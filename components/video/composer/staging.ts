import { rng } from "./art";
import { isAccent } from "./layout";
import type { ComposerPlan, GuideKind, JourneyKind, LinkKind, PlacedScene } from "./types";

// How a video is staged — chosen by rule for every video, never fixed: the
// whole film as cuts between scenes, as one canvas the camera travels (a
// path, a timeline, a mind map, a wall of tiles, a web page that scrolls), as
// depth (into things, out of them, through, over like cards) or by the camera
// alone (a whip, a quarter turn); and for every move between two scenes the
// way that fits what those two scenes hold (a thing carried on, a word that
// stays, a line drawn…). Whether it ends by showing the whole way. The seed
// decides among what fits; what this customer had lately is less likely.

export type Staging = {
  family: Family;
  journey: JourneyKind | null;
  link: LinkKind | null;
  // the way into each scene (index = the scene arrived at; 0 unused)
  links: (LinkKind | null)[] | null;
  guide: GuideKind | null;
  recap: boolean;
};
export type Family = "cuts" | "path" | "structure" | "scroll" | "depth" | "camera";
export const stagingName = (s: Staging | null | undefined) => (s ? [s.family, s.journey, s.link].filter(Boolean).join(":") : "cuts");

const PATHS: JourneyKind[] = ["right", "zigzag", "down", "diagonal", "snake"];

// what a scene holds, as the choices need it
const things = (s: PlacedScene) => s.items.filter((it) => !isAccent(it));
const early = (s: PlacedScene) => things(s).filter((it) => it.at <= s.from + 24);
const big = (s: PlacedScene, early = false) => things(s).some((it) => it.box.w >= 220 && it.box.h >= 150 && it.kind !== "button" && (!early || it.at <= s.from + 24));
const keyed = (s: PlacedScene) => !!s.text?.words.some((w) => w.key) || (s.text?.words.length ?? 0) >= 3;

function pick<T>(R: ReturnType<typeof rng>, list: [T, number][]): T {
  const live = list.filter(([, w]) => w > 0);
  const sum = live.reduce((a, [, w]) => a + w, 0);
  let x = R.next() * sum;
  for (const [k, w] of live) if ((x -= w) <= 0) return k;
  return live[live.length - 1][0];
}

// (the seed well stirred first: xorshift's first draws follow a near seed closely)
const stir = (x: number) => {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};

export function stageOf(plan: ComposerPlan, seed: number, recent: (Staging | null)[] = []): Staging {
  const R = rng(stir(seed ^ 0x5bd1e995) || 1);
  const sc = plan.scenes;
  const n = sc.length;
  // what this customer had lately counts against it (the latest most)
  const seen = (f: (s: Staging) => boolean) => recent.reduce((w, s, i) => (s && f(s) ? w * (0.25 + 0.5 * (i / Math.max(1, recent.length))) : w), 1);
  const family = pick<Family>(R, [
    ["cuts", 1 * seen((s) => s.family === "cuts")],
    ["path", 2.4 * seen((s) => s.family === "path")],
    ["structure", (n >= 4 ? 2 : 0) * seen((s) => s.family === "structure")],
    ["scroll", (n >= 3 ? 0.8 : 0) * seen((s) => s.family === "scroll")],
    ["depth", 1.6 * seen((s) => s.family === "depth")],
    ["camera", 1.2 * seen((s) => s.family === "camera")],
  ]);
  const none: Staging = { family, journey: null, link: null, links: null, guide: null, recap: false };
  if (family === "cuts") return none;
  if (family === "scroll") return { ...none, journey: "scroll" };
  if (family === "depth") {
    // every move its own: into the thing when there is one to go into, out
    // of the next one's, over like a card now and then, else through
    const links: (LinkKind | null)[] = [null];
    for (let i = 1; i < n; i++) {
      const A = sc[i - 1], B = sc[i];
      const prev = links.slice(-2);
      const tired = (k: LinkKind) => (prev.length === 2 && prev.every((p) => p === k) ? 0.1 : 1);
      links.push(pick<LinkKind>(R, [["dive", (big(A) && early(B).length ? 3 : 0) * tired("dive")], ["reveal", (big(B, true) ? 2.2 : 0) * tired("reveal")], ["flip", 0.9 * tired("flip")], ["tunnel", 1.3 * tired("tunnel")]]));
    }
    return { ...none, link: "tunnel", links };
  }
  if (family === "camera") {
    const link = pick<LinkKind>(R, [["whip", 1 * seen((s) => s.link === "whip")], ["turn", 1 * seen((s) => s.link === "turn")]]);
    return { ...none, journey: link === "whip" ? pick<JourneyKind>(R, [["right", 2], ["zigzag", 1]]) : "right", link, recap: R.next() < 0.5 };
  }
  const journey = family === "structure"
    ? pick<JourneyKind>(R, [["timeline", 1 * seen((s) => s.journey === "timeline")], ["map", (n >= 5 ? 1 : 0) * seen((s) => s.journey === "map")], ["tiles", 1 * seen((s) => s.journey === "tiles")]])
    : pick<JourneyKind>(R, PATHS.map((k) => [k, seen((s) => s.journey === k)] as [JourneyKind, number]));
  // the moves: a guide the camera follows the whole way, or each move as its two scenes allow
  const lead = R.next() < 0.28 * seen((s) => s.link === "lead");
  if (lead) return { ...none, journey, link: "lead", guide: pick<GuideKind>(R, [["plane", 1], ["cursor", 1], ["orb", 1]]), recap: R.next() < 0.6 };
  const links: (LinkKind | null)[] = [null];
  for (let i = 1; i < n; i++) {
    const A = sc[i - 1], B = sc[i];
    const prev = links.slice(-2);
    const tired = (k: LinkKind) => (prev.length === 2 && prev.every((p) => p === k) ? 0.15 : 1);
    links.push(pick<LinkKind>(R, [
      ["carry", (things(A).length && early(B).length ? 2.2 : 0) * tired("carry")],
      ["word", (A.text && B.text && keyed(A) ? 1.6 : 0) * tired("word")],
      ["line", (journey === "timeline" || journey === "tiles" ? 0.6 : 1.4) * tired("line")],
    ]));
  }
  return { ...none, journey, link: "line", links, recap: R.next() < 0.6 };
}

// The recap (drawn in journey.tsx): the journey's last seconds, the camera
// pulling back to the whole way and the brand coming up over it. Its frames
// are added to the film. (Here, not in journey.tsx: the server stages plans
// and must not load Remotion.)
export const RECAP = 140;
export const withRecap = (plan: ComposerPlan): ComposerPlan => (plan.recap ? plan : { ...plan, recap: true, duration: plan.duration + RECAP });

// The plan as staged (and its recap's seconds added).
export function staged(plan: ComposerPlan, s: Staging | null | undefined): ComposerPlan {
  if (!s || s.family === "cuts") return plan;
  const out: ComposerPlan = { ...plan, journey: s.journey, link: s.link, links: s.links, guide: s.guide };
  return s.recap && s.journey && s.journey !== "scroll" ? withRecap(out) : out;
}
