import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { FlowScript, flowScriptBlockers, MAX_BEATS, MAX_STEPS, repairFlowScript } from "@/lib/flow-script";
import { tokenize, type WordTiming } from "@/lib/voice-timing";

// Visual Director for the Flow engine: turns the finished narration (and its
// real word timestamps) into a FlowScript — which motion pattern happens on
// which spoken words. Layout, camera, timing and sound are the compiler's job.
// One call, at most one revision; never throws.

const LOTTIES = Object.entries(LOTTIE_MANIFEST as Record<string, { description: string }>)
  .map(([name, m]) => `${name}: ${m.description}`)
  .join("\n");

const INSTRUCTIONS = `You are the art director of a premium motion-graphics promo video. The narration is final and already recorded; you decide WHAT the viewer sees on which words, using a fixed set of motion patterns. A compiler turns your beats into one continuous, camera-driven animation, so think like a motion designer: one persistent subject that transforms, not a slideshow.

OUTPUT: { theme, beats[] }. Each beat = one motion pattern that starts on its cue.

CUE: 1–6 consecutive words copied EXACTLY from NARRATION, in spoken order (each cue after the previous one). The motion lands on those words, so pick the words that name the action.

PATTERNS (action):
- hero_enter: the persistent SUBJECT appears (icon; label ≤3 words). Exactly once, early — the thing the story is about (an order, a booking, a document, the product).
- hero_morph: the subject turns into its next state (new icon, new label) — e.g. bag → package, draft → signed document. Prefer this over introducing new objects.
- actor_enter: a person or outside party arrives and connects to the subject (id, icon, packet_icon = what travels to the subject).
- add_step: the next stage of a process joins a chain; packet_icon travels along the new link (id, icon, label). At most ${MAX_STEPS} steps. Use for sequential processes ("then…", "and…").
- confirm: a node completes — ring fills, success badge (id of a step/actor, or null for the subject).
- ui_showcase: the product's own interface in 3D: title, 3–6 rows {icon, text, value|null, status|null}, 0–2 callouts {text ≤4 words, icon}, click_row (row index to click, or null). Only when the narration talks about the product's app, dashboard or interface. Rows and values are illustrative UI, never claims.
- iris_to_hub: after a ui_showcase, the interface closes through a circle into the subject as a hub (icon, label).
- orbit: 2–6 satellites {id, icon, label|null} spiral out and circle the subject — for connecting, integrating, "everything in one place".
- converge: everything on stage flows back into the subject (optional icon for its final form) — the resolution ("all in one", "everything stays on track").
- celebrate: a Lottie accent at the subject or a node (id|null, lottie).
- title: one short kinetic line (text ≤8 words, taken from the narration's key phrase; accent = the 1–3 words to highlight). Usually the last beat, cued on the closing phrase.

RULES
- ${MAX_BEATS} beats at most; about one beat every 1–2 seconds of narration; first beat establishes the scene (hero_enter, actor_enter or ui_showcase).
- Continuity: the same subject persists from its first appearance to the end; later beats transform or connect it. Never a sequence of unrelated objects.
- Every beat must change what the viewer sees; do not repeat an action twice in a row unless it continues a chain (add_step).
- Icons: Lucide icon names (e.g. shopping-bag, package, truck, credit-card, house, calendar-check, shield-check, users, landmark, wallet, bell-ring, mail, rocket, sparkles). Pick the most literal icon for each noun.
- Labels are 1–3 words taken from or implied by the narration. No invented facts, prices, percentages or customer names in labels or titles.
- theme: "lavender" (bright, friendly SaaS) or "midnight" (dark, dramatic, premium). Use creative_preferences.visual_style: Premium SaaS / Minimal / Corporate → lavender; Bold / Futuristic / Cinematic → midnight.
- Unused fields are null.

VISUAL CONCEPT SOURCE
- If ADVANCED_DIRECTION is present, it is the client's visual concept: follow it closely (subject, world, what transforms) as long as it fits these patterns; never replace it with a generic concept.
- If it is empty, derive the concept from the narration itself: its subject, its process, its outcome.

LOTTIE ACCENTS (celebrate.lottie must be one of these names):
${LOTTIES}`;

export type FlowDirectorInput = {
  narration: string;
  words?: WordTiming[] | null;
  duration_seconds: number;
  product_name?: string;
  creative_preferences?: Record<string, string>;
};
export type FlowDirectorResult = { script: FlowScript | null; attempts: number; revised: boolean; errors: string[]; ms: number; timing: "voice" | "estimated" };

export async function generateFlowScript(input: FlowDirectorInput, onUsage?: (usage: BriefUsage) => void, budgetMs = 100_000): Promise<FlowDirectorResult> {
  const started = Date.now();
  const timing = input.words?.length ? "voice" : "estimated";
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const usage = { model, inputTokens: 0, outputTokens: 0 };
  const format = { format: zodTextFormat(FlowScript, "flow_script") };
  const check = (raw: FlowScript | null) => {
    if (!raw) return { script: null, problems: ["no structured output"] };
    const script = repairFlowScript(raw);
    const problems = flowScriptBlockers(script, input.narration, input.words, input.duration_seconds);
    return { script: problems.length ? null : script, problems };
  };
  let attempts = 0;
  let problems: string[] = [];
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
    const client = new OpenAI({ maxRetries: 0 });
    attempts++;
    const first = await client.responses.parse(
      {
        model,
        instructions: INSTRUCTIONS,
        input: JSON.stringify({
          NARRATION: input.narration,
          WORDS: input.words?.length ? input.words.filter((w) => tokenize(w.text).length).map((w) => [w.text, Math.round(w.start * 100) / 100]) : null,
          duration_seconds: input.duration_seconds,
          product_name: input.product_name ?? null,
          ADVANCED_DIRECTION: input.creative_preferences?.advanced_direction?.trim() || null,
          creative_preferences: input.creative_preferences ? { ...input.creative_preferences, advanced_direction: undefined } : null,
        }),
        text: format,
      },
      { timeout: Math.min(80_000, budgetMs) },
    );
    usage.inputTokens += first.usage?.input_tokens ?? 0;
    usage.outputTokens += first.usage?.output_tokens ?? 0;
    let result = check(first.output_parsed);
    problems = result.problems;
    const left = budgetMs - (Date.now() - started);
    if (!result.script && first.id && left > 25_000) {
      attempts++;
      const revised = await client.responses.parse(
        { model, instructions: INSTRUCTIONS, previous_response_id: first.id, input: `Your beats failed these checks:\n- ${problems.slice(0, 12).join("\n- ")}\nReturn the corrected complete FlowScript.`, text: format },
        { timeout: Math.min(60_000, left) },
      );
      usage.inputTokens += revised.usage?.input_tokens ?? 0;
      usage.outputTokens += revised.usage?.output_tokens ?? 0;
      result = check(revised.output_parsed);
      problems = result.problems;
    }
    return { script: result.script, attempts, revised: attempts > 1, errors: problems, ms: Date.now() - started, timing };
  } catch (e) {
    return { script: null, attempts, revised: attempts > 1, errors: [e instanceof Error ? e.message : String(e)], ms: Date.now() - started, timing };
  } finally {
    if (attempts) onUsage?.(usage);
  }
}
