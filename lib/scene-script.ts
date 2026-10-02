import { z } from "zod";
import { isIconName, resolveIcon } from "@/components/video/icons";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import { isCardStyle, isCardTemplate, searchCards } from "@/components/video/flow/cards/catalog";
import { CROP_PRESETS, DEVICE_FINISHES, DEVICE_MODELS } from "@/components/video/flow/cards/device-data";
import { isLayout } from "@/components/video/flow/layouts";
import { OBJECTS, type ObjectName } from "@/components/video/flow/object-names";
import { BACKDROPS } from "@/components/video/flow/backdrop-names";
import { searchIcons } from "@/lib/icons";
import { spokenCueTimes, tokenize, tokensForWord, type WordTiming } from "@/lib/voice-timing";
import { FLOW_THEMES, STATEMENT_LAYOUTS, estimateWords } from "@/lib/flow-script";
import { CompiledRecipeSchema } from "@/lib/scene-recipe";

// SceneScript (Director v2): the video as scenes of product elements (cards,
// devices, screenshot crops, icons) on a canvas, each beat a motion verb on
// spoken words. The compiler (components/video/flow/compile-scene.ts) lays the
// elements out, animates the verbs, moves the camera and handles transitions.

export const SCENE_ACTIONS = [
  "scene", // start a scene: new elements in a layout, a camera move, a transition in
  "place", // add elements to the current scene
  "move", // an element (or 2–4 together) travels to another element
  "trigger", // an element travels to another, which reacts (and may update)
  "update", // a card's content changes (a status, a number)
  "connect", // a line (with a travelling packet) between two elements
  "merge", // elements fly into one element
  "arrange", // the scene's elements reorganise into a new layout
  "erase", // elements are wiped away
  "highlight", // an element pulses; the rest dims for a moment
  "focus", // the camera pushes in on an element
  "reveal", // the camera pulls back to show everything
  "celebrate", // a Lottie accent at an element
  "orbit", // elements circle another element (an ecosystem, integrations)
  "expand", // an element grows to fill the frame (a detail view); the rest recede
  "collapse", // an expanded element returns to its place
  "disconnect", // a line between two elements breaks away
  "trace", // a line draws through several elements in order (a journey, a data path)
  "flow", // a stream of packets runs from one element to another (data syncing)
  "statement", // the narration's key phrase as kinetic type
  "list", // 3–5 spoken items as a rolling checklist
  "lift", // new elements (1–2 cards) lift out of targets [one screen / device] and take a place beside it
  "click", // a cursor glides to targets [one id] and clicks it; content = what it shows after
  "activate", // (shot templates) targets [one id], waiting faint in a "steps" scene, lights up; to = the step before (an arrow from it)
] as const;
export type SceneAction = (typeof SCENE_ACTIONS)[number];

// (hold: the camera stays still on purpose — a shot intent; static is the default.)
// (orbit: shot templates only, from the DNA camera; the Scene Director is not offered it.)
export const CAMERA_MOVES = ["push-in", "pull-back", "pan-left", "pan-right", "rise", "drift", "static", "hold", "orbit"] as const;
export const TRANSITIONS = ["cut", "dissolve", "push-left", "push-right", "push-up", "zoom-through", "panel-wipe", "morph"] as const;
export const ENTER_STYLES = ["pop", "rise", "slide-left", "slide-right", "drop", "blur", "flip", "scale-up", "cascade", "bounce", "spin", "tilt"] as const;
export const PATH_STYLES = ["arc", "straight", "swoop"] as const;
export const ERASE_STYLES = ["wipe", "fade", "shrink", "fly-out", "burst", "sink"] as const;

const Content = z.object({
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  value: z.string().nullable(),
  label: z.string().nullable(),
  status: z.string().nullable(),
  name: z.string().nullable(),
  amount: z.string().nullable(),
  delta: z.string().nullable(),
  note: z.string().nullable(),
  action: z.string().nullable(),
  date: z.string().nullable(),
  items: z.array(z.string()).nullable(),
});
export type SceneContent = z.infer<typeof Content>;

const Element = z.object({
  id: z.string(),
  // card:<template>/<style> · device:<model>/<finish> · shot:<n>/<crop> · icon:<lucide name> · logo
  // (null asset = an element that already exists, carried into this scene)
  asset: z.string().nullable(),
  content: Content.nullable(),
  // for devices: what the screen shows (shot:<n>/<crop> or card:<template>/<style>)
  screen: z.string().nullable(),
  label: z.string().nullable(), // caption under an icon
});
export type SceneElement = z.infer<typeof Element>;

