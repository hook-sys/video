import { H, W } from "../frame";
import type { Word } from "../types";
import type { HeroLayout } from "./slots";

export const saidAt = (words: Word[], index: number | null, fallback: number) => {
  if (index == null) return fallback;
  const w = words[index];
  return w ? Math.round(w.start * 30) : fallback;
};

export type Rect = { x: number; y: number; w: number; h: number };

const pad = () => Math.round(Math.min(W, H) * 0.055);

// Where the hero's glass sits. Wide frames use left / right / split; a tall
// or square frame stacks into one centred pane so type stays large.
export function stageOf(layout: HeroLayout): { main: Rect; alt: Rect | null; wide: boolean } {
  const p = pad();
  const wide = W / H >= 1.35;
  if (!wide || layout === "center") {
    const w = Math.round(Math.min(W * 0.74, wide ? 1040 : W - p * 2));
    const h = Math.round(Math.min(H * (wide ? 0.8 : 0.72), H - p * 2));
    return { main: { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h }, alt: null, wide };
  }
  const gap = Math.round(W * 0.028);
  const inner = W - p * 2 - gap;
  if (layout === "split") {
    const w = Math.round(inner / 2);
    const h = H - p * 2;
    return { main: { x: p, y: p, w, h }, alt: { x: p + w + gap, y: p, w, h }, wide };
  }
  const mainW = Math.round(inner * 0.56);
  const altW = inner - mainW;
  const h = H - p * 2;
  if (layout === "right") return { main: { x: W - p - mainW, y: p, w: mainW, h }, alt: { x: p, y: p, w: altW, h }, wide };
  return { main: { x: p, y: p, w: mainW, h }, alt: { x: p + mainW + gap, y: p, w: altW, h }, wide };
}

export function fitType(text: string, maxW: number, cap: number, min: number) {
  const len = Math.max(1, [...text].length);
  return Math.max(min, Math.min(cap, Math.floor(maxW / (len * 0.56))));
}
