import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductBrief } from "@/lib/ai/product-brief";
import { type AssetManifest, sceneId } from "@/lib/asset-manifest";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import type { RenderScene } from "@/components/video/types";
import { PreviewPlayer } from "./preview-player";

// Development-only storyboard preview.
export default async function PreviewPage({ params }: PageProps<"/projects/[id]/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("format, brief, assets_manifest")
    .eq("id", id)
    .maybeSingle();
  const brief = ProductBrief.safeParse(project?.brief);
  if (!project || !brief.success) notFound();

  // Map each scene to its manifest asset (project screenshot or completed generated asset).
  const assets = (project.assets_manifest as AssetManifest | null)?.assets ?? [];
  const pathByScene = new Map<string, string>();
  for (const a of assets) {
    if (!a.storage_path || (a.source === "generated" && a.status !== "completed")) continue;
    for (const s of a.scene_ids) pathByScene.set(s, a.storage_path);
  }
  const paths = [...new Set(pathByScene.values())];
  const { data: signed } = paths.length
    ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const scenes: RenderScene[] = brief.data.scenes.map((scene, i) => {
    const path = pathByScene.get(sceneId(i));
    return { ...scene, id: sceneId(i), assetUrl: (path && urlByPath.get(path)) || undefined };
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href={`/projects/${id}`} className="text-sm text-foreground/70 underline">
        ← Project
      </Link>
      <h1 className="text-xl font-semibold">Storyboard preview (dev)</h1>
      <PreviewPlayer scenes={scenes} format={project.format} />
    </main>
  );
}
