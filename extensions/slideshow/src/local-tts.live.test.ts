import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
/**
 * Live integration test — actually runs macOS `say` + ffmpeg to produce a WAV.
 * Requires: macOS with `say` command, ffmpeg, ffprobe.
 * Run with: npx vitest run --config vitest.extensions.config.ts extensions/slideshow/src/local-tts.live.test.ts
 */
import { describe, it, expect, beforeEach } from "vitest";
import { detectProvider, resetProviderCache, synthesize, getAudioDuration } from "./local-tts.js";
import { extractNarrationText, generateNarration } from "./narration.js";
import type { SlideData } from "./types.js";

const isMac = os.platform() === "darwin";

beforeEach(() => {
  resetProviderCache();
});

describe.skipIf(!isMac)("live TTS with macOS say", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-tts-live-"));
  });

  it("detects say provider on macOS", async () => {
    const provider = await detectProvider({ provider: "auto" });
    expect(["piper", "say"]).toContain(provider);
  });

  it("synthesizes a WAV file from text", async () => {
    const outPath = path.join(tmpDir, "hello.wav");
    const result = await synthesize("Hello, this is a test of the narration system.", outPath, {
      provider: "say",
    });

    expect(result.success).toBe(true);
    expect(result.audioPath).toBe(outPath);
    expect(result.provider).toBe("say");
    expect(result.durationMs).toBeGreaterThan(500); // at least half a second

    // Verify file exists and has content
    const stat = await fs.stat(outPath);
    expect(stat.size).toBeGreaterThan(1000);
  });

  it("getAudioDuration returns correct duration for generated WAV", async () => {
    const outPath = path.join(tmpDir, "duration-test.wav");
    const result = await synthesize("One two three four five.", outPath, {
      provider: "say",
    });
    expect(result.success).toBe(true);

    const duration = await getAudioDuration(outPath);
    expect(duration).toBeGreaterThan(500);
    expect(duration).toBeLessThan(10000); // shouldn't be more than 10s
  });

  it("generates narration for multiple slides end-to-end", async () => {
    const slides: SlideData[] = [
      { type: "title", title: "The Solar System", subtitle: "A brief overview" },
      {
        type: "content",
        heading: "Inner Planets",
        bullets: ["Mercury", "Venus", "Earth", "Mars"],
      },
      {
        type: "quote",
        quote: "The Earth is the cradle of humanity",
        attribution: "Tsiolkovsky",
      },
    ];

    const segments = await generateNarration({
      slides,
      outputDir: tmpDir,
      ttsConfig: { provider: "say" },
    });

    expect(segments).toHaveLength(3);

    for (const seg of segments) {
      expect(seg.durationMs).toBeGreaterThan(0);
      const stat = await fs.stat(seg.audioPath);
      expect(stat.size).toBeGreaterThan(0);
    }

    // Verify text extraction worked correctly
    expect(segments[0].text).toBe("The Solar System. A brief overview");
    expect(segments[1].text).toBe("Inner Planets. Mercury. Venus. Earth. Mars");
    expect(segments[2].text).toContain("Tsiolkovsky");
  });

  it("respects per-slide narration override", async () => {
    const slides: SlideData[] = [{ type: "title", title: "Hello" }];

    const segments = await generateNarration({
      slides,
      narrationTexts: ["This is a custom narration that overrides the title."],
      outputDir: tmpDir,
      ttsConfig: { provider: "say" },
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("This is a custom narration that overrides the title.");
    expect(segments[0].durationMs).toBeGreaterThan(500);
  });
});
