import { z } from "zod";
import { DISPLAY_FACES, rng, type Rng } from "./art";
import type { ArtT, CameraKind, KeyStyle, Look, Motion, ScriptT, TransitionKind } from "./types";

// A video's style: not one of a few finished looks but a set of independent
// parts (genes) — the ground, what is drawn on it, the cards, the icons,
// the accent, the type's size, the cuts, the rhythm, the UI's angle — each
// chosen on its own and kept compatible by rules (mendStyle), so thousands
// of looks come out of them. The references (recipes.ts) are styles too:
// a video starts from one and changes it, or the Director writes its own.

export const GROUNDS = ["black", "night", "deep", "dusk", "plate", "bright", "tint", "paper", "white"] as const;
export const BACKDROPS = ["none", "glow", "spot", "rays", "horizon", "grid", "columns", "dots", "rules", "disc", "arcs", "orb"] as const;
export const TEXTURES = ["none", "grain", "vignette"] as const;
export const SHIFTS = ["none", "scene"] as const;
export const CARDS = ["glass", "solid", "offset", "outline", "hairline", "glow", "lifted"] as const;
export const PANELS = ["light", "dark", "ground"] as const;
export const ICON_LOOKS = ["tile", "ink", "outline", "glow", "bare", "gradient"] as const;
export const ACCENTS = ["brand", "electric", "complement", "mono"] as const;
export const TYPE_SIZES = ["normal", "big", "giant"] as const;
export const CUTS = ["soft", "push", "hard", "graphic"] as const;
export const RHYTHMS = ["calm", "steady", "quick", "rapid"] as const;
export const TILTS = [0, 6, 10] as const;

export type Ground = (typeof GROUNDS)[number];

export const Style = z.object({
  ground: z.enum(GROUNDS),
  backdrop: z.enum(BACKDROPS),
  texture: z.enum(TEXTURES),
  shift: z.enum(SHIFTS),
  card: z.enum(CARDS),
  panel: z.enum(PANELS),
  icon: z.enum(ICON_LOOKS),
  accent: z.enum(ACCENTS),
  size: z.enum(TYPE_SIZES),
  cuts: z.enum(CUTS),
  rhythm: z.enum(RHYTHMS),
  tilt: z.number().min(0).max(12),
  ghost: z.boolean(),
  // (later parts: optional, so the styles made before them still read)
  frame: z.boolean().optional(),
  confetti: z.boolean().optional(),
});
export type StyleT = z.infer<typeof Style>;

// What each part means (for the Director's menu).
export const STYLE_NOTES = {
  ground: "black (neutral near-black), night (near-black tinted by the hue), deep (deep saturated dark: aubergine, teal, navy), dusk (dark two-hue gradient), plate (saturated colour, white words), bright (vivid light colour, black words), tint (pale tint of the hue), paper (warm off-white), white",
  backdrop: "none, glow (soft pools of light; dark grounds), spot (one pool on the subject; dark), rays (light beams; dark), horizon (perspective grid to a glowing horizon; dark), grid (fine grid lines), columns (column lines), dots (dot grid), rules (two hairline rules), disc (a big tone-on-tone circle; colour grounds), arcs (big flat coloured arcs at the corners; light grounds), orb (a sphere of glowing points turning behind the subject; dark)",
  texture: "none, grain, vignette (dark)",
  shift: "none, scene (the ground's colour turns scene by scene; plate, bright, deep, tint)",
  card: "glass (dark glass, lit edge; dark panels), solid (plain panel), offset (hard offset shadow), outline (thick ink border), hairline (1px line, flat), glow (accent border that glows; dark), lifted (soft deep shadow; colour grounds)",
  panel: "light (white UI), dark (dark UI; dark grounds), ground (the UI drawn in the ground's own colour, only its lines)",
  icon: "tile (accent tile), ink (ink-coloured tile), outline, glow (lit outline; dark), bare (the glyph alone), gradient",
  accent: "brand (the brand's hue), electric (the hue at full voltage), complement (the opposite hue), mono (no colour: ink only)",
  size: "normal, big (headlines a size up), giant (type-led: the words are the picture; scenes of only small things become words alone)",
  cuts: "soft (fade, blur, zoom out), push (pushes and wipes), hard (whips, zooms in), graphic (wipes, irises, clock wipes)",
  rhythm: "calm (slow, long holds), steady, quick, rapid (fast, snappy)",
  tilt: "0, 6 or 10 — the product's UI set at that angle",
  ghost: "true: the scene's key word huge and faint behind its things",
  frame: "true: a design tool's selection frame, handles and name tab round the scene's main thing",
  confetti: "true: a burst of confetti at the hero moment",
} as const;

