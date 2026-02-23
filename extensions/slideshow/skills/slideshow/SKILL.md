---
name: slideshow
description: Create video slideshows from structured slide data. Activate when user asks to create a slideshow, presentation video, or MP4 presentation.
metadata:
  openclaw:
    emoji: "\U0001F3AC"
    requires:
      bins: [ffmpeg]
    install:
      - id: ffmpeg-brew
        kind: brew
        formula: ffmpeg
        bins: [ffmpeg]
        label: "Install ffmpeg (brew)"
---

# Slideshow Skill

Create professional MP4 slideshow videos from structured slide data using the `create_slideshow` tool.

## When to Activate

Activate this skill when the user:

- Asks to create a **slideshow**, **presentation video**, or **MP4 presentation**
- Wants to turn text/bullet points into a video
- Asks for a **video summary** of a topic
- Mentions creating a "slide deck video" or "animated presentation"

## Slide Types

| Type      | Fields                                                           | Best For               |
| --------- | ---------------------------------------------------------------- | ---------------------- |
| `title`   | `title`, `subtitle?`                                             | Opening/closing slides |
| `content` | `heading`, `bullets[]`                                           | Key points and lists   |
| `image`   | `src` (absolute path or URL), `caption?`                         | Photos and diagrams    |
| `quote`   | `quote`, `attribution?`                                          | Notable quotes         |
| `split`   | `leftHeading`, `leftBullets[]`, `rightHeading`, `rightBullets[]` | Comparisons, pros/cons |

## Themes

| Theme       | Style                                       |
| ----------- | ------------------------------------------- |
| `dark`      | Dark navy background, blue accent (default) |
| `light`     | White background, blue accent               |
| `corporate` | Dark purple, red accent                     |
| `neon`      | Black background, green/magenta             |
| `ocean`     | Deep navy, cyan accent                      |

## Transitions

| Transition   | Effect                  |
| ------------ | ----------------------- |
| `fade`       | Cross-fade (default)    |
| `slide`      | Slide in from side      |
| `wipe`       | Wipe across             |
| `flip`       | 3D flip                 |
| `clock-wipe` | Clock-hand wipe         |
| `none`       | Hard cut, no transition |

## Background Audio

Add background music or narration to your slideshow with the optional `audio` field:

| Field             | Type    | Default | Description                                             |
| ----------------- | ------- | ------- | ------------------------------------------------------- |
| `src`             | string  | —       | Absolute path or URL to audio file (mp3, wav, aac, ogg) |
| `volume`          | number  | `0.8`   | Playback volume from 0 to 1                             |
| `fadeInDuration`  | number  | `1`     | Fade-in duration in seconds                             |
| `fadeOutDuration` | number  | `2`     | Fade-out duration in seconds                            |
| `startFrom`       | number  | `0`     | Start playback from this many seconds into the audio    |
| `loop`            | boolean | `true`  | Loop audio if shorter than the video                    |

## Voice Narration

Add AI-generated voice narration to your slideshow with the optional `narration` field. Uses local TTS (no cloud APIs).

### Narration Config

| Field          | Type    | Default | Description                                                   |
| -------------- | ------- | ------- | ------------------------------------------------------------- |
| `enabled`      | boolean | `false` | Enable voice narration                                        |
| `autoGenerate` | boolean | `true`  | Auto-generate narration from slide text                       |
| `voice`        | string  | —       | Voice name (macOS say) or Piper model path                    |
| `speakingRate` | number  | `1.0`   | Speaking rate multiplier (0.5–2.0)                            |
| `provider`     | string  | `auto`  | TTS provider: `"piper"`, `"say"`, or `"auto"`                 |
| `piper`        | object  | —       | `{ modelPath?: string, speakerId?: number }`                  |
| `audioDucking` | number  | `0.3`   | Background music volume during narration (0 = mute, 1 = full) |

### Per-Slide Narration

