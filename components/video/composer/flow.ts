import { rng } from "./art";
import { isAccent } from "./layout";
import { baseSize } from "./sizes";
import type { Staging } from "./staging";
import type { Box, CameraKind, ComposerPlan, Energy, Flow, LinkKind, PlacedItem, PlacedScene, TransitionKind } from "./types";

// "New version": how a video flows (the premium SaaS motion of the team's
// reference films). Every scene is on its own background with its own slow
// camera move; one scene leads into the next by a continuous way where an
// icon or a window joins them — an icon morphing into the next scene's hero
// icon, the camera zooming through a scene's icon (or main thing) into the
// next, a scene shrinking into the next scene's hero icon — else by a slide,
// a mask wipe or a cross-fade. The video's energy (drawn per video) sets its
// springs, its pace, the length of each way and how many are continuous.
// No React here: the server stages plans with it.

export type EnergySpec = {
  motion: "snappy" | "springy";
  pace: number;
  // how much the camera moves (the art's energy, 0–1)
  level: number;
  // frames a way between scenes takes
  hop: number;
  // the least share of scene changes made by a continuous way
  share: number;
  // frames between things that come in together (50–100 ms)
  stagger: number;
  spring: { damping: number; stiffness: number; mass: number };
  cameras: CameraKind[];
  plain: LinkKind[];
};
export const ENERGY: Record<Energy, EnergySpec> = {
  // (damping ratios ≈ 0.9, 0.7, 0.55: a settle, never an excessive bounce)
  calm: { motion: "snappy", pace: 0.85, level: 0.25, hop: 30, share: 0.3, stagger: 3, spring: { damping: 20, stiffness: 120, mass: 1 }, cameras: ["drift", "push", "pull", "rise", "float"], plain: ["fade", "slide", "wipe"] },
  medium: { motion: "snappy", pace: 1, level: 0.5, hop: 24, share: 0.4, stagger: 3, spring: { damping: 17, stiffness: 170, mass: 0.85 }, cameras: ["drift", "push", "pull", "rise", "orbit", "float"], plain: ["slide", "wipe", "fade"] },
  lively: { motion: "springy", pace: 1.15, level: 0.75, hop: 18, share: 0.5, stagger: 2, spring: { damping: 14, stiffness: 210, mass: 0.8 }, cameras: ["push", "drift", "orbit", "tilt", "rise", "pull", "macro"], plain: ["slide", "wipe", "tunnel"] },
};
export const CONTINUOUS = new Set<LinkKind>(["morph", "dive", "reveal"]);
// how fast a zoom through a window may grow (×e per this many frames⁻¹)
export const FLOW_ZOOM = 0.11;

const area = (b: Box) => b.w * b.h;
const things = (s: PlacedScene) => s.items.map((it, j) => ({ it, j })).filter(({ it }) => !isAccent(it));
const isIcon = (it: PlacedItem) => it.kind === "icon" && !!it.icon;
const heroOf = (s: PlacedScene) => [...things(s)].sort((a, b) => area(b.it.box) - area(a.it.box))[0] ?? null;
// there before the scene goes / there as it comes in
const atEnd = (A: PlacedScene, it: PlacedItem) => it.at <= A.to - 12;
const early = (B: PlacedScene, it: PlacedItem) => it.at <= B.from + 24;

// Where an icon thing's glyph is (its tile, above its word) — else the thing's box.
export function glyphRect(it: PlacedItem): Box {
  if (it.kind !== "icon") return it.box;
  const [bw] = baseSize(it);
  const k = it.box.w / bw;
  const s = (it.title ? 200 : 220) * k;
  return { x: it.box.x, y: it.title ? it.box.y - it.box.h / 2 + s / 2 : it.box.y, w: s, h: s };
}
// the next scene fits inside its window (a little in from its edges)
export const windowFit = (b: Box, W: number, H: number) => Math.min((b.w * 0.86) / W, (b.h * 0.8) / H);
const roomy = (it: PlacedItem) => it.kind !== "button" && glyphRect(it).w >= 90;

