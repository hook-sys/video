import type { Vec } from "./types";

// Layout library: where N elements sit in a scene. A layout returns one slot
// per element — its centre (world px around the scene centre), the box it may
// fill, a depth (0 back … 2 front; back is smaller and blurred) and a small
// rotation. Families have lettered variants (seeded), so the same family looks
// different from video to video.

export type Slot = { pos: Vec; box: Vec; depth: 0 | 1 | 2; rot: number; scale: number };
type Gen = (n: number, rnd: () => number) => Slot[];

const W = 1640; // usable scene width
const H = 860; // usable scene height

const slot = (x: number, y: number, bw: number, bh: number, depth: 0 | 1 | 2 = 1, rot = 0, scale = 1): Slot => ({ pos: [Math.round(x), Math.round(y)], box: [Math.round(bw), Math.round(bh)], depth, rot, scale });

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const row: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * (W / n), 0, (W / n) * 0.88, H * 0.7));
const column: Gen = (n) => Array.from({ length: n }, (_, i) => slot(0, (i - (n - 1) / 2) * (H / n), W * 0.5, (H / n) * 0.88));
const grid: Gen = (n) => {
  const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const cw = W / cols;
  const ch = H / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const c = i % cols;
    return slot((c - (inRow - 1) / 2) * cw, (r - (rows - 1) / 2) * ch, cw * 0.88, ch * 0.86);
  });
};
const pipeline: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * (W / n) * 1.05, (i % 2 ? 1 : -1) * 26, (W / n) * 0.72, H * 0.55));
const zigzag: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * (W / n), (i % 2 ? 1 : -1) * H * 0.2, (W / n) * 0.9, H * 0.5));
const diagonal: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * (W / n) * 0.9, (i - (n - 1) / 2) * (H / n) * 0.7, (W / n) * 0.78, (H / n) * 1.2, (Math.min(2, i) as 0 | 1 | 2)));
const arc: Gen = (n) =>
  Array.from({ length: n }, (_, i) => {
    const a = Math.PI * (0.15 + (0.7 * i) / Math.max(1, n - 1));
    return slot(-Math.cos(a) * W * 0.42, H * 0.28 - Math.sin(a) * H * 0.62, (W / n) * 0.8, H * 0.42, 1, (a - Math.PI / 2) * -12);
  });
const ring: Gen = (n) =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return slot(Math.cos(a) * W * 0.34, Math.sin(a) * H * 0.36, Math.min(W / n, 420), Math.min(H / 3, 300));
  });
// A hub in the middle (the first element), the rest around it.
const hub: Gen = (n) => {
  const k = Math.max(0, n - 1);
  const spread = k > 3 ? 1.22 : 1;
  const hubBox: Vec = k > 3 ? [440, 320] : [520, 420];
  return [slot(0, 0, hubBox[0], hubBox[1], 2), ...ring(k, () => 0.5).map((s) => ({ ...s, pos: [s.pos[0] * spread, s.pos[1] * spread] as Vec, box: [Math.min(k > 3 ? 320 : 360, s.box[0]), Math.min(k > 3 ? 220 : 260, s.box[1])] as Vec, depth: 1 as const }))];
};
// One element large; any others around it like a hub (never stacked on it).
const single: Gen = (n, rnd) => (n === 1 ? [slot(0, 0, W * 0.7, H * 0.9, 2)] : hub(n, rnd));
const stack: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * 60, (i - (n - 1) / 2) * 46, W * 0.46, H * 0.62, (i === n - 1 ? 2 : 1) as 1 | 2, 0, 1 - (n - 1 - i) * 0.04));
const fan: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * 190, Math.abs(i - (n - 1) / 2) * 30, W * 0.34, H * 0.66, 1, (i - (n - 1) / 2) * 7));
// The first element large on one side, the rest as a column on the other.
const heroSide = (side: 1 | -1): Gen => (n) => [
  slot(-side * W * 0.2, 0, W * 0.52, H * 0.9, 2),
  ...Array.from({ length: n - 1 }, (_, i) => slot(side * W * 0.3, (i - (n - 2) / 2) * (H / Math.max(1, n - 1)), W * 0.36, (H / Math.max(1, n - 1)) * 0.86)),
];
const heroTop: Gen = (n) => [slot(0, -H * 0.2, W * 0.6, H * 0.5, 2), ...Array.from({ length: n - 1 }, (_, i) => slot((i - (n - 2) / 2) * (W / Math.max(1, n - 1)), H * 0.3, (W / Math.max(1, n - 1)) * 0.86, H * 0.36))];
const split: Gen = (n) => {
  const left = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const onLeft = i < left;
    const k = onLeft ? i : i - left;
    const m = onLeft ? left : n - left;
    return slot((onLeft ? -1 : 1) * W * 0.26, (k - (m - 1) / 2) * (H / Math.max(1, m)), W * 0.4, (H / Math.max(1, m)) * 0.86);
  });
};
const pyramid: Gen = (n) => {
  const out: Slot[] = [];
  let r = 0;
  let i = 0;
  while (i < n) {
    const inRow = Math.min(r + 1, n - i);
    for (let c = 0; c < inRow; c++) out.push(slot((c - (inRow - 1) / 2) * (W / 3.2), (r - 1) * (H / 3), W / 3.6, H / 3.4));
    i += inRow;
    r++;
  }
  return out;
};
// A bento grid on 4 × 3 units: [col, row, width, height] per element, the
// first cell the largest; cells never overlap.
const BENTO: [number, number, number, number][][] = [
  [[0, 0, 4, 3]],
  [[0, 0, 2, 3], [2, 0, 2, 3]],
  [[0, 0, 2, 3], [2, 0, 2, 1.5], [2, 1.5, 2, 1.5]],
  [[0, 0, 2, 2], [2, 0, 2, 1], [2, 1, 2, 1], [0, 2, 4, 1]],
  [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 2, 1], [0, 2, 4, 1]],
  [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 2, 1], [0, 2, 2, 1], [2, 2, 2, 1]],
  [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 1, 1], [3, 1, 1, 1], [0, 2, 2, 1], [2, 2, 2, 1]],
  [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 2, 2], [0, 1, 2, 1], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1], [3, 2, 1, 1]],
];
const mosaic: Gen = (n) =>
  BENTO[Math.min(n, BENTO.length) - 1].slice(0, n).map(([c, r, w, h], i) => slot(((c + w / 2) / 4 - 0.5) * W, ((r + h / 2) / 3 - 0.5) * H, (w / 4) * W * 0.92, (h / 3) * H * 0.9, (i === 0 ? 2 : 1) as 1 | 2));
