import { Composition } from "remotion";
import { DURATION, HEIGHT, WIDTH } from "@/components/video/reference/plan";
import { ReferenceDemo } from "@/components/video/reference/reference-demo";
import { Storyboard } from "@/components/video/storyboard";
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
    </>
  );
}
