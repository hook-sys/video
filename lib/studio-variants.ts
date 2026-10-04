import { BLOCK_IDS, HANDS, LOOK_IDS, type LookId, type Role, ROLES } from "@/components/video/clean/studio/ids";
import type { CleanVariant } from "@/lib/clean-variants";

// The studio's variation engine: a set is four videos, each one LOOK and one
// BLOCK per part. Within a set the four looks differ and, part by part, the
// blocks differ. Against everything this customer already had for the script
// (history), a new video never repeats a look with three or more of the same
// blocks, and the set as a whole prefers what has been seen least.

export type StudioRecipe = { look: LookId; blocks: Record<Role, string>; hue: number; story?: number; shape?: string };
// What a project stores per video: a studio recipe, or (older) a film template.
export type StoredVariant = CleanVariant | StudioRecipe;

const blockIds = (role: Role) => BLOCK_IDS[role];

// A video stored before the studio (one of the four film templates): the
// same look with the blocks that came from that film.
const FROM_FILM: Record<CleanVariant["film"], number> = { glow: 0, dusk: 1, fly: 2, connect: 3 };
export function toRecipe(v: StoredVariant): StudioRecipe {
  if ("look" in v) return v;
  const i = FROM_FILM[v.film];
  const blocks = Object.fromEntries(ROLES.map((r) => [r, r === "end" && v.film === "connect" ? "end.button" : BLOCK_IDS[r][i]])) as Record<Role, string>;
  return { look: v.film, blocks, hue: v.hue };
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// How much a recipe repeats an earlier one (same look counts 3, each same block 1).
export function overlap(a: StudioRecipe, b: StudioRecipe) {
  return (a.look === b.look ? 3 : 0) + ROLES.filter((r) => a.blocks[r] === b.blocks[r]).length;
}
// Too close to an earlier video: the same look and 3+ of the same blocks, or 6+ same blocks.
export const tooClose = (a: StudioRecipe, b: StudioRecipe) => {
  const same = ROLES.filter((r) => a.blocks[r] === b.blocks[r]).length;
  return (a.look === b.look && same >= 3) || same >= 6;
};

// How many cuts of a recipe are hand-offs (one part's object becomes the next).
export const handoffs = (v: StudioRecipe) => ROLES.slice(1).filter((r, i) => HANDS[v.blocks[ROLES[i]]]?.includes("z") && HANDS[v.blocks[r]]?.includes("a")).length;

// opts.recent: this customer's videos of other scripts (counted at half
// weight: the same look or opening again is avoided, not forbidden);
// opts.exclude: blocks whose pictures do not fit this script;
// opts.shapes: the script's story shapes ("hook-trio-reveal-…"), spread over
// the set so the videos tell it differently, the openings seen least first.
export type VariantOpts = { recent?: StoredVariant[]; exclude?: Set<string>; shapes?: string[] };
export function studioVariants(seed: number, history: StoredVariant[][], count = 4, opts: VariantOpts = {}): StudioRecipe[] {
  const past = history.flat().map(toRecipe);
  const recent = (opts.recent ?? []).map(toRecipe);
  const r = rng(seed + history.length * 104729);
  const seen = (role: Role, id: string) => past.filter((p) => p.blocks[role] === id).length + 0.5 * recent.filter((p) => p.blocks[role] === id).length + (opts.exclude?.has(id) ? 100 : 0);
  const seenLook = (l: LookId) => past.filter((p) => p.look === l).length + 0.5 * recent.filter((p) => p.look === l).length;
  let best: StudioRecipe[] = [];
  let bestScore = Infinity;
  // seeded tries (until a set has nothing too close to the past); keep the
  // one that repeats the past least and hands off most
  for (let t = 0; t < 400 && (t < 160 || bestScore >= 100); t++) {
    const looks = [...LOOK_IDS].map((l) => [l, seenLook(l) + r() * 1.5] as const).sort((a, b) => a[1] - b[1]).slice(0, count).map(([l]) => l);
    const perRole = Object.fromEntries(ROLES.map((role) => [role, [...blockIds(role)].map((id) => [id, seen(role, id) + r() * 1.5] as const).sort((a, b) => a[1] - b[1]).map(([id]) => id)])) as Record<Role, string[]>;
    const set = looks.map((look, i) => ({ look, hue: 0, blocks: Object.fromEntries(ROLES.map((role) => [role, perRole[role][i % perRole[role].length]])) as Record<Role, string> }));
    const close = set.reduce((n, v) => n + past.filter((p) => tooClose(v, p)).length, 0);
    // fewer repeats first; then more hand-offs between parts
    const score = close * 100 + set.reduce((n, v) => n + past.reduce((m, p) => m + overlap(v, p), 0), 0) - set.reduce((n, v) => n + handoffs(v), 0) * 0.6 - Math.min(...set.map(handoffs)) * 3 + r();
    if (score < bestScore) {
      best = set;
      bestScore = score;
    }
  }
  return withShapes(best, [...past, ...recent], opts.shapes ?? []);
}

// Each video a story shape: all shapes used before one repeats; the openings
// (first kind of part) this customer has seen least go first.
function withShapes(set: StudioRecipe[], seenBefore: StudioRecipe[], shapes: string[]): StudioRecipe[] {
  if (!shapes.length) return set;
  const opening = (shape: string) => shape.split("-")[0];
  const seenOpen = (shape: string) => seenBefore.filter((p) => p.shape && opening(p.shape) === opening(shape)).length;
  const order = shapes.map((sh, i) => ({ sh, i })).sort((a, z) => seenOpen(a.sh) - seenOpen(z.sh) || a.i - z.i);
  return set.map((v, k) => ({ ...v, story: order[k % order.length].i, shape: order[k % order.length].sh }));
}
