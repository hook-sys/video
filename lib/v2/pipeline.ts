import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_MAX, voiceVideoSeconds } from "@/lib/projects";
import { type BriefUsage, ProductBrief } from "@/lib/ai/product-brief";
import { getAiConfig, unitCost, usageCost } from "@/lib/ai/models";
import { type MotionInput, directMotion, reviewMotion } from "@/lib/ai/motion-director";
import { falCost, openaiCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { ruleBrief } from "@/lib/rule-brief";
import { parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { AUDIO_BUCKET, storeVoiceAudio } from "@/lib/voice-audio";
import { getSettings } from "@/lib/app-settings";
import { brandOf, pastOf } from "@/lib/director-context";
import { loadV2NeverList } from "@/lib/v2/never";
import { checkProjectFrames, prepareFrameCheck } from "@/lib/frame-check";
import { renderWithin } from "@/lib/render-server";
import { TIER_IDS, type TierId, refundVideo, settleVideo } from "@/lib/billing";
import type { PipelineStep } from "@/lib/pipeline";
import { composeVariants } from "@/components/video/composer/variants";
import { scorePlan } from "@/components/video/composer/score";
import { frameOf } from "@/components/video/composer/frame";
import { styleRulesOf } from "@/components/video/composer/style";
import { RECIPES } from "@/components/video/composer/recipes";
import { techOffOf } from "@/components/video/composer/techniques";
import { scriptWords } from "@/components/video/composer/words";
import { v2DetailsOf, type V2Details } from "@/lib/v2/form";
import { type RoleAi, v2DirectorModel, v2Role, v2Speak, v2TimeScript, v2Transcribe, v2Whisper } from "@/lib/v2/models";
import { type V2Rules, v2DirectorOf, v2RulesOf } from "@/lib/v2/rules";
import { type V2Look, drawLook, freshSeed, hueColour, lookOf, lookText, varietyOf } from "@/lib/v2/variety";
import { copywrite } from "@/lib/v2/copywriter";

// "New version" (admin → Settings): one simple path, no fallbacks.
//   1. the voice: our voice reads the script (timed by the admin's Whisper),
//      or the customer's recording (its words heard by that Whisper)
//   2. the brief, by rule, from those words (no website, no AI)
//   3. the Motion Director on the admin's model, with fixed instructions
//      (classic prompt, house rules on; story shapes, Director's transitions,
//      visual match and the Creative Director off) — if it fails, the video
//      fails and its credits are returned (never a plan or a video by rule)
//   4. the frame check, the credits settled, the server render (as v1)
// No music (sound effects follow admin → Settings, as v1). The logo is put
// in the video where it is rendered (lib/render-input.ts).

const STALE_PIPELINE_MS = 15 * 60 * 1000;
type Admin = ReturnType<typeof createAdminClient>;

export async function startPipelineV2(projectId: string, userId: string) {
  const staleBefore = new Date(Date.now() - STALE_PIPELINE_MS).toISOString();
  const { data } = await createAdminClient()
    .from("projects")
    .update({ pipeline_status: "running", pipeline_step: "analyzing", pipeline_error: null })
    .eq("id", projectId)
    .eq("user_id", userId)
    .or(`pipeline_status.neq.running,updated_at.lt.${staleBefore}`)
    .select("id");
  if (data?.length) after(() => runPipelineV2(projectId, userId));
}

const PROJECT = "brief, direction, details, brand_name, brand_color, call_to_action, website_url, format, quality, duration_seconds, voice_status, voice_result, voice_language, voice_style, voice_gender";
type Project = {
  brief: unknown;
  direction: string;
  details: unknown;
  brand_name: string | null;
  brand_color: string | null;
  call_to_action: string | null;
  website_url: string | null;
  format: string;
  quality: string;
  duration_seconds: number;
  voice_status: string;
  voice_result: { storagePath?: string; timing?: { words?: unknown } } | null;
  voice_language: string;
  voice_style: string;
  voice_gender: string;
};

// Never throws; the outcome is stored on the project (a failure returns the credits).
export async function runPipelineV2(projectId: string, userId: string) {
  // (the function this runs in stops at 300 s)
  const started = Date.now();
  const left = () => 285_000 - (Date.now() - started);
  const admin = createAdminClient();
  const settings = await getSettings();
  const ready = settings.feature_frame_check !== false ? prepareFrameCheck(240_000) : null;
  const update = (fields: Record<string, unknown>) => admin.from("projects").update(fields).eq("id", projectId).eq("user_id", userId);
  let step: PipelineStep = "analyzing";
  const enter = (next: PipelineStep) => {
    step = next;
    return update({ pipeline_step: next });
  };
  const fail = async (message: string) => {
    await update({ pipeline_status: "failed", pipeline_step: step, pipeline_error: message.slice(0, 500) });
    await refundVideo(projectId, userId).catch((e) => console.error("refund failed:", projectId, e instanceof Error ? e.message : e));
  };
  const read = async () => (await admin.from("projects").select(PROJECT).eq("id", projectId).eq("user_id", userId).single()).data as Project | null;

  try {
    await enter("analyzing");
    let project = await read();
    const v2 = v2DetailsOf(project?.details);
    if (!project || !v2) return void (await fail("This video was not made with the new version."));
    const ai = await getAiConfig();
    // (one level: priced as Standard; a video made before keeps its level)
    const tierId: TierId = (TIER_IDS as readonly string[]).includes(project.quality) ? (project.quality as TierId) : "standard";
    // every model this video needs is checked before anything is spent:
    // its roles (admin → AI models, "New version") and Whisper
    const [director, review, copywriter] = await Promise.all([v2Role("director", { timeout: DIRECTOR_MS }), v2Role("review", { timeout: 120_000 }), v2Role("copywriter", { timeout: 60_000 })]);
    await v2Whisper(ai);
    // its rules (admin → Settings, "New version: video rules") and its look
    // (a fresh seed, unlike this customer's last five; kept with the project)
    const rules = v2RulesOf(settings);
    const look = await lookFor(admin, projectId, userId, project.details, settings, rules);
    // (a logo without colour: the brand colour from the look's random hue, kept)
    if (!project.brand_color) {
      project = { ...project, brand_color: hueColour(look.hue) };
      await update({ brand_color: project.brand_color });
    }
    const roles: Roles = { director, review, copywriter, rules, look, left };
    if (v2.voice.source === "script" && !ai.voice.model) throw new Error("No voice model is set for the new version. A super admin must choose it on /admin/models.");

    // The Director plans from the script while the voice is made (a
    // recording: once its words are heard); it reviews on the voice's times.
    const stored = (project.brief as { composer?: unknown } | null)?.composer;
    // (the Director takes up to ~170 s — it runs while the voice is made —
    // leaving ~95 s for the review, the Copywriter, the layout and the frame check)
    const budget = () => Math.max(30_000, Math.min(DIRECTOR_MS, left() - 95_000));
    const own = v2.voice.source === "script" ? project.direction.trim() : "";
    const planning = own && !stored ? planV2(admin, projectId, userId, project, own, readingPace(own), roles, settings, budget()) : null;
    planning?.catch(() => {});

    // 1. The voice and its words.
    await enter("voice");
    let words = project.voice_status === "completed" ? parseWordTimings(project.voice_result?.timing?.words) : null;
    let script = ProductBrief.safeParse(project.brief).data?.script ?? own;
    if (!words?.length || !script) ({ words, script } = await voiceOf(admin, projectId, userId, project, v2));

    // 2. The brief, by rule, from the words the voice says.
    await enter("writing");
    project = (await read())!;
    const brief = ruleBrief({ script, productName: project.brand_name, summary: null, cta: project.call_to_action });
    await update({ brief: { ...brief, ...(stored ? { composer: stored } : {}) }, brief_status: "completed", brief_error: null });

    // 3. The Motion Director's video.
    await enter("visuals");
    if (!stored) {
      const planned = await (planning ?? planV2(admin, projectId, userId, project, script, words, roles, settings, budget()));
      const composer = await buildV2(admin, projectId, userId, project, words, brief, roles, settings, planned);
      await update({ brief: { ...brief, composer }, render_status: "idle", render_error: null, video_path: null });
    }

    // 4. As v1: the frame check, the credits settled, the server render.
    if (ready) {
      await enter("validating");
      await ready;
      await checkProjectFrames(projectId, left()).catch((e) => console.warn("frame check failed:", e instanceof Error ? e.message : e));
    }
    const { data: made } = await admin.from("projects").select("duration_seconds").eq("id", projectId).single();
    if (made) await settleVideo(projectId, userId, tierId, Number(made.duration_seconds) || 0).catch((e) => console.error("settle failed:", projectId, e instanceof Error ? e.message : e));
    await update({ pipeline_status: "completed", pipeline_step: null, pipeline_error: null, status: "completed" });
    if (settings.feature_server_render !== false && left() > 45_000) await renderWithin(projectId, left()).catch((e) => console.warn("server render failed:", e instanceof Error ? e.message : e));
  } catch (e) {
    console.error("new version pipeline failed:", projectId, e instanceof Error ? e.message : e);
    await fail(e instanceof Error ? e.message : "Generation failed.");
  }
}

// Our voice reading the script, or the customer's recording; stored, timed,
// and the video's length set from its last word.
async function voiceOf(admin: Admin, projectId: string, userId: string, project: Project, v2: V2Details): Promise<{ words: WordTiming[]; script: string }> {
  const ai = await getAiConfig();
  const owner = { project_id: projectId, user_id: userId };
  const set = (fields: Record<string, unknown>) => admin.from("projects").update(fields).eq("id", projectId).eq("user_id", userId);
  await set({ voice_status: "generating", voice_error: null });
  try {
    let words: WordTiming[], script: string, storagePath: string, model: string, requestId: string | null;
    const heardCost = (h: { model: string; requestId: string; seconds: number }) =>
      recordCost(admin, { ...owner, operation: "fal_voice", model: h.model, quantity: Math.round(h.seconds), estimated_cost_usd: unitCost(ai, h.model, Math.max(1, h.seconds), () => 0), metadata: { kind: "word_timing", unit: "audio seconds", request_id: h.requestId } });
    if (v2.voice.source === "upload") {
      // (only this project's own folder)
      const path = v2.voice.path;
      if (!path || !path.startsWith(`${userId}/${projectId}/`)) throw new Error("The uploaded recording is missing. Please create the video again.");
      const { data: signed } = await admin.storage.from(AUDIO_BUCKET).createSignedUrl(path, 900);
      if (!signed?.signedUrl) throw new Error("The uploaded recording could not be read.");
      const heard = await v2Transcribe(signed.signedUrl);
      await heardCost(heard);
      ({ words, script } = heard);
      storagePath = path;
      model = "upload";
      requestId = null;
      await set({ direction: script.slice(0, DIRECTION_MAX) });
    } else {
      script = project.direction.trim();
      const spoken = await v2Speak({ script, language: project.voice_language, style: project.voice_style, gender: project.voice_gender, voice: v2.voice.name });
      await recordCost(admin, { ...owner, operation: "fal_voice", model: spoken.model, quantity: script.length, estimated_cost_usd: unitCost(ai, spoken.model, script.length, () => falCost(spoken.model, script.length)), metadata: { unit: "characters", request_id: spoken.requestId } });
      const kept = await storeVoiceAudio(admin, spoken.audioUrl, userId, projectId);
      await recordCost(admin, { ...owner, operation: "storage", quantity: kept.bytes, estimated_cost_usd: storageCost(kept.bytes), metadata: { kind: "voice", unit: "bytes" } });
      const timed = await v2TimeScript(spoken.audioUrl, script);
      await heardCost(timed);
      words = timed.words;
      storagePath = kept.path;
      model = spoken.model;
      requestId = spoken.requestId;
    }
    const lastEnd = Math.max(...words.map((w) => w.end));
    await set({ duration_seconds: voiceVideoSeconds(lastEnd), voice_status: "completed", voice_error: null, voice_result: { model, requestId, storagePath, timing: { source: "heard", words } } });
    return { words, script };
  } catch (e) {
    await set({ voice_status: "failed", voice_error: (e instanceof Error ? e.message : "Voice failed.").slice(0, 500) });
    throw e;
  }
}

// the script's words at a reading pace (before the voice exists)
const readingPace = (script: string) => script.split(/\s+/).filter(Boolean).map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
type Roles = { director: RoleAi; review: RoleAi; copywriter: RoleAi; rules: V2Rules; look: V2Look; left: () => number };
// the Director's time: two calls of ~110–130 s timed out at 120 s (Oct 16)
const DIRECTOR_MS = 170_000;

// This video's look: the one kept with it (a retry), else one drawn from a
// fresh seed unlike the customer's last five "New version" looks — kept with
// the project (projects.details.look).
async function lookFor(admin: Admin, projectId: string, userId: string, details: unknown, settings: Record<string, unknown>, rules: V2Rules): Promise<V2Look> {
  const kept = lookOf((details as { look?: unknown } | null)?.look);
  if (kept) return kept;
  const { data: last } = await admin.from("projects").select("details").eq("user_id", userId).neq("id", projectId).eq("details->>engine", "v2").order("created_at", { ascending: false }).limit(5);
  const recent = (last ?? []).map((p) => lookOf((p.details as { look?: unknown } | null)?.look)).filter((l): l is V2Look => !!l);
  const allowed = styleRulesOf(settings as Parameters<typeof styleRulesOf>[0], RECIPES.map((r) => r.id))?.recipes ?? null;
  const look = drawLook(freshSeed(), recent, { soft: rules.on.motion, noMacro: techOffOf(settings as Parameters<typeof techOffOf>[0]).includes("camera:macro"), recipes: allowed });
  await admin.from("projects").update({ details: { ...((details as object | null) ?? {}), look } }).eq("id", projectId).eq("user_id", userId);
  return look;
}

// The Motion Director's plan. Throws (the video fails) when it is not the
// Director's (no plan by rule).
async function planV2(admin: Admin, projectId: string, userId: string, project: Project, script: string, voice: WordTiming[], roles: Roles, settings: Record<string, unknown>, budgetMs: number) {
  const text = roles.director;
  const usage: BriefUsage[] = [];
  const words = scriptWords(script, voice);
  const brand = { ...brandOf(project, null), url: "" };
  const [{ known, earlier, looks, past }, never] = await Promise.all([pastOf(admin, projectId, userId, brand.name), loadV2NeverList(admin)]);
  const styles = styleRulesOf(settings as Parameters<typeof styleRulesOf>[0], RECIPES.map((r) => r.id));
  const input: MotionInput = {
    name: brand.name,
    color: brand.color,
    cta: brand.cta,
    url: "",
    product: null,
    words,
    website: null,
    seen: past.seen,
    earlier,
    known,
    never,
    category: null,
    customer: null,
    seed: roles.look.seed,
    model: null,
    clientModel: text.model,
    reasoning: text.reasoning,
    temperature: text.temperature,
    // its own switches (admin → Settings, "New version"), its own rules and
    // its look — nothing of the old version's; RECENT always
    prompt: "classic",
    recent: looks,
    rules: false,
    ruleText: `${roles.rules.text(never)}\n\n${lookText(roles.look, roles.rules.flow)}`,
    checks: roles.rules.checks,
    styles,
    ...v2DirectorOf(settings),
    direction: null,
    screenshots: [],
  };
  const started = Date.now();
  try {
    // (never OPENAI_MODEL / gpt-5-mini: no model is an error)
    v2DirectorModel(input.clientModel);
    const directed = await directMotion(input, (u) => usage.push(u), text.client, budgetMs);
    if (directed.plan.source !== "ai" || !directed.plan.ideas) throw new Error(`The Motion Director (${text.model}) gave no plan: ${directed.problems[0] ?? "no answer"}`);
    return { input, directed, past, styles };
  } finally {
    await priceV2(admin, projectId, userId, text.model, usage, started);
  }
}

// Its review on the voice's times, and the video built from it. Throws when
// the video is not the Director's (never composed by rule).
async function buildV2(admin: Admin, projectId: string, userId: string, project: Project, voice: WordTiming[], brief: ProductBrief, roles: Roles, settings: Record<string, unknown>, planned: Awaited<ReturnType<typeof planV2>>) {
  const usage: BriefUsage[] = [];
  const words = scriptWords(brief.script, voice);
  const brand = { ...brandOf(project, brief), url: "" };
  const { directed, past, styles } = planned;
  const { review, copywriter, rules, look } = roles;
  // (the Director review: its own model and reasoning)
  const input: MotionInput = { ...planned.input, words, name: brand.name, cta: brand.cta, clientModel: review.model, reasoning: review.reasoning, temperature: review.temperature };
  const started = Date.now();
  try {
    v2DirectorModel(input.clientModel);
    // (the review and the Copywriter share what the 300 s leave)
    const reviewed = await reviewMotion(directed.plan, input, (u) => usage.push(u), review.client, Math.max(20_000, Math.min(90_000, roles.left() - 45_000)));
    const plan = reviewed.plan;
    if (plan.source !== "ai" || !plan.ideas) throw new Error(`The Director review (${review.model}) lost the plan.`);
    // the Copywriter: every scene's on-screen words down to its 2–6 key words
    const copied = await copywrite(plan.ideas, words, copywriter, (u) => usage.push(u), Math.max(15_000, Math.min(60_000, roles.left() - 25_000)));
    const set = composeVariants({ words, brand, duration: Math.round(project.duration_seconds * 30), seed: look.seed, ideas: copied.ideas, count: 1, avoid: { display: past.seen.display, field: past.seen.field.slice(0, 3) }, screens: 0, avoidStaging: past.seenStaging, rules: rules.ruleSet, variety: varietyOf(look, rules.flow, techOffOf(settings as Parameters<typeof techOffOf>[0]).includes("camera:macro")), match: input.match !== false, techOff: techOffOf(settings as Parameters<typeof techOffOf>[0]), styles, avoidStyles: past.avoidStyles, creative: plan.creative, look: { scheme: plan.profile.look.scheme, energy: plan.profile.look.energy }, size: frameOf(project.format) });
    const video = set.videos[0];
    if (!video || video.source !== "director") throw new Error("The Motion Director's scenes could not be laid out.");
    const score = scorePlan(set.plans[0], video.script, { staging: video.staging, motif: plan.creative.motif, heroScene: video.staging?.hero ?? null, recent: past.recent, problems: set.problems.length });
    const problems = [...directed.problems, ...reviewed.problems, ...copied.problems, ...set.problems].slice(0, 20);
    console.info("composer (new version):", { projectId, director: roles.director.model, review: review.model, copywriter: copywriter.model, look: `${look.display}/${look.text} ${look.harmony} ${look.energy ?? "medium"}`, scenes: plan.ideas.scenes.length, score: score.total, problems: problems.slice(0, 8) });
    await admin.from("direction_library").update({ narration: brief.script, outcome: { stored: true, engine: "composer-v2", language: video.staging?.language ?? "cuts", problems: problems.slice(0, 8) }, updated_at: new Date().toISOString() }).eq("project_id", projectId);
    return { videos: [video], indexing: "script" as const, source: plan.source, profile: plan.profile, creative: plan.creative, score: { total: score.total, notes: score.notes.slice(0, 6), built: video.source }, changes: [] as { direction: string; at: string; ok: boolean }[], problems, at: new Date().toISOString() };
  } finally {
    await priceV2(admin, projectId, userId, [...new Set(usage.map((u) => u.model))].join(", ") || review.model, usage, started);
  }
}

// (every call is priced, a failed one too)
async function priceV2(admin: Admin, projectId: string, userId: string, model: string, usage: BriefUsage[], started: number) {
  const ai = await getAiConfig();
  const cost = usage.reduce((a, u) => a + usageCost(ai, u, (i, o) => openaiCost(u.model, i, o)), 0);
  const [input_tokens, output_tokens] = [usage.reduce((a, u) => a + u.inputTokens, 0), usage.reduce((a, u) => a + u.outputTokens, 0)];
  if (input_tokens || output_tokens)
    await recordCost(admin, { project_id: projectId, user_id: userId, operation: "openai_brief", model, quantity: input_tokens + output_tokens, estimated_cost_usd: cost, metadata: { kind: "motion_director", engine: "v2", input_tokens, output_tokens, latency_ms: Date.now() - started, ...(usage.some((u) => u.estimated) ? { estimated: true, note: "a call failed or timed out: its input is counted from its length, its output is unknown (the provider may bill more)" } : {}) } });
}
