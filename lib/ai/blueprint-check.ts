import type { BlueprintObject, ProductBrief } from "@/lib/ai/product-brief";

// Continuity checks for the AI's visual blueprint (the same rules the prompt
// asks the model to self-check). Problems are fed back to the model once; any
// object still dropped silently is then kept on screen by `keepOmittedObjects`.

const PROCESSING_WORDS = /\b(process\w*|generat\w*|automat\w*|ai|analy\w*|comput\w*|render\w*|creat\w*|build\w*|transcrib\w*|summari\w*|convert\w*)\b/i;
// Plural concrete nouns → the object type that should appear several times.
const PLURALS: [RegExp, BlueprintObject["type"]][] = [
  [/\btasks\b/i, "task_card"],
  [/\btabs\b/i, "browser_tab"],
  [/\bvideos\b/i, "video_card"],
  [/\bresults\b/i, "result_card"],
];

type Scene = ProductBrief["scenes"][number];
const idsOf = (s: Scene) => new Set(s.visual_plan?.objects.map((o) => o.id) ?? []);

// Ids removed on purpose in a scene (exit, or turned into / replaced by something).
function removedIn(s: Scene) {
  const bp = s.visual_plan;
  if (!bp) return new Set<string>();
  const out = new Set(bp.objects.filter((o) => o.action === "exit").map((o) => o.id));
  for (const r of bp.relationships) {
    if (r.relation === "transforms_into") out.add(r.from);
    if (r.relation === "replaces") out.add(r.to);
  }
  return out;
}

export function checkContinuity(brief: ProductBrief): string[] {
  const problems: string[] = [];
  const planned = brief.scenes.filter((s) => s.visual_plan);
  if (!planned.length) return problems;
  if (!brief.cast.length) problems.push("cast is missing: create the persistent cast before the scenes.");
  const cast = new Set(brief.cast.map((c) => c.id));

  brief.scenes.forEach((s, i) => {
    const bp = s.visual_plan;
    if (!bp) return;
    const n = i + 1;
    const ids = idsOf(s);
    const extra = [...ids].filter((id) => !cast.has(id));
    if (cast.size && extra.length) problems.push(`scene ${n}: ids not in the cast (${extra.join(", ")}); use cast objects or add them to the cast.`);
    if (bp.objects.length && bp.objects.every((o) => o.type === "text")) problems.push(`scene ${n}: only text objects; show the narration's objects.`);
    if (bp.objects.filter((o) => o.type === "text").length > 1) problems.push(`scene ${n}: more than one text object.`);
    if (bp.camera.focus !== "all" && !ids.has(bp.camera.focus)) problems.push(`scene ${n}: camera focus "${bp.camera.focus}" is not an object in this scene.`);
    const words = `${s.narration} ${s.purpose}`;
    if (bp.objects.some((o) => o.type === "processing_core") && !PROCESSING_WORDS.test(words)) {
      problems.push(`scene ${n}: processing_core used but the narration describes no processing.`);
    }
    const phrases = new Set(s.on_screen_text.map((t) => t.trim().toLowerCase()));
    const featureFromText = bp.objects.filter((o) => o.type === "feature_card" && phrases.has(o.label.trim().toLowerCase()));
    if (featureFromText.length >= 2) problems.push(`scene ${n}: feature cards copied from on_screen_text; show the narration's objects instead.`);
    for (const [re, type] of PLURALS) {
      if (re.test(s.narration) && bp.objects.filter((o) => o.type === type).length < 2) problems.push(`scene ${n}: "${s.narration.match(re)![0]}" needs several ${type} objects.`);
    }

    const next = brief.scenes[i + 1];
    if (!next?.visual_plan) return;
    const nextIds = idsOf(next);
    const shared = [...ids].filter((id) => nextIds.has(id));
    if (shared.length < 2) problems.push(`scenes ${n}→${n + 1}: share ${shared.length} object id(s); reuse at least 2 unless the subject genuinely changes.`);
    const removed = new Set([...removedIn(s), ...removedIn(next)]);
    const dropped = [...ids].filter((id) => !nextIds.has(id) && !removed.has(id) && bp.objects.find((o) => o.id === id)?.type !== "text");
    if (dropped.length) problems.push(`scene ${n + 1}: ${dropped.join(", ")} disappear without exit/transform/replaces; keep them (start "previous") or remove them explicitly.`);
  });
  return problems;
}

// Objects the model still left out without removing them stay where they were.
export function keepOmittedObjects(brief: ProductBrief): ProductBrief {
  const scenes = brief.scenes.map((s) => ({ ...s, visual_plan: s.visual_plan && { ...s.visual_plan, objects: [...s.visual_plan.objects] } }));
  for (let i = 0; i + 1 < scenes.length; i++) {
    const cur = scenes[i].visual_plan;
    const next = scenes[i + 1].visual_plan;
    if (!cur || !next) continue;
    const nextIds = new Set(next.objects.map((o) => o.id));
    const removed = new Set([...removedIn(scenes[i]), ...removedIn(scenes[i + 1])]);
    for (const o of cur.objects) {
      if (nextIds.has(o.id) || removed.has(o.id) || o.action === "exit" || o.type === "text") continue;
      next.objects.unshift({ ...o, role: "context", start: "previous", end: "previous", action: "move", cue: "", emphasis: false });
    }
  }
  return { ...brief, scenes };
}
