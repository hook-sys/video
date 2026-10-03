import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { Radial, W } from "../refs/common";

// The studio: a video is one LOOK (its backgrounds, colours, type and camera)
// and one BLOCK for each part of the script (blocks/). Looks never draw
// content; blocks never choose colours — they read the look's palette.

import { type LookId, type Role, ROLES } from "./ids";
export { ROLES, type Role, type LookId };
export type Mode = "dark" | "light";

// What a block colours with.
export type Pal = {
  dark: boolean;
  ink: string; // text on the background
  sub: string; // quieter text
  accent: string; // the look's key colour
  accent2: string; // its partner (gradients)
  glow: string; // a light version of the accent (lines, rings on dark)
  panel: string; // card face
  panelInk: string;
  panelSub: string;
  line: string; // hairlines on cards
  glass: string; // frosted-pill tint
  panelDark?: boolean; // the product's cards are dark (Warm)
  panelAccent?: string; // the accent on cards when `accent` is for the field (Violet's violet part)
  panelSide?: string; // a dark card's inner panels (rows, fields)
};

export type KeyStyle = "pill" | "color" | "underline" | "gradient";
export type Camera = "push" | "drift" | "tilt" | "float";

export type Look = {
  id: LookId;
  name: string;
  // dark or light for each part (a change is a band of light, never a blend)
  mode: (r: Role) => Mode;
  pal: Record<Mode, Pal>;
  key: KeyStyle;
  camera: Camera;
  // the field behind a part: drawn for dark and light; `i` is the part's index
  field: (f: number, mode: Mode, i: number) => ReactNode;
  // how the field changes between dark and light: a rising band, or a circle
  // that grows from an edge (Violet)
  wipe?: "band" | "circle";
};

const glowPal: Pal = { dark: true, ink: "#effff8", sub: "#bff5df", accent: "#14b889", accent2: "#46f2b0", glow: "#46f2b0", panel: "#ffffff", panelInk: "#0d2a21", panelSub: "#5c7a6f", line: "#e2efe9", glass: "#bfffe6" };
const duskDark: Pal = { dark: true, ink: "#f4f0ff", sub: "#b9aecb", accent: "#7c4dff", accent2: "#c4a8ff", glow: "#c4a8ff", panel: "#ffffff", panelInk: "#1b1630", panelSub: "#8a85a0", line: "#efedf5", glass: "#d9c8ff" };
const duskLight: Pal = { dark: false, ink: "#16121f", sub: "#5d5870", accent: "#7c4dff", accent2: "#b18cff", glow: "#8b5cf6", panel: "#ffffff", panelInk: "#1b1630", panelSub: "#8a85a0", line: "#ececf4", glass: "#ffffff" };
const flyPal: Pal = { dark: false, ink: "#0f1222", sub: "#7b8099", accent: "#2563eb", accent2: "#60a5fa", glow: "#2563eb", panel: "#ffffff", panelInk: "#0f1222", panelSub: "#7b8099", line: "#e8eaf2", glass: "#ffffff" };
const connectPal: Pal = { dark: false, ink: "#14152a", sub: "#7a7d96", accent: "#3b3fd8", accent2: "#6b7bff", glow: "#3b3fd8", panel: "#ffffff", panelInk: "#14152a", panelSub: "#7a7d96", line: "#e9eaf3", glass: "#ffffff" };
const emberPal: Pal = { dark: true, ink: "#fff4ea", sub: "#e3c3ad", accent: "#ff7a3d", accent2: "#ffc26b", glow: "#ffb070", panel: "#fffaf5", panelInk: "#2a1710", panelSub: "#9a7c6c", line: "#f3e6dc", glass: "#ffd2b0" };
const paperPal: Pal = { dark: false, ink: "#1c1a17", sub: "#77706a", accent: "#ff5a3c", accent2: "#ff9a6b", glow: "#ff5a3c", panel: "#ffffff", panelInk: "#1c1a17", panelSub: "#8a837c", line: "#ece6df", glass: "#ffffff" };

