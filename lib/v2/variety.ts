import { DISPLAY_FACES, TEXT_FACES, rng } from "@/components/video/composer/art";
import { RECIPES } from "@/components/video/composer/recipes";
import { CAMERA, CUT_SETS, groundIsDark } from "@/components/video/composer/style";
import { CAMERAS, HARMONIES, type CameraKind, type LayoutKind, type TransitionKind } from "@/components/video/composer/types";
import type { Variety } from "@/components/video/composer/variants";

// "New version": every video gets a fresh random seed that draws its look —
// built on one of the reference recipes (recipes.ts; the code's look, never
// the Director's style): its palette treatment (harmony + the recipe's dark
// or light ground), its font pairing, a set of layouts, its ways in (the
// recipe's cuts) and its camera (the recipe's rhythm), and a hue for a logo
// without colour. Kept with the project (projects.details.look) and unlike
// the customer's last five looks wherever the choices allow.

export type V2Look = Variety & { seed: number; recipe: string; hue: number };

// (every set holds center and one more general layout, so a scene whose
// things fit none of the special ones still has one in the set)
const GENERAL: LayoutKind[] = ["top", "bottom", "split-left", "split-right"];
const OTHERS: LayoutKind[] = ["split-left", "split-right", "corner", "visual", "inline", "label", "caption", "around", "between", "top", "bottom"];
// (soft entries — the motion rule: never a clock wipe, a flip or a drop)
const HARD: TransitionKind[] = ["clock", "flip", "drop"];
const DISPLAYS = DISPLAY_FACES.map((f) => f.slug).filter((s) => s !== "inter");
const TEXTS = TEXT_FACES.map((f) => f.slug);

export const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;

// One look from the seed, unlike `recent` (the customer's last five) in as
// many ways as it can be. `recipes`: the references the team allows (admin →
// Settings, "Looks: references"; null: all); `soft`: soft ways in only;
// `noMacro`: the macro camera is turned off ("Techniques").
export function drawLook(seed: number, recent: Partial<V2Look>[], { soft = true, noMacro = false, recipes = null }: { soft?: boolean; noMacro?: boolean; recipes?: string[] | null } = {}): V2Look {
  const R = rng(seed);
  const pool = RECIPES.filter((r) => !recipes || recipes.includes(r.id));
  const usable = pool.length ? pool : RECIPES;
  const key = (xs: readonly string[] | undefined) => [...(xs ?? [])].sort().join(",");
  const repeats = (l: V2Look) =>
    recent.filter((r) => r.recipe === l.recipe).length * 4 +
    recent.filter((r) => r.display === l.display).length * 3 +
    recent.filter((r) => r.display === l.display && r.text === l.text).length * 2 +
    recent.filter((r) => r.harmony === l.harmony && r.scheme === l.scheme).length * 2 +
    recent.filter((r) => r.camera === l.camera).length +
    recent.filter((r) => key(r.transitions) === key(l.transitions)).length +
    recent.filter((r) => key(r.layouts) === key(l.layouts)).length;
  let best: V2Look | null = null;
  let bestScore = Infinity;
  for (let k = 0; k < 60 && bestScore > 0; k++) {
    const recipe = R.pick(usable);
    const faces = recipe.faces?.filter((f) => DISPLAYS.includes(f)) ?? [];
    const display = faces.length && R.chance(0.7) ? R.pick(faces) : R.pick(DISPLAYS);
    const cameras = (recipe.style.rhythm ? CAMERA[recipe.style.rhythm] : CAMERAS).filter((c) => c !== "still" && !(noMacro && c === "macro")) as CameraKind[];
    const cuts = recipe.style.cuts ? CUT_SETS[recipe.style.cuts] : CUT_SETS.soft;
    const look: V2Look = {
      seed,
      recipe: recipe.id,
      hue: R.int(0, 359),
      harmony: R.pick(HARMONIES),
      scheme: recipe.style.ground && groundIsDark(recipe.style.ground) ? "dark" : "light",
      display,
      text: R.pick(TEXTS.filter((t) => t !== display)),
      camera: R.pick(cameras.length ? cameras : (["drift", "push"] as CameraKind[])),
      transitions: [...new Set(cuts.map((t) => (soft && HARD.includes(t) ? "fade" : t)))],
      layouts: ["center" as LayoutKind, R.pick(GENERAL), ...pickSome(R, OTHERS, 6)].filter((l, i, xs) => xs.indexOf(l) === i).slice(0, 7),
    };
    const score = repeats(look);
    if (score < bestScore) [best, bestScore] = [look, score];
  }
  return best!;
}

function pickSome<T>(R: ReturnType<typeof rng>, xs: readonly T[], n: number): T[] {
  const pool = [...xs];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(R.next() * pool.length) % pool.length, 1)[0]);
  return out;
}

// A stored look read back defensively (null: none, or not one of ours).
export function lookOf(raw: unknown): V2Look | null {
  const l = raw as Partial<V2Look> | null;
  if (!l || typeof l !== "object" || typeof l.seed !== "number" || typeof l.recipe !== "string" || typeof l.hue !== "number" || typeof l.display !== "string" || typeof l.text !== "string" || !Array.isArray(l.transitions) || !l.transitions.length || !Array.isArray(l.layouts) || !l.layouts.length) return null;
  if (!(HARMONIES as readonly string[]).includes(String(l.harmony)) || (l.scheme !== "dark" && l.scheme !== "light") || !(CAMERAS as readonly string[]).includes(String(l.camera))) return null;
  return l as V2Look;
}

// A brand colour from the look's hue (a logo without colour): vivid, mid-light.
export function hueColour(hue: number): string {
  const s = 0.68, l = 0.52;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// The look as the Director is told it (it plans inside it; the code keeps it).
export const lookText = (l: V2Look) => {
  const r = RECIPES.find((x) => x.id === l.recipe);
  return `THIS VIDEO'S LOOK (drawn for this video so no two look alike — plan inside it): its style is built in code from the reference ${r ? `"${r.from}" (${r.note})` : l.recipe} — your "style" answer is not used; staging.scheme ${l.scheme} (choose a ${l.scheme} ground); palette harmony ${l.harmony} around the brand colour; faces ${l.display} for headlines and ${l.text} for the rest; camera ${l.camera}; ways into scenes only ${l.transitions.join(", ")}; layouts only ${l.layouts.join(", ")} (a words-only scene may use type). Make it unlike RECENT.`;
};
