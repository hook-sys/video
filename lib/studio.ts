import { rng } from "@/components/video/composer/art";
import { IN_USE, type Language } from "@/components/video/composer/staging";
import type { GuideKind, JourneyKind, Word } from "@/components/video/composer/types";

// The studio's shared vocabulary: the brand profile and the creative plan the
// Motion Director writes (lib/ai/motion-director.ts), and
// how each is written by rule when AI is off ("AI only for the voice") or
// fails — so every video has a brand profile and a creative plan.

export const BRAND_CATEGORIES = ["clinic & health", "online shop", "customer support", "finance & payments", "education", "restaurant & food", "real estate", "hr & teams", "marketing", "productivity", "developer tools", "logistics", "travel & booking", "fitness", "legal", "other"] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];
export const MOODS = ["calm", "professional", "energetic", "playful", "premium"] as const;
export type Mood = (typeof MOODS)[number];

export type BrandProfile = {
  category: BrandCategory;
  personality: string[];
  mood: Mood;
  audience: string;
  promise: string;
  features: string[];
  before: string[];
  keywords: string[];
  numbers: string[];
  look: { scheme: "dark" | "light" | "mixed"; face: "geometric" | "humanist" | "serif" | "condensed" | "rounded" | "wide"; energy: number };
  source: "ai" | "rule";
};

export const BEATS = ["hook", "problem", "turn", "feature", "proof", "demo", "before", "after", "cta"] as const;
export type Beat = (typeof BEATS)[number];

// The story's shape: how the whole video is told (the narration's order never
// changes — the shape decides what the scenes show and where the product first
// appears). One per video, unlike this customer's last ones where the script allows.
export const STORY_SHAPES = ["problem-led", "demo-first", "before-after", "feature-led", "kinetic-type"] as const;
export type StoryShape = (typeof STORY_SHAPES)[number];
export const SHAPE_NOTES: Record<StoryShape, string> = {
  "problem-led": "opens on the pain the script names, turns when the product arrives, then what it does, ends on the ask (the classic arc — only when the script is built that way)",
  "demo-first": "opens on the product already at work (its screen, its result) — no problem scene first; every scene shows the product doing what its words say; a problem the script names is shown in passing, beside the product",
  "before-after": "the old way and the new one side by side all through: the opening a before (the old way's mess), then each scene pairs a before with its after (compare, a split, a card that changes), ending on the after",
  "feature-led": "a run of features, one per scene, each with its own picture (a card, a screen, a chart) — no problem arc; opens on the strongest feature or the product's name",
  "kinetic-type": "the words are the picture: big kinetic type on most scenes (layout type, or one small thing beside the words), a picture only at the hero moment and the end",
};
// the beat of each sentence in a shape (i: the sentence, n: how many, turn: where the product arrives)
export function beatsOf(shape: StoryShape, texts: string[], turn: number): Beat[] {
  const n = texts.length;
  const proof = (t: string) => /\d|twice|double|half|faster|more|less/i.test(t);
  return texts.map((t, i): Beat => {
    if (i === n - 1 && n > 1) return "cta";
    if (shape === "demo-first") return i === 0 ? "demo" : proof(t) ? "proof" : "feature";
    if (shape === "feature-led") return i === 0 ? "hook" : proof(t) ? "proof" : "feature";
    if (shape === "before-after") return i === 0 ? "before" : i < turn ? "before" : i === turn ? "turn" : "after";
    if (shape === "kinetic-type") return i === 0 ? "hook" : i === turn ? "turn" : proof(t) ? "proof" : "feature";
    return i === 0 ? "hook" : i < turn ? "problem" : i === turn ? "turn" : proof(t) ? "proof" : "feature";
  });
}
// The shape a script supports, by rule (unlike the last ones where it can be).
export function ruleShape(texts: string[], brandName: string, seed: number, recent: (StoryShape | null | undefined)[] = []): StoryShape {
  const all = texts.join(" ").toLowerCase();
  const first = (texts[0] ?? "").toLowerCase();
  const name = brandName.toLowerCase();
  const pain = /\b(tired|still|struggl|problem|hard|messy|lost|waste|stuck|chaos|boring|generic|fail|miss|slow|manual|spreadsheet|paper)\w*|\?/;
  const contrast = /\b(no more|instead of|stop|without|from .+ to|before|after|old way|replace)\b/;
  const fits: StoryShape[] = [];
  if (name && first.includes(name)) fits.push("demo-first", "feature-led");
  if (contrast.test(all)) fits.push("before-after");
  if (pain.test(first)) fits.push("problem-led");
  if (texts.length >= 4) fits.push("feature-led");
  fits.push("demo-first", "kinetic-type");
  const fresh = [...new Set(fits)].filter((x) => !recent.slice(0, 2).includes(x));
  const pool = fresh.length ? fresh : [...new Set(fits)];
  return pool[Math.abs(seed) % Math.min(pool.length, 3)];
}
export type CreativePlan = {
  idea: string; // the one idea the whole video is built on
  motif: { icon: string; label: string } | null; // a thing that comes back through the video
  hero: number; // the word the hero moment is on
  turn: number; // the word the product arrives on (the story turns)
  beats: { at: number; beat: Beat }[]; // the story, sentence by sentence
  shape?: StoryShape; // how the story is told (older plans: none — told problem-led)
  language: Language; // one camera language for the whole video
  journey: JourneyKind | null;
  guide: GuideKind | null;
  recap: boolean;
  scheme: "dark" | "light" | "mixed";
  source: "ai" | "rule";
};

