import type { Word } from "./types";

// Matching script words to the voice's words. The voice's transcript can
// split one word into pieces ("sa" "les") or carry punctuation as its own
// token ("."), so a phrase word may span up to three voice tokens.
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// For each word of `phrase`, the index of its first voice token (the first
// match at or after `after` seconds); throws when the phrase is not spoken.
export function findPhrase(words: Word[], phrase: string, after = 0): number[] {
  const want = phrase.split(/\s+/).map(norm).filter(Boolean);
  const toks = words.map((w, i) => ({ t: norm(w.text), i })).filter((x) => x.t);
  for (let k = 0; k < toks.length; k++) {
    if (words[toks[k].i].start < after) continue;
    const hit: number[] = [];
    let j = k;
    for (const w of want) {
      let acc = "";
      const first = j;
      while (j < toks.length && acc.length < w.length && j - first < 3) acc += toks[j++].t;
      if (acc !== w) break;
      hit.push(toks[first].i);
    }
    if (hit.length === want.length) return hit;
  }
  throw new Error(`phrase not in the voice: ${phrase}`);
}
