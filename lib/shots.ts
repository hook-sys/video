import { z } from "zod";
import { isIconName } from "@/components/video/icons";
import { FLOW_THEMES } from "@/lib/flow-script";
import { CAMERA_MOVES, CUTS, DECORS, ICON_STYLES, parseAsset, TONES, SceneScript, type SceneBeat, type SceneContent, type SceneElement } from "@/lib/scene-script";

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
});
export type Shot = z.infer<typeof Shot>;
// Stored shots from before Phase 3 have no camera intent, from before Phase 4
// no objects (null).
const StoredShot = Shot.extend({ camera: z.enum(SHOT_INTENTS).nullable().default(null), objects: z.array(StoredShotObject).nullable().default(null) });
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
export const ShotScriptModel = z.object({ theme: z.enum(FLOW_THEMES), creative: Creative, concepts: z.array(Concept), shots: z.array(Shot) });
export const ShotScript = ShotScriptModel.extend({ version: z.literal(3).default(3), creative: Creative.nullable().default(null), concepts: z.array(Concept).nullable().default(null), shots: z.array(StoredShot) });
export type ShotScript = z.infer<typeof ShotScript>;

// ── expansion ──
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

type ShotInput = Omit<Shot, "camera" | "objects"> & { camera?: ShotIntent | null; objects?: ShotObject[] | null };

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
function bindObjects(shots: ShotInput[], beats: SceneBeat[], ranges: [number, number][], notes: ExpandNotes) {
  const { errors } = continuityCheck(shots);
  notes.push(...errors.map((e) => `continuity: ${e}`));
  const bad = new Set(errors.map((e) => /^shot (\d+): (?:unknown )?object "([^"]+)"/.exec(e)).filter((m) => m).map((m) => `${m![1]}:${m![2]}`));
  const badBehavior = new Set(errors.map((e) => /^shot (\d+): behavior of "([^"]+)"/.exec(e)).filter((m) => m).map((m) => `${m![1]}:${m![2]}`));
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
      const own = beats.slice(from, to).flatMap((b) => (b.elements ?? []).map((e) => ({ b, e }))).find(({ e }) => !used.has(e) && sameAsset(e.asset, o.asset));
      if (!own) continue; // (its picture was not drawn: nothing to bind)
      used.add(own.e);
      const prev = elementOf.get(o.id);
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
    // with the same verb, target and cue move as one beat.
    const added: SceneBeat[] = [];
    const cues = new Set(beats.slice(from, to).map((b) => b.cue));
    const left = new Set(here.values()); // still on screen in this shot
    for (const o of s.objects ?? []) {
      const bh = o.behavior;
      const el = here.get(o.id);
      if (!bh || !el || bh.type === "enter" || badBehavior.has(`${i + 1}:${o.id}`) || !(bh.type in BEHAVIOR_ACTION) || !bh.cue) continue;
      const action = BEHAVIOR_ACTION[bh.type as Exclude<BehaviorType, "enter">];
      const target = bh.target ? here.get(bh.target) : undefined;
      if (!left.has(el) || (TARGETED.includes(bh.type) && (!target || !left.has(target)))) {
        notes.push(`behavior: ${bh.type} of "${o.id}" in shot ${i + 1} has nothing on screen to act on: skipped`);
        continue;
      }
      const group = added.find((b) => b.cue === bh.cue && b.action === action && b.to === (target ?? null) && (action === "move" || action === "merge"));
      if (group) {
        group.targets = action === "merge" ? [...group.targets!.slice(0, -1), el, target!] : [...group.targets!, el].slice(0, 4);
      } else if (cues.has(bh.cue)) {
        notes.push(`behavior: ${bh.type} of "${o.id}" in shot ${i + 1} shares its cue "${bh.cue}" with another moment: skipped`);
        continue;
      } else {
        cues.add(bh.cue);
        const targets = action === "merge" ? [el, target!] : action === "reveal" ? null : [el];
        added.push(beat({ cue: bh.cue, action, targets, to: TARGETED.includes(bh.type) ? target! : null, style: action === "erase" ? "fade" : null }));
      }
      if (CONSUMING.includes(bh.type)) left.delete(el);
    }
    if (added.length) {
      beats.splice(to, 0, ...added);
      ranges[i][1] += added.length;
      for (let k = i + 1; k < ranges.length; k++) ranges[k] = [ranges[k][0] + added.length, ranges[k][1] + added.length];
    }
  });
  return new Map([...elementOf].map(([k, v]) => [k, v.el]));
}

