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
    // "background": full-frame scene image; otherwise the scene's main visual.
    role?: "background" | "foreground";
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

  // Every scene gets its own generated background image so no frame is text-only.
  const background = (scene: string, purpose: string) =>
    addToAsset(`bg:${scene}`, () => ({
      type: "abstract",
      source: "generated",
      role: "background",
      prompt: `Premium cinematic 3D illustration for a software promo video scene about: ${
        neutral(purpose) || "modern software"
      }. Glossy abstract shapes, soft volumetric light, depth of field, rich indigo and violet gradient palette, ${format} composition, ${SAFE}`,
    }), scene);

  let nextShot = 0;
  brief.scenes.forEach((scene, i) => {
    const id = sceneId(i);
    background(id, scene.purpose);
    switch (scene.visual) {
      case "ui":
      case "screenshot": {
        // Without screenshots the composition draws an app mockup instead.
        if (!screenshotPaths.length) return;
        // Rotate through available screenshots so scenes vary without new assets.
        const path = screenshotPaths[nextShot++ % screenshotPaths.length];
        return addToAsset(path, () => ({
          type: "screenshot",
          source: "project",
          role: "foreground",
          storage_path: path,
        }), id);
      }
      case "icon": {
        const subject = neutral(scene.purpose) || "software product";
        return addToAsset(`icon:${subject.toLowerCase()}`, () => ({
          type: "icon",
          source: "generated",
          role: "foreground",
          prompt: `Minimal flat line icon symbolizing: ${subject}. Single color on transparent background, ${SAFE}`,
        }), id);
      }
      case "abstract":
      case "typography":
        return; // Background image plus animated typography.
    }
  });

  return { assets };
}
