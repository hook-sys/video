import "server-only";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  COMPOSITION_ID,
  RESOLUTIONS,
  STORY_WORLD_ID,
  FLOW_SCENE_ID,
  type RenderProps,
  type Resolution,
} from "@/components/video/types";

let bundled: Promise<string> | undefined;

// Remotion is loaded lazily: its native dependencies aren't shipped to Vercel
// Functions, and a top-level import would break every server action that
// shares this module graph (e.g. project creation), not just rendering.

// Bundles the Remotion entry once per server process.
async function getServeUrl() {
  const { bundle } = await import("@remotion/bundler");
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
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await getServeUrl();
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  // Preview-only story engine when a validated story came with the props.
  const inputProps = (
    props.flow
      ? { plan: props.flow.plan, audioUrl: props.audioUrl }
      : props.story
        ? { ...props.story, durationSeconds: props.durationSeconds, words: props.words ?? null, audioUrl: props.audioUrl }
        : props
  ) as unknown as Record<string, unknown>;
  const composition = await selectComposition({
    serveUrl,
    id: props.flow ? FLOW_SCENE_ID : props.story ? STORY_WORLD_ID : COMPOSITION_ID,
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
