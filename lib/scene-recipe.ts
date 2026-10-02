import { z } from "zod";
import { Choreography, ModelChoreography } from "@/lib/choreography";
import type { EnvBackdrop } from "@/components/video/flow/backdrop-names";
import type { Vec } from "@/components/video/flow/types";

// Scene Recipe: how one scene visually exists — its world, its hero, the few
// objects that support it, where everything stands (and at which depth),
// where the words go, what the camera means to do, what the objects do on
// their words and how the scene arrives. The Director writes intents only
// (enums, ids and narration cues; never coordinates). lib/shots.ts expands a
// recipe into scene beats and the scene compiler (compile-scene.ts) turns
// them into positions, layers, camera keys and transitions here.
//
// Every value reaches the renderer or is reported: an intent the renderer has
// no exact form for is mapped to its closest one (RECIPE_MAPPED says which),
// a behavior it cannot run is dropped with a reason (BehaviorReport).

export const ENVIRONMENTS = ["open", "studio", "dark-space", "grid-space", "product-space", "data-space", "cinematic"] as const;
export const HERO_TYPES = ["device", "3d-object", "data-visual", "typography", "ui-plane", "product", "object-group"] as const;
export const SUPPORT_LAYERS = ["background", "midground", "foreground"] as const;
export const RELATIONS = ["feeds-hero", "from-hero", "beside-hero", "behind-hero", "orbits-hero"] as const;
export const COMPOSITIONS = ["hero-right", "hero-left", "hero-center", "asymmetric", "depth-stack", "foreground-hero", "cinematic-wide", "split-depth", "typography-led", "full-frame"] as const;
export const TYPE_POSITIONS = ["auto", "left", "right", "top-left", "top", "bottom", "bottom-left"] as const;
export const RECIPE_CAMERAS = ["static", "push-in", "pull-back", "lateral", "focus-hero", "reveal", "orbit-intent"] as const;
export const RECIPE_BEHAVIORS = ["reveal", "move", "connect", "flow", "assemble", "merge", "transform", "highlight", "expand", "focus", "arrange"] as const;
export const RECIPE_TRANSITIONS = ["cut", "push", "panel-wipe", "iris", "flash", "object-transform", "morph-intent", "dissolve"] as const;

// Asset requirements: what a scene needs, as structure instead of a free
// visual description. lib/asset-selection.ts matches each one against the
// approved assets (heroes only from the hero allowlist) or leaves it
// unresolved; it never forces a low-quality pick.
export const ASSET_CATEGORIES = ["hero", "supporting", "accent"] as const;
export const ASSET_ROLES = ["primary", "secondary", "accent"] as const;
export const ASSET_CONCEPTS = ["payment-card", "money", "chart", "growth", "dashboard", "security-lock", "security-shield", "ai-chip", "document", "chat", "email", "goal", "success", "award", "idea", "question", "speed", "other"] as const;
export type AssetConcept = (typeof ASSET_CONCEPTS)[number];
export const AssetRequirement = z.object({
  category: z.enum(ASSET_CATEGORIES),
  concept: z.enum(ASSET_CONCEPTS),
  role: z.enum(ASSET_ROLES),
  visual_need: z.string(), // a few words: what the asset must show
  preferred_asset_id: z.string().nullable(),
  fallback_allowed: z.boolean(),
  // which recipe element it is for: "hero", a supporting id, or null (the scene)
  slot: z.string().nullable(),
});
export type AssetRequirement = z.infer<typeof AssetRequirement>;

export type Environment = (typeof ENVIRONMENTS)[number];
export type Composition = (typeof COMPOSITIONS)[number];
export type RecipeTransition = (typeof RECIPE_TRANSITIONS)[number];

// (choreography is optional here; the Director's strict output schema,
// ModelSceneRecipe, asks for it as null or a value)
export const RecipeBehavior = z.object({ type: z.enum(RECIPE_BEHAVIORS), from: z.string(), to: z.string().nullable(), cue: z.string(), choreography: Choreography.nullable().optional() });
export type RecipeBehavior = z.infer<typeof RecipeBehavior>;