const blob = (left: number, top: number, size: number, color: string, blur = 30) => (
  <div style={{ position: "absolute", left, top, width: size, height: size * 0.66, filter: `blur(${blur}px)` }}><Radial stops={[[color, 0], ["transparent", 0.65]]} /></div>
);
const pass = (f: number, color: string, speed = 2.2) => (
  <div style={{ position: "absolute", top: -200, height: 1500, width: 460, left: ((f * speed) % 2700) - 650, transform: "rotate(21deg)", background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
);

// Glow: deep green under two great arcs of light whose shape changes part
// by part; soft orbs.
const ARCS = [
  [-1180, 1240, -4],
  [-1260, 980, 5],
  [-1040, 1300, 0],
  [-1320, 1100, -6],
  [-1000, 960, 0],
  [-1200, 1200, 7],
  [-1080, 1020, -3],
  [-1120, 1180, 2],
];
function glowField(f: number, i: number) {
  const [top, bot, tilt] = ARCS[i % ARCS.length];
  const arc = (y: number, flip: boolean, op: number) => (
    <div style={{ position: "absolute", left: -600, width: W + 1200, height: 2200, top: y, borderRadius: "50%", transform: `rotate(${tilt}deg)`, borderTop: flip ? undefined : `3px solid rgba(150,255,215,${op})`, borderBottom: flip ? `3px solid rgba(150,255,215,${op})` : undefined, boxShadow: flip ? `0 40px 120px -20px rgba(70,242,176,${op * 0.6}), inset 0 -60px 160px -40px rgba(70,242,176,${op * 0.5})` : `0 -40px 120px -20px rgba(70,242,176,${op * 0.6}), inset 0 60px 160px -40px rgba(70,242,176,${op * 0.5})` }} />
  );
  return (
    <AbsoluteFill style={{ background: "#062a20", overflow: "hidden" }}>
      <Radial at={[50, 38]} r={0.8} stops={[["#0d5a43", 0], ["#0a3f30", 0.38], ["#062a20", 1]]} />
      {[0, 1, 2].map((k) => (
        <div key={k} style={{ position: "absolute", width: 900, height: 900, left: [-200, 1250, 600][k] + Math.sin(f / (70 + k * 13) + k) * 180, top: [-260, 380, 640][k] + Math.cos(f / (83 + k * 9)) * 120, filter: "blur(20px)" }}><Radial r={0.5} stops={[[`rgba(70,242,176,${[0.2, 0.16, 0.12][k]})`, 0], ["transparent", 0.65]]} /></div>
      ))}
      {arc(top + Math.sin(f / 60) * 16, false, 0.75)}
      {arc(bot - 2200 + Math.cos(f / 66) * 16, true, 0.55)}
      {pass(f, "rgba(160,255,220,0.06)")}
    </AbsoluteFill>
  );
}

// Dusk: near-black plum lit purple from below; white with a lavender glow.
function duskField(f: number, mode: Mode) {
  const lift = Math.sin(f / 45) * 40;
  const light = mode === "light";
  return (
    <AbsoluteFill style={{ background: light ? "#f7f5fb" : "#0d0612", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -300 + Math.sin(f / 70) * 160, width: W + 600, height: 900, top: 760 + lift, filter: "blur(30px)" }}><Radial at={[50, 30]} stops={[[light ? "rgba(196,168,255,0.55)" : "rgba(139,92,246,0.85)", 0], ["transparent", 0.62]]} /></div>
      {blob(500 + Math.cos(f / 60) * 300, -380, 900, light ? "rgba(196,168,255,0.25)" : "rgba(139,92,246,0.14)")}
      {!light && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "linear-gradient(90deg, transparent, rgba(110,255,200,0.5), #8b5cf6, transparent)", opacity: 0.8 }} />}
    </AbsoluteFill>
  );
}

// Fly: cool white with soft blue light and a passing sheen.
function flyField(f: number) {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #f6f8fc, #e9eef8)", overflow: "hidden" }}>
      {blob(-300 + Math.sin(f / 80) * 200, 300 + Math.cos(f / 90) * 100, 1400, "rgba(120,150,255,0.22)")}
      {blob(1000 + Math.cos(f / 70) * 180, -300, 1200, "rgba(255,255,255,0.9)", 20)}
      {pass(f, "rgba(255,255,255,0.5)", 2)}
    </AbsoluteFill>
  );
}

