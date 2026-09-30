import type { CompileBrand } from "@/components/video/flow/compile";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { compositionCheck, type Violation } from "@/components/video/flow/composition-check";
import type { FlowPlan } from "@/components/video/flow/types";
import { validateFlowPlan } from "@/components/video/flow/validate";
import { sceneScriptBlockers, type SceneScript } from "@/lib/scene-script";
import { expandShots, type ShotScript } from "@/lib/shots";
import type { WordTiming } from "@/lib/voice-timing";

// Variant search: the same shots are built several ways (look, hand-over,
// entrances — lib/shots.ts ShotVariant), each is compiled on the real voice
// timing and measured, and the cleanest is kept. No model call: a few
// hundred milliseconds per variant. The first seed comes from the project,
// so two projects with the same script look different, while one project
// always rebuilds the same video.

export type SearchContext = { narration: string; words?: WordTiming[] | null; durationSeconds: number; screenshots?: number; brand: CompileBrand };
export type Candidate = { seed: number; script: SceneScript; plan: FlowPlan; violations: Violation[]; notes: string[]; score: number };

// How much each broken rule costs a variant (what a viewer notices most weighs
// most). Pacing (idle, long-scene) is the shots' cut, the same in every
// variant: not counted here (the Director's revision handles it).
const WEIGHT: Record<string, number> = { stacked: 10, "overlap-text": 10, "empty-frame": 8, crowded: 6, "lonely-icon": 6, "tiny-screens": 6, "camera-swing": 6, "no-hero": 5, idle: 0, "long-scene": 0 };

export const seedFrom = (text: string) => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 1_000_003;

export function scoreCandidate(violations: Violation[], plan: FlowPlan) {
  // ("nothing new on screen" is pacing too.)
  const cost = (v: Violation) => (v.rule === "quality" && v.detail.includes("nothing new") ? 0 : (WEIGHT[v.rule] ?? 3));
  return violations.reduce((s, v) => s + cost(v), 0) + 4 * (plan.resolved?.left.length ?? 0);
}

export type SearchResult = { best: Candidate | null; picks: Candidate[]; blockers: string[]; tried: { seed: number; score: number; decor: string | null }[] };
// What customers kept: how often each look feature was downloaded
// (feature → value → count). Only the first of the picks follows it; the
// others explore, so the taste keeps learning.
export type Taste = Record<string, Record<string, number>>;
export const LOOK_FEATURES = ["decor", "tone", "icons", "cut", "side"] as const;

const feature = (c: Candidate, f: (typeof LOOK_FEATURES)[number]) => String(c.script.look?.[f] ?? "");
// How many look features two variants do not share (0–5).
const distance = (a: Candidate, b: Candidate) => LOOK_FEATURES.filter((f) => feature(a, f) !== feature(b, f)).length;
export function tasteScore(c: Candidate, taste?: Taste | null) {
  if (!taste) return 0;
  return LOOK_FEATURES.reduce((s, f) => {
    const counts = taste[f] ?? {};
    const vals = Object.values(counts);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return s + Math.log(((counts[feature(c, f)] ?? 0) + 1) / (mean + 1));
  }, 0);
}

// Builds the shots `tries` ways and keeps `pick` of them: the cleanest, and
// among equally clean ones those that look most unlike each other (a
// different background, icons, hand-over, side). The first pick is the one
// the taste likes best.
export function searchVariants(shots: ShotScript, ctx: SearchContext, baseSeed: number, { tries = 14, pick = 4, taste = null }: { tries?: number; pick?: number; taste?: Taste | null } = {}): SearchResult {
  const tried: SearchResult["tried"] = [];
  const all: Candidate[] = [];
  let blockers: string[] = [];
  for (let k = 0; k < tries; k++) {
    const seed = (baseSeed + k * 7919) % 1_000_003;
    const notes: string[] = [];
    const script = expandShots(shots, notes, ctx.narration, { seed });
    const blocked = sceneScriptBlockers(script, ctx.narration, ctx.words, ctx.durationSeconds);
    if (blocked.length) {
      // The words decide these, not the variant: another try will not help.
      blockers = blocked;
      break;
    }
    let plan: FlowPlan;
    try {
      plan = compileSceneScript(script, { narration: ctx.narration, words: ctx.words, durationSeconds: ctx.durationSeconds, brand: ctx.brand });
    } catch {
      continue;
    }
    if (validateFlowPlan(plan).length) continue;
    const violations = compositionCheck(script, plan, { narration: ctx.narration, words: ctx.words, durationSeconds: ctx.durationSeconds, screenshots: ctx.screenshots });
    const score = scoreCandidate(violations, plan);
    tried.push({ seed, score, decor: script.look?.decor ?? null });
    all.push({ seed, script, plan, violations, notes, score });
    // Enough clean ones to choose from: stop early.
    if (all.filter((c) => c.score === 0).length >= pick * 3) break;
  }
  if (!all.length) return { best: null, picks: [], blockers, tried };
  const floor = Math.min(...all.map((c) => c.score));
  // The pool: the cleanest variants (and, if too few, the next cleanest).
  const pool = [...all].sort((a, b) => a.score - b.score).filter((c, i) => c.score === floor || i < pick);
  const first = [...pool].filter((c) => c.score === floor).sort((a, b) => tasteScore(b, taste) - tasteScore(a, taste))[0];
  const picks = [first];
  while (picks.length < Math.min(pick, pool.length)) {
    const rest = pool.filter((c) => !picks.includes(c));
    // How different: features whose value no pick has yet (a new background,
    // new icons…), then the fewest features shared with the nearest pick.
    const fresh = (c: Candidate) => LOOK_FEATURES.filter((f) => !picks.some((p) => feature(p, f) === feature(c, f))).length;
    const far = (c: Candidate) => fresh(c) * 10 + Math.min(...picks.map((p) => distance(c, p)));
    rest.sort((a, b) => a.score - b.score || far(b) - far(a));
    // Clean first; among the cleanest, the most different.
    const best = rest.filter((c) => c.score === rest[0].score).sort((a, b) => far(b) - far(a))[0];
    picks.push(best);
  }
  return { best: picks[0], picks, blockers, tried };
}

// The single best variant (the first pick).
export function searchShots(shots: ShotScript, ctx: SearchContext, baseSeed: number, tries = 8): SearchResult {
  return searchVariants(shots, ctx, baseSeed, { tries, pick: 1 });
}