// an icon at the end of A morphing into B's hero icon
function morphPair(A: PlacedScene, B: PlacedScene): [number, number] | null {
  const h = heroOf(B);
  if (!h || !isIcon(h.it) || !early(B, h.it)) return null;
  const a = things(A).filter(({ it }) => isIcon(it) && atEnd(A, it)).sort((x, y) => area(y.it.box) - area(x.it.box))[0];
  return a ? [a.j, h.j] : null;
}
// A's icon (else its main thing) to go into, B coming up inside it
function diveWindow(A: PlacedScene, B: PlacedScene): number | null {
  if (!things(B).some(({ it }) => early(B, it))) return null;
  const w = things(A).filter(({ it }) => atEnd(A, it) && roomy(it)).sort((x, y) => Number(isIcon(y.it)) - Number(isIcon(x.it)) || area(y.it.box) - area(x.it.box))[0];
  return w ? w.j : null;
}
// B's hero icon (else its main thing) the scene before shrinks into
function revealWindow(B: PlacedScene): number | null {
  const h = heroOf(B);
  const icon = things(B).filter(({ it }) => isIcon(it) && early(B, it) && roomy(it)).sort((x, y) => area(y.it.box) - area(x.it.box))[0];
  if (icon && (!h || h.j === icon.j || isIcon(h.it))) return icon.j;
  return h && early(B, h.it) && roomy(h.it) ? h.j : null;
}

// what the Director asked for (a scene's own way in), within the energy
const ASKED: Partial<Record<TransitionKind, LinkKind>> = { morph: "morph", "zoom-in": "dive", "zoom-out": "reveal", "push-left": "slide", "push-right": "slide", "push-up": "slide", "push-down": "slide", whip: "slide", drop: "slide", flip: "slide", wipe: "wipe", iris: "wipe", clock: "wipe", fade: "fade", blur: "fade" };

// (the seed well stirred first)
const stir = (x: number) => {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};

