import { RequestClient, type RequestData } from "@buape/carbon";
import type { DiscordUserRestClient } from "../discord-user/rest.js";
import { resolveActionJitter } from "../discord-user/stealth.js";
import type { GuildAccessRegistry } from "./guild-registry.js";
import { resolveAccessRoute } from "./router.js";
import type { AccessSource } from "./types.js";

/**
 * Extract a guild ID from a Discord API path.
 * Matches patterns like `/guilds/123/...` or `/channels/456/...` where
 * the channel lookup would need a separate call (not implemented here;
 * we only extract from explicit guild paths).
 */
export function extractGuildIdFromPath(path: string): string | undefined {
  const match = path.match(/\/guilds\/(\d+)/);
  return match?.[1];
}

const ACCESS_DENIED_STATUSES = new Set([403, 404]);

/**
 * Build a Discord-API-style error from a Response, matching the shape
 * that callers expect from Carbon's DiscordError (status, rawBody, code).
 */
async function buildAdapterError(res: Response): Promise<Error> {
  let rawBody: unknown;
  let discordCode: number | undefined;
  try {
    const text = await res.text();
    if (text) {
      rawBody = JSON.parse(text);
      if (rawBody && typeof rawBody === "object" && "code" in rawBody) {
        discordCode = (rawBody as { code?: number }).code;
      }
    }
  } catch {
    // body parse failed — still throw with status
  }
  return Object.assign(new Error(`Discord API error: ${res.status}`), {
    status: res.status,
    ...(discordCode !== undefined ? { code: discordCode, discordCode } : {}),
    ...(rawBody !== undefined ? { rawBody } : {}),
  });
}

/**
 * Wraps a DiscordUserRestClient to match the RequestClient interface
 * used by the bot-side Discord functions.
 *
 * Key adaptations:
 * - Bot: `post(path, { body })` → User: `post(path, body)`
 * - Bot: `get(path, queryParams)` → User: `get(pathWithQueryString)`
 * - Bot returns parsed JSON → User returns Response (we call .json())
 * - Bot: `RequestData.headers` → forwarded as extra headers on the fetch
 */