const Beat = z.object({
  cue: z.string(),
  action: z.enum(SCENE_ACTIONS),
  elements: z.array(Element).nullable(), // scene / place
  targets: z.array(z.string()).nullable(), // element ids acted on
  to: z.string().nullable(), // destination element id (move / trigger / connect / merge)
  layout: z.string().nullable(), // scene / arrange
  camera: z.enum(CAMERA_MOVES).nullable(), // scene
  transition: z.enum(TRANSITIONS).nullable(), // scene
  backdrop: z.enum(BACKDROPS).nullable(), // scene: the atmosphere behind the elements
  style: z.string().nullable(), // enter / path / erase style
  content: Content.nullable(), // update (and trigger's reaction)
  text: z.string().nullable(), // statement
  accent: z.string().nullable(),
  text_layout: z.enum(STATEMENT_LAYOUTS).nullable(),
  items: z.array(z.string()).nullable(), // list
  lottie: z.string().nullable(), // celebrate
});
// A stored beat may carry its scene's recipe (lib/scene-recipe.ts; scene
// beats expanded from a shot that has one). Not part of the model's schema.
const StoredBeat = Beat.extend({ recipe: CompiledRecipeSchema.nullable().optional() });
export type SceneBeat = z.infer<typeof StoredBeat>;

export const SceneScriptModel = z.object({ theme: z.enum(FLOW_THEMES), beats: z.array(Beat) });
// pace: "calm" (explainer: gentle entrances, one steady backdrop, the subject
// always in focus) or "lively" (more motion); set from the motion preference.
// Explainer looks the variant search picks between (lib/shot-search.ts).
export const DECORS = ["dots", "ribbons", "waves", "glow"] as const;
export const TONES = ["tint", "white", "deep"] as const;
// How icons are drawn, and how shots hand over (a look is all of these together).
export const ICON_STYLES = ["tile", "solid", "soft", "outline"] as const;
export const CUTS = ["slide", "rise", "soft", "zoom"] as const;
export const Look = z.object({ decor: z.enum(DECORS), tone: z.enum(TONES).nullable().optional(), icons: z.enum(ICON_STYLES).nullable().optional(), cut: z.enum(CUTS).nullable().optional(), side: z.enum(["right", "left"]).nullable().optional(), seed: z.number().int() });
export type Look = z.infer<typeof Look>;
export const SceneScript = z.object({ version: z.literal(2).default(2), theme: z.enum(FLOW_THEMES), beats: z.array(StoredBeat), pace: z.enum(["calm", "lively"]).nullable().optional(), style: z.enum(["explainer"]).nullable().optional(), look: Look.nullable().optional() });
export type SceneScript = z.infer<typeof SceneScript>;

export const MAX_SCENE_BEATS = 24;
export const MAX_ELEMENTS_PER_SCENE = 6;

// Parse an asset reference.
export type AssetRef =
  | { kind: "card"; template: string; style: string }
  | { kind: "device"; model: string; finish: string }
  | { kind: "shot"; index: number; crop: string }
  | { kind: "icon"; icon: string }
  | { kind: "logo" }
  | { kind: "text"; text: string }
  | { kind: "shape"; shape: ShapeName }
  | { kind: "visual"; visual: VisualName }
  | { kind: "object"; object: ObjectName };

// Non-card elements (so a scene is not only UI cards):
// text:<1–3 words> — a big word or number as an object ("4K", "−1h", "3 weeks");
// shape:<name> — a round / arrow form; visual:<name> — a literal picture of an idea.
export const SHAPES = ["circle", "ring", "orb", "pill", "arrow-right", "arrow-down", "arrow-curve", "plus", "spark"] as const;
export type ShapeName = (typeof SHAPES)[number];
export const VISUALS = ["waveform", "filmstrip", "clock", "progress", "download", "play", "bars"] as const;
export type VisualName = (typeof VISUALS)[number];
export function parseAsset(asset: string | null | undefined): AssetRef | null {
  if (!asset) return null;
  const [kind, rest = ""] = asset.split(/:([\s\S]*)/);
  const [a, b] = rest.split("/");
  if (kind === "card" && isCardTemplate(a)) return { kind, template: a, style: isCardStyle(b) ? b : "glass" };
  if (kind === "device" && (DEVICE_MODELS as readonly string[]).includes(a)) return { kind, model: a, finish: (DEVICE_FINISHES as readonly string[]).includes(b) ? b : "light" };
  if (kind === "shot" && /^\d+$/.test(a)) return { kind, index: parseInt(a, 10), crop: b && b in CROP_PRESETS ? b : "full" };
  if (kind === "icon" && isIconName(a)) return { kind, icon: resolveIcon(a)! };
  if (kind === "logo") return { kind };
  if (kind === "text") {
    const text = rest.trim().replace(/\s+/g, " ");
    return text && text.length <= 14 && text.split(" ").length <= 3 ? { kind, text } : null;
  }
  if (kind === "shape" && (SHAPES as readonly string[]).includes(a)) return { kind, shape: a as ShapeName };
  if (kind === "visual" && (VISUALS as readonly string[]).includes(a)) return { kind, visual: a as VisualName };
  if (kind === "object" && (OBJECTS as readonly string[]).includes(a)) return { kind, object: a as ObjectName };
  return null;
}

