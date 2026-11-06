import { searchIcons } from "@/lib/icons";
import { bare, hasDigit, leadsBn, numberInWords, trailsBn } from "./bangla";
import { wordIcon } from "./motion";
import type { Beat, Concept, Intent, Item, Reading, Word } from "./types";

// A beat read by rule — the Director when no AI is connected or it fails
// (a video is made all the same: lib/v2/pipeline.ts), and for the template
// gallery, local tests and the side-by-side comparisons. A Bangla script is
// read by its own rules (readBangla below).

const STOP = new Set("a an the and or but so of to in on at for with by from is are was were be been it its this that these those your you our we they their there here what when how why who all any each every no not just more most very can will do does did have has had get gets got into onto than then also only".split(" "));
const clean = (t: string) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
const isWord = (t: string) => clean(t).length > 2 && !STOP.has(clean(t).toLowerCase());

const PAIN = /\b(nothing|never|takes hours|hours of|too expensive|costs too|still|tired|lost|lose|losing|miss|missed|missing|manual|chaos|messy|scattered|endless|slow|stuck|hard|without|no more|problem|struggle|juggling|spreadsheets?)\b/i;
const STEP = /\b(first|then|next|finally|step|steps|three|simple|in minutes)\b/i;

// the idea a beat's words picture, by their words (the truth: "X is just Y", its two words)
const IDEAS: [Concept, RegExp][] = [
  ["trapped", /\b(trapped|stuck|locked (in|up|away)|boxed in|held back|caged)\b/i],
  ["chaos", /\b(chaos|chaotic|mess|messy|scattered|cluttered|juggling|all over the place|overwhelm\w*|organi[sz]e\w*)\b/i],
  ["waiting", /\b(wait|waits|waiting|delay\w*|takes forever|loading|slow|weeks to|days to)\b/i],
  ["hours", /\b(hours|all day|all week|time-consuming|in minutes|minutes instead)\b/i],
  ["cost", /\b(costs?|costly|expensive|overpay\w*|fees|pricey|budget)\b/i],
  ["launch", /\b(launch\w*|take off|takes off|lift ?off|go live|ship it|skyrocket\w*)\b/i],
  ["progress", /\b(goals?|targets?|milestones?|progress|on track|finish line)\b/i],
];
// "no X, no Y" — what stands in the way, its things
const THING = String.raw`(\p{L}+(?:\s+(?!(?:and|or|no|needed|required)\b)\p{L}+)?)`;
const BARRIERS = new RegExp(String.raw`\bno\s+${THING}[,;]?\s+(?:and\s+|or\s+)?no\s+${THING}(?:[,;]?\s+(?:and\s+|or\s+)?no\s+${THING})?`, "iu");
const TRUTH = /\b(\p{L}+)\s+(?:is|are)\s+(?:(?:just|only|really|actually|simply|basically|nothing but)\s+)+(?:(?:being|a|an|the)\s+)?(\p{L}+)/iu;
function ideaOf(text: string): { concept: Concept; items?: Item[] } | null {
  const t = TRUTH.exec(text);
  if (t && !STOP.has(t[1].toLowerCase()) && !STOP.has(t[2].toLowerCase())) return { concept: "truth", items: [t[1], t[2]].map((x) => ({ text: x.charAt(0).toUpperCase() + x.slice(1), icon: null })) };
  const b = BARRIERS.exec(text);
  if (b) return { concept: "barriers", items: b.slice(1).filter(Boolean).map((x) => x.replace(/[.,;!?]+$/, "")).map((x) => ({ text: x.charAt(0).toUpperCase() + x.slice(1), icon: searchIcons(x, 1)[0] ?? null })) };
  const hit = IDEAS.find(([, re]) => re.test(text));
  return hit ? { concept: hit[0] } : null;
}

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
  if (words.some((w) => /[\u0980-\u09FF]/.test(w.text))) return readBangla(words, beats, brand);
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
    const idea = i < beats.length - 1 ? ideaOf(text) : null;
    return { intent: intentOf(text, i, beats.length, brand), show: best, key, icon: searchIcons(text, 1)[0] ?? "sparkles", items: idea ? (idea.items ?? []) : items, number, ...(idea ? { concept: idea.concept } : {}) };
  });
}

