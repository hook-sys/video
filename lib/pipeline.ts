// Automatic generation pipeline: step order, labels and customer-facing errors.
export const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyzing", error: "We couldn't analyze your product." },
  { key: "writing", label: "Writing script", error: "We couldn't write the script." },
  { key: "voice", label: "Creating voice", error: "We couldn't create the voiceover." },
  { key: "visuals", label: "Preparing visuals", error: "We couldn't prepare the visuals." },
  {
    key: "validating",
    label: "Validating",
    error: "The generated script didn't pass our accuracy checks. Retry to write a new version.",
  },
  { key: "rendering", label: "Rendering", error: "We couldn't render the video." },
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number]["key"];

// Shown when neither the website nor screenshots give enough source material.
export const NEEDS_SCREENSHOTS_MESSAGE =
  "We couldn't read enough about your product from the website. To avoid inventing features, please create a new project and upload product screenshots.";

// Shown when the brief is written by rule ("AI only for the voice"): nothing
// writes a script then, so the voice needs the customer's own.
export const OWN_SCRIPT_MESSAGE =
  "Please write the script for the voice — the words your video should say. Create a new project and type it in the script box.";

export const RENDER_WORKER_MESSAGE = "Video rendering requires the production render worker.";

// The whole pipeline runs within one request (maxDuration 300 s).
export const PIPELINE_BUDGET_MS = 280_000;
// The Shot Director's share: what is left after `elapsedMs`, minus 30 s for
// the steps after it, at most 180 s.
export const flowBudgetMs = (elapsedMs: number) => Math.min(180_000, PIPELINE_BUDGET_MS - elapsedMs - 30_000);
