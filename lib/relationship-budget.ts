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
// Timings are the compiler's own: the narration's word times (or their
// estimate) and each event's length to rest (compile-scene.ts eventLength).

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

export function fitRelationshipBudget(shots: ShotScript, words: WordTiming[]): { shots: ShotScript; notes: string[] } {
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
      // the least important event after the cause (ties: the later one)
      const victim = over.members.filter((i) => i !== over.root).sort((a, b) => worth(behaviors[a], a === over.last) - worth(behaviors[b], b === over.last) || b - a)[0];
      const v = behaviors[victim];
      const parent = v.relationship!.after!;
      notes.push(`shot ${si + 1} (${r.scene_id}): relationship budget: chain needs ${over.frames} frames, ${available} available — dropped ${name(victim)} (${v.type} ${v.from}); its followers now follow "${parent}"`);
      behaviors = behaviors.filter((_, i) => i !== victim).map((b) => (b.relationship?.after?.trim() === v.id?.trim() ? { ...b, relationship: { ...b.relationship, after: parent } } : b));
      changed = true;
    }
    return behaviors === r.behaviors ? shot : { ...shot, recipe: { ...r, behaviors } };
  });
  return { shots: changed ? { ...shots, shots: out } : shots, notes };
}
