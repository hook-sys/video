import type { AssetManifest } from "@/lib/asset-manifest";
import { storyBlockers, type VisualStory } from "@/lib/visual-story";

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

// Legacy manifest images (Fal) are only needed by the Storyboard renderer.
// When a usable story will be rendered, StoryWorld never shows them, so they
// are not generated; without one, the legacy pipeline runs unchanged.
export function needsLegacyImages(manifest: AssetManifest | null | undefined, story: VisualStory | null) {
  return !story && !!manifest?.assets.some((a) => a.source === "generated" && a.status !== "completed");
}
