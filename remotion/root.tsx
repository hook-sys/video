import { Composition } from "remotion";
import { ComposerFilm } from "@/components/video/composer/film";
import { COMPOSER_ID, type ComposerProps } from "@/components/video/composer/types";

// The Composer's film: its length and frame (16:9, 9:16 or 1:1) come from the plan.
export function RemotionRoot() {
  return (
    <Composition
      id={COMPOSER_ID}
      component={ComposerFilm as unknown as React.ComponentType<Record<string, unknown>>}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{} as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const plan = (props as unknown as ComposerProps).plan;
        return { durationInFrames: Math.max(1, plan?.duration ?? 300), width: plan?.w ?? 1920, height: plan?.h ?? 1080 };
      }}
    />
  );
}
