import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { compileFlowScript } from "@/components/video/flow/compile";
import { planQuality, qualityProblems } from "@/components/video/flow/quality";
import { FlowScript, FlowScriptModel, flowScriptBlockers, MAX_BEATS, MAX_STEPS, repairFlowScript } from "@/lib/flow-script";
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
- statement: the narration's key phrase as big kinetic type — each word comes into focus exactly as it is spoken. text = the phrase copied from the narration (≤10 words, cue = its first words), accent = the 1–3 words to highlight, layout:
  • "display": the words alone on a clean frame, the scene clears behind them — for the core promise.
  • "panel": the camera pushes through the subject into a full colour panel with the words in white — for a turning point, the problem, or "Meet <product>".
  • "side": two lines beside the subject (lighter lead-in, strong accent line) — to name what the subject is doing.
  • "pill": a short line or question in a capsule over the scene (≤6 words).
  The last beat is normally a statement on the closing phrase (its layout is chosen automatically). Use 2–3 statements per video with DIFFERENT layouts: typography is a main design element, not only an end card.
- list: when the narration names 3–5 things in a row (features, benefits, problems), show them as a rolling checklist, one item in focus at a time as it is spoken. items = 3–5 short phrases (≤4 words each, taken from the narration, in spoken order); cue = the words where the list starts.

STRUCTURE — pick ONE arc and follow it, so every video has the same designed rhythm:
- PROCESS (a flow, an order, a journey): hero_enter (or actor_enter → hero_enter) → hero_morph / add_step ×2–4 with confirms → statement (side) mid-way → converge → closing statement.
- PLATFORM (an app, a dashboard, integrations): ui_showcase (≥1.6 s) → iris_to_hub → orbit → confirm → statement (panel or display) → closing statement.
- TRANSFORMATION (before → after, raw → polished): hero_enter → statement (pill, the problem) → hero_morph ×1–2 → celebrate → statement (panel, the promise) → closing statement.
- BENEFITS (a list of what you get): hero_enter → hero_morph / orbit → list (the benefits as spoken) → statement (display) → closing statement.

