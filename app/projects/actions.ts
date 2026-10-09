"use server";

import { downloadEntry, LOOK_FEATURES, seedFrom, type Taste } from "@/lib/shot-search";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADVANCED_DIRECTION_MAX,
  AUDIENCE_MAX,
  BRAND_NAME_MAX,
  CTA_MAX,
  isHexColor,
  CREATIVE_DEFAULTS,
  CREATIVE_DIRECTIONS,
  DIRECTION_MAX,
  estimateVideoSeconds,
  resolveTheme,
  type Look,
  VOICE_SCRIPT_MAX,
  voiceVideoSeconds,
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
  lockBriefScript,
  lockedScriptOf,
  lockedVoiceScript,
  voiceChoiceOf,
  withVoiceChoice,
  logoPath,
  parseHttpUrl,
  validateLogo,
  validateScreenshots,
  VERCEL_SCREENSHOT_TOTAL_BYTES,
} from "@/lib/projects";
import { runWebsiteCapture } from "@/lib/website-capture";

import { type BriefUsage, ProductBrief, fitDurations, generateProductBrief } from "@/lib/ai/product-brief";
import { type AssetManifest, buildAssetManifest } from "@/lib/asset-manifest";
import { type ScreenshotEvidence, analyzeScreenshots, evidenceText } from "@/lib/ai/screenshot-evidence";
import { generateAsset } from "@/lib/generated-assets";
import { RENDER_PROJECT_COLUMNS, buildRenderInput } from "@/lib/render-input";
import { renderStoryboardMp4 } from "@/lib/render-video";
import { validateForRender } from "@/lib/render-validation";
import { falCost, openaiCost, renderCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { getAiConfig, unitCost, usageCost } from "@/lib/ai/models";
import { canUseDevTools } from "@/lib/dev-tools";
import {
  flowBudgetMs,
  NEEDS_SCREENSHOTS_MESSAGE,
  OWN_SCRIPT_MESSAGE,
  PIPELINE_BUDGET_MS,
  RENDER_WORKER_MESSAGE,
  type PipelineStep,
} from "@/lib/pipeline";
import {
  BENCHMARK_CASES,
  cloneProjectForBenchmark,
  collectBenchmarkMetrics,
} from "@/lib/benchmark";
import type { Resolution } from "@/components/video/types";
import { generateVoice as generateFalVoice, timeWords } from "@/lib/ai/fal";
import { generateVisualStory } from "@/lib/ai/visual-story";
import { parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { type StoredVariant, studioVariants } from "@/lib/studio-variants";
import { flowEngineEnabled, needsLegacyImages, storyEngineEnabled, usableFlow, usableScene, usableStory } from "@/lib/story-engine";
import { generateFlowScript } from "@/lib/ai/flow-director";
import { generateStories } from "@/lib/ai/story-director";
import { generateComposerIdeas, ideasOf, reviseComposerPlan } from "@/lib/ai/composer-director";
import { ruleBrief } from "@/lib/rule-brief";
import { CHANGE_WORDS, COMPOSER_CHANGES } from "@/components/video/composer/types";
import { type StoredComposition, composeVariants } from "@/components/video/composer/variants";
import { scriptWords } from "@/components/video/composer/words";
import { literalMisfits } from "@/components/video/clean/studio/ids";
import { generateSceneScript } from "@/lib/ai/scene-director";
import { generateShotScript } from "@/lib/ai/shot-director";
import { neverList } from "@/lib/video-rules";
import { estimateWords, type FlowScript } from "@/lib/flow-script";
import type { SceneScript } from "@/lib/scene-script";
import type { VisualStory } from "@/lib/visual-story";
import { generateStoryAssets, planStoryAssets, storyAssetsEnabled } from "@/lib/story-assets";
import { AUDIO_BUCKET, storeVoiceAudio } from "@/lib/voice-audio";
import { userAccess } from "@/lib/admin";
import { getSettings } from "@/lib/app-settings";

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
  // The voiceover script, without the "Visual style: …" suffix the form adds.
  const voiceScript = lockedVoiceScript(direction);
  // A first estimate; the voice's real length replaces it once it exists.
  const duration = estimateVideoSeconds(voiceScript);
  const format = oneOf(FORMATS, formData.get("format"));
  const voiceLanguage = oneOf(VOICE_LANGUAGES, formData.get("voice_language"));
  const voiceStyle = oneOf(VOICE_STYLES, formData.get("voice_style"));
  const voiceGender = oneOf(VOICE_GENDERS, formData.get("voice_gender")) ?? "male";
  const creativeDirection = oneOf(CREATIVE_DIRECTIONS, formData.get("creative_direction")) ?? CREATIVE_DEFAULTS.creative_direction;
  const motionLevel = oneOf(MOTION_LEVELS, formData.get("motion_level")) ?? CREATIVE_DEFAULTS.motion_level;
  const visualDensity = oneOf(VISUAL_DENSITIES, formData.get("visual_density")) ?? CREATIVE_DEFAULTS.visual_density;
  const advancedDirection = String(formData.get("advanced_direction") ?? "").trim();
  const brandName = String(formData.get("brand_name") ?? "").trim();
  const brandColorRaw = String(formData.get("brand_color") ?? "").trim();
  const brandColor = brandColorRaw && isHexColor(brandColorRaw) ? brandColorRaw.toUpperCase() : null;
  const callToAction = String(formData.get("call_to_action") ?? "").trim();
  const targetAudience = String(formData.get("target_audience") ?? "").trim();

  if (!direction) return { error: "The voiceover script is required." };
  if (voiceScript.length > VOICE_SCRIPT_MAX || direction.length > DIRECTION_MAX)
    return { error: `The voiceover script must be ${VOICE_SCRIPT_MAX} characters or less.` };
  // The video direction is optional: the Directors work out the visuals from
  // the script (the simple form does not ask for it).
  if (advancedDirection.length > ADVANCED_DIRECTION_MAX)
    return { error: `The video direction must be ${ADVANCED_DIRECTION_MAX} characters or less.` };
  if (brandColorRaw && !brandColor) return { error: "Brand colour must be a hex colour like #0E9CA6." };
  if (brandName.length > BRAND_NAME_MAX || callToAction.length > CTA_MAX || targetAudience.length > AUDIENCE_MAX)
    return { error: "Brand name and call to action must be 60 characters or less, audience 200." };
  if (!duration || !format || !voiceLanguage || !voiceStyle)
    return { error: "Please choose a valid option for every field." };
  if (websiteUrl && !parseHttpUrl(websiteUrl))
    return { error: "Website URL must be a valid http:// or https:// address." };

  // The logo is required; screenshots are optional.
  const logoEntry = formData.get("logo");
  const logo = logoEntry instanceof File ? logoEntry : null;
  const logoError = validateLogo(logo);
  if (logoError) return { error: logoError };
  // With no file chosen, browsers send an empty File — unnamed on desktop,
  // named "blob" on mobile Chrome. Empty entries are "none chosen".
  const screenshots = formData
    .getAll("screenshots")
    .filter((f): f is File => f instanceof File && f.size > 0);
  // On Vercel the logo shares the request-size budget with the screenshots.
  const screenshotError = validateScreenshots(
    screenshots,
    process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES - logo!.size : undefined,
  );
  if (screenshotError) return { error: screenshotError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Controls from /admin: suspension, maintenance mode, daily limit (admins exempt).
  const access = await userAccess(supabase, user.id);
  if (access.suspended) return { error: "This account is suspended. Contact support." };
  if (!access.admin) {
    const settings = await getSettings();
    if (settings.maintenance_mode === true) return { error: String(settings.maintenance_message) };
    const perDay = Number(settings.max_videos_per_day) || 0;
    if (perDay > 0) {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
      if ((count ?? 0) >= perDay) return { error: `You can start ${perDay} videos per day. Please try again tomorrow.` };
    }
  }

  // A voice from the list on /admin/models (else the gender's default voice).
  const chosenVoice = (await getAiConfig()).voice.choices.find((c) => c.name === String(formData.get("voice_name") ?? ""));
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      website_url: websiteUrl || null,
      direction: withVoiceChoice(direction, chosenVoice?.name ?? null),
      duration_seconds: duration,
      format,
      voice_language: voiceLanguage,
      voice_style: voiceStyle,
      voice_gender: chosenVoice?.gender ?? voiceGender,
      creative_direction: creativeDirection,
      motion_level: motionLevel,
      visual_density: visualDensity,
      advanced_direction: advancedDirection,
      brand_name: brandName,
      brand_color: brandColor,
      call_to_action: callToAction,
      target_audience: targetAudience,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const uploaded: string[] = [];
  const logoAt = logoPath(user.id, data.id, SCREENSHOT_TYPES[logo!.type]);
  const logoUpload = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(logoAt, logo!, { contentType: logo!.type });
  if (logoUpload.error) {
    await supabase.from("projects").delete().eq("id", data.id);
    return { error: "Icon upload failed. Please try again." };
  }
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
    await supabase.storage.from(SCREENSHOTS_BUCKET).remove([logoAt, ...uploaded]);
    await supabase.from("projects").delete().eq("id", data.id);
    return { error: "Screenshot upload failed. Please try again." };
  }

  // Direction library: what the customer asked for, kept as data the product
  // learns from. Never blocks the project.
  const { error: libraryError } = await createAdminClient()
    .from("direction_library")
    .insert({
      project_id: data.id,
      user_id: user.id,
      voice_script: direction.replace(/\n\nVisual style:[\s\S]*$/, ""),
      video_direction: advancedDirection,
      visual_style: direction.match(/Visual style:\s*(.+)\s*$/m)?.[1] ?? null,
      creative_direction: creativeDirection,
      motion_level: motionLevel,
      visual_density: visualDensity,
      format,
      duration_seconds: duration,
      voice_language: voiceLanguage,
      brand_name: brandName || null,
      brand_color: brandColor,
      call_to_action: callToAction || null,
      target_audience: targetAudience || null,
      has_logo: true,
      screenshot_count: uploaded.length,
    });
  if (libraryError) console.error("direction library insert failed:", data.id, libraryError.message);

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

  // "AI only for the voice": the brief is written by rule from the
  // customer's own script (lib/rule-brief.ts); no AI call.
  if (!(await getAiConfig()).tasks.brief.on) {
    const script = lockedScriptOf(project) || lockedVoiceScript(project.direction);
    if (!script) {
      await fail(OWN_SCRIPT_MESSAGE);
      revalidatePath(`/projects/${projectId}`);
      return;
    }
    const { data: fresh } = await admin.from("projects").select("brief, voice_status, duration_seconds").eq("id", projectId).single();
    const kept = Object.fromEntries(Object.entries((fresh?.brief as Record<string, unknown> | null) ?? {}).filter(([k]) => ["scene", "flow", "story", "shots", "variants", "diagnostics", "taste", "clean", "composer"].includes(k)));
    let next = ruleBrief({ script, productName: project.brand_name, summary: capture?.meta_description, cta: project.call_to_action });
    if (fresh?.voice_status === "completed" && fresh.duration_seconds) {
      try {
        next = { ...next, scenes: fitDurations(next, fresh.duration_seconds).scenes };
      } catch {
        // (keeps the even pace)
      }
    }
    await briefUpdate({ brief: { ...next, ...kept }, brief_status: "completed", brief_error: null });
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
    // (turned off on /admin/models: the screenshots are shown, not read)
    if (!evidence && screenshots?.length && (await getAiConfig()).tasks.screenshots.on) {
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
    // The customer's script is the narration, word for word (lockBriefScript):
    // the brief model never rewrites what the voice says.
    // With a locked script the voice and the Shot Director run alongside the
    // brief: keep what they already stored, and fit the storyboard to the voice.
    const { data: fresh } = await admin.from("projects").select("brief, voice_status, duration_seconds").eq("id", projectId).single();
    const kept = Object.fromEntries(Object.entries((fresh?.brief as Record<string, unknown> | null) ?? {}).filter(([k]) => ["scene", "flow", "story", "shots", "variants", "diagnostics", "taste", "clean", "composer"].includes(k)));
    let next = lockBriefScript(brief, project);
    if (fresh?.voice_status === "completed" && fresh.duration_seconds) {
      try {
        next = { ...next, scenes: fitDurations(next, fresh.duration_seconds).scenes };
      } catch {
        // (keeps the brief's own timing)
      }
    }
    await briefUpdate({ brief: { ...next, ...kept }, brief_status: "completed", brief_error: null });
  } catch (e) {
    console.error("brief generation failed:", projectId, e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e);
    await fail((e instanceof Error ? e.message : "Brief generation failed.").slice(0, 500));
  } finally {
    const ai = await getAiConfig();
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
        estimated_cost_usd: usageCost(ai, u, (i, o) => openaiCost(u.model, i, o)),
        metadata: { kind, input_tokens: u.inputTokens, output_tokens: u.outputTokens },
      });
    }
  }
  revalidatePath(`/projects/${projectId}`);
}

