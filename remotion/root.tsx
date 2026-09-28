import { Composition } from "remotion";
import { DURATION, HEIGHT, WIDTH } from "@/components/video/reference/plan";
import { ReferenceDemo } from "@/components/video/reference/reference-demo";
import { REFERENCE_NARRATION, REFERENCE_STORY } from "@/components/video/engine/fixtures/reference-story";
import { STORY_WORLD_ID, StoryWorld, type StoryWorldProps } from "@/components/video/engine/story-world";
import { Storyboard } from "@/components/video/storyboard";
import { FLOW_SCENE_ID, FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import { ecommercePlan } from "@/components/video/flow/fixtures/ecommerce";
import { paymentsHubPlan } from "@/components/video/flow/fixtures/payments-hub";
import { GALLERY_CELL, GALLERY_COLS, LOTTIE_GALLERY_ID, LottieGallery, galleryRows } from "@/components/video/lottie/gallery";
import {
  COMPOSITION_ID,
  DIMENSIONS,
  FPS,
  sceneTimings,
  type RenderProps,
} from "@/components/video/types";

// `format` is only used for metadata; the scenes themselves are unchanged.
const RenderStoryboard = (props: RenderProps) => <Storyboard {...props} />;

// Size and length come from the project's props at render time.
export function RemotionRoot() {
  return (
    <>
    <Composition
      id={COMPOSITION_ID}
      component={RenderStoryboard}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1}
      defaultProps={{ scenes: [], durationSeconds: 1, format: "16:9" } as RenderProps}
      calculateMetadata={({ props }) => ({
        ...(DIMENSIONS[props.format] ?? DIMENSIONS["16:9"]),
        durationInFrames: sceneTimings(props.scenes, props.durationSeconds).total,
      })}
    />
    {/* Phase 1 renderer proof: one continuous, hard-coded reference video. */}
    <Composition id="ReferenceDemo" component={ReferenceDemo} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={DURATION} />
    {/* Phase 2B: generic continuous story engine (not used by customer projects yet). */}
    <Composition
      id={STORY_WORLD_ID}
      component={StoryWorld}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={450}
      defaultProps={{ story: REFERENCE_STORY, narration: REFERENCE_NARRATION, durationSeconds: 15 } as StoryWorldProps}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.durationSeconds * FPS)) })}
    />
    {/* Flow engine: pattern-built continuous motion graphics (reference: e-commerce). */}
    <Composition
      id={FLOW_SCENE_ID}
      component={FlowScene}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={450}
      defaultProps={{ plan: ecommercePlan() } as FlowSceneProps}
      calculateMetadata={({ props }) => ({ durationInFrames: props.plan.duration })}
    />
    <Composition
      id="FlowPaymentsHub"
      component={FlowScene}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={450}
      defaultProps={{ plan: paymentsHubPlan() } as FlowSceneProps}
      calculateMetadata={({ props }) => ({ durationInFrames: props.plan.duration })}
    />
    {/* QA only: every Lottie micro-animation in one grid. */}
    <Composition
      id={LOTTIE_GALLERY_ID}
      component={LottieGallery}
      fps={FPS}
      width={GALLERY_COLS * GALLERY_CELL}
      height={galleryRows() * GALLERY_CELL}
      durationInFrames={60}
    />
    </>
  );
}
