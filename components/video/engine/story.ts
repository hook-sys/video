import { z } from "zod";

// VisualStory: what the AI Creative Director will describe (Phase 2C+). It is
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

export const Moment = z.object({
  cue: z.string(),
  intent: z.enum(INTENTS),
  area: z.string(),
  events: z.array(Event),
  camera: z.object({ shot: z.enum(SHOTS), subject: z.string() }).optional(),
  text: z.object({ content: z.string(), role: z.literal("support") }).optional(),
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
