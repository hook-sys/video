import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { countUsage, textAi } from "@/lib/ai/models";
import { resolveIcon } from "@/components/video/icons";
import { DEFAULT_CONTENT, type FilmContent } from "@/components/video/clean/content";
import { buildStory, shapeOf, type Story, type StoryPart } from "@/components/video/clean/plan";
import type { Brand, CleanPlan, Word } from "@/components/video/clean/types";
import { CleanScriptModel } from "@/lib/ai/clean-director";

// Story Director: one AI call casts the recorded narration into two to four
// different STORY SHAPES — sequences of the seven kinds of part, each quoting
// the narration — so the videos of one script do not all tell it the same
// way: one opens on the problem, one on three things, one on a result, one on
// a contrast… The number of parts fits the length (15 s: 3–4, 60 s: 9–12).
// Checked against the voice (buildStory); one revision; then a plain
// fallback from the sentences. Never throws.

export const STORY_INSTRUCTIONS = `You direct short explainer videos for a software product. The narration is final and already recorded; you never change or add a word of it.

A video is a sequence of PARTS. Each part quotes the narration EXACTLY (same words, same order) and is drawn as one kind of picture. The KINDS:
- hook — a problem or question line. text: the line; key: its most important word; big: one noun from the line the problem is about.
- trio — a line naming three things (tools, places, steps, problems, features). text: the line; items: exactly 3 { label: the thing as spoken (1–2 words from the line), sub: 2–4 words about it, icon: a Lucide icon name that pictures THAT thing literally (e.g. calendar, stethoscope, file-text, bell, credit-card, users, mail, package, message-square, clock) }.
- reveal — the line that brings in the product. name: the product's name as spoken (or the brand name if not spoken); sub: the rest of the line after the name; key: one word of sub.
- pay — a cause and its result ("When a patient books online, the slot fills itself."), or a feature and what it does. eyebrow: the cause part (may be "" when one phrase); title: the result part; key: one word of title; pay: 1–3 words when it happens; rev: 1–3 words when the result shows; inst: one word near the result's end.
- growth — something improves, grows or is seen by people ("your whole team sees who is next"). eyebrow, title, key as in pay; grow: 1–3 words where it improves; team: 1–3 words naming the people (or the thing); zoom: 1–3 words near the end.
- nomore — two short lines of what stops or changes ("No more double bookings." / "No more missed appointments."). a, b: the two lines; aKey, bKey: one word of each.
- cta — the closing line. text: the line; key: one word of it.

Write STORIES: 2 to 4 different ways to cast the same narration into parts. Rules for every story:
- Parts follow the narration's order, never overlap, and together cover it from its first words to its end (a part may be a phrase of a sentence, split at a comma; small gaps are fine).
- The FIRST part starts with the narration's first words. The last part is the closing line (cta when it is a call to action or promise).
- Number of parts by length: under 20 s → 3–4 parts; 20–40 s → 5–8; 40–75 s → 8–12. Each part is at least about 1.5 seconds of speech.
- Kinds may repeat (pay or growth for several features or steps; trio at most twice); reveal, nomore and cta at most once each.
- Cast each line as the kind whose picture fits ITS meaning: a list of three → trio; a cause and result → pay; people seeing or something growing → growth; "no more …" → nomore. Never force a line into a kind that does not fit.

The stories must DIFFER: each opens with a different kind or cuts the narration differently (e.g. one opens with hook, another casts the opening lines as a trio, another as pay or growth, another as nomore when the lines allow). Never repeat the same sequence of kinds. Avoid opening with the kinds listed under AVOID OPENING (this customer has seen them) when another opening fits.

Every quoted text, eyebrow, title, line and word MUST appear in the narration exactly. Unused fields are "" (items [] when not trio).

CONTENT — what the product's own screens show (realistic for THIS product, never generic placeholders, never real people's photos; people are names only):
- metric { label, from, to, unit "$" | "%" | "" }: a number a pay part changes (from → to, a believable small change).
- event { label (2–3 words), detail (an amount or count), source (who or what it came from), done (2–3 words after it) }.
- rows: 3 earlier entries of the same list as event { name, value }.
- side: 2 more figures of the same screen { label, value }.
- growth { label, from, to, unit }: what grows (to > from).
- people: 4 team members { name (first and last name), role }.
Keep every label short (1–4 words).
- tagline: the product's promise for the end card, 3–6 words.`;

const KINDS = ["hook", "trio", "reveal", "pay", "growth", "nomore", "cta"] as const;
const Item = z.object({ label: z.string(), sub: z.string(), icon: z.string() });
const PartModel = z.object({
  kind: z.enum(KINDS),
  text: z.string(),
  key: z.string(),
  big: z.string(),
  items: z.array(Item),
  name: z.string(),
  sub: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  pay: z.string(),
  rev: z.string(),
  inst: z.string(),
  grow: z.string(),
  team: z.string(),
  zoom: z.string(),
  a: z.string(),
  aKey: z.string(),
  b: z.string(),
  bKey: z.string(),
});
export const StoriesModel = z.object({
  tagline: z.string(),
  stories: z.array(z.object({ parts: z.array(PartModel) })),
  content: CleanScriptModel.shape.content,
});
export type StoriesOut = z.infer<typeof StoriesModel>;
type PartOut = z.infer<typeof PartModel>;

