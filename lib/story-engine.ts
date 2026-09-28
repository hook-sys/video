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
