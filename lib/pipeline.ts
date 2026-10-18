// Automatic generation pipeline: step order, labels and customer-facing errors.
export const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyzing", error: "We couldn't analyze your product." },
  { key: "writing", label: "Writing script", error: "We couldn't write the script." },
  { key: "voice", label: "Creating voice", error: "We couldn't create the voiceover." },
  { key: "visuals", label: "Composing the video", error: "We couldn't compose the video." },
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number]["key"];