SCREENSHOTS: when SCREENSHOTS > 0 the client uploaded real product screenshots; include one ui_showcase (they are shown on it) where the narration talks about the product, and describe its rows/title from the narration.
ENDING: the video always closes on the brand lockup (the client's logo and product name), added automatically in the last ~2 seconds; your closing statement comes just before it.

PACING (the picture moves with the voice from the first word to the last)
- Spread beats over the WHOLE narration: never more than 3 s of speech without a new beat (a ui_showcase may hold up to 7 s, a statement up to 4 s).
- ui_showcase needs at least 1.6 s before the next beat; orbit about 1.3 s; put quick accents (confirm, celebrate) between bigger moves.
- The final 3 s must carry a beat — usually the closing statement.

RULES
- ${MAX_BEATS} beats at most; about one beat every 1–2 seconds of narration; first beat establishes the scene (hero_enter, actor_enter or ui_showcase).
- Continuity: the same subject persists from its first appearance to the end; later beats transform or connect it. Never a sequence of unrelated objects.
- Every beat must change what the viewer sees; do not repeat an action twice in a row unless it continues a chain (add_step).
- Icons: Lucide icon names (e.g. shopping-bag, package, truck, credit-card, house, calendar-check, shield-check, users, landmark, wallet, bell-ring, mail, rocket, sparkles). Pick the most literal icon for each noun.
- Labels are 1–3 words taken from or implied by the narration. No invented facts, prices, percentages or customer names in labels or titles.
- theme: "lavender" (bright, friendly SaaS), "mint" (fresh white and green: health, wellness, finance, sustainability, calm), "teal" (clean white and teal: operations, B2B platforms, data, security, logistics) or "midnight" (dark, dramatic, premium). Pick the one that fits the product; use creative_preferences.visual_style as a hint: Bold / Futuristic / Cinematic → midnight; Minimal / Corporate → teal or mint; Premium SaaS → lavender, mint or teal.
- Unused fields are null.

VISUAL CONCEPT SOURCE — the client's VIDEO DIRECTION comes first
- ADVANCED_DIRECTION is the client's video direction: what the viewer should see. It is the brief for your beats. Follow it closely — its subject, objects, world, mood, the order things appear, what transforms, which moments get big type — translating each idea into the nearest pattern (a named object → hero_enter / hero_morph with the most literal icon; "show our app/dashboard" → ui_showcase; "list/benefits" → list; "everything connects" → orbit; "comes together" → converge; a key line → statement). Never replace it with a generic concept, and never repeat a default arc when the direction asks for something else.
- Match its mood with the theme and statement layouts (e.g. calm/clean → mint or teal, display lines; bold/energetic → panels, more beats).
- If it is empty, derive the concept from the narration itself: its subject, its process, its outcome.
- creative_preferences.target_audience (if any) tells you who watches; brand_name is the product name.

LOTTIE ACCENTS (celebrate.lottie must be one of these names):
${LOTTIES}`;

export type FlowDirectorInput = {
  narration: string;
  screenshots?: number; // product screenshots the client uploaded
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
  const format = { format: zodTextFormat(FlowScriptModel, "flow_script") };
  // Blockers reject a script; quality notes (dead time, overflowing text,
  // camera jolts, measured on the compiled plan) ask for one revision but do
  // not reject it.
  const check = (raw: FlowScript | null) => {
    if (!raw) return { script: null, problems: ["no structured output"], notes: [] as string[] };
    const script = repairFlowScript(FlowScript.parse(raw));
    const problems = flowScriptBlockers(script, input.narration, input.words, input.duration_seconds);
    if (problems.length) return { script: null, problems, notes: [] as string[] };
    let notes: string[] = [];
    try {
      // Judged as it will render: with the closing brand lockup.
      const brand = { name: input.product_name ?? "", logo: "logo" };
      notes = qualityProblems(planQuality(compileFlowScript(script, { narration: input.narration, words: input.words, durationSeconds: input.duration_seconds, brand })));
    } catch (e) {
      return { script: null, problems: [`does not compile: ${e instanceof Error ? e.message : e}`], notes };
    }
    return { script, problems, notes };
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
          SCREENSHOTS: input.screenshots ?? 0,
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
    problems = result.problems.length ? result.problems : result.notes;
    const left = budgetMs - (Date.now() - started);
    if ((!result.script || result.notes.length) && first.id && left > 25_000) {
      attempts++;
      let revised;
      try {
        revised = await client.responses.parse(
          { model, instructions: INSTRUCTIONS, previous_response_id: first.id, input: `Your beats failed these checks:\n- ${problems.slice(0, 12).join("\n- ")}\nReturn the corrected complete FlowScript.`, text: format },
          { timeout: Math.min(60_000, left) },
        );
      } catch (e) {
        // A failed or timed-out revision never discards a usable first draft.
        return { script: result.script, attempts, revised: false, errors: [`revision failed: ${e instanceof Error ? e.message : e}`, ...problems], ms: Date.now() - started, timing };
      }
      usage.inputTokens += revised.usage?.input_tokens ?? 0;
      usage.outputTokens += revised.usage?.output_tokens ?? 0;
      const second = check(revised.output_parsed);
      // Keep the revision if it is usable; otherwise a usable first draft.
      if (second.script || !result.script) result = second;
      problems = result.problems.length ? result.problems : result.notes;
    }
    return { script: result.script, attempts, revised: attempts > 1, errors: problems, ms: Date.now() - started, timing };
  } catch (e) {
    return { script: null, attempts, revised: attempts > 1, errors: [e instanceof Error ? e.message : String(e)], ms: Date.now() - started, timing };
  } finally {
    if (attempts) onUsage?.(usage);
  }
}
