import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { countUsage, textAi } from "@/lib/ai/models";
import { HOUSE_RULES } from "@/lib/ai/house-rules";
import { isAccent } from "@/components/video/composer/layout";
import type { Score } from "@/components/video/composer/score";
import { stagingName, type Staging } from "@/components/video/composer/staging";
import type { ComposerPlan } from "@/components/video/composer/types";
import type { BrandProfile, CreativePlan } from "@/lib/studio";

// Judge: the last of the Composer's Directors, the studio's project manager.
// Several candidate videos are built from the plan; the Judge reads each one
// as it would play (scene by scene: when, the words on screen, what is shown,
// the camera), with our rule score and its notes, and scores them against the
// house rules, the creative plan and the brand. The best one is the video.
// Without a model (or with a bad answer) the rule score decides.

const INSTRUCTIONS = `You are the project manager and final reviewer of a motion-design studio that makes premium explainer videos for software products. Several candidate cuts of ONE video were built for a brand. Read each one as it plays and score it 0–10 on:
- story: it opens on the pain, turns to the product, shows how it works, lands the result and the call to action; one message per scene.
- clarity: one hero per frame, few things, words that can be read, each picture literally what the voice says.
- brand: it feels like THIS brand (its mood and character) and follows the creative plan (the idea, the motif, the hero moment the strongest).
- rules: the house rules below are kept.
total = the overall score a demanding client would give (not an average). Pick the best candidate; when two are close, prefer the one unlike the brand's earlier videos. One short note per candidate: its biggest weakness.

${HOUSE_RULES}`;

const VerdictM = z.object({
  best: z.number(),
  scores: z.array(z.object({ candidate: z.number(), story: z.number(), clarity: z.number(), brand: z.number(), rules: z.number(), total: z.number(), note: z.string() })),
});
export type Verdict = { best: number; scores: { candidate: number; total: number; note: string; story?: number; clarity?: number; brand?: number; rules?: number }[]; source: "ai" | "rule"; problems: string[] };

// A candidate as it plays, in words (for the Judge).
export function playOf(plan: ComposerPlan, staging?: Staging | null): string {
  const lines = plan.scenes.map((s, i) => {
    const t = `${(s.from / 30).toFixed(1)}–${(s.to / 30).toFixed(1)} s`;
    const words = s.text?.words.map((w) => (w.key ? `*${w.t}*` : w.t)).join(" ") ?? "(no words on screen)";
    const things = s.items.map((it) => `${isAccent(it) ? "(small) " : ""}${it.kind}${it.variant ? `:${it.variant}` : ""}${it.title ? ` "${it.title}"` : ""}${it.value ? ` ${it.value}` : ""}${it.icon ? ` [${it.icon}]` : ""} ${Math.round(it.box.w)}×${Math.round(it.box.h)}`).join("; ");
    return `  ${i + 1}. ${t} ${s.dark ? "dark" : "light"} ${s.layout}${s.enter && i ? `, in by ${s.enter}` : ""} — "${words}" — ${things || "nothing but the words"}`;
  });
  return `camera: ${stagingName(staging)}${staging?.recap ? " + recap" : ""}; look: ${plan.art.display} type, ${plan.art.field} background, ${plan.art.scheme}\n${lines.join("\n")}`;
}

export async function judge(input: { candidates: { plan: ComposerPlan; staging?: Staging | null; score: Score }[]; profile?: BrandProfile | null; creative?: CreativePlan | null; earlier?: string[] }, onUsage?: (u: BriefUsage) => void, client?: Pick<OpenAI, "responses">, budgetMs = 40_000): Promise<Verdict> {
  const byRule = (problems: string[]): Verdict => {
    const scores = input.candidates.map((c, i) => ({ candidate: i, total: c.score.total, note: c.score.notes[0] ?? "" }));
    const best = scores.reduce((b, s) => (s.total > scores[b].total ? s.candidate : b), 0);
    return { best, scores, source: "rule", problems };
  };
  if (input.candidates.length < 2) return byRule([]);
  const picked = client ? null : await textAi("judge").catch(() => null);
  const ai = client ?? picked?.client ?? null;
  const model = picked?.model ?? (process.env.OPENAI_MODEL || "gpt-5-mini");
  if (!ai) return byRule(["no model (turned off on /admin/models, or no key) — the rule score decides"]);
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const quick = (picked ? picked.quick : /(^|\/)(gpt-5|o\d)/.test(model)) ? { reasoning: { effort: "low" as const } } : {};
  const p = input.profile, c = input.creative;
  const request = [
    p ? `BRAND: ${p.category}; ${p.personality.join(", ")}; mood ${p.mood}; promise: ${p.promise || "(not said)"}` : "",
    c ? `CREATIVE PLAN: idea "${c.idea}"; motif ${c.motif ? `${c.motif.icon} "${c.motif.label}"` : "(none)"}; hero at word ${c.hero}; camera ${c.language}` : "",
    input.earlier?.length ? `EARLIER videos of this brand: ${input.earlier.join("; ")}` : "",
    ...input.candidates.map((x, i) => `CANDIDATE ${i}:\n${playOf(x.plan, x.staging)}\nOur rule score: ${x.score.total}/10${x.score.notes.length ? ` (${x.score.notes.slice(0, 4).join("; ")})` : ""}`),
  ].filter(Boolean).join("\n\n");
  try {
    const r = await ai.responses.parse({ model, instructions: INSTRUCTIONS, input: request, text: { format: zodTextFormat(VerdictM, "verdict") }, ...quick }, { timeout: budgetMs });
    countUsage(usage, r.usage);
    onUsage?.(usage);
    const o = r.output_parsed;
    if (!o || !Number.isInteger(o.best) || o.best < 0 || o.best >= input.candidates.length) return byRule(["no usable answer — the rule score decides"]);
    const clamp = (v: number) => Math.max(0, Math.min(10, v));
    return { best: o.best, scores: o.scores.filter((s) => s.candidate >= 0 && s.candidate < input.candidates.length).map((s) => ({ candidate: s.candidate, story: clamp(s.story), clarity: clamp(s.clarity), brand: clamp(s.brand), rules: clamp(s.rules), total: clamp(s.total), note: s.note.slice(0, 200) })), source: "ai", problems: [] };
  } catch (e) {
    onUsage?.(usage);
    return byRule([`model call failed: ${e instanceof Error ? e.message : String(e)} — the rule score decides`]);
  }
}
