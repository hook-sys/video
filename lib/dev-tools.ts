import type { SupabaseClient } from "@supabase/supabase-js";

// Dev-only tools (benchmark, cost breakdown, step controls, raw JSON). Enabled
// locally, or on a deployment by setting ENABLE_DEV_TOOLS=true. Never set it in Production.
export const devToolsEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_TOOLS === "true";

// Dev tools always require an admin account (profiles.role, which users can't
// change), so customers never see them even if the env flag is on by mistake.
export async function canUseDevTools(supabase: SupabaseClient, userId: string) {
  if (!devToolsEnabled()) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}