const DARK = new Set<Ground>(["black", "night", "deep", "dusk", "plate"]);
export const groundIsDark = (g: Ground) => DARK.has(g);
const LIT = new Set<Ground>(["black", "night", "deep", "dusk"]);

// What goes with what (anything else is mended to the nearest that does).
const BACKDROP_ON: Record<(typeof BACKDROPS)[number], Ground[]> = {
  none: [...GROUNDS],
  glow: [...LIT],
  spot: [...LIT],
  rays: [...LIT],
  horizon: [...LIT],
  grid: [...GROUNDS],
  columns: [...GROUNDS],
  dots: [...GROUNDS],
  rules: ["paper", "white", "bright", "tint", "black"],
  disc: ["plate", "bright", "deep", "dusk", "tint"],
  arcs: ["white", "tint", "paper", "bright"],
  orb: [...LIT],
};
const CARDS_OF: Record<(typeof PANELS)[number], (typeof CARDS)[number][]> = {
  light: ["solid", "offset", "outline", "hairline", "lifted"],
  dark: ["glass", "solid", "hairline", "glow", "outline"],
  ground: ["outline", "hairline", "glow"],
};
const ok = {
  backdrop: (s: StyleT) => BACKDROP_ON[s.backdrop].includes(s.ground),
  texture: (s: StyleT) => s.texture !== "vignette" || (LIT.has(s.ground)),
  shift: (s: StyleT) => s.shift === "none" || ["plate", "bright", "deep", "tint"].includes(s.ground),
  panel: (s: StyleT) => s.panel !== "dark" || LIT.has(s.ground),
  // (white cards with a soft shadow on a pale ground: the soft look we left)
  card: (s: StyleT) => CARDS_OF[s.panel].includes(s.card) && !(s.card === "glow" && !LIT.has(s.ground)) && !(s.card === "lifted" && ["white", "tint", "paper"].includes(s.ground)),
  icon: (s: StyleT) => s.icon !== "glow" || LIT.has(s.ground),
  accent: (s: StyleT) => s.accent !== "mono" || ["black", "white", "paper", "plate", "bright"].includes(s.ground),
  ghost: (s: StyleT) => !(s.ghost && s.size === "giant"),
};
const ORDER = ["backdrop", "texture", "shift", "panel", "card", "icon", "accent", "ghost"] as const;
const OPTIONS: { [K in keyof StyleT]: readonly StyleT[K][] } = {
  ground: GROUNDS, backdrop: BACKDROPS, texture: TEXTURES, shift: SHIFTS, card: CARDS, panel: PANELS, icon: ICON_LOOKS, accent: ACCENTS, size: TYPE_SIZES, cuts: CUTS, rhythm: RHYTHMS, tilt: TILTS, ghost: [false, true],
  // (a frame or confetti now and then: one in four)
  frame: [false, false, false, true], confetti: [false, false, false, true],
};

// What the team allows (admin → Settings, "Looks"): parts turned off, the
// references in use, whether the Director's choice is kept, whether parts
// are mixed and changed, whether recent styles are avoided.
export type StyleRules = { director: boolean; mix: boolean; noRepeat: boolean; off: string[]; recipes: string[] | null };
export const ALL_STYLES: StyleRules = { director: true, mix: true, noRepeat: true, off: [], recipes: null };
// (a feature's switch: "tilt:on", "ghost:true", "size:giant", "shift:scene"…)
const allowed = (rules: StyleRules | undefined, k: string, v: unknown) => !rules?.off.includes(`${k}:${k === "tilt" ? (v ? "on" : "off") : String(v)}`);

