import type { P } from "./journey";
import { isAccent } from "./layout";
import { clamp01, mix, ramp } from "./motion";
import type { Box, ComposerPlan, PlacedItem } from "./types";

// Depth: one scene leads into the next by going deeper, not sideways.
//  dive   — the camera goes into the scene's main thing (a card, a screen, an
//           icon): the next scene is inside it, and opens as the camera nears;
//  reveal — the other way: the camera pulls back and the scene turns out to
//           have been inside the next scene's main thing;
//  tunnel — the camera flies forward: the scene's things rush past it and
//           the next scene comes up out of the depth (a field of light
//           streams past). Any scene can do this, so a hop with no thing to
//           go into (or come out of) is a tunnel.
// Everything is drawn flat (2D scale), never CSS 3D.

type Move = { start: number; dur: number };
export const DEPTHS = ["dive", "reveal", "tunnel"] as const;
export type DepthKind = (typeof DEPTHS)[number];
export const isDepth = (k: string | null | undefined): k is DepthKind => !!k && (DEPTHS as readonly string[]).includes(k);

// c: the window's middle (on the outer scene's frame); s: the inner scene's
// size in it (1 = the whole frame); item: the thing that is the window.
export type DepthHop = { kind: DepthKind; c: P; s: number; item: number };

const area = (b: Box) => b.w * b.h;
// the inner scene fits inside its window (a little in from its edges)
const fit = (b: Box) => Math.min((b.w * 0.86) / 1920, (b.h * 0.8) / 1080);

export function depthHops(plan: ComposerPlan, mv: Move[]): { plan: ComposerPlan; hops: (DepthHop | null)[] } {
  const want = plan.link as DepthKind;
  const scenes = plan.scenes.map((s) => ({ ...s, items: [...s.items] }));
  const hops = plan.scenes.map((B, i): DepthHop | null => {
    if (!i) return null;
    const A = plan.scenes[i - 1];
    const lift = mv[i].start;
    // a window is a thing with room in it (never the ask's button)
    const big = (it: PlacedItem) => it.box.w >= 220 && it.box.h >= 150 && it.kind !== "button";
    // something of the next scene to see in the window from the start
    const shows = B.items.some((it) => !isAccent(it) && it.at <= B.from + 24);
    if (want === "dive" && shows) {
      const w = A.items.map((it, j) => ({ it, j })).filter(({ it }) => !isAccent(it) && it.at <= lift && big(it)).sort((x, y) => area(y.it.box) - area(x.it.box))[0];
      if (w) {
        // what the camera dives into is there in the window from the start
        scenes[i].items = scenes[i].items.map((it) => (it.at <= B.from + 24 ? { ...it, at: Math.min(it.at, lift - 20) } : it));
        return { kind: "dive", c: { x: w.it.box.x, y: w.it.box.y }, s: fit(w.it.box), item: w.j };
      }
    }
    if (want === "reveal") {
      const w = B.items.map((it, j) => ({ it, j })).filter(({ it }) => !isAccent(it) && it.at <= B.from + 24 && big(it)).sort((x, y) => area(y.it.box) - area(x.it.box))[0];
      if (w) {
        // it is there (whole) when the camera starts pulling back
        scenes[i].items[w.j] = { ...w.it, at: Math.min(w.it.at, lift - 30) };
        return { kind: "reveal", c: { x: w.it.box.x, y: w.it.box.y }, s: fit(w.it.box), item: w.j };
      }
    }
    return { kind: "tunnel", c: { x: 960, y: 540 }, s: 1, item: -1 };
  });
  return { plan: { ...plan, scenes }, hops };
}

// The camera on the outer scene while it goes into a window: Z its zoom (1 =
// the outer scene fills the frame, 1/s = the inner one does), C the point of
// the outer scene at the middle of the frame. The zoom grows evenly (in
// steps of ×, not +) and the window's middle drifts to the frame's middle as
// it grows — the way a real zoom into a point looks.
export function zoomAt(u: number, c: P, s: number): { Z: number; C: P } {
  const Z = Math.pow(s, -u);
  const k = s >= 1 ? u : (1 - 1 / Z) / (1 - s);
  return { Z, C: { x: mix(960, c.x, k), y: mix(540, c.y, k) } };
}
export const outerTransform = (Z: number, C: P) => `translate(${(960 - C.x * Z).toFixed(2)}px, ${(540 - C.y * Z).toFixed(2)}px) scale(${Z.toFixed(5)})`;
export const innerTransform = (Z: number, C: P, c: P, s: number) => `translate(${(960 + (c.x - C.x) * Z - 960 * s * Z).toFixed(2)}px, ${(540 + (c.y - C.y) * Z - 540 * s * Z).toFixed(2)}px) scale(${(s * Z).toFixed(5)})`;

// Where the camera is on a hop at frame f: which hop, and how far along (0–1,
// eased), or null when it is resting in a scene.
export function hopAt(f: number, mv: Move[]): { seg: number; raw: number; u: number } {
  let seg = 0;
  for (let i = 1; i < mv.length; i++) if (f >= mv[i].start) seg = i;
  const raw = seg ? ramp(f, mv[seg].start, mv[seg].dur) : 1;
  // a softer curve than the sideways journey's: a zoom changes the whole
  // frame, so its fastest moment must stay calm
  return { seg, raw, u: (1 - Math.cos(raw * Math.PI)) / 2 };
}

// The tunnel's two layers: the scene being left grows past the camera (and
// is gone before it is huge); the next one comes up from far away. Both as
// a camera moving through depth would see them (scale = 1 / distance).
export function tunnelAt(u: number): { outS: number; outO: number; inS: number; inO: number } {
  const outS = 1 / Math.max(0.2, 1 - u * 0.75);
  const inS = 1 / (1 + (1 - u) * 3.2);
  return { outS, outO: 1 - clamp01((u - 0.22) / 0.36), inS, inO: clamp01((u - 0.28) / 0.34) };
}
