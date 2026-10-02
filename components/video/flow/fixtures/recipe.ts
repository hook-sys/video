import { expandShots, type BehaviorReport, type Shot, type ShotScript } from "@/lib/shots";
import type { SceneRecipe } from "@/lib/scene-recipe";
import { repairCues } from "@/lib/scene-script";
import { compileSceneScript } from "../compile-scene";
import type { FlowPlan } from "../types";

// Scene Recipe proof (QA only, never used for a customer video): one ~25 s
// explainer for a made-up analytics product whose every scene has a recipe —
// a hero, purposeful supporting objects at their depth layers, an
// environment, placed words, a camera intent, behaviors on the voice and a
// meaningful transition. Rendered by check:story and the parity check.

export const RECIPE_NARRATION =
  "Your data is scattered across ten different tools. Reports take days to build. Flowly pulls every source into one live dashboard. Revenue updates the moment a sale happens. Teams see growth up 40% in the first month. One view. Every answer. Start free with Flowly.";
export const RECIPE_DURATION = 26;
export const RECIPE_BRAND = { name: "Flowly", cta: "Start free" };

const shot = (s: Partial<Shot> & Pick<Shot, "shot" | "cue" | "recipe">): Shot => ({
  subject: null, label: null, line: null, line_cue: null, accent: null, mark: null, card: null, title: null, input: null, button: null, action_cue: null, result: null, result_cue: null, items: null, camera: null, objects: null, ...s,
});
const R = (r: Omit<SceneRecipe, "transition_out" | "assets"> & Partial<Pick<SceneRecipe, "transition_out" | "assets">>): SceneRecipe => ({ transition_out: null, assets: null, ...r });

