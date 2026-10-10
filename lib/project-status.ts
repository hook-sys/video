// One status per video from the pipeline and render fields, shared by the
// customer dashboard and the admin panel.
export type VideoState = "completed" | "rendering" | "generating" | "failed" | "needs_input" | "preview_ready" | "draft";

export function videoState(p: { pipeline_status: string | null; render_status: string | null }): VideoState {
  // (a video is ready when the pipeline is: it plays and downloads in the browser)
  if (p.pipeline_status === "completed" || p.render_status === "completed") return "completed";
  if (p.render_status === "processing") return "rendering";
  if (p.pipeline_status === "failed" || p.render_status === "failed") return "failed";
  if (p.pipeline_status === "running") return "generating";
  if (p.pipeline_status === "needs_input") return "needs_input";
  if (p.pipeline_status === "preview_ready") return "preview_ready";
  return "draft";
}

export const projectTitle = (p: { brand_name: string | null; website_url: string | null; id: string }) =>
  p.brand_name || (p.website_url ? p.website_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : `Video ${p.id.slice(0, 6)}`);
