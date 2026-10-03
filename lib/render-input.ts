import "server-only";
import { sceneScriptBlockers } from "@/lib/scene-script";
import { validateFlowPlan } from "@/components/video/flow/validate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductBrief } from "@/lib/ai/product-brief";
import { type AssetManifest, sceneId } from "@/lib/asset-manifest";
import { LOGO_FILE_PREFIX, SCREENSHOTS_BUCKET } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import type { RenderScene } from "@/components/video/types";
import { parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { storyAssetsEnabled, usableFlow, usableScene, usableStory } from "@/lib/story-engine";
import { compileFlowScript, type CompileBrand } from "@/components/video/flow/compile";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { buildPlan, type SevenPart } from "@/components/video/clean/plan";
import type { CleanPlan } from "@/components/video/clean/types";
import { type StudioRecipe, toRecipe } from "@/lib/studio-variants";

export type RenderProject = {
  id?: string;
  brand_name?: string | null;
  brand_color?: string | null;
  call_to_action?: string | null;
  user_id?: string;
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
  "id, user_id, format, duration_seconds, brand_name, brand_color, call_to_action, brief, assets_manifest, voice_status, voice_result, screenshot_evidence, direction";

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
  const scene = story ? null : usableScene(brief.data.scene, brief.data.script, project.format, wordTimings, project.duration_seconds);
  const flow = story || scene ? null : usableFlow(brief.data.flow, brief.data.script, project.format, wordTimings, project.duration_seconds);
  const flowing = !!(flow || scene);
  // Per scene: a full-frame background and/or a main visual.
  const bgByScene = new Map<string, string>();
  const fgByScene = new Map<string, { path: string; kind: "screenshot" | "icon" | "image" }>();
  for (const a of assets) {
    if (a.source === "generated" && a.status !== "completed") {
      // Not needed (and not generated) when StoryWorld renders the story.
      if (!story && !flowing) problems.push(`Asset ${a.id} is not generated.`);
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

  // Flow only: the customer's logo (closing lockup) and product screenshots
  // (shown on the UI planes). Missing files simply leave them out.
  let logoUrl: string | undefined;
  let screenshotUrls: string[] = [];
  if ((flowing || brief.data.clean) && project.id && project.user_id) {
    const folder = `${project.user_id}/${project.id}`;
    const [{ data: files }, { data: shots }] = await Promise.all([
      supabase.storage.from(SCREENSHOTS_BUCKET).list(folder, { search: LOGO_FILE_PREFIX }),
      supabase.from("project_screenshots").select("storage_path").eq("project_id", project.id).order("created_at"),
    ]);
    const logoFile = files?.find((f) => f.name.startsWith(LOGO_FILE_PREFIX));
    const paths = [...(logoFile ? [`${folder}/${logoFile.name}`] : []), ...(shots ?? []).map((x) => x.storage_path as string)];
    const { data: signedFlow } = paths.length ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(paths, expiresIn) : { data: [] };
    const urls = (signedFlow ?? []).map((x) => x.signedUrl || undefined);
    if (logoFile) logoUrl = urls.shift();
    screenshotUrls = urls.filter((u): u is string => !!u);
  }

  // Compiled on the voice's real word timestamps (no model call here). The
  // customer's own brand inputs win over what the brief inferred.
  const compilePlan = () => {
    const brand: CompileBrand = {
      name: project.brand_name?.trim() || brief.data.product_name,
      logo: logoUrl,
      cta: project.call_to_action?.trim() || brief.data.cta,
      color: project.brand_color,
    };
    const opts = { narration: brief.data.script, words: wordTimings, durationSeconds: project.duration_seconds, brand, screenshots: screenshotUrls };
    return scene ? compileSceneScript(scene, opts) : compileFlowScript(flow!, opts);
  };

  // The other videos to choose from (same voice and brand, other looks).
  const variants = scene && (brief.data.variants?.length ?? 0) > 1
    ? brief.data.variants!.flatMap((v) => {
        const usable = { ...v.scene, theme: scene.theme, pace: scene.pace };
        if (sceneScriptBlockers(usable, brief.data.script, wordTimings, project.duration_seconds).length) return [];
        try {
          const brand: CompileBrand = { name: project.brand_name?.trim() || brief.data.product_name, logo: logoUrl, cta: project.call_to_action?.trim() || brief.data.cta, color: project.brand_color };
          const plan = compileSceneScript(usable, { narration: brief.data.script, words: wordTimings, durationSeconds: project.duration_seconds, brand, screenshots: screenshotUrls });
          return validateFlowPlan(plan).length ? [] : [{ seed: v.seed, look: usable.look ?? null, plan }];
        } catch {
          return [];
        }
      })
    : [];

  // The clean film templates: the stored seven parts on the voice's words,
  // with the customer's brand inputs; the four videos offered.
  let clean: { plan: CleanPlan; variants: StudioRecipe[] } | null = null;
  const stored = brief.data.clean;
  if (stored && project.format === "16:9" && wordTimings?.length) {
    try {
      const script = stored.script as unknown as SevenPart;
      const brand = { ...script.brand, name: project.brand_name?.trim() || script.brand.name, color: project.brand_color || script.brand.color, cta: project.call_to_action?.trim() || script.brand.cta, icon: logoUrl ?? null };
      const built = buildPlan({ ...script, brand }, wordTimings);
      if (built.plan && stored.variants.length) clean = { plan: built.plan, variants: stored.variants.map(toRecipe) };
    } catch {
      clean = null;
    }
  }

  return {
    problems,
    variants,
    clean,
    props: {
      story: story ? { story, narration: brief.data.script, assets: storyAssets } : null,
      flow: flowing ? { plan: compilePlan() } : null,
      scenes,
      format: project.format,
      durationSeconds: project.duration_seconds,
      audioUrl: voice?.signedUrl,
      words: voicePath ? (parseWordTimings(project.voice_result?.timing?.words) ?? undefined) : undefined,
    },
  };
}
