import { Type, type Static } from "@sinclair/typebox";

// --- Slide types ---

const TitleSlideSchema = Type.Object({
  type: Type.Literal("title"),
  title: Type.String({ description: "Main title text." }),
  subtitle: Type.Optional(Type.String({ description: "Subtitle text." })),
  narration: Type.Optional(
    Type.String({
      description:
        "Custom narration text for this slide. If omitted, auto-generated from slide content.",
    }),
  ),
});

const ContentSlideSchema = Type.Object({
  type: Type.Literal("content"),
  heading: Type.String({ description: "Slide heading." }),
  bullets: Type.Array(Type.String(), { description: "Bullet point items." }),
  narration: Type.Optional(
    Type.String({
      description:
        "Custom narration text for this slide. If omitted, auto-generated from slide content.",
    }),
  ),
});

const ImageSlideSchema = Type.Object({
  type: Type.Literal("image"),
  src: Type.String({ description: "Absolute path or URL to the image." }),
  caption: Type.Optional(Type.String({ description: "Optional image caption." })),
  narration: Type.Optional(
    Type.String({
      description: "Custom narration text for this slide. If omitted, auto-generated from caption.",
    }),
  ),
});

const QuoteSlideSchema = Type.Object({
  type: Type.Literal("quote"),
  quote: Type.String({ description: "The quote text." }),
  attribution: Type.Optional(Type.String({ description: "Who said it." })),
  narration: Type.Optional(
    Type.String({
      description: "Custom narration text for this slide. If omitted, auto-generated from quote.",
    }),
  ),
});

const SplitSlideSchema = Type.Object({
  type: Type.Literal("split"),
  leftHeading: Type.String({ description: "Left column heading." }),
  leftBullets: Type.Array(Type.String(), { description: "Left column bullet points." }),
  rightHeading: Type.String({ description: "Right column heading." }),
  rightBullets: Type.Array(Type.String(), { description: "Right column bullet points." }),
  narration: Type.Optional(
    Type.String({
      description:
        "Custom narration text for this slide. If omitted, auto-generated from slide content.",
    }),
  ),
});

export const SlideSchema = Type.Union([
  TitleSlideSchema,
  ContentSlideSchema,
  ImageSlideSchema,
  QuoteSlideSchema,
  SplitSlideSchema,
]);

export type Slide = Static<typeof SlideSchema>;

// --- Theme & transition enums ---

export const ThemeEnum = Type.Union(
  [
    Type.Literal("dark"),
    Type.Literal("light"),
    Type.Literal("corporate"),
    Type.Literal("neon"),
    Type.Literal("ocean"),
  ],
  { description: "Color theme for the slideshow." },
);

export const TransitionEnum = Type.Union(
  [
    Type.Literal("fade"),
    Type.Literal("slide"),
    Type.Literal("wipe"),
    Type.Literal("flip"),
    Type.Literal("clock-wipe"),
    Type.Literal("none"),
  ],
  { description: "Transition effect between slides." },
);

// --- Audio schema ---

export const AudioSchema = Type.Object({
  src: Type.String({
    description: "Absolute path or URL to the background audio file (mp3, wav, aac, ogg).",
  }),
  volume: Type.Optional(
    Type.Number({ description: "Playback volume from 0 to 1.", minimum: 0, maximum: 1 }),
  ),
  fadeInDuration: Type.Optional(
    Type.Number({ description: "Fade-in duration in seconds.", minimum: 0, maximum: 10 }),
  ),
  fadeOutDuration: Type.Optional(
    Type.Number({ description: "Fade-out duration in seconds.", minimum: 0, maximum: 10 }),
  ),
  startFrom: Type.Optional(
    Type.Number({
      description: "Start playback from this many seconds into the audio file.",
      minimum: 0,
    }),
  ),
  loop: Type.Optional(
    Type.Boolean({ description: "Loop audio if it is shorter than the video. Defaults to true." }),
  ),
});

// --- Narration schema ---

export const NarrationSchema = Type.Object({
  enabled: Type.Optional(
    Type.Boolean({ description: "Enable AI voice narration. Default: false." }),
  ),
  autoGenerate: Type.Optional(
    Type.Boolean({
      description:
        "Auto-generate narration from slide text when no per-slide narration is provided. Default: true when enabled.",
    }),
  ),
  voice: Type.Optional(
    Type.String({ description: "Voice name (macOS say) or model path (Piper)." }),
  ),
  speakingRate: Type.Optional(
    Type.Number({
      description: "Speaking rate multiplier. 0.5–2.0, where 1.0 is normal speed.",
      minimum: 0.5,
      maximum: 2.0,
    }),
  ),
  provider: Type.Optional(
    Type.Union([Type.Literal("piper"), Type.Literal("say"), Type.Literal("auto")], {
      description: "TTS provider. 'auto' tries Piper then macOS say. Default: 'auto'.",
    }),
  ),
  piper: Type.Optional(
    Type.Object({
      modelPath: Type.Optional(Type.String({ description: "Path to Piper ONNX voice model." })),
      speakerId: Type.Optional(
        Type.Number({ description: "Speaker ID for multi-speaker models." }),
      ),
    }),
  ),
  audioDucking: Type.Optional(
    Type.Number({
      description:
        "Reduce background music volume during narration. 0–1 where 0 = mute, 1 = full volume. Default: 0.3.",
      minimum: 0,
      maximum: 1,
    }),
  ),
});

// --- Full tool input schema ---

export const SlideshowInputSchema = Type.Object({
  title: Type.String({
    description: "Slideshow title (used in metadata and title slide fallback).",
  }),
  slides: Type.Array(SlideSchema, {
    description: "Ordered list of slides to render.",
    minItems: 1,
  }),
  theme: Type.Optional(ThemeEnum),
  transition: Type.Optional(TransitionEnum),
  audio: Type.Optional(AudioSchema),
  durationPerSlide: Type.Optional(
    Type.Number({ description: "Duration of each slide in seconds.", minimum: 1, maximum: 30 }),
  ),
  fps: Type.Optional(Type.Number({ description: "Frames per second.", minimum: 1, maximum: 60 })),
  width: Type.Optional(
    Type.Number({ description: "Video width in pixels.", minimum: 320, maximum: 3840 }),
  ),
  height: Type.Optional(
    Type.Number({ description: "Video height in pixels.", minimum: 240, maximum: 2160 }),
  ),
  outputFormat: Type.Optional(
    Type.Union([Type.Literal("mp4"), Type.Literal("webm")], {
      description: "Output video format.",
    }),
  ),
  narration: Type.Optional(NarrationSchema),
});

export type SlideshowInput = Static<typeof SlideshowInputSchema>;
