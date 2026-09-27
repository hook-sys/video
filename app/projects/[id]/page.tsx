import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import { AUDIO_BUCKET } from "@/lib/voice-audio";
import { generateBrief, generateVoice, prepareAssets } from "@/app/projects/actions";
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
            disabled={project.brief_status !== "completed" || project.assets_status === "preparing"}
            className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-50"
          >
            Prepare Visual Assets
          </SubmitButton>
        </form>
        {project.assets_manifest && (
          <pre className="max-h-96 overflow-auto rounded-md bg-foreground/5 p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(project.assets_manifest, null, 2)}
          </pre>
        )}
      </section>
      <button
        disabled
        title="Coming soon"
        className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background opacity-50"
      >
        Generate Video
      </button>
    </main>
  );
}
