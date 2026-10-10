// The voices customers choose from (ElevenLabs preset voices on the voice
// model set on /admin/models), each with what it suits and a 5-second sample
// (public/voices/<name>.mp3, made with app/internal/voice-sample).
// /admin/models → voice choices decides which of them are offered.

export type VoiceInfo = { name: string; gender: "female" | "male"; accent: "American" | "British"; tone: string; bestFor: string };

export const VOICE_LIBRARY: VoiceInfo[] = [
  { name: "Rachel", gender: "female", accent: "American", tone: "Calm, clear", bestFor: "Product walkthroughs and explainers" },
  { name: "Sarah", gender: "female", accent: "American", tone: "Soft, reassuring", bestFor: "Finance, health and trust-first brands" },
  { name: "Jessica", gender: "female", accent: "American", tone: "Bright, youthful", bestFor: "Apps, social ads and consumer products" },
  { name: "Matilda", gender: "female", accent: "American", tone: "Warm, friendly", bestFor: "Onboarding, education and friendly SaaS" },
  { name: "Lily", gender: "female", accent: "British", tone: "Smooth, elegant", bestFor: "Premium and design-led brands" },
  { name: "Brian", gender: "male", accent: "American", tone: "Deep, confident", bestFor: "B2B SaaS, launches and narration" },
  { name: "Eric", gender: "male", accent: "American", tone: "Smooth, trustworthy", bestFor: "Sales demos and business tools" },
  { name: "Roger", gender: "male", accent: "American", tone: "Relaxed, easy-going", bestFor: "Casual explainers and lifestyle" },
  { name: "George", gender: "male", accent: "British", tone: "Warm storyteller", bestFor: "Brand stories and premium products" },
  { name: "Daniel", gender: "male", accent: "British", tone: "Authoritative, crisp", bestFor: "Corporate, fintech and announcements" },
];

export const voiceInfo = (name: string | null | undefined) => VOICE_LIBRARY.find((v) => v.name.toLowerCase() === (name ?? "").toLowerCase()) ?? null;
export const voiceSample = (name: string) => `/voices/${name.toLowerCase()}.mp3`;
