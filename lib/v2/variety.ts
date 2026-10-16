import { DISPLAY_FACES, TEXT_FACES, rng } from "@/components/video/composer/art";
import { CAMERAS, HARMONIES, type CameraKind, type LayoutKind, type TransitionKind } from "@/components/video/composer/types";
import type { Variety } from "@/components/video/composer/variants";

// "New version": every video gets a fresh random seed that draws its look —
// the palette treatment (harmony + dark or light), the font pairing, the set
// of layouts, the ways into its scenes and the camera. The look is stored
// with the project (projects.details.look) and is unlike the customer's last
// five looks wherever the choices allow.

export type V2Look = Variety & { seed: number };

const GENERAL: LayoutKind[] = ["center", "top", "bottom"];
const OTHERS: LayoutKind[] = ["split-left", "split-right", "corner", "visual", "inline", "label", "caption", "around", "between", "center", "top", "bottom"];
const ALL_TRANSITIONS: TransitionKind[] = ["blur", "fade", "push-left", "push-right", "push-up", "push-down", "zoom-in", "zoom-out", "whip", "iris", "wipe", "morph", "flip", "drop", "clock"];
// (soft entries — the motion rule: never flip, drop or a clock wipe)
const SOFT_TRANSITIONS: TransitionKind[] = ["blur", "fade", "push-left", "push-right", "push-up", "push-down", "zoom-in", "zoom-out", "whip", "iris", "wipe", "morph"];
const DISPLAYS = DISPLAY_FACES.map((f) => f.slug).filter((s) => s !== "inter");
const TEXTS = TEXT_FACES.map((f) => f.slug);

export const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;

// One look from the seed, unlike `recent` (the customer's last five) in as
// many ways as it can be; `soft`: soft ways in only; `noMacro`: the macro
// camera is turned off (admin → Settings, "Techniques").
export function drawLook(seed: number, recent: Partial<V2Look>[], { soft = true, noMacro = false }: { soft?: boolean; noMacro?: boolean } = {}): V2Look {
  const R = rng(seed);
  const cameras = CAMERAS.filter((c) => c !== "still" && !(noMacro && c === "macro")) as CameraKind[];
  const transitions = soft ? SOFT_TRANSITIONS : ALL_TRANSITIONS;
  const key = (xs: readonly string[] | undefined) => [...(xs ?? [])].sort().join(",");
  const repeats = (l: V2Look) =>
    recent.filter((r) => r.display === l.display).length * 3 +
    recent.filter((r) => r.display === l.display && r.text === l.text).length * 2 +
    recent.filter((r) => r.harmony === l.harmony && r.scheme === l.scheme).length * 2 +
    recent.filter((r) => r.camera === l.camera).length +
    recent.filter((r) => key(r.transitions) === key(l.transitions)).length +
    recent.filter((r) => key(r.layouts) === key(l.layouts)).length;
  let best: V2Look | null = null;
  let bestScore = Infinity;
  for (let k = 0; k < 40 && bestScore > 0; k++) {
    const display = R.pick(DISPLAYS);
    const look: V2Look = {
      seed,
      harmony: R.pick(HARMONIES),
      scheme: R.chance(0.5) ? "dark" : "light",
      display,
      text: R.pick(TEXTS.filter((t) => t !== display)),
      camera: R.pick(cameras),
      transitions: pickSome(R, transitions, 3),
      layouts: [R.pick(GENERAL), ...pickSome(R, OTHERS, 6)].filter((l, i, xs) => xs.indexOf(l) === i).slice(0, 6),
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
  if (!l || typeof l !== "object" || typeof l.seed !== "number" || typeof l.display !== "string" || typeof l.text !== "string" || !Array.isArray(l.transitions) || !l.transitions.length || !Array.isArray(l.layouts) || !l.layouts.length) return null;
  if (!(HARMONIES as readonly string[]).includes(String(l.harmony)) || (l.scheme !== "dark" && l.scheme !== "light") || !(CAMERAS as readonly string[]).includes(String(l.camera))) return null;
  return l as V2Look;
}

// The look as the Director is told it (it plans inside it; the code keeps it).
export const lookText = (l: V2Look) =>
  `THIS VIDEO'S LOOK (drawn for this video so no two look alike — plan inside it): staging.scheme ${l.scheme} (choose a ${l.scheme} ground); palette harmony ${l.harmony} around the brand colour; faces ${l.display} for headlines and ${l.text} for the rest; camera ${l.camera}; ways into scenes only ${l.transitions.join(", ")}; layouts only ${l.layouts.join(", ")} (a words-only scene may use type).`;
