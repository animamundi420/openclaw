import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import type { Theme } from "../../themes.js";

type Props = {
  src: string;
  caption?: string;
  theme: Theme;
};

export const ImageSlide: React.FC<Props> = ({ src, caption, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageProgress = spring({ frame, fps, config: { damping: 20 } });
  const imageOpacity = interpolate(imageProgress, [0, 1], [0, 1]);
  const imageScale = interpolate(imageProgress, [0, 1], [1.05, 1]);

  const captionProgress = spring({ frame: frame - 15, fps, config: { damping: 20 } });
  const captionOpacity = interpolate(captionProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          opacity: imageOpacity,
          transform: `scale(${imageScale})`,
          overflow: "hidden",
        }}
      >
        <Img
          src={src}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: 12,
          }}
        />
      </div>
      {caption && (
        <div
          style={{
            color: theme.text,
            fontSize: 28,
            fontFamily: theme.fontFamily,
            textAlign: "center",
            marginTop: 24,
            opacity: captionOpacity,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
