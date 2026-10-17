import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { noise2D } from "@remotion/noise";
import { H, W } from "./frame";
import { IN_OUT, clamp01, mix } from "./motion";

// Flat stand-ins for glass, depth and camera. The in-browser download draws
// the same CSS the Player does, except it cannot paint a backdrop blur, a
// CSS radial or conic fill, or a rotateX / rotateY. Glass is a translucent
// fill, a linear highlight, a hairline border and a pre-blurred copy of the
// layer behind. Depth is three flat layers at different speeds. The camera
// is translate + scale + a small in-plane rotate, and it is clamped so a
// text box never leaves the frame.

export type Cam2 = { x: number; y: number; s: number; rot: number };
export type FrameBox = { x: number; y: number; w: number; h: number };

export function cam2d(kind: string, p: number, f: number, energy: number): Cam2 {
  const e = 0.45 + Math.max(0, Math.min(1, energy)) * 0.7;
  const q = IN_OUT(clamp01(p));
  const bx = noise2D("hcam-x", f / 70, 0) * 8 * e;
  const by = noise2D("hcam-y", 0, f / 80) * 6 * e;
  switch (kind) {
    case "drift": return { x: bx + mix(32, -32, q) * e, y: by, s: 1, rot: 0 };
    case "push": return { x: bx, y: by, s: mix(1, 1.055, q), rot: 0 };
    case "pull": return { x: bx, y: by, s: mix(1.05, 1, q), rot: 0 };
    case "tilt": return { x: bx + mix(10, -8, q) * e, y: by, s: mix(1.01, 1.035, q), rot: mix(-1.1, 1, q) * e };
    case "orbit": return { x: bx + Math.sin(q * Math.PI * 2) * 24 * e, y: by + Math.cos(q * Math.PI * 2) * 12 * e, s: 1.025, rot: mix(-0.8, 0.8, q) };
    case "rise": return { x: bx, y: by + mix(20, -18, q) * e, s: mix(1, 1.03, q), rot: 0 };
    case "float": return { x: bx * 0.6, y: by + noise2D("hcam-f", f / 38, 0.4) * 16 * e, s: 1.02, rot: 0 };
    case "macro": return { x: bx * 0.4, y: by * 0.4, s: mix(1, 1.07, q), rot: 0 };
    default: return { x: bx * 0.4, y: by * 0.4, s: 1, rot: 0 };
  }
}

export function depthCam(cam: Cam2, depth: number): Cam2 {
  return { x: cam.x * depth, y: cam.y * depth, rot: cam.rot * depth, s: 1 + (cam.s - 1) * depth };
}

function corners(box: FrameBox): [number, number][] {
  return [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
}

// Transform origin is the frame centre. CSS applies the functions right to
// left, so the string is translate, then scale, then rotate.
export function mapPoint(px: number, py: number, cam: Cam2): [number, number] {
  const cx = W / 2, cy = H / 2;
  const dx = px - cx, dy = py - cy;
  const rad = (cam.rot * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return [cx + rx * cam.s + cam.x, cy + ry * cam.s + cam.y];
}

export function containCam(cam: Cam2, box: FrameBox, margin = 28): Cam2 {
  const inside = (c: Cam2) => corners(box).every(([x, y]) => {
    const [nx, ny] = mapPoint(x, y, c);
    return nx >= margin && ny >= margin && nx <= W - margin && ny <= H - margin;
  });
  if (inside(cam)) return cam;
  let lo = 0, hi = 1;
  for (let i = 0; i < 14; i++) {
    const t = (lo + hi) / 2;
    const c = { x: cam.x * t, y: cam.y * t, rot: cam.rot * t, s: 1 + (cam.s - 1) * t };
    if (inside(c)) lo = t;
    else hi = t;
  }
  return { x: cam.x * lo, y: cam.y * lo, rot: cam.rot * lo, s: 1 + (cam.s - 1) * lo };
}

export function camStyle(cam: Cam2): CSSProperties {
  return {
    transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) scale(${cam.s.toFixed(4)}) rotate(${cam.rot.toFixed(3)}deg)`,
    transformOrigin: "50% 50%",
  };
}

// `backdrop` is the layer behind this pane, drawn again and blurred so the
// pane reads as glass without a backdrop blur.
export function Glass({ x, y, w, h, radius, fill, children, backdrop, sheen = 0.15 }: { x: number; y: number; w: number; h: number; radius: number; fill: string; children?: ReactNode; backdrop?: ReactNode; sheen?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: radius, overflow: "hidden", border: "1px solid rgba(255,255,255,0.66)", background: fill, boxShadow: "0 28px 70px rgba(20, 16, 12, 0.16)" }}>
      {backdrop && (
        <div style={{ position: "absolute", left: -x, top: -y, width: W, height: H, filter: "blur(26px)", transform: "scale(1.08)", transformOrigin: `${x + w / 2}px ${y + h / 2}px` }}>
          {backdrop}
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(168deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 36%, rgba(255,255,255,0.02) 68%, rgba(255,255,255,0.18) 100%)" }} />
      <div style={{ position: "absolute", left: (-0.35 + sheen * 1.5) * w, top: 0, width: w * 0.28, height: "100%", background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.5), rgba(255,255,255,0))", transform: "skewX(-16deg)", opacity: 0.7 }} />
      <div style={{ position: "relative", width: "100%", height: "100%" }}>{children}</div>
    </div>
  );
}

// back / mid move freely. front is clamped to `textBox` when one is given,
// so type on that layer cannot be cropped.
export function Parallax({ cam, back, mid, front, textBox }: { cam: Cam2; back: ReactNode; mid: ReactNode; front: ReactNode; textBox?: FrameBox | null }) {
  const frontCam = textBox ? containCam(depthCam(cam, 0.5), textBox) : depthCam(cam, 1);
  return (
    <>
      <AbsoluteFill style={camStyle(depthCam(cam, 0.35))}>{back}</AbsoluteFill>
      <AbsoluteFill style={camStyle(depthCam(cam, 0.72))}>{mid}</AbsoluteFill>
      <AbsoluteFill style={camStyle(frontCam)}>{front}</AbsoluteFill>
    </>
  );
}
