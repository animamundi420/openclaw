import { getGuildRegistry } from "../../discord-access/guild-registry.js";
import { logVerbose } from "../../globals.js";
import type { DiscordUserRawMessage, DiscordUserMessageHandlerParams } from "./message-handler.js";
import { handleDiscordUserMessage } from "./message-handler.js";

export type DiscordUserEventHandlerParams = DiscordUserMessageHandlerParams;

/**
 * Dispatch a gateway event to the appropriate handler.
 */
export async function handleDiscordUserEvent(
  event: string,
  data: unknown,
  params: DiscordUserEventHandlerParams,
): Promise<void> {
  switch (event) {
    case "MESSAGE_CREATE": {
      const message = data as DiscordUserRawMessage;
      if (!message?.id || !message?.author) {
        logVerbose("discord-user: drop MESSAGE_CREATE (missing id or author)");
        return;
      }
      try {
        await handleDiscordUserMessage(message, params);
      } catch (err) {
        params.runtime.error(
          `discord-user: message handler error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      break;
    }
    case "GUILD_CREATE": {
      const guild = data as { id?: string; unavailable?: boolean };
      if (guild?.id && !guild.unavailable) {
        getGuildRegistry().registerAccess(guild.id, "user", params.accountId);
        logVerbose(`discord-user: GUILD_CREATE → registered access for guild ${guild.id}`);
      }
      break;
    }
    case "GUILD_DELETE": {
      const guild = data as { id?: string };
      if (guild?.id) {
        getGuildRegistry().removeAccess(guild.id, "user");
        logVerbose(`discord-user: GUILD_DELETE → removed access for guild ${guild.id}`);
      }
      break;
    }
    default:
      break;
  }
}
