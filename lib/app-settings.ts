import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Runtime settings edited from /admin/settings (table app_settings, service
// role only). `wired` says whether the app already acts on the setting.
export type SettingDef = {
  key: string;
  label: string;
  help: string;
  type: "bool" | "text" | "number";
  fallback: boolean | string | number;
  wired: boolean;
};

export const SETTINGS: SettingDef[] = [
  { key: "signups_enabled", label: "New sign-ups", help: "When off, the sign-up form refuses new accounts.", type: "bool", fallback: true, wired: true },
  { key: "maintenance_mode", label: "Maintenance mode", help: "When on, customers can't start new videos (admins still can).", type: "bool", fallback: false, wired: true },
  { key: "maintenance_message", label: "Maintenance message", help: "Shown to customers who try to create a video during maintenance.", type: "text", fallback: "MotionBrief is getting an upgrade. Back soon.", wired: true },
  { key: "max_videos_per_day", label: "Videos per customer per day", help: "New videos a customer can start in 24 hours. 0 = no limit. Admins are exempt.", type: "number", fallback: 20, wired: true },
  { key: "feature_4k", label: "4K downloads", help: "When off, customers can't request the 4K copy.", type: "bool", fallback: true, wired: true },
  { key: "feature_sfx", label: "Sound effects", help: "Sound effects in generated videos. Saved, not yet acted on.", type: "bool", fallback: true, wired: false },
  { key: "support_email", label: "Support email", help: "Where customers reach you. Saved, not yet shown in the app.", type: "text", fallback: "support@motionbrief.io", wired: false },
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
