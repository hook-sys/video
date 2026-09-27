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
  VOICE_LANGUAGES,
  VOICE_STYLES,
  parseHttpUrl,
  validateScreenshots,
} from "@/lib/projects";
import { runWebsiteCapture } from "@/lib/website-capture";
import { generateProductBrief } from "@/lib/ai/product-brief";
import { generateVoice as generateFalVoice } from "@/lib/ai/fal";

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

  try {
    const brief = await generateProductBrief({
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
    });
    await briefUpdate({ brief, brief_status: "completed", brief_error: null });
  } catch (e) {
    await fail((e instanceof Error ? e.message : "Brief generation failed.").slice(0, 500));
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
    .select("brief, brief_status, voice_language, voice_style")
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
    const result = await generateFalVoice({
      script,
      language: project.voice_language,
      style: project.voice_style,
    });
    await voiceUpdate({ voice_status: "completed", voice_error: null, voice_result: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Voice generation failed.";
    await voiceUpdate({ voice_status: "failed", voice_error: message.slice(0, 500) });
  }
  revalidatePath(`/projects/${projectId}`);
}
