"use server";

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
  VOICE_SCRIPT_MAX,
  voiceVideoSeconds,
  FORMATS,
  MOTION_LEVELS,
  SCREENSHOT_TYPES,
  SCREENSHOTS_BUCKET,
  VISUAL_DENSITIES,
  VOICE_LANGUAGES,
  VOICE_GENDERS,
  VOICE_STYLES,
  lockBriefScript,
  lockedScriptOf,
  lockedVoiceScript,
  seedFrom,
  voiceChoiceOf,
  withVoiceChoice,
  logoPath,
  parseHttpUrl,
  validateLogo,
} from "@/lib/projects";
import { runWebsiteCapture } from "@/lib/website-capture";
import { type BriefUsage, ProductBrief, generateProductBrief } from "@/lib/ai/product-brief";
import { falCost, openaiCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { getAiConfig, unitCost, usageCost } from "@/lib/ai/models";
import { COMPOSE_MESSAGE, NEEDS_SCREENSHOTS_MESSAGE, OWN_SCRIPT_MESSAGE, type PipelineStep } from "@/lib/pipeline";
import { generateVoice as generateFalVoice, timeWords } from "@/lib/ai/fal";
import { estimateWords, parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { type MotionInput, type MotionResult, directMotion, reviewMotion } from "@/lib/ai/motion-director";
import { ruleBrief } from "@/lib/rule-brief";
import { detailsFrom, parseDetails } from "@/lib/project-details";
import { scorePlan } from "@/components/video/composer/score";
import { type BrandProfile, type CreativePlan } from "@/lib/studio";
import { frameOf } from "@/components/video/composer/frame";
import { type StoredComposition, composeVariants } from "@/components/video/composer/variants";
import { scriptWords } from "@/components/video/composer/words";
import { neverList } from "@/lib/video-rules";
import { AUDIO_BUCKET, storeVoiceAudio } from "@/lib/voice-audio";
import { userAccess } from "@/lib/admin";
import { getSettings } from "@/lib/app-settings";
import { checkProjectFrames, prepareFrameCheck } from "@/lib/frame-check";

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
  // every answer is required (the Director builds on them)
  if (!brandName) return { error: "Your company name is required." };
  if (!targetAudience) return { error: "Say who the video is for." };
  if (!callToAction) return { error: "The call to action is required." };
  if (!websiteUrl) return { error: "Your website is required." };
  const { details, error: detailsError } = detailsFrom(formData);
  if (!details) return { error: detailsError ?? "Please answer every question." };
  if (!duration || !format || !voiceLanguage || !voiceStyle)
    return { error: "Please choose a valid option for every field." };
  if (websiteUrl && !parseHttpUrl(websiteUrl))
    return { error: "Website URL must be a valid http:// or https:// address." };

  // The logo (the icon) is required.
  const logoEntry = formData.get("logo");
  const logo = logoEntry instanceof File ? logoEntry : null;
  const logoError = validateLogo(logo);
  if (logoError) return { error: logoError };

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
      details,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const logoAt = logoPath(user.id, data.id, SCREENSHOT_TYPES[logo!.type]);
  const logoUpload = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(logoAt, logo!, { contentType: logo!.type });
  if (logoUpload.error) {
    await supabase.from("projects").delete().eq("id", data.id);
    return { error: "Icon upload failed. Please try again." };
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
      screenshot_count: 0,
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
    // (the Composer's video may already be stored: it is kept)
    const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
    const composer = (fresh?.brief as { composer?: unknown } | null)?.composer;
    const next = ruleBrief({ script, productName: project.brand_name, summary: capture?.meta_description, cta: project.call_to_action });
    await briefUpdate({ brief: { ...next, ...(composer ? { composer } : {}) }, brief_status: "completed", brief_error: null });
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
    // (projects from before screenshots were dropped keep what was read from them)
    const evidence = project.screenshot_evidence as Parameters<typeof generateProductBrief>[0]["screenshot_evidence"] | null;

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
        screenshot_evidence: evidence ?? undefined,
        direction: project.direction,
        duration_seconds: project.duration_seconds,
        voice_language: project.voice_language,
        voice_style: project.voice_style,
        target_audience: project.target_audience || undefined,
        brand_name: project.brand_name || undefined,
      },
      (u) => (usage = u),
    );
    // The customer's script is the narration, word for word (lockBriefScript):
    // the brief model never rewrites what the voice says. With a locked script
    // the voice runs alongside the brief: the Composer's video, if already
    // stored, is kept.
    const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
    const composer = (fresh?.brief as { composer?: unknown } | null)?.composer;
    const next = lockBriefScript(brief, project);
    await briefUpdate({ brief: { ...next, ...(composer ? { composer } : {}) }, brief_status: "completed", brief_error: null });
  } catch (e) {
    console.error("brief generation failed:", projectId, e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e);
    await fail((e instanceof Error ? e.message : "Brief generation failed.").slice(0, 500));
  } finally {
    const ai = await getAiConfig();
    for (const [u, kind] of [[usage, "brief"]] as const) {
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

// The Director's NEVER list: built-in rules plus the active `video_rules`
// rows (admin → Video rules). Never blocks a video.
async function loadNeverList(admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data } = await admin.from("video_rules").select("id, never").eq("active", true).limit(50);
    return neverList(data ?? []);
  } catch {
    return neverList();
  }
}


