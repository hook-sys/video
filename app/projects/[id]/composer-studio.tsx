"use client";

import { useRef, useState } from "react";
import { Player } from "@remotion/player";
import { ComposerFilm } from "@/components/video/composer/film";
import type { ComposerPlan, ComposerProps } from "@/components/video/composer/types";

// The Composer's video of a project (each scene composed by its Director):
// watch it and download it (rendered in this browser). A video changed
// before "Change it" was removed keeps its versions to pick from.
// the film's frame (16:9 unless its plan says 9:16 or 1:1)
const sizeOf = (plan: ComposerPlan) => [plan.w ?? 1920, plan.h ?? 1080] as const;
type Props = ComposerProps & { screens?: string[] };

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


export function ComposerStudio({ plans, changes, screens, audioUrl, name, className, about }: { plans: ComposerPlan[]; changes: { direction: string; at: string }[]; screens: string[]; audioUrl: string | null; name: string; className: string; about?: { idea: string | null; mood: string | null; language: string | null; score: number | null } }) {
  // the newest version unless the customer picks an earlier one
  const [picked, setPicked] = useState<number | null>(null);
  const selected = Math.min(picked ?? plans.length - 1, plans.length - 1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  const plan = plans[selected];

  const download = async () => {
    setError(undefined);
    const controller = new AbortController();
    abort.current = controller;
    try {
      setBusy(true);
      setProgress(0);
      const file = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}${selected ? `-v${selected + 1}` : ""}.mp4`;
      await renderToFile({ props: { plan, audioUrl, screens }, file, signal: controller.signal, onProgress: setProgress });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-2xl bg-black shadow-xl shadow-black/15 ring-1 ring-black/10">
            <Player
              key={`${selected}:${plan.seed}:${plan.w ?? 1920}`}
              component={ComposerFilm}
              inputProps={{ plan, audioUrl, screens } satisfies Props}
              durationInFrames={Math.max(1, plan.duration)}
              fps={30}
              compositionWidth={sizeOf(plan)[0]}
              compositionHeight={sizeOf(plan)[1]}
              controls
              style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${sizeOf(plan)[0]} / ${sizeOf(plan)[1]}` }}
            />
          </div>
          {/* what the studio's Directors decided */}
          {about?.idea && (
            <p className="text-xs text-foreground/60">
              <span className="font-semibold text-foreground/80">Idea:</span> {about.idea}
              {about.mood && <> · {about.mood}</>}
              {about.language && <> · camera: {about.language}</>}
              {about.score != null && <> · score {about.score.toFixed(1)}/10</>}
            </p>
          )}
          {plans.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {plans.map((p, i) => (
                <button key={`${i}:${p.seed}`} type="button" onClick={() => setPicked(i)} title={i ? changes[i - 1]?.direction.slice(0, 300) : "The first video"} className={`flex flex-col items-start rounded-2xl border bg-white/70 px-3 py-2 text-left ${i === selected ? "border-[#0a66d6] ring-4 ring-[#0a66d6]/15" : "border-foreground/10 hover:bg-white"}`}>
                  <span className="text-sm font-semibold">Version {i + 1}</span>
                  <span className="max-w-[180px] truncate text-xs text-foreground/55">{i ? changes[i - 1]?.direction ?? "" : "Original"}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
            <h2 className="text-sm font-semibold">Download</h2>
            <button type="button" disabled={busy} onClick={download} className={className}>
              {busy ? `Rendering · ${Math.round(progress * 100)}%…` : plans.length > 1 ? `Download version ${selected + 1}` : "Download video"}
            </button>
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
            <p className="text-xs text-foreground/50">Rendered in this browser (1080p). Keep this tab open until it finishes.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
