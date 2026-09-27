import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCREENSHOTS_BUCKET, VIDEOS_BUCKET } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import {
  generateBrief,
  generateVisualAssets,
  generateVoice,
  prepareAssets,
  renderVideo,
} from "@/app/projects/actions";
import type { AssetManifest } from "@/lib/asset-manifest";
import { getProjectCostSummary } from "@/lib/costs/benchmark";
import { SubmitButton } from "@/components/submit-button";

// Allows the AI brief call to finish.
export const maxDuration = 60;

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: screenshots } = await supabase
    .from("project_screenshots")
    .select("storage_path, original_filename")
    .eq("project_id", id)
    .order("created_at");
  const { data: signed } = screenshots?.length
    ? await supabase.storage
        .from(SCREENSHOTS_BUCKET)
        .createSignedUrls(screenshots.map((s) => s.storage_path), 3600)
    : { data: [] };

  const { data: capture } = await supabase
    .from("website_captures")
    .select("status, error_message, title, meta_description, visible_text, screenshot_path")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: captureShot } = capture?.screenshot_path
    ? await supabase.storage
        .from(SCREENSHOTS_BUCKET)
        .createSignedUrl(capture.screenshot_path, 3600)
    : { data: null };

  const { data: voiceAudio } =
    project.voice_status === "completed" && project.voice_result?.storagePath
      ? await supabase.storage
          .from(AUDIO_BUCKET)
          .createSignedUrl(project.voice_result.storagePath, 3600)
      : { data: null };

  const manifestAssets = (project.assets_manifest as AssetManifest | null)?.assets ?? [];
  const generatedPaths = manifestAssets
    .filter((a) => a.source === "generated" && a.storage_path)
    .map((a) => a.storage_path!);
  const { data: assetUrls } = generatedPaths.length
    ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(generatedPaths, 3600)
    : { data: [] };
  const assetUrl = (path?: string) => assetUrls?.find((u) => u.path === path)?.signedUrl;
  const assetsBusy = project.assets_status === "preparing" || project.assets_status === "generating";

  const { data: video } =
    project.render_status === "completed" && project.video_path
      ? await supabase.storage.from(VIDEOS_BUCKET).createSignedUrl(project.video_path, 3600)
      : { data: null };
  const { data: download } =
    project.render_status === "completed" && project.video_path
      ? await supabase.storage
          .from(VIDEOS_BUCKET)
          .createSignedUrl(project.video_path, 3600, { download: "video.mp4" })
      : { data: null };

  const costs =
    process.env.NODE_ENV !== "production"
      ? await getProjectCostSummary(supabase, id, project.duration_seconds)
      : null;
  const usd = (n: number) => `$${n.toFixed(4)}`;

  const rows: [string, string][] = [
    ["Website URL", project.website_url ?? "—"],
    ["Direction", project.direction],
    ["Duration", `${project.duration_seconds} sec`],
    ["Format", project.format],
    ["Voice language", project.voice_language],
    ["Voice style", project.voice_style],
    ["Status", project.status],
  ];
  const canGenerateBrief = capture?.status === "completed" || !!screenshots?.length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/dashboard" className="text-sm text-foreground/70 underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">Project</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-foreground/60">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {screenshots && screenshots.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {screenshots.map((s, i) =>
            signed?.[i]?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs
              <img
                key={s.storage_path}
                src={signed[i].signedUrl}
                alt={s.original_filename}
                className="aspect-video w-full rounded-md border border-foreground/10 object-cover"
              />
            ) : null,
          )}
        </div>
      )}
      {capture && (
        <section className="flex flex-col gap-2 text-sm">
          <h2 className="font-medium">
            Website capture:{" "}
            <span className="text-foreground/70">
              {capture.status === "pending" ? "In progress (refresh to update)" : capture.status}
            </span>
          </h2>
          {capture.error_message && <p className="text-red-600">{capture.error_message}</p>}
          {capture.status === "completed" && (
            <>
              <p>{capture.title || "Untitled page"}</p>
              {capture.meta_description && (
                <p className="text-foreground/70">{capture.meta_description}</p>
              )}
              <p className="text-foreground/60">
                {capture.visible_text?.length ?? 0} characters of text captured
              </p>
            </>
          )}
          {captureShot?.signedUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img
              src={captureShot.signedUrl}
              alt="Website screenshot"
              className="w-full rounded-md border border-foreground/10"
            />
          )}
        </section>
      )}
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">
          AI brief: <span className="text-foreground/70">{project.brief_status}</span>
        </h2>
        {project.brief_error && <p className="text-red-600">{project.brief_error}</p>}
        <form action={generateBrief.bind(null, id)}>
          <SubmitButton
            pendingLabel="Generating…"
            disabled={!canGenerateBrief || project.brief_status === "generating"}
            className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-50"
          >
            {project.brief ? "Regenerate brief" : "Generate brief"}
          </SubmitButton>
        </form>
        {project.brief && (
          <pre className="max-h-96 overflow-auto rounded-md bg-foreground/5 p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(project.brief, null, 2)}
          </pre>
        )}
      </section>
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">
          Voice: <span className="text-foreground/70">{project.voice_status}</span>
        </h2>
        {project.voice_error && <p className="text-red-600">{project.voice_error}</p>}
        <form action={generateVoice.bind(null, id)}>
          <SubmitButton
            pendingLabel="Generating voice…"
            disabled={project.brief_status !== "completed" || project.voice_status === "generating"}
            className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-50"
          >
            {project.voice_result ? "Regenerate voice" : "Generate voice"}
          </SubmitButton>
        </form>
        {voiceAudio?.signedUrl && (
          <audio controls src={voiceAudio.signedUrl} className="w-full" />
        )}
      </section>
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">
          Visual assets: <span className="text-foreground/70">{project.assets_status}</span>
        </h2>
        {project.assets_error && <p className="text-red-600">{project.assets_error}</p>}
        <form action={prepareAssets.bind(null, id)}>
          <SubmitButton
            pendingLabel="Preparing…"
            disabled={project.brief_status !== "completed" || assetsBusy}
            className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-50"
          >
            Prepare Visual Assets
          </SubmitButton>
        </form>
        {manifestAssets.some((a) => a.source === "generated") && (
          <form action={generateVisualAssets.bind(null, id)}>
            <SubmitButton
              pendingLabel="Generating assets…"
              disabled={assetsBusy}
              className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-50"
            >
              Generate Visual Assets
            </SubmitButton>
          </form>
        )}
        {manifestAssets.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {manifestAssets.map((a) => {
              const url = a.source === "generated" ? assetUrl(a.storage_path) : undefined;
              return (
                <li key={a.id} className="flex flex-col gap-1 rounded-md border border-foreground/10 p-2 text-xs">
                  <span className="font-medium">
                    {a.id} · {a.type}
                  </span>
                  <span className="text-foreground/60">
                    {a.source === "project" ? "project screenshot" : (a.status ?? "pending")}
                  </span>
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={url} alt={a.id} className="aspect-square w-full rounded object-contain" />
                  )}
                  {a.error && <span className="text-red-600">{a.error}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {project.assets_manifest && (
          <details>
            <summary className="cursor-pointer text-foreground/60">Manifest JSON</summary>
            <pre className="max-h-96 overflow-auto rounded-md bg-foreground/5 p-3 text-xs whitespace-pre-wrap">
              {JSON.stringify(project.assets_manifest, null, 2)}
            </pre>
          </details>
        )}
      </section>
      {costs && (
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-foreground/20 p-3 text-sm">
          <h2 className="font-medium">Cost Breakdown (dev)</h2>
          <p className="text-xs text-foreground/60">
            Estimated internal provider cost, not customer billing. Unpriced models show $0.
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
            {(
              [
                ["Total (estimated)", costs.total_cost_usd],
                ["OpenAI", costs.cost_by_operation.openai_brief],
                ["Voice", costs.cost_by_operation.fal_voice],
                ["Images", costs.cost_by_operation.fal_image],
                ["Render", costs.cost_by_operation.remotion_render],
                ["Storage", costs.cost_by_operation.storage],
                ["Per video minute", costs.cost_per_video_minute],
                ["1080p per minute", costs.by_resolution["1080p"].cost_per_video_minute],
                ["4K per minute", costs.by_resolution["4k"].cost_per_video_minute],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-foreground/60">{label}</dt>
                <dd>{usd(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {process.env.NODE_ENV !== "production" && project.brief_status === "completed" && (
        <Link href={`/projects/${id}/preview`} className="self-start text-sm underline">
          Preview storyboard (dev)
        </Link>
      )}
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">
          Video:{" "}
          <span className="text-foreground/70">
            {project.render_status === "processing"
              ? "Rendering… (refresh to update)"
              : project.render_status}
          </span>
        </h2>
        {project.render_error && <p className="text-red-600">{project.render_error}</p>}
        <form action={renderVideo.bind(null, id)} className="flex items-center gap-2">
          <select
            name="resolution"
            defaultValue={project.resolution}
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2"
          >
            <option value="1080p">1080p</option>
            <option value="4k">4K</option>
          </select>
          <SubmitButton
            pendingLabel="Starting render…"
            disabled={project.render_status === "processing"}
            className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
          >
            Render Video
          </SubmitButton>
        </form>
        {video?.signedUrl && (
          <video controls src={video.signedUrl} className="w-full rounded-md" />
        )}
        {download?.signedUrl && (
          <a href={download.signedUrl} className="self-start underline">
            Download MP4
          </a>
        )}
      </section>
    </main>
  );
}
