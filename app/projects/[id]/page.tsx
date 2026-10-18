import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VIDEOS_BUCKET, ownedPath, voiceChoiceOf } from "@/lib/projects";
import { getSettings } from "@/lib/app-settings";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import { retryPipeline } from "@/app/projects/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { PipelineProgress } from "@/components/pipeline-progress";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import { getProjectCostSummary } from "@/lib/costs/benchmark";
import { canUseDevTools } from "@/lib/dev-tools";
import { SubmitButton } from "@/components/submit-button";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { buildRenderInput } from "@/lib/render-input";
import { BackToDashboard } from "./back-to-dashboard";
import { Studio } from "./studio";

// Server actions on this page (the pipeline via after()) run inside this
// function. 300s is the Vercel Hobby maximum with Fluid compute;
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

  const { data: voiceAudio } =
    project.voice_status === "completed" && ownedPath(project.voice_result?.storagePath, project.user_id, id)
      ? await supabase.storage
          .from(AUDIO_BUCKET)
          .createSignedUrl(project.voice_result!.storagePath!, 3600)
      : { data: null };

  const costs = dev ? await getProjectCostSummary(supabase, id, project.duration_seconds) : null;
  const usd = (n: number) => `$${n.toFixed(4)}`;

  const rows: [string, string][] = [
    ["Direction", project.direction],
    ["Duration", `${project.duration_seconds} sec`],
    ["Format", project.format],
    ["Voice language", project.voice_language],
    ["Voice style", project.voice_style],
    ["Status", project.status],
  ];

  // Customer view: the video (played, and downloaded as the server's MP4 or rendered in the browser).
  const ready = project.pipeline_status === "completed" || project.pipeline_status === "preview_ready";
  let input: Awaited<ReturnType<typeof buildRenderInput>> | null = null;
  if (ready) input = await buildRenderInput(supabase, project).catch(() => null);
  // the MP4 made on the server (lib/render-server.ts): downloaded as it is;
  // until it is there (or if it can't be made) the browser renders it
  const serverRender = (await getSettings()).feature_server_render !== false;
  let file: string | null = null;
  if (ready && project.render_status === "completed" && project.video_path && ownedPath(project.video_path, project.user_id, id)) {
    const name = `${(project.brand_name ?? "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "video"}.mp4`;
    const { data: signedVideo } = await supabase.storage.from(VIDEOS_BUCKET).createSignedUrl(project.video_path, 3600, { download: name });
    file = signedVideo?.signedUrl ?? null;
  }
  const rendering = serverRender && project.pipeline_status === "completed" && (project.render_status === "processing" || project.render_status === "idle");
  const direction = String(project.direction ?? "");
  const voiceScript = direction.split(/\n\nVisual style:/)[0].trim();
  const title = project.brand_name || "Your video";
  const status =
    project.pipeline_status === "completed" ? { label: "Ready", cls: "bg-[#e3f4e8] text-[#1e7a3c]" }
    : project.pipeline_status === "preview_ready" ? { label: "Preview ready", cls: "bg-[#e5effc] text-[#0a5cc2]" }
    : project.pipeline_status === "running" ? { label: "Creating", cls: "bg-[#e5effc] text-[#0a5cc2]" }
    : project.pipeline_status === "failed" ? { label: "Failed", cls: "bg-[#fdecea] text-[#a1281b]" }
    : project.pipeline_status === "needs_input" ? { label: "Needs your input", cls: "bg-[#fff3df] text-[#8a5300]" }
    : { label: "Draft", cls: "bg-foreground/10 text-foreground/60" };
  const primaryBtn = "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0a66d6] px-5 py-3.5 font-semibold text-white hover:bg-[#0859bd] disabled:opacity-60";

  // while it is made: the waiting screen on its own (never inside the window)
  if (project.pipeline_status === "running")
    return (
      <>
        <AutoRefresh active />
        <WaitingScreen step={project.pipeline_step} inline />
      </>
    );

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
            {/* what the customer chose (no style is chosen: the Director decides it) */}
            {[
              `${project.duration_seconds} s`,
              project.format,
              `${voiceChoiceOf(direction) ?? (project.voice_gender === "female" ? "Female voice" : "Male voice")}`,
              project.quality ? `${String(project.quality).charAt(0).toUpperCase()}${String(project.quality).slice(1)}` : null,
            ]
              .filter(Boolean)
              .map((c) => (
                <span key={c} className="rounded-full bg-white/70 px-2.5 py-1 text-foreground/65 ring-1 ring-black/[0.06]">{c}</span>
              ))}
          </div>
        </div>
      </div>

      {/* The video: watch it, download it. */}
      {ready && input?.plan && (
        <Studio projectId={id} file={file} rendering={rendering} autoStart={rendering && project.render_status === "idle"} plan={input.plan} audioUrl={input.audioUrl} name={title} className={primaryBtn} editable={!!user && user.id === project.user_id && project.pipeline_status === "completed"} edited={!!(project.brief as { composer?: { original?: unknown } } | null)?.composer?.original} />
      )}
      {ready && !input?.plan && (
        <section className="flex flex-col items-start gap-3 rounded-2xl bg-white/70 p-6 text-sm text-foreground/65 ring-1 ring-black/[0.06]">
          <p>{input?.problems.includes("This video was made with an earlier version.") ? "This video was made with an earlier version of MotionBrief and can no longer be played here." : "This video can't be shown: its voice is missing."} {file ? "Its MP4 is still here to download." : "Make it again from a new video."}</p>
          {file ? <a href={file} className={`${primaryBtn} w-auto px-6`}>Download video</a> : <Link href={`/projects/new?from=${id}`} className={`${primaryBtn} w-auto px-6`}>Make it again</Link>}
        </section>
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
                ? "Please create the video again."
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
          {voiceAudio?.signedUrl && <audio controls src={voiceAudio.signedUrl} className="w-full" />}
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