// Deterministic repairs: unknown card templates/icons become the closest known
// ones, unknown layouts "grid", unknown Lottie names the default.
export function repairSceneScript(script: SceneScript): SceneScript {
  const fixAsset = (asset: string | null) => {
    if (!asset || parseAsset(asset)) return asset;
    const [kind, rest = ""] = asset.split(/:([\s\S]*)/);
    const [a, b] = rest.split("/");
    if (kind === "card") return `card:${searchCards(a.replace(/[-_]/g, " "), 1)[0] ?? "kpi"}/${isCardStyle(b) ? b : "glass"}`;
    if (kind === "icon") return `icon:${resolveIcon(a) ?? searchIcons(a.replace(/[-_]/g, " "), 1)[0] ?? "sparkles"}`;
    if (kind === "device") return "device:laptop/light";
    if (kind === "shot") return "shot:1/full";
    if (kind === "text") return `text:${rest.trim().split(/\s+/).slice(0, 2).join(" ").slice(0, 14) || "New"}`;
    if (kind === "shape") return a.startsWith("arrow") ? "shape:arrow-right" : "shape:orb";
    if (kind === "visual") return `icon:${searchIcons(a.replace(/[-_]/g, " "), 1)[0] ?? "sparkles"}`;
    return `card:${searchCards(asset, 1)[0] ?? "kpi"}/glass`;
  };
  // Rulebook (lib/video-rules.ts): no panel-wipe; no dark cards on a dark theme.
  const onDark = (asset: string | null) => (asset && script.theme === "midnight" ? asset.replace(/^(card:[^/]+)\/dark$/, "$1/solid") : asset);
  return {
    ...script,
    beats: script.beats.slice(0, MAX_SCENE_BEATS).map((b) => ({
      ...b,
      transition: b.transition === "panel-wipe" ? "dissolve" : b.transition,
      elements: b.elements && b.elements.slice(0, MAX_ELEMENTS_PER_SCENE).map((e) => ({ ...e, asset: onDark(fixAsset(e.asset)), screen: e.screen && (parseAsset(e.screen) ? e.screen : fixAsset(e.screen)) })),
      layout: b.layout === null ? null : isLayout(b.layout) ? b.layout : "grid",
      items: b.items && b.items.map((x) => x.trim()).filter(Boolean).slice(0, 5),
      lottie: b.lottie === null ? null : b.lottie in LOTTIE_MANIFEST ? b.lottie : "confetti-burst",
    })),
  };
}

const words = (s: string | null) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