// ── Bangla ────────────────────────────────────────────────────────────────
// (words that carry nothing on screen alone: pronouns, the verbs that only join)
const BN_STOP = new Set("আপনি আপনার আপনাকে আমি আমরা আমাদের আমার তুমি তোমার সে তারা তাদের তার এটা এটি ওটা যা যে যারা যাদের এখানে সেখানে এখন তখন হয় হবে হলে হলেই হয়ে হচ্ছে হচ্ছেন ছিল আছে আছেন নেই করতে করে করুন করেন করছেন করবেন করছে করা পারেন পারবেন যায় যাবে দিয়ে নিয়ে থেকে জন্য সাথে মধ্যে কি কী কেন কোন কোনো কত কতটা খুব আরও অনেক শুধু মাত্র সব সকল একটি একটা প্রতিটি এবং ও আর বা কিন্তু তবে তাই কারণ যদি তাহলে মনে রাখবেন ধরুন".split(" "));
const content = (t: string) => {
  const w = bare(t);
  return w.length >= 2 && !BN_STOP.has(w) && !leadsBn(t) && !trailsBn(t);
};
// (a verb's form — আসছে, থাকেন, কমাবেন, দেখছেন: on screen a caption reads better on its nouns)
const verbish = (t: string) => /(ছেন|চ্ছে|ছে|বেন|েন|ুন|তে|লে|িনি|বে)$/.test(bare(t)) && !wordIcon(t);
// (the light verbs that make a verb of the word before: "অপ্টিমাইজ করতে", "যোগ করছেন")
const LIGHT = new Set("করতে করুন করে করেন করছেন করবেন করছে করা হবে হয় হচ্ছে হচ্ছেন দিন নিন দেখুন".split(" "));
const BN_PAIN = /(সমস্যা|ঝামেলা|কষ্ট|ভুল|হারা|নষ্ট|অপচয়|পারছেন না|হচ্ছে না|হয় না|আটকে|এলোমেলো|দেরি|অপেক্ষা|খরচ বেশি|বেশি খরচ|ব্যয়বহুল|জটিল|চিন্তা|দুশ্চিন্তা|এখনো|এখনও|আর কত)/;
const BN_STEP = /(প্রথমে|তারপর|এরপর|শেষে|ধাপ|প্রথমত|দ্বিতীয়ত|তৃতীয়ত|চতুর্থত|পঞ্চমত)/;
const BN_IDEAS: [Concept, RegExp][] = [
  ["trapped", /(আটকে|আটকা|বন্দি|আটকে আছে)/],
  ["chaos", /(এলোমেলো|বিশৃঙ্খল|ছড়িয়ে ছিটিয়ে|ছড়িয়ে আছে|গোছানো|গুছিয়ে|গোছাতে)/],
  ["waiting", /(অপেক্ষা|দেরি|ধীরগতি|লোডিং|সময় লাগে|অনেক দিন)/],
  ["hours", /(ঘণ্টার পর ঘণ্টা|ঘণ্টা|সারাদিন|মিনিটেই|মিনিটে|সময় নষ্ট)/],
  ["cost", /(খরচ|ব্যয়|কস্ট|দামি|ব্যয়বহুল|বাজেট|টাকা নষ্ট)/],
  ["launch", /(লঞ্চ|যাত্রা শুরু|শুরু করুন|এগিয়ে যান|উড়ান)/],
  ["progress", /(লক্ষ্য|টার্গেটে পৌঁছ|অগ্রগতি|মাইলফলক|ধাপে ধাপে)/],
];
// "X আসলে Y" / "X মানেই Y": one thing that is really another
const BN_TRUTH = /(\S+)\s+(?:আসলে|মানেই|মানে)\s+(?:শুধুই?\s+)?(\S+)/u;
// what stands in the way: "X লাগবে না" — two or more, or "X, Y ছাড়াই"
const BN_NEED = /((?:\S+\s+)?\S+?)\s+(?:লাগবে না|লাগে না|দরকার নেই|দরকার হবে না|প্রয়োজন নেই)/gu;

// a list said in the beat: its parts between commas and "এবং/ও/আর/বা/অথবা", each 1–3 words
function listOf(ws: string[]): string[] {
  const parts: string[][] = [[]];
  for (const w of ws) {
    const b = bare(w);
    if (["এবং", "ও", "আর", "বা", "অথবা", "কিংবা"].includes(b)) {
      if (parts[parts.length - 1].length) parts.push([]);
      continue;
    }
    parts[parts.length - 1].push(w.replace(/[,;।?!]+$/u, ""));
    if (/[,;]$/.test(w)) parts.push([]);
  }
  // (a part ends where a verb begins: "সেলস কপি অপ্টিমাইজ করতে হবে" → "সেলস কপি")
  const cut = parts.map((p) => {
    const v = p.findIndex((w, k) => LIGHT.has(bare(w)) || (k + 1 < p.length && LIGHT.has(bare(p[k + 1]))));
    return v >= 0 ? p.slice(0, v) : p;
  });
  // (a part of a list is a short thing — at most 3 words as said, none a question word, at least one that carries something)
  // (nor an ordinal — "প্রথমত" — nor a "not")
  const ASK = new Set("কখন কত কতগুলো কতজন কোন কোথায় কীভাবে কেন কী কি প্রথমত দ্বিতীয়ত তৃতীয়ত চতুর্থত পঞ্চমত নয় না".split(" "));
  const short = cut.map((p) => (p.length >= 1 && p.length <= 3 && !p.some((w) => ASK.has(bare(w))) && p.some(content) ? p.filter(content).join(" ") : null));
  // the longest run of short parts in a row (two or more), its first three
  let best: string[] = [], run: string[] = [];
  for (const x of short) {
    run = x ? [...run, x] : [];
    if (run.length > best.length) best = run;
  }
  return best.length >= 2 ? best.slice(0, 3) : [];
}
// (nor starting on a conjunction)
const CONJ = new Set("এবং ও আর বা অথবা কিংবা কিন্তু তবে".split(" "));
const iconOfBn = (ws: string[]) => ws.map((w) => wordIcon(w)).find(Boolean) ?? null;

