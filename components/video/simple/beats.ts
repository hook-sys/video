import { type Beat, FPS, type Word } from "./types";

// The voice cut into beats: one sentence each, a long one split at its
// comma or pause nearest the middle, a short one joined to the next — so
// every beat is 2.5–5 s, one idea the viewer can take in.

const LONG = 5.5, SHORT = 2.2, MAX = 5.5;
const ends = (w: Word) => /[.?!…]["'”’)]*$/.test(w.text);
const soft = (w: Word, next?: Word) => /[,;:—–-]["'”’)]*$/.test(w.text) || (!!next && next.start - w.end > 0.35);
const span = (words: Word[], b: Beat) => words[b.last].end - words[b.first].start;

export function beatsOf(words: Word[]): Beat[] {
  if (!words.length) return [];
  // sentences
  let out: Beat[] = [];
  let first = 0;
  words.forEach((w, i) => {
    if (ends(w) || i === words.length - 1) {
      out.push({ first, last: i });
      first = i + 1;
    }
  });
  // a long one: split at the soft break nearest its middle (again while long)
  const split = (b: Beat): Beat[] => {
    if (span(words, b) <= LONG || b.last - b.first < 5) return [b];
    const mid = (words[b.first].start + words[b.last].end) / 2;
    const cuts = Array.from({ length: b.last - b.first - 3 }, (_, k) => b.first + 2 + k);
    const soft1 = cuts.filter((i) => soft(words[i], words[i + 1]));
    const at = (soft1.length ? soft1 : cuts).reduce((a, i) => (Math.abs(words[i].end - mid) < Math.abs(words[a].end - mid) ? i : a));
    return [...split({ first: b.first, last: at }), ...split({ first: at + 1, last: b.last })];
  };
  out = out.flatMap(split);
  // a short one joins its shorter neighbour, never past MAX (else the other one; else it stays)
  for (let i = 0; i < out.length && out.length > 1; ) {
    const b = out[i];
    if (span(words, b) >= SHORT) {
      i++;
      continue;
    }
    const join = [i - 1, i + 1]
      .filter((j) => j >= 0 && j < out.length)
      .map((j) => ({ j, merged: { first: Math.min(b.first, out[j].first), last: Math.max(b.last, out[j].last) } }))
      .filter((x) => span(words, x.merged) <= MAX)
      .sort((x, y) => span(words, x.merged) - span(words, y.merged))[0];
    if (!join) {
      i++;
      continue;
    }
    out.splice(Math.min(i, join.j), 2, join.merged);
    i = Math.max(0, Math.min(i, join.j));
  }
  return out;
}

// Each beat's frames: it starts a little before its first word (the first at
// 0) and runs to the next one; the last runs to the end of the video.
export function framesOf(words: Word[], beats: Beat[], duration: number): { from: number; to: number }[] {
  const starts = beats.map((b, i) => (i ? Math.max(0, Math.round(words[b.first].start * FPS) - 6) : 0));
  return beats.map((_, i) => ({ from: starts[i], to: i < beats.length - 1 ? starts[i + 1] : duration }));
}

// a video's length: the voice and a held ending
export const durationOf = (words: Word[]) => Math.round(((words.at(-1)?.end ?? 0) + 1.6) * FPS);
