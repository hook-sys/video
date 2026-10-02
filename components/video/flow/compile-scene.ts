import { estimateWords } from "@/lib/flow-script";
import { type BackdropSlot, backdropSlot, renderableBackdrop } from "./backdrop-names";
import { type BgChoreo, CAMERA_RETURN, type CameraOffset, cameraOffsets, choreoTimeline, type ChoreoTimeline, sfxFrame } from "@/lib/choreography";
import { parseAsset, type SceneBeat, type SceneContent, type SceneElement, type SceneScript } from "@/lib/scene-script";
import { spokenCueTimes, type WordTiming } from "@/lib/voice-timing";
import { cardSize } from "./cards/card";
import { deviceSize } from "./cards/device-data";
import { CARD_BY_ID } from "./cards/templates";
import type { CardContent } from "./cards/types";
import { resolvePlan } from "./resolve";
import { brandStartFrame, type CompileBrand, ctaLine, smoothCamera, wordFrames } from "./compile";
import { CURVES } from "./ease";
import { num, vec } from "./eval";
import { DEPTH, layoutFamily, layoutSlots, OVERLAPPING_FAMILIES, type Slot } from "./layouts";
import { animate as animateAfter, Flow, type FlowNodeHandle, put as putAfter } from "./patterns";
import { MARK_DELAY, type Ease, type FlowElement, type FlowLink, type FlowNode, type FlowPlan, type FlowText, type ThemeName, type Track, type Vec, type Vec3 } from "./types";
import { EXPLAINER_TYPE, fitSize } from "./typography";
import { type CompiledRecipe, ENV_WORLD, type Layer, recipeCamera, recipeSlots, recipeText } from "@/lib/scene-recipe";

// SceneScript (Director v2) → FlowPlan. Scenes are arrangements of product
// elements on one continuous canvas; beats are motion verbs on spoken words.
// Layout, sizes, paths, camera, transitions and timing are decided here.

const FPS = 30;
const LEAD = 3;
const MIN_GAP = 8;
// Push transitions slide the old scene out and the new one in by this much
// (the camera stays: a long camera pan lags behind its acceleration cap).
const SCENE_STEP: Record<string, Vec> = { "push-left": [2200, 0], "push-right": [-2200, 0], "push-up": [0, 1300] };

// Each verb needs time to read before the next beat starts.
const MIN_FRAMES: Record<SceneBeat["action"], number> = {
  scene: 40,
  place: 18,
  move: 22,
  trigger: 26,
  update: 16,
  connect: 18,
  merge: 26,
  arrange: 28,
  erase: 16,
  highlight: 14,
  focus: 24,
  reveal: 26,
  celebrate: 10,
  statement: 34,
  list: 56,
  orbit: 30,
  expand: 24,
  collapse: 18,
  disconnect: 12,
  trace: 26,
  flow: 20,
  click: 20,
  lift: 30,
  activate: 12,
};
// focus style → the part of the element to zoom into (offsets as a share of its size).
const DETAIL: Record<string, Vec> = { center: [0, 0], top: [0, -0.25], bottom: [0, 0.25], left: [-0.25, 0], right: [0.25, 0], "top-left": [-0.25, -0.25], "top-right": [0.25, -0.25], "bottom-left": [-0.25, 0.25], "bottom-right": [0.25, 0.25] };
const MINOR = new Set<SceneBeat["action"]>(["celebrate", "highlight", "disconnect"]);
// How long an event runs (frames), for the events that follow it: until its
// motion is at rest. Choreographed: to the end of its settle (a transform's
// action keeps its 16-frame turn; a highlight's dimmed neighbours come back
// at least 26 frames into the action). Otherwise each event's own timing
// below: the move lands at 26, a merge's bump settles at 40, an assemble's
// fuse at 56, a transform's bump at 50, a highlight's neighbours come back at
// 34. Any other verb: the time it needs to read.
const EVENT_REST: Partial<Record<string, number>> = { "move/recipe": 26, merge: 40, "merge/assemble": 56, "merge/transform": 50, highlight: 34 };
function eventLength(b: SceneBeat): number {
  const key = b.style === "recipe" || b.style === "assemble" || b.style === "transform" ? `${b.action}/${b.style}` : b.action;
  if (b.choreo && (b.action === "merge" || b.action === "highlight" || key === "move/recipe")) {
    const c = choreoTimeline(b.style === "transform" ? { ...b.choreo, action: Math.max(b.choreo.action, 22) } : b.choreo, 0);
    return b.action === "highlight" ? Math.max(c.end, c.actionAt + 26) : c.end;
  }
  return EVENT_REST[key] ?? MIN_FRAMES[b.action];
}

export type SceneCompileOptions = {
  narration: string;
  words?: WordTiming[] | null;
  durationSeconds: number;
  theme?: ThemeName;
  brand?: CompileBrand | null;
  screenshots?: string[] | null;
};

// The newest beat wins from its own frame: keys an earlier beat scheduled
// for later (a highlight's restore, a pulse's settle) are cut, so a fade or
// shrink is never postponed past them. Positions keep their order instead
// (a travel path must stay continuous).
function cut(track: Track<number>, t: number) {
  if (!track.length || track[track.length - 1][0] <= t) return;
  const v = num(track, t, track[0][1]);
  while (track.length && track[track.length - 1][0] > t) track.pop();
  if (!track.length || track[track.length - 1][0] < t) track.push([t, v]);
}
function animate<T>(track: Track<T>, t: number, dur: number, value: T, ease?: Ease) {
  if (typeof value === "number") cut(track as unknown as Track<number>, t);
  animateAfter(track, t, dur, value, ease);
}
function put<T>(track: Track<T>, t: number, value: T, ease?: Ease) {
  if (typeof value === "number") cut(track as unknown as Track<number>, t);
  putAfter(track, t, value, ease);
}

// The canvas decor's level under a recipe environment: an edge accent only.
export const DECOR_ACCENT = 0.35;

// Phase 3: each event's camera response (lib/choreography.ts cameraOffsets)
// as offsets on the scene's own camera between the event's phase frames:
// start (none) → action start (preparation) → impact (the move) → settle
// (a touch further) → end (back to the scene's camera), eased. The scene's
// camera is sampled frame by frame over the span its neighbouring keys
// cover, so its own path stays exactly as it was (extra keys must not
// re-ease its long moves) and the offset is added on top; the usual camera
// smoothing then gives the response the same pace and acceleration limits
// as every other camera move. No cues: the camera is untouched.
function applyCameraResponses(plan: FlowPlan, cues: { c: ChoreoTimeline; subject: Vec }[]) {
  for (const { c, subject } of cues) {
    const cam = c.camera!;
    const centre0 = vec(plan.camera.center, c.start);
    const off = cameraOffsets(cam, [subject[0] - centre0[0], subject[1] - centre0[1]]);
    const none: CameraOffset = { center: [0, 0], zoom: 1 };
    const anchors: [number, CameraOffset][] = [[c.start, none]];
    if (c.anticipation) anchors.push([c.actionAt, off.anticipation]);
    anchors.push([c.impactAt, off.action]);
    if (c.impact) anchors.push([c.settleAt, off.impact]);
    const end = c.settle ? c.end : anchors[anchors.length - 1][0] + CAMERA_RETURN;
    anchors.push([end, none]);
    const at = (fr: number): CameraOffset => {
      if (fr <= c.start || fr >= end) return none;
      const j = anchors.findIndex(([af]) => af >= fr);
      const [f0, a] = anchors[j - 1];
      const [f1, b] = anchors[j];
      const k = CURVES.inOut(f1 === f0 ? 1 : (fr - f0) / (f1 - f0));
      return { center: [a.center[0] + (b.center[0] - a.center[0]) * k, a.center[1] + (b.center[1] - a.center[1]) * k], zoom: a.zoom + (b.zoom - a.zoom) * k };
    };
    // per frame over [the key before the event, the key after it]
    const dense = <T,>(track: Track<T>, sample: (fr: number) => T, add: (v: T, o: CameraOffset) => T): Track<T> => {
      const lo = Math.min(c.start, ...track.filter(([kf]) => kf <= c.start).map(([kf]) => kf).slice(-1));
      const hiKeys = track.filter(([kf]) => kf >= end).map(([kf]) => kf);
      const hi = hiKeys.length ? hiKeys[0] : end;
      const span: Track<T> = [];
      for (let fr = lo; fr <= hi; fr++) span.push([fr, add(sample(fr), at(fr)), "linear"]);
      return [...track.filter(([kf]) => kf < lo), ...span, ...track.filter(([kf]) => kf > hi)];
    };
    const base = { center: plan.camera.center, zoom: plan.camera.zoom };
    plan.camera.center = dense(base.center, (fr) => vec(base.center, fr), (v, o) => [v[0] + o.center[0], v[1] + o.center[1]]);
    plan.camera.zoom = dense(base.zoom, (fr) => num(base.zoom, fr, 1), (v, o) => v * o.zoom);
  }
}

// Cards whose last block is a button (the cursor clicks it).
const BUTTON_CARDS = new Set(["action-panel", "login", "checkout", "cta"]);

// Explainer pace swaps the lively entrances for soft ones.
const CALM_ENTER: Record<string, string> = { spin: "pop", bounce: "rise", drop: "rise", flip: "scale-up", cascade: "rise", "slide-left": "rise", "slide-right": "rise" };

type Live = { h: FlowNodeHandle; w: number; h0: number; fit: number; pos: Vec; depth: 0 | 1 | 2; home?: { pos: Vec; fit: number; z: number } };

const toContent = (c: SceneContent | null | undefined): Record<string, unknown> | undefined =>
  c ? Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length))) : undefined;

