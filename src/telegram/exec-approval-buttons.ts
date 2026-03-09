import type { ExecApprovalDecision } from "../infra/exec-approvals.js";
import type { TelegramInlineButtons } from "./button-types.js";
import { parseTelegramTarget } from "./targets.js";

const CALLBACK_PREFIX = "eap";
const MAX_CALLBACK_DATA_BYTES = 64;
const APPROVAL_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const ACTION_TO_CODE: Record<ExecApprovalDecision, "o" | "a" | "d"> = {
  "allow-once": "o",
  "allow-always": "a",
  deny: "d",
};

const CODE_TO_ACTION: Record<string, ExecApprovalDecision> = {
  o: "allow-once",
  a: "allow-always",
  d: "deny",
};

export const EXEC_APPROVAL_CALLBACK_PREFIX = CALLBACK_PREFIX;

export type ParsedTelegramExecApprovalCallback = {
  approvalId: string;
  decision: ExecApprovalDecision;
};

type TelegramExecApprovalBinding = {
  chatId: string;
  accountId?: string;
  threadId?: string;
  expectedUserId?: string;
  expiresAtMs: number;
};

const bindingsByApprovalId = new Map<string, TelegramExecApprovalBinding[]>();

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNumericId(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  return /^\d+$/.test(normalized) ? normalized : undefined;
}

export function isValidExecApprovalId(id: string): boolean {
  return APPROVAL_ID_REGEX.test(id);
}

function buildCallbackData(id: string, decision: ExecApprovalDecision): string {
  const encodedId = encodeURIComponent(id);
  return `${CALLBACK_PREFIX}:${ACTION_TO_CODE[decision]}:${encodedId}`;
}

function isCallbackDataWithinLimit(data: string): boolean {
  return Buffer.byteLength(data, "utf8") <= MAX_CALLBACK_DATA_BYTES;
}

export function buildTelegramExecApprovalButtons(params: {
  approvalId: string;
}): TelegramInlineButtons | undefined {
  const approvalId = params.approvalId.trim();
  if (!isValidExecApprovalId(approvalId)) {
    return undefined;
  }

  const allowOnce = buildCallbackData(approvalId, "allow-once");
  const allowAlways = buildCallbackData(approvalId, "allow-always");
  const deny = buildCallbackData(approvalId, "deny");

  if (
    !isCallbackDataWithinLimit(allowOnce) ||
    !isCallbackDataWithinLimit(allowAlways) ||
    !isCallbackDataWithinLimit(deny)
  ) {
    return undefined;
  }

  return [
    [
      { text: "Approve once", callback_data: allowOnce, style: "success" },
      { text: "Approve always", callback_data: allowAlways, style: "primary" },
      { text: "Deny", callback_data: deny, style: "danger" },
    ],
  ];
}

export function parseTelegramExecApprovalCallbackData(
  data: string,
): ParsedTelegramExecApprovalCallback | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith(`${CALLBACK_PREFIX}:`)) {
    return null;
  }
  const parts = trimmed.split(":");
  if (parts.length !== 3) {
    return null;
  }

  const action = CODE_TO_ACTION[parts[1] ?? ""];
  const encodedId = parts[2] ?? "";
  if (!action || !encodedId) {
    return null;
  }

  let approvalId = "";
  try {
    approvalId = decodeURIComponent(encodedId);
  } catch {
    return null;
  }
  if (!isValidExecApprovalId(approvalId)) {
    return null;
  }

  return { approvalId, decision: action };
}

export function buildExecApprovalCommandFromCallback(
  callback: ParsedTelegramExecApprovalCallback,
): string {
  return `/approve ${callback.approvalId} ${callback.decision}`;
}

