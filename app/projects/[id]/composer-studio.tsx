"use client";

import { useRef, useState, useTransition } from "react";
import { Player } from "@remotion/player";
import { newComposerSet } from "@/app/projects/actions";
import { ComposerFilm } from "@/components/video/composer/film";
import type { ComposerPlan, ComposerProps } from "@/components/video/composer/types";

// The Composer's four videos of a project (each scene composed by its
// Director): watch each, download one (rendered in this browser), or ask for
// four new ones. Shown beside the studio while the engine is being compared.
const W = 1920;
const H = 1080;
type Props = ComposerProps & { screens?: string[] };
const nameOf = (p: ComposerPlan) => p.art.name || `${p.art.display.replace(/-/g, " ")} · ${p.art.field}`;

async function renderToFile({ props, file, signal, onProgress }: { props: Props; file: string; signal: AbortSignal; onProgress: (p: number) => void }) {
  const { renderMediaOnWeb, canRenderMediaOnWeb, getEncodableVideoCodecs } = await import("@remotion/web-renderer");
  const codecs = await getEncodableVideoCodecs("mp4");
  const videoCodec = (["h264", "vp9", "av1"] as const).find((c) => codecs.includes(c));
  if (!videoCodec) throw new Error("This browser can't encode MP4 video. Try Chrome on a computer.");
  const check = await canRenderMediaOnWeb({ width: W, height: H, container: "mp4", videoCodec });
  if (!check.canRender) throw new Error(check.issues.map((i) => i.message).join(" ") || "This browser can't render video.");
  const inputProps: Props = { ...props, webAudio: true };
  const { getBlob } = await renderMediaOnWeb({
    composition: { component: ComposerFilm, id: "ComposerFilm", width: W, height: H, fps: 30, durationInFrames: Math.max(1, props.plan.duration), defaultProps: inputProps },
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

export function ComposerStudio({ projectId, plans, screens, audioUrl, name, className, secondaryClassName }: { projectId: string; plans: ComposerPlan[]; screens: string[]; audioUrl: string | null; name: string; className: string; secondaryClassName: string }) {
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const abort = useRef<AbortController | null>(null);
  const plan = plans[Math.min(selected, plans.length - 1)];

  const download = async (i: number) => {
    setError(undefined);
    const controller = new AbortController();
    abort.current = controller;
    try {
      setBusy(i);
      setProgress(0);
      const file = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}-composer-${i + 1}.mp4`;
      await renderToFile({ props: { plan: plans[i], audioUrl, screens }, file, signal: controller.signal, onProgress: setProgress });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-300">Composer · new engine</span>
        <span className="text-xs text-foreground/50">Every scene composed by the Director — compare with the studio videos below.</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-black shadow-2xl shadow-violet-900/20">
            <Player
              key={`${selected}:${plan.seed}`}
              component={ComposerFilm}
              inputProps={{ plan, audioUrl, screens } satisfies Props}
              durationInFrames={Math.max(1, plan.duration)}
              fps={30}
              compositionWidth={W}
              compositionHeight={H}
              controls
              style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${W} / ${H}` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {plans.map((p, i) => (
              <button key={`${i}:${p.seed}`} type="button" onClick={() => setSelected(i)} className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition ${i === selected ? "border-violet-500 bg-violet-500/10" : "border-foreground/10 hover:bg-foreground/5"}`}>
                <span className="text-sm font-semibold">Video {i + 1}</span>
                <span className="truncate text-xs capitalize text-foreground/55">{nameOf(p)}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
            <h2 className="text-sm font-semibold">Download</h2>
            <button type="button" disabled={busy !== null} onClick={() => download(selected)} className={className}>
              {busy !== null ? `Rendering video ${busy + 1} · ${Math.round(progress * 100)}%…` : `↓ Download video ${selected + 1}`}
            </button>
            {busy !== null && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <button type="button" onClick={() => abort.current?.abort()} className="text-xs text-foreground/55 hover:text-foreground">
                  Cancel
                </button>
              </>
            )}
            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            <p className="text-xs text-foreground/50">Rendered in this browser (1080p). Keep this tab open until it finishes.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
            <button
              type="button"
              disabled={pending || busy !== null}
              onClick={() =>
                start(async () => {
                  setSelected(0);
                  await newComposerSet(projectId);
                })
              }
              className={secondaryClassName}
            >
              {pending ? "Composing 4 new videos…" : "↻ 4 new Composer videos"}
            </button>
            <p className="text-xs text-foreground/50">Same script and voice: new art directions and other pictures for each scene.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
