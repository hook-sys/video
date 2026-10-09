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

// Each state's label and its pill (site.css .gs-pill.*).
export const STATE_UI: Record<VideoState, { label: string; tone: "ok" | "busy" | "bad" | "wait" | "plain" }> = {
  completed: { label: "Ready", tone: "ok" },
  rendering: { label: "Rendering", tone: "busy" },
  generating: { label: "Creating", tone: "busy" },
  failed: { label: "Failed", tone: "bad" },
  needs_input: { label: "Needs your input", tone: "wait" },
  preview_ready: { label: "Preview ready", tone: "busy" },
  draft: { label: "Draft", tone: "plain" },
};