export const SceneRecipe = z.object({
  scene_id: z.string(),
  environment: z.enum(ENVIRONMENTS),
  // asset: an asset reference (object:rocket, device:laptop/light, visual:bars,
  // text:98%, card:<template>/<style>, logo); "card" = this shot's ui card.
  hero: z.object({ type: z.enum(HERO_TYPES), asset: z.string(), role: z.string(), persistence: z.enum(["persistent", "scene"]) }),
  // 1–4 objects with a purpose; id is what behaviors name.
  supporting: z.array(z.object({ id: z.string(), asset: z.string(), role: z.string(), layer: z.enum(SUPPORT_LAYERS), relation: z.enum(RELATIONS), persistence: z.enum(["persistent", "scene"]) })),
  composition: z.enum(COMPOSITIONS),
  typography: z.object({ position: z.enum(TYPE_POSITIONS), scale: z.enum(["hero", "supporting"]), emphasis: z.enum(["word-highlight", "pill", "strike", "none"]) }),
  camera: z.object({ intent: z.enum(RECIPE_CAMERAS), intensity: z.enum(["low", "medium", "high"]) }),
  // from / to: "hero" or a supporting id; cue: 1–6 narration words.
  // choreography: the event's phases (lib/choreography.ts), null = the engine's timing.
  behaviors: z.array(RecipeBehavior),
  transition_in: z.enum(RECIPE_TRANSITIONS),
  transition_out: z.enum(RECIPE_TRANSITIONS).nullable(),
  // What the scene's assets must be (null: the assets named above as they are).
  assets: z.array(AssetRequirement).nullable(),
});
export type SceneRecipe = z.infer<typeof SceneRecipe>;
// A stored recipe: ones saved before asset requirements have none, and an
// unreadable list is dropped (the recipe itself is kept).
// What the Director writes (structured output: every key present; a missing
// choreography reads as null).
export const ModelSceneRecipe = SceneRecipe.extend({ behaviors: z.array(RecipeBehavior.extend({ choreography: ModelChoreography.nullable().default(null) })) });
// Behaviors saved before choreography have none; an unreadable one is null.
export const StoredSceneRecipe = SceneRecipe.extend({
  assets: z.array(AssetRequirement).nullable().default(null).catch(null),
  behaviors: z.array(RecipeBehavior.extend({ choreography: Choreography.nullable().optional().catch(null) })),
});

// Depth layers (z order, size and camera response). The hero layer is the
// scene's own; background sits behind and blurred, foreground in front.
export const LAYER = { background: 0, midground: 1, hero: 2, foreground: 3 } as const;
export type Layer = 0 | 1 | 2 | 3;
// How far each layer follows the camera (1 = the world; < 1 farther away,
// > 1 nearer): a camera move shifts and scales the layers by different
// amounts, so the scene has depth (components/video/flow/states.ts).
export const PARALLAX: Record<Layer, number> = { 0: 0.55, 1: 0.82, 2: 1, 3: 1.3 };

// Environment → its world: an approved environment backdrop (the place) and
// an approved atmosphere (light over it), either may be none (the plain
// canvas). Only production-approved backdrops (ENV_APPROVED_BACKDROPS): the
// audit rejected the studio spotlight and the data-space data-stream, and
// horizon / light-beams / glow (70–72) are not premium. With one approved
// environment (perspective-grid) and one atmosphere (aurora) some
// environments still share a look until environment plates exist; dark-space,
// product-space and cinematic are three different worlds.
export type EnvWorld = { environment: "perspective-grid" | null; atmosphere: "aurora" | null };
export const ENV_WORLD: Record<Environment, EnvWorld> = {
  open: { environment: null, atmosphere: null }, // the plain canvas and its edge decor
  studio: { environment: null, atmosphere: null }, // a clean, neutral studio (was spotlight: rejected)
  "dark-space": { environment: null, atmosphere: "aurora" }, // colour drifting in a deep space
  "grid-space": { environment: "perspective-grid", atmosphere: null },
  "product-space": { environment: "perspective-grid", atmosphere: null }, // a floor the product stands on
  "data-space": { environment: "perspective-grid", atmosphere: null }, // the spatial data floor (was data-stream: rejected)
  cinematic: { environment: "perspective-grid", atmosphere: "aurora" }, // a stage under curtains of light
};
// The one backdrop a recipe scene beat names (its world's main layer; mesh = none).
export const ENV_BACKDROP: Record<Environment, EnvBackdrop> = Object.fromEntries(
  Object.entries(ENV_WORLD).map(([e, w]) => [e, w.environment ?? w.atmosphere ?? "mesh"]),
) as Record<Environment, EnvBackdrop>;