// Older projects have no preferences: fall back to the neutral defaults.
function creativePreferences(project: { direction?: string | null; creative_direction?: string | null; motion_level?: string | null; visual_density?: string | null; advanced_direction?: string | null; target_audience?: string | null; brand_name?: string | null }) {
  return {
    visual_style: project.direction?.match(/Visual style:\s*(.+)\s*$/m)?.[1] ?? VISUAL_STYLES[0],
    look: project.direction?.match(/^Look:\s*(.+)$/m)?.[1]?.trim() ?? "Auto",
    creative_direction: project.creative_direction ?? CREATIVE_DEFAULTS.creative_direction,
    motion_level: project.motion_level ?? CREATIVE_DEFAULTS.motion_level,
    visual_density: project.visual_density ?? CREATIVE_DEFAULTS.visual_density,
    advanced_direction: project.advanced_direction ?? "",
    target_audience: project.target_audience ?? "",
    brand_name: project.brand_name ?? "",
  };
}

// Preview-only (VISUAL_ENGINE=story): a separate VisualStory call after the
// brief. Stores the story only when it validates; otherwise the brief keeps
// story = null and the existing renderer is used. Never fails the project.
// Preview-only (VISUAL_ENGINE=flow): the Flow Director after the voice. Stores
// the FlowScript only when it validates against the narration and its word
// timestamps; otherwise the existing renderer is used. Never fails the project.
// The Director's NEVER list: built-in rules, active `video_rules` rows, and
// how many videos broke each rule in the last 30 days. Never blocks a video.
async function loadNeverList(admin: ReturnType<typeof createAdminClient>) {
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [rules, mistakes] = await Promise.all([
      admin.from("video_rules").select("id, never").eq("active", true).limit(50),
      admin.from("video_mistakes").select("rule_id, project_id").gte("created_at", since).limit(5000),
    ]);
    const videos: Record<string, Set<string>> = {};
    for (const m of mistakes.data ?? []) (videos[m.rule_id] ??= new Set()).add(m.project_id ?? "");
    return neverList(rules.data ?? [], Object.fromEntries(Object.entries(videos).map(([k, v]) => [k, v.size])));
  } catch {
    return neverList();
  }
}

