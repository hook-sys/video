import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGO_FILE_PREFIX, SCREENSHOTS_BUCKET, ownedPath } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import type { WordTiming } from "@/lib/voice-timing";
import { getSettings } from "@/lib/app-settings";
import { type SimplePlan, isSimple } from "@/components/video/simple/types";

export type RenderProject = {
  id?: string;
  user_id?: string;
  brief: unknown;
  voice_status: string;
  voice_result: { storagePath?: string; timing?: { words?: WordTiming[] } | null } | null;
};

export const RENDER_PROJECT_COLUMNS = "id, user_id, brief, voice_status, voice_result";

// The project's video as it plays: its stored plan with the customer's logo
// and the voice signed now. A video made with an earlier engine has no plan
// here (its MP4, if one was made, is still downloaded as it is).
// `problems`: what is missing.
export async function buildRenderInput(supabase: SupabaseClient, project: RenderProject, expiresIn = 3600): Promise<{ problems: string[]; plan: SimplePlan | null; audioUrl: string | null }> {
  const problems: string[] = [];
  // Stored narration only; never regenerated here. (only this project's own file)
  const narration = project.voice_status === "completed" ? project.voice_result?.storagePath : undefined;
  const voicePath = ownedPath(narration, project.user_id, project.id) ? narration : undefined;
  const { data: voice } = voicePath ? await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(voicePath, expiresIn) : { data: null };
  if (!voice?.signedUrl) problems.push("The voice is missing.");
  const audioUrl = voice?.signedUrl ?? null;

  const stored = (project.brief as { composer?: { simple?: unknown } } | null)?.composer?.simple;
  if (!isSimple(stored)) {
    problems.push("This video was made with an earlier version.");
    return { problems, plan: null, audioUrl };
  }
  // the customer's logo (the brand's mark); a missing file leaves it out
  let logoUrl: string | null = null;
  if (project.id && project.user_id) {
    const folder = `${project.user_id}/${project.id}`;
    const { data: files } = await supabase.storage.from(SCREENSHOTS_BUCKET).list(folder, { search: LOGO_FILE_PREFIX });
    const logoFile = files?.find((f) => f.name.startsWith(LOGO_FILE_PREFIX));
    if (logoFile) logoUrl = (await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrl(`${folder}/${logoFile.name}`, expiresIn)).data?.signedUrl ?? null;
  }
  // sound effects, unless the team turned them off (admin → Settings)
  const plan: SimplePlan = { ...stored, brand: { ...stored.brand, icon: logoUrl }, sfx: (await getSettings()).feature_sfx !== false };
  return { problems, plan, audioUrl };
}
