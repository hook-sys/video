"use client";

import { Player } from "@remotion/player";
import { Storyboard } from "@/components/video/storyboard";
import {
  DIMENSIONS,
  FPS,
  sceneTimings,
  type StoryboardProps,
} from "@/components/video/types";

export function PreviewPlayer({ format, ...props }: StoryboardProps & { format: string }) {
  const { width, height } = DIMENSIONS[format] ?? DIMENSIONS["16:9"];
  return (
    <Player
      component={Storyboard}
      inputProps={props}
      durationInFrames={sceneTimings(props.scenes, props.durationSeconds).total}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      controls
      style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${width} / ${height}` }}
    />
  );
}
