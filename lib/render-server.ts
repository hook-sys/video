import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { renderMediaOnVercel } from "@remotion/vercel";
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
// browser). Never throws: a render that cannot run is marked failed and the
// browser render remains.

const VCPUS = 8;
// (a render left "processing" longer than this was cut off: it may start again)
const STALE_MS = 10 * 60_000;

export type ServerRender = { at: string; ms: number; bytes: number; plan: number; seed: number; frames: number };

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

// The project's video (its newest version, as the studio shows it first)
// rendered and stored, within the time given.
export async function renderProjectVideo(projectId: string, budgetMs: number): Promise<ServerRender | { skipped: string }> {
  const admin = createAdminClient();
  const t0 = Date.now();
  if (budgetMs < 90_000) return { skipped: "no time left for the render" };
  if (!(await claim(projectId))) return { skipped: "already rendering or rendered" };
  const failed = async (why: string) => {
    console.warn("server render:", projectId, why);
    await admin.from("projects").update({ render_status: "failed", render_error: why.slice(0, 500) }).eq("id", projectId);
    return { skipped: why };
  };
  try {
    const { data: project } = await admin.from("projects").select(RENDER_PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
    if (!project) return await failed("project not found");
    const { composer, audioUrl, problems } = await buildRenderInput(admin, project as RenderProject, 2 * 3600);
    const index = (composer?.plans.length ?? 0) - 1;
    const plan = composer?.plans[index];
    if (!plan || !audioUrl) return await failed(problems.join(" ") || "nothing to render");

    const signal = AbortSignal.timeout(budgetMs - 5_000);
    const snapshotId = await filmSnapshot(signal);
    // (more CPUs render faster; an account that can't have them gets the frame check's)
    const start = (vcpus: number) => Sandbox.create({ source: { type: "snapshot", snapshotId }, resources: { vcpus }, timeout: budgetMs - 10_000, signal });
    const sandbox = await start(VCPUS).catch(() => start(4));
    let file: Buffer | null = null;
    try {
      const { sandboxFilePath } = await renderMediaOnVercel({
        sandbox,
        compositionId: COMPOSER_ID,
        inputProps: { plan, audioUrl, screens: composer!.screens },
        codec: "h264",
        imageFormat: "png",
        pixelFormat: "yuv420p",
        crf: 16,
        x264Preset: "slow",
        colorSpace: "bt709",
        audioCodec: "aac",
        audioBitrate: "320k",
        concurrency: VCPUS,
        enforceAudioTrack: true,
        timeoutInMilliseconds: 60_000,
        logLevel: "error",
      });
      file = await sandbox.readFileToBuffer({ path: sandboxFilePath }, { signal });
    } finally {
      await sandbox.stop().catch(() => {});
    }
    if (!file?.length) return await failed("the render wrote no file");

    const path = `${(project as RenderProject).user_id}/${projectId}/video.mp4`;
    const { error } = await admin.storage.from(VIDEOS_BUCKET).upload(path, file, { contentType: "video/mp4", upsert: true });
    if (error) return await failed(`upload: ${error.message}`);
    const done: ServerRender = { at: new Date().toISOString(), ms: Date.now() - t0, bytes: file.length, plan: index, seed: plan.seed, frames: plan.duration };
    // (which version the file is, kept with the video: the studio offers it for that one)
    const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
    const brief = (fresh?.brief as { composer?: object } | null) ?? {};
    await admin
      .from("projects")
      .update({ render_status: "completed", render_error: null, video_path: path, ...(brief.composer ? { brief: { ...brief, composer: { ...brief.composer, render: done } } } : {}) })
      .eq("id", projectId);
    console.info("server render:", { projectId, ms: done.ms, mb: +(done.bytes / 1e6).toFixed(1), frames: done.frames });
    return done;
  } catch (e) {
    return await failed(sandboxError(e));
  }
}
