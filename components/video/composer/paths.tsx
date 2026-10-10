import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { clamp01 } from "./motion";

// Lines that draw themselves (Remotion's paths): connectors between things,
// a chart's line. Once drawn, a small light runs along a connector now and
// then — something is travelling from one thing to the next.

// A smooth curve through points (Catmull-Rom as cubic Béziers).
export function smoothPath(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// A path drawn to `k` (0 → 1); its head is where the line has got to.
export function drawn(d: string, k: number) {
  const t = clamp01(k);
  const len = getLength(d);
  const head = getPointAtLength(d, len * t);
  return { ...evolvePath(t, d), head, len };
}

export function Connector({ d, k, f, color, width = 4, dash, runner = true, seed = 0 }: { d: string; k: number; f: number; color: string; width?: number; dash?: boolean; runner?: boolean; seed?: number }) {
  if (!d || k <= 0) return null;
  const { strokeDasharray, strokeDashoffset, len } = drawn(d, k);
  // after it is drawn, a light runs along it every ~1.6 s
  const cycle = 48;
  const run = ((f + seed * 17) % cycle) / cycle;
  const at = k >= 1 && runner ? getPointAtLength(d, len * run) : null;
  return (
    <g>
      {dash && k >= 1 ? (
        <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray="3 12" opacity={0.75} />
      ) : (
        <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} opacity={0.75} />
      )}
      {at && <circle cx={at.x} cy={at.y} r={width * 2.2} fill={color} opacity={Math.sin(run * Math.PI)} style={{ filter: `drop-shadow(0 0 ${width * 3}px ${color})` }} />}
    </g>
  );
}
