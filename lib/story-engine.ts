import type { AssetManifest } from "@/lib/asset-manifest";
import { type FlowScript, flowScriptBlockers } from "@/lib/flow-script";
import { storyBlockers, type VisualStory } from "@/lib/visual-story";
import type { WordTiming } from "@/lib/voice-timing";

// The continuous story engine is a Preview-only experiment: it runs only on a
// Vercel Preview deployment with VISUAL_ENGINE=story. Production (and local
// builds) always use the existing Storyboard renderer.
export const storyEngineEnabled = () => process.env.VERCEL_ENV === "preview" && process.env.VISUAL_ENGINE === "story";

// Generated visual assets for the story engine: Preview-only, VISUAL_ASSETS=on
// (default off).
export const storyAssetsEnabled = () => storyEngineEnabled() && process.env.VISUAL_ASSETS === "on";

// The story engine renders 16:9 only for now.
export const STORY_FORMATS = ["16:9"];

// A stored story is used only when the flag is on, the format is supported and
// it still validates against the narration. Anything else → Storyboard.
export function usableStory(story: VisualStory | null | undefined, narration: string, format: string) {
  if (!storyEngineEnabled() || !story || !STORY_FORMATS.includes(format)) return null;
  return storyBlockers(story, narration).length ? null : story;
}

// The Flow engine (pattern-based motion graphics directed by the AI) is also a
// Preview-only experiment: VISUAL_ENGINE=flow on a Vercel Preview deployment.
export const flowEngineEnabled = () => process.env.VERCEL_ENV === "preview" && process.env.VISUAL_ENGINE === "flow";

// A stored FlowScript is used only when the flag is on, the format is 16:9 and
// it still validates against the narration (and its word timestamps).
export function usableFlow(flow: FlowScript | null | undefined, narration: string, format: string, words: WordTiming[] | null | undefined, durationSeconds: number) {
  if (!flowEngineEnabled() || !flow || !STORY_FORMATS.includes(format)) return null;
  return flowScriptBlockers(flow, narration, words, durationSeconds).length ? null : flow;
}

// Legacy manifest images (Fal) are only needed by the Storyboard renderer.
// When a usable story or flow will be rendered, StoryWorld/Flow never show
// them, so they are not generated; without one, the legacy pipeline runs unchanged.
export function needsLegacyImages(manifest: AssetManifest | null | undefined, story: VisualStory | FlowScript | null) {
  return !story && !!manifest?.assets.some((a) => a.source === "generated" && a.status !== "completed");
}
