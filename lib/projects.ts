export const DIRECTION_MAX = 500;
export const DURATIONS = [30, 45, 60] as const;
export const FORMATS = ["16:9", "9:16", "1:1"] as const;
export const VOICE_LANGUAGES = [
  "English (US)",
  "English (UK)",
  "Bengali",
  "Hindi",
  "Spanish",
  "Arabic",
] as const;
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
