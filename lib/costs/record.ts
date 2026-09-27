import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COST_OPERATIONS = [
  "openai_brief",
  "fal_voice",
  "fal_image",
  "remotion_render",
  "storage",
] as const;
export type CostOperation = (typeof COST_OPERATIONS)[number];

export type CostEvent = {
  project_id: string;
  user_id: string;
  operation: CostOperation;
  model?: string | null;
  duration_seconds?: number | null;
  resolution?: string | null;
  quantity?: number | null;
  estimated_cost_usd: number;
  metadata?: Record<string, unknown>;
};

// Writes a cost event with the service-role client. Never throws, so cost
// tracking can't change generation behavior.
export async function recordCost(admin: SupabaseClient, event: CostEvent) {
  try {
    const { error } = await admin.from("cost_events").insert({
      ...event,
      estimated_cost_usd: Number(event.estimated_cost_usd.toFixed(6)),
      metadata: event.metadata ?? {},
    });
    if (error) console.error("recordCost failed:", error.message);
  } catch (e) {
    console.error("recordCost failed:", e);
  }
}
