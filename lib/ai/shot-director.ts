import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import type { SceneDirectorInput, SceneDirectorResult } from "@/lib/ai/scene-director";
import { compositionCheck, violationNote } from "@/components/video/flow/composition-check";
import { type DirectionDiagnostics, searchCreative, seedFrom } from "@/lib/shot-search";
import type { SceneScript } from "@/lib/scene-script";
import { continuityCheck, type Direction, directionScripts, type Dna, expandShots, isFixableNote, shotCatalogText, type ShotScript, ShotScriptModel } from "@/lib/shots";
import { tokenize } from "@/lib/voice-timing";

// Shot Director: picks a tested shot template (lib/shots.ts) for each moment
// of the narration and fills in its words. Sizes, places, motion, cursor and
// sound come from the templates, so the Director cannot make a crowded,
// tiny or off-frame picture. One call, at most one revision; never throws.

const INSTRUCTIONS = `You are the editor of a calm explainer video for a software product (the style of Keka, Linear or Stripe explainers: one idea at a time, one subject always in focus). The narration is final and already recorded. You cut it into SHOTS and pick, for each, a tested shot template and its words. The engine draws every shot (sizes, places, motion, cursor, sound), so you only choose the shot and write its short texts.

OUTPUT (JSON only, no prose; unused fields null): { theme, creative, variants[] }.
- creative (shared): message, audience, tone, pace (calm | balanced | brisk).
- variants: FOUR creative directions A, B, C, D for the SAME narration, each { id, dna, direction, shots[] }.
- dna (controlled values only): composition hero | workspace | kinetic-type | object-story · cards none | accent | primary · icons outline | solid | minimal · typography editorial | ui-labels | dominant | secondary · transitions push | panel | type | object · motion physical | assemble | scale-reveal | transform · camera push | lateral | static | orbit · background open | grid | bold-field | environment. The four use four DIFFERENT compositions and differ in at least 6 of: composition, cards, typography, motion, transitions, camera, background, icons, shot sequence. The engine sets the look and the camera from the dna; the SHOTS must follow it: hero → a picture subject per shot, at most one ui · workspace → the product's ui card leads (ui, outputs) · kinetic-type → at least 40% line/number shots, at most one ui · object-story → object:/visual: pictures with object behaviors, at most one ui · cards none → no ui/outputs; accent → one ui, no outputs; primary → ui leads · typography editorial → at least one big line; dominant → 3+ line/number shots; secondary → at most 2 big lines · motion physical → things travel (move, route, dock, steps, outputs); assemble → pieces gather or connect; scale-reveal → numbers and reveals; transform → transform/converge or a word swap.
- direction: concept, hero, metaphor, story, shot_approach, assets, opening, ending, motion, camera — each at most 8 words, never numbers or positions.
- The four are genuinely different stories: another concept, hero, metaphor, story, shot sequence, assets, object behaviors and camera. Never the same shots with other colours, background, icons, transitions or camera (the engine varies the look). E.g. a finance tool: A scattered data → one view · B money flows through one system · C numbers → insight → decision · D pieces connect into one picture.
- Each variant covers the whole narration and keeps every rule below. Each shot shows what the viewer should SEE for its words in that direction; a persisting object stays the next shot's subject when the shot allows.
- shot fields: shot, cue, subject, label, text { line, line_cue, accent, mark } (problem, number, line shots), ui { card, title, input, button, action_cue, result, result_cue } (ui shot), items, camera, objects, recipe.

OBJECTS (each shot's objects — the story's things, by identity, never positions): one entry per picture that matters: id (a short semantic id like "release_notes", the SAME id every time the same thing is shown), role (hero | support | context), asset (which picture of this shot it is: the subject, an item's asset, "card" for the ui card, "logo" for the reveal), enters (true where it first appears; false when it continues from an earlier shot), persistent (true when it stays into the next shot), exits (true when it leaves after this shot; never with persistent), transforms_from / transforms_to (the id of the object it turns from / into, else null). A persisting object keeps its id in the next shot (enters false), so the viewer follows ONE object instead of seeing a new copy. behavior (what the object DOES in this shot, else null): { type, target, cue } — type is one of enter (comes in with the shot; only when enters is true) · move (goes to the target) · accumulate (pieces pile up beside the target, the collection point; give each piece its own id, the same asset is fine) · converge (several objects fly into the target) · assemble (pieces combine into the target) · transform (becomes the target — set transforms_to to it, and the target's transforms_from to this id) · connect (a line to the target) · dock (lands in the target) · route (travels along a path to the target) · reveal (everything comes into view) · highlight (it pulses; the rest dims) · exit (it leaves). target is another object id of the SAME shot (needed for move, accumulate, converge, assemble, transform, connect, dock, route; else null). cue is 1–6 narration words when it happens, later than the shot's other cues (null only for enter). After converge, assemble, transform, dock or exit the object is gone: never persistent. You say WHAT happens; never positions, sizes, durations or easing. objects null when nothing carries over or acts.

SCENE RECIPE (recipe — how the scene visually exists, a premium motion-design composition instead of the template's centred subject; write one for the 3–5 most important shots of each variant — the problem, the product at work, the proof, the promise — and null elsewhere). Intents only, never positions or numbers; the engine places, sizes, lights and times everything on the voice:
- scene_id: a short id ("s1").
- environment: open | studio | dark-space | grid-space | product-space | data-space | cinematic — the world the scene lives in (a product → product-space, numbers → data-space, a problem → studio, a promise → cinematic). Neighbouring scenes may share one (the world continues).
- hero: { type: device | 3d-object | data-visual | typography | ui-plane | product | object-group, asset, role (2–4 words: what it means), persistence: persistent | scene }. asset: object:<name> (3d-object), device:<phone|tablet|laptop|browser|monitor>/<light|dark> (device; a ui shot shows its card on the screen), "card" (ui-plane or product: the ui shot's own card, tilted as a plane in 3D), visual:<name> or text:<number> (data-visual), text:<1–3 words> (typography), logo. Never an icon:. ONE strong hero that carries the meaning. persistent: the next recipe scene names the same asset and the same object stays and travels (no new copy).
- supporting: 0–3 objects, only with a purpose: { id ("s1"…), asset (object:, visual:, icon:, text:, shape:), role (2–4 words), layer: background | midground | foreground, relation: feeds-hero | from-hero | beside-hero | behind-hero | orbits-hero, persistence }. Fewer and stronger beats more; never decoration.
- composition: hero-right | hero-left | hero-center | asymmetric | depth-stack | foreground-hero | cinematic-wide | split-depth | typography-led | full-frame. Vary it; never hero-center for every scene.
- typography: { position: auto | left | right | top-left | top | bottom | bottom-left (never on the hero's side), scale: hero | supporting, emphasis: word-highlight | pill | strike | none } — the shot's line (text) is placed there, word by word on the voice.
- camera: { intent: static | push-in | pull-back | lateral | focus-hero | reveal | orbit-intent, intensity: low | medium | high } (this replaces the shot's camera).
- behaviors: what the objects DO on their words: { type: reveal (a supporting object arrives on its words) | move | connect | flow (data runs from → to) | merge | assemble | transform | highlight | expand | focus (the camera pushes on it, the rest blurs), from ("hero" or a supporting id), to (an id or null), cue (1–6 narration words spoken after the shot's cue, in order) }. At least one where the narration says something happens.
- transition_in: cut | push | panel-wipe | iris | flash | object-transform (a persistent hero carries into this scene) | morph-intent | dissolve; transition_out: the same, or null (how the next, non-recipe scene arrives). Never all the same.

CAMERA (each shot's camera, an intent — never positions or numbers): establish (the opening: wide and settling) · reveal (the product or answer opens up) · push (move closer to what matters now) · close (a detail in focus) · pull_back (show the bigger picture) · follow / track (the eye travels across a row or a flow) · hold (stay still so a number or a line can be read) · overhead (rise above it) · transition (a quiet bridge). Open with establish; reveal where the product is named; hold on numbers and on the closing line; push on the problem; vary — never the same intent three shots in a row.

SHOTS (shot: what it shows — the fields it uses):
${shotCatalogText()}

CUES: every cue (cue, text.line_cue, ui.action_cue, ui.result_cue, items[].cue, behavior.cue) is 1–6 consecutive words copied EXACTLY from NARRATION, all in spoken order across the whole video (each cue after the previous one). A shot starts on its cue; its other moments land on their own later cues.

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

// The one-direction answer (fallback): needs about this long (real runs:
// 40–75 s), and asks for A only.
export const SINGLE_MS = 55_000;
// How long the four-direction call may take with `leftMs` to go: time is kept
// back for the one-direction answer. (Four directions took ~95 s uncompacted
// in a real run; the compact answer is shorter.) Under 30 s it is skipped.
export const fourDirectionsTimeout = (leftMs: number) => Math.min(110_000, leftMs - 8_000 - SINGLE_MS);
const SINGLE = `\n\nThis time write ONE variant only (id A): your strongest direction. The rules on how four directions differ do not apply; every other rule does. With one direction there is room for a scene recipe on every meaningful shot.`;
// How many directions a Director call asks for. One strong direction is the
// primary path (one script → one premium video); the four-direction picker
// stays available behind SHOT_DIRECTIONS=4.
export type DirectionMode = "single" | "four";
export const directionMode = (env: string | undefined = process.env.SHOT_DIRECTIONS): DirectionMode => (env?.trim() === "4" ? "four" : "single");

// The videos offered to the customer: one per creative direction (the first is `script`).
export type ShotVariantOut = { seed: number; score: number; scene: SceneScript; variant: string | null; direction: Direction | null; dna: Dna | null };
// diagnostics: what the search did with each direction; status says whether
// four different videos came out (else INSUFFICIENT_VISUAL_DIVERSITY).
export type ShotDirectorDiagnostics = { mode: "four" | "single"; status: string; directions: DirectionDiagnostics[]; output_tokens: number };
export type ShotDirectorResult = SceneDirectorResult & { shots: ShotScript | null; variants: ShotVariantOut[]; diagnostics: ShotDirectorDiagnostics | null };

// `client` is for tests (a stand-in for the OpenAI client).
export async function generateShotScript(input: SceneDirectorInput, onUsage?: (usage: BriefUsage) => void, budgetMs = 100_000, client?: Pick<OpenAI, "responses">, wanted: DirectionMode = directionMode()): Promise<ShotDirectorResult> {
  const started = Date.now();
  const timing = input.words?.length ? "voice" : "estimated";
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const usage = { model, inputTokens: 0, outputTokens: 0 };
  const format = { format: zodTextFormat(ShotScriptModel, "shot_script") };
  const quick = /^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {};
  const none = { violations: [] as ReturnType<typeof compositionCheck>, notes: [] as string[], variants: [] as ShotVariantOut[], status: "failed", directions: [] as DirectionDiagnostics[] };
  // Each draft holds four creative directions; each is built a few ways, its
  // cleanest kept, and the directions that are truly different are offered
  // (lib/shot-search.ts searchCreative); the seed comes from the project.
  const seed = input.seed ?? seedFrom(input.narration);
  const check = (raw: unknown) => {
    if (!raw) return { shots: null, script: null, problems: ["no structured output"], ...none };
    // Phase 6.5: one shot script per creative direction (A–D).
    const scripts = directionScripts(ShotScriptModel.parse(raw));
    if (!scripts.length) return { shots: null, script: null, problems: ["no creative directions"], ...none };
    const expandNotes: string[] = [];
    for (const shots of scripts) {
      // Phase 4: object continuity (errors reach the revision through the expand notes).
      const chain = continuityCheck(shots.shots);
      if (chain.errors.length || chain.warnings.length) console.info("shot continuity:", { variant: shots.variant, ...chain });
      const notes: string[] = [];
      expandShots(shots, notes, input.narration);
      expandNotes.push(...notes.map((n) => `direction ${shots.variant}: ${n}`));
    }
    try {
      // (One direction asked for: one video is the full answer, not too few.)
      const found = searchCreative(scripts, { narration: input.narration, words: input.words, durationSeconds: input.duration_seconds, screenshots: input.screenshots, brand: { name: input.product_name ?? "", logo: "logo" } }, seed, { taste: input.taste, pick: wanted === "single" ? 1 : 4 });
      if (!found.best) return { shots: scripts[0], script: null, problems: found.blockers.length ? found.blockers : ["no direction compiles to a valid plan"], ...none, directions: found.diagnostics };
      const { script, violations, plan } = found.best;
      const shots = found.best.shots ?? scripts[0];
      console.info("shot variants:", { repaired: found.best.notes.filter((n) => n.startsWith("cue ")), tried: found.tried, picks: found.picks.map((p) => ({ variant: p.shots?.variant, seed: p.seed, score: p.score, concept: p.shots?.direction?.concept })), skipped: found.skipped, resolved: plan.resolved });
      const variants = found.picks.map((p) => ({ seed: p.seed, score: p.score, scene: p.script, variant: p.shots?.variant ?? null, direction: p.shots?.direction ?? null, dna: p.shots?.dna ?? null }));
      // Fewer than four different directions is never padded with copies.
      const thin = found.insufficient && scripts.length > 1 ? [`${found.status}: ${found.picks.length} of 4 directions are valid and different (${found.skipped.map((x) => `${x.variant}: ${x.reason}`).join("; ")}) — give each direction its own composition, cards, typography, motion and shot sequence`] : [];
      return { shots, script, problems: [] as string[], violations, notes: [...expandNotes, ...violations.map(violationNote), ...thin], variants, status: found.status as string, directions: found.diagnostics };
    } catch (e) {
      return { shots: scripts[0], script: null, problems: [`does not compile: ${e instanceof Error ? e.message : e}`], ...none };
    }
  };
  let attempts = 0;
  let problems: string[] = [];
  let mode: "four" | "single" = "four";
  let fourDirections: DirectionDiagnostics[] = []; // (kept when the one-direction answer replaces them)
  try {
    if (!client && !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
    const ai = client ?? new OpenAI({ maxRetries: 0 });
    const request = JSON.stringify({
      NARRATION: input.narration,
      WORDS: input.words?.length ? input.words.filter((w) => tokenize(w.text).length).map((w) => [w.text, Math.round(w.start * 100) / 100]) : null,
      duration_seconds: input.duration_seconds,
      product_name: input.product_name ?? null,
      DIRECTION: input.creative_preferences?.advanced_direction?.trim() || input.creative_preferences?.direction?.trim() || null,
      creative_preferences: input.creative_preferences ? { ...input.creative_preferences, advanced_direction: undefined } : null,
    });
    const ask = (instructions: string, timeout: number) => {
      attempts++;
      return ai.responses.parse({ model, instructions, input: request, text: format, ...quick }, { timeout });
    };
    const count = (r: { usage?: { input_tokens?: number; output_tokens?: number } | null }) => {
      usage.inputTokens += r.usage?.input_tokens ?? 0;
      usage.outputTokens += r.usage?.output_tokens ?? 0;
    };
    const left = () => budgetMs - (Date.now() - started);
    let result: ReturnType<typeof check> = { shots: null, script: null, problems: [], ...none };
    let fellBack = false; // four directions failed and one was asked for instead
    // One revision of an answer that failed its checks, if time allows.
    const revise = async (firstId: string | undefined, instructions: string, ask4: string, timeout: number) => {
      if (!firstId || timeout < 20_000) return;
      try {
        attempts++;
        const revised = await ai.responses.parse({ model, instructions, previous_response_id: firstId, input: `Your shots failed these checks:\n- ${problems.slice(0, 12).join("\n- ")}\n${ask4}`, text: format, ...quick }, { timeout });
        count(revised);
        const second = check(revised.output_parsed);
        if (!result.script || (second.script && second.violations.length <= result.violations.length)) result = second;
        problems = result.problems.length ? result.problems : result.notes;
      } catch (e) {
        problems = [`revision failed: ${e instanceof Error ? e.message : String(e)}`, ...problems];
      }
    };
    if (wanted === "single") {
      // The primary path: one strong direction, one revision if it needs one.
      if (left() >= 30_000) {
        try {
          const one = await ask(INSTRUCTIONS + SINGLE, Math.min(110_000, left() - 3_000));
          count(one);
          result = check(one.output_parsed);
          problems = result.problems.length ? result.problems : result.notes;
          console.info("shot director (one direction):", { ms: Date.now() - started, output_tokens: one.usage?.output_tokens, usable: !!result.script, problems: problems.slice(0, 8) });
          if (!result.script || result.notes.some(isFixableNote)) await revise(one.id, INSTRUCTIONS + SINGLE, "Return the corrected complete ShotScript with variant A only.", Math.min(60_000, left() - 3_000));
        } catch (e) {
          problems = [`single direction failed: ${e instanceof Error ? e.message : String(e)}`];
          console.warn("shot director: one direction failed", { ms: Date.now() - started, error: problems[0] });
        }
      } else problems = [`single direction skipped: ${Math.round(left() / 1000)} s left`];
      if (!result.script) console.warn("shot director: no usable shots", { ms: Date.now() - started, problems: problems.slice(0, 6) });
      const diagnostics: ShotDirectorDiagnostics = { mode: "single", status: result.script ? result.status : "failed", directions: result.directions, output_tokens: usage.outputTokens };
      return { script: result.script, shots: result.script ? result.shots : null, variants: result.script ? result.variants : [], attempts, revised: attempts > 1, errors: problems, ms: Date.now() - started, timing, violations: result.violations, diagnostics };
    }
    // Four directions in one call, with time kept back for the one-direction
    // answer should it fail (no blind retry of the same request).
    const fourTimeout = fourDirectionsTimeout(left());
    if (fourTimeout >= 30_000) {
      try {
        const first = await ask(INSTRUCTIONS, fourTimeout);
        count(first);
        result = check(first.output_parsed);
        problems = result.problems.length ? result.problems : result.notes;
        console.info("shot director first draft:", { ms: Date.now() - started, output_tokens: first.usage?.output_tokens, usable: !!result.script, variants: result.variants.map((v) => v.variant), problems: problems.slice(0, 8) });
        // One revision while the one-direction answer still fits after it.
        if ((!result.script || result.notes.some(isFixableNote)) && first.id && left() - SINGLE_MS > 30_000) await revise(first.id, INSTRUCTIONS, "Return the corrected complete ShotScript with all four variants.", Math.min(60_000, left() - (result.script ? 3_000 : SINGLE_MS)));
      } catch (e) {
        problems = [`four directions failed: ${e instanceof Error ? e.message : String(e)}`];
        console.warn("shot director: four directions failed", { ms: Date.now() - started, error: problems[0] });
      }
    } else problems = [`four directions skipped: ${Math.round(left() / 1000)} s left`];
    // Fallback: one direction through the same shot engine (never the
    // free-form Scene Director while this still fits).
    if (!result.script) {
      fourDirections = result.directions;
      if (left() >= SINGLE_MS) {
        mode = "single";
        fellBack = true;
        try {
          const one = await ask(INSTRUCTIONS + SINGLE, Math.min(90_000, left() - 3_000));
          count(one);
          const single = check(one.output_parsed);
          if (single.script) result = single;
          problems = [...problems, ...(single.problems.length ? single.problems : single.notes).map((p) => `single: ${p}`)];
          console.info("shot director single direction:", { ms: Date.now() - started, output_tokens: one.usage?.output_tokens, usable: !!single.script });
        } catch (e) {
          problems = [...problems, `single direction failed: ${e instanceof Error ? e.message : String(e)}`];
        }
      } else problems = [...problems, `single direction skipped: ${Math.round(left() / 1000)} s left`];
      if (!result.script) console.warn("shot director: no usable shots", { ms: Date.now() - started, problems: problems.slice(0, 6) });
    }
    const diagnostics: ShotDirectorDiagnostics = { mode, status: result.script ? result.status : "failed", directions: mode === "single" && fourDirections.length ? fourDirections : result.directions, output_tokens: usage.outputTokens };
    return { script: result.script, shots: result.script ? result.shots : null, variants: result.script ? result.variants : [], attempts, revised: attempts > 1, errors: fellBack ? [`fallback: one direction`, ...problems] : problems, ms: Date.now() - started, timing, violations: result.violations, diagnostics };
  } catch (e) {
    return { script: null, shots: null, variants: [], attempts, revised: attempts > 1, errors: [e instanceof Error ? e.message : String(e)], ms: Date.now() - started, timing, violations: [], diagnostics: null };
  } finally {
    if (attempts) onUsage?.(usage);
  }
}
