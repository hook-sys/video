// The voiceover script (what the voice says) is at most 1,000 characters;
// `direction` stores it (older projects: with a "Visual style: …" suffix).
export const VOICE_SCRIPT_MAX = 1000;
export const DIRECTION_MAX = 1100;

// The video is exactly as long as its voice plus the closing brand lockup
// (which starts just after the last word and needs ~2.4 s).
export const LOCKUP_SECONDS = 2.7;
export const MIN_VIDEO_SECONDS = 5;
export const MAX_VIDEO_SECONDS = 90;
const clampSeconds = (s: number) => Math.min(MAX_VIDEO_SECONDS, Math.max(MIN_VIDEO_SECONDS, Math.ceil(s)));
// Before the voice exists: an estimate from the script (~2.5 words a second).
export const estimateVideoSeconds = (script: string) => clampSeconds(script.trim().split(/\s+/).filter(Boolean).length / 2.5 + LOCKUP_SECONDS);
// Once it exists: the end of the last spoken word.
export const voiceVideoSeconds = (lastWordEnd: number) => clampSeconds(lastWordEnd + LOCKUP_SECONDS);

// The voice the customer picked (a "Voice: …" line after the script), or null.
export const voiceChoiceOf = (direction: string | null | undefined) =>
  (direction ?? "").split(/\r?\n\r?\nVisual style:/)[1]?.match(/^Voice:\s*(.+?)\s*$/m)?.[1] ?? null;
// Brand inputs (optional): shown in the closing lockup and used for the palette.
export const BRAND_NAME_MAX = 60;
export const isHexColor = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
// Also the database defaults, so projects created before these existed get them.
export const CREATIVE_DEFAULTS = {
  creative_direction: "Auto",
  motion_level: "Balanced",
  visual_density: "Balanced",
} as const;
export const FORMATS = ["16:9", "9:16", "1:1"] as const;
// English only (the voices that sound best; older videos keep theirs)
export const VOICE_LANGUAGES = ["English (US)"] as const;
export const VOICE_GENDERS = ["male", "female"] as const;
export const VOICE_STYLES = [
  "Professional",
  "Friendly",
  "Energetic",
  "Calm",
  "Premium",
] as const;

// Storage path: `${userId}/${projectId}/…`
export const SCREENSHOTS_BUCKET = "project-screenshots";
export const VIDEOS_BUCKET = "project-videos";
export const SCREENSHOT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// The customer's logo (required for new projects), stored next to the
// screenshots at `${userId}/${projectId}/logo.${ext}`. SVG is not accepted
// (it can carry scripts); a transparent PNG works best.
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
// A stored file of this project's own (`<user>/<project>/…`): a path from a
// row a customer can write is never signed unless it is.
export const ownedPath = (path: unknown, userId?: string | null, projectId?: string | null): path is string =>
  typeof path === "string" && !!userId && !!projectId && path.startsWith(`${userId}/${projectId}/`) && !path.split("/").includes("..");
export const LOGO_FILE_PREFIX = "logo.";
// Pictures of the product for its screen scenes, beside the logo: uploaded
// with the project, or taken from its website when the video is made
// (lib/product-pictures.ts) — screen-1.jpg, screen-2.jpg, screen-3.jpg.
export const SCREEN_FILE_PREFIX = "screen-";
export const SCREENS_MAX = 3;
export const logoPath = (userId: string, projectId: string, ext: string) => `${userId}/${projectId}/${LOGO_FILE_PREFIX}${ext}`;

export function validateLogo(file: File | null | undefined): string | undefined {
  // An empty entry (no file chosen; "blob" on mobile browsers) means no logo.
  if (!file || file.size === 0) return "Please upload your icon.";
  if (!SCREENSHOT_TYPES[file.type]) return `${file.name}: the icon must be a PNG, JPG or WebP image.`;
  if (file.size > LOGO_MAX_BYTES) return `${file.name}: the icon must be 2 MB or smaller.`;
}

// Vercel Functions reject request bodies over 4.5 MB; keep uploads (plus form
// overhead) under that on Vercel deployments.
export const VERCEL_SCREENSHOT_TOTAL_BYTES = 4 * 1024 * 1024;
// A project's own seed (the same every time): its videos are drawn from it.
export const seedFrom = (text: string) => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 1_000_003;