// What the compiler needs of a recipe scene (stored on its scene beat).
export type CompiledRecipe = {
  id: string;
  composition: Composition;
  environment: Environment;
  hero: string; // element id
  heroType: (typeof HERO_TYPES)[number];
  // per element id: its role, depth layer and relation to the hero
  roles: Record<string, { role: "hero" | "support"; layer: Layer; relation: (typeof RELATIONS)[number] | null }>;
  text: { position: (typeof TYPE_POSITIONS)[number]; scale: "hero" | "supporting" };
  camera: { intent: (typeof RECIPE_CAMERAS)[number]; intensity: "low" | "medium" | "high" };
  flash: boolean; // a brand-colour circle sweeps the canvas as the scene arrives
  words: boolean; // the scene has a line of words (else the picture takes their room)
};
export const CompiledRecipeSchema = z.object({
  id: z.string(),
  composition: z.enum(COMPOSITIONS),
  environment: z.enum(ENVIRONMENTS),
  hero: z.string(),
  heroType: z.enum(HERO_TYPES),
  roles: z.record(z.string(), z.object({ role: z.enum(["hero", "support"]), layer: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), relation: z.enum(RELATIONS).nullable() })),
  text: z.object({ position: z.enum(TYPE_POSITIONS), scale: z.enum(["hero", "supporting"]) }),
  camera: z.object({ intent: z.enum(RECIPE_CAMERAS), intensity: z.enum(["low", "medium", "high"]) }),
  flash: z.boolean(),
  words: z.boolean().default(true),
});

// Transitions without an exact renderer form, and what they become.
export const RECIPE_MAPPED: Partial<Record<RecipeTransition, string>> = {
  iris: "a brand-colour circle sweeps the canvas (flash) while the scene dissolves in",
  "morph-intent": "zoom-through (the old scene grows past the camera)",
};
// The transition at a scene boundary, deterministic, from both sides:
// 1. the first scene cuts in ("first");
// 2. the incoming recipe asks for object-transform and the outgoing scene is
//    a recipe scene whose hero it can carry — continuity wins ("carry");
// 3. the outgoing recipe's transition_out ("out");
// 4. the incoming recipe's transition_in ("in");
// 5. neither: null, the shot template's own handover ("default").
export type BoundarySource = "first" | "carry" | "out" | "in" | "default";
export function boundaryTransition({ first, out, into, canCarry }: { first: boolean; out: RecipeTransition | null; into: RecipeTransition | null; canCarry: boolean }): { transition: RecipeTransition | null; source: BoundarySource } {
  if (first) return { transition: "cut", source: "first" };
  if (into === "object-transform" && canCarry) return { transition: into, source: "carry" };
  if (out) return { transition: out, source: "out" };
  if (into) return { transition: into, source: "in" };
  return { transition: null, source: "default" };
}

// Recipe transition → the scene compiler's transition (+ flash).
export function sceneTransition(tr: RecipeTransition, seed: number): { transition: "cut" | "dissolve" | "push-left" | "push-up" | "panel-wipe" | "zoom-through"; flash: boolean } {
  switch (tr) {
    case "cut":
      return { transition: "cut", flash: false };
    case "push":
      return { transition: seed % 2 ? "push-up" : "push-left", flash: false };
    case "panel-wipe":
      return { transition: "panel-wipe", flash: false };
    case "iris":
    case "flash":
      return { transition: "dissolve", flash: true };
    case "morph-intent":
      return { transition: "zoom-through", flash: false };
    case "object-transform":
    case "dissolve":
      return { transition: "dissolve", flash: false };
  }
}

