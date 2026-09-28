import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { cardCatalogText, deviceCatalogText } from "@/components/video/flow/cards/catalog";
import { CROP_NAMES } from "@/components/video/flow/cards/device-data";
import { CARD_STYLES } from "@/components/video/flow/cards/types";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { layoutCatalogText } from "@/components/video/flow/layouts";
import { planQuality, qualityProblems } from "@/components/video/flow/quality";
import { validateFlowPlan } from "@/components/video/flow/validate";
import { CAMERA_MOVES, ENTER_STYLES, ERASE_STYLES, MAX_ELEMENTS_PER_SCENE, MAX_SCENE_BEATS, PATH_STYLES, repairSceneScript, SceneScript, SceneScriptModel, sceneScriptBlockers, TRANSITIONS } from "@/lib/scene-script";
import { tokenize, type WordTiming } from "@/lib/voice-timing";

// Visual Director v2: turns the finished narration (and its word timestamps)
// and the client's video direction into a SceneScript — scenes of product
// elements (UI cards, device mockups, screenshot crops, icons) and motion verbs
// on spoken words. The compiler lays out, animates, moves the camera and
// transitions. One call, at most one revision; never throws.

const LOTTIES = Object.keys(LOTTIE_MANIFEST).join(", ");

const INSTRUCTIONS = `You are the motion designer of a premium product promo video (the style of Apple / Stripe / Linear launch films: clean UI cards floating on a soft canvas, things travelling, reacting and assembling). The narration is final and already recorded. You direct WHAT the viewer sees on which spoken words, as scenes of product elements and motion verbs. A compiler builds the animation (layout, sizes, easing, camera, transitions, sound), so you only decide the story in pictures.

OUTPUT: { theme, beats[] }. Each beat is one verb that starts on its cue. Unused fields are null.

CUE: 1–6 consecutive words copied EXACTLY from NARRATION, in spoken order (each cue after the previous one). The motion lands on those words.

ELEMENTS (in scene/place beats): { id, asset, content, screen, label }
- id: a short name you choose ("order", "stock", "dash"). Reuse it to act on the element later.
- asset:
  • "card:<template>/<style>": a product UI card. Styles: ${CARD_STYLES.join(", ")} (glass = frosted, solid = white, tinted = soft brand tint, dark = dark card, accent = full brand colour — use accent for the ONE card that matters most in a scene).
  • "device:<model>/<light|dark>": a device mockup; screen = "shot:<n>/<crop>" (a client screenshot) or "card:<template>/<style>".
  • "shot:<n>/<crop>": a crop of client screenshot n (1-based), floating as a card. Only when SCREENSHOTS > 0.
  • "icon:<lucide-name>": a glass icon tile (label = caption ≤2 words).
  • "logo": the client's logo.
  • null: an element that already exists (by id), carried into a new scene.
- content: the card's text slots (only the slots its template lists; others null). Short, UI-like, taken from or implied by the narration and direction: titles 1–3 words, statuses 1–2 words, values like "128", "৳2.4M", "12 hrs". Values are illustrative UI, never factual claims about the client.

CARD TEMPLATES (id [slots] meaning):
${cardCatalogText()}

DEVICES: ${deviceCatalogText()}
SCREENSHOT CROPS: ${CROP_NAMES.join(", ")}

LAYOUTS (scene/arrange layout; pick a lettered variant for variety, e.g. "scatter-c", "hub-b"):
${layoutCatalogText()}

VERBS (action):
- scene: start a scene: elements (1–${MAX_ELEMENTS_PER_SCENE}) in a layout; camera (${CAMERA_MOVES.join(", ")}); transition from the previous scene (${TRANSITIONS.join(", ")}; morph = carried elements travel into the new layout, the others leave). style = entrance (${ENTER_STYLES.join(", ")}) or null for a varied mix.
- place: add elements to the current scene (the scene re-lays out).
- move: targets [one id] travels next to "to" (style: ${PATH_STYLES.join(", ")}).
- trigger: targets [one id] flies INTO "to", which reacts; content = what "to" now shows (e.g. an order hitting the inventory card → status "Updated").
- update: targets [one card]; content = its new values (a status flips, a number counts up).
- connect: a line with a travelling packet from targets [one id] to "to".
- merge: targets fly into "to" (assembling, "all in one").
- arrange: the current elements reorganise into a new layout (chaos → order).
- erase: targets are wiped away (style: ${ERASE_STYLES.join(", ")}) — busywork, problems, manual steps disappearing.
- highlight: targets [one id] pulses, the rest dim briefly.
- focus: the camera pushes in on targets [one id].
- reveal: the camera pulls back to show the whole system.
- celebrate: a Lottie accent at targets [one id] (lottie: ${LOTTIES}).
- statement: the narration's key phrase as kinetic type, each word appearing as spoken. text = the phrase copied from the narration (≤10 words; cue = its first words), accent = 1–3 words to highlight, text_layout: "display" (words alone on a clean frame), "panel" (full colour panel), "side"/"pill" (a caption over the scene).
- list: 3–5 things named in a row → a rolling checklist; items ≤4 words each, from the narration, in order.

DIRECTION FIRST
- ADVANCED_DIRECTION is the client's video direction: the brief for what the viewer sees. Follow its objects, order, transformations and mood closely, translating each idea into elements and verbs (e.g. "separate tools scattered" → a scatter scene of cards; "an order moves and triggers inventory" → trigger with update; "everything assembles into one platform" → morph into mosaic / merge; "automation erases busywork" → erase; "pull back to the connected system" → reveal). Never replace it with a generic concept.
- If it is empty, derive the concept from the narration: its objects, its process, its outcome — shown as the product's own UI.
- Make it specific to this product: pick templates that name its real objects (orders, couriers, patients, invoices, lessons…), with content in its words.

RHYTHM
- ${MAX_SCENE_BEATS} beats at most; about one beat every 1–1.5 s of speech; never more than 3 s of speech without a new beat (4 s after a scene, list, arrange or reveal).
- 2–4 scenes, each with a different layout family and a different transition; 3–6 elements per scene is typical (one hero element, supporting ones).
- Inside a scene, make things HAPPEN (trigger, update, connect, move, merge, erase) — a scene where nothing reacts is a slideshow.
- 1–2 statements (or a list) where the narration states its promise; the last beat is usually a statement on the closing phrase. The brand lockup (logo, name, call to action) is added automatically after it.
- theme: "lavender" (friendly SaaS), "mint" (health, wellness, finance, calm), "teal" (operations, B2B, logistics, data, security) or "midnight" (dark, dramatic, premium). creative_preferences.visual_style is a hint.`;