// The ways between the scenes. `asked`: each scene's way in as the Director
// chose it — a continuous one is a suggestion (the video's seed keeps part
// of them and places the rest elsewhere), a plain one is kept where the
// energy has it; null: the code's choice. About the energy's share of the
// changes is continuous where an icon or a window joins the two scenes;
// never a cut.
export function flowStaging(plan: ComposerPlan, seed: number, energy: Energy, { hero = null, asked = [], continuous = true, cursor = true, depth = true }: { hero?: number | null; asked?: (TransitionKind | null)[]; continuous?: boolean; cursor?: boolean; depth?: boolean } = {}): Staging {
  const R = rng(stir(seed ^ 0x2545f491) || 1);
  const e = ENERGY[energy];
  const sc = plan.scenes;
  const n = sc.length;
  const links: (LinkKind | null)[] = Array(n).fill(null);
  const pairs: ([number, number] | null)[] = Array(n).fill(null);
  const tryCont = (i: number, kind: LinkKind): boolean => {
    const A = sc[i - 1], B = sc[i];
    if (kind === "morph") {
      const p = morphPair(A, B);
      if (p) return ((links[i] = "morph"), (pairs[i] = p), true);
    }
    if (kind === "dive") {
      const w = diveWindow(A, B);
      if (w != null) return ((links[i] = "dive"), (pairs[i] = [w, -1]), true);
    }
    if (kind === "reveal") {
      const w = revealWindow(B);
      if (w != null) return ((links[i] = "reveal"), (pairs[i] = [-1, w]), true);
    }
    return false;
  };
  const anyCont = (i: number, first: LinkKind = "morph") => continuous && [first, ...(["morph", "dive", "reveal"] as LinkKind[]).filter((k) => k !== first)].some((k) => tryCont(i, k));
  let plain = R.int(0, e.plain.length - 1);
  const nextPlain = (i: number, want?: LinkKind) => {
    // (the Director's plain way where the energy has it, else the next of the energy's, never the same twice in a row)
    const ok = (k: LinkKind) => e.plain.includes(k) && k !== links[i - 1];
    if (want && ok(want)) return want;
    for (let t = 0; t < e.plain.length; t++) {
      const k = e.plain[(plain + t) % e.plain.length];
      if (ok(k)) {
        plain = (plain + t + 1) % e.plain.length;
        return k;
      }
    }
    return e.plain[0];
  };
  // the share of continuous ways: about the energy's (calm 30 %, medium 40 %), at least half when lively
  const changes = Array.from({ length: n - 1 }, (_, k) => k + 1);
  const eligible = continuous ? changes.filter((i) => !!morphPair(sc[i - 1], sc[i]) || diveWindow(sc[i - 1], sc[i]) != null || revealWindow(sc[i]) != null) : [];
  const target = Math.min(eligible.length, Math.ceil((n - 1) * e.share) + (energy === "lively" ? R.int(0, 1) : 0));
  const want = (i: number) => (asked[i] ? ASKED[asked[i]!] : undefined);
  // the Director's continuous ways are suggestions: each video keeps a seeded
  // part of them (never all of two or more) and places the rest of its share
  // at other scene changes an icon or a window can join — so two videos of
  // one plan never join the same scenes the same way
  const suggested = R.shuffle(eligible.filter((i) => CONTINUOUS.has(want(i) as LinkKind)));
  const keep = suggested.length ? Math.max(1, Math.min(target, suggested.length - (suggested.length > 1 ? 1 : 0), Math.round(target * R.range(0.3, 0.7)))) : 0;
  const kept = suggested.slice(0, keep);
  const extra = [...R.shuffle(eligible.filter((i) => !suggested.includes(i))), ...suggested.slice(keep)];
  const kinds: LinkKind[] = ["morph", "dive", "reveal"];
  for (const i of kept) anyCont(i, want(i));
  for (const i of extra) {
    if (links.filter((l) => l && CONTINUOUS.has(l)).length >= target) break;
    anyCont(i, R.pick(kinds));
  }
  // the Director's other ways in, where the energy has them
  for (const i of changes) if (!links[i] && want(i) && !CONTINUOUS.has(want(i)!)) links[i] = nextPlain(i, want(i));
  for (let i = 1; i < n; i++) if (!links[i]) links[i] = nextPlain(i);
  const flow: Flow = { energy, pairs, cursor, depth };
  return { family: "depth", language: "depth", journey: null, link: "fade", links, guide: null, recap: false, hero: hero ?? null, flow };
}

// When each way between scenes runs (frames): its start and length. A scene's
// last words are said before it goes; the next one lands on its first word.
const TAIL = 4, LAND = 20;
export function flowMoves(plan: ComposerPlan): { start: number; dur: number }[] {
  const e = ENERGY[plan.flow?.energy ?? "medium"];
  const W = plan.w ?? 1920, H = plan.h ?? 1080;
  const sc = plan.scenes;
  return sc.map((s, i) => {
    if (!i) return { start: -1, dur: 1 };
    const kind = plan.links?.[i] ?? "fade";
    const pair = plan.flow?.pairs[i];
    const win = kind === "dive" && pair ? sc[i - 1].items[pair[0]] : kind === "reveal" && pair ? s.items[pair[1]] : null;
    const zoom = win ? Math.ceil(Math.log(1 / windowFit(glyphRect(win), W, H)) / FLOW_ZOOM) : 0;
    let dur = kind === "cut" ? 2 : kind === "morph" ? e.hop + 10 : win ? Math.max(e.hop + 12, zoom) : kind === "tunnel" ? e.hop + 8 : e.hop;
    const room = s.from - sc[i - 1].from - 16;
    dur = Math.max(kind === "cut" ? 2 : 12, Math.min(dur, room));
    const said = plan.words.filter((w) => w.start * 30 < s.from && w.start * 30 >= sc[i - 1].from).reduce((a, w) => Math.max(a, Math.round(w.end * 30)), -Infinity);
    let start = Math.round(s.from - dur * 0.65);
    if (Number.isFinite(said) && said - TAIL > start) start = Math.min(said - TAIL, s.from + LAND - dur);
    return { start, dur };
  });
}

