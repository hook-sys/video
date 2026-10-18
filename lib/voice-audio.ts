import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Block requests to private/internal networks (SSRF protection).
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

function isPublicIp(ip: string) {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  const family = isIP(ip);
  return family !== 0 && !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

export async function isPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return isPublicIp(host);
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => isPublicIp(a.address));
  } catch {
    return false;
  }
}

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

// Downloads temporary provider audio and stores it privately.
export async function storeVoiceAudio(
  admin: SupabaseClient,
  audioUrl: string,
  userId: string,
  projectId: string,
): Promise<{ path: string; bytes: number }> {
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
  return { path, bytes: body.byteLength };
}
