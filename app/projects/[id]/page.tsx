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
  retryPipeline,
  runBenchmark,
} from "@/app/projects/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { PipelineProgress } from "@/components/pipeline-progress";
import { heroPlan } from "@/components/landing/hero-plan";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import { BENCHMARK_CASES } from "@/lib/benchmark";
import type { AssetManifest } from "@/lib/asset-manifest";
import { getProjectCostSummary } from "@/lib/costs/benchmark";
import { canUseDevTools } from "@/lib/dev-tools";
import { SubmitButton } from "@/components/submit-button";

// Server actions on this page (brief, voice, assets, render via after(), dev
// benchmark) run inside this function. 300s is the Vercel Hobby maximum with
// Fluid compute; Pro allows up to 800s.
export const maxDuration = 300;

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  // Developer tools: ENABLE_DEV_TOOLS and (on deployments) an admin account only.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const dev = !!user && (await canUseDevTools(supabase, user.id));

  const { data: screenshots } = await supabase
    .from("project_screenshots")
    .select("storage_path, original_filename")
    .eq("project_id", id)
    .order("created_at");
  const { data: signed } = screenshots?.length
    ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(
        screenshots.map((s) => s.storage_path),
        3600,
      )
    : { data: [] };

  const { data: capture } = await supabase
    .from("website_captures")
    .select("status, error_message, title, meta_description, visible_text, screenshot_path")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: captureShot } = capture?.screenshot_path
    ? await supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrl(capture.screenshot_path, 3600)
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
  const assetsBusy =
    project.assets_status === "preparing" || project.assets_status === "generating";

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

  const costs = dev ? await getProjectCostSummary(supabase, id, project.duration_seconds) : null;
  const usd = (n: number) => `$${n.toFixed(4)}`;
  const { data: benchmarkRuns } = dev
    ? await supabase
        .from("benchmark_runs")
        .select("*")
        .eq("source_project_id", id)
        .order("started_at", { ascending: false })
        .limit(20)
    : { data: null };

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
      <AutoRefresh active={project.pipeline_status === "running"} />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Your video</h1>
        <p className="text-sm text-foreground/60">
          {project.duration_seconds} sec · {project.format} · {project.voice_language} ·{" "}
          {project.voice_gender === "female" ? "Female" : "Male"} voice
        </p>
      </div>

      {project.pipeline_status === "running" && <WaitingScreen step={project.pipeline_step} {...heroPlan()} />}

      {(project.pipeline_status === "completed" || project.pipeline_status === "preview_ready") && (
        <section className="flex flex-col items-center gap-6 rounded-3xl border border-foreground/10 bg-gradient-to-b from-indigo-500/[0.06] to-transparent px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl text-white shadow-lg shadow-indigo-500/30">
            ✓
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {project.pipeline_status === "completed"
              ? "Your video is ready"
              : "Your video preview is ready"}
          </h2>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <a
              href={video?.signedUrl ? "#video" : `/projects/${id}/preview`}
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110"
            >
              ▶ Watch Video
            </a>
            {download?.signedUrl ? (
              <a
                href={download.signedUrl}
                className="rounded-2xl border border-foreground/15 px-6 py-3 font-semibold transition hover:bg-foreground/5"
              >
                ↓ Download MP4
              </a>
            ) : (
              <span
                aria-disabled
                className="cursor-not-allowed rounded-2xl border border-foreground/10 px-6 py-3 font-semibold text-foreground/40"
              >
                ↓ Download MP4
              </span>
            )}
          </div>
          {!download?.signedUrl && (
            <p className="max-w-sm text-xs text-foreground/50">
              The MP4 download will be available once final rendering is enabled.
            </p>
          )}
          {video?.signedUrl && (
            <video id="video" controls src={video.signedUrl} className="w-full rounded-2xl" />
          )}
        </section>
      )}

      {(project.pipeline_status === "failed" ||
        project.pipeline_status === "needs_input" ||
        project.pipeline_status === "idle") && (
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-foreground/10 px-6 py-10 text-center">
          <p className="max-w-md text-foreground/80">
            {project.pipeline_status === "idle"
              ? "Your video hasn't been generated yet."
              : "We couldn't finish your video this time. Please try again."}
          </p>
          {project.pipeline_status === "needs_input" ? (
            <Link
              href="/projects/new"
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110"
            >
              Create a new video
            </Link>
          ) : (
            <form action={retryPipeline.bind(null, id)}>
              <SubmitButton
                pendingLabel="Starting…"
                className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {project.pipeline_status === "failed" ? "Try again" : "✦ Generate Video"}
              </SubmitButton>
            </form>
          )}
        </section>
      )}

      {dev && (
        <>
          <h2 className="mt-4 text-xs font-medium tracking-wide text-foreground/50 uppercase">
            Developer tools
          </h2>
          <PipelineProgress
            status={project.pipeline_status}
            step={project.pipeline_step}
            error={project.pipeline_error}
          />
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
                  {capture.status === "pending"
                    ? "In progress (refresh to update)"
                    : capture.status}
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
                disabled={
                  project.brief_status !== "completed" || project.voice_status === "generating"
                }
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
                    <li
                      key={a.id}
                      className="flex flex-col gap-1 rounded-md border border-foreground/10 p-2 text-xs"
                    >
                      <span className="font-medium">
                        {a.id} · {a.type}
                      </span>
                      <span className="text-foreground/60">
                        {a.source === "project" ? "project screenshot" : (a.status ?? "pending")}
                      </span>
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                        <img
                          src={url}
                          alt={a.id}
                          className="aspect-square w-full rounded object-contain"
                        />
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
        </>
      )}
      {costs && (
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-foreground/20 p-3 text-sm">
          <h2 className="font-medium">Cost Breakdown</h2>
          <p className="text-xs font-medium text-amber-600">
            Development estimate — not billing. Unconfigured rates count as $0.
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
            {(
              [
                ["Total estimated cost", costs.total_cost_usd],
                ["Cost per video minute", costs.cost_per_video_minute],
                ["OpenAI", costs.cost_by_operation.openai_brief],
                ["Voice", costs.cost_by_operation.fal_voice],
                ["Images", costs.cost_by_operation.fal_image],
                ["Render", costs.cost_by_operation.remotion_render],
                ["Storage", costs.cost_by_operation.storage],
                ["1080p estimated cost", costs.by_resolution["1080p"].total_cost_usd],
                ["4K estimated cost", costs.by_resolution["4k"].total_cost_usd],
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
      {benchmarkRuns && (
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-foreground/20 p-3 text-sm">
          <h2 className="font-medium">Generation Benchmark (dev)</h2>
          <p className="text-xs font-medium text-amber-600">
            Development estimate — not billing. Runs the full paid pipeline on copies of this
            project; the original is not modified. Costs are measured usage × the rates configured
            in lib/costs/pricing.ts / COST_PRICING_JSON, not provider invoices. Unconfigured rates
            count as $0. Failed runs show no totals — use completed runs only.
          </p>
          <form action={runBenchmark.bind(null, id)} className="flex items-center gap-2">
            <select
              name="case"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2"
            >
              <option value="all">All 4 cases</option>
              {BENCHMARK_CASES.map((c, i) => (
                <option key={i} value={i}>
                  {c.duration}s / {c.resolution === "4k" ? "4K" : c.resolution}
                </option>
              ))}
            </select>
            <SubmitButton
              pendingLabel="Benchmarking… (can take many minutes)"
              className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-50"
            >
              Run benchmark
            </SubmitButton>
          </form>
          {benchmarkRuns.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-foreground/60">
                  <tr>
                    {[
                      "Case",
                      "Status",
                      "Tokens in/out",
                      "Voice chars",
                      "Images",
                      "Render",
                      "MP4",
                      "Total",
                      "Est. cost",
                      "Est. /min",
                    ].map((h) => (
                      <th key={h} className="py-1 pr-3 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benchmarkRuns.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-foreground/10"
                      title={r.error ?? undefined}
                    >
                      <td className="py-1 pr-3">
                        {r.duration_seconds}s/{r.resolution}
                      </td>
                      <td className="pr-3">{r.status}</td>
                      <td className="pr-3">
                        {r.openai_input_tokens ?? "–"}/{r.openai_output_tokens ?? "–"}
                      </td>
                      <td className="pr-3">{r.voice_characters ?? "–"}</td>
                      <td className="pr-3">{r.image_count ?? "–"}</td>
                      <td className="pr-3">
                        {r.render_ms ? `${(r.render_ms / 1000).toFixed(1)}s` : "–"}
                      </td>
                      <td className="pr-3">
                        {r.mp4_bytes ? `${(r.mp4_bytes / 1e6).toFixed(1)} MB` : "–"}
                      </td>
                      <td className="pr-3">
                        {r.total_ms ? `${(r.total_ms / 1000).toFixed(0)}s` : "–"}
                      </td>
                      <td className="pr-3">
                        {r.estimated_cost_usd != null ? usd(Number(r.estimated_cost_usd)) : "–"}
                      </td>
                      <td className="pr-3">
                        {r.cost_per_minute_usd != null ? usd(Number(r.cost_per_minute_usd)) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {dev && project.brief_status === "completed" && (
        <Link href={`/projects/${id}/preview`} className="self-start text-sm underline">
          Preview storyboard (dev)
        </Link>
      )}
      {dev && (
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
        </section>
      )}
    </main>
  );
}