export type SceneDirectorInput = {
  narration: string;
  screenshots?: number;
  words?: WordTiming[] | null;
  duration_seconds: number;
  product_name?: string;
  creative_preferences?: Record<string, string>;
};
export type SceneDirectorResult = { script: SceneScript | null; attempts: number; revised: boolean; errors: string[]; ms: number; timing: "voice" | "estimated" };

export async function generateSceneScript(input: SceneDirectorInput, onUsage?: (usage: BriefUsage) => void, budgetMs = 100_000): Promise<SceneDirectorResult> {
  const started = Date.now();
  const timing = input.words?.length ? "voice" : "estimated";
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const usage = { model, inputTokens: 0, outputTokens: 0 };
  const format = { format: zodTextFormat(SceneScriptModel, "scene_script") };
  // Blockers reject a script; quality notes (measured on the compiled plan)
  // ask for one revision but do not reject it.
  const check = (raw: unknown) => {
    if (!raw) return { script: null, problems: ["no structured output"], notes: [] as string[] };
    const script = repairSceneScript(SceneScript.parse(raw));
    const problems = sceneScriptBlockers(script, input.narration, input.words, input.duration_seconds);
    if (problems.length) return { script: null, problems, notes: [] as string[] };
    let notes: string[] = [];
    try {
      // Judged as it will render: with the closing brand lockup.
      const plan = compileSceneScript(script, { narration: input.narration, words: input.words, durationSeconds: input.duration_seconds, brand: { name: input.product_name ?? "", logo: "logo" } });
      const invalid = validateFlowPlan(plan);
      if (invalid.length) return { script: null, problems: invalid.slice(0, 6).map((e) => `compiles to an invalid plan: ${e}`), notes };
      notes = qualityProblems(planQuality(plan));
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
      const revised = await client.responses.parse(
        { model, instructions: INSTRUCTIONS, previous_response_id: first.id, input: `Your beats failed these checks:\n- ${problems.slice(0, 12).join("\n- ")}\nReturn the corrected complete SceneScript.`, text: format },
        { timeout: Math.min(60_000, left) },
      );
      usage.inputTokens += revised.usage?.input_tokens ?? 0;
      usage.outputTokens += revised.usage?.output_tokens ?? 0;
      const second = check(revised.output_parsed);
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
