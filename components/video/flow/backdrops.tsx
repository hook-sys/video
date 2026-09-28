import { AbsoluteFill } from "remotion";
import type { BackdropName } from "./backdrop-names";
import type { FlowTheme } from "./themes";
import type { Vec } from "./types";

// Procedural backdrops: a layer between the colour mesh and the elements that
// sets a scene's atmosphere. Everything is a pure function of the frame
// (deterministic for rendering) and drawn in 1920×1080 space.

const W = 1920;
const H = 1080;

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Precomputed random fields (same for every frame).
const R = rand(7);
const PARTICLES = Array.from({ length: 80 }, () => ({ x: R() * W, y: R() * H, r: 3 + R() * 5, v: 0.4 + R() * 1.2, tw: R() * 6.28, depth: 0.2 + R() * 0.8 }));
const STREAMS = Array.from({ length: 34 }, (_, i) => ({ x: 30 + (i * (W - 60)) / 33 + (R() - 0.5) * 20, v: 3 + R() * 5, off: R() * H, len: 3 + Math.floor(R() * 5) }));
const BLOBS = Array.from({ length: 5 }, (_, i) => ({ x: 200 + R() * (W - 400), y: 150 + R() * (H - 300), s: 380 + R() * 360, p: R() * 6.28, i }));

