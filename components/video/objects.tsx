import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, ACCENT_2, clamp, FG, glass } from "./theme";

// Lightweight scene objects built from shapes (no extra AI images). Generic by
// design: skeleton lines and icons only, so they never state product features.

export type Dir = "left" | "right" | "up" | "down" | "depth";
const OFFSET: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], depth: [0, 0] };
const exitEase = Easing.in(Easing.cubic);

// Anticipation → action → settle: a spring with slight overshoot, sharpening from a blur.
export function entrance(frame: number, fps: number, at: number, from: Dir, dist: number): CSSProperties {
  const p = spring({ frame: frame - at, fps, config: { damping: 13, mass: 0.8 } });
  const [dx, dy] = OFFSET[from];
  const s = from === "depth" ? 0.55 + 0.45 * p : 0.82 + 0.18 * p;
  return {
    opacity: Math.min(1, p * 1.4),
    filter: `blur(${Math.max(0, 1 - p) * 10}px)`,
    transform: `translate(${dx * dist * (1 - p)}px, ${dy * dist * (1 - p)}px) scale(${s}) rotate(${(1 - p) * -6 * (dx || 1)}deg)`,
  };
}

function exitStyle(frame: number, at: number, to: Dir, dist: number): CSSProperties {
  const e = exitEase(interpolate(frame, [at, at + 14], [0, 1], clamp));
  const [dx, dy] = OFFSET[to];
  return {
    opacity: 1 - e,
    filter: `blur(${e * 8}px)`,
    transform: `translate(${dx * dist * e}px, ${dy * dist * e}px) scale(${to === "depth" ? 1 + e * 0.8 : 1 - e * 0.15})`,
  };
}

// An object placed at (x%, y%) of the frame (its centre), with entrance, idle float and optional exit.
export function Obj({
  x,
  y,
  at,
  from = "up",
  exitAt,
  exitTo = "up",
  float = 1,
  seed = 0,
  style,
  children,
}: {
  x: number;
  y: number;
  at: number;
  from?: Dir;
  exitAt?: number;
  exitTo?: Dir;
  float?: number;
  seed?: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  if (frame < at - 1) return null;
  const inS = entrance(frame, fps, at, from, base * 0.35);
  const outS = exitAt !== undefined && frame >= exitAt ? exitStyle(frame, exitAt, exitTo, base * 0.4) : null;
  if (outS && Number(outS.opacity) <= 0.01) return null;
  const bob = Math.sin((frame + seed * 37) / 26) * base * 0.008 * float;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) translateY(${bob}px)`, ...style }}>
      <div style={{ ...inS, opacity: Number(inS.opacity) * Number(outS?.opacity ?? 1), filter: [inS.filter, outS?.filter].filter(Boolean).join(" ") }}>
        <div style={{ transform: outS?.transform }}>{children}</div>
      </div>
    </div>
  );
}

const ICONS = {
  sparkle: <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" fill={FG} />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill={FG} />,
  check: <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke={FG} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  dot: <circle cx="12" cy="12" r="5" fill="none" stroke={FG} strokeWidth="2.4" />,
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" fill="none" stroke={FG} strokeWidth="2" strokeLinejoin="round" />,
};
export type IconName = keyof typeof ICONS;

// Glass chip holding a simple icon.
export function Chip({ icon, size, tint = ACCENT }: { icon: IconName; size: number; tint?: string }) {
  return (
    <div
      style={{
        ...glass,
        width: size,
        height: size,
        borderRadius: size * 0.3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${tint}55, rgba(255,255,255,0.06))`,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24">
        {ICONS[icon]}
      </svg>
    </div>
  );
}

