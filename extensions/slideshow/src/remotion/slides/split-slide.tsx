import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { Theme } from "../../themes.js";

type Props = {
  leftHeading: string;
  leftBullets: string[];
  rightHeading: string;
  rightBullets: string[];
  theme: Theme;
};

export const SplitSlide: React.FC<Props> = ({
  leftHeading,
  leftBullets,
  rightHeading,
  rightBullets,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftProgress = spring({ frame, fps, config: { damping: 20 } });
  const leftOpacity = interpolate(leftProgress, [0, 1], [0, 1]);
  const leftX = interpolate(leftProgress, [0, 1], [-30, 0]);

  const rightProgress = spring({ frame: frame - 8, fps, config: { damping: 20 } });
  const rightOpacity = interpolate(rightProgress, [0, 1], [0, 1]);
  const rightX = interpolate(rightProgress, [0, 1], [30, 0]);

  const renderColumn = (
    heading: string,
    bullets: string[],
    opacity: number,
    x: number,
    delayBase: number,
  ) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          color: theme.accent,
          fontSize: 40,
          fontWeight: 700,
          fontFamily: theme.headingFontFamily,
          marginBottom: 32,
        }}
      >
        {heading}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {bullets.map((bullet, i) => {
          const delay = delayBase + i * 6;
          const progress = spring({ frame: frame - delay, fps, config: { damping: 20 } });
          const bOpacity = interpolate(progress, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                color: theme.text,
                fontSize: 26,
                fontFamily: theme.fontFamily,
                opacity: bOpacity,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <span style={{ color: theme.accent, flexShrink: 0 }}>&#x2022;</span>
              <span>{bullet}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        gap: 60,
      }}
    >
      {renderColumn(leftHeading, leftBullets, leftOpacity, leftX, 10)}
      <div
        style={{
          width: 2,
          alignSelf: "stretch",
          backgroundColor: theme.accent,
          opacity: 0.3,
          margin: "40px 0",
        }}
      />
      {renderColumn(rightHeading, rightBullets, rightOpacity, rightX, 16)}
    </AbsoluteFill>
  );
};
