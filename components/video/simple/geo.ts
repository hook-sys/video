import type { CSSProperties } from "react";
import { noteHero } from "./fit";

// Where things go on each frame (16:9, 9:16, 1:1). A template is made of a
// place for the words and a place for its hero (or a group below the words);
// side by side on a wide frame, the words above on a tall or square one. A
// hero is designed once at its own size and scaled into its place.

export type Box = { left: number; top: number; width: number; height: number };
export type Shape = "wide" | "tall" | "square";
export type Geo = { W: number; H: number; shape: Shape; pad: number; u: number };

export function geoOf(W: number, H: number): Geo {
  const shape: Shape = W > H * 1.2 ? "wide" : H > W * 1.2 ? "tall" : "square";
  // (u: how type scales against the wide frame's)
  return { W, H, shape, pad: shape === "wide" ? 140 : shape === "tall" ? 80 : 70, u: shape === "wide" ? 1 : shape === "tall" ? 0.86 : 0.74 };
}

// the words beside a hero (wide: the hero on the left when `left`), or above
// it; `hw`: how wide the hero may be on a wide frame
export const HERO_W = 1040;
export function splitOf(g: Geo, left: boolean, hw = HERO_W): { words: Box; hero: Box } {
  const { W, H, pad } = g;
  if (g.shape === "wide") {
    const words = W - 2 * pad - hw - GAP;
    return left
      ? { hero: { left: pad, top: 0, width: hw, height: H }, words: { left: pad + hw + GAP, top: 0, width: words, height: H } }
      : { hero: { left: W - pad - hw, top: 0, width: hw, height: H }, words: { left: pad, top: 0, width: words, height: H } };
  }
  if (g.shape === "tall") return { words: { left: pad, top: 170, width: W - 2 * pad, height: 600 }, hero: { left: pad, top: 800, width: W - 2 * pad, height: H - 800 - 110 } };
  return { words: { left: pad, top: 40, width: W - 2 * pad, height: 330 }, hero: { left: pad, top: 390, width: W - 2 * pad, height: H - 390 - 40 } };
}

// the words in a band on top, a group below them
export function stackOf(g: Geo): { words: Box; body: Box } {
  const { W, H, pad } = g;
  if (g.shape === "wide") return { words: { left: pad, top: 90, width: W - 2 * pad, height: 300 }, body: { left: pad, top: 410, width: W - 2 * pad, height: H - 410 - 70 } };
  if (g.shape === "tall") return { words: { left: pad, top: 180, width: W - 2 * pad, height: 520 }, body: { left: pad, top: 740, width: W - 2 * pad, height: H - 740 - 120 } };
  return { words: { left: pad, top: 40, width: W - 2 * pad, height: 300 }, body: { left: pad, top: 360, width: W - 2 * pad, height: H - 360 - 40 } };
}

// how big the words may be in each place
export type WordsFit = { width: number; lines: number; max: number; min: number };
export function wordsFit(g: Geo, place: "side" | "band" | "center", box: Box): WordsFit {
  if (place === "side") return g.shape === "wide" ? { width: box.width, lines: 4, max: TYPE.HEAD, min: 60 } : { width: box.width, lines: 3, max: Math.round(TYPE.HEAD * g.u), min: 52 };
  if (place === "band") return { width: box.width, lines: g.shape === "wide" ? 2 : 3, max: Math.round(TYPE.HEAD * g.u), min: 48 };
  return { width: box.width, lines: g.shape === "wide" ? 2 : 4, max: Math.round(TYPE.HERO * g.u), min: 70 };
}

// The type scale (docs/reference: the promos use few sizes, the same ones
// throughout): the words alone (HERO), the words beside or above a hero —
// second to it — and a name (HEAD), words under a name (SUB), a thing on a
// card or a tile (ITEM, its title TITLE), a small line under it (LABEL), a
// button's words (BUTTON). Headlines are frame pixels (times g.u); the rest
// are a hero's own pixels, scaled with it. A number the voice says and a
// device's own screen keep their sizes. No scene shows more than three.
export const TYPE = { HERO: 190, HEAD: 96, SUB: 64, TITLE: 48, ITEM: 48, LABEL: 30, BUTTON: 56 } as const;
export const WEIGHT = { title: 700, item: 650 } as const;
// the room between the words and a hero
const GAP = 120;
// a hero may grow to this much of its designed size to fill its place
const MOST = 1.35;
// the room kept above and below a group (a tall frame keeps more: phones lay their own buttons there)
const vpad = (g: Geo) => (g.shape === "wide" ? 90 : g.shape === "tall" ? 170 : 60);

