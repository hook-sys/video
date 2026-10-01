import { estimateWords } from "@/lib/flow-script";
import { parseAsset, type SceneBeat, type SceneContent, type SceneElement, type SceneScript } from "@/lib/scene-script";
import { spokenCueTimes, type WordTiming } from "@/lib/voice-timing";
import { cardSize } from "./cards/card";
import { deviceSize } from "./cards/device-data";
import { CARD_BY_ID } from "./cards/templates";
import type { CardContent } from "./cards/types";
import { resolvePlan } from "./resolve";
import { brandStartFrame, type CompileBrand, ctaLine, smoothCamera, wordFrames } from "./compile";
import { num, vec } from "./eval";
import { DEPTH, layoutFamily, layoutSlots, OVERLAPPING_FAMILIES, type Slot } from "./layouts";
import { animate as animateAfter, Flow, type FlowNodeHandle, put as putAfter } from "./patterns";
import { MARK_DELAY, type Ease, type FlowElement, type FlowLink, type FlowNode, type FlowPlan, type FlowText, type ThemeName, type Track, type Vec } from "./types";
import { EXPLAINER_TYPE, fitSize } from "./typography";

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
  const stageEnd = brand?.name?.trim() || brand?.logo ? brandStartFrame(total, timeline) : total;
  // Explainer pace (the default): soft entrances, one backdrop, sound only where
  // something visibly lands.
  const calm = script.pace !== "lively";
  const explainer = script.style === "explainer";
  const stagger = calm ? 6 : 4; // ≥ 0.2 s apart, so each pop is heard

  // ── schedule ──
  // Explainer: a line set beside a shot's subject shares the shot's cue (the
  // words are spoken as it appears); it arrives a moment after the subject.
  const paired = new Set<SceneBeat>(explainer ? script.beats.filter((b, i) => b.action === "statement" && script.beats[i - 1]?.action === "scene" && script.beats[i - 1].cue === b.cue) : []);
  const times = spokenCueTimes(script.beats.map((b) => (paired.has(b) ? "" : b.cue)), timeline);
  const beats: SceneBeat[] = [];
  const starts: number[] = [];
  let last = -MIN_GAP;
  script.beats.forEach((b, i) => {
    if (paired.has(b) && beats[beats.length - 1] === script.beats[i - 1]) {
      beats.push(b);
      starts.push(starts[starts.length - 1] + 6);
      last = starts[starts.length - 1];
      return;
    }
    const cue = times[i] === null ? last + MIN_GAP : Math.round(times[i]! * FPS) - LEAD;
    const prev = beats[beats.length - 1];
    const earliest = prev ? starts[starts.length - 1] + MIN_FRAMES[prev.action] : 0;
    const t = Math.min(stageEnd - 24, Math.max(0, cue, earliest));
    if (MINOR.has(b.action) && t - cue > 20) return;
    if (prev && t - starts[starts.length - 1] < MIN_GAP) return;
    beats.push(b);
    starts.push(t);
    last = t;
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
    const { slots, name } = slotsFor(layout, sizes, sceneIdx);
    const nodeIds: string[] = [];
    kept.forEach((id, i) => {
      const s = slots[i];
      const at = worldSlot(s);
      const existing = existingOf(id);
      if (existing) {
        existing.fit = fitIn(existing.w, existing.h0, s);
        existing.depth = s.depth;
        existing.h.spec.z = s.depth * 10 + i;
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
      const h = f.el(nodeId, at, { ...spec, z: s.depth * 10 + i });
      const n: Live = { h, w: spec.w, h0: spec.h, fit: fitIn(spec.w, spec.h, s), pos: at, depth: s.depth };
      // A device or screenshot as the scene's hero enters tilted, then settles.
      const heroScreen = (i === 0 || s.depth === 2) && (spec.el.type === "device" || spec.el.type === "shot");
      const enterStyle = style ?? (heroScreen ? "tilt" : calm ? ["rise", "pop", "scale-up", "blur"][(sceneIdx + i) % 4] : ["rise", "pop", "slide-left", "blur", "drop", "scale-up", "flip"][(sceneIdx + i) % 7]);
      enter(n, push ? t : t + i * stagger, enterStyle, s.rot, push);
      entered.push(push ? t : t + i * stagger);
      live.set(id, n);
      known.set(id, n);
      nodeIds.push(nodeId);
    });
    openOverlap(name, t, nodeIds);
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
      if (move !== "scene") return;
      const next = beats.findIndex((x, k) => starts[k] > t && x.action === "scene");
      const len = (next >= 0 ? starts[next] : stageEnd) - t;
      // (The look's seed decides whether the first shot pushes in or out.)
      const k = (sceneIdx + (script.look?.seed ?? 0)) % 2 ? -1 : 1;
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
    const [z0, z1] = move === "push-in" ? [z * 0.92, z * 1.1] : move === "pull-back" ? [z * 1.2, z * 0.98] : move === "static" ? [z, z] : [z, z * 1.03];
    f.camera(t, settle, a, z0);
    if (span - settle > 6) f.camera(t + settle, span - settle, b, z1, "linear");
  };
  let sceneMove = "drift";
  const links = new Map<string, FlowLink>(); // "from>to" → its line
  const orbiting: { ids: string[]; start: number; end: number }[] = [];
  const rings: NonNullable<FlowPlan["rings"]> = []; // dashed orbit paths
  const ghosts: { live: Live; end: number }[] = []; // running orbits, for framing
  const backdrops: { kind: string; start: number }[] = [];
  let focusedOn: Live | null = null; // the camera is pushed in on this element
  const flashes: [number, number][] = [];

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
        const kind = calm && backdrops.length ? backdrops[0].kind : b.backdrop ?? (sceneIdx === 0 ? "mesh" : backdrops[backdrops.length - 1]?.kind ?? "mesh");
        if (backdrops[backdrops.length - 1]?.kind !== kind) backdrops.push({ kind, start: t });
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
        shoot(t, span, explainer ? "scene" : sceneMove);
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
        // It takes the layout slot next to its destination; the others shift.
        const [a] = tgt;
        if (!a || !to) break;
        const ids = [...live.keys()].filter((id) => id !== b.targets![0]);
        ids.splice(ids.indexOf(b.to!) + 1, 0, b.targets![0]);
        const chosen = slotsFor(layoutName, ids.map((id) => [live.get(id)!.w, live.get(id)!.h0] as Vec), sceneIdx);
        ids.forEach((id, k) => {
          const n = live.get(id)!;
          const s = chosen.slots[k];
          const at = worldSlot(s);
          if (n !== a && Math.hypot(at[0] - n.pos[0], at[1] - n.pos[1]) < 4) return;
          n.fit = fitIn(n.w, n.h0, s);
          n.depth = s.depth;
          travel(n, n === a ? t : t + 4, 22, at, n === a ? (b.style ?? "arc") : "straight");
          animate(n.h.spec.scale!, n === a ? t : t + 4, 22, n.fit, "inOut");
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
        tgt.filter((n) => n !== to).forEach((n, k) => {
          travel(n, t + k * 3, 20, to.pos, "arc");
          animate(n.h.spec.scale!, t + k * 3 + 8, 12, n.fit * 0.2, "in");
          animate(n.h.spec.opacity!, t + k * 3 + 14, 6, 0, "in");
        });
        for (const id of b.targets ?? []) if (id !== b.to) live.delete(id);
        to.fit *= 1.1;
        bump(to, t + 22);
        moveSfx(t);
        f.sfx(t + 22, "subtle_impact");
        break;
      }
      case "arrange": {
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
        bump(a, t + 2);
        for (const n of live.values()) {
          if (n === a) continue;
          animate(n.h.spec.opacity!, t, 8, 0.35);
          put(n.h.spec.opacity!, t + 34, 1, "inOut");
        }
        f.sfx(t + 2, "soft_pop");
        // Pushed in on another element: pull back so the highlighted one is seen.
        framed = !!focusedOn && focusedOn !== a;
        break;
      }
      case "focus": {
        const [a] = tgt;
        if (!a) break;
        for (const n of live.values()) if (n !== a) setBlur(n, t, 8, 14);
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
        const start = Math.max(Math.min(wf[0], Math.max(t + 2, wf[0] - 8)), explainer && paired.has(b) ? t + 6 : 0);
        let style: NonNullable<FlowText["style"]> = b.text_layout === "panel" ? "panel" : b.text_layout === "display" ? "display" : b.text_layout === "pill" ? "pill" : live.size ? "caption" : "display";
        if (b.text_layout === "side") style = live.size ? "caption" : "display";
        // Explainer: beside a subject on the right, the words sit big on the left.
        const besideRight = explainer && b.text_layout === "side" && live.size > 0 && ["stage-right", "stage-left"].includes(layoutFamily(layoutName));
        const mirrored = besideRight && layoutFamily(layoutName) === "stage-left";
        if (besideRight) style = "side";
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
        const pos: Vec = mirrored ? [760, -10] : besideRight ? [-760, -10] : style === "caption" ? [0, 350] : style === "pill" ? [0, 370] : [0, 0];
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
        f.text(text, start, end, { swap, style, pos, size: explainer ? Math.min(fitSize(text, style, b.accent ?? undefined), EXPLAINER_TYPE[style]) : fitSize(text, style, b.accent ?? undefined), accent: b.accent ?? undefined, words: shown, mark: b.accent ? mark : undefined, markAt: explainer && j >= 0 ? wf[j] : undefined, ...(mirrored && { align: "right" as const }) });
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
    if (!calm && b.action !== "scene" && b.backdrop && backdrops.length && backdrops[backdrops.length - 1].kind !== b.backdrop) backdrops.push({ kind: b.backdrop, start: t });
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
  if (backdrops.some((x) => x.kind !== "mesh")) plan.backdrops = backdrops;
  // Elements that never appeared (skipped beats) are dropped.
  plan.nodes = plan.nodes.filter((n: FlowNode) => n.kind !== "el" || n.appear !== undefined);
  const out = smoothCamera(plan);
  // Explainer: the rules are enforced on the finished plan, not only reported.
  if (explainer) resolvePlan(out);
  return out;
}
