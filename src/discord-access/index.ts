import type { RequestClient } from "@buape/carbon";
import { getGuildRegistry } from "./guild-registry.js";
import { UnifiedDiscordRest } from "./rest-facade.js";

export { GuildAccessRegistry, getGuildRegistry } from "./guild-registry.js";
export {
  UnifiedDiscordRest,
  createUnifiedDiscordRest,
  extractGuildIdFromPath,
} from "./rest-facade.js";
export { resolveAccessRoute, DEFAULT_ACCESS_POLICY } from "./router.js";
export type { AccessEntry, AccessSource, AccessRoutingMeta, RegisteredClient } from "./types.js";
export type { DiscordAccessPolicy } from "./router.js";

/**
 * Returns a unified Discord REST client if both bot and user REST clients
 * are registered. Returns null if only one (or neither) is available,
 * since there's nothing to unify.
 *
 * When only a bot client exists (no user account configured), returns null
 * and the caller should fall back to the normal bot-only path.
 */
export function getUnifiedDiscordRest(): RequestClient | null {
  const registry = getGuildRegistry();

  // Need at least one client; prefer unified only when both exist
  if (!registry.hasAnyClient()) {
    return null;
  }

  const botRest = registry.getBotRest();
  const userRest = registry.getUserRest();

  // If only one client exists, return it directly (bot as RequestClient,
  // or null to let the normal path handle it).
  // The unified facade is only useful when both clients exist.
  if (!botRest || !userRest) {
    return null;
  }

  return new UnifiedDiscordRest({
    botRest,
    userRest,
    registry,
    prefer: "bot",
  });
}
