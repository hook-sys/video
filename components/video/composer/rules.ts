import { isAccent } from "./layout";
import type { ScriptT, TransitionKind } from "./types";

// The house rules (docs/video-never-list.md, video-do-list.md,
// style-reference.md) as the Composer keeps them, whoever directed the video
// (the AI Director is told them too — lib/ai/house-rules.ts — but a rule that
// can be kept by construction is kept here):
//  - one hero, at most 2 supporting things per scene (badges and decor aside);
//  - at most 3 kinds of way in for the whole video;
//  - one calm background: a "mixed" video turns dark ↔ light once, at the turn
//    of the story (the problem dark, the product light), never scene by scene;
//  - no busy animated backgrounds (beams, streaks, particles) in an explainer.

const BUSY_FIELDS = new Set(["beams", "streaks"]);
const CALM_FIELDS = ["aurora", "mesh", "spot", "waves", "dots", "discs"] as const;

// `turn`: the scene where the story turns (the product arrives); a mixed
// video is dark before it and light from it.
export function houseRules(script: ScriptT, turn?: number | null): ScriptT {
  const scenes = script.scenes.map((s) => {
    if (s.items.filter((it) => !isAccent(it)).length <= 3) return s;
    // keep the first three (the Director's order is its order of importance)
    let kept = 0;
    return { ...s, items: s.items.filter((it) => isAccent(it) || kept++ < 3) };
  });
  // at most 3 kinds of way in: the rarer ones become the most used
  const counts = new Map<TransitionKind, number>();
  scenes.slice(1).forEach((s) => counts.set(s.enter, (counts.get(s.enter) ?? 0) + 1));
  const kept = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const main = kept[0] ?? "fade";
  const withEnters = scenes.map((s, i) => (i && !kept.includes(s.enter) ? { ...s, enter: main } : s));
  // one background: dark or light throughout, or one turn from dark to light
  let out = withEnters.map((s) => ({ ...s, dark: script.art.scheme === "dark" }));
  if (script.art.scheme === "mixed" && withEnters.length > 1) {
    const at = Math.max(1, Math.min(withEnters.length - 1, turn ?? Math.round(withEnters.length / 3)));
    out = withEnters.map((s, i) => ({ ...s, dark: i < at }));
  }
  const art = { ...script.art };
  if (BUSY_FIELDS.has(art.field)) art.field = CALM_FIELDS[Math.abs(Math.round(art.hue)) % CALM_FIELDS.length];
  if (art.overlay === "particles") art.overlay = "grain";
  return { art, scenes: out };
}
