import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractNarrationText, generateNarration } from "./narration.js";
import type { SlideData } from "./types.js";

// ─── extractNarrationText ───────────────────────────────────────────────

describe("extractNarrationText", () => {
  it("title slide → title + subtitle", () => {
    const slide: SlideData = { type: "title", title: "Hello", subtitle: "World" };
    expect(extractNarrationText(slide)).toBe("Hello. World");
  });

  it("title slide without subtitle → title only", () => {
    const slide: SlideData = { type: "title", title: "Hello" };
    expect(extractNarrationText(slide)).toBe("Hello");
  });

  it("content slide → heading + bullets joined by periods", () => {
    const slide: SlideData = {
      type: "content",
      heading: "Key Points",
      bullets: ["First", "Second", "Third"],
    };
    expect(extractNarrationText(slide)).toBe("Key Points. First. Second. Third");
  });

  it("content slide with empty bullets → heading only", () => {
    const slide: SlideData = { type: "content", heading: "Heading", bullets: [] };
    expect(extractNarrationText(slide)).toBe("Heading");
  });

  it("image slide with caption → caption", () => {
    const slide: SlideData = { type: "image", src: "/img.png", caption: "A photo" };
    expect(extractNarrationText(slide)).toBe("A photo");
  });

  it("image slide without caption → empty string", () => {
    const slide: SlideData = { type: "image", src: "/img.png" };
    expect(extractNarrationText(slide)).toBe("");
  });

  it("quote slide → quote + attribution", () => {
    const slide: SlideData = {
      type: "quote",
      quote: "To be or not to be",
      attribution: "Shakespeare",
    };
    expect(extractNarrationText(slide)).toBe("To be or not to be, by Shakespeare");
  });

  it("quote slide without attribution → quote only", () => {
    const slide: SlideData = { type: "quote", quote: "Just a quote" };
    expect(extractNarrationText(slide)).toBe("Just a quote");
  });

  it("split slide → both columns", () => {
    const slide: SlideData = {
      type: "split",
      leftHeading: "Pros",
      leftBullets: ["Fast", "Simple"],
      rightHeading: "Cons",
      rightBullets: ["Limited", "Basic"],
    };
    expect(extractNarrationText(slide)).toBe("Pros: Fast, Simple. Cons: Limited, Basic");
  });
});

// ─── generateNarration ──────────────────────────────────────────────────

// Mock the local-tts module so we don't need actual TTS binaries
vi.mock("./local-tts.js", () => ({
  synthesize: vi.fn(async (_text: string, outputPath: string) => ({
    success: true,
    audioPath: outputPath,
    durationMs: 2500,
    provider: "say" as const,
  })),
}));

describe("generateNarration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates segments for slides with extractable text", async () => {
    const slides: SlideData[] = [
      { type: "title", title: "Hello", subtitle: "World" },
      { type: "content", heading: "Points", bullets: ["A", "B"] },
    ];

    const segments = await generateNarration({
      slides,
      outputDir: "/tmp/test-narration",
    });

    expect(segments).toHaveLength(2);
    expect(segments[0].slideIndex).toBe(0);
    expect(segments[0].text).toBe("Hello. World");
    expect(segments[0].durationMs).toBe(2500);
    expect(segments[1].slideIndex).toBe(1);
    expect(segments[1].text).toBe("Points. A. B");
  });

  it("skips image slides with no caption", async () => {
    const slides: SlideData[] = [
      { type: "title", title: "Intro" },
      { type: "image", src: "/photo.jpg" }, // no caption → empty text → skip
      { type: "quote", quote: "Nice" },
    ];

    const segments = await generateNarration({
      slides,
      outputDir: "/tmp/test-narration",
    });

    expect(segments).toHaveLength(2);
    expect(segments[0].slideIndex).toBe(0);
    expect(segments[1].slideIndex).toBe(2);
  });

  it("uses explicit narrationTexts when provided", async () => {
    const slides: SlideData[] = [
      { type: "title", title: "Hello" },
      { type: "content", heading: "Points", bullets: ["A"] },
    ];

    const segments = await generateNarration({
      slides,
      narrationTexts: ["Custom narration for slide one", undefined],
      outputDir: "/tmp/test-narration",
    });

    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe("Custom narration for slide one");
    expect(segments[1].text).toBe("Points. A"); // auto-generated
  });

  it("skips all slides when autoGenerate is false and no narrationTexts", async () => {
    const slides: SlideData[] = [
      { type: "title", title: "Hello" },
      { type: "content", heading: "Points", bullets: ["A"] },
    ];

    const segments = await generateNarration({
      slides,
      autoGenerate: false,
      outputDir: "/tmp/test-narration",
    });

    expect(segments).toHaveLength(0);
  });

  it("generates correct output paths per slide index", async () => {
    const slides: SlideData[] = [
      { type: "title", title: "A" },
      { type: "title", title: "B" },
      { type: "title", title: "C" },
    ];

    const segments = await generateNarration({
      slides,
      outputDir: "/tmp/test-out",
    });

    expect(segments[0].audioPath).toBe("/tmp/test-out/narration-0.wav");
    expect(segments[1].audioPath).toBe("/tmp/test-out/narration-1.wav");
    expect(segments[2].audioPath).toBe("/tmp/test-out/narration-2.wav");
  });
});