export function compileSceneScript(script: SceneScript, { narration, words, durationSeconds, theme, brand, screenshots }: SceneCompileOptions): FlowPlan {
  const total = Math.round(durationSeconds * FPS);
  const timeline = words?.length ? words : estimateWords(narration, durationSeconds);
  // Explainer pace (the default): soft entrances, one backdrop, sound only where
  // something visibly lands.
  const calm = script.pace !== "lively";
  const explainer = script.style === "explainer";
  let stageEnd = brand?.name?.trim() || brand?.logo ? brandStartFrame(total, timeline) : total;
  // Explainer: a closing sentence that names the brand ("Start free with
  // MotionBrief.") and has no shot of its own is the call to action — the
  // lockup arrives with its first word instead of after a dead stretch.
  if (explainer && brand?.name?.trim() && timeline.length > 2) {
    const name = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    let k = timeline.length - 1;
    while (k > 0 && !/[.!?]["')\]]*$/.test(timeline[k - 1].text)) k--;
    const said = timeline.slice(k).map((w) => w.text).join("").toLowerCase().replace(/[^a-z0-9]/g, "");
    const from = Math.round(timeline[k].start * FPS) - LEAD;
    const lastCue = Math.max(-1, ...spokenCueTimes(script.beats.map((b) => b.cue), timeline).map((x) => (x === null ? -1 : x)));
    if (k > 0 && name && said.includes(name) && lastCue < timeline[k].start && from > 0 && from < stageEnd) stageEnd = Math.max(from, 45);
  }
  const stagger = calm ? 6 : 4; // ≥ 0.2 s apart, so each pop is heard

  // ── schedule ──
  // Explainer: a line set beside a shot's subject shares the shot's cue (the
  // words are spoken as it appears); it arrives a moment after the subject.
  const paired = new Set<SceneBeat>(explainer ? script.beats.filter((b, i) => b.action === "statement" && script.beats[i - 1]?.action === "scene" && script.beats[i - 1].cue === b.cue) : []);
  const times = spokenCueTimes(script.beats.map((b) => (paired.has(b) ? "" : b.cue)), timeline);
  const beats: SceneBeat[] = [];
  const starts: number[] = [];
  const skipped: NonNullable<FlowPlan["skipped"]> = [];
  let last = -MIN_GAP;
  // Relationships (Phase 5): an event after another starts when that one
  // ends (+ offset) instead of on its words — never before the beat ahead
  // of it may give way (then it is late, and reported). The events'
  // choreography runs from there unchanged.
  const events = new Map<string, { start: number; end: number }>();
  const relations: NonNullable<FlowPlan["relations"]> = [];
  script.beats.forEach((b, i) => {
    if (paired.has(b) && beats[beats.length - 1] === script.beats[i - 1]) {
      beats.push(b);
      starts.push(starts[starts.length - 1] + 6);
      last = starts[starts.length - 1];
      return;
    }
    const dep = b.after ? events.get(b.after.event) : undefined;
    const cue = dep ? dep.end + b.after!.offset : times[i] === null ? last + MIN_GAP : Math.round(times[i]! * FPS) - LEAD;
    const prev = beats[beats.length - 1];
    const earliest = prev ? starts[starts.length - 1] + MIN_FRAMES[prev.action] : 0;
    const t = Math.min(stageEnd - 24, Math.max(0, cue, earliest));
    if (MINOR.has(b.action) && t - cue > 20) return void skipped.push({ cue: b.cue, action: b.action, reason: `a minor accent ${t - cue} frames late` });
    if (prev && t - starts[starts.length - 1] < MIN_GAP) return void skipped.push({ cue: b.cue, action: b.action, reason: `${t - starts[starts.length - 1]} frames after the ${prev.action} before it` });
    beats.push(b);
    starts.push(t);
    last = t;
    if (b.event) events.set(b.event, { start: t, end: t + eventLength(b) });
    if (b.after) relations.push({ event: b.event ?? `${b.action}:${b.cue}`, after: b.after.event, offset: b.after.offset, start: t, ...(dep ? { dependencyEnd: dep.end } : {}), status: !dep ? "fallback" : t === cue ? "applied" : "delayed" });
  });

  const f = new Flow(theme ?? script.theme, total, { center: [0, 0], zoom: 0.9 });
  // A travelling element whooshes only at the lively pace; calm keeps whooshes for scene changes.
  const moveSfx = (at: number) => {
    if (!calm) f.sfx(at, "whoosh");
  };
  const live = new Map<string, Live>(); // elements on screen
  const clicks: { t: number; aim: Vec }[] = []; // click beats, for the cursor
  const known = new Map<string, Live>(); // every element ever made
  const center: Vec = [0, 0]; // every scene is framed here (pushes move elements, not the camera)
  let layoutName = "grid";
  // The current scene's recipe (lib/scene-recipe.ts), if it has one.
  let sceneRecipe: CompiledRecipe | null = null;
  let carriedIn = false; // the current scene carries an element in from the last one
  let sceneIdx = -1;
  let sceneAt = 0; // when the current scene started (its words may be spoken from there)
  let uid = 0;
  const lines: { start: number; end: number; style: NonNullable<FlowText["style"]> }[] = [];

  // ── elements ──
  const elementSpec = (e: SceneElement): { el: FlowElement; w: number; h: number } | null => {
    const ref = parseAsset(e.asset);
    if (!ref) return null;
    const content = toContent(e.content);
    if (ref.kind === "card") {
      const tpl = CARD_BY_ID.get(ref.template)!;
      const { w, h } = cardSize(tpl, content as CardContent);
      return { el: { type: "card", template: ref.template, style: ref.style, content }, w, h };
    }
    if (ref.kind === "device") {
      const scr = parseAsset(e.screen);
      const screen =
        scr?.kind === "shot" && screenshots?.length
          ? { src: screenshots[(scr.index - 1) % screenshots.length], crop: scr.crop }
          : scr?.kind === "card"
            ? { card: { template: scr.template, style: scr.style, content } }
            : screenshots?.length
              ? { src: screenshots[0], crop: "full" }
              : { card: { template: "dashboard-mini", style: "solid", content } };
      const { w, h } = deviceSize(ref.model as never);
      return { el: { type: "device", model: ref.model, finish: ref.finish, screen }, w, h };
    }
    if (ref.kind === "shot") {
      if (!screenshots?.length) {
        const tpl = CARD_BY_ID.get("dashboard-mini")!;
        const { w, h } = cardSize(tpl, content as CardContent);
        return { el: { type: "card", template: "dashboard-mini", style: "solid", content }, w, h };
      }
      const [, , cw, ch] = ref.crop === "full" ? [0, 0, 1.6, 1] : [0, 0, 1.25, 1];
      return { el: { type: "shot", src: screenshots[(ref.index - 1) % screenshots.length], crop: ref.crop }, w: Math.round(560 * cw), h: Math.round(560 * ch) };
    }
    if (ref.kind === "icon") return { el: { type: "icon", icon: ref.icon, label: e.label ?? undefined }, w: 160, h: e.label ? 220 : 160 };
    if (ref.kind === "text") {
      // Sized to the word: short numbers are huge, three words stay one line.
      const len = Math.max(2, ref.text.length);
      const size = Math.round(Math.min(300, 1400 / len));
      return { el: { type: "text", text: ref.text }, w: Math.round(size * len * 0.62 + 40), h: Math.round(size * 1.25) };
    }
    if (ref.kind === "shape") {
      const wide = ref.shape.startsWith("arrow") || ref.shape === "pill";
      return { el: { type: "shape", shape: ref.shape, label: e.label ?? undefined }, w: wide ? 360 : 260, h: wide ? (ref.shape === "pill" ? 120 : 160) : 260 };
    }
    if (ref.kind === "object") return { el: { type: "object", object: ref.object, label: e.label ?? undefined }, w: 320, h: e.label ? 390 : 320 };
    if (ref.kind === "visual") {
      const wide = ref.visual === "waveform" || ref.visual === "filmstrip" || ref.visual === "bars";
      return { el: { type: "visual", visual: ref.visual, label: e.label ?? undefined }, w: wide ? 520 : 300, h: wide ? 300 : 320 };
    }
    return { el: { type: "logo", src: brand?.logo ?? undefined, text: brand?.name ?? "Logo" }, w: 320, h: 180 };
  };

  const fitIn = (w: number, h: number, s: Slot) => Math.min(s.grow ?? 1.1, s.box[0] / w, s.box[1] / h) * s.scale * DEPTH[s.depth].scale;
  // The layout's slots, unless it would shrink sharp cards below readable
  // size (7 cards in a row): then the best of grid / mosaic.
  const READABLE = 0.5; // × 0.86 when a caption band is kept free ≈ the gate's 0.42
  const slotsFor = (name: string, sizes: Vec[], seed: number): { slots: Slot[]; name: string } => {
    const minFit = (sl: Slot[]) => Math.min(...sizes.map(([w, h], i) => (sl[i].depth === 0 ? 9 : fitIn(w, h, sl[i]))));
    const first = layoutSlots(name, sizes.length, seed);
    if (minFit(first) >= READABLE) return { slots: first, name };
    return [name, "grid", "mosaic"].map((n) => ({ slots: n === name ? first : layoutSlots(n, sizes.length, seed), name: n })).sort((a, b) => minFit(b.slots) - minFit(a.slots))[0];
  };
  // Stacks, fans and cascades overlap on purpose; the quality gate is told.
  const overlaps: { ids: string[]; start: number; end: number }[] = [];
  const openOverlap = (layout: string, t: number, ids: string[]) => {
    for (const o of overlaps) if (o.end > t) o.end = t + 20;
    if (OVERLAPPING_FAMILIES.includes(layoutFamily(layout))) overlaps.push({ ids, start: t, end: total });
  };
  const worldSlot = (s: Slot): Vec => [center[0] + s.pos[0], center[1] + s.pos[1]];

  const bump = (n: Live, t: number) => {
    const sc = n.h.spec.scale!;
    animate(sc, t, 6, n.fit * 1.07, "out");
    put(sc, t + 18, n.fit, "inOut");
  };
  // Choreographed events (lib/choreography.ts): anticipation → action →
  // impact → settle on the event's own frames. Absent: the event keeps its
  // own fixed timing (nothing here runs).
  const choreoOf = (b: SceneBeat, t: number): ChoreoTimeline | null => (b.choreo ? choreoTimeline(b.choreo, t) : null);
  // Anticipation: the actor gathers itself (a small dip) before it acts.
  const anticipate = (n: Live, c: ChoreoTimeline) => {
    if (!c.anticipation) return;
    const sc = n.h.spec.scale!;
    animate(sc, c.start, c.anticipation, n.fit * 0.93, "inOut");
    animate(sc, c.actionAt, Math.min(6, c.action), n.fit, "out");
  };
  // Impact and settle on what the action lands on: a pop, then the return
  // to rest; with no impact, the settle is a soft overshoot coming to rest.
  const land = (n: Live, c: ChoreoTimeline) => {
    const sc = n.h.spec.scale!;
    if (c.impact) {
      animate(sc, c.impactAt, c.impact, n.fit * 1.08, "out");
      animate(sc, c.settleAt, Math.max(1, c.settle), n.fit, "inOut");
    } else if (c.settle) {
      animate(sc, c.impactAt, Math.max(1, Math.round(c.settle / 3)), n.fit * 1.03, "out");
      animate(sc, c.impactAt + Math.max(1, Math.round(c.settle / 3)), Math.max(1, c.settle - Math.round(c.settle / 3)), n.fit, "inOut");
    }
  };
  // Phase 2: the event's own SFX cues, each on its phase's frame
  // (sfxFrame). With cues, the event's fixed sounds give way to them;
  // without, nothing changes (false: play the fixed ones).
  const choreoSfx = (c: ChoreoTimeline | null) => {
    if (!c?.sfx?.length) return false;
    for (const x of c.sfx) f.sfx(sfxFrame(c, x.phase), x.kind, true);
    return true;
  };
  // Phase 3: camera responses of choreographed events, laid over the scene's
  // own camera once every beat is placed (applyCameraResponses).
  const cameraCues: { c: ChoreoTimeline; subject: Vec }[] = [];
  const cameraCue = (c: ChoreoTimeline | null, subject: Live | undefined) => {
    if (c?.camera && subject) cameraCues.push({ c, subject: subject.pos });
  };
  const setBlur = (n: Live, t: number, v: number, dur = 12) => {
    const b = (n.h.spec.blur ??= [[0, num(n.h.spec.blur, t, 0)]]);
    animate(b, t, dur, v, "inOut");
  };

  // Show an element at its slot with an entrance style.
  const enter = (n: Live, t: number, want: string, rot: number, push?: Vec) => {
    const style = calm ? (CALM_ENTER[want] ?? want) : want;
    const spec = n.h.spec;
    const [x, y] = n.pos;
    const sc = spec.scale!;
    const op = spec.opacity!;
    spec.appear = t;
    put(op, t, 0);
    put(op, t + 10, 1, "out");
    const from: Record<string, Vec> = { tilt: [x, y + 120], rise: [x, y + 80], "slide-left": [x + 280, y], "slide-right": [x - 280, y], drop: [x, y - 180], cascade: [x - 60, y + 60], bounce: [x, y - 260] };
    if (push) {
      put(spec.pos, t, [x + push[0], y + push[1]]);
      put(spec.pos, t + 22, [x, y], "inOut");
      put(sc, t, n.fit);
      if (rot) spec.rot = [[0, rot]];
      if (DEPTH[n.depth].blur && spec.el?.type !== "text") spec.blur = [[0, DEPTH[n.depth].blur]];
      return;
    }
    if (from[style]) {
      put(spec.pos, t, from[style]);
      if (style === "bounce") {
        // Falls in, overshoots and settles: two hops.
        put(spec.pos, t + 12, [x, y], "in");
        put(spec.pos, t + 18, [x, y - 34], "out");
        put(spec.pos, t + 24, [x, y], "in");
      } else put(spec.pos, t + 20, [x, y], style === "drop" ? "back" : "out");
    } else put(spec.pos, t, [x, y]);
    put(sc, t, style === "pop" ? (calm ? n.fit * 0.85 : 0) : style === "scale-up" ? n.fit * 0.6 : style === "spin" ? n.fit * 0.3 : style === "blur" ? n.fit * 1.08 : n.fit * 0.94);
    put(sc, t + 18, n.fit, style === "pop" || style === "spin" ? "back" : "out");
    if (style === "spin") spec.rot = [[t, rot - 200], [t + 22, rot, "out"]];
    if (style === "blur") {
      spec.blur = [[0, 18]];
      put(spec.blur, t, 18);
      put(spec.blur, t + 16, 0, "out");
    }
    if (style === "flip") {
      spec.tilt = [[t, [0, 75, 0]], [t + 20, [0, 0, 0], "out"]];
    }
    if (style === "tilt") {
      // The hero screen rises in tilted back in 3D, then settles flat (slowly).
      spec.tilt = [[t, [24, -16, 3]], [t + 40, [0, 0, 0], "inOut"]];
    }
    if (rot && style !== "spin") spec.rot = [[0, rot]];
    // A big word or number must stay readable: never blurred for depth.
    const depthBlur = spec.el?.type === "text" ? 0 : DEPTH[n.depth].blur;
    if (depthBlur) {
      spec.blur ??= [[0, 0]];
      put(spec.blur, t + 18, depthBlur, "inOut");
    }
  };

  const leave = (n: Live, t: number, style: string) => {
    const spec = n.h.spec;
    if (style === "wipe") spec.erase = t;
    else if (style === "shrink") {
      animate(spec.scale!, t, 14, 0, "in");
      animate(spec.opacity!, t + 6, 8, 0, "in");
    }
    else if (style === "fly-out") {
      animate(spec.pos, t, 16, [n.pos[0] + 900, n.pos[1] - 120], "in");
      animate(spec.opacity!, t + 4, 12, 0, "in");
    } else if (style === "burst") {
      // Pops outward and dissolves.
      animate(spec.scale!, t, 10, n.fit * 1.35, "out");
      setBlur(n, t + 2, 16, 10);
      animate(spec.opacity!, t + 2, 10, 0, "in");
    } else if (style === "sink") {
      animate(spec.pos, t, 16, [n.pos[0], n.pos[1] + 260], "in");
      animate(spec.scale!, t, 16, n.fit * 0.85, "in");
      animate(spec.opacity!, t + 6, 10, 0, "in");
    } else if (style === "through") {
      // The camera pushes past it: grows, blurs and fades.
      animate(spec.scale!, t, 16, n.fit * 2.4, "in");
      setBlur(n, t, 22, 16);
      animate(spec.opacity!, t + 4, 12, 0, "in");
    } else {
      setBlur(n, t, 12, 14);
      animate(spec.opacity!, t, 14, 0, "in");
    }
  };

  // Move an element to a new place (straight or along a curve).
  const travel = (n: Live, t: number, dur: number, to: Vec, style: string) => {
    const from = vec(n.h.spec.pos, t);
    const mid: Vec = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const bend = style === "straight" ? 0 : style === "swoop" ? 0.55 : 0.28;
    const ctrl: Vec = [mid[0] - dy * bend, mid[1] + dx * bend];
    (n.h.spec.paths ??= []).push({ start: t, end: t + dur, from, ctrl, to, ease: "inOut" });
    put(n.h.spec.pos, t, from);
    put(n.h.spec.pos, t + dur, to);
    n.pos = to;
  };

  // Lay the given elements out in a layout (new ones enter, existing ones travel).
  let entered: number[] = []; // when the last place() brought each newcomer in
  const place = (els: SceneElement[], t: number, layout: string, style: string | null, carry: boolean, push?: Vec) => {
    entered = [];
    const ids = [...(carry ? [...live.keys()].filter((id) => !els.some((e) => e.id === id)) : []), ...els.map((e) => e.id)];
    const existingOf = (id: string) => live.get(id) ?? (els.find((e) => e.id === id)?.asset === null ? known.get(id) : undefined);
    const specs = new Map(els.filter((e) => e.asset !== null).map((e) => [e.id, elementSpec(e)] as const));
    const kept = ids.filter((id) => existingOf(id) || specs.get(id));
    const sizes = kept.map((id): Vec => {
      const n = existingOf(id);
      const sp = specs.get(id);
      return n ? [n.w, n.h0] : [sp!.w, sp!.h];
    });
    // A recipe scene: each element at its composition's place and depth layer.
    const rs = layout === "recipe" && sceneRecipe ? recipeSlots(sceneRecipe, kept) : null;
    const { slots, name } = rs ? { slots: kept.map((id): Slot => ({ ...rs.get(id)!, rot: 0 })), name: "recipe" } : slotsFor(layout, sizes, sceneIdx);
    const layerOf = (id: string): Layer | undefined => rs?.get(id)?.layer;
    const zOf = (id: string, s: Slot, i: number) => (layerOf(id) ?? s.depth) * 10 + i;
    const nodeIds: string[] = [];
    kept.forEach((id, i) => {
      const s = slots[i];
      const at = worldSlot(s);
      const existing = existingOf(id);
      if (existing) {
        existing.fit = fitIn(existing.w, existing.h0, s);
        existing.depth = s.depth;
        existing.h.spec.z = zOf(id, s, i);
        if (rs) existing.h.spec.layer = layerOf(id);
        if (!live.has(id)) {
          // Carried in from an earlier scene: reappears where it was, then moves.
          put(existing.h.spec.opacity!, t, 1, "out");
        }
        travel(existing, t + i * 2, 22, at, "arc");
        animate(existing.h.spec.scale!, t + i * 2, 22, existing.fit, "inOut");
        if (existing.h.spec.blur) animate(existing.h.spec.blur, t + i * 2, 16, DEPTH[s.depth].blur, "inOut");
        live.set(id, existing);
        nodeIds.push(existing.h.id);
        return;
      }
      const spec = specs.get(id)!;
      const nodeId = known.has(id) ? `${id}~${uid++}` : id;
      const h = f.el(nodeId, at, { ...spec, z: zOf(id, s, i) });
      if (rs) h.spec.layer = layerOf(id);
      const n: Live = { h, w: spec.w, h0: spec.h, fit: fitIn(spec.w, spec.h, s), pos: at, depth: s.depth };
      // A device or screenshot as the scene's hero enters tilted, then settles.
      const heroScreen = (i === 0 || s.depth === 2) && (spec.el.type === "device" || spec.el.type === "shot");
      const role = rs ? sceneRecipe!.roles[id] : undefined;
      const recipeEnter = role && (role.role === "hero" ? (["device", "shot", "card"].includes(spec.el.type) ? "tilt" : spec.el.type === "text" ? "scale-up" : "pop") : role.layer === 0 ? "blur" : "rise");
      const enterStyle = style ?? recipeEnter ?? (heroScreen ? "tilt" : calm ? ["rise", "pop", "scale-up", "blur"][(sceneIdx + i) % 4] : ["rise", "pop", "slide-left", "blur", "drop", "scale-up", "flip"][(sceneIdx + i) % 7]);
      enter(n, push ? t : t + i * stagger, enterStyle, s.rot, push);
      // A ui-plane or device hero stays a plane in 3D (tilted back), after it lands.
      if (role?.role === "hero" && (sceneRecipe!.heroType === "ui-plane" || sceneRecipe!.heroType === "device")) {
        const held: [number, number, number] = sceneRecipe!.heroType === "ui-plane" ? [14, -20, 2] : [6, -12, 0];
        const tt = h.spec.tilt;
        if (tt?.length) tt[tt.length - 1] = [tt[tt.length - 1][0], held, "inOut"];
        else h.spec.tilt = [[t, [0, 0, 0]], [t + 30, held, "inOut"]];
      }
      entered.push(push ? t : t + i * stagger);
      live.set(id, n);
      known.set(id, n);
      nodeIds.push(nodeId);
    });
    openOverlap(name, t, nodeIds);
    // A recipe's background layer sits behind the hero, its foreground in
    // front of it, on purpose (depth).
    if (rs) {
      const heroNode = kept.find((id) => sceneRecipe!.roles[id]?.role === "hero");
      const back = kept.filter((id) => layerOf(id) === 0 || layerOf(id) === 3).map((id) => live.get(id)?.h.id).filter((x): x is string => !!x);
      const hn = heroNode ? live.get(heroNode)?.h.id : undefined;
      if (hn && back.length) overlaps.push({ ids: [hn, ...back], start: t, end: total });
    }
    return name;
  };

  // ── camera ──
  const framedBox = (ns: Live[]) => {
    if (!ns.length) return { c: center, zoom: 1 };
    const xs = ns.flatMap((n) => [n.pos[0] - (n.w * n.fit) / 2, n.pos[0] + (n.w * n.fit) / 2]);
    const ys = ns.flatMap((n) => [n.pos[1] - (n.h0 * n.fit) / 2, n.pos[1] + (n.h0 * n.fit) / 2]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { c: [(x0 + x1) / 2, (y0 + y1) / 2] as Vec, zoom: Math.max(0.42, Math.min(1.25, 1680 / Math.max(1, x1 - x0), 900 / Math.max(1, y1 - y0))) };
  };
  // Captions and pills sit at the bottom of the frame: the camera keeps that
  // band free from the beat before they arrive (known before they compile).
  // (Explainer words beside a subject on the right sit left, not at the bottom.)
  const besideLeft = (i: number) => explainer && ["stage-right", "stage-left"].includes(beats.slice(0, i).reverse().find((x) => x.action === "scene")?.layout ?? "");
  const planned = beats.flatMap((b, i) =>
    b.action === "statement" && b.text_layout !== "display" && b.text_layout !== "panel" && !besideLeft(i) ? [{ start: starts[i], end: (starts[i + 1] ?? stageEnd) + 30, style: (b.text_layout === "pill" ? "pill" : "caption") as NonNullable<FlowText["style"]> }] : [],
  );
  const reserveAt = (t0: number, t1: number) => {
    const on = [...lines, ...planned].filter((l) => l.start - 30 < t1 && l.end > t0);
    return on.some((l) => l.style === "caption") ? 250 : on.some((l) => l.style === "pill") ? 210 : 0;
  };
  const shoot = (t: number, span: number, move: string, focus?: Live[]) => {
    focusedOn = null;
    // Explainer: the shot stages are laid out for the frame itself, so the
    // camera holds still (a subject placed right stays right; nothing drifts
    // up to make room).
    // It still breathes: each shot is one slow, continuous move (in, then out
    // on the next, drifting sideways) so the frame never stands still.
    if (explainer) {
      if (!move.startsWith("scene")) return;
      const next = beats.findIndex((x, k) => starts[k] > t && x.action === "scene");
      const len = (next >= 0 ? starts[next] : stageEnd) - t;
      // (The look's seed decides whether the first shot pushes in or out.)
      const k = (sceneIdx + (script.look?.seed ?? 0)) % 2 ? -1 : 1;
      // (The DNA orbit of a non-recipe shot is the same camera as the
      // recipe's orbit-intent, on the shot's subject.)
      const orbit = move === "scene:orbit" ? { camera: { intent: "orbit-intent", intensity: "medium" } as const } : null;
      if ((move === "scene:recipe" && sceneRecipe) || orbit) {
        // The recipe's camera intent, aimed at its hero (lib/scene-recipe.ts);
        // a focus behavior later in the scene pushes on to its object then.
        const hero = orbit ? focus?.[0] : live.get(sceneRecipe!.hero);
        const cam = recipeCamera(orbit ?? sceneRecipe!, hero?.pos ?? [0, 0]);
        const settle = Math.min(12, Math.max(1, len - 6));
        f.camera(t, sceneIdx === 0 ? 1 : settle, cam.from, cam.z0);
        const fk = beats.findIndex((x, j) => starts[j] > t && starts[j] < t + len && x.action === "focus" && x.style === "recipe");
        const ease = cam.from[0] === cam.to[0] && cam.z0 === cam.z1 ? "inOut" : "linear";
        if (fk >= 0) {
          const tf = starts[fk];
          const tp = known.get(beats[fk].targets?.[0] ?? "")?.pos ?? hero?.pos ?? [0, 0];
          f.camera(t + settle, Math.max(6, tf - t - settle), cam.to, cam.z1, ease);
          f.camera(tf, 22, [Math.max(-160, Math.min(160, tp[0] * 0.2)), Math.max(-120, Math.min(120, tp[1] * 0.2))], Math.min(1.34, cam.z1 + 0.1), "inOut");
        } else f.camera(t + settle, Math.max(6, len - settle), cam.to, cam.z1, ease);
        // orbit-intent: the hero turns in 3D through the shot while the camera arcs.
        if (cam.tilt && hero) {
          const t0 = Math.max(t + 24, ...(hero.h.spec.tilt ?? []).map(([x]) => x));
          hero.h.spec.tilt = [...(hero.h.spec.tilt ?? [[t, [0, 0, 0]]]), [t0, [4, cam.tilt[0], 0], "inOut"], [Math.max(t0 + 6, t + len), [4, cam.tilt[1], 0], "linear"]];
        }
        return;
      }
      // Phase 3: the Director's shot intent (a camera move) decides the move;
      // the code decides how far and how fast, inside the frame-safe range
      // the stages are laid out for (zoom 1.06–1.18, ±50 px). Without one
      // (older shots, "static") the shot alternates in and out as before.
      const intent = move.slice(6);
      const MOVES: Record<string, [Vec, number, Vec, number]> = {
        "push-in": [[0, 0], 1.06, [0, 0], 1.18],
        "pull-back": [[0, 0], 1.18, [0, 0], 1.06],
        "pan-right": [[-50, 0], 1.12, [50, 0], 1.12],
        "pan-left": [[50, 0], 1.12, [-50, 0], 1.12],
        rise: [[0, 40], 1.1, [0, -30], 1.1],
        drift: [[-20 * k, 0], 1.11, [20 * k, -6], 1.13],
        hold: [[0, 0], 1.12, [0, 0], 1.12],
      };
      const m = MOVES[intent];
      if (m) {
        // Settle into the move's start, then travel it for the whole shot.
        const settle = Math.min(12, Math.max(1, len - 6));
        f.camera(t, sceneIdx === 0 ? 1 : settle, m[0], m[1]);
        f.camera(t + settle, Math.max(6, len - settle), m[2], m[3], intent === "hold" ? "inOut" : "linear");
        return;
      }
      if (sceneIdx === 0) f.camera(t, 1, [-30 * k, 0], k > 0 ? 1.07 : 1.17);
      f.camera(t, Math.max(12, len), [30 * k, -10 * k], k > 0 ? 1.17 : 1.07, "linear");
      return;
    }
    // A running orbit counts as one element as big as its circle.
    const { c, zoom } = framedBox(focus ?? [...live.values(), ...ghosts.filter((g) => g.end > t).map((g) => g.live)]);
    const bottom = reserveAt(t, t + span);
    const z = zoom * (bottom ? 0.86 : 1);
    const cc: Vec = [c[0], c[1] + (bottom ? bottom / 2 / z : 0)];
    const settle = Math.min(22, Math.max(10, span - 4));
    const [a, b]: [Vec, Vec] = move === "pan-left" ? [[cc[0] + 140, cc[1]], [cc[0] - 140, cc[1]]] : move === "pan-right" ? [[cc[0] - 140, cc[1]], [cc[0] + 140, cc[1]]] : move === "rise" ? [[cc[0], cc[1] + 90], [cc[0], cc[1] - 60]] : [cc, cc];
    const [z0, z1] = move === "push-in" ? [z * 0.92, z * 1.1] : move === "pull-back" ? [z * 1.2, z * 0.98] : move === "static" || move === "hold" ? [z, z] : [z, z * 1.03];
    f.camera(t, settle, a, z0);
    if (span - settle > 6) f.camera(t + settle, span - settle, b, z1, "linear");
  };
  let sceneMove = "drift";
  const links = new Map<string, FlowLink>(); // "from>to" → its line
  const orbiting: { ids: string[]; start: number; end: number }[] = [];
  const rings: NonNullable<FlowPlan["rings"]> = []; // dashed orbit paths
  const ghosts: { live: Live; end: number }[] = []; // running orbits, for framing
  const backdrops: NonNullable<FlowPlan["backdrops"]> = [];
  // The world on screen: one entry open per slot (environment, atmosphere).
  const openSlot: Record<BackdropSlot, (typeof backdrops)[number] | null> = { environment: null, atmosphere: null };
  // choreo: how the world arrives (a recipe scene's background, Phase 4) —
  // one event drives both slots, each slot changing on its own: the new
  // entry enters with it, an entry whose slot goes empty exits with it.
  const setWorld = (w: Record<BackdropSlot, string | null>, t: number, source: "recipe" | "shot", choreo?: BgChoreo) => {
    for (const slot of ["environment", "atmosphere"] as const) {
      const k = w[slot];
      const cur = openSlot[slot];
      if ((cur?.kind ?? null) === k) continue;
      if (cur) cur.end = t;
      if (cur && choreo && !k) cur.exit = choreo;
      openSlot[slot] = k ? { kind: k, start: t, slot, source, ...(choreo ? { enter: choreo } : {}) } : null;
      if (k) backdrops.push(openSlot[slot]!);
    }
  };
  // A single named backdrop as a world (mesh: the plain canvas, no layer).
  const worldOf = (k: string): Record<BackdropSlot, string | null> => {
    const r = renderableBackdrop(k);
    return r === "mesh" ? { environment: null, atmosphere: null } : backdropSlot(r) === "environment" ? { environment: r, atmosphere: null } : { environment: null, atmosphere: r };
  };
  // The shots' own world (never a recipe scene's): a shot without a backdrop
  // keeps it, else the plain canvas.
  let shotWorld: string | null = null;
  let recipeSeen = false;
  const decorLevel: Track<number> = [[0, 1]]; // how much of the canvas decor shows (1 = all)
  let focusedOn: Live | null = null; // the camera is pushed in on this element
  const flashes: [number, number, number?][] = [];

  // ── text ──
  const nextLineStart = (i: number) => {
    const k = beats.findIndex((x, j) => j > i && (x.action === "statement" || x.action === "list"));
    return k === -1 ? null : starts[k];
  };
  const lastEnd = stageEnd < total ? stageEnd - 8 : total + 30;

  beats.forEach((b, i) => {
    const t = starts[i];
    const span = (starts[i + 1] ?? stageEnd) - t;
    const tgt = (b.targets ?? []).map((id) => live.get(id)).filter((x): x is Live => !!x);
    const to = b.to ? live.get(b.to) : undefined;
    let framed = true;
    switch (b.action) {
      case "scene": {
        sceneIdx++;
        sceneAt = t;
        sceneRecipe = b.recipe ?? null;
        carriedIn = (b.elements ?? []).some((e) => e.asset === null);
        const tr = b.transition ?? (sceneIdx === 0 ? "cut" : ["dissolve", "push-left", "zoom-through", "push-up", "morph"][sceneIdx % 5]);
        const carried = new Set((b.elements ?? []).filter((e) => e.asset === null).map((e) => e.id));
        const old = [...live.entries()].filter(([id]) => !carried.has(id));
        const focusEl = [...live.values()][0];
        let enterAt = t;
        let push: Vec | undefined;
        if (SCENE_STEP[tr]) {
          // (Explainer: a strip one frame wide, so the old shot is still
          // leaving as the new one comes in — never a blank frame mid-push.)
          const [sx, sy] = explainer ? [SCENE_STEP[tr][0] * 0.8, SCENE_STEP[tr][1] * 0.8] : SCENE_STEP[tr];
          const wordsWith = explainer && beats[i + 1] && paired.has(beats[i + 1]);
          push = [sx, sy];
          for (const [, n] of old) {
            // Old and new move together with the same timing, like one strip.
            animate(n.h.spec.pos, t, 22, [n.pos[0] - sx, n.pos[1] - sy], "inOut");
            // (Explainer words arriving with this shot: the old shot is gone
            // before they land, never under them.)
            animate(n.h.spec.opacity!, wordsWith ? t : t + 18, wordsWith ? 6 : 4, 0, "in");
          }
          enterAt = t;
        } else if (tr === "zoom-through") {
          for (const [, n] of old) leave(n, t, "through");
          enterAt = t + 10;
        } else if (tr === "panel-wipe") {
          f.panel(t, t + 14, focusEl ? focusEl.pos : center);
          for (const [, n] of old) animate(n.h.spec.opacity!, t + 12, 2, 0);
          enterAt = t + 16;
          f.sfx(t, "whoosh");
        } else if (tr === "cut") {
          for (const [, n] of old) animate(n.h.spec.opacity!, t, 1, 0);
        } else {
          for (const [, n] of old) leave(n, t, "fade");
          enterAt = t + 6;
        }
        for (const [id] of old) live.delete(id);
        layoutName = b.layout ?? "grid";
        // The scene's atmosphere (kept from the previous scene when not set).
        // Calm: the first scene's backdrop stays for the whole video.
        // (A recipe scene's environment is its own; one shared with the scene
        // before simply continues, so the world stays one place.)
        // (After recipe scenes, a shot that names its backdrop — the DNA's — keeps it.)
        // Recipe scene: its environment's world (lib/scene-recipe.ts ENV_WORLD).
        // A shot: its own backdrop (calm: only the first shot's names one,
        // unless recipe scenes came before) → the shots' current world → the
        // plain canvas. A recipe scene's world is never inherited by a shot.
        if (sceneRecipe) {
          setWorld(ENV_WORLD[sceneRecipe.environment], t, "recipe", sceneRecipe.background);
          recipeSeen = true;
        } else {
          const explicit = b.backdrop && (!calm || shotWorld === null || recipeSeen) ? b.backdrop : null;
          shotWorld = explicit ?? shotWorld ?? "mesh";
          setWorld(worldOf(shotWorld), t, "shot");
        }
        // One world at a time: in a recipe scene its environment is the world
        // and the canvas decor steps back to a quiet edge accent (the glow
        // decor, itself an atmosphere, goes); elsewhere the decor is full.
        const level = sceneRecipe ? (script.look?.decor === "glow" ? 0 : DECOR_ACCENT) : 1;
        if (num(decorLevel, t, 1) !== level) {
          decorLevel.push([t, num(decorLevel, t, 1)], [t + 24, level, "inOut"]);
        }
        // A flash / iris transition: a brand-colour circle sweeps the canvas as the scene arrives.
        if (sceneRecipe?.flash && explainer) flashes.push([t - 6, t + 40, 22]);
        sceneMove = b.camera ?? ["push-in", "drift", "pan-right", "pull-back", "rise"][sceneIdx % 5];
        // A "steps" scene: every step is there from the start, faint, so no
        // icon stands alone in an empty frame; the first is lit, the others
        // light up on their words (activate).
        const steps = b.style === "steps";
        layoutName = place(b.elements ?? [], enterAt, layoutName, steps ? "rise" : b.style, true, push);
        // Explainer: the product's reveal turns the whole canvas brand colour.
        if (explainer && (b.elements ?? []).some((e) => e.asset === "logo")) flashes.push([enterAt, starts[i + 1] ?? stageEnd]);
        if (steps)
          (b.elements ?? []).forEach((e, k) => {
            const n = live.get(e.id);
            if (!n) return;
            if (k === 0) n.h.spec.lit = [[0, 1]];
            else put(n.h.spec.opacity!, enterAt + 14 + k * stagger, 0.35, "inOut");
          });
        if (sceneIdx > 0) f.sfx(t, "whoosh");
        // A group popping in: one pop per element (five logos = five pops).
        if (b.style === "pop" && entered.length > 1) for (const at of entered) f.sfx(at, "soft_pop");
        // (An orbit turns the scene's biggest element, its subject.)
        const subject = b.camera === "orbit" ? (b.elements ?? []).map((e) => live.get(e.id)).filter((n): n is Live => !!n).sort((a, c) => c.w * c.h0 * c.fit - a.w * a.h0 * a.fit)[0] : undefined;
        shoot(t, span, explainer ? (sceneRecipe ? "scene:recipe" : `scene:${b.camera ?? "static"}`) : sceneMove, subject ? [subject] : undefined);
        framed = false;
        break;
      }
      case "place":
        // targets on a place: they make way (fade out) for the newcomers.
        for (const id of b.targets ?? []) {
          const n = live.get(id);
          if (!n || id === b.to) continue;
          leave(n, t, "fade");
          live.delete(id);
        }
        // A layout named here re-arranges the scene with the newcomers.
        layoutName = place(b.elements ?? [], t, b.layout ?? layoutName, b.style, true);
        // One pop per newcomer: five logos arriving are five pops.
        for (const at of entered) f.sfx(at, "soft_pop");
        // A next step: a dashed arrow from the previous one, and the light
        // (the brand fill) moves to the step being talked about.
        const prev = b.to ? live.get(b.to) : undefined;
        const next = prev && (b.elements ?? []).map((e) => live.get(e.id)).find(Boolean);
        if (prev && next) {
          const l = f.connect(prev.h, next.h, entered[0] ?? t, { dur: 14, dashed: true, bend: -40 });
          l.arrow = true;
          if (explainer) {
            animate((prev.h.spec.lit ??= [[0, 1]]), t, 10, 0, "inOut");
            next.h.spec.lit = [[0, 0], [(entered[0] ?? t) + 8, 0], [(entered[0] ?? t) + 18, 1, "inOut"]];
          }
        }
        break;
      case "lift": {
        // Cards rise out of the screen (small, from its surface) and travel to
        // their place in the re-laid-out scene; the screen glows as they leave.
        const [src] = tgt;
        if (!src) break;
        layoutName = place(b.elements ?? [], t, b.layout ?? layoutName, "rise", true);
        bump(src, t);
        (b.elements ?? []).forEach((e, k) => {
          const n = live.get(e.id);
          if (!n) return;
          const s = n.h.spec;
          const at = n.pos;
          const t0 = t + 4 + k * 6;
          s.appear = t0;
          s.pos = [[t0, [src.pos[0] + (k ? 40 : -40), src.pos[1]]], [t0 + 26, at, "inOut"]];
          s.scale = [[t0, n.fit * 0.35], [t0 + 26, n.fit, "out"]];
          s.opacity = [[t0, 0], [t0 + 6, 1, "out"]];
          s.tilt = [[t0, [0, -18, 0]], [t0 + 30, [0, 0, 0], "inOut"]];
          s.z = (src.h.spec.z ?? 0) + 20 + k;
          s.blur = [[0, 0]];
        });
        (b.elements ?? []).forEach((_, k) => f.sfx(t + 4 + k * 6, "soft_pop"));
        // framed stays true: the camera re-frames the screen with its new cards.
        break;
      }
      case "move": {
        if (b.style === "recipe") {
          // A recipe scene keeps its composition: the object travels to the
          // target's near side (on an arc) and the rest stay where they are.
          const [a] = tgt;
          if (!a || !to) break;
          const dir = Math.sign(a.pos[0] - to.pos[0]) || -1;
          const c = choreoOf(b, t);
          if (c) anticipate(a, c);
          travel(a, c?.actionAt ?? t, c?.action ?? 26, [to.pos[0] + dir * ((to.w * to.fit) / 2 + (a.w * a.fit) / 2 + 24), to.pos[1] + 30], "arc");
          if (c) land(a, c);
          cameraCue(c, to);
          if (!choreoSfx(c)) moveSfx(t);
          break;
        }
        // It takes the layout slot next to its destination; the others shift.
        // (Several targets gather there together, one after another.)
        const [a] = tgt;
        if (!a || !to) break;
        const movers = b.targets!.filter((id) => live.has(id) && id !== b.to);
        const ids = [...live.keys()].filter((id) => !movers.includes(id));
        ids.splice(ids.indexOf(b.to!) + 1, 0, ...movers);
        const chosen = slotsFor(layoutName, ids.map((id) => [live.get(id)!.w, live.get(id)!.h0] as Vec), sceneIdx);
        ids.forEach((id, k) => {
          const n = live.get(id)!;
          const s = chosen.slots[k];
          const at = worldSlot(s);
          const m = tgt.indexOf(n);
          if (m < 0 && Math.hypot(at[0] - n.pos[0], at[1] - n.pos[1]) < 4) return;
          n.fit = fitIn(n.w, n.h0, s);
          n.depth = s.depth;
          const t0 = m >= 0 ? t + m * 4 : t + 4;
          travel(n, t0, 22, at, m >= 0 ? (b.style ?? "arc") : "straight");
          animate(n.h.spec.scale!, t0, 22, n.fit, "inOut");
          if (n.h.spec.blur) animate(n.h.spec.blur, t, 16, DEPTH[s.depth].blur, "inOut");
        });
        moveSfx(t);
        break;
      }
      case "trigger": {
        const [a] = tgt;
        if (!a || !to) break;
        travel(a, t, 22, to.pos, b.style ?? "arc");
        moveSfx(t);
        {
          // It lands on the destination, which reacts (and updates).
          animate(a.h.spec.scale!, t + 12, 10, a.fit * 0.3, "in");
          animate(a.h.spec.opacity!, t + 16, 6, 0, "in");
          live.delete(b.targets![0]);
          bump(to, t + 22);
          if (b.content && to.h.spec.el?.type === "card") (to.h.spec.el.updates ??= []).push({ at: t + 22, content: toContent(b.content)! });
          f.sfx(t + 22, "success_chime");
        }
        break;
      }
      case "activate": {
        const [a] = tgt;
        if (!a) break;
        animate(a.h.spec.opacity!, t, 10, 1, "out");
        a.h.spec.lit = [[0, 0], [t + 2, 0], [t + 12, 1, "inOut"]];
        bump(a, t);
        if (to) {
          animate((to.h.spec.lit ??= [[0, 1]]), t, 10, 0, "inOut");
          f.connect(to.h, a.h, t, { dur: 12, dashed: true, bend: -40 }).arrow = true;
        }
        f.sfx(t, "soft_pop");
        break;
      }
      case "click": {
        const [a] = tgt;
        if (!a) break;
        // Aim at the button of a card that has one (bottom), else a little
        // right of and below the centre.
        const tpl = a.h.spec.el?.type === "card" ? a.h.spec.el.template : "";
        const aim: Vec = BUTTON_CARDS.has(tpl) ? [a.pos[0] + a.w * a.fit * 0.1, a.pos[1] + a.h0 * a.fit * 0.36] : [a.pos[0] + a.w * a.fit * 0.16, a.pos[1] + a.h0 * a.fit * 0.14];
        clicks.push({ t, aim });
        // The element presses in and springs back; its new state shows.
        const sc = a.h.spec.scale!;
        animate(sc, t + 4, 4, a.fit * 0.95, "out");
        put(sc, t + 14, a.fit, "back");
        if (b.content && a.h.spec.el?.type === "card") (a.h.spec.el.updates ??= []).push({ at: t + 8, content: toContent(b.content)! });
        f.sfx(t + 4, "click");
        framed = false;
        break;
      }
      case "update": {
        const [a] = tgt;
        if (!a || !b.content) break;
        if (a.h.spec.el?.type === "card" || a.h.spec.el?.type === "text") (a.h.spec.el.updates ??= []).push({ at: t + 2, content: toContent(b.content)! });
        bump(a, t + 2);
        f.sfx(t + 2, "reveal");
        framed = false;
        break;
      }
      case "connect": {
        const [a] = tgt;
        if (!a || !to) break;
        links.set(`${b.targets![0]}>${b.to}`, f.connect(a.h, to.h, t + 2, { dur: 16, packet: "sparkles", packetDur: 20, bend: 60 }));
        moveSfx(t + 8);
        framed = false;
        break;
      }
      case "disconnect": {
        const link = links.get(`${b.targets![0]}>${b.to}`) ?? links.get(`${b.to}>${b.targets![0]}`);
        if (link) link.fade = [t + 2, t + 14];
        const [a] = tgt;
        // The two ends drift apart a little.
        if (a && to) {
          const [dx, dy] = [a.pos[0] - to.pos[0], a.pos[1] - to.pos[1]];
          const d = Math.hypot(dx, dy) || 1;
          travel(a, t + 2, 16, [a.pos[0] + (dx / d) * 60, a.pos[1] + (dy / d) * 60], "straight");
        }
        f.sfx(t + 2, "subtle_impact");
        framed = false;
        break;
      }
      case "trace": {
        // A line draws through the targets in order, a packet running ahead.
        tgt.slice(1).forEach((n, k) => {
          const from = tgt[k];
          links.set(`${b.targets![k]}>${b.targets![k + 1]}`, f.connect(from.h, n.h, t + 2 + k * 8, { dur: 12, packet: "sparkles", packetDur: 14, bend: k % 2 ? -40 : 40 }));
          bump(n, t + 12 + k * 8);
        });
        moveSfx(t + 2);
        break;
      }
      case "flow": {
        // A stream of packets: over the existing line, or a new one.
        const [a] = tgt;
        if (!a || !to) break;
        const key = `${b.targets![0]}>${b.to}`;
        const link = links.get(key) ?? f.connect(a.h, to.h, t, { dur: 12, bend: 50 });
        links.set(key, link);
        link.fade = undefined;
        const icon = "sparkles";
        for (let k = 0; k < 3; k++) (link.packets ??= []).push({ icon, start: t + 8 + k * 9, end: t + 26 + k * 9 });
        bump(to, t + 44);
        moveSfx(t + 8);
        framed = false;
        break;
      }
      case "orbit": {
        // The targets shrink and circle the centre until the next rearrangement.
        if (!to || !tgt.length || tgt.some((n) => n.h.spec.orbit) || to.h.spec.orbit) break; // one orbit at a time
        const j = beats.findIndex((x, k) => k > i && ["scene", "arrange", "merge", "place", "move", "expand", "trigger"].includes(x.action));
        // Into a new scene the satellites keep circling while it takes over.
        const end = j === -1 ? stageEnd : beats[j].action === "scene" ? starts[j] + 40 : starts[j];
        const sat = Math.max(...tgt.map((n) => Math.max(n.w, n.h0) * n.fit * 0.62));
        const r = (Math.max(to.w, to.h0) * to.fit) / 2 + sat / 2 + 40;
        tgt.forEach((n, k) => {
          const a0 = (Math.atan2(n.pos[1] - to.pos[1], n.pos[0] - to.pos[0]) * 180) / Math.PI;
          n.h.spec.orbit = { center: to.h.id, radius: [[t, r]], angle: tgt.length > 1 ? -90 + (360 * k) / tgt.length : a0, speed: 1.4, start: t + 2, end: Math.max(t + 30, end - 14) };
          animate(n.h.spec.scale!, t, 14, n.fit * 0.62, "inOut");
          put(n.h.spec.scale!, Math.max(t + 30, end - 14), n.fit * 0.62);
          put(n.h.spec.scale!, Math.max(t + 44, end), n.fit, "inOut");
        });
        rings.push({ center: to.h.id, radius: r, start: t, end });
        orbiting.push({ ids: [to.h.id, ...tgt.map((n) => n.h.id)], start: t, end });
        // Everything else recedes while the orbit runs.
        for (const n of live.values()) if (n !== to && !tgt.includes(n)) {
          setBlur(n, t, 7, 14);
          animate(n.h.spec.opacity!, t, 14, 0.5);
          setBlur(n, Math.max(t + 30, end - 14), DEPTH[n.depth].blur, 14);
          animate(n.h.spec.opacity!, Math.max(t + 30, end - 14), 14, 1);
        }
        const ghost: Live = { h: to.h, w: (2 * r + sat) / to.fit, h0: (2 * r + sat) / to.fit, fit: to.fit, pos: to.pos, depth: 1 };
        ghosts.push({ live: ghost, end });
        shoot(t, span, "drift");
        moveSfx(t + 2);
        framed = false;
        break;
      }
      case "expand": {
        // A detail view: the element comes forward to fill the frame.
        const [a] = tgt;
        if (!a) break;
        for (const n of live.values()) if (n.home && n !== a) {
          travel(n, t, 16, n.home.pos, "straight");
          animate(n.h.spec.scale!, t, 16, n.home.fit, "inOut");
          n.fit = n.home.fit;
          n.h.spec.z = n.home.z;
          n.home = undefined;
        }
        a.home = { pos: a.pos, fit: a.fit, z: a.h.spec.z ?? 0 };
        const { c, zoom } = framedBox([...live.values()]);
        const big = Math.min(1500 / a.w, 820 / a.h0) / zoom;
        a.h.spec.z = 99;
        travel(a, t, 20, c, "straight");
        animate(a.h.spec.scale!, t, 20, big, "inOut");
        a.fit = big;
        for (const n of live.values()) if (n !== a) {
          animate(n.h.spec.opacity!, t, 14, 0.18);
          setBlur(n, t, 8, 14);
        }
        // The camera settles on the detail view (wherever it was looking).
        shoot(t, span, "static", [a]);
        moveSfx(t);
        framed = false;
        break;
      }
      case "collapse": {
        const [a] = tgt;
        if (!a?.home) break;
        travel(a, t, 20, a.home.pos, "straight");
        animate(a.h.spec.scale!, t, 20, a.home.fit, "inOut");
        a.fit = a.home.fit;
        const z = a.home.z;
        a.home = undefined;
        put(a.h.spec.opacity!, t, 1);
        a.h.spec.z = z;
        for (const n of live.values()) if (n !== a) {
          animate(n.h.spec.opacity!, t + 4, 14, 1);
          setBlur(n, t + 4, DEPTH[n.depth].blur, 14);
        }
        f.sfx(t, "soft_pop");
        break;
      }
      case "merge": {
        if (!to) break;
        if (b.style === "assemble") {
          // Recipe assemble: the pieces dock around the target's edge, hold
          // there as one shape for a moment, then fuse into it (it grows).
          const pieces = tgt.filter((n) => n !== to);
          const r = (to.w * to.fit) / 2 + 30;
          // (choreographed: the same beats on the event's action length)
          const c = choreoOf(b, t);
          const T = c?.actionAt ?? t;
          const sc = (x: number) => (c ? Math.max(1, Math.round((x * c.action) / 40)) : x);
          if (c) for (const n of pieces) anticipate(n, c);
          pieces.forEach((n, k) => {
            const a = -Math.PI / 2 + (k * 2 * Math.PI) / Math.max(1, pieces.length) + (pieces.length === 2 ? Math.PI / 2 : 0);
            const dock: Vec = [to.pos[0] + Math.cos(a) * r, to.pos[1] + Math.sin(a) * r * 0.8];
            const t0 = T + sc(k * 4);
            travel(n, t0, sc(18), dock, "arc");
            animate(n.h.spec.scale!, t0, sc(18), n.fit * 0.55, "inOut");
            travel(n, T + sc(30), sc(10), to.pos, "straight");
            animate(n.h.spec.scale!, T + sc(30), sc(10), n.fit * 0.15, "in");
            animate(n.h.spec.opacity!, T + sc(34), sc(6), 0, "in");
          });
          for (const id of b.targets ?? []) if (id !== b.to) live.delete(id);
          to.fit *= 1.12;
          if (c) land(to, c);
          else {
            animate(to.h.spec.scale!, t + 40, 8, to.fit * 1.07, "out");
            put(to.h.spec.scale!, t + 56, to.fit, "inOut");
          }
          cameraCue(c, to);
          if (!choreoSfx(c)) {
            moveSfx(t);
            f.sfx(t + 22, "soft_pop");
            f.sfx(t + 40, "subtle_impact");
          }
          break;
        }
        if (b.style === "transform") {
          // Recipe transform: the source flies to the target's place, takes its
          // size, turns edge-on (3D) and the target turns in from the edge in
          // its stead — the source becomes the target's shape and state.
          const [src] = tgt.filter((n) => n !== to);
          if (!src) break;
          // (Tilt keys from t on are replaced, so the track stays in time order.)
          const tiltFrom = (n: Live, at: number): Vec3 => {
            const tr = n.h.spec.tilt;
            const v: Vec3 = tr?.length ? [0, 1, 2].map((i) => num(tr.map(([f, x, e]) => [f, x[i], e] as [number, number, Ease?]), at, 0)) as Vec3 : [0, 0, 0];
            n.h.spec.tilt = [...(tr ?? []).filter(([f]) => f < at), [at, v]];
            return v;
          };
          // (choreographed: the flight takes the action's length; the turn
          // itself — out edge-on, hand over, in from the edge — keeps its own
          // 16 frames, so the action is at least 22 frames: compressed, the
          // source vanished barely turned and a blank frame came before the
          // target, a hard cut)
          const c0 = choreoOf(b, t);
          const c = c0 && b.choreo ? choreoTimeline({ ...b.choreo, action: Math.max(c0.action, 22) }, t) : null;
          const T = c?.actionAt ?? t;
          const fly = c ? c.action - 16 : 16;
          const sc = (x: number) => (x <= 16 ? Math.round((x * fly) / 16) : fly + x - 16);
          if (c) anticipate(src, c);
          travel(src, T, sc(16), to.pos, "arc");
          animate(src.h.spec.scale!, T, sc(16), (to.w * to.fit) / src.w, "inOut");
          animate(to.h.spec.opacity!, T, sc(10), 0, "inOut");
          const s0 = tiltFrom(src, T + sc(16));
          src.h.spec.tilt!.push([T + sc(24), [s0[0], 90, s0[2]], "in"]);
          animate(src.h.spec.opacity!, T + sc(22), 2, 0);
          src.h.spec.z = (to.h.spec.z ?? 0) + 1;
          const d0 = tiltFrom(to, T);
          to.h.spec.tilt!.push([T + sc(22), d0], [T + sc(23), [d0[0], -90, d0[2]]], [T + sc(32), d0, "out"]);
          put(to.h.spec.opacity!, T + sc(23), 0);
          put(to.h.spec.opacity!, T + sc(24), 1);
          if (c) land(to, c);
          else bump(to, t + 32);
          for (const id of b.targets ?? []) if (id !== b.to) live.delete(id);
          cameraCue(c, to);
          if (!choreoSfx(c)) {
            moveSfx(t);
            f.sfx(t + 24, "soft_pop");
          }
          break;
        }
        const c = choreoOf(b, t);
        const T = c?.actionAt ?? t;
        const dur = c?.action ?? 20;
        tgt.filter((n) => n !== to).forEach((n, k) => {
          if (c) anticipate(n, c);
          travel(n, T + k * 3, dur, to.pos, "arc");
          animate(n.h.spec.scale!, T + k * 3 + Math.round(dur * 0.4), dur - Math.round(dur * 0.4), n.fit * 0.2, "in");
          animate(n.h.spec.opacity!, T + k * 3 + Math.round(dur * 0.7), 6, 0, "in");
        });
        for (const id of b.targets ?? []) if (id !== b.to) live.delete(id);
        to.fit *= 1.1;
        if (c) land(to, c);
        else bump(to, t + 22);
        cameraCue(c, to);
        if (!choreoSfx(c)) {
          moveSfx(t);
          f.sfx(t + 22, "subtle_impact");
        }
        break;
      }
      case "arrange": {
        if (b.style === "recipe" && sceneRecipe) {
          // Recipe arrange: the scene keeps its composition; its supporting
          // objects line up evenly (a row, or a column beside a side hero)
          // around where they stood. The hero does not move.
          const rec = sceneRecipe;
          const items = [...live.entries()].filter(([id]) => rec.roles[id]?.role === "support").map(([, n]) => n);
          if (items.length < 2) break;
          const cx = items.reduce((a, n) => a + n.pos[0], 0) / items.length;
          const cy = items.reduce((a, n) => a + n.pos[1], 0) / items.length;
          const column = Math.abs(cx) > 480;
          const gap = Math.max(...items.map((n) => (column ? n.h0 : n.w) * n.fit)) + 40;
          const span = gap * (items.length - 1);
          const ordered = [...items].sort((a, c) => (column ? a.pos[1] - c.pos[1] : a.pos[0] - c.pos[0]));
          const clampX = (x: number) => Math.max(-820 + span / 2, Math.min(820 - span / 2, x));
          const clampY = (y: number) => Math.max(-430 + span / 2, Math.min(430 - span / 2, y));
          const [ox, oy] = column ? [Math.max(-820, Math.min(820, cx)), clampY(cy)] : [clampX(cx), Math.max(-430, Math.min(430, cy))];
          ordered.forEach((n, k) => {
            const d = -span / 2 + k * gap;
            travel(n, t + k * 3, 24, column ? [ox, oy + d] : [ox + d, oy], "straight");
          });
          moveSfx(t);
          f.sfx(t + 24, "soft_pop");
          break;
        }
        const ids = [...live.keys()];
        const chosen = slotsFor(b.layout ?? layoutName, ids.map((id) => [live.get(id)!.w, live.get(id)!.h0] as Vec), sceneIdx + 3);
        const slots = chosen.slots;
        layoutName = chosen.name;
        openOverlap(layoutName, t, ids.map((id) => live.get(id)!.h.id));
        ids.forEach((id, k) => {
          const n = live.get(id)!;
          const s = slots[k];
          n.fit = fitIn(n.w, n.h0, s);
          n.depth = s.depth;
          travel(n, t + k * 3, 24, worldSlot(s), "straight");
          animate(n.h.spec.scale!, t + k * 3, 24, n.fit, "inOut");
          if (n.h.spec.rot) animate(n.h.spec.rot, t + k * 3, 24, s.rot, "inOut");
          n.h.spec.blur ??= [[0, 0]];
          animate(n.h.spec.blur, t + k * 3, 20, DEPTH[s.depth].blur, "inOut");
        });
        moveSfx(t);
        f.sfx(t + 24, "soft_pop");
        break;
      }
      case "erase": {
        tgt.forEach((n, k) => leave(n, t + k * 4, b.style ?? "wipe"));
        for (const id of b.targets ?? []) live.delete(id);
        moveSfx(t);
        // The next beat reframes (swinging onto what is left reads as a
        // jolt) — unless the camera was pushed in on what just went away.
        framed = !!focusedOn && tgt.includes(focusedOn) && live.size > 0;
        break;
      }
      case "highlight": {
        const [a] = tgt;
        if (!a) break;
        const c = choreoOf(b, t);
        if (c) {
          anticipate(a, c);
          land(a, c);
        } else bump(a, t + 2);
        for (const n of live.values()) {
          if (n === a) continue;
          animate(n.h.spec.opacity!, c?.actionAt ?? t, c?.action ?? 8, 0.35);
          put(n.h.spec.opacity!, c ? Math.max(c.end, c.actionAt + 26) : t + 34, 1, "inOut");
        }
        cameraCue(c, a);
        if (!choreoSfx(c)) f.sfx(t + 2, "soft_pop");
        // Pushed in on another element: pull back so the highlighted one is seen.
        framed = !!focusedOn && focusedOn !== a;
        break;
      }
      case "focus": {
        const [a] = tgt;
        if (!a) break;
        for (const n of live.values()) if (n !== a) setBlur(n, t, 8, 14);
        if (b.style === "recipe") {
          // (The camera push is keyed with the scene's camera, see shoot.)
          bump(a, t + 2);
          framed = false;
          break;
        }
        const region = b.style ? DETAIL[b.style] : undefined;
        if (region) {
          // Zoom into one part of the element (a button, a chart, a field) so it reads.
          const [w, h] = [a.w * a.fit, a.h0 * a.fit];
          const c: Vec = [a.pos[0] + region[0] * w, a.pos[1] + region[1] * h];
          const z = Math.min(2.4, 1680 / (w * 0.55), 900 / (h * 0.55));
          f.camera(t, Math.min(24, span), c, z * 0.94);
          if (span > 30) f.camera(t + 24, span - 24, c, z, "linear");
          focusedOn = null;
        } else {
          shoot(t, span, "push-in", [a]);
          focusedOn = a;
        }
        framed = false;
        break;
      }
      case "reveal": {
        for (const n of live.values()) if (n.h.spec.blur) animate(n.h.spec.blur, t, 14, DEPTH[n.depth].blur, "inOut");
        const { c, zoom } = framedBox([...live.values()]);
        f.camera(t, Math.min(30, span), c, zoom * 0.86);
        framed = false;
        break;
      }
      case "celebrate": {
        const [a] = tgt;
        f.lottie(b.lottie ?? "confetti-burst", t + 2, 520, { node: a?.h, pos: a ? undefined : center });
        f.sfx(t + 2, "success_chime");
        framed = false;
        break;
      }
      case "statement":
      case "list": {
        const nl = nextLineStart(i);
        const lastLine = nl === null;
        const hardEnd = lastLine ? lastEnd : nl! - 4;
        const nextStart = starts[i + 1] ?? stageEnd;
        if (b.action === "list") {
          const at: number[] = [];
          let from = (t + LEAD) / FPS - 0.2;
          for (const item of b.items ?? []) {
            const w0 = wordFrames(item, from, timeline)[0];
            at.push(Math.min(Math.max(at.length ? at[at.length - 1] + 18 : t + 2, w0), stageEnd - 34));
            from = at[at.length - 1] / FPS;
          }
          const end = lastLine ? lastEnd : Math.min(hardEnd, Math.max(at[at.length - 1] + 40, nextStart - 10));
          lines.push({ start: at[0], end, style: "display" });
          f.list(b.items ?? [], at, end);
          f.dimTo(at[0] - 8, 12, 1).dimTo(Math.min(end, total) + 8, 12, 0);
          framed = false;
          break;
        }
        const text = b.text ?? "";
        // (Explainer: a caption cued on its shot's last word says words spoken
        // earlier in the shot — "four finished videos" on "videos" — so its
        // words are looked for from the shot's start, not after the cue.)
        const lookFrom = paired.has(b) ? t - 6 : explainer ? Math.min(t, Math.max(sceneAt, t - 120)) : t;
        const wf = wordFrames(text, (lookFrom + LEAD) / FPS - 0.2, timeline).map((w) => Math.min(w, stageEnd - (stageEnd < total ? 24 : 8)));
        // The line (and the dim behind a display line) arrives with its first word.
        // (Words sharing their shot's cue never arrive before the shot does:
        // the last shot's icons are still clearing then.)
        // (A recipe scene's words wait for an object carried in from the last scene to land.)
        const settled = sceneRecipe && b.text_layout === "side" && carriedIn ? sceneAt + 26 : 0;
        const start = Math.max(Math.min(wf[0], Math.max(t + 2, wf[0] - 8)), explainer && paired.has(b) ? t + 6 : 0, settled);
        let style: NonNullable<FlowText["style"]> = b.text_layout === "panel" ? "panel" : b.text_layout === "display" ? "display" : b.text_layout === "pill" ? "pill" : live.size ? "caption" : "display";
        if (b.text_layout === "side") style = live.size ? "caption" : "display";
        // Explainer: beside a subject on the right, the words sit big on the left.
        const besideRight = explainer && b.text_layout === "side" && live.size > 0 && ["stage-right", "stage-left"].includes(layoutFamily(layoutName));
        const mirrored = besideRight && layoutFamily(layoutName) === "stage-left";
        if (besideRight) style = "side";
        // A recipe scene places its words (lib/scene-recipe.ts recipeText).
        const rt = sceneRecipe && b.text_layout === "side" ? recipeText(sceneRecipe) : null;
        if (rt) style = rt.style;
        const cover = style === "display" || style === "panel";
        const end0 = lastLine ? lastEnd : Math.min(hardEnd, cover ? Math.max(wf[wf.length - 1] + 36, nextStart - 10) : Math.max(wf[wf.length - 1] + 36, nextStart + 20));
        // Explainer: a line is gone before the next shot arrives (never over its card).
        // (the words' 12-frame exit is over before the next shot comes in)
        // And never past the next shot, whatever the word times say.
        const nextScene = beats.findIndex((x, k) => k > i && x.action === "scene");
        const end = explainer && !lastLine ? Math.min(Math.max(wf[wf.length - 1] + 6, Math.min(end0, nextStart - 10)), nextScene >= 0 ? starts[nextScene] - 4 : Infinity) : end0;
        lines.push({ start, end, style });
        if (style === "panel") {
          const first = [...live.values()][0];
          f.panel(t, end, first ? first.pos : center);
          f.sfx(t, "whoosh");
        }
        const pos: Vec = rt ? rt.pos : mirrored ? [760, -10] : besideRight ? [-760, -10] : style === "caption" ? [0, 350] : style === "pill" ? [0, 370] : [0, 0];
        const mark = b.style === "pill" || b.style === "strike" ? b.style : undefined;
        // The mark lands just after the (last, or for a strike the first) accent word is spoken.
        const ws = text.split(/\s+/);
        const acc = new Set((b.accent ?? "").toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean));
        const isAcc = (w: string) => acc.has(w.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const j = mark === "strike" ? ws.findIndex(isAcc) : ws.reduce((k, w, x) => (isAcc(w) ? x : k), -1);
        // Explainer: a line never waits word by word on a slow voice (no lone
        // "Your" on screen); it settles in whole, 0.1 s per word.
        const shown = explainer ? wf.map((_, i) => Math.max(wf[0], start) + i * 3) : wf;
        // A word swap: the accent word flips to the new one as the voice says it.
        const swapWord = b.action === "statement" && b.items?.[0] && b.accent ? b.items[0] : null;
        const swapAt = swapWord ? wordFrames(swapWord, (start + LEAD) / FPS, timeline)[0] : null;
        const swap = swapWord && swapAt !== null && swapAt !== undefined && swapAt > start && swapAt < end ? { at: swapAt, word: swapWord } : undefined;
        const size = rt ? Math.min(fitSize(text, style, b.accent ?? undefined), rt.size) : explainer ? Math.min(fitSize(text, style, b.accent ?? undefined), EXPLAINER_TYPE[style]) : fitSize(text, style, b.accent ?? undefined);
        f.text(text, start, end, { swap, style, pos, size, accent: b.accent ?? undefined, words: shown, mark: b.accent ? mark : undefined, markAt: explainer && j >= 0 ? wf[j] : undefined, ...((rt ? rt.align === "right" : mirrored) && { align: "right" as const }) });
        if (mark && b.accent && j >= 0) f.sfx((wf[j] ?? start) + MARK_DELAY, mark === "strike" ? "click" : "soft_pop");
        if (style === "display" && explainer) {
          // Explainer: a big line owns the frame; the scene before it leaves
          // (nothing faded and ghostly behind the words).
          for (const [id, n] of live) {
            leave(n, start - 12, "fade");
            live.delete(id);
          }
          f.sfx(wf[0], "subtle_impact");
        } else if (style === "display") {
          f.dimTo(start - 4, 12, 1).dimTo(Math.min(end, total) + 8, 12, 0);
          f.sfx(wf[0], "subtle_impact");
        }
        else if (style === "pill") f.sfx(start, "soft_pop");
        if (!cover) shoot(t, span, "drift");
        framed = false;
        break;
      }
    }
    // A backdrop named on any later beat changes the atmosphere from there.
    if (!calm && b.action !== "scene" && b.backdrop && !sceneRecipe) {
      shotWorld = b.backdrop;
      setWorld(worldOf(b.backdrop), t, "shot");
    }
    // Before a caption arrives the camera already makes room for it.
    if (framed || (b.action !== "scene" && b.action !== "statement" && planned.some((l) => l.start > t && l.start <= t + 45))) shoot(t, span, b.action === "scene" ? sceneMove : "drift");
  });

  // Brand lockup.
  if (stageEnd < total && brand) {
    f.brand({ start: stageEnd, name: brand.name.trim(), logo: brand.logo ?? undefined, icon: "sparkles", cta: ctaLine(brand.cta) });
    f.sfx(stageEnd, "reveal");
  }
  const plan = f.build();
  // Every video gets its own base world (from its words, so it is stable).
  if (calm) plan.calm = true;
  if (explainer) plan.explainer = true;
  if (flashes.length) plan.flashes = flashes;
  plan.seed = script.look?.seed ?? [...narration].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1_000_003, 7);
  if (explainer && script.look) [plan.decor, plan.tone, plan.iconStyle] = [script.look.decor, script.look.tone ?? undefined, script.look.icons ?? undefined];
  // The cursor: glides in before each click (from off to the lower right when
  // it was hidden), clicks, and leaves when no click follows soon.
  if (clicks.length) {
    const path: Track<Vec> = [];
    const show: Track<number> = [[0, 0]];
    let prevEnd = -Infinity;
    let from: Vec = [0, 0];
    clicks.forEach(({ t, aim }, i) => {
      if (t - 16 > prevEnd) {
        from = [aim[0] + 320, aim[1] + 240];
        path.push([t - 18, from]);
        show.push([t - 18, 0], [t - 8, 1, "out"]);
      }
      // A hand's move: it glides a touch past the button, then settles on it.
      const [dx, dy] = [aim[0] - from[0], aim[1] - from[1]];
      const len = Math.hypot(dx, dy) || 1;
      path.push([t - 3, [aim[0] + (dx / len) * 16, aim[1] + (dy / len) * 16], "out"]);
      path.push([t + 3, aim, "inOut"]);
      from = aim;
      const next = clicks[i + 1];
      prevEnd = t + 36;
      if (!next || next.t - 16 > prevEnd) show.push([t + 30, 1], [t + 40, 0, "in"]);
    });
    plan.cursor = { path, show, clicks: clicks.map((c) => c.t + 4) };
  }
  if (brand?.color) plan.brandColor = brand.color;
  if (overlaps.length || orbiting.length) plan.overlaps = [...overlaps, ...orbiting];
  if (rings.length) plan.rings = [...(plan.rings ?? []), ...rings];
  if (backdrops.length) plan.backdrops = backdrops;
  if (relations.length) plan.relations = relations;
  if (decorLevel.length > 1) plan.decorLevel = decorLevel;
  // Elements that never appeared (skipped beats) are dropped.
  plan.nodes = plan.nodes.filter((n: FlowNode) => n.kind !== "el" || n.appear !== undefined);
  applyCameraResponses(plan, cameraCues);
  const out = smoothCamera(plan);
  if (skipped.length) out.skipped = skipped;
  // Explainer: the rules are enforced on the finished plan, not only reported.
  if (explainer) resolvePlan(out);
  return out;
}