// Connect: soft lavender white with moving light streaks.
function connectField(f: number) {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(170deg, #f7f7fc, #ecedf8)", overflow: "hidden" }}>
      {blob(200 + Math.sin(f / 90) * 260, 500 + Math.cos(f / 70) * 80, 1500, "rgba(110,120,255,0.18)")}
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0) 0 120px, rgba(255,255,255,0.55) 160px, rgba(255,255,255,0) 220px)", backgroundPosition: `${f * 1.2}px 0`, opacity: 0.7 }} />
    </AbsoluteFill>
  );
}

// Ember (new): warm charcoal, a low sun of orange light, fine horizon lines
// drifting up, embers rising.
const EMBERS = Array.from({ length: 22 }, (_, k) => ({ x: (k * 397) % 1920, y: (k * 613) % 1080, s: 0.5 + ((k * 7) % 10) / 14, r: 2 + (k % 3) }));
function emberField(f: number, i: number) {
  const sunX = [960, 640, 1280, 900, 1100, 760, 960, 960][i % 8];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #120a07 0%, #1f120b 55%, #2b160c 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: sunX - 900 + Math.sin(f / 80) * 60, top: 640, width: 1800, height: 900, filter: "blur(24px)" }}><Radial at={[50, 30]} stops={[["rgba(255,122,61,0.75)", 0], ["rgba(255,90,40,0.18)", 0.45], ["transparent", 0.68]]} /></div>
      {Array.from({ length: 9 }, (_, k) => (
        <div key={k} style={{ position: "absolute", left: 0, right: 0, top: 700 + k * 44 - ((f * 0.6) % 44), height: 1, background: `rgba(255,170,110,${0.05 + k * 0.012})` }} />
      ))}
      {EMBERS.map((p, k) => (
        <div key={k} style={{ position: "absolute", left: p.x + Math.sin(f / 30 + k) * 12, top: ((((p.y - f * p.s * 1.4) % 1140) + 1140) % 1140) - 30, width: p.r * 2, height: p.r * 2, borderRadius: 9, background: "#ffb070", opacity: 0.25 + 0.25 * Math.sin(f / 14 + k) }} />
      ))}
    </AbsoluteFill>
  );
}

// Paper (new): warm off-white, a faint ruled grid that slides, a coral wash.
function paperField(f: number, i: number) {
  return (
    <AbsoluteFill style={{ background: "#f6f1ea", overflow: "hidden" }}>
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(60,40,20,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(60,40,20,0.05) 1px, transparent 1px)", backgroundSize: "80px 80px", backgroundPosition: `${f * 0.6}px ${f * 0.3}px` }} />
      {blob([1200, -200, 900, 300, 1300, 100, 700, 800][i % 8] + Math.sin(f / 90) * 120, [-200, 500, 600, -260, 520, 560, -200, 400][i % 8], 1300, "rgba(255,120,80,0.16)")}
      {blob(-300 + Math.cos(f / 100) * 160, 200, 1100, "rgba(255,200,150,0.18)")}
    </AbsoluteFill>
  );
}

// ── from the second set of references ─────────────────────────────────────
const pastelLight: Pal = { dark: false, ink: "#1b2233", sub: "#6b7388", accent: "#1d3f94", accent2: "#e2583e", glow: "#4f7ff0", panel: "#ffffff", panelInk: "#1b2233", panelSub: "#7d8599", line: "#eceff6", glass: "#ffffff" };
const pastelDark: Pal = { dark: true, ink: "#eef3ff", sub: "#9aa8c9", accent: "#5b8dff", accent2: "#a9c4ff", glow: "#6aa0ff", panel: "#ffffff", panelInk: "#141a2b", panelSub: "#7d8599", line: "#eceff6", glass: "#b8ccff" };
const warmPal: Pal = { dark: false, ink: "#1d1512", sub: "#7a6b63", accent: "#f0532c", accent2: "#ff9a5a", glow: "#ff6a3d", panel: "#1b1716", panelInk: "#f6eee9", panelSub: "#a3928a", line: "#2f2826", glass: "#ffffff", panelDark: true };
const violetLight: Pal = { dark: false, ink: "#1b1736", sub: "#6e6a85", accent: "#5a3ff0", accent2: "#8b78ff", glow: "#5a3ff0", panel: "#ffffff", panelInk: "#1b1736", panelSub: "#85829a", line: "#ececf3", glass: "#ffffff" };
const violetDark: Pal = { dark: true, ink: "#ffffff", sub: "#ddd6ff", accent: "#ffffff", accent2: "#cfc6ff", glow: "#ffffff", panel: "#ffffff", panelInk: "#1b1736", panelSub: "#85829a", line: "#ececf3", glass: "#ffffff", panelAccent: "#5a3ff0" };
const azureLight: Pal = { dark: false, ink: "#0f1530", sub: "#66708f", accent: "#3a64f0", accent2: "#9a5cf6", glow: "#4f7dff", panel: "#ffffff", panelInk: "#0f1530", panelSub: "#7a83a0", line: "#e9ecf5", glass: "#ffffff" };
const azureDark: Pal = { dark: true, ink: "#f2f5ff", sub: "#a9b4d6", accent: "#6f8dff", accent2: "#b98cff", glow: "#7f9cff", panel: "#ffffff", panelInk: "#0f1530", panelSub: "#7a83a0", line: "#e9ecf5", glass: "#c3cfff" };

