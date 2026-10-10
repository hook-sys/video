import { z } from "zod";

// A still background: the field of light doesn't drift or glide between
// scenes, and the camera doesn't travel (every video staged as cuts). Off:
// the background moves.
export const STILL_BACKGROUND = false;

// The Composer: a video is composed scene by scene by its Director — every
// scene's layout, things, motion, camera, background and way in are chosen
// for the words spoken there. Nothing here is a finished scene: these are
// the parts (primitives) and the grammar the Director composes with.

export const COMPOSER_ID = "ComposerFilm";
export const FPS = 30;
// (the frame: frame.ts — 16:9, 9:16 or 1:1)
export { W, H } from "./frame";

// ── the vocabulary ─────────────────────────────────────────────────────────
export const FIELDS = ["aurora", "arcs", "grid", "dots", "rings", "beams", "horizon", "discs", "streaks", "mesh", "spot", "waves", "plain"] as const;
export const OVERLAYS = ["none", "grain", "particles", "sheen", "vignette", "lines"] as const;
export const HARMONIES = ["mono", "analogous", "complement", "split", "triad"] as const;
export const SCHEMES = ["dark", "light", "mixed"] as const;
export const SURFACES = ["glass", "solid", "outline", "soft", "tinted", "ink"] as const;
export const KEYS = ["color", "pill", "underline", "gradient", "box", "outline", "italic", "glow"] as const;
export const CASES = ["sentence", "upper", "lower"] as const;
export const MOTIONS = ["soft", "snappy", "springy", "glide"] as const;
export const CAMERAS = ["still", "drift", "push", "pull", "tilt", "float", "orbit", "rise"] as const;
export const ICON_STYLES = ["tile", "round", "bare", "duotone", "outline", "glass"] as const;
// (the last five compose the words with the things: an icon beside the words,
// the words as a thing's label, a caption over a thing that fills the frame,
// things around the words, the words between two things — see layout.ts)
export const LAYOUTS = ["center", "split-left", "split-right", "top", "bottom", "type", "visual", "corner", "over", "inline", "label", "caption", "around", "between"] as const;
export const ARRANGES = ["single", "row", "column", "grid", "cascade", "orbit", "scatter", "diagonal"] as const;
export const REVEALS = ["word", "rise", "mask", "type", "scale", "blur", "slide", "line"] as const;
export const TRANSITIONS = ["blur", "fade", "push-left", "push-right", "push-up", "push-down", "zoom-in", "zoom-out", "whip", "iris", "wipe", "flip", "morph", "drop", "clock"] as const;
export const ENTERS = ["rise", "drop", "left", "right", "scale", "pop", "blur", "flip", "unfold", "draw", "swing"] as const;
export const ITEM_KINDS = ["icon", "chips", "stat", "chart", "card", "device", "logo", "button", "compare", "flow", "avatars", "badge", "cursor", "shape", "screenshot", "steps", "quote"] as const;
// What a card shows (the product's UI, drawn).
export const CARD_VARIANTS = ["list", "kpi", "form", "chat", "notify", "invoice", "calendar", "table", "kanban", "toggles", "timeline", "checklist", "search", "profile", "doc", "pay"] as const;
export const CHART_VARIANTS = ["bars", "line", "area", "donut", "ring", "progress", "columns", "spark"] as const;
export const DEVICE_VARIANTS = ["phone", "browser", "laptop", "tablet", "watch"] as const;
export const FLOW_VARIANTS = ["chain", "hub", "ring", "fan", "merge"] as const;
export const SHAPE_VARIANTS = ["ring", "orb", "arrow", "spark", "grid", "line", "plus", "wave", "star", "burst", "hex"] as const;
export const SIZES = ["s", "m", "l"] as const;

export type FieldKind = (typeof FIELDS)[number];
export type Overlay = (typeof OVERLAYS)[number];
export type Surface = (typeof SURFACES)[number];
export type KeyStyle = (typeof KEYS)[number];
export type Motion = (typeof MOTIONS)[number];
export type CameraKind = (typeof CAMERAS)[number];
export type IconStyle = (typeof ICON_STYLES)[number];
export type LayoutKind = (typeof LAYOUTS)[number];
export type ArrangeKind = (typeof ARRANGES)[number];
export type Reveal = (typeof REVEALS)[number];
export type TransitionKind = (typeof TRANSITIONS)[number];
export type EnterKind = (typeof ENTERS)[number];
export type ItemKind = (typeof ITEM_KINDS)[number];

const n = <T extends z.ZodTypeAny>(t: T) => t.nullable().optional();

