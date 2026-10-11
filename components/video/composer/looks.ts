import { DISPLAY_FACES, rng } from "./art";
import { LOOKS, type ArtT, type CameraKind, type KeyStyle, type Look, type Motion, type ScriptT, type TransitionKind } from "./types";

// The looks (types.ts LOOKS): each a whole visual family — its type, its
// highlight, its pace, its camera and its cuts — on top of its colours and
// background (art.ts lookPalette, field.tsx LookField). The Director (or the
// rule) picks one per video; the build applies it here, so whatever the
// Director wrote, a video reads as its look. The last videos' looks are
// avoided by construction (avoidLooks).

type LookRule = {
  scheme: "dark" | "light" | "either";
  faces: string[];
  text: string[];
  keys: KeyStyle[];
  motion: Motion[];
  pace: [number, number];
  cameras: CameraKind[];
  // the ways into a scene (at most three: the house rule)
  cuts: TransitionKind[];
  weight: number;
  tracking: number;
  radius: number;
  // the product's UI set at an angle (cinematic: lit like an object)
  tilt?: number;
  // the words big (kinetic: type-led)
  bigText?: boolean;
};

export const LOOK_RULES: Record<Look, LookRule> = {
  cinematic: { scheme: "dark", faces: ["geist", "inter", "space-grotesk", "sora", "manrope", "oswald", "big-shoulders-display"], text: ["geist", "inter", "manrope"], keys: ["color", "glow", "underline"], motion: ["glide", "soft"], pace: [0.82, 0.95], cameras: ["push", "drift", "float"], cuts: ["fade", "blur", "zoom-out"], weight: 650, tracking: -0.03, radius: 22, tilt: 7 },
  plates: { scheme: "dark", faces: ["archivo-black", "dela-gothic-one", "unbounded", "anton", "bricolage-grotesque", "syne"], text: ["inter", "dm-sans", "outfit"], keys: ["box", "pill", "underline"], motion: ["snappy", "springy"], pace: [1.12, 1.3], cameras: ["still", "push"], cuts: ["push-left", "push-up", "wipe"], weight: 800, tracking: -0.03, radius: 28 },
  kinetic: { scheme: "either", faces: ["anton", "bebas-neue", "archivo-black", "big-shoulders-display", "oswald"], text: ["inter", "geist"], keys: ["color", "outline", "box"], motion: ["snappy"], pace: [1.2, 1.35], cameras: ["still", "push"], cuts: ["whip", "zoom-in", "push-left"], weight: 800, tracking: 0, radius: 8, bigText: true },
  editorial: { scheme: "light", faces: ["fraunces", "playfair-display", "instrument-serif", "dm-serif-display", "newsreader", "young-serif"], text: ["inter", "public-sans", "work-sans"], keys: ["italic", "underline", "color"], motion: ["soft"], pace: [0.85, 0.95], cameras: ["drift", "still"], cuts: ["wipe", "fade", "push-left"], weight: 500, tracking: -0.02, radius: 6 },
  neon: { scheme: "dark", faces: ["space-grotesk", "unbounded", "sora", "syne", "lexend", "krona-one"], text: ["inter", "geist", "onest"], keys: ["glow", "gradient", "color"], motion: ["glide", "snappy"], pace: [1, 1.12], cameras: ["push", "orbit", "rise"], cuts: ["zoom-in", "iris", "blur"], weight: 700, tracking: -0.03, radius: 18 },
  swiss: { scheme: "light", faces: ["inter", "archivo", "schibsted-grotesk", "hanken-grotesk", "geist", "montserrat", "red-hat-display"], text: ["inter", "hanken-grotesk", "geist"], keys: ["box", "underline", "color"], motion: ["snappy", "soft"], pace: [1, 1.1], cameras: ["still", "drift"], cuts: ["wipe", "push-left", "push-down"], weight: 800, tracking: -0.045, radius: 2 },
};

export const lookOf = (art: unknown): Look | null => {
  const l = (art as { look?: unknown } | null | undefined)?.look;
  return isLook(l) ? l : null;
};

