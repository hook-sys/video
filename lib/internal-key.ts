import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The team's tools under /internal that cost money (a render, a voice) run
// only on Preview and only with the key kept in app_settings "internal_key"
// (service role only): the Preview link can be public.
export async function internalAllowed(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return false;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (key.length < 24) return false;
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "internal_key").maybeSingle();
  return typeof data?.value === "string" && data.value === key;
}