// Seeded scatter: elements spread over the frame at varied depths and small
// angles, never overlapping much (controlled complexity, not clutter).
const scatter: Gen = (n, rnd) => {
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    let best: Slot | null = null;
    let bestD = -1;
    for (let k = 0; k < 24; k++) {
      const room = Math.min(1, 4.5 / Math.max(1, n)); // denser scenes get smaller boxes
      const c = slot((rnd() - 0.5) * W * 0.9, (rnd() - 0.5) * H * 0.82, W * 0.3 * room, H * 0.34 * room, (Math.floor(rnd() * 3) as 0 | 1 | 2), (rnd() - 0.5) * 10);
      const d = Math.min(...out.map((o) => Math.hypot((o.pos[0] - c.pos[0]) / W, (o.pos[1] - c.pos[1]) / H)), 9);
      if (d > bestD) [best, bestD] = [c, d];
    }
    out.push(best!);
  }
  return out;
};
// Depth field: a few large front elements and small blurred ones behind.
const depthField: Gen = (n, rnd) => scatter(n, rnd).map((s, i) => ({ ...s, depth: (i % 3 === 0 ? 2 : i % 3 === 1 ? 0 : 1) as 0 | 1 | 2 }));
const timeline: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * (W / n), (i % 2 ? 1 : -1) * H * 0.24, (W / n) * 0.86, H * 0.4));
const columns2: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i % 2 ? 1 : -1) * W * 0.24, (Math.floor(i / 2) - (Math.ceil(n / 2) - 1) / 2) * (H / Math.ceil(n / 2)), W * 0.42, (H / Math.ceil(n / 2)) * 0.86));
const cascade: Gen = (n) => Array.from({ length: n }, (_, i) => slot((i - (n - 1) / 2) * 180, (i - (n - 1) / 2) * 90, W * 0.4, H * 0.5, (i === n - 1 ? 2 : 1) as 1 | 2, -4 + i * 2));

const FAMILIES: Record<string, { gen: Gen; description: string; variants: number }> = {
  single: { gen: single, description: "one element, large, centred", variants: 1 },
  row: { gen: row, description: "side by side in a row", variants: 1 },
  column: { gen: column, description: "stacked in a column", variants: 1 },
  grid: { gen: grid, description: "an even grid", variants: 1 },
  columns2: { gen: columns2, description: "two columns", variants: 1 },
  mosaic: { gen: mosaic, description: "a bento grid of mixed sizes (dashboard assembled)", variants: 1 },
  pipeline: { gen: pipeline, description: "left to right steps of a process", variants: 1 },
  timeline: { gen: timeline, description: "alternating above/below a time line", variants: 1 },
  zigzag: { gen: zigzag, description: "a zigzag path", variants: 1 },
  diagonal: { gen: diagonal, description: "a diagonal from back-left to front-right", variants: 1 },
  arc: { gen: arc, description: "an arc across the frame", variants: 1 },
  ring: { gen: ring, description: "a ring", variants: 1 },
  hub: { gen: hub, description: "the first element as a central hub, the rest around it", variants: 1 },
  stack: { gen: stack, description: "stacked cards with depth", variants: 1 },
  cascade: { gen: cascade, description: "a diagonal cascade of overlapping cards", variants: 1 },
  fan: { gen: fan, description: "fanned out like a hand of cards", variants: 1 },
  "hero-left": { gen: heroSide(1), description: "the first element big on the left, the rest listed on the right", variants: 1 },
  "hero-right": { gen: heroSide(-1), description: "the first element big on the right, the rest on the left", variants: 1 },
  "hero-top": { gen: heroTop, description: "the first element big on top, the rest in a row below", variants: 1 },
  split: { gen: split, description: "two groups: before (left) and after (right)", variants: 1 },
  pyramid: { gen: pyramid, description: "a pyramid", variants: 1 },
  scatter: { gen: scatter, description: "spread across the frame at varied depths (controlled chaos, separate tools)", variants: 12 },
  depth: { gen: depthField, description: "a deep field: big front elements, small blurred ones behind", variants: 8 },
};

