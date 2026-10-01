import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import type { SceneDirectorInput, SceneDirectorResult } from "@/lib/ai/scene-director";
import { compositionCheck, violationNote } from "@/components/video/flow/composition-check";
import { searchVariants, seedFrom } from "@/lib/shot-search";
import type { SceneScript } from "@/lib/scene-script";
import { expandShots, shotCatalogText, ShotScript, ShotScriptModel } from "@/lib/shots";
import { tokenize } from "@/lib/voice-timing";

// Shot Director: picks a tested shot template (lib/shots.ts) for each moment
// of the narration and fills in its words. Sizes, places, motion, cursor and
// sound come from the templates, so the Director cannot make a crowded,
// tiny or off-frame picture. One call, at most one revision; never throws.

const INSTRUCTIONS = `You are the editor of a calm explainer video for a software product (the style of Keka, Linear or Stripe explainers: one idea at a time, one subject always in focus). The narration is final and already recorded. You cut it into SHOTS and pick, for each, a tested shot template and its words. The engine draws every shot (sizes, places, motion, cursor, sound), so you only choose the shot and write its short texts.

OUTPUT: { theme, creative, concepts[], shots[] }. Unused fields are null. Think in this order:

1. creative — read only the NARRATION: message (the one thing to remember), audience, tone, pace (calm | balanced | brisk).
2. concepts[] — for each sentence or idea, answer "what should the viewer SEE to understand this?": cue (1–6 words where it is spoken), see (concrete objects and what happens to them, e.g. "scattered sheets pile up, then slide into one clear chart" — never a vague "show a dashboard"), hero (the one object in focus, written as an ASSET), persists (an object carried over from the previous idea, else null), avoid (what must not be shown, else null).
3. shots[] — the shots that show those concepts: each concept's hero is that shot's subject or item; keep a persisting object as the subject of the next shot when the shot allows it.

SHOTS (shot: what it shows — the fields it uses):
${shotCatalogText()}

CUES: every cue (cue, line_cue, action_cue, result_cue, items[].cue) is 1–6 consecutive words copied EXACTLY from NARRATION, all in spoken order across the whole video (each cue after the previous one). A shot starts on its cue; its other moments land on their own later cues.

ASSETS: object:<question|exclaim|check|rocket|bulb|star|trophy|shield|lock|bell|gift|target|coin|bolt|chart> (a glossy 3D object for a feeling or an idea: a question → question, an idea → bulb, launch or speed → rocket or bolt, a win → trophy or star, safe → shield or lock, done → check, money → coin, a goal → target, growth → chart, news → bell; the problem shot's subject, or beside a line) · icon:<lucide icon name> (a plain object: clock, file-text, mic, users, calendar, credit-card, shield-check, chart-line, globe, mail, share-2, rocket, search, bell, …) · visual:<waveform|filmstrip|clock|progress|download|play|bars> (voice/audio → waveform; video/scenes → filmstrip; time → clock; loading/rendering → progress; download/export → download; growth/results → bars) · text:<a number or measure with a digit> (only in the number shot). There are no brand logos of other companies: for "YouTube, Instagram …" use a group with a short label each (the engine shows labelled chips).

RULES
- One shot for every sentence or clause; a new shot about every 2–4 s of speech; never leave more than 3 s of speech without a new shot or moment. Cover the narration from the first word to the last line.
- Never people or animals (no persons, faces, hands, animals — in icons, objects or words to draw).
- Show exactly what the words say, literally: the thing named, never a pun on a word (the word "hero" is not a picture; "stays the hero" is a line, not a number).
- Open with problem (the pain) — never with reveal or a line. Use reveal once, where the product is named the first time. Show the product working with ui (+ outputs) at least once.
- number only for a real number or measure spoken in the narration ("4K", "3 minutes", "98%"); never a word.
- line for the promise and the closing phrase (2–6 words, the most important word as accent). The brand lockup (logo, name, call to action) is added automatically after the last shot — do not add a reveal or a line for the call to action.
- Vary: never the same shot kind three times in a row; mix pictures (problem, steps, group, ui, number) with at most 3 lines.
- Labels 1–2 words, titles 1–4 words, button 1–2 words (a verb), result 2–4 words. Plain words from the narration and the direction; no invented facts, customers or numbers.
- Captions (line on problem and number shots) use only words the voice says; otherwise leave them null. The ui shot card must have a button: action-panel (default), login, checkout or cta.
- theme: "lavender" (friendly SaaS), "mint" (health, wellness, finance, calm), "teal" (operations, B2B, data, security) or "midnight" (dark, premium). creative_preferences.visual_style is a hint.`;

