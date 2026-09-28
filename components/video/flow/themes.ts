import type { LottieColors } from "@/components/video/lottie/recolor";
import type { ThemeName } from "./types";

// Art directions taken from the reference videos: a bright lavender product
// world, a dark studio with coloured light, a fresh white-and-green health look
// and a clean teal operations look (white with a soft mesh of colour).
export type FlowTheme = {
  dark: boolean;
  bg: [string, string];
  blobs: [string, string, string];
  primary: string;
  primary2: string; // gradient partner
  accent: string;
  ink: string;
  sub: string;
  surface: string;
  soft: string; // tinted fill (tiles, tracks)
  line: string;
  success: string;
  glow: string; // rgba of primary for shadows
};

export const THEMES: Record<ThemeName, FlowTheme> = {
  lavender: {
    dark: false,
    bg: ["#F6F4FF", "#E4DEFF"],
    blobs: ["#B3A7FF", "#D9D2FF", "#8F80FF"],
    primary: "#5B4FF5",
    primary2: "#8A5CF6",
    accent: "#19C6B0",
    ink: "#1E1B4B",
    sub: "#6B6899",
    surface: "#FFFFFF",
    soft: "#E4E1FF",
    line: "#B9B1F7",
    success: "#22C55E",
    glow: "rgba(91,79,245,",
  },
  midnight: {
    dark: true,
    bg: ["#15161C", "#0E0F13"],
    blobs: ["#E0445A", "#1FB5A5", "#5B4FF5"],
    primary: "#E8457A",
    primary2: "#2BC4B4",
    accent: "#2BC4B4",
    ink: "#F5F6FA",
    sub: "#9A9CAA",
    surface: "#1E2029",
    soft: "#2A2D38",
    line: "#3A3D4A",
    success: "#2BC4B4",
    glow: "rgba(232,69,122,",
  },
  mint: {
    dark: false,
    bg: ["#FFFFFF", "#EEF8F2"],
    blobs: ["#34C38F", "#F1E27C", "#8FE0BD"],
    primary: "#0F9B6C",
    primary2: "#B7D334",
    accent: "#2FB67E",
    ink: "#0F2A21",
    sub: "#5C786D",
    surface: "#FFFFFF",
    soft: "#DDF3E8",
    line: "#A6DDC5",
    success: "#1DB67E",
    glow: "rgba(15,155,108,",
  },
  teal: {
    dark: false,
    bg: ["#FFFFFF", "#EFF6F8"],
    blobs: ["#2BB8BD", "#A9CFF2", "#F3E6A2"],
    primary: "#0E9CA6",
    primary2: "#45C9C4",
    accent: "#2B7DE0",
    ink: "#0F2930",
    sub: "#5A7680",
    surface: "#FFFFFF",
    soft: "#DBF0F2",
    line: "#A5DCDF",
    success: "#16AE8A",
    glow: "rgba(14,156,166,",
  },
};

// The customer's brand colour (#RRGGBB) takes over the theme's accent roles:
// the subject, panels, highlights and the glow; the rest of the palette stays.
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);
export function withBrandColor(theme: FlowTheme, brand?: string | null): FlowTheme {
  if (!brand || !/^#[0-9A-Fa-f]{6}$/.test(brand)) return theme;
  const c = hex(brand);
  const white = [255, 255, 255];
  // A lighter partner for gradients, a readable accent (not too light).
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const primary = lum > 0.62 ? toHex(mix(c, [0, 0, 0], 0.35)) : brand;
  const p = hex(primary);
  return {
    ...theme,
    primary,
    primary2: toHex(mix(p, white, 0.35)),
    accent: toHex(mix(p, hex(theme.accent), 0.4)),
    blobs: theme.dark ? [primary, theme.blobs[1], theme.blobs[2]] : [toHex(mix(p, white, 0.35)), theme.blobs[1], toHex(mix(p, white, 0.6))],
    soft: theme.dark ? theme.soft : toHex(mix(p, white, 0.86)),
    line: theme.dark ? theme.line : toHex(mix(p, white, 0.6)),
    glow: `rgba(${p.join(",")},`,
  };
}

export const lottieColors = (t: FlowTheme): LottieColors => ({
  primary: t.primary,
  accent: t.accent,
  ink: t.ink,
  soft: t.soft,
  success: t.success,
});

export const FLOW_FONT = "InterFlow, Inter, system-ui, sans-serif";