export type StoryDirectorInput = { brand: Brand; words: Word[]; product?: string | null; avoid?: string[] };
export type StoryDirectorResult = { stories: { story: Story; plan: CleanPlan }[]; source: "ai" | "revised" | "fallback" | "none"; problems: string[]; attempts: number; ms: number };

const toPart = (p: PartOut): StoryPart => {
  switch (p.kind) {
    case "hook":
      return { role: "hook", text: p.text, key: p.key, big: p.big || null };
    case "trio":
      return { role: "trio", text: p.text, items: p.items.slice(0, 3).map((it) => ({ ...it, icon: resolveIcon(it.icon) ? it.icon : "sparkles" })) };
    case "reveal":
      return { role: "reveal", name: p.name, sub: p.sub, key: p.key };
    case "pay":
      return { role: "pay", eyebrow: p.eyebrow, title: p.title, key: p.key, pay: p.pay, rev: p.rev, inst: p.inst };
    case "growth":
      return { role: "growth", eyebrow: p.eyebrow, title: p.title, key: p.key, grow: p.grow, team: p.team, zoom: p.zoom };
    case "nomore":
      return { role: "nomore", a: p.a, aKey: p.aKey, b: p.b, bKey: p.bKey };
    default:
      return { role: "cta", tagline: p.text, key: p.key };
  }
};

function tidyContent(c: StoriesOut["content"]): FilmContent {
  const pad = <T,>(xs: T[], n: number, fill: T[]) => [...xs, ...fill].slice(0, n);
  return {
    metric: c.metric,
    event: c.event,
    rows: pad(c.rows, 3, DEFAULT_CONTENT.rows),
    side: pad(c.side, 2, DEFAULT_CONTENT.side),
    growth: c.growth.to > c.growth.from ? c.growth : { ...c.growth, to: Math.round(c.growth.from * 1.27 + 1) },
    people: pad(c.people, 4, DEFAULT_CONTENT.people),
  };
}

// How many parts a narration of this length should have.
export const partsFor = (seconds: number) => (seconds < 20 ? [3, 4] : seconds <= 40 ? [5, 8] : [8, 12]) as [number, number];

// The answer's stories that play on the voice: different shapes only.
function check(out: StoriesOut, input: StoryDirectorInput, problems: string[]) {
  const brand = { ...input.brand, tagline: out.tagline?.trim().split(/\s+/).length >= 2 && out.tagline.trim().split(/\s+/).length <= 8 ? out.tagline.trim() : input.brand.tagline };
  const content = tidyContent(out.content);
  const ok: { story: Story; plan: CleanPlan }[] = [];
  out.stories.forEach((s, i) => {
    const story: Story = { brand, content, parts: s.parts.map(toPart) };
    story.shape = shapeOf(story);
    if (ok.some((o) => o.story.shape === story.shape)) return void problems.push(`story ${i + 1} repeats the shape ${story.shape}`);
    const built = buildStory(story, input.words);
    if (built.plan) ok.push({ story, plan: built.plan });
    else problems.push(...built.problems.slice(0, 6).map((p) => `story ${i + 1}: ${p}`));
  });
  return ok;
}

// The plain fallback: the narration's sentences as parts — the first a hook
// (another story: a result), a line naming the brand the reveal, the last the
// call to action, the rest features.
export function fallbackStories(words: Word[], brand: Brand): Story[] {
  const text = words.map((w) => w.text).join(" ").replace(/\s+([.,!?])/g, "$1");
  // sentences; a one-word sentence ("Notely.") joins the next (the text stays contiguous)
  let lines = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].split(/\s+/).length >= 2) continue;
    if (i + 1 < lines.length) lines.splice(i, 2, `${lines[i]} ${lines[i + 1]}`);
    else if (i > 0) lines.splice(i - 1, 2, `${lines[i - 1]} ${lines[i]}`);
    else break;
    i--;
  }
  const seconds = words.length ? words[words.length - 1].end : 0;
  const [, most] = partsFor(seconds);
  if (lines.length < 3) lines = lines.flatMap((s) => (s.split(/\s+/).length >= 6 ? s.split(/(?<=,)\s+/) : [s])).filter((s) => s.split(/\s+/).length >= 2);
  // too many sentences for the length: neighbours merge into one part
  while (lines.length > most) {
    let k = 0;
    for (let i = 1; i < lines.length - 1; i++) if (lines[i].length + lines[i + 1].length < lines[k].length + lines[k + 1].length) k = i;
    lines.splice(k, 2, `${lines[k]} ${lines[k + 1]}`);
  }
  if (lines.length < 2) return [];
  const longest = (s: string) => s.split(/\s+/).reduce((a, w) => (w.replace(/\W/g, "").length > a.replace(/\W/g, "").length ? w : a), "");
  const first = (s: string) => s.split(/\s+/)[0];
  const named = lines.findIndex((l, i) => i > 0 && i < lines.length - 1 && l.toLowerCase().includes(brand.name.toLowerCase()));
  const feature = (l: string, n: number): StoryPart => (n % 2 ? { role: "growth", eyebrow: "", title: l, key: longest(l), grow: first(l), team: first(l), zoom: longest(l) } : { role: "pay", eyebrow: "", title: l, key: longest(l), pay: first(l), rev: first(l), inst: longest(l) });
  const cast = (opening: "hook" | "result"): Story => {
    const parts = lines.map((l, i): StoryPart => {
      if (i === lines.length - 1) return { role: "cta", tagline: l, key: longest(l) };
      if (i === named) {
        const at = l.toLowerCase().indexOf(brand.name.toLowerCase());
        const sub = l.slice(at + brand.name.length).trim();
        return sub.split(/\s+/).length >= 2 ? { role: "reveal", name: brand.name, sub, key: longest(sub) } : feature(l, i);
      }
      if (i === 0) return opening === "hook" ? { role: "hook", text: l, key: longest(l), big: null } : feature(l, 1);
      return feature(l, i);
    });
    const story: Story = { brand, content: DEFAULT_CONTENT, parts };
    story.shape = shapeOf(story);
    return story;
  };
  const a = cast("hook");
  const b = cast("result");
  return a.shape === b.shape ? [a] : [a, b];
}

