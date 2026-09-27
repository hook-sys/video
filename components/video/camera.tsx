import { createContext, useContext, type ReactNode } from "react";
import { AbsoluteFill, Easing } from "remotion";

// Scene-wide camera driven by keyframes placed on the scene's story beats
// (object enters, action starts, result appears). Moves ease between beats and
// settle, instead of drifting at one constant speed. Every layer reads the same
// pose and scales its translation by depth (background 1x, midground ~1.3x,
// foreground ~1.6x), which gives parallax.
export type Pose = { scale: number; x: number; y: number; rot: number }; // x/y in % of frame
export type CameraKey = { f: number; pose: Pose };

export const pose = (scale = 1, x = 0, y = 0, rot = 0): Pose => ({ scale, x, y, rot });

// Pose that brings a point (offset from frame centre, in %) on a layer at
// `depth` part of the way to the centre while zooming to `scale`. Partial
// centring keeps the background plane covering the frame.
export function focusOn(dx: number, dy: number, scale: number, depth = 1.3, amount = 0.45, rot = 0): Pose {
  return { scale, x: (-dx * scale * amount) / depth, y: (-dy * scale * amount) / depth, rot };
}

const EASE = Easing.bezier(0.45, 0, 0.2, 1);

function poseAt(keys: CameraKey[], frame: number): Pose {
  if (!keys.length) return pose();
  if (frame <= keys[0].f) return keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame > b.f) continue;
    const t = EASE((frame - a.f) / Math.max(b.f - a.f, 1));
    const mix = (u: number, v: number) => u + (v - u) * t;
    return { scale: mix(a.pose.scale, b.pose.scale), x: mix(a.pose.x, b.pose.x), y: mix(a.pose.y, b.pose.y), rot: mix(a.pose.rot, b.pose.rot) };
  }
  // Past the last beat: hold, with a barely-there drift so the shot never freezes.
  const last = keys[keys.length - 1];
  return { ...last.pose, scale: last.pose.scale + (frame - last.f) * 0.0005 };
}

// Keys sorted and strictly increasing, so beats that collide in short scenes still ease.
export function orderKeys(keys: CameraKey[]): CameraKey[] {
  const sorted = [...keys].sort((a, b) => a.f - b.f);
  return sorted.map((k, i) => ({ ...k, f: i ? Math.max(k.f, sorted[i - 1].f + 1) : k.f }));
}

type Camera = { keys: CameraKey[]; frame: number; span: number };
const CameraContext = createContext<Camera>({ keys: [], frame: 0, span: 1 });

export function CameraProvider({ value, children }: { value: Camera; children: ReactNode }) {
  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

// depth: how far the layer moves relative to the background; zoom: share of the
// camera's zoom applied (text zooms less so it never crops); blur: depth-of-field
// softness for foreground elements.
export function CameraLayer({
  depth = 1,
  zoom = 1,
  blur = 0,
  children,
}: {
  depth?: number;
  zoom?: number;
  blur?: number;
  children: ReactNode;
}) {
  const { keys, frame } = useContext(CameraContext);
  const p = poseAt(keys, frame);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${p.x * depth}%, ${p.y * depth}%) scale(${1 + (p.scale - 1) * zoom}) rotate(${p.rot * depth}deg)`,
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// The scene's own length in frames (the Sequence also includes the transition tail).
export const useSceneSpan = () => useContext(CameraContext).span;
