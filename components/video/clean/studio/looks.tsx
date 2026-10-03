import type { ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { W } from "../refs/common";

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
};

const glowPal: Pal = { dark: true, ink: "#effff8", sub: "#bff5df", accent: "#14b889", accent2: "#46f2b0", glow: "#46f2b0", panel: "#ffffff", panelInk: "#0d2a21", panelSub: "#5c7a6f", line: "#e2efe9", glass: "#bfffe6" };
const duskDark: Pal = { dark: true, ink: "#f4f0ff", sub: "#b9aecb", accent: "#7c4dff", accent2: "#c4a8ff", glow: "#c4a8ff", panel: "#ffffff", panelInk: "#1b1630", panelSub: "#8a85a0", line: "#efedf5", glass: "#d9c8ff" };
const duskLight: Pal = { dark: false, ink: "#16121f", sub: "#5d5870", accent: "#7c4dff", accent2: "#b18cff", glow: "#8b5cf6", panel: "#ffffff", panelInk: "#1b1630", panelSub: "#8a85a0", line: "#ececf4", glass: "#ffffff" };
const flyPal: Pal = { dark: false, ink: "#0f1222", sub: "#7b8099", accent: "#2563eb", accent2: "#60a5fa", glow: "#2563eb", panel: "#ffffff", panelInk: "#0f1222", panelSub: "#7b8099", line: "#e8eaf2", glass: "#ffffff" };
const connectPal: Pal = { dark: false, ink: "#14152a", sub: "#7a7d96", accent: "#3b3fd8", accent2: "#6b7bff", glow: "#3b3fd8", panel: "#ffffff", panelInk: "#14152a", panelSub: "#7a7d96", line: "#e9eaf3", glass: "#ffffff" };
const emberPal: Pal = { dark: true, ink: "#fff4ea", sub: "#e3c3ad", accent: "#ff7a3d", accent2: "#ffc26b", glow: "#ffb070", panel: "#fffaf5", panelInk: "#2a1710", panelSub: "#9a7c6c", line: "#f3e6dc", glass: "#ffd2b0" };
const paperPal: Pal = { dark: false, ink: "#1c1a17", sub: "#77706a", accent: "#ff5a3c", accent2: "#ff9a6b", glow: "#ff5a3c", panel: "#ffffff", panelInk: "#1c1a17", panelSub: "#8a837c", line: "#ece6df", glass: "#ffffff" };

const blob = (left: number, top: number, size: number, color: string, blur = 30) => (
  <div style={{ position: "absolute", left, top, width: size, height: size * 0.66, borderRadius: "50%", background: `radial-gradient(ellipse, ${color}, transparent 65%)`, filter: `blur(${blur}px)` }} />
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
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 38%, #0d5a43 0%, #0a3f30 38%, #062a20 100%)", overflow: "hidden" }}>
      {[0, 1, 2].map((k) => (
        <div key={k} style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, left: [-200, 1250, 600][k] + Math.sin(f / (70 + k * 13) + k) * 180, top: [-260, 380, 640][k] + Math.cos(f / (83 + k * 9)) * 120, background: `radial-gradient(circle, rgba(70,242,176,${[0.2, 0.16, 0.12][k]}), transparent 65%)`, filter: "blur(20px)" }} />
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
      <div style={{ position: "absolute", left: -300 + Math.sin(f / 70) * 160, width: W + 600, height: 900, top: 760 + lift, borderRadius: "50%", background: `radial-gradient(ellipse at 50% 30%, ${light ? "rgba(196,168,255,0.55)" : "rgba(139,92,246,0.85)"}, transparent 62%)`, filter: "blur(30px)" }} />
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
      <div style={{ position: "absolute", left: sunX - 900 + Math.sin(f / 80) * 60, top: 640, width: 1800, height: 900, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 30%, rgba(255,122,61,0.75), rgba(255,90,40,0.18) 45%, transparent 68%)", filter: "blur(24px)" }} />
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

const always = (m: Mode) => () => m;
export const LOOKS: Record<LookId, Look> = {
  glow: { id: "glow", name: "Glow", mode: always("dark"), pal: { dark: glowPal, light: glowPal }, key: "pill", camera: "push", field: (f, _m, i) => glowField(f, i) },
  dusk: { id: "dusk", name: "Dusk", mode: (r) => (["growth", "cta", "end"].includes(r) ? "light" : "dark"), pal: { dark: duskDark, light: duskLight }, key: "color", camera: "tilt", field: (f, m) => duskField(f, m) },
  fly: { id: "fly", name: "Fly-through", mode: always("light"), pal: { dark: flyPal, light: flyPal }, key: "color", camera: "drift", field: (f) => flyField(f) },
  connect: { id: "connect", name: "Connect", mode: always("light"), pal: { dark: connectPal, light: connectPal }, key: "color", camera: "float", field: (f) => connectField(f) },
  ember: { id: "ember", name: "Ember", mode: always("dark"), pal: { dark: emberPal, light: emberPal }, key: "gradient", camera: "drift", field: (f, _m, i) => emberField(f, i) },
  paper: { id: "paper", name: "Paper", mode: always("light"), pal: { dark: paperPal, light: paperPal }, key: "underline", camera: "push", field: (f, _m, i) => paperField(f, i) },
};
export const LOOK_IDS = Object.keys(LOOKS) as LookId[];

// The background over the whole video: each part's field; where the mode
// changes, the new field rises as a soft band (linear, so it never flashes).
export function Backdrop({ f, look, parts }: { f: number; look: Look; parts: { role: Role; from: number }[] }) {
  const i = Math.max(0, parts.findLastIndex((p) => p.from <= f + 16));
  const cur = look.mode(parts[i].role);
  const prev = i ? look.mode(parts[i - 1].role) : cur;
  const k = cur === prev ? 1 : interpolate(f, [parts[i].from - 16, parts[i].from + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = k * 1400 - 320;
  const mask = `linear-gradient(to top, #000 ${y}px, transparent ${y + 320}px)`;
  return (
    <AbsoluteFill>
      {k < 1 && <AbsoluteFill>{look.field(f, prev, Math.max(0, i - 1))}</AbsoluteFill>}
      <AbsoluteFill style={k < 1 ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>{look.field(f, cur, i)}</AbsoluteFill>
    </AbsoluteFill>
  );
}
