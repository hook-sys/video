import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { getRenderProgress } from "@remotion/vercel";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIDEOS_BUCKET } from "@/lib/projects";
import { RENDER_PROJECT_COLUMNS, type RenderProject, buildRenderInput } from "@/lib/render-input";
import { filmSnapshot } from "@/lib/frame-check";
import { COMPOSER_ID } from "@/components/video/composer/types";

// The video's MP4, made on the server: the film opened in a real Chrome in a
// Vercel Sandbox (started from the frame check's snapshot: the same bundled
// film) and encoded for quality — every frame as PNG (no banding in
// gradients), x264 "slow" at CRF 16, bt709 colour, AAC 320k. Stored in
// project-videos; the customer downloads the file (no rendering in their
// browser).
//
// The render runs on its own in the sandbox (a 90 s video takes longer than
// a function may run): startServerRender starts it and returns;
// collectServerRender — asked by the project page while it waits, and by the
// pipeline while it has time — reads its progress and, once it is done,
// stores the file. Neither throws: a render that cannot be made is marked
// failed and the browser render remains.

// (the most this account's sandboxes get)
const VCPUS = 4;
// how long the sandbox may run: the longest video, with room
const SANDBOX_MS = 25 * 60_000;
// (a render "processing" longer than this was lost: it may start again)
const STALE_MS = 30 * 60_000;
const HOME = "/vercel/sandbox";
const OUT = "/tmp/video.mp4";

export type ServerRender = { at: string; ms: number; bytes: number; plan: number; seed: number; frames: number };
type Job = { sandboxId: string; cmdId: string; at: string; plan: number; seed: number; frames: number };
type Brief = { composer?: { renderJob?: Job | null; render?: ServerRender } & Record<string, unknown> } & Record<string, unknown>;

// What went wrong, with the sandbox API's own answer when it gave one.
export function sandboxError(e: unknown) {
  const json = (e as { json?: unknown } | null)?.json;
  const msg = e instanceof Error ? e.message : String(e);
  return json ? `${msg}: ${JSON.stringify(json).slice(0, 300)}` : msg;
}

// Takes the render for this run; false when another is already making it.
async function claim(projectId: string) {
  const stale = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await createAdminClient()
    .from("projects")
    .update({ render_status: "processing", render_error: null })
    .eq("id", projectId)
    .or(`render_status.in.(idle,failed),and(render_status.eq.processing,updated_at.lt.${stale})`)
    .select("id");
  return !!data?.length;
}

// brief.composer changed (only its render fields), the rest as it is now
async function setComposer(projectId: string, fields: Record<string, unknown>, row: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("brief").eq("id", projectId).single();
  const brief = (data?.brief as Brief | null) ?? {};
  await admin
    .from("projects")
    .update({ ...row, ...(brief.composer ? { brief: { ...brief, composer: { ...brief.composer, ...fields } } } : {}) })
    .eq("id", projectId);
}

async function fail(projectId: string, why: string) {
  console.warn("server render:", projectId, why);
  await setComposer(projectId, { renderJob: null }, { render_status: "failed", render_error: why.slice(0, 500) });
  return { error: why };
}

