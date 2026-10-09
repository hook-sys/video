import "server-only";
import { composeVariants } from "@/components/video/composer/variants";
import { FPS, type ComposerPlan } from "@/components/video/composer/types";
import { estimateWords, spokenCueTimes } from "@/lib/voice-timing";
import { HERO_BRAND, HERO_NARRATION, HERO_SECONDS } from "./hero-scene";

export type HeroCaption = { text: string; frame: number };

// Composed once per server (the script is fixed): the plan for the Player and
// the frame each line of the narration starts on, for the synced caption.
let cached: { plan: ComposerPlan; captions: HeroCaption[] } | null = null;

export function heroPlan() {
  if (cached) return cached;
  const words = estimateWords(HERO_NARRATION, HERO_SECONDS);
  const plan = composeVariants({ words, brand: HERO_BRAND, duration: HERO_SECONDS * FPS, seed: 2026, count: 1, creative: { language: "line", journey: "zigzag", recap: false } }).plans[0];
  const lines = HERO_NARRATION.match(/[^.]+\./g)!.map((l) => l.trim());
  const times = spokenCueTimes(lines, words);
  const captions = lines.map((text, i) => ({ text, frame: Math.round((times[i] ?? 0) * FPS) }));
  cached = { plan, captions };
  return cached;
}
