import type { CSSProperties } from "react";

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

// the words beside a hero (wide: the hero on the left when `left`), or above it
export function splitOf(g: Geo, left: boolean, hw = 860): { words: Box; hero: Box } {
  const { W, H, pad } = g;
  if (g.shape === "wide") {
    const gap = 100;
    return left
      ? { hero: { left: pad, top: 40, width: hw, height: H - 80 }, words: { left: pad + hw + gap, top: 0, width: W - 2 * pad - hw - gap, height: H } }
      : { hero: { left: W - pad - hw, top: 40, width: hw, height: H - 80 }, words: { left: pad, top: 0, width: W - 2 * pad - hw - gap - 40, height: H } };
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
  if (place === "side") return g.shape === "wide" ? { width: box.width, lines: 4, max: 120, min: 60 } : { width: box.width, lines: 3, max: g.shape === "tall" ? 112 : 84, min: 52 };
  if (place === "band") return { width: box.width, lines: g.shape === "wide" ? 2 : 3, max: Math.round(118 * g.u), min: 48 };
  return { width: box.width, lines: g.shape === "wide" ? 2 : 4, max: Math.round(210 * g.u), min: 70 };
}

// a design of its own size, scaled to fit its place and centred in it
export function fitIn(box: Box, dw: number, dh: number, most = 1): CSSProperties {
  const s = Math.min(most, box.width / dw, box.height / dh);
  return { position: "absolute", left: box.left + (box.width - dw * s) / 2, top: box.top + (box.height - dh * s) / 2, width: dw, height: dh, transform: `scale(${s.toFixed(4)})`, transformOrigin: "0 0" };
}