// The videos offered to the customer: the same shots in different looks (the first is `script`).
export type ShotVariantOut = { seed: number; score: number; scene: SceneScript };
export type ShotDirectorResult = SceneDirectorResult & { shots: ShotScript | null; variants: ShotVariantOut[] };

export async function generateShotScript(input: SceneDirectorInput, onUsage?: (usage: BriefUsage) => void, budgetMs = 100_000): Promise<ShotDirectorResult> {
  const started = Date.now();
  const timing = input.words?.length ? "voice" : "estimated";
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const usage = { model, inputTokens: 0, outputTokens: 0 };
  const format = { format: zodTextFormat(ShotScriptModel, "shot_script") };
  const quick = /^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {};
  const none = { violations: [] as ReturnType<typeof compositionCheck>, notes: [] as string[], variants: [] as ShotVariantOut[] };
  // Each draft is built several ways and the cleanest variant is kept
  // (lib/shot-search.ts); the seed comes from the project.
  const seed = input.seed ?? seedFrom(input.narration);
  const check = (raw: unknown) => {
    if (!raw) return { shots: null, script: null, problems: ["no structured output"], ...none };
    const shots = ShotScript.parse(raw);
    const expandNotes: string[] = [];
    expandShots(shots, expandNotes, input.narration);
    try {
      const found = searchVariants(shots, { narration: input.narration, words: input.words, durationSeconds: input.duration_seconds, screenshots: input.screenshots, brand: { name: input.product_name ?? "", logo: "logo" } }, seed, { taste: input.taste });
      if (found.blockers.length) return { shots, script: null, problems: found.blockers, ...none };
      if (!found.best) return { shots, script: null, problems: ["no variant compiles to a valid plan"], ...none };
      const { script, violations, plan } = found.best;
      console.info("shot variants:", { repaired: found.best.notes.filter((n) => n.startsWith("cue ")), tried: found.tried, picks: found.picks.map((p) => ({ seed: p.seed, score: p.score, look: p.script.look })), resolved: plan.resolved });
      const variants = found.picks.map((p) => ({ seed: p.seed, score: p.score, scene: p.script }));
      return { shots, script, problems: [] as string[], violations, notes: [...expandNotes, ...violations.map(violationNote)], variants };
    } catch (e) {
      return { shots, script: null, problems: [`does not compile: ${e instanceof Error ? e.message : e}`], ...none };
    }
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
          DIRECTION: input.creative_preferences?.advanced_direction?.trim() || input.creative_preferences?.direction?.trim() || null,
          creative_preferences: input.creative_preferences ? { ...input.creative_preferences, advanced_direction: undefined } : null,
        }),
        text: format,
        ...quick,
      },
      { timeout: Math.min(90_000, budgetMs - 8_000) },
    );
    usage.inputTokens += first.usage?.input_tokens ?? 0;
    usage.outputTokens += first.usage?.output_tokens ?? 0;
    let result = check(first.output_parsed);
    problems = result.problems.length ? result.problems : result.notes;
    console.info("shot director first draft:", { ms: Date.now() - started, usable: !!result.script, problems: problems.slice(0, 8) });
    const left = budgetMs - (Date.now() - started);
    if ((!result.script || result.notes.length) && first.id && left > 20_000) {
      attempts++;
      try {
        const revised = await client.responses.parse(
          { model, instructions: INSTRUCTIONS, previous_response_id: first.id, input: `Your shots failed these checks:\n- ${problems.slice(0, 12).join("\n- ")}\nReturn the corrected complete ShotScript.`, text: format, ...quick },
          { timeout: Math.min(60_000, left) },
        );
        usage.inputTokens += revised.usage?.input_tokens ?? 0;
        usage.outputTokens += revised.usage?.output_tokens ?? 0;
        const second = check(revised.output_parsed);
        if (!result.script || (second.script && second.violations.length <= result.violations.length)) result = second;
        problems = result.problems.length ? result.problems : result.notes;
      } catch (e) {
        problems = [`revision failed: ${e instanceof Error ? e.message : String(e)}`, ...problems];
      }
    }
    return { script: result.script, shots: result.script ? result.shots : null, variants: result.script ? result.variants : [], attempts, revised: attempts > 1, errors: problems, ms: Date.now() - started, timing, violations: result.violations };
  } catch (e) {
    return { script: null, shots: null, variants: [], attempts, revised: attempts > 1, errors: [e instanceof Error ? e.message : String(e)], ms: Date.now() - started, timing, violations: [] };
  } finally {
    if (attempts) onUsage?.(usage);
  }
}
