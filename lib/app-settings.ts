import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Runtime settings edited from /admin/settings (table app_settings, service
// role only).
export type SettingDef = {
  key: string;
  label: string;
  help: string;
  type: "bool" | "text" | "number";
  fallback: boolean | string | number;
};

export const SETTINGS: SettingDef[] = [
  { key: "signups_enabled", label: "New sign-ups", help: "When off, the sign-up form refuses new accounts.", type: "bool", fallback: true },
  { key: "maintenance_mode", label: "Maintenance mode", help: "When on, customers can't start new videos (admins still can).", type: "bool", fallback: false },
  { key: "maintenance_message", label: "Maintenance message", help: "Shown to customers who try to create a video during maintenance.", type: "text", fallback: "MotionBrief is getting an upgrade. Back soon." },
  { key: "max_videos_per_day", label: "Videos per customer per day", help: "New videos a customer can start in 24 hours. 0 = no limit. Admins are exempt.", type: "number", fallback: 20 },
];

export async function getSettings(): Promise<Record<string, boolean | string | number>> {
  const out: Record<string, boolean | string | number> = Object.fromEntries(SETTINGS.map((s) => [s.key, s.fallback]));
  try {
    const { data } = await createAdminClient().from("app_settings").select("key, value");
    for (const row of data ?? []) out[row.key] = row.value;
  } catch {
    // Settings unavailable: fall back to defaults rather than blocking customers.
  }
  return out;
}
