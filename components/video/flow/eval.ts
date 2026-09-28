import { CURVES } from "./ease";
import type { Track, Vec } from "./types";

// Keyframe evaluation: each key's ease shapes the segment arriving at it.
// Pure (no Remotion), so the compiler can sample tracks on the server.
function segment<T>(track: Track<T>, frame: number): [T, T, number] {
  if (frame <= track[0][0]) return [track[0][1], track[0][1], 0];
  for (let i = 1; i < track.length; i++) {
    const [t1, v1, ease = "inOut"] = track[i];
    const [t0, v0] = track[i - 1];
    if (frame < t1) return [v0, v1, CURVES[ease](t1 === t0 ? 1 : (frame - t0) / (t1 - t0))];
  }
  const last = track[track.length - 1][1];
  return [last, last, 1];
}

export function num(track: Track<number> | undefined, frame: number, fallback: number) {
  if (!track?.length) return fallback;
  const [a, b, k] = segment(track, frame);
  return a + (b - a) * k;
}

export function vec(track: Track<Vec>, frame: number): Vec {
  const [a, b, k] = segment(track, frame);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

// Discrete track (icon, label): current value, previous value and 0..1
// progress of the change that started at the current key.
export function step<T>(track: Track<T> | undefined, frame: number, dur: number) {
  if (!track?.length) return null;
  let i = 0;
  while (i + 1 < track.length && track[i + 1][0] <= frame) i++;
  const since = frame - track[i][0];
  return { cur: track[i][1], prev: i > 0 ? track[i - 1][1] : null, k: i > 0 ? Math.min(1, Math.max(0, since / dur)) : 1, since };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ramp = (frame: number, start: number, dur: number, ease: keyof typeof CURVES = "out") => CURVES[ease](clamp01((frame - start) / dur));
