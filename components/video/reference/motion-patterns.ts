import { Easing, interpolate, spring } from "remotion";

// Deterministic motion patterns for the continuous timeline. Every function is
// a pure function of the frame, so any frame renders identically.

export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);

export type Vec = { x: number; y: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

// Stable pseudo-random in [-1, 1] from a string and a salt (no Math.random).
export function jitter(id: string, salt: number) {
  let h = salt * 977;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000003;
  const x = Math.sin(h) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

// Eased 0→1 over [start, start + dur] frames.
export function ramp(frame: number, start: number, dur: number, easing = Easing.inOut(Easing.cubic)) {
  return interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing });
}

// enter: an object arrives with weight and a small overshoot.
export const enter = (frame: number, start: number) =>
  frame < start ? 0 : spring({ frame: frame - start, fps: FPS, config: { damping: 13, mass: 0.8, stiffness: 110 } });

// snap: a quicker, crisper arrival into an exact position.
export const snap = (frame: number, start: number) =>
  frame < start ? 0 : spring({ frame: frame - start, fps: FPS, config: { damping: 12, mass: 0.5, stiffness: 190 } });

// build: growth (bars, progress) with a gentle overshoot.
export const build = (frame: number, start: number) =>
  frame < start ? 0 : spring({ frame: frame - start, fps: FPS, config: { damping: 16, mass: 0.7, stiffness: 120 } });

// accumulate: start frame of item i of n in a stream that speeds up, so the
// density visibly increases.
export function accumulate(i: number, n: number, first: number, last: number, accel = 1.7) {
  const u = n > 1 ? i / (n - 1) : 0;
  return Math.round(first + (last - first) * Math.pow(u, 1 / accel));
}

// converge: travel along an arc (quadratic Bézier lifted sideways) so objects
// sweep toward their destination instead of sliding in a straight line.
export function converge(frame: number, start: number, dur: number, a: Vec, b: Vec, lift: number) {
  const t = ramp(frame, start, dur, Easing.bezier(0.55, 0, 0.2, 1));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const c = { x: mid.x - (dy / len) * lift, y: mid.y + (dx / len) * lift };
  const u = 1 - t;
  return { t, pos: { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y } };
}

// arrange: move through a sequence of slots; each change springs from wherever
// the object is to the next slot (so re-flows chain naturally).
export function arrange(frame: number, slots: { at: number; pos: Vec }[], motion = snap) {
  let pos = slots[0].pos;
  for (const s of slots.slice(1)) pos = lerpVec(pos, s.pos, motion(frame, s.at));
  return pos;
}

// transform: 0→1 morph between two shapes of the same object.
export const transform = (frame: number, start: number, dur = sec(0.5)) => ramp(frame, start, dur);

// reveal: masked text / element reveal.
export const reveal = (frame: number, start: number, dur = sec(0.5)) => ramp(frame, start, dur, Easing.out(Easing.cubic));

// settle: decaying wobble after an impact (degrees or px).
export function settle(frame: number, at: number, amp: number) {
  const k = frame - at;
  return k < 0 ? 0 : amp * Math.exp(-k / 8) * Math.sin(k / 2.4);
}

// Smooth path through keyframes: monotone cubic interpolation per component
// (no overshoot), at rest at the first and last key. One continuous camera.
export function smoothPath(keys: { t: number; v: number[] }[], time: number): number[] {
  const n = keys.length;
  if (time <= keys[0].t) return keys[0].v;
  if (time >= keys[n - 1].t) return keys[n - 1].v;
  let k = 0;
  while (keys[k + 1].t < time) k++;
  return keys[0].v.map((_, c) => {
    const xs = keys.map((kf) => kf.t);
    const ys = keys.map((kf) => kf.v[c]);
    const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
    const m = xs.map((_, i) => (i === 0 || i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * a * d[i];
        m[i + 1] = tau * b * d[i];
      }
    }
    const h = xs[k + 1] - xs[k];
    const t = (time - xs[k]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
  });
}
