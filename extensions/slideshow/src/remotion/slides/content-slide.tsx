import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { Theme } from "../../themes.js";

type Props = {
  heading: string;
  bullets: string[];
  theme: Theme;
};

export const ContentSlide: React.FC<Props> = ({ heading, bullets, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingProgress = spring({ frame, fps, config: { damping: 20 } });
  const headingOpacity = interpolate(headingProgress, [0, 1], [0, 1]);
  const headingX = interpolate(headingProgress, [0, 1], [-30, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 100,
      }}
    >
      <div
        style={{
          color: theme.accent,
          fontSize: 52,
          fontWeight: 700,
          fontFamily: theme.headingFontFamily,
          marginBottom: 48,
          transform: `translateX(${headingX}px)`,
          opacity: headingOpacity,
        }}
      >
        {heading}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {bullets.map((bullet, i) => {
          const delay = 8 + i * 6;
          const progress = spring({ frame: frame - delay, fps, config: { damping: 20 } });
          const opacity = interpolate(progress, [0, 1], [0, 1]);
          const x = interpolate(progress, [0, 1], [20, 0]);

          return (
            <div
              key={i}
              style={{
                color: theme.text,
                fontSize: 32,
                fontFamily: theme.fontFamily,
                opacity,
                transform: `translateX(${x}px)`,
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <span style={{ color: theme.accent, flexShrink: 0 }}>&#x2022;</span>
              <span>{bullet}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