export function expandShots(script: { theme: ShotScript["theme"]; shots: ShotInput[]; version?: number }, notes: ExpandNotes = [], narration?: string, variant?: ShotVariant): SceneScript {
  // (the seed is mixed first: neighbouring seeds give unrelated videos)
  const pick = variant ? rng(Math.imul(variant.seed ^ 0x9e3779b9, 0x85ebca6b)) : null;
  const choose = <T,>(fallback: T, options: readonly T[]) => (pick ? options[Math.floor(pick() * options.length)] : fallback);
  const decor = choose("dots", DECORS);
  const tone = choose("tint", TONES);
  const icons = choose("tile", ICON_STYLES);
  // How shots hand over: slide (push left), rise (push up), soft (dissolves)
  // or zoom (through the old shot into the new).
  const cut = choose("slide", CUTS);
  const push = ({ slide: "push-left", rise: "push-up", soft: "push-left", zoom: "zoom-through" } as const)[cut];
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
  const scene = (cue: string, elements: SceneElement[], layout: string, style: string | null = null, transition?: "dissolve") => {
    const prev = beats[beats.length - 1];
    const dissolve = (layout !== lastLayout || prev?.text_layout === "display") && (transition ?? (prev?.action === "statement" || cut === "soft" ? "dissolve" : null));
    beats.push(beat({ cue, action: "scene", elements, layout, style, camera: intent ? INTENT_CAMERA[intent] : "static", transition: scenes === 0 ? "cut" : dissolve ? "dissolve" : push, backdrop: scenes === 0 ? "mesh" : null }));
    lastLayout = layout;
    scenes++;
  };
  // swap: a word the accent flips to when the voice says it ("weeks" → "minutes").
  const swapOf = (s: Pick<Shot, "items">) => {
    const w = s.items?.[0]?.asset?.startsWith("text:") ? words(s.items[0].asset.slice(5), 2) : null;
    return w ? [w] : null;
  };
  const caption = (cue: string, text: string, accent: string | null, mark: "strike" | "pill" | null, swap: string[] | null = null) =>
    beats.push(beat({ cue, action: "statement", text, accent: accent && text.toLowerCase().includes(accent.toLowerCase()) ? accent : null, style: mark, text_layout: "side", items: swap }));

  const ranges: [number, number][] = []; // each shot's beats
  for (const s of script.shots) {
    ranges.push([beats.length, beats.length]);
    intent = s.camera ?? null;
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
        // All arrive with the scene, 0.2 s apart, a pop each.
        scene(s.cue, list.map((p) => el(id("g"), p.asset, p.label)), "stage-row", "pop", "dissolve");
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
  if (script.shots.some((s) => s.objects?.length)) bindObjects(script.shots, beats, ranges, notes);
  return SceneScript.parse({ version: 2, theme: script.theme, pace: "calm", style: "explainer", beats, look });
}

// "Generate" → "Generating…"; other buttons show a tick.
const pressed = (b: string) => (/^[A-Za-z]+e$/.test(b) ? `${b.slice(0, -1)}ing…` : /^[A-Za-z]+$/.test(b) ? `${b}ing…` : `✓ ${b}`);

export const shotCatalogText = () =>
  SHOT_KINDS.map((k) => `- ${k}: ${SHOT_CATALOG[k]}`).join("\n") + `\n\nui cards: ${UI_CARDS.join(", ")}`;
