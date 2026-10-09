import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { noise2D } from "@remotion/noise";
import type { Pal } from "./art";
import { hsl } from "./art";
import { clamp01, mix, ramp } from "./motion";
import { Radial, Tiles } from "./radial";
import type { ComposerPlan, JourneyKind } from "./types";

// Journey: the whole film is one big canvas. Every scene has its own place on
// it; between scenes the camera travels there (along a line it draws as it
// goes) instead of one scene giving way to the next. The background belongs
// to the canvas, so it streams past while the camera moves.

type P = { x: number; y: number };
export const W = 1920;
export const H = 1080;
const STEP_X = 2350;
const STEP_Y = 1450;

// The scenes' places on the canvas.
export function stations(n: number, kind: JourneyKind, seed: number): P[] {
  const j = (i: number, k: string, amp: number) => noise2D(`${k}${seed}`, i * 0.9, 0.3) * amp;
  return Array.from({ length: n }, (_, i) => {
    switch (kind) {
      case "down": return { x: j(i, "dx", 520), y: i * STEP_Y };
      case "diagonal": return { x: i * STEP_X * 0.86, y: i * STEP_Y * 0.72 + j(i, "dy", 160) };
      case "zigzag": return { x: i * STEP_X * 0.92, y: (i % 2) * STEP_Y * 0.95 };
      case "snake": {
        // rows of three: right, down, back left, down…
        const row = Math.floor(i / 3), col = i % 3;
        return { x: (row % 2 ? 2 - col : col) * STEP_X, y: row * STEP_Y };
      }
      default: return { x: i * STEP_X, y: j(i, "dy", 260) };
    }
  });
}

// When the camera travels into each scene (frames): it leaves a little before
// the scene's words start and arrives just after.
export const MOVE = 60;
export function moves(plan: ComposerPlan): { start: number; dur: number }[] {
  const sc = plan.scenes;
  return sc.map((s, i) => {
    if (!i) return { start: -1, dur: 1 };
    const room = s.from - sc[i - 1].from - 16;
    const dur = Math.max(24, Math.min(MOVE, room));
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
function road(a: P, b: P): [P, P, P, P] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bend = len * 0.16;
  return [a, { x: a.x + dx * 0.35 + nx * bend, y: a.y + dy * 0.35 + ny * bend }, { x: a.x + dx * 0.65 - nx * bend, y: a.y + dy * 0.65 - ny * bend }, b];
}
const bez = ([a, b, c, d]: [P, P, P, P], t: number): P => {
  const u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y };
};
// ease in and out, a little longer at both ends than the middle
const EASE = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Cam = { x: number; y: number; z: number; rot: number; seg: number; k: number; speed: number };

// Where the camera is at frame f (on the canvas), how far out it has pulled,
// and which stretch of road it is on.
export function cameraAt(f: number, st: P[], mv: { start: number; dur: number }[]): Cam {
  let seg = 0;
  for (let i = 1; i < st.length; i++) if (f >= mv[i].start) seg = i;
  const raw = seg ? ramp(f, mv[seg].start, mv[seg].dur) : 1;
  const k = EASE(raw);
  if (!seg || raw >= 1) {
    const p = st[seg];
    return { x: p.x, y: p.y, z: 1, rot: 0, seg, k: 1, speed: 0 };
  }
  const a = st[seg - 1], b = st[seg];
  const p = bez(road(a, b), k);
  const p2 = bez(road(a, b), EASE(ramp(f + 1, mv[seg].start, mv[seg].dur)));
  // it pulls out on the way (the further, the more) and leans into the turn
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const z = 1 - Math.sin(raw * Math.PI) * Math.min(0.46, 0.2 + dist / 7000);
  const rot = Math.sin(raw * Math.PI) * Math.sign(b.x - a.x || 1) * (b.y >= a.y ? 1.4 : -1.4);
  return { x: p.x, y: p.y, z, rot, seg, k, speed: Math.hypot(p2.x - p.x, p2.y - p.y) };
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
      <Tiles w={W} h={H} kind={grid ? "grid" : "dots"} gap={gap} size={grid ? 0.8 : 1.8 * cam.z} color={hsl(hue, 40, d ? 75 : 40, d ? 0.22 : 0.18)} dx={ox} dy={oy} />
    </AbsoluteFill>
  );
}

// The line that joins one scene to the next: drawn as the camera travels,
// its head a bright point the camera follows; the roads already travelled
// stay on the canvas.
export function Roads({ cam, st, mv, f, pals, darks }: { cam: Cam; st: P[]; mv: { start: number; dur: number }[]; f: number; pals: { dark: Pal; light: Pal }; darks: boolean[] }) {
  const out: ReactNode[] = [];
  for (let i = 1; i < st.length; i++) {
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
