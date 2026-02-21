import type { OpenClawConfig } from "../../config/config.js";
import { getGuildRegistry } from "../../discord-access/guild-registry.js";
import { logVerbose } from "../../globals.js";
import type { RuntimeEnv } from "../../runtime.js";
import { resolveDiscordUserAccount } from "../accounts.js";
import { DiscordUserGateway, type GatewayReadyData } from "../gateway.js";
import { createDiscordUserRestClient } from "../rest.js";
import { buildStealthFingerprint, type StealthConfig } from "../stealth.js";
import { handleDiscordUserEvent } from "./event-handler.js";

export type MonitorDiscordUserProviderParams = {
  token: string;
  accountId: string;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
  abortSignal?: AbortSignal;
};

/**
 * Start monitoring Discord as a user account.
 *
 * 1. Resolves stealth fingerprint from config
 * 2. Creates REST client with raw-token auth
 * 3. Connects WebSocket gateway with user IDENTIFY
 * 4. Dispatches events to the event handler
 * 5. Cleans up on abort signal
 */
export async function monitorDiscordUserProvider(
  params: MonitorDiscordUserProviderParams,
): Promise<void> {
  const { token, accountId, config, runtime, abortSignal } = params;
  const account = resolveDiscordUserAccount({ cfg: config, accountId });
  const stealthConfig: StealthConfig = account.config.stealth ?? {};
  const fingerprint = buildStealthFingerprint(stealthConfig);

  const rest = createDiscordUserRestClient({
    token,
    fingerprint,
  });

  // Register user REST client with the unified access registry
  const guildRegistry = getGuildRegistry();
  guildRegistry.registerClient("user", rest, accountId);

  const gateway = new DiscordUserGateway(token, fingerprint);
  let selfUserId = "";

  gateway.on("ready", (data: GatewayReadyData) => {
    selfUserId = data.user.id;
    runtime.log(
      `[${accountId}] discord-user gateway connected as ${data.user.username}#${data.user.discriminator} (${data.user.id}), ${data.guilds.length} guild(s)`,
    );
    // Register guild access for each guild the user account is in
    for (const guild of data.guilds) {
      if (!guild.unavailable) {
        guildRegistry.registerAccess(guild.id, "user", accountId);
      }
    }
  });

  gateway.on("dispatch", (event: string, data: unknown) => {
    if (!selfUserId) {
      // Haven't finished READY yet — buffer or skip
      return;
    }
    void handleDiscordUserEvent(event, data, {
      cfg: config,
      accountId,
      selfUserId,
      rest,
      runtime,
    });
  });

  gateway.on("close", (code: number, reason: string) => {
    logVerbose(`discord-user: gateway closed (code=${code}, reason=${reason})`);
  });

  gateway.on("error", (err: Error) => {
    runtime.error(`discord-user gateway error: ${err.message}`);
  });

  // Wire abort signal for clean shutdown
  if (abortSignal) {
    const onAbort = () => {
      gateway.disconnect();
      abortSignal.removeEventListener("abort", onAbort);
    };
    if (abortSignal.aborted) {
      return;
    }
    abortSignal.addEventListener("abort", onAbort);
  }

  gateway.connect();
}
