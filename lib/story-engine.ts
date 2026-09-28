import type { AssetManifest } from "@/lib/asset-manifest";
import { compileFlowScript } from "@/components/video/flow/compile";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { type SceneScript, sceneScriptBlockers } from "@/lib/scene-script";
import { validateFlowPlan } from "@/components/video/flow/validate";
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
  if (flowScriptBlockers(flow, narration, words, durationSeconds).length) return null;
  // It must also compile to a valid plan; anything else falls back to the
  // Storyboard (never a failed video).
  try {
    const errors = validateFlowPlan(compileFlowScript(flow, { narration, words, durationSeconds }));
    if (errors.length) throw new Error(errors.slice(0, 3).join("; "));
    return flow;
  } catch (e) {
    console.error("flow compile failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Same for a stored SceneScript (Director v2), which is preferred over a
// FlowScript when both exist.
export function usableScene(scene: SceneScript | null | undefined, narration: string, format: string, words: WordTiming[] | null | undefined, durationSeconds: number) {
  if (!flowEngineEnabled() || !scene || !STORY_FORMATS.includes(format)) return null;
  if (sceneScriptBlockers(scene, narration, words, durationSeconds).length) return null;
  try {
    const errors = validateFlowPlan(compileSceneScript(scene, { narration, words, durationSeconds }));
    if (errors.length) throw new Error(errors.slice(0, 3).join("; "));
    return scene;
  } catch (e) {
    console.error("scene compile failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Legacy manifest images (Fal) are only needed by the Storyboard renderer.
// When a usable story or flow will be rendered, StoryWorld/Flow never show
// them, so they are not generated; without one, the legacy pipeline runs unchanged.
export function needsLegacyImages(manifest: AssetManifest | null | undefined, story: VisualStory | FlowScript | SceneScript | null) {
  return !story && !!manifest?.assets.some((a) => a.source === "generated" && a.status !== "completed");
}