// What the Motion Director is given: the brand, the script, the website, and
// what this customer has had before (the next video is unlike those).
type Past = { seen: { display: string[]; field: string[] }; seenStaging: (NonNullable<StoredComposition["staging"]> | null)[]; recent: { staging: NonNullable<StoredComposition["staging"]> | null; display: string | null }[] };
type MotionDirection = { input: MotionInput; result: MotionResult; past: Past; usage: BriefUsage[] };

async function pastOf(admin: ReturnType<typeof createAdminClient>, projectId: string, userId: string, name: string) {
  const { data: past } = await admin.from("projects").select("brand_name, composer:brief->composer").eq("user_id", userId).neq("id", projectId).order("created_at", { ascending: false }).limit(20);
  const rows = (past ?? []).map((p) => ({ brand: (p.brand_name ?? "").trim().toLowerCase(), composer: p.composer as { profile?: BrandProfile; creative?: CreativePlan; videos?: StoredComposition[] } | null }));
  const same = rows.filter((p) => p.brand === name.toLowerCase());
  const known = same.map((p) => p.composer?.profile).find((x): x is BrandProfile => !!x?.category) ?? null;
  const earlier = same.flatMap((p) => (p.composer?.creative ? [{ idea: p.composer.creative.idea, language: p.composer.videos?.at(-1)?.staging?.language ?? p.composer.creative.language }] : [])).slice(0, 6);
  const pastVideos = rows.slice(0, 12).flatMap((p) => p.composer?.videos ?? []);
  const seenArts = pastVideos.map((v) => (v.script as { art?: { display?: string; field?: string } } | undefined)?.art ?? {});
  const seen = { display: [...new Set(seenArts.map((x) => x.display).filter((x): x is string => !!x))].slice(0, 12), field: [...new Set(seenArts.map((x) => x.field).filter((x): x is string => !!x))].slice(0, 6) };
  // how this customer's last videos were staged (the next is staged otherwise)
  const seenStaging = pastVideos.map((v) => v.staging ?? null).slice(0, 8).reverse();
  const recent = pastVideos.slice(0, 8).map((v) => ({ staging: v.staging ?? null, display: (v.script as { art?: { display?: string } } | undefined)?.art?.display ?? null }));
  return { known, earlier, past: { seen, seenStaging, recent } };
}

const brandOf = (project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null }, brief: { product_name?: string; cta?: string } | null) => {
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  return { name: project.brand_name?.trim() || brief?.product_name || "Your product", color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || brief?.cta || "Get started", url: host, icon: null };
};

