"use client";

import { Player } from "@remotion/player";
import { StoryWorld, type StoryWorldProps } from "@/components/video/engine/story-world";
import { Storyboard } from "@/components/video/storyboard";
import { FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import type { FlowPlan } from "@/components/video/flow/types";
import {
  DIMENSIONS,
  FPS,
  sceneTimings,
  type RenderProps,
} from "@/components/video/types";

export function PreviewPlayer({ format, story, flow, ...props }: RenderProps) {
  const { width, height } = DIMENSIONS[format] ?? DIMENSIONS["16:9"];
  if (flow) {
    const plan = flow.plan as FlowPlan;
    return (
      <Player
        component={FlowScene}
        inputProps={{ plan, audioUrl: props.audioUrl } satisfies FlowSceneProps}
        durationInFrames={Math.max(1, plan.duration)}
        fps={FPS}
        compositionWidth={width}
        compositionHeight={height}
        controls
        // Narration + up to 14 motion sounds can be mounted at once.
        numberOfSharedAudioTags={20}
        style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${width} / ${height}` }}
      />
    );
  }
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
