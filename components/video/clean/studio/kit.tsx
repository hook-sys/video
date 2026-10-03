import type { CSSProperties, ReactNode } from "react";
import type { FilmContent } from "../content";
import type { Beats, Lines, Moments } from "../refs/beats";
import { type AppTone, Words } from "../refs/common";
import type { KWord } from "../text";
import type { Look, Pal, Role } from "./looks";

// What a block is given: the frame, its part's span, the look and palette,
// the script's moments and lines, the product's card content.
export type BlockCtx = { f: number; from: number; to: number; role: Role; look: Look; pal: Pal; b: Beats; T: Moments; L: Lines; C: FilmContent };
// A block's main object (centre, size, corner radius, how it is filled):
// where it stands when the part opens (`a`) and when it closes (`z`). Between
// two parts the one becomes the other (film.tsx) instead of a cut.
export type Box = { x: number; y: number; w: number; h: number; r: number; fill: "card" | "accent" | "glass" | "dark" | "white" };
export const box = (x: number, y: number, w: number, h: number, r: number, fill: Box["fill"] = "card"): Box => ({ x, y, w, h, r, fill });
export type Block = {
  id: string;
  role: Role;
  name: string;
  // where the design came from (a reference film, or new)
  from: string;
  draw: (c: BlockCtx) => ReactNode;
  obj?: (c: BlockCtx) => { a?: Box; z?: Box };
};

// The keyword in the look's way: a pill, a colour, a marker or a gradient.
export function keyStyle(look: Look, pal: Pal) {
  return (_w: KWord, k: number): CSSProperties => {
    if (look.key === "pill") return { color: pal.dark ? "#04261b" : "#fff", padding: "0 0.28em", margin: "0 0.08em", borderRadius: 14, background: pal.dark ? `${pal.glow}${Math.round(0x66 + 0x99 * k).toString(16)}` : pal.accent, boxShadow: pal.dark ? `0 0 ${40 * k}px ${pal.glow}99` : undefined };
    if (look.key === "gradient") return { backgroundImage: `linear-gradient(100deg, ${pal.accent}, ${pal.accent2})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
    if (look.key === "underline") return { color: pal.ink, backgroundImage: `linear-gradient(transparent 62%, ${pal.accent}55 62%)`, backgroundSize: `${k * 100}% 100%`, backgroundRepeat: "no-repeat" };
    return { color: pal.accent };
  };
}

// Spoken words in the look's type.
export function Say({ c, words, size, weight = 600, align, ink, style, from }: { c: BlockCtx; words: KWord[]; size: number; weight?: number; align?: "left" | "center"; ink?: string; style?: CSSProperties; from?: "blur" | "up" | "right" }) {
  return <Words f={c.f} words={words} from={from} style={style} s={{ size, ink: ink ?? c.pal.ink, weight, align, key: keyStyle(c.look, c.pal) }} />;
}

// A card on the background (white face; a soft glow ring on dark looks).
export const card = (pal: Pal, radius = 24): CSSProperties => ({
  background: pal.panel,
  color: pal.panelInk,
  borderRadius: radius,
  boxShadow: pal.dark ? `0 0 0 8px ${pal.glass}22, 0 50px 120px rgba(0,0,0,0.45)` : "0 40px 100px rgba(40,40,110,0.16), 0 0 0 1px rgba(0,0,0,0.04)",
});

// The product's app colours from the palette.
// (dark product cards when the look has them — Warm)
export const appTone = (pal: Pal): AppTone =>
  pal.panelDark
    ? { bg: pal.panel, side: pal.panelSide ?? "#231e1c", ink: pal.panelInk, sub: pal.panelSub, line: pal.line, accent: pal.accent, accent2: pal.accent2, card: pal.panelSide ?? "#241f1d" }
    : { bg: "#ffffff", side: "#f6f6fb", ink: pal.panelInk, sub: pal.panelSub, line: pal.line, accent: pal.panelAccent ?? pal.accent, accent2: pal.panelAccent ? "#8b78ff" : pal.accent2, card: "#ffffff" };

// A part's progress 0..1 (eased by the caller).
export const span = (c: BlockCtx) => Math.min(1, Math.max(0, (c.f - c.from) / Math.max(1, c.to - c.from)));
export type { Moments };
