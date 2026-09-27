"use client";

import { Player } from "@remotion/player";
import { Storyboard } from "@/components/video/storyboard";
import { DIMENSIONS, FPS, sceneFrames, type RenderScene } from "@/components/video/types";

export function PreviewPlayer({ scenes, format }: { scenes: RenderScene[]; format: string }) {
  const { width, height } = DIMENSIONS[format] ?? DIMENSIONS["16:9"];
  return (
    <Player
      component={Storyboard}
      inputProps={{ scenes }}
      durationInFrames={scenes.reduce((sum, s) => sum + sceneFrames(s), 0)}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      controls
      style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${width} / ${height}` }}
    />
  );
}