// A style made whole and compatible: what is missing or out of range drawn,
// what clashes changed (the ground is kept: it is the style's base).
export function mendStyle(raw: unknown, R: Rng, rules?: StyleRules): StyleT {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = {} as Record<keyof StyleT, unknown>;
  const free = <K extends keyof StyleT>(k: K) => {
    const xs = (OPTIONS[k] as readonly unknown[]).filter((x) => allowed(rules, k, x));
    return xs.length ? xs : (OPTIONS[k] as readonly unknown[]);
  };
  for (const k of Object.keys(OPTIONS) as (keyof StyleT)[]) {
    const xs = free(k);
    if (k === "tilt") {
      const t = typeof o.tilt === "number" && Number.isFinite(o.tilt) ? Math.max(0, Math.min(12, Math.round(o.tilt))) : (R.pick(TILTS) as number);
      s.tilt = allowed(rules, "tilt", t) ? t : 0;
    } else s[k] = xs.includes(o[k]) ? o[k] : R.pick(xs);
  }
  const st = s as StyleT;
  for (const k of ORDER) {
    if (ok[k](st)) continue;
    // (an allowed value that fits; else any that fits)
    const xs = R.shuffle(OPTIONS[k] as readonly StyleT[typeof k][]);
    const tryAll = (only: boolean) => {
      for (const x of xs) {
        if (only && !allowed(rules, k, x)) continue;
        (st as Record<string, unknown>)[k] = x;
        if (ok[k](st)) return true;
      }
      return false;
    };
    if (!tryAll(true)) tryAll(false);
  }
  // (the card follows the panel it was mended to)
  if (!ok.card(st)) st.card = CARDS_OF[st.panel].find((c) => ok.card({ ...st, card: c }) && allowed(rules, "card", c)) ?? CARDS_OF[st.panel].find((c) => ok.card({ ...st, card: c })) ?? "hairline";
  return st;
}

// How far apart two styles are (the parts that differ; the ground counts twice).
const PARTS = ["ground", "backdrop", "texture", "shift", "card", "panel", "icon", "accent", "size", "cuts", "rhythm", "ghost", "frame", "confetti"] as const;
export function styleDistance(a: StyleT, b: StyleT): number {
  let d = PARTS.filter((k) => a[k] !== b[k]).length + (a.ground !== b.ground ? 1 : 0);
  if (Math.abs(a.tilt - b.tilt) >= 5) d++;
  return d;
}
// (unlike the last ones: another ground than the last, and far from each)
const FAR = 6;
const farFrom = (s: StyleT, others: StyleT[]) => others.every((o) => styleDistance(s, o) >= FAR) && (!others[0] || others[0].ground !== s.ground);

// A style changed in `n` parts (each kept compatible).
export function mutate(s: StyleT, R: Rng, n: number, rules?: StyleRules): StyleT {
  let out = { ...s };
  for (const k of R.shuffle(PARTS).slice(0, n)) {
    const xs = (OPTIONS[k] as readonly unknown[]).filter((x) => x !== out[k] && allowed(rules, k, x));
    // (a frame or confetti is an accent: turned on now and then, not whenever it is changed)
    if ((k === "frame" || k === "confetti") && !out[k] && !R.chance(0.3)) continue;
    if (xs.length) (out as Record<string, unknown>)[k] = R.pick(xs);
  }
  if (R.chance(0.3)) out.tilt = R.pick(TILTS.filter((t) => t !== out.tilt));
  out = mendStyle(out, R, rules);
  return out;
}

// The six looks of before, as styles (older videos made in one keep it).
export const LOOK_STYLES: Record<Look, StyleT> = {
  cinematic: { ground: "night", backdrop: "spot", texture: "vignette", shift: "none", card: "glass", panel: "dark", icon: "gradient", accent: "brand", size: "normal", cuts: "soft", rhythm: "calm", tilt: 6, ghost: true },
  plates: { ground: "plate", backdrop: "disc", texture: "none", shift: "scene", card: "offset", panel: "light", icon: "ink", accent: "brand", size: "big", cuts: "push", rhythm: "quick", tilt: 0, ghost: false },
  kinetic: { ground: "black", backdrop: "none", texture: "none", shift: "none", card: "outline", panel: "ground", icon: "tile", accent: "electric", size: "giant", cuts: "hard", rhythm: "rapid", tilt: 0, ghost: false },
  editorial: { ground: "paper", backdrop: "rules", texture: "grain", shift: "none", card: "hairline", panel: "light", icon: "ink", accent: "brand", size: "normal", cuts: "push", rhythm: "calm", tilt: 0, ghost: false },
  neon: { ground: "night", backdrop: "horizon", texture: "none", shift: "none", card: "glow", panel: "dark", icon: "glow", accent: "electric", size: "normal", cuts: "graphic", rhythm: "steady", tilt: 0, ghost: false },
  swiss: { ground: "white", backdrop: "grid", texture: "none", shift: "none", card: "outline", panel: "light", icon: "tile", accent: "mono", size: "big", cuts: "push", rhythm: "steady", tilt: 0, ghost: false },
};

