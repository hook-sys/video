import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage } from "@/lib/ai/fal";
import type { AssetManifest } from "@/lib/asset-manifest";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import { isPublicHost } from "@/lib/website-capture";
import { falCost, storageCost } from "@/lib/costs/pricing";
import { recordCost } from "@/lib/costs/record";

type Asset = AssetManifest["assets"][number];

const MAX_BYTES = 5 * 1024 * 1024; // matches the private bucket limit
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function downloadImage(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !(await isPublicHost(parsed.hostname))) {
    throw new Error("Image URL is not allowed.");
  }
  const res = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Image download failed (HTTP ${res.status}).`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) throw new Error(`Unsupported image type: ${type || "unknown"}.`);
  const body = await res.arrayBuffer();
  if (body.byteLength === 0) throw new Error("Image is empty.");
  if (body.byteLength > MAX_BYTES) throw new Error("Image is larger than 5 MB.");
  return { body, type, ext };
}

// Generates one icon/abstract asset and stores it privately. Never throws.
export async function generateAsset(
  admin: SupabaseClient,
  asset: Asset,
  ctx: { userId: string; projectId: string; format: string },
): Promise<Asset> {
  if (asset.source !== "generated" || (asset.type !== "icon" && asset.type !== "abstract")) {
    return asset;
  }
  if (!asset.prompt) return { ...asset, status: "failed", error: "Asset has no prompt." };
  try {
    const { imageUrl, model, requestId } = await generateImage({
      prompt: asset.prompt,
      format: asset.type === "icon" ? "1:1" : ctx.format,
    });
    const owner = { project_id: ctx.projectId, user_id: ctx.userId };
    // Recorded as soon as Fal returns: the provider charges even if storing fails.
    await recordCost(admin, {
      ...owner,
      operation: "fal_image",
      model,
      quantity: 1,
      estimated_cost_usd: falCost(model, 1),
      metadata: { asset_id: asset.id, asset_type: asset.type, request_id: requestId },
    });
    const { body, type, ext } = await downloadImage(imageUrl);
    const path = `${ctx.userId}/${ctx.projectId}/assets/${asset.id}.${ext}`;
    const { error } = await admin.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(path, body, { contentType: type, upsert: true });
    if (error) throw new Error(`Asset storage failed: ${error.message}`);
    await recordCost(admin, {
      ...owner,
      operation: "storage",
      quantity: body.byteLength,
      estimated_cost_usd: storageCost(body.byteLength),
      metadata: { kind: "asset", asset_id: asset.id, unit: "bytes" },
    });
    return { ...asset, storage_path: path, status: "completed", error: undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Asset generation failed.";
    return { ...asset, status: "failed", error: message.slice(0, 300) };
  }
}
