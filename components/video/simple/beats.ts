import { retimeScript } from "@/lib/voice-timing";
import { asksBn, closesBn, ordinalOf } from "./bangla";
import { type Beat, FPS, type Point, type Word } from "./types";

// The voice cut into beats: one sentence each, a long one split at its
// comma or pause nearest the middle, a short one joined to the next — so
// every beat is 2.5–5 s, one idea the viewer can take in. The last sentence
// is the last beat on its own (the brand and the ask): nothing before it is
// swallowed by it, except a name of a word or two said just before ("Orin ERP.").

const LONG = 5.5, SHORT = 2.2, MAX = 5.5;
// (a sentence ends at . ? ! … and at Bangla's । ॥)
const ends = (w: Word) => /[.?!…।॥]["'”’)]*$/.test(w.text);
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
    // (never inside a list — "ওয়েবসাইট, অফার, কনটেন্ট": a comma with another within three words either side)
    const commaAt = (i: number) => /[,;]["'”’)]*$/.test(words[i]?.text ?? "");
    // (Bangla scripts — the English test scripts keep the cuts their readings were made on)
    const inList = (i: number) => /[\u0980-\u09FF]/.test(words[i]?.text ?? "") && commaAt(i) && [1, 2, 3].some((d) => commaAt(i - d) || commaAt(i + d));
    // (nor between clauses said alike — "কতজন দেখছেন, কতজন কার্টে যোগ করছেন, আর কতজন…": the next opens on a word the last opened on)
    const word = (i: number) => (words[i]?.text ?? "").replace(/[^\p{L}\p{M}\p{N}]/gu, "");
    const alike = (i: number) => /[\u0980-\u09FF]/.test(words[i]?.text ?? "") && commaAt(i) && [1, 2].some((d) => [1, 2, 3, 4, 5].some((back) => word(i + d) !== "" && word(i + d) === word(i - back) && (i - back === 0 || commaAt(i - back - 1) || i - back === b.first)));
    const inList2 = (i: number) => inList(i) || alike(i);
    const soft1 = cuts.filter((i) => soft(words[i], words[i + 1]) && !inList2(i));
    const open = cuts.filter((i) => !inList2(i));
    // (a run of clauses said alike is one beat — a funnel, a list of questions — up to 8 s, rather than cut inside it)
    if (!soft1.length && cuts.some(alike) && span(words, b) <= 8) return [b];
    const at = (soft1.length ? soft1 : open.length ? open : cuts).reduce((a, i) => (Math.abs(words[i].end - mid) < Math.abs(words[a].end - mid) ? i : a));
    return [...split({ first: b.first, last: at }), ...split({ first: at + 1, last: b.last })];
  };
  // (the last sentence keeps its own beat, however long)
  const lastSentence = out.at(-1)!;
  out = [...out.slice(0, -1).flatMap(split), lastSentence];
  const words2 = (b: Beat) => b.last - b.first + 1;
  // (a point's opening — "প্রথমত, …" — is a beat of its own: never joined, nothing joined into it)
  const opens = (b: Beat) => ordinalOf(words[b.first].text) != null;
  // a short one joins its shorter neighbour, never past MAX (else the other one; else it stays)
  for (let i = 0; i < out.length && out.length > 1; ) {
    const b = out[i];
    if (span(words, b) >= SHORT || opens(b)) {
      i++;
      continue;
    }
    const join = [i - 1, i + 1]
      .filter((j) => j >= 0 && j < out.length)
      // (into the last beat only a name said just before it; the last beat into none)
      .filter((j) => (i < out.length - 1 && j < out.length - 1) || (i === out.length - 2 && j === out.length - 1 && words2(b) <= 2))
      .filter((j) => !opens(out[j]))
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

// The ask the voice ends on ("Book a free demo today.", "আজই অর্ডার করুন।") — the button's words,
// as said — or null when the last sentence asks nothing (no button then).
const ASKS = new Set(["book", "try", "start", "get", "sign", "join", "download", "install", "visit", "call", "contact", "request", "schedule", "order", "buy", "shop", "claim", "grab", "register", "subscribe", "apply", "chat", "talk", "message", "email", "text", "discover", "explore", "learn", "see", "watch", "upgrade", "switch"]);
export function askOf(words: Word[], b: Beat): string | null {
  let first = b.first;
  for (let i = b.first; i < b.last; i++) if (ends(words[i])) first = i + 1;
  const said = words.slice(first, b.last + 1).map((w) => w.text);
  const lead = said[0]?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? "";
  // (Bangla asks with its last word: "এখনই অর্ডার করুন")
  if (!said.length || said.length > 7 || !(ASKS.has(lead) || asksBn(said))) return null;
  return said.join(" ").replace(/[.!?…।॥]+["'”’)]*$/, "");
}

// Each beat's frames: it starts a little before its first word (the first at
// 0) and runs to the next one; the last runs to the end of the video.
export function framesOf(words: Word[], beats: Beat[], duration: number): { from: number; to: number }[] {
  const starts = beats.map((b, i) => (i ? Math.max(0, Math.round(words[b.first].start * FPS) - 6) : 0));
  return beats.map((_, i) => ({ from: starts[i], to: i < beats.length - 1 ? starts[i + 1] : duration }));
}

// a video's length: the voice and a held ending
export const durationOf = (words: Word[]) => Math.round(((words.at(-1)?.end ?? 0) + 1.6) * FPS);

// The script's own words on the voice's times. Some voices time pieces of
// words ("s" "upport") and the stops on their own ("."); shown as they come
// they read as broken words.
const letters = (t: string) => t.replace(/[^\p{L}\p{M}\p{N}]/gu, "").length;
export function scriptWords(script: string | null | undefined, voice: Word[]): Word[] {
  const heard = voice.filter((w) => letters(w.text) > 0);
  const text = (script ?? "").trim();
  if (!text || !heard.length) return voice;
  return retimeScript(text, heard) ?? voice;
}

// The points a script is told in (docs/video-spec.md, Points): each opens with its ordinal
// ("প্রথমত, …") and runs to the next — the last to the script's conclusion ("কারণ…", "মনে রাখবেন…")
// or the ask; its title the opening's words after the ordinal (at most five). Two points at least.
export function pointsOf(words: Word[], beats: Beat[]): ({ point: Point; open: boolean } | null)[] {
  const openers = beats.map((b, i) => (ordinalOf(words[b.first].text) != null ? i : -1)).filter((i) => i >= 0);
  if (openers.length < 2) return beats.map(() => null);
  const last = beats.length - 1;
  const end = (k: number) => {
    if (k + 1 < openers.length) return openers[k + 1] - 1;
    // (the last point: to the beat before the conclusion, or before the ask)
    const close = beats.findIndex((b, i) => i > openers[k] + 1 && i < last && closesBn(words[b.first].text));
    return close > 0 ? close - 1 : last - 1;
  };
  const out: ({ point: Point; open: boolean } | null)[] = beats.map(() => null);
  openers.forEach((o, k) => {
    const said = words.slice(beats[o].first + 1, beats[o].last + 1).map((w) => w.text.replace(/[,;:।.!?]+$/u, ""));
    const title = (said.length <= 6 ? said : said.slice(0, 5)).join(" ");
    const point: Point = { n: k + 1, of: openers.length, title };
    for (let i = o; i <= end(k); i++) out[i] = { point, open: i === o };
  });
  return out;
}