export const RECIPE_SHOTS: ShotScript = {
  version: 3,
  theme: "lavender",
  creative: null,
  concepts: null,
  variant: "A",
  direction: null,
  dna: null,
  shots: [
    // The problem: one question in a studio light, the tools feeding it.
    shot({
      shot: "problem", cue: "Your data is scattered", subject: "object:question", line: "Scattered across ten tools", accent: "Scattered",
      recipe: R({
        scene_id: "s1", environment: "studio", composition: "hero-right",
        hero: { type: "3d-object", asset: "object:question", role: "the unanswered question", persistence: "scene" },
        supporting: [
          { id: "sheet", asset: "icon:file-spreadsheet", role: "a scattered source", layer: "midground", relation: "feeds-hero", persistence: "scene" },
          { id: "mail", asset: "icon:mail", role: "another source", layer: "background", relation: "behind-hero", persistence: "scene" },
        ],
        typography: { position: "left", scale: "hero", emphasis: "word-highlight" },
        camera: { intent: "push-in", intensity: "medium" },
        behaviors: [{ type: "flow", from: "sheet", to: "hero", cue: "ten different tools" }],
        transition_in: "cut",
      }),
    }),
    // Time lost: the clock, struck words, a panel wipes it in.
    shot({
      shot: "problem", cue: "Reports take", subject: "visual:clock", line: "Reports take days", accent: "days", mark: "strike",
      recipe: R({
        scene_id: "s2", environment: "studio", composition: "asymmetric",
        hero: { type: "data-visual", asset: "visual:clock", role: "time lost", persistence: "scene" },
        supporting: [{ id: "doc", asset: "icon:file-text", role: "the report", layer: "foreground", relation: "beside-hero", persistence: "scene" }],
        typography: { position: "top-left", scale: "hero", emphasis: "strike" },
        camera: { intent: "lateral", intensity: "medium" },
        behaviors: [{ type: "highlight", from: "hero", to: null, cue: "to build" }],
        transition_in: "panel-wipe",
      }),
    }),
    // The product at work: a ui plane in 3D, sources flow in, results come out.
    shot({
      shot: "ui", cue: "Flowly pulls", card: "action-panel", title: "Live dashboard", input: "All sources connected", button: "Sync",
      recipe: R({
        scene_id: "s3", environment: "product-space", composition: "depth-stack",
        hero: { type: "ui-plane", asset: "card", role: "the product at work", persistence: "scene" },
        supporting: [
          { id: "db", asset: "icon:database", role: "every source", layer: "midground", relation: "feeds-hero", persistence: "scene" },
          { id: "bars", asset: "visual:bars", role: "live results", layer: "foreground", relation: "from-hero", persistence: "persistent" },
        ],
        typography: { position: "auto", scale: "supporting", emphasis: "none" },
        camera: { intent: "focus-hero", intensity: "medium" },
        behaviors: [
          { type: "flow", from: "db", to: "hero", cue: "every source" },
          { type: "reveal", from: "bars", to: null, cue: "one live dashboard" },
        ],
        transition_in: "iris",
      }),
    }),
    // The same bars carry into the data world; a sale flies into them.
    shot({
      shot: "line", cue: "Revenue updates", line: "Updates the moment it happens", accent: "moment", mark: "pill",
      recipe: R({
        scene_id: "s4", environment: "data-space", composition: "hero-left",
        hero: { type: "data-visual", asset: "visual:bars", role: "revenue growing", persistence: "scene" },
        supporting: [{ id: "coin", asset: "object:coin", role: "a sale", layer: "midground", relation: "feeds-hero", persistence: "scene" }],
        typography: { position: "right", scale: "hero", emphasis: "pill" },
        camera: { intent: "pull-back", intensity: "medium" },
        behaviors: [{ type: "merge", from: "coin", to: "hero", cue: "a sale happens" }],
        transition_in: "object-transform",
      }),
    }),
    // The proof: the number as the hero, wide, a rocket in front.
    shot({
      shot: "number", cue: "Teams see growth", subject: "text:40%", line: "Growth up 40%",
      recipe: R({
        scene_id: "s5", environment: "data-space", composition: "cinematic-wide",
        hero: { type: "typography", asset: "text:40%", role: "the proof", persistence: "scene" },
        supporting: [{ id: "rocket", asset: "object:rocket", role: "momentum", layer: "foreground", relation: "beside-hero", persistence: "scene" }],
        typography: { position: "top", scale: "hero", emphasis: "none" },
        camera: { intent: "reveal", intensity: "medium" },
        behaviors: [{ type: "highlight", from: "hero", to: null, cue: "first month" }],
        transition_in: "push",
      }),
    }),
    // The promise: type-led, a target turning in 3D, the check arriving behind it.
    shot({
      shot: "line", cue: "One view.", subject: "object:target", line: "One view. Every answer.", accent: "answer.", mark: "pill",
      recipe: R({
        scene_id: "s6", environment: "cinematic", composition: "typography-led",
        hero: { type: "3d-object", asset: "object:target", role: "one clear goal", persistence: "scene" },
        supporting: [{ id: "ok", asset: "object:check", role: "every answer", layer: "background", relation: "behind-hero", persistence: "scene" }],
        typography: { position: "left", scale: "hero", emphasis: "pill" },
        camera: { intent: "orbit-intent", intensity: "medium" },
        behaviors: [{ type: "reveal", from: "ok", to: null, cue: "Every answer." }],
        transition_in: "morph-intent",
      }),
    }),
  ],
};

// The same shots without recipes: the template composition (the fallback).
export const RECIPE_SHOTS_LEGACY: ShotScript = { ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((s) => ({ ...s, recipe: null })) };

export function recipeFixture(shots: ShotScript = RECIPE_SHOTS) {
  const notes: string[] = [];
  const behaviors: BehaviorReport[] = [];
  const fixed = repairCues(expandShots(shots, notes, RECIPE_NARRATION, { seed: 7 }, behaviors), RECIPE_NARRATION, null, RECIPE_DURATION);
  const plan: FlowPlan = compileSceneScript(fixed.script, { narration: RECIPE_NARRATION, durationSeconds: RECIPE_DURATION, brand: RECIPE_BRAND });
  return { script: fixed.script, plan, notes: [...notes, ...fixed.notes], behaviors };
}
