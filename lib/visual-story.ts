import { z } from "zod";
import { spokenCueTimes, tokenize, type WordTiming } from "@/lib/voice-timing";

// VisualStory: what the AI Creative Director will describe. It is
// purely semantic — which objects, where the story is, what happens to them on
// which spoken words, and what the camera cares about. No coordinates, frames
// or anchors: the compiler decides how things physically move.

export const OBJECT_KINDS = [
  "task_card",
  "browser_tab",
  "workspace",
  "progress_panel",
  "generic_card",
  "message",
  "document",
  "input_field",
  "cursor",
  "metric",
  "hero_mark",
] as const;
export const AREA_KINDS = ["chaos", "convergence", "workspace", "product_ui", "data", "hero", "neutral"] as const;
export const MOODS = ["tense", "energetic", "calm", "focused", "triumphant"] as const;
export const INTENTS = ["establish", "accumulate", "overwhelm", "converge", "organize", "progress", "resolve", "reveal", "demonstrate"] as const;
export const VERBS = ["enter", "accumulate", "move", "converge", "arrange", "dock", "transform", "reveal", "complete", "build", "emphasize", "type", "exit"] as const;
export const SHOTS = ["establish", "follow", "push", "track", "reveal", "pull_back", "hold"] as const;
export const SLOTS = ["todo", "in_progress", "done", "dock", "panel"] as const;

export type ObjectKind = (typeof OBJECT_KINDS)[number];
export type AreaKind = (typeof AREA_KINDS)[number];
export type Verb = (typeof VERBS)[number];
export type Shot = (typeof SHOTS)[number];
export type SlotRole = (typeof SLOTS)[number];

export const Area = z.object({ id: z.string(), kind: z.enum(AREA_KINDS), mood: z.enum(MOODS) });

// Illustrative mock-UI labels only (never narration or claims).
export const CastObject = z.object({
  id: z.string(),
  kind: z.enum(OBJECT_KINDS),
  group: z.string().optional(),
  content: z.object({ title: z.string().optional(), tag: z.string().optional(), meta: z.string().optional() }).default({}),
  home: z.string(),
});

// Selector: "task_1", "task_1,task_2", "group:tasks", "task_*", "all", "all_loose".
export const Event = z.object({
  verb: z.enum(VERBS),
  targets: z.string(),
  into: z.string().optional(),
  slot: z.enum(SLOTS).optional(),
  state: z.string().optional(),
  pace: z.enum(["tight", "loose"]).optional(),
});

export const ASSET_TYPES = ["product_scene", "environment", "object", "cinematic_scene", "character", "metaphor"] as const;
export const MAX_STORY_ASSETS = 2; // distinct generated images per video (default: none)
export const StoryAsset = z.object({
  required: z.boolean(),
  type: z.enum(ASSET_TYPES),
  description: z.string(),
  continuity_id: z.string(),
});
export type StoryAsset = z.infer<typeof StoryAsset>;

// A generated asset, stored privately (never a raw provider URL).
export const StoryAssetRecord = z.object({
  continuity_id: z.string(),
  type: z.enum(ASSET_TYPES),
  status: z.enum(["completed", "failed"]),
  storage_path: z.string().optional(),
  error: z.string().optional(),
  model: z.string().optional(),
  ms: z.number().optional(),
});
export type StoryAssetRecord = z.infer<typeof StoryAssetRecord>;

export const Moment = z.object({
  cue: z.string(),
  intent: z.enum(INTENTS),
  area: z.string(),
  events: z.array(Event),
  camera: z.object({ shot: z.enum(SHOTS), subject: z.string() }).optional(),
  text: z.object({ content: z.string(), role: z.literal("support") }).optional(),
  // Optional AI-generated visual for a complex moment (product, environment,
  // physical object, cinematic scene, character, metaphor). Only a semantic
  // description: the renderer decides placement and motion. The same
  // continuity_id always reuses the same generated image.
  asset: StoryAsset.optional(),
});

export const VisualStory = z.object({
  version: z.literal(1),
  world: z.object({ areas: z.array(Area).min(1) }),
  cast: z.array(CastObject),
  moments: z.array(Moment),
  closing: z.object({ text: z.array(z.string()) }).default({ text: [] }),
});

export type Area = z.infer<typeof Area>;
export type CastObject = z.infer<typeof CastObject>;
export type StoryEvent = z.infer<typeof Event>;
export type Moment = z.infer<typeof Moment>;
export type VisualStory = z.infer<typeof VisualStory>;

// ---------------------------------------------------------------------------
// Deterministic validation. Errors make a story unusable as written (the
// engine would have to repair or drop parts of it); warnings are quality or
// policy concerns. Same input → same result.

export type StoryIssues = { errors: string[]; warnings: string[] };

const SELECTOR_WORDS = new Set(["all", "all_loose"]);
const CONTAINER_KINDS: ObjectKind[] = ["workspace"];
// Verbs that only make sense for some kinds.
const VERB_KINDS: Partial<Record<Verb, ObjectKind[]>> = {
  type: ["input_field"],
  build: ["progress_panel", "metric"],
  dock: ["browser_tab"],
};

const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

// Index of the cue's words in the narration tokens at/after `from`, or -1.
function cueIndex(tokens: string[], cue: string, from: number) {
  const want = tokenize(cue);
  if (!want.length) return -1;
  for (let i = from; i < tokens.length; i++) if (want.every((w, j) => tokens[i + j] && sameWord(tokens[i + j], w))) return i;
  return -1;
}

