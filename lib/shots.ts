import { z } from "zod";
import { isIconName } from "@/components/video/icons";
import { FLOW_THEMES } from "@/lib/flow-script";
import { CAMERA_MOVES, CUTS, DECORS, ICON_STYLES, parseAsset, TONES, SceneScript, type SceneBeat, type SceneContent, type SceneElement } from "@/lib/scene-script";
import { DEVICE_MODELS } from "@/components/video/flow/cards/device-data";
import { type AssetSelection, applyAssetSelection } from "@/lib/asset-selection";
import { normalizeBackground, normalizeChoreography } from "@/lib/choreography";
import { boundaryTransition, type CompiledRecipe, ENV_BACKDROP, ModelSceneRecipe, LAYER, RECIPE_MAPPED, type RecipeTransition, SceneRecipe, sceneTransition, StoredSceneRecipe } from "@/lib/scene-recipe";
import { tokenize } from "@/lib/voice-timing";

// Shot templates: tested building blocks a video is made of. The Director
// only picks a shot per sentence and fills its words; every size, place,
// entrance, cursor move and sound is fixed here and checked by rendering
// (npm run check:story renders each shot). A ShotScript expands into a
// SceneScript, which the scene compiler turns into the video.

// Phase 3: camera intents the Director picks per shot.
export const SHOT_INTENTS = ["establish", "reveal", "push", "pull_back", "follow", "track", "hold", "overhead", "close", "transition"] as const;
export type ShotIntent = (typeof SHOT_INTENTS)[number];
// Each intent as one of the compiler's camera moves (compile-scene.ts resolves
// position, zoom, duration and easing).
export const INTENT_CAMERA: Record<ShotIntent, (typeof CAMERA_MOVES)[number]> = {
  establish: "drift", // wide, settling
  reveal: "pull-back", // the subject opens up
  push: "push-in",
  close: "push-in",
  pull_back: "pull-back",
  follow: "pan-right",
  track: "pan-left",
  hold: "hold",
  overhead: "rise",
  transition: "drift",
};
export const SHOT_KINDS = ["problem", "steps", "group", "reveal", "ui", "outputs", "number", "line"] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

export const SHOT_CATALOG: Record<ShotKind, string> = {
  problem: "a pain or a question (items[0] = { asset: 'text:<word>' } flips the accent word to that word when the voice says it, e.g. weeks → minutes): subject (object:, icon: or visual:) big in the centre with its label; then line (2–6 words) appears under it on line_cue; mark 'strike' crosses out the accent word (e.g. 'Takes weeks', strike 'weeks')",
  steps: "2–4 things that come one after another (steps, tools, chores): items[] each { cue, asset (icon: or visual:), label }; each appears on its own cue in a row",
  group: "3–6 things named together (apps, channels, platforms, features): items[] { asset, label } appear together on cue with a pop each",
  reveal: "the product's logo arrives big (use once, where the voice names the product the first time; never for the closing line)",
  ui: "the product doing its job: a UI card big in the centre (card = one template id; title, input, button); a cursor clicks the button on action_cue (button text becomes 'pressed'); a success card with result pops beside it on result_cue",
  outputs: "right after a ui shot: 2–3 results come out of that card one after another: items[] { cue, asset (visual: or icon:), label }",
  number: "a number or measure as the hero: subject 'text:<value with a digit>' (e.g. text:4K, text:3 min, text:98%); items[] { cue, asset: 'text:<next value>' } swap it on their cues; line = a short caption under it",
  line: "a promise or closing line as big kinetic type: line (2–6 words), accent = 1 word in brand colour, mark 'pill' puts the accent on a pill; add subject 'object:<name>' to set a 3D object beside the words (the words go left)",
};

// Cards the ui shot may use (readable as a big hero).
export const UI_CARDS = ["action-panel", "ai-prompt", "search", "upload", "checkout", "login", "cta", "invoice", "calendar-event", "task", "chat", "email", "payment", "order", "appointment", "social-post", "campaign"] as const;

