import { composeVariants } from "@/components/video/composer/variants";
import { BOOKWELL, FLOWLY, SHOPNEST, durationOf, type Fixture } from "@/components/video/composer/fixtures";
import type { ComposerPlan, GuideKind, JourneyKind } from "@/components/video/composer/types";
import type { Language } from "@/components/video/composer/staging";
import { moves } from "@/components/video/composer/journey";

// The plans the parity check renders both ways: Composer videos of the three
// fixture narrations, one per camera language (cuts with the composed
// layouts and plated captions, journeys with a line, a carried thing and a
// guide, depth, a flip, a turn, and the structures), so every way the film
// draws is compared with the download.
const LANGS: [string, Fixture, Language, JourneyKind | null, GuideKind | null][] = [
  ["cuts", BOOKWELL, "cuts", null, null],
  ["line + recap", FLOWLY, "line", "zigzag", null],
  ["carry", SHOPNEST, "carry", "right", null],
  ["guide", BOOKWELL, "guide", "snake", "plane"],
  ["depth", FLOWLY, "depth", null, null],
  ["flip", SHOPNEST, "flip", null, null],
  ["turn", BOOKWELL, "turn", null, null],
  ["whip", FLOWLY, "whip", null, null],
  ["timeline", FLOWLY, "timeline", null, null],
  ["tiles", SHOPNEST, "tiles", null, null],
  ["scroll", BOOKWELL, "scroll", null, null],
];

export function parityPlans(): { name: string; plan: ComposerPlan }[] {
  return LANGS.map(([name, fx, language, journey, guide], i) => {
    const set = composeVariants({ words: fx.words, brand: fx.brand, duration: durationOf(fx), seed: 900 + i * 37, count: 1, creative: { language, journey, guide, recap: true } });
    return { name: `${fx.brand.name} · ${name} (${set.videos[0].staging?.language ?? "cuts"})`, plan: set.plans[0] };
  });
}

// Whether frame f is inside a move from one scene to the next (the camera's
// moves on a canvas or into depth; a cut's way in) — give or take a few frames.
export function movingAt(plan: ComposerPlan, f: number): boolean {
  const staged = !!plan.journey || (plan.links ?? []).some(Boolean) || !!plan.link;
  if (staged) return moves(plan).some((m, i) => i > 0 && f >= m.start - 4 && f <= m.start + m.dur + 4);
  return plan.scenes.some((sc, k) => k > 0 && Math.abs(f - sc.from) <= 30);
}
