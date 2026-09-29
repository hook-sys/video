import { ShotScript } from "@/lib/shots";

// MotionBrief's own explainer as shots (no screenshots): the regression
// fixture for the shot templates (npm run check:story).
export const SHOT_NARRATION =
  "Making a promo video usually takes weeks. You hire a studio, write a brief, record a voice, and wait. With MotionBrief, you just write your script. We record the voice, direct every scene and animate it for you. Your product stays the hero, with clean text and calm motion. In a few minutes, your video is ready. Download it in 1080p or 4K and share it anywhere. MotionBrief. Your script, a finished video.";

const N = null;
const sh = (o: Record<string, unknown>) => ({ subject: N, label: N, line: N, line_cue: N, accent: N, mark: N, card: N, title: N, input: N, button: N, action_cue: N, result: N, result_cue: N, items: N, ...o });

export const SHOT_FIXTURE = ShotScript.parse({
  theme: "lavender",
  shots: [
    sh({ shot: "problem", cue: "Making a promo video", subject: "visual:clock", label: "Promo video", line: "Takes weeks", line_cue: "usually takes weeks", accent: "weeks", mark: "strike" }),
    sh({ shot: "steps", cue: "You hire a studio", items: [{ cue: "hire a studio", asset: "icon:clapperboard", label: "Studio" }, { cue: "write a brief", asset: "icon:file-text", label: "Brief" }, { cue: "record a voice", asset: "icon:mic", label: "Voice" }] }),
    sh({ shot: "reveal", cue: "With MotionBrief" }),
    sh({ shot: "ui", cue: "you just write your script", card: "action-panel", title: "New video", input: "Making a promo video usually takes weeks…", button: "Generate", action_cue: "We record the voice" }),
    sh({ shot: "outputs", cue: "direct every scene", items: [{ cue: N, asset: "visual:waveform", label: "Voice" }, { cue: N, asset: "visual:filmstrip", label: "Scenes" }, { cue: "animate it for you", asset: "visual:play", label: "Motion" }] }),
    sh({ shot: "line", cue: "Your product stays the hero", line: "Your product, the hero", accent: "hero" }),
    sh({ shot: "line", cue: "with clean text", line: "Clean text, calm motion", accent: "calm", mark: "pill" }),
    sh({ shot: "number", cue: "In a few minutes", subject: "text:3 min", line: "Your video is ready" }),
    sh({ shot: "number", cue: "Download it in", subject: "text:1080p", items: [{ cue: "or 4K", asset: "text:4K", label: N }] }),
    sh({ shot: "group", cue: "share it anywhere", items: [{ cue: N, asset: "icon:globe", label: "Web" }, { cue: N, asset: "icon:mail", label: "Email" }, { cue: N, asset: "icon:share-2", label: "Social" }] }),
    sh({ shot: "line", cue: "Your script, a finished video", line: "Your script, a finished video", accent: "finished" }),
  ],
});
