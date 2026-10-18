import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_MAX, seedFrom, voiceVideoSeconds } from "@/lib/projects";
import { type BriefUsage, ProductBrief } from "@/lib/ai/product-brief";
import { getAiConfig, unitCost, usageCost } from "@/lib/ai/models";
import { falCost, openaiCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { ruleBrief } from "@/lib/rule-brief";
import { parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { AUDIO_BUCKET, storeVoiceAudio } from "@/lib/voice-audio";
import { getSettings } from "@/lib/app-settings";
import { renderWithin } from "@/lib/render-server";
import { prepareFilm } from "@/lib/film-snapshot";
import { TIER_IDS, type TierId, refundVideo, settleVideo } from "@/lib/billing";
import type { PipelineStep } from "@/lib/pipeline";
import { v2DetailsOf, type V2Details } from "@/lib/v2/form";
import { type RoleAi, v2DirectorModel, v2Role, v2Speak, v2TimeScript, v2Transcribe, v2Whisper } from "@/lib/v2/models";
import { readBeats } from "@/lib/simple/brain";
import { beatsOf, scriptWords } from "@/components/video/simple/beats";
import { frameOf } from "@/components/video/simple/geo";
import { planOf } from "@/components/video/simple/select";
import { repairPlan } from "@/components/video/simple/check";

// The pipeline: one simple path (docs/video-spec.md), no fallbacks.
//   1. the voice: our voice reads the script (timed by the admin's Whisper),
//      or the customer's recording (its words heard by that Whisper)
//   2. the brief, by rule, from those words (no website, no AI)
//   3. the simple engine: the voice in beats, one AI call reading them (the
//      Director's model), the templates chosen unlike this customer's last
//      videos, checked and mended by code — if the reading fails, the video
//      fails and its credits are returned
//   4. the credits settled, the server render
// No music. The logo is put in the video where it is rendered (lib/render-input.ts).

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

const PROJECT = "brief, direction, details, brand_name, brand_color, call_to_action, format, quality, duration_seconds, voice_status, voice_result, voice_language, voice_style, voice_gender";
type Project = {
  brief: unknown;
  direction: string;
  details: unknown;
  brand_name: string | null;
  brand_color: string | null;
  call_to_action: string | null;
  format: string;
  quality: string;
  duration_seconds: number;
  voice_status: string;
  voice_result: { storagePath?: string; timing?: { words?: unknown } } | null;
  voice_language: string;
  voice_style: string;
  voice_gender: string;
};

// a brand colour for a video whose logo gave none: one of these, the same for the same project
const COLOURS = ["#4F46E5", "#0EA5E9", "#10B981", "#F97316", "#E11D48", "#8B5CF6", "#14B8A6", "#F59E0B"];

// Never throws; the outcome is stored on the project (a failure returns the credits).
export async function runPipelineV2(projectId: string, userId: string) {
  // (the function this runs in stops at 300 s)
  const started = Date.now();
  const left = () => 285_000 - (Date.now() - started);
  const admin = createAdminClient();
  const settings = await getSettings();
  // (the render's sandbox made ready while the video is made: the first after a new film takes minutes)
  const film = settings.feature_server_render !== false ? prepareFilm(240_000) : null;
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
    if (!project || !v2) return void (await fail("This video was made with an earlier version. Please create it again."));
    const ai = await getAiConfig();
    // (one level: priced as Standard; a video made before keeps its level)
    const tierId: TierId = (TIER_IDS as readonly string[]).includes(project.quality) ? (project.quality as TierId) : "standard";
    // every model this video needs is checked before anything is spent: the Director and Whisper (admin → AI models)
    const director = await v2Role("director", { timeout: 120_000 });
    await v2Whisper(ai);
    if (v2.voice.source === "script" && !ai.voice.model) throw new Error("No voice model is set. A super admin must choose it on /admin/models.");
    if (!project.brand_color) {
      project = { ...project, brand_color: COLOURS[seedFrom(projectId) % COLOURS.length] };
      await update({ brand_color: project.brand_color });
    }
    const stored = (project.brief as { composer?: unknown } | null)?.composer;

    // 1. The voice and its words.
    await enter("voice");
    let words = project.voice_status === "completed" ? parseWordTimings(project.voice_result?.timing?.words) : null;
    let script = ProductBrief.safeParse(project.brief).data?.script ?? (v2.voice.source === "script" ? project.direction.trim() : "");
    if (!words?.length || !script) ({ words, script } = await voiceOf(admin, projectId, userId, project, v2));

    // 2. The brief, by rule, from the words the voice says.
    await enter("writing");
    project = (await read())!;
    const brief = ruleBrief({ script, productName: project.brand_name, summary: null, cta: project.call_to_action });
    await update({ brief: { ...brief, ...(stored ? { composer: stored } : {}) }, brief_status: "completed", brief_error: null });

    // 3. The video.
    await enter("visuals");
    if (!stored) {
      const composer = await buildSimple(admin, projectId, userId, project, words, brief, director, left);
      await update({ brief: { ...brief, composer }, render_status: "idle", render_error: null, video_path: null });
    }

    // 4. The credits settled, the server render.
    const { data: made } = await admin.from("projects").select("duration_seconds").eq("id", projectId).single();
    if (made) await settleVideo(projectId, userId, tierId, Number(made.duration_seconds) || 0).catch((e) => console.error("settle failed:", projectId, e instanceof Error ? e.message : e));
    await update({ pipeline_status: "completed", pipeline_step: null, pipeline_error: null, status: "completed" });
    await film;
    if (settings.feature_server_render !== false && left() > 45_000) await renderWithin(projectId, left()).catch((e) => console.warn("server render failed:", e instanceof Error ? e.message : e));
  } catch (e) {
    console.error("pipeline failed:", projectId, e instanceof Error ? e.message : e);
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

// The simple engine's video (docs/video-spec.md): the voice in beats, one AI
// call reading them (the Director's model), the templates chosen unlike this
// customer's last five videos, checked and mended. Throws when the reading fails.
async function buildSimple(admin: Admin, projectId: string, userId: string, project: Project, voice: WordTiming[], brief: ProductBrief, director: RoleAi, left: () => number) {
  const usage: BriefUsage[] = [];
  const words = scriptWords(brief.script, voice);
  const brand = { name: project.brand_name?.trim() || brief.product_name || "Your product", color: project.brand_color || COLOURS[0], cta: project.call_to_action?.trim() || brief.cta || "Get started", icon: null };
  const started = Date.now();
  try {
    v2DirectorModel(director.model);
    const beats = beatsOf(words);
    const { readings, problems } = await readBeats(words, beats, brand.name, director, (u) => usage.push(u), Math.max(30_000, Math.min(120_000, left() - 60_000)));
    const { data: last } = await admin.from("projects").select("print:brief->composer->simple->>print").eq("user_id", userId).neq("id", projectId).not("brief->composer->simple", "is", null).order("created_at", { ascending: false }).limit(5);
    const recent = (last ?? []).map((p) => p.print as string | null).filter((p): p is string => !!p);
    const drawn = planOf({ words, beats, readings, brand, seed: seedFrom(projectId), duration: Math.round(project.duration_seconds * 30), recent, size: frameOf(project.format) });
    // (checked and mended by code before it is played: check.ts)
    const { plan, report } = repairPlan(drawn, readings);
    const noted = [...problems, ...report.fixed.map((x) => `mended — ${x}`), ...report.left.map((x) => `left — ${x}`)];
    console.info("simple engine:", { projectId, model: director.model, beats: beats.length, print: plan.print, problems: noted.slice(0, 8) });
    return { simple: plan, problems: noted, at: new Date().toISOString() };
  } finally {
    await price(admin, projectId, userId, director.model, usage, started);
  }
}

// (every call is priced, a failed one too)
async function price(admin: Admin, projectId: string, userId: string, model: string, usage: BriefUsage[], started: number) {
  const ai = await getAiConfig();
  const cost = usage.reduce((a, u) => a + usageCost(ai, u, (i, o) => openaiCost(u.model, i, o)), 0);
  const [input_tokens, output_tokens] = [usage.reduce((a, u) => a + u.inputTokens, 0), usage.reduce((a, u) => a + u.outputTokens, 0)];
  if (input_tokens || output_tokens)
    await recordCost(admin, { project_id: projectId, user_id: userId, operation: "openai_brief", model, quantity: input_tokens + output_tokens, estimated_cost_usd: cost, metadata: { kind: "director", engine: "simple", input_tokens, output_tokens, latency_ms: Date.now() - started, ...(usage.some((u) => u.estimated) ? { estimated: true, note: "a call failed or timed out: its input is counted from its length, its output is unknown (the provider may bill more)" } : {}) } });
}
