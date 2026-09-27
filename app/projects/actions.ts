"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DIRECTION_MAX,
  DURATIONS,
  FORMATS,
  VOICE_LANGUAGES,
  VOICE_STYLES,
} from "@/lib/projects";

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
  if (websiteUrl && !URL.canParse(websiteUrl))
    return { error: "Website URL is not valid." };

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
  redirect(`/projects/${data.id}`);
}
