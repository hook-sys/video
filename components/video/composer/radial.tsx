import { type CSSProperties, useId } from "react";
import { H, W } from "./frame";

// A CSS radial-gradient, drawn as SVG: the browser's download (web-renderer)
// can't paint CSS radial gradients (they came out empty), but it draws SVG as
// the browser does — so the glows, dots and vignettes look the same in the
// Preview and in the downloaded MP4.

type Stop = [offset: number, color: string, opacity?: number];
const idOf = (s: string) => "r" + s.replace(/[^a-zA-Z0-9_-]/g, "");

// `at` and the reach follow CSS: an ellipse (or circle) reaching the farthest
// corner. With `place` (the box's top-left on a 1920×1080 frame) the SVG covers
// the whole frame and the gradient sits in the box: the download squeezes an
// element that hangs off the frame into the frame, so a glow drawn in its own
// (bigger than the frame) box came out with hard edges.
export function Radial({ w, h, at = [0.5, 0.5], circle = false, round = false, stops, place, style }: { w: number; h: number; at?: [number, number]; circle?: boolean; round?: boolean; stops: Stop[]; place?: { x: number; y: number }; style?: CSSProperties }) {
  const id = idOf(useId());
  const [cx, cy] = at;
  const fx = Math.max(cx, 1 - cx) * w;
  const fy = Math.max(cy, 1 - cy) * h;
  const [rx, ry] = circle ? [Math.hypot(fx, fy), Math.hypot(fx, fy)] : [fx * Math.SQRT2, fy * Math.SQRT2];
  const [ox, oy] = place ? [place.x, place.y] : [0, 0];
  const [sw, sh] = place ? [W, H] : [w, h];
  return (
    <svg width={sw} height={sh} style={{ display: "block", ...(place ? { position: "absolute", left: 0, top: 0 } : null), ...style }}>
      <defs>
        <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${ox + cx * w} ${oy + cy * h}) scale(${rx} ${ry})`}>
          {stops.map(([o, c, op = 1], i) => (
            <stop key={i} offset={o} stopColor={c} stopOpacity={op} />
          ))}
        </radialGradient>
      </defs>
      {round ? <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} /> : <rect width={sw} height={sh} fill={`url(#${id})`} />}
    </svg>
  );
}

// A tiled field — dots (a CSS `radial-gradient(c r, transparent)` tile) or grid
// lines — optionally fading out from a centre (an ellipse, as a CSS mask
// `radial-gradient(… #000 inner, transparent outer)`).
export type Fade = { x: number; y: number; rx: number; ry: number; inner: number; outer: number };
export function Tiles({ w, h, kind, gap, size, color, dx = 0, dy = 0, fade }: { w: number; h: number; kind: "dots" | "grid"; gap: number; size: number; color: string; dx?: number; dy?: number; fade?: Fade }) {
  const id = idOf(useId());
  return (
    <svg width={w} height={h} style={{ display: "block", position: "absolute", left: 0, top: 0 }}>
      <defs>
        <pattern id={`${id}p`} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform={`translate(${dx} ${dy})`}>
          {kind === "dots" ? <circle cx={gap / 2} cy={gap / 2} r={size} fill={color} /> : <path d={`M0 ${size}H${gap}M${size} 0V${gap}`} stroke={color} strokeWidth={size * 2} fill="none" />}
        </pattern>
        {fade && (
          <>
            <radialGradient id={`${id}g`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${fade.x} ${fade.y}) scale(${fade.rx} ${fade.ry})`}>
              <stop offset={fade.inner} stopColor="#fff" />
              <stop offset={fade.outer} stopColor="#fff" stopOpacity={0} />
            </radialGradient>
            <mask id={`${id}m`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
              <rect width={w} height={h} fill={`url(#${id}g)`} />
            </mask>
          </>
        )}
      </defs>
      <rect width={w} height={h} fill={`url(#${id}p)`} mask={fade ? `url(#${id}m)` : undefined} />
    </svg>
  );
}

// The CSS reach of a radial gradient centred at (x, y) on the frame.
export function reachOf(x: number, y: number, circle: boolean, w = W, h = H): [number, number] {
  const fx = Math.max(x, w - x);
  const fy = Math.max(y, h - y);
  return circle ? [Math.hypot(fx, fy), Math.hypot(fx, fy)] : [fx * Math.SQRT2, fy * Math.SQRT2];
}
