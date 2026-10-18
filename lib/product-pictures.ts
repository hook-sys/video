import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCREENSHOTS_BUCKET, SCREEN_FILE_PREFIX, SCREENS_MAX } from "@/lib/projects";
import { captureWebsite } from "@/lib/website-capture";

// The product's pictures for a video's screen scenes: the ones the customer
// uploaded, else up to three taken from their website now. None when there is
// neither, or the website could not be pictured (private, or not reached) —
// the video is made without them, and why is noted on it.
export async function productPictures(admin: SupabaseClient, userId: string, projectId: string, website: string | null): Promise<{ names: string[]; bytes: number; note: string | null }> {
  const folder = `${userId}/${projectId}`;
  const { data: files } = await admin.storage.from(SCREENSHOTS_BUCKET).list(folder, { search: SCREEN_FILE_PREFIX });
  const uploaded = (files ?? []).map((f) => f.name).filter((n) => n.startsWith(SCREEN_FILE_PREFIX)).sort().slice(0, SCREENS_MAX);
  if (uploaded.length || !website) return { names: uploaded, bytes: 0, note: null };
  const shot = await captureWebsite(website).catch((e): { ok: false; reason: "unreachable"; detail: string } => ({ ok: false, reason: "unreachable", detail: e instanceof Error ? e.message.slice(0, 160) : String(e) }));
  if (!shot.ok) return { names: [], bytes: 0, note: `website not pictured (${shot.reason === "private" ? "private" : "not reached"}): ${shot.detail}` };
  const names: string[] = [];
  let bytes = 0;
  for (const [i, picture] of shot.shots.slice(0, SCREENS_MAX).entries()) {
    const name = `${SCREEN_FILE_PREFIX}${i + 1}.jpg`;
    const { error } = await admin.storage.from(SCREENSHOTS_BUCKET).upload(`${folder}/${name}`, picture, { contentType: "image/jpeg", upsert: true });
    if (error) continue;
    names.push(name);
    bytes += picture.length;
  }
  return { names, bytes, note: names.length ? null : "website pictured but the pictures could not be stored" };
}