// Blocking problems: the compiler would show something wrong or out of sync.
// Cues the voice does not say as written (the Director wrote "MotionBrief
// changes that" but the voice has "Motion Brief", a cue repeated out of
// order …): instead of throwing the script away, each cue is matched in
// spoken order to the longest run of its words the voice does say next; a
// beat with none of its words left is dropped (a scene takes the next word).
export function repairCues(script: SceneScript, narration: string, voiceWords?: WordTiming[] | null, durationSeconds = 15): { script: SceneScript; notes: string[] } {
  const timeline = voiceWords?.length ? voiceWords : estimateWords(narration, durationSeconds);
  const stream = timeline.flatMap((w) => tokenize(w.text).map((t) => ({ t, start: w.start })));
  const notes: string[] = [];
  // Where `want` is spoken from token `from` on: [start token, end token] or null.
  const find = (want: string[], from: number): [number, number] | null => {
    for (let i = from; i < stream.length; i++) {
      let at = i;
      const ok = want.every((w) => {
        const n = tokensForWord(stream, at, w);
        at += n;
        return n > 0;
      });
      if (ok) return [i, at];
    }
    return null;
  };
  let from = 0;
  const beats: SceneBeat[] = [];
  script.beats.forEach((b, i) => {
    const paired = script.style === "explainer" && b.action === "statement" && beats.length > 0 && beats[beats.length - 1].action === "scene" && script.beats[i - 1]?.cue === b.cue;
    if (paired) {
      beats.push({ ...b, cue: beats[beats.length - 1].cue });
      return;
    }
    const want = tokenize(b.cue);
    const hit = want.length ? find(want, from) : null;
    if (hit) {
      from = hit[0] + 1;
      beats.push(b);
      return;
    }
    // The longest run of the cue's own words spoken next.
    for (let len = want.length - 1; len >= 1; len--) {
      for (let s0 = 0; s0 + len <= want.length; s0++) {
        const part = find(want.slice(s0, s0 + len), from);
        if (part) {
          const cue = timeline.length ? stream.slice(part[0], part[1]).map((x) => x.t).join(" ") : want.slice(s0, s0 + len).join(" ");
          notes.push(`cue "${b.cue}" is spoken as "${cue}"`);
          from = part[0] + 1;
          beats.push({ ...b, cue });
          return;
        }
      }
    }
    if (b.action === "scene" && from < stream.length) {
      notes.push(`cue "${b.cue}" is not spoken: the scene starts on "${stream[from].t}"`);
      beats.push({ ...b, cue: stream[from].t });
      from += 1;
      return;
    }
    notes.push(`cue "${b.cue}" is not spoken: ${b.action} dropped`);
  });
  return { script: { ...script, beats }, notes };
}