// The plan as the "New version" stages it: its ways, its energy, things that
// come in together staggered, and the big cursor (one click per chapter).
export function flowed(plan: ComposerPlan, s: Staging): ComposerPlan {
  const flow = s.flow!;
  const e = ENERGY[flow.energy];
  const scenes = plan.scenes.map((sc) => {
    // things that come in on one word: one after another, a stagger apart (a row or a list is one thing)
    const seen = new Map<number, number>();
    const items = sc.items.map((it) => {
      if (isAccent(it)) return it;
      const k = seen.get(it.at) ?? 0;
      seen.set(it.at, k + 1);
      return k ? { ...it, at: it.at + k * e.stagger } : it;
    });
    return { ...sc, items };
  });
  const out: ComposerPlan = { ...plan, scenes, journey: null, link: s.link, links: s.links, guide: null, recap: false, flow, ...(s.hero != null ? { hero: s.hero } : {}) };
  return flow.cursor === false ? out : withCursor(out);
}

// The big cursor: once a chapter (about three scenes) it goes to the thing
// the voice is talking about and clicks it, and the click changes it (its
// moment: an icon pulses, a list ticks its rows, a button is pressed). The
// last scene's button has its own. The Director's cursors give way to it.
const CLICKABLE: Record<string, number> = { button: 5, card: 4, device: 3, chips: 3, icon: 2, stat: 2, chart: 1, steps: 1, flow: 1, compare: 1 };
export function withCursor(plan: ComposerPlan): ComposerPlan {
  const W = plan.w ?? 1920, H = plan.h ?? 1080;
  const n = plan.scenes.length;
  const scenes = plan.scenes.map((sc) => ({ ...sc, items: sc.items.filter((it) => it.kind !== "cursor") }));
  const body = Array.from({ length: Math.max(0, n - 2) }, (_, k) => k + 1);
  const chapters = Math.max(1, Math.round(body.length / 3));
  const R = rng(stir(plan.seed ^ 0x1b873593) || 1);
  for (let c = 0; c < chapters; c++) {
    const part = body.slice(Math.floor((c * body.length) / chapters), Math.floor(((c + 1) * body.length) / chapters));
    // the scene whose main thing takes a click best (long enough to show it)
    const pick = part
      .map((i) => ({ i, h: heroOf(scenes[i]) }))
      .filter((x): x is { i: number; h: { it: PlacedItem; j: number } } => !!x.h && (CLICKABLE[x.h.it.kind] ?? 0) > 0 && scenes[x.i].to - Math.max(scenes[x.i].from, x.h.it.at) >= 70)
      .sort((a, b) => (CLICKABLE[b.h.it.kind] ?? 0) - (CLICKABLE[a.h.it.kind] ?? 0) || a.i - b.i)[0];
    if (!pick) continue;
    const sc = scenes[pick.i];
    const it = pick.h.it;
    const click = Math.min(sc.to - 24, it.hit != null && it.hit > it.at + 20 ? it.hit : Math.max(it.at + 30, sc.from + 36));
    // the click is its moment
    sc.items[pick.h.j] = { ...it, hit: click };
    const g = glyphRect(it);
    const to = { x: g.x + g.w * (it.kind === "icon" ? 0.18 : 0.22), y: g.y + g.h * (it.kind === "icon" ? 0.2 : 0.18) };
    const side = to.x < W / 2 ? 1 : -1;
    const from = { x: Math.max(60, Math.min(W - 60, to.x + side * R.range(260, 420))), y: Math.max(60, Math.min(H - 60, to.y + R.range(180, 300))) };
    sc.items.push({ kind: "cursor", at: click - 34, hit: click, box: { x: to.x, y: to.y, w: 120, h: 120 }, from: { x: from.x, y: from.y, w: 120, h: 120 }, scale: 1, z: 9 } as PlacedItem);
  }
  return { ...plan, scenes };
}