// Phase 4: a story object — one semantic thing ("release_notes", "video")
// that keeps its identity from shot to shot. The same id is the same object
// on screen: carried into the next shot (it travels to its new place) instead
// of a new copy appearing. Like StoryWorld's continuity_id
// (lib/visual-story.ts), but for the explainer's tested pictures.
export const OBJECT_ROLES = ["hero", "support", "context"] as const;
// Phase 5: what an object DOES in its shot — a semantic verb, never numbers.
// The compiler turns each into its tested motion (BEHAVIOR_ACTION below).
export const BEHAVIORS = ["enter", "move", "accumulate", "converge", "assemble", "transform", "connect", "dock", "route", "reveal", "highlight", "exit"] as const;
export type BehaviorType = (typeof BEHAVIORS)[number];
// Behaviors that act toward another object of the same shot.
export const TARGETED: readonly string[] = ["move", "accumulate", "converge", "assemble", "transform", "connect", "dock", "route"];
// Behaviors after which the object is gone (absorbed or left).
export const CONSUMING: readonly string[] = ["converge", "assemble", "transform", "dock", "exit"];
// Pieces that may share one picture (three coins accumulating).
const GROUPED: readonly string[] = ["accumulate", "converge", "assemble"];
export const Behavior = z.object({
  type: z.enum(BEHAVIORS),
  target: z.string().nullable(), // the object id it acts toward (same shot)
  cue: z.string().nullable(), // 1–6 narration words when it happens (enter: null, it comes with the shot)
});
// Stored behaviors are read loosely: an unknown verb is caught by
// continuityCheck and ignored, never a failed parse.
const StoredBehavior = z.object({ type: z.string(), target: z.string().nullable().default(null), cue: z.string().nullable().default(null) });
export type ObjectBehavior = z.infer<typeof StoredBehavior>;
export const ShotObject = z.object({
  id: z.string(), // short semantic id, the same in every shot that shows it
  role: z.enum(OBJECT_ROLES),
  asset: z.string(), // which of this shot's pictures it is (its subject or an item asset; "card" for the ui card, "logo" for the reveal)
  enters: z.boolean(), // true: first seen here · false: it continues from an earlier shot
  persistent: z.boolean(), // stays into the next shot
  exits: z.boolean(), // leaves at the end of this shot
  transforms_from: z.string().nullable(), // an earlier object this one becomes
  transforms_to: z.string().nullable(),
  behavior: Behavior.nullable(),
});
// Objects stored before Phase 5 have no behavior (null).
const StoredShotObject = ShotObject.extend({ behavior: StoredBehavior.nullable().default(null) });
export type ShotObject = Omit<z.infer<typeof ShotObject>, "behavior"> & { behavior?: ObjectBehavior | null };
const Item = z.object({ cue: z.string().nullable(), asset: z.string(), label: z.string().nullable() });
const Shot = z.object({
  shot: z.enum(SHOT_KINDS),
  cue: z.string(), // 1–6 consecutive narration words: the shot starts here
  subject: z.string().nullable(), // problem: icon:/visual: · number: text:<value>
  label: z.string().nullable(), // caption under the subject (≤3 words)
  line: z.string().nullable(), // on-screen words (problem caption, number caption, line)
  line_cue: z.string().nullable(), // problem: when the line appears
  accent: z.string().nullable(),
  mark: z.enum(["strike", "pill"]).nullable(),
  card: z.string().nullable(), // ui: a card template from UI_CARDS
  title: z.string().nullable(), // ui: card title
  input: z.string().nullable(), // ui: text in its input
  button: z.string().nullable(), // ui: button text
  action_cue: z.string().nullable(), // ui: the click
  result: z.string().nullable(), // ui: success card title (2–4 words)
  result_cue: z.string().nullable(),
  items: z.array(Item).nullable(),
  // Phase 3: how the shot is seen — a semantic intent, never coordinates.
  // The compiler turns it into the camera move (compile-scene.ts).
  camera: z.enum(SHOT_INTENTS).nullable(),
  // Phase 4: which story objects this shot shows (identity, never positions).
  objects: z.array(ShotObject).nullable(),
  // How the scene visually exists (lib/scene-recipe.ts); null: the shot
  // template's own composition.
  recipe: SceneRecipe.nullable(),
});
export type Shot = z.infer<typeof Shot>;
// Stored shots from before Phase 3 have no camera intent, from before Phase 4
// no objects (null).
// Shots stored before the Scene Recipe have none; an unreadable recipe is
// dropped (the template composition is used), never a failed parse.
const StoredShot = Shot.extend({ camera: z.enum(SHOT_INTENTS).nullable().default(null), objects: z.array(StoredShotObject).nullable().default(null), recipe: StoredSceneRecipe.nullable().default(null).catch(null) });
// Phase 2: before choosing shots the Director writes what the video means
// (creative) and, per sentence, what the viewer should SEE (concepts). The
// shots then show those concepts. Stored with the shots for later phases;
// scripts saved before this have neither (null).
export const Creative = z.object({
  message: z.string(), // the one thing the viewer should remember
  audience: z.string(),
  tone: z.string(), // e.g. calm and confident
  pace: z.enum(["calm", "balanced", "brisk"]),
});
export const Concept = z.object({
  cue: z.string(), // 1–6 narration words where this idea is spoken
  see: z.string(), // what the viewer sees, concretely (objects and what happens to them)
  hero: z.string(), // the one object in focus (an asset from ASSETS)
  persists: z.string().nullable(), // an object carried from the previous idea, if any
  avoid: z.string().nullable(), // what must not be shown here
});
export type Creative = z.infer<typeof Creative>;
export type Concept = z.infer<typeof Concept>;
// Phase 6.5: four independent creative directions for the same locked script
// (one Director call). Each direction is its own visual interpretation —
// concept, hero, metaphor, story, shots — never only another look; its
// concepts and shots are the Phase 2–5 schemas.
export const CREATIVE_IDS = ["A", "B", "C", "D"] as const;
export const Direction = z.object({
  concept: z.string(), // the visual idea, e.g. "scattered numbers become one clear view"
  hero: z.string(), // the one visual the video is built around
  metaphor: z.string(), // what it stands for, e.g. "a pile sorted into a shelf"
  story: z.string(), // the story approach, e.g. "problem → product → proof"
  shot_approach: z.string(), // which shots carry it, e.g. "a UI demo, then numbers"
  assets: z.string(), // the asset strategy, e.g. "3D objects for feelings, icons for things"
  opening: z.string(),
  ending: z.string(),
  motion: z.string(), // the motion language, e.g. "pieces gather and merge"
  camera: z.string(), // the camera language, e.g. "slow pushes, holds on numbers"
});
export type Direction = z.infer<typeof Direction>;
// What the Director writes per shot, compact: the words of a problem/number/
// line shot in `text`, the ui shot's card in `ui` (one null instead of a
// dozen). directionScripts() turns it back into the stored Shot.
const ModelText = z.object({ line: z.string(), line_cue: z.string().nullable(), accent: z.string().nullable(), mark: z.enum(["strike", "pill"]).nullable() });
const ModelUi = z.object({ card: z.string(), title: z.string().nullable(), input: z.string().nullable(), button: z.string().nullable(), action_cue: z.string().nullable(), result: z.string().nullable(), result_cue: z.string().nullable() });
export const ModelShot = z.object({
  shot: z.enum(SHOT_KINDS),
  cue: z.string(),
  subject: z.string().nullable(),
  label: z.string().nullable(),
  text: ModelText.nullable(),
  ui: ModelUi.nullable(),
  items: z.array(Item).nullable(),
  camera: z.enum(SHOT_INTENTS).nullable(),
  objects: z.array(ShotObject).nullable(),
  recipe: ModelSceneRecipe.nullable(),
});
export type ModelShot = z.infer<typeof ModelShot>;
// A direction and its shots; its concepts (Phase 2) are read off the shots.
// The direction's visual DNA: controlled values only (no free text), so the
// four can be compared and each one's shots and look are made to follow it.
export const DNA_VALUES = {
  composition: ["hero", "workspace", "kinetic-type", "object-story"],
  cards: ["none", "accent", "primary"],
  icons: ["outline", "solid", "minimal"],
  typography: ["editorial", "ui-labels", "dominant", "secondary"],
  transitions: ["push", "panel", "type", "object"],
  motion: ["physical", "assemble", "scale-reveal", "transform"],
  camera: ["push", "lateral", "static", "orbit"],
  background: ["open", "grid", "bold-field", "environment"],
} as const;
export const Dna = z.object({
  composition: z.enum(DNA_VALUES.composition),
  cards: z.enum(DNA_VALUES.cards),
  icons: z.enum(DNA_VALUES.icons),
  typography: z.enum(DNA_VALUES.typography),
  transitions: z.enum(DNA_VALUES.transitions),
  motion: z.enum(DNA_VALUES.motion),
  camera: z.enum(DNA_VALUES.camera),
  background: z.enum(DNA_VALUES.background),
});
export type Dna = z.infer<typeof Dna>;
export const CreativeVariant = z.object({ id: z.enum(CREATIVE_IDS), dna: Dna, direction: Direction, shots: z.array(ModelShot) });
export const ShotScriptModel = z.object({ theme: z.enum(FLOW_THEMES), creative: Creative, variants: z.array(CreativeVariant) });
// A stored shot script is ONE direction (older ones have none: null).
export const ShotScript = z.object({
  version: z.literal(3).default(3),
  theme: z.enum(FLOW_THEMES),
  creative: Creative.nullable().default(null),
  concepts: z.array(Concept).nullable().default(null),
  shots: z.array(StoredShot),
  variant: z.string().nullable().default(null),
  direction: Direction.nullable().default(null),
  dna: Dna.nullable().default(null),
});
export type ShotScript = z.infer<typeof ShotScript>;
// A compact shot as the stored Shot (every Phase 2–5 field kept).
export const flatShot = (m: ModelShot) => ({
  shot: m.shot,
  cue: m.cue,
  subject: m.subject,
  label: m.label,
  line: m.text?.line ?? null,
  line_cue: m.text?.line_cue ?? null,
  accent: m.text?.accent ?? null,
  mark: m.text?.mark ?? null,
  card: m.ui?.card ?? null,
  title: m.ui?.title ?? null,
  input: m.ui?.input ?? null,
  button: m.ui?.button ?? null,
  action_cue: m.ui?.action_cue ?? null,
  result: m.ui?.result ?? null,
  result_cue: m.ui?.result_cue ?? null,
  items: m.items,
  camera: m.camera,
  objects: m.objects,
  recipe: m.recipe ?? null,
});
// Phase 2 concepts read off the shots: where each idea is spoken, what is
// seen, its hero and the object it carries over.
type ConceptSource = Pick<ReturnType<typeof flatShot>, "shot" | "cue" | "subject" | "label" | "line" | "title" | "card" | "items"> & { objects: { id: string; enters: boolean }[] | null };
export const conceptsOf = (shots: ConceptSource[]): Concept[] =>
  shots.map((s) => ({
    cue: s.cue,
    see: [s.line, s.title, s.label, ...(s.items ?? []).map((i) => i.label)].filter(Boolean).join(" · ") || s.shot,
    hero: s.subject ?? (s.card ? `card:${s.card}` : s.items?.[0]?.asset ?? (s.shot === "reveal" ? "logo" : s.shot)),
    persists: s.objects?.find((o) => !o.enters)?.id ?? null,
    avoid: null,
  }));
// The Director's answer as one shot script per direction (A–D, in order).
export const directionScripts = (model: z.infer<typeof ShotScriptModel>): ShotScript[] =>
  model.variants.map((v) => {
    const shots = v.shots.map(flatShot);
    return ShotScript.parse({ version: 3, theme: model.theme, creative: model.creative, concepts: conceptsOf(shots), shots, variant: v.id, direction: v.direction, dna: v.dna });
  });

// ── expansion ──
// The recipe behaviors the compiler choreographs, with their own action
// length in frames (the fixed timing they keep without choreography).
const CHOREO_ACTION: Partial<Record<SceneRecipe["behaviors"][number]["type"], number>> = { move: 26, merge: 20, assemble: 40, transform: 32, highlight: 8 };
// Marks a note that only says how an intent was drawn (a recipe transition
// mapped to its closest renderer form): reported, never a reason to revise.
export const MAPPED_NOTE = "mapped:";
export const isFixableNote = (note: string) => !note.includes(`: ${MAPPED_NOTE} `);
const EMPTY_CONTENT: SceneContent = { title: null, subtitle: null, value: null, label: null, status: null, name: null, amount: null, delta: null, note: null, action: null, date: null, items: null };
const content = (c: Partial<SceneContent>): SceneContent => ({ ...EMPTY_CONTENT, ...c });
const beat = (b: Partial<SceneBeat> & Pick<SceneBeat, "cue" | "action">): SceneBeat => ({
  elements: null, targets: null, to: null, layout: null, camera: null, transition: null, backdrop: null, style: null, content: null, text: null, accent: null, text_layout: null, items: null, lottie: null, ...b,
});
const el = (id: string, asset: string, label: string | null = null, c: SceneContent | null = null): SceneElement => ({ id, asset, label, screen: null, content: c });
// A second moment inside a shot lands on the cue's last word (a beat on the
// very same cue would be dropped as a duplicate).
const lastWord = (cue: string) => {
  const w = cue.trim().split(/\s+/);
  return w.length > 1 ? w[w.length - 1] : null;
};
const words = (s: string | null | undefined, max: number) => (s ?? "").trim().split(/\s+/).filter(Boolean).slice(0, max).join(" ") || null;

