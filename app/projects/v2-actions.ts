"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME_MAX, CREATIVE_DEFAULTS, DIRECTION_MAX, FORMATS, LOGO_MAX_BYTES, MAX_VIDEO_SECONDS, LOCKUP_SECONDS, SCREENSHOTS_BUCKET, SCREENSHOT_TYPES, SCREEN_FILE_PREFIX, SCREENS_MAX, VERCEL_SCREENSHOT_TOTAL_BYTES, VOICE_GENDERS, VOICE_LANGUAGES, VOICE_SCRIPT_MAX, VOICE_STYLES, estimateVideoSeconds, isHexColor, logoPath, validateLogo, voiceVideoSeconds } from "@/lib/projects";
import { getAiConfig } from "@/lib/ai/models";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import { userAccess } from "@/lib/admin";
import { BRAND_KITS_MAX, brandKitOf, kitLogoPath } from "@/lib/brand-kits";
import { getSettings } from "@/lib/app-settings";
import { balanceOf, chargeVideo, creditsFor, getBilling, hasPaid, refundVideo } from "@/lib/billing";
import { V2_VOICE_TYPES, type V2Details } from "@/lib/v2/form";
import { startPipelineV2 } from "@/lib/v2/pipeline";
import { websiteUrlOf } from "@/lib/website-url";

export type CreateProjectV2State = { error?: string };

const oneOf = <T extends string>(list: readonly T[], value: unknown) => list.find((x) => x === value);
// (the form says "about 15 s per 250 characters")
const trialSecondsOf = (chars: number) => Math.ceil((chars / 250) * 15);

