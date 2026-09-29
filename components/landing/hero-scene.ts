import type { SceneBeat, SceneContent, SceneElement, SceneScript } from "@/lib/scene-script";

// The landing page hero: a MotionBrief promo made with MotionBrief's own scene
// engine. The narration is not spoken; it only times the beats, so every line
// of text appears with the motion it describes.

const C = (c: Partial<SceneContent>): SceneContent => ({ title: null, subtitle: null, value: null, label: null, status: null, name: null, amount: null, delta: null, note: null, action: null, date: null, items: null, ...c });
const E = (id: string, asset: string, content?: Partial<SceneContent>, extra: Partial<SceneElement> = {}): SceneElement => ({ id, asset, content: content ? C(content) : null, screen: null, label: null, ...extra });
const B = (b: Partial<SceneBeat> & Pick<SceneBeat, "cue" | "action">): SceneBeat => ({ elements: null, targets: null, to: null, layout: null, camera: null, transition: null, backdrop: null, style: null, content: null, text: null, accent: null, text_layout: null, items: null, lottie: null, ...b });

export const HERO_NARRATION =
  "Write a brief. Add your logo and screens. MotionBrief directs every scene, voice and sound. Your promo video, ready in minutes.";
export const HERO_SECONDS = 15;
export const HERO_BRAND = { name: "MotionBrief", cta: "Start free" };

export const HERO_SCRIPT: SceneScript = {
  version: 2,
  theme: "lavender",
  beats: [
    B({ cue: "Write a brief.", action: "scene", layout: "single", camera: "push-in", transition: "cut", backdrop: "mesh", style: "rise", elements: [
      E("brief", "card:ai-prompt/glass", { title: "Your brief", note: "A 20 s promo for our booking app: busy clinics, one calendar, happy patients." }),
    ] }),
    B({ cue: "Add your logo", action: "place", layout: "hero-left", style: "pop", elements: [
      E("logo", "card:upload/solid", { title: "logo.png", subtitle: "Brand logo", status: "Uploaded" }),
    ] }),
    B({ cue: "and screens.", action: "place", layout: "hero-left", style: "pop", elements: [
      E("screens", "card:media-upload/tinted", { title: "5 screenshots", subtitle: "Product screens", status: "Ready" }),
    ] }),
    B({ cue: "MotionBrief directs", action: "scene", layout: "hero-top", camera: "drift", transition: "zoom-through", backdrop: "energy", style: "scale-up", elements: [
      E("director", "card:ai-processing/accent", { title: "Directing", subtitle: "Clinic promo · 20 s", status: "Scene 3 of 4", items: ["Reading the brief", "Planning scenes", "Timing the voice"] }),
      E("i1", "icon:clapperboard", undefined, { label: "Scenes" }),
      E("i2", "icon:mic", undefined, { label: "Voice" }),
      E("i3", "icon:music", undefined, { label: "Sound" }),
    ] }),
    B({ cue: "every scene,", action: "connect", targets: ["i1"], to: "director" }),
    B({ cue: "voice", action: "connect", targets: ["i2"], to: "director" }),
    B({ cue: "and sound.", action: "connect", targets: ["i3"], to: "director" }),
    B({ cue: "Your promo video,", action: "scene", layout: "single", camera: "push-in", transition: "push-left", backdrop: "glow", style: "rise", elements: [
      E("video", "card:video-gen/glass", { title: "clinic-promo.mp4", subtitle: "1080p · 20 s", status: "Rendering" }),
    ] }),
    B({ cue: "ready in minutes.", action: "statement", text: "Ready in minutes.", accent: "minutes", style: "rise", text_layout: "display", backdrop: "glow" }),
  ],
};