// The Motion Director plans the whole video from the script: it needs no
// voice, so it works while the voice is made.
async function motionDirection(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  userId: string,
  project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null; details?: unknown; target_audience?: string | null },
  narration: string,
  brief: { product_name?: string; product_summary?: string; cta?: string } | null,
): Promise<MotionDirection> {
  const usage: BriefUsage[] = [];
  const details = parseDetails(project.details);
  const brand = brandOf(project, brief);
  const [{ known, earlier, past }, { data: capture }, never] = await Promise.all([
    pastOf(admin, projectId, userId, brand.name),
    admin.from("website_captures").select("url, title, meta_description, visible_text").eq("project_id", projectId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadNeverList(admin),
  ]);
  // the script's own words (the same split the voice's words are put on), at a reading pace
  const words = narration.split(/\s+/).filter(Boolean).map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
  const input: MotionInput = {
    name: brand.name,
    color: brand.color,
    cta: brand.cta,
    url: brand.url,
    product: brief?.product_summary ?? null,
    words,
    website: capture ? { url: capture.url, title: capture.title, description: capture.meta_description, text: capture.visible_text } : null,
    seen: past.seen,
    earlier,
    known,
    never,
    // the customer's own answers (the form), taken as facts
    category: details?.category ?? null,
    customer: details ? { audience: project.target_audience?.trim() ?? "", features: details.features, before: details.before, mood: details.mood, use: details.use } : null,
    seed: seedFrom(projectId),
  };
  const result = await directMotion(input, (u) => usage.push(u));
  console.info("motion director:", { projectId, source: result.plan.source, ms: result.ms, category: result.plan.profile.category, mood: result.plan.profile.mood, idea: result.plan.creative.idea, language: result.plan.creative.language, scheme: result.plan.creative.scheme, scenes: result.plan.ideas?.scenes.length ?? 0, problems: result.problems.slice(0, 6) });
  return { input, result, past, usage };
}

// The video, once the voice is timed: the Motion Director reviews its plan on
// the voice's times (with what our layout check found), and the video is
// built from it. Its video is the video; the Composer composes by rule only
// when there is no plan or the plan does not lay out.
async function composerSet(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  userId: string,
  project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null; details?: unknown; target_audience?: string | null; duration_seconds: number; format: string },
  voice: WordTiming[],
  narration: string,
  brief: { product_name?: string; product_summary?: string; cta?: string } | null,
  addUsage: (u: BriefUsage) => void,
  direction?: Promise<MotionDirection | null> | null,
) {
  // the script's own words on the voice's times (never pieces of words)
  const words = scriptWords(narration, voice);
  const brand = brandOf(project, brief);
  const dir = (await direction?.catch(() => null)) ?? (await motionDirection(admin, projectId, userId, project, narration, brief));
  dir.usage.forEach(addUsage);
  const input: MotionInput = { ...dir.input, words, name: brand.name, cta: brand.cta, url: brand.url, product: brief?.product_summary ?? dir.input.product };
  const reviewed = await reviewMotion(dir.result.plan, input, addUsage);
  const plan = reviewed.plan;
  const { count: screens } = await admin.from("project_screenshots").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const { seen, seenStaging, recent } = dir.past;
  const set = composeVariants({ words, brand, duration: Math.round(project.duration_seconds * 30), seed: seedFrom(projectId), ideas: plan.ideas, count: 1, avoid: { display: seen.display, field: seen.field.slice(0, 3) }, screens: screens ?? 0, avoidStaging: seenStaging, creative: plan.creative, look: { scheme: plan.profile.look.scheme, energy: plan.profile.look.energy }, size: frameOf(project.format) });
  const video = set.videos[0];
  // the code's own check of what was built (shown in the studio; it picks nothing)
  const score = scorePlan(set.plans[0], video.script, { staging: video.staging, motif: plan.creative.motif, heroScene: video.staging?.hero ?? null, recent, problems: set.problems.length });
  const problems = [...dir.result.problems, ...reviewed.problems, ...set.problems].slice(0, 20);
  console.info("composer:", { projectId, director: plan.source, built: video.source, review_ms: reviewed.ms, scenes: plan.ideas?.scenes.length ?? 0, score: score.total, problems: problems.slice(0, 8) });
  return {
    videos: [video],
    indexing: "script" as const,
    source: plan.source,
    profile: plan.profile,
    creative: plan.creative,
    score: { total: score.total, notes: score.notes.slice(0, 6), built: video.source },
    changes: [] as { direction: string; at: string; ok: boolean }[],
    problems,
    at: new Date().toISOString(),
  };
}

