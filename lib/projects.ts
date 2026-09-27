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

// Storage path convention for future uploads: `${userId}/${projectId}/${fileName}`
export const SCREENSHOTS_BUCKET = "project-screenshots";
