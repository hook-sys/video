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
export const SCREENSHOT_MAX_FILES = 5;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function validateScreenshots(files: File[]): string | undefined {
  if (files.length > SCREENSHOT_MAX_FILES)
    return `Upload at most ${SCREENSHOT_MAX_FILES} screenshots.`;
  for (const file of files) {
    if (!SCREENSHOT_TYPES[file.type])
      return `${file.name}: only PNG, JPG or WebP images are allowed.`;
    if (file.size === 0) return `${file.name}: file is empty.`;
    if (file.size > SCREENSHOT_MAX_BYTES)
      return `${file.name}: must be 5 MB or smaller.`;
  }
}