export function Backdrop({ kind, frame, theme, camera, opacity }: { kind: BackdropName; frame: number; theme: FlowTheme; camera: Vec; opacity: number }) {
  if (kind === "mesh" || opacity <= 0.001) return null;
  const c = theme.primary;
  const c2 = theme.primary2;
  const ink = theme.dark ? "255,255,255" : "30,27,75";
  const par = (k: number): Vec => [(-camera[0] * k) % 2000, (-camera[1] * k) % 2000];
  let body: React.ReactNode = null;

  switch (kind) {
    case "particles": {
      body = PARTICLES.map((p, i) => {
        const [px, py] = par(0.04 * p.depth);
        const y = (((p.y - frame * p.v + py) % (H + 40)) + H + 40) % (H + 40) - 20;
        const x = (((p.x + Math.sin(frame / 60 + p.tw) * 18 + px) % W) + W) % W;
        const a = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(frame / 18 + p.tw));
        return <circle key={i} cx={x} cy={y} r={p.r * p.depth + 1.5} fill={i % 3 ? c : c2} opacity={Math.min(1, a * (0.4 + p.depth))} />;
      });
      break;
    }
    case "dot-field": {
      const step = 48;
      const [px, py] = par(0.05);
      const wave = (frame * 9) % (W + 900);
      const dots: React.ReactNode[] = [];
      for (let y = -step; y < H + step; y += step)
        for (let x = -step; x < W + step; x += step) {
          const X = x + (((px % step) + step) % step);
          const Y = y + (((py % step) + step) % step);
          const d = Math.abs(X + Y * 0.45 - wave + 450);
          const k = Math.max(0, 1 - d / 260);
          dots.push(<circle key={`${x}.${y}`} cx={X} cy={Y} r={3.2 + k * 4.5} fill={k > 0.05 ? c : `rgb(${ink})`} opacity={0.22 + k * 0.65} />);
        }
      body = dots;
      break;
    }
    case "grid": {
      const step = 80;
      const [px, py] = par(0.08);
      const ox = ((px % step) + step) % step;
      const oy = ((py % step) + step) % step;
      body = (
        <g stroke={`rgba(${ink},0.14)`} strokeWidth={2}>
          {Array.from({ length: Math.ceil(W / step) + 2 }, (_, i) => <line key={`v${i}`} x1={i * step + ox - step} y1={0} x2={i * step + ox - step} y2={H} />)}
          {Array.from({ length: Math.ceil(H / step) + 2 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * step + oy - step} x2={W} y2={i * step + oy - step} />)}
          <rect x={0} y={0} width={W} height={H} fill="url(#bd-vignette)" stroke="none" />
        </g>
      );
      break;
    }
    case "perspective-grid": {
      // A floor from the horizon (y = 560) to the bottom, lines scrolling towards us.
      const hz = 560;
      const lines: React.ReactNode[] = [];
      for (let i = -14; i <= 14; i++) lines.push(<line key={`r${i}`} x1={W / 2 + i * 40} y1={hz} x2={W / 2 + i * 260} y2={H} />);
      const t = (frame / 45) % 1;
      for (let k = 0; k < 12; k++) {
        const z = (k + t) / 12; // 0 at the horizon … 1 at the bottom
        const y = hz + (H - hz) * z * z;
        lines.push(<line key={`h${k}`} x1={0} y1={y} x2={W} y2={y} strokeOpacity={0.15 + 0.6 * z} />);
      }
      body = (
        <g stroke={c} strokeWidth={1.6} strokeOpacity={0.35}>
          {lines}
          <rect x={0} y={hz - 140} width={W} height={220} fill="url(#bd-horizon)" stroke="none" />
        </g>
      );
      break;
    }
    case "light-beams": {
      body = [0, 1, 2, 3, 4].map((i) => {
        const x = ((i * 520 + frame * (1.6 + i * 0.3)) % (W + 1200)) - 600;
        return <polygon key={i} points={`${x},-50 ${x + 180 + i * 30},-50 ${x - 380 + i * 30},${H + 50} ${x - 560},${H + 50}`} fill="url(#bd-beam)" opacity={0.5 + 0.3 * Math.sin(frame / 40 + i)} />;
      });
      break;
    }
    case "rings": {
      body = [0, 1, 2, 3, 4, 5].map((i) => {
        const k = ((frame / 120 + i / 6) % 1);
        return <circle key={i} cx={W / 2} cy={H / 2} r={80 + k * 900} fill="none" stroke={i % 2 ? c2 : c} strokeWidth={3.5} opacity={0.55 * (1 - k)} />;
      });
      break;
    }
    case "waves": {
      body = [0, 1, 2, 3].map((i) => {
        const pts: string[] = [];
        for (let x = -20; x <= W + 20; x += 20) {
          const y = H * (0.62 + i * 0.07) + Math.sin(x / (220 + i * 40) + frame / (30 + i * 6) + i) * (40 + i * 12) + Math.sin(x / 90 + frame / 20) * 6;
          pts.push(`${x},${y.toFixed(1)}`);
        }
        return <polyline key={i} points={pts.join(" ")} fill="none" stroke={i % 2 ? c2 : c} strokeWidth={4 - i * 0.5} opacity={0.6 - i * 0.08} />;
      });
      break;
    }
    case "glow": {
      const k = 0.5 + 0.5 * Math.sin(frame / 45);
      body = (
        <>
          <circle cx={W / 2} cy={H / 2} r={520 + k * 60} fill="url(#bd-glow)" opacity={0.75 + 0.25 * k} />
          <rect x={0} y={0} width={W} height={H} fill="url(#bd-vignette)" />
        </>
      );
      break;
    }
    case "data-stream": {
      body = STREAMS.map((s, i) => {
        const y0 = ((s.off + frame * s.v) % (H + 300)) - 150;
        return (
          <g key={i} opacity={0.35 + (i % 4) * 0.12}>
            {Array.from({ length: s.len }, (_, k) => (
              <rect key={k} x={s.x} y={y0 - k * 30} width={7} height={18} rx={3.5} fill={k === 0 ? c2 : c} opacity={1 - k / s.len} />
            ))}
          </g>
        );
      });
      break;
    }
    case "blobs": {
      body = BLOBS.map((b) => {
        const x = b.x + Math.sin(frame / (70 + b.i * 13) + b.p) * 160;
        const y = b.y + Math.cos(frame / (90 + b.i * 11) + b.p) * 110;
        const rx = b.s * (1 + 0.18 * Math.sin(frame / 37 + b.p));
        const ry = b.s * (1 + 0.18 * Math.cos(frame / 41 + b.p));
        return <ellipse key={b.i} cx={x} cy={y} rx={rx / 2} ry={ry / 2} fill={b.i % 2 ? c2 : c} opacity={0.22} filter="url(#bd-soft)" transform={`rotate(${(frame / 3 + b.i * 40) % 360} ${x} ${y})`} />;
      });
      break;
    }
    case "grain": {
      body = <rect x={0} y={0} width={W} height={H} filter="url(#bd-grain)" opacity={theme.dark ? 0.14 : 0.1} />;
      break;
    }
    case "energy": {
      body = [0, 1, 2].map((i) => {
        const y0 = 220 + i * 280;
        const d = `M-100 ${y0} C ${W * 0.3} ${y0 - 260 + i * 120}, ${W * 0.6} ${y0 + 260 - i * 90}, ${W + 100} ${y0 - 40}`;
        const k = ((frame / (70 + i * 15) + i * 0.33) % 1);
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={i % 2 ? c2 : c} strokeWidth={3} opacity={0.28} />
            <path d={d} fill="none" stroke={i % 2 ? c2 : c} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray="0.22 0.78" strokeDashoffset={-k} opacity={0.85} filter="url(#bd-soft-s)" />
          </g>
        );
      });
      break;
    }
  }

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="bd-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="55%" stopColor={theme.bg[0]} stopOpacity={0} />
            <stop offset="100%" stopColor={theme.dark ? "#000" : theme.bg[1]} stopOpacity={0.55} />
          </radialGradient>
          <radialGradient id="bd-glow">
            <stop offset="0%" stopColor={c} stopOpacity={0.45} />
            <stop offset="100%" stopColor={c} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="bd-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.dark ? "#fff" : c} stopOpacity={0} />
            <stop offset="50%" stopColor={theme.dark ? "#fff" : c} stopOpacity={0.14} />
            <stop offset="100%" stopColor={theme.dark ? "#fff" : c} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="bd-horizon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.bg[0]} stopOpacity={0} />
            <stop offset="60%" stopColor={theme.bg[0]} stopOpacity={0.9} />
            <stop offset="100%" stopColor={theme.bg[0]} stopOpacity={0} />
          </linearGradient>
          <filter id="bd-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="60" />
          </filter>
          <filter id="bd-soft-s" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="bd-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 97} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        {body}
      </svg>
    </AbsoluteFill>
  );
}
