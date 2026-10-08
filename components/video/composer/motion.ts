import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";
import type { ArtT, EnterKind, TransitionKind } from "./types";

// How things move in a Composer film: the art direction's motion character
// (soft, snappy, springy, glide) sets every curve and duration.

const SOFT = Easing.bezier(0.22, 1, 0.36, 1);
const SNAP = Easing.bezier(0.16, 1, 0.3, 1);
const GLIDE = Easing.bezier(0.45, 0, 0.15, 1);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
// a spring that settles (no wobble past one small overshoot)
const spring = (t: number) => (t >= 1 ? 1 : 1 - Math.exp(-6.2 * t) * Math.cos(5.2 * t));

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const ramp = (f: number, at: number, dur: number) => clamp01((f - at) / Math.max(1, dur));

export type Mover = { ease: (t: number) => number; dur: number; stagger: number };
export function moverOf(art: Pick<ArtT, "motion" | "pace">): Mover {
  const p = art.pace || 1;
  if (art.motion === "snappy") return { ease: SNAP, dur: Math.round(13 / p), stagger: Math.round(3 / p) };
  if (art.motion === "springy") return { ease: spring, dur: Math.round(24 / p), stagger: Math.round(4 / p) };
  if (art.motion === "glide") return { ease: GLIDE, dur: Math.round(26 / p), stagger: Math.round(6 / p) };
  return { ease: SOFT, dur: Math.round(20 / p), stagger: Math.round(4 / p) };
}
// 0 → 1 from `at`, on the art's curve
export const enterK = (m: Mover, f: number, at: number, dur = m.dur) => (f < at ? 0 : m.ease(ramp(f, at, dur)));

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
    case "flip": return { opacity: o, transform: `perspective(1400px) rotateX(${-70 * r}deg)${rot}`, transformOrigin: "50% 100%" };
    case "swing": return { opacity: o, transform: `perspective(1400px) rotateY(${55 * r}deg)${rot}`, transformOrigin: "0% 50%" };
    case "unfold": return { opacity: clamp01(k * 3), clipPath: `inset(0 ${Math.round(100 * r)}% 0 0 round 24px)`, transform: rot || undefined };
    case "draw": return { opacity: clamp01(k * 3), transform: rot || undefined };
    default: return { opacity: o, transform: `translateY(${80 * r}px)${rot}`, filter: blurOf(r * 10) };
  }
}
const blurOf = (px: number) => (px > 0.3 ? `blur(${px.toFixed(1)}px)` : undefined);

// ── scenes in and out ─────────────────────────────────────────────────────
// A scene comes in over `dur` frames from just before its first word while
// the last one goes (they cross: there is never an empty frame).
export const TRANSITION_FRAMES: Record<TransitionKind, number> = { blur: 16, fade: 14, "push-left": 22, "push-right": 22, "push-up": 22, "push-down": 22, "zoom-in": 20, "zoom-out": 20, whip: 14, iris: 26, wipe: 22, flip: 22, morph: 20, drop: 20 };

export function sceneIn(kind: TransitionKind, k: number, origin: { x: number; y: number }): CSSProperties {
  const r = 1 - k;
  switch (kind) {
    case "push-left": return { transform: `translateX(${1920 * 0.42 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "push-right": return { transform: `translateX(${-1920 * 0.42 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "push-up": return { transform: `translateY(${1080 * 0.45 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "push-down": return { transform: `translateY(${-1080 * 0.45 * r}px)`, filter: blurOf(r * 14), opacity: clamp01(k * 1.4) };
    case "zoom-in": return { transform: `scale(${mix(0.72, 1, k)})`, filter: blurOf(r * 16), opacity: k };
    case "zoom-out": return { transform: `scale(${mix(1.35, 1, k)})`, filter: blurOf(r * 16), opacity: k };
    case "whip": return { transform: `translateX(${1100 * r}px) skewX(${-8 * r}deg)`, filter: blurOf(r * 30), opacity: clamp01(k * 3) };
    case "iris": {
      const reach = Math.hypot(Math.max(origin.x, 1920 - origin.x), Math.max(origin.y, 1080 - origin.y));
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
    case "push-left": return { transform: `translateX(${-1920 * 0.35 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "push-right": return { transform: `translateX(${1920 * 0.35 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "push-up": return { transform: `translateY(${-1080 * 0.4 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
    case "push-down": return { transform: `translateY(${1080 * 0.4 * k}px)`, filter: blurOf(k * 14), opacity: 1 - k * 0.9 };
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
  const breathe = `translate(${(Math.sin(f / 47) * 5 * e).toFixed(1)}px, ${(Math.cos(f / 61) * 4 * e).toFixed(1)}px)`;
  const q = IN_OUT(clamp01(p));
  switch (kind) {
    case "drift": return `${breathe} translateX(${mix(36, -36, q) * e}px)`;
    case "push": return `${breathe} scale(${mix(0.975, 1.045, q)})`;
    case "pull": return `${breathe} scale(${mix(1.05, 0.985, q)})`;
    case "tilt": return `${breathe} rotateY(${mix(-5, 4, q) * e}deg) rotateX(${mix(3, 0, q)}deg)`;
    case "orbit": return `${breathe} rotateY(${Math.sin(q * Math.PI - Math.PI / 2) * 6 * e}deg) rotateZ(${mix(-0.8, 0.8, q)}deg)`;
    case "rise": return `${breathe} translateY(${mix(26, -22, q) * e}px)`;
    case "float": return `${breathe} translateY(${Math.sin(f / 38) * 8 * e}px)`;
    default: return breathe;
  }
}
