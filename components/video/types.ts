import type { ProductBrief } from "@/lib/ai/product-brief";

export type RenderScene = ProductBrief["scenes"][number] & {
  id: string;
  // Signed URL of the screenshot or generated asset used by this scene, if any.
  assetUrl?: string;
};

export type StoryboardProps = {
  scenes: RenderScene[];
  // Requested video length; the composition always matches it exactly.
  durationSeconds: number;
  // Signed URL of the stored narration audio, if generated.
  audioUrl?: string;
};

export const FPS = 30;

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
