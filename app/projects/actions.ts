"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADVANCED_DIRECTION_MAX,
  CREATIVE_DEFAULTS,
  CREATIVE_DIRECTIONS,
  DIRECTION_MAX,
  DURATIONS,
  FORMATS,
  MOTION_LEVELS,
  SCREENSHOT_TYPES,
  SCREENSHOTS_BUCKET,
  VIDEOS_BUCKET,
  VISUAL_DENSITIES,
  VISUAL_STYLES,
  VOICE_LANGUAGES,
  VOICE_GENDERS,
  VOICE_STYLES,
  parseHttpUrl,
  validateScreenshots,
  VERCEL_SCREENSHOT_TOTAL_BYTES,
} from "@/lib/projects";
import { runWebsiteCapture } from "@/lib/website-capture";

import { type BriefUsage, ProductBrief, generateProductBrief } from "@/lib/ai/product-brief";
import { type AssetManifest, buildAssetManifest } from "@/lib/asset-manifest";
import { type ScreenshotEvidence, analyzeScreenshots, evidenceText } from "@/lib/ai/screenshot-evidence";
import { generateAsset } from "@/lib/generated-assets";
import { RENDER_PROJECT_COLUMNS, buildRenderInput } from "@/lib/render-input";
import { renderStoryboardMp4 } from "@/lib/render-video";
import { validateForRender } from "@/lib/render-validation";
import { falCost, openaiCost, renderCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { canUseDevTools } from "@/lib/dev-tools";
import {
  NEEDS_SCREENSHOTS_MESSAGE,
  RENDER_WORKER_MESSAGE,
  type PipelineStep,
} from "@/lib/pipeline";
import {
  BENCHMARK_CASES,
  cloneProjectForBenchmark,
  collectBenchmarkMetrics,
} from "@/lib/benchmark";
import type { Resolution } from "@/components/video/types";
import { generateVoice as generateFalVoice } from "@/lib/ai/fal";
import { generateVisualStory } from "@/lib/ai/visual-story";
import { parseWordTimings } from "@/lib/voice-timing";
import { storyEngineEnabled } from "@/lib/story-engine";
import { generateStoryAssets, planStoryAssets, storyAssetsEnabled } from "@/lib/story-assets";
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
  const voiceGender = oneOf(VOICE_GENDERS, formData.get("voice_gender")) ?? "male";
  const creativeDirection = oneOf(CREATIVE_DIRECTIONS, formData.get("creative_direction")) ?? CREATIVE_DEFAULTS.creative_direction;
  const motionLevel = oneOf(MOTION_LEVELS, formData.get("motion_level")) ?? CREATIVE_DEFAULTS.motion_level;
  const visualDensity = oneOf(VISUAL_DENSITIES, formData.get("visual_density")) ?? CREATIVE_DEFAULTS.visual_density;
  const advancedDirection = String(formData.get("advanced_direction") ?? "").trim();

  if (!direction) return { error: "Video direction is required." };
  if (direction.length > DIRECTION_MAX)
    return { error: `Direction must be ${DIRECTION_MAX} characters or less.` };
  if (advancedDirection.length > ADVANCED_DIRECTION_MAX)
    return { error: `Advanced direction must be ${ADVANCED_DIRECTION_MAX} characters or less.` };
  if (!duration || !format || !voiceLanguage || !voiceStyle)
    return { error: "Please choose a valid option for every field." };
  if (websiteUrl && !parseHttpUrl(websiteUrl))
    return { error: "Website URL must be a valid http:// or https:// address." };

  // Browsers send an empty, unnamed File when no file is chosen.
  const screenshots = formData
    .getAll("screenshots")
    .filter((f): f is File => f instanceof File && (f.size > 0 || f.name !== ""));
  const screenshotError = validateScreenshots(
    screenshots,
    process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES : undefined,
  );
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
      voice_gender: voiceGender,
      creative_direction: creativeDirection,
      motion_level: motionLevel,
      visual_density: visualDensity,
      advanced_direction: advancedDirection,
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
    // Captured by the pipeline's first step.
    await supabase
      .from("website_captures")
      .insert({ project_id: data.id, user_id: user.id, url: websiteUrl });
  }

  await claimPipeline(data.id, user.id);
  after(() => runPipeline(data.id, user.id));

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
    supabase
      .from("project_screenshots")
      .select("original_filename, storage_path")
      .eq("project_id", projectId)
      .order("created_at"),
  ]);
  if (!project) return;

  // Brief fields are system-managed: users can't write them, so write via the
  // admin client, scoped to the project ownership verified above.
  const admin = createAdminClient();
  const briefUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);
  const fail = (message: string) =>
    briefUpdate({ brief_status: "failed", brief_error: message });

  // The customer's script is also a source (same rule as the pipeline).
  if (!capture && !screenshots?.length && !project.direction?.trim()) {
    await fail("Add a script, captured website or screenshots before generating a brief.");
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
  let visionUsage: BriefUsage | undefined;
  try {
    // Screenshot evidence (vision) is extracted once and reused; it lets
    // screenshot-only projects support claims without website text.
    let evidence = project.screenshot_evidence as ScreenshotEvidence | null;
    if (!evidence && screenshots?.length) {
      const { data: signed } = await supabase.storage
        .from(SCREENSHOTS_BUCKET)
        .createSignedUrls(screenshots.map((s) => s.storage_path), 600);
      const urls = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
      if (!urls.length) throw new Error("Screenshots could not be loaded for analysis.");
      evidence = await analyzeScreenshots(urls, (u) => (visionUsage = u));
      await briefUpdate({ screenshot_evidence: evidence });
    }

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
        creative_preferences: creativePreferences(project),
        screenshots: (screenshots ?? []).map((s) => s.original_filename),
        has_website_screenshot: !!capture?.screenshot_path,
      },
      (u) => (usage = u),
    );
    await briefUpdate({ brief, brief_status: "completed", brief_error: null });
  } catch (e) {
    console.error("brief generation failed:", projectId, e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e);
    await fail((e instanceof Error ? e.message : "Brief generation failed.").slice(0, 500));
  } finally {
    for (const [u, kind] of [
      [visionUsage, "screenshot_analysis"],
      [usage, "brief"],
    ] as const) {
      if (!u) continue;
      await recordCost(admin, {
        project_id: projectId,
        user_id: user.id,
        operation: "openai_brief",
        model: u.model,
        quantity: u.inputTokens + u.outputTokens,
        estimated_cost_usd: openaiCost(u.model, u.inputTokens, u.outputTokens),
        metadata: { kind, input_tokens: u.inputTokens, output_tokens: u.outputTokens },
      });
    }
  }
  revalidatePath(`/projects/${projectId}`);
}

