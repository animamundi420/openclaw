import { TransitionSeries, linearTiming } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, Audio, useVideoConfig, interpolate } from "remotion";
import { DEFAULT_TRANSITION_DURATION } from "../constants.js";
import { getTheme } from "../themes.js";
import { getTransition } from "../transitions.js";
import type { SlideData, AudioConfig, NarrationSegmentData } from "../types.js";
import { ContentSlide } from "./slides/content-slide.js";
import { ImageSlide } from "./slides/image-slide.js";
import { QuoteSlide } from "./slides/quote-slide.js";
import { SplitSlide } from "./slides/split-slide.js";
import { TitleSlide } from "./slides/title-slide.js";

export type SlideshowProps = {
  slides: SlideData[];
  theme?: string;
  transition?: string;
  audio?: AudioConfig;
  durationPerSlide?: number;
  fps?: number;
  narrationSegments?: Array<NarrationSegmentData & { slideIndex: number }>;
  perSlideDurations?: number[];
  audioDucking?: number;
};

/**
 * Compute the starting frame of each slide, accounting for transition overlap.
 */
function computeSlideFrameRanges(
  slideDurations: number[],
  fps: number,
  transitionDurationFrames: number,
): Array<{ startFrame: number; endFrame: number }> {
  const ranges: Array<{ startFrame: number; endFrame: number }> = [];
  let currentFrame = 0;
  for (let i = 0; i < slideDurations.length; i++) {
    const durationFrames = Math.round(slideDurations[i] * fps);
    ranges.push({ startFrame: currentFrame, endFrame: currentFrame + durationFrames });
    // Next slide starts after this one minus transition overlap
    currentFrame += durationFrames - (i < slideDurations.length - 1 ? transitionDurationFrames : 0);
  }
  return ranges;
}

const BackgroundAudio: React.FC<{
  audio: AudioConfig;
  narrationRanges?: Array<{ startFrame: number; endFrame: number }>;
  audioDucking?: number;
}> = ({ audio, narrationRanges, audioDucking }) => {
  const { fps, durationInFrames } = useVideoConfig();

  const baseVolume = audio.volume ?? 0.8;
  const fadeInFrames = Math.round((audio.fadeInDuration ?? 1) * fps);
  const fadeOutFrames = Math.round((audio.fadeOutDuration ?? 2) * fps);
  const startFromFrames = Math.round((audio.startFrom ?? 0) * fps);
  const shouldLoop = audio.loop !== false; // default true
  const duckingFactor = audioDucking ?? 1;

  const volume = (f: number): number => {
    let v = baseVolume;
    // Fade in
    if (fadeInFrames > 0 && f < fadeInFrames) {
      v *= interpolate(f, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    // Fade out
    const fadeOutStart = durationInFrames - fadeOutFrames;
    if (fadeOutFrames > 0 && f > fadeOutStart) {
      v *= interpolate(f, [fadeOutStart, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    // Audio ducking during narrated slides
    if (narrationRanges && duckingFactor < 1) {
      const isNarrated = narrationRanges.some(
        (range) => f >= range.startFrame && f < range.endFrame,
      );
      if (isNarrated) {
        v *= duckingFactor;
      }
    }
    return Math.max(0, Math.min(1, v));
  };

  return <Audio src={audio.src} volume={volume} loop={shouldLoop} startFrom={startFromFrames} />;
};

export const SlideshowComposition: React.FC<SlideshowProps> = ({
  slides,
  theme: themeName,
  transition: transitionName,
  audio,
  durationPerSlide = 5,
  fps = 30,
  narrationSegments,
  perSlideDurations,
  audioDucking,
}) => {
  const { width, height } = useVideoConfig();
  const theme = getTheme(themeName);
  const presentation = getTransition(transitionName, { width, height });
  const transitionDurationFrames = presentation ? Math.round(DEFAULT_TRANSITION_DURATION * fps) : 0;

  // Build a map of slide index → narration segment for quick lookup
  const narrationMap = new Map<number, { audioSrc: string; durationMs: number }>();
  if (narrationSegments) {
    for (const seg of narrationSegments) {
      narrationMap.set(seg.slideIndex, { audioSrc: seg.audioSrc, durationMs: seg.durationMs });
    }
  }

  // Compute frame ranges for narrated slides (for audio ducking)
  const slideDurations = perSlideDurations ?? slides.map(() => durationPerSlide);
  let narrationRanges: Array<{ startFrame: number; endFrame: number }> | undefined;
  if (narrationSegments && narrationSegments.length > 0) {
    const allRanges = computeSlideFrameRanges(slideDurations, fps, transitionDurationFrames);
    narrationRanges = narrationSegments.map((seg) => allRanges[seg.slideIndex]).filter(Boolean);
  }

  function renderSlide(slide: SlideData) {
    switch (slide.type) {
      case "title":
        return <TitleSlide title={slide.title} subtitle={slide.subtitle} theme={theme} />;
      case "content":
        return <ContentSlide heading={slide.heading} bullets={slide.bullets} theme={theme} />;
      case "image":
        return <ImageSlide src={slide.src} caption={slide.caption} theme={theme} />;
      case "quote":
        return <QuoteSlide quote={slide.quote} attribution={slide.attribution} theme={theme} />;
      case "split":
        return (
          <SplitSlide
            leftHeading={slide.leftHeading}
            leftBullets={slide.leftBullets}
            rightHeading={slide.rightHeading}
            rightBullets={slide.rightBullets}
            theme={theme}
          />
        );
    }
  }

  return (
    <AbsoluteFill>
      {audio?.src && (
        <BackgroundAudio
          audio={audio}
          narrationRanges={narrationRanges}
          audioDucking={audioDucking}
        />
      )}
      <TransitionSeries>
        {slides.map((slide, i) => {
          const slideDuration = perSlideDurations?.[i] ?? durationPerSlide;
          const slideDurationFrames = Math.round(slideDuration * fps);
          const narration = narrationMap.get(i);

          return (
            <React.Fragment key={i}>
              {i > 0 && presentation && transitionDurationFrames > 0 && (
                <TransitionSeries.Transition
                  presentation={presentation}
                  timing={linearTiming({ durationInFrames: transitionDurationFrames })}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={slideDurationFrames}>
                {renderSlide(slide)}
                {narration && <Audio src={narration.audioSrc} volume={1} />}
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
