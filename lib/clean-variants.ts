import type { FilmId } from "@/components/video/clean/refs";

// The variation engine for the film templates: a project gets four videos,
// each a different template, and each template in a colour (a hue turn of
// the whole film). A regeneration of the same script takes a colour every
// template has not had in this project before, and a new order, so no video
// repeats an earlier one.

export type CleanVariant = { film: FilmId; hue: number; tint: Tint };
export type Tint = "native" | "brand" | "brand+120" | "brand-120";
const FILMS: FilmId[] = ["glow", "dusk", "fly", "connect"];
const TINTS: Tint[] = ["native", "brand", "brand+120", "brand-120"];
// Each film's own key hue (degrees): what a turn starts from.
export const FILM_HUE: Record<FilmId, number> = { glow: 158, dusk: 262, fly: 221, connect: 238 };

// A hex colour's hue (degrees, 0–360); null for greys and bad input.
export function hueOf(hex: string | null | undefined): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

// The turn (degrees, −180…180) that takes a film's hue to a tint.
export function hueTurn(film: FilmId, tint: Tint, brandHue: number | null): number {
  if (tint === "native" || brandHue === null) return tint === "native" ? 0 : { brand: 0, "brand+120": 120, "brand-120": -120 }[tint];
  const target = brandHue + { brand: 0, "brand+120": 120, "brand-120": -120 }[tint];
  return Math.round((((target - FILM_HUE[film]) % 360) + 540) % 360 - 180);
}

// A small seeded shuffle (the same seed → the same order).
function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Four variants for a generation. `history`: the variants of earlier
// generations of this project (any order); `seed`: per project.
export function cleanVariants(seed: number, history: CleanVariant[][], brandColor?: string | null): CleanVariant[] {
  const brandHue = hueOf(brandColor);
  const used = new Set(history.flat().map((v) => `${v.film}:${v.tint}`));
  const order = shuffle(FILMS, seed + history.length * 7919);
  return order.map((film, i) => {
    // first a tint this film has not had, starting from this generation's slot
    const start = (history.length + i) % TINTS.length;
    const tints = [...TINTS.slice(start), ...TINTS.slice(0, start)];
    const tint = tints.find((t) => !used.has(`${film}:${t}`)) ?? tints[0];
    return { film, tint, hue: hueTurn(film, tint, brandHue) };
  });
}
