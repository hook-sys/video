import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPublicHost } from "@/lib/website-capture";

export const AUDIO_BUCKET = "project-audio";
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "audio/webm": "webm",
};

// Downloads temporary provider audio and stores it privately. Returns the storage path.
export async function storeVoiceAudio(
  admin: SupabaseClient,
  audioUrl: string,
  userId: string,
  projectId: string,
): Promise<string> {
  const url = new URL(audioUrl);
  if (url.protocol !== "https:" || !(await isPublicHost(url.hostname))) {
    throw new Error("Voice audio URL is not allowed.");
  }

  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Audio download failed (HTTP ${res.status}).`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
    throw new Error("Voice audio is too large.");
  }

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type.startsWith("text/") || type.includes("json") || type.includes("html")) {
    throw new Error("Voice audio download was not audio.");
  }
  const ext = EXTENSIONS[type] ?? "mp3";
  const contentType = EXTENSIONS[type] ? type : "audio/mpeg";

  const body = await res.arrayBuffer();
  if (body.byteLength === 0) throw new Error("Voice audio is empty.");
  if (body.byteLength > MAX_BYTES) throw new Error("Voice audio is too large.");

  const path = `${userId}/${projectId}/voice/narration.${ext}`;
  const { error } = await admin.storage
    .from(AUDIO_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Audio storage failed: ${error.message}`);
  return path;
}
