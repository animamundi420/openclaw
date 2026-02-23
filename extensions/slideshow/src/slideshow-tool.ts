import os from "node:os";
import path from "node:path";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { MAX_SLIDES } from "./constants.js";
import { renderSlideshow } from "./render.js";
import { SlideshowInputSchema, type SlideshowInput } from "./schemas.js";

type PluginCfg = {
  outputDir?: string;
  defaultTheme?: string;
  defaultTransition?: string;
  defaultFps?: number;
  defaultDurationPerSlide?: number;
  maxSlides?: number;
  defaultNarrationProvider?: "piper" | "say" | "auto";
  piperModelPath?: string;
  piperBinaryPath?: string;
};

const VALID_SLIDE_TYPES = new Set(["title", "content", "image", "quote", "split"]);

export function createSlideshowTool(api: OpenClawPluginApi) {
  return {
    name: "create_slideshow",
    label: "Slideshow",
    description:
      "Create an MP4 slideshow video from structured slide data. " +
      "Supports title, content, image, quote, and split slide types with animated transitions, themes, optional background audio, and AI voice narration. " +
      "Video is delivered automatically from the tool result — reply with NO_REPLY after a successful call to avoid duplicate messages.",
    parameters: SlideshowInputSchema,

    async execute(_id: string, params: Record<string, unknown>) {
      const pluginCfg = (api.pluginConfig ?? {}) as PluginCfg;
      const input = params as unknown as SlideshowInput;

      // --- Defensive validation ---
      if (typeof input.title !== "string" || !input.title.trim()) {
        throw new Error("title is required and must be a non-empty string.");
      }
      if (!Array.isArray(input.slides) || input.slides.length === 0) {
        throw new Error("At least one slide is required.");
      }
      const maxSlides = pluginCfg.maxSlides ?? MAX_SLIDES;
      if (input.slides.length > maxSlides) {
        throw new Error(`Too many slides (${input.slides.length}). Maximum is ${maxSlides}.`);
      }
      for (let i = 0; i < input.slides.length; i++) {
        const slide = input.slides[i];
        if (!slide || typeof slide !== "object" || !VALID_SLIDE_TYPES.has(slide.type)) {
          throw new Error(
            `Slide at index ${i} is invalid: expected an object with type one of ${[...VALID_SLIDE_TYPES].join(", ")}.`,
          );
        }
      }

      // --- Apply defaults from plugin config ---
      if (!input.theme && pluginCfg.defaultTheme) {
        input.theme = pluginCfg.defaultTheme as SlideshowInput["theme"];
      }
      if (!input.transition && pluginCfg.defaultTransition) {
        input.transition = pluginCfg.defaultTransition as SlideshowInput["transition"];
      }
      if (!input.fps && pluginCfg.defaultFps) {
        input.fps = pluginCfg.defaultFps;
      }
      if (!input.durationPerSlide && pluginCfg.defaultDurationPerSlide) {
        input.durationPerSlide = pluginCfg.defaultDurationPerSlide;
      }

      // --- Apply narration defaults from plugin config ---
      if (input.narration?.enabled) {
        if (!input.narration.provider && pluginCfg.defaultNarrationProvider) {
          input.narration.provider = pluginCfg.defaultNarrationProvider;
        }
        if (!input.narration.piper?.modelPath && pluginCfg.piperModelPath) {
          input.narration.piper = {
            ...input.narration.piper,
            modelPath: pluginCfg.piperModelPath,
          };
        }
      }

      // --- Resolve output path ---
      const outputDir = pluginCfg.outputDir ?? path.join(os.tmpdir(), "openclaw-slideshow");
      const filename = `slideshow-${Date.now()}.${input.outputFormat === "webm" ? "webm" : "mp4"}`;
      const outputPath = path.join(outputDir, filename);

      try {
        const result = await renderSlideshow(input, outputPath, {
          piperBinaryPath: pluginCfg.piperBinaryPath,
        });

        return {
          content: [
            {
              type: "text",
              text: `MEDIA:${result.outputPath}`,
            },
          ],
          details: {
            outputPath: result.outputPath,
            durationMs: result.durationMs,
            slideCount: input.slides.length,
            theme: input.theme ?? "dark",
            transition: input.transition ?? "fade",
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Slideshow render failed: ${msg}`);
      }
    },
  };
}
