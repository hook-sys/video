// "New version": the uploaded voice's file types (shared by the form and the server).
export const V2_VOICE_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};

// What a "New version" project keeps in projects.details (besides engine: "v2").
export type V2Details = { engine: "v2"; voice: { source: "script" | "upload"; name: string | null; path: string | null } };

export function v2DetailsOf(details: unknown): V2Details | null {
  const d = details as { engine?: unknown; voice?: { source?: unknown; name?: unknown; path?: unknown } } | null;
  if (!d || d.engine !== "v2") return null;
  const source = d.voice?.source === "upload" ? "upload" : "script";
  return { engine: "v2", voice: { source, name: typeof d.voice?.name === "string" ? d.voice.name : null, path: typeof d.voice?.path === "string" ? d.voice.path : null } };
}
