import "server-only";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  COMPOSITION_ID,
  RESOLUTIONS,
  type RenderProps,
  type Resolution,
} from "@/components/video/types";

let bundled: Promise<string> | undefined;

// Bundles the Remotion entry once per server process.
function getServeUrl() {
  bundled ??= bundle({
    entryPoint: path.join(process.cwd(), "remotion/index.ts"),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...config.resolve?.alias, "@": process.cwd() },
      },
    }),
  }).catch((e) => {
    bundled = undefined;
    throw e;
  });
  return bundled;
}

// Renders the storyboard composition to an MP4 and returns its bytes.
export async function renderStoryboardMp4(
  props: RenderProps,
  resolution: Resolution,
): Promise<Buffer> {
  const serveUrl = await getServeUrl();
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const inputProps = props as unknown as Record<string, unknown>;
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable,
  });

  const outputLocation = path.join(os.tmpdir(), `render-${crypto.randomUUID()}.mp4`);
  try {
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      // 1080p composition scaled up for 4K (e.g. 1920×1080 → 3840×2160).
      scale: RESOLUTIONS[resolution],
      outputLocation,
      browserExecutable,
      // Fail instead of producing a silent video if narration can't load.
      enforceAudioTrack: true,
      timeoutInMilliseconds: 60_000,
    });
    return await readFile(outputLocation);
  } finally {
    await rm(outputLocation, { force: true });
  }
}
