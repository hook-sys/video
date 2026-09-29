import { PIPELINE_STEPS } from "@/lib/pipeline";
import type { VideoState } from "@/lib/project-status";

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

// Progress through the generation pipeline, 0–1, and the step's label.
export function pipelineProgress(step: string | null, state: VideoState) {
  if (state === "rendering") return { pct: 0.92, label: "Rendering" };
  const i = PIPELINE_STEPS.findIndex((s) => s.key === step);
  return i < 0 ? { pct: 0.05, label: "Starting" } : { pct: (i + 0.5) / PIPELINE_STEPS.length, label: PIPELINE_STEPS[i].label };
}

export const STATE_UI: Record<VideoState, { label: string; cls: string }> = {
  completed: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  rendering: { label: "Rendering", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  generating: { label: "Creating", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  needs_input: { label: "Needs your input", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  preview_ready: { label: "Preview ready", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  draft: { label: "Draft", cls: "bg-foreground/10 text-foreground/60" },
};
