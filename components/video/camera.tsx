import { createContext, useContext, type ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { motionFor } from "./animations";

// Scene-wide camera. Every layer reads the same move and scales its translation
// by depth (background 1x, subject further forward, text nearest), which gives
// parallax. The move keeps going through the transition tail so consecutive
// scenes feel like one continuous camera.
type Pose = { scale: number; x: number; y: number; rot: number }; // x/y in %
type Preset = { from: Pose; to: Pose };

const PRESETS: Record<string, Preset> = {
  push: { from: { scale: 1.0, x: 0, y: 0, rot: 0 }, to: { scale: 1.2, x: 0, y: -1, rot: 0 } },
  pull: { from: { scale: 1.22, x: 0, y: 1, rot: 0 }, to: { scale: 1.02, x: 0, y: 0, rot: 0 } },
  panLeft: { from: { scale: 1.14, x: 4, y: 0, rot: 0 }, to: { scale: 1.16, x: -4, y: 0, rot: 0 } },
  panRight: { from: { scale: 1.14, x: -4, y: 0.5, rot: -0.6 }, to: { scale: 1.16, x: 4, y: -0.5, rot: 0.6 } },
  panUp: { from: { scale: 1.14, x: 0, y: 3.5, rot: 0 }, to: { scale: 1.16, x: 0, y: -3.5, rot: 0 } },
  pushTilt: { from: { scale: 1.04, x: 1.5, y: 0, rot: 1.2 }, to: { scale: 1.2, x: -1.5, y: 0, rot: -1.2 } },
};
const ROTATION = ["push", "panLeft", "pull", "pushTilt", "panUp", "panRight"];

// Chosen from the scene's animation direction; varies by scene when unspecific.
export function cameraPresetFor(animation: string, index: number): string {
  const m = motionFor(animation);
  if (m === "zoom" || m === "highlight" || m === "pop") return "push";
  if (m === "pan") return "panUp";
  if (m === "parallax" || m === "slide") return index % 2 ? "panRight" : "panLeft";
  if (m === "blur" || m === "reveal") return "pull";
  return ROTATION[index % ROTATION.length];
}

type Camera = { preset: string; frame: number; span: number };
const CameraContext = createContext<Camera>({ preset: "push", frame: 0, span: 1 });

export function CameraProvider({ value, children }: { value: Camera; children: ReactNode }) {
  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

// Constant-velocity dolly (like a real camera move); continues past the scene's
// end into the transition tail instead of stopping.
function pose({ preset, frame, span }: Camera): Pose {
  const { from, to } = PRESETS[preset] ?? PRESETS.push;
  const t = interpolate(frame, [0, span], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "extend" });
  const lerp = (a: number, b: number) => a + (b - a) * Math.min(t, 1.15);
  return { scale: lerp(from.scale, to.scale), x: lerp(from.x, to.x), y: lerp(from.y, to.y), rot: lerp(from.rot, to.rot) };
}

// depth: how far the layer moves relative to the background; zoom: share of the
// camera's zoom applied (text zooms less so it never crops).
export function CameraLayer({ depth = 1, zoom = 1, children }: { depth?: number; zoom?: number; children: ReactNode }) {
  const p = pose(useContext(CameraContext));
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${p.x * depth}%, ${p.y * depth}%) scale(${1 + (p.scale - 1) * zoom}) rotate(${p.rot * depth}deg)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// The scene's own length in frames (the Sequence also includes the transition tail).
export const useSceneSpan = () => useContext(CameraContext).span;
