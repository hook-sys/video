import type { Ctx } from "../kit";
import type { CameraKind, HeroT, Word } from "../types";
import { GrowthChart } from "./growth_chart";
import { LogoEnd } from "./logo_end";
import { HERO_CAMERAS, resolveHero } from "./slots";

// Draws a v2 hero for this scene. Null when a required slot is missing
// (no uploaded logo, no metric label): the caller keeps the kinetic scene.
export function heroNode(raw: HeroT | null | undefined, camera: CameraKind, c: Ctx, words: Word[], from: number, to: number, si: number) {
  const hero = resolveHero(raw, words, c.brand);
  if (!hero) return null;
  const list = HERO_CAMERAS[hero.id];
  const cam = list.includes(camera) ? camera : list[hero.variant % list.length];
  const props = { hero, camera: cam, c, words, from, to, si };
  return hero.id === "logo_end" ? <LogoEnd {...props} /> : <GrowthChart {...props} />;
}
