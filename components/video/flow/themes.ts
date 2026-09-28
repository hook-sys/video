import type { LottieColors } from "@/components/video/lottie/recolor";
import type { ThemeName } from "./types";

// Two art directions taken from the reference videos: a bright lavender
// product world, and a dark studio with coloured light.
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
    line: "#3A3D4A",
    success: "#2BC4B4",
    glow: "rgba(232,69,122,",
  },
};

export const lottieColors = (t: FlowTheme): LottieColors => ({
  primary: t.primary,
  accent: t.accent,
  ink: t.ink,
  soft: t.dark ? "#2A2D38" : "#E4E1FF",
  success: t.success,
});

export const FLOW_FONT = "InterFlow, Inter, system-ui, sans-serif";
