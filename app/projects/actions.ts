"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DIRECTION_MAX,
  DURATIONS,
  FORMATS,
  SCREENSHOT_TYPES,
  SCREENSHOTS_BUCKET,
  VIDEOS_BUCKET,
  VOICE_LANGUAGES,
  VOICE_STYLES,
  parseHttpUrl,
  validateScreenshots,
} from "@/lib/projects";
import { runWebsiteCapture } from "@/lib/website-capture";
import { type BriefUsage, ProductBrief, generateProductBrief } from "@/lib/ai/product-brief";
import { type AssetManifest, buildAssetManifest } from "@/lib/asset-manifest";
import { generateAsset } from "@/lib/generated-assets";
import { RENDER_PROJECT_COLUMNS, buildRenderInput } from "@/lib/render-input";
import { renderStoryboardMp4 } from "@/lib/render-video";
import { validateForRender } from "@/lib/render-validation";
import { falCost, openaiCost, renderCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import {
  BENCHMARK_CASES,
  cloneProjectForBenchmark,
  collectBenchmarkMetrics,
} from "@/lib/benchmark";
import type { Resolution } from "@/components/video/types";
import { generateVoice as generateFalVoice } from "@/lib/ai/fal";
import { AUDIO_BUCKET, storeVoiceAudio } from "@/lib/voice-audio";

export type CreateProjectState = { error?: string };

function oneOf<T extends string | number>(list: readonly T[], value: unknown) {
  return list.find((item) => String(item) === value);
}

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const websiteUrl = String(formData.get("website_url") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const duration = oneOf(DURATIONS, formData.get("duration_seconds"));
  const format = oneOf(FORMATS, formData.get("format"));
  const voiceLanguage = oneOf(VOICE_LANGUAGES, formData.get("voice_language"));
  const voiceStyle = oneOf(VOICE_STYLES, formData.get("voice_style"));

  if (!direction) return { error: "Video direction is required." };
  if (direction.length > DIRECTION_MAX)
    return { error: `Direction must be ${DIRECTION_MAX} characters or less.` };
  if (!duration || !format || !voiceLanguage || !voiceStyle)
    return { error: "Please choose a valid option for every field." };
  if (websiteUrl && !parseHttpUrl(websiteUrl))
    return { error: "Website URL must be a valid http:// or https:// address." };

  // Browsers send an empty, unnamed File when no file is chosen.
  const screenshots = formData
    .getAll("screenshots")
    .filter((f): f is File => f instanceof File && (f.size > 0 || f.name !== ""));
  const screenshotError = validateScreenshots(screenshots);
  if (screenshotError) return { error: screenshotError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      website_url: websiteUrl || null,
      direction,
      duration_seconds: duration,
      format,
      voice_language: voiceLanguage,
      voice_style: voiceStyle,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const uploaded: string[] = [];
  for (const file of screenshots) {
    const path = `${user.id}/${data.id}/${crypto.randomUUID()}.${SCREENSHOT_TYPES[file.type]}`;
    const upload = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (upload.error) break;
    uploaded.push(path);
  }

  let saved = uploaded.length === screenshots.length;
  if (saved && uploaded.length > 0) {
    const { error: rowsError } = await supabase.from("project_screenshots").insert(
      uploaded.map((storage_path, i) => ({
        project_id: data.id,
        user_id: user.id,
        storage_path,
        original_filename: screenshots[i].name,
      })),
    );
    saved = !rowsError;
  }

  if (!saved) {
    // Roll back so the user can retry cleanly.
    if (uploaded.length) await supabase.storage.from(SCREENSHOTS_BUCKET).remove(uploaded);
    await supabase.from("projects").delete().eq("id", data.id);
    return { error: "Screenshot upload failed. Please try again." };
  }

  if (websiteUrl) {
    const { data: capture } = await supabase
      .from("website_captures")
      .insert({ project_id: data.id, user_id: user.id, url: websiteUrl })
      .select("id")
      .single();
    if (capture) {
      after(() =>
        runWebsiteCapture(supabase, {
          id: capture.id,
          userId: user.id,
          projectId: data.id,
          url: websiteUrl,
        }),
      );
    }
  }

  redirect(`/projects/${data.id}`);
}

const STALE_GENERATION_MS = 2 * 60 * 1000;

export async function generateBrief(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: capture }, { data: screenshots }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase
      .from("website_captures")
      .select("url, title, meta_description, visible_text, screenshot_path")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("project_screenshots").select("original_filename").eq("project_id", projectId),
  ]);
  if (!project) return;

  // Brief fields are system-managed: users can't write them, so write via the
  // admin client, scoped to the project ownership verified above.
  const admin = createAdminClient();
  const briefUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);
  const fail = (message: string) =>
    briefUpdate({ brief_status: "failed", brief_error: message });

  if (!capture && !screenshots?.length) {
    await fail("Add a captured website or screenshots before generating a brief.");
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  // Claim the job so double submits don't trigger two paid AI calls.
  const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: claimed } = await briefUpdate({ brief_status: "generating", brief_error: null })
    .or(`brief_status.neq.generating,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return;

  // Captured even if the call fails after tokens were used.
  let usage: BriefUsage | undefined;
  try {
    const brief = await generateProductBrief(
      {
        website: capture
          ? {
              url: capture.url,
              title: capture.title,
              meta_description: capture.meta_description,
              visible_text: capture.visible_text,
            }
          : undefined,
        direction: project.direction,
        duration_seconds: project.duration_seconds,
        format: project.format,
        voice_language: project.voice_language,
        voice_style: project.voice_style,
        screenshots: (screenshots ?? []).map((s) => s.original_filename),
        has_website_screenshot: !!capture?.screenshot_path,
      },
      (u) => (usage = u),
    );
    await briefUpdate({ brief, brief_status: "completed", brief_error: null });
  } catch (e) {
    await fail((e instanceof Error ? e.message : "Brief generation failed.").slice(0, 500));
  } finally {
    if (usage) {
      await recordCost(admin, {
        project_id: projectId,
        user_id: user.id,
        operation: "openai_brief",
        model: usage.model,
        quantity: usage.inputTokens + usage.outputTokens,
        estimated_cost_usd: openaiCost(usage.model, usage.inputTokens, usage.outputTokens),
        metadata: { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens },
      });
    }
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function generateVoice(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase
    .from("projects")
    .select("brief, brief_status, voice_language, voice_style, voice_result")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;

  const admin = createAdminClient();
  const voiceUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);

  const script = project.brief_status === "completed" ? project.brief?.script : undefined;
  if (typeof script !== "string" || !script.trim()) {
    await voiceUpdate({ voice_status: "failed", voice_error: "Generate the brief first." });
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: claimed } = await voiceUpdate({ voice_status: "generating", voice_error: null })
    .or(`voice_status.neq.generating,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return;

  try {
    const { model, requestId, audioUrl } = await generateFalVoice({
      script,
      language: project.voice_language,
      style: project.voice_style,
    });
    const stored = await storeVoiceAudio(admin, audioUrl, user.id, projectId);
    const storagePath = stored.path;
    const owner = { project_id: projectId, user_id: user.id };
    // Voice is priced per script character; the stored file costs storage.
    await recordCost(admin, {
      ...owner,
      operation: "fal_voice",
      model,
      quantity: script.length,
      estimated_cost_usd: falCost(model, script.length),
      metadata: { unit: "characters", request_id: requestId },
    });
    await recordCost(admin, {
      ...owner,
      operation: "storage",
      quantity: stored.bytes,
      estimated_cost_usd: storageCost(stored.bytes),
      metadata: { kind: "voice", unit: "bytes" },
    });
    const previousPath = project.voice_result?.storagePath;
    if (previousPath && previousPath !== storagePath) {
      await admin.storage.from(AUDIO_BUCKET).remove([previousPath]);
    }
    // Only the permanent path is persisted, never the temporary provider URL.
    await voiceUpdate({
      voice_status: "completed",
      voice_error: null,
      voice_result: { model, requestId, storagePath },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Voice generation failed.";
    await voiceUpdate({ voice_status: "failed", voice_error: message.slice(0, 500) });
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function prepareAssets(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns rows this user owns.
  const [{ data: project }, { data: screenshots }, { data: capture }] = await Promise.all([
    supabase.from("projects").select("brief, brief_status, format").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_screenshots")
      .select("storage_path")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase
      .from("website_captures")
      .select("screenshot_path")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .not("screenshot_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!project) return;

  const admin = createAdminClient();
  const assetsUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);

  const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: claimed } = await assetsUpdate({ assets_status: "preparing", assets_error: null })
    .or(`assets_status.not.in.(preparing,generating),updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return;

  const brief = ProductBrief.safeParse(project.brief);
  if (project.brief_status !== "completed" || !brief.success) {
    await assetsUpdate({ assets_status: "failed", assets_error: "Generate a valid brief first." });
  } else {
    const paths = [
      ...(capture?.screenshot_path ? [capture.screenshot_path] : []),
      ...(screenshots ?? []).map((s) => s.storage_path),
    ];
    await assetsUpdate({
      assets_status: "completed",
      assets_error: null,
      assets_manifest: buildAssetManifest(brief.data, paths, project.format),
    });
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function generateVisualAssets(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase
    .from("projects")
    .select("format, assets_status, assets_manifest")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.assets_manifest) return;

  const admin = createAdminClient();
  const assetsUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);

  // Only from a prepared manifest, and never while another run is in progress.
  const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: claimed } = await assetsUpdate({ assets_status: "generating", assets_error: null })
    .or(`assets_status.in.(completed,failed),and(assets_status.eq.generating,updated_at.lt.${staleBefore})`)
    .select("assets_manifest")
    .maybeSingle();
  if (!claimed) return;

  const manifest = claimed.assets_manifest as AssetManifest;
  const ctx = { userId: user.id, projectId, format: project.format };
  // Skip assets already generated; screenshots/typography are never sent to Fal.
  const assets = await Promise.all(
    manifest.assets.map((asset) =>
      asset.status === "completed" ? asset : generateAsset(admin, asset, ctx),
    ),
  );
  const failed = assets.filter((a) => a.status === "failed").length;
  await assetsUpdate({
    assets_manifest: { ...manifest, assets },
    assets_status: failed ? "failed" : "completed",
    assets_error: failed ? `${failed} asset(s) failed to generate.` : null,
  });
  revalidatePath(`/projects/${projectId}`);
}

const STALE_RENDER_MS = 30 * 60 * 1000;

export async function renderVideo(projectId: string, formData: FormData) {
  await startRender(projectId, String(formData.get("resolution") ?? ""), false);
}

// Shared by the Render button (background) and the dev benchmark (awaited).
// Not exported, so clients can't trigger a blocking render.
async function startRender(projectId: string, requested: string, wait: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns rows this user owns.
  const [{ data: project }, { data: capture }] = await Promise.all([
    supabase.from("projects").select(RENDER_PROJECT_COLUMNS).eq("id", projectId).maybeSingle(),
    supabase
      .from("website_captures")
      .select("title, meta_description, visible_text")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!project) return;

  const admin = createAdminClient();
  const renderUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);

  // Validate immediately before rendering; Remotion never starts on failure.
  // Signed URLs must outlive the render.
  const input = await buildRenderInput(supabase, project, 2 * 60 * 60);
  const problems = validateForRender({
    brief: project.brief,
    assetsManifest: project.assets_manifest,
    format: project.format,
    durationSeconds: project.duration_seconds,
    resolution: requested,
    sourceText: [capture?.title, capture?.meta_description, capture?.visible_text].join("\n"),
    missing: input.problems,
  });
  if (!input.props || problems.length) {
    await renderUpdate({
      render_status: "failed",
      render_error: `Validation failed: ${problems.join(" ")}`.slice(0, 500),
    }).neq("render_status", "processing");
    revalidatePath(`/projects/${projectId}`);
    return;
  }
  const resolution = requested as Resolution;

  const staleBefore = new Date(Date.now() - STALE_RENDER_MS).toISOString();
  const { data: claimed } = await renderUpdate({
    render_status: "processing",
    render_error: null,
    status: "processing",
    resolution,
  })
    .or(`render_status.neq.processing,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return;

  // Rendering takes minutes; finish after responding. Page shows progress on refresh.
  const props = input.props;
  const job = async () => {
    try {
      const started = Date.now();
      const mp4 = await renderStoryboardMp4(props, resolution);
      const renderMs = Date.now() - started;
      const videoPath = `${user.id}/${projectId}/final.mp4`;
      const { error } = await admin.storage
        .from(VIDEOS_BUCKET)
        .upload(videoPath, mp4, { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(`Video storage failed: ${error.message}`);
      const owner = { project_id: projectId, user_id: user.id };
      await recordCost(admin, {
        ...owner,
        operation: "remotion_render",
        model: "remotion",
        duration_seconds: props.durationSeconds,
        resolution,
        quantity: props.durationSeconds,
        estimated_cost_usd: renderCost(resolution, props.durationSeconds),
        metadata: { unit: "video_seconds", render_ms: renderMs, bytes: mp4.byteLength },
      });
      await recordCost(admin, {
        ...owner,
        operation: "storage",
        resolution,
        quantity: mp4.byteLength,
        estimated_cost_usd: storageCost(mp4.byteLength),
        metadata: { kind: "video", unit: "bytes" },
      });
      await renderUpdate({
        render_status: "completed",
        render_error: null,
        video_path: videoPath,
        status: "completed",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message.split("\n")[0] : "Render failed.";
      await renderUpdate({
        render_status: "failed",
        render_error: message.slice(0, 500),
        status: "failed",
      });
    }
  };
  if (wait) await job();
  else after(job);
  revalidatePath(`/projects/${projectId}`);
}

// Development-only: runs the real pipeline (brief → voice → assets → render)
// for each benchmark case on a copy of this project and records the metrics.
// Runs synchronously so each step and render can be timed end to end.
export async function runBenchmark(sourceProjectId: string, formData: FormData) {
  if (process.env.NODE_ENV === "production") return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: verifies ownership of the source project.
  const { data: source } = await supabase
    .from("projects")
    .select("id")
    .eq("id", sourceProjectId)
    .maybeSingle();
  if (!source) return;

  const choice = String(formData.get("case") ?? "all");
  const cases = choice === "all" ? BENCHMARK_CASES : [BENCHMARK_CASES[Number(choice)]].filter(Boolean);
  const admin = createAdminClient();

  for (const { duration, resolution } of cases) {
    const started = Date.now();
    const { data: run } = await admin
      .from("benchmark_runs")
      .insert({
        user_id: user.id,
        source_project_id: sourceProjectId,
        duration_seconds: duration,
        resolution,
      })
      .select("id")
      .single();
    if (!run) continue;
    const finish = (fields: Record<string, unknown>) =>
      admin
        .from("benchmark_runs")
        .update({ ...fields, total_ms: Date.now() - started, finished_at: new Date().toISOString() })
        .eq("id", run.id);

    let projectId: string | undefined;
    try {
      projectId = await cloneProjectForBenchmark(admin, user.id, sourceProjectId, duration);
      await admin.from("benchmark_runs").update({ project_id: projectId }).eq("id", run.id);
      const pid = projectId;
      const state = async () =>
        (
          await admin
            .from("projects")
            .select("brief_status, brief_error, voice_status, voice_error, assets_status, assets_error, render_status, render_error")
            .eq("id", pid)
            .single()
        ).data!;

      await generateBrief(pid);
      let p = await state();
      if (p.brief_status !== "completed") throw new Error(`Brief: ${p.brief_error}`);
      await generateVoice(pid);
      p = await state();
      if (p.voice_status !== "completed") throw new Error(`Voice: ${p.voice_error}`);
      await prepareAssets(pid);
      await generateVisualAssets(pid);
      p = await state();
      if (p.assets_status !== "completed") throw new Error(`Assets: ${p.assets_error}`);
      await startRender(pid, resolution, true);
      p = await state();
      if (p.render_status !== "completed") throw new Error(`Render: ${p.render_error}`);

      await finish({ status: "completed", ...(await collectBenchmarkMetrics(admin, pid, duration)) });
    } catch (e) {
      const metrics = projectId ? await collectBenchmarkMetrics(admin, projectId, duration) : {};
      await finish({
        status: "failed",
        error: (e instanceof Error ? e.message : "Benchmark failed.").slice(0, 500),
        ...metrics,
      });
    }
  }
  revalidatePath(`/projects/${sourceProjectId}`);
}
