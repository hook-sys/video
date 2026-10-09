import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { noise2D } from "@remotion/noise";
import type { Pal } from "./art";
import { hsl } from "./art";
import { clamp01, mix, ramp } from "./motion";
import { Radial, Tiles } from "./radial";
import type { ComposerPlan, JourneyKind } from "./types";
import { RECAP } from "./staging";

// Journey: the whole film is one big canvas. Every scene has its own place on
// it; between scenes the camera travels there (along a line it draws as it
// goes) instead of one scene giving way to the next. The background belongs
// to the canvas, so it streams past while the camera moves.

export type P = { x: number; y: number };
export { W, H } from "./frame";
import { W, H } from "./frame";
// (a step between scenes: a frame and a gap)
const stepX = () => W + 430;
const stepY = () => H + 370;
export const TILE_GAP = 150;

// How the camera behaves on each kind of canvas: how far back it rests (a
// wall of tiles shows the gutters), how much it pulls out on the way, whether
// it leans, and whether the last move shows the whole canvas first.
export type Style = { rest: number; pull: number; lean: boolean; overview: boolean; soft?: boolean };
export function styleOf(kind: JourneyKind | null | undefined, link?: string | null): Style {
  // a whip pan goes straight there, fast, barely pulling out
  // (on a sine, not the cubic: half the top speed, so a big bright card
  // whipping past never changes the frame too much at once)
  if (link === "whip") return { rest: 1, pull: 0.12, lean: false, overview: false, soft: true };
  switch (kind) {
    case "timeline": return { rest: 1, pull: 0.55, lean: false, overview: false };
    case "map": return { rest: 1, pull: 1, lean: true, overview: true };
    case "tiles": return { rest: 0.9, pull: 0.8, lean: false, overview: true };
    case "scroll": return { rest: 1, pull: 0, lean: false, overview: false };
    default: return { rest: 1, pull: 1, lean: true, overview: false };
  }
}
// the whole canvas in view (its middle, and the zoom that fits it)
export function overviewOf(st: P[]): { c: P; z: number } {
  const xs = st.map((p) => p.x), ys = st.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { c: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, z: Math.min(W / (x1 - x0 + W + 500), H / (y1 - y0 + H + 360)) };
}

// The scenes' places on the canvas.
export function stations(n: number, kind: JourneyKind, seed: number): P[] {
  const j = (i: number, k: string, amp: number) => noise2D(`${k}${seed}`, i * 0.9, 0.3) * amp;
  return Array.from({ length: n }, (_, i) => {
    switch (kind) {
      case "down": return { x: j(i, "dx", 520), y: i * stepY() };
      case "diagonal": return { x: i * stepX() * 0.86, y: i * stepY() * 0.72 + j(i, "dy", 160) };
      case "zigzag": return { x: i * stepX() * 0.92, y: (i % 2) * stepY() * 0.95 };
      case "timeline": return { x: i * stepX(), y: 0 };
      // the story goes round a ring; the last scene (the ask) is the hub in the middle
      case "map": {
        if (i === n - 1) return { x: 0, y: 0 };
        const R = Math.max(W * 1.4, ((n - 1) * stepX()) / (2 * Math.PI));
        const a = -Math.PI * 0.75 + (i / Math.max(1, n - 1)) * Math.PI * 2;
        return { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.78 };
      }
      // a wall of screens, three across, read like a snake
      case "tiles": {
        const row = Math.floor(i / 3), col = i % 3;
        return { x: (row % 2 ? 2 - col : col) * (W + TILE_GAP), y: row * (H + TILE_GAP) };
      }
      case "scroll": return { x: 0, y: i * H };
      case "snake": {
        // rows of three: right, down, back left, down…
        const row = Math.floor(i / 3), col = i % 3;
        return { x: (row % 2 ? 2 - col : col) * stepX(), y: row * stepY() };
      }
      default: return { x: i * stepX(), y: j(i, "dy", 260) };
    }
  });
}

// When the camera travels into each scene (frames): it leaves a little before
// the scene's words start and arrives just after.
export const MOVE = 60;
export const WHIP = 26;
export function moves(plan: ComposerPlan): { start: number; dur: number }[] {
  const sc = plan.scenes;
  // a last move that shows the whole canvas on the way takes longer
  const long = styleOf(plan.journey).overview;
  // a whip pan is over in a moment (its blur carries it); the more frames'
  // worth of canvas it crosses (a frame is shorter than it is wide), the longer
  const whip = plan.link === "whip";
  const st = whip ? stations(sc.length, plan.journey ?? "right", plan.seed) : [];
  const span = (i: number) => Math.max(Math.abs(st[i].x - st[i - 1].x) / W, (Math.abs(st[i].y - st[i - 1].y) / H) * 1.3);
  return sc.map((s, i) => {
    if (!i) return { start: -1, dur: 1 };
    const room = s.from - sc[i - 1].from - 16;
    const dur = whip ? Math.max(14, Math.min(Math.round((WHIP * span(i)) / 1.22), room)) : Math.max(24, Math.min(long && i === sc.length - 1 ? 110 : MOVE, room));
    return { start: Math.round(s.from - dur * 0.72), dur };
  });
}