// A video's style (a stored art's own, or its older look's; null: the oldest videos' light glass).
export function styleOf(art: Pick<ArtT, "look"> & { style?: unknown } | null | undefined): StyleT | null {
  if (!art) return null;
  const parsed = Style.safeParse(art.style);
  if (parsed.success) return parsed.data;
  return art.look ? LOOK_STYLES[art.look] : null;
}

// A recipe: a reference video's style (or the parts of it we can draw), and
// the faces and highlights it suits.
export type Recipe = { id: string; from: string; note: string; style: Partial<StyleT>; faces?: string[]; keys?: KeyStyle[] };

// The style a video is built in. The Director's (`asked`) when it has one and
// it is unlike `avoid` (the other videos of this set, then this customer's
// last ones) — changed where it is too close; else a recipe's, changed in 2–4
// parts; else drawn whole.
export function pickStyle(asked: unknown, seed: number, recipes: Recipe[], avoid: (StyleT | null)[] = [], soft: (StyleT | null)[] = [], rules: StyleRules = ALL_STYLES): { style: StyleT; recipe: Recipe | null } {
  const R = rng(seed ^ 0x6c8e9cf5);
  const hard = rules.noRepeat ? avoid.filter((x): x is StyleT => !!x) : [];
  const all = rules.noRepeat ? [...hard, ...soft.filter((x): x is StyleT => !!x).slice(0, 3)] : [];
  const fits = (s: StyleT, against: StyleT[]) => farFrom(s, against);
  const askedOk = rules.director && asked && typeof asked === "object" && Object.keys(asked).length >= 4;
  if (askedOk) {
    let s = mendStyle(asked, R, rules);
    for (let t = 0; t < 40 && !fits(s, all); t++) s = mutate(s, R, 2 + (t >> 3), rules);
    if (fits(s, all) || fits(s, hard)) return { style: s, recipe: null };
  }
  const usable = recipes.filter((r) => !rules.recipes || rules.recipes.includes(r.id));
  const order = R.shuffle(usable.length ? usable : recipes);
  // (mix off: a reference as it is — only what is turned off or clashes is changed)
  const from = (r: Recipe) => (rules.mix ? mutate(mendStyle(r.style, R, rules), R, R.int(2, 4), rules) : mendStyle(r.style, R, rules));
  for (const against of [all, hard]) {
    for (const r of order) {
      for (let t = 0; t < (rules.mix ? 6 : 1); t++) {
        const s = from(r);
        if (fits(s, against)) return { style: s, recipe: r };
      }
    }
  }
  const r = order[0];
  return { style: r ? from(r) : mendStyle({}, R, rules), recipe: r ?? null };
}

// ── the style applied to a script ─────────────────────────────────────────
const CUT_SETS: Record<(typeof CUTS)[number], TransitionKind[]> = {
  soft: ["fade", "blur", "zoom-out"],
  push: ["push-left", "push-up", "wipe"],
  hard: ["whip", "zoom-in", "push-left"],
  graphic: ["wipe", "iris", "clock"],
};
const PACE: Record<(typeof RHYTHMS)[number], [number, number]> = { calm: [0.82, 0.92], steady: [0.95, 1.06], quick: [1.1, 1.2], rapid: [1.24, 1.35] };
const MOTION: Record<(typeof RHYTHMS)[number], Motion[]> = { calm: ["soft", "glide"], steady: ["glide", "soft", "springy"], quick: ["snappy", "springy"], rapid: ["snappy"] };
const CAMERA: Record<(typeof RHYTHMS)[number], CameraKind[]> = { calm: ["drift", "push", "float", "macro"], steady: ["drift", "push", "rise", "orbit", "float", "macro"], quick: ["push", "still", "rise"], rapid: ["still", "push"] };
const SMALL = new Set(["icon", "badge", "chips", "shape"]);
const UP: Record<string, "s" | "m" | "l" | "xl"> = { s: "m", m: "l", l: "xl", xl: "xl" };

