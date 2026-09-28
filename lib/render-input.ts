import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductBrief } from "@/lib/ai/product-brief";
import { type AssetManifest, sceneId } from "@/lib/asset-manifest";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import type { RenderScene } from "@/components/video/types";
import { parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { storyAssetsEnabled, usableFlow, usableStory } from "@/lib/story-engine";
import { compileFlowScript } from "@/components/video/flow/compile";

export type RenderProject = {
  format: string;
  duration_seconds: number;
  brief: unknown;
  assets_manifest: unknown;
  voice_status: string;
  voice_result: { storagePath?: string; timing?: { words?: WordTiming[] } | null } | null;
  screenshot_evidence?: unknown;
  direction?: string;
};

export const RENDER_PROJECT_COLUMNS =
  "format, duration_seconds, brief, assets_manifest, voice_status, voice_result, screenshot_evidence, direction";

// Resolves storyboard scenes, assets and narration into composition props with signed URLs.
// `problems` lists anything missing that a final render must not proceed without.
export async function buildRenderInput(
  supabase: SupabaseClient,
  project: RenderProject,
  expiresIn = 3600,
) {
  const problems: string[] = [];
  const brief = ProductBrief.safeParse(project.brief);
  if (!brief.success) return { problems: ["Generate a valid brief first."] };

  // Map each scene to its manifest asset (project screenshot or completed generated asset).
  const assets = (project.assets_manifest as AssetManifest | null)?.assets ?? [];
  if (!project.assets_manifest) problems.push("Prepare visual assets first.");
  // Preview-only engines: the validated story or flow, else null (→ Storyboard).
  const story = usableStory(brief.data.story, brief.data.script, project.format);
  const wordTimings = project.voice_status === "completed" ? parseWordTimings(project.voice_result?.timing?.words) : null;
  const flow = story ? null : usableFlow(brief.data.flow, brief.data.script, project.format, wordTimings, project.duration_seconds);
  // Per scene: a full-frame background and/or a main visual.
  const bgByScene = new Map<string, string>();
  const fgByScene = new Map<string, { path: string; kind: "screenshot" | "icon" | "image" }>();
  for (const a of assets) {
    if (a.source === "generated" && a.status !== "completed") {
      // Not needed (and not generated) when StoryWorld renders the story.
      if (!story && !flow) problems.push(`Asset ${a.id} is not generated.`);
      continue;
    }
    if (!a.storage_path) continue;
    // Older manifests have no role: abstract images were used as backgrounds.
    const isBackground = a.role ? a.role === "background" : a.type === "abstract";
    for (const s of a.scene_ids) {
      if (isBackground) bgByScene.set(s, a.storage_path);
      else fgByScene.set(s, { path: a.storage_path, kind: a.type === "abstract" ? "image" : a.type });
    }
  }
  const pathByScene = new Map<string, string>([
    ...bgByScene,
    ...[...fgByScene].map(([k, v]) => [`fg:${k}`, v.path] as [string, string]),
  ]);
  const paths = [...new Set(pathByScene.values())];
  const { data: signed } = paths.length
    ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(paths, expiresIn)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  if (paths.some((p) => !urlByPath.get(p))) problems.push("Some visual assets could not be loaded.");

  // Stored narration only; never regenerated here.
  const voicePath =
    project.voice_status === "completed" ? project.voice_result?.storagePath : undefined;
  const { data: voice } = voicePath
    ? await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(voicePath, expiresIn)
    : { data: null };
  if (!voice?.signedUrl) problems.push("Generate the voice first.");

  const url = (path?: string) => (path && urlByPath.get(path)) || undefined;
  const scenes: RenderScene[] = brief.data.scenes.map((scene, i) => {
    const fg = fgByScene.get(sceneId(i));
    return {
      ...scene,
      id: sceneId(i),
      assetUrl: url(fg?.path),
      assetKind: fg?.kind,
      backgroundUrl: url(bgByScene.get(sceneId(i))),
    };
  });

  // Its generated visuals as signed private URLs (continuity_id → url); any
  // missing one simply keeps the procedural visual for that moment.
  const storyAssetPaths = story && storyAssetsEnabled() ? (brief.data.story_assets ?? []).filter((a) => a.status === "completed" && a.storage_path) : [];
  const { data: storySigned } = storyAssetPaths.length
    ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(storyAssetPaths.map((a) => a.storage_path!), expiresIn)
    : { data: [] };
  const storyAssets = Object.fromEntries(
    storyAssetPaths.flatMap((a, i) => (storySigned?.[i]?.signedUrl ? [[a.continuity_id, storySigned[i].signedUrl]] : [])),
  );

  return {
    problems,
    props: {
      story: story ? { story, narration: brief.data.script, assets: storyAssets } : null,
      // Compiled on the voice's real word timestamps (no model call here).
      flow: flow ? { plan: compileFlowScript(flow, { narration: brief.data.script, words: wordTimings, durationSeconds: project.duration_seconds }) } : null,
      scenes,
      format: project.format,
      durationSeconds: project.duration_seconds,
      audioUrl: voice?.signedUrl,
      words: voicePath ? (parseWordTimings(project.voice_result?.timing?.words) ?? undefined) : undefined,
    },
  };
}