// A picture for an item: icons and visuals as asked; anything else (a brand
// we have no logo for, a made-up icon) becomes a labelled pill, never a
// random stand-in icon.
function picture(asset: string | null | undefined, label: string | null): { asset: string; label: string | null } {
  const ref = parseAsset(asset);
  if (ref?.kind === "visual" || ref?.kind === "shape" || ref?.kind === "object") return { asset: asset!, label };
  if (ref?.kind === "icon" || (asset?.startsWith("icon:") && isIconName(asset.slice(5)))) return { asset: asset!, label };
  const name = label ?? asset?.split(":").pop() ?? "";
  return { asset: "shape:pill", label: words(name, 2) };
}
// A big text object only for a real number or measure ("4K", "3 min", "98%").
const numberText = (asset: string | null | undefined) => {
  const t = asset?.startsWith("text:") ? asset.slice(5).trim() : "";
  return /\d/.test(t) && t.length <= 10 ? t : null;
};

export type ExpandNotes = string[];

// A caption must say what the voice says: every word of 4+ letters is
// spoken (no invented "Download quality").
const spoken = (line: string | null, narration?: string) => {
  if (!line || !narration) return line;
  const said = new Set(narration.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const w = (line.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((x) => x.length >= 4);
  return w.every((x) => said.has(x)) ? line : null;
};
// Cards whose last block is a button (a click needs one to press).
const BUTTON_CARDS = ["action-panel", "login", "checkout", "cta"];

// A variant of the same shots: the look, how shots hand over and how
// subjects enter, drawn from a seed. Without one the default look is kept.
export type ShotVariant = { seed: number };
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type ShotInput = Omit<Shot, "camera" | "objects" | "recipe"> & { camera?: ShotIntent | null; objects?: ShotObject[] | null; recipe?: SceneRecipe | null };

// ── Phase 4: object continuity ──
// Checks the objects' chain before anything is drawn. Errors are wrong
// references (the Director is asked to fix them; the expander ignores those
// objects); warnings are kept as they are and only logged.
export type Continuity = { errors: string[]; warnings: string[] };
export function continuityCheck(shots: { objects?: ShotObject[] | null }[]): Continuity {
  const errors: string[] = [];
  const warnings: string[] = [];
  const last = new Map<string, { at: number; exits: boolean; persistent: boolean }>(); // id → its latest shot
  shots.forEach((s, i) => {
    const objs = s.objects ?? [];
    const ids = objs.map((o) => o.id);
    for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) errors.push(`shot ${i + 1}: object "${id}" is listed twice`);
    // One picture, one identity — except pieces gathering into the same
    // target (three coins accumulating), each bound to its own copy.
    for (const a of new Set(objs.map((o) => o.asset))) {
      const same = objs.filter((o) => o.asset === a);
      if (same.length > 1 && !same.every((o) => GROUPED.includes(o.behavior?.type ?? "") && o.behavior?.target === same[0].behavior?.target)) errors.push(`shot ${i + 1}: "${a}" is given two object ids (${same.map((o) => o.id).join(", ")})`);
    }
    const inShot = new Map(objs.map((o) => [o.id, o] as const));
    for (const o of objs) {
      const seen = last.get(o.id);
      if (o.persistent && o.exits) errors.push(`shot ${i + 1}: object "${o.id}" cannot both stay (persistent) and exit`);
      if (!o.enters && !seen) errors.push(`shot ${i + 1}: unknown object "${o.id}" (not shown before; set enters true)`);
      if (o.enters && seen && !seen.exits) warnings.push(`shot ${i + 1}: object "${o.id}" enters again without having exited: kept as the same object`);
      if (!o.enters && seen?.exits) warnings.push(`shot ${i + 1}: object "${o.id}" comes back after it exited: shown again`);
      else if (!o.enters && seen && seen.at < i - 1) warnings.push(`shot ${i + 1}: object "${o.id}" was not on screen in the shot before: shown again`);
      if (o.transforms_from !== null && (o.transforms_from === o.id || !last.has(o.transforms_from))) errors.push(`shot ${i + 1}: object "${o.id}" transforms from unknown object "${o.transforms_from}"`);
      if (o.transforms_to === o.id) errors.push(`shot ${i + 1}: object "${o.id}" transforms into itself`);
      // Phase 5: its behavior (a wrong one is dropped; the object stays as it is).
      const bh = o.behavior;
      if (!bh) continue;
      const at = `shot ${i + 1}: behavior of "${o.id}"`;
      if (!(BEHAVIORS as readonly string[]).includes(bh.type)) {
        errors.push(`${at}: unknown behavior "${bh.type}"`);
        continue;
      }
      const target = bh.target ? inShot.get(bh.target) : undefined;
      if (TARGETED.includes(bh.type)) {
        if (!bh.target) errors.push(`${at}: ${bh.type} needs a target object`);
        else if (bh.target === o.id) errors.push(`${at}: ${bh.type} cannot target itself`);
        else if (!target) errors.push(`${at}: ${bh.type} targets unknown object "${bh.target}" (not in this shot)`);
        else if (CONSUMING.includes(target.behavior?.type ?? "")) errors.push(`${at}: ${bh.type} targets "${bh.target}", which itself leaves in this shot`);
      }
      if (bh.type === "enter" && !o.enters) errors.push(`${at}: enter on an object that continues from an earlier shot`);
      if (CONSUMING.includes(bh.type) && o.persistent) errors.push(`${at}: ${bh.type} ends it, so it cannot persist`);
      if (bh.type === "transform" && target) {
        if (o.transforms_to && o.transforms_to !== target.id) errors.push(`${at}: transforms into "${target.id}" but transforms_to is "${o.transforms_to}"`);
        if (target.transforms_from && target.transforms_from !== o.id) errors.push(`${at}: transforms into "${target.id}", which comes from "${target.transforms_from}"`);
      }
      if (bh.type === "assemble" && objs.filter((x) => x.behavior?.type === "assemble" && x.behavior.target === bh.target).length < 2) warnings.push(`${at}: assemble with one piece (shown as converge)`);
      if (bh.type !== "enter" && !bh.cue) warnings.push(`${at}: ${bh.type} has no cue: skipped`);
    }
    // Promised to stay, but the next shot does not show it.
    for (const [id, x] of last) if (x.at === i - 1 && x.persistent && !ids.includes(id)) warnings.push(`shot ${i + 1}: object "${id}" should persist from shot ${i} but disappears`);
    // (absorbed, docked or transformed: gone, like an exit)
    objs.forEach((o) => last.set(o.id, { at: i, exits: o.exits || CONSUMING.includes(o.behavior?.type ?? ""), persistent: o.persistent }));
  });
  shots.forEach((s, i) =>
    (s.objects ?? []).forEach((o) => {
      if (o.transforms_to && !shots.slice(i + 1).some((x) => x.objects?.some((y) => y.id === o.transforms_to))) warnings.push(`shot ${i + 1}: object "${o.id}" transforms to "${o.transforms_to}", which never appears`);
    }),
  );
  return { errors, warnings };
}

// The same asset with or without its look ("card:upload/glass" = "card:upload").
const sameAsset = (element: string | null, asked: string) => !!element && (asked === "card" ? element.startsWith("card:") : element.replace(/^(card:[^/]+)\/.*$/, "$1") === asked.replace(/^(card:[^/]+)\/.*$/, "$1"));

// Gives each story object one element id for the whole video: an object the
// shot before showed is carried (asset null — compile-scene moves the same
// element to its new place); a new one keeps its fresh id. Then each object's
// behavior becomes a tested scene action on its cue (BEHAVIOR_ACTION).
// Returns the ids.
export const BEHAVIOR_ACTION: Record<Exclude<BehaviorType, "enter">, SceneBeat["action"]> = {
  move: "move", // travels to the target's side
  accumulate: "move", // the pieces gather beside the collection point, one after another
  converge: "merge", // fly into the target, which grows
  assemble: "merge",
  transform: "merge", // flows into what it becomes (its new state), which reacts
  connect: "connect", // a line with a travelling packet
  dock: "trigger", // lands in the target, which reacts
  route: "flow", // packets run along the path to the target
  reveal: "reveal", // everything comes into view
  highlight: "highlight", // a pulse; the rest dims for a moment
  exit: "erase",
};
// What became of each object's behavior: applied on its cue, delayed to a
// free word of the same shot (two moments on one word), or dropped — always
// with a reason.
export type BehaviorReport = { shot: number; object: string; type: string; status: "applied" | "delayed" | "dropped"; reason: string | null; cue: string | null };
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
function bindObjects(shots: ShotInput[], beats: SceneBeat[], ranges: [number, number][], notes: ExpandNotes, narration?: string, report?: BehaviorReport[]) {
  const { errors } = continuityCheck(shots);
  notes.push(...errors.map((e) => `continuity: ${e}`));
  const bad = new Set(errors.map((e) => /^shot (\d+): (?:unknown )?object "([^"]+)"/.exec(e)).filter((m) => m).map((m) => `${m![1]}:${m![2]}`));
  const badBehavior = new Map(errors.map((e) => [/^shot (\d+): behavior of "([^"]+)"/.exec(e), e] as const).filter(([m]) => m).map(([m, e]) => [`${m![1]}:${m![2]}`, e]));
  // The narration's words, and where each shot starts in them (a delayed
  // moment stays inside its own shot).
  const toks = (narration ?? "").split(/\s+/).filter(Boolean);
  const keys = toks.map(norm);
  const find = (cue: string | null | undefined, from: number) => {
    const want = (cue ?? "").split(/\s+/).map(norm).filter(Boolean);
    if (!want.length) return -1;
    for (let k = Math.max(0, from); k + want.length <= keys.length; k++) if (want.every((w, j) => keys[k + j] === w)) return k;
    return -1;
  };
  const shotAt: number[] = [];
  shots.forEach((s, i) => shotAt.push(find(s.cue, i ? Math.max(0, shotAt[i - 1]) : 0)));
  const classify = (e: string) => (/unknown object|transforms from unknown|needs a target|cannot target itself|targets unknown/.test(e) ? "invalid-target" : /persist|enter on an object/.test(e) ? "persistence-conflict" : /which itself leaves/.test(e) ? "target-unavailable" : "invalid");
  const elementOf = new Map<string, { el: string; at: number; exits: boolean }>(); // object id → its element
  const rename = (from: string, to: string, start: number) => {
    for (const b of beats.slice(start)) {
      for (const e of b.elements ?? []) if (e.id === from) e.id = to;
      if (b.targets) b.targets = b.targets.map((t) => (t === from ? to : t));
      if (b.to === from) b.to = to;
    }
  };
  shots.forEach((s, i) => {
    const [from, to] = ranges[i];
    const used = new Set<SceneElement>(); // (pieces sharing a picture take one copy each)
    const here = new Map<string, string>(); // object id → its element in this shot
    for (const o of s.objects ?? []) {
      if (bad.has(`${i + 1}:${o.id}`)) continue;
      let own = beats.slice(from, to).flatMap((b) => (b.elements ?? []).map((e) => ({ b, e }))).find(({ e }) => !used.has(e) && sameAsset(e.asset, o.asset));
      const prev = elementOf.get(o.id);
      const onScreen = prev && prev.at === i - 1 && !prev.exits;
      const sceneBeat = beats.slice(from, to).find((b) => b.action === "scene");
      if (!own) {
        // Its picture is not one this shot's template draws.
        if (onScreen && !sceneBeat) {
          // No new scene (outputs, a caption): it is still on screen.
          elementOf.set(o.id, { el: prev.el, at: i, exits: o.exits || CONSUMING.includes(o.behavior?.type ?? "") });
          here.set(o.id, prev.el);
          continue;
        }
        // A carried or acting object joins a scene with room (at most 3 on screen).
        const pictureOk = onScreen || /^(icon|visual|object):/.test(o.asset);
        if (!sceneBeat || !pictureOk || (!o.behavior && !onScreen) || (sceneBeat.elements?.length ?? 0) > 2 || o.exits) continue;
        const added = onScreen ? { id: prev.el, asset: null, label: null, screen: null, content: null } : el(`${o.id.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "obj"}${i + 1}x`, picture(o.asset, null).asset);
        if (sceneBeat.layout === "stage") sceneBeat.layout = "stage-duo";
        sceneBeat.elements = [...(sceneBeat.elements ?? []), added];
        own = { b: sceneBeat, e: added };
        if (onScreen) {
          used.add(added);
          elementOf.set(o.id, { el: prev.el, at: i, exits: o.exits || CONSUMING.includes(o.behavior?.type ?? "") });
          here.set(o.id, prev.el);
          continue;
        }
      }
      used.add(own.e);
      const gone = o.exits || (!badBehavior.has(`${i + 1}:${o.id}`) && CONSUMING.includes(o.behavior?.type ?? ""));
      // Carried only straight from the shot before, into a new scene.
      if (prev && prev.at === i - 1 && !prev.exits && own.b.action === "scene" && !(own.b.elements ?? []).some((e) => e.id === prev.el)) {
        rename(own.e.id, prev.el, from);
        own.e.asset = null;
        own.e.label = null;
        own.e.content = null;
        elementOf.set(o.id, { el: prev.el, at: i, exits: gone });
      } else elementOf.set(o.id, { el: own.e.id, at: i, exits: gone });
      here.set(o.id, elementOf.get(o.id)!.el);
    }
    // Behaviors → beats at the end of the shot, in the order listed. Pieces
    // with the same verb, target and cue move as one beat; a moment on a
    // word another moment already uses moves to the next free word of the
    // same shot (never silently lost).
    const added: SceneBeat[] = [];
    const cues = new Set(beats.slice(from, to).map((b) => norm(b.cue)));
    const left = new Set(here.values()); // still on screen in this shot
    const end = shotAt.slice(i + 1).find((k) => k >= 0) ?? toks.length;
    const free = (cue: string) => {
      if (!cues.has(norm(cue))) return cue;
      const last = lastWord(cue);
      if (last && !cues.has(norm(last))) return last;
      const at = find(cue, Math.max(0, shotAt[i]));
      if (at < 0) return null;
      for (let k = at + cue.split(/\s+/).length; k < end; k++) if (keys[k] && !cues.has(keys[k])) return toks[k];
      return null;
    };
    const note = (o: ShotObject, status: BehaviorReport["status"], reason: string | null, cue: string | null) => {
      report?.push({ shot: i + 1, object: o.id, type: o.behavior!.type, status, reason, cue });
      if (status === "dropped") notes.push(`behavior: ${o.behavior!.type} of "${o.id}" in shot ${i + 1} dropped (${reason})`);
    };
    for (const o of s.objects ?? []) {
      const bh = o.behavior;
      if (!bh || bh.type === "enter") continue;
      const el = here.get(o.id);
      const error = badBehavior.get(`${i + 1}:${o.id}`);
      if (error) {
        note(o, "dropped", classify(error), bh.cue);
        continue;
      }
      if (!(bh.type in BEHAVIOR_ACTION)) {
        note(o, "dropped", "invalid", bh.cue);
        continue;
      }
      if (!bh.cue) {
        note(o, "dropped", "no-cue", null);
        continue;
      }
      if (!el) {
        // (its picture is not one this shot draws: the template cannot show it)
        note(o, "dropped", bad.has(`${i + 1}:${o.id}`) ? "invalid-target" : "unsupported-composition", bh.cue);
        continue;
      }
      const action = BEHAVIOR_ACTION[bh.type as Exclude<BehaviorType, "enter">];
      const target = bh.target ? here.get(bh.target) : undefined;
      if (!left.has(el) || (TARGETED.includes(bh.type) && (!target || !left.has(target)))) {
        note(o, "dropped", TARGETED.includes(bh.type) && !target ? "unsupported-composition" : "target-unavailable", bh.cue);
        continue;
      }
      const group = added.find((b) => b.cue === bh.cue && b.action === action && b.to === (target ?? null) && (action === "move" || action === "merge"));
      if (group) {
        group.targets = action === "merge" ? [...group.targets!.slice(0, -1), el, target!] : [...group.targets!, el].slice(0, 4);
        note(o, "applied", null, bh.cue);
      } else {
        const cue = free(bh.cue);
        if (!cue) {
          note(o, "dropped", "timing-conflict", bh.cue);
          continue;
        }
        cues.add(norm(cue));
        const targets = action === "merge" ? [el, target!] : action === "reveal" ? null : [el];
        added.push(beat({ cue, action, targets, to: TARGETED.includes(bh.type) ? target! : null, style: action === "erase" ? "fade" : null }));
        note(o, cue === bh.cue ? "applied" : "delayed", cue === bh.cue ? null : `"${bh.cue}" was taken`, cue);
      }
      if (CONSUMING.includes(bh.type)) left.delete(el);
    }
    if (added.length) {
      // In spoken order inside the shot (cues are matched forward in time).
      const all = [...beats.slice(from, to), ...added];
      let key = -1;
      const keyed = all.map((b, k) => {
        const at = find(b.cue, Math.max(0, shotAt[i]));
        key = at >= 0 ? at : key;
        return { b, key, k };
      });
      keyed.sort((x, y) => x.key - y.key || x.k - y.k);
      beats.splice(from, to - from, ...keyed.map((x) => x.b));
      ranges[i][1] += added.length;
      for (let k = i + 1; k < ranges.length; k++) ranges[k] = [ranges[k][0] + added.length, ranges[k][1] + added.length];
    }
  });
  return new Map([...elementOf].map(([k, v]) => [k, v.el]));
}

// ── Visual DNA → the look and the camera (deterministic) ──
// Background, icons and hand-over follow the direction's DNA, not the seed
// (the seed still varies the side and the entrances).
// (backdrop: the renderer's own backdrop for the non-recipe scenes, else the plain canvas.)
const DNA_BACKGROUND: Record<Dna["background"], { decor: (typeof DECORS)[number]; tone: (typeof TONES)[number]; backdrop?: "perspective-grid" }> = {
  open: { decor: "dots", tone: "white" },
  grid: { decor: "dots", tone: "tint", backdrop: "perspective-grid" },
  "bold-field": { decor: "glow", tone: "deep" },
  environment: { decor: "waves", tone: "tint" },
};
const DNA_ICONS: Record<Dna["icons"], (typeof ICON_STYLES)[number]> = { outline: "outline", solid: "solid", minimal: "soft" };
const DNA_CUT: Record<Dna["transitions"], (typeof CUTS)[number]> = { push: "slide", panel: "slide", type: "soft", object: "zoom" };
// A DNA transition with its own renderer handover (instead of the cut's push).
const DNA_HANDOVER: Partial<Record<Dna["transitions"], "panel-wipe">> = { panel: "panel-wipe" };
// The camera intents each camera language allows (any shot may still open
// wide, reveal the product or hold to be read); others become its main one.
const DNA_CAMERA: Record<Dna["camera"], { main: ShotIntent; allow: ShotIntent[] }> = {
  push: { main: "push", allow: ["push", "close"] },
  lateral: { main: "follow", allow: ["follow", "track", "transition"] },
  static: { main: "hold", allow: [] },
  orbit: { main: "pull_back", allow: ["pull_back", "overhead", "transition"] },
};
// The camera move a shot intent becomes; the orbit language turns its moving
// intents into the compiler's orbit (the recipe's orbit-intent camera: a
// lateral arc while the subject turns in 3D). Holds, openings and reveals stay.
export const dnaMove = (dna: Dna | null, intent: ShotIntent): (typeof CAMERA_MOVES)[number] =>
  dna?.camera === "orbit" && !["establish", "reveal", "hold"].includes(intent) ? "orbit" : INTENT_CAMERA[intent];
export const dnaCamera = (dna: Dna, intent: ShotIntent | null | undefined, first: boolean): ShotIntent => {
  const c = DNA_CAMERA[dna.camera];
  if (intent && (["establish", "reveal", "hold"].includes(intent) || c.allow.includes(intent))) return intent;
  return first ? "establish" : c.main;
};
export const dnaLook = (dna: Dna) => ({ ...DNA_BACKGROUND[dna.background], icons: DNA_ICONS[dna.icons], cut: DNA_CUT[dna.transitions], handover: DNA_HANDOVER[dna.transitions] ?? null });

// Whether the shots follow their DNA (composition, cards, typography,
// motion). Each problem is named; the search counts them against the
// direction and the Director is asked to fix them.
type DnaShot = { shot: ShotKind; subject: string | null; line?: string | null; items?: { asset: string }[] | null; objects?: { behavior?: { type: string } | null }[] | null };
export function dnaProblems(shots: DnaShot[], dna: Dna): string[] {
  const out: string[] = [];
  const count = (f: (s: DnaShot) => boolean) => shots.filter(f).length;
  const ui = count((s) => s.shot === "ui");
  const outputs = count((s) => s.shot === "outputs");
  const typeShots = count((s) => s.shot === "line" || s.shot === "number");
  const plainLines = count((s) => s.shot === "line" && !s.subject);
  const pictures = count((s) => [s.subject, ...(s.items ?? []).map((i) => i.asset)].some((a) => /^(object|visual):/.test(a ?? "")));
  const acts = new Set(shots.flatMap((s) => (s.objects ?? []).map((o) => o.behavior?.type).filter((t): t is string => !!t)));
  const has = (...k: string[]) => k.some((x) => acts.has(x));
  const swaps = count((s) => (s.items ?? []).some((i) => i.asset.startsWith("text:")));
  const kinds = (k: ShotKind) => shots.some((s) => s.shot === k);
  const need = (ok: boolean, what: string) => ok || out.push(what);
  switch (dna.composition) {
    case "hero": need(ui <= 1, `composition hero: ${ui} ui shots (at most 1; the subject is a picture, not a screen)`); break;
    case "workspace": need(ui >= 1, "composition workspace: no ui shot (the product's screen is the hero)"); break;
    case "kinetic-type": need(typeShots >= Math.ceil(shots.length * 0.4) && ui <= 1, `composition kinetic-type: ${typeShots} of ${shots.length} shots are line or number (at least 40%), ${ui} ui`); break;
    case "object-story": need(pictures >= 2 && acts.size >= 1 && ui <= 1, `composition object-story: ${pictures} shots with object:/visual: pictures (need 2), ${acts.size} object behaviors (need 1), ${ui} ui`); break;
  }
  switch (dna.cards) {
    case "none": need(ui + outputs === 0, `cards none: ${ui + outputs} ui/outputs shots`); break;
    case "accent": need(ui <= 1 && outputs === 0, `cards accent: ${ui} ui and ${outputs} outputs shots (at most one ui, no outputs)`); break;
    case "primary": need(ui >= 1, "cards primary: no ui shot"); break;
  }
  switch (dna.typography) {
    case "editorial": need(plainLines >= 1, "typography editorial: no line shot in big type"); break;
    case "ui-labels": need(ui >= 1, "typography ui-labels: no ui shot to carry the labels"); break;
    case "dominant": need(typeShots >= 3, `typography dominant: ${typeShots} line/number shots (need 3)`); break;
    case "secondary": need(plainLines <= 2, `typography secondary: ${plainLines} big-type lines (at most 2)`); break;
  }
  switch (dna.motion) {
    case "physical": need(has("move", "route", "dock", "accumulate") || kinds("steps") || kinds("outputs"), "motion physical: nothing travels (no move/route/dock/accumulate, steps or outputs)"); break;
    case "assemble": need(has("accumulate", "assemble", "converge", "dock", "connect") || kinds("outputs"), "motion assemble: nothing gathers or connects"); break;
    case "scale-reveal": need(kinds("number") || kinds("reveal"), "motion scale-reveal: no number or reveal shot"); break;
    case "transform": need(has("transform", "converge") || swaps > 0, "motion transform: nothing transforms (no transform/converge behavior or word swap)"); break;
  }
  return out;
}

// assets: collects how each recipe's asset requirements were resolved
// (lib/asset-selection.ts). Never notes: an unresolved requirement keeps the
// Director's own asset and is not a reason to revise.
export function expandShots(script: { theme: ShotScript["theme"]; shots: ShotInput[]; version?: number; dna?: Dna | null }, notes: ExpandNotes = [], narration?: string, variant?: ShotVariant, report?: BehaviorReport[], assets?: (AssetSelection & { shot: number })[]): SceneScript {
  // (the seed is mixed first: neighbouring seeds give unrelated videos)
  const pick = variant ? rng(Math.imul(variant.seed ^ 0x9e3779b9, 0x85ebca6b)) : null;
  const choose = <T,>(fallback: T, options: readonly T[]) => (pick ? options[Math.floor(pick() * options.length)] : fallback);
  const dna = script.dna ?? null;
  const fromDna = dna ? dnaLook(dna) : null;
  if (dna) notes.push(...dnaProblems(script.shots, dna).map((p) => `dna: ${p}`));
  const [decor0, tone0, icons0] = [choose("dots", DECORS), choose("tint", TONES), choose("tile", ICON_STYLES)];
  const decor = fromDna?.decor ?? decor0;
  const tone = fromDna?.tone ?? tone0;
  const icons = fromDna?.icons ?? icons0;
  // How shots hand over: slide (push left), rise (push up), soft (dissolves)
  // or zoom (through the old shot into the new).
  const cut0 = choose("slide", CUTS);
  const cut = fromDna?.cut ?? cut0;
  const push = fromDna?.handover ?? ({ slide: "push-left", rise: "push-up", soft: "push-left", zoom: "zoom-through" } as const)[cut];
  // Which side a subject with words beside it stands on (the words take the other).
  const beside = choose("stage-right", ["stage-right", "stage-left"]);
  const look = variant ? { decor, tone, icons, cut, side: beside === "stage-left" ? ("left" as const) : ("right" as const), seed: variant.seed } : null;
  // A number with its picture: the number first (left) or the picture first.
  const duo = choose("stage-duo", ["stage-duo", "stage-duo-flip"]);
  // How each kind of subject arrives (all calm entrances).
  const enter = {
    problem: choose("rise", ["rise", "scale-up", "pop"]),
    ui: choose("rise", ["rise", "scale-up"]),
    number: choose("pop", ["pop", "scale-up"]),
    object: choose("pop", ["pop", "rise"]),
    reveal: choose("scale-up", ["scale-up", "pop"]),
  };
  const beats: SceneBeat[] = [];
  let scenes = 0;
  let revealed = false;
  let lastUi: string | null = null;
  let n = 0;
  const id = (k: string) => `${k}${++n}`;
  // Calm transitions: a push between most shots, a dissolve into type-free
  // pictures; the first shot cuts in.
  // (A shot in the same layout as the last never dissolves: its subject would
  // fade in on top of the old one, "90%" over "4K" — it pushes the old away.
  // After a full-frame line nothing is left to push, so it dissolves.)
  let lastLayout: string | null = null;
  let intent: ShotIntent | null = null; // the current shot's camera intent
  // Scene Recipe state: the last recipe scene (its persistent objects by
  // asset, its hero) and the transition it asked to leave with.
  let pendingOut: RecipeTransition | null = null;
  let prevRecipe: { heroId: string; persisted: Map<string, string> } | null = null;
  const scene = (cue: string, elements: SceneElement[], layout: string, style: string | null = null, transition?: "dissolve") => {
    const prev = beats[beats.length - 1];
    const dissolve = (layout !== lastLayout || prev?.text_layout === "display") && (transition ?? (prev?.action === "statement" || cut === "soft" ? "dissolve" : null));
    // (After a recipe scene its transition_out decides how this one arrives.)
    const chosen = boundaryTransition({ first: scenes === 0, out: pendingOut, into: null, canCarry: false }).transition;
    const out = chosen && scenes > 0 ? sceneTransition(chosen, scenes) : null;
    beats.push(beat({ cue, action: "scene", elements, layout, style, camera: intent ? dnaMove(dna, intent) : "static", transition: scenes === 0 ? "cut" : out ? out.transition : dissolve ? "dissolve" : push, backdrop: fromDna?.backdrop ?? (scenes === 0 ? "mesh" : null) }));
    lastLayout = layout;
    scenes++;
    pendingOut = null;
    prevRecipe = null;
  };
  // swap: a word the accent flips to when the voice says it ("weeks" → "minutes").
  const swapOf = (s: Pick<Shot, "items">) => {
    const w = s.items?.[0]?.asset?.startsWith("text:") ? words(s.items[0].asset.slice(5), 2) : null;
    return w ? [w] : null;
  };
  const caption = (cue: string, text: string, accent: string | null, mark: "strike" | "pill" | null, swap: string[] | null = null) =>
    beats.push(beat({ cue, action: "statement", text, accent: accent && text.toLowerCase().includes(accent.toLowerCase()) ? accent : null, style: mark, text_layout: "side", items: swap }));

  // ── Scene Recipe → beats ──
  // Where a cue is spoken (token index from `from` on), or -1.
  const said = narration ? tokenize(narration) : null;
  const cuePos = (cue: string | null | undefined, from = 0) => {
    if (!said || !cue) return -1;
    const want = tokenize(cue);
    for (let i = from; want.length && i + want.length <= said.length; i++) if (want.every((w, k) => said[i + k] === w)) return i;
    return -1;
  };
  // An asset reference a recipe names, as an element (null: not drawable).
  // "card" (or a device / ui-plane hero of a ui shot) is the shot's own card.
  const uiCard = (s: ShotInput) => {
    const asked = (UI_CARDS as readonly string[]).includes(s.card ?? "") ? s.card! : "action-panel";
    const tpl = s.action_cue && !BUTTON_CARDS.includes(asked) ? "action-panel" : asked;
    return { tpl, content: content({ title: words(s.title, 4), note: words(s.input, 8), label: null, action: words(s.button, 3) ?? "Continue" }) };
  };
  const recipeElement = (s: ShotInput, eid: string, asset: string, type: string | null, hero: boolean): SceneElement | null => {
    const ui = s.shot === "ui" ? uiCard(s) : null;
    const dev = asset.startsWith("device:") ? asset.slice(7).split("/") : null;
    if (dev || type === "device") {
      const model = dev && (DEVICE_MODELS as readonly string[]).includes(dev[0]) ? dev[0] : "laptop";
      const finish = dev?.[1] === "dark" ? "dark" : "light";
      return { id: eid, asset: `device:${model}/${finish}`, label: null, screen: ui ? `card:${ui.tpl}/solid` : "card:dashboard-mini/solid", content: ui?.content ?? null };
    }
    if (ui && (asset === "card" || type === "ui-plane" || type === "product")) return el(eid, `card:${ui.tpl}/glass`, null, ui.content);
    const ref = parseAsset(asset);
    if (!ref) return null;
    if (ref.kind === "icon" && hero) return null; // a plain icon never carries a scene
    if (ref.kind === "text") return /\d/.test(ref.text) || ref.text.split(/\s+/).length <= 3 ? el(eid, asset) : null;
    if (ref.kind === "card" || ref.kind === "logo" || ref.kind === "object" || ref.kind === "visual" || ref.kind === "shape") return el(eid, asset);
    if (ref.kind === "icon") return el(eid, picture(asset, null).asset);
    return null;
  };
  // Builds the shot as its recipe describes; false: the recipe cannot be
  // drawn (its hero is not an asset) and the template is used instead.
  const recipeShot = (s: ShotInput, r: SceneRecipe, si: number): boolean => {
    const startAt = beats.length;
    const persisted = prevRecipe?.persisted ?? new Map<string, string>();
    // The hero: carried from the last scene when it is the same persistent thing.
    const carriedHero = persisted.get(r.hero.asset);
    const heroId = carriedHero ?? id("hero");
    const heroEl = carriedHero ? ({ id: heroId, asset: null, label: null, screen: null, content: null } as SceneElement) : recipeElement(s, heroId, r.hero.asset, r.hero.type, true);
    if (!heroEl) {
      notes.push(`recipe ${r.scene_id}: hero "${r.hero.asset}" is not a drawable hero (an icon or an unknown asset): the shot template is used`);
      return false;
    }
    const roles: CompiledRecipe["roles"] = { [heroId]: { role: "hero", layer: r.composition === "foreground-hero" ? LAYER.foreground : LAYER.hero, relation: null } };
    // Supporting objects (at most 4); one that a reveal behavior brings in
    // waits for its words instead of arriving with the scene.
    const revealed = new Set(r.behaviors.filter((b) => b.type === "reveal").map((b) => b.from));
    const support = new Map<string, SceneElement>(); // recipe id → element
    const later: SceneElement[] = [];
    for (const sp of r.supporting.slice(0, 4)) {
      const carried = persisted.get(sp.asset);
      const eid = carried ?? id("sup");
      const e = carried ? ({ id: eid, asset: null, label: null, screen: null, content: null } as SceneElement) : recipeElement(s, eid, sp.asset, null, false);
      if (!e) {
        notes.push(`recipe ${r.scene_id}: supporting "${sp.id}" (${sp.asset}) is not drawable: left out`);
        continue;
      }
      support.set(sp.id, e);
      roles[eid] = { role: "support", layer: LAYER[sp.layer], relation: sp.relation };
      if (revealed.has(sp.id) && !carried) later.push(e);
    }
    if (r.supporting.length > 4) notes.push(`recipe ${r.scene_id}: ${r.supporting.length - 4} supporting objects over the 4 allowed: left out`);
    // object-transform from a different hero: the last scene's hero comes
    // along and flows into the new one (merge) on the shot's last word.
    // The boundary into this scene (lib/scene-recipe.ts boundaryTransition):
    // first cut → a carry it asks for → the last scene's transition_out → its transition_in.
    const boundary = boundaryTransition({ first: scenes === 0, out: pendingOut, into: r.transition_in, canCarry: !!prevRecipe });
    const tIn: RecipeTransition = boundary.transition ?? r.transition_in;
    const morphFrom = tIn === "object-transform" && prevRecipe && !carriedHero && lastWord(s.cue) ? prevRecipe.heroId : null;
    if (morphFrom) roles[morphFrom] = { role: "support", layer: LAYER.midground, relation: "feeds-hero" };
    const tr = sceneTransition(tIn, scenes);
    if (RECIPE_MAPPED[tIn]) notes.push(`recipe ${r.scene_id}: ${MAPPED_NOTE} transition ${tIn} → ${RECIPE_MAPPED[tIn]}`);
    if (tIn === "object-transform" && boundary.source !== "out" && !carriedHero && !morphFrom) notes.push(`recipe ${r.scene_id}: object-transform with nothing to carry (no persistent hero before it): dissolve`);
    const compiled: CompiledRecipe = { id: r.scene_id, composition: r.composition, environment: r.environment, hero: heroId, heroType: r.hero.type, roles, text: { position: r.typography.position, scale: r.typography.scale }, camera: r.camera, flash: tr.flash, words: false };
    // How the world arrives (only when the recipe asks: else nothing changes).
    const bg = normalizeBackground(r.background);
    if (bg) compiled.background = bg;
    const elements = [heroEl, ...[...support.values()].filter((e) => !later.includes(e)), ...(morphFrom ? [{ id: morphFrom, asset: null, label: null, screen: null, content: null } as SceneElement] : [])];
    beats.push(beat({ cue: s.cue, action: "scene", elements, layout: "recipe", style: null, camera: "static", transition: tr.transition, backdrop: ENV_BACKDROP[r.environment] as SceneBeat["backdrop"], recipe: compiled }));
    scenes++;
    lastLayout = "recipe";
    if (morphFrom) beats.push(beat({ cue: lastWord(s.cue)!, action: "merge", targets: [morphFrom], to: heroId }));
    // The words, placed by the recipe (compile-scene.ts recipeText).
    const line0 = words(s.line, 6);
    const line = s.shot === "problem" || s.shot === "number" ? spoken(line0, narration) : line0;
    const mark = r.typography.emphasis === "pill" ? "pill" : r.typography.emphasis === "strike" ? "strike" : null;
    // (Words over a hero still travelling in from the last scene wait for its last word.)
    compiled.words = !!line;
    if (line) caption(s.line_cue ?? (carriedHero || morphFrom ? (lastWord(s.cue) ?? s.cue) : s.cue), line, r.typography.emphasis === "none" ? null : s.accent, mark, swapOf(s));
    // The shot's own moments on the hero.
    if (s.shot === "ui" && heroEl.asset) {
      const ui = uiCard(s);
      const isCard = heroEl.asset.startsWith("card:");
      if (s.action_cue) beats.push(beat({ cue: s.action_cue, action: "click", targets: [heroId], content: isCard ? content({ ...ui.content, action: pressed(ui.content.action ?? "Continue") }) : null }));
      const result = words(s.result, 4);
      if (result && s.result_cue && isCard) beats.push(beat({ cue: s.result_cue, action: "update", targets: [heroId], content: content({ ...ui.content, title: result, action: "✓ Done" }) }));
    }
    if (s.shot === "number" && heroEl.asset?.startsWith("text:"))
      for (const i of (s.items ?? []).slice(0, 3)) {
        const next = numberText(i.asset);
        if (next && i.cue) beats.push(beat({ cue: i.cue, action: "update", targets: [heroId], content: content({ value: next }) }));
      }
    // Behaviors: each one runs on its words, or is reported with why not.
    const idOf = (name: string) => (name === "hero" ? heroId : (support.get(name)?.id ?? null));
    const at0 = cuePos(s.cue);
    const tell = (b: SceneRecipe["behaviors"][number], status: BehaviorReport["status"], reason: string | null) => report?.push({ shot: si, object: b.from, type: `recipe:${b.type}`, status, reason, cue: b.cue });
    const consumed = new Set<string>(); // recipe ids merged away (never carried on)
    for (const b of r.behaviors) {
      const from = idOf(b.from);
      const to = b.to ? idOf(b.to) : null;
      if (!from) {
        tell(b, "dropped", "invalid-object");
        continue;
      }
      if (said && (cuePos(b.cue, Math.max(0, at0)) < 0 || cuePos(b.cue, Math.max(0, at0)) <= at0)) {
        tell(b, "dropped", "cue-not-spoken-after-scene");
        continue;
      }
      const needsTo = ["move", "connect", "flow", "assemble", "merge", "transform"].includes(b.type);
      if (needsTo && (!to || to === from)) {
        tell(b, "dropped", "invalid-target");
        continue;
      }
      // The event's choreography (lib/choreography.ts), normalized to frames
      // on the event's own action length; only the events the compiler
      // choreographs carry it (the rest keep their fixed timing, reported).
      const choreo = b.choreography && CHOREO_ACTION[b.type] ? normalizeChoreography(b.choreography, CHOREO_ACTION[b.type]!) : null;
      const ch = choreo ? { choreo } : {};
      if (b.choreography && !CHOREO_ACTION[b.type]) notes.push(`recipe ${r.scene_id}: ${MAPPED_NOTE} ${b.type} keeps its own timing (choreography is not applied to it yet)`);
      switch (b.type) {
        case "reveal": {
          const e = later.find((x) => x.id === from);
          if (!e) {
            tell(b, "dropped", from === heroId ? "the hero arrives with the scene" : "already on screen");
            break;
          }
          beats.push(beat({ cue: b.cue, action: "place", layout: "recipe", style: "rise", elements: [e] }));
          tell(b, "applied", null);
          break;
        }
        case "move":
          beats.push(beat({ cue: b.cue, action: "move", targets: [from], to, style: "recipe", ...ch }));
          tell(b, "applied", null);
          break;
        case "connect":
        case "flow":
          beats.push(beat({ cue: b.cue, action: b.type, targets: [from], to }));
          tell(b, "applied", null);
          break;
        case "merge":
          beats.push(beat({ cue: b.cue, action: "merge", targets: [from], to, ...ch }));
          consumed.add(b.from);
          tell(b, "applied", null);
          break;
        case "assemble": {
          // The pieces: the named one and the scene's other objects that
          // stand in the same relation to the hero (at most 4).
          const rel = r.supporting.find((sp) => sp.id === b.from)?.relation ?? null;
          const others = rel ? r.supporting.filter((sp) => sp.id !== b.from && sp.id !== b.to && sp.relation === rel && support.has(sp.id) && !consumed.has(sp.id) && !later.includes(support.get(sp.id)!)).map((sp) => sp.id) : [];
          const ids = [b.from, ...others].slice(0, 4);
          beats.push(beat({ cue: b.cue, action: "merge", targets: ids.map((x) => idOf(x)!), to, style: "assemble", ...ch }));
          for (const x of ids) consumed.add(x);
          tell(b, "applied", `assembled: ${ids.length} piece${ids.length > 1 ? "s" : ""} (${ids.join(", ")}) dock around ${b.to}, hold as one shape, then fuse into it (it grows)`);
          break;
        }
        case "transform":
          beats.push(beat({ cue: b.cue, action: "merge", targets: [from], to, style: "transform", ...ch }));
          consumed.add(b.from);
          tell(b, "applied", `transformed: ${b.from} flies to ${b.to}, takes its size and turns edge-on; ${b.to} turns in from the edge in its place (3D turn, no shape morph)`);
          break;
        case "highlight":
        case "expand":
          beats.push(beat({ cue: b.cue, action: b.type, targets: [from], ...(b.type === "highlight" ? ch : {}) }));
          tell(b, "applied", null);
          break;
        case "focus":
          beats.push(beat({ cue: b.cue, action: "focus", targets: [from], style: "recipe" }));
          tell(b, "applied", null);
          break;
        case "arrange": {
          const n = r.supporting.filter((sp) => support.has(sp.id) && !consumed.has(sp.id)).length;
          if (n < 2) {
            tell(b, "dropped", `nothing to arrange: ${n} supporting object on screen (needs 2+)`);
            break;
          }
          beats.push(beat({ cue: b.cue, action: "arrange", layout: "recipe", style: "recipe" }));
          tell(b, "applied", `arranged: the ${n} supporting objects line up evenly (a row, or a column beside a side hero); the hero and the composition stay`);
          break;
        }
      }
    }
    // A supporting object that orbits the hero circles it from the shot's last word.
    const orbiters = r.supporting.filter((sp) => sp.relation === "orbits-hero" && support.has(sp.id) && !later.includes(support.get(sp.id)!));
    if (orbiters.length && lastWord(s.cue)) beats.push(beat({ cue: lastWord(s.cue)!, action: "orbit", targets: orbiters.map((sp) => support.get(sp.id)!.id), to: heroId }));
    else if (orbiters.length) notes.push(`recipe ${r.scene_id}: orbits-hero needs a cue of 2+ words to start on: placed beside the hero`);
    // This shot's beats in spoken order (the scene first; its paired words next).
    if (said) {
      const mine = beats.splice(startAt);
      const key = mine.map((b, k) => ({ b, k, at: k === 0 ? -1 : Math.max(at0, cuePos(b.cue, Math.max(0, at0))) }));
      key.sort((x, y) => x.at - y.at || x.k - y.k);
      beats.push(...key.map((x) => x.b));
    }
    // What the next scene may carry (persistent objects, by asset).
    const keep = new Map<string, string>();
    if (r.hero.persistence === "persistent" && !consumed.has("hero")) keep.set(r.hero.asset, heroId);
    for (const sp of r.supporting) if (sp.persistence === "persistent" && support.has(sp.id) && !consumed.has(sp.id)) keep.set(sp.asset, support.get(sp.id)!.id);
    prevRecipe = { heroId, persisted: keep };
    pendingOut = r.transition_out;
    return true;
  };

  const ranges: [number, number][] = []; // each shot's beats
  const byRecipe = new Set<number>(); // shots built from their recipe (its behaviors replace the objects')
  for (const s of script.shots) {
    ranges.push([beats.length, beats.length]);
    // The recipe with its asset requirements resolved to approved assets.
    const chosen = s.recipe ? applyAssetSelection(s.recipe) : null;
    if (chosen) assets?.push(...chosen.selections.map((x) => ({ ...x, shot: ranges.length - 1 })));
    if (chosen && recipeShot(s, chosen.recipe, ranges.length - 1)) {
      byRecipe.add(ranges.length - 1);
      intent = null;
      lastUi = s.shot === "ui" ? (beats.find((b, k) => k >= ranges[ranges.length - 1][0] && b.action === "scene")?.recipe?.hero ?? null) : null;
      ranges[ranges.length - 1][1] = beats.length;
      continue;
    }
    intent = dna ? dnaCamera(dna, s.camera, !beats.length) : (s.camera ?? null);
    const items = (s.items ?? []).filter((i) => i.asset);
    switch (s.shot) {
      case "problem": {
        const p = picture(s.subject ?? "visual:clock", words(s.label, 3));
        const line0 = spoken(words(s.line, 6), narration);
        // With words, the subject goes right and the words sit big on the left.
        scene(s.cue, [el(id("subject"), p.asset, p.label)], line0 ? beside : "stage", enter.problem);
        const line = spoken(words(s.line, 6), narration);
        const at = s.line_cue ?? lastWord(s.cue);
        if (line && at) caption(at, line, s.accent, s.mark === "strike" ? "strike" : null, swapOf(s));
        lastUi = null;
        break;
      }
      case "steps":
      case "outputs": {
        if (s.shot === "outputs" && lastUi && items.length) {
          // The first result(s) lift out on the cue; any with a later cue of
          // their own join the row then.
          // Two results beside the card at most (a third would shrink them all);
          // a later one's words make the card pulse instead, so something
          // still happens on them.
          const outs = items.slice(0, 2).map((i, k) => ({ ...picture(i.asset, words(i.label, 2)), cue: k > 0 ? i.cue : null }));
          beats.push(beat({ cue: s.cue, action: "lift", targets: [lastUi], layout: "stage-duo", style: "rise", elements: outs.filter((o) => !o.cue).map((o) => el(id("out"), o.asset, o.label)) }));
          for (const o of outs.filter((x) => x.cue)) beats.push(beat({ cue: o.cue!, action: "place", layout: "stage-duo", style: "rise", elements: [el(id("out"), o.asset, o.label)] }));
          const extra = items[2]?.cue;
          if (extra) beats.push(beat({ cue: extra, action: "highlight", targets: [lastUi] }));
          lastUi = null;
          break;
        }
        const list = items.slice(0, 4);
        if (!list.length) break;
        // Every step is on screen from the start (faint), so one icon never
        // stands alone in the frame; each lights up on its words with an
        // arrow from the one before (Keka).
        const els = list.map((i) => {
          const p = picture(i.asset, words(i.label, 2));
          return el(id("step"), p.asset, p.label);
        });
        scene(list[0].cue ?? s.cue, els, "stage-row", "steps");
        list.slice(1).forEach((i, k) => {
          if (i.cue) beats.push(beat({ cue: i.cue, action: "activate", targets: [els[k + 1].id], to: els[k].id }));
        });
        lastUi = null;
        break;
      }
      case "group": {
        const list = items.slice(0, 6).map((i) => picture(i.asset, words(i.label, 2)));
        if (!list.length) break;
        const els = list.map((p) => el(id("g"), p.asset, p.label));
        // Said one by one ("website, email, LinkedIn"): all wait faint from
        // the start (one icon never stands alone) and each lights up on its
        // own word. Said together: all arrive with the scene, a pop each.
        const said = items.slice(1, 6).filter((i) => i.cue && i.cue !== s.cue);
        if (said.length) {
          scene(s.cue, els, "stage-row", "steps", "dissolve");
          items.slice(1, 6).forEach((i, k) => {
            if (i.cue && i.cue !== s.cue) beats.push(beat({ cue: i.cue, action: "activate", targets: [els[k + 1].id] }));
          });
        } else scene(s.cue, els, "stage-row", "pop", "dissolve");
        lastUi = null;
        break;
      }
      case "reveal": {
        if (revealed) {
          notes.push("reveal used twice: the second became a line");
          if (s.line) caption(s.cue, words(s.line, 6)!, s.accent, null);
          break;
        }
        revealed = true;
        scene(s.cue, [el(id("logo"), "logo")], "stage", enter.reveal);
        lastUi = null;
        break;
      }
      case "ui": {
        // A click needs a button: cards without one become the action panel.
        const asked = (UI_CARDS as readonly string[]).includes(s.card ?? "") ? s.card! : "action-panel";
        const tpl = s.action_cue && !BUTTON_CARDS.includes(asked) ? "action-panel" : asked;
        const ui = id("ui");
        const button = words(s.button, 3) ?? "Continue";
        scene(s.cue, [el(ui, `card:${tpl}/glass`, null, content({ title: words(s.title, 4), note: words(s.input, 8), label: null, action: button }))], "stage", enter.ui);
        if (s.action_cue) beats.push(beat({ cue: s.action_cue, action: "click", targets: [ui], content: content({ title: words(s.title, 4), note: words(s.input, 8), action: pressed(button) }) }));
        const result = words(s.result, 4);
        // The success card only when no outputs follow (card + result + 2
        // outputs would crowd the frame).
        const outputsNext = script.shots[script.shots.indexOf(s) + 1]?.shot === "outputs";
        // With outputs next (no room for a second card) the card itself shows
        // the result on its words.
        if (result && s.result_cue && outputsNext) beats.push(beat({ cue: s.result_cue, action: "update", targets: [ui], content: content({ title: result, note: words(s.input, 8), action: "✓ Done" }) }));
        if (result && s.result_cue && !outputsNext) beats.push(beat({ cue: s.result_cue, action: "place", layout: "stage-duo", style: "pop", elements: [el(id("done"), "card:success-toast/solid", null, content({ title: result, subtitle: null }))] }));
        lastUi = ui;
        break;
      }
      case "number": {
        const first = numberText(s.subject);
        if (!first) {
          // Not a number ("HERO", "minutes"): shown as a line instead.
          notes.push(`number shot without a number (${s.subject ?? "none"}): shown as a line`);
          const line = words(s.line, 6) ?? words(s.subject?.replace(/^text:/, ""), 4);
          if (line) beats.push(beat({ cue: s.cue, action: "statement", text: line, accent: s.accent, text_layout: "display" }));
          break;
        }
        const num = id("num");
        // A number never stands alone: the picture of what it measures sits beside it.
        const about = `${s.cue} ${s.line ?? ""}`.toLowerCase();
        const companion = /download|export|save/.test(about) ? "visual:download" : /minute|hour|second|time|fast|day/.test(about) ? "visual:clock" : /%|grow|more|sales|revenue|x\b/.test(about) ? "visual:bars" : /\d+(p|k)\b|video|hd/.test(about) ? "visual:play" : null;
        scene(s.cue, companion ? [el(num, `text:${first}`), el(id("pic"), companion)] : [el(num, `text:${first}`)], companion ? duo : "stage", enter.number);
        const line = spoken(words(s.line, 5), narration);
        const at = s.line_cue ?? lastWord(s.cue);
        if (line && at) caption(at, line, null, null);
        for (const i of items.slice(0, 3)) {
          const next = numberText(i.asset);
          if (next && i.cue) beats.push(beat({ cue: i.cue, action: "update", targets: [num], content: content({ value: next }) }));
        }
        lastUi = null;
        break;
      }
      case "line": {
        const line = words(s.line, 6);
        // A line with a 3D object: the words big on the left, the object on the right.
        if (line && parseAsset(s.subject)?.kind === "object") {
          scene(s.cue, [el(id("obj"), s.subject!)], beside, enter.object);
          beats.push(beat({ cue: s.cue, action: "statement", text: line, accent: s.accent, style: s.mark === "pill" ? "pill" : null, text_layout: "side", items: swapOf(s) }));
          lastUi = null;
          break;
        }
        // Two lines in a row saying the same words: only the second is shown.
        const next = script.shots[script.shots.indexOf(s) + 1];
        const shared = next?.shot === "line" && line && next.line ? line.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && next.line!.toLowerCase().includes(w)).length : 0;
        if (shared >= 2) {
          notes.push(`line "${line}" repeats the next line: dropped`);
          break;
        }
        if (line) beats.push(beat({ cue: s.cue, action: "statement", text: line, accent: s.accent, style: s.mark === "pill" ? "pill" : null, text_layout: "display", items: swapOf(s) }));
        break;
      }
    }
    ranges[ranges.length - 1][1] = beats.length;
  }
  const bound = script.shots.map((s, i) => (byRecipe.has(i) ? { ...s, objects: null } : s));
  if (bound.some((s) => s.objects?.length)) bindObjects(bound, beats, ranges, notes, narration, report);
  return SceneScript.parse({ version: 2, theme: script.theme, pace: "calm", style: "explainer", beats, look });
}

// "Generate" → "Generating…"; other buttons show a tick.
const pressed = (b: string) => (/^[A-Za-z]+e$/.test(b) ? `${b.slice(0, -1)}ing…` : /^[A-Za-z]+$/.test(b) ? `${b}ing…` : `✓ ${b}`);

export const shotCatalogText = () =>
  SHOT_KINDS.map((k) => `- ${k}: ${SHOT_CATALOG[k]}`).join("\n") + `\n\nui cards: ${UI_CARDS.join(", ")}`;