// Older projects have no preferences: fall back to the neutral defaults.
function creativePreferences(project: { direction?: string | null; creative_direction?: string | null; motion_level?: string | null; visual_density?: string | null; advanced_direction?: string | null }) {
  return {
    visual_style: project.direction?.match(/Visual style:\s*(.+)\s*$/m)?.[1] ?? VISUAL_STYLES[0],
    creative_direction: project.creative_direction ?? CREATIVE_DEFAULTS.creative_direction,
    motion_level: project.motion_level ?? CREATIVE_DEFAULTS.motion_level,
    visual_density: project.visual_density ?? CREATIVE_DEFAULTS.visual_density,
    advanced_direction: project.advanced_direction ?? "",
  };
}

// Preview-only (VISUAL_ENGINE=story): a separate VisualStory call after the
// brief. Stores the story only when it validates; otherwise the brief keeps
// story = null and the existing renderer is used. Never fails the project.
async function generateStory(projectId: string, userId: string, budgetMs: number) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("brief, format, duration_seconds, direction, creative_direction, motion_level, visual_density, advanced_direction, voice_status, voice_result")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  const brief = ProductBrief.safeParse(project?.brief);
  // Only after the voice exists; the locked script is never rewritten here.
  if (!project || project.voice_status !== "completed" || !brief.success || brief.data.story || project.format !== "16:9") return;
  const words = parseWordTimings((project.voice_result as { timing?: { words?: unknown } } | null)?.timing?.words);
  console.info("visual story start:", { projectId, after: "voice completed", timing: words?.length ? "voice" : "estimated", words: words?.length ?? 0 });
  let usage: BriefUsage | undefined;
  const result = await generateVisualStory(
    {
      narration: brief.data.script,
      words,
      duration_seconds: project.duration_seconds,
      product_name: brief.data.product_name || undefined,
      creative_preferences: creativePreferences(project),
      assets: storyAssetsEnabled(),
    },
    (u) => (usage = u),
    budgetMs,
  );
  console.info("visual story:", {
    projectId,
    outcome: result.story ? "stored" : "none",
    timing: result.timing,
    attempts: result.attempts,
    ms: result.ms,
    input_tokens: usage?.inputTokens,
    output_tokens: usage?.outputTokens,
    problems: result.errors.slice(0, 6),
  });
  if (result.story) {
    // Re-read so nothing written meanwhile is lost; only `story` changes.
    const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
    const current = ProductBrief.safeParse(fresh?.brief);
    if (current.success && !current.data.story) {
      await admin.from("projects").update({ brief: { ...(fresh!.brief as object), story: result.story } }).eq("id", projectId).eq("user_id", userId);
      // Visual Asset Planner: only after the story is validated and stored.
      // Images take ~10–30 s; skipped (procedural visuals) when time is short.
      if (storyAssetsEnabled() && planStoryAssets(result.story).length && budgetMs - result.ms > 45_000) {
        const started = Date.now();
        const records = await generateStoryAssets(admin, result.story, { userId, projectId, visualStyle: creativePreferences(project).visual_style });
        console.info("story assets:", { projectId, ms: Date.now() - started, assets: records.map((r) => ({ id: r.continuity_id, type: r.type, status: r.status, ms: r.ms, error: r.error })) });
        const { data: latest } = await admin.from("projects").select("brief").eq("id", projectId).single();
        await admin.from("projects").update({ brief: { ...(latest!.brief as object), story_assets: records } }).eq("id", projectId).eq("user_id", userId);
      }
    }
  }
  if (usage) {
    await recordCost(admin, {
      project_id: projectId,
      user_id: userId,
      operation: "openai_brief",
      model: usage.model,
      quantity: usage.inputTokens + usage.outputTokens,
      estimated_cost_usd: openaiCost(usage.model, usage.inputTokens, usage.outputTokens),
      metadata: { kind: "visual_story", input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, attempts: result.attempts, latency_ms: result.ms, stored: !!result.story, timing: result.timing },
    });
  }
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
    .select("brief, brief_status, voice_language, voice_style, voice_gender, voice_result")
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
    const { model, requestId, audioUrl, words, timestampsSample } = await generateFalVoice({
      script,
      language: project.voice_language,
      style: project.voice_style,
      gender: project.voice_gender,
    });
    const owner = { project_id: projectId, user_id: user.id };
    // Recorded as soon as Fal returns: the provider charges even if storing fails.
    // Voice is priced per script character; the stored file costs storage.
    await recordCost(admin, {
      ...owner,
      operation: "fal_voice",
      model,
      quantity: script.length,
      estimated_cost_usd: falCost(model, script.length),
      metadata: { unit: "characters", request_id: requestId },
    });
    const stored = await storeVoiceAudio(admin, audioUrl, user.id, projectId);
    const storagePath = stored.path;
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
      // Word timing drives narration-synced motion; null = none available.
      voice_result: {
        model,
        requestId,
        storagePath,
        timing: words ? { source: "provider", words } : null,
        ...(timestampsSample && { timestampsSample }),
      },
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
    supabase.from("projects").select("brief, brief_status, format, direction").eq("id", projectId).maybeSingle(),
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
      // The customer's chosen visual style (appended to the direction) shapes image prompts.
      assets_manifest: buildAssetManifest(brief.data, paths, project.format, project.direction?.match(/Visual style:\s*(.+)\s*$/m)?.[1]),
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
    // Claims must be supported by website text, screenshot evidence or the script.
    sourceText: [
      capture?.title,
      capture?.meta_description,
      capture?.visible_text,
      evidenceText(project.screenshot_evidence as ScreenshotEvidence | null),
      // The customer's own script is a source for its own claims.
      project.direction,
    ].join("\n"),
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

  // Vercel Functions have no Chrome for Remotion; stop cleanly instead of
  // attempting (or faking) a render. Rendering runs on a dedicated worker later.
  if (process.env.VERCEL) {
    await renderUpdate({
      render_status: "failed",
      render_error: RENDER_WORKER_MESSAGE,
    }).neq("render_status", "processing");
    revalidatePath(`/projects/${projectId}`);
    return;
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseDevTools(supabase, user.id))) return;

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
      // Keep usage and partial spend for diagnosis, but no per-video totals:
      // an incomplete video's cost would understate the real cost per video/minute.
      const metrics = projectId ? await collectBenchmarkMetrics(admin, projectId, duration) : undefined;
      await finish({
        status: "failed",
        error: (e instanceof Error ? e.message : "Benchmark failed.").slice(0, 500),
        ...metrics,
        estimated_cost_usd: null,
        cost_per_minute_usd: null,
        cost_breakdown: metrics ? { ...metrics.cost_breakdown, partial: true } : null,
      });
    }
  }
  revalidatePath(`/projects/${sourceProjectId}`);
}

