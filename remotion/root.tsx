import { Composition } from "remotion";
import { DURATION, HEIGHT, WIDTH } from "@/components/video/reference/plan";
import { ReferenceDemo } from "@/components/video/reference/reference-demo";
import { REFERENCE_NARRATION, REFERENCE_STORY } from "@/components/video/engine/fixtures/reference-story";
import { STORY_WORLD_ID, StoryWorld, type StoryWorldProps } from "@/components/video/engine/story-world";
import { Storyboard } from "@/components/video/storyboard";
import { FLOW_SCENE_ID, FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import { CleanVideo } from "@/components/video/clean/clean-video";
import { CLEAN_ID, type CleanVideoProps } from "@/components/video/clean/types";
import { Film, FILM_ID, FILM_IDS, type FilmId, REF_DURATION, REF_ID, RefFilm } from "@/components/video/clean/refs";
import { shopnestPlan } from "@/components/video/clean/fixtures/sample";
import type { CleanPlan } from "@/components/video/clean/types";
import { flowlyPlan } from "@/components/video/clean/fixtures/flowly";
import { ecommercePlan } from "@/components/video/flow/fixtures/ecommerce";
import { paymentsHubPlan } from "@/components/video/flow/fixtures/payments-hub";
import { FLOW_SCRIPT_FIXTURES } from "@/components/video/flow/fixtures/scripts";
import { compileFlowScript } from "@/components/video/flow/compile";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { SCENE_FIXTURES } from "@/components/video/flow/fixtures/scenes";
import { RECIPE_DURATION, recipeFixture } from "@/components/video/flow/fixtures/recipe";
import { CARD_GALLERY_ID, CardGallery } from "@/components/video/flow/cards/gallery";
import { BACKDROP_GALLERY_ID, BackdropGallery } from "@/components/video/flow/backdrop-gallery";
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
    {/* The clean explainer (flat UI, kinetic type, story-coloured background). */}
    <Composition
      id={CLEAN_ID}
      component={CleanVideo}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={900}
      defaultProps={{ plan: flowlyPlan(0) } as CleanVideoProps}
      calculateMetadata={({ props }) => ({ durationInFrames: props.plan.duration })}
    />
    {/* Proof: the Flowly script in variant 0–3. */}
    <Composition
      id="CleanVideoProof"
      component={({ variantIndex }: { variantIndex: number }) => <CleanVideo plan={flowlyPlan(variantIndex)} />}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={flowlyPlan(0).duration}
      defaultProps={{ variantIndex: 0 }}
    />
    {/* Proof: the Flowly script as four reference-style films (0–3). */}
    <Composition id={REF_ID} component={RefFilm} fps={30} width={1920} height={1080} durationInFrames={REF_DURATION} defaultProps={{ film: 0 }} />
    {/* The film templates on any seven-part plan (glow / dusk / fly / connect). */}
    <Composition
      id={FILM_ID}
      component={Film}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={REF_DURATION}
      defaultProps={{ plan: flowlyPlan(0), film: "glow" as FilmId } as { plan: CleanPlan; film: FilmId }}
      calculateMetadata={({ props }) => ({ durationInFrames: props.plan.duration })}
    />
    {/* Proof: a second script (Shopnest) in the film templates (0–3). */}
    <Composition id="CleanFilmSample" component={({ film }: { film: number }) => <Film plan={shopnestPlan()} film={FILM_IDS[film] ?? "glow"} />} fps={30} width={1920} height={1080} durationInFrames={shopnestPlan().duration} defaultProps={{ film: 0 }} />
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
    {/* Director FlowScripts compiled by the Flow compiler (QA / checks). */}
    {FLOW_SCRIPT_FIXTURES.map((fx) => (
      <Composition
        key={fx.name}
        id={`FlowScript-${fx.name}`}
        component={FlowScene}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={Math.round(fx.durationSeconds * FPS)}
        defaultProps={{ plan: compileFlowScript(fx.script, { narration: fx.narration, durationSeconds: fx.durationSeconds, words: fx.words, brand: fx.brand, screenshots: fx.screenshots }) } as FlowSceneProps}
      />
    ))}
    {SCENE_FIXTURES.map((fx) => (
      <Composition
        key={fx.name}
        id={`SceneScript-${fx.name}`}
        component={FlowScene}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={fx.durationSeconds * FPS}
        defaultProps={{ plan: compileSceneScript(fx.script, { narration: fx.narration, durationSeconds: fx.durationSeconds, words: fx.words, brand: fx.brand, screenshots: fx.screenshots }) } as FlowSceneProps}
      />
    ))}
    {/* QA only: the Scene Recipe proof (every scene composed by its recipe). */}
    <Composition id="SceneRecipe-demo" component={FlowScene} fps={FPS} width={1920} height={1080} durationInFrames={RECIPE_DURATION * FPS} defaultProps={{ plan: recipeFixture().plan } as FlowSceneProps} />
    {/* QA only: every card template (one style per page) and the device mockups. */}
    <Composition id={CARD_GALLERY_ID} component={CardGallery} fps={FPS} width={1920} height={1080} durationInFrames={90} defaultProps={{ page: 0, style: "glass" as const, theme: "teal" as const }} />
    {/* QA only: every scene backdrop, animated. */}
    <Composition id={BACKDROP_GALLERY_ID} component={BackdropGallery} fps={FPS} width={1920} height={1080} durationInFrames={90} defaultProps={{ theme: "lavender" as const }} />
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
