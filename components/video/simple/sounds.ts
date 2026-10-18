import { keyIconOf } from "./kit";
import { clickOf } from "./more";
import { MOTION_DELAY, MOTION_SOUND, motionOf } from "./motion";
import { thingAt } from "./scenes";
import type { Scene, SimplePlan } from "./types";

// The film's sounds, as times (film.tsx plays them; the check counts them).
// No music.

// frames a way between scenes takes (half before the cut, half after)
export const T = 18;
// the sounds there are (public/sfx)
// how long each lasts, in frames (its file's length, a little over)
export const SOUND_FRAMES: Record<string, number> = { whoosh: 20, soft_pop: 7, click: 5, typing: 25, digital_processing: 27, reveal: 30, subtle_impact: 20, success_chime: 36, tick: 6, ding: 30, rise: 17, shimmer: 18, lock: 8 };
// sounds heard at once, at most (with the voice, within the player's 5 audio tags)
export const MOST_AT_ONCE = 3;
export const SOUND_NAMES = ["whoosh", "soft_pop", "click", "typing", "digital_processing", "reveal", "subtle_impact", "success_chime", "tick", "ding", "rise", "shimmer", "lock"];

// (the templates whose things come in with their icons)
const ICONED = new Set(["trouble", "compare", "reveal", "feature", "messages", "bento", "steps"]);
// typing heard while letters are typed (the clip is 0.75 s; again every 21 frames until done)
const typed = (from: number, to: number) => Array.from({ length: Math.max(1, Math.ceil((to - from) / 21)) }, (_, k) => ({ at: from + k * 21, name: "typing", volume: 0.16 }));

// a whoosh as each scene comes in, a pop as things come in, a click on each
// click, a chime at the end; an icon's own sound as it does what it means (the
// first in a scene only), the keys as letters are typed
export function soundsOf(plan: SimplePlan): { at: number; name: string; volume: number }[] {
  const out: { at: number; name: string; volume: number }[] = [];
  plan.scenes.forEach((s: Scene, i) => {
    if (i) out.push({ at: Math.max(0, s.from - T / 2), name: "whoosh", volume: 0.22 });
    if (s.items.length && s.template !== "statement" && s.template !== "stat") out.push({ at: s.from + 10, name: "soft_pop", volume: 0.3 });
    if (s.template === "stat" || s.template === "reveal") out.push({ at: s.from + 8, name: s.template === "stat" ? "subtle_impact" : "reveal", volume: 0.36 });
    const moves: { at: number; m: NonNullable<ReturnType<typeof motionOf>> }[] = [];
    const key = keyIconOf(s);
    const km = key && motionOf(key.name);
    if (key && km) moves.push({ at: key.at + MOTION_DELAY, m: km });
    const hm = s.template === "statement" && s.variant === 1 ? motionOf(s.icon) : null;
    if (hm) moves.push({ at: s.from + 12 + MOTION_DELAY, m: hm });
    if (ICONED.has(s.template)) {
      const k = s.items.findIndex((it) => motionOf(it.icon ?? s.icon));
      if (k >= 0) moves.push({ at: thingAt(s, k, s.items.length) + MOTION_DELAY, m: motionOf(s.items[k].icon ?? s.icon)! });
    }
    const first = moves.sort((a, b) => a.at - b.at)[0];
    // (the icon's own sound in place of the scene's pop, never both)
    if (first) {
      const pop = out.findIndex((e) => e.name === "soft_pop" && e.at === s.from + 10);
      if (pop >= 0) out.splice(pop, 1);
      out.push({ at: first.at, ...MOTION_SOUND[first.m] });
    }
    if (s.template === "kinetic" && s.variant === 1 && s.words.length) out.push(...typed(s.words[0].at - 2, s.words.at(-1)!.at + s.words.at(-1)!.t.length * 1.6));
    if (s.template === "feature" && s.variant === 2 && s.items.length) out.push(...typed(s.from + 12, s.from + 12 + s.items[0].text.length * 2));
    const click = clickOf(s, !!plan.brand.cta.trim());
    if (click != null) out.push({ at: click, name: "click", volume: 0.45 });
    if (s.template === "cta" && click != null) out.push({ at: click + 10, name: "success_chime", volume: 0.32 });
  });
  const spaced = out.filter((e) => e.at < plan.duration - 6).sort((a, b) => a.at - b.at).filter((e, i, a) => !i || e.at - a[i - 1].at >= 9);
  // (never more than MOST_AT_ONCE sounding together: a later one that would be is left out)
  const kept: typeof spaced = [];
  for (const e of spaced) if (kept.filter((k) => k.at + (SOUND_FRAMES[k.name] ?? 30) > e.at).length < MOST_AT_ONCE) kept.push(e);
  return kept;
}
