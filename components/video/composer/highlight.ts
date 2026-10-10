import type { Word } from "./types";

// The words a scene shows: its hook, never the sentence the voice says — up
// to SHOWN words of the scene's own, in order (so each still comes in as it
// is said): the phrase that carries the scene (its key words, a spoken
// number, the thing named), never one starting or ending on a little word
// ("and", "the", "in").

export const SHOWN = 4;
// a pause: a clause or sentence ends on the word (the Bengali দাঁড়ি too)
const PAUSE = /[.,;:!?—–।]["”’)]*$/;
const STOP = /[.!?।]["”’)]*$/;
const LITTLE = new Set("a an and as at be but by for from in into is it its of on or so than that the then this to was we with you your our are will can just now also even still very really every each all some more most not".split(" "));
const bare = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}%$€£৳]/gu, "");
const NUMBER = /\d|^(one|two|three|four|five|six|seven|eight|nine|ten|twice|half|hundred|thousand)$/;

// [first, last] word index of the highlight inside [from, to].
export function highlightOf(words: Word[], from: number, to: number, keys: Set<string>): [number, number] {
  // (a few words in one sentence are shown as they are)
  if (to - from + 1 <= SHOWN && !words.slice(from, to).some((w) => STOP.test(w.text))) return [from, to];
  let best: [number, number] = [from, from + SHOWN - 1];
  let bestScore = -Infinity;
  for (let a = from; a <= to; a++) {
    for (let len = 2; len <= SHOWN && a + len - 1 <= to; len++) {
      const b = a + len - 1;
      const ws = words.slice(a, b + 1).map((w) => w.text);
      const plain = ws.map(bare);
      let score = 0;
      plain.forEach((w) => {
        if (keys.has(w)) score += 3.5;
        if (NUMBER.test(w)) score += 2.5;
        if (w.length > 2 && !LITTLE.has(w)) score += 1;
      });
      if (LITTLE.has(plain[0])) score -= 1.6;
      if (LITTLE.has(plain[len - 1])) score -= 2;
      // a phrase that ends where the voice stops or pauses reads as one
      if (b === to || PAUSE.test(ws[len - 1])) score += 1.2;
      // (before a little word it may still be mid-phrase: "gets | a confirmation")
      else if (LITTLE.has(bare(words[b + 1]?.text ?? ""))) score -= 1;
      // (never cut in the middle of a phrase: "one live | dashboard")
      else score -= 4;
      const starts = a === from || PAUSE.test(words[a - 1]?.text ?? "");
      if (starts) score += 0.8;
      // never across a sentence end
      // never across a sentence end (each one crossed counts)
      // (two very short sentences read as one: "No credit card. No time limit.")
      score -= ws.slice(0, -1).filter((w) => STOP.test(w)).length * (len <= 6 ? 1 : 6);
      // (the hook: two or three words read at a glance)
      score -= Math.abs(len - 2.5) * 0.6;
      if (score > bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
  }
  return best;
}

// A word as the highlight shows it: the first one capitalised (it may start
// mid-sentence), the last without a trailing comma or dash.
export function shownWord(t: string, first: boolean, last: boolean): string {
  let s = t;
  if (last) s = s.replace(/[,;:—–-]+$/, "");
  if (first && /^[a-z][a-z'’-]*[^a-z]*$/.test(s)) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s || t;
}
