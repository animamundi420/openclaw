import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { Theme } from "../../themes.js";

type Props = {
  title: string;
  subtitle?: string;
  theme: Theme;
};

export const TitleSlide: React.FC<Props> = ({ title, subtitle, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 20 } });
  const subtitleProgress = spring({ frame: frame - 10, fps, config: { damping: 20 } });

  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          color: theme.text,
          fontSize: 72,
          fontWeight: 700,
          fontFamily: theme.headingFontFamily,
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            color: theme.accent,
            fontSize: 36,
            fontFamily: theme.fontFamily,
            textAlign: "center",
            marginTop: 24,
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
