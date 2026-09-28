import type { FlowText } from "./types";

// Type system for the Flow engine (Inter). One scale, used by the renderer,
// the compiler (fitting) and the quality checks, so text is always legible
// and never overflows the frame.

export type TextStyle = NonNullable<FlowText["style"]>;
export const TYPE: Record<TextStyle, { size: number; weight: number; track: number; lineHeight: number }> = {
  display: { size: 156, weight: 800, track: -0.045, lineHeight: 1.0 },
  headline: { size: 96, weight: 760, track: -0.035, lineHeight: 1.05 },
  side: { size: 100, weight: 780, track: -0.038, lineHeight: 1.04 },
  pill: { size: 56, weight: 700, track: -0.02, lineHeight: 1.1 },
  caption: { size: 84, weight: 760, track: -0.03, lineHeight: 1.08 },
};

// Node labels live in the world (they move with their node) but are sized
// against the camera zoom so they never read smaller than ~36 px on screen.
export const LABEL_MIN_SCREEN_PX = 36;
export const labelWorldSize = (zoom: number) => Math.max(40, LABEL_MIN_SCREEN_PX / Math.max(0.3, zoom));

// Average advance of Inter at these weights, in em per character.
const EM_PER_CHAR = 0.56;
const MAX_WIDTH: Record<TextStyle, number> = { display: 1680, headline: 1680, side: 980, pill: 1400, caption: 1680 };

// The side layout sets the phrase on two lines: the lead-in, then the accent
// ("Growth begins / with your People").
export function splitLines(text: string, accent?: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return [text];
  const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = accent ? words.findIndex((w) => bare(w) === bare(accent.split(/\s+/)[0] ?? "")) : -1;
  const cut = first > 0 ? first : Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

// Largest size (≤ the style's size) at which every line fits its width.
export function fitSize(text: string, style: TextStyle, accent?: string) {
  const lines = style === "side" ? splitLines(text, accent) : [text];
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const s = TYPE[style];
  return Math.max(Math.round(s.size * 0.45), Math.min(s.size, Math.floor(MAX_WIDTH[style] / (longest * EM_PER_CHAR))));
}
export const textWidth = (text: string, size: number) => text.length * EM_PER_CHAR * size;