// On a journey the camera arrives at a scene before its words: the scene's
// first things are already there to arrive at (later ones still come on
// their words).
export function arriving(plan: ComposerPlan, mv: { start: number; dur: number }[]): ComposerPlan {
  return {
    ...plan,
    scenes: plan.scenes.map((sc, i) => {
      if (!i) return sc;
      const at = Math.round(mv[i].start + mv[i].dur * 0.45);
      return { ...sc, items: sc.items.map((it) => (it.at <= sc.from + 24 ? { ...it, at: Math.min(it.at, at) } : it)) };
    }),
  };
}

// The road from one place to the next: a gentle S between the two scenes.
export function road(a: P, b: P): [P, P, P, P] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bend = len * 0.16;
  return [a, { x: a.x + dx * 0.35 + nx * bend, y: a.y + dy * 0.35 + ny * bend }, { x: a.x + dx * 0.65 - nx * bend, y: a.y + dy * 0.65 - ny * bend }, b];
}
export const bez = ([a, b, c, d]: [P, P, P, P], t: number): P => {
  const u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y };
};
// ease in and out, a little longer at both ends than the middle
export const EASE = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Cam = { x: number; y: number; z: number; rot: number; seg: number; k: number; speed: number };

// Where the camera is at frame f (on the canvas), how far out it has pulled,
// and which stretch of road it is on. With `ends` the camera keeps a thing in
// view on the way instead of the scenes' middles: it travels along that
// thing's road (from where it is in one scene to where it lands in the next),
// keeping the thing where it was on screen at the start and where it will be
// at the end.
export type Ends = { a: P; b: P } | null;
export function cameraAt(f: number, st: P[], mv: { start: number; dur: number }[], ends?: Ends[], style: Style = styleOf(null)): Cam {
  let seg = 0;
  for (let i = 1; i < st.length; i++) if (f >= mv[i].start) seg = i;
  const raw = seg ? ramp(f, mv[seg].start, mv[seg].dur) : 1;
  const ease = style.soft ? (t: number) => (1 - Math.cos(t * Math.PI)) / 2 : EASE;
  const k = ease(raw);
  if (!seg || raw >= 1) {
    const p = st[seg];
    return { x: p.x, y: p.y, z: style.rest, rot: 0, seg, k: 1, speed: 0 };
  }
  const sa = st[seg - 1], sb = st[seg];
  const e = ends?.[seg];
  const a = e?.a ?? sa, b = e?.b ?? sb;
  const r = road(a, b);
  const over = style.overview && seg === st.length - 1 ? overviewOf(st) : null;
  const at = (t: number, w: number): P => {
    const q = bez(r, t);
    const p = { x: q.x - mix(a.x - sa.x, b.x - sb.x, t), y: q.y - mix(a.y - sa.y, b.y - sb.y, t) };
    return over ? { x: mix(p.x, over.c.x, w), y: mix(p.y, over.c.y, w) } : p;
  };
  // (on the way to the last scene the camera first pulls back to show the whole canvas)
  // (it eases out to the whole view, holds it a moment, and eases back in)
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const wOf = (rr: number) => (over ? smooth(clamp01(Math.min(rr, 1 - rr) / 0.38)) : 0);
  const raw2 = ramp(f + 1, mv[seg].start, mv[seg].dur);
  const p = at(k, wOf(raw));
  const p2 = at(ease(raw2), wOf(raw2));
  // it pulls out on the way (the further, the more) and leans into the turn
  const dist = Math.hypot(sb.x - sa.x, sb.y - sa.y);
  let z = style.rest * (1 - Math.sin(raw * Math.PI) * Math.min(0.46, 0.2 + dist / 7000) * style.pull);
  if (over) z = Math.exp(mix(Math.log(z), Math.log(over.z), wOf(raw)));
  const rot = style.lean ? Math.sin(raw * Math.PI) * Math.sign(sb.x - sa.x || 1) * (sb.y >= sa.y ? 1.4 : -1.4) * (1 - wOf(raw)) : 0;
  return { x: p.x, y: p.y, z, rot, seg, k, speed: Math.hypot(p2.x - p.x, p2.y - p.y) };
}

