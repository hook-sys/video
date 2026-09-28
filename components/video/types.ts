import type { ProductBrief } from "@/lib/ai/product-brief";
import type { WordTiming } from "@/lib/voice-timing";

export type RenderScene = ProductBrief["scenes"][number] & {
  id: string;
  // Signed URL of the scene's main visual (screenshot or icon), if any.
  assetUrl?: string;
  assetKind?: "screenshot" | "icon" | "image";
  // Signed URL of the full-frame generated background image, if any.
  backgroundUrl?: string;
};

export type StoryboardProps = {
  scenes: RenderScene[];
  // Requested video length; the composition always matches it exactly.
  durationSeconds: number;
  // Signed URL of the stored narration audio, if generated.
  audioUrl?: string;
  // Word timestamps of that narration; motion is estimated when absent.
  words?: WordTiming[];
};

// Props for server rendering; `format` only drives composition size.
// `story` set → the Preview-only continuous story engine renders instead.
export type RenderProps = StoryboardProps & { format: string; story?: { story: unknown; narration: string } | null };

export const COMPOSITION_ID = "Storyboard";
export const STORY_WORLD_ID = "StoryWorld"; // Preview-only continuous story engine

export const FPS = 30;

// Output resolutions. The composition is laid out at 1080p and scaled for 4K,
// so scenes render identically at either size.
export const RESOLUTIONS = { "1080p": 1, "4k": 2 } as const;
export type Resolution = keyof typeof RESOLUTIONS;

export const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export const secondsToFrames = (seconds: number) => Math.max(1, Math.round(seconds * FPS));

// Frame length per scene from `duration_seconds`, in storyboard order. The last
// scene absorbs rounding so the total equals the requested duration.
export function sceneTimings(scenes: { duration_seconds: number }[], totalSeconds: number) {
  const total = secondsToFrames(totalSeconds);
  const frames = scenes.map((s) => secondsToFrames(s.duration_seconds));
  const beforeLast = frames.slice(0, -1).reduce((sum, f) => sum + f, 0);
  if (frames.length) frames[frames.length - 1] = Math.max(1, total - beforeLast);
  return { frames, total: Math.max(total, beforeLast + 1) };
}