// A script built in its style: dark or light as its ground is, paced, cut and
// filmed as its rhythm and cuts are, its UI at its angle, its words as big as
// its size; faces from its recipe when the Director gave none that suits.
export function inStyle(script: ScriptT, style: StyleT, seed: number, recipe?: Recipe | null): ScriptT {
  const R = rng(seed ^ 0x27d4eb2f);
  const a = script.art;
  const keep = <T,>(v: T, xs: readonly T[]) => (xs.includes(v) ? v : R.pick(xs));
  const dark = groundIsDark(style.ground);
  let display = a.display, key = a.key;
  if (recipe?.faces?.length && !recipe.faces.includes(display) && R.chance(0.6)) display = R.pick(recipe.faces);
  if (recipe?.keys?.length && !recipe.keys.includes(key) && R.chance(0.5)) key = R.pick(recipe.keys);
  // (no colour: the highlight is a shape, not a colour)
  if (style.accent === "mono" && (key === "color" || key === "gradient" || key === "glow")) key = R.pick(["box", "underline", "pill"] as const);
  // (an outlined word or a glow reads only on a dark ground)
  if (!dark && (key === "outline" || key === "glow")) key = R.pick(["box", "underline", "color"] as const);
  const face = DISPLAY_FACES.find((f) => f.slug === display);
  const pace = PACE[style.rhythm];
  const art: ArtT = {
    ...a,
    style,
    look: null,
    scheme: dark ? "dark" : "light",
    display,
    weight: face?.fixed ?? a.weight,
    case: face?.upper ? "upper" : a.case,
    key,
    motion: keep(a.motion, MOTION[style.rhythm]),
    pace: Number(Math.min(pace[1], Math.max(pace[0], a.pace)).toFixed(2)),
    camera: keep(a.camera, CAMERA[style.rhythm]),
  };
  const cuts = CUT_SETS[style.cuts];
  let turn = R.int(0, cuts.length - 1);
  const last = script.scenes.length - 1;
  const scenes = script.scenes.map((s, i) => {
    const enter = i === 0 ? "fade" : cuts.includes(s.enter) || s.enter === "morph" ? s.enter : cuts[turn++ % cuts.length];
    const camera = s.camera && !CAMERA[style.rhythm].includes(s.camera) ? null : s.camera;
    const items = style.tilt ? s.items.map((it, j) => (it.kind === "device" || it.kind === "card" || it.kind === "screenshot" ? { ...it, tilt: it.tilt || ((i + j) % 2 ? style.tilt : -style.tilt) } : it)) : s.items;
    const text = s.text && style.size !== "normal" ? { ...s.text, size: style.size === "giant" ? ("xl" as const) : UP[s.text.size] } : s.text;
    // (hard cuts and rapid rhythms: the logo comes in glitching — ref 25)
    const glitchy = style.cuts === "hard" || style.rhythm === "rapid";
    const items2 = glitchy ? items.map((it) => (it.kind === "logo" && !it.enter && R.chance(0.6) ? { ...it, enter: "glitch" as const } : it)) : items;
    // giant type: a scene of only small things is the words alone (one word at a time, now and then)
    if (style.size === "giant" && text && i !== last && items2.length && items2.every((it) => SMALL.has(it.kind))) return { ...s, dark, enter, camera, text: R.chance(0.5) ? { ...text, reveal: "beat" as const } : text, items: [], layout: "type" as const, arrange: null };
    return { ...s, dark, enter, camera, items: items2, text };
  });
  return { art, scenes };
}

// A short line naming a style (the studio, the logs, RECENT).
export const styleLine = (s: StyleT) => `${s.ground} ground${s.backdrop !== "none" ? ` + ${s.backdrop}` : ""}${s.shift === "scene" ? " (turning)" : ""}, ${s.card} ${s.panel} cards, ${s.icon} icons, ${s.accent} accent, ${s.size} type, ${s.cuts} cuts, ${s.rhythm}${s.tilt ? `, UI at ${s.tilt}°` : ""}${s.ghost ? ", ghost word" : ""}${s.frame ? ", design frame" : ""}${s.confetti ? ", confetti" : ""}`;

