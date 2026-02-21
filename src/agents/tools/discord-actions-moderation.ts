import type { RequestClient } from "@buape/carbon";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { DiscordActionConfig } from "../../config/config.js";
import {
  banMemberDiscord,
  hasAnyGuildPermissionDiscord,
  kickMemberDiscord,
  timeoutMemberDiscord,
} from "../../discord/send.js";
import type { DiscordReactOpts } from "../../discord/send.types.js";
import { type ActionGate, jsonResult, readStringParam } from "./common.js";
import {
  isDiscordModerationAction,
  readDiscordModerationCommand,
  requiredGuildPermissionForModerationAction,
} from "./discord-actions-moderation-shared.js";

/**
 * Build base opts for Discord REST calls.
 */
function buildBaseOpts(params: Record<string, unknown>): DiscordReactOpts {
  const restOverride = params._rest as RequestClient | undefined;
  if (restOverride) {
    return { rest: restOverride };
  }
  const accountId = readStringParam(params, "accountId");
  return accountId ? { accountId } : {};
}

async function verifySenderModerationPermission(params: {
  guildId: string;
  senderUserId?: string;
  requiredPermission: bigint;
  opts?: DiscordReactOpts;
}) {
  // CLI/manual flows may not have sender context; enforce only when present.
  if (!params.senderUserId) {
    return;
  }
  const hasPermission = await hasAnyGuildPermissionDiscord(
    params.guildId,
    params.senderUserId,
    [params.requiredPermission],
    params.opts,
  );
  if (!hasPermission) {
    throw new Error("Sender does not have required permissions for this moderation action.");
  }
}

export async function handleDiscordModerationAction(
  action: string,
  params: Record<string, unknown>,
  isActionEnabled: ActionGate<DiscordActionConfig>,
): Promise<AgentToolResult<unknown>> {
  if (!isDiscordModerationAction(action)) {
    throw new Error(`Unknown action: ${action}`);
  }
  if (!isActionEnabled("moderation", false)) {
    throw new Error("Discord moderation is disabled.");
  }
  const command = readDiscordModerationCommand(action, params);
  const baseOpts = buildBaseOpts(params);
  const senderUserId = readStringParam(params, "senderUserId");
  await verifySenderModerationPermission({
    guildId: command.guildId,
    senderUserId,
    requiredPermission: requiredGuildPermissionForModerationAction(command.action),
    opts: baseOpts,
  });
  switch (command.action) {
    case "timeout": {
      const member = await timeoutMemberDiscord(
        {
          guildId: command.guildId,
          userId: command.userId,
          durationMinutes: command.durationMinutes,
          until: command.until,
          reason: command.reason,
        },
        baseOpts,
      );
      return jsonResult({ ok: true, member });
    }
    case "kick": {
      await kickMemberDiscord(
        {
          guildId: command.guildId,
          userId: command.userId,
          reason: command.reason,
        },
        baseOpts,
      );
      return jsonResult({ ok: true });
    }
    case "ban": {
      await banMemberDiscord(
        {
          guildId: command.guildId,
          userId: command.userId,
          reason: command.reason,
          deleteMessageDays: command.deleteMessageDays,
        },
        baseOpts,
      );
      return jsonResult({ ok: true });
    }
  }
}
