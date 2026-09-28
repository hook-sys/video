import type { Ease } from "./types";

// Cubic-bezier easing without Remotion, so the compiler (server side) and the
// renderer evaluate keyframes identically.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}

export const CURVES: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  out: bezier(0.22, 1, 0.36, 1),
  in: bezier(0.55, 0, 0.85, 0.2),
  inOut: bezier(0.65, 0, 0.35, 1),
  back: bezier(0.34, 1.56, 0.64, 1),
  snap: bezier(0.2, 0.9, 0.1, 1),
};
