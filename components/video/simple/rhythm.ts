import { litInTime, wordsAlone } from "./select";
import type { Scene } from "./types";

// The rhythm of a scene (docs/video-spec.md): the promos change what is on
// screen every 1.5–3 s, and our scenes held one picture for 4–13 s. So the
// voice is cut into phrases — at its punctuation and its pauses, at most 5
// words, never ending on a little word — and the picture changes on each:
// words on screen alone show the whole line phrase by phrase, big; a scene
// with a hero cuts to a close-up of its hero on each new phrase, and back.

export type Phrase = { from: number; words: { t: string; at: number; key: boolean }[] };

const MOST = 5;
// (a pause the voice makes, in frames)
const PAUSE = 8;
const LITTLE = new Set(["a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "or", "by", "at", "from", "is", "are", "your", "our", "its", "that", "this", "but", "so", "as"]);
const bare = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const ends = (t: string) => /[,.!?;:—–]$/.test(t);

// where the lit word is in what the voice says (the words shown, found by their text)
function litIn(s: Scene): number {
  const said = s.said ?? [];
  const first = said.findIndex((_, i) => s.words.length > 0 && s.words.every((w, k) => said[i + k] && bare(said[i + k].t) === bare(w.t)));
  const k = s.words.findIndex((w) => w.key);
  return first >= 0 && k >= 0 ? first + k : -1;
}

export function phrasesOf(s: Scene): Phrase[] {
  const said = s.said ?? [];
  if (!said.length) return [];
  const lit = litIn(s);
  const runs: number[][] = [];
  let run: number[] = [];
  said.forEach((w, i) => {
    run.push(i);
    const next = said[i + 1];
    const cut = !next || ends(w.t) || next.at - w.at >= PAUSE + 10 || run.length >= MOST;
    if (!cut) return;
    // (never ending on a little word: it goes on to the next phrase)
    if (next && run.length > 1 && LITTLE.has(bare(w.t)) && !ends(w.t)) {
      run.pop();
      runs.push(run);
      run = [i];
      return;
    }
    runs.push(run);
    run = [];
  });
  if (run.length) runs.push(run);
  // (a phrase of one little word joins the one before)
  const merged = runs.reduce<number[][]>((out, r) => (out.length && r.length === 1 && LITTLE.has(bare(said[r[0]].t)) ? (out[out.length - 1].push(...r), out) : (out.push(r), out)), []);
  // (the first phrase in by 4 frames into the scene — never an empty start — and each later
  // one's first word in as the phrase before goes: a cut, never an empty frame between)
  const late = Math.max(0, said[merged[0][0]].at - (s.from + (s.from ? 4 : 0)));
  const out = merged.map((r, k) => {
    const from = k ? Math.max(s.from, said[r[0]].at - 4) : s.from;
    return {
      from,
      // (as said: its own capitals, a comma at its end dropped)
      words: r.map((i, j) => ({ t: j === r.length - 1 ? said[i].t.replace(/[,;:—–]$/, "") : said[i].t, at: k ? (j ? said[i].at : from) : Math.max(s.from, said[i].at - late), key: i === lit })),
    };
  });
  // (the phrase with the lit word in, sooner when the word would be on screen less than 1 s — select.ts litInTime)
  const p = out.findIndex((x) => x.words.some((w) => w.key));
  if (p > 0) {
    const words = litInTime(out[p].words, s.from, s.to);
    const by = out[p].words.findIndex((w) => w.key) >= 0 ? out[p].words.find((w) => w.key)!.at - words.find((w) => w.key)!.at : 0;
    if (by > 0) {
      out[p] = { from: Math.max(out[p - 1].from + 12, out[p].from - by), words };
      out[p].words = out[p].words.map((w, j) => (j ? w : { ...w, at: out[p].from }));
    }
  } else if (p === 0) out[0] = { ...out[0], words: litInTime(out[0].words, s.from, s.to) };
  return out;
}

// The words alone, the whole line phrase by phrase: a big-words scene whose
// beat says more than its words (not the prompt bar, not one word at a time)
export const phraseMode = (s: Scene) => wordsAlone(s.template, s.variant) && !(s.template === "kinetic" && s.variant !== 2) && (s.said?.length ?? 0) > s.words.length && phrasesOf(s).length >= 2;

// A scene with a hero: the frames its camera punches on (each new phrase, a second apart, not at its ends)
export function punchesOf(s: Scene): number[] {
  if (phraseMode(s) || wordsAlone(s.template, s.variant)) return [];
  const out: number[] = [];
  for (const p of phrasesOf(s).slice(1)) if (p.from >= s.from + 24 && p.from <= s.to - CLOSE - 20 && (!out.length || p.from - out[out.length - 1] >= 30)) out.push(p.from);
  return out;
}

// how close on its hero the camera is now (0 wide, 1 close): in on a new
// phrase quickly, like a cut, held up to 1.3 s, then back out — always wide at the end
const CLOSE = 40;
export function closeAt(s: Scene, f: number): number {
  const ps = punchesOf(s);
  const k = ps.findLastIndex((b) => f >= b);
  if (k < 0) return 0;
  const b = ps[k], end = Math.min(ps[k + 1] ?? Infinity, b + CLOSE);
  const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 2);
  return f < end ? ease((f - b) / 4) : 1 - ease((f - end) / 5);
}
