import type { FilmContent } from "./content";

// The clean explainer: flat UI, kinetic type and icons on a moving,
// story-coloured background (no 3D objects). A plan is a list of scenes on
// the voice's word timeline; each scene is one template with its own data
// and the words it is synced to.

export const CLEAN_ID = "CleanVideo";
export const FPS = 30;

// The story's acts: they colour the background.
export type Act = "problem" | "reveal" | "solution" | "cta";

export type LookId = "lavender" | "midnight" | "mint" | "sunrise";

// How one video differs from another: every choice below has four options
// (side has two) so four variants of one script can each take a different one.
export type Variant = {
  look: LookId;
  camera: "push" | "tilt" | "drift" | "zoom";
  transition: "blur" | "slide" | "zoom" | "wipe";
  keyword: "gradient" | "pill" | "underline" | "marker";
  side: "left" | "right";
  hook: "center" | "left" | "stack" | "word";
  trio: "row" | "scatter" | "stack" | "orbit";
  reveal: "converge" | "ring" | "split" | "wipe";
  pay: "dashboard" | "phone" | "cards" | "feed";
  growth: "bars" | "line" | "tiles" | "donut";
  nomore: "stack" | "swap" | "icons" | "split";
  cta: "center" | "left" | "card" | "minimal";
};

export type Brand = { name: string; color: string; tagline: string; cta: string; url: string; icon?: string | null };

// A word of the voice: seconds.
export type Word = { text: string; start: number; end: number };

export type Scene = {
  template: "hook" | "trio" | "reveal" | "pay" | "growth" | "nomore" | "cta";
  act: Act;
  from: number; // frames
  to: number;
  // named moments of the scene (absolute frames): when each thing happens
  cues: Record<string, number>;
  data: Record<string, unknown>;
};

export type CleanPlan = {
  duration: number; // frames
  variant: Variant;
  brand: Brand;
  words: Word[];
  scenes: Scene[];
  // what the product's cards show in the film templates (else the defaults)
  content?: FilmContent;
};

export type CleanVideoProps = { plan: CleanPlan; audioUrl?: string | null };