// Generic card with skeleton content: "doc" (input), "result" (output), "panel".
export function SkeletonCard({
  w,
  variant,
  fill = 1,
  check = 0,
  glow = 0,
}: {
  w: number;
  variant: "doc" | "result" | "panel";
  fill?: number; // 0-1: how much of the content has appeared
  check?: number; // 0-1: completion badge
  glow?: number;
}) {
  const line = (width: string, i: number, color = "rgba(255,255,255,0.18)") => (
    <div
      key={i}
      style={{ height: w * 0.035, width, borderRadius: 99, background: color, transform: `scaleX(${interpolate(fill, [i * 0.15, i * 0.15 + 0.4], [0, 1], clamp)})`, transformOrigin: "left" }}
    />
  );
  return (
    <div
      style={{
        ...glass,
        position: "relative",
        width: w,
        padding: w * 0.07,
        borderRadius: w * 0.07,
        display: "flex",
        flexDirection: "column",
        gap: w * 0.045,
        background: "rgba(16,19,32,0.78)",
        boxShadow: `0 30px 80px rgba(0,0,0,.45), 0 0 ${w * 0.25 * glow}px ${ACCENT_2}`,
      }}
    >
      {variant === "result" && (
        <div
          style={{
            height: w * 0.42,
            borderRadius: w * 0.04,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2} 60%, #ff8ad8)`,
            opacity: 0.35 + 0.65 * fill,
          }}
        />
      )}
      {variant === "doc" && (
        <div style={{ display: "flex", gap: w * 0.03 }}>
          {[ACCENT, ACCENT_2].map((c) => (
            <div key={c} style={{ width: w * 0.06, height: w * 0.06, borderRadius: 99, background: c }} />
          ))}
        </div>
      )}
      {variant === "panel" && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: w * 0.03, height: w * 0.22 }}>
          {[0.5, 0.8, 0.6, 1, 0.75].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h * 100 * interpolate(fill, [i * 0.1, i * 0.1 + 0.5], [0, 1], clamp)}%`, borderRadius: w * 0.015, background: `linear-gradient(180deg, ${ACCENT_2}, ${ACCENT})` }} />
          ))}
        </div>
      )}
      {line("85%", 0)}
      {line("65%", 1)}
      {variant !== "result" && line("75%", 2)}
      {check > 0.01 && (
        <div
          style={{
            position: "absolute",
            right: -w * 0.07,
            top: -w * 0.07,
            width: w * 0.2,
            height: w * 0.2,
            borderRadius: 99,
            background: "linear-gradient(135deg, #34d399, #6d8cff)",
            boxShadow: "0 8px 24px rgba(52,211,153,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${check})`,
          }}
        >
          <svg width="60%" height="60%" viewBox="0 0 24 24">
            {ICONS.check}
          </svg>
        </div>
      )}
    </div>
  );
}

// Processing "core": rotating rings, a progress arc and a pulsing centre.
export function Core({ size, progress, frame }: { size: number; progress: number; frame: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <div style={{ position: "absolute", inset: "-25%", borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT_2}55, transparent 65%)`, opacity: 0.6 + 0.4 * pulse }} />
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0 }}>
        <circle cx="50" cy="50" r={r} fill="rgba(14,17,30,.85)" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#coreGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`}
          transform="rotate(-90 50 50)"
        />
        <circle cx="50" cy="50" r="32" fill="none" stroke={`${ACCENT}66`} strokeWidth="1.5" strokeDasharray="4 7" transform={`rotate(${frame * 3} 50 50)`} />
        <circle cx="50" cy="50" r="24" fill="none" stroke={`${ACCENT_2}88`} strokeWidth="1.5" strokeDasharray="10 12" transform={`rotate(${-frame * 5} 50 50)`} />
        <defs>
          <linearGradient id="coreGrad" x1="0" x2="1">
            <stop offset="0" stopColor={ACCENT} />
            <stop offset="1" stopColor={ACCENT_2} />
          </linearGradient>
        </defs>
      </svg>
      <svg width={size * 0.26} height={size * 0.26} viewBox="0 0 24 24" style={{ position: "absolute", left: "37%", top: "37%", transform: `scale(${0.9 + 0.15 * pulse}) rotate(${frame * 2}deg)` }}>
        {ICONS.sparkle}
      </svg>
    </div>
  );
}

// Stable pseudo-random value in [0, 1) per input.
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// Deterministic particle field. With `into`, particles stream into a point
// (e.g. the processing core) between `from` and `to` frames and are absorbed.
export function Particles({
  n,
  seed,
  size,
  into,
  color = ACCENT,
}: {
  n: number;
  seed: number;
  size: number;
  into?: { x: number; y: number; from: number; to: number };
  color?: string;
}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: n }, (_, i) => {
        const rnd = (k: number) => hash(seed * 131 + i * 17 + k);
        const x0 = rnd(1) * 100;
        const y0 = rnd(2) * 100;
        const sz = size * (0.4 + rnd(3) * 0.8);
        const drift = (frame * (0.03 + rnd(4) * 0.05)) % 12;
        let x = x0 + Math.sin((frame + i * 20) / 40) * 1.5;
        let y = y0 - drift;
        let o = 0.35 + 0.4 * rnd(5);
        if (into) {
          const start = into.from + (i / n) * (into.to - into.from) * 0.6;
          const p = Easing.in(Easing.quad)(interpolate(frame, [start, start + 18], [0, 1], clamp));
          x += (into.x - x) * p;
          y += (into.y - y) * p;
          o *= 1 - p * p;
        }
        return (
          <div
            key={i}
            style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: sz, height: sz, borderRadius: 99, background: color, opacity: o, boxShadow: `0 0 ${sz * 2}px ${color}` }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

// Expanding ring at (x%, y%) when something appears.
export function Burst({ x, y, at, size }: { x: number; y: number; at: number; size: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame - at, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (frame < at || p >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: `3px solid ${ACCENT_2}`,
        opacity: 1 - p,
        transform: `scale(${0.3 + p * 1.2})`,
      }}
    />
  );
}
