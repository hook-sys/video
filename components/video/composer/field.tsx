import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import type { Pal } from "./art";
import { hsl } from "./art";
import type { FieldKind, Overlay } from "./types";

// The background a Composer film plays on: a kind of light (aurora, arcs,
// grid…) in the film's palette, around an anchor that each scene moves (it
// glides there between scenes), so the field changes with every scene and
// never jumps.

export type Anchor = { x: number; y: number; s: number; t: number }; // centre (px), spread (0.6–1.4), turn (0–1)

const glow = (x: number, y: number, w: number, h: number, color: string, blur = 40, at = "50% 50%", stop = 0.62): ReactNode => (
  <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, filter: `blur(${blur}px)`, background: `radial-gradient(ellipse at ${at}, ${color} 0%, transparent ${Math.round(stop * 100)}%)` }} />
);

export function Field({ f, kind, pal, hue, anchor: a, energy, overlay, style }: { f: number; kind: FieldKind; pal: Pal; hue: number; anchor: Anchor; energy: number; overlay: Overlay; style?: CSSProperties }) {
  const e = 0.6 + energy * 0.8;
  const d = pal.dark;
  const c1 = hsl(hue, 85, d ? 58 : 66, d ? 0.55 : 0.42);
  const c2 = hsl(hue + 40 + a.t * 60, 80, d ? 55 : 72, d ? 0.42 : 0.38);
  const c3 = hsl(hue - 30 - a.t * 40, 75, d ? 50 : 80, d ? 0.3 : 0.5);
  const sway = (k: number, amp = 60) => Math.sin(f / (70 + k * 11) + k) * amp * e;
  const base: CSSProperties = { background: kind === "plain" || kind === "discs" ? pal.bg : `linear-gradient(${150 + a.t * 60}deg, ${pal.bg}, ${pal.bg2})`, overflow: "hidden", ...style };
  let body: ReactNode = null;
  switch (kind) {
    case "aurora":
      body = (
        <>
          {glow(a.x - 520 * a.s + sway(1, 90), a.y - 160 + sway(2, 50), 1500 * a.s, 1000 * a.s, c1, 60)}
          {glow(a.x + 560 * a.s + sway(3, 90), a.y + 220 + sway(4, 60), 1400 * a.s, 1000 * a.s, c2, 60)}
          {glow(a.x + sway(5, 120), a.y - 520, 1200, 700, c3, 50)}
        </>
      );
      break;
    case "arcs": {
      const arc = (top: number, flip: boolean, op: number) => (
        <div style={{ position: "absolute", left: -600, width: 3120, height: 2200, top, borderRadius: "50%", transform: `rotate(${(a.t - 0.5) * 12}deg)`, [flip ? "borderBottom" : "borderTop"]: `3px solid ${hsl(hue, 90, d ? 75 : 55, op)}`, boxShadow: `0 ${flip ? 40 : -40}px 120px -20px ${hsl(hue, 90, 60, op * 0.6)}, inset 0 ${flip ? -60 : 60}px 160px -40px ${hsl(hue, 90, 60, op * 0.5)}` }} />
      );
      body = (
        <>
          {glow(a.x, a.y, 2000, 1300, c1, 50)}
          {arc(a.y - 380 - 900 * a.s * 0.2 + sway(1, 16), false, 0.7)}
          {arc(a.y + 300 - 2200 + sway(2, 16), true, 0.5)}
        </>
      );
      break;
    }
    case "grid":
      body = (
        <>
          <AbsoluteFill style={{ backgroundImage: `linear-gradient(${hsl(hue, 30, d ? 60 : 30, d ? 0.09 : 0.07)} 1.5px, transparent 1.5px), linear-gradient(90deg, ${hsl(hue, 30, d ? 60 : 30, d ? 0.09 : 0.07)} 1.5px, transparent 1.5px)`, backgroundSize: `${Math.round(70 + a.s * 30)}px ${Math.round(70 + a.s * 30)}px`, backgroundPosition: `${(f * 0.5 * e).toFixed(1)}px ${(f * 0.25 * e).toFixed(1)}px`, WebkitMaskImage: `radial-gradient(ellipse at ${Math.round((a.x / 1920) * 100)}% ${Math.round((a.y / 1080) * 100)}%, #000 10%, transparent 75%)`, maskImage: `radial-gradient(ellipse at ${Math.round((a.x / 1920) * 100)}% ${Math.round((a.y / 1080) * 100)}%, #000 10%, transparent 75%)` }} />
          {glow(a.x + sway(1), a.y + sway(2, 40), 1400 * a.s, 900 * a.s, c1, 60)}
        </>
      );
      break;
    case "dots":
      body = (
        <>
          {glow(a.x + sway(3), a.y, 1600 * a.s, 1000 * a.s, c1, 60)}
          <AbsoluteFill style={{ backgroundImage: `radial-gradient(${hsl(hue, 40, d ? 75 : 40, d ? 0.28 : 0.2)} 2px, transparent 2.5px)`, backgroundSize: "34px 34px", backgroundPosition: `${(f * 0.3).toFixed(1)}px 0px`, WebkitMaskImage: `radial-gradient(circle at ${Math.round((a.x / 1920) * 100)}% ${Math.round((a.y / 1080) * 100)}%, #000 0%, transparent ${Math.round(45 + a.s * 20)}%)`, maskImage: `radial-gradient(circle at ${Math.round((a.x / 1920) * 100)}% ${Math.round((a.y / 1080) * 100)}%, #000 0%, transparent ${Math.round(45 + a.s * 20)}%)` }} />
        </>
      );
      break;
    case "rings":
      body = (
        <>
          {glow(a.x, a.y, 1800 * a.s, 1200 * a.s, c1, 50)}
          {[500, 820, 1160, 1520, 1900].map((r, k) => (
            <div key={r} style={{ position: "absolute", left: a.x - (r * a.s) / 2, top: a.y - (r * a.s) / 2 + Math.sin(f / 50 + k) * 8, width: r * a.s, height: r * a.s, borderRadius: 9999, border: `2px solid ${hsl(hue, 70, d ? 70 : 50, (d ? 0.2 : 0.16) - k * 0.03)}` }} />
          ))}
        </>
      );
      break;
    case "beams":
      body = (
        <>
          {glow(a.x, 1080, 2400 * a.s, 1100, c1, 40, "50% 70%")}
          {Array.from({ length: 13 }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: 60 + k * 148, bottom: 0, width: 42, height: 220 + 200 * Math.abs(Math.sin(f / (20 / e) + k * 0.9 + a.t * 3)), borderRadius: 30, background: `linear-gradient(180deg, transparent, ${hsl(hue, 80, d ? 70 : 55, d ? 0.18 : 0.14)})` }} />
          ))}
        </>
      );
      break;
    case "horizon":
      body = (
        <>
          {glow(a.x + sway(1, 40), 760, 1900 * a.s, 900, hsl(hue, 90, 60, d ? 0.7 : 0.45), 30, "50% 30%")}
          {Array.from({ length: 9 }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: 0, right: 0, top: 690 + k * 46 - ((f * 0.6 * e) % 46), height: 1.5, background: hsl(hue, 80, d ? 72 : 45, 0.05 + k * 0.013) }} />
          ))}
        </>
      );
      break;
    case "discs": {
      const disc = (x: number, y: number, size: number, c: string) => <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: 9999, background: c }} />;
      const op = (k: number) => (a.x < 960 ? 1 : -1) * k;
      body = (
        <>
          {disc(a.x - 1100 * op(1) + sway(1, 20), a.y + 420, 640 * a.s, d ? hsl(hue, 60, 18) : hsl(hue, 80, 56))}
          {disc(a.x + 1000 * op(1), a.y - 460 + sway(2, 20), 520 * a.s, d ? hsl(hue + 20, 60, 14) : hsl(hue + 30, 80, 62, 0.85))}
        </>
      );
      break;
    }
    case "streaks":
      body = (
        <>
          {glow(a.x + sway(1, 120), a.y, 1700 * a.s, 1000, c1, 60)}
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(${110 + a.t * 30}deg, transparent 0 120px, ${d ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)"} 160px, transparent 220px)`, backgroundPosition: `${(f * 1.2 * e).toFixed(1)}px 0`, opacity: 0.8 }} />
        </>
      );
      break;
    case "mesh":
      body = (
        <>
          {glow(a.x - 600 + sway(1, 100), a.y - 300, 1600, 1100, c1, 70)}
          {glow(a.x + 600 + sway(2, 100), a.y - 200, 1500, 1100, c2, 70)}
          {glow(a.x + sway(3, 140), a.y + 420, 1800, 1000, c3, 70)}
        </>
      );
      break;
    case "spot":
      body = (
        <>
          {glow(a.x + sway(1, 30), a.y + sway(2, 20), 1300 * a.s, 1300 * a.s, hsl(hue, 70, d ? 60 : 80, d ? 0.45 : 0.7), 30, "50% 50%", 0.5)}
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 40%, ${d ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.05)"} 100%)` }} />
        </>
      );
      break;
    case "waves":
      body = (
        <>
          {glow(a.x, a.y + 200, 1900, 1000, c1, 60)}
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            {[0, 1, 2, 3].map((k) => {
              const y0 = a.y + 120 + k * 60;
              const ph = f / (40 - k * 4) + k + a.t * 4;
              const pts = Array.from({ length: 25 }, (_, i) => `${i * 80},${(y0 + Math.sin(ph + i * 0.35) * (40 + k * 12) * e).toFixed(1)}`).join(" L");
              return <path key={k} d={`M${pts}`} stroke={hsl(hue + k * 14, 80, d ? 70 : 50, d ? 0.3 - k * 0.05 : 0.25 - k * 0.04)} strokeWidth={3 - k * 0.5} fill="none" />;
            })}
          </svg>
        </>
      );
      break;
    default:
      body = glow(a.x, a.y, 1800, 1100, hsl(hue, 70, d ? 50 : 85, d ? 0.25 : 0.4), 60);
  }
  return (
    <AbsoluteFill style={base}>
      {body}
      <OverlayLayer f={f} kind={overlay} pal={pal} hue={hue} />
    </AbsoluteFill>
  );
}

