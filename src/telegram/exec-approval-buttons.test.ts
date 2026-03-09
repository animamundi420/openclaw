import { beforeEach, describe, expect, it } from "vitest";
import {
  buildExecApprovalCommandFromCallback,
  buildTelegramExecApprovalButtons,
  parseTelegramExecApprovalCallbackData,
  registerTelegramExecApprovalBinding,
  resetTelegramExecApprovalBindingsForTests,
  resolveTelegramExecApprovalCallback,
} from "./exec-approval-buttons.js";

describe("telegram exec approval buttons", () => {
  beforeEach(() => {
    resetTelegramExecApprovalBindingsForTests();
  });

  it("renders three approval action buttons", () => {
    const buttons = buildTelegramExecApprovalButtons({ approvalId: "req-1" });

    expect(buttons).toEqual([
      [
        { text: "Approve once", callback_data: "eap:o:req-1", style: "success" },
        { text: "Approve always", callback_data: "eap:a:req-1", style: "primary" },
        { text: "Deny", callback_data: "eap:d:req-1", style: "danger" },
      ],
    ]);
  });

  it("maps callback data to /approve semantics", () => {
    const parsed = parseTelegramExecApprovalCallbackData("eap:d:req-1");
    expect(parsed).toEqual({ approvalId: "req-1", decision: "deny" });
    expect(parsed && buildExecApprovalCommandFromCallback(parsed)).toBe("/approve req-1 deny");
  });

  it("rejects invalid callback payloads", () => {
    expect(parseTelegramExecApprovalCallbackData("eap:o:bad id")).toBeNull();
    expect(parseTelegramExecApprovalCallbackData("eap:x:req-1")).toBeNull();
    expect(parseTelegramExecApprovalCallbackData("commands_page_2")).toBeNull();
  });

  it("resolves allow-once callback when chat/account/user bindings match", () => {
    registerTelegramExecApprovalBinding({
      approvalId: "req-allow",
      chatId: "1234",
      accountId: "main",
      expectedUserId: "9",
      expiresAtMs: 5000,
    });

    const callback = parseTelegramExecApprovalCallbackData("eap:o:req-allow");
    expect(callback).not.toBeNull();

    const result = resolveTelegramExecApprovalCallback({
      callback: callback!,
      chatId: "1234",
      accountId: "main",
      userId: "9",
      nowMs: () => 1000,
    });

    expect(result).toEqual({ ok: true, command: "/approve req-allow allow-once" });
  });

  it("resolves deny callback when bindings match", () => {
    registerTelegramExecApprovalBinding({
      approvalId: "req-deny",
      chatId: "1234",
      expiresAtMs: 5000,
    });

    const callback = parseTelegramExecApprovalCallbackData("eap:d:req-deny");
    expect(callback).not.toBeNull();

    const result = resolveTelegramExecApprovalCallback({
      callback: callback!,
      chatId: "1234",
      nowMs: () => 1000,
    });

    expect(result).toEqual({ ok: true, command: "/approve req-deny deny" });
  });

  it("rejects unknown and expired approval ids", () => {
    const missing = parseTelegramExecApprovalCallbackData("eap:o:req-missing");
    expect(missing).not.toBeNull();
    expect(
      resolveTelegramExecApprovalCallback({
        callback: missing!,
        chatId: "1234",
      }),
    ).toEqual({ ok: false, reason: "not-found" });

    registerTelegramExecApprovalBinding({
      approvalId: "req-expired",
      chatId: "1234",
      expiresAtMs: 1000,
    });
    const expired = parseTelegramExecApprovalCallbackData("eap:a:req-expired");
    expect(expired).not.toBeNull();
    expect(
      resolveTelegramExecApprovalCallback({
        callback: expired!,
        chatId: "1234",
        nowMs: () => 2000,
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects cross-chat and cross-user callbacks", () => {
    registerTelegramExecApprovalBinding({
      approvalId: "req-bound",
      chatId: "1234",
      expectedUserId: "9",
      expiresAtMs: 5000,
    });

    const callback = parseTelegramExecApprovalCallbackData("eap:o:req-bound");
    expect(callback).not.toBeNull();

    expect(
      resolveTelegramExecApprovalCallback({
        callback: callback!,
        chatId: "9999",
        userId: "9",
        nowMs: () => 1000,
      }),
    ).toEqual({ ok: false, reason: "chat-mismatch" });

    expect(
      resolveTelegramExecApprovalCallback({
        callback: callback!,
        chatId: "1234",
        userId: "77",
        nowMs: () => 1000,
      }),
    ).toEqual({ ok: false, reason: "user-mismatch" });
  });
});