// The taste: which looks customers downloaded (brief.taste on their projects),
// counted per look feature. The first of the four videos follows it.
async function loadTaste(admin: ReturnType<typeof createAdminClient>): Promise<Taste | null> {
  try {
    const { data } = await admin.from("projects").select("brief->taste").not("brief->taste", "is", null).order("updated_at", { ascending: false }).limit(500);
    const taste: Taste = {};
    for (const row of data ?? []) {
      const downloads = ((row as { taste?: { downloads?: { look?: Record<string, unknown> | null }[] } }).taste?.downloads ?? []);
      for (const d of downloads) for (const f of LOOK_FEATURES) {
        const v = d.look?.[f];
        if (typeof v === "string") (taste[f] ??= {})[v] = (taste[f][v] ?? 0) + 1;
      }
    }
    return Object.keys(taste).length ? taste : null;
  } catch {
    return null;
  }
}

// The clean set for a project: the Director's seven parts (with the
// product's card content) and four studio videos (look + a block per part). Earlier sets
// of this customer for the same narration are its history, so the new four
// differ from every one of them. Null when nothing usable came back.
async function cleanSet(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  userId: string,
  project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null },
  words: WordTiming[],
  narration: string,
  brief: { product_name?: string; product_summary?: string; cta?: string } | null,
  addUsage: (u: BriefUsage) => void,
) {
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const brand = {
    name: project.brand_name?.trim() || brief?.product_name || "Your product",
    color: project.brand_color || "#6a5bff",
    tagline: "",
    cta: project.call_to_action?.trim() || brief?.cta || "Get started",
    url: host,
    icon: null,
  };
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const { data: past } = await admin.from("projects").select("id, clean:brief->clean, script:brief->>script").eq("user_id", userId).neq("id", projectId).order("created_at", { ascending: false }).limit(40);
  const setsOf = (p: { clean: unknown }) => {
    const c = p.clean as { variants?: StoredVariant[]; history?: StoredVariant[][] } | null;
    return c?.variants ? [...(c.history ?? []), c.variants] : [];
  };
  // the same script before: never a video close to those; other scripts (the
  // last ten): their looks, blocks and openings are avoided where possible
  const history: StoredVariant[][] = (past ?? []).filter((p) => typeof p.script === "string" && norm(p.script) === norm(narration)).flatMap(setsOf);
  const recent: StoredVariant[] = (past ?? []).filter((p) => !(typeof p.script === "string" && norm(p.script) === norm(narration))).slice(0, 10).flatMap((p) => setsOf(p).flat());
  const openings = [...[...history.flat(), ...recent].reduce((m, v) => {
    const o = "shape" in v && v.shape ? v.shape.split("-")[0] : null;
    if (o) m.set(o, (m.get(o) ?? 0) + 1);
    return m;
  }, new Map<string, number>())].sort((a, z) => z[1] - a[1]).slice(0, 2).map(([o]) => o);
  // story shapes: two to four ways to tell this script (lib/ai/story-director.ts)
  const result = await generateStories({ brand, words, product: brief?.product_summary ?? null, avoid: openings }, addUsage);
  console.info("story director:", { projectId, source: result.source, attempts: result.attempts, ms: result.ms, shapes: result.stories.map((s) => s.story.shape), problems: result.problems.slice(0, 6) });
  if (!result.stories.length) return null;
  const stories = result.stories.map((s) => s.story);
  const exclude = literalMisfits(`${narration} ${brief?.product_summary ?? ""}`);
  const variants = studioVariants(seedFrom(projectId), history, 4, { recent, exclude, shapes: stories.map((s) => s.shape ?? "") });
  return { script: stories[0] as unknown as Record<string, unknown>, stories: stories as unknown as Record<string, unknown>[], source: result.source, variants, history, at: new Date().toISOString() };
}

// The Composer's four videos (when its engine is on for this customer): the
// Director composes the narration scene by scene, with ways to picture each
// and four art directions; each video takes its own. The faces and fields
// this customer has seen are avoided. Null when the engine is off.
// The Composer engine for this customer: off, admins only, or everyone (/admin/models).
async function composerOn(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const mode = (await getAiConfig()).engine.composer;
  return mode === "all" || (mode === "admins" && (await userAccess(admin, userId)).admin);
}