function adaptUserRestForBotInterface(userRest: DiscordUserRestClient) {
  async function parseResponse(res: Response): Promise<unknown> {
    if (res.status === 204) {
      return undefined;
    }
    const text = await res.text();
    if (!text) {
      return undefined;
    }
    return JSON.parse(text);
  }

  async function throwIfNotOk(res: Response): Promise<void> {
    if (!res.ok) {
      throw await buildAdapterError(res);
    }
  }

  function buildPathWithQuery(
    path: string,
    query?: Record<string, string | number | boolean>,
  ): string {
    if (!query || Object.keys(query).length === 0) {
      return path;
    }
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      qs.set(key, String(value));
    }
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}${qs.toString()}`;
  }

  /**
   * Build RequestInit for methods that accept a body + optional headers.
   * Forwards RequestData.headers (e.g. X-Audit-Log-Reason) through the
   * user REST client's fetch init.  The user REST client's `doFetch` merges
   * these on top of its base headers, so we only need to set extras here.
   * Content-Type is included for JSON bodies since `fetch()` (unlike `post()`)
   * doesn't automatically use jsonHeaders.
   */
  function buildFetchInit(method: string, data?: RequestData): RequestInit {
    const init: RequestInit = { method };
    const extraHeaders: Record<string, string> = {};
    if (data?.body !== undefined) {
      init.body = data.rawBody ? (data.body as BodyInit) : JSON.stringify(data.body);
      if (!data.rawBody) {
        extraHeaders["Content-Type"] = "application/json";
      }
    }
    if (data?.headers) {
      Object.assign(extraHeaders, data.headers);
    }
    if (Object.keys(extraHeaders).length > 0) {
      init.headers = extraHeaders;
    }
    return init;
  }

  // Use the raw fetch path when RequestData contains headers or rawBody,
  // since the convenience methods (post/put/patch) would lose headers and
  // unconditionally JSON.stringify the body.
  const needsRawFetch = (data?: RequestData) => Boolean(data?.headers || data?.rawBody);

  return {
    get: async (path: string, query?: Record<string, string | number | boolean>) => {
      const fullPath = buildPathWithQuery(path, query);
      const res = await userRest.get(fullPath);
      await throwIfNotOk(res);
      return parseResponse(res);
    },
    post: async (
      path: string,
      data?: RequestData,
      query?: Record<string, string | number | boolean>,
    ) => {
      const fullPath = buildPathWithQuery(path, query);
      const res = needsRawFetch(data)
        ? await userRest.fetch(fullPath, buildFetchInit("POST", data))
        : await userRest.post(fullPath, data?.body);
      await throwIfNotOk(res);
      return parseResponse(res);
    },
    put: async (
      path: string,
      data?: RequestData,
      query?: Record<string, string | number | boolean>,
    ) => {
      const fullPath = buildPathWithQuery(path, query);
      const res = needsRawFetch(data)
        ? await userRest.fetch(fullPath, buildFetchInit("PUT", data))
        : await userRest.put(fullPath, data?.body);
      await throwIfNotOk(res);
      return parseResponse(res);
    },
    patch: async (
      path: string,
      data?: RequestData,
      query?: Record<string, string | number | boolean>,
    ) => {
      const fullPath = buildPathWithQuery(path, query);
      const res = needsRawFetch(data)
        ? await userRest.fetch(fullPath, buildFetchInit("PATCH", data))
        : await userRest.patch(fullPath, data?.body);
      await throwIfNotOk(res);
      return parseResponse(res);
    },
    delete: async (
      path: string,
      data?: RequestData,
      query?: Record<string, string | number | boolean>,
    ) => {
      const fullPath = buildPathWithQuery(path, query);
      const res = needsRawFetch(data)
        ? await userRest.fetch(fullPath, buildFetchInit("DELETE", data))
        : await userRest.delete(fullPath);
      await throwIfNotOk(res);
      return parseResponse(res);
    },
  };
}

type AdaptedUserRest = ReturnType<typeof adaptUserRestForBotInterface>;

function isAccessDeniedError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const status = (err as { status?: number }).status;
  return status !== undefined && ACCESS_DENIED_STATUSES.has(status);
}

/**
 * A RequestClient subclass that transparently routes Discord API requests
 * through the most appropriate REST client (bot or user account) based on
 * guild access information from the GuildAccessRegistry.
 *
 * Routing logic per request:
 * 1. Extract guildId from the request path
 * 2. Look up guild in registry → pick preferred client
 * 3. On 403/404 → retry with the other client, update registry
 */
export class UnifiedDiscordRest extends RequestClient {
  private botRest: RequestClient | null;
  private adaptedUserRest: AdaptedUserRest | null;
  private registry: GuildAccessRegistry;
  private prefer: AccessSource;

  constructor(opts: {
    botRest: RequestClient | null;
    userRest: DiscordUserRestClient | null;
    registry: GuildAccessRegistry;
    prefer?: AccessSource;
  }) {
    // Pass a dummy token — we override all request methods
    super("unified-facade-token", { queueRequests: false });
    this.botRest = opts.botRest;
    this.adaptedUserRest = opts.userRest ? adaptUserRestForBotInterface(opts.userRest) : null;
    this.registry = opts.registry;
    this.prefer = opts.prefer ?? "bot";
  }

  private getRestForSource(source: AccessSource): RequestClient | AdaptedUserRest | null {
    return source === "bot" ? this.botRest : this.adaptedUserRest;
  }

  private pickSource(guildId: string | undefined): {
    primary: AccessSource;
    secondary: AccessSource | null;
  } {
    if (!guildId) {
      // No guild context — use preferred, no fallback
      const hasPrimary = this.getRestForSource(this.prefer) !== null;
      const other: AccessSource = this.prefer === "bot" ? "user" : "bot";
      if (hasPrimary) {
        return { primary: this.prefer, secondary: this.getRestForSource(other) ? other : null };
      }
      return { primary: other, secondary: null };
    }

    return resolveAccessRoute({
      guildId,
      registry: this.registry,
      prefer: this.prefer,
      hasBotRest: this.botRest !== null,
      hasUserRest: this.adaptedUserRest !== null,
    });
  }

  private async routeRequest<T>(
    path: string,
    execute: (rest: RequestClient | AdaptedUserRest) => Promise<T>,
  ): Promise<T> {
    const guildId = extractGuildIdFromPath(path);
    const { primary, secondary } = this.pickSource(guildId);

    const primaryRest = this.getRestForSource(primary);
    if (!primaryRest) {
      if (secondary) {
        const secondaryRest = this.getRestForSource(secondary);
        if (secondaryRest) {
          if (secondary === "user") {
            await this.addStealthDelay();
          }
          return execute(secondaryRest);
        }
      }
      throw new Error("No Discord REST client available");
    }

    // Add stealth delay when using user account
    if (primary === "user") {
      await this.addStealthDelay();
    }

    try {
      return await execute(primaryRest);
    } catch (err) {
      // On 403/404, try the secondary client
      if (isAccessDeniedError(err) && secondary) {
        const secondaryRest = this.getRestForSource(secondary);
        if (secondaryRest) {
          // Mark primary as having lost access for this guild
          if (guildId) {
            this.registry.markAccessLost(guildId, primary);
          }
          if (secondary === "user") {
            await this.addStealthDelay();
          }
          return execute(secondaryRest);
        }
      }
      throw err;
    }
  }

  private async addStealthDelay(): Promise<void> {
    const jitter = resolveActionJitter();
    if (jitter > 0) {
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  // ── Override all RequestClient methods ──────────────────────────────

  override async get(
    path: string,
    query?: Record<string, string | number | boolean>,
  ): Promise<unknown> {
    return this.routeRequest(path, (rest) => rest.get(path, query));
  }

  override async post(
    path: string,
    data?: RequestData,
    query?: Record<string, string | number | boolean>,
  ): Promise<unknown> {
    return this.routeRequest(path, (rest) => rest.post(path, data, query));
  }

  override async put(
    path: string,
    data?: RequestData,
    query?: Record<string, string | number | boolean>,
  ): Promise<unknown> {
    return this.routeRequest(path, (rest) => rest.put(path, data, query));
  }

  override async patch(
    path: string,
    data?: RequestData,
    query?: Record<string, string | number | boolean>,
  ): Promise<unknown> {
    return this.routeRequest(path, (rest) => rest.patch(path, data, query));
  }

  override async delete(
    path: string,
    data?: RequestData,
    query?: Record<string, string | number | boolean>,
  ): Promise<unknown> {
    return this.routeRequest(path, (rest) => rest.delete(path, data, query));
  }
}

/**
 * Create a unified Discord REST client that routes through bot or user
 * account based on guild access.
 */
export function createUnifiedDiscordRest(opts: {
  botRest: RequestClient | null;
  userRest: DiscordUserRestClient | null;
  registry: GuildAccessRegistry;
  prefer?: AccessSource;
}): UnifiedDiscordRest {
  return new UnifiedDiscordRest(opts);
}
