import type { TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from "./constants.js";

export type TransitionName = "fade" | "slide" | "wipe" | "flip" | "clock-wipe" | "none";

export function getTransition(
  name?: string,
  opts?: { width?: number; height?: number },
): TransitionPresentation | null {
  switch (name) {
    case "fade":
      return fade();
    case "slide":
      return slide();
    case "wipe":
      return wipe();
    case "flip":
      return flip();
    case "clock-wipe":
      return clockWipe({
        width: opts?.width ?? DEFAULT_WIDTH,
        height: opts?.height ?? DEFAULT_HEIGHT,
      });
    case "none":
      return null;
    default:
      return fade();
  }
}
