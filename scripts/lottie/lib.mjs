// Tiny Lottie (bodymovin 5.x) authoring kit: shapes, styles, keyframes and an
// SVG-path → Lottie-bezier converter so any library icon can be animated.
// Everything is plain data; lottie-web renders it frame-accurately in Remotion.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ICONS = JSON.parse(readFileSync(path.join(root, "components/video/icons/icons.json"), "utf8"));
const ALIASES = JSON.parse(readFileSync(path.join(root, "components/video/icons/aliases.json"), "utf8"));

// Default palette. Colours are stored as these exact values so the renderer can
// map each role to the video's theme (see components/video/lottie/recolor.ts).
export const PALETTE = {
  primary: "#5B4FF5",
  accent: "#19C6B0",
  ink: "#1B1D2A",
  soft: "#E4E1FF",
  white: "#FFFFFF",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
  gold: "#FBBF24",
};
const r3 = (v) => Math.round(v * 1000) / 1000;
export const rgba = (hex, a = 1) => {
  const h = (PALETTE[hex] ?? hex).replace("#", "");
  return [0, 2, 4].map((i) => r3(parseInt(h.slice(i, i + 2), 16) / 255)).concat(a);
};

// Cubic-bezier easings (x1, y1, x2, y2).
export const EASE = {
  linear: [0, 0, 1, 1],
  out: [0.33, 1, 0.68, 1],
  in: [0.32, 0, 0.67, 0],
  inOut: [0.65, 0, 0.35, 1],
  back: [0.34, 1.56, 0.64, 1],
  snap: [0.2, 0.9, 0.1, 1],
};

const dims = (v) => (Array.isArray(v) ? v.length : 1);
const arr = (v) => (Array.isArray(v) ? v.map(r3) : [r3(v)]);

// Animated or static property. `frames` = [[t, value, ease?], …]; the ease
// shapes the segment that starts at that keyframe. [t, value, "hold"] jumps.
export function kf(frames) {
  return {
    a: 1,
    k: frames.map(([t, v, ease = "inOut"], i) => {
      const k = { t, s: arr(v) };
      if (i === frames.length - 1) return k;
      if (ease === "hold") return { ...k, h: 1 };
      const [x1, y1, x2, y2] = EASE[ease] ?? ease;
      const n = dims(v);
      return { ...k, o: { x: Array(n).fill(x1), y: Array(n).fill(y1) }, i: { x: Array(n).fill(x2), y: Array(n).fill(y2) } };
    }),
  };
}
export const P = (v) => (v && typeof v === "object" && "a" in v ? v : { a: 0, k: Array.isArray(v) ? v.map(r3) : r3(v) });

// ── shapes ──────────────────────────────────────────────────────────────────
export const ellipse = (size, pos = [0, 0]) => ({ ty: "el", p: P(pos), s: P(Array.isArray(size) ? size : [size, size]) });
export const rect = (size, radius = 0, pos = [0, 0]) => ({ ty: "rc", p: P(pos), s: P(size), r: P(radius) });
export const bez = (shape) => ({ ty: "sh", ks: P0(shape) });
const P0 = (shape) => (shape && shape.a === 1 ? shape : { a: 0, k: shape });
export const stroke = (color = "primary", width = 6, opacity = 100, dash) => ({
  ty: "st",
  c: color?.a ? color : P(rgba(color)),
  o: P(opacity),
  w: P(width),
  lc: 2,
  lj: 2,
  ml: 4,
  ...(dash && { d: [{ n: "d", nm: "dash", v: P(dash[0]) }, { n: "g", nm: "gap", v: P(dash[1]) }, { n: "o", nm: "offset", v: P(dash[2] ?? 0) }] }),
});
export const fill = (color = "primary", opacity = 100) => ({ ty: "fl", c: color?.a ? color : P(rgba(color)), o: P(opacity), r: 1 });
export const trim = (end = 100, start = 0, offset = 0) => ({ ty: "tm", s: P(start), e: P(end), o: P(offset), m: 1 });
// Animated colour: [[t, "role"|hex, ease?], …]
export const colorKf = (frames) => kf(frames.map(([t, c, e]) => [t, rgba(c), e]));

// Several groups inside one layer, listed back-to-front (Lottie draws the
// first item in front, so the list is reversed).
export const stack = (...groups) => groups.slice().reverse();

