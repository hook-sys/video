import { ProductBrief } from "@/lib/ai/product-brief";

// A brief written by rule, not by AI (with "AI only for the voice" on
// /admin/models): the customer's own script is the narration, word for word;
// its sentences are the storyboard's scenes, timed at an even reading pace
// (the voice's real length replaces it). Nothing is claimed that the script
// does not say, and nothing is invented about the product.
const PACE = 2.6; // words a second

export function ruleBrief(input: { script: string; productName?: string | null; summary?: string | null; cta?: string | null }) {
  const script = input.script.trim();
  const sentences = (script.match(/[^.!?。]+[.!?。]*["”’)]*\s*/g) ?? [script]).map((s) => s.trim()).filter(Boolean);
  const scenes = sentences.map((narration) => ({
    duration_seconds: Math.max(1.5, Math.round((narration.split(/\s+/).filter(Boolean).length / PACE) * 10) / 10),
    purpose: "",
    narration,
    on_screen_text: [],
    visual: "typography" as const,
    animation: "fade",
    transition: "fade",
    sound_effects: [],
    actions: [],
    visual_plan: null,
  }));
  return ProductBrief.parse({
    product_name: input.productName?.trim() || "Your product",
    product_summary: input.summary?.trim() ?? "",
    supported_features: [],
    supported_claims: [],
    cta: input.cta?.trim() || "Get started",
    script,
    cast: [],
    scenes,
  });
}
