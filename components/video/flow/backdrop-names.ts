// Scene backdrops the Director can choose (rendered by backdrops.tsx behind
// the elements, over the drifting colour mesh). Kept free of React so the
// script schema can import it.
export const BACKDROPS = [
  "mesh", // only the soft colour mesh (default)
  "particles", // tiny lights drifting upward
  "dot-field", // a grid of dots with a ripple of light running through it
  "grid", // a fine blueprint grid
  "perspective-grid", // a floor grid receding into the distance, moving forward
  "light-beams", // soft diagonal beams sweeping across
  "rings", // concentric rings pulsing out from the centre
  "waves", // flowing sine lines
  "glow", // a large central glow breathing, darker edges
  "data-stream", // columns of small dashes streaming down
  "blobs", // liquid colour blobs morphing
  "grain", // a fine film grain over the mesh
  "energy", // curved trails of light sweeping through the frame
  "spotlight", // a swaying stage light from above, the rest in shade
  "horizon", // a bright horizon line with a glow rising behind it
  "aurora", // soft curtains of colour drifting across the top
] as const;
export type BackdropName = (typeof BACKDROPS)[number];
export const isBackdrop = (x: unknown): x is BackdropName => typeof x === "string" && (BACKDROPS as readonly string[]).includes(x);

// Production approval (motionbrief-asset-quality-audit): the backdrops a
// Scene Recipe environment may resolve to — the plain canvas (mesh) and the
// two the audit kept (perspective-grid 80, aurora 80). Nothing else is
// selectable from an environment.
export const ENV_APPROVED_BACKDROPS = ["mesh", "perspective-grid", "aurora"] as const satisfies readonly BackdropName[];
export type EnvBackdrop = (typeof ENV_APPROVED_BACKDROPS)[number];
// Rejected in the audit (< 70): never rendered. Wherever one is still named
// (the Scene Director, an older stored script) it is drawn as its closest
// approved backdrop instead.
export const REJECTED_BACKDROPS: Partial<Record<BackdropName, EnvBackdrop>> = {
  spotlight: "mesh", // a stage light → the clean studio canvas
  "data-stream": "perspective-grid", // streaming data → the spatial data floor
  grid: "perspective-grid", // a flat blueprint grid → the receding grid
  rings: "mesh", // pulsing rings → the calm canvas
};
export const renderableBackdrop = (k: string) => REJECTED_BACKDROPS[k as BackdropName] ?? k;

// What each backdrop is in the world (World Stack audit). "base" draws
// nothing (the canvas itself); an environment is the place (a floor, a
// stage); an atmosphere is light or air over it; a pattern is texture.
// A scene's world holds at most one environment and one atmosphere: they are
// two slots of the backdrop timeline (patterns take the atmosphere slot).
export type BackdropRole = "base" | "environment" | "atmosphere" | "pattern";
export const BACKDROP_ROLE: Record<BackdropName, BackdropRole> = {
  mesh: "base",
  "perspective-grid": "environment",
  grid: "environment",
  horizon: "environment",
  spotlight: "environment",
  aurora: "atmosphere",
  glow: "atmosphere",
  "light-beams": "atmosphere",
  energy: "atmosphere",
  blobs: "atmosphere",
  grain: "atmosphere",
  particles: "atmosphere",
  waves: "atmosphere",
  "dot-field": "pattern",
  rings: "pattern",
  "data-stream": "pattern",
};
export type BackdropSlot = "environment" | "atmosphere";
export const backdropSlot = (k: string): BackdropSlot => (BACKDROP_ROLE[k as BackdropName] === "environment" ? "environment" : "atmosphere");
// One strength per backdrop, whoever asked for it (a recipe, a shot, a pace):
// the approved ones at full presence, the rest quiet. An entry's own
// `strength` is the only override.
export const BACKDROP_STRENGTH: Partial<Record<BackdropName, number>> = { "perspective-grid": 0.9, aurora: 0.9 };
export const backdropStrength = (k: string) => BACKDROP_STRENGTH[k as BackdropName] ?? 0.55;
