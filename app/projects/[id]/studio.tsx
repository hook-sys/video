"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { renderProgress, startRender } from "@/app/projects/actions";
import { Player, type PlayerRef } from "@remotion/player";
import { SimpleFilm } from "@/components/video/simple/film";
import { FILM_ID, type FilmProps, type SimplePlan } from "@/components/video/simple/types";
import { Editor } from "./editor";

// The project's video: watch it, edit it (its owner) and download it — the
// MP4 made on the server, or (until it is there, or if it can't be made)
// rendered in this browser.
// the film's frame (16:9 unless its plan says 9:16 or 1:1)
const sizeOf = (plan: SimplePlan) => [plan.w ?? 1920, plan.h ?? 1080] as const;
type Props = FilmProps;

async function renderToFile({ props, file, signal, onProgress }: { props: Props; file: string; signal: AbortSignal; onProgress: (p: number) => void }) {
  const { renderMediaOnWeb, canRenderMediaOnWeb, getEncodableVideoCodecs } = await import("@remotion/web-renderer");
  const codecs = await getEncodableVideoCodecs("mp4");
  const videoCodec = (["h264", "vp9", "av1"] as const).find((c) => codecs.includes(c));
  if (!videoCodec) throw new Error("This browser can't encode MP4 video. Try Chrome on a computer.");
  const [W, H] = sizeOf(props.plan);
  const check = await canRenderMediaOnWeb({ width: W, height: H, container: "mp4", videoCodec });
  if (!check.canRender) throw new Error(check.issues.map((i) => i.message).join(" ") || "This browser can't render video.");
  const inputProps: Props = { ...props, webAudio: true };
  const { getBlob } = await renderMediaOnWeb({
    composition: { component: SimpleFilm, id: FILM_ID, width: W, height: H, fps: 30, durationInFrames: Math.max(1, props.plan.duration), defaultProps: inputProps },
    inputProps,
    container: "mp4",
    videoCodec,
    videoBitrate: "high",
    licenseKey: "free-license",
    signal,
    onProgress: (p) => onProgress(p.progress),
  });
  const url = URL.createObjectURL(await getBlob());
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


// file: the MP4 made on the server (lib/render-server.ts); rendering: it is
// being made (autoStart: ask for it now)
// editable: the owner may edit it (editor.tsx); edited: it was, and can go back
export function Studio({ projectId, file, rendering = false, autoStart = false, plan: saved, audioUrl, name, className, editable = false, edited = false }: { projectId?: string; file?: string | null; rendering?: boolean; autoStart?: boolean; plan: SimplePlan; audioUrl: string | null; name: string; className: string; editable?: boolean; edited?: boolean }) {
  const router = useRouter();
  // what the player shows: the video as saved, or as it is being edited
  const [preview, setPreview] = useState<{ of: string; plan: SimplePlan } | null>(null);
  const plan = preview && preview.of === saved.print + saved.duration ? preview.plan : saved;
  const changed = plan !== saved;
  const player = useRef<PlayerRef>(null);
  const asked = useRef(false);
  const [made, setMade] = useState(0);
  useEffect(() => {
    if (!autoStart || !projectId || asked.current) return;
    asked.current = true;
    startRender(projectId).catch(() => {});
  }, [autoStart, projectId]);
  // while the server makes the file: how far it is, then the page again (with the file)
  useEffect(() => {
    if (!rendering || !projectId) return;
    let stop = false;
    const tick = async () => {
      const s = await renderProgress(projectId).catch(() => null);
      if (stop) return;
      if (s?.status === "processing") setMade(s.progress);
      else if (s && s.status !== "idle") return router.refresh();
      setTimeout(tick, 5000);
    };
    const first = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(first);
    };
  }, [rendering, projectId, router]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | null>(null);

  const download = async () => {
    setError(undefined);
    const controller = new AbortController();
    abort.current = controller;
    try {
      setBusy(true);
      setProgress(0);
      await renderToFile({ props: { plan, audioUrl }, file: `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}.mp4`, signal: controller.signal, onProgress: setProgress });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="overflow-hidden rounded-2xl bg-black shadow-xl shadow-black/15 ring-1 ring-black/10">
          <Player
            ref={player}
            key={`${plan.seed}:${plan.w ?? 1920}`}
            component={SimpleFilm}
            inputProps={{ plan, audioUrl } satisfies Props}
            durationInFrames={Math.max(1, plan.duration)}
            fps={30}
            compositionWidth={sizeOf(plan)[0]}
            compositionHeight={sizeOf(plan)[1]}
            controls
            style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${sizeOf(plan)[0]} / ${sizeOf(plan)[1]}` }}
          />
        </div>
        {editable && projectId && (
          <Editor
            key={saved.print + String(edited)}
            projectId={projectId}
            plan={saved}
            edited={edited}
            onPreview={(next) => setPreview({ of: saved.print + saved.duration, plan: next })}
            onPick={(frame) => {
              player.current?.seekTo(frame);
              player.current?.pause();
            }}
          />
        )}
      </section>
      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
          <h2 className="text-sm font-semibold">Download</h2>
          {changed && <p className="text-xs text-[#8a5300]">You have unsaved changes: the download is the video as you see it now.</p>}
          {file && !busy && !changed ? (
            <>
              <a href={file} className={className}>Download video</a>
              <p className="text-xs text-foreground/50">1080p · high-quality MP4, ready now.</p>
            </>
          ) : rendering && !busy && !changed ? (
            <>
              <button type="button" disabled className={className}>
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Preparing your HD video{made > 0.02 ? ` · ${Math.round(made * 100)}%` : "…"}
              </button>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-[#0a66d6] transition-all" style={{ width: `${Math.max(3, Math.round(made * 100))}%` }} />
              </div>
              <p className="text-xs text-foreground/50">
                A few minutes. You can leave this page; it will be ready here.{" "}
                <button type="button" onClick={download} className="font-medium text-[#0a66d6] hover:underline">
                  Or render it in this browser now
                </button>
              </p>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={download} className={className}>
              {busy ? `Rendering · ${Math.round(progress * 100)}%…` : "Download video"}
            </button>
          )}
          {busy && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-[#0a66d6]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <button type="button" onClick={() => abort.current?.abort()} className="text-xs text-foreground/55 hover:text-foreground">
                Cancel
              </button>
            </>
          )}
          {error && <p className="text-xs text-[#a1281b]">{error}</p>}
          {busy && <p className="text-xs text-foreground/50">Rendered in this browser (1080p). Keep this tab open until it finishes.</p>}
        </div>
      </aside>
    </div>
  );
}
