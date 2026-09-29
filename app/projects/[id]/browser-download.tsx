"use client";

import { useRef, useState } from "react";
import { FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import type { FlowPlan } from "@/components/video/flow/types";

// Test download: renders the video to an MP4 right in this browser tab
// (@remotion/web-renderer), since there is no server render worker yet.
// 1080p is the composition size; 4K renders it at 2×.
type Quality = "1080p" | "4k";

export function BrowserDownload({ plan, audioUrl, width, height, name, className, secondaryClassName }: { plan: FlowPlan; audioUrl: string | null; width: number; height: number; name: string; className: string; secondaryClassName: string }) {
  const [busy, setBusy] = useState<Quality | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | null>(null);

  const run = async (quality: Quality) => {
    setError(undefined);
    setBusy(quality);
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { renderMediaOnWeb, canRenderMediaOnWeb, getEncodableVideoCodecs } = await import("@remotion/web-renderer");
      const scale = quality === "4k" ? 2 : 1;
      // H.264 plays everywhere; browsers without its encoder fall back to VP9 / AV1.
      const codecs = await getEncodableVideoCodecs("mp4");
      const videoCodec = (["h264", "vp9", "av1"] as const).find((c) => codecs.includes(c));
      if (!videoCodec) throw new Error("This browser can't encode MP4 video. Try Chrome on a computer.");
      const check = await canRenderMediaOnWeb({ width: width * scale, height: height * scale, container: "mp4", videoCodec });
      if (!check.canRender) throw new Error(check.issues.map((i) => i.message).join(" ") || "This browser can't render video.");
      const inputProps: FlowSceneProps = { plan, audioUrl, webAudio: true };
      const { getBlob } = await renderMediaOnWeb({
        composition: { component: FlowScene, id: "FlowScene", width, height, fps: 30, durationInFrames: Math.max(1, plan.duration), defaultProps: inputProps },
        inputProps,
        scale,
        container: "mp4",
        videoCodec,
        videoBitrate: "high",
        licenseKey: "free-license",
        signal: controller.signal,
        onProgress: (p) => setProgress(p.progress),
      });
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}-${quality}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const label = (q: Quality) => (busy === q ? `Rendering ${Math.round(progress * 100)}%…` : `↓ Download ${q === "4k" ? "4K" : "1080p"}`);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" disabled={!!busy} onClick={() => run("1080p")} className={className}>
        {label("1080p")}
      </button>
      <button type="button" disabled={!!busy} onClick={() => run("4k")} className={secondaryClassName}>
        {label("4k")}
      </button>
      {busy && (
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
      <p className="text-xs text-foreground/50">Test mode: the video is rendered in this browser. Keep this tab open until it downloads (4K takes longer; a computer is faster than a phone).</p>
    </div>
  );
}
