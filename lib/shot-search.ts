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
export type SearchResult = { best: Candidate | null; blockers: string[]; tried: { seed: number; score: number; decor: string | null }[] };

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

export function searchShots(shots: ShotScript, ctx: SearchContext, baseSeed: number, tries = 8): SearchResult {
  const tried: SearchResult["tried"] = [];
  let best: Candidate | null = null;
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
    if (!best || score < best.score) best = { seed, script, plan, violations, notes, score };
    if (score === 0) break; // clean: the project's own first clean variant
  }
  return { best, blockers, tried };
}