// ── the team's switches (admin → Settings, "Looks") ──────────────────────
// One switch for every part's every option, one for every reference, and
// four for how a style is chosen. Read by createProject's build (actions.ts).
const PART_LABEL: Record<string, string> = { ground: "Ground", backdrop: "Background", texture: "Texture", shift: "Colour turning", card: "Cards", panel: "UI colour", icon: "Icons", accent: "Accent", size: "Type size", cuts: "Cuts", rhythm: "Rhythm", tilt: "UI at an angle", ghost: "Ghost word", frame: "Design frame", confetti: "Confetti" };
const PART_VALUES: [keyof StyleT, string[]][] = [
  ["ground", [...GROUNDS]],
  ["backdrop", BACKDROPS.filter((b) => b !== "none")],
  ["texture", ["grain", "vignette"]],
  ["shift", ["scene"]],
  ["card", [...CARDS]],
  ["panel", [...PANELS]],
  ["icon", [...ICON_LOOKS]],
  ["accent", [...ACCENTS]],
  ["size", ["big", "giant"]],
  ["cuts", [...CUTS]],
  ["rhythm", [...RHYTHMS]],
  ["tilt", ["on"]],
  ["ghost", ["true"]],
  ["frame", ["true"]],
  ["confetti", ["true"]],
];
const noteOf = (k: keyof StyleT, v: string) => {
  const all = (STYLE_NOTES as Record<string, string>)[k] ?? "";
  const m = all.split(/,(?![^(]*\))/).map((x) => x.trim()).find((x) => x.startsWith(v));
  return m && m !== v ? m : "";
};
export type StyleSwitch = { key: string; label: string; help: string };
export const STYLE_SWITCHES: { how: StyleSwitch[]; parts: StyleSwitch[]; refs: StyleSwitch[] } = {
  how: [
    { key: "looks_on", label: "Looks", help: "Every new video is drawn in its own style, made from the parts below and the references. Off: every new video in the first light glass look." },
    { key: "looks_director", label: "Looks: the Director chooses", help: "The Motion Director writes each video's style (the parts below) for its brand and story. Off: the style is drawn from the references by code." },
    { key: "looks_mix", label: "Looks: mix and change", help: "A reference's style is changed in 2–4 parts each time, so thousands of looks come out of them. Off: a reference is used as it is." },
    { key: "looks_no_repeat", label: "Looks: never like the last ones", help: "A new video's style is far from this customer's last three videos (another ground, most parts different). Off: it may repeat." },
  ],
  parts: PART_VALUES.flatMap(([k, vs]) =>
    vs.map((v) => ({ key: `look_${k}_${v}`, label: `${PART_LABEL[k]}: ${k === "tilt" || k === "ghost" || k === "shift" || k === "frame" || k === "confetti" ? "on" : v}`, help: k === "tilt" ? "The product's UI set at an angle (6° or 10°). Off: always flat." : k === "ghost" ? "The scene's key word huge and faint behind its things. Off: never." : k === "frame" ? "A design tool's selection frame, handles and name tab round the scene's main thing (ref 17). Off: never." : k === "confetti" ? "A burst of confetti at the hero moment (refs 01, 20). Off: never." : k === "shift" ? "The ground's colour turns scene by scene. Off: one colour all video." : noteOf(k, v) ? `${noteOf(k, v)}. Off: never used.` : "Off: never used." })),
  ),
  refs: [],
};
export const switchOffOf = (key: string): string | null => {
  const m = /^look_([a-z]+)_(.+)$/.exec(key);
  return m ? `${m[1]}:${m[2]}` : null;
};
// (the team's settings → the rules a style is chosen by; null: looks off)
export function styleRulesOf(settings: Record<string, unknown>, recipeIds: string[]): StyleRules | null {
  if (settings.looks_on === false) return null;
  const off = STYLE_SWITCHES.parts.filter((s) => settings[s.key] === false).map((s) => switchOffOf(s.key)!).filter(Boolean);
  const recipes = recipeIds.filter((id) => settings[`look_ref_${id}`] !== false);
  return { director: settings.looks_director !== false, mix: settings.looks_mix !== false, noRepeat: settings.looks_no_repeat !== false, off, recipes: recipes.length === recipeIds.length ? null : recipes };
}
