"use client";

import { Player } from "@remotion/player";
import { StoryWorld, type StoryWorldProps } from "@/components/video/engine/story-world";
import { Storyboard } from "@/components/video/storyboard";
import {
  DIMENSIONS,
  FPS,
  sceneTimings,
  type RenderProps,
} from "@/components/video/types";

export function PreviewPlayer({ format, story, ...props }: RenderProps) {
  const { width, height } = DIMENSIONS[format] ?? DIMENSIONS["16:9"];
  if (story) {
    const storyProps: StoryWorldProps = { ...story, durationSeconds: props.durationSeconds, words: props.words ?? null, audioUrl: props.audioUrl };
    return (
      <Player
        component={StoryWorld}
        inputProps={storyProps}
        durationInFrames={Math.max(1, Math.round(props.durationSeconds * FPS))}
        fps={FPS}
        compositionWidth={width}
        compositionHeight={height}
        controls
        // Narration + up to 16 event sounds can be mounted at once; the default
        // (5) makes the Player throw mid-playback and restart from 0:00.
        numberOfSharedAudioTags={20}
        style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${width} / ${height}` }}
      />
    );
  }
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
