import "server-only";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import type { FlowPlan } from "@/components/video/flow/types";
import { FPS } from "@/components/video/types";
import { estimateWords } from "@/lib/flow-script";
import { repairSceneScript } from "@/lib/scene-script";
import { spokenCueTimes } from "@/lib/voice-timing";
import { HERO_BRAND, HERO_NARRATION, HERO_SCRIPT, HERO_SECONDS } from "./hero-scene";

export type HeroCaption = { text: string; frame: number };

// Compiled once per server (the script is fixed): the plan for the Player and
// the frame each line of the narration starts on, for the synced caption.
let cached: { plan: FlowPlan; captions: HeroCaption[] } | null = null;

export function heroPlan() {
  if (cached) return cached;
  const plan = compileSceneScript(repairSceneScript(HERO_SCRIPT), {
    narration: HERO_NARRATION,
    durationSeconds: HERO_SECONDS,
    brand: { ...HERO_BRAND, logo: "/icon.svg" },
  });
  const lines = HERO_NARRATION.match(/[^.]+\./g)!.map((l) => l.trim());
  const times = spokenCueTimes(lines, estimateWords(HERO_NARRATION, HERO_SECONDS));
  const captions = lines.map((text, i) => ({ text, frame: Math.round((times[i] ?? 0) * FPS) }));
  cached = { plan, captions };
  return cached;
}
