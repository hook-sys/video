import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { countUsage, textAi } from "@/lib/ai/models";
import { HOUSE_RULES } from "@/lib/ai/house-rules";
import { LANGUAGES, LANGUAGE_NOTES, type Language } from "@/components/video/composer/staging";
import type { Word } from "@/components/video/composer/types";
import { BEATS, type BrandProfile, type CreativePlan, LANGUAGE_WEIGHTS, ruleCreative, sentencesOf } from "@/lib/studio";

// Creative Director: the second of the Composer's Directors. From the brand's
// profile and the narration it decides what a studio's creative director
// decides before anyone draws: the ONE idea the video is built on, a motif
// that comes back through it, where the hero moment is, how the story turns,
// and one camera language for the whole video — unlike this brand's earlier
// videos. The Composer Director then pictures every scene inside that plan.
// Never throws: no model or a bad answer → the plan by rule (lib/studio.ts).

const INSTRUCTIONS = `You are the creative director of a motion-design studio known for premium explainer videos for software products. Before anyone draws, you decide the concept of ONE video from the brand's profile and its recorded narration (numbered words, given sentence by sentence).
Decide:
- idea: the ONE idea the whole video is built on, in one line — a concrete visual concept for THIS brand, not a slogan (e.g. "the clinic's day as a calendar that fills itself", "a messy inbox folding into one calm thread").
- motif: one thing that comes back through the video and carries the idea: { icon (a Lucide icon name that pictures it literally — never people, faces, hands or animals), label (1–3 words) }.
- hero: the word index where the hero moment happens — the strongest moment (usually the product's result or the spoken number). It gets the signature move and is held longest.
- turn: the word index where the product arrives and the story turns from the problem.
- beats: one per sentence, in order: { at: the sentence's first word index, beat: ${BEATS.join("|")} }.
- language: ONE camera language for the whole video (variety is between videos, never inside one), the one that suits the brand's mood and idea best:
${LANGUAGES.map((l) => `  ${l}: ${LANGUAGE_NOTES[l]}`).join("\n")}
- journey: for line|carry|words|guide, the canvas path right|zigzag|down|diagonal|snake; else null.
- guide: for guide, plane|cursor|orb; else null.
- recap: true to end by pulling back to show the whole way the video came (canvas languages only).
- scheme: dark|light|mixed (mixed = dark problem, light from the turn).
AVOID the ideas and languages listed under EARLIER (this brand's earlier videos) — this video must feel new.

${HOUSE_RULES}`;

const PlanM = z.object({
  idea: z.string(),
  motif: z.object({ icon: z.string(), label: z.string() }),
  hero: z.number(),
  turn: z.number(),
  beats: z.array(z.object({ at: z.number(), beat: z.enum(BEATS) })),
  language: z.enum(LANGUAGES),
  journey: z.enum(["right", "zigzag", "down", "diagonal", "snake"]).nullable(),
  guide: z.enum(["plane", "cursor", "orb"]).nullable(),
  recap: z.boolean(),
  scheme: z.enum(["dark", "light", "mixed"]),
});

export type CreativeInput = { profile: BrandProfile; words: Word[]; brandName: string; seed: number; earlier?: { idea: string; language: Language | null }[] };

export async function directCreative(input: CreativeInput, onUsage?: (u: BriefUsage) => void, client?: Pick<OpenAI, "responses">, budgetMs = 45_000): Promise<{ plan: CreativePlan; problems: string[] }> {
  const recent = (input.earlier ?? []).map((e) => e.language);
  const fallback = ruleCreative(input.profile, input.words, input.brandName, input.seed, recent);
  const picked = client ? null : await textAi("creative").catch(() => null);
  const ai = client ?? picked?.client ?? null;
  const model = picked?.model ?? (process.env.OPENAI_MODEL || "gpt-5-mini");
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  if (!ai || !input.words.length) return { plan: fallback, problems: ["no model (turned off on /admin/models, or no key) — plan by rule"] };
  const quick = (picked ? picked.quick : /(^|\/)(gpt-5|o\d)/.test(model)) ? { reasoning: { effort: "low" as const } } : {};
  const p = input.profile;
  const sentences = sentencesOf(input.words).map((s) => input.words.slice(s.from, s.to + 1).map((w, k) => `${s.from + k}:${w.text}`).join(" "));
  const suited = Object.entries(LANGUAGE_WEIGHTS[p.mood]).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 5).map(([l]) => l);
  const request = [
    `Brand: ${input.brandName}`,
    `PROFILE: ${p.category}; character ${p.personality.join(", ")}; mood ${p.mood}; for ${p.audience || "(not said)"}; promise: ${p.promise || "(not said)"}; features: ${p.features.join(", ") || "(none named)"}; replaces: ${p.before.join(", ") || "(not said)"}; key words: ${p.keywords.join(", ")}; spoken numbers: ${p.numbers.join(", ") || "(none)"}; look: ${p.look.scheme}, ${p.look.face} type, energy ${p.look.energy}`,
    `Languages that usually suit a ${p.mood} brand: ${suited.join(", ")} (others are allowed when the idea asks for them)`,
    `EARLIER (this brand's videos): ${input.earlier?.length ? input.earlier.map((e) => `"${e.idea}" (${e.language ?? "?"})`).join("; ") : "(none)"}`,
    `NARRATION (index:word), one sentence per line:\n${sentences.join("\n")}`,
  ].join("\n");
  try {
    const r = await ai.responses.parse({ model, instructions: INSTRUCTIONS, input: request, text: { format: zodTextFormat(PlanM, "creative_plan") }, ...quick }, { timeout: budgetMs });
    countUsage(usage, r.usage);
    onUsage?.(usage);
    const o = r.output_parsed;
    if (!o) return { plan: fallback, problems: ["no answer — plan by rule"] };
    const n = input.words.length;
    const inRange = (i: number, d: number) => (Number.isFinite(i) && i >= 0 && i < n ? Math.round(i) : d);
    const beats = o.beats.filter((b) => b.at >= 0 && b.at < n).sort((a, b) => a.at - b.at);
    const plan: CreativePlan = {
      idea: o.idea.slice(0, 160),
      motif: o.motif.icon ? { icon: o.motif.icon.slice(0, 40), label: o.motif.label.slice(0, 30) } : fallback.motif,
      hero: inRange(o.hero, fallback.hero),
      turn: inRange(o.turn, fallback.turn),
      beats: beats.length ? beats : fallback.beats,
      language: o.language,
      journey: ["line", "carry", "words", "guide"].includes(o.language) ? (o.journey ?? fallback.journey ?? "right") : null,
      guide: o.language === "guide" ? (o.guide ?? "plane") : null,
      recap: o.recap,
      scheme: o.scheme,
      source: "ai",
    };
    return { plan, problems: [] };
  } catch (e) {
    onUsage?.(usage);
    return { plan: fallback, problems: [`model call failed: ${e instanceof Error ? e.message : String(e)} — plan by rule`] };
  }
}