function readBangla(words: Word[], beats: Beat[], brand: string): Reading[] {
  const brandBare = bare(brand);
  return beats.map((b, i): Reading => {
    const ws = words.slice(b.first, b.last + 1).map((w) => w.text);
    const text = ws.join(" ");
    const last = i === beats.length - 1;
    const number = ws.map((t) => t.replace(/[,।?!]+$/u, "")).find((t) => hasDigit(t) && /[০-৯0-9]/.test(t)) ?? numberInWords(ws);
    const intent: Intent = last ? "cta" : i === 0 ? "hook" : number ? "proof" : brandBare && ws.some((w) => bare(w).includes(brandBare)) ? "solution" : BN_PAIN.test(text) && i < beats.length / 2 ? "problem" : BN_STEP.test(text) ? "steps" : "feature";
    // the words shown: the run of 2–4 that carries most (content words, an icon's word worth more),
    // never starting on a word that follows the one before nor ending on one that leads the next
    let best: [number, number] = [b.first, Math.min(b.last, b.first + 2)], bestScore = -1;
    for (let s0 = b.first; s0 <= b.last; s0++) {
      for (let e = s0 + 1; e <= Math.min(b.last, s0 + 3); e++) {
        if (trailsBn(words[s0].text) || leadsBn(words[e].text) || BN_STOP.has(bare(words[s0].text)) || BN_STOP.has(bare(words[e].text)) || CONJ.has(bare(words[s0].text))) continue;
        // (a run never spans a sentence's or a phrase's end inside it)
        if (words.slice(s0, e).some((w) => /[,;।?!]$/.test(w.text))) continue;
        const run = words.slice(s0, e + 1).map((w) => w.text);
        const score = run.filter(content).length * 2 - run.filter(verbish).length * 1.6 - (verbish(run[run.length - 1]) ? 1.5 : 0) + run.filter((t) => wordIcon(t)).length + (e - s0) * 0.3 - (s0 - b.first) * 0.05;
        if (score > bestScore) [best, bestScore] = [[s0, e], score];
      }
    }
    const shown = words.slice(best[0], best[1] + 1);
    // the lit word: one an icon stands for, else the longest that carries something
    const lit = shown.findIndex((w) => wordIcon(w.text));
    const longest = shown.reduce((k, w, j) => (content(w.text) && bare(w.text).length > bare(shown[k].text).length ? j : k), 0);
    const key = best[0] + (lit >= 0 ? lit : longest);
    // an idea its words picture; the truth's and the barriers' things are their own words
    let concept: Concept | undefined;
    let items: Item[] = [];
    const t = last ? null : BN_TRUTH.exec(text);
    const needs = last ? [] : [...text.matchAll(BN_NEED)].map((m) => m[1].split(/\s+/).filter(content).join(" ")).filter(Boolean);
    if (t && content(t[1]) && content(t[2])) {
      concept = "truth";
      items = [t[1], t[2]].map((x) => ({ text: x.replace(/[,।?!]+$/u, ""), icon: null }));
    } else if (needs.length >= 2) {
      concept = "barriers";
      items = needs.slice(0, 3).map((x) => ({ text: x, icon: iconOfBn(x.split(" ")) }));
    } else {
      concept = last ? undefined : BN_IDEAS.find(([, re]) => re.test(text))?.[0];
      const unit = number?.endsWith("%") ? "%" : "";
      items = listOf(ws).map((x) => {
        const n = numberInWords([x, ...(unit ? ["শতাংশ"] : ["হাজার"])]);
        // (a number word listed — "পঁচিশ" — as its digits, with the sentence's % when it has one)
        return { text: n && unit ? n : x, icon: n ? null : iconOfBn(x.split(" ")) };
      });
    }
    const icon = iconOfBn(ws) ?? ({ hook: "sparkles", problem: "triangle-alert", solution: "rocket", feature: "circle-check", proof: "trending-up", steps: "list-checks", cta: "arrow-right" } as Record<Intent, string>)[intent];
    return { intent, show: best, key, icon, items, number, ...(concept ? { concept } : {}) };
  });
}