// ── the profile by rule ────────────────────────────────────────────────────
const CATEGORY_WORDS: [BrandCategory, RegExp][] = [
  ["clinic & health", /\b(clinic|patient|doctor|dental|dentist|health|appointment|therapy|medical|care)\w*/i],
  ["online shop", /\b(shop|store|order|cart|ecommerce|e-commerce|inventory|product listing|checkout)\w*/i],
  ["customer support", /\b(support|ticket|help ?desk|inbox|customer conversation|live chat)\w*/i],
  ["finance & payments", /\b(invoice|payment|accounting|finance|expense|bank|revenue|billing|cash ?flow)\w*/i],
  ["education", /\b(student|course|school|lesson|teacher|classroom|learn)\w*/i],
  ["restaurant & food", /\b(restaurant|menu|kitchen|food|dining|table booking)\w*/i],
  ["real estate", /\b(property|tenant|rent|listing|real estate|landlord)\w*/i],
  ["hr & teams", /\b(employee|hiring|recruit|payroll|leave request|onboarding|hr)\b/i],
  ["marketing", /\b(campaign|leads?|marketing|seo|social media|ads?)\b/i],
  ["developer tools", /\b(api|deploy|developer|codebase|bug|repository)\w*/i],
  ["logistics", /\b(shipment|fleet|warehouse|tracking|freight|courier)\w*/i],
  ["travel & booking", /\b(hotel|travel|flight|trip|booking|reservation)\w*/i],
  ["fitness", /\b(gym|workout|fitness|trainer|membership)\w*/i],
  ["legal", /\b(contract|legal|lawyer|law firm|case file)\w*/i],
  ["productivity", /\b(task|project|notes?|docs?|workflow|meeting|dashboard|team)\w*/i],
];
const MOOD_OF: Record<BrandCategory, Mood> = { "clinic & health": "calm", "online shop": "energetic", "customer support": "professional", "finance & payments": "professional", education: "playful", "restaurant & food": "playful", "real estate": "premium", "hr & teams": "professional", marketing: "energetic", productivity: "calm", "developer tools": "premium", logistics: "professional", "travel & booking": "playful", fitness: "energetic", legal: "premium", other: "professional" };
const PERSONALITY: Record<Mood, string[]> = { calm: ["calm", "caring", "clear"], professional: ["reliable", "precise", "clear"], energetic: ["bold", "fast", "confident"], playful: ["friendly", "bright", "light"], premium: ["refined", "confident", "quiet"] };
const LOOK: Record<Mood, BrandProfile["look"]> = {
  calm: { scheme: "light", face: "humanist", energy: 0.3 },
  professional: { scheme: "light", face: "geometric", energy: 0.45 },
  energetic: { scheme: "mixed", face: "condensed", energy: 0.75 },
  playful: { scheme: "light", face: "rounded", energy: 0.65 },
  premium: { scheme: "dark", face: "serif", energy: 0.4 },
};
const OLD_WAYS = ["phone calls", "paper notes", "paper", "spreadsheets", "spreadsheet", "excel", "emails", "email", "whatsapp", "sticky notes", "notebooks", "manual", "by hand"];
const STOP = new Set(["their", "there", "every", "about", "which", "where", "while", "would", "could", "should", "again", "other", "these", "those", "still", "into", "your", "with", "from", "that", "this", "what", "when", "they", "them", "then", "than", "just", "more", "most", "only", "over", "some", "such", "very", "will", "have", "been", "were"]);