// The Composer's video for the project, after the voice: the Motion
// Director's plan (started alongside the voice), its review, the video
// (composerSet). Stored on the brief (brief.composer). True when stored.
async function generateComposer(projectId: string, userId: string, direction?: Promise<MotionDirection | null> | null): Promise<boolean> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("brief, format, duration_seconds, direction, advanced_direction, brand_name, brand_color, call_to_action, website_url, details, target_audience, voice_status, voice_result")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!project) return false;
  if ((project.brief as { composer?: unknown } | null)?.composer) return true;
  const brief = ProductBrief.safeParse(project.brief);
  // (with a locked script this runs while the brief is still being written)
  const narration = brief.success ? brief.data.script : lockedScriptOf(project);
  const words = parseWordTimings((project.voice_result as { timing?: { words?: unknown } } | null)?.timing?.words);
  if (project.voice_status !== "completed" || !narration || !words?.length) return false;
  const started = Date.now();
  // The Motion Director's model (/admin/models): priced per call.
  const ai = await getAiConfig();
  const meter = { cost: 0, models: new Set<string>(), input: 0, output: 0 };
  const addUsage = (u: BriefUsage) => {
    meter.cost += usageCost(ai, u, (i, o) => openaiCost(u.model, i, o));
    if (u.inputTokens || u.outputTokens) meter.models.add(u.model);
    meter.input += u.inputTokens;
    meter.output += u.outputTokens;
  };
  const composer = await composerSet(admin, projectId, userId, project, words, narration, brief.success ? brief.data : null, addUsage, direction).catch((e) => {
    console.warn("composer failed:", e instanceof Error ? e.message : e);
    return null;
  });
  if (composer) {
    // The brief is written alongside (locked script): wait for it, so one
    // write never replaces the other. Then re-read; only `composer` changes.
    for (let k = 0; k < 60; k++) {
      const { data: b } = await admin.from("projects").select("brief_status").eq("id", projectId).single();
      if (b?.brief_status === "completed" || b?.brief_status === "failed") break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
    const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
    await admin.from("projects").update({ brief: { ...((fresh?.brief as object | null) ?? {}), composer } }).eq("id", projectId).eq("user_id", userId);
  }
  // Direction library: what the Directors made of the customer's script.
  await admin
    .from("direction_library")
    .update({ narration, outcome: { stored: !!composer, engine: "composer", language: composer?.videos[0]?.staging?.language ?? "cuts", problems: composer?.problems.slice(0, 8) ?? [] }, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (meter.input || meter.output) {
    await recordCost(admin, {
      project_id: projectId,
      user_id: userId,
      operation: "openai_brief",
      model: [...meter.models].join(", "),
      quantity: meter.input + meter.output,
      estimated_cost_usd: meter.cost,
      metadata: { kind: "motion_director", input_tokens: meter.input, output_tokens: meter.output, latency_ms: Date.now() - started },
    });
  }
  return !!composer;
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
    // The video lasts exactly as long as the voice (plus the brand's close):
    // the length comes from the last spoken word.
    const lastEnd = words?.length ? Math.max(...words.map((w) => w.end)) : null;
    const seconds = lastEnd ? voiceVideoSeconds(lastEnd) : null;
    // Only the permanent path is persisted, never the temporary provider URL.
    await voiceUpdate({
      ...(seconds && { duration_seconds: seconds }),
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
 * Runs every generation step in order, reusing the individual step actions:
 * the website, the brief, the voice, the Composer's video, the frame check
 * (lib/frame-check). Completed steps
 * are skipped, so a retry resumes where the last run stopped. Never throws;
 * the outcome is stored on the project. The video is played and downloaded
 * in the browser (composer-studio.tsx): there is no server render.
 */
async function runPipeline(projectId: string, userId: string) {
  // (the function this runs in stops at 300 s: the frame check gets what is left)
  const started = Date.now();
  const left = () => 285_000 - (Date.now() - started);
  const admin = createAdminClient();
  // the frame check's sandbox, got ready while the video is made
  const checking = (await getSettings()).feature_frame_check !== false;
  const ready = checking ? prepareFrameCheck(240_000) : null;
  const setPipeline = (fields: Record<string, unknown>) => admin.from("projects").update(fields).eq("id", projectId).eq("user_id", userId);
  const state = async () => (await admin.from("projects").select("brief_status, brief_error, voice_status, voice_error").eq("id", projectId).single()).data!;
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
  const fail = (message: string, status = "failed") => setPipeline({ pipeline_status: status, pipeline_step: step, pipeline_error: message.slice(0, 500) });

  try {
    // 1. Website capture (pending captures only) and source check.
    await enter("analyzing");
    const supabase = await createClient();
    const { data: pending } = await supabase.from("website_captures").select("id, url").eq("project_id", projectId).eq("status", "pending");
    for (const c of pending ?? []) await runWebsiteCapture(supabase, { id: c.id, userId, projectId, url: c.url });
    const [{ count: captured }, { count: shots }] = await Promise.all([
      supabase.from("website_captures").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "completed"),
      supabase.from("project_screenshots").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    ]);
    // Sources: captured website, screenshots, or the customer's own script.
    // Never generate from the URL alone: that would mean inventing the product.
    const { data: own } = await supabase.from("projects").select("direction").eq("id", projectId).single();
    if (!captured && !shots && !own?.direction?.trim()) return void (await fail(NEEDS_SCREENSHOTS_MESSAGE, "needs_input"));
    // ("AI only for the voice": nothing writes a script, so the customer's own is needed)
    if (!(await getAiConfig()).tasks.brief.on && !lockedVoiceScript(own?.direction)) return void (await fail(OWN_SCRIPT_MESSAGE, "needs_input"));

    // 2. The brief. A locked script (the customer's own words) needs no brief
    // for the voice or the Directors, so it is written alongside them.
    await enter("writing");
    let p = await state();
    const { data: row } = await admin.from("projects").select("brief, format, direction, advanced_direction, brand_name, brand_color, call_to_action, website_url, details, target_audience").eq("id", projectId).single();
    const alongside = !!row && !!lockedScriptOf(row);
    const briefRun = p.brief_status !== "completed" ? attempt(() => generateBrief(projectId)) : null;
    const briefDone = async () => {
      if (briefRun) await briefRun;
      p = await state();
      return p.brief_status === "completed";
    };
    if (!alongside && !(await briefDone())) return void (await fail(p.brief_error ?? "Brief failed."));

    // The Motion Director needs only the script: it plans while the voice is made.
    const { data: now } = await admin.from("projects").select("brief, direction, advanced_direction").eq("id", projectId).single();
    const b = ProductBrief.safeParse(now?.brief);
    const script = b.success ? b.data.script : now ? lockedScriptOf(now) : "";
    const direction: Promise<MotionDirection | null> | null = row && script ? motionDirection(admin, projectId, userId, row, script, b.success ? b.data : null).catch((e) => (console.warn("motion director failed:", e instanceof Error ? e.message : e), null)) : null;

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

    // 4. The Composer's video (the brief, written alongside, must be done too).
    await enter("visuals");
    const composed = generateComposer(projectId, userId, direction);
    if (alongside && !(await briefDone())) {
      await composed.catch(() => false);
      return void (await fail(p.brief_error ?? "Brief failed."));
    }
    if (!(await composed.catch(() => false))) return void (await fail(COMPOSE_MESSAGE));
    // 5. The frame check: the video opened and checked frame by frame
    // before it is shown (what it finds is kept for the team; it never stops the video).
    if (checking) {
      await enter("validating");
      await ready;
      await checkProjectFrames(projectId, left()).catch((e) => console.warn("frame check failed:", e instanceof Error ? e.message : e));
    }
    await setPipeline({ pipeline_status: "completed", pipeline_step: null, pipeline_error: null, status: "completed" });
  } catch (e) {
    await fail(e instanceof Error ? e.message : "Generation failed.");
  }
}

// Retries the pipeline from the failed step (the steps already done are kept).
export async function retryPipeline(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase.from("projects").select("pipeline_status").eq("id", projectId).maybeSingle();
  // Failed runs resume; projects created before the pipeline existed can start.
  if (!project || !["failed", "idle"].includes(project.pipeline_status)) return;
  if (await claimPipeline(projectId, user.id)) after(() => runPipeline(projectId, user.id));
  revalidatePath(`/projects/${projectId}`);
}

