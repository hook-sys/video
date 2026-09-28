import { estimateWords } from "@/lib/flow-script";
import { parseAsset, type SceneBeat, type SceneContent, type SceneElement, type SceneScript } from "@/lib/scene-script";
import { spokenCueTimes, type WordTiming } from "@/lib/voice-timing";
import { cardSize } from "./cards/card";
import { deviceSize } from "./cards/device-data";
import { CARD_BY_ID } from "./cards/templates";
import type { CardContent } from "./cards/types";
import { brandStartFrame, type CompileBrand, ctaLine, smoothCamera, wordFrames } from "./compile";
import { num, vec } from "./eval";
import { DEPTH, layoutFamily, layoutSlots, OVERLAPPING_FAMILIES, type Slot } from "./layouts";
import { animate as animateAfter, Flow, type FlowNodeHandle, put as putAfter } from "./patterns";
import type { Ease, FlowElement, FlowNode, FlowPlan, FlowText, ThemeName, Track, Vec } from "./types";
import { fitSize } from "./typography";

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
};
const MINOR = new Set<SceneBeat["action"]>(["celebrate", "highlight"]);

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

type Live = { h: FlowNodeHandle; w: number; h0: number; fit: number; pos: Vec; depth: 0 | 1 | 2 };

const toContent = (c: SceneContent | null | undefined): Record<string, unknown> | undefined =>
  c ? Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length))) : undefined;

