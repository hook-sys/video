import { DISPLAY_FACES, TEXT_FACES, type Face, faceOf, hsl, hueOf } from "../composer/art";
import { type Pace, type Theme, TYPE_PAIRS } from "./types";

// A video's colours and type from its brand colour and its ground: the brand
// colour only on the keyword, buttons and glows; everything else neutral.

export type Look = {
  dark: boolean;
  bg: string;
  glow: string;
  ink: string;
  sub: string;
  accent: string;
  // on the accent (a button's words)
  onAccent: string;
  panel: string;
  // the accent on a card (on a brand-filled ground the card is white: the brand colour itself)
  panelAccent: string;
  panelInk: string;
  panelSub: string;
  line: string;
  shadow: string;
  bad: string;
  display: Face;
  text: Face;
};

export function lookOf(theme: Theme, color: string): Look {
  const h = hueOf(color);
  const [display, text] = TYPE_PAIRS[theme.type] ?? TYPE_PAIRS[0];
  const faces = { display: faceOf(display), text: faceOf(text, TEXT_FACES) ?? DISPLAY_FACES[0] };
  if (theme.ground === "light")
    return { dark: false, bg: hsl(h, 30, 97), glow: hsl(h, 85, 70, 0.28), ink: "#0e1015", sub: "#5b606b", accent: hsl(h, 75, 46), onAccent: "#ffffff", panel: "#ffffff", panelAccent: hsl(h, 75, 46), panelInk: "#0e1015", panelSub: "#6b7080", line: "rgba(14,16,21,0.08)", shadow: "rgba(20,24,40,0.14)", bad: "#e5484d", ...faces };
  if (theme.ground === "brand")
    return { dark: true, bg: hsl(h, 70, 38), glow: hsl(h + 25, 90, 62, 0.45), ink: "#ffffff", sub: "rgba(255,255,255,0.78)", accent: hsl(h + 15, 95, 85), onAccent: hsl(h, 70, 22), panel: "#ffffff", panelAccent: hsl(h, 72, 40), panelInk: "#0e1015", panelSub: "#6b7080", line: "rgba(14,16,21,0.08)", shadow: "rgba(0,0,0,0.28)", bad: "#e5484d", ...faces };
  return { dark: true, bg: hsl(h, 35, 7), glow: hsl(h, 85, 55, 0.32), ink: "#ffffff", sub: "rgba(255,255,255,0.66)", accent: hsl(h, 85, 66), onAccent: hsl(h, 60, 10), panel: "rgba(255,255,255,0.07)", panelAccent: hsl(h, 85, 66), panelInk: "#ffffff", panelSub: "rgba(255,255,255,0.6)", line: "rgba(255,255,255,0.1)", shadow: "rgba(0,0,0,0.45)", bad: "#ff6369", ...faces };
}

// the springs: a visible settle, never a bounce (damping ratio ≈ 0.62 calm, 0.5 lively)
export const SPRINGS: Record<Pace, { damping: number; stiffness: number; mass: number; stagger: number }> = {
  calm: { damping: 15, stiffness: 150, mass: 0.95, stagger: 4 },
  lively: { damping: 13, stiffness: 190, mass: 0.85, stagger: 3 },
};