// The canvas turning a quarter round a corner: each scene lies a quarter turn
// from the last about a point just off one side of it (alternating sides,
// turning either way), so on the way the camera swings round that point and
// the scene goes out like a door as the next swings in.
export type Turn = { st: P[]; rot: number[]; pivot: P[]; dir: number[] };
const TURN_D = 1580;
export function turnGeometry(n: number, seed: number): Turn {
  const st: P[] = [{ x: 0, y: 0 }], rot = [0], pivot: P[] = [{ x: 0, y: 0 }], dir = [0];
  for (let i = 1; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const d = noise2D(`turn${seed}`, i * 1.7, 0.5) >= 0 ? 1 : -1;
    const a = (rot[i - 1] * Math.PI) / 180;
    const P = { x: st[i - 1].x + Math.cos(a) * side * TURN_D, y: st[i - 1].y + Math.sin(a) * side * TURN_D };
    const q = (d * Math.PI) / 2, rx = st[i - 1].x - P.x, ry = st[i - 1].y - P.y;
    st.push({ x: P.x + rx * Math.cos(q) - ry * Math.sin(q), y: P.y + rx * Math.sin(q) + ry * Math.cos(q) });
    rot.push(rot[i - 1] + d * 90);
    pivot.push(P);
    dir.push(d);
  }
  return { st, rot, pivot, dir };
}
export function turnCam(f: number, g: Turn, mv: { start: number; dur: number }[]): Cam {
  let seg = 0;
  for (let i = 1; i < g.st.length; i++) if (f >= mv[i].start) seg = i;
  const raw = seg ? ramp(f, mv[seg].start, mv[seg].dur) : 1;
  if (!seg || raw >= 1) return { x: g.st[seg].x, y: g.st[seg].y, z: 1, rot: -g.rot[seg], seg, k: 1, speed: 0 };
  // the camera goes straight from one scene to the next (not round the
  // corner's point, which would leave both scenes at the frame's edges) while
  // it turns, pulled well back so both are in view as they swing round
  const at = (r: number) => {
    const u = (1 - Math.cos(r * Math.PI)) / 2;
    const a = g.st[seg - 1], b = g.st[seg];
    return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), u };
  };
  const p = at(raw), p2 = at(ramp(f + 1, mv[seg].start, mv[seg].dur));
  return { x: p.x, y: p.y, z: 1 - Math.sin(raw * Math.PI) * 0.62, rot: -(g.rot[seg - 1] + g.dir[seg] * 90 * p.u), seg, k: p.u, speed: Math.hypot(p2.x - p.x, p2.y - p.y) };
}

// The recap: after the last scene the camera pulls back until the whole
// canvas is in view (every scene where it was, the way between them drawn),
// straightening as it goes, and holds there while the brand comes up over it.
// It adds its own seconds to the film.
// (on a sine: the zoom goes a long way, so its fastest moment must stay calm)
export const recapAt = (f: number, duration: number) => (1 - Math.cos(ramp(f, duration - RECAP, 78) * Math.PI)) / 2;
export function recapped(cam: Cam, f: number, duration: number, st: P[]): Cam {
  const k = recapAt(f, duration);
  if (k <= 0) return cam;
  const o = overviewOf(st);
  // (it pulls back first and travels to the middle as it does: far from the
  // middle, moving while still close in would sweep the whole frame)
  const kp = Math.pow(k, 1.7);
  return { ...cam, x: mix(cam.x, o.c.x, kp), y: mix(cam.y, o.c.y, kp), z: Math.exp(mix(Math.log(cam.z), Math.log(o.z), k)), rot: mix(cam.rot, 0, k), speed: 0 };
}

// canvas → screen
export function toScreen(p: P, cam: Cam, depth = 1): P {
  const dx = (p.x - cam.x) * cam.z * depth, dy = (p.y - cam.y) * cam.z * depth;
  const r = (cam.rot * Math.PI) / 180;
  return { x: W / 2 + dx * Math.cos(r) - dy * Math.sin(r), y: H / 2 + dx * Math.sin(r) + dy * Math.cos(r) };
}
export const worldTransform = (cam: Cam) => `translate(${W / 2}px, ${H / 2}px) rotate(${cam.rot.toFixed(3)}deg) scale(${cam.z.toFixed(4)}) translate(${(-cam.x).toFixed(1)}px, ${(-cam.y).toFixed(1)}px)`;

const hexRgb = (c: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
};
const mixHex = (a: string, b: string, t: number) => {
  const x = hexRgb(a), y = hexRgb(b);
  if (!x || !y) return t < 0.5 ? a : b;
  return `rgb(${x.map((v, i) => Math.round(mix(v, y[i], t))).join(",")})`;
};

