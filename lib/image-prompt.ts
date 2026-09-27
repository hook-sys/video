import type { VisualPlan } from "@/lib/ai/product-brief";

// Semantic image prompts for generated background/hero assets. They describe
// a visual concept (never the raw narration), leave room for the animated
// objects and text that Remotion draws on top, and always carry the same
// safety and quality constraints.

const COMPOSITION: Record<string, string> = {
  "16:9": "wide landscape composition, subject slightly off-centre, generous empty space on both sides",
  "9:16": "tall portrait composition, subject in the upper-middle third, open space above and below",
  "1:1": "square composition, centred subject with even margins",
};

const OBJECT_PHRASE: Partial<Record<VisualPlan["primary_object"], string>> = {
  hero_visual: "a single striking hero visual of a modern software product",
  workspace: "one calm, organised digital workspace",
  task_cards: "many floating task cards",
  browser_tabs: "a clutter of overlapping browser windows",
  progress_chart: "an upward-trending abstract data visual",
  processing_core: "a glowing abstract processing core",
  result_card: "a polished finished result presented like a product shot",
  video_card: "a polished finished video frame presented like a product shot",
  feature_card: "clean floating feature panels",
  icon: "one simple symbolic object",
};

const ACTION_MOOD: Partial<Record<VisualPlan["action"], string>> = {
  scatter: "a feeling of overload and scattered focus",
  stack: "a feeling of things piling up",
  merge: "elements converging toward one centre",
  arrange: "order and structure emerging",
  complete: "calm clarity and completion",
  reveal: "a moment of reveal, light opening up",
  transform: "one form transforming into another",
  connect: "elements linked into one system",
  process: "intelligent processing in motion",
};

const NEGATIVE =
  "no watermark, no readable text, no letters, no numbers, no logos, no people, no animals, no creatures, no UI screenshots";

export function buildImagePrompt({
  plan,
  concept,
  style = "Premium SaaS",
  format,
}: {
  plan: Pick<VisualPlan, "primary_object" | "action">;
  concept: string; // the scene's meaning in a few neutral words (not the narration)
  style?: string;
  format: string;
}) {
  const subject = OBJECT_PHRASE[plan.primary_object] ?? "an abstract visual metaphor";
  const mood = ACTION_MOOD[plan.action] ?? "a confident, premium mood";
  return [
    `${style} motion-ad visual: ${subject}, expressing ${mood}${concept ? `, about ${concept}` : ""}`,
    "premium SaaS advertising aesthetic, dark elegant background with indigo and violet accents",
    COMPOSITION[format] ?? COMPOSITION["16:9"],
    "soft cinematic lighting with a gentle rim light, layered depth, shallow depth of field",
    "clear subject separation from the background, suitable empty space for motion graphics and text overlays",
    NEGATIVE,
  ].join(". ");
}
