import type { Act, LookId } from "./types";

// One act's colours: the background gradient, three soft light blobs that
// drift over it, the text on it and whether it is dark.
export type Palette = { bg: [string, string]; blobs: [string, string, string]; ink: string; sub: string; dark: boolean };

export type Look = {
  id: LookId;
  acts: Record<Act, Palette>;
  accent: [string, string]; // the keyword gradient
  card: "light" | "dark"; // the UI cards' face in the solution act
  pattern: "grid" | "dots" | "lines" | "rings";
  font: string;
};

const INTER = "InterClean, system-ui, sans-serif";

// Four families, each with its own story arc of colours (reference films:
// Lumin, Converse, Desklog, Alex — dark problem, a brand-coloured reveal, a
// bright solution; Sunrise runs the other way and ends dark).
export const LOOKS: Record<LookId, Look> = {
  lavender: {
    id: "lavender",
    acts: {
      problem: { bg: ["#1c1748", "#0c0a22"], blobs: ["#5b4bff", "#2b1f7a", "#8a3ffc"], ink: "#f4f2ff", sub: "#b9b3e6", dark: true },
      reveal: { bg: ["#6a5bff", "#8f6bff"], blobs: ["#b9a8ff", "#5b47f0", "#d68bff"], ink: "#ffffff", sub: "#e6e1ff", dark: true },
      solution: { bg: ["#f7f5ff", "#ebe7ff"], blobs: ["#d9d2ff", "#cfe9ff", "#f6d8ff"], ink: "#16123a", sub: "#6b678e", dark: false },
      cta: { bg: ["#f4f1ff", "#e4defe"], blobs: ["#cfc6ff", "#bfe3ff", "#f1cdfd"], ink: "#16123a", sub: "#6b678e", dark: false },
    },
    accent: ["#6a5bff", "#c04dff"],
    card: "light",
    pattern: "grid",
    font: INTER,
  },
  midnight: {
    id: "midnight",
    acts: {
      problem: { bg: ["#05060d", "#0b0f24"], blobs: ["#1a2a7a", "#3a1a6e", "#0e3a5e"], ink: "#eef2ff", sub: "#8f9ac2", dark: true },
      reveal: { bg: ["#16207a", "#3a2fd6"], blobs: ["#4f7bff", "#8a5cff", "#2fd3ff"], ink: "#ffffff", sub: "#cdd6ff", dark: true },
      solution: { bg: ["#0a0f26", "#121a42"], blobs: ["#2b4cff", "#7a3cff", "#00b3ff"], ink: "#eef2ff", sub: "#9aa6d1", dark: true },
      cta: { bg: ["#0b1030", "#1b1660"], blobs: ["#4f6bff", "#9b4dff", "#2ad1ff"], ink: "#ffffff", sub: "#aeb8e6", dark: true },
    },
    accent: ["#5b8cff", "#b45bff"],
    card: "dark",
    pattern: "dots",
    font: INTER,
  },
  mint: {
    id: "mint",
    acts: {
      problem: { bg: ["#0b1d18", "#050f0c"], blobs: ["#0f5a45", "#123a2f", "#0b4a5a"], ink: "#eafff6", sub: "#8fbfae", dark: true },
      reveal: { bg: ["#0fae7b", "#22c9a0"], blobs: ["#7ff0c9", "#0a8f6a", "#5ee0e6"], ink: "#ffffff", sub: "#dffcf1", dark: true },
      solution: { bg: ["#f3fbf7", "#e2f5ec"], blobs: ["#c8f1df", "#cdeef6", "#e6f9d6"], ink: "#0d2a21", sub: "#5c7a6f", dark: false },
      cta: { bg: ["#eefaf4", "#d9f3e7"], blobs: ["#b9ecd6", "#c4ebf5", "#dff6cc"], ink: "#0d2a21", sub: "#5c7a6f", dark: false },
    },
    accent: ["#0fae7b", "#0aa5c8"],
    card: "light",
    pattern: "lines",
    font: INTER,
  },
  sunrise: {
    id: "sunrise",
    acts: {
      problem: { bg: ["#f3efeb", "#e7e0d9"], blobs: ["#e9d9cc", "#dcd3cc", "#f1e3d6"], ink: "#24170f", sub: "#7d6c60", dark: false },
      reveal: { bg: ["#ff6a2b", "#ff8f4d"], blobs: ["#ffb27a", "#ff4d1f", "#ffd08a"], ink: "#ffffff", sub: "#fff0e4", dark: true },
      solution: { bg: ["#fffaf6", "#fff0e5"], blobs: ["#ffd9c2", "#ffe9cf", "#ffd0d6"], ink: "#24170f", sub: "#7d6c60", dark: false },
      cta: { bg: ["#1a120d", "#2b1b12"], blobs: ["#ff6a2b", "#8a2d10", "#ff9a4d"], ink: "#fff6ef", sub: "#d2b8a6", dark: true },
    },
    accent: ["#ff6a2b", "#ff3d71"],
    card: "light",
    pattern: "rings",
    font: INTER,
  },
};
