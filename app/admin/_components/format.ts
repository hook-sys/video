// Formatting and status helpers shared by the admin pages.
import type { BadgeTone } from "./ui";
import { projectTitle, videoState, type VideoState } from "@/lib/project-status";

export { projectTitle, videoState, type VideoState };

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

export const STATE_LABEL: Record<VideoState, [string, BadgeTone]> = {
  completed: ["Completed", "green"],
  rendering: ["Rendering", "blue"],
  generating: ["Generating", "violet"],
  failed: ["Failed", "red"],
  needs_input: ["Needs input", "amber"],
  preview_ready: ["Preview ready", "blue"],
  draft: ["Draft", "gray"],
};


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
