// Formatting and status helpers shared by the admin pages.
import type { BadgeTone } from "./ui";

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 && n > 0 ? 4 : 2 })}`;

export function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const minutesSince = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : 0);

export type ProjectRow = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  brand_name: string | null;
  website_url: string | null;
  duration_seconds: number | null;
  status: string | null;
  pipeline_status: string | null;
  pipeline_step: string | null;
  pipeline_error: string | null;
  render_status: string | null;
  render_error: string | null;
  render_4k_status: string | null;
  video_path: string | null;
};
export const PROJECT_COLUMNS =
  "id, user_id, created_at, updated_at, brand_name, website_url, duration_seconds, status, pipeline_status, pipeline_step, pipeline_error, render_status, render_error, render_4k_status, video_path";

// One status per video, from the pipeline and render fields.
export type VideoState = "completed" | "rendering" | "generating" | "failed" | "needs_input" | "preview_ready" | "draft";
export function videoState(p: Pick<ProjectRow, "pipeline_status" | "render_status">): VideoState {
  if (p.render_status === "completed") return "completed";
  if (p.render_status === "processing") return "rendering";
  if (p.pipeline_status === "failed" || p.render_status === "failed") return "failed";
  if (p.pipeline_status === "running") return "generating";
  if (p.pipeline_status === "needs_input") return "needs_input";
  if (p.pipeline_status === "preview_ready") return "preview_ready";
  return "draft";
}
export const STATE_LABEL: Record<VideoState, [string, BadgeTone]> = {
  completed: ["Completed", "green"],
  rendering: ["Rendering", "blue"],
  generating: ["Generating", "violet"],
  failed: ["Failed", "red"],
  needs_input: ["Needs input", "amber"],
  preview_ready: ["Preview ready", "blue"],
  draft: ["Draft", "gray"],
};

export const projectTitle = (p: Pick<ProjectRow, "brand_name" | "website_url" | "id">) =>
  p.brand_name || (p.website_url ? p.website_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : `Video ${p.id.slice(0, 6)}`);

export const ROLE_TONE: Record<string, BadgeTone> = { super_admin: "violet", admin: "blue", user: "gray" };
export const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", admin: "Admin", user: "Customer" };

// Keeps PostgREST filter syntax out of free-text search.
export const cleanSearch = (q: unknown) => (typeof q === "string" ? q.replace(/[,()%_*\\"]/g, " ").trim().slice(0, 80) : "");

export function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86400000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace(" ", " ") };
  });
}

// ISO timestamp `days` ago (0 = now), for date filters.
export const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