Each slide type accepts an optional `narration` field to override auto-generated text:

```json
{
  "type": "content",
  "heading": "Key Points",
  "bullets": ["Point A", "Point B"],
  "narration": "Let me walk you through the key points of this section."
}
```

When `autoGenerate` is `true` (default), slides without explicit `narration` text get narration auto-generated from their content.

### Providers

| Provider      | Platform | Requirements                           | Quality |
| ------------- | -------- | -------------------------------------- | ------- |
| **Piper**     | All      | `piper` binary + ONNX model (~50MB)    | Good    |
| **macOS say** | macOS    | Built-in (+ ffmpeg for WAV conversion) | Basic   |

**Auto-detection** (`provider: "auto"`): tries Piper first, then macOS `say`, then skips narration gracefully.

### Installing Piper (optional)

```bash
# macOS
brew install piper

# Download a voice model
curl -L -o en_US-lessac-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
curl -L -o en_US-lessac-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
```

## Example Tool Call

```json
{
  "title": "The Solar System",
  "slides": [
    {
      "type": "title",
      "title": "The Solar System",
      "subtitle": "A journey through our cosmic neighborhood"
    },
    {
      "type": "content",
      "heading": "The Inner Planets",
      "bullets": [
        "Mercury — closest to the Sun",
        "Venus — hottest planet",
        "Earth — our home",
        "Mars — the Red Planet"
      ]
    },
    {
      "type": "quote",
      "quote": "The Earth is the cradle of humanity, but mankind cannot stay in the cradle forever.",
      "attribution": "Konstantin Tsiolkovsky"
    },
    {
      "type": "split",
      "leftHeading": "Gas Giants",
      "leftBullets": ["Jupiter", "Saturn"],
      "rightHeading": "Ice Giants",
      "rightBullets": ["Uranus", "Neptune"]
    },
    {
      "type": "title",
      "title": "Thank You",
      "subtitle": "Keep exploring!"
    }
  ],
  "theme": "ocean",
  "transition": "fade",
  "durationPerSlide": 5,
  "audio": {
    "src": "/path/to/background-music.mp3",
    "volume": 0.5,
    "fadeInDuration": 1,
    "fadeOutDuration": 2
  }
}
```

### Example with Narration

```json
{
  "title": "The Solar System",
  "slides": [
    {
      "type": "title",
      "title": "The Solar System",
      "subtitle": "A journey through our cosmic neighborhood",
      "narration": "Welcome to our journey through the solar system."
    },
    {
      "type": "content",
      "heading": "The Inner Planets",
      "bullets": ["Mercury", "Venus", "Earth", "Mars"]
    }
  ],
  "theme": "ocean",
  "narration": {
    "enabled": true,
    "provider": "auto",
    "audioDucking": 0.3
  },
  "audio": {
    "src": "/path/to/background-music.mp3",
    "volume": 0.8
  }
}
```

## Tips for Best Results

- **Start and end with title slides** for a polished look
- Keep bullet points **concise** — 4-6 per slide works best
- Use **5 seconds per slide** (default) for readability; increase for dense content
- Choose a theme that matches the topic's tone
- Use `split` slides for **comparisons** (pros/cons, before/after, etc.)
- The `image` slide type requires an **absolute file path** or **full URL** to the image
- Add **background audio** with the `audio` field — use `volume: 0.3`–`0.5` for music under narration
- Audio **loops automatically** if shorter than the video; set `loop: false` to play once
- The `audio.src` field requires an **absolute file path** or **full URL** to the audio file
- The tool returns a `MEDIA:` token — the rendered video is automatically delivered to the user's channel
- Enable **narration** with `"narration": { "enabled": true }` — slide text is auto-narrated using local TTS
- Use per-slide `narration` fields to write custom spoken text that differs from the displayed text
- Combine narration with background audio — `audioDucking: 0.3` automatically lowers music during speech
- Slide durations auto-extend to fit narration length (with 1s padding)
