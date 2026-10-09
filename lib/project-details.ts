import { BRAND_CATEGORIES, MOODS, type BrandCategory, type Mood } from "@/lib/studio";

// What the customer tells the Motion Director in the form ("make it yours"):
// all required. Stored on projects.details; the audience is target_audience.
// The Director takes them as facts instead of guessing them from the script.

export const USES = ["website", "ad", "social", "presentation"] as const;
export type Use = (typeof USES)[number];
export const USE_LABEL: Record<Use, string> = { website: "Website", ad: "Ad", social: "Social (Reels, TikTok)", presentation: "Presentation" };
// how a video for each use is paced (for the Director)
export const USE_NOTE: Record<Use, string> = {
  website: "a website video: clear and calm, each scene given time to read",
  ad: "an ad: a hook in the first 2 seconds, punchy cuts, a strong call to action",
  social: "social (Reels, TikTok): fast, big type, one idea per scene",
  presentation: "a presentation: calm, steady and professional",
};

export const MOOD_CHOICES: { mood: Mood; label: string; hint: string }[] = [
  { mood: "calm", label: "Calm", hint: "Soft and clear" },
  { mood: "premium", label: "Premium", hint: "Refined and quiet" },
  { mood: "professional", label: "Professional", hint: "Precise and trusted" },
  { mood: "energetic", label: "Energetic", hint: "Bold and fast" },
  { mood: "playful", label: "Friendly", hint: "Bright and warm" },
];

export const OLD_WAYS = ["Spreadsheets", "Paper", "Phone calls", "WhatsApp", "Email", "Another app"] as const;
export const FEATURE_MAX = 40;

export const CATEGORY_LABEL = (c: BrandCategory) => (c === "hr & teams" ? "HR & teams" : c.charAt(0).toUpperCase() + c.slice(1));

export type ProjectDetails = { category: BrandCategory; use: Use; mood: Mood; features: string[]; before: string[] };

const isOne = <T extends string>(xs: readonly T[], v: unknown): v is T => typeof v === "string" && (xs as readonly string[]).includes(v);

// The form's answers, checked (every one is required).
export function detailsFrom(formData: FormData): { details?: ProjectDetails; error?: string } {
  const category = formData.get("category");
  const use = formData.get("use");
  const mood = formData.get("mood");
  const features = formData.getAll("feature").map((f) => String(f).trim()).filter(Boolean);
  const before = formData.getAll("before").map(String).filter((b) => isOne(OLD_WAYS, b));
  if (!isOne(BRAND_CATEGORIES, category)) return { error: "Choose your type of business." };
  if (features.length < 3) return { error: "Name your three main features." };
  if (features.some((f) => f.length > FEATURE_MAX)) return { error: `Keep each feature to ${FEATURE_MAX} characters.` };
  if (!before.length) return { error: "Choose what your customers used before." };
  if (!isOne(MOODS, mood)) return { error: "Choose a mood." };
  if (!isOne(USES, use)) return { error: "Choose where the video will be used." };
  return { details: { category, use, mood, features: features.slice(0, 3), before } };
}

// A stored value (older projects have none).
export function parseDetails(raw: unknown): ProjectDetails | null {
  const d = raw as Partial<ProjectDetails> | null;
  if (!d || !isOne(BRAND_CATEGORIES, d.category) || !isOne(USES, d.use) || !isOne(MOODS, d.mood)) return null;
  return {
    category: d.category,
    use: d.use,
    mood: d.mood,
    features: Array.isArray(d.features) ? d.features.map(String).slice(0, 3) : [],
    before: Array.isArray(d.before) ? d.before.map(String).slice(0, 6) : [],
  };
}
