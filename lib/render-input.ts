import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductBrief } from "@/lib/ai/product-brief";
import { LOGO_FILE_PREFIX, SCREENSHOTS_BUCKET, lockedVoiceScript, seedFrom } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import { parseWordTimings, type WordTiming } from "@/lib/voice-timing";
import { getSettings } from "@/lib/app-settings";
import { iconFor } from "@/lib/ai/motion-director";
import { inspected } from "@/components/video/composer/inspect";
import { frameOf } from "@/components/video/composer/frame";
import { placeAll } from "@/components/video/composer/layout";
import { type Staging, staged } from "@/components/video/composer/staging";
import { composeVariants } from "@/components/video/composer/variants";
import { pieceToWord, remapScript, scriptWords } from "@/components/video/composer/words";
import { Script as ComposerScript, type ComposerPlan } from "@/components/video/composer/types";

export type RenderProject = {
  id?: string;
  brand_name?: string | null;
  brand_color?: string | null;
  call_to_action?: string | null;
  user_id?: string;
  format: string;
  duration_seconds: number;
  brief: unknown;
  voice_status: string;
  voice_result: { storagePath?: string; timing?: { words?: WordTiming[] } | null } | null;
  direction?: string;
  website_url?: string | null;
};

export const RENDER_PROJECT_COLUMNS = "id, user_id, format, duration_seconds, brand_name, brand_color, call_to_action, brief, voice_status, voice_result, direction, website_url";

// What the studio shows beside the video: what its Motion Director decided.
export type ComposerAbout = { idea: string | null; mood: string | null; language: string | null; score: number | null };
export type ComposerView = { plans: ComposerPlan[]; screens: string[]; changes: { direction: string; at: string }[]; about?: ComposerAbout };
type StoredComposer = { videos?: { script: unknown; seed: number; source: ComposerPlan["source"]; staging?: Staging | null }[]; indexing?: "script"; changes?: { direction: string; at: string; ok: boolean }[] };

// The project's Composer videos laid out on its voice, with the customer's
// brand inputs and signed URLs (the voice, the logo, the screenshots).
// A project made before the Composer (or whose stored videos no longer
// parse) is composed now by the Composer's own director, from its seed — the
// same video every time it is opened. `problems`: what is missing.
export async function buildRenderInput(supabase: SupabaseClient, project: RenderProject, expiresIn = 3600): Promise<{ problems: string[]; composer: ComposerView | null; audioUrl: string | null }> {
  const problems: string[] = [];
  const brief = ProductBrief.safeParse(project.brief);
  const script = brief.success ? brief.data.script : lockedVoiceScript(project.direction);
  if (!script) problems.push("Write the script first.");

  // Stored narration only; never regenerated here.
  const voicePath = project.voice_status === "completed" ? project.voice_result?.storagePath : undefined;
  const { data: voice } = voicePath ? await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(voicePath, expiresIn) : { data: null };
  if (!voice?.signedUrl) problems.push("Generate the voice first.");
  const wordTimings = project.voice_status === "completed" ? parseWordTimings(project.voice_result?.timing?.words) : null;
  if (!wordTimings?.length) problems.push("The voice has no word timings.");
  const audioUrl = voice?.signedUrl ?? null;
  if (!script || !wordTimings?.length) return { problems, composer: null, audioUrl };

  // The customer's logo (the brand's mark) and product screenshots (shown on
  // screens in the film). Missing files simply leave them out.
  let logoUrl: string | undefined;
  let screenshotUrls: string[] = [];
  if (project.id && project.user_id) {
    const folder = `${project.user_id}/${project.id}`;
    const [{ data: files }, { data: shots }] = await Promise.all([
      supabase.storage.from(SCREENSHOTS_BUCKET).list(folder, { search: LOGO_FILE_PREFIX }),
      supabase.from("project_screenshots").select("storage_path").eq("project_id", project.id).order("created_at"),
    ]);
    const logoFile = files?.find((f) => f.name.startsWith(LOGO_FILE_PREFIX));
    const paths = [...(logoFile ? [`${folder}/${logoFile.name}`] : []), ...(shots ?? []).map((x) => x.storage_path as string)];
    const { data: signed } = paths.length ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(paths, expiresIn) : { data: [] };
    const urls = (signed ?? []).map((x) => x.signedUrl || undefined);
    if (logoFile) logoUrl = urls.shift();
    screenshotUrls = urls.filter((u): u is string => !!u);
  }

  const size = frameOf(project.format);
  const duration = Math.round(project.duration_seconds * 30);
  // the script's own words on the voice's times
  const shown = scriptWords(script, wordTimings);
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const name = project.brand_name?.trim() || (brief.success ? brief.data.product_name : "") || "Your product";
  const brand = { name, color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || (brief.success ? brief.data.cta : "") || "Get started", url: host, icon: logoUrl ?? null };

  const stored = (project.brief as { composer?: StoredComposer } | null)?.composer;
  // videos written on the voice's pieces of words (before Oct 8) are moved onto the script's words
  const toWord = stored?.indexing === "script" ? null : pieceToWord(wordTimings, shown);
  const plans = (stored?.videos ?? []).flatMap((v) => {
    const sc = ComposerScript.safeParse(v.script);
    if (!sc.success) return [];
    // (an icon name the library lacks: the nearest one it has)
    for (const scene of sc.data.scenes) for (const it of scene.items) if (it.icon || it.kind === "icon") it.icon = iconFor(it.icon, it.title);
    try {
      const { plan } = placeAll(toWord ? remapScript(sc.data, toWord) : sc.data, shown, duration, brand, v.seed, screenshotUrls.length, v.source, size);
      // (staged as it was chosen: a journey, depth, a recap…)
      // (the Frame Inspector's mends, as when it was made)
      return [inspected(staged(plan, v.staging)).plan];
    } catch {
      return [];
    }
  });
  // sound effects, unless the team turned them off (admin → Settings)
  const sfx = (await getSettings()).feature_sfx !== false;
  if (!plans.length) {
    // (made before the Composer: composed now, the same every time)
    const seed = seedFrom(project.id ?? script);
    plans.push(...composeVariants({ words: shown, brand, duration, seed, count: 1, screens: screenshotUrls.length, size }).plans);
  }
  for (const p of plans) p.sfx = sfx;

  // what the Motion Director decided (the idea, the camera language) and the code's score
  const sc = stored as { creative?: { idea?: string; language?: string }; profile?: { mood?: string; category?: string }; score?: { total?: number }; judge?: { best?: number; scores?: { candidate: number; total: number }[]; rule?: { total: number }[] } } | undefined;
  // (videos made before the Motion Director kept a Judge's score)
  const best = sc?.judge?.best ?? 0;
  const score = sc?.score?.total ?? sc?.judge?.scores?.find((x) => x.candidate === best)?.total ?? sc?.judge?.rule?.[best]?.total ?? null;
  const about = sc?.creative ? { idea: sc.creative.idea ?? null, mood: [sc.profile?.category, sc.profile?.mood].filter(Boolean).join(" · ") || null, language: stored?.videos?.at(-1)?.staging?.language ?? sc.creative.language ?? null, score } : undefined;
  const changes = (stored?.changes ?? []).filter((c) => c.ok).map((c) => ({ direction: c.direction, at: c.at }));
  return { problems, composer: { plans, screens: screenshotUrls, changes, about }, audioUrl };
}
