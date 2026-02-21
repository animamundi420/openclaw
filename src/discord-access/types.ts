import type { RequestClient } from "@buape/carbon";
import type { DiscordUserRestClient } from "../discord-user/rest.js";

/**
 * Tracks which Discord identity (bot or user account) has access to a guild.
 */
export type AccessEntry = {
  bot: boolean;
  user: boolean;
  botAccountId?: string;
  userAccountId?: string;
};

/**
 * Source of a Discord access: the bot channel or user account channel.
 */
export type AccessSource = "bot" | "user";

/**
 * Registered REST client for a given access source.
 */
export type RegisteredClient = {
  source: AccessSource;
  rest: RequestClient | DiscordUserRestClient;
  accountId: string;
};

/**
 * Result metadata indicating which access method was used.
 */
export type AccessRoutingMeta = {
  accessedVia: AccessSource;
  guildId?: string;
  fellBack: boolean;
};
