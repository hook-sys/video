import type { ProductBrief } from "@/lib/ai/product-brief";

export type AssetManifest = {
  assets: {
    id: string;
    type: "screenshot" | "icon" | "abstract" | "image";
    source: "project" | "generated";
    scene_ids: string[];
    prompt?: string;
    // Private storage path: project screenshot, or generated file once created.
    storage_path?: string;
    // Generation state for `source: "generated"` assets.
    status?: "pending" | "completed" | "failed";
    error?: string;
  }[];
};

export const sceneId = (index: number) => `scene-${index + 1}`;

// Shared guardrails for every generated prompt.
const SAFE =
  "no text, no letters, no logos, no people, no animals, no creatures; clean modern software aesthetic";

// Keep generated prompts free of numbers, prices and quoted claims.
const neutral = (s: string) =>
  s.replace(/[\d$€£%"“”]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

/**
 * Deterministically maps storyboard scenes to the visuals they need.
 * Project screenshots are reused first; only uncovered scenes get generated assets.
 */
export function buildAssetManifest(
  brief: ProductBrief,
  screenshotPaths: string[],
  format: string,
): AssetManifest {
  const assets: AssetManifest["assets"] = [];
  const byKey = new Map<string, AssetManifest["assets"][number]>();
  type NewAsset = Omit<AssetManifest["assets"][number], "id" | "scene_ids">;
  const addToAsset = (key: string, make: () => NewAsset, scene: string) => {
    let asset = byKey.get(key);
    if (!asset) {
      const fields = make();
      const n = assets.filter((a) => a.type === fields.type).length + 1;
      asset = { id: `${fields.type}-${n}`, ...fields, scene_ids: [] };
      byKey.set(key, asset);
      assets.push(asset);
    }
    asset.scene_ids.push(scene);
  };

  const abstract = (scene: string) =>
    addToAsset("abstract", () => ({
      type: "abstract",
      source: "generated",
      prompt: `Abstract geometric motion background, soft gradients and simple shapes, ${format} composition, ${SAFE}`,
    }), scene);

  let nextShot = 0;
  brief.scenes.forEach((scene, i) => {
    const id = sceneId(i);
    switch (scene.visual) {
      case "ui":
      case "screenshot": {
        if (!screenshotPaths.length) return abstract(id);
        // Rotate through available screenshots so scenes vary without new assets.
        const path = screenshotPaths[nextShot++ % screenshotPaths.length];
        return addToAsset(path, () => ({
          type: "screenshot",
          source: "project",
          storage_path: path,
        }), id);
      }
      case "icon": {
        const subject = neutral(scene.purpose) || "software product";
        return addToAsset(`icon:${subject.toLowerCase()}`, () => ({
          type: "icon",
          source: "generated",
          prompt: `Minimal flat line icon symbolizing: ${subject}. Single color on transparent background, ${SAFE}`,
        }), id);
      }
      case "abstract":
        return abstract(id);
      case "typography":
        return; // Rendered as text; no asset needed.
    }
  });

  return { assets };
}
