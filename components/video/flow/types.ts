// Flow scene format: one continuous motion-graphics piece built from
// persistent nodes that move, transform and connect under one camera.
// Plain data (frames at 30 fps, world pixels with origin at the frame centre),
// written by pattern builders (patterns.ts) and later by the Visual Director.

export type Ease = "linear" | "out" | "in" | "inOut" | "back" | "snap";
export type Vec = [number, number];
export type Vec3 = [number, number, number];
// [frame, value, ease into this key]
export type Key<T> = [number, T, Ease?];
export type Track<T> = Key<T>[];

export const THEME_NAMES = ["lavender", "midnight", "mint", "teal"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

// A product UI shown as a plane in 3D: a screenshot (src) or a procedural mock
// (title + rows). Points on the plane are [u, v] in 0..1.
export type UiRow = { icon: string; text: string; value?: string; status?: string };
export type FlowUi = {
  w: number;
  h: number;
  title: string;
  rows?: UiRow[];
  src?: string;
  tilt: Track<Vec3>; // rotateX, rotateY, rotateZ in degrees
  callouts?: { at: Vec; text: string; icon?: string; side: "left" | "right"; start: number }[];
  lifts?: { row: number; start: number; end?: number }[]; // a row rises off the plane
  cursor?: { path: Track<Vec>; clicks: number[] };
};

// Circular motion around another node between start and end (blends in/out).
export type FlowOrbit = { center: string; radius: Track<number>; angle: number; speed: number; start: number; end?: number };

// A product element on the canvas: a UI card, a device mockup, a screenshot
// crop, a glass icon tile or a logo. Cards can change content over time
// (an inventory card updating); `erase` wipes an element away.
export type FlowElement =
  | { type: "card"; template: string; style: string; content?: Record<string, unknown>; updates?: { at: number; content: Record<string, unknown> }[] }
  | { type: "device"; model: string; finish: string; screen: { src?: string; crop?: string; card?: { template: string; style: string; content?: Record<string, unknown> } } }
  | { type: "shot"; src: string; crop: string }
  | { type: "icon"; icon: string; label?: string }
  | { type: "logo"; src?: string; text?: string }
  // A big word or number as an object in the scene; updates may change it.
  | { type: "text"; text: string; updates?: { at: number; content: Record<string, unknown> }[] }
  // Round and arrow forms, and literal pictures of an idea (voice → waveform).
  | { type: "shape"; shape: string; label?: string }
  | { type: "visual"; visual: string; label?: string }
  | { type: "object"; object: string; label?: string };

export type FlowNode = {
  id: string;
  kind: "orb" | "pill" | "ui" | "el";
  variant?: "solid" | "soft";
  size: number; // orb diameter / pill height
  icon?: Track<string>; // icon swaps morph (old out, new draws on)
  label?: Track<string>; // orb caption or pill text; "" hides it
  pos: Track<Vec>;
  scale?: Track<number>;
  opacity?: Track<number>;
  ring?: Track<number>; // 0..1 progress ring around an orb
  check?: number; // frame a success badge pops
  pulses?: number[]; // frames a ripple fires
  ui?: FlowUi;
  orbit?: FlowOrbit;
  shape?: "circle" | "tile"; // tile: a rounded glass square
  // Elements ("el"): box size, 3D tilt, z-rotation, depth blur, first frame
  // visible (internal animations start there), and an erase sweep.
  el?: FlowElement;
  w?: number;
  h?: number;
  tilt?: Track<Vec3>;
  rot?: Track<number>;
  blur?: Track<number>;
  lit?: Track<number>; // explainer: 1 = the tile fills with the brand colour (the step being talked about)
  appear?: number;
  erase?: number;
  z?: number; // stacking order (higher is in front)
  // Scene Recipe depth layer: 0 background, 1 midground, 2 hero, 3 foreground.
  // Layers follow the camera by different amounts (parallax, states.ts).
  layer?: 0 | 1 | 2 | 3;
  // Travel along a curve (quadratic bezier) between start and end frames.
  paths?: { start: number; end: number; from: Vec; ctrl: Vec; to: Vec; ease?: Ease }[];
};

export type FlowLink = {
  id: string;
  from: string;
  to: string;
  draw: [number, number]; // frames the line draws from → to
  style?: "solid" | "dashed";
  bend?: number; // perpendicular arc height (px), 0 = straight
  packets?: { icon: string; start: number; end: number }[];
  success?: number; // frame the line turns success colour
  fade?: [number, number]; // frames it fades out
  arrow?: boolean; // an arrowhead at the "to" end
};

export type FlowText = {
  text: string;
  start: number;
  end: number;
  pos: Vec; // screen pixels from the frame centre
  size: number;
  weight?: number;
  accent?: string; // words shown in the accent gradient
  // Typography role: display (alone, huge), headline, side (two lines beside
  // the subject), pill (a short line in a capsule), caption (under the subject).
  // panel: set in white on a colour panel that sweeps over the scene.
  style?: "display" | "headline" | "side" | "pill" | "caption" | "panel";
  words?: number[]; // frame each word reveals (its spoken time); else a cascade
  // How the accent words are marked: gradient ink (default), a brand-colour
  // pill that sweeps in behind them, or a line striking them out ("No more ~~x~~").
  mark?: "gradient" | "pill" | "strike";
  // Explainer: the whole line settles in together (words 0.1 s apart) and
  // the mark still lands on the accent word's spoken frame.
  markAt?: number;
  // A word swap: at `at` the accent word flips to `word` ("weeks" → "minutes").
  swap?: { at: number; word: string };
  // Side text anchored by its right edge at pos (words right of a subject on the left).
  align?: "right";
};

// A rolling checklist: one item at a time in focus, the previous one lifting
// away above it and the next one waiting, faded, below.
export type FlowList = { items: string[]; at: number[]; end: number };

// A colour panel that grows from a point (the subject) to fill the frame, then
// sweeps off: the scene "pushes through" the subject into a statement.
export type FlowPanel = { start: number; end: number; from: Vec };

// The closing brand lockup: the logo (or the subject's icon), the product name
// revealed beside it, and a call to action.
export type FlowBrand = { start: number; name: string; logo?: string; icon?: string; cta?: string };

export type FlowLottie = { name: string; start: number; node?: string; pos?: Vec; size: number };

export type FlowPlan = {
  theme: ThemeName;
  duration: number; // frames
  camera: { center: Track<Vec>; zoom: Track<number> };
  nodes: FlowNode[];
  links: FlowLink[];
  texts: FlowText[];
  lotties: FlowLottie[];
  rings?: { center: string; radius: number; start: number; end?: number }[]; // dashed orbit paths
  // Iris: the member nodes are framed by a circle that closes onto `into`.
  iris?: { start: number; dur: number; members: string[]; into: string }[];
  // 0..1: how far the world recedes (dims, blurs) behind a display line.
  dim?: Track<number>;
  brandColor?: string; // the customer's colour, applied over the theme
  lists?: FlowList[];
  panels?: FlowPanel[];
  // Scene backdrops (particles, grid …) from their start frame, cross-faded.
  // strength: its opacity (default: 0.55 at the calm pace, else 1).
  backdrops?: { kind: string; start: number; strength?: number }[];
  // Element nodes that overlap on purpose (a stack, a fan) during a window.
  overlaps?: { ids: string[]; start: number; end: number }[];
  brand?: FlowBrand;
  // Varies the base colour world per video (blob layout, light direction).
  seed?: number;
  // Explainer pace: a calmer backdrop and less idle float.
  calm?: boolean;
  // The explainer look (shot templates): a flat light canvas with edge decor,
  // one text scale, lit step tiles, a brand-colour cursor.
  explainer?: boolean;
  // Explainer: frame spans where the whole canvas turns brand colour (the
  // product reveal, Keka's full-colour moment).
  // [start, end, soft?]: soft = frames of an even ramp in and out (a transition flash).
  flashes?: [number, number, number?][];
  // Explainer canvas decor (a variant the search picks): dots, ribbons, waves, glow.
  decor?: string;
  // How much of the decor shows over time (1 = all; a recipe environment
  // turns it down to an accent so the scene has one world). Absent: 1.
  decorLevel?: Track<number>;
  // Explainer canvas tone: tint (default), white or deep.
  tone?: string;
  // Explainer icon style: tile (default), solid, soft or outline.
  iconStyle?: string;
  // What the resolve pass changed, and what it could not (resolve.ts).
  resolved?: { fixed: string[]; left: string[] };
  // Beats the schedule could not place (too close to the one before, or a
  // minor accent pushed too late): kept for the diagnostics.
  skipped?: { cue: string; action: string; reason: string }[];
  // A pointer in world space: glides along path, visible where show > 0,
  // and presses (a ripple) at each click frame.
  cursor?: { path: Track<Vec>; show: Track<number>; clicks: number[] };
  // Sound effects tied to motion (kinds from components/video/sfx.tsx).
  sfx?: { frame: number; kind: "whoosh" | "soft_pop" | "click" | "reveal" | "success_chime" | "subtle_impact" | "digital_processing" | "typing" }[];
};

// Frames after the last accent word is spoken before its pill / strike lands.
export const MARK_DELAY = 6;
