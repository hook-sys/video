import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { resolveIcon } from "@/components/video/icons";
import { DEFAULT_CONTENT, type FilmContent } from "@/components/video/clean/content";
import { buildPlan, type SevenPart } from "@/components/video/clean/plan";
import type { Brand, CleanPlan, Word } from "@/components/video/clean/types";

// Clean Director: one AI call cuts the recorded narration into the seven
// parts the film templates play (hook, three things, reveal, an event that
// updates a number, growth seen by the team, two "no more" lines, the call to
// action), quoting the narration's own words, and writes what the product's
// cards show. The answer is checked against the voice (buildPlan); one
// revision on problems; then a plain fallback from the sentences. Never throws.

export const CLEAN_INSTRUCTIONS = `You plan a short explainer video for a software product. The narration is final and already recorded; you never change or add a word of it.

Cut the narration into SEVEN PARTS, in the order they are spoken, each quoting the narration EXACTLY (same words, same order, punctuation as written):
1. hook — the opening problem line. key: its one most important word. big: the noun the line is about (one word from the line, e.g. "data").
2. trio — the line naming three things (tools, places, steps, problems). items: exactly 3 { label: the thing as spoken (1–2 words from the line), sub: 2–4 words about it, icon: a Lucide icon name that pictures it (e.g. chart-line, credit-card, file-text, package, users, mail, calendar, receipt, boxes, message-square) }.
3. reveal — the line that brings in the product. name: the product's name as spoken (or the brand name if it is not spoken). sub: the rest of that line after the name. key: one word of sub.
4. pay — an EVENT that changes a number ("When a payment arrives, revenue updates instantly."). eyebrow: the event part ("When a payment arrives,"), title: the result part ("revenue updates instantly."), key: one word of title. pay: 1–3 words of the event when it happens; rev: 1–3 words when the number changes; inst: one word of the result's end.
5. growth — something grows and people see it. eyebrow, title, key as in pay. grow: 1–3 words where it grows; team: 1–3 words naming the people; zoom: 1–3 words near the end.
6. nomore — two short lines of what stops ("No more switching between tools." / "No more waiting for reports."). a, b: the two lines; aKey, bKey: one word of each.
7. cta — the closing line. tagline: the line; key: one word of it.

Rules:
- Every quoted text, eyebrow, title, line and word MUST appear in the narration exactly, and the parts follow the narration's order without overlapping. A part may be a phrase of a longer sentence (split at a comma), never a word that is not spoken.
- When the narration has no clear line for a part, use the closest line in its place in the order; eyebrow may be "" when the event and result are one phrase.
- Each part is at least about one second of speech.

CONTENT — what the product's own screens show (realistic for this product, never generic placeholders, never real people's photos; people are names only):
- metric { label, from, to, unit "$" | "%" | "" }: the number the pay event changes (from → to, a believable small change).
- event { label (2–3 words, e.g. "New order"), detail (an amount or count), source (who or what it came from: a company, an order id, a ticket), done (2–3 words after it, e.g. "Stock updated") }.
- rows: 3 earlier entries of the same list as event { name, value }.
- side: 2 more figures of the same screen { label, value }.
- growth { label, from, to, unit }: what grows in part 5 (to > from).
- people: 4 team members { name (first and last name), role }.
Keep every label short (1–4 words).
- tagline: the product's promise for the end card, 3–6 words (e.g. "Every answer you need").`;

