import type { OpenClawConfig } from "../config/config.js";
import type { SessionEntry, SessionMaintenanceWarning } from "../config/sessions.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { isDeliverableMessageChannel, normalizeMessageChannel } from "../utils/message-channel.js";
import { buildOutboundSessionContext } from "./outbound/session-context.js";
import { resolveSessionDeliveryTarget } from "./outbound/targets.js";
import { enqueueSystemEvent } from "./system-events.js";

type WarningParams = {
  cfg: OpenClawConfig;
  sessionKey: string;
  entry: SessionEntry;
  warning: SessionMaintenanceWarning;
};

type WarningState = { context: string; sentAtMs: number };

const warnedContexts = new Map<string, WarningState>();
const log = createSubsystemLogger("session-maintenance-warning");
const DEFAULT_WARNING_COOLDOWN_MS = 60 * 60 * 1000;

function shouldSendWarning(): boolean {
  return !process.env.VITEST && process.env.NODE_ENV !== "test";
}

function buildWarningContext(params: WarningParams): string {
  const { warning } = params;
  return [
    warning.pruneAfterMs,
    warning.maxEntries,
    warning.wouldPrune ? "prune" : "",
    warning.wouldCap ? "cap" : "",
  ]
    .filter(Boolean)
    .join("|");
}

function resolveWarningCooldownMs(): number {
  const raw = process.env.OPENCLAW_SESSION_MAINTENANCE_WARNING_COOLDOWN_MS;
  if (!raw) {
    return DEFAULT_WARNING_COOLDOWN_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_WARNING_COOLDOWN_MS;
  }
  return Math.floor(parsed);
}

function buildWarningScopeKey(params: {
  sessionKey: string;
  target: { channel?: string; to?: string; accountId?: string; threadId?: string | number };
}): string {
  if (params.target.channel && params.target.to) {
    const channel = normalizeMessageChannel(params.target.channel) ?? params.target.channel;
    return [
      channel,
      params.target.to,
      params.target.accountId ?? "",
      params.target.threadId ?? "",
    ].join(":");
  }
  return `system:${params.sessionKey}`;
}

function shouldSuppressWarning(params: {
  scopeKey: string;
  context: string;
  nowMs: number;
  cooldownMs: number;
}): boolean {
  const current = warnedContexts.get(params.scopeKey);
  if (!current) {
    return false;
  }
  if (current.context !== params.context) {
    return false;
  }
  return params.nowMs - current.sentAtMs < params.cooldownMs;
}

function markWarningSent(params: {
  scopeKey: string;
  context: string;
  nowMs: number;
  cooldownMs: number;
}) {
  warnedContexts.set(params.scopeKey, { context: params.context, sentAtMs: params.nowMs });

  if (warnedContexts.size < 512) {
    return;
  }
  for (const [key, state] of warnedContexts) {
    if (params.nowMs - state.sentAtMs >= params.cooldownMs) {
      warnedContexts.delete(key);
    }
  }
}

function formatDuration(ms: number): string {
  if (ms >= 86_400_000) {
    const days = Math.round(ms / 86_400_000);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (ms >= 3_600_000) {
    const hours = Math.round(ms / 3_600_000);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (ms >= 60_000) {
    const mins = Math.round(ms / 60_000);
    return `${mins} minute${mins === 1 ? "" : "s"}`;
  }
  const secs = Math.round(ms / 1000);
  return `${secs} second${secs === 1 ? "" : "s"}`;
}

function buildWarningText(warning: SessionMaintenanceWarning): string {
  const reasons: string[] = [];
  if (warning.wouldPrune) {
    reasons.push(`older than ${formatDuration(warning.pruneAfterMs)}`);
  }
  if (warning.wouldCap) {
    reasons.push(`not in the most recent ${warning.maxEntries} sessions`);
  }
  const reasonText = reasons.length > 0 ? reasons.join(" and ") : "over maintenance limits";
  return (
    `⚠️ Session maintenance warning: this active session would be evicted (${reasonText}). ` +
    `Maintenance is set to warn-only, so nothing was reset. ` +
    `To enforce cleanup, set \`session.maintenance.mode: "enforce"\` or increase the limits.`
  );
}

export async function deliverSessionMaintenanceWarning(params: WarningParams): Promise<void> {
  if (!shouldSendWarning()) {
    return;
  }

  const target = resolveSessionDeliveryTarget({
    entry: params.entry,
    requestedChannel: "last",
  });
  const scopeKey = buildWarningScopeKey({
    sessionKey: params.sessionKey,
    target,
  });
  const contextKey = buildWarningContext(params);
  const nowMs = Date.now();
  const cooldownMs = resolveWarningCooldownMs();
  if (
    shouldSuppressWarning({
      scopeKey,
      context: contextKey,
      nowMs,
      cooldownMs,
    })
  ) {
    return;
  }
  markWarningSent({
    scopeKey,
    context: contextKey,
    nowMs,
    cooldownMs,
  });

  const text = buildWarningText(params.warning);

  if (!target.channel || !target.to) {
    enqueueSystemEvent(text, { sessionKey: params.sessionKey });
    return;
  }

  const channel = normalizeMessageChannel(target.channel) ?? target.channel;
  if (!isDeliverableMessageChannel(channel)) {
    enqueueSystemEvent(text, { sessionKey: params.sessionKey });
    return;
  }

  try {
    const { deliverOutboundPayloads } = await import("./outbound/deliver.js");
    const outboundSession = buildOutboundSessionContext({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
    });
    await deliverOutboundPayloads({
      cfg: params.cfg,
      channel,
      to: target.to,
      accountId: target.accountId,
      threadId: target.threadId,
      payloads: [{ text }],
      session: outboundSession,
    });
  } catch (err) {
    log.warn(`Failed to deliver session maintenance warning: ${String(err)}`);
    enqueueSystemEvent(text, { sessionKey: params.sessionKey });
  }
}
