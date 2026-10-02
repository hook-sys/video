import { eventLength } from "@/components/video/flow/compile-scene";
import { normalizeChoreography, resolveRelationships } from "@/lib/choreography";
import type { SceneBeat } from "@/lib/scene-script";
import type { SceneRecipe } from "@/lib/scene-recipe";
import { CHOREO_ACTION, type ShotScript } from "@/lib/shots";
import { spokenCueTimes, type WordTiming } from "@/lib/voice-timing";

// Relationship timing budget (the Director's side): a scene's chain of
// related events (lib/choreography.ts resolveRelationships) should fit the
// time its narration leaves before the next scene's words. Applied to the
// Director's answer before it is compiled: a chain that does not fit loses
// its least important events (never its first, the cause) until it fits or
// only the cause and one effect are left. Choreography phases, sounds and
// camera responses are never shortened. A chain that still does not fit is
// kept as it is: the compiler reports it (RELATIONSHIP_SCENE_OVERFLOW).
// Timings are the compiler's own: given a `measure`, its warnings decide
// (the scheduler's real start of the cause, the next scene's words or the
// stage's end); without one, the narration's word times (or their estimate)
// and each event's length to rest (compile-scene.ts eventLength).

const FPS = 30;
const LEAD = 3; // the compiler starts a beat this many frames before its word
type Behavior = SceneRecipe["behaviors"][number];

// The beat a behavior becomes (shots.ts recipeShot), for its length.
const BEAT: Record<Behavior["type"], Pick<SceneBeat, "action" | "style">> = {
  move: { action: "move", style: "recipe" },
  merge: { action: "merge", style: null },
  assemble: { action: "merge", style: "assemble" },
  transform: { action: "merge", style: "transform" },
  highlight: { action: "highlight", style: null },
  expand: { action: "expand", style: null },
  focus: { action: "focus", style: "recipe" },
  reveal: { action: "place", style: "rise" },
  connect: { action: "connect", style: null },
  flow: { action: "flow", style: null },
  arrange: { action: "arrange", style: "recipe" },
};
export function behaviorLength(b: Behavior): number {
  const choreo = b.choreography && CHOREO_ACTION[b.type] ? normalizeChoreography(b.choreography, CHOREO_ACTION[b.type]!) : null;
  return eventLength({ ...BEAT[b.type], choreo } as SceneBeat);
}

// The chains of a scene: each first event (one others follow) with its
// events and the frames from its start until the last of them is at rest.
export type Chain = { root: number; members: number[]; frames: number; last: number };
export function sceneChains(behaviors: Behavior[]): Chain[] {
  const { relations } = resolveRelationships(behaviors);
  const kids = new Map<number, number[]>();
  relations.forEach((r, i) => r && kids.set(r.after, [...(kids.get(r.after) ?? []), i]));
  const roots = [...kids.keys()].filter((k) => !relations[k]).sort((a, b) => a - b);
  return roots.map((root) => {
    const members: number[] = [];
    let frames = 0;
    let last = root;
    const walk = (i: number, start: number) => {
      members.push(i);
      const end = start + behaviorLength(behaviors[i]);
      if (end > frames || (end === frames && i > last)) [frames, last] = [end, i];
      for (const k of kids.get(i) ?? []) walk(k, end + relations[k]!.offset);
    };
    walk(root, 0);
    return { root, members: members.sort((a, b) => a - b), frames, last };
  });
}

// What an event is worth to the story: the hero's own action, then the main
// metaphor (a transform, an assemble, a merge), the chain's final emphasis;
// a supporting move, flow, reveal or highlight least.
const WEIGHT: Partial<Record<Behavior["type"], number>> = { transform: 3, assemble: 3, merge: 2, move: 1, flow: 1, connect: 1, reveal: 1 };
const worth = (b: Behavior, final: boolean) => (b.from === "hero" ? 4 : 0) + (WEIGHT[b.type] ?? 0) + (final ? 2 : 0);

// The frames between a scene's first related event and the next scene's
// words (or the end of the narration).
function budgets(shots: ShotScript, words: WordTiming[]): { at: (cue: string) => number | null; next: number }[] {
  const frame = (s: number) => Math.round(s * FPS) - LEAD;
  const shotAt = spokenCueTimes(shots.shots.map((s) => s.cue), words);
  const end = words.length ? frame(words[words.length - 1].end) : 0;
  return shots.shots.map((_, i) => {
    const from = shotAt[i] ?? 0;
    const after = words.filter((w) => w.start >= from);
    const next = shotAt.slice(i + 1).find((x) => x !== null);
    const at = (cue: string) => {
      const t = spokenCueTimes([cue], after)[0];
      return t === null ? null : frame(t);
    };
    return { at, next: next == null ? end : frame(next) };
  });
}

// One step of the simplification: the least important event after the
// cause (ties: the later one) leaves the chain; its followers follow the
// event it followed.
function dropOne(behaviors: Behavior[], chain: Chain): { behaviors: Behavior[]; victim: Behavior; parent: string } {
  const victim = chain.members.filter((i) => i !== chain.root).sort((a, b) => worth(behaviors[a], a === chain.last) - worth(behaviors[b], b === chain.last) || b - a)[0];
  const v = behaviors[victim];
  const parent = v.relationship!.after!;
  return { victim: v, parent, behaviors: behaviors.filter((_, i) => i !== victim).map((b) => (b.relationship?.after?.trim() === v.id?.trim() ? { ...b, relationship: { ...b.relationship, after: parent } } : b)) };
}

