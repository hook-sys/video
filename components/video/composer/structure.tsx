import type { ReactNode } from "react";
import { Easing } from "remotion";
import type { Pal } from "./art";
import { type Cam, EASE, H, type P, W, toScreen } from "./journey";
import { clamp01, mix, ramp } from "./motion";
import type { ComposerPlan } from "./types";

// Canvas structures (a journey's kind): the scenes' places make a shape the
// viewer can read, drawn on the canvas under the scenes (on screen, like the
// roads — a canvas-sized SVG would be too big to draw).
//  timeline — the scenes are stations on one long line, numbered; the line
//             fills in as the camera goes along it;
//  map      — a mind map: the story goes round a ring, each scene joined to
//             the hub in the middle, which is the last scene (the ask);
//  tiles    — a wall of screens (drawn in film.tsx: each scene on its tile);
//  scroll   — a web page that scrolls (film.tsx).

type Move = { start: number; dur: number };
const arrivedAt = (mv: Move[], i: number) => (i ? mv[i].start + mv[i].dur : 0);

export function Structure({ kind, f, cam, st, mv, plan, pals, font }: { kind: string; f: number; cam: Cam; st: P[]; mv: Move[]; plan: ComposerPlan; pals: { dark: Pal; light: Pal }; font: string }) {
  const pal = plan.scenes[cam.seg].dark ? pals.dark : pals.light;
  if (kind === "timeline") return <Timeline f={f} cam={cam} st={st} mv={mv} pal={pal} font={font} />;
  if (kind === "map") return <MindMap f={f} cam={cam} st={st} mv={mv} pal={pal} />;
  return null;
}

// The line runs along the bottom of every scene; each scene's station is a
// numbered dot that lights up as the camera arrives.
const AXIS_Y = 492;
function Timeline({ f, cam, st, mv, pal, font }: { f: number; cam: Cam; st: P[]; mv: Move[]; pal: Pal; font: string }) {
  const n = st.length;
  const y = st[0].y + AXIS_Y;
  const a = toScreen({ x: st[0].x - 1400, y }, cam), b = toScreen({ x: st[n - 1].x + 1400, y }, cam);
  // filled up to where the camera is
  const here = toScreen({ x: cam.x, y }, cam);
  const out: ReactNode[] = [];
  // small ticks between the stations
  for (let x = st[0].x - 1400; x <= st[n - 1].x + 1400; x += 235) {
    const p = toScreen({ x, y }, cam);
    if (p.x < -40 || p.x > W + 40) continue;
    out.push(<line key={`t${x}`} x1={p.x} y1={p.y - 10 * cam.z} x2={p.x} y2={p.y + 10 * cam.z} stroke={pal.sub} strokeWidth={2.5} opacity={0.6} />);
  }
  st.forEach((s, i) => {
    const p = toScreen({ x: s.x, y }, cam);
    if (p.x < -200 || p.x > W + 200) return;
    const on = EASE(ramp(f, arrivedAt(mv, i) - 10, 18));
    const r = 17 * cam.z;
    out.push(
      <g key={`s${i}`}>
        <circle cx={p.x} cy={p.y} r={r * (2 + on * 0.8)} fill={pal.glow} opacity={0.45 * on} />
        <circle cx={p.x} cy={p.y} r={r} fill={on > 0.5 ? pal.accent : pal.bg} stroke={on > 0.5 ? "#ffffff" : pal.sub} strokeWidth={4} />
        <text x={p.x + 34 * cam.z} y={p.y - 20 * cam.z} fontFamily={font} fontSize={38 * cam.z} fontWeight={800} letterSpacing="0.08em" fill={on > 0.5 ? pal.accent : pal.sub} opacity={on > 0.5 ? 1 : 0.7}>
          {String(i + 1).padStart(2, "0")}
        </text>
      </g>,
    );
  });
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={pal.sub} strokeWidth={3} opacity={0.45} />
      <line x1={a.x} y1={a.y} x2={Math.max(a.x, here.x)} y2={here.y} stroke={pal.glow} strokeWidth={16} strokeLinecap="round" opacity={0.35} />
      <line x1={a.x} y1={a.y} x2={Math.max(a.x, here.x)} y2={here.y} stroke={pal.accent} strokeWidth={6} strokeLinecap="round" />
      {out}
    </svg>
  );
}