export async function generateStories(input: StoryDirectorInput, onUsage?: (u: BriefUsage) => void, client?: Pick<OpenAI, "responses">, budgetMs = 90_000): Promise<StoryDirectorResult> {
  const t0 = Date.now();
  const problems: string[] = [];
  let attempts = 0;
  const picked = client ? null : await textAi("clean").catch(() => null);
  const model = picked?.model ?? (process.env.OPENAI_MODEL || "gpt-5-mini");
  const quick = (picked ? picked.quick : /(^|\/)(gpt-5|o\d)/.test(model)) ? { reasoning: { effort: "low" as const } } : {};
  const format = { format: zodTextFormat(StoriesModel, "stories") };
  const seconds = input.words.length ? input.words[input.words.length - 1].end : 0;
  const narration = input.words.map((w) => w.text).join(" ").replace(/\s+([.,!?])/g, "$1");
  const [few, most] = partsFor(seconds);
  const request = `Product: ${input.brand.name}${input.product ? ` — ${input.product}` : ""}\nCall to action: ${input.brand.cta}\nLength: ${Math.round(seconds)} s → ${few}–${most} parts per story\nAVOID OPENING: ${input.avoid?.length ? input.avoid.join(", ") : "(none)"}\nNarration:\n${narration}`;
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const done = (r: Omit<StoryDirectorResult, "attempts" | "ms">): StoryDirectorResult => {
    onUsage?.(usage);
    return { ...r, attempts, ms: Date.now() - t0 };
  };

  const ai = client ?? picked?.client ?? null;
  let kept: { story: Story; plan: CleanPlan }[] = []; // the first answer's good stories
  if (ai) {
    try {
      attempts++;
      const first = await ai.responses.parse({ model, instructions: STORY_INSTRUCTIONS, input: request, text: format, ...quick }, { timeout: budgetMs });
      countUsage(usage, first.usage);
      if (first.output_parsed) {
        const asked: string[] = [];
        const ok = check(first.output_parsed, input, asked);
        kept = ok;
        if (ok.length >= 2) return done({ stories: ok, source: "ai", problems: asked });
        problems.push(...asked);
        const left = budgetMs - (Date.now() - t0);
        if (left > 15_000) {
          attempts++;
          const second = await ai.responses.parse({ model, instructions: STORY_INSTRUCTIONS, previous_response_id: first.id, input: `Only ${ok.length} of your stories play on the narration. Problems:\n- ${asked.slice(0, 14).join("\n- ")}\nQuote the narration exactly, keep the parts in order, and give 2–4 stories with different shapes. Return everything again.`, text: format, ...quick }, { timeout: left });
          countUsage(usage, second.usage);
          if (second.output_parsed) {
            const again: string[] = [];
            const ok2 = check(second.output_parsed, input, again);
            const best = ok2.length >= ok.length ? ok2 : ok;
            if (best.length) return done({ stories: best, source: "revised", problems: [...problems, ...again.map((p) => `revision: ${p}`)] });
          }
        } else if (ok.length) return done({ stories: ok, source: "ai", problems });
      } else problems.push("the model returned no stories");
    } catch (e) {
      problems.push(`model call failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (kept.length) return done({ stories: kept, source: "ai", problems });
  } else problems.push("no model (turned off on /admin/models, or no key)");

  const fb = fallbackStories(input.words, input.brand)
    .map((story) => ({ story, built: buildStory(story, input.words) }))
    .filter((x) => {
      if (!x.built.plan) problems.push(...x.built.problems.map((p) => `fallback: ${p}`));
      return !!x.built.plan;
    })
    .map((x) => ({ story: x.story, plan: x.built.plan! }));
  return done({ stories: fb, source: fb.length ? "fallback" : "none", problems });
}
