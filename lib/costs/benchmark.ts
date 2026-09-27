import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COST_OPERATIONS, type CostOperation } from "./record";

type Row = { operation: CostOperation; resolution: string | null; estimated_cost_usd: number | string };

export type CostSummary = {
  total_cost_usd: number;
  cost_by_operation: Record<CostOperation, number>;
  cost_per_video_minute: number;
  // Shared (non-render) costs plus that resolution's render costs.
  by_resolution: Record<"1080p" | "4k", { total_cost_usd: number; cost_per_video_minute: number }>;
};

const round = (n: number) => Number(n.toFixed(6));

export async function getProjectCostSummary(
  client: SupabaseClient,
  projectId: string,
  videoSeconds: number,
): Promise<CostSummary> {
  const { data } = await client
    .from("cost_events")
    .select("operation, resolution, estimated_cost_usd")
    .eq("project_id", projectId);
  const rows = (data ?? []) as Row[];

  const byOp = Object.fromEntries(COST_OPERATIONS.map((op) => [op, 0])) as Record<CostOperation, number>;
  const renderByRes: Record<string, number> = {};
  for (const r of rows) {
    const cost = Number(r.estimated_cost_usd) || 0;
    byOp[r.operation] += cost;
    if (r.operation === "remotion_render" && r.resolution) {
      renderByRes[r.resolution] = (renderByRes[r.resolution] ?? 0) + cost;
    }
  }

  const minutes = videoSeconds > 0 ? videoSeconds / 60 : 0;
  const perMinute = (usd: number) => (minutes ? round(usd / minutes) : 0);
  const total = Object.values(byOp).reduce((a, b) => a + b, 0);
  const shared = total - byOp.remotion_render;
  const forRes = (res: "1080p" | "4k") => {
    const usd = shared + (renderByRes[res] ?? 0);
    return { total_cost_usd: round(usd), cost_per_video_minute: perMinute(usd) };
  };

  return {
    total_cost_usd: round(total),
    cost_by_operation: Object.fromEntries(
      Object.entries(byOp).map(([k, v]) => [k, round(v)]),
    ) as Record<CostOperation, number>,
    cost_per_video_minute: perMinute(total),
    by_resolution: { "1080p": forRes("1080p"), "4k": forRes("4k") },
  };
}
