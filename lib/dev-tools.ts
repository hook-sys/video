import type { SupabaseClient } from "@supabase/supabase-js";

// Dev-only tools (benchmark, cost breakdown, step controls, raw JSON). Enabled
// locally, or on a deployment by setting ENABLE_DEV_TOOLS=true. Never set it in Production.
export const devToolsEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_TOOLS === "true";

// On deployments, dev tools are also limited to admin accounts, so customers
// on a Preview never see them. Locally every signed-in user gets them.
export async function canUseDevTools(supabase: SupabaseClient, userId: string) {
  if (!devToolsEnabled()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}
