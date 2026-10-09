import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { countUsage, textAi } from "@/lib/ai/models";
import { BRAND_CATEGORIES, MOODS, type BrandProfile, ruleProfile } from "@/lib/studio";

// Brand Analyst: the first of the Composer's Directors. One AI call reads what
// we know of the brand — its website's words, its name and colour, the
// script — and writes its profile: what kind of business it is, its
// character, who it is for, what it promises, its features and the old way
// it replaces, the script's key words and real numbers, and the look that
// suits it. Every other Director works from this profile, so two brands get
// two different videos. Never throws: no model or a bad answer → the profile
// by rule (lib/studio.ts).

const INSTRUCTIONS = `You are the brand strategist of a motion-design studio that makes premium explainer videos for software products. Read what we know about ONE brand and write its profile for the creative team. Be specific to THIS brand — never generic. Use only what the material says; never invent features, numbers or claims.
- category: the kind of business, one of the list.
- personality: 3 adjectives for the brand's character (e.g. "calm, caring, precise" for a clinic tool; "bold, fast, playful" for a social app).
- mood: the feeling the video should have, one of the list.
- audience: who the video speaks to, in a few words ("small clinic owners").
- promise: the one thing the product promises, one short line in plain words.
- features: up to 3 features the material names, 2–4 words each.
- before: up to 3 old ways the product replaces ("phone calls", "paper notes", "spreadsheets").
- keywords: up to 6 words from the SCRIPT that carry its meaning (exact words).
- numbers: the numbers the SCRIPT says, exactly as said ("twice as fast", "4 hours"); [] when none.
- look: scheme dark|light|mixed (dark for night/tech/bold, light for calm/health/finance, mixed when the story turns from a dark problem to a bright product), face geometric|humanist|serif|condensed|rounded|wide (the headline type that suits the character), energy 0.2–0.85 (calm → low).`;

const ProfileM = z.object({
  category: z.enum(BRAND_CATEGORIES),
  personality: z.array(z.string()),
  mood: z.enum(MOODS),
  audience: z.string(),
  promise: z.string(),
  features: z.array(z.string()),
  before: z.array(z.string()),
  keywords: z.array(z.string()),
  numbers: z.array(z.string()),
  look: z.object({ scheme: z.enum(["dark", "light", "mixed"]), face: z.enum(["geometric", "humanist", "serif", "condensed", "rounded", "wide"]), energy: z.number() }),
});

export type AnalystInput = { name: string; color: string; script: string; website?: { url?: string | null; title?: string | null; description?: string | null; text?: string | null } | null; category?: string | null };

export async function analyzeBrand(input: AnalystInput, onUsage?: (u: BriefUsage) => void, client?: Pick<OpenAI, "responses">, budgetMs = 45_000): Promise<{ profile: BrandProfile; problems: string[] }> {
  const fallback = ruleProfile(input);
  const picked = client ? null : await textAi("analyst").catch(() => null);
  const ai = client ?? picked?.client ?? null;
  const model = picked?.model ?? (process.env.OPENAI_MODEL || "gpt-5-mini");
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  if (!ai) return { profile: fallback, problems: ["no model (turned off on /admin/models, or no key) — profile by rule"] };
  const quick = (picked ? picked.quick : /(^|\/)(gpt-5|o\d)/.test(model)) ? { reasoning: { effort: "low" as const } } : {};
  const w = input.website;
  const request = [
    `Brand: ${input.name}`,
    `Brand colour: ${input.color}`,
    input.category ? `Category (the customer's choice): ${input.category}` : "",
    w?.url ? `Website: ${w.url}` : "",
    w?.title ? `Website title: ${w.title}` : "",
    w?.description ? `Website description: ${w.description}` : "",
    w?.text ? `Website text:\n${w.text.slice(0, 5000)}` : "",
    `SCRIPT (the narration, word for word):\n${input.script}`,
    `Categories: ${BRAND_CATEGORIES.join(", ")}`,
    `Moods: ${MOODS.join(", ")}`,
  ].filter(Boolean).join("\n");
  try {
    const r = await ai.responses.parse({ model, instructions: INSTRUCTIONS, input: request, text: { format: zodTextFormat(ProfileM, "brand_profile") }, ...quick }, { timeout: budgetMs });
    countUsage(usage, r.usage);
    onUsage?.(usage);
    const o = r.output_parsed;
    if (!o) return { profile: fallback, problems: ["no answer — profile by rule"] };
    // what the script really says (a number or keyword it does not say is dropped)
    const said = input.script.toLowerCase();
    const profile: BrandProfile = {
      category: input.category && (BRAND_CATEGORIES as readonly string[]).includes(input.category) ? (input.category as BrandProfile["category"]) : o.category,
      personality: o.personality.slice(0, 3).map((x) => x.slice(0, 24)),
      mood: o.mood,
      audience: o.audience.slice(0, 60),
      promise: o.promise.slice(0, 120),
      features: o.features.slice(0, 3).map((x) => x.slice(0, 40)),
      before: o.before.slice(0, 3).map((x) => x.slice(0, 40)),
      keywords: o.keywords.filter((k) => said.includes(k.toLowerCase())).slice(0, 6),
      numbers: o.numbers.filter((k) => said.includes(k.toLowerCase())).slice(0, 4),
      look: { ...o.look, energy: Math.max(0.2, Math.min(0.85, o.look.energy)) },
      source: "ai",
    };
    return { profile, problems: [] };
  } catch (e) {
    onUsage?.(usage);
    return { profile: fallback, problems: [`model call failed: ${e instanceof Error ? e.message : String(e)} — profile by rule`] };
  }
}
