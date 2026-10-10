import type { ComposerPlan } from "./types";

// The frame check: what a viewer would see wrong, read from the video as it
// really plays — where every word and every thing is on each frame (the
// probe, probe.tsx), after the camera, the ways in and out and the flights.
// The Frame Inspector (inspect.ts) reads the plan; this reads the frames.
//
//  - a thing on the words, or two things on each other
//  - a word or a thing cut off by the edge while it stands still
//  - an empty screen
//  - a thing gone before it can be seen, words gone before they can be read

// What the probe wrote down on a frame (frame pixels):
// [key, x, y, w, h, opacity] for each word; [key, x, y, w, h, opacity, kind, title, fly] for each thing
export type ProbeWord = [string, number, number, number, number, number];
export type ProbeThing = [string, number, number, number, number, number, string, string, 0 | 1];
export type ProbeSample = { f: number; w: ProbeWord[]; t: ProbeThing[] };
// (the probe's lines in the browser's log start with this)
export const PROBE_PREFIX = "QA1";

export type FrameFinding = { from: number; to: number; scene: number; what: string };
export type FrameCheck = { ok: boolean; frames: number; findings: FrameFinding[] };

type Box = { x: number; y: number; w: number; h: number };
// (things that may sit on others: a pointer, a shape behind)
const LOOSE = new Set(["cursor", "shape"]);
const SEEN = 0.5, SOLID = 0.6;
// a thing on screen at least this long, words fully on screen at least this long (frames)
export const THING_MIN = 36, WORDS_MIN = 30;
// an empty screen longer than this (frames)
const EMPTY_MAX = 20;

const shrink = (b: Box, kx: number, ky: number): Box => ({ x: b.x + b.w * kx, y: b.y + b.h * ky, w: b.w * (1 - 2 * kx), h: b.h * (1 - 2 * ky) });
const meet = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const sceneOf = (key: string) => Number(key.split(":")[0]) || 0;
const nameOf = (kind: string, title: string) => `${kind}${title ? ` "${title}"` : ""}`;
const secs = (f: number) => `${(f / 30).toFixed(1)} s`;

