/**
 * Narration orchestration — extracts speakable text from slides and generates
 * per-slide narration audio files via the local TTS engine.
 */

import path from "node:path";
import { synthesize, type LocalTtsConfig, type LocalTtsProvider } from "./local-tts.js";
import type { SlideData } from "./types.js";

export type NarrationSegment = {
  slideIndex: number;
  text: string;
  audioPath: string;
  durationMs: number;
};

export type GenerateNarrationOptions = {
  slides: SlideData[];
  /** Explicit narration texts per slide (index-matched). `undefined` entries use auto-extraction. */
  narrationTexts?: (string | undefined)[];
  /** Auto-generate narration from slide text when no explicit text is provided. Default: true. */
  autoGenerate?: boolean;
  /** Directory to write WAV files into. */
  outputDir: string;
  /** TTS configuration. */
  ttsConfig?: LocalTtsConfig;
};

/**
 * Extract speakable narration text from a slide based on its type.
 */
export function extractNarrationText(slide: SlideData): string {
  switch (slide.type) {
    case "title": {
      const parts = [slide.title];
      if (slide.subtitle) parts.push(slide.subtitle);
      return parts.join(". ");
    }
    case "content": {
      const parts = [slide.heading];
      parts.push(...slide.bullets);
      return parts.join(". ");
    }
    case "image": {
      return slide.caption ?? "";
    }
    case "quote": {
      let text = slide.quote;
      if (slide.attribution) text += `, by ${slide.attribution}`;
      return text;
    }
    case "split": {
      const parts: string[] = [];
      parts.push(`${slide.leftHeading}: ${slide.leftBullets.join(", ")}`);
      parts.push(`${slide.rightHeading}: ${slide.rightBullets.join(", ")}`);
      return parts.join(". ");
    }
  }
}

/**
 * Generate per-slide narration audio files.
 * Returns an array of successfully generated narration segments.
 * Slides that fail TTS or have no text are silently skipped.
 */
export async function generateNarration(
  options: GenerateNarrationOptions,
): Promise<NarrationSegment[]> {
  const { slides, narrationTexts, autoGenerate = true, outputDir, ttsConfig } = options;
  const segments: NarrationSegment[] = [];

  for (let i = 0; i < slides.length; i++) {
    // Determine narration text: explicit override → auto-extract → skip
    let text = narrationTexts?.[i];
    if (!text && autoGenerate) {
      text = extractNarrationText(slides[i]);
    }
    if (!text?.trim()) continue;

    const wavPath = path.join(outputDir, `narration-${i}.wav`);
    const result = await synthesize(text, wavPath, ttsConfig);

    if (result.success && result.audioPath && result.durationMs && result.durationMs > 0) {
      segments.push({
        slideIndex: i,
        text,
        audioPath: result.audioPath,
        durationMs: result.durationMs,
      });
    } else if (result.error) {
      // Log warning but continue — graceful degradation
      console.warn(`[slideshow] Narration skipped for slide ${i}: ${result.error}`);
    }
  }

  return segments;
}