export function compileSceneScript(script: SceneScript, { narration, words, durationSeconds, theme, brand, screenshots }: SceneCompileOptions): FlowPlan {
  const total = Math.round(durationSeconds * FPS);
  const timeline = words?.length ? words : estimateWords(narration, durationSeconds);
  const stageEnd = brand?.name?.trim() || brand?.logo ? brandStartFrame(total, timeline) : total;

  // ── schedule ──
  const times = spokenCueTimes(script.beats.map((b) => b.cue), timeline);
  const beats: SceneBeat[] = [];
  const starts: number[] = [];
  let last = -MIN_GAP;
  script.beats.forEach((b, i) => {
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
  const live = new Map<string, Live>(); // elements on screen
  const known = new Map<string, Live>(); // every element ever made
  const center: Vec = [0, 0]; // every scene is framed here (pushes move elements, not the camera)
  let layoutName = "grid";
  let sceneIdx = -1;
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
    return { el: { type: "logo", src: brand?.logo ?? undefined, text: brand?.name ?? "Logo" }, w: 320, h: 180 };
  };

  const fitIn = (w: number, h: number, s: Slot) => Math.min(1.1, s.box[0] / w, s.box[1] / h) * s.scale * DEPTH[s.depth].scale;
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
  const enter = (n: Live, t: number, style: string, rot: number, push?: Vec) => {
    const spec = n.h.spec;
    const [x, y] = n.pos;
    const sc = spec.scale!;
    const op = spec.opacity!;
    spec.appear = t;
    put(op, t, 0);
    put(op, t + 10, 1, "out");
    const from: Record<string, Vec> = { rise: [x, y + 80], "slide-left": [x + 280, y], "slide-right": [x - 280, y], drop: [x, y - 180], cascade: [x - 60, y + 60] };
    if (push) {
      put(spec.pos, t, [x + push[0], y + push[1]]);
      put(spec.pos, t + 22, [x, y], "inOut");
      put(sc, t, n.fit);
      if (rot) spec.rot = [[0, rot]];
      if (DEPTH[n.depth].blur) spec.blur = [[0, DEPTH[n.depth].blur]];
      return;
    }
    if (from[style]) {
      put(spec.pos, t, from[style]);
      put(spec.pos, t + 20, [x, y], style === "drop" ? "back" : "out");
    } else put(spec.pos, t, [x, y]);
    put(sc, t, style === "pop" ? 0 : style === "scale-up" ? n.fit * 0.6 : style === "blur" ? n.fit * 1.08 : n.fit * 0.94);
    put(sc, t + 18, n.fit, style === "pop" ? "back" : "out");
    if (style === "blur") {
      spec.blur = [[0, 18]];
      put(spec.blur, t, 18);
      put(spec.blur, t + 16, 0, "out");
    }
    if (style === "flip") {
      spec.tilt = [[t, [0, 75, 0]], [t + 20, [0, 0, 0], "out"]];
    }
    if (rot) spec.rot = [[0, rot]];
    const depthBlur = DEPTH[n.depth].blur;
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
  const place = (els: SceneElement[], t: number, layout: string, style: string | null, carry: boolean, push?: Vec) => {
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
      const enterStyle = style ?? (["rise", "pop", "slide-left", "blur", "drop", "scale-up", "flip"][(sceneIdx + i) % 7]);
      enter(n, push ? t : t + i * 4, enterStyle, s.rot, push);
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
  const planned = beats.flatMap((b, i) =>
    b.action === "statement" && b.text_layout !== "display" && b.text_layout !== "panel" ? [{ start: starts[i], end: (starts[i + 1] ?? stageEnd) + 30, style: (b.text_layout === "pill" ? "pill" : "caption") as NonNullable<FlowText["style"]> }] : [],
  );
  const reserveAt = (t0: number, t1: number) => {
    const on = [...lines, ...planned].filter((l) => l.start - 30 < t1 && l.end > t0);
    return on.some((l) => l.style === "caption") ? 250 : on.some((l) => l.style === "pill") ? 210 : 0;
  };
  const shoot = (t: number, span: number, move: string, focus?: Live[]) => {
    focusedOn = null;
    const { c, zoom } = framedBox(focus ?? [...live.values()]);
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
  let focusedOn: Live | null = null; // the camera is pushed in on this element

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
        const tr = b.transition ?? (sceneIdx === 0 ? "cut" : ["dissolve", "push-left", "zoom-through", "push-up", "morph"][sceneIdx % 5]);
        const carried = new Set((b.elements ?? []).filter((e) => e.asset === null).map((e) => e.id));
        const old = [...live.entries()].filter(([id]) => !carried.has(id));
        const focusEl = [...live.values()][0];
        let enterAt = t;
        let push: Vec | undefined;
        if (SCENE_STEP[tr]) {
          const [sx, sy] = SCENE_STEP[tr];
          push = [sx, sy];
          for (const [, n] of old) {
            // Old and new move together with the same timing, like one strip.
            animate(n.h.spec.pos, t, 22, [n.pos[0] - sx, n.pos[1] - sy], "inOut");
            animate(n.h.spec.opacity!, t + 18, 4, 0, "in");
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
        sceneMove = b.camera ?? ["push-in", "drift", "pan-right", "pull-back", "rise"][sceneIdx % 5];
        layoutName = place(b.elements ?? [], enterAt, layoutName, b.style, true, push);
        if (sceneIdx > 0) f.sfx(t, "whoosh");
        shoot(t, span, sceneMove);
        framed = false;
        break;
      }
      case "place":
        layoutName = place(b.elements ?? [], t, layoutName, b.style, true);
        f.sfx(t, "soft_pop");
        break;
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
        f.sfx(t, "whoosh");
        break;
      }
      case "trigger": {
        const [a] = tgt;
        if (!a || !to) break;
        travel(a, t, 22, to.pos, b.style ?? "arc");
        f.sfx(t, "whoosh");
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
      case "update": {
        const [a] = tgt;
        if (!a || !b.content) break;
        if (a.h.spec.el?.type === "card") (a.h.spec.el.updates ??= []).push({ at: t + 2, content: toContent(b.content)! });
        bump(a, t + 2);
        f.sfx(t + 2, "reveal");
        framed = false;
        break;
      }
      case "connect": {
        const [a] = tgt;
        if (!a || !to) break;
        f.connect(a.h, to.h, t + 2, { dur: 16, packet: "sparkles", packetDur: 20, bend: 60 });
        f.sfx(t + 8, "whoosh");
        framed = false;
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
        f.sfx(t, "whoosh").sfx(t + 22, "subtle_impact");
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
        f.sfx(t, "whoosh").sfx(t + 24, "soft_pop");
        break;
      }
      case "erase": {
        tgt.forEach((n, k) => leave(n, t + k * 4, b.style ?? "wipe"));
        for (const id of b.targets ?? []) live.delete(id);
        f.sfx(t, "whoosh");
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
        shoot(t, span, "push-in", [a]);
        focusedOn = a;
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
        const wf = wordFrames(text, (t + LEAD) / FPS - 0.2, timeline).map((w) => Math.min(w, stageEnd - (stageEnd < total ? 24 : 8)));
        // The line (and the dim behind a display line) arrives with its first word.
        const start = Math.min(wf[0], Math.max(t + 2, wf[0] - 8));
        let style: NonNullable<FlowText["style"]> = b.text_layout === "panel" ? "panel" : b.text_layout === "display" ? "display" : b.text_layout === "pill" ? "pill" : live.size ? "caption" : "display";
        if (b.text_layout === "side") style = live.size ? "caption" : "display";
        const cover = style === "display" || style === "panel";
        const end = lastLine ? lastEnd : Math.min(hardEnd, cover ? Math.max(wf[wf.length - 1] + 36, nextStart - 10) : Math.max(wf[wf.length - 1] + 36, nextStart + 20));
        lines.push({ start, end, style });
        if (style === "panel") {
          const first = [...live.values()][0];
          f.panel(t, end, first ? first.pos : center);
          f.sfx(t, "whoosh");
        }
        const pos: Vec = style === "caption" ? [0, 350] : style === "pill" ? [0, 370] : [0, 0];
        f.text(text, start, end, { style, pos, size: fitSize(text, style, b.accent ?? undefined), accent: b.accent ?? undefined, words: wf });
        if (style === "display") {
          f.dimTo(start - 4, 12, 1).dimTo(Math.min(end, total) + 8, 12, 0);
          f.sfx(wf[0], "subtle_impact");
        }
        else if (style === "pill") f.sfx(start, "soft_pop");
        if (!cover) shoot(t, span, "drift");
        framed = false;
        break;
      }
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
  if (brand?.color) plan.brandColor = brand.color;
  if (overlaps.length) plan.overlaps = overlaps;
  // Elements that never appeared (skipped beats) are dropped.
  plan.nodes = plan.nodes.filter((n: FlowNode) => n.kind !== "el" || n.appear !== undefined);
  return smoothCamera(plan);
}
