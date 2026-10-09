import { renderStillOnWeb } from "@remotion/web-renderer";
import { ComposerFilm } from "@/components/video/composer/film";
import type { ComposerPlan, ComposerProps } from "@/components/video/composer/types";

// The download path (composer-studio.tsx renderToFile) for one frame.
declare global {
  interface Window { renderFrame: (plan: ComposerPlan, frame: number, scale: number) => Promise<string> }
}
window.renderFrame = async (plan, frame, scale) => {
  const inputProps: ComposerProps = { plan, audioUrl: null, webAudio: true };
  const r = await renderStillOnWeb({
    composition: { component: ComposerFilm, id: "ComposerFilm", width: plan.w ?? 1920, height: plan.h ?? 1080, fps: 30, durationInFrames: plan.duration, defaultProps: inputProps },
    inputProps,
    frame,
    scale,
    licenseKey: "free-license",
  });
  const buf = new Uint8Array(await (await r.blob({ format: "png" })).arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};
