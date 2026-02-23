import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectProvider, resetProviderCache, synthesize, getAudioDuration } from "./local-tts.js";

// Reset cached provider between tests
beforeEach(() => {
  resetProviderCache();
});

// ─── detectProvider ─────────────────────────────────────────────────────

describe("detectProvider", () => {
  it("returns explicit provider when configured", async () => {
    const provider = await detectProvider({ provider: "say" });
    expect(provider).toBe("say");
  });

  it("returns explicit 'none' when configured", async () => {
    const provider = await detectProvider({ provider: "none" });
    expect(provider).toBe("none");
  });

  it("auto-detects 'say' on macOS when piper is not available", async () => {
    // On macOS CI/dev, piper is typically not installed but say is
    const provider = await detectProvider({ provider: "auto" });
    // Should be either "piper" or "say" on macOS, not "none"
    if (process.platform === "darwin") {
      expect(["piper", "say"]).toContain(provider);
    }
  });
});

// ─── synthesize ─────────────────────────────────────────────────────────

describe("synthesize", () => {
  it("returns error for empty text", async () => {
    const result = await synthesize("", "/tmp/test.wav");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Empty text");
  });

  it("returns error for whitespace-only text", async () => {
    const result = await synthesize("   ", "/tmp/test.wav");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Empty text");
  });

  it("returns error when provider is none", async () => {
    const result = await synthesize("Hello", "/tmp/test.wav", { provider: "none" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("No TTS provider available");
    expect(result.provider).toBe("none");
  });

  it("returns error when piper has no model path", async () => {
    const result = await synthesize("Hello", "/tmp/test.wav", { provider: "piper" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("model path");
    expect(result.provider).toBe("piper");
  });
});

// ─── getAudioDuration ───────────────────────────────────────────────────

describe("getAudioDuration", () => {
  it("returns 0 for nonexistent file", async () => {
    const duration = await getAudioDuration("/tmp/nonexistent-file-xyz.wav");
    expect(duration).toBe(0);
  });
});