export const LOOK_NOTES: Record<Look, string> = {
  cinematic: "near-black; the product's UI lit like an object (dark glass, set at an angle), one soft pool of light, slow camera, few words",
  plates: "flat full-bleed colour that changes scene to scene, white UI on it, heavy bold headlines, quick pushes and wipes",
  kinetic: "type-led: giant words on pure black or white, hard cuts and whips, minimal outlined cards — the words are the picture",
  editorial: "warm paper, serif headlines, hairline cards, calm wipes — like a magazine spread",
  neon: "deep night blue, an electric perspective grid and glow, glowing outlined cards, zooms and irises",
  swiss: "white with a fine black grid, heavy grotesk type, one strong colour, square black-outlined cards, clean wipes",
};

const SMALL = new Set(["icon", "badge", "chips", "shape"]);
const isLook = (v: unknown): v is Look => typeof v === "string" && (LOOKS as readonly string[]).includes(v);

// The look a video is built in: its own when it has one and it is not one to
// avoid; else the first of a seeded order that is not. `avoid` comes first
// (the other videos of this set), `soft` after (this customer's last videos):
// when every look is taken, only `avoid` is kept to.
export function pickLook(asked: unknown, seed: number, avoid: (Look | null | undefined)[] = [], soft: (Look | null | undefined)[] = []): Look {
  const order = rng(seed ^ 0x5bd1e995).shuffle(LOOKS);
  for (const not of [[...avoid, ...soft], avoid]) {
    const bad = new Set(not.filter(isLook));
    if (isLook(asked) && !bad.has(asked)) return asked;
    const free = order.find((l) => !bad.has(l));
    if (free) return free;
  }
  return isLook(asked) ? asked : order[0];
}

// A script built in its look: the art's type, highlight, pace and camera from
// the look's own sets (the Director's choice kept where it belongs to them),
// every scene's background dark or light as the look is, its ways in from the
// look's cuts, its UI at the look's angle, its words as big as the look wants.
export function inLook(script: ScriptT, look: Look, seed: number): ScriptT {
  const L = LOOK_RULES[look];
  const R = rng(seed ^ 0x27d4eb2f);
  const a = script.art;
  const keep = <T,>(v: T, xs: readonly T[]) => (xs.includes(v) ? v : R.pick(xs));
  const display = keep(a.display, L.faces);
  const face = DISPLAY_FACES.find((f) => f.slug === display);
  const scheme = L.scheme === "either" ? (a.scheme === "light" ? "light" : R.chance(0.5) ? "dark" : "light") : L.scheme;
  const art: ArtT = {
    ...a,
    look,
    scheme,
    display,
    text: keep(a.text, L.text),
    weight: face?.fixed ?? L.weight,
    case: face?.upper || look === "kinetic" ? "upper" : look === "editorial" || look === "swiss" ? "sentence" : a.case === "lower" ? "sentence" : a.case,
    tracking: face?.upper ? 0.01 : L.tracking,
    key: keep(a.key, L.keys),
    motion: keep(a.motion, L.motion),
    pace: Number(Math.min(L.pace[1], Math.max(L.pace[0], a.pace)).toFixed(2)),
    camera: keep(a.camera, L.cameras),
    radius: L.radius,
  };
  const dark = scheme === "dark";
  // the scenes' ways in: the Director's where it is one of the look's cuts, else the look's in turn
  let turn = R.int(0, L.cuts.length - 1);
  const scenes = script.scenes.map((s, i) => {
    const enter = i === 0 ? "fade" : L.cuts.includes(s.enter) || s.enter === "morph" ? s.enter : L.cuts[turn++ % L.cuts.length];
    const camera = s.camera && !L.cameras.includes(s.camera) ? null : s.camera;
    const items = L.tilt
      ? s.items.map((it, j) => (it.kind === "device" || it.kind === "card" || it.kind === "screenshot" ? { ...it, tilt: it.tilt || ((i + j) % 2 ? L.tilt! : -L.tilt!) } : it))
      : s.items;
    const text = s.text && L.bigText ? { ...s.text, size: "xl" as const } : s.text;
    // kinetic: a scene of only small things (icons, badges, chips, shapes) is the words alone
    const last = i === script.scenes.length - 1;
    if (look === "kinetic" && text && !last && items.length && items.every((it) => SMALL.has(it.kind))) return { ...s, dark, enter, camera, text, items: [], layout: "type" as const, arrange: null };
    return { ...s, dark, enter, camera, items, text };
  });
  return { art, scenes };
}
