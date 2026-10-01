import { renderStillOnWeb } from "@remotion/web-renderer";
import { FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import type { FlowPlan } from "@/components/video/flow/types";

// The download path (browser-download.tsx renderPlanToFile) for one frame.
declare global {
  interface Window { renderFrame: (plan: FlowPlan, frame: number, scale: number) => Promise<string> }
}
window.renderFrame = async (plan, frame, scale) => {
  const inputProps: FlowSceneProps = { plan, audioUrl: null, webAudio: true };
  const r = await renderStillOnWeb({
    composition: { component: FlowScene, id: "FlowScene", width: 1920, height: 1080, fps: 30, durationInFrames: plan.duration, defaultProps: inputProps },
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
