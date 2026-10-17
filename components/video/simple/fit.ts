import { type Face, emWidth } from "../composer/art";

// Words fitted to their place: the biggest size at which they wrap into at
// most `lines` lines no wider than the place (a little kept spare: the
// estimate is rough). Never smaller than `min`; the last resort is that.

// (ok: false when even the smallest size does not fit its lines and width)
export type Fitted = { size: number; lines: number[][]; ok: boolean };

// While a plan is checked (check.ts): every fitting made, and whether it fitted.
export type FitNote = { text: string; ok: boolean; size: number };
let notes: FitNote[] | null = null;
export function noting<T>(run: () => T): { out: T; notes: FitNote[] } {
  notes = [];
  try {
    return { out: run(), notes };
  } finally {
    notes = null;
  }
}
const noted = (words: string[], f: Fitted): Fitted => (notes?.push({ text: words.join(" "), ok: f.ok, size: f.size }), f);

export function fitWords(words: string[], face: Face, { width, lines: most, max, min = 40, weight = 700 }: { width: number; lines: number; max: number; min?: number; weight?: number }): Fitted {
  const room = width * 0.92;
  const em = words.map((w) => emWidth(w, face, weight));
  const gap = emWidth(" ", face, weight) * 1.15;
  for (let size = max; size >= min; size -= 4) {
    const lines: number[][] = [[]];
    let used = 0;
    let ok = true;
    em.forEach((e, i) => {
      const w = e * size;
      if (w > room) ok = false;
      const line = lines[lines.length - 1];
      const add = line.length ? gap * size + w : w;
      if (line.length && used + add > room) {
        lines.push([i]);
        used = w;
      } else {
        line.push(i);
        used += add;
      }
    });
    if (ok && lines.length <= most) return noted(words, { size, lines: balanced(em.map((e) => e * size), gap * size, lines.length), ok: true });
  }
  // (the smallest size, as many lines as it takes)
  const lines: number[][] = [];
  let used = 0;
  em.forEach((e, i) => {
    const w = e * min;
    if (!lines.length || used + gap * min + w > room) {
      lines.push([i]);
      used = w;
    } else {
      lines[lines.length - 1].push(i);
      used += gap * min + w;
    }
  });
  return noted(words, { size: min, lines, ok: lines.length <= most && em.every((e) => e * min <= room) });
}

// The same words on the same number of lines, as even as they go (never one
// word left alone on the last line when it can be helped).
function balanced(widths: number[], gap: number, n: number): number[][] {
  if (n <= 1) return [widths.map((_, i) => i)];
  const lineW = (a: number, b: number) => widths.slice(a, b).reduce((s, w) => s + w, 0) + gap * (b - a - 1);
  let best: number[][] | null = null, bestMax = Infinity;
  const walk = (start: number, left: number, acc: number[][], worst: number) => {
    if (worst >= bestMax) return;
    if (left === 1) {
      const m = Math.max(worst, lineW(start, widths.length));
      if (m < bestMax) [best, bestMax] = [[...acc, range(start, widths.length)], m];
      return;
    }
    for (let end = start + 1; end <= widths.length - left + 1; end++) walk(end, left - 1, [...acc, range(start, end)], Math.max(worst, lineW(start, end)));
  };
  walk(0, n, [], 0);
  return best ?? [widths.map((_, i) => i)];
}
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);
