import { DISPLAY_FACES, TEXT_FACES, type Face, faceOf } from "./faces";
import { type Ground, type Pace, type Theme, TYPE_PAIRS } from "./types";

// A video's colours and type. Every colour is the brand's own colour or a
// neutral: the brand colour exactly where it reads (made only lighter or
// darker, never another hue, where it would not), on the keyword, the
// icons, the buttons and the cards' accents. No second colour.

export type Look = {
  dark: boolean;
  bg: string;
  // a soft light of the brand colour in the ground
  glow: string;
  ink: string;
  sub: string;
  // the keyword, the icons, the buttons
  accent: string;
  // the keyword on a plate (the brand colour made as light or as dark as the words; on the
  // brand's own colour a lighter or darker brand colour does not stand out from the words)
  plate: boolean;
  plateFill: string;
  // on the accent (a button's words, an icon on a filled tile)
  onAccent: string;
  panel: string;
  // a card's surface may be a soft gradient (dark ground: glass)
  panelFill: string;
  // the accent on a card (on a brand-filled ground the card is white: the brand colour itself)
  panelAccent: string;
  onPanelAccent: string;
  panelInk: string;
  panelSub: string;
  line: string;
  shadow: string;
  // the brand colour as a surface (a half of the frame, a big tile) and what is on it
  fill: string;
  onFill: string;
  bad: string;
  // the accent as a surface (a button, a solid icon tile): flat, or on glass a soft gradient
  accentFill: string;
  // (glass) the keyword's gradient, the colour fields of the ground, and its look: words that come in from a blur,
  // glossy tiles, a hairline ring of the brand colour around cards
  keyFill?: string;
  fields?: [string, string, string];
  glass?: boolean;
  ring?: string;
  display: Face;
  text: Face;
};

