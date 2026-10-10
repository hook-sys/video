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
  { key: "email_verification", label: "Email verification", help: "When on, a new account must confirm its email (a link is sent) before it can sign in. When off, it is ready at once.", type: "bool", fallback: false },
  { key: "require_approval", label: "Approve new accounts", help: "When on, a new account can look around and fill in a video but has no credits until the team approves it on Users (its welcome credits come then), and can't buy credits before. Accounts the team adds are approved already.", type: "bool", fallback: true },
  { key: "maintenance_mode", label: "Maintenance mode", help: "When on, customers can't start new videos (admins still can).", type: "bool", fallback: false },
  { key: "maintenance_message", label: "Maintenance message", help: "Shown to customers who try to create a video during maintenance.", type: "text", fallback: "MotionBrief is getting an upgrade. Back soon." },
  { key: "feature_sfx", label: "Sound effects", help: "Soft sound effects in every video — a whoosh between scenes, a pop as an icon comes in, a click on the button. No music.", type: "bool", fallback: true },
  { key: "feature_frame_check", label: "Frame check", help: "Before a video is shown, it is opened in a browser (a Vercel Sandbox) and checked frame by frame: nothing on the words, nothing on each other, nothing cut off, no empty screen, nothing gone before it can be seen. What it finds is shown on the video's admin page. Adds about a minute.", type: "bool", fallback: true },
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
