import { DISPLAY_FACES, TEXT_FACES, rng } from "@/components/video/composer/art";
import { RECIPES } from "@/components/video/composer/recipes";
import { CAMERA, CUT_SETS, groundIsDark } from "@/components/video/composer/style";
import { ENERGY } from "@/components/video/composer/flow";
import { CAMERAS, ENERGIES, HARMONIES, type CameraKind, type Energy, type KeyStyle, type LayoutKind, type TransitionKind } from "@/components/video/composer/types";
import type { Variety } from "@/components/video/composer/variants";
import type { V2Flow } from "@/lib/v2/rules";

// "New version": every video gets a fresh random seed that draws its look —
// built on one of the reference recipes (recipes.ts; the code's look, never
// the Director's style): its palette treatment (harmony + the recipe's dark
// or light ground), its font pairing, a set of layouts, its ways in (the
// recipe's cuts) and its camera (the recipe's rhythm), and a hue for a logo
// without colour. Kept with the project (projects.details.look) and unlike
// the customer's last five looks wherever the choices allow.

// energy: calm, medium or lively (its springs, pace and ways between scenes —
// composer/flow.ts); key: how the keyword is lit. (Looks drawn before them
// have neither: read as medium and the brand colour.)
export type V2Look = Variety & { seed: number; recipe: string; hue: number; energy?: Energy; key?: KeyStyle };
const KEY_LOOKS: KeyStyle[] = ["color", "pill"];

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
    recent.filter((r) => key(r.layouts) === key(l.layouts)).length +
    recent.filter((r) => r.energy === l.energy).length * 2;
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
      energy: R.pick(ENERGIES),
      key: R.pick(KEY_LOOKS),
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

// What the Composer is given (variants.ts Variety): the look, and the
// premium motion (composer/flow.ts) with the parts the rules leave on.
export function varietyOf(l: V2Look, flow: V2Flow, noMacro = false): Variety {
  const energy = l.energy ?? "medium";
  return {
    ...l,
    flow: {
      energy,
      cameras: flow.camera ? ENERGY[energy].cameras.filter((c) => !(noMacro && c === "macro")) : null,
      key: flow.keyword ? (l.key ?? "color") : null,
      depth: flow.depth,
      cursor: flow.cursor,
      continuous: flow.continuous,
      pieces: flow.pieces,
    },
  };
}

// A stored look read back defensively (null: none, or not one of ours).
export function lookOf(raw: unknown): V2Look | null {
  const l = raw as Partial<V2Look> | null;
  if (!l || typeof l !== "object" || typeof l.seed !== "number" || typeof l.recipe !== "string" || typeof l.hue !== "number" || typeof l.display !== "string" || typeof l.text !== "string" || !Array.isArray(l.transitions) || !l.transitions.length || !Array.isArray(l.layouts) || !l.layouts.length) return null;
  if (!(HARMONIES as readonly string[]).includes(String(l.harmony)) || (l.scheme !== "dark" && l.scheme !== "light") || !(CAMERAS as readonly string[]).includes(String(l.camera))) return null;
  // (looks drawn before the energy: none kept, read as medium)
  return { ...(l as V2Look), energy: (ENERGIES as readonly string[]).includes(String(l.energy)) ? l.energy : undefined, key: KEY_LOOKS.includes(l.key as KeyStyle) ? l.key : undefined };
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
// `flow`: the premium motion's parts that are on (its ways between scenes,
// a camera move per scene) — off, the look's own ways in and camera.
const SHARE: Record<Energy, string> = { calm: "about 30%", medium: "about 40%", lively: "at least half" };
export const lookText = (l: V2Look, flow?: V2Flow | null) => {
  const r = RECIPES.find((x) => x.id === l.recipe);
  const energy = l.energy ?? "medium";
  const base = `THIS VIDEO'S LOOK (drawn for this video so no two look alike — plan inside it): its style is built in code from the reference ${r ? `"${r.from}" (${r.note})` : l.recipe} — your "style" answer is not used; staging.scheme ${l.scheme} (choose a ${l.scheme} ground); palette harmony ${l.harmony} around the brand colour; faces ${l.display} for headlines and ${l.text} for the rest; layouts only ${l.layouts.join(", ")} (a words-only scene may use type).`;
  if (!flow) return `${base} Camera ${l.camera}; ways into scenes only ${l.transitions.join(", ")}. Make it unlike RECENT.`;
  const cams = flow.camera ? ` CAMERA per scene, from: ${ENERGY[energy].cameras.join(", ")} (never still, never the same twice in a row).` : ` Camera ${l.camera}.`;
  const ways = flow.continuous
    ? ` WAYS BETWEEN SCENES (each scene's enter): continuous ways join two scenes — "morph": the last scene's icon morphs into THIS scene's hero icon (this scene's main thing is an icon, size l, that pictures what the voice says next; give the two icons the same id); "zoom-in": the camera zooms through the last scene's icon (or its main thing) into this scene; "zoom-out": the last scene shrinks into this scene's hero icon. Use them on ${SHARE[energy]} of the scene changes, where an icon links the two scenes. The rest: "push-left" or "push-up" (a slide), "wipe" (a mask wipe) or "fade". Never a hard cut.`
    : ` WAYS BETWEEN SCENES: "push-left" or "push-up" (a slide), "wipe" (a mask wipe) or "fade" — never a hard cut.`;
  return `${base} ENERGY: ${energy} — ${energy === "calm" ? "gentle springs, longer holds, slow ways between scenes" : energy === "lively" ? "quick springs, a brisk pace, short ways between scenes" : "crisp springs, a steady pace"}.${cams}${ways} Make it unlike RECENT.`;
};
