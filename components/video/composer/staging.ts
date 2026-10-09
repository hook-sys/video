import { rng } from "./art";
import { isAccent } from "./layout";
import { STILL_BACKGROUND, type ComposerPlan, type GuideKind, type JourneyKind, type LinkKind, type PlacedScene } from "./types";

// How a video is staged. A studio's rule: ONE camera language for the whole
// video — variety comes from one video to the next, never inside one — and
// one signature move kept for the hero moment. The language is the Motion
// Director's choice (lib/ai/motion-director.ts, or by rule in lib/studio.ts
// from the brand's mood); without one it is drawn here from the seed. Each
// move uses the language's way wherever its two scenes allow it (a thing to
// carry, a word to keep, a window to go into), else the language's plain way.

export const LANGUAGES = ["cuts", "line", "carry", "words", "guide", "timeline", "map", "tiles", "scroll", "depth", "flip", "whip", "turn"] as const;
export type Language = (typeof LANGUAGES)[number];
// what each language is, for the Directors
export const LANGUAGE_NOTES: Record<Language, string> = {
  cuts: "scene after scene, each with its own soft way in — quiet and classic",
  line: "one canvas: the camera travels from scene to scene along a line it draws; the hero moment is carried in",
  carry: "one canvas: each scene's main thing flies on and becomes the next scene's",
  words: "one canvas: a word of each scene stays and becomes the next scene's first word",
  guide: "one canvas: a guide (paper plane, cursor or point of light) flies ahead and the camera follows it",
  timeline: "the scenes are numbered stations on one line; the hero moment is carried in",
  map: "a mind map: the story goes round a ring and ends at the hub (the call to action)",
  tiles: "a wall of screens, one scene per tile; the camera moves tile to tile",
  scroll: "a web page in a browser window that scrolls section to section",
  depth: "the camera flies forward through the scenes; at the hero moment it goes into the main thing",
  flip: "each scene turns over like a card; at the hero moment the camera goes into the main thing",
  whip: "fast whip pans with motion blur — energetic",
  turn: "the canvas turns a quarter round a corner between scenes — playful",
};
export type Direction = { language: Language; journey?: JourneyKind | null; guide?: GuideKind | null; recap?: boolean; hero?: number | null };

export type Staging = {
  family: Family;
  language?: Language;
  journey: JourneyKind | null;
  link: LinkKind | null;
  // the way into each scene (index = the scene arrived at; 0 unused)
  links: (LinkKind | null)[] | null;
  guide: GuideKind | null;
  recap: boolean;
  // the scene the hero moment is in (its way in is the signature move)
  hero?: number | null;
};
export type Family = "cuts" | "path" | "structure" | "scroll" | "depth" | "camera";
export const stagingName = (s: Staging | null | undefined) => (s ? s.language ?? [s.family, s.journey, s.link].filter(Boolean).join(":") : "cuts");
const FAMILY: Record<Language, Family> = { cuts: "cuts", line: "path", carry: "path", words: "path", guide: "path", timeline: "structure", map: "structure", tiles: "structure", scroll: "scroll", depth: "depth", flip: "depth", whip: "camera", turn: "camera" };

const PATHS: JourneyKind[] = ["right", "zigzag", "down", "diagonal", "snake"];

// what a scene holds, as the choices need it
const things = (s: PlacedScene) => s.items.filter((it) => !isAccent(it));
const early = (s: PlacedScene) => things(s).filter((it) => it.at <= s.from + 24);
const big = (s: PlacedScene, early = false) => things(s).some((it) => it.box.w >= 220 && it.box.h >= 150 && it.kind !== "button" && (!early || it.at <= s.from + 24));
const keyed = (s: PlacedScene) => !!s.text?.words.some((w) => w.key) || (s.text?.words.length ?? 0) >= 3;
const canCarry = (A: PlacedScene, B: PlacedScene) => things(A).length > 0 && early(B).length > 0;
const canWord = (A: PlacedScene, B: PlacedScene) => !!A.text && !!B.text && keyed(A);
const canDive = (A: PlacedScene, B: PlacedScene) => big(A) && early(B).length > 0;
const canReveal = (B: PlacedScene) => big(B, true);

// (the seed well stirred first: xorshift's first draws follow a near seed closely)
const stir = (x: number) => {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};

