import { Composition } from "remotion";
import { SimpleFilm } from "@/components/video/simple/film";
import { FILM_ID, type SimplePlan } from "@/components/video/simple/types";

// The film: its length and frame (16:9, 9:16 or 1:1) come from the plan.
export function RemotionRoot() {
  return (
    <Composition
      id={FILM_ID}
      component={SimpleFilm as unknown as React.ComponentType<Record<string, unknown>>}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{} as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const plan = (props as unknown as { plan?: SimplePlan }).plan;
        return { durationInFrames: Math.max(1, plan?.duration ?? 300), width: plan?.w ?? 1920, height: plan?.h ?? 1080 };
      }}
    />
  );
}
