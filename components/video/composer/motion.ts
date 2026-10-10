import type { CSSProperties } from "react";
import { Easing, interpolate, spring } from "remotion";
import type { ArtT, EnterKind, TransitionKind } from "./types";
import { H, W } from "./frame";
import { noise2D } from "@remotion/noise";

// How things move in a Composer film: the art direction's motion character
// (soft, snappy, springy, glide) sets every curve and duration.

const SOFT = Easing.bezier(0.22, 1, 0.36, 1);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const ramp = (f: number, at: number, dur: number) => clamp01((f - at) / Math.max(1, dur));

// Things come in on Remotion's physical spring: each motion character is a
// spring (soft: no overshoot; snappy: quick with a hair of overshoot;
// springy: a visible settle; glide: heavy and slow), stretched to the pace.
type SpringCfg = { damping: number; stiffness: number; mass: number; overshootClamping?: boolean };
export type Mover = { cfg: SpringCfg; dur: number; stagger: number; ease: (t: number) => number };
const CFG: Record<ArtT["motion"], SpringCfg> = {
  soft: { damping: 200, stiffness: 100, mass: 1 },
  snappy: { damping: 22, stiffness: 220, mass: 0.7 },
  springy: { damping: 11, stiffness: 140, mass: 0.9 },
  glide: { damping: 200, stiffness: 60, mass: 1.6 },
};
export function moverOf(art: Pick<ArtT, "motion" | "pace">): Mover {
  const p = art.pace || 1;
  const base = { soft: 22, snappy: 16, springy: 26, glide: 30 }[art.motion] ?? 22;
  const stagger = { soft: 4, snappy: 3, springy: 4, glide: 6 }[art.motion] ?? 4;
  return { cfg: CFG[art.motion] ?? CFG.soft, dur: Math.round(base / p), stagger: Math.round(stagger / p), ease: SOFT };
}
// 0 → 1 from `at` on the art's spring (a springy one passes 1 and settles)
export const enterK = (m: Mover, f: number, at: number, dur = m.dur) => (f < at ? 0 : spring({ frame: f - at, fps: 30, config: m.cfg, durationInFrames: Math.max(4, dur) }));

// A thing coming in (k 0 → 1): never from nothing, never with a jump.
export function enterStyle(kind: EnterKind, k: number, tilt = 0): CSSProperties {
  const o = clamp01(k * 1.6);
  const r = 1 - k;
  const rot = tilt ? ` rotate(${tilt * (0.4 + 0.6 * k)}deg)` : "";
  switch (kind) {
    case "drop": return { opacity: o, transform: `translateY(${-90 * r}px)${rot}`, filter: blurOf(r * 10) };
    case "left": return { opacity: o, transform: `translateX(${-140 * r}px)${rot}`, filter: blurOf(r * 10) };
    case "right": return { opacity: o, transform: `translateX(${140 * r}px)${rot}`, filter: blurOf(r * 10) };
    case "scale": return { opacity: o, transform: `scale(${mix(0.78, 1, k)})${rot}`, filter: blurOf(r * 8) };
    case "pop": return { opacity: o, transform: `scale(${mix(0.4, 1, k)})${rot}` };
    case "blur": return { opacity: o, transform: `scale(${mix(1.08, 1, k)})${rot}`, filter: blurOf(r * 24) };
    // (flat: the download draws a turn in depth flat or not at all — see present.tsx)
    case "flip": return { opacity: o, transform: `scaleY(${mix(0.18, 1, 1 - r).toFixed(3)}) skewX(${(-10 * r).toFixed(2)}deg)${rot}`, transformOrigin: "50% 100%" };
    case "swing": return { opacity: o, transform: `scaleX(${mix(0.35, 1, 1 - r).toFixed(3)}) skewY(${(8 * r).toFixed(2)}deg)${rot}`, transformOrigin: "0% 50%" };
    case "unfold": return { opacity: clamp01(k * 3), clipPath: `inset(0 ${Math.round(100 * r)}% 0 0 round 24px)`, transform: rot || undefined };
    case "draw": return { opacity: clamp01(k * 3), transform: rot || undefined };
    default: return { opacity: o, transform: `translateY(${80 * r}px)${rot}`, filter: blurOf(r * 10) };
  }
}
const blurOf = (px: number) => (px > 0.3 ? `blur(${px.toFixed(1)}px)` : undefined);

// ── scenes in and out ─────────────────────────────────────────────────────
// A scene comes in over `dur` frames from just before its first word while
// the last one goes (they cross: there is never an empty frame).
export { TRANSITION_FRAMES } from "./sizes";

