// The voiceover script (what the voice says) is at most 500 characters;
// `direction` stores it with a short "Visual style: …" suffix.
export const VOICE_SCRIPT_MAX = 500;
export const DIRECTION_MAX = 560;
// The customer's voiceover script, exactly as typed: the form appends
// "\n\nVisual style: …" (and "Look: …") to it in `direction`; only that suffix
// is removed. This locked text is what the voice speaks and every Director reads.
// (Browsers send the form's line breaks as \r\n.)
export const lockedVoiceScript = (direction: string | null | undefined) => (direction ?? "").split(/\r?\n\r?\nVisual style:/)[0].trim();
// The simple form (no video direction) marks its direction with this line,
// so its script is locked too.
export const SCRIPT_LOCK_LINE = "Script: exact";
// A generated brief with the customer's script as its narration, word for
// word. Projects from the script-first form carry a video direction or the
// lock line; older ones (neither) keep the brief's own script.
export function lockBriefScript<T extends { script: string }>(brief: T, project: { direction?: string | null; advanced_direction?: string | null }): T {
  const marked = new RegExp(`^${SCRIPT_LOCK_LINE}\\r?$`, "m").test(project.direction?.split(/\r?\n\r?\nVisual style:/)[1] ?? "");
  const locked = project.advanced_direction?.trim() || marked ? lockedVoiceScript(project.direction) : "";
  return locked ? { ...brief, script: locked } : brief;
}
// Kept for benchmarks and older projects; new videos last as long as their voice.
export const DURATIONS = [15, 30, 60] as const;

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

// Sent to the AI as part of the direction text (no separate backend field).
export const VISUAL_STYLES = ["Premium SaaS", "Minimal", "Bold", "Corporate", "Futuristic", "Cinematic"] as const;
// The look (docs/style-reference.md families). Travels with the script as a
// "Look:" line, like the visual style; Auto lets the Director choose.
export const LOOKS = ["Auto", "Light glass", "Dark glow", "Warm brand"] as const;
export type Look = (typeof LOOKS)[number];
// The customer's one style choice: an existing visual style + look pair
// (Auto: the default style, the Director picks the look).
export const STYLE_PRESETS = {
  Auto: { visual_style: "Premium SaaS", look: "Auto" },
  Clean: { visual_style: "Minimal", look: "Light glass" },
  Cinematic: { visual_style: "Cinematic", look: "Dark glow" },
  Bold: { visual_style: "Bold", look: "Warm brand" },
} as const satisfies Record<string, { visual_style: (typeof VISUAL_STYLES)[number]; look: Look }>;
export type StylePreset = keyof typeof STYLE_PRESETS;
// The direction the form stores: the script, then its style lines.
export const directionFor = (script: string, preset: StylePreset) => {
  const { visual_style, look } = STYLE_PRESETS[preset];
  return script.trim() ? `${script.trim()}\n\nVisual style: ${visual_style}${look === "Auto" ? "" : `\nLook: ${look}`}\n${SCRIPT_LOCK_LINE}` : "";
};
// The theme a look forces on the video (null = the Director's choice).
export const LOOK_THEME: Record<Look, "lavender" | "midnight" | null> = { Auto: null, "Light glass": null, "Dark glow": "midnight", "Warm brand": null };
// Creative preferences: guidance for the AI director only (never facts).
export const CREATIVE_DIRECTIONS = ["Auto", "Story Ad", "Product Demo", "Fast Promo", "Cinematic Brand", "Explainer"] as const;
export const MOTION_LEVELS = ["Subtle", "Balanced", "Dynamic", "High Energy"] as const;
export const VISUAL_DENSITIES = ["Clean", "Balanced", "Rich"] as const;
// The video direction (what the viewer should see) is required for new projects.
export const ADVANCED_DIRECTION_MAX = 1500;
export const VIDEO_DIRECTION_MIN = 20;
// Brand inputs (optional): shown in the closing lockup and used for the palette.
export const BRAND_NAME_MAX = 60;
export const CTA_MAX = 60;
export const AUDIENCE_MAX = 200;
export const isHexColor = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
// Also the database defaults, so projects created before these existed get them.
export const CREATIVE_DEFAULTS = {
  creative_direction: "Auto",
  motion_level: "Balanced",
  visual_density: "Balanced",
} as const;
export const FORMATS = ["16:9", "9:16", "1:1"] as const;
export const VOICE_LANGUAGES = [
  "English (US)",
  "English (UK)",
  "Bengali",
  "Hindi",
  "Spanish",
  "Arabic",
] as const;
export const VOICE_GENDERS = ["male", "female"] as const;
export const VOICE_STYLES = [
  "Professional",
  "Friendly",
  "Energetic",
  "Calm",
  "Premium",
] as const;

export function parseHttpUrl(value: string): URL | null {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
}

// Storage path: `${userId}/${projectId}/${uuid}.${ext}`
export const SCREENSHOTS_BUCKET = "project-screenshots";
export const VIDEOS_BUCKET = "project-videos";
export const SCREENSHOT_MAX_FILES = 5;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// The customer's logo (required for new projects), stored next to the
// screenshots at `${userId}/${projectId}/logo.${ext}`. SVG is not accepted
// (it can carry scripts); a transparent PNG works best.
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_FILE_PREFIX = "logo.";
export const logoPath = (userId: string, projectId: string, ext: string) => `${userId}/${projectId}/${LOGO_FILE_PREFIX}${ext}`;

export function validateLogo(file: File | null | undefined): string | undefined {
  // An empty entry (no file chosen; "blob" on mobile browsers) means no logo.
  if (!file || file.size === 0) return "Please upload your logo.";
  if (!SCREENSHOT_TYPES[file.type]) return `${file.name}: the logo must be a PNG, JPG or WebP image.`;
  if (file.size > LOGO_MAX_BYTES) return `${file.name}: the logo must be 2 MB or smaller.`;
}

// Vercel Functions reject request bodies over 4.5 MB; keep uploads (plus form
// overhead) under that on Vercel deployments.
export const VERCEL_SCREENSHOT_TOTAL_BYTES = 4 * 1024 * 1024;

export function validateScreenshots(
  files: File[],
  maxTotalBytes = Infinity,
): string | undefined {
  if (files.length > SCREENSHOT_MAX_FILES)
    return `Upload at most ${SCREENSHOT_MAX_FILES} screenshots.`;
  if (files.reduce((sum, f) => sum + f.size, 0) > maxTotalBytes)
    return `Screenshots must total ${Math.floor(maxTotalBytes / 1024 / 1024)} MB or less on this server.`;
  for (const file of files) {
    if (!SCREENSHOT_TYPES[file.type])
      return `${file.name}: only PNG, JPG or WebP images are allowed.`;
    if (file.size === 0) return `${file.name}: file is empty.`;
    if (file.size > SCREENSHOT_MAX_BYTES)
      return `${file.name}: must be 5 MB or smaller.`;
  }
}
