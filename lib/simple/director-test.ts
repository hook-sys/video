import "server-only";
import { beatsOf } from "@/components/video/simple/beats";
import type { Intent, Reading, Word } from "@/components/video/simple/types";
import type { BriefUsage } from "@/lib/ai/product-brief";
import type { RoleAi } from "@/lib/v2/models";
import { readBeats } from "./brain";
import CASES from "./director-cases.json";

// The Director's test set: real scripts read by a model, every beat scored
// against what a good reading is (director-cases.json) — so a model, its
// reasoning or the prompt is chosen by its score, not by a guess.
//
// Per beat (100): the intent fits (30), the words shown lie inside the run
// that may be shown and are 2–6 of them (25), the key fits (15), the things
// it should name are named (20), the number is the one said (10).

export type GoldBeat = { intent: Intent[]; show: [number, number]; key: number[]; items: string[]; number: string | null };
export type TestCase = { id: string; brand: string; words: Word[]; beats: GoldBeat[] };
export type BeatScore = { beat: number; score: number; said: string; got: string; misses: string[] };
export type CaseScore = { id: string; brand: string; score: number; beats: BeatScore[]; ms: number; error?: string };
export type TestRun = { model: string; reasoning: string; temperature: number | null; score: number; cases: CaseScore[]; ms: number; inputTokens: number; outputTokens: number };

export const DIRECTOR_CASES = (CASES as unknown as { cases: TestCase[] }).cases;

const low = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, " ").trim();

export function scoreReading(words: Word[], gold: GoldBeat, r: Reading, beat: number, first: number, last: number): BeatScore {
  const misses: string[] = [];
  const intent = gold.intent.includes(r.intent) ? 1 : 0;
  if (!intent) misses.push(`intent ${r.intent} (fits: ${gold.intent.join("/")})`);
  // the words shown: inside the run that may be shown, 2–6 of them
  const [a, b] = r.show;
  const n = b - a + 1;
  const inside = Math.max(0, Math.min(b, gold.show[1]) - Math.max(a, gold.show[0]) + 1) / Math.max(1, n);
  const show = inside * (n >= 2 && n <= 6 ? 1 : 0.5);
  if (show < 1) misses.push(`shows "${words.slice(a, b + 1).map((w) => w.text).join(" ")}"`);
  const key = r.key !== null && gold.key.includes(r.key) ? 1 : r.key !== null && r.key >= gold.show[0] && r.key <= gold.show[1] ? 0.5 : 0;
  if (key < 1) misses.push(`key "${r.key === null ? "none" : words[r.key]?.text}"`);
  // the things it should name (a thing named when its words are in one of the answer's)
  const got = r.items.map((x) => low(x.text));
  const named = gold.items.filter((t) => got.some((x) => x.includes(low(t)) || low(t).split(" ").every((w) => x.includes(w))));
  const items = gold.items.length ? named.length / gold.items.length : 1;
  if (items < 1) misses.push(`things: missed ${gold.items.filter((t) => !named.includes(t)).join(", ")}`);
  const number = low(r.number ?? "") === low(gold.number ?? "") ? 1 : 0;
  if (!number) misses.push(`number ${r.number ?? "none"} (said: ${gold.number ?? "none"})`);
  return {
    beat,
    score: Math.round(30 * intent + 25 * show + 15 * key + 20 * items + 10 * number),
    said: words.slice(first, last + 1).map((w) => w.text).join(" "),
    got: `${r.intent} · "${words.slice(a, b + 1).map((w) => w.text).join(" ")}"${r.items.length ? ` · ${r.items.map((x) => x.text).join(", ")}` : ""}${r.number ? ` · ${r.number}` : ""}`,
    misses,
  };
}

export function scoreCase(c: TestCase, readings: Reading[]): number {
  const beats = beatsOf(c.words);
  const scores = beats.map((b, i) => (readings[i] ? scoreReading(c.words, c.beats[i], readings[i], i + 1, b.first, b.last).score : 0));
  return Math.round(scores.reduce((s, x) => s + x, 0) / Math.max(1, scores.length));
}

// Every case read by the model (a few at a time), scored
export async function runDirectorTest(ai: RoleAi, cases: TestCase[] = DIRECTOR_CASES): Promise<TestRun> {
  const started = Date.now();
  const usage: BriefUsage[] = [];
  const out: CaseScore[] = [];
  const one = async (c: TestCase): Promise<CaseScore> => {
    const t0 = Date.now();
    const beats = beatsOf(c.words);
    try {
      const { readings } = await readBeats(c.words, beats, c.brand, ai, (u) => usage.push(u), 120_000);
      const scored = beats.map((b, i) => scoreReading(c.words, c.beats[i], readings[i], i + 1, b.first, b.last));
      return { id: c.id, brand: c.brand, score: Math.round(scored.reduce((s, x) => s + x.score, 0) / Math.max(1, scored.length)), beats: scored, ms: Date.now() - t0 };
    } catch (e) {
      return { id: c.id, brand: c.brand, score: 0, beats: [], ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 200) : String(e) };
    }
  };
  for (let i = 0; i < cases.length; i += 5) out.push(...(await Promise.all(cases.slice(i, i + 5).map(one))));
  return {
    model: ai.model,
    reasoning: ai.reasoning,
    temperature: ai.temperature,
    score: Math.round(out.reduce((s, c) => s + c.score, 0) / Math.max(1, out.length)),
    cases: out,
    ms: Date.now() - started,
    inputTokens: usage.reduce((s, u) => s + u.inputTokens, 0),
    outputTokens: usage.reduce((s, u) => s + u.outputTokens, 0),
  };
}