export function sceneIn(kind: TransitionKind, k: number, origin: { x: number; y: number }): CSSProperties {
  const r = 1 - k;
  switch (kind) {
    case "push-left": return { transform: `translateX(${W * 0.42 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "push-right": return { transform: `translateX(${-W * 0.42 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "push-up": return { transform: `translateY(${H * 0.45 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "push-down": return { transform: `translateY(${-H * 0.45 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "zoom-in": return { transform: `scale(${mix(0.72, 1, k)})`, filter: blurOf(r * 16), opacity: k };
    case "zoom-out": return { transform: `scale(${mix(1.35, 1, k)})`, filter: blurOf(r * 16), opacity: k };
    case "whip": return { transform: `translateX(${1100 * r}px) skewX(${-8 * r}deg)`, filter: blurOf(r * 30), opacity: clamp01(k * 3) };
    case "iris": {
      const reach = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y));
      const c = `circle(${Math.round(Math.sqrt(k) * reach)}px at ${Math.round(origin.x)}px ${Math.round(origin.y)}px)`;
      return { clipPath: c, WebkitClipPath: c };
    }
    case "wipe": {
      const c = `inset(0 0 0 ${Math.round(100 * r)}%)`;
      return { clipPath: c, WebkitClipPath: c, transform: `translateX(${60 * r}px)` };
    }
    case "flip": return { transform: `perspective(2200px) rotateY(${-80 * r}deg)`, transformOrigin: "100% 50%", opacity: clamp01(k * 2) };
    case "drop": return { transform: `translateY(${-160 * r}px) scale(${mix(1.06, 1, k)})`, filter: blurOf(r * 12), opacity: k };
    case "morph": return { opacity: k, filter: blurOf(r * 8) };
    case "fade": return { opacity: k };
    default: return { transform: `scale(${mix(0.97, 1, k)})`, filter: blurOf(r * 18), opacity: k };
  }
}
// the last scene going as `kind` (the next one's way in) comes
export function sceneOut(kind: TransitionKind, k: number): CSSProperties {
  // k: 0 (still here) → 1 (gone)
  switch (kind) {
    case "push-left": return { transform: `translateX(${-W * 0.35 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "push-right": return { transform: `translateX(${W * 0.35 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "push-up": return { transform: `translateY(${-H * 0.4 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "push-down": return { transform: `translateY(${H * 0.4 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "zoom-in": return { transform: `scale(${mix(1, 1.3, k)})`, filter: blurOf(k * 16), opacity: 1 - k };
    case "zoom-out": return { transform: `scale(${mix(1, 0.8, k)})`, filter: blurOf(k * 16), opacity: 1 - k };
    case "whip": return { transform: `translateX(${-1100 * k}px) skewX(${8 * k}deg)`, filter: blurOf(k * 30), opacity: 1 - k };
    case "iris": case "wipe": return { opacity: 1 - interpolate(k, [0.6, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) };
    case "flip": return { transform: `perspective(2200px) rotateY(${70 * k}deg)`, transformOrigin: "0% 50%", opacity: 1 - k };
    case "drop": return { transform: `translateY(${120 * k}px)`, filter: blurOf(k * 12), opacity: 1 - k };
    case "morph": return { opacity: 1 - k, filter: blurOf(k * 8) };
    case "fade": return { opacity: 1 - k };
    default: return { transform: `scale(${mix(1, 1.05, k)})`, filter: blurOf(k * 18), opacity: 1 - k };
  }
}

// The camera on a scene's things over the scene (p 0 → 1).
export function cameraOf(kind: string, p: number, f: number, energy: number): string {
  const e = 0.5 + energy;
  // (a hand-held drift — Remotion's noise: never the same loop twice)
  const breathe = `translate(${(noise2D("cam-x", f / 70, 0) * 7 * e).toFixed(1)}px, ${(noise2D("cam-y", 0, f / 85) * 5 * e).toFixed(1)}px)`;
  const q = IN_OUT(clamp01(p));
  switch (kind) {
    case "drift": return `${breathe} translateX(${mix(36, -36, q) * e}px)`;
    case "push": return `${breathe} scale(${mix(0.975, 1.045, q)})`;
    case "pull": return `${breathe} scale(${mix(1.05, 0.985, q)})`;
    // (tilt and orbit in the plane: the download draws a turn in depth flat or not at all)
    case "tilt": return `${breathe} rotate(${(mix(-1.1, 0.8, q) * e).toFixed(3)}deg) skewY(${(mix(-0.7, 0.5, q) * e).toFixed(3)}deg) scale(${mix(1.01, 1.03, q).toFixed(4)})`;
    case "orbit": return `${breathe} translateX(${(Math.sin(q * Math.PI - Math.PI / 2) * 28 * e).toFixed(1)}px) rotateZ(${mix(-0.8, 0.8, q).toFixed(3)}deg) scale(1.02)`;
    case "rise": return `${breathe} translateY(${mix(26, -22, q) * e}px)`;
    case "float": return `${breathe} translateY(${(noise2D("cam-float", f / 45, 0.5) * 12 * e).toFixed(1)}px)`;
    default: return breathe;
  }
}