// Pastel (Converse): white with blue and peach light in the corners, which
// move part by part; a near-black part lit by curved blue light.
const PASTEL = [[-200, 600, 1300, 300], [1200, 500, -300, -200], [900, -300, -100, 600], [-300, -200, 1300, 600]];
function pastelField(f: number, mode: Mode, i: number) {
  if (mode === "dark")
    return (
      <AbsoluteFill style={{ background: "#04060d", overflow: "hidden" }}>
        <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0, filter: "blur(2px)" }}>
          {[0, 1, 2].map((k) => (
            <path key={k} d={`M ${-200 + k * 60} ${1200 - k * 40} C ${500 + Math.sin(f / 50 + k) * 80} ${700 - k * 90}, ${700 + k * 40} ${200 + k * 60}, ${2100} ${-100 + k * 120}`} stroke={["#2f6bff", "#7aa6ff", "#1b3fd1"][k]} strokeWidth={[10, 3, 22][k]} fill="none" opacity={[0.9, 0.7, 0.35][k]} />
          ))}
        </svg>
        <div style={{ position: "absolute", left: -200, top: 500, width: 1400, height: 900, filter: "blur(40px)" }}><Radial stops={[["rgba(47,107,255,0.35)", 0], ["transparent", 0.6]]} /></div>
      </AbsoluteFill>
    );
  const [bx, by, px, py] = PASTEL[i % PASTEL.length];
  return (
    <AbsoluteFill style={{ background: "#f5f6fa", overflow: "hidden" }}>
      {blob(bx + Math.sin(f / 80) * 120, by + Math.cos(f / 90) * 60, 1500, "rgba(110,150,255,0.45)", 50)}
      {blob(px + Math.cos(f / 70) * 120, py + Math.sin(f / 85) * 60, 1300, "rgba(255,170,140,0.38)", 50)}
      {blob(700 + Math.sin(f / 100) * 200, 300, 900, "rgba(255,255,255,0.8)", 30)}
    </AbsoluteFill>
  );
}

// Warm (UrVote): bright white with soft orange light drifting at the edges.
const WARM = Array.from({ length: 6 }, (_, k) => ({ x: [-200, 1400, 300, 1500, -100, 900][k], y: [-200, -150, 700, 600, 350, 850][k], s: [900, 800, 700, 900, 600, 700][k] }));
function warmField(f: number, i: number) {
  return (
    <AbsoluteFill style={{ background: "#fffaf7", overflow: "hidden" }}>
      {WARM.map((b, k) => <div key={k}>{blob(b.x + Math.sin(f / (60 + k * 9) + i + k) * 140, b.y + Math.cos(f / (70 + k * 7) + k) * 80, b.s, `rgba(255,${130 + k * 12},${80 + k * 10},${0.32 - k * 0.025})`, 60)}</div>)}
    </AbsoluteFill>
  );
}

