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
  // (when its words picture one idea) the idea (concept.tsx)
  concept?: Concept;
};

// The ideas a beat's words may picture (concept.tsx): an idea shut in, a mess put
// in order, waiting, one word that is really another, taking off
// — and what it costs, hours of work made minutes, what stands in the way, the way to a goal
// — and the points ahead (agenda), less of one thing for more of another (versus), stages narrowing (funnel)
export const CONCEPTS = ["trapped", "chaos", "waiting", "truth", "launch", "cost", "hours", "barriers", "progress", "agenda", "versus", "funnel", "split", "few", "exit", "retention", "cycle", "report"] as const;
export type Concept = (typeof CONCEPTS)[number];
// (the ideas made of the beat's things: the truth's two words, the barriers crossed out — none without two)
export const ideaNeedsThings = (c: Concept | undefined, things: number) => (c === "truth" || c === "barriers" || c === "versus" || c === "split" || c === "few" || c === "cycle" || c === "report") && things < 2 || (c === "funnel" && things < 3);

// (a new template goes last: a video's print keeps each template's place)
export const TEMPLATES = ["statement", "kinetic", "trouble", "compare", "reveal", "feature", "messages", "bento", "stat", "chart", "steps", "cta", "screen", "concept", "point", "panel", "deck"] as const;
export type TemplateId = (typeof TEMPLATES)[number];
// every template has three designed variants — some more (rows.tsx: the panel 8, the deck 5; the kinetic
// 10, the statement 11, kit.tsx Moving; the point 10, points.tsx)
export const VARIANTS = 3;
export const VARIANT_COUNT: Partial<Record<TemplateId, number>> = { panel: 8, deck: 5, kinetic: 10, statement: 11, point: 10 };
export const variantsOf = (t: TemplateId) => VARIANT_COUNT[t] ?? VARIANTS;

// (glass: an airy light ground of soft colour fields, frosted cards, glossy icons, the keyword in a gradient)
export const GROUNDS = ["dark", "light", "brand", "glass"] as const;
export type Ground = (typeof GROUNDS)[number];
// (blur: the scene going out blurs and fades as the next comes in from a blur · leak: a warm light
// sweeps across the cut · push: the next comes up from below, both streaked by motion · tilt: the
// scene turns away in depth as the next turns in)
export const WAYS = ["slide", "zoom", "wipe", "blur", "leak", "push", "tilt"] as const;
export type Way = (typeof WAYS)[number];
export const PACES = ["calm", "lively"] as const;
export type Pace = (typeof PACES)[number];

// the type pairs (display, text) — Bangla faces in public/fonts/library (faces.ts BANGLA_FACES):
// clean, modern, characterful, soft, classic
export const TYPE_PAIRS: [string, string][] = [
  ["noto-sans-bengali", "hind-siliguri"],
  ["anek-bangla", "hind-siliguri"],
  ["atma", "hind-siliguri"],
  ["baloo-da-2", "hind-siliguri"],
  ["noto-serif-bengali", "noto-sans-bengali"],
];

// The video's look: one family for every card, icon tile, keyword and the ground's pattern —
// soft (frosted, rounded; the first look), neon (a deep dark ground, glowing edges, a grid),
// editorial (paper, hairline rules, square corners, a serif), bold (thick ink outlines, hard
// offset shadows, halftone dots), depth (deep soft shadows, a slow turn in 3D, colour blobs)
export const STYLES = ["soft", "neon", "editorial", "bold", "depth"] as const;
export type Style = (typeof STYLES)[number];
// the grounds each look stands on
export const STYLE_GROUNDS: Record<Style, readonly Ground[]> = {
  soft: ["dark", "light", "brand", "glass"],
  neon: ["dark"],
  editorial: ["light"],
  bold: ["light", "brand"],
  depth: ["glass", "light", "dark"],
};

// (style: none on a plan made before the looks — soft)
export type Theme = { ground: Ground; type: number; way: Way; pace: Pace; style?: Style };

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
  // its picture: the icon of a word said in it ("" when none is — then no template shows one), and the
  // frame that word is said (the icon comes in with it)
  icon: string;
  iconAt?: number;
  items: Item[];
  number: string | null;
  // (a screen scene) which picture of the product it shows
  screen?: number;
  // every word of its beat, each when it is said (the words that may be shown — the editor picks from these)
  said?: { t: string; at: number }[];
  // its own ground, when the customer gave it one other than the video's (edit.ts; at most two scenes)
  ground?: Ground;
  // false: its lit word's icon (kit.tsx keyIconOf) left out — it did not fit (check.ts settleWordIcons)
  wordIcon?: false;
  // the idea its words picture, and whether it resolves there (not in a hook or a problem: the box stays shut)
  concept?: Concept;
  resolves?: boolean;
  // (a script told as numbered points) which point this scene is in — its opening scene is the
  // template "point"; the others show the point's bar at the top (points.tsx)
  point?: Point;
  // (the concept "agenda") the points' titles, previewed
  agenda?: string[];
  // (the words beside their pictures — statement B) the things the words name, each a card that comes in as it is said
  tiles?: { text: string; icon: string; at: number }[];
  // (the panel) the rows it had from the scene before it — already in — and that it goes on from it with no cut;
  // and the rows the panel is laid out for (the most it will have), so it never moves as rows come
  carry?: number;
  cont?: boolean;
  rows?: number;
};
export type Point = { n: number; of: number; title: string };

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
  // a free trial video: "Made with MotionDots" in a corner, all the way through
  watermark?: boolean;
  // what the check before playing mended, and what it could not (check.ts)
  check?: { fixed: string[]; left: string[] };
};

export const isSimple = (plan: unknown): plan is SimplePlan => !!plan && (plan as { engine?: unknown }).engine === "simple";

// the film's id in the bundle (remotion/root.tsx) and what it takes
export const FILM_ID = "SimpleFilm";
export type FilmProps = { plan: SimplePlan; audioUrl?: string | null; webAudio?: boolean };
