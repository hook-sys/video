import "server-only";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { SimplePlan } from "@/components/video/simple/types";
import { FILM_ID } from "@/components/video/simple/types";

// The video's MP4 made on our own server (a VPS, RENDER_MODE=local): the
// film bundled at build time (.remotion-bundle, scripts/film/bundle.mjs)
// opened in Remotion's own Chrome on this machine, encoded as on the
// sandbox (PNG frames, x264 "slow" at CRF 16, bt709, AAC 320k). One render at
// a time — each uses every core — the rest wait their turn in this process.
// Where each is (0–1) is kept here for the page that asks; the caller stores
// the file (lib/render-server.ts).

const BUNDLE = path.join(process.cwd(), ".remotion-bundle");
const CORES = Math.max(1, Number(process.env.RENDER_CONCURRENCY) || os.cpus().length);

const progress = new Map<string, number>();
let queue: Promise<unknown> = Promise.resolve();

// Where this project's render is: 0–1 while it waits or runs, undefined when this process has none.
export const localProgress = (projectId: string) => progress.get(projectId);

// The MP4's bytes, once its turn comes and it is made (throws what went wrong).
export function renderLocally(projectId: string, plan: SimplePlan, audioUrl: string): Promise<Buffer> {
  progress.set(projectId, 0);
  const run = queue.then(async () => {
    const { renderMedia, selectComposition, ensureBrowser } = await import("@remotion/renderer");
    await ensureBrowser({ chromeMode: "headless-shell" });
    const dir = await mkdtemp(path.join(os.tmpdir(), "motiondots-"));
    const out = path.join(dir, "video.mp4");
    try {
      const inputProps = { plan, audioUrl };
      const composition = await selectComposition({ serveUrl: BUNDLE, id: FILM_ID, inputProps, chromeMode: "headless-shell", logLevel: "error" });
      await renderMedia({
        serveUrl: BUNDLE,
        composition,
        inputProps,
        outputLocation: out,
        codec: "h264",
        crf: 16,
        imageFormat: "png",
        pixelFormat: "yuv420p",
        x264Preset: "slow",
        colorSpace: "bt709",
        audioCodec: "aac",
        audioBitrate: "320k",
        enforceAudioTrack: true,
        concurrency: CORES,
        chromeMode: "headless-shell",
        timeoutInMilliseconds: 60_000,
        logLevel: "error",
        onProgress: ({ progress: p }) => progress.set(projectId, Math.min(0.99, p)),
      });
      return await readFile(out);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
  // (the next waits for this one, whatever became of it)
  queue = run.catch(() => {});
  return run.finally(() => progress.delete(projectId));
}