export function validateStory(story: VisualStory, narration?: string): StoryIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dup = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

  const areaIds = new Set(story.world.areas.map((a) => a.id));
  for (const id of dup(story.world.areas.map((a) => a.id))) errors.push(`duplicate area id "${id}"`);
  const castById = new Map(story.cast.map((c) => [c.id, c]));
  for (const id of dup(story.cast.map((c) => c.id))) errors.push(`duplicate object id "${id}"`);
  for (const c of story.cast) if (!areaIds.has(c.home)) errors.push(`${c.id}: home "${c.home}" is not an area`);
  const groups = new Set(story.cast.map((c) => c.group).filter(Boolean));

  const targeted = new Set<string>();
  const resolve = (sel: string, where: string) =>
    sel.split(",").map((p) => p.trim()).filter(Boolean).flatMap((part) => {
      if (SELECTOR_WORDS.has(part)) return story.cast.map((c) => c.id);
      if (part.startsWith("group:")) {
        if (!groups.has(part.slice(6))) errors.push(`${where}: unknown group "${part}"`);
        return story.cast.filter((c) => c.group === part.slice(6)).map((c) => c.id);
      }
      if (part.endsWith("*")) {
        const hit = story.cast.filter((c) => c.id.startsWith(part.slice(0, -1))).map((c) => c.id);
        if (!hit.length) errors.push(`${where}: "${part}" matches no object`);
        return hit;
      }
      if (!castById.has(part)) {
        errors.push(`${where}: unknown object "${part}"`);
        return [];
      }
      return [part];
    });

  if (!story.moments.some((m) => m.events.length)) errors.push("no moment has any event");
  story.moments.forEach((m, i) => {
    const where = `moment ${i + 1} ("${m.cue}")`;
    if (!areaIds.has(m.area)) errors.push(`${where}: area "${m.area}" is not an area`);
    for (const ev of m.events) {
      const ids = resolve(ev.targets, `${where} ${ev.verb}`);
      ids.forEach((id) => targeted.add(id));
      if (ev.into && !castById.has(ev.into) && !areaIds.has(ev.into)) errors.push(`${where} ${ev.verb}: "into" target "${ev.into}" is neither an object nor an area`);
      const allowed = VERB_KINDS[ev.verb];
      if (allowed) for (const id of ids) if (!allowed.includes(castById.get(id)!.kind)) warnings.push(`${where}: "${ev.verb}" has no effect on ${id} (${castById.get(id)!.kind})`);
      if ((ev.verb === "arrange" || ev.verb === "dock") && ev.into && castById.has(ev.into) && !CONTAINER_KINDS.includes(castById.get(ev.into)!.kind))
        warnings.push(`${where}: ${ev.verb} into ${ev.into} (not a container) arranges in place`);
    }
    if (m.camera) resolve(m.camera.subject, `${where} camera`);
  });
  for (const c of story.cast) if (!targeted.has(c.id)) warnings.push(`${c.id} is never used by any event`);

  // Generated visuals: few, described, with a stable continuity id.
  const assets = story.moments.flatMap((m, i) => (m.asset?.required ? [{ a: m.asset, i }] : []));
  for (const { a, i } of assets) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(a.continuity_id)) errors.push(`moment ${i + 1}: asset continuity_id "${a.continuity_id}" must be a short id`);
    if (a.description.trim().length < 12) errors.push(`moment ${i + 1}: asset description is too short to generate`);
    if (a.description.length > 400) errors.push(`moment ${i + 1}: asset description is too long (max 400 characters)`);
  }
  const distinct = new Set(assets.map(({ a }) => a.continuity_id));
  if (distinct.size > MAX_STORY_ASSETS) errors.push(`${distinct.size} distinct generated assets requested (max ${MAX_STORY_ASSETS}); reuse continuity_ids or drop some`);
  if (assets.length > story.moments.length - 1 && assets.length > 1) warnings.push("almost every moment has a generated asset (risk of a slideshow)");

  if (narration !== undefined) {
    const tokens = tokenize(narration);
    let from = 0;
    story.moments.forEach((m, i) => {
      const at = cueIndex(tokens, m.cue, from);
      if (at === -1) warnings.push(`moment ${i + 1}: cue "${m.cue}" not found in the narration${cueIndex(tokens, m.cue, 0) >= 0 ? " after the previous cue (out of order)" : ""}`);
      else from = at + 1;
    });
    // Closing/support text should come from the script, never from mock UI.
    const mock = new Set(story.cast.flatMap((c) => [c.content.title, c.content.tag, c.content.meta]).filter(Boolean).map((t) => t!.toLowerCase()));
    const lines = [...story.closing.text, ...story.moments.flatMap((m) => (m.text ? [m.text.content] : []))];
    for (const line of lines) {
      if (mock.has(line.toLowerCase())) errors.push(`text "${line}" is illustrative mock-UI content, not a message`);
      const words = tokenize(line);
      const missing = words.filter((w) => !tokens.some((t) => sameWord(t, w)));
      if (words.length && missing.length / words.length > 0.5) warnings.push(`text "${line}" is not from the narration`);
    }
  }
  if (story.closing.text.length > 3) warnings.push("more than 3 closing lines (only 3 are shown)");
  return { errors, warnings };
}

// What makes a story unusable for rendering against this narration: any error,
// or a cue that isn't spoken (visuals would no longer match the words).
// With the voice's word timestamps, every cue must also be actually spoken, in
// order (the voice is the timeline).
export function storyBlockers(story: VisualStory, narration: string, words?: WordTiming[] | null) {
  const v = validateStory(story, narration);
  const out = [...v.errors, ...v.warnings.filter((w) => w.includes("not found in the narration"))];
  if (words?.length) {
    spokenCueTimes(story.moments.map((m) => m.cue), words).forEach((at, i) => {
      if (at === null) out.push(`moment ${i + 1}: cue "${story.moments[i].cue}" is not spoken in the voice (in order)`);
    });
  }
  return out;
}