const Item = z.object({ label: z.string(), sub: z.string(), icon: z.string() });
const Figure = z.object({ label: z.string(), from: z.number(), to: z.number(), unit: z.enum(["$", "%", ""]) });
export const CleanScriptModel = z.object({
  tagline: z.string(),
  hook: z.object({ text: z.string(), key: z.string(), big: z.string().nullable() }),
  trio: z.object({ text: z.string(), items: z.array(Item) }),
  reveal: z.object({ name: z.string(), sub: z.string(), key: z.string() }),
  pay: z.object({ eyebrow: z.string(), title: z.string(), key: z.string(), pay: z.string(), rev: z.string(), inst: z.string() }),
  growth: z.object({ eyebrow: z.string(), title: z.string(), key: z.string(), grow: z.string(), team: z.string(), zoom: z.string() }),
  nomore: z.object({ a: z.string(), aKey: z.string(), b: z.string(), bKey: z.string() }),
  cta: z.object({ tagline: z.string(), key: z.string() }),
  content: z.object({
    metric: Figure,
    event: z.object({ label: z.string(), detail: z.string(), source: z.string(), done: z.string() }),
    rows: z.array(z.object({ name: z.string(), value: z.string() })),
    side: z.array(z.object({ label: z.string(), value: z.string() })),
    growth: Figure,
    people: z.array(z.object({ name: z.string(), role: z.string() })),
  }),
});
export type CleanScriptOut = z.infer<typeof CleanScriptModel>;

export type CleanDirectorInput = { brand: Brand; words: Word[]; product?: string | null };
export type CleanDirectorResult = { plan: CleanPlan | null; script: SevenPart | null; source: "ai" | "revised" | "fallback" | "none"; problems: string[]; attempts: number; ms: number };

// Fill what the model may leave short (lists of the wrong length, unknown
// icons, a growth that does not grow) so the films always have what they draw.
export function tidyScript(out: CleanScriptOut, brand: Brand): SevenPart {
  const pad = <T,>(xs: T[], n: number, fill: T[]) => [...xs, ...fill].slice(0, n);
  const c = out.content;
  const content: FilmContent = {
    metric: c.metric,
    event: c.event,
    rows: pad(c.rows, 3, DEFAULT_CONTENT.rows),
    side: pad(c.side, 2, DEFAULT_CONTENT.side),
    growth: c.growth.to > c.growth.from ? c.growth : { ...c.growth, to: Math.round(c.growth.from * 1.27 + 1) },
    people: pad(c.people, 4, DEFAULT_CONTENT.people),
  };
  const items = out.trio.items.slice(0, 3).map((it) => ({ ...it, icon: resolveIcon(it.icon) ? it.icon : "sparkles" }));
  const tagline = out.tagline?.trim().split(/\s+/).length >= 2 && out.tagline.trim().split(/\s+/).length <= 8 ? out.tagline.trim() : brand.tagline;
  return { brand: { ...brand, tagline }, hook: out.hook, trio: { ...out.trio, items }, reveal: out.reveal, pay: out.pay, growth: out.growth, nomore: out.nomore, cta: out.cta, content };
}

// The plain fallback: the narration's sentences (long ones split at commas)
// placed on the parts in order, keywords the longest word of each.
export function fallbackScript(words: Word[], brand: Brand): SevenPart | null {
  const text = words.map((w) => w.text).join(" ").replace(/\s+([.,!?])/g, "$1");
  let lines = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2);
  if (lines.length < 8) lines = lines.flatMap((s) => (s.split(/\s+/).length >= 8 ? s.split(/(?<=,)\s+/) : [s])).filter((s) => s.split(/\s+/).length >= 2);
  if (lines.length < 8) return null;
  const pickAt = (k: number) => lines[Math.round((k * (lines.length - 1)) / 7)];
  const p = [0, 1, 2, 3, 4, 5, 6, 7].map(pickAt);
  const longest = (s: string) => s.split(/\s+/).reduce((a, w) => (w.replace(/\W/g, "").length > a.replace(/\W/g, "").length ? w : a), "");
  const tw = p[1].split(/\s+/).filter((w) => w.replace(/\W/g, "").length > 2);
  const things = [...new Set(tw.sort((a, b) => b.length - a.length).slice(0, 3))];
  while (things.length < 3) things.push(tw[things.length] ?? p[1].split(/\s+/)[0]);
  const named = p[2].toLowerCase().includes(brand.name.toLowerCase());
  const sub = named ? p[2].slice(p[2].toLowerCase().indexOf(brand.name.toLowerCase()) + brand.name.length).trim() : p[2];
  return {
    brand,
    hook: { text: p[0], key: longest(p[0]), big: null },
    trio: { text: p[1], items: things.map((t) => ({ label: t, sub: "", icon: "circle-dot" })) },
    reveal: { name: named ? brand.name : brand.name, sub: sub || p[2], key: longest(sub || p[2]) },
    pay: { eyebrow: "", title: p[3], key: longest(p[3]), pay: p[3].split(/\s+/)[0], rev: p[3].split(/\s+/)[0], inst: longest(p[3]) },
    growth: { eyebrow: "", title: p[4], key: longest(p[4]), grow: p[4].split(/\s+/)[0], team: p[4].split(/\s+/)[0], zoom: longest(p[4]) },
    nomore: { a: p[5], aKey: longest(p[5]), b: p[6], bKey: longest(p[6]) },
    cta: { tagline: p[7], key: longest(p[7]) },
    content: DEFAULT_CONTENT,
  };
}