// ── what a Director writes (word indexes into the voice's words) ───────────
export const Row = z.object({ icon: n(z.string().max(40)), title: z.string().max(48), meta: n(z.string().max(40)), tag: n(z.string().max(24)) });
export const Item = z.object({
  kind: z.enum(ITEM_KINDS),
  id: n(z.string().max(24)), // the same id in the next scene: the thing travels on (a match cut)
  at: z.number().int(), // the word it comes in on
  hit: n(z.number().int()), // the word its moment happens on (a count, a click, a strike)
  enter: n(z.enum(ENTERS)),
  variant: n(z.string().max(16)),
  title: n(z.string().max(60)),
  sub: n(z.string().max(80)),
  icon: n(z.string().max(40)),
  value: n(z.string().max(24)),
  values: n(z.array(z.number()).max(12)),
  rows: n(z.array(Row).max(6)),
  screen: n(z.enum(CARD_VARIANTS)), // a device's screen
  size: n(z.enum(SIZES)),
  tilt: n(z.number().min(-20).max(20)),
});
export const Scene = z.object({
  at: z.number().int(), // the word the scene starts on
  text: n(z.object({ from: z.number().int(), to: z.number().int(), size: z.enum(["s", "m", "l", "xl"]), reveal: z.enum(REVEALS), align: n(z.enum(["left", "center", "right"])), key: n(z.array(z.string().max(30)).max(4)) })),
  kicker: n(z.string().max(36)),
  layout: z.enum(LAYOUTS),
  arrange: n(z.enum(ARRANGES)),
  ratio: n(z.number().min(0.25).max(0.65)),
  dark: n(z.boolean()),
  camera: n(z.enum(CAMERAS)),
  enter: z.enum(TRANSITIONS),
  items: z.array(Item).max(7),
});
export const Art = z.object({
  name: z.string().max(40),
  hue: z.number().min(0).max(360),
  harmony: z.enum(HARMONIES),
  scheme: z.enum(SCHEMES),
  field: z.enum(FIELDS),
  overlay: z.enum(OVERLAYS),
  surface: z.enum(SURFACES),
  radius: z.number().min(0).max(48),
  display: z.string().max(40),
  text: z.string().max(40),
  weight: z.number().min(300).max(900),
  case: z.enum(CASES),
  tracking: z.number().min(-0.08).max(0.1),
  key: z.enum(KEYS),
  motion: z.enum(MOTIONS),
  pace: z.number().min(0.6).max(1.5),
  camera: z.enum(CAMERAS),
  icons: z.enum(ICON_STYLES),
  energy: z.number().min(0).max(1),
});
export const Script = z.object({ art: Art, scenes: z.array(Scene).min(1).max(24) });
export type RowT = z.infer<typeof Row>;
export type ItemT = z.infer<typeof Item>;
export type SceneT = z.infer<typeof Scene>;
export type ArtT = z.infer<typeof Art>;
export type ScriptT = z.infer<typeof Script>;

// ── what the film plays (frames; validated and laid out) ───────────────────
export type Word = { text: string; start: number; end: number };
export type Brand = { name: string; color: string; tagline: string; cta: string; url: string; icon?: string | null };
export type Box = { x: number; y: number; w: number; h: number }; // centre, size
export type PlacedItem = Omit<ItemT, "at" | "hit"> & { at: number; hit: number | null; box: Box; scale: number; z: number; from?: Box | null };
// area: the place the layout gave the words; anchor: where in it they sit
export type TextBlock = { words: { t: string; at: number; key: boolean }[]; box: Box; size: number; lines: number[][]; align: "left" | "center" | "right"; reveal: Reveal; kicker: string | null; area?: Box; anchor?: "top" | "middle" | "bottom" };
export type PlacedScene = {
  from: number;
  to: number;
  dark: boolean;
  camera: CameraKind;
  enter: TransitionKind;
  layout: LayoutKind;
  arrange: ArrangeKind;
  text: TextBlock | null;
  items: PlacedItem[];
  seed: number;
};
// (the last four are structures: a timeline, a mind map, a wall of tiles, a
// web page that scrolls — see structure.tsx)
export const JOURNEYS = ["right", "zigzag", "down", "diagonal", "snake", "timeline", "map", "tiles", "scroll"] as const;
export type JourneyKind = (typeof JOURNEYS)[number];
// How one scene leads to the next on a journey: a line drawn between them,
// the scene's main thing carried on into the next, a guide (a paper plane, a
// cursor, a point of light) the camera follows, or a word that stays and
// becomes the next scene's first word. Or deeper instead of sideways (see
// depth.ts): into the scene's main thing, back out of the next one's, or
// forward through the scenes.
// Or the camera alone: a whip pan, the canvas turning a quarter round a
// corner, or the scene flipping over like a card with the next on its back.
export const LINKS = ["line", "carry", "lead", "word", "dive", "reveal", "tunnel", "whip", "turn", "flip"] as const;
export type LinkKind = (typeof LINKS)[number];
export const GUIDES = ["plane", "cursor", "orb"] as const;
export type GuideKind = (typeof GUIDES)[number];
export type ComposerPlan = {
  v: 1;
  duration: number;
  words: Word[];
  brand: Brand;
  art: ArtT;
  scenes: PlacedScene[];
  seed: number;
  source: "director" | "auto";
  // the frame (frame.ts; 1920×1080 when not given): 9:16 is 1080×1920, 1:1 1080×1080
  w?: number;
  h?: number;
  // one canvas, the camera travelling from scene to scene (see journey.tsx)
  journey?: JourneyKind | null;
  link?: LinkKind | null;
  // the way into each scene, when the moves differ (index = the scene arrived at; else `link`)
  links?: (LinkKind | null)[] | null;
  guide?: GuideKind | null;
  // a journey's last seconds: the camera pulls back to show the whole way the
  // film came, and the brand comes up over it (see staging.ts withRecap)
  recap?: boolean | null;
  // sound effects on what happens (off only when the team turns them off)
  sfx?: boolean;
};
export type ComposerProps = { plan: ComposerPlan; audioUrl?: string | null; webAudio?: boolean; bare?: boolean };
