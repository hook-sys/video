import type { ReactNode } from "react";
import { AbsoluteFill, interpolateColors } from "remotion";
import { ramp, sec } from "./motion-patterns";
import type { AreaTrack, RenderTimeline } from "./timeline";

// World treatments: each area kind has its own look, placed in world space
// where the area is, and lit while the story is there. The camera moves
// through them; nothing is a per-scene background.

export type Cam = { x: number; y: number; z: number };

export function CameraSpace({ cam, width, height, parallax = 1, children }: { cam: Cam; width: number; height: number; parallax?: number; children: ReactNode }) {
  const s = Math.pow(cam.z, parallax);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${width / 2 - cam.x * parallax * s}px, ${height / 2 - cam.y * parallax * s}px) scale(${s})` }}>
      {children}
    </div>
  );
}

const blob = (key: string, x: number, y: number, r: number, color: string, opacity: number) =>
  opacity > 0.01 ? <div key={key} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, opacity }} /> : null;

// Warm/cool light sources per area kind (far layer).
const SOURCES: Record<string, [string, string]> = {
  chaos: ["#ff4d6d", "#ff9f43"],
  convergence: ["#7c3aed", "#8fa2ff"],
  workspace: ["#3b5bff", "#7c3aed"],
  product_ui: ["#3b5bff", "#06b6d4"],
  data: ["#22c55e", "#3b82f6"],
  neutral: ["#6366f1", "#0ea5e9"],
  hero: ["#a5b4fc", "#f0abfc"],
};

// How present an area's treatment is: lights up as the story approaches,
// dims (not to zero) once it has moved on.
function presence(a: AreaTrack, frame: number, calm: number) {
  const on = a.lit <= 1 ? 1 : ramp(frame, a.lit - sec(0.6), sec(1.6));
  const off = a.kind === "chaos" || a.kind === "convergence" ? 0.75 * ramp(frame, a.leave + sec(0.2), sec(2.2)) : 0;
  return on * (1 - off) * (1 - calm * (a.kind === "hero" ? 0 : 0.8));
}

function Treatment({ a, p, frame }: { a: AreaTrack; p: number; frame: number }) {
  const { x, y } = a.rect;
  switch (a.kind) {
    case "chaos":
      return (
        <>
          <div style={{ position: "absolute", left: x - 1600, top: y - 850, width: 3200, height: 1700, backgroundImage: "radial-gradient(rgba(255,170,150,0.28) 2.2px, transparent 2.6px)", backgroundSize: "44px 44px", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 30%, transparent 75%)", opacity: p }} />
          {blob("c", x, y, 1000, "#ff5470", 0.3 * p)}
        </>
      );
    case "convergence": {
      if (!a.from || !a.to) return null;
      const draw = ramp(frame, a.enter - sec(0.1), sec(1.6));
      const fade = 1 - ramp(frame, a.leave + sec(1.2), sec(1));
      const x0 = a.from.x + 300;
      const x1 = a.to.x - 800;
      return (
        <svg width={Math.max(10, x1 - x0 + 400)} height={2000} viewBox={`0 0 ${Math.max(10, x1 - x0 + 400)} 2000`} style={{ position: "absolute", left: x0 - 200, top: y - 1000, opacity: fade }}>
          <defs>
            <linearGradient id={`flow-${a.id}`} x1="0" x2="1">
              <stop offset="0" stopColor="#ff7a8a" stopOpacity="0" />
              <stop offset="0.5" stopColor="#8fa2ff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#8fa2ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[-360, -220, -90, 40, 170, 300, 430].map((dy, i) => {
            const L = x1 - x0;
            return (
              <path key={i} d={`M 200 ${1000 + dy * 1.6} C ${200 + L * 0.45} ${1000 + dy * 1.4}, ${200 + L * 0.7} ${1000 + dy * 0.6}, ${200 + L} ${1000 + dy * 0.25}`} fill="none" stroke={`url(#flow-${a.id})`} strokeWidth={i % 2 ? 3 : 5} strokeDasharray={L * 1.3} strokeDashoffset={L * 1.3 * (1 - Math.min(1, draw * 1.2 - i * 0.03))} />
            );
          })}
        </svg>
      );
    }
    case "workspace":
    case "product_ui":
      return (
        <>
          <div style={{ position: "absolute", left: x - 1600, top: y - 1100, width: 3200, height: 2200, backgroundImage: "linear-gradient(rgba(140,160,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(140,160,255,0.12) 1px, transparent 1px)", backgroundSize: "80px 80px", WebkitMaskImage: "radial-gradient(ellipse 45% 45% at 50% 50%, #000 35%, transparent 80%)", opacity: p }} />
          {blob("f", x, y + 560, 1100, a.kind === "workspace" ? "#4f6bff" : "#06b6d4", 0.45 * p)}
        </>
      );
    case "data":
      return (
        <>
          <div style={{ position: "absolute", left: x - 1400, top: y - 900, width: 2800, height: 1800, backgroundImage: "linear-gradient(0deg, rgba(34,197,94,0.14) 1px, transparent 1px)", backgroundSize: "100% 90px", WebkitMaskImage: "radial-gradient(ellipse 45% 45% at 50% 50%, #000 30%, transparent 80%)", opacity: p }} />
          {blob("d", x, y, 1000, "#22c55e", 0.35 * p)}
        </>
      );
    case "hero": {
      const open = ramp(frame, a.enter - sec(0.3), sec(1.6));
      return <div style={{ position: "absolute", left: x - 5000 * open, top: y - 5000 * open, width: 10000 * open, height: 10000 * open, borderRadius: "50%", background: "radial-gradient(circle, #ffffff 0%, #f3f2ff 35%, #e9ecff 55%, transparent 70%)", opacity: open }} />;
    }
    default:
      return <>{blob("n", x, y, 1000, "#6366f1", 0.3 * p)}</>;
  }
}

export function WorldBackdrop({ tl, frame, cam, glows }: { tl: RenderTimeline; frame: number; cam: Cam; glows: { x: number; y: number; k: number }[] }) {
  const keys = tl.lighting.length > 1 ? tl.lighting : [...tl.lighting, { frame: tl.durationInFrames, color: tl.lighting[0]?.color ?? "#11142a" }];
  const base = interpolateColors(frame, keys.map((k) => k.frame), keys.map((k) => k.color));
  const hero = tl.areas.find((a) => a.kind === "hero");
  const calm = hero ? ramp(frame, hero.enter - sec(0.2), sec(1.4)) : 0;
  const { width: W, height: H } = tl;
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <CameraSpace cam={cam} width={W} height={H} parallax={0.45}>
        <div style={{ opacity: 1 - calm * 0.8 }}>
          {tl.areas.filter((a) => !a.colocated).flatMap((a) => {
            const p = presence(a, frame, 0);
            const [c1, c2] = SOURCES[a.kind] ?? SOURCES.neutral;
            return [blob(`${a.id}1`, a.rect.x * 0.45 - 450, 380, 700, c1, 0.33 * p), blob(`${a.id}2`, a.rect.x * 0.45 + 50, 850, 620, c2, 0.24 * p)];
          })}
        </div>
      </CameraSpace>
      <CameraSpace cam={cam} width={W} height={H}>
        {tl.areas.map((a) => (
          <Treatment key={a.id} a={a} p={presence(a, frame, calm)} frame={frame} />
        ))}
        {/* results light their surroundings (e.g. a progress panel building) */}
        {glows.map((g, i) => blob(`g${i}`, g.x, g.y, 900, "#22c55e", 0.4 * g.k * (1 - calm * 0.5)))}
      </CameraSpace>
    </AbsoluteFill>
  );
}