export async function generateCleanScript(input: CleanDirectorInput, onUsage?: (u: BriefUsage) => void, client?: Pick<OpenAI, "responses">, budgetMs = 90_000): Promise<CleanDirectorResult> {
  const t0 = Date.now();
  const problems: string[] = [];
  let attempts = 0;
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const quick = /^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {};
  const format = { format: zodTextFormat(CleanScriptModel, "clean_script") };
  const narration = input.words.map((w) => w.text).join(" ").replace(/\s+([.,!?])/g, "$1");
  const request = `Product: ${input.brand.name}${input.product ? ` — ${input.product}` : ""}\nCall to action: ${input.brand.cta}\nNarration:\n${narration}`;
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const count = (r: { usage?: { input_tokens?: number; output_tokens?: number } | null }) => {
    usage.inputTokens += r.usage?.input_tokens ?? 0;
    usage.outputTokens += r.usage?.output_tokens ?? 0;
  };
  const done = (r: Omit<CleanDirectorResult, "attempts" | "ms">): CleanDirectorResult => {
    onUsage?.(usage);
    return { ...r, attempts, ms: Date.now() - t0 };
  };

  const ai = client ?? (process.env.OPENAI_API_KEY ? new OpenAI() : null);
  if (ai) {
    try {
      attempts++;
      const first = await ai.responses.parse({ model, instructions: CLEAN_INSTRUCTIONS, input: request, text: format, ...quick }, { timeout: budgetMs });
      count(first);
      if (first.output_parsed) {
        const script = tidyScript(first.output_parsed, input.brand);
        const built = buildPlan(script, input.words);
        if (built.plan) return done({ plan: built.plan, script, source: "ai", problems: [] });
        problems.push(...built.problems);
        const left = budgetMs - (Date.now() - t0);
        if (left > 15_000) {
          attempts++;
          const second = await ai.responses.parse({ model, instructions: CLEAN_INSTRUCTIONS, previous_response_id: first.id, input: `Your plan failed these checks against the narration:\n- ${built.problems.slice(0, 12).join("\n- ")}\nQuote the narration exactly and keep the parts in order. Return the whole plan again.`, text: format, ...quick }, { timeout: left });
          count(second);
          if (second.output_parsed) {
            const script2 = tidyScript(second.output_parsed, input.brand);
            const built2 = buildPlan(script2, input.words);
            if (built2.plan) return done({ plan: built2.plan, script: script2, source: "revised", problems });
            problems.push(...built2.problems.map((p) => `revision: ${p}`));
          }
        }
      } else problems.push("the model returned no plan");
    } catch (e) {
      problems.push(`model call failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else problems.push("no OpenAI key");

  const fb = fallbackScript(input.words, input.brand);
  if (fb) {
    const built = buildPlan(fb, input.words);
    if (built.plan) return done({ plan: built.plan, script: fb, source: "fallback", problems });
    problems.push(...built.problems.map((p) => `fallback: ${p}`));
  } else problems.push("fallback: the narration has fewer than 8 lines");
  return done({ plan: null, script: null, source: "none", problems });
}
