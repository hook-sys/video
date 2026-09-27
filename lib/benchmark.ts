import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectCostSummary } from "@/lib/costs/benchmark";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";

export const BENCHMARK_CASES = [
  { duration: 30, resolution: "1080p" },
  { duration: 30, resolution: "4k" },
  { duration: 60, resolution: "1080p" },
  { duration: 60, resolution: "4k" },
] as const;

const ext = (path: string) => path.split(".").pop() ?? "jpg";

// Copies the source project's inputs (settings, website capture, screenshots)
// into a fresh project so each case runs the full pipeline independently.
export async function cloneProjectForBenchmark(
  admin: SupabaseClient,
  userId: string,
  sourceId: string,
  durationSeconds: number,
): Promise<string> {
  const [{ data: src }, { data: capture }, { data: shots }] = await Promise.all([
    admin
      .from("projects")
      .select("website_url, direction, format, voice_language, voice_style")
      .eq("id", sourceId)
      .eq("user_id", userId)
      .single(),
    admin
      .from("website_captures")
      .select("url, title, meta_description, visible_text, screenshot_path")
      .eq("project_id", sourceId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("project_screenshots").select("storage_path, original_filename").eq("project_id", sourceId),
  ]);
  if (!src) throw new Error("Source project not found.");

  const { data: project, error } = await admin
    .from("projects")
    .insert({ ...src, user_id: userId, duration_seconds: durationSeconds })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const dir = `${userId}/${project.id}`;
  const copy = async (from: string, to: string) => {
    const { error: copyError } = await admin.storage.from(SCREENSHOTS_BUCKET).copy(from, to);
    if (copyError) throw new Error(`Copy failed: ${copyError.message}`);
    return to;
  };

  if (capture) {
    const id = crypto.randomUUID();
    const screenshot_path = capture.screenshot_path
      ? await copy(capture.screenshot_path, `${dir}/website-${id}.${ext(capture.screenshot_path)}`)
      : null;
    await admin.from("website_captures").insert({
      ...capture,
      id,
      screenshot_path,
      project_id: project.id,
      user_id: userId,
      status: "completed",
    });
  }
  for (const s of shots ?? []) {
    const storage_path = await copy(s.storage_path, `${dir}/${crypto.randomUUID()}.${ext(s.storage_path)}`);
    await admin.from("project_screenshots").insert({
      project_id: project.id,
      user_id: userId,
      storage_path,
      original_filename: s.original_filename,
    });
  }
  return project.id;
}

type Event = {
  operation: string;
  model: string | null;
  quantity: number | string | null;
  metadata: Record<string, unknown> | null;
};

// Usage metrics from the project's cost ledger plus estimated cost.
export async function collectBenchmarkMetrics(
  admin: SupabaseClient,
  projectId: string,
  durationSeconds: number,
) {
  const { data } = await admin
    .from("cost_events")
    .select("operation, model, quantity, metadata")
    .eq("project_id", projectId);
  const events = (data ?? []) as Event[];
  const of = (op: string) => events.filter((e) => e.operation === op);
  const sumMeta = (list: Event[], key: string) =>
    list.reduce((sum, e) => sum + (Number(e.metadata?.[key]) || 0), 0);
  const sumQty = (list: Event[]) => list.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);

  const brief = of("openai_brief");
  const voice = of("fal_voice");
  const images = of("fal_image");
  const render = of("remotion_render");
  const summary = await getProjectCostSummary(admin, projectId, durationSeconds);

  return {
    openai_model: brief[0]?.model ?? null,
    openai_input_tokens: sumMeta(brief, "input_tokens"),
    openai_output_tokens: sumMeta(brief, "output_tokens"),
    voice_model: voice[0]?.model ?? null,
    voice_characters: sumQty(voice),
    image_model: images[0]?.model ?? null,
    image_count: images.length,
    render_ms: sumMeta(render, "render_ms"),
    mp4_bytes: sumMeta(render, "bytes"),
    estimated_cost_usd: summary.total_cost_usd,
    cost_per_minute_usd: summary.cost_per_video_minute,
    cost_breakdown: summary.cost_by_operation,
  };
}
