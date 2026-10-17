import { rng } from "../composer/art";
import { framesOf } from "./beats";
import { type Beat, type Brand, FPS, GROUNDS, type Ground, PACES, type Reading, type Scene, type SimplePlan, TYPE_PAIRS, type TemplateId, type Theme, VARIANTS, WAYS, type Word } from "./types";

// The selector: each beat's template and variant, and the video's theme —
// drawn from a seed, never the same template twice in a row, and unlike
// this customer's last videos in what a viewer sees (docs/video-spec.md).

// what each intent can be played as, with how often (a template that needs
// things — tiles, steps, chips — only when the beat has them): the same
// script drawn again tells a beat another way
function choices(r: Reading): [TemplateId, number][] {
  const many = r.items.length >= 2;
  switch (r.intent) {
    case "hook": return many ? [["statement", 0.6], ["trouble", 0.4]] : [["statement", 1]];
    case "problem": return many ? [["trouble", 0.65], ["statement", 0.35]] : [["statement", 1]];
    case "solution": return many ? [["reveal", 0.6], ["feature", 0.2], ["statement", 0.2]] : [["reveal", 0.7], ["statement", 0.3]];
    case "feature": return many ? [["feature", 0.55], ["steps", 0.2], ["statement", 0.25]] : [["statement", 1]];
    case "proof": return r.number ? [["stat", 1]] : many ? [["feature", 0.6], ["statement", 0.4]] : [["statement", 1]];
    case "steps": return many ? [["steps", 0.7], ["feature", 0.3]] : [["statement", 1]];
    case "cta": return [["cta", 1]];
  }
}
// one of them by its weight, never the one before (unless it is all there is)
function pickOf(list: [TemplateId, number][], prev: TemplateId | null, R: ReturnType<typeof rng>): TemplateId {
  const open = list.filter(([t]) => t !== prev);
  const from = open.length ? open : list;
  let x = R.next() * from.reduce((a, [, w]) => a + w, 0);
  for (const [t, w] of from) if ((x -= w) <= 0) return t;
  return from[from.length - 1][0];
}

// a colour too grey to fill the ground with
function grey(hex: string): boolean {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(r, g, b) - Math.min(r, g, b) < 40;
}

function draw(words: Word[], beats: Beat[], readings: Reading[], brand: Brand, seed: number, duration: number): Omit<SimplePlan, "w" | "h"> {
  const R = rng(seed);
  const grounds: Ground[] = grey(brand.color) ? GROUNDS.filter((g) => g !== "brand") : [...GROUNDS];
  const theme: Theme = { ground: R.pick(grounds), type: R.int(0, TYPE_PAIRS.length - 1), way: R.pick(WAYS), pace: R.pick(PACES) };
  const frames = framesOf(words, beats, duration);
  let prev: TemplateId | null = null;
  const scenes: Scene[] = readings.map((r, i) => {
    // (the last beat is always the brand and the ask)
    const list: [TemplateId, number][] = i === readings.length - 1 ? [["cta", 1]] : choices(r).filter(([t]) => t !== "cta");
    const template = pickOf(list, prev, R);
    prev = template;
    // (a variant that needs things only when there are some)
    let variant = R.int(0, VARIANTS - 1);
    if (template === "reveal" && r.items.length < 2) variant = 0;
    const shown = words.slice(r.show[0], r.show[1] + 1);
    // (the words come in as they are said — never later than half a second into the scene: no empty start)
    const late = Math.max(0, Math.round((shown[0]?.start ?? 0) * FPS) - (frames[i].from + 15));
    return {
      ...frames[i],
      template,
      variant,
      left: R.chance(0.5),
      words: shown.map((w, k) => ({ t: shownWord(w.text, k, shown.length), at: Math.max(frames[i].from, Math.round(w.start * FPS) - late), key: r.show[0] + k === r.key })),
      icon: r.icon ?? "sparkles",
      items: r.items.slice(0, 3),
      number: r.number,
    };
  });
  const print = [theme.ground, theme.type, theme.way, theme.pace, scenes.map((s) => `${s.template[0]}${s.variant}`).join("")].join("|");
  return { engine: "simple", v: 1, duration, seed, brand, theme, scenes, print };
}

// a word as shown: the first capitalised, the last without a trailing comma or colon
function shownWord(t: string, k: number, n: number): string {
  let out = k === n - 1 ? t.replace(/[,;:—–-]+$/, "") : t;
  if (k === 0) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

// how many of ground, type, transitions, pace and template order differ
export function differs(a: string, b: string): number {
  const x = a.split("|"), y = b.split("|");
  return x.reduce((n, v, i) => n + (v !== y[i] ? 1 : 0), 0);
}

// The video: the first of 12 draws unlike the recent ones in at least 3 ways
// (else the most unlike).
export function planOf({ words, beats, readings, brand, seed, duration, recent = [], size = [1920, 1080] }: { words: Word[]; beats: Beat[]; readings: Reading[]; brand: Brand; seed: number; duration: number; recent?: string[]; size?: [number, number] }): SimplePlan {
  let best: Omit<SimplePlan, "w" | "h"> | null = null, bestScore = -1;
  for (let k = 0; k < 12; k++) {
    const p = draw(words, beats, readings, brand, (seed + k * 7919) >>> 0, duration);
    const score = recent.length ? Math.min(...recent.map((r) => differs(p.print, r))) : 5;
    if (score > bestScore) [best, bestScore] = [p, score];
    if (score >= 3) break;
  }
  return { ...best!, w: size[0], h: size[1] };
}