async function composerSet(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  userId: string,
  project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null; duration_seconds: number },
  voice: WordTiming[],
  narration: string,
  brief: { product_name?: string; product_summary?: string; cta?: string } | null,
  addUsage: (u: BriefUsage) => void,
) {
  if (!(await composerOn(admin, userId))) return null;
  // the script's own words on the voice's times (never pieces of words)
  const words = scriptWords(narration, voice);
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const brand = { name: project.brand_name?.trim() || brief?.product_name || "Your product", color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || brief?.cta || "Get started", url: host, icon: null };
  const { data: past } = await admin.from("projects").select("composer:brief->composer").eq("user_id", userId).neq("id", projectId).order("created_at", { ascending: false }).limit(12);
  const seenArts = (past ?? []).flatMap((p) => ((p.composer as { videos?: { script?: { art?: { display?: string; field?: string } } }[] } | null)?.videos ?? []).map((v) => v.script?.art ?? {}));
  // how this customer's last videos were staged (the next is staged otherwise)
  const seenStaging = (past ?? []).flatMap((p) => ((p.composer as { videos?: StoredComposition[] } | null)?.videos ?? []).map((v) => v.staging ?? null)).slice(0, 8).reverse();
  const seen = { display: [...new Set(seenArts.map((a) => a.display).filter((x): x is string => !!x))].slice(0, 12), field: [...new Set(seenArts.map((a) => a.field).filter((x): x is string => !!x))].slice(0, 6) };
  const result = await generateComposerIdeas({ words, brand, product: brief?.product_summary ?? null, seen }, addUsage);
  const { count: screens } = await admin.from("project_screenshots").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  // one video, the Director's best (its versions follow from "Change it")
  const set = composeVariants({ words, brand, duration: Math.round(project.duration_seconds * 30), seed: seedFrom(projectId), ideas: result.ideas, avoid: { display: seen.display, field: seen.field.slice(0, 3) }, screens: screens ?? 0, count: 1, avoidStaging: seenStaging });
  console.info("composer director:", { projectId, source: result.source, ms: result.ms, scenes: result.ideas?.scenes.length ?? 0, problems: [...result.problems, ...set.problems].slice(0, 8) });
  return { videos: set.videos, ideas: result.ideas, indexing: "script" as const, source: result.source, changes: [] as { direction: string; at: string; ok: boolean }[], problems: [...result.problems, ...set.problems].slice(0, 20), at: new Date().toISOString() };
}