// The ring's scenes each send a branch to the hub as the camera reaches them;
// every scene sits in a soft outline (dashed until the camera gets there).
function MindMap({ f, cam, st, mv, pal }: { f: number; cam: Cam; st: P[]; mv: Move[]; pal: Pal }) {
  const n = st.length;
  const hub = st[n - 1];
  const out: ReactNode[] = [];
  const pad = 70;
  // where a branch leaves a scene's outline (on the way from a to b)
  const edge = (a: P, b: P) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.min((W / 2 + pad) / Math.abs(dx || 1e-6), (H / 2 + pad) / Math.abs(dy || 1e-6));
    return { x: a.x + dx * t, y: a.y + dy * t };
  };
  st.forEach((s, i) => {
    const on = EASE(ramp(f, arrivedAt(mv, i) - 14, 20));
    const c = [{ x: s.x - W / 2 - pad, y: s.y - H / 2 - pad }, { x: s.x + W / 2 + pad, y: s.y + H / 2 + pad }].map((p) => toScreen(p, cam));
    const hubBox = i === n - 1;
    out.push(<rect key={`o${i}`} x={c[0].x} y={c[0].y} width={c[1].x - c[0].x} height={c[1].y - c[0].y} rx={90 * cam.z} fill="none" stroke={on > 0.5 ? pal.accent : pal.faint} strokeWidth={hubBox ? 5 : 3} strokeDasharray={on > 0.5 ? undefined : `${18 * cam.z} ${14 * cam.z}`} opacity={on > 0.5 ? 0.55 : 0.6} />);
    if (hubBox) return;
    // the branch grows from the scene to the hub once the camera is there
    const k = EASE(ramp(f, arrivedAt(mv, i) + 6, 40));
    if (k <= 0) return;
    const a = edge(s, hub), d = edge(hub, s);
    const mid = { x: (a.x + d.x) / 2, y: (a.y + d.y) / 2 };
    const len = Math.hypot(d.x - a.x, d.y - a.y);
    const bend = { x: mid.x - ((d.y - a.y) / len) * len * 0.12, y: mid.y + ((d.x - a.x) / len) * len * 0.12 };
    const [A, B, D] = [a, bend, d].map((p) => toScreen(p, cam));
    out.push(<path key={`b${i}`} d={`M${A.x},${A.y} Q${B.x},${B.y} ${D.x},${D.y}`} fill="none" stroke={pal.accent} strokeWidth={Math.max(2, 5 * cam.z)} strokeLinecap="round" pathLength={1} strokeDasharray={`${k} 1`} opacity={0.8} />);
    if (k < 1) {
      const t = k, u = 1 - t;
      const h = { x: u * u * A.x + 2 * u * t * B.x + t * t * D.x, y: u * u * A.y + 2 * u * t * B.y + t * t * D.y };
      out.push(<circle key={`h${i}`} cx={h.x} cy={h.y} r={Math.max(4, 10 * cam.z)} fill="#ffffff" />);
    }
  });
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {out}
    </svg>
  );
}

// ── the web page that scrolls ─────────────────────────────────────────────

// The page sits in a browser window; the scroll position (page px) at f: it
// sets off quickly and settles slowly, the way a page scrolls.
export const PAGE = { k: 0.84, bar: 62 };
const SCROLL = Easing.bezier(0.35, 0, 0.12, 1);
export function scrollAt(f: number, mv: Move[]): { y: number; seg: number; raw: number } {
  let seg = 0;
  for (let i = 1; i < mv.length; i++) if (f >= mv[i].start) seg = i;
  if (!seg) return { y: 0, seg, raw: 1 };
  const raw = ramp(f, mv[seg].start, mv[seg].dur);
  return { y: mix((seg - 1) * H, seg * H, clamp01(SCROLL(raw))), seg, raw };
}