export function registerTelegramExecApprovalBinding(params: {
  approvalId: string;
  chatId: string;
  expiresAtMs: number;
  accountId?: string;
  threadId?: string | number;
  expectedUserId?: string;
}): boolean {
  const approvalId = params.approvalId.trim();
  if (!isValidExecApprovalId(approvalId)) {
    return false;
  }
  const chatId = normalizeOptionalString(params.chatId);
  if (!chatId) {
    return false;
  }

  const nextBinding: TelegramExecApprovalBinding = {
    chatId,
    accountId: normalizeOptionalString(params.accountId),
    threadId:
      params.threadId != null && `${params.threadId}`.trim()
        ? `${params.threadId}`.trim()
        : undefined,
    expectedUserId: normalizeNumericId(params.expectedUserId),
    expiresAtMs: Number.isFinite(params.expiresAtMs) ? params.expiresAtMs : 0,
  };

  const existing = bindingsByApprovalId.get(approvalId) ?? [];
  const dedupeKey = [
    nextBinding.chatId,
    nextBinding.accountId ?? "",
    nextBinding.threadId ?? "",
    nextBinding.expectedUserId ?? "",
  ].join(":");

  const deduped = existing.filter((binding) => {
    const key = [
      binding.chatId,
      binding.accountId ?? "",
      binding.threadId ?? "",
      binding.expectedUserId ?? "",
    ].join(":");
    return key !== dedupeKey;
  });

  deduped.push(nextBinding);
  bindingsByApprovalId.set(approvalId, deduped);
  return true;
}

export function clearTelegramExecApprovalBindings(approvalId: string): void {
  const normalized = approvalId.trim();
  if (!normalized) {
    return;
  }
  bindingsByApprovalId.delete(normalized);
}

export function resolveTelegramExecApprovalCallback(params: {
  callback: ParsedTelegramExecApprovalCallback;
  chatId: string;
  accountId?: string;
  threadId?: string | number;
  userId?: string;
  nowMs?: () => number;
}):
  | { ok: true; command: string }
  | {
      ok: false;
      reason:
        | "not-found"
        | "expired"
        | "account-mismatch"
        | "chat-mismatch"
        | "thread-mismatch"
        | "user-mismatch";
    } {
  const approvalId = params.callback.approvalId;
  const nowMs = params.nowMs ?? Date.now;
  const now = nowMs();

  const bindings = bindingsByApprovalId.get(approvalId);
  if (!bindings?.length) {
    return { ok: false, reason: "not-found" };
  }

  const activeBindings = bindings.filter((binding) => binding.expiresAtMs > now);
  if (activeBindings.length === 0) {
    bindingsByApprovalId.delete(approvalId);
    return { ok: false, reason: "expired" };
  }

  bindingsByApprovalId.set(approvalId, activeBindings);

  const chatId = params.chatId.trim();
  const accountId = normalizeOptionalString(params.accountId);
  const threadId =
    params.threadId != null && `${params.threadId}`.trim()
      ? `${params.threadId}`.trim()
      : undefined;
  const userId = normalizeNumericId(params.userId);

  const accountMatched = activeBindings.filter((binding) => {
    if (!binding.accountId) {
      return true;
    }
    return binding.accountId === accountId;
  });
  if (accountMatched.length === 0) {
    return { ok: false, reason: "account-mismatch" };
  }

  const chatMatched = accountMatched.filter((binding) => binding.chatId === chatId);
  if (chatMatched.length === 0) {
    return { ok: false, reason: "chat-mismatch" };
  }

  const threadMatched = chatMatched.filter((binding) => {
    if (!binding.threadId) {
      return true;
    }
    return binding.threadId === threadId;
  });
  if (threadMatched.length === 0) {
    return { ok: false, reason: "thread-mismatch" };
  }

  const userMatched = threadMatched.filter((binding) => {
    if (!binding.expectedUserId) {
      return true;
    }
    return binding.expectedUserId === userId;
  });
  if (userMatched.length === 0) {
    return { ok: false, reason: "user-mismatch" };
  }

  return {
    ok: true,
    command: buildExecApprovalCommandFromCallback(params.callback),
  };
}

export function resolveTelegramExpectedApproverId(params: {
  to: string;
  explicitUserId?: string;
}): string | undefined {
  const explicit = normalizeNumericId(params.explicitUserId);
  if (explicit) {
    return explicit;
  }

  const parsed = parseTelegramTarget(params.to);
  if (parsed.chatType !== "direct") {
    return undefined;
  }
  return normalizeNumericId(parsed.chatId);
}

export function resetTelegramExecApprovalBindingsForTests(): void {
  bindingsByApprovalId.clear();
}
