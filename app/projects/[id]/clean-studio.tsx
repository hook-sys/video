"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Player } from "@remotion/player";
import { newCleanSet } from "@/app/projects/actions";
import { StudioFilm, type StudioProps } from "@/components/video/clean/studio/film";
import { BLOCK_BY_ID } from "@/components/video/clean/studio/blocks";
import { LOOK_NAMES } from "@/components/video/clean/studio/ids";
import type { CleanPlan } from "@/components/video/clean/types";
import type { StudioRecipe } from "@/lib/studio-variants";

// The four clean videos of a project (one look + one block per part): watch
// each, download one or all (rendered in this browser), or ask for four new
// ones that differ from every earlier set.
const keyOf = (r: StudioRecipe) => `${r.look}:${Object.values(r.blocks).join(",")}:${r.hue}:${r.story ?? 0}`;
// the picture the video opens on: the first part of its story shape
const opening = (r: StudioRecipe) => {
  const first = (r.shape?.split("-")[0] ?? "hook") as keyof StudioRecipe["blocks"];
  return BLOCK_BY_ID[r.blocks[first] ?? r.blocks.hook]?.name.toLowerCase() ?? "";
};
const W = 1920;
const H = 1080;

async function renderFilmToFile({ props, file, signal, onProgress }: { props: StudioProps; file: string; signal: AbortSignal; onProgress: (p: number) => void }) {
  const { renderMediaOnWeb, canRenderMediaOnWeb, getEncodableVideoCodecs } = await import("@remotion/web-renderer");
  const codecs = await getEncodableVideoCodecs("mp4");
  const videoCodec = (["h264", "vp9", "av1"] as const).find((c) => codecs.includes(c));
  if (!videoCodec) throw new Error("This browser can't encode MP4 video. Try Chrome on a computer.");
  const check = await canRenderMediaOnWeb({ width: W, height: H, container: "mp4", videoCodec });
  if (!check.canRender) throw new Error(check.issues.map((i) => i.message).join(" ") || "This browser can't render video.");
  // The colour turn on each finished frame (a parent's CSS filter is not
  // applied everywhere by this renderer).
  const hue = props.recipe.hue ?? 0;
  const inputProps: StudioProps = { ...props, recipe: { ...props.recipe, hue: 0 }, postHue: hue, webAudio: true };
  const canvas = hue ? new OffscreenCanvas(W, H) : null;
  const ctx = canvas?.getContext("2d") ?? null;
  const onFrame = canvas && ctx
    ? (frame: VideoFrame) => {
        ctx.filter = `hue-rotate(${hue}deg)`;
        ctx.drawImage(frame, 0, 0, W, H);
        return new VideoFrame(canvas, { timestamp: frame.timestamp });
      }
    : undefined;
  const { getBlob } = await renderMediaOnWeb({
    composition: { component: StudioFilm, id: "StudioFilm", width: W, height: H, fps: 30, durationInFrames: Math.max(1, props.plan.duration), defaultProps: inputProps },
    inputProps,
    container: "mp4",
    videoCodec,
    videoBitrate: "high",
    licenseKey: "free-license",
    onFrame,
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

// plans: one per story shape of the script; a video plays the one its recipe tells.
export function CleanStudio({ projectId, plans, variants, audioUrl, name, className, secondaryClassName }: { projectId: string; plans: CleanPlan[]; variants: StudioRecipe[]; audioUrl: string | null; name: string; className: string; secondaryClassName: string }) {
  const planOf = (r: StudioRecipe) => plans[r.story ?? 0] ?? plans[0];
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const abort = useRef<AbortController | null>(null);
  const v = variants[Math.min(selected, variants.length - 1)];
  const plan = planOf(v);

  const download = async (indexes: number[]) => {
    setError(undefined);
    setAll(indexes.length > 1);
    const controller = new AbortController();
    abort.current = controller;
    try {
      for (const i of indexes) {
        setBusy(i);
        setProgress(0);
        const file = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}-${i + 1}-${variants[i].look}.mp4`;
        await renderFilmToFile({ props: { plan: planOf(variants[i]), recipe: variants[i], audioUrl }, file, signal: controller.signal, onProgress: setProgress });
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-black shadow-2xl shadow-violet-900/20">
          <Player
            key={keyOf(v)}
            component={StudioFilm}
            inputProps={{ plan, recipe: v, audioUrl } satisfies StudioProps}
            durationInFrames={Math.max(1, plan.duration)}
            fps={30}
            compositionWidth={W}
            compositionHeight={H}
            controls
            style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${W} / ${H}` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {variants.map((x, i) => (
            <button
              key={keyOf(x)}
              type="button"
              onClick={() => setSelected(i)}
              className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition ${i === selected ? "border-violet-500 bg-violet-500/10" : "border-foreground/10 hover:bg-foreground/5"}`}
            >
              <span className="text-sm font-semibold">Video {i + 1}</span>
              <span className="text-xs text-foreground/55">
                {LOOK_NAMES[x.look]} · {opening(x)}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/50">The same script and voice as {variants.length} different videos. Watch each, then download the one you like — or all of them.</p>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <h2 className="text-sm font-semibold">Download</h2>
          <button type="button" disabled={busy !== null} onClick={() => download([selected])} className={className}>
            {busy !== null && !all ? `Rendering video ${busy + 1} · ${Math.round(progress * 100)}%…` : `↓ Download video ${selected + 1}`}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => download(variants.map((_, i) => i))} className={secondaryClassName}>
            {busy !== null && all ? `Rendering video ${busy + 1} of ${variants.length} · ${Math.round(progress * 100)}%…` : `↓ Download all ${variants.length}`}
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
          <p className="text-xs text-foreground/50">Test mode: each video is rendered in this browser (1080p). Keep this tab open until the downloads finish.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <h2 className="text-sm font-semibold">Want something else?</h2>
          <button
            type="button"
            disabled={pending || busy !== null}
            onClick={() =>
              start(async () => {
                setSelected(0);
                await newCleanSet(projectId);
              })
            }
            className={secondaryClassName}
          >
            {pending ? "Making 4 new videos…" : "↻ 4 new videos"}
          </button>
          <p className="text-xs text-foreground/50">Same script and voice, four videos unlike any you have had for it before.</p>
          <Link href={`/projects/new?from=${projectId}`} className={secondaryClassName}>
            ✎ Same script, new video
          </Link>
          <Link href="/projects/new" className={secondaryClassName}>
            + Create a new video
          </Link>
        </div>
      </aside>
    </div>
  );
}