// ── composition geometry (world px around the scene centre; the explainer
// camera frames ±860 × ±480 of it) ──
type Spot = { pos: Vec; box: Vec; grow: number };
type Geometry = {
  hero: Spot;
  // where the words go by default (screen px from the frame centre)
  text: Exclude<(typeof TYPE_POSITIONS)[number], "auto">;
  // anchors for supporting objects by relation
  anchors: Record<(typeof RELATIONS)[number], Vec[]>;
};
const G = (hero: [number, number, number, number, number], text: Geometry["text"], a: { behind: Vec[]; feeds: Vec[]; from: Vec[]; beside: Vec[] }): Geometry => ({
  hero: { pos: [hero[0], hero[1]], box: [hero[2], hero[3]], grow: hero[4] },
  text,
  anchors: { "behind-hero": a.behind, "feeds-hero": a.feeds, "from-hero": a.from, "beside-hero": a.beside, "orbits-hero": a.beside },
});
const GEOMETRY: Record<Composition, Geometry> = {
  "hero-right": G([470, 0, 560, 560, 2.4], "left", { behind: [[250, -250], [700, 250]], feeds: [[150, 380], [700, -330]], from: [[740, -320], [740, 320]], beside: [[760, 300], [240, -330]] }),
  "hero-left": G([-470, 0, 560, 560, 2.4], "right", { behind: [[-250, -250], [-700, 250]], feeds: [[-740, -320], [-150, 380]], from: [[-150, 380], [-740, 320]], beside: [[-760, 300], [-240, -330]] }),
  "hero-center": G([0, -50, 620, 500, 2.2], "bottom", { behind: [[-430, -180], [430, -180]], feeds: [[-620, 0], [-620, -260]], from: [[620, 0], [620, -260]], beside: [[560, -250], [-560, -250]] }),
  asymmetric: G([380, 60, 640, 620, 2.6], "top-left", { behind: [[-60, -200], [760, -260]], feeds: [[-320, 270], [-650, 250]], from: [[770, -300], [760, 330]], beside: [[760, 320], [-320, 270]] }),
  "depth-stack": G([420, 40, 560, 560, 2.4], "left", { behind: [[170, -190], [640, -260]], feeds: [[700, -310], [190, 340]], from: [[750, 320], [700, -310]], beside: [[190, 340], [750, 320]] }),
  "foreground-hero": G([500, 190, 760, 760, 3], "top-left", { behind: [[0, -160], [-560, 120]], feeds: [[-280, 270], [-640, 280]], from: [[800, -320], [-280, 270]], beside: [[-560, 290], [800, -320]] }),
  "cinematic-wide": G([0, 90, 460, 400, 1.8], "top", { behind: [[-520, 60], [520, 60]], feeds: [[-560, 150], [-760, 260]], from: [[560, 150], [760, 260]], beside: [[400, 220], [-400, 220]] }),
  "split-depth": G([-430, 30, 560, 560, 2.4], "top-left", { behind: [[430, 90], [700, -220]], feeds: [[-760, 300], [430, 330]], from: [[450, 300], [760, -280]], beside: [[-760, 300], [450, 300]] }),
  "typography-led": G([560, 10, 380, 380, 1.8], "left", { behind: [[720, -260], [300, 260]], feeds: [[300, 300], [780, 300]], from: [[780, 300], [780, -290]], beside: [[780, -290], [300, 300]] }),
  "full-frame": G([0, -30, 1100, 620, 2.6], "bottom", { behind: [[-620, -250], [620, -250]], feeds: [[-720, 170], [-720, -170]], from: [[720, 170], [720, -170]], beside: [[660, -270], [-660, -270]] }),
};

// Layer size (on top of the slot's box): background smaller, foreground bigger.
const LAYER_SCALE: Record<Layer, number> = { 0: 1, 1: 0.62, 2: 1, 3: 0.9 };
const SUPPORT_BOX: Record<Layer, Vec> = { 0: [420, 420], 1: [260, 260], 2: [300, 300], 3: [360, 360] };

export type RecipeSlot = { pos: Vec; box: Vec; grow: number; depth: 0 | 1 | 2; layer: Layer; scale: number };
// One slot per element id, from the composition and each element's layer
// and relation (several with one relation take its anchors in turn).
export function recipeSlots(r: CompiledRecipe, ids: string[]): Map<string, RecipeSlot> {
  const g0 = GEOMETRY[r.composition];
  // No words in the scene: the whole arrangement moves toward the centre and
  // the hero grows into the room the words would have taken.
  const dx = r.words ? 0 : -g0.hero.pos[0] * 0.6;
  const shift = (p: Vec): Vec => [Math.max(-820, Math.min(820, p[0] + dx)), p[1]];
  const g: Geometry = r.words ? g0 : { ...g0, hero: { ...g0.hero, pos: shift(g0.hero.pos), box: [g0.hero.box[0] * 1.35, g0.hero.box[1] * 1.2] }, anchors: Object.fromEntries(Object.entries(g0.anchors).map(([k, v]) => [k, v.map(shift)])) as Geometry["anchors"] };
  const out = new Map<string, RecipeSlot>();
  const used: Record<string, number> = {};
  for (const id of ids) {
    const role = r.roles[id];
    if (role?.role === "hero") {
      out.set(id, { pos: g.hero.pos, box: g.hero.box, grow: g.hero.grow, depth: 2, layer: role.layer, scale: 1 });
      continue;
    }
    // (An element with no role of its own stands where the hero is fed from.)
    const rel = role?.relation ?? "feeds-hero";
    const k = (used[rel] = (used[rel] ?? -1) + 1);
    const anchors = g.anchors[rel];
    const pos = anchors[k % anchors.length];
    const layer: Layer = role?.layer ?? 1;
    out.set(id, { pos: k >= anchors.length ? [pos[0], pos[1] + 120] : pos, box: SUPPORT_BOX[layer], grow: layer === 0 ? 1.4 : 1.2, depth: layer === 0 ? 0 : layer === 3 ? 2 : 1, layer, scale: LAYER_SCALE[layer] });
  }
  return out;
}