// Regular families get lettered variants too: the same arrangement with a
// seeded offset, depth order and slight tilt (variant a is the clean one).
for (const f of Object.values(FAMILIES)) if (f.variants === 1 && f.gen !== single) f.variants = 5;
// Denser layouts are jittered less, so neighbours never touch.
const jitter = (slots: Slot[], rnd: () => number, k = Math.min(1, 3 / slots.length)): Slot[] =>
  slots.map((s) => ({ ...s, pos: [s.pos[0] + (rnd() - 0.5) * 70 * k, s.pos[1] + (rnd() - 0.5) * 50 * k] as Vec, rot: s.rot + (rnd() - 0.5) * 6, depth: (s.depth === 2 ? 2 : rnd() < 0.25 ? 0 : 1) as 0 | 1 | 2 }));

export const LAYOUT_FAMILIES = Object.keys(FAMILIES);
// Every named preset: families, plus lettered variants for seeded ones.
export const LAYOUT_PRESETS = LAYOUT_FAMILIES.flatMap((f) => (FAMILIES[f].variants > 1 ? Array.from({ length: FAMILIES[f].variants }, (_, i) => `${f}-${String.fromCharCode(97 + i)}`) : [f]));

export const isLayout = (name: unknown): name is string => typeof name === "string" && (LAYOUT_PRESETS.includes(name) || LAYOUT_FAMILIES.includes(name));

// Slots for n elements. "scatter-c" picks variant c; a bare family picks the
// first variant (or one from `seed`).
export function layoutSlots(name: string, n: number, seed = 0): Slot[] {
  if (n <= 0) return [];
  const [fam, v] = name.match(/^(.*?)(?:-([a-z]))?$/)!.slice(1) as [string, string | undefined];
  const family = FAMILIES[fam] ? fam : FAMILIES[name] ? name : "grid";
  const variant = v ? v.charCodeAt(0) - 97 : seed % FAMILIES[family].variants;
  const rnd = seeded(1 + variant * 7919 + n * 31);
  const slots = FAMILIES[family].gen(n, rnd);
  const out = variant > 0 && family !== "scatter" && family !== "depth" ? jitter(slots, rnd) : slots;
  return OVERLAPPING_FAMILIES.includes(family) ? out : separate(out);
}

// Boxes of sharp (non-back) slots never overlap: any two that do shrink a
// little, repeatedly, until they are apart. Back-layer slots are blurred
// backdrop and may sit behind others.
function separate(slots: Slot[]): Slot[] {
  const out = slots.map((s) => ({ ...s, box: [...s.box] as Vec }));
  const half = (s: Slot, k: 0 | 1) => (s.box[k] * s.scale * DEPTH[s.depth].scale) / 2 + 12;
  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const [a, b] = [out[i], out[j]];
        if (a.depth === 0 || b.depth === 0) continue;
        const ox = half(a, 0) + half(b, 0) - Math.abs(a.pos[0] - b.pos[0]);
        const oy = half(a, 1) + half(b, 1) - Math.abs(a.pos[1] - b.pos[1]);
        if (ox <= 0 || oy <= 0) continue;
        for (const s of [a, b]) s.box = [Math.round(s.box[0] * 0.93), Math.round(s.box[1] * 0.93)];
        moved = true;
      }
    if (!moved) break;
  }
  return out;
}

// Families whose elements overlap on purpose (a stack, a hand of cards).
export const OVERLAPPING_FAMILIES = ["stack", "cascade", "fan"];
export const layoutFamily = (name: string) => {
  const fam = name.match(/^(.*?)(?:-([a-z]))?$/)![1];
  return FAMILIES[fam] ? fam : FAMILIES[name] ? name : "grid";
};

export const layoutCatalogText = () => LAYOUT_FAMILIES.map((f) => `${f}${FAMILIES[f].variants > 1 ? ` (variants ${f}-a…${String.fromCharCode(96 + FAMILIES[f].variants)})` : ""}: ${FAMILIES[f].description}`).join("\n");

// Size multiplier and blur (px) per depth layer.
export const DEPTH = { 0: { scale: 0.72, blur: 5 }, 1: { scale: 1, blur: 0 }, 2: { scale: 1.08, blur: 0 } } as const;