// --- Automatic generation pipeline ------------------------------------------

const STALE_PIPELINE_MS = 15 * 60 * 1000;

// Marks the pipeline running; returns false if a run is already in progress.
async function claimPipeline(projectId: string, userId: string) {
  const staleBefore = new Date(Date.now() - STALE_PIPELINE_MS).toISOString();
  const { data } = await createAdminClient()
    .from("projects")
    .update({ pipeline_status: "running", pipeline_step: "analyzing", pipeline_error: null })
    .eq("id", projectId)
    .eq("user_id", userId)
    .or(`pipeline_status.neq.running,updated_at.lt.${staleBefore}`)
    .select("id");
  return !!data?.length;
}

/**
 * Runs every generation step in order, reusing the individual step actions.
 * Completed steps are skipped, so a retry resumes where the last run stopped.
 * Never throws; the outcome is stored on the project.
 */
// The whole pipeline runs within one request (maxDuration 300 s).
const PIPELINE_BUDGET_MS = 280_000;

async function runPipeline(projectId: string, userId: string) {
  const pipelineStarted = Date.now();
  const admin = createAdminClient();
  const setPipeline = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", userId);
  const state = async () =>
    (
      await admin
        .from("projects")
        .select(
          "resolution, brief_status, brief_error, voice_status, voice_error, assets_status, assets_error, assets_manifest, render_status, render_error",
        )
        .eq("id", projectId)
        .single()
    ).data!;
  // Step actions finish with revalidatePath, which may not be allowed here;
  // their results are read back from the database either way.
  const attempt = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      console.error("pipeline step:", e);
    }
  };
  let step: PipelineStep = "analyzing";
  const enter = (next: PipelineStep) => {
    step = next;
    return setPipeline({ pipeline_step: next });
  };
  const fail = (message: string, status = "failed") =>
    setPipeline({ pipeline_status: status, pipeline_step: step, pipeline_error: message.slice(0, 500) });

  try {
    // 1. Website capture (pending captures only) and source check.
    await enter("analyzing");
    const supabase = await createClient();
    const { data: pending } = await supabase
      .from("website_captures")
      .select("id, url")
      .eq("project_id", projectId)
      .eq("status", "pending");
    for (const c of pending ?? []) {
      await runWebsiteCapture(supabase, { id: c.id, userId, projectId, url: c.url });
    }
    const [{ count: captured }, { count: shots }] = await Promise.all([
      supabase
        .from("website_captures")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "completed"),
      supabase
        .from("project_screenshots")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
    ]);
    // Sources: captured website, screenshots, or the customer's own script.
    // Never generate from the URL alone: that would mean inventing the product.
    const { data: own } = await supabase.from("projects").select("direction").eq("id", projectId).single();
    if (!captured && !shots && !own?.direction?.trim()) {
      return void (await fail(NEEDS_SCREENSHOTS_MESSAGE, "needs_input"));
    }

    // 2. Product brief + script.
    await enter("writing");
    let p = await state();
    if (p.brief_status !== "completed") {
      await attempt(() => generateBrief(projectId));
      p = await state();
      if (p.brief_status !== "completed") return void (await fail(p.brief_error ?? "Brief failed."));
    }

    // 3. Voice: one track for the locked script, with word timestamps.
    await enter("voice");
    if (p.voice_status !== "completed") {
      await attempt(() => generateVoice(projectId));
      p = await state();
      if (p.voice_status !== "completed") return void (await fail(p.voice_error ?? "Voice failed."));
    }

    // Preview-only: the Visual Director starts only after the voice exists
    // (its words are the timeline); it runs alongside the visuals step.
    const budget = PIPELINE_BUDGET_MS - (Date.now() - pipelineStarted);
    const story = storyEngineEnabled() && budget > 45_000 ? attempt(() => generateStory(projectId, userId, Math.min(110_000, budget - 30_000))) : null;

    // 4. Visual asset manifest, then generated assets.
    await enter("visuals");
    if (p.assets_status !== "completed" || !p.assets_manifest) {
      await attempt(() => prepareAssets(projectId));
    }
    p = await state();
    const needsGeneration = (p.assets_manifest as AssetManifest | null)?.assets.some(
      (a) => a.source === "generated" && a.status !== "completed",
    );
    if (p.assets_status === "completed" && needsGeneration) {
      await attempt(() => generateVisualAssets(projectId));
      p = await state();
    }
    await story;
    if (p.assets_status !== "completed") return void (await fail(p.assets_error ?? "Assets failed."));

    // 5–6. Validation runs first inside startRender; rendering only where supported.
    await enter("validating");
    await attempt(() => startRender(projectId, p.resolution, true));
    p = await state();
    if (p.render_status === "completed") {
      return void (await setPipeline({ pipeline_status: "completed", pipeline_step: null, pipeline_error: null }));
    }
    if (p.render_error?.startsWith("Validation failed")) return void (await fail(p.render_error));
    if (p.render_error === RENDER_WORKER_MESSAGE) {
      // Honest end state: everything but the MP4 is ready; no fake render.
      return void (await setPipeline({
        pipeline_status: "preview_ready",
        pipeline_step: "rendering",
        pipeline_error: RENDER_WORKER_MESSAGE,
      }));
    }
    step = "rendering";
    await fail(p.render_error ?? "Render failed.");
  } catch (e) {
    await fail(e instanceof Error ? e.message : "Generation failed.");
  }
}

// Retries the pipeline from the failed step. After a validation failure the
// script is regenerated (with its voice and visuals) instead of re-checking it.
export async function retryPipeline(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase
    .from("projects")
    .select("pipeline_status, pipeline_step")
    .eq("id", projectId)
    .maybeSingle();
  // Failed runs resume; projects created before the pipeline existed can start.
  if (!project || !["failed", "idle"].includes(project.pipeline_status)) return;

  if (project.pipeline_step === "validating") {
    await createAdminClient()
      .from("projects")
      .update({ brief_status: "none", voice_status: "none", assets_status: "none", assets_manifest: null })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }
  if (await claimPipeline(projectId, user.id)) after(() => runPipeline(projectId, user.id));
  revalidatePath(`/projects/${projectId}`);
}
