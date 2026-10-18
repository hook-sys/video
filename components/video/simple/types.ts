// The simple engine (docs/video-spec.md): a video is a run of beats of the
// voice, each played by one hand-made template. No React here: the server
// builds plans with it.

export const FPS = 30;

export type Word = { text: string; start: number; end: number };
// `screens`: pictures of the product (its website, or uploaded) — file names
// in the plan as stored, addresses once it is played (lib/render-input.ts)
// `site`: the website's address as a browser shows it ("acme.com"), when there is one
export type Brand = { name: string; color: string; cta: string; icon?: string | null; screens?: string[]; site?: string };

// what a beat is for (the story arc)
export const INTENTS = ["hook", "problem", "solution", "feature", "proof", "steps", "cta"] as const;
export type Intent = (typeof INTENTS)[number];

// A beat: a run of the voice's words (indexes, `last` included).
export type Beat = { first: number; last: number };

// What a beat should show, from the Director's plan of the whole story
// (lib/simple/brain.ts readStory): the pains listed, the old way against the
// new, the product's screen, what it brings as tiles, a number said, steps,
// the brand, or a line to say big.
export const SHOWS = ["pains", "before-after", "product", "list", "number", "steps", "brand", "words"] as const;
export type Show = (typeof SHOWS)[number];

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
  // (from the story plan, when there is one) what it should show, and whether it is the video's main moment
  shows?: Show;
  hero?: boolean;
};

// (a new template goes last: a video's print keeps each template's place)
export const TEMPLATES = ["statement", "kinetic", "trouble", "compare", "reveal", "feature", "messages", "bento", "stat", "chart", "steps", "cta", "screen"] as const;
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
  // (a screen scene) which picture of the product it shows
  screen?: number;
  // every word of its beat, each when it is said (the words that may be shown — the editor picks from these)
  said?: { t: string; at: number }[];
  // its own ground, when the customer gave it one other than the video's (edit.ts; at most two scenes)
  ground?: Ground;
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
