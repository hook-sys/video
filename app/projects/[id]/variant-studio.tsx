"use client";

import { useRef, useState } from "react";
import { Player } from "@remotion/player";
import { recordVariantDownload } from "@/app/projects/actions";
import { FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import type { FlowPlan } from "@/components/video/flow/types";
import { FPS } from "@/components/video/types";
import type { Look } from "@/lib/scene-script";
import { renderPlanToFile } from "./browser-download";

// The same video in four looks (background, icons, hand-over, side): the
// customer watches each and downloads one or all. Each download is kept as
// the taste the next videos learn from.
export type StudioVariant = { seed: number; look: Look | null; plan: FlowPlan };

const DECOR: Record<string, string> = { dots: "Dots", ribbons: "Ribbons", waves: "Waves", glow: "Glow" };
const ICONS: Record<string, string> = { tile: "tile icons", solid: "solid icons", soft: "soft icons", outline: "line icons" };
const CUT: Record<string, string> = { slide: "slide", rise: "rise", soft: "fade", zoom: "zoom" };
const describe = (l: Look | null) => (l ? [DECOR[l.decor], l.icons && ICONS[l.icons], l.cut && CUT[l.cut]].filter(Boolean).join(" · ") : "");

export function VariantStudio({ projectId, variants, audioUrl, width, height, name, className, secondaryClassName }: { projectId: string; variants: StudioVariant[]; audioUrl: string | null; width: number; height: number; name: string; className: string; secondaryClassName: string }) {
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  const v = variants[selected];

  const download = async (indexes: number[]) => {
    setError(undefined);
    setAll(indexes.length > 1);
    const controller = new AbortController();
    abort.current = controller;
    try {
      for (const i of indexes) {
        setBusy(i);
        setProgress(0);
        const file = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}-${i + 1}.mp4`;
        await renderPlanToFile({ plan: variants[i].plan, audioUrl, width, height, file, signal: controller.signal, onProgress: setProgress });
        void recordVariantDownload(projectId, variants[i].seed);
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
            key={v.seed}
            component={FlowScene}
            inputProps={{ plan: v.plan, audioUrl } satisfies FlowSceneProps}
            durationInFrames={Math.max(1, v.plan.duration)}
            fps={FPS}
            compositionWidth={width}
            compositionHeight={height}
            controls
            numberOfSharedAudioTags={20}
            style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${width} / ${height}` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {variants.map((x, i) => (
            <button
              key={x.seed}
              type="button"
              onClick={() => setSelected(i)}
              className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition ${i === selected ? "border-violet-500 bg-violet-500/10" : "border-foreground/10 hover:bg-foreground/5"}`}
            >
              <span className="text-sm font-semibold">Video {i + 1}</span>
              <span className="text-xs text-foreground/55">{describe(x.look)}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/50">The same script and voice in {variants.length} looks. Watch each, then download the one you like — or all of them.</p>
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
      </aside>
    </div>
  );
}