// The scene a word is in (the hero moment's scene).
export const sceneAt = (plan: ComposerPlan, frame: number) => Math.max(0, plan.scenes.findLastIndex((s) => s.from <= frame));
// Without a hero from the Motion Director: the first scene showing a big
// number or chart, else the one ~55% of the way in.
const heroOf = (plan: ComposerPlan) => {
  const i = plan.scenes.findIndex((s, k) => k > 0 && s.items.some((it) => it.kind === "stat" || it.kind === "chart"));
  return i > 0 ? i : Math.max(1, Math.round((plan.scenes.length - 1) * 0.55));
};

export function stageOf(plan: ComposerPlan, seed: number, recent: (Staging | null)[] = [], direction?: Direction | null): Staging {
  const R = rng(stir(seed ^ 0x5bd1e995) || 1);
  const sc = plan.scenes;
  const n = sc.length;
  // the language: the Motion Director's, else drawn (what this customer had lately counts against it)
  let language = direction?.language;
  if (!language) {
    const list = LANGUAGES.filter((l) => (l === "map" ? n >= 5 : ["timeline", "tiles"].includes(l) ? n >= 4 : true)).map((l) => [l, recent.reduce((w, s, i) => (s && stagingName(s) === l ? w * (0.15 + 0.5 * (i / Math.max(1, recent.length))) : w), 1)] as const);
    const sum = list.reduce((a, [, w]) => a + w, 0);
    let x = R.next() * sum;
    language = list[list.length - 1][0];
    for (const [l, w] of list) if ((x -= w) <= 0) {
      language = l;
      break;
    }
  }
  if (language === "map" && n < 5) language = "timeline";
  const hero = Math.max(1, Math.min(n - 1, direction?.hero ?? heroOf(plan)));
  const family = FAMILY[language];
  const recap = direction?.recap ?? R.next() < 0.6;
  const none: Staging = { family, language, journey: null, link: null, links: null, guide: null, recap: false, hero };
  if (language === "cuts") return none;
  if (language === "scroll") return { ...none, journey: "scroll" };
  const hops = (base: (A: PlacedScene, B: PlacedScene, i: number) => LinkKind, signature: (A: PlacedScene, B: PlacedScene) => LinkKind | null) =>
    sc.map((B, i): LinkKind | null => (i ? (i === hero ? signature(sc[i - 1], B) ?? base(sc[i - 1], B, i) : base(sc[i - 1], B, i)) : null));
  if (language === "depth" || language === "flip") {
    const plain: LinkKind = language === "depth" ? "tunnel" : "flip";
    // the hero moment: into the thing it is in, or out of the next one's
    const links = hops(() => plain, (A, B) => (canDive(A, B) ? "dive" : canReveal(B) ? "reveal" : null));
    return { ...none, link: plain, links };
  }
  if (language === "whip" || language === "turn") return { ...none, journey: language === "whip" ? (direction?.journey && ["right", "zigzag"].includes(direction.journey) ? direction.journey : R.next() < 0.66 ? "right" : "zigzag") : "right", link: language, recap };
  const journey = family === "structure" ? (language as JourneyKind) : direction?.journey && PATHS.includes(direction.journey) ? direction.journey : PATHS[Math.floor(R.next() * PATHS.length) % PATHS.length];
  if (language === "guide") return { ...none, journey, link: "lead", guide: direction?.guide ?? (["plane", "cursor", "orb"] as const)[Math.floor(R.next() * 3) % 3], recap };
  const carryIn = (A: PlacedScene, B: PlacedScene) => (canCarry(A, B) ? "carry" : null);
  const links =
    language === "carry" ? hops((A, B) => (canCarry(A, B) ? "carry" : "line"), () => null)
    : language === "words" ? hops((A, B) => (canWord(A, B) ? "word" : "line"), carryIn)
    : hops(() => "line", carryIn);
  return { ...none, journey, link: "line", links, recap };
}

// The recap (drawn in journey.tsx): the journey's last seconds, the camera
// pulling back to the whole way and the brand coming up over it. Its frames
// are added to the film. (Here, not in journey.tsx: the server stages plans
// and must not load Remotion.)
export const RECAP = 140;
export const withRecap = (plan: ComposerPlan): ComposerPlan => (plan.recap ? plan : { ...plan, recap: true, duration: plan.duration + RECAP });

// The plan as staged (and its recap's seconds added).
export function staged(plan: ComposerPlan, s: Staging | null | undefined): ComposerPlan {
  if (!s || s.family === "cuts" || STILL_BACKGROUND) return plan;
  const out: ComposerPlan = { ...plan, journey: s.journey, link: s.link, links: s.links, guide: s.guide };
  return s.recap && s.journey && s.journey !== "scroll" ? withRecap(out) : out;
}
