import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage, type ImageInput, type ImageResult } from "@/lib/ai/fal";
import { downloadImage } from "@/lib/generated-assets";
import { falCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import { storyAssetsEnabled } from "@/lib/story-engine";
import { MAX_STORY_ASSETS, type StoryAsset, type StoryAssetRecord, type VisualStory } from "@/lib/visual-story";

// Visual Asset Planner (Preview-only, VISUAL_ASSETS=on): turns the validated
// story's asset requests into at most MAX_STORY_ASSETS generated images, one
// per continuity_id (every moment with that id reuses the same image). Images
// are stored privately; failures fall back to the procedural visual.

export { storyAssetsEnabled };

// Distinct requested assets, first description per continuity_id, capped.
export function planStoryAssets(story: VisualStory): StoryAsset[] {
  const byId = new Map<string, StoryAsset>();
  for (const m of story.moments) {
    const a = m.asset;
    if (a?.required && !byId.has(a.continuity_id)) byId.set(a.continuity_id, a);
  }
  return [...byId.values()].slice(0, MAX_STORY_ASSETS);
}

// Wide scenes fill a 16:9 frame; single subjects are square.
export const assetFormat = (a: Pick<StoryAsset, "type">) => (a.type === "environment" || a.type === "cinematic_scene" ? "16:9" : "1:1");

const STYLE = "Premium commercial motion-graphics still, cinematic soft lighting, clean composition with the subject large and centred, rich but restrained colour, high detail.";
const GUARDRAILS = (a: Pick<StoryAsset, "type">) =>
  `No readable text, no letters, no numbers, no logos, no watermarks, no UI screenshots.${a.type === "character" ? "" : " No people."}`;

export function assetPrompt(a: StoryAsset, visualStyle?: string) {
  return `${a.description.trim()}. ${STYLE}${visualStyle ? ` Visual style: ${visualStyle}.` : ""}`;
}

type Deps = { generate: (input: ImageInput) => Promise<ImageResult>; download: typeof downloadImage };

export async function generateStoryAssets(
  admin: SupabaseClient,
  story: VisualStory,
  ctx: { userId: string; projectId: string; visualStyle?: string },
  { generate, download }: Deps = { generate: generateImage, download: downloadImage },
): Promise<StoryAssetRecord[]> {
  const owner = { project_id: ctx.projectId, user_id: ctx.userId };
  return Promise.all(
    planStoryAssets(story).map(async (a): Promise<StoryAssetRecord> => {
      const started = Date.now();
      try {
        const { imageUrl, model, requestId } = await generate({ prompt: assetPrompt(a, ctx.visualStyle), format: assetFormat(a), guardrails: GUARDRAILS(a) });
        // Recorded as soon as Fal returns: the provider charges even if storing fails.
        await recordCost(admin, { ...owner, operation: "fal_image", model, quantity: 1, estimated_cost_usd: falCost(model, 1), metadata: { kind: "story_asset", continuity_id: a.continuity_id, asset_type: a.type, request_id: requestId } });
        const { body, type, ext } = await download(imageUrl);
        const path = `${ctx.userId}/${ctx.projectId}/story/${a.continuity_id}.${ext}`;
        const { error } = await admin.storage.from(SCREENSHOTS_BUCKET).upload(path, body, { contentType: type, upsert: true });
        if (error) throw new Error(`Asset storage failed: ${error.message}`);
        await recordCost(admin, { ...owner, operation: "storage", quantity: body.byteLength, estimated_cost_usd: storageCost(body.byteLength), metadata: { kind: "story_asset", continuity_id: a.continuity_id, unit: "bytes" } });
        return { continuity_id: a.continuity_id, type: a.type, status: "completed", storage_path: path, model, ms: Date.now() - started };
      } catch (e) {
        const error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        console.error("story asset failed:", { projectId: ctx.projectId, continuity_id: a.continuity_id, error });
        return { continuity_id: a.continuity_id, type: a.type, status: "failed", error, ms: Date.now() - started };
      }
    }),
  );
}
