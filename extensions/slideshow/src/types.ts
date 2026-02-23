/** Plain TypeScript types shared between the tool (Node) and Remotion compositions (webpack). */

export type TitleSlideData = {
  type: "title";
  title: string;
  subtitle?: string;
  narration?: string;
};

export type ContentSlideData = {
  type: "content";
  heading: string;
  bullets: string[];
  narration?: string;
};

export type ImageSlideData = {
  type: "image";
  src: string;
  caption?: string;
  narration?: string;
};

export type QuoteSlideData = {
  type: "quote";
  quote: string;
  attribution?: string;
  narration?: string;
};

export type SplitSlideData = {
  type: "split";
  leftHeading: string;
  leftBullets: string[];
  rightHeading: string;
  rightBullets: string[];
  narration?: string;
};

export type SlideData =
  | TitleSlideData
  | ContentSlideData
  | ImageSlideData
  | QuoteSlideData
  | SplitSlideData;

export type AudioConfig = {
  src: string;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  startFrom?: number;
  loop?: boolean;
};

export type NarrationConfig = {
  enabled?: boolean;
  autoGenerate?: boolean;
  voice?: string;
  speakingRate?: number;
  provider?: "piper" | "say" | "auto";
  piper?: { modelPath?: string; speakerId?: number };
  audioDucking?: number;
};

export type NarrationSegmentData = {
  audioSrc: string;
  durationMs: number;
};
