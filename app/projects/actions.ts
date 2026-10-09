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
  validateScreenshots,
  VERCEL_SCREENSHOT_TOTAL_BYTES,
} from "@/lib/projects";
import { runWebsiteCapture } from "@/lib/website-capture";
import { type BriefUsage, ProductBrief, generateProductBrief } from "@/lib/ai/product-brief";
import { type ScreenshotEvidence, analyzeScreenshots } from "@/lib/ai/screenshot-evidence";
import { falCost, openaiCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { getAiConfig, unitCost, usageCost } from "@/lib/ai/models";
import { COMPOSE_MESSAGE, NEEDS_SCREENSHOTS_MESSAGE, OWN_SCRIPT_MESSAGE, type PipelineStep } from "@/lib/pipeline";
import { generateVoice as generateFalVoice, timeWords } from "@/lib/ai/fal";
import { estimateWords, parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { generateComposerIdeas, ideasOf, reviseComposerPlan } from "@/lib/ai/composer-director";
import { ruleBrief } from "@/lib/rule-brief";
import { analyzeBrand } from "@/lib/ai/brand-analyst";
import { directCreative } from "@/lib/ai/creative-director";
import { judge } from "@/lib/ai/judge";
import { scorePlan } from "@/components/video/composer/score";
import { pickLanguage, type BrandProfile, type CreativePlan } from "@/lib/studio";
import { frameOf } from "@/components/video/composer/frame";
import { CHANGE_WORDS, COMPOSER_CHANGES } from "@/components/video/composer/types";
import { type StoredComposition, composeVariants } from "@/components/video/composer/variants";
import { scriptWords } from "@/components/video/composer/words";
import { neverList } from "@/lib/video-rules";
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


// The studio's first two Directors (before the voice is even ready): the
// Brand Analyst writes the brand's profile — reused for the brand's later
// videos — and the Creative Director the video's idea, motif, hero moment and
// one camera language, unlike the brand's earlier videos. By rule when their
// AI is off. Usage is handed on (the Composer's meter counts it).
type StudioDirection = { profile: BrandProfile; creative: CreativePlan; problems: string[]; ms: number; usage: BriefUsage[] };
async function studioDirection(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  userId: string,
  project: { brand_name?: string | null; brand_color?: string | null; website_url?: string | null },
  narration: string,
): Promise<StudioDirection> {
  const t0 = Date.now();
  const usage: BriefUsage[] = [];
  const name = project.brand_name?.trim() || "Your product";
  const { data: past } = await admin.from("projects").select("brand_name, composer:brief->composer").eq("user_id", userId).neq("id", projectId).order("created_at", { ascending: false }).limit(20);
  const same = (past ?? []).filter((p) => (p.brand_name ?? "").trim().toLowerCase() === name.toLowerCase());
  const known = same.map((p) => (p.composer as { profile?: BrandProfile } | null)?.profile).find((x): x is BrandProfile => !!x?.category);
  const earlier = same
    .flatMap((p) => {
      const c = p.composer as { creative?: CreativePlan; videos?: StoredComposition[] } | null;
      return c?.creative ? [{ idea: c.creative.idea, language: c.videos?.at(-1)?.staging?.language ?? c.creative.language }] : [];
    })
    .slice(0, 6);
  const { data: capture } = await admin.from("website_captures").select("url, title, meta_description, visible_text").eq("project_id", projectId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const analyst = known
    ? { profile: known, problems: ["profile: this brand's earlier one"] }
    : await analyzeBrand({ name, color: project.brand_color || "#6a5bff", script: narration, website: capture ? { url: capture.url, title: capture.title, description: capture.meta_description, text: capture.visible_text } : null }, (u) => usage.push(u));
  // the script's own words (the same split the voice's words are put on)
  const words = narration.split(/\s+/).filter(Boolean).map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
  const creative = await directCreative({ profile: analyst.profile, words, brandName: name, seed: seedFrom(projectId), earlier }, (u) => usage.push(u));
  console.info("studio direction:", { projectId, profile: analyst.profile.source, category: analyst.profile.category, mood: analyst.profile.mood, creative: creative.plan.source, idea: creative.plan.idea, language: creative.plan.language, problems: [...analyst.problems, ...creative.problems] });
  return { profile: analyst.profile, creative: creative.plan, problems: [...analyst.problems, ...creative.problems], ms: Date.now() - t0, usage };
}

async function composerSet(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  userId: string,
  project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null; duration_seconds: number; format: string },
  voice: WordTiming[],
  narration: string,
  brief: { product_name?: string; product_summary?: string; cta?: string } | null,
  addUsage: (u: BriefUsage) => void,
  direction?: Promise<StudioDirection | null> | null,
) {
  // the script's own words on the voice's times (never pieces of words)
  const words = scriptWords(narration, voice);
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const brand = { name: project.brand_name?.trim() || brief?.product_name || "Your product", color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || brief?.cta || "Get started", url: host, icon: null };
  const { data: past } = await admin.from("projects").select("composer:brief->composer").eq("user_id", userId).neq("id", projectId).order("created_at", { ascending: false }).limit(12);
  const pastVideos = (past ?? []).flatMap((p) => (p.composer as { videos?: StoredComposition[] } | null)?.videos ?? []);
  const seenArts = pastVideos.map((v) => (v.script as { art?: { display?: string; field?: string } } | undefined)?.art ?? {});
  // how this customer's last videos were staged (the next is staged otherwise)
  const seenStaging = pastVideos.map((v) => v.staging ?? null).slice(0, 8).reverse();
  const seen = { display: [...new Set(seenArts.map((a) => a.display).filter((x): x is string => !!x))].slice(0, 12), field: [...new Set(seenArts.map((a) => a.field).filter((x): x is string => !!x))].slice(0, 6) };
  // 1–2. the brand's profile and the creative plan (started alongside the voice)
  const dir = (await direction?.catch(() => null)) ?? (await studioDirection(admin, projectId, userId, project, narration));
  dir.usage.forEach(addUsage);
  // 3. the Composer Director pictures every scene inside that plan, with the house rules
  const result = await generateComposerIdeas({ words, brand, product: brief?.product_summary ?? null, seen, profile: dir.profile, creative: dir.creative, never: await loadNeverList(admin) }, addUsage, undefined, 95_000);
  const { count: screens } = await admin.from("project_screenshots").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  // 4. candidates: the Director's video and two composed by rule, all in the plan's camera language
  const seed = seedFrom(projectId);
  const base = { words, brand, duration: Math.round(project.duration_seconds * 30), avoid: { display: seen.display, field: seen.field.slice(0, 3) }, screens: screens ?? 0, avoidStaging: seenStaging, creative: dir.creative, look: { scheme: dir.profile.look.scheme, energy: dir.profile.look.energy }, size: frameOf(project.format) };
  const sets = [result.ideas ? composeVariants({ ...base, seed, ideas: result.ideas, count: 1 }) : null, composeVariants({ ...base, seed: (seed + 7919) >>> 0, ideas: null, count: result.ideas ? 2 : 3 })].filter((x): x is NonNullable<typeof x> => !!x);
  const candidates = sets.flatMap((set) => set.videos.map((video, v) => ({ video, plan: set.plans[v], problems: set.problems.filter((p) => p.startsWith(`video ${v + 1},`) || p.startsWith(`video ${v + 1}:`)).length })));
  // 5. the Judge scores them and keeps the best
  const heroSceneOf = (st: StoredComposition["staging"]) => st?.hero ?? null;
  const recent = pastVideos.slice(0, 8).map((v) => ({ staging: v.staging ?? null, display: (v.script as { art?: { display?: string } } | undefined)?.art?.display ?? null }));
  const scores = candidates.map((c) => scorePlan(c.plan, c.video.script, { staging: c.video.staging, motif: dir.creative.motif, heroScene: heroSceneOf(c.video.staging), recent, problems: c.problems }));
  const verdict = await judge({ candidates: candidates.map((c, i) => ({ plan: c.plan, staging: c.video.staging, score: scores[i] })), profile: dir.profile, creative: dir.creative, earlier: recent.slice(0, 4).map((r) => `${r.staging?.language ?? "cuts"}, ${r.display ?? "?"} type`) }, addUsage);
  const chosen = candidates[verdict.best] ?? candidates[0];
  const problems = [...dir.problems, ...result.problems, ...verdict.problems, ...sets.flatMap((x) => x.problems)].slice(0, 20);
  console.info("composer:", { projectId, director: result.source, ms: result.ms, scenes: result.ideas?.scenes.length ?? 0, judge: verdict.source, best: verdict.best, of: candidates.length, scores: scores.map((x) => x.total), problems: problems.slice(0, 8) });
  return {
    videos: [chosen.video],
    ideas: result.ideas,
    indexing: "script" as const,
    source: result.source,
    profile: dir.profile,
    creative: dir.creative,
    judge: { source: verdict.source, best: verdict.best, scores: verdict.scores, rule: scores.map((x) => ({ total: x.total, notes: x.notes.slice(0, 6) })), kept: chosen.video.source },
    changes: [] as { direction: string; at: string; ok: boolean }[],
    problems,
    at: new Date().toISOString(),
  };
}

// The Composer's video for the project, after the voice: the Brand Analyst
// and the Creative Director (started alongside the voice), the Composer
// Director, candidates by rule, the Judge (composerSet). Stored on the brief
// (brief.composer). True when a video was stored.
async function generateComposer(projectId: string, userId: string, direction?: Promise<StudioDirection | null> | null): Promise<boolean> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("brief, format, duration_seconds, direction, advanced_direction, brand_name, brand_color, call_to_action, website_url, voice_status, voice_result")
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
  // Each Director may use its own model (/admin/models): priced per call.
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
      metadata: { kind: "composer_director", input_tokens: meter.input, output_tokens: meter.output, latency_ms: Date.now() - started },
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
 * the website, the brief, the voice, the Composer's video. Completed steps
 * are skipped, so a retry resumes where the last run stopped. Never throws;
 * the outcome is stored on the project. The video is played and downloaded
 * in the browser (composer-studio.tsx): there is no server render.
 */
async function runPipeline(projectId: string, userId: string) {
  const admin = createAdminClient();
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
    const { data: row } = await admin.from("projects").select("brief, format, direction, advanced_direction, brand_name, brand_color, website_url").eq("id", projectId).single();
    const alongside = !!row && !!lockedScriptOf(row);
    const briefRun = p.brief_status !== "completed" ? attempt(() => generateBrief(projectId)) : null;
    const briefDone = async () => {
      if (briefRun) await briefRun;
      p = await state();
      return p.brief_status === "completed";
    };
    if (!alongside && !(await briefDone())) return void (await fail(p.brief_error ?? "Brief failed."));

    // The studio's Brand Analyst and Creative Director need only the script:
    // they work while the voice is made.
    const { data: now } = await admin.from("projects").select("brief, direction, advanced_direction").eq("id", projectId).single();
    const b = ProductBrief.safeParse(now?.brief);
    const script = b.success ? b.data.script : now ? lockedScriptOf(now) : "";
    const direction: Promise<StudioDirection | null> | null = row && script ? studioDirection(admin, projectId, userId, row, script).catch((e) => (console.warn("studio direction failed:", e instanceof Error ? e.message : e), null)) : null;

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
  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase.from("projects").select("brief, format, brand_name, brand_color, call_to_action, website_url, duration_seconds, voice_result").eq("id", projectId).maybeSingle();
  const raw = (project?.brief ?? null) as { composer?: { videos: StoredComposition[]; indexing?: "script"; changes?: { direction: string; at: string; ok: boolean }[]; profile?: BrandProfile; creative?: CreativePlan }; product_name?: string; product_summary?: string; cta?: string; script?: string } | null;
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
  // the plan stays (a new version by rule takes another camera language than the ones before)
  const stored = composer.creative ?? null;
  const creative = stored && byRule && composer.profile ? { ...stored, language: pickLanguage(composer.profile.mood, seed, composer.videos.map((v) => v.staging?.language)) } : stored;
  const look = composer.profile ? { scheme: composer.profile.look.scheme, energy: composer.profile.look.energy } : null;
  const set = result.ideas || byRule ? composeVariants({ words, brand, duration: Math.round(project.duration_seconds * 30), seed, ideas: result.ideas ?? undefined, count: 1, avoidStaging: composer.videos.map((v) => v.staging ?? null), creative, look, size: frameOf(project.format) }) : null;
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

