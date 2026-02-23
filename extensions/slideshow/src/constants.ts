export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;
export const DEFAULT_DURATION_PER_SLIDE = 5; // seconds
export const DEFAULT_TRANSITION_DURATION = 0.5; // seconds
export const MAX_SLIDES = 50;
export const COMPOSITION_ID = "Slideshow";
export const DEFAULT_NARRATION_PADDING_SECONDS = 1.0;
export const DEFAULT_AUDIO_DUCKING = 0.3;

/**
 * Calculate total slideshow duration in seconds, accounting for transition overlap.
 */
export function calculateTotalSeconds(
  slideCount: number,
  durationPerSlide: number,
  hasTransition: boolean,
): number {
  const transitionOverlap = hasTransition ? DEFAULT_TRANSITION_DURATION : 0;
  return slideCount * durationPerSlide - Math.max(0, slideCount - 1) * transitionOverlap;
}

/**
 * Calculate total slideshow duration when slides have variable durations (narration-adapted).
 */
export function calculateTotalSecondsVariableDuration(
  slideDurations: number[],
  hasTransition: boolean,
): number {
  const total = slideDurations.reduce((sum, d) => sum + d, 0);
  const overlap = hasTransition
    ? Math.max(0, slideDurations.length - 1) * DEFAULT_TRANSITION_DURATION
    : 0;
  return total - overlap;
}
