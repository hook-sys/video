import type { ProductBrief } from "@/lib/ai/product-brief";

export type RenderScene = ProductBrief["scenes"][number] & {
  id: string;
  // Signed URL of the screenshot or generated asset used by this scene, if any.
  assetUrl?: string;
};

export type StoryboardProps = { scenes: RenderScene[] };

export const FPS = 30;

export const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export const sceneFrames = (s: { duration_seconds: number }) =>
  Math.max(1, Math.round(s.duration_seconds * FPS));
