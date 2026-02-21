import type { GuildAccessRegistry } from "./guild-registry.js";
import type { AccessSource } from "./types.js";

/**
 * Policy: which access source is preferred for which operations.
 * Currently all operations prefer bot (safer, better rate limits).
 * User account serves as fallback when bot lacks guild access or gets 403.
 */
export type DiscordAccessPolicy = {
  /** Operations where bot is preferred (default for everything). */
  botPreferred: Set<string>;
  /** Operations where user account is required (bot literally can't). */
  userOnly: Set<string>;
  /** Operations where user account is preferred (stealth advantage). */
  userPreferred: Set<string>;
};

export const DEFAULT_ACCESS_POLICY: DiscordAccessPolicy = {
  botPreferred: new Set([
    "readMessages",
    "sendMessage",
    "react",
    "searchMessages",
    "editMessage",
    "deleteMessage",
    "fetchMessage",
    "threadCreate",
    "threadList",
    "threadReply",
    "pinMessage",
    "unpinMessage",
    "listPins",
    "memberInfo",
    "roleInfo",
    "channelInfo",
    "channelList",
    "roleAdd",
    "roleRemove",
    "emojiList",
    "emojiUpload",
    "stickerUpload",
    "channelCreate",
    "channelEdit",
    "channelDelete",
    "channelMove",
    "channelPermissionSet",
    "channelPermissionRemove",
    "voiceStatus",
    "eventList",
    "eventCreate",
    "timeout",
    "kick",
    "ban",
  ]),
  userOnly: new Set<string>(),
  userPreferred: new Set<string>(),
};

/**
 * Given a guild ID, determine which access source to use as primary
 * and which as fallback, based on registry state and preference.
 */
export function resolveAccessRoute(opts: {
  guildId: string;
  registry: GuildAccessRegistry;
  prefer: AccessSource;
  hasBotRest: boolean;
  hasUserRest: boolean;
}): { primary: AccessSource; secondary: AccessSource | null } {
  const { guildId, registry, prefer, hasBotRest, hasUserRest } = opts;
  const access = registry.getAccess(guildId);
  const other: AccessSource = prefer === "bot" ? "user" : "bot";

  const hasPreferredRest = prefer === "bot" ? hasBotRest : hasUserRest;
  const hasOtherRest = other === "bot" ? hasBotRest : hasUserRest;

  // No access info — use preferred if client exists, fallback to other
  if (!access) {
    if (hasPreferredRest) {
      return { primary: prefer, secondary: hasOtherRest ? other : null };
    }
    if (hasOtherRest) {
      return { primary: other, secondary: null };
    }
    return { primary: prefer, secondary: null };
  }

  const preferredHasAccess = access[prefer];
  const otherHasAccess = access[other];

  // Preferred has access and client exists → use it
  if (preferredHasAccess && hasPreferredRest) {
    return {
      primary: prefer,
      secondary: otherHasAccess && hasOtherRest ? other : null,
    };
  }

  // Preferred has no access but other does → use other
  if (otherHasAccess && hasOtherRest) {
    return {
      primary: other,
      secondary: preferredHasAccess && hasPreferredRest ? prefer : null,
    };
  }

  // Only preferred client exists (even without confirmed access)
  if (hasPreferredRest) {
    return { primary: prefer, secondary: hasOtherRest ? other : null };
  }

  // Only other client exists
  if (hasOtherRest) {
    return { primary: other, secondary: null };
  }

  return { primary: prefer, secondary: null };
}
