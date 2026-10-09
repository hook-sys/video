import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import { generateBrief, generateVoice, retryPipeline } from "@/app/projects/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { PipelineProgress } from "@/components/pipeline-progress";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import { getProjectCostSummary } from "@/lib/costs/benchmark";
import { canUseDevTools } from "@/lib/dev-tools";
import { SubmitButton } from "@/components/submit-button";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { type ComposerView, buildRenderInput } from "@/lib/render-input";
import { BackToDashboard } from "./back-to-dashboard";
import { ComposerStudio } from "./composer-studio";

// Server actions on this page (brief, voice, the pipeline via after()) run
// inside this function. 300s is the Vercel Hobby maximum with Fluid compute;
// Pro allows up to 800s.
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
  const admin = user ? (await userAccess(supabase, user.id)).admin : false;

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

  const costs = dev ? await getProjectCostSummary(supabase, id, project.duration_seconds) : null;
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

  // Customer view: the Composer's video (played and downloaded in the browser).
  const ready = project.pipeline_status === "completed" || project.pipeline_status === "preview_ready";
  let composer: ComposerView | null = null;
  let audioUrl: string | null = null;
  if (ready) {
    try {
      const input = await buildRenderInput(supabase, project);
      composer = input.composer;
      audioUrl = input.audioUrl;
    } catch {
      composer = null;
    }
  }
  const direction = String(project.direction ?? "");
  const voiceScript = direction.split(/\n\nVisual style:/)[0].trim();
  const visualStyle = direction.match(/Visual style:\s*(.+)\s*$/m)?.[1] ?? null;
  const look = direction.match(/^Look:\s*(.+)$/m)?.[1]?.trim() ?? "Auto";
  const title = project.brand_name || "Your video";
  const status =
    project.pipeline_status === "completed" ? { label: "Ready", cls: "bg-[#e3f4e8] text-[#1e7a3c]" }
    : project.pipeline_status === "preview_ready" ? { label: "Preview ready", cls: "bg-[#e5effc] text-[#0a5cc2]" }
    : project.pipeline_status === "running" ? { label: "Creating", cls: "bg-[#e5effc] text-[#0a5cc2]" }
    : project.pipeline_status === "failed" ? { label: "Failed", cls: "bg-[#fdecea] text-[#a1281b]" }
    : project.pipeline_status === "needs_input" ? { label: "Needs your input", cls: "bg-[#fff3df] text-[#8a5300]" }
    : { label: "Draft", cls: "bg-foreground/10 text-foreground/60" };
  const primaryBtn = "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0a66d6] px-5 py-3.5 font-semibold text-white hover:bg-[#0859bd] disabled:opacity-60";

  return (
    <AppShell title={title} admin={admin} active={null} initial={(user?.email ?? "?")[0]} wide>
    <div className="flex flex-col gap-6">
      <AutoRefresh active={project.pipeline_status === "running"} />
      <BackToDashboard />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              `${project.duration_seconds} s`,
              project.format,
              `${project.voice_language} · ${project.voice_gender === "female" ? "Female" : "Male"}`,
              look !== "Auto" ? look : null,
              visualStyle,
            ]
              .filter(Boolean)
              .map((c) => (
                <span key={c} className="rounded-full bg-white/70 px-2.5 py-1 text-foreground/65 ring-1 ring-black/[0.06]">{c}</span>
              ))}
          </div>
        </div>
      </div>

      {project.pipeline_status === "running" && <WaitingScreen step={project.pipeline_step} />}

      {/* The Composer's video: watch it, change it, download it. */}
      {ready && composer && (
        <ComposerStudio plans={composer.plans} changes={composer.changes} screens={composer.screens} audioUrl={audioUrl} name={title} className={primaryBtn} about={composer.about} />
      )}
      {ready && !composer && (
        <section className="rounded-2xl bg-white/70 p-6 text-sm text-foreground/65 ring-1 ring-black/[0.06]">This video can&apos;t be shown: its voice is missing. Try again from a new video.</section>
      )}

      {(project.pipeline_status === "failed" ||
        project.pipeline_status === "needs_input" ||
        project.pipeline_status === "idle") && (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-white/70 px-6 py-14 text-center ring-1 ring-black/[0.06]">
          <div className={`flex size-14 items-center justify-center rounded-full text-2xl ${project.pipeline_status === "idle" ? "bg-[#0a66d6]/10 text-[#0a66d6]" : "bg-[#fdecea] text-[#a1281b]"}`}>
            {project.pipeline_status === "idle" ? "▶" : "!"}
          </div>
          <h2 className="text-xl font-semibold">
            {project.pipeline_status === "idle" ? "Ready to generate" : project.pipeline_status === "needs_input" ? "We need a bit more to work with" : "This one didn't finish"}
          </h2>
          <p className="max-w-md text-sm text-foreground/65">
            {project.pipeline_status === "idle"
              ? "Your video hasn't been generated yet."
              : project.pipeline_status === "needs_input"
                ? "Add product screenshots in a new video so we don't have to guess your features."
                : "We couldn't finish your video this time. Please try again."}
          </p>
          {project.pipeline_status === "needs_input" ? (
            <Link href="/projects/new" className={`${primaryBtn} w-auto px-6`}>
              Create a new video
            </Link>
          ) : (
            <form action={retryPipeline.bind(null, id)}>
              <SubmitButton pendingLabel="Starting…" className={`${primaryBtn} w-auto px-6`}>
                {project.pipeline_status === "failed" ? "Try again" : "Create video"}
              </SubmitButton>
            </form>
          )}
        </section>
      )}

      {project.pipeline_status !== "running" && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
            <h2 className="text-sm font-semibold">Script</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{voiceScript || "—"}</p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
            <h2 className="text-sm font-semibold">What viewers see</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{project.advanced_direction || "Chosen automatically from your script."}</p>
            <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-foreground/[0.07] pt-3 text-xs">
              {[
                ["Look", look],
                ["Style", visualStyle ?? "—"],
                ["Call to action", project.call_to_action || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-foreground/45">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-foreground/45">Brand colour</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                  {project.brand_color ? (
                    <>
                      <span className="size-3.5 rounded-full border border-foreground/15" style={{ background: project.brand_color }} />
                      {project.brand_color}
                    </>
                  ) : (
                    "Auto"
                  )}
                </dd>
              </div>
            </dl>
          </div>
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
                ["Storage", costs.cost_by_operation.storage],
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
    </div>
    </AppShell>
  );
}
