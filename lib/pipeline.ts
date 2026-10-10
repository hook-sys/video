// Automatic generation pipeline: step order, labels and customer-facing errors.
export const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyzing", error: "We couldn't analyze your product." },
  { key: "writing", label: "Writing script", error: "We couldn't write the script." },
  { key: "voice", label: "Creating voice", error: "We couldn't create the voiceover." },
  { key: "visuals", label: "Composing the video", error: "We couldn't compose the video." },
  { key: "validating", label: "Checking every frame", error: "We couldn't check the video." },
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number]["key"];

// Shown when neither the website nor screenshots give enough source material.
export const NEEDS_SCREENSHOTS_MESSAGE =
  "We couldn't read enough about your product from the website. To avoid inventing features, please create a new project and upload product screenshots.";

// Shown when the brief is written by rule ("AI only for the voice"): nothing
// writes a script then, so the voice needs the customer's own.
export const OWN_SCRIPT_MESSAGE =
  "Please write the script for the voice — the words your video should say. Create a new project and type it in the script box.";

// Shown when no video could be composed on the voice.
export const COMPOSE_MESSAGE = "We couldn't compose the video this time. Please try again.";
