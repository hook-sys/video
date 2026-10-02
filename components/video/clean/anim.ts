import { Easing, interpolate } from "remotion";

// 0 → 1 from `at` over `dur` frames, with a soft, premium ease-out.
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const rise = (f: number, at: number, dur = 18, ease = OUT) =>
  interpolate(f, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
// A little overshoot (a pop, a click).
export const pop = (f: number, at: number, dur = 16) =>
  interpolate(f, [at, at + dur * 0.6, at + dur], [0, 1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
// Counts from a to b between two frames (a number "ticking" up).
export const count = (f: number, at: number, dur: number, a: number, b: number) => Math.round(mix(a, b, rise(f, at, dur, IN_OUT)));
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