const SPECKS = Array.from({ length: 26 }, (_, k) => ({ x: (k * 397) % 1920, y: (k * 613) % 1080, s: 0.4 + ((k * 7) % 10) / 14, r: 1.5 + (k % 3) }));
function OverlayLayer({ f, kind, pal, hue }: { f: number; kind: Overlay; pal: Pal; hue: number }) {
  if (kind === "particles")
    return (
      <AbsoluteFill>
        {SPECKS.map((p, k) => (
          <div key={k} style={{ position: "absolute", left: p.x + Math.sin(f / 30 + k) * 14, top: ((((p.y - f * p.s) % 1120) + 1120) % 1120) - 20, width: p.r * 2, height: p.r * 2, borderRadius: 9, background: hsl(hue, 80, pal.dark ? 80 : 55), opacity: 0.18 + 0.2 * Math.sin(f / 15 + k) }} />
        ))}
      </AbsoluteFill>
    );
  if (kind === "sheen") return <div style={{ position: "absolute", top: -200, height: 1500, width: 460, left: ((f * 2.2) % 2700) - 650, transform: "rotate(21deg)", background: `linear-gradient(90deg, transparent, ${pal.dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)"}, transparent)` }} />;
  if (kind === "vignette") return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 55%, ${pal.dark ? "rgba(0,0,0,0.55)" : hsl(hue, 30, 40, 0.12)} 100%)` }} />;
  if (kind === "lines") return <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, ${pal.dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)"} 0 1px, transparent 1px 6px)` }} />;
  if (kind === "grain")
    return (
      <AbsoluteFill style={{ opacity: pal.dark ? 0.09 : 0.06, mixBlendMode: pal.dark ? "screen" : "multiply" }}>
        <svg width={1920} height={1080}>
          <filter id="cgrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} />
          </filter>
          <rect width={1920} height={1080} filter="url(#cgrain)" />
        </svg>
      </AbsoluteFill>
    );
  return null;
}