export function checkFrames(plan: ComposerPlan, samples: ProbeSample[]): FrameCheck {
  const W = plan.w ?? 1920, H = plan.h ?? 1080;
  const frame: Box = { x: 0, y: 0, w: W, h: H };
  const S = [...samples].sort((a, b) => a.f - b.f);
  const step = S.length > 1 ? Math.max(1, Math.round((S.at(-1)!.f - S[0].f) / (S.length - 1))) : 3;
  const last = plan.scenes.length - 1;
  const inside = (b: Box) => meet(b, frame) / Math.max(1, b.w * b.h);
  // a problem seen on several samples in a row is one finding
  const open = new Map<string, { from: number; to: number; n: number; scene: number; what: string; seen: number }>();
  const found: FrameFinding[] = [];
  const close = (k: string) => {
    const g = open.get(k)!;
    open.delete(k);
    if (g.n >= 2) found.push({ from: g.from, to: g.to, scene: g.scene, what: g.what });
  };
  const note = (k: string, f: number, scene: number, what: string, idx: number) => {
    const g = open.get(k);
    if (g?.seen === idx) return;
    if (g && g.seen === idx - 1) Object.assign(g, { to: f, n: g.n + 1, seen: idx });
    else {
      if (g) close(k);
      open.set(k, { from: f, to: f, n: 1, scene, what, seen: idx });
    }
  };
  // where each thing was on the sample before (still or moving)
  const before = new Map<string, Box>();
  const shown = new Map<string, { frames: number; scene: number; name: string; fly: boolean }>();
  const wordsFull = new Map<number, number>();
  const wordsSeen = new Map<number, Set<string>>();
  for (const s of S) for (const [k, , , , , o] of s.w) if (o >= SOLID) (wordsSeen.get(sceneOf(k)) ?? wordsSeen.set(sceneOf(k), new Set()).get(sceneOf(k))!).add(k);
  let empty = { from: -1, to: -1 };
  const endEmpty = () => {
    if (empty.from >= 0 && empty.to - empty.from + step > EMPTY_MAX) found.push({ from: empty.from, to: empty.to, scene: Math.max(0, plan.scenes.findLastIndex((x) => x.from <= empty.from)), what: `the screen is empty for ${secs(empty.to - empty.from + step)}` });
    empty = { from: -1, to: -1 };
  };

  S.forEach((s, idx) => {
    const words = s.w.map(([key, x, y, w, h, o]) => ({ key, box: { x, y, w, h }, o, scene: sceneOf(key) }));
    const things = s.t.map(([key, x, y, w, h, o, kind, title, fly]) => ({ key, box: { x, y, w, h }, o, kind, title, fly: !!fly, scene: sceneOf(key) }));
    const still = (key: string, b: Box) => {
      const p = before.get(key);
      return !!p && Math.abs(p.x + p.w / 2 - (b.x + b.w / 2)) <= 2 && Math.abs(p.y + p.h / 2 - (b.y + b.h / 2)) <= 2 && Math.abs(p.w - b.w) <= 2;
    };
    // words under a thing (where a scene lays its words on a plate over its picture, they may)
    for (const w of words) {
      if (w.o < SEEN) continue;
      const wb = shrink(w.box, 0.01, 0.16);
      const plated = ["over", "caption"].includes(plan.scenes[w.scene]?.layout ?? "");
      for (const t of things) {
        if (t.o < SEEN || LOOSE.has(t.kind) || (plated && t.scene === w.scene && !t.fly)) continue;
        const tb = shrink(t.box, t.kind === "badge" ? 0 : 0.05, t.kind === "badge" ? 0 : 0.05);
        if (meet(wb, tb) > Math.min(wb.w * wb.h, tb.w * tb.h) * 0.02) note(`wt|${t.key}|${w.scene}`, s.f, w.scene, `${nameOf(t.kind, t.title)} ${t.fly ? "flies over" : "covers"} the words${t.scene !== w.scene ? " (two scenes on screen at once)" : ""}`, idx);
      }
    }
    // two things on each other
    const solid = things.filter((t) => t.o >= SOLID && !LOOSE.has(t.kind) && t.kind !== "badge");
    for (let a = 0; a < solid.length; a++)
      for (let b = a + 1; b < solid.length; b++) {
        const A = solid[a], B = solid[b];
        if (A.scene === B.scene && !A.fly && !B.fly && ["cascade", "orbit"].includes(plan.scenes[A.scene]?.arrange ?? "")) continue;
        const ab = shrink(A.box, 0.06, 0.06), bb = shrink(B.box, 0.06, 0.06);
        if (meet(ab, bb) > Math.min(ab.w * ab.h, bb.w * bb.h) * 0.03) {
          const [p, q] = A.key < B.key ? [A, B] : [B, A];
          note(`tt|${p.key}|${q.key}`, s.f, p.scene, `${nameOf(p.kind, p.title)} and ${nameOf(q.kind, q.title)} are on each other${p.scene !== q.scene ? " (two scenes on screen at once)" : ""}`, idx);
        }
      }
    // cut off by the edge while it stands still
    for (const e of [...words.map((w) => ({ ...w, name: "the words" })), ...things.filter((t) => !LOOSE.has(t.kind)).map((t) => ({ ...t, name: nameOf(t.kind, t.title) }))]) {
      if (e.o < SOLID) continue;
      const b = e.box, out = b.x < -6 || b.y < -6 || b.x + b.w > W + 6 || b.y + b.h > H + 6;
      if (out && inside(b) > 0.05 && still(e.key, b)) note(`cut|${e.name === "the words" ? `w${e.scene}` : e.key}`, s.f, e.scene, `${e.name} cut off by the edge`, idx);
    }
    for (const e of [...words, ...things]) before.set(e.key, e.box);
    // how long each thing is seen
    for (const t of things) {
      if (t.fly || LOOSE.has(t.kind)) continue;
      const g = shown.get(t.key) ?? { frames: 0, scene: t.scene, name: nameOf(t.kind, t.title), fly: false };
      if (t.o >= SOLID && inside(t.box) > 0.6) g.frames += step;
      shown.set(t.key, g);
    }
    // how long a scene's words are all on screen at once
    for (const [sc, set] of wordsSeen) {
      const full = [...set].every((k) => words.some((w) => w.key === k && w.o >= SOLID && inside(w.box) > 0.9));
      if (full) wordsFull.set(sc, (wordsFull.get(sc) ?? 0) + step);
    }
    // nothing on screen
    const any = [...words, ...things.filter((t) => !LOOSE.has(t.kind))].some((e) => e.o >= SEEN && inside(e.box) > 0.5);
    if (!any && s.f > 6 && s.f < plan.duration - 3) {
      if (empty.from < 0) empty.from = s.f;
      empty.to = s.f;
    } else endEmpty();
    // what was not seen on this sample is closed
    for (const [k, g] of open) if (g.seen !== idx) close(k);
  });
  for (const k of [...open.keys()]) close(k);
  endEmpty();
  for (const [, g] of shown) if (g.scene !== last && g.frames > 0 && g.frames < THING_MIN) found.push({ from: 0, to: 0, scene: g.scene, what: `${g.name} is on screen only ${secs(g.frames)}` });
  for (const [sc, set] of wordsSeen) if (sc !== last && set.size && (wordsFull.get(sc) ?? 0) < WORDS_MIN) found.push({ from: 0, to: 0, scene: sc, what: `the words are all on screen only ${secs(wordsFull.get(sc) ?? 0)}` });
  // (where it happens: the first frame of a scene for the ones over a whole scene)
  for (const g of found) if (!g.from && !g.to) g.from = g.to = plan.scenes[g.scene]?.from ?? 0;
  found.sort((a, b) => a.from - b.from);
  return { ok: !found.length, frames: S.length, findings: found };
}

// The frames the check looks at: every few frames, all of the video.
export const framesToCheck = (duration: number, every = duration > 1200 ? 4 : 3) => Array.from({ length: Math.ceil(duration / every) }, (_, k) => k * every).filter((f) => f < duration);