// The words and a hero as one group, centred on the frame, the hero as big
// as its place lets it be: side by side on a wide frame (the words as wide as
// they are, the hero taking the rest), one above the other on a tall or
// square one. `words`: their fitted size, how many lines and the widest line
// (fit.ts measured).
export type Measured = { size: number; lines: number; width: number };
export function sideOf(g: Geo, left: boolean, hw: number, words: Measured, dw: number, dh: number): { words: Box; hero: CSSProperties } {
  const { W, H, pad } = g;
  const { words: box } = splitOf(g, left, hw);
  const place = (s: number, x: number, y: number): CSSProperties => {
    noteHero((dw * s * dh * s) / (W * H));
    return { position: "absolute", left: x, top: y, width: dw, height: dh, transform: `scale(${s.toFixed(4)})`, transformOrigin: "0 0" };
  };
  if (g.shape === "wide") {
    const ww = Math.min(box.width, words.width);
    // (the hero takes what the words leave, up to a little more than its own width)
    const s = Math.min(MOST, Math.min(W - 2 * pad - ww - GAP, hw * 1.25) / dw, (H - 2 * vpad(g)) / dh);
    const w = dw * s;
    const x0 = Math.max(pad, (W - (ww + GAP + w)) / 2);
    // (the words' place keeps its width — they are fitted to it — and starts where they do)
    return left
      ? { hero: place(s, x0, (H - dh * s) / 2), words: { ...box, left: x0 + w + GAP } }
      : { words: { ...box, left: x0 }, hero: place(s, x0 + ww + GAP, (H - dh * s) / 2) };
  }
  const wh = words.lines * words.size * 1.08;
  const gap = GAP * 0.6;
  const s = Math.min(MOST, (W - 2 * pad) / dw, (H - 2 * vpad(g) - wh - gap) / dh);
  const y0 = Math.max(vpad(g) * 0.5, (H - (wh + gap + dh * s)) / 2);
  return { words: { ...box, top: y0, height: wh }, hero: place(s, (W - dw * s) / 2, y0 + wh + gap) };
}
// the words in a band on top and a group below them, centred on the frame together, the group as big as it may be
export function bandOf(g: Geo, words: Measured, dw: number, dh: number): { words: Box; body: CSSProperties } {
  const { W, H, pad } = g;
  const { words: box } = stackOf(g);
  const wh = words.lines * words.size * 1.08;
  const gap = GAP * 0.6;
  const s = Math.min(MOST, (W - 2 * pad) / dw, (H - 2 * vpad(g) - wh - gap) / dh);
  noteHero((dw * s * dh * s) / (W * H));
  const y0 = Math.max(vpad(g) * 0.5, (H - (wh + gap + dh * s)) / 2);
  return { words: { ...box, top: y0, height: wh }, body: { position: "absolute", left: (W - dw * s) / 2, top: y0 + wh + gap, width: dw, height: dh, transform: `scale(${s.toFixed(4)})`, transformOrigin: "0 0" } };
}

// a design of its own size, scaled to fit its place and centred in it
export function fitIn(box: Box, dw: number, dh: number, most = 1): CSSProperties {
  const s = Math.min(most, box.width / dw, box.height / dh);
  return { position: "absolute", left: box.left + (box.width - dw * s) / 2, top: box.top + (box.height - dh * s) / 2, width: dw, height: dh, transform: `scale(${s.toFixed(4)})`, transformOrigin: "0 0" };
}

// the frame of a format (16:9 unless it is 9:16 or 1:1)
const FRAMES: Record<string, [number, number]> = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] };
export const frameOf = (format: string | null | undefined): [number, number] => FRAMES[format ?? ""] ?? FRAMES["16:9"];
