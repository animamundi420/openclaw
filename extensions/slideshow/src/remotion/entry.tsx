import React from "react";
import { registerRoot, Composition } from "remotion";
import {
  DEFAULT_FPS,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_DURATION_PER_SLIDE,
  COMPOSITION_ID,
  calculateTotalSeconds,
  calculateTotalSecondsVariableDuration,
} from "../constants.js";
import { SlideshowComposition } from "./slideshow-composition.js";
import type { SlideshowProps } from "./slideshow-composition.js";

function calculateDurationInFrames(props: SlideshowProps): number {
  const fps = props.fps ?? DEFAULT_FPS;
  const durationPerSlide = props.durationPerSlide ?? DEFAULT_DURATION_PER_SLIDE;
  const slideCount = props.slides?.length ?? 1;
  const hasTransition = props.transition !== "none";

  let totalSeconds: number;
  if (props.perSlideDurations && props.perSlideDurations.length === slideCount) {
    totalSeconds = calculateTotalSecondsVariableDuration(props.perSlideDurations, hasTransition);
  } else {
    totalSeconds = calculateTotalSeconds(slideCount, durationPerSlide, hasTransition);
  }
  return Math.max(1, Math.round(totalSeconds * fps));
}

const Root: React.FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={SlideshowComposition}
      durationInFrames={1}
      fps={DEFAULT_FPS}
      width={DEFAULT_WIDTH}
      height={DEFAULT_HEIGHT}
      defaultProps={{
        slides: [{ type: "title" as const, title: "Slideshow" }],
        theme: "dark",
        transition: "fade",
        audio: undefined,
        durationPerSlide: DEFAULT_DURATION_PER_SLIDE,
        fps: DEFAULT_FPS,
        narrationSegments: undefined,
        perSlideDurations: undefined,
        audioDucking: undefined,
      }}
      calculateMetadata={async ({ props }) => {
        return {
          durationInFrames: calculateDurationInFrames(props),
          fps: props.fps ?? DEFAULT_FPS,
        };
      }}
    />
  );
};

registerRoot(Root);