// ── colour arithmetic (sRGB) ──────────────────────────────────────────────
type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x6a5bff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOf = (c: RGB) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const lum = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(rgbOf(a)), lum(rgbOf(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// a mix of two colours (t: how much of b)
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return hexOf([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
};
// the colour made lighter or darker (towards white or black, same hue) until it stands out by `ratio`
function readable(color: string, against: string, ratio: number, towards: "#ffffff" | "#000000"): string {
  for (let t = 0; t <= 0.9; t += 0.03) {
    const c = mix(color, towards, t);
    if (contrast(c, against) >= ratio) return c;
  }
  return mix(color, towards, 0.9);
}
// white or near-black, whichever reads on it
const inkOn = (bg: string) => (contrast("#ffffff", bg) >= contrast("#0e1015", bg) ? "#ffffff" : "#0e1015");
const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
};

// the colour turned round the colour wheel by `deg` (its neighbour: the glass ground's second light)
const turned = (hex: string, deg: number) => {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [a, bb, cc] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hexOf([(a + m) * 255, (bb + m) * 255, (cc + m) * 255]);
};

// a scene's theme: the video's, on its own ground when it has one
export const themeOf = (theme: Theme, s: { ground?: Ground }): Theme => (s.ground && s.ground !== theme.ground ? { ...theme, ground: s.ground } : theme);

export function lookOf(theme: Theme, color: string): Look {
  const brand = /^#?[0-9a-f]{6}$/i.test(color.trim()) ? `#${color.trim().replace("#", "").toLowerCase()}` : "#6a5bff";
  const [display, text] = TYPE_PAIRS[theme.type] ?? TYPE_PAIRS[0];
  const faces = { display: faceOf(display), text: faceOf(text, TEXT_FACES) ?? DISPLAY_FACES[0] };
  const bad = "#e5484d";
  if (theme.ground === "light") {
    const bg = mix(brand, "#ffffff", 0.96);
    const accent = readable(brand, bg, 3, "#000000");
    return {
      dark: false, bg, glow: alpha(brand, 0.14), ink: "#0e1015", sub: "#5b606b", accent, plate: false, plateFill: accent, onAccent: inkOn(accent),
      panel: "#ffffff", panelFill: "#ffffff", panelAccent: readable(brand, "#ffffff", 3, "#000000"), onPanelAccent: inkOn(readable(brand, "#ffffff", 3, "#000000")),
      panelInk: "#0e1015", panelSub: "#6b7080", line: "rgba(14,16,21,0.07)", shadow: "rgba(16,24,40,0.12)",
      fill: brand, onFill: inkOn(brand), bad, accentFill: accent, ...faces,
    };
  }
  if (theme.ground === "glass") {
    // near white, lit by two soft fields — the brand colour and its warm neighbour — and a haze of it
    // along the bottom; the words a deep ink of the brand's hue; cards frosted white (no backdrop
    // blur: it blinks while things move), a hairline of the brand colour round them
    const bg = mix(brand, "#ffffff", 0.97);
    const ink = mix(brand, "#0d0a1c", 0.84);
    const accent = readable(brand, bg, 3.2, "#000000");
    const second = readable(turned(brand, 38), bg, 3.2, "#000000");
    return {
      dark: false, bg, glow: alpha(brand, 0.16), ink, sub: mix(ink, bg, 0.42), accent, plate: false, plateFill: accent, onAccent: inkOn(accent),
      panel: "#ffffff", panelFill: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))", panelAccent: accent, onPanelAccent: inkOn(accent),
      panelInk: ink, panelSub: mix(ink, "#ffffff", 0.45), line: "rgba(255,255,255,0.95)", shadow: alpha(mix(brand, "#000000", 0.5), 0.13),
      fill: brand, onFill: inkOn(brand), bad,
      accentFill: `linear-gradient(135deg, ${mix(accent, "#ffffff", 0.18)}, ${accent} 55%, ${mix(accent, second, 0.5)})`,
      keyFill: `linear-gradient(90deg, ${accent}, ${second})`,
      fields: [alpha(brand, 0.42), alpha(mix(turned(brand, 38), "#ffffff", 0.25), 0.34), alpha(mix(brand, "#ffffff", 0.7), 0.7)],
      glass: true, ring: alpha(brand, 0.1),
      ...faces,
    };
  }
  if (theme.ground === "brand") {
    // the ground is the brand colour itself; the words on it white (or ink on a light brand colour)
    const ink = inkOn(brand);
    const light = ink === "#ffffff";
    const accent = light ? mix(brand, "#ffffff", 0.78) : mix(brand, "#000000", 0.62);
    const panelAccent = readable(brand, "#ffffff", 3, "#000000");
    return {
      dark: light, bg: brand, glow: alpha(light ? "#ffffff" : "#000000", 0.1), ink, sub: alpha(ink, 0.78), accent, plate: true, plateFill: readable(brand, brand, 4.5, light ? "#ffffff" : "#000000"), onAccent: readable(brand, accent, 4.5, light ? "#000000" : "#ffffff"),
      panel: "#ffffff", panelFill: "#ffffff", panelAccent, onPanelAccent: inkOn(panelAccent),
      panelInk: "#0e1015", panelSub: "#6b7080", line: "rgba(14,16,21,0.07)", shadow: "rgba(0,0,0,0.22)",
      fill: "#ffffff", onFill: panelAccent, bad, accentFill: accent, ...faces,
    };
  }
  const bg = mix(brand, "#07080b", 0.93);
  const accent = readable(brand, bg, 3.5, "#ffffff");
  return {
    dark: true, bg, glow: alpha(brand, 0.22), ink: "#ffffff", sub: "rgba(255,255,255,0.66)", accent, plate: false, plateFill: accent, onAccent: inkOn(accent),
    panel: "rgba(255,255,255,0.06)", panelFill: "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.04))", panelAccent: accent, onPanelAccent: inkOn(accent),
    panelInk: "#ffffff", panelSub: "rgba(255,255,255,0.6)", line: "rgba(255,255,255,0.09)", shadow: "rgba(0,0,0,0.5)",
    fill: brand, onFill: inkOn(brand), bad: "#ff6369", accentFill: accent, ...faces,
  };
}

// the springs: a visible settle, never a bounce (damping ratio ≈ 0.62 calm, 0.5 lively)
export const SPRINGS: Record<Pace, { damping: number; stiffness: number; mass: number; stagger: number }> = {
  calm: { damping: 15, stiffness: 150, mass: 0.95, stagger: 4 },
  lively: { damping: 13, stiffness: 190, mass: 0.85, stagger: 3 },
};
