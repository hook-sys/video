import manifest from "@/public/hero3d/manifest.json";

// The premium 3D hero objects (Priority A), rendered by scripts/hero3d and
// gated by scripts/hero3d/quality.mjs. Not wired into the Director or the
// recipe workflow yet: this is the registry they will read from.
//
// Each view has a beauty layer (transparent background), a white accent mask
// to tint with the brand colour, and a separate contact shadow. The turntable
// is 24 frames from 0° to 60° yaw at the 3/4 elevation (for orbit).

export const HERO_IDS = [
  "hero:payment-card",
  "hero:chart-block",
  "hero:padlock",
  "hero:ai-chip",
  "hero:document-stack",
  "hero:chat-bubble",
] as const;
export type HeroId = (typeof HERO_IDS)[number];
export type HeroView = "front" | "three-quarter" | "side";

export type HeroAsset = {
  size: number;
  views: Record<HeroView, { beauty: string; accent: string; shadow: string; yaw: number; elevation: number }>;
  turntable: { frames: number; yawFrom: number; yawTo: number; elevation: number; pattern: string };
  score: number | null;
  production: boolean;
  notes: string;
};

export const HERO_ASSETS = manifest as Record<HeroId, HeroAsset>;

// Only reviewed objects scoring 90+ may be used as a hero.
export const HERO_ALLOWLIST: HeroId[] = HERO_IDS.filter((id) => HERO_ASSETS[id]?.production);

export const heroTurntableFrame = (id: HeroId, frame: number) =>
  `/hero3d/${id.slice(5)}/turntable/${String(Math.max(0, Math.min(23, Math.round(frame)))).padStart(2, "0")}.webp`;
