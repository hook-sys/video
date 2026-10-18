"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME_MAX, CREATIVE_DEFAULTS, CTA_MAX, DIRECTION_MAX, FORMATS, MAX_VIDEO_SECONDS, LOCKUP_SECONDS, SCREENSHOTS_BUCKET, SCREENSHOT_TYPES, VERCEL_SCREENSHOT_TOTAL_BYTES, VOICE_GENDERS, VOICE_LANGUAGES, VOICE_SCRIPT_MAX, VOICE_STYLES, estimateVideoSeconds, isHexColor, logoPath, validateLogo, voiceVideoSeconds } from "@/lib/projects";
import { getAiConfig } from "@/lib/ai/models";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import { userAccess } from "@/lib/admin";
import { getSettings } from "@/lib/app-settings";
import { balanceOf, chargeVideo, creditsFor, getBilling, hasPaid, refundVideo } from "@/lib/billing";
import { V2_VOICE_TYPES, type V2Details } from "@/lib/v2/form";
import { startPipelineV2 } from "@/lib/v2/pipeline";

export type CreateProjectV2State = { error?: string };

const oneOf = <T extends string>(list: readonly T[], value: unknown) => list.find((x) => x === value);
// (the form says "about 15 s per 250 characters")
const trialSecondsOf = (chars: number) => Math.ceil((chars / 250) * 15);

// A video from the customer's script or their own recording, their logo, a
// voice, a format, their name and call to action.
export async function createProjectV2(_prev: CreateProjectV2State, formData: FormData): Promise<CreateProjectV2State> {
  const mode = formData.get("voice_mode") === "upload" ? "upload" : "script";
  const script = mode === "script" ? String(formData.get("script") ?? "").trim() : "";
  const voiceEntry = mode === "upload" ? formData.get("voice_file") : null;
  const voiceFile = voiceEntry instanceof File && voiceEntry.size > 0 ? voiceEntry : null;
  const heardSeconds = Number(formData.get("voice_seconds"));
  const format = oneOf(FORMATS, formData.get("format"));
  const voiceLanguage = oneOf(VOICE_LANGUAGES, formData.get("voice_language"));
  const voiceStyle = oneOf(VOICE_STYLES, formData.get("voice_style"));
  const voiceGender = oneOf(VOICE_GENDERS, formData.get("voice_gender")) ?? "female";
  const brandName = String(formData.get("brand_name") ?? "").trim();
  const callToAction = String(formData.get("call_to_action") ?? "").trim();
  const brandColorRaw = String(formData.get("brand_color") ?? "").trim();
  const brandColor = brandColorRaw && isHexColor(brandColorRaw) ? brandColorRaw.toUpperCase() : null;

  if (mode === "script") {
    if (!script) return { error: "The voiceover script is required." };
    if (script.length > VOICE_SCRIPT_MAX) return { error: `The voiceover script must be ${VOICE_SCRIPT_MAX} characters or less.` };
  } else {
    if (!voiceFile) return { error: "Upload your recording." };
    if (!V2_VOICE_TYPES[voiceFile.type]) return { error: `${voiceFile.name}: the recording must be an MP3, WAV or M4A file.` };
    if (!(heardSeconds > 0)) return { error: "Your recording's length could not be read. Try an MP3 file." };
    if (heardSeconds + LOCKUP_SECONDS > MAX_VIDEO_SECONDS) return { error: `Your recording must be ${Math.floor(MAX_VIDEO_SECONDS - LOCKUP_SECONDS)} seconds or shorter.` };
  }
  if (!brandName) return { error: "Your company name is required." };
  if (!callToAction) return { error: "The call to action is required." };
  if (brandName.length > BRAND_NAME_MAX || callToAction.length > CTA_MAX) return { error: "Company name and call to action must be 60 characters or less." };
  if (brandColorRaw && !brandColor) return { error: "Brand colour must be a hex colour like #0E9CA6." };
  if (!format || !voiceLanguage || !voiceStyle) return { error: "Please choose a valid option for every field." };
  const logoEntry = formData.get("logo");
  const logo = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
  const logoError = validateLogo(logo);
  if (logoError || !logo) return { error: logoError ?? "Please upload your icon." };
  // (one request on Vercel carries both files)
  if (process.env.VERCEL && logo.size + (voiceFile?.size ?? 0) > VERCEL_SCREENSHOT_TOTAL_BYTES)
    return { error: `The recording and the icon together must be ${VERCEL_SCREENSHOT_TOTAL_BYTES / 1024 / 1024} MB or smaller.` };
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
    return { error: `With welcome credits the script can be up to ${billing.trialScriptMax} characters. Shorten it, or buy credits for a longer video.` };
  if (!paid && mode === "upload" && heardSeconds > trialSecondsOf(billing.trialScriptMax))
    return { error: `With welcome credits the recording can be up to ${trialSecondsOf(billing.trialScriptMax)} seconds. Shorten it, or buy credits for a longer video.` };
  const cost = creditsFor(billing, quality, duration);
  if (!access.admin) {
    const have = await balanceOf(user.id);
    if (have < cost) return { error: `This video needs about ${cost.toLocaleString("en-US")} credits and you have ${have.toLocaleString("en-US")}. Add credits on the Credits page.` };
  }

  // the voice artist (a name from /admin/models), only when our voice speaks
  const chosen = mode === "script" ? (await getAiConfig()).voice.choices.find((c) => c.name === String(formData.get("voice_name") ?? "")) : undefined;
  const details: V2Details = { engine: "v2", voice: { source: mode, name: chosen?.name ?? null, path: null } };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .insert({
      user_id: user.id,
      website_url: null,
      // (an uploaded voice: its words replace this once they are heard)
      direction: mode === "script" ? script : "(your own recording)",
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
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "The video could not be created." };
  if (!access.admin) {
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
  const logoAt = logoPath(user.id, data.id, SCREENSHOT_TYPES[logo.type]);
  const logoUpload = await admin.storage.from(SCREENSHOTS_BUCKET).upload(logoAt, logo, { contentType: logo.type });
  if (logoUpload.error) return undo("Icon upload failed. Please try again.");
  uploaded.push({ bucket: SCREENSHOTS_BUCKET, path: logoAt });
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
    voice_script: mode === "script" ? script.slice(0, DIRECTION_MAX) : "",
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
    screenshot_count: 0,
  });
  if (libraryError) console.error("direction library insert failed:", data.id, libraryError.message);

  await startPipelineV2(data.id, user.id);
  redirect(`/projects/${data.id}`);
}