// Violet (Madison): flat light grey with violet half-circles at the edges,
// a different pair each part; its dark mode is the violet itself.
const DISCS = [[-260, 760, 1720, -200], [1660, 640, -320, -300], [-300, -260, 1700, 760], [1600, -280, -260, 700]];
function violetField(f: number, mode: Mode, i: number) {
  const [ax, ay, bx2, by2] = DISCS[i % DISCS.length];
  const disc = (x: number, y: number, d: number, c: string) => <div style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: 9999, background: c }} />;
  if (mode === "dark")
    return (
      <AbsoluteFill style={{ background: "#5a3ff0", overflow: "hidden" }}>
        {disc(ax + Math.sin(f / 70) * 30, ay, 620, "#6a52f5")}
        {disc(bx2, by2 + Math.cos(f / 80) * 30, 540, "#4e34e0")}
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: "#f3f3f7", overflow: "hidden" }}>
      {disc(ax + Math.sin(f / 70) * 30, ay, 560, "#5a3ff0")}
      {disc(bx2, by2 + Math.cos(f / 80) * 30, 460, "#5a3ff0")}
    </AbsoluteFill>
  );
}

// Azure (Alex): white with blue and violet light rising from the corners;
// its dark parts are deep night blue with a glow from below.
function azureField(f: number, mode: Mode, i: number) {
  if (mode === "dark")
    return (
      <AbsoluteFill style={{ background: "#03040b", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -200 + Math.sin(f / 70) * 120, top: 520, width: 2300, height: 1100, filter: "blur(30px)" }}><Radial at={[50, 60]} stops={[["rgba(58,100,240,0.85)", 0], ["rgba(120,70,240,0.35)", 0.35], ["transparent", 0.62]]} /></div>
        {Array.from({ length: 12 }, (_, k) => (
          <div key={k} style={{ position: "absolute", left: 120 + k * 150, bottom: 0, width: 40, height: 260 + 180 * Math.abs(Math.sin(f / 18 + k * 0.9)), borderRadius: 30, background: "linear-gradient(180deg, rgba(120,150,255,0), rgba(120,150,255,0.16))" }} />
        ))}
      </AbsoluteFill>
    );
  const right = i % 2 === 0;
  return (
    <AbsoluteFill style={{ background: "#fbfcff", overflow: "hidden" }}>
      {blob((right ? 1100 : -500) + Math.sin(f / 80) * 100, 520 + Math.cos(f / 90) * 50, 1500, "rgba(70,110,255,0.42)", 50)}
      {blob((right ? 1300 : -300) + Math.cos(f / 70) * 100, 700, 1100, "rgba(160,90,250,0.32)", 50)}
      {blob((right ? -400 : 1300), -400, 1000, "rgba(120,160,255,0.18)", 50)}
    </AbsoluteFill>
  );
}

// ── from the third set of references ──────────────────────────────────────
const nightPal: Pal = { dark: true, ink: "#eef2ff", sub: "#8f9bd0", accent: "#3d6bff", accent2: "#8fb0ff", glow: "#4f7dff", panel: "#0d1330", panelInk: "#e8edff", panelSub: "#8391c4", line: "#1d2858", glass: "#6d8dff", panelDark: true, panelSide: "#141c42" };
const lineLight: Pal = { dark: false, ink: "#1d1060", sub: "#5c578f", accent: "#2b0fa8", accent2: "#24c6c0", glow: "#2b0fa8", panel: "#ffffff", panelInk: "#1d1060", panelSub: "#6f6a9c", line: "#e4e2f1", glass: "#ffffff" };
const lineDark: Pal = { dark: true, ink: "#ffffff", sub: "#c9c3ff", accent: "#5ee3e0", accent2: "#f06b7c", glow: "#5ee3e0", panel: "#ffffff", panelInk: "#1d1060", panelSub: "#6f6a9c", line: "#e4e2f1", glass: "#ffffff", panelAccent: "#2b0fa8" };
const crimsonPal: Pal = { dark: true, ink: "#ffffff", sub: "#d2aeb3", accent: "#e3162d", accent2: "#ff6170", glow: "#ff2e44", panel: "#17131a", panelInk: "#ffffff", panelSub: "#a8939a", line: "#2c2329", glass: "#ff8a96", panelDark: true, panelSide: "#221b20" };

// Night (Kitaabh): near-black navy under a deep blue glow, faint rings of
// light turning slowly.
function nightField(f: number, i: number) {
  const cx = [960, 760, 1160, 960][i % 4];
  return (
    <AbsoluteFill style={{ background: "#060918", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: cx - 1300 + Math.sin(f / 80) * 80, top: 380, width: 2600, height: 1300, filter: "blur(30px)" }}><Radial at={[50, 55]} stops={[["rgba(40,80,255,0.55)", 0], ["rgba(30,50,180,0.22)", 0.3], ["transparent", 0.6]]} /></div>
      {[900, 1300, 1700].map((d, k) => (
        <div key={d} style={{ position: "absolute", left: cx - d / 2, top: 760 - d / 2 + Math.sin(f / 60 + k) * 10, width: d, height: d, borderRadius: 9999, border: `2px solid rgba(90,130,255,${0.16 - k * 0.04})` }} />
      ))}
    </AbsoluteFill>
  );
}

