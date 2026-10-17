import { searchIcons } from "@/lib/icons";
import type { Beat, Intent, Item, Reading, Word } from "./types";

// A beat read by rule: for the template gallery, local tests and the
// side-by-side comparisons — videos for customers are read by the AI
// (lib/simple/brain.ts).

const STOP = new Set("a an the and or but so of to in on at for with by from is are was were be been it its this that these those your you our we they their there here what when how why who all any each every no not just more most very can will do does did have has had get gets got into onto than then also only".split(" "));
const clean = (t: string) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
const isWord = (t: string) => clean(t).length > 2 && !STOP.has(clean(t).toLowerCase());

const PAIN = /\b(still|tired|lost|lose|losing|miss|missed|missing|manual|chaos|messy|scattered|endless|slow|stuck|hard|without|no more|problem|struggle|juggling|spreadsheets?)\b/i;
const STEP = /\b(first|then|next|finally|step|steps|three|simple|in minutes)\b/i;

function intentOf(text: string, i: number, n: number, brand: string): Intent {
  if (i === n - 1) return "cta";
  if (i === 0) return "hook";
  if (/\d/.test(text)) return "proof";
  if (brand && text.toLowerCase().includes(brand.toLowerCase())) return "solution";
  if (PAIN.test(text) && i < n / 2) return "problem";
  if (STEP.test(text)) return "steps";
  return "feature";
}

export function guessReadings(words: Word[], beats: Beat[], brand: string): Reading[] {
  return beats.map((b, i) => {
    const text = words.slice(b.first, b.last + 1).map((w) => w.text).join(" ");
    // the words shown: the longest run of real words (2–5), else the beat's first words
    let best: [number, number] = [b.first, Math.min(b.last, b.first + 3)];
    for (let s = b.first; s <= b.last; s++) {
      let e = s;
      while (e + 1 <= b.last && e - s < 4 && (isWord(words[e + 1].text) || clean(words[e + 1].text).length <= 3) && !/[.?!,]$/.test(words[e].text)) e++;
      const real = words.slice(s, e + 1).filter((w) => isWord(w.text)).length;
      const was = words.slice(best[0], best[1] + 1).filter((w) => isWord(w.text)).length;
      if (isWord(words[s].text) && e > s && real > was) best = [s, e];
    }
    const shown = words.slice(best[0], best[1] + 1);
    const key = best[0] + shown.reduce((k, w, j) => (clean(w.text).length > clean(shown[k].text).length ? j : k), 0);
    const things = [...new Set(words.slice(b.first, b.last + 1).map((w) => clean(w.text)).filter((t) => isWord(t) && !/\d/.test(t)))];
    const items: Item[] = things.slice(0, 3).map((t) => ({ text: t.charAt(0).toUpperCase() + t.slice(1), icon: searchIcons(t, 1)[0] ?? null }));
    const number = words.slice(b.first, b.last + 1).map((w) => clean(w.text)).find((t) => /\d/.test(t)) ?? null;
    return { intent: intentOf(text, i, beats.length, brand), show: best, key, icon: searchIcons(text, 1)[0] ?? "sparkles", items, number };
  });
}