export function group(items, { p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return {
    ty: "gr",
    it: [...items, { ty: "tr", p: P(p), a: P(a), s: P(s), r: P(r), o: P(o), sk: P(0), sa: P(0) }],
  };
}

// ── SVG path → Lottie beziers ───────────────────────────────────────────────
function tokens(d) {
  return d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
}
function arcToCubics(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  // SVG spec F.6.5 endpoint → centre parameterisation, split into ≤90° cubics.
  const rad = (phi * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const out = [];
  for (let i = 0; i < segs; i++) {
    const a0 = t1 + i * step;
    const a1 = a0 + step;
    const [p0, p1] = [pt(a0), pt(a1)];
    const [d0, d1] = [der(a0), der(a1)];
    out.push([[p0[0] + k * d0[0], p0[1] + k * d0[1]], [p1[0] - k * d1[0], p1[1] - k * d1[1]], p1]);
  }
  return out;
}

// Returns Lottie path objects {i, o, v, c}, one per subpath.
export function svgToBeziers(d) {
  const t = tokens(d);
  const subs = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastC = null; // last cubic control point (for S)
  let lastQ = null; // last quadratic control point (for T)
  let cmd = "";
  let i = 0;
  const num = () => parseFloat(t[i++]);
  const start = (nx, ny) => {
    cur = { v: [[nx, ny]], i: [[0, 0]], o: [[0, 0]], c: false };
    subs.push(cur);
    [x, y, sx, sy] = [nx, ny, nx, ny];
  };
  const cubic = (c1x, c1y, c2x, c2y, nx, ny) => {
    const k = cur.v.length - 1;
    cur.o[k] = [c1x - x, c1y - y];
    cur.v.push([nx, ny]);
    cur.i.push([c2x - nx, c2y - ny]);
    cur.o.push([0, 0]);
    [x, y] = [nx, ny];
  };
  const line = (nx, ny) => cubic(x, y, nx, ny, nx, ny);
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase();
    const bx = rel ? x : 0;
    const by = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        start(bx + num(), by + num());
        cmd = rel ? "l" : "L";
        lastC = lastQ = null;
        break;
      }
      case "L":
        line(bx + num(), by + num());
        lastC = lastQ = null;
        break;
      case "H":
        line((rel ? x : 0) + num(), y);
        lastC = lastQ = null;
        break;
      case "V":
        line(x, (rel ? y : 0) + num());
        lastC = lastQ = null;
        break;
      case "C": {
        const [a, b, c, e, f, g] = [bx + num(), by + num(), bx + num(), by + num(), bx + num(), by + num()];
        cubic(a, b, c, e, f, g);
        lastC = [c, e];
        lastQ = null;
        break;
      }
      case "S": {
        const [c, e, f, g] = [bx + num(), by + num(), bx + num(), by + num()];
        const [a, b] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
        cubic(a, b, c, e, f, g);
        lastC = [c, e];
        lastQ = null;
        break;
      }
      case "Q":
      case "T": {
        let qx;
        let qy;
        if (cmd.toUpperCase() === "Q") [qx, qy] = [bx + num(), by + num()];
        else [qx, qy] = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
        const [f, g] = [bx + num(), by + num()];
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), f + (2 / 3) * (qx - f), g + (2 / 3) * (qy - g), f, g);
        lastQ = [qx, qy];
        lastC = null;
        break;
      }
      case "A": {
        const [rx, ry, phi, fa, fs] = [num(), num(), num(), num(), num()];
        const [nx, ny] = [bx + num(), by + num()];
        if (!rx || !ry) line(nx, ny);
        else for (const [c1, c2, p] of arcToCubics(x, y, rx, ry, phi, fa, fs, nx, ny)) cubic(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
        lastC = lastQ = null;
        break;
      }
      case "Z": {
        const last = cur.v.length - 1;
        if (last > 0 && Math.hypot(cur.v[last][0] - sx, cur.v[last][1] - sy) < 1e-6) {
          cur.i[0] = cur.i[last];
          cur.v.pop();
          cur.i.pop();
          cur.o.pop();
        }
        cur.c = true;
        [x, y] = [sx, sy];
        lastC = lastQ = null;
        break;
      }
      default:
        throw new Error(`unsupported path command ${cmd}`);
    }
  }
  const rp = (list) => list.map(([a, b]) => [r3(a), r3(b)]);
  return subs.map((s) => ({ i: rp(s.i), o: rp(s.o), v: rp(s.v), c: s.c }));
}

// A library icon as an animatable group, centred at `pos`, `size` px wide.
// `draw` (0..100 or kf) trims the line for a draw-on reveal.
export function icon(name, { size = 96, pos = [100, 100], color = "primary", width = 2, draw, fillColor, s = [100, 100], r = 0, o = 100 } = {}) {
  const key = ICONS[name] ? name : ALIASES[name];
  if (!key) throw new Error(`unknown icon ${name}`);
  const data = ICONS[key];
  const [strokeD, fillD] = typeof data === "string" ? [data, ""] : data;
  const k = (size / 24) * 100;
  const items = [
    group([
      ...svgToBeziers(strokeD).map(bez),
      ...(draw !== undefined ? [trim(draw)] : []),
      stroke(color, width), // listed first = drawn in front of the fill
      ...(fillColor ? [fill(fillColor)] : []),
    ]),
    ...(fillD ? [group([...svgToBeziers(fillD).map(bez), fill(color), stroke(color, width)])] : []),
  ];
  // Inner group maps the 24×24 icon to `size` px around its centre; the outer
  // one carries the animation (position, scale, rotation, opacity).
  return group([group(items, { a: [12, 12], s: [k, k] })], { p: pos, s, r, o });
}

// ── layers & animation ──────────────────────────────────────────────────────
export function layer(shapes, { p = [100, 100], a = [100, 100], s = [100, 100], r = 0, o = 100, ip, op, name = "layer" } = {}) {
  const v3 = (v, z) => (v && v.a === 1 ? { a: 1, k: v.k.map((f) => ({ ...f, s: f.s.length === 2 ? [...f.s, z] : f.s })) } : P([...v, z]));
  return {
    ddd: 0,
    ty: 4,
    nm: name,
    sr: 1,
    ks: { o: P(o), r: P(r), p: v3(p, 0), a: v3(a, 0), s: v3(s, 100) },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  };
}

export function animation({ name, frames = 60, size = 200, layers }) {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: frames,
    w: size,
    h: size,
    nm: name,
    ddd: 0,
    assets: [],
    // Lottie draws the first layer on top; callers list back-to-front.
    layers: layers
      .slice()
      .reverse()
      .map((l, i) => ({ ...l, ind: i + 1, ip: l.ip ?? 0, op: l.op ?? frames })),
  };
}