export function sceneScriptBlockers(script: SceneScript, narration: string, voiceWords?: WordTiming[] | null, durationSeconds = 15): string[] {
  const errors: string[] = [];
  const beats = script.beats;
  if (beats.length < 4) errors.push(`only ${beats.length} beats; direct at least 4`);
  if (beats[0]?.action !== "scene") errors.push("the first beat must be a scene");
  const timeline = voiceWords?.length ? voiceWords : estimateWords(narration, durationSeconds);
  // A line sharing its shot's cue (shot templates) is spoken with the shot.
  const pairedAt = (i: number) => script.style === "explainer" && i > 0 && beats[i].action === "statement" && beats[i - 1].action === "scene" && beats[i - 1].cue === beats[i].cue;
  const times0 = spokenCueTimes(beats.map((b, i) => (pairedAt(i) ? "" : b.cue)), timeline);
  const times = times0.map((x, i) => (pairedAt(i) ? times0[i - 1] : x));
  times.forEach((t, i) => {
    if (t === null) errors.push(`beat ${i} cue "${beats[i].cue}" is not spoken in order (copy words exactly from the narration)`);
  });
  if (!tokenize(narration).length) errors.push("empty narration");
  const speechEnd = timeline[timeline.length - 1]?.end ?? durationSeconds;
  // (Explainer shots: pacing is checked on the video itself — the idle rule —
  // and never throws a whole script away.)
  const paced = script.style !== "explainer";
  for (let i = 1; paced && i < beats.length; i++) {
    const [a, b] = [times[i - 1], times[i]];
    if (a === null || b === null) continue;
    const held = ["scene", "list", "arrange", "reveal"].includes(beats[i - 1].action) ? 4 : 3;
    if (b - a > held) errors.push(`${(b - a).toFixed(1)} s between beat ${i - 1} and beat ${i} with nothing new; add a beat in between (max ${held} s)`);
  }
  const last = times[times.length - 1];
  if (paced && last !== null && last !== undefined && speechEnd - last > 3.5) errors.push(`the last ${(speechEnd - last).toFixed(1)} s have no beat`);
  if (!beats.some((b) => b.action === "statement" || b.action === "list")) errors.push("no statement: put the key phrase on screen with at least one statement");
  if (beats.filter((b) => b.action === "scene").length < 2) errors.push("use at least 2 scenes (the video must travel, not stay on one arrangement)");

  const alive = new Set<string>();
  const ever = new Set<string>();
  const expanded = new Set<string>();
  let orbitInScene = false;
  const need = (cond: unknown, i: number, what: string) => {
    if (!cond) errors.push(`beat ${i} (${beats[i].action}): ${what}`);
  };
  beats.forEach((b, i) => {
    const prev = beats[i - 1];
    // A camera-only beat repeated changes nothing on screen.
    if (b.action === "scene" || b.action === "arrange") expanded.clear();
    if (b.action === "scene") orbitInScene = false;
    if (prev && ["reveal", "focus"].includes(b.action) && prev.action === b.action && (b.action === "reveal" || prev.targets?.[0] === b.targets?.[0])) errors.push(`beat ${i} repeats beat ${i - 1} (${b.action}); make something happen instead`);
    const known = (id: string) => alive.has(id);
    switch (b.action) {
      case "scene":
      case "place":
      case "lift": {
        need(b.elements?.length, i, "needs elements");
        if (b.action === "lift") {
          need(b.targets?.length === 1 && known(b.targets[0]), i, "needs the screen it lifts out of (one target on screen)");
          need((b.elements?.length ?? 0) <= 2 && (b.elements ?? []).every((e) => e.asset !== null), i, "lifts out 1–2 new elements");
        }
        if (b.action === "scene") need(b.layout, i, "needs a layout");
        const next = new Set<string>(b.action === "scene" ? [] : alive);
        for (const e of b.elements ?? []) {
          if (e.asset === null) need(ever.has(e.id), i, `element "${e.id}" has no asset and does not exist yet`);
          else {
            need(parseAsset(e.asset), i, `unknown asset "${e.asset}"`);
            need(!alive.has(e.id), i, `element id "${e.id}" is already on screen`);
          }
          next.add(e.id);
          ever.add(e.id);
        }
        need(next.size <= MAX_ELEMENTS_PER_SCENE, i, `at most ${MAX_ELEMENTS_PER_SCENE} elements on screen`);
        alive.clear();
        next.forEach((x) => alive.add(x));
        break;
      }
      case "move":
        // (Several targets: they gather beside the destination — accumulate.)
        need(b.targets?.length && b.targets.length <= 4 && b.targets.every(known), i, "needs 1–4 targets on screen");
        need(b.to && known(b.to) && !b.targets?.includes(b.to), i, "needs a different destination on screen");
        break;
      case "trigger":
      case "connect":
        need(b.targets?.length === 1 && known(b.targets[0]), i, "needs one target on screen");
        need(b.to && known(b.to) && b.to !== b.targets?.[0], i, "needs a different destination on screen");
        break;
      case "merge":
        need(b.targets?.length && b.targets.every(known), i, "targets must be on screen");
        need(b.to && known(b.to), i, "needs a destination on screen");
        for (const t of b.targets ?? []) if (t !== b.to) alive.delete(t);
        break;
      case "update":
        need(b.targets?.length === 1 && known(b.targets[0]), i, "needs one card on screen");
        need(b.content, i, "needs content");
        break;
      case "click":
        need(b.targets?.length === 1 && known(b.targets[0]), i, "needs one target on screen");
        break;
      case "erase":
        need(b.targets?.length && b.targets.every(known), i, "targets must be on screen");
        for (const t of b.targets ?? []) alive.delete(t);
        break;
      case "highlight":
      case "focus":
      case "celebrate":
        need(b.targets?.length && b.targets.every(known), i, "targets must be on screen");
        break;
      case "orbit":
        need(!orbitInScene, i, "only one orbit per scene");
        orbitInScene = true;
        need(b.targets?.length && b.targets.length <= 4 && b.targets.every(known), i, "1–4 targets on screen");
        need(b.to && known(b.to) && !b.targets?.includes(b.to), i, "needs a centre on screen that is not a target");
        break;
      case "expand":
        need(b.targets?.length === 1 && known(b.targets[0]), i, "needs one target on screen");
        need(!expanded.size, i, "collapse the expanded element first");
        expanded.add(b.targets?.[0] ?? "");
        break;
      case "collapse":
        need(b.targets?.length === 1 && expanded.has(b.targets[0]) && known(b.targets[0]), i, "needs one expanded target on screen");
        expanded.delete(b.targets?.[0] ?? "");
        break;
      case "disconnect":
      case "flow":
        need(b.targets?.length === 1 && known(b.targets[0]), i, "needs one target on screen");
        need(b.to && known(b.to) && b.to !== b.targets?.[0], i, "needs a different destination on screen");
        break;
      case "trace":
        need(b.targets && b.targets.length >= 2 && b.targets.length <= 6 && b.targets.every(known), i, "2–6 targets on screen, in order");
        break;
      case "arrange":
        need(b.layout, i, "needs a layout");
        break;
      case "reveal":
        break;
      case "statement":
        need(b.text && words(b.text) <= 10, i, "text of at most 10 words");
        break;
      case "list":
        need(b.items && b.items.length >= 3 && b.items.length <= 5, i, "needs 3–5 items");
        for (const x of b.items ?? []) if (words(x) > 4) errors.push(`beat ${i}: list item "${x}" is longer than 4 words`);
        break;
    }
  });
  return errors;
}