export function ruleProfile(input: { name: string; script: string; category?: string | null; website?: { title?: string | null; description?: string | null; text?: string | null } | null }): BrandProfile {
  const text = [input.script, input.website?.title, input.website?.description, input.website?.text?.slice(0, 3000)].filter(Boolean).join(" ");
  const chosen = (BRAND_CATEGORIES as readonly string[]).includes(input.category ?? "") ? (input.category as BrandCategory) : null;
  const category = chosen ?? CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? "other";
  const mood = MOOD_OF[category];
  const lower = input.script.toLowerCase();
  const words = input.script.match(/[A-Za-z][A-Za-z'-]+/g) ?? [];
  const keywords = [...new Set(words.filter((w) => w.length > 5 && !STOP.has(w.toLowerCase()) && w.toLowerCase() !== input.name.toLowerCase()))].sort((a, b) => b.length - a.length).slice(0, 6);
  const numbers = [...new Set(input.script.match(/\b(\d[\d,.]*\s?(%|x|×|hours?|minutes?|days?|k)?|twice|double|half|ten times)\b/gi) ?? [])].slice(0, 4);
  const sentences = input.script.split(/(?<=[.!?।॥])\s+/);
  return {
    category,
    personality: PERSONALITY[mood],
    mood,
    audience: "",
    promise: (sentences.find((s) => s.toLowerCase().includes(input.name.toLowerCase())) ?? sentences[1] ?? "").slice(0, 120),
    features: [],
    before: OLD_WAYS.filter((w) => lower.includes(w)).slice(0, 3),
    keywords,
    numbers,
    look: LOOK[mood],
    source: "rule",
  };
}

// ── the creative plan by rule ──────────────────────────────────────────────
// Which camera languages suit a mood (the seed and what the brand had before decide among them).
export const LANGUAGE_WEIGHTS: Record<Mood, Partial<Record<Language, number>>> = {
  calm: { cuts: 1, line: 2, timeline: 1.5, scroll: 1, depth: 1.2, flip: 0.5, tiles: 1, map: 0.8, carry: 1, words: 1, guide: 0.8, whip: 0.2, turn: 0.3 },
  professional: { cuts: 1, line: 1.5, timeline: 1.5, tiles: 1.5, map: 1.2, scroll: 1.2, carry: 1.5, words: 1, depth: 1, flip: 0.6, guide: 0.6, whip: 0.4, turn: 0.5 },
  energetic: { whip: 2, turn: 1.5, carry: 1.5, guide: 1.2, line: 1, words: 1, depth: 1.2, flip: 1, tiles: 0.8, cuts: 0.5, timeline: 0.5, map: 0.6, scroll: 0.6 },
  playful: { guide: 2, carry: 1.5, turn: 1.2, flip: 1.2, line: 1, words: 1.2, tiles: 1, whip: 1, depth: 0.8, map: 0.8, cuts: 0.6, timeline: 0.6, scroll: 0.8 },
  premium: { depth: 2, line: 1.5, map: 1.2, carry: 1.2, words: 1, cuts: 1, tiles: 1, scroll: 0.8, timeline: 0.8, guide: 0.6, flip: 0.6, whip: 0.5, turn: 0.5 },
};
const MOTIF_OF: Record<BrandCategory, { icon: string; label: string }> = {
  "clinic & health": { icon: "calendar-check", label: "Booked" },
  "online shop": { icon: "shopping-bag", label: "New order" },
  "customer support": { icon: "message-square", label: "Replied" },
  "finance & payments": { icon: "receipt", label: "Paid" },
  education: { icon: "graduation-cap", label: "Done" },
  "restaurant & food": { icon: "utensils", label: "Order up" },
  "real estate": { icon: "home", label: "Let" },
  "hr & teams": { icon: "briefcase", label: "Approved" },
  marketing: { icon: "megaphone", label: "Live" },
  productivity: { icon: "check-circle", label: "Done" },
  "developer tools": { icon: "code", label: "Shipped" },
  logistics: { icon: "truck", label: "Delivered" },
  "travel & booking": { icon: "plane", label: "Booked" },
  fitness: { icon: "dumbbell", label: "Done" },
  legal: { icon: "file-check", label: "Signed" },
  other: { icon: "sparkles", label: "Done" },
};
const PATHS: JourneyKind[] = ["right", "zigzag", "down", "diagonal", "snake"];
const stir = (x: number) => {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};
export function pickLanguage(mood: Mood, seed: number, recent: (Language | null | undefined)[] = []): Language {
  const R = rng(stir(seed ^ 0x2545f491) || 1);
  const weights = LANGUAGE_WEIGHTS[mood];
  const list = IN_USE.map((l) => [l, (weights[l] ?? 0.5) * recent.reduce((w, r, i) => (r === l ? w * (0.15 + 0.5 * (i / Math.max(1, recent.length))) : w), 1)] as const);
  const sum = list.reduce((a, [, w]) => a + w, 0);
  let x = R.next() * sum;
  for (const [l, w] of list) if ((x -= w) <= 0) return l;
  return list[list.length - 1][0];
}

// A word that ends a sentence (the Bengali দাঁড়ি "।" too).
export const SENTENCE_END = /[.!?।॥]["”’)]*$/;

// The sentences of the narration (word index ranges).
export function sentencesOf(words: Word[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let from = 0;
  words.forEach((w, i) => {
    if (SENTENCE_END.test(w.text) || i === words.length - 1) {
      out.push({ from, to: i });
      from = i + 1;
    }
  });
  return out;
}

export function ruleCreative(profile: BrandProfile, words: Word[], brandName: string, seed: number, recent: (Language | null | undefined)[] = [], recentShapes: (StoryShape | null | undefined)[] = [], fixed?: StoryShape): CreativePlan {
  const R = rng(stir(seed ^ 0x68e31da4) || 1);
  const sentences = sentencesOf(words);
  const textOf = (s: { from: number; to: number }) => words.slice(s.from, s.to + 1).map((w) => w.text).join(" ");
  const name = brandName.toLowerCase();
  const turnS = sentences.findIndex((s) => textOf(s).toLowerCase().includes(name));
  const turnI = turnS > 0 ? turnS : Math.max(1, Math.round(sentences.length / 3));
  const numbered = sentences.findIndex((s, i) => i >= turnI && /\d|twice|double|half/i.test(textOf(s)));
  const heroS = numbered >= 0 ? numbered : Math.min(sentences.length - 1, turnI);
  const texts = sentences.map(textOf);
  const shape = fixed ?? ruleShape(texts, brandName, seed, recentShapes);
  const kinds = beatsOf(shape, texts, turnI);
  const beats = sentences.map((s, i): { at: number; beat: Beat } => ({ at: s.from, beat: kinds[i] }));
  const language = pickLanguage(profile.mood, seed, recent);
  const journey = ["line", "carry", "words", "guide"].includes(language) ? PATHS[Math.floor(R.next() * PATHS.length) % PATHS.length] : null;
  const old = profile.before[0];
  return {
    idea: (old ? `From ${old} to ${brandName}` : profile.promise ? profile.promise.replace(/[.!?।]+$/, "") : `${brandName}: one calm place for the whole job`).slice(0, 120),
    motif: MOTIF_OF[profile.category],
    hero: sentences[heroS]?.from ?? 0,
    // (told demo-first or feature-led: the product is there from the start)
    turn: shape === "demo-first" || shape === "feature-led" ? 0 : (sentences[turnI]?.from ?? 0),
    beats,
    shape,
    language,
    journey,
    guide: language === "guide" ? (["plane", "cursor", "orb"] as const)[Math.floor(R.next() * 3) % 3] : null,
    recap: R.next() < 0.6,
    scheme: profile.look.scheme,
    source: "rule",
  };
}
