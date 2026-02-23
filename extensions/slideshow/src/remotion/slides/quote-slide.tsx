import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { Theme } from "../../themes.js";

type Props = {
  quote: string;
  attribution?: string;
  theme: Theme;
};

export const QuoteSlide: React.FC<Props> = ({ quote, attribution, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const quoteProgress = spring({ frame, fps, config: { damping: 20 } });
  const quoteOpacity = interpolate(quoteProgress, [0, 1], [0, 1]);
  const quoteY = interpolate(quoteProgress, [0, 1], [30, 0]);

  const attrProgress = spring({ frame: frame - 15, fps, config: { damping: 20 } });
  const attrOpacity = interpolate(attrProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
      }}
    >
      <div
        style={{
          borderLeft: `4px solid ${theme.accent}`,
          paddingLeft: 40,
          transform: `translateY(${quoteY}px)`,
          opacity: quoteOpacity,
        }}
      >
        <div
          style={{
            color: theme.text,
            fontSize: 42,
            fontFamily: theme.fontFamily,
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          &ldquo;{quote}&rdquo;
        </div>
        {attribution && (
          <div
            style={{
              color: theme.accent,
              fontSize: 28,
              fontFamily: theme.fontFamily,
              marginTop: 32,
              opacity: attrOpacity,
            }}
          >
            &mdash; {attribution}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
