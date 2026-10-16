import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// The team's tools under /internal that cost money (a render, a voice, a
// sound effect) run only on Preview and only with the key kept in
// app_settings "internal_key" (service role only): the Preview link can be
// public. The key is sent in the "x-internal-key" header — never in the URL,
// where it would end up in logs and browser history.
export const INTERNAL_KEY_HEADER = "x-internal-key";

export async function internalAllowed(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return false;
  const key = request.headers.get(INTERNAL_KEY_HEADER) ?? "";
  if (key.length < 24) return false;
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "internal_key").maybeSingle();
  if (typeof data?.value !== "string") return false;
  const a = Buffer.from(key), b = Buffer.from(data.value);
  return a.length === b.length && timingSafeEqual(a, b);
}