// Where the words go: a position the Director asked for, unless it would sit
// on the hero's side (then the composition's own place). Screen px.
export type RecipeText = { style: "side" | "headline" | "caption"; pos: Vec; align?: "right"; size: number; asked: string; used: string };
export function recipeText(r: CompiledRecipe): RecipeText {
  const g = GEOMETRY[r.composition];
  const heroSide = Math.sign(g.hero.pos[0]) * (Math.abs(g.hero.pos[0]) > 200 ? 1 : 0);
  const sideOf = (p: string) => (p === "left" || p === "top-left" || p === "bottom-left" ? -1 : p === "right" ? 1 : 0);
  const asked = r.text.position;
  const clash = asked !== "auto" && heroSide !== 0 && sideOf(asked) === heroSide;
  const centreClash = asked !== "auto" && heroSide === 0 && (asked === "left" || asked === "right") && g.hero.box[0] > 500;
  const used = asked === "auto" || clash || centreClash ? g.text : asked;
  const big = r.text.scale === "hero";
  switch (used) {
    case "left":
      return { style: "side", pos: [-800, -10], size: big ? 112 : 84, asked, used };
    case "right":
      return { style: "side", pos: [800, -10], align: "right", size: big ? 112 : 84, asked, used };
    case "top-left":
      return { style: "side", pos: [-800, -300], size: big ? 104 : 80, asked, used };
    case "bottom-left":
      return { style: "side", pos: [-800, 300], size: big ? 104 : 80, asked, used };
    case "top":
      return { style: "headline", pos: [0, -390], size: big ? 96 : 72, asked, used };
    case "bottom":
      return { style: "caption", pos: [0, 380], size: big ? 80 : 64, asked, used };
  }
}

// Camera intent → a deterministic move for the whole scene: [from centre,
// from zoom, to centre, to zoom], aimed at the hero; how far by intensity.
// (Kept within ±150 px and zoom 1.04–1.32 so the composition stays framed.)
export function recipeCamera(r: Pick<CompiledRecipe, "camera">, hero: Vec): { from: Vec; z0: number; to: Vec; z1: number; tilt?: [number, number] } {
  const k = { low: 0.5, medium: 1, high: 1.5 }[r.camera.intensity];
  const cap = (v: number) => Math.max(-150, Math.min(150, v));
  const toward = (f: number): Vec => [cap(hero[0] * f), cap(hero[1] * f)];
  const dir = Math.sign(hero[0]) || 1;
  switch (r.camera.intent) {
    case "static":
      return { from: [0, 0], z0: 1.1, to: [0, 0], z1: 1.1 };
    case "push-in":
      return { from: [0, 0], z0: 1.05, to: toward(0.12 * k), z1: Math.min(1.32, 1.05 + 0.13 * k) };
    case "pull-back":
      return { from: toward(0.14 * k), z0: Math.min(1.32, 1.06 + 0.16 * k), to: [0, 0], z1: 1.05 };
    case "lateral":
      return { from: [-dir * 60 * k, 0], z0: 1.1, to: [dir * 60 * k, -8], z1: 1.12 };
    case "focus-hero":
      return { from: [0, 0], z0: 1.07, to: toward(0.16 * k), z1: Math.min(1.32, 1.1 + 0.1 * k) };
    case "reveal":
      return { from: toward(0.3), z0: Math.min(1.32, 1.22 + 0.06 * k), to: [0, 0], z1: 1.05 };
    case "orbit-intent":
      // A lateral arc while the hero turns in 3D (rotateY): the closest the
      // 2D camera comes to circling it.
      return { from: [-dir * 45 * k, 12], z0: 1.1, to: [dir * 45 * k, -12], z1: 1.14, tilt: [-14 * k, 14 * k] };
  }
}