async function generateFlow(projectId: string, userId: string, budgetMs: number) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("brief, format, duration_seconds, direction, creative_direction, motion_level, visual_density, advanced_direction, target_audience, brand_name, brand_color, call_to_action, website_url, voice_status, voice_result")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  const brief = ProductBrief.safeParse(project?.brief);
  // (With a locked script this runs while the brief is still being written.)
  const raw = (project?.brief ?? null) as { scene?: unknown; flow?: unknown; clean?: unknown; composer?: unknown } | null;
  const narration = brief.success ? brief.data.script : project ? lockedScriptOf(project) : "";
  if (!project || project.voice_status !== "completed" || !narration || raw?.flow || raw?.scene || raw?.clean || raw?.composer || project.format !== "16:9") return;
  const words = parseWordTimings((project.voice_result as { timing?: { words?: unknown } } | null)?.timing?.words);
  const { count: screenshots } = await admin.from("project_screenshots").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const input = { narration, words, duration_seconds: project.duration_seconds, product_name: (brief.success ? brief.data.product_name : project.brand_name?.trim()) || undefined, screenshots: screenshots ?? 0, creative_preferences: creativePreferences(project), never: await loadNeverList(admin), seed: seedFrom(projectId), taste: await loadTaste(admin) };
  console.info("flow director start:", { projectId, timing: words?.length ? "voice" : "estimated", words: words?.length ?? 0, screenshots: screenshots ?? 0 });
  const started = Date.now();
  // Director v2 (scenes of product UI) first; the pattern Director is the
  // fallback when no usable SceneScript comes back and time remains.
  let usage: BriefUsage | undefined;
  // Each job may use its own model (/admin/models): priced per call, and
  // recorded per Director (Composer, studio Story, old Shot/Scene/Flow).
  const ai = await getAiConfig();
  type Meter = { cost: number; models: Set<string>; input: number; output: number };
  const meters: Record<"composer" | "story" | "shot", Meter> = { composer: { cost: 0, models: new Set(), input: 0, output: 0 }, story: { cost: 0, models: new Set(), input: 0, output: 0 }, shot: { cost: 0, models: new Set(), input: 0, output: 0 } };
  const meterOf = (k: keyof typeof meters) => (u: BriefUsage) => {
    const m = meters[k];
    m.cost += usageCost(ai, u, (i, o) => openaiCost(u.model, i, o));
    if (u.inputTokens || u.outputTokens) m.models.add(u.model);
    m.input += u.inputTokens;
    m.output += u.outputTokens;
    usage = usage ? { ...u, inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens } : u;
  };
  const addUsage = meterOf("shot");
  // The clean film templates first (one quick call): the narration in seven
  // parts and the four videos to offer, never a set this customer already had
  // for the same script. The engines below still run (fallback).
  // The Composer when it is on for this customer; the studio's Story
  // Director only when it is off (or the Composer failed).
  const sixteen = project.format === "16:9" && !!words?.length;
  const composer = sixteen
    ? await composerSet(admin, projectId, userId, project, words!, narration, brief.success ? brief.data : null, meterOf("composer")).catch((e) => {
        console.warn("composer failed:", e instanceof Error ? e.message : e);
        return null;
      })
    : null;
  const clean = sixteen && !composer ? await cleanSet(admin, projectId, userId, project, words!, narration, brief.success ? brief.data : null, meterOf("story")) : null;
  // Shot templates first (lib/shots.ts): tested shots, the Director only picks
  // and fills them (four directions, else one — inside generateShotScript).
  // The free-form scene Director is the fallback only when no shots came back.
  // The old engines are only a fallback: with Composer or studio videos they
  // never show, so they are not run (or paid for).
  const skipOld = !!(clean || composer);
  if (skipOld) console.info("shot director: skipped (Composer/studio videos ready)", { projectId, composer: !!composer, studio: !!clean });
  const shot = skipOld ? { script: null, shots: null, variants: [], attempts: 0, ms: 0, errors: [] as string[], diagnostics: null, timing: null, violations: [] } as unknown as Awaited<ReturnType<typeof generateShotScript>> : await generateShotScript(input, addUsage, budgetMs);
  console.info("shot director:", { projectId, outcome: shot.script ? "stored" : "none", directions: shot.variants.map((v) => v.variant), attempts: shot.attempts, ms: shot.ms, shots: shot.shots?.shots.map((s) => `${s.shot}@${s.cue}`), creative: shot.shots?.creative, concepts: shot.shots?.concepts?.map((c) => `${c.cue} → ${c.hero}: ${c.see}`), problems: shot.errors.slice(0, 6) });
  const v2 = skipOld || shot.script || budgetMs - (Date.now() - started) < 60_000 ? shot : await generateSceneScript(input, addUsage, Math.min(budgetMs - (Date.now() - started), 130_000));
  console.info("scene director:", {
    projectId,
    outcome: v2.script ? "stored" : "none",
    timing: v2.timing,
    attempts: v2.attempts,
    ms: v2.ms,
    beats: v2.script?.beats.map((b) => `${b.action}@${b.cue}`),
    problems: v2.errors.slice(0, 6),
  });
  const left = budgetMs - (Date.now() - started);
  const fallback = !skipOld && !v2.script && left > 40_000;
  const result = fallback ? await generateFlowScript(input, addUsage, left) : { ...v2, script: null };
  if (!v2.script && !fallback) console.info("flow director: skipped (no time left)", { projectId, left });
  if (fallback)
    console.info("flow director:", {
      projectId,
      outcome: result.script ? "stored" : "none",
      timing: result.timing,
      attempts: result.attempts,
      ms: result.ms,
      beats: result.script?.beats.map((b) => `${b.action}@${b.cue}`),
      input_tokens: usage?.inputTokens,
      output_tokens: usage?.outputTokens,
      problems: result.errors.slice(0, 6),
    });
  // The chosen look fixes the palette: dark → midnight; light → never midnight.
  const look = input.creative_preferences.look as Look;
  if (v2.script) v2.script.theme = resolveTheme(v2.script.theme, look).theme;
  // Explainer pace unless the customer asked for more motion.
  if (v2.script) v2.script.pace = ["Dynamic", "High Energy"].includes(input.creative_preferences.motion_level) ? "lively" : "calm";
  // The videos the customer chooses between: one per creative direction.
  const variants = shot.script && v2 === shot ? shot.variants.map((v) => ({ ...v, scene: { ...v.scene, theme: v2.script!.theme, pace: v2.script!.pace } })) : [];
  const engine = v2.script ? { scene: v2.script, ...(shot.script ? { shots: shot.shots } : {}), ...(variants.length > 1 ? { variants } : {}) } : result.script ? { flow: result.script } : null;
  const stored = engine || clean || composer ? { ...(engine ?? {}), ...(clean ? { clean } : {}), ...(composer ? { composer } : {}) } : null;
  // What the Shot Director's search did with each direction (why one was
  // dropped, its DNA, its behaviors) and which build made it — kept even
  // when nothing usable came back.
  const diagnostics = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    at: new Date().toISOString(),
    engine: v2.script ? (v2 === shot ? "shots" : "scene") : result.script ? "flow" : null,
    director_ms: shot.ms,
    ...(shot.diagnostics ?? { mode: null, status: "failed", directions: [], output_tokens: null }),
    previews: variants.length > 1 ? variants.length : v2.script ? 1 : 0,
    problems: shot.errors.slice(0, 6),
  };
  {
    // The brief is written alongside (locked script): wait for it, so one
    // write never replaces the other. Then re-read; only these keys change.
    for (let k = 0; k < 60; k++) {
      const { data: b } = await admin.from("projects").select("brief_status").eq("id", projectId).single();
      if (b?.brief_status === "completed" || b?.brief_status === "failed") break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
    const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
    const current = (fresh?.brief ?? null) as { scene?: unknown; flow?: unknown } | null;
    if (!current?.flow && !current?.scene) {
      await admin.from("projects").update({ brief: { ...((fresh?.brief as object | null) ?? {}), ...(stored ?? {}), diagnostics } }).eq("id", projectId).eq("user_id", userId);
    }
  }
  // Direction library: what the Director made of the customer's direction.
  const script = v2.script ?? result.script;
  const attempts = v2.attempts + (v2.script ? 0 : result.attempts);
  await admin
    .from("direction_library")
    .update({
      narration,
      flow_script: script,
      outcome: { stored: !!script, engine: v2.script ? "scene" : result.script ? "flow" : null, attempts, problems: (v2.script ? v2.errors : [...v2.errors, ...result.errors]).slice(0, 8), theme: script?.theme ?? null, status: diagnostics.status, previews: diagnostics.previews, commit: diagnostics.commit },
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);
  // Rulebook: log what this video still breaks, so later videos are warned.
  if (v2.script && v2.violations.length) {
    const { error: mistakesError } = await admin.from("video_mistakes").insert(v2.violations.map((v) => ({ project_id: projectId, rule_id: v.rule, detail: v.detail.slice(0, 300) })));
    if (mistakesError) console.warn("video mistakes not logged:", mistakesError.message);
  }
  // One cost line per Director that ran (admin → Costs shows each).
  const KIND = { composer: "composer_director", story: "story_director", shot: "flow_director" } as const;
  for (const k of ["composer", "story", "shot"] as const) {
    const m = meters[k];
    if (!m.input && !m.output) continue;
    await recordCost(admin, {
      project_id: projectId,
      user_id: userId,
      operation: "openai_brief",
      model: [...m.models].join(", ") || usage?.model || "",
      quantity: m.input + m.output,
      estimated_cost_usd: m.cost,
      metadata: { kind: KIND[k], ...(k === "shot" ? { engine: v2.script ? "scene" : "flow", attempts, stored: !!script, timing: v2.timing } : {}), input_tokens: m.input, output_tokens: m.output, latency_ms: Date.now() - started },
    });
  }
}

async function generateStory(projectId: string, userId: string, budgetMs: number) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("brief, format, duration_seconds, direction, creative_direction, motion_level, visual_density, advanced_direction, target_audience, brand_name, voice_status, voice_result")
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
      estimated_cost_usd: usageCost(await getAiConfig(), usage, (i, o) => openaiCost(usage!.model, i, o)),
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
    .select("brief, brief_status, direction, advanced_direction, voice_language, voice_style, voice_gender, voice_result")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;

  const admin = createAdminClient();
  const voiceUpdate = (fields: Record<string, unknown>) =>
    admin.from("projects").update(fields).eq("id", projectId).eq("user_id", user.id);

  // A locked script is spoken as typed, so the voice need not wait for the brief.
  const script = project.brief_status === "completed" ? project.brief?.script : lockedScriptOf(project) || undefined;
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
    const ai = await getAiConfig();
    // Voice turned off on /admin/models: no audio, and the words timed at an
    // even reading pace (about 2.6 words a second) so the visuals still follow them.
    const silent = !ai.voice.on;
    const voiced = silent
      ? { model: "none", requestId: null, audioUrl: null, words: estimateWords(script, Math.max(4, script.split(/\s+/).filter(Boolean).length / 2.6) / 0.92), timestampsSample: undefined }
      : await generateFalVoice({
          script,
          language: project.voice_language,
          style: project.voice_style,
          gender: project.voice_gender,
          voice: voiceChoiceOf(project.direction),
        });
    const { model, requestId, audioUrl, timestampsSample } = voiced;
    let { words } = voiced;
    let timingSource: "provider" | "heard" | "estimated" = silent ? "estimated" : "provider";
    const owner = { project_id: projectId, user_id: user.id };
    // A voice without word times (most TTS models): Whisper hears them, else an
    // even reading pace. The studio films need word times to follow the voice.
    if (!words?.length && audioUrl) {
      try {
        const heard = await timeWords(audioUrl, script);
        if (heard) {
          words = heard.words;
          timingSource = "heard";
          await recordCost(admin, {
            ...owner,
            operation: "fal_voice",
            model: heard.model,
            quantity: Math.round(heard.seconds),
            estimated_cost_usd: unitCost(ai, heard.model, Math.max(1, heard.seconds), () => 0),
            metadata: { kind: "word_timing", unit: "audio seconds", request_id: heard.requestId },
          });
        }
      } catch (e) {
        console.warn("word timing failed:", projectId, e instanceof Error ? e.message.slice(0, 300) : e);
      }
      if (!words?.length) {
        words = estimateWords(script, Math.max(4, script.split(/\s+/).filter(Boolean).length / 2.6) / 0.92);
        timingSource = "estimated";
      }
    }
    let storagePath: string | undefined;
    if (audioUrl) {
      // Recorded as soon as Fal returns: the provider charges even if storing fails.
      // Voice is priced per script character; the stored file costs storage.
      await recordCost(admin, {
        ...owner,
        operation: "fal_voice",
        model,
        quantity: script.length,
        estimated_cost_usd: unitCost(ai, model, script.length, () => falCost(model, script.length)),
        metadata: { unit: "characters", request_id: requestId },
      });
      const stored = await storeVoiceAudio(admin, audioUrl, user.id, projectId);
      storagePath = stored.path;
      await recordCost(admin, {
        ...owner,
        operation: "storage",
        quantity: stored.bytes,
        estimated_cost_usd: storageCost(stored.bytes),
        metadata: { kind: "voice", unit: "bytes" },
      });
    }
    const previousPath = project.voice_result?.storagePath;
    if (previousPath && previousPath !== storagePath) {
      await admin.storage.from(AUDIO_BUCKET).remove([previousPath]);
    }
    // The video lasts exactly as long as the voice (plus the brand lockup):
    // the length comes from the last spoken word, and the storyboard's scene
    // timing is rescaled to it.
    const lastEnd = words?.length ? Math.max(...words.map((w) => w.end)) : null;
    const seconds = lastEnd ? voiceVideoSeconds(lastEnd) : null;
    // (re-read: a brief written alongside may have finished while the voice spoke)
    const { data: latest } = await admin.from("projects").select("brief").eq("id", projectId).single();
    const briefNow = (latest?.brief ?? project.brief) as object | null;
    const parsedBrief = ProductBrief.safeParse(briefNow);
    let rescaled: ReturnType<typeof fitDurations> | null = null;
    if (seconds && parsedBrief.success) {
      try {
        rescaled = fitDurations(parsedBrief.data, seconds);
      } catch {
        rescaled = null;
      }
    }
    // Only the permanent path is persisted, never the temporary provider URL.
    await voiceUpdate({
      ...(seconds && { duration_seconds: seconds }),
      ...(rescaled && { brief: { ...(briefNow as object), scenes: rescaled.scenes } }),
      voice_status: "completed",
      voice_error: null,
      // Word timing drives narration-synced motion; null = none available.
      voice_result: {
        model,
        requestId,
        ...(storagePath && { storagePath }),
        timing: words ? { source: timingSource, words } : null,
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
    // The customer's chosen visual style (appended to the direction) shapes image prompts.
    const manifest = buildAssetManifest(brief.data, paths, project.format, project.direction?.match(/Visual style:\s*(.+)\s*$/m)?.[1]);
    // Images turned off on /admin/models: no generated images are planned (the
    // scenes use screenshots, icons and shapes).
    if (!(await getAiConfig()).image.on) manifest.assets = manifest.assets.filter((a) => a.source !== "generated");
    await assetsUpdate({
      assets_status: "completed",
      assets_error: null,
      assets_manifest: manifest,
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

// 4K is a download option: renders a 4K copy next to the 1080p video.
export async function render4kVideo(projectId: string) {
  // Switched off from /admin/settings (admins can still test it).
  if ((await getSettings()).feature_4k === false) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user || !(await userAccess(supabase, data.user.id)).admin) return;
  }
  await startRender(projectId, "4k", false, true);
}

// Shared by the Render button (background) and the dev benchmark (awaited).
// Not exported, so clients can't trigger a blocking render. `fourK` renders
// the 4K download copy into its own fields, leaving the main video alone.
async function startRender(projectId: string, requested: string, wait: boolean, fourK = false) {
  const F = fourK
    ? ({ status: "render_4k_status", error: "render_4k_error", path: "video_4k_path", file: "final-4k.mp4" } as const)
    : ({ status: "render_status", error: "render_error", path: "video_path", file: "final.mp4" } as const);
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
      [F.status]: "failed",
      [F.error]: `Validation failed: ${problems.join(" ")}`.slice(0, 500),
    }).neq(F.status, "processing");
    revalidatePath(`/projects/${projectId}`);
    return;
  }
  const resolution = requested as Resolution;

  // Vercel Functions have no Chrome for Remotion; stop cleanly instead of
  // attempting (or faking) a render. Rendering runs on a dedicated worker later.
  if (process.env.VERCEL) {
    await renderUpdate({
      [F.status]: "failed",
      [F.error]: RENDER_WORKER_MESSAGE,
    }).neq(F.status, "processing");
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  const staleBefore = new Date(Date.now() - STALE_RENDER_MS).toISOString();
  const { data: claimed } = await renderUpdate(fourK ? { [F.status]: "processing", [F.error]: null } : { render_status: "processing", render_error: null, status: "processing", resolution })
    .or(`${F.status}.neq.processing,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return;

  // Rendering takes minutes; finish after responding. Page shows progress on refresh.
  const props = input.props;
  const job = async () => {
    try {
      const started = Date.now();
      const mp4 = await renderStoryboardMp4(props, resolution);
      const renderMs = Date.now() - started;
      const videoPath = `${user.id}/${projectId}/${F.file}`;
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
        [F.status]: "completed",
        [F.error]: null,
        [F.path]: videoPath,
        ...(fourK ? {} : { status: "completed" }),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message.split("\n")[0] : "Render failed.";
      await renderUpdate({
        [F.status]: "failed",
        [F.error]: message.slice(0, 500),
        ...(fourK ? {} : { status: "failed" }),
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
async function fitBriefToVoice(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data } = await admin.from("projects").select("brief, duration_seconds, voice_status").eq("id", projectId).single();
  const brief = ProductBrief.safeParse(data?.brief);
  if (!data || data.voice_status !== "completed" || !brief.success || !data.duration_seconds) return;
  const total = brief.data.scenes.reduce((n, sc) => n + sc.duration_seconds, 0);
  if (Math.abs(total - data.duration_seconds) < 0.01) return;
  try {
    const fitted = fitDurations(brief.data, data.duration_seconds);
    await admin.from("projects").update({ brief: { ...(data.brief as object), scenes: fitted.scenes } }).eq("id", projectId);
  } catch (e) {
    console.warn("brief not fitted to the voice:", projectId, e instanceof Error ? e.message : e);
  }
}

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
    // ("AI only for the voice": nothing writes a script, so the customer's own is needed)
    if (!(await getAiConfig()).tasks.brief.on && !lockedVoiceScript(own?.direction)) {
      return void (await fail(OWN_SCRIPT_MESSAGE, "needs_input"));
    }

    // 2. Product brief + script. A locked script (the customer's own words)
    // needs no brief for the voice or the Shot Director, so the brief is
    // written alongside them instead of before them: the Director gets the
    // time the brief used to take (it took 80–150 s and left the Director
    // too little to finish).
    await enter("writing");
    let p = await state();
    const { data: own2 } = await admin.from("projects").select("direction, advanced_direction").eq("id", projectId).single();
    const alongside = !!own2 && !!lockedScriptOf(own2) && !storyEngineEnabled();
    const briefRun = p.brief_status !== "completed" ? attempt(() => generateBrief(projectId)) : null;
    const briefDone = async () => {
      if (briefRun) await briefRun;
      p = await state();
      return p.brief_status === "completed";
    };
    if (!alongside && !(await briefDone())) return void (await fail(p.brief_error ?? "Brief failed."));

    // 3. Voice: one track for the locked script, with word timestamps.
    await enter("voice");
    if (p.voice_status !== "completed") {
      await attempt(() => generateVoice(projectId));
      p = await state();
      if (p.voice_status !== "completed") {
        if (briefRun) await briefRun;
        return void (await fail(p.voice_error ?? "Voice failed."));
      }
    }

    // Preview-only: the Visual Director starts only after the voice exists
    // (its words are the timeline); it runs alongside the visuals step.
    const budget = PIPELINE_BUDGET_MS - (Date.now() - pipelineStarted);
    const story =
      storyEngineEnabled() && budget > 45_000
        ? attempt(() => generateStory(projectId, userId, Math.min(110_000, budget - 30_000)))
        : flowEngineEnabled() && budget > 45_000
          ? attempt(() => generateFlow(projectId, userId, flowBudgetMs(Date.now() - pipelineStarted)))
          : null;
    // The brief (written alongside) must be done before the visuals step.
    if (alongside && !(await briefDone())) {
      if (story) await story;
      return void (await fail(p.brief_error ?? "Brief failed."));
    }

    // The brief and the voice may each have finished before the other (a slow
    // voice model): the storyboard always lasts as long as the voice.
    await fitBriefToVoice(admin, projectId);

    // 4. Visual asset manifest, then generated assets.
    await enter("visuals");
    if (p.assets_status !== "completed" || !p.assets_manifest) {
      await attempt(() => prepareAssets(projectId));
    }
    p = await state();
    // With the story engine on, wait for the Visual Director first: a usable
    // story renders with StoryWorld, which never shows the legacy images.
    let usable: VisualStory | FlowScript | SceneScript | null = null;
    if (story) {
      await story;
      const { data: row } = await admin.from("projects").select("brief, format, duration_seconds, voice_result").eq("id", projectId).single();
      const brief = ProductBrief.safeParse(row?.brief);
      const words = parseWordTimings((row?.voice_result as { timing?: { words?: unknown } } | null)?.timing?.words);
      usable = brief.success && row ? (usableStory(brief.data.story, brief.data.script, row.format) ?? usableScene(brief.data.scene, brief.data.script, row.format, words, row.duration_seconds) ?? usableFlow(brief.data.flow, brief.data.script, row.format, words, row.duration_seconds)) : null;
    }
    if (p.assets_status === "completed" && needsLegacyImages(p.assets_manifest as AssetManifest | null, usable)) {
      await attempt(() => generateVisualAssets(projectId));
      p = await state();
    }
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
    .select("pipeline_status, pipeline_step, direction, advanced_direction")
    .eq("id", projectId)
    .maybeSingle();
  // Failed runs resume; projects created before the pipeline existed can start.
  if (!project || !["failed", "idle"].includes(project.pipeline_status)) return;

  if (project.pipeline_step === "validating") {
    // The customer's own script never changes, so its voice is kept (it was
    // paid for); only the brief and visuals are made again.
    const locked = !!lockedScriptOf(project);
    await createAdminClient()
      .from("projects")
      .update({ brief_status: "none", ...(locked ? {} : { voice_status: "none" }), assets_status: "none", assets_manifest: null })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }
  if (await claimPipeline(projectId, user.id)) after(() => runPipeline(projectId, user.id));
  revalidatePath(`/projects/${projectId}`);
}

// Four new clean videos for the same script and voice: the current four join
// the history and a new set unlike every earlier one is offered.
export async function newCleanSet(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase.from("projects").select("brief, brand_color").eq("id", projectId).maybeSingle();
  const brief = ProductBrief.safeParse(project?.brief);
  const clean = brief.success ? brief.data.clean : null;
  if (!project || !clean) return;
  const history = [...clean.history, clean.variants];
  // the same story shapes, the openings shown least so far first
  const shapes = (clean.stories ?? []).map((st) => String((st as { shape?: unknown }).shape ?? ""));
  const variants = studioVariants(seedFrom(projectId), history, 4, { shapes, exclude: literalMisfits(`${brief.success ? brief.data.script : ""} ${brief.success ? brief.data.product_summary : ""}`) });
  await createAdminClient()
    .from("projects")
    .update({ brief: { ...(project.brief as object), clean: { ...clean, variants, history, at: new Date().toISOString() } } })
    .eq("id", projectId)
    .eq("user_id", user.id);
  revalidatePath(`/projects/${projectId}`);
}

// "Change it": the customer's direction (up to 1000 words) revises the
// Composer video; the voice and script stay. Each change is a new version
// (the earlier ones are kept); three changes per video. Returns a message
// for the form.
export async function changeComposerVideo(projectId: string, direction: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const text = String(direction ?? "").trim();
  const count = text.split(/\s+/).filter(Boolean).length;
  const ai = await getAiConfig();
  // ("AI only for the voice": nothing reads a written direction — a change is a new version, composed by rule)
  const byRule = ai.engine.voiceOnly;
  if (!text && !byRule) return { ok: false, message: "Write what you want changed." };
  if (count > CHANGE_WORDS) return { ok: false, message: `Keep it to ${CHANGE_WORDS} words (now ${count}).` };
  const admin = createAdminClient();
  if (!(await composerOn(admin, user.id))) return { ok: false, message: "Changes are not available yet." };
  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase.from("projects").select("brief, brand_name, brand_color, call_to_action, website_url, duration_seconds, voice_result").eq("id", projectId).maybeSingle();
  const raw = (project?.brief ?? null) as { composer?: { videos: StoredComposition[]; indexing?: "script"; changes?: { direction: string; at: string; ok: boolean }[] }; product_name?: string; product_summary?: string; cta?: string; script?: string } | null;
  const composer = raw?.composer;
  const voice = parseWordTimings((project?.voice_result as { timing?: { words?: unknown } } | null)?.timing?.words);
  // the words its versions are written on (older videos: the voice's own pieces)
  const words = voice && composer?.indexing === "script" ? scriptWords(raw?.script, voice) : voice;
  if (!project || !composer?.videos?.length || !words?.length) return { ok: false, message: "This video can't be changed." };
  const done = (composer.changes ?? []).filter((c) => c.ok).length;
  if (done >= COMPOSER_CHANGES) return { ok: false, message: `All ${COMPOSER_CHANGES} changes for this video are used.` };
  const current = composer.videos[composer.videos.length - 1];
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const brand = { name: project.brand_name?.trim() || raw?.product_name || "Your product", color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || raw?.cta || "Get started", url: host, icon: null };
  let usage: BriefUsage | null = null;
  const result = byRule ? { ideas: null, ms: 0, problems: [] as string[] } : await reviseComposerPlan({ words, brand, product: raw?.product_summary ?? null, plan: ideasOf(current.script), direction: text }, (u) => (usage = u));
  const seed = (current.seed + 7919) >>> 0;
  const set = result.ideas || byRule ? composeVariants({ words, brand, duration: Math.round(project.duration_seconds * 30), seed, ideas: result.ideas ?? undefined, count: 1, avoidStaging: composer.videos.map((v) => v.staging ?? null) }) : null;
  const video = set?.videos[0] && (byRule || set.videos[0].source === "director") ? set.videos[0] : null;
  const changes = [...(composer.changes ?? []), { direction: text.slice(0, 9000), at: new Date().toISOString(), ok: !!video }];
  await admin
    .from("projects")
    .update({ brief: { ...(project.brief as object), composer: { ...composer, videos: video ? [...composer.videos, video] : composer.videos, changes } } })
    .eq("id", projectId)
    .eq("user_id", user.id);
  const u = usage as BriefUsage | null;
  if (u && (u.inputTokens || u.outputTokens)) {
    await recordCost(admin, { project_id: projectId, user_id: user.id, operation: "openai_brief", model: u.model, quantity: u.inputTokens + u.outputTokens, estimated_cost_usd: usageCost(ai, u, (i, o) => openaiCost(u.model, i, o)), metadata: { kind: "composer_change", input_tokens: u.inputTokens, output_tokens: u.outputTokens, words: count, ok: !!video } });
  }
  console.info("composer change:", { projectId, ok: !!video, ms: result.ms, words: count, problems: [...result.problems, ...(set?.problems ?? [])].slice(0, 8) });
  revalidatePath(`/projects/${projectId}`);
  if (!video) return { ok: false, message: "The change didn't work this time — your video is as it was, and no change was used. Try again or say it differently." };
  return { ok: true, message: `Done — version ${composer.videos.length + 1}. ${COMPOSER_CHANGES - done - 1} change${COMPOSER_CHANGES - done - 1 === 1 ? "" : "s"} left.` };
}

// A video the customer downloaded (of the ones offered): kept on the project
// as the taste the next videos learn from (loadTaste). Never fails the download.
export async function recordVariantDownload(projectId: string, seed: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const admin = createAdminClient();
    const { data: project } = await admin.from("projects").select("brief").eq("id", projectId).eq("user_id", user.id).maybeSingle();
    const brief = ProductBrief.safeParse(project?.brief);
    if (!project || !brief.success) return;
    const variant = brief.data.variants?.find((v) => v.seed === seed);
    if (!variant) return;
    const downloads = [...(brief.data.taste?.downloads ?? []), downloadEntry(variant, new Date().toISOString())];
    await admin.from("projects").update({ brief: { ...(project.brief as object), taste: { downloads } } }).eq("id", projectId).eq("user_id", user.id);
  } catch (e) {
    console.warn("variant download not recorded:", e instanceof Error ? e.message : e);
  }
}