// Starts the render of the project's video (its newest version, as the
// studio shows it first) in a sandbox of its own.
export async function startServerRender(projectId: string): Promise<{ started: true } | { error: string } | { skipped: string }> {
  if (!(await claim(projectId))) return { skipped: "already rendering or rendered" };
  const admin = createAdminClient();
  try {
    const { data: project } = await admin.from("projects").select(RENDER_PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
    if (!project) return await fail(projectId, "project not found");
    // (the voice's link must last as long as the render may)
    const { composer, audioUrl, problems } = await buildRenderInput(admin, project as RenderProject, 2 * 3600);
    const index = (composer?.plans.length ?? 0) - 1;
    const plan = composer?.plans[index];
    if (!plan || !audioUrl) return await fail(projectId, problems.join(" ") || "nothing to render");

    const signal = AbortSignal.timeout(240_000);
    const snapshotId = await filmSnapshot(signal);
    const sandbox = await Sandbox.create({ source: { type: "snapshot", snapshotId }, resources: { vcpus: VCPUS }, timeout: SANDBOX_MS, signal });
    // what @remotion/vercel's render script takes (renderMediaOnVercel's
    // options), run detached: it writes progress.json as it goes
    const config = {
      serveUrl: `${HOME}/remotion-bundle`,
      compositionId: COMPOSER_ID,
      inputProps: { plan, audioUrl, screens: composer!.screens },
      outputLocation: OUT,
      codec: "h264",
      crf: 16,
      imageFormat: "png",
      pixelFormat: "yuv420p",
      envVariables: {},
      frameRange: null,
      everyNthFrame: 1,
      proResProfile: null,
      chromiumOptions: {},
      scale: 1,
      preferLossless: false,
      enforceAudioTrack: true,
      disallowParallelEncoding: false,
      concurrency: VCPUS,
      metadata: null,
      licenseKey: null,
      videoBitrate: null,
      audioBitrate: "320k",
      encodingMaxRate: null,
      encodingBufferSize: null,
      muted: false,
      numberOfGifLoops: null,
      x264Preset: "slow",
      gopSize: null,
      colorSpace: "bt709",
      jpegQuality: 80,
      audioCodec: "aac",
      logLevel: "error",
      timeoutInMilliseconds: 60_000,
      forSeamlessAacConcatenation: false,
      separateAudioTo: null,
      hardwareAcceleration: "disable",
      offthreadVideoCacheSizeInBytes: null,
      mediaCacheSizeInBytes: null,
      offthreadVideoThreads: null,
      chromeMode: "headless-shell",
      browserExecutable: null,
      binariesDirectory: null,
      repro: false,
      sampleRate: 48000,
      vercelBlob: null,
    };
    const cmd = await sandbox.runCommand({ cmd: "node", args: ["render-video.mjs", JSON.stringify(config)], cwd: HOME, detached: true, signal });
    const job: Job = { sandboxId: sandbox.sandboxId, cmdId: cmd.cmdId, at: new Date().toISOString(), plan: index, seed: plan.seed, frames: plan.duration };
    await setComposer(projectId, { renderJob: job });
    console.info("server render: started", { projectId, frames: plan.duration });
    return { started: true };
  } catch (e) {
    return await fail(projectId, sandboxError(e));
  }
}

// Where the render is (0–1), and once it is done the file stored.
export async function collectServerRender(projectId: string): Promise<{ status: "processing"; progress: number } | { status: "completed" | "failed" | "idle" }> {
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("user_id, render_status, render_error, updated_at, brief").eq("id", projectId).maybeSingle();
  if (!data) return { status: "failed" };
  if (data.render_status !== "processing") return { status: data.render_status as "completed" | "failed" | "idle" };
  // (storing was cut off: stored by the next ask)
  if (data.render_error === "storing" && Date.now() - Date.parse(data.updated_at) > 120_000) await admin.from("projects").update({ render_error: null }).eq("id", projectId).eq("render_error", "storing");
  const job = (data.brief as Brief | null)?.composer?.renderJob;
  // (starting: the job is written in a moment)
  if (!job) return { status: "processing", progress: 0 };
  try {
    const p = await getRenderProgress({ sandboxId: job.sandboxId, cmdId: job.cmdId });
    if (p.stage === "expired") return (await fail(projectId, "the render's sandbox stopped before it finished"), { status: "failed" });
    if (p.stage === "error") return (await fail(projectId, `render: ${p.message}`.slice(0, 500)), { status: "failed" });
    if (p.stage !== "done") return { status: "processing", progress: Math.max(0, Math.min(0.99, p.overallProgress ?? 0)) };

    // done: the file stored once (a second ask meanwhile finds it taken)
    const { data: mine } = await admin.from("projects").update({ render_error: "storing" }).eq("id", projectId).eq("render_status", "processing").is("render_error", null).select("id");
    if (!mine?.length) return { status: "processing", progress: 0.99 };
    const sandbox = await Sandbox.get({ sandboxId: job.sandboxId });
    const file = await sandbox.readFileToBuffer({ path: OUT });
    await sandbox.stop().catch(() => {});
    if (!file?.length) return (await fail(projectId, "the render wrote no file"), { status: "failed" });
    const path = `${data.user_id}/${projectId}/video.mp4`;
    const { error } = await admin.storage.from(VIDEOS_BUCKET).upload(path, file, { contentType: "video/mp4", upsert: true });
    if (error) return (await fail(projectId, `upload: ${error.message}`), { status: "failed" });
    const done: ServerRender = { at: new Date().toISOString(), ms: Date.now() - Date.parse(job.at), bytes: file.length, plan: job.plan, seed: job.seed, frames: job.frames };
    // (which version the file is, kept with the video: the studio offers it for that one)
    await setComposer(projectId, { renderJob: null, render: done }, { render_status: "completed", render_error: null, video_path: path });
    console.info("server render: done", { projectId, s: Math.round(done.ms / 1000), mb: +(done.bytes / 1e6).toFixed(1), frames: done.frames });
    return { status: "completed" };
  } catch (e) {
    // (a passing hiccup: asked again in a moment)
    console.warn("server render: progress", projectId, sandboxError(e));
    return { status: "processing", progress: 0 };
  }
}

// Started, then followed while there is time (the pipeline's last step).
export async function renderWithin(projectId: string, budgetMs: number) {
  const t0 = Date.now();
  const started = await startServerRender(projectId);
  if (!("started" in started)) return started;
  while (Date.now() - t0 < budgetMs - 15_000) {
    await new Promise((r) => setTimeout(r, 5_000));
    const s = await collectServerRender(projectId);
    if (s.status !== "processing") return s;
  }
  return { status: "processing" as const };
}