// Line (Assembly): flat paper white with dot grids in the corners; its dark
// mode is a flat deep indigo.
const dots = (x: number, y: number, w: number, h: number, c: string) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, backgroundImage: `linear-gradient(90deg, ${c} 3px, transparent 3px), linear-gradient(${c} 3px, transparent 3px)`, backgroundSize: "26px 26px", WebkitMaskImage: "linear-gradient(135deg, #000, transparent 70%)", maskImage: "linear-gradient(135deg, #000, transparent 70%)", opacity: 0.5 }} />
);
function lineField(f: number, mode: Mode, i: number) {
  if (mode === "dark") return <AbsoluteFill style={{ background: "#2b0fa8" }} />;
  const flip = i % 2;
  return (
    <AbsoluteFill style={{ background: "#f7f7fa", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: flip ? "scaleX(-1)" : undefined }}>
        {dots(1340 + Math.sin(f / 90) * 10, 40, 560, 220, "#9ae6e3")}
        <div style={{ transform: "rotate(180deg)", position: "absolute", left: 0, top: 820, width: 620, height: 240 }}>{dots(0, 0, 620, 240, "#9ae6e3")}</div>
      </div>
    </AbsoluteFill>
  );
}

// Crimson (FSS): black with deep red light and slow glossy red orbs.
const ORBS = Array.from({ length: 7 }, (_, k) => ({ x: (k * 331 + 120) % 1920, y: (k * 547 + 90) % 1080, s: 30 + ((k * 37) % 70) }));
function crimsonField(f: number, i: number) {
  return (
    <AbsoluteFill style={{ background: "#0c0a0c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: [-300, 500, 900, 100][i % 4] + Math.sin(f / 90) * 100, top: -500, width: 1700, height: 1500, filter: "blur(40px)" }}><Radial stops={[["rgba(190,10,30,0.55)", 0], ["rgba(120,0,20,0.22)", 0.35], ["transparent", 0.62]]} /></div>
      <div style={{ position: "absolute", left: 900, top: 500, width: 1400, height: 900, filter: "blur(40px)" }}><Radial stops={[["rgba(150,0,20,0.35)", 0], ["transparent", 0.6]]} /></div>
      {ORBS.map((o, k) => (
        <div key={k} style={{ position: "absolute", left: o.x + Math.sin(f / 70 + k) * 30, top: o.y + Math.cos(f / 80 + k) * 24, width: o.s, height: o.s, borderRadius: 999, background: "linear-gradient(150deg, rgba(255,120,130,0.5), rgba(200,10,30,0.35) 55%, rgba(80,0,10,0.2))", filter: `blur(${k % 3 ? 3 : 0}px)`, opacity: 0.55 }} />
      ))}
    </AbsoluteFill>
  );
}

const always = (m: Mode) => () => m;
export const LOOKS: Record<LookId, Look> = {
  glow: { id: "glow", name: "Glow", mode: always("dark"), pal: { dark: glowPal, light: glowPal }, key: "pill", camera: "push", field: (f, _m, i) => glowField(f, i) },
  dusk: { id: "dusk", name: "Dusk", mode: (r) => (["growth", "cta", "end"].includes(r) ? "light" : "dark"), pal: { dark: duskDark, light: duskLight }, key: "color", camera: "tilt", field: (f, m) => duskField(f, m) },
  fly: { id: "fly", name: "Fly-through", mode: always("light"), pal: { dark: flyPal, light: flyPal }, key: "color", camera: "drift", field: (f) => flyField(f) },
  connect: { id: "connect", name: "Connect", mode: always("light"), pal: { dark: connectPal, light: connectPal }, key: "color", camera: "float", field: (f) => connectField(f) },
  ember: { id: "ember", name: "Ember", mode: always("dark"), pal: { dark: emberPal, light: emberPal }, key: "gradient", camera: "drift", field: (f, _m, i) => emberField(f, i) },
  paper: { id: "paper", name: "Paper", mode: always("light"), pal: { dark: paperPal, light: paperPal }, key: "underline", camera: "push", field: (f, _m, i) => paperField(f, i) },
  pastel: { id: "pastel", name: "Pastel", mode: (r) => (r === "nomore" ? "dark" : "light"), pal: { dark: pastelDark, light: pastelLight }, key: "color", camera: "drift", field: pastelField },
  warm: { id: "warm", name: "Warm", mode: always("light"), pal: { dark: warmPal, light: warmPal }, key: "pill", camera: "push", field: (f, _m, i) => warmField(f, i) },
  violet: { id: "violet", name: "Violet", mode: (r) => (r === "reveal" || r === "growth" ? "dark" : "light"), pal: { dark: violetDark, light: violetLight }, key: "color", camera: "float", field: violetField, wipe: "circle" },
  azure: { id: "azure", name: "Azure", mode: (r) => (r === "reveal" || r === "pay" ? "dark" : "light"), pal: { dark: azureDark, light: azureLight }, key: "gradient", camera: "tilt", field: azureField },
  night: { id: "night", name: "Night", mode: always("dark"), pal: { dark: nightPal, light: nightPal }, key: "gradient", camera: "tilt", field: (f, _m, i) => nightField(f, i) },
  line: { id: "line", name: "Line", mode: (r) => (r === "trio" || r === "cta" ? "dark" : "light"), pal: { dark: lineDark, light: lineLight }, key: "color", camera: "float", field: lineField, wipe: "circle" },
  crimson: { id: "crimson", name: "Crimson", mode: always("dark"), pal: { dark: crimsonPal, light: crimsonPal }, key: "color", camera: "push", field: (f, _m, i) => crimsonField(f, i) },
};
export const LOOK_IDS = Object.keys(LOOKS) as LookId[];

// The background over the whole video: each part's field; where the mode
// changes, the new field opens out of a card (or Violet's circle).
export type Origin = { x: number; y: number; w: number; h: number; r: number } | null;
export function Backdrop({ f, look, parts, origins }: { f: number; look: Look; parts: { role: Role; from: number }[]; origins?: Origin[] }) {
  // where the field changes: from 16 frames before a cut — or, when the new
  // part's object grows out of the last one's, once it has arrived
  const w0 = (j: number) => (origins?.[j] ? parts[j].from + 12 : parts[j].from - 16);
  const dur = (j: number) => (origins?.[j] ? 28 : 36);
  const i = Math.max(0, parts.findLastIndex((_, j) => w0(j) <= f));
  const cur = look.mode(parts[i].role);
  const prev = i ? look.mode(parts[i - 1].role) : cur;
  const k = cur === prev ? 1 : interpolate(f, [w0(i), w0(i) + dur(i)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ck = k * k * (3 - 2 * k);
  let wipe: CSSProperties | undefined;
  if (k < 1 && look.wipe === "circle") {
    const clip = `circle(${Math.round(ck * 2300)}px at ${i % 2 ? 1920 : 0}px 540px)`;
    wipe = { clipPath: clip, WebkitClipPath: clip };
  } else if (k < 1) {
    // the new field opens out of the incoming object (or a point in the
    // middle) to the full frame — a clean edge, never a grey band
    const o = origins?.[i] ?? { x: 960, y: 540, w: 0, h: 0, r: 0 };
    const top = (o.y - o.h / 2) * (1 - ck);
    const left = (o.x - o.w / 2) * (1 - ck);
    const bottom = (1080 - o.y - o.h / 2) * (1 - ck);
    const right = (1920 - o.x - o.w / 2) * (1 - ck);
    const clip = `inset(${Math.round(top)}px ${Math.round(right)}px ${Math.round(bottom)}px ${Math.round(left)}px round ${Math.round(Math.max(o.r, 60 * Math.sin(ck * Math.PI)) * (1 - ck))}px)`;
    wipe = { clipPath: clip, WebkitClipPath: clip };
  }
  return (
    <AbsoluteFill>
      {k < 1 && <AbsoluteFill>{look.field(f, prev, Math.max(0, i - 1))}</AbsoluteFill>}
      <AbsoluteFill style={wipe}>{look.field(f, cur, i)}</AbsoluteFill>
    </AbsoluteFill>
  );
}
