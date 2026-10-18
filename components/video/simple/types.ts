// The simple engine (docs/video-spec.md): a video is a run of beats of the
// voice, each played by one hand-made template. No React here: the server
// builds plans with it.

export const FPS = 30;

export type Word = { text: string; start: number; end: number };
export type Brand = { name: string; color: string; cta: string; icon?: string | null };

// what a beat is for (the story arc)
export const INTENTS = ["hook", "problem", "solution", "feature", "proof", "steps", "cta"] as const;
export type Intent = (typeof INTENTS)[number];

// A beat: a run of the voice's words (indexes, `last` included).
export type Beat = { first: number; last: number };

// What a beat says, as the AI (or the rule guess) reads it.
export type Item = { text: string; icon: string | null };
export type Reading = {
  intent: Intent;
  // the words shown: a run inside the beat (indexes into all the words), and the one lit
  show: [number, number];
  key: number | null;
  icon: string | null;
  // up to 3 short things (1–3 words each): pains, features, steps
  items: Item[];
  // a number the voice says in this beat, exactly as said
  number: string | null;
};

export const TEMPLATES = ["statement", "kinetic", "trouble", "compare", "reveal", "feature", "messages", "bento", "stat", "chart", "steps", "cta"] as const;
export type TemplateId = (typeof TEMPLATES)[number];
// every template has three designed variants
export const VARIANTS = 3;

export const GROUNDS = ["dark", "light", "brand"] as const;
export type Ground = (typeof GROUNDS)[number];
export const WAYS = ["slide", "zoom", "wipe"] as const;
export type Way = (typeof WAYS)[number];
export const PACES = ["calm", "lively"] as const;
export type Pace = (typeof PACES)[number];

// the type pairs (display, text) — faces in public/fonts/library
export const TYPE_PAIRS: [string, string][] = [
  ["plus-jakarta-sans", "inter"],
  ["sora", "dm-sans"],
  ["bricolage-grotesque", "figtree"],
  ["lexend", "instrument-sans"],
  ["unbounded", "manrope"],
];

export type Theme = { ground: Ground; type: number; way: Way; pace: Pace };

// A scene as the film plays it (frames).
export type Scene = {
  from: number;
  to: number;
  template: TemplateId;
  variant: number;
  // the hero on the left (false: mirrored)
  left: boolean;
  // the words shown, each when it is said; `key` lit
  words: { t: string; at: number; key: boolean }[];
  icon: string;
  items: Item[];
  number: string | null;
};

export type SimplePlan = {
  engine: "simple";
  v: 1;
  duration: number;
  w: number;
  h: number;
  seed: number;
  brand: Brand;
  theme: Theme;
  scenes: Scene[];
  // what makes it look like itself (kept to keep the next videos unlike it)
  print: string;
  sfx?: boolean;
  // what the check before playing mended, and what it could not (check.ts)
  check?: { fixed: string[]; left: string[] };
};

export const isSimple = (plan: unknown): plan is SimplePlan => !!plan && (plan as { engine?: unknown }).engine === "simple";

// the film's id in the bundle (remotion/root.tsx) and what it takes
export const FILM_ID = "SimpleFilm";
export type FilmProps = { plan: SimplePlan; audioUrl?: string | null; webAudio?: boolean };
