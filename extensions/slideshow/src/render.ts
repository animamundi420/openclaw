import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  DEFAULT_FPS,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_DURATION_PER_SLIDE,
  COMPOSITION_ID,
  DEFAULT_NARRATION_PADDING_SECONDS,
  DEFAULT_AUDIO_DUCKING,
  calculateTotalSeconds,
  calculateTotalSecondsVariableDuration,
} from "./constants.js";
import { detectProvider, type LocalTtsConfig } from "./local-tts.js";
import { generateNarration } from "./narration.js";
import type { SlideshowInput } from "./schemas.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type RenderResult = {
  outputPath: string;
  durationMs: number;
};

async function ensureFfmpeg(): Promise<void> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
  } catch {
    throw new Error(
      "ffmpeg not found in PATH. Install it with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux).",
    );
  }
}

export type RenderOptions = {
  piperBinaryPath?: string;
};

export async function renderSlideshow(
  input: SlideshowInput,
  outputPath: string,
  options?: RenderOptions,
): Promise<RenderResult> {
  // Pre-flight: ffmpeg is required by Remotion for encoding
  await ensureFfmpeg();

  // Dynamic imports to avoid loading Remotion at OpenClaw startup
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  const entryPoint = path.resolve(__dirname, "remotion", "entry.tsx");

  const fps = input.fps ?? DEFAULT_FPS;
  const durationPerSlide = input.durationPerSlide ?? DEFAULT_DURATION_PER_SLIDE;
  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const codec = input.outputFormat === "webm" ? "vp8" : "h264";

  // --- Narration generation ---
  let narrationSegments:
    | Array<{ slideIndex: number; audioSrc: string; durationMs: number }>
    | undefined;
  let perSlideDurations: number[] | undefined;
  let audioDucking: number | undefined;
  let narrationTmpDir: string | undefined;

  if (input.narration?.enabled) {
    narrationTmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-narration-"));

    const ttsConfig: LocalTtsConfig = {
      provider: input.narration.provider ?? "auto",
      piper: {
        binaryPath: options?.piperBinaryPath,
        modelPath: input.narration.piper?.modelPath ?? input.narration.voice,
        speakerId: input.narration.piper?.speakerId,
        lengthScale: input.narration.speakingRate
          ? 1 / input.narration.speakingRate // lengthScale is inverse of rate
          : undefined,
      },
      say: {
        voice: input.narration.voice,
        rate: input.narration.speakingRate
          ? Math.round(175 * input.narration.speakingRate)
          : undefined,
      },
    };

    // Check if any TTS provider is available before attempting generation
    const provider = await detectProvider(ttsConfig);
    if (provider !== "none") {
      // Extract per-slide narration texts from the slide data
      const narrationTexts = input.slides.map((slide) => {
        if ("narration" in slide && typeof slide.narration === "string") {
          return slide.narration;
        }
        return undefined;
      });

      const segments = await generateNarration({
        slides: input.slides,
        narrationTexts,
        autoGenerate: input.narration.autoGenerate !== false,
        outputDir: narrationTmpDir,
        ttsConfig,
      });

      if (segments.length > 0) {
        // Build narration segments for Remotion (using file:// URLs for local files)
        narrationSegments = segments.map((seg) => ({
          slideIndex: seg.slideIndex,
          audioSrc: seg.audioPath,
          durationMs: seg.durationMs,
        }));

        // Calculate per-slide durations: max(default, narration + padding)
        const segmentMap = new Map(segments.map((s) => [s.slideIndex, s]));
        perSlideDurations = input.slides.map((_, i) => {
          const seg = segmentMap.get(i);
          if (seg) {
            const narrationSeconds = seg.durationMs / 1000 + DEFAULT_NARRATION_PADDING_SECONDS;
            return Math.max(durationPerSlide, narrationSeconds);
          }
          return durationPerSlide;
        });

        audioDucking = input.narration.audioDucking ?? DEFAULT_AUDIO_DUCKING;
      }
    } else {
      console.warn("[slideshow] No TTS provider available — rendering without narration.");
    }
  }

  const inputProps = {
    slides: input.slides,
    theme: input.theme ?? "dark",
    transition: input.transition ?? "fade",
    audio: input.audio,
    durationPerSlide,
    fps,
    narrationSegments,
    perSlideDurations,
    audioDucking,
  };

  let bundleLocation: string | undefined;
  try {
    bundleLocation = await bundle({
      entryPoint,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: COMPOSITION_ID,
      inputProps,
    });

    // Override width/height if provided
    composition.width = width;
    composition.height = height;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec,
      outputLocation: outputPath,
    });

    // Verify the output file was actually written
    try {
      const stat = await fs.stat(outputPath);
      if (stat.size === 0) {
        throw new Error("Render produced an empty file.");
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("Render completed but output file was not created.");
      }
      throw err;
    }

    // Calculate duration for metadata
    const hasTransition = input.transition !== "none";
    let totalSeconds: number;
    if (perSlideDurations) {
      totalSeconds = calculateTotalSecondsVariableDuration(perSlideDurations, hasTransition);
    } else {
      totalSeconds = calculateTotalSeconds(input.slides.length, durationPerSlide, hasTransition);
    }
    const durationMs = Math.round(totalSeconds * 1000);

    return { outputPath, durationMs };
  } finally {
    if (bundleLocation) {
      try {
        await fs.rm(bundleLocation, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    if (narrationTmpDir) {
      try {
        await fs.rm(narrationTmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