// The canvas behind the scenes: its colour turns from one scene's to the
// next on the way; dots (far, slower) and the light at each place (nearer)
// stream past as the camera moves.
export function JourneyField({ f, cam, st, darks, pals, hue, grid }: { f: number; cam: Cam; st: P[]; darks: boolean[]; pals: { dark: Pal; light: Pal }; hue: number; grid: boolean }) {
  const from = darks[Math.max(0, cam.seg - 1)], to = darks[cam.seg];
  const t = cam.seg ? clamp01(cam.k) : 1;
  const pa = from ? pals.dark : pals.light, pb = to ? pals.dark : pals.light;
  const bg = mixHex(pa.bg, pb.bg, t), bg2 = mixHex(pa.bg2, pb.bg2, t);
  const d = t < 0.5 ? from : to;
  const depth = 0.55;
  const gap = (grid ? 96 : 42) * cam.z * (0.75 + depth * 0.25);
  const ox = (-cam.x * cam.z * depth) % gap, oy = (-cam.y * cam.z * depth) % gap;
  const glows: ReactNode[] = [];
  st.forEach((p, i) => {
    const s = toScreen({ x: p.x + noise2D(`gx${i}`, f / 140, 0) * 220, y: p.y + noise2D(`gy${i}`, 0, f / 160) * 160 }, cam, 0.8);
    if (s.x < -1600 || s.x > W + 1600 || s.y < -1200 || s.y > H + 1200) return;
    const dk = darks[i];
    const c1 = hsl(hue + i * 18, 85, dk ? 58 : 66, dk ? 0.5 : 0.38);
    const c2 = hsl(hue + 50 + i * 12, 80, dk ? 55 : 72, dk ? 0.36 : 0.32);
    const w1 = 1700 * cam.z, h1 = 1100 * cam.z;
    glows.push(<Radial key={`a${i}`} w={w1} h={h1} stops={[[0, c1], [0.62, c1, 0]]} place={{ x: s.x - 420 * cam.z - w1 / 2, y: s.y - 160 * cam.z - h1 / 2 }} />);
    glows.push(<Radial key={`b${i}`} w={w1 * 0.9} h={h1} stops={[[0, c2], [0.62, c2, 0]]} place={{ x: s.x + 480 * cam.z - (w1 * 0.9) / 2, y: s.y + 220 * cam.z - h1 / 2 }} />);
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(155deg, ${bg}, ${bg2})`, overflow: "hidden" }}>
      {glows}
      {/* (the field turns with the camera: drawn twice the frame's size, turned about its middle) */}
      <div style={{ position: "absolute", left: -W / 2, top: -H / 2, width: W * 2, height: H * 2, transform: cam.rot ? `rotate(${cam.rot.toFixed(3)}deg)` : undefined }}>
        <Tiles w={W * 2} h={H * 2} kind={grid ? "grid" : "dots"} gap={gap} size={grid ? 0.8 : 1.8 * cam.z} color={hsl(hue, 40, d ? 75 : 40, d ? 0.22 : 0.18)} dx={ox} dy={oy} />
      </div>
    </AbsoluteFill>
  );
}

// The line that joins one scene to the next: drawn as the camera travels,
// its head a bright point the camera follows; the roads already travelled
// stay on the canvas.
export function Roads({ cam, st, mv, f, pals, darks, only }: { cam: Cam; st: P[]; mv: { start: number; dur: number }[]; f: number; pals: { dark: Pal; light: Pal }; darks: boolean[]; only?: boolean[] }) {
  const out: ReactNode[] = [];
  for (let i = 1; i < st.length; i++) {
    if (only && !only[i]) continue;
    const k = EASE(ramp(f, mv[i].start - 4, mv[i].dur * 0.9));
    if (k <= 0) continue;
    const [a, b, c, d] = road(st[i - 1], st[i]).map((p) => toScreen(p, cam));
    // only the stretch between the two scenes (not through them)
    const pal = darks[i] ? pals.dark : pals.light;
    const id = `road${i}`;
    out.push(
      <g key={i}>
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={d.x} y2={d.y}>
            <stop offset={0} stopColor={pal.accent} stopOpacity={0} />
            <stop offset={0.28} stopColor={pal.accent} stopOpacity={0.9} />
            <stop offset={0.72} stopColor={pal.accent2 ?? pal.accent} stopOpacity={0.9} />
            <stop offset={1} stopColor={pal.accent2 ?? pal.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`M${a.x},${a.y} C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} fill="none" stroke={`url(#${id})`} strokeWidth={Math.max(2, 5 * cam.z)} strokeLinecap="round" pathLength={1} strokeDasharray={`${k} 1`} />
      </g>,
    );
    if (k < 1) {
      const h = toScreen(bez(road(st[i - 1], st[i]), k), cam);
      const r = 10 * cam.z;
      out.push(<circle key={`h${i}`} cx={h.x} cy={h.y} r={r * 2.4} fill={pal.glow} opacity={0.35} />, <circle key={`hc${i}`} cx={h.x} cy={h.y} r={r} fill="#fff" />);
    }
  }
  return out.length ? (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {out}
    </svg>
  ) : null;
}
