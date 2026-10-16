import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORM_FIELDS, FORM_FIELD_LABEL } from "@/lib/project-form";
import { STYLE_SWITCHES } from "@/components/video/composer/style";
import { RECIPES } from "@/components/video/composer/recipes";
import { TECHNIQUES } from "@/components/video/composer/techniques";
import { V2_DIRECTOR, V2_RULES, V2_RULES_MASTER, v2RuleKey } from "@/lib/v2/rules";

// Runtime settings edited from /admin/settings (table app_settings, service
// role only).
export type SettingDef = {
  key: string;
  label: string;
  help: string;
  type: "bool" | "text" | "number";
  fallback: boolean | string | number;
  // (shown under its own heading; none: the general settings)
  group?: string;
  // only a super admin may change it (others see it, greyed out)
  superAdmin?: boolean;
  // used only by the old version: while "New version" is on it is hidden
  // (its stored value is kept) and has no effect on new videos
  oldOnly?: boolean;
  // used only by "New version": shown only while it is on
  newOnly?: boolean;
};

export const SETTINGS: SettingDef[] = [
  { key: "feature_new_version", label: "New version", help: "The new, simpler video maker (lib/v2): script or the customer's own voice recording, logo, voice, format, name and call to action — no website or screenshots. Models only from AI models (no fallbacks), one Director path, a failed Director refunds instead of composing by rule. Each video keeps the version it was made with. Off: everything works exactly as before. Super admin only.", type: "bool", fallback: false, superAdmin: true },
  { key: "signups_enabled", label: "New sign-ups", help: "When off, the sign-up form refuses new accounts.", type: "bool", fallback: true },
  { key: "email_verification", label: "Email verification", help: "When on, a new account must confirm its email (a link is sent) before it can sign in. When off, it is ready at once.", type: "bool", fallback: false },
  { key: "require_approval", label: "Approve new accounts", help: "When on, a new account can look around and fill in a video but has no credits until the team approves it on Users (its welcome credits come then), and can't buy credits before. Accounts the team adds are approved already.", type: "bool", fallback: true },
  { key: "maintenance_mode", label: "Maintenance mode", help: "When on, customers can't start new videos (admins still can).", type: "bool", fallback: false },
  { key: "maintenance_message", label: "Maintenance message", help: "Shown to customers who try to create a video during maintenance.", type: "text", fallback: "MotionBrief is getting an upgrade. Back soon." },
  { key: "feature_sfx", label: "Sound effects", help: "Soft sound effects in every video — a whoosh between scenes, a pop as an icon comes in, a click on the button. No music.", type: "bool", fallback: true },
  { key: "feature_frame_check", label: "Frame check", help: "Before a video is shown, it is opened in a browser (a Vercel Sandbox) and checked frame by frame: nothing on the words, nothing on each other, nothing cut off, no empty screen, nothing gone before it can be seen. What it finds is shown on the video's admin page. Adds about a minute.", type: "bool", fallback: true },
  { key: "feature_server_render", label: "Server render", help: "Each finished video is rendered on the server (a Vercel Sandbox, real Chrome) as a high-quality 1080p MP4 the customer downloads at once. When off (or if it fails), the video is rendered in the customer's browser when they download it.", type: "bool", fallback: true },
  { key: "feature_creative_director", label: "Creative Director", help: "The Motion Director works from the new creative brief: full freedom inside what the renderer can build, and it is shown how this customer's last videos looked so the next one is unlike them. Off: the classic instructions, exactly as before.", type: "bool", fallback: false, oldOnly: true },
  { key: "feature_video_rules", label: "Video rules", help: "The house rules and the style rules: in the Director's instructions (the rulebook, the team's never list, one focal point, at most 2 things, scene length, layout repetition…) and kept by the Composer (at most 3 things and 3 ways in, one calm background, no busy fields, varied layouts). Off: all of them are left out, so the Director composes freely. The renderer's limits and honesty (no invented numbers or claims, no placeholder data) always stay.", type: "bool", fallback: true, oldOnly: true },
  { key: "feature_story_shapes", label: "Story shapes", help: "Every video is told in its own shape — problem-led, demo-first, before-after, feature-led or kinetic type — the one its script supports best and unlike this customer's last videos; the Director's scenes are checked against it. Off: every video is told the classic way (problem → turn → features → ask).", type: "bool", fallback: true, oldOnly: true },
  { key: "feature_director_motion", label: "Director's transitions", help: "The Director chooses each scene's way in (a wipe from the before to the after, a zoom onto the hero…), how its words come in and its camera move, where they serve the story; the techniques switched off below are never used. Off: the renderer draws them for every scene, as before.", type: "bool", fallback: true, oldOnly: true },
  { key: "feature_visual_match", label: "Visual match", help: "Every scene's things picture what its words say: the Director is given the map (bookings → a calendar, payments → a pay card, an icon shows its own word…), every video is checked against it, icons that don't fit are swapped and the rest is sent back to the Director's review. Off: no map, no check.", type: "bool", fallback: true, oldOnly: true },
  ...FORM_FIELDS.map((f): SettingDef => ({ key: `form_${f}`, label: `Form: ${FORM_FIELD_LABEL[f]}`, help: f === "screenshots" ? "Customers can upload up to 5 product screenshots; the Director shows them where the words talk about that screen. Off: not asked." : f === "direction" ? "A free text (up to 1,500 characters) about how the video should look and feel; the Director follows it where it can. Off: not asked." : "Asked in the new video form. Off: not asked, and the Director works without it.", type: "bool", fallback: true, oldOnly: true })),
  ...V2_DIRECTOR.map((d): SettingDef => ({ ...d, type: "bool", fallback: true, group: "New version: Director", newOnly: true })),
  { key: V2_RULES_MASTER, label: "All video rules", help: "The master switch: off turns every rule below off at once (honesty, the renderer's limits and no music always stay). On: each rule follows its own switch.", type: "bool", fallback: true, group: "New version: video rules", newOnly: true },
  ...V2_RULES.map((r): SettingDef => ({ key: v2RuleKey(r.id), label: r.label, help: `${r.help} On: written into the Director's instructions and kept in code where it can be.`, type: "bool", fallback: r.on, group: "New version: video rules", newOnly: true })),
  ...TECHNIQUES.map((t): SettingDef => ({ key: t.key, label: t.label, help: t.help, type: "bool", fallback: true, group: "Techniques" })),
  ...STYLE_SWITCHES.how.map((x): SettingDef => ({ ...x, type: "bool", fallback: true, group: "Looks" })),
  ...STYLE_SWITCHES.parts.map((x): SettingDef => ({ ...x, type: "bool", fallback: true, group: "Looks: parts" })),
  ...RECIPES.map((r): SettingDef => ({ key: `look_ref_${r.id}`, label: `${r.id.startsWith("ref-") ? `Reference ${r.id.slice(4)}` : "House look"}: ${r.from === "house" ? r.id : r.from}`, help: `${r.note}. Off: never used as a starting point.`, type: "bool", fallback: true, group: "Looks: references" })),
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
