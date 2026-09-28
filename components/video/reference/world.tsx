import type { ReactNode } from "react";
import { AbsoluteFill, interpolateColors } from "remotion";
import { ramp, sec } from "./motion-patterns";
import { BEAT, HEIGHT, WIDTH, WS } from "./plan";

// The world the camera travels through. Areas are placed in world space
// (chaos on the left, the workspace on the right) and the lighting changes
// with the story; nothing is a per-scene background.

export type Cam = { x: number; y: number; z: number };

// A layer that follows the camera. parallax < 1 moves slower (farther away).
export function CameraSpace({ cam, parallax = 1, children }: { cam: Cam; parallax?: number; children: ReactNode }) {
  const s = Math.pow(cam.z, parallax);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformOrigin: "0 0",
        transform: `translate(${WIDTH / 2 - cam.x * parallax * s}px, ${HEIGHT / 2 - cam.y * parallax * s}px) scale(${s})`,
      }}
    >
      {children}
    </div>
  );
}

const blob = (x: number, y: number, r: number, color: string, opacity: number) => (
  <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, opacity }} />
);

// Base lighting over the story: warm chaos → cool convergence → clean
// workspace → green-lit progress → bright clarity.
export function baseColor(frame: number) {
  return interpolateColors(
    frame,
    [0, BEAT.converge, BEAT.organize, BEAT.progress, BEAT.clarity, BEAT.clarity + sec(1.2)],
    ["#1d0b1c", "#170c24", "#0b1330", "#0a1a2e", "#0d1c30", "#eef0fa"],
  );
}

export function WorldBackdrop({ frame, cam }: { frame: number; cam: Cam }) {
  const calm = ramp(frame, BEAT.clarity - sec(0.2), sec(1.4));
  const chaosLight = 1 - 0.75 * ramp(frame, BEAT.converge + sec(0.6), sec(2.4));
  const flow = ramp(frame, BEAT.converge - sec(0.1), sec(1.6));
  const flowFade = 1 - ramp(frame, BEAT.organize + sec(0.4), sec(1));
  const studio = ramp(frame, BEAT.workspaceIn, sec(2.2));
  const progressLight = ramp(frame, BEAT.progress, sec(2));
  const clarity = ramp(frame, BEAT.clarity - sec(0.3), sec(1.6));
  return (
    <AbsoluteFill style={{ background: baseColor(frame), overflow: "hidden" }}>
      {/* far layer: large soft light sources, slow parallax for depth */}
      <CameraSpace cam={cam} parallax={0.45}>
        <div style={{ opacity: 1 - calm * 0.8 }}>
          {blob(300, 380, 700, "#ff4d6d", 0.35 * chaosLight)}
          {blob(700, 900, 600, "#ff9f43", 0.22 * chaosLight)}
          {blob(1250, 300, 650, "#7c3aed", 0.3)}
          {blob(1500, 820, 700, "#3b5bff", 0.28 * studio)}
          {blob(1700, 350, 520, "#22c55e", 0.3 * progressLight)}
        </div>
      </CameraSpace>

      {/* near layer: the areas themselves, in world space */}
      <CameraSpace cam={cam}>
        {/* CHAOS: warm, busy dot field */}
        <div
          style={{
            position: "absolute",
            left: -700,
            top: 150,
            width: 2900,
            height: 1700,
            backgroundImage: "radial-gradient(rgba(255,170,150,0.28) 2.2px, transparent 2.6px)",
            backgroundSize: "44px 44px",
            WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 30%, transparent 75%)",
            opacity: chaosLight,
          }}
        />
        {blob(900, 1000, 1000, "#ff5470", 0.3 * chaosLight)}

        {/* CONVERGENCE: flow lines drawn from the chaos toward the workspace */}
        <svg width={3200} height={2000} viewBox="0 0 3200 2000" style={{ position: "absolute", left: 600, top: 0, opacity: flowFade }}>
          <defs>
            <linearGradient id="flow" x1="0" x2="1">
              <stop offset="0" stopColor="#ff7a8a" stopOpacity="0" />
              <stop offset="0.5" stopColor="#8fa2ff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#8fa2ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[-360, -220, -90, 40, 170, 300, 430].map((dy, i) => (
            <path
              key={i}
              d={`M 300 ${1000 + dy * 1.6} C 900 ${1000 + dy * 1.4}, 1300 ${1000 + dy * 0.6}, 1650 ${1000 + dy * 0.25}`}
              fill="none"
              stroke="url(#flow)"
              strokeWidth={i % 2 ? 3 : 5}
              strokeDasharray={1600}
              strokeDashoffset={1600 * (1 - Math.min(1, flow * 1.2 - i * 0.03))}
            />
          ))}
        </svg>

        {/* WORKSPACE: a clean studio — cool floor light and a fine grid */}
        <div
          style={{
            position: "absolute",
            left: WS.x - 1600,
            top: WS.y - 1100,
            width: 3200,
            height: 2200,
            backgroundImage: "linear-gradient(rgba(140,160,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(140,160,255,0.12) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            WebkitMaskImage: "radial-gradient(ellipse 45% 45% at 50% 50%, #000 35%, transparent 80%)",
            opacity: studio * (1 - calm),
          }}
        />
        {blob(WS.x, WS.y + 560, 1100, "#4f6bff", 0.45 * studio * (1 - calm * 0.6))}

        {/* PROGRESS: green light spilling from the results panel */}
        {blob(WS.x + 580, WS.y - 100, 900, "#22c55e", 0.4 * progressLight * (1 - calm * 0.5))}

        {/* CLARITY: light opens up from the workspace and fills the world */}
        <div
          style={{
            position: "absolute",
            left: WS.x - 5000 * clarity,
            top: WS.y - 5000 * clarity,
            width: 10000 * clarity,
            height: 10000 * clarity,
            borderRadius: "50%",
            background: "radial-gradient(circle, #ffffff 0%, #f3f2ff 35%, #e9ecff 55%, transparent 70%)",
            opacity: clarity,
          }}
        />
      </CameraSpace>
    </AbsoluteFill>
  );
}
