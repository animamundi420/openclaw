import type { RequestClient } from "@buape/carbon";
import type { DiscordUserRestClient } from "../discord-user/rest.js";
import type { AccessEntry, AccessSource } from "./types.js";

/**
 * Negative-cache entry: when a 403/404 proves access is lost, we mark it
 * as removed with a TTL so we don't keep retrying.
 */
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type NegativeCacheEntry = {
  source: AccessSource;
  guildId: string;
  expiry: number;
};

type ClientEntry = {
  rest: RequestClient | DiscordUserRestClient;
  accountId: string;
};

/**
 * In-memory singleton that tracks which Discord identities have access to
 * which guilds, and holds references to the REST clients for each source.
 */
class GuildAccessRegistry {
  private guilds = new Map<string, AccessEntry>();
  private clients = new Map<AccessSource, ClientEntry>();
  private negativeCache: NegativeCacheEntry[] = [];

  // ── Guild membership tracking ──────────────────────────────────────

  registerAccess(guildId: string, source: AccessSource, accountId: string): void {
    const existing = this.guilds.get(guildId) ?? {
      bot: false,
      user: false,
    };
    existing[source] = true;
    if (source === "bot") {
      existing.botAccountId = accountId;
    } else {
      existing.userAccountId = accountId;
    }
    this.guilds.set(guildId, existing);
    // Clear any negative cache for this guild + source
    this.negativeCache = this.negativeCache.filter(
      (e) => !(e.guildId === guildId && e.source === source),
    );
  }

  removeAccess(guildId: string, source: AccessSource): void {
    const existing = this.guilds.get(guildId);
    if (!existing) {
      return;
    }
    existing[source] = false;
    if (source === "bot") {
      existing.botAccountId = undefined;
    } else {
      existing.userAccountId = undefined;
    }
    // If neither has access, remove the entry entirely
    if (!existing.bot && !existing.user) {
      this.guilds.delete(guildId);
    }
  }

  /**
   * Mark access as lost due to a 403/404 response. Uses negative cache
   * with TTL so periodic re-checks can restore access.
   */
  markAccessLost(guildId: string, source: AccessSource): void {
    this.removeAccess(guildId, source);
    this.negativeCache.push({
      source,
      guildId,
      expiry: Date.now() + NEGATIVE_CACHE_TTL_MS,
    });
  }

  getAccess(guildId: string): AccessEntry | null {
    this.pruneNegativeCache();
    return this.guilds.get(guildId) ?? null;
  }

  listGuildsWithAccess(source?: AccessSource): string[] {
    const result: string[] = [];
    for (const [guildId, entry] of this.guilds) {
      if (!source || entry[source]) {
        result.push(guildId);
      }
    }
    return result;
  }

  // ── REST client references ─────────────────────────────────────────

  registerClient(
    source: AccessSource,
    rest: RequestClient | DiscordUserRestClient,
    accountId: string,
  ): void {
    this.clients.set(source, { rest, accountId });
  }

  getClient(source: AccessSource): ClientEntry | null {
    return this.clients.get(source) ?? null;
  }

  getBotRest(): RequestClient | null {
    const entry = this.clients.get("bot");
    return entry ? (entry.rest as RequestClient) : null;
  }

  getUserRest(): DiscordUserRestClient | null {
    const entry = this.clients.get("user");
    return entry ? (entry.rest as DiscordUserRestClient) : null;
  }

  hasAnyClient(): boolean {
    return this.clients.size > 0;
  }

  hasBothClients(): boolean {
    return this.clients.has("bot") && this.clients.has("user");
  }

  // ── Internals ──────────────────────────────────────────────────────

  private pruneNegativeCache(): void {
    const now = Date.now();
    this.negativeCache = this.negativeCache.filter((e) => e.expiry > now);
  }

  /** Clear all state (for testing). */
  reset(): void {
    this.guilds.clear();
    this.clients.clear();
    this.negativeCache = [];
  }
}

// Module-level singleton
const registry = new GuildAccessRegistry();

export function getGuildRegistry(): GuildAccessRegistry {
  return registry;
}

export { GuildAccessRegistry };