// A video from the customer's script or their own recording, their logo, a
// voice, a format, their name, and their website or pictures of the product.
export async function createProjectV2(_prev: CreateProjectV2State, formData: FormData): Promise<CreateProjectV2State> {
  const mode = formData.get("voice_mode") === "upload" ? "upload" : "script";
  // (a recording comes with its words, written: they are what is shown and timed — lib/voice-align.ts)
  // (NFC: one way of writing each Bangla letter — "য়" as য and a nukta, however it was typed)
  const script = String(formData.get(mode === "script" ? "script" : "upload_script") ?? "").normalize("NFC").trim();
  const voiceEntry = mode === "upload" ? formData.get("voice_file") : null;
  const voiceFile = voiceEntry instanceof File && voiceEntry.size > 0 ? voiceEntry : null;
  const heardSeconds = Number(formData.get("voice_seconds"));
  const format = oneOf(FORMATS, formData.get("format"));
  const voiceLanguage = oneOf(VOICE_LANGUAGES, formData.get("voice_language"));
  const voiceStyle = oneOf(VOICE_STYLES, formData.get("voice_style"));
  const voiceGender = oneOf(VOICE_GENDERS, formData.get("voice_gender")) ?? "female";
  const brandName = String(formData.get("brand_name") ?? "").trim();
  // (no call-to-action field: the button's words are the ask the voice ends on, read when the video is made)
  const callToAction = "";
  const brandColorRaw = String(formData.get("brand_color") ?? "").trim();
  const brandColor = brandColorRaw && isHexColor(brandColorRaw) ? brandColorRaw.toUpperCase() : null;

  if (mode === "script") {
    if (!script) return { error: "The voiceover script is required." };
    if (script.length > VOICE_SCRIPT_MAX) return { error: `The voiceover script must be ${VOICE_SCRIPT_MAX} characters or less.` };
  } else {
    if (!voiceFile) return { error: "Upload your recording." };
    if (!script) return { error: "Write the words of your recording, exactly as you say them." };
    if (script.length > VOICE_SCRIPT_MAX) return { error: `The words of your recording must be ${VOICE_SCRIPT_MAX} characters or less.` };
    if (!V2_VOICE_TYPES[voiceFile.type]) return { error: `${voiceFile.name}: the recording must be an MP3, WAV or M4A file.` };
    if (!(heardSeconds > 0)) return { error: "Your recording's length could not be read. Try an MP3 file." };
    if (heardSeconds + LOCKUP_SECONDS > MAX_VIDEO_SECONDS) return { error: `Your recording must be ${Math.floor(MAX_VIDEO_SECONDS - LOCKUP_SECONDS)} seconds or shorter.` };
  }
  if (!brandName) return { error: "Your company name is required." };
  if (brandName.length > BRAND_NAME_MAX) return { error: `Company name must be ${BRAND_NAME_MAX} characters or less.` };
  if (brandColorRaw && !brandColor) return { error: "Brand colour must be a hex colour like #0E9CA6." };
  if (!format || !voiceLanguage || !voiceStyle) return { error: "Please choose a valid option for every field." };
  const logoEntry = formData.get("logo");
  const logo = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
  // a saved brand kit (/brand) brings its icon: no upload needed (read once the user is known)
  const kitId = String(formData.get("brand_kit_id") ?? "").trim();
  const saveKit = !kitId && formData.get("save_kit") === "1";
  if (logo || !kitId) {
    const logoError = validateLogo(logo);
    if (logoError || !logo) return { error: logoError ?? "Please upload your icon." };
  }
  // the website (pictures of the product are taken from it when the video is made), or pictures of it uploaded
  const websiteRaw = String(formData.get("website_url") ?? "").trim();
  const website = websiteUrlOf(websiteRaw);
  if (websiteRaw && !website) return { error: "The website must be an address like yourcompany.com." };
  const screens = formData.getAll("screens").filter((f): f is File => f instanceof File && f.size > 0);
  if (screens.length > SCREENS_MAX) return { error: `Add up to ${SCREENS_MAX} pictures of your product.` };
  for (const f of screens) if (!SCREENSHOT_TYPES[f.type] || f.size > LOGO_MAX_BYTES) return { error: `${f.name}: a picture must be a PNG, JPG or WebP image of ${LOGO_MAX_BYTES / 1024 / 1024} MB or less.` };
  // (one request on Vercel carries every file)
  if (process.env.VERCEL && (logo?.size ?? 0) + (voiceFile?.size ?? 0) + screens.reduce((a, f) => a + f.size, 0) > VERCEL_SCREENSHOT_TOTAL_BYTES)
    return { error: `The recording, the icon and the pictures together must be ${VERCEL_SCREENSHOT_TOTAL_BYTES / 1024 / 1024} MB or smaller.` };
  const duration = mode === "script" ? estimateVideoSeconds(script) : voiceVideoSeconds(heardSeconds);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await userAccess(supabase, user.id);
  if (access.suspended) return { error: "This account is suspended. Contact support." };
  if (access.pending) return { error: "Not enough credits yet — your account is waiting for approval. Your welcome credits arrive as soon as it's approved." };
  if (!access.admin) {
    const settings = await getSettings();
    if (settings.maintenance_mode === true) return { error: String(settings.maintenance_message) };
    const perDay = Number(settings.max_videos_per_day) || 0;
    if (perDay > 0) {
      const { count } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
      if ((count ?? 0) >= perDay) return { error: `You can start ${perDay} videos per day. Please try again tomorrow.` };
    }
  }

  const billing = await getBilling();
  const paid = access.admin || (await hasPaid(user.id));
  // one level: every new-version video is priced as Standard (/admin/billing)
  const quality = "standard" as const;
  if (!paid && mode === "script" && script.length > billing.trialScriptMax)
    return { error: `Before your first credit load the script can be up to ${billing.trialScriptMax} characters. Shorten it, or buy credits for a longer video.` };
  if (!paid && mode === "upload" && heardSeconds > trialSecondsOf(billing.trialScriptMax))
    return { error: `Before your first credit load the recording can be up to ${trialSecondsOf(billing.trialScriptMax)} seconds. Shorten it, or buy credits for a longer video.` };
  const cost = creditsFor(billing, quality, duration);
  // the free trial (/admin/billing): a customer who hasn't bought credits makes
  // a few short videos for nothing — watermarked, not editable — then loads
  // credits. (A trial video that failed is not counted. Before the database
  // knows trial videos — migration 20261114000039 — there is no trial.)
  const trialUsed = async () => {
    const { count, error } = await createAdminClient().from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("trial", true).neq("pipeline_status", "failed");
    return error ? null : (count ?? 0);
  };
  const used = paid ? null : await trialUsed();
  const trial = used !== null && used < billing.trialVideos;
  if (trial && duration > billing.trialSeconds)
    return { error: `Free trial videos can be up to ${billing.trialSeconds} seconds — this script makes about ${duration} s. Shorten it (about ${Math.floor((billing.trialSeconds - LOCKUP_SECONDS) * 2.5)} words), or load credits for a longer video.` };
  if (!access.admin && !trial) {
    const have = await balanceOf(user.id);
    if (have < cost)
      return { error: used !== null && billing.trialVideos > 0 ? `Your ${billing.trialVideos} free videos are made. Load credits on the Credits page to make more — without the watermark, and with edits.` : `This video needs about ${cost.toLocaleString("en-US")} credits and you have ${have.toLocaleString("en-US")}. Add credits on the Credits page.` };
  }

  // the voice artist (a name from /admin/models), only when our voice speaks
  const chosen = mode === "script" ? (await getAiConfig()).voice.choices.find((c) => c.name === String(formData.get("voice_name") ?? "")) : undefined;
  const details: V2Details = { engine: "v2", voice: { source: mode, name: chosen?.name ?? null, path: null } };
  const admin = createAdminClient();
  const kit = kitId ? await brandKitOf(admin, user.id, kitId) : null;
  if (kitId && !kit) return { error: "That brand kit was not found. Pick another or upload your icon." };
  if (!logo && !kit?.logoPath) return { error: "That brand kit has no icon. Upload your icon." };
  const { data, error } = await admin
    .from("projects")
    .insert({
      user_id: user.id,
      website_url: website,
      // (an uploaded voice: its words replace this once they are heard)
      direction: script,
      duration_seconds: duration,
      format,
      voice_language: voiceLanguage,
      voice_style: voiceStyle,
      voice_gender: chosen?.gender ?? voiceGender,
      creative_direction: CREATIVE_DEFAULTS.creative_direction,
      motion_level: CREATIVE_DEFAULTS.motion_level,
      visual_density: CREATIVE_DEFAULTS.visual_density,
      advanced_direction: "",
      brand_name: brandName,
      brand_color: brandColor,
      call_to_action: callToAction,
      target_audience: "",
      details,
      quality,
      ...(trial ? { trial: true } : {}),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "The video could not be created." };
  if (trial && ((await trialUsed()) ?? 0) > billing.trialVideos) {
    // (two started at the same moment: the one over the limit is not made)
    await admin.from("projects").delete().eq("id", data.id).eq("user_id", user.id);
    return { error: `Your ${billing.trialVideos} free videos are made. Load credits on the Credits page to make more.` };
  }
  if (!access.admin && !trial) {
    try {
      await chargeVideo(data.id, user.id, quality, duration);
    } catch {
      await admin.from("projects").delete().eq("id", data.id).eq("user_id", user.id);
      return { error: "Not enough credits for this video. Add credits on the Credits page." };
    }
  }

  const uploaded: { bucket: string; path: string }[] = [];
  const undo = async (message: string) => {
    for (const u of uploaded) await admin.storage.from(u.bucket).remove([u.path]).catch(() => {});
    await refundVideo(data.id, user.id, "Upload failed — credits returned").catch(() => {});
    await admin.from("projects").delete().eq("id", data.id).eq("user_id", user.id);
    return { error: message };
  };
  // the icon uploaded, or the saved kit's copied in (the video reads it from the project's folder)
  const logoAt = logoPath(user.id, data.id, logo ? SCREENSHOT_TYPES[logo.type] : kit!.logoPath!.split(".").pop()!);
  const logoUpload = logo
    ? await admin.storage.from(SCREENSHOTS_BUCKET).upload(logoAt, logo, { contentType: logo.type })
    : await admin.storage.from(SCREENSHOTS_BUCKET).copy(kit!.logoPath!, logoAt);
  if (logoUpload.error) return undo("Icon upload failed. Please try again.");
  uploaded.push({ bucket: SCREENSHOTS_BUCKET, path: logoAt });
  for (const [i, f] of screens.entries()) {
    const at = `${user.id}/${data.id}/${SCREEN_FILE_PREFIX}${i + 1}.${SCREENSHOT_TYPES[f.type]}`;
    const up = await admin.storage.from(SCREENSHOTS_BUCKET).upload(at, f, { contentType: f.type });
    if (up.error) return undo("Picture upload failed. Please try again.");
    uploaded.push({ bucket: SCREENSHOTS_BUCKET, path: at });
  }
  if (voiceFile) {
    const voiceAt = `${user.id}/${data.id}/voice/upload.${V2_VOICE_TYPES[voiceFile.type]}`;
    const voiceUpload = await admin.storage.from(AUDIO_BUCKET).upload(voiceAt, voiceFile, { contentType: voiceFile.type });
    if (voiceUpload.error) return undo("Recording upload failed. Please try again.");
    uploaded.push({ bucket: AUDIO_BUCKET, path: voiceAt });
    const kept: V2Details = { ...details, voice: { ...details.voice, path: voiceAt } };
    const { error: keptError } = await admin.from("projects").update({ details: kept }).eq("id", data.id).eq("user_id", user.id);
    if (keptError) return undo("Recording upload failed. Please try again.");
  }

  const { error: libraryError } = await admin.from("direction_library").insert({
    project_id: data.id,
    user_id: user.id,
    voice_script: script.slice(0, DIRECTION_MAX),
    video_direction: "",
    visual_style: null,
    creative_direction: CREATIVE_DEFAULTS.creative_direction,
    motion_level: CREATIVE_DEFAULTS.motion_level,
    visual_density: CREATIVE_DEFAULTS.visual_density,
    format,
    duration_seconds: duration,
    voice_language: voiceLanguage,
    brand_name: brandName,
    brand_color: brandColor,
    call_to_action: callToAction,
    target_audience: null,
    has_logo: true,
    screenshot_count: screens.length,
  });
  if (libraryError) console.error("direction library insert failed:", data.id, libraryError.message);

  // "Save this brand for my next videos": a kit from what was given (never fails the video)
  if (saveKit) await keepBrandKit(admin, user.id, { name: brandName, color: brandColor, website, logoAt }).catch((e) => console.error("brand kit save failed:", e));

  await startPipelineV2(data.id, user.id);
  redirect(`/projects/${data.id}`);
}

// A brand kit made from a new video's brand, unless one of that name is kept or the customer has the most
async function keepBrandKit(admin: ReturnType<typeof createAdminClient>, userId: string, b: { name: string; color: string | null; website: string | null; logoAt: string }) {
  const { data: kits } = await admin.from("brand_kits").select("name").eq("user_id", userId);
  if ((kits ?? []).length >= BRAND_KITS_MAX || (kits ?? []).some((k) => k.name.trim().toLowerCase() === b.name.toLowerCase())) return;
  const { data, error } = await admin
    .from("brand_kits")
    .insert({ user_id: userId, name: b.name, color: b.color, website_url: b.website, is_default: !(kits ?? []).length })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "no kit");
  const at = kitLogoPath(userId, data.id, b.logoAt.split(".").pop()!);
  const copied = await admin.storage.from(SCREENSHOTS_BUCKET).copy(b.logoAt, at);
  if (!copied.error) await admin.from("brand_kits").update({ logo_path: at }).eq("id", data.id).eq("user_id", userId);
}