// The compiler's own verdict on a script (compile-scene.ts
// RELATIONSHIP_SCENE_OVERFLOW warnings: per chain its scene, its events'
// keys "<scene_id>#<behavior index>", requiredFrames and availableFrames),
// or null when it could not be compiled. The authoritative timing: where
// the scheduler really starts the cause (after the beats before it) and
// where the next scene's words (or the stage's end) are.
export type Overflow = { scene: string; chain: string[]; requiredFrames: number; availableFrames: number };
export type Measure = (shots: ShotScript) => Overflow[] | null;

export function fitRelationshipBudget(shots: ShotScript, words: WordTiming[], measure?: Measure): { shots: ShotScript; notes: string[] } {
  if (!shots.shots.some((s) => s.recipe?.behaviors.some((b) => b.relationship?.after))) return { shots, notes: [] };
  return measure ? fitMeasured(shots, words, measure) : fitEstimated(shots, words);
}

// With the compiler's timing: measure, simplify each overflowing chain until
// its estimate fits the compiler's available frames, measure again — until
// the compiler reports no overflow but chains already down to the cause and
// one effect. (A script that does not compile: the estimate alone.)
function fitMeasured(shots: ShotScript, words: WordTiming[], measure: Measure): { shots: ShotScript; notes: string[] } {
  const notes: string[] = [];
  const kept = new Set<string>(); // "<scene_id>#<cause id>": chains left as they are
  let cur = shots;
  for (let pass = 0; pass < 16; pass++) {
    const warned = measure(cur);
    if (!warned) {
      const est = fitEstimated(cur, words);
      return { shots: est.shots, notes: [...notes, ...est.notes] };
    }
    let progressed = false;
    for (const w of warned) {
      const si = cur.shots.findIndex((x) => x.recipe?.scene_id === w.scene);
      const r = cur.shots[si]?.recipe;
      const root = Number(w.chain[0]?.split("#").pop());
      if (!r || !Number.isInteger(root) || !r.behaviors[root]) continue;
      const tag = `${w.scene}#${r.behaviors[root].id ?? root}`;
      if (kept.has(tag)) continue;
      let behaviors = r.behaviors;
      let chain = sceneChains(behaviors).find((c) => c.root === root);
      if (!chain) continue;
      const name = (b: Behavior[], i: number) => `"${b[i].id}"`;
      if (chain.members.length <= 2) {
        notes.push(`shot ${si + 1} (${r.scene_id}): relationship budget: ${chain.members.map((i) => name(behaviors, i)).join(" → ")} needs ${w.requiredFrames} frames, ${w.availableFrames} available — kept (the cause and one effect; the compiler reports the overflow)`);
        kept.add(tag);
        continue;
      }
      // the compiler's numbers first; then the estimate against the same available frames
      let needs = w.requiredFrames;
      while (chain && chain.members.length > 2 && needs > w.availableFrames) {
        const d = dropOne(behaviors, chain);
        notes.push(`shot ${si + 1} (${r.scene_id}): relationship budget: chain needs ${needs} frames, ${w.availableFrames} available — dropped "${d.victim.id}" (${d.victim.type} ${d.victim.from}); its followers now follow "${d.parent}"`);
        behaviors = d.behaviors;
        chain = sceneChains(behaviors).find((c) => c.root === root);
        needs = chain?.frames ?? 0;
      }
      cur = { ...cur, shots: cur.shots.map((x, k) => (k === si ? { ...x, recipe: { ...r, behaviors } } : x)) };
      progressed = true;
      break; // measure again (indices of the other warnings may have moved)
    }
    if (!progressed) break;
  }
  return { shots: cur, notes };
}

// Without a compiler at hand: the narration's word times alone.
function fitEstimated(shots: ShotScript, words: WordTiming[]): { shots: ShotScript; notes: string[] } {
  const notes: string[] = [];
  const room = budgets(shots, words);
  let changed = false;
  const out = shots.shots.map((shot, si) => {
    const r = shot.recipe;
    if (!r || !r.behaviors.some((b) => b.relationship?.after)) return shot;
    let behaviors = r.behaviors;
    const kept = new Set<string>(); // chains left as they are (cannot get shorter)
    for (;;) {
      const over = sceneChains(behaviors).find((c) => {
        const at = room[si].at(behaviors[c.root].cue);
        return at !== null && c.frames > room[si].next - at && !kept.has(behaviors[c.root].id ?? "");
      });
      if (!over) break;
      const name = (i: number) => `"${behaviors[i].id}"`;
      const available = room[si].next - room[si].at(behaviors[over.root].cue)!;
      if (over.members.length <= 2) {
        notes.push(`shot ${si + 1} (${r.scene_id}): relationship budget: ${over.members.map(name).join(" → ")} needs ${over.frames} frames, ${available} available — kept (the cause and one effect; the compiler reports the overflow)`);
        kept.add(behaviors[over.root].id ?? "");
        continue;
      }
      const d = dropOne(behaviors, over);
      notes.push(`shot ${si + 1} (${r.scene_id}): relationship budget: chain needs ${over.frames} frames, ${available} available — dropped "${d.victim.id}" (${d.victim.type} ${d.victim.from}); its followers now follow "${d.parent}"`);
      behaviors = d.behaviors;
      changed = true;
    }
    return behaviors === r.behaviors ? shot : { ...shot, recipe: { ...r, behaviors } };
  });
  return { shots: changed ? { ...shots, shots: out } : shots, notes };
}
