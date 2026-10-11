import type { ArtT, Look, Surface } from "./types";

// Colour, type and randomness for the Composer. A video's palette is made
// from its art direction (a hue, a harmony, dark or light) — never picked
// from a list of finished looks — and every colour pair is checked for
// contrast.

// ── seeded randomness ──────────────────────────────────────────────────────
export function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  return {
    next,
    range: (a: number, b: number) => a + (b - a) * next(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * next()),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length) % xs.length],
    chance: (p: number) => next() < p,
    shuffle: <T,>(xs: readonly T[]): T[] => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
export type Rng = ReturnType<typeof rng>;
export const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ── colour ─────────────────────────────────────────────────────────────────
export function hsl(h: number, s: number, l: number, a = 1) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const c = s * Math.min(l, 1 - l);
  const f = (n: number) => l - c * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return a >= 1 ? `#${hex(f(0))}${hex(f(8))}${hex(f(4))}` : `rgba(${Math.round(f(0) * 255)},${Math.round(f(8) * 255)},${Math.round(f(4) * 255)},${a})`;
}
export function hueOf(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 250;
  const v = parseInt(m[1], 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 250;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}
const lum = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const v = parseInt(m[1], 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// The lightness of hue/sat that reads on `bg` (at least `min` contrast).
function readable(h: number, s: number, l: number, bg: string, min: number) {
  const dark = lum(bg) < 0.4;
  let c = hsl(h, s, l);
  for (let k = 0; k < 30 && contrast(c, bg) < min; k++) {
    l += dark ? 3 : -3;
    c = hsl(h, s, l);
  }
  return c;
}

export type Pal = {
  dark: boolean;
  bg: string;
  bg2: string;
  ink: string;
  sub: string;
  faint: string;
  accent: string; // reads on the field (text, lines)
  accent2: string;
  accent3: string;
  fill: string; // a solid accent face (buttons, tiles)
  fill2: string;
  onFill: string;
  glow: string;
  panel: string;
  panelInk: string;
  panelSub: string;
  panelLine: string;
  panelSoft: string; // inner panels (rows, fields)
  panelDark: boolean;
  shadow: string;
  // the video's look (types.ts LOOKS); null: an older video's light glass look
  look: Look | null;
};

const partners = (h: number, harmony: ArtT["harmony"]): [number, number] => {
  if (harmony === "mono") return [h + 12, h - 10];
  if (harmony === "analogous") return [h + 34, h - 30];
  if (harmony === "complement") return [h + 180, h + 20];
  if (harmony === "split") return [h + 150, h + 210];
  return [h + 120, h + 240];
};

// A palette for one field (dark or light) of an art direction.
export function palette(art: Pick<ArtT, "hue" | "harmony" | "surface"> & { look?: Look | null }, dark: boolean): Pal {
  if (art.look) return lookPalette(art.look, art, dark);
  const h = art.hue;
  const [h2, h3] = partners(h, art.harmony);
  const bg = dark ? hsl(h, 38, 6) : hsl(h, 30, 97);
  const bg2 = dark ? hsl(h + 8, 45, 12) : hsl(h2, 45, 93);
  const ink = dark ? hsl(h, 30, 96) : hsl(h, 35, 10);
  const sub = dark ? hsl(h, 22, 72) : hsl(h, 14, 40);
  const accent = readable(h, 82, dark ? 66 : 50, bg, 3.2);
  const accent2 = readable(h2, 78, dark ? 68 : 50, bg, 3);
  const accent3 = readable(h3, 72, dark ? 70 : 52, bg, 2.6);
  const fill = hsl(h, 78, dark ? 58 : 52);
  const fill2 = hsl(h2, 76, dark ? 60 : 56);
  const onFill = contrast("#ffffff", fill) >= 3 ? "#ffffff" : hsl(h, 40, 10);
  // the product's cards are always bright — white on a light field, and
  // bright (lit) on a dark one: on a dark background the subject is the light
  const panelDark = false;
  const panel = art.surface === "tinted" || art.surface === "ink" ? hsl(h, 50, 98) : "#ffffff";
  const panelInk = panelDark ? hsl(h, 25, 95) : hsl(h, 35, 12);
  const panelSub = panelDark ? hsl(h, 16, 66) : hsl(h, 12, 46);
  const panelLine = panelDark ? hsl(h, 24, 22) : hsl(h, 22, 92);
  const panelSoft = panelDark ? hsl(h, 26, 17) : hsl(h, 30, 96.5);
  const glow = hsl(h, 90, dark ? 70 : 60);
  // on a dark field the bright things glow faintly in the key colour
  const shadow = dark ? hsl(h, 80, 55, 0.28) : hsl(h, 40, 30, 0.16);
  return { dark, bg, bg2, ink, sub, faint: dark ? hsl(h, 20, 40) : hsl(h, 15, 75), accent, accent2, accent3, fill, fill2, onFill, glow, panel, panelInk, panelSub, panelLine, panelSoft, panelDark, shadow, look: null };
}

// Each look's own colours (dark: the scene's field is dark — a look that is
// always dark or always light ignores it, see looks.ts).
function lookPalette(look: Look, art: Pick<ArtT, "hue" | "harmony">, dark: boolean): Pal {
  const h = art.hue;
  const [h2, h3] = partners(h, art.harmony);
  const on = (bg: string) => (contrast("#ffffff", bg) >= 3.2 ? "#ffffff" : "#0b0b0d");
  const base = { accent3: readable(h3, 72, 66, "#0b0b0d", 2.6), look } as const;
  switch (look) {
    case "cinematic": {
      const bg = hsl(h, 22, 4), bg2 = hsl(h, 34, 8);
      const fill = hsl(h, 82, 58);
      return { ...base, dark: true, bg, bg2, ink: "#f4f5f7", sub: hsl(h, 8, 66), faint: hsl(h, 10, 30), accent: readable(h, 85, 68, bg, 4), accent2: readable(h2, 80, 70, bg, 3.4), fill, fill2: hsl(h2, 76, 56), onFill: on(fill), glow: hsl(h, 90, 62), panel: hsl(h, 16, 9), panelInk: "#eef0f4", panelSub: hsl(h, 8, 62), panelLine: hsl(h, 12, 19), panelSoft: hsl(h, 16, 13), panelDark: true, shadow: "rgba(0,0,0,0.62)" };
    }
    case "plates": {
      // the plate: a deep, saturated colour that white words read on (field.tsx turns it scene by scene)
      const bg = hsl(h, 70, 38), bg2 = hsl(h, 70, 34);
      return { ...base, dark: true, bg, bg2, ink: "#ffffff", sub: "rgba(255,255,255,0.82)", faint: "rgba(255,255,255,0.4)", accent: hsl(h + 18, 100, 86), accent2: hsl(h2, 100, 86), fill: "#0d0d10", fill2: hsl(h, 30, 22), onFill: "#ffffff", glow: hsl(h, 100, 80), panel: "#ffffff", panelInk: "#0d0d10", panelSub: "#55575f", panelLine: "#e7e7ea", panelSoft: "#f3f3f5", panelDark: false, shadow: "rgba(0,0,0,0.25)" };
    }
    case "kinetic": {
      const bg = dark ? "#000000" : "#ffffff";
      const ink = dark ? "#ffffff" : "#000000";
      const accent = readable(h, 96, dark ? 62 : 46, bg, 3.6);
      return { ...base, dark, bg, bg2: bg, ink, sub: dark ? "#a3a3a8" : "#55555c", faint: dark ? "#3a3a40" : "#c9c9cf", accent, accent2: readable(h2, 92, dark ? 64 : 46, bg, 3.2), fill: accent, fill2: ink, onFill: on(accent), glow: accent, panel: bg, panelInk: ink, panelSub: dark ? "#a3a3a8" : "#55555c", panelLine: dark ? "#2a2a2f" : "#e2e2e6", panelSoft: dark ? "#111114" : "#f4f4f6", panelDark: dark, shadow: "rgba(0,0,0,0)" };
    }
    case "editorial": {
      const bg = "#f3ede3", bg2 = "#ebe3d6";
      const accent = readable(h, 58, 36, bg, 4.5);
      return { ...base, dark: false, bg, bg2, ink: "#1d1a16", sub: "#5f584e", faint: "#bdb3a4", accent, accent2: readable(h2, 50, 36, bg, 4), fill: accent, fill2: "#1d1a16", onFill: on(accent), glow: accent, panel: "#fffdf8", panelInk: "#1d1a16", panelSub: "#6b6458", panelLine: "#ddd3c3", panelSoft: "#f7f2e9", panelDark: false, shadow: "rgba(60,45,25,0.10)" };
    }
    case "neon": {
      const bg = hsl(h, 60, 5), bg2 = hsl(h + 30, 70, 10);
      const accent = readable(h, 100, 64, bg, 4.5);
      return { ...base, dark: true, bg, bg2, ink: "#f2f6ff", sub: hsl(h, 30, 72), faint: hsl(h, 40, 28), accent, accent2: readable(h + 60, 100, 64, bg, 4), fill: hsl(h, 100, 58), fill2: hsl(h + 60, 100, 58), onFill: on(hsl(h, 100, 58)), glow: hsl(h, 100, 62), panel: hsl(h, 50, 8), panelInk: "#eef3ff", panelSub: hsl(h, 25, 66), panelLine: hsl(h, 45, 18), panelSoft: hsl(h, 50, 12), panelDark: true, shadow: hsl(h, 100, 55, 0.3) };
    }
    case "swiss": {
      const accent = readable(h, 92, 48, "#ffffff", 3.6);
      return { ...base, dark: false, bg: "#ffffff", bg2: "#ffffff", ink: "#0a0a0a", sub: "#4a4a4f", faint: "#d0d0d4", accent, accent2: "#0a0a0a", fill: accent, fill2: "#0a0a0a", onFill: on(accent), glow: accent, panel: "#ffffff", panelInk: "#0a0a0a", panelSub: "#55555b", panelLine: "#e3e3e7", panelSoft: "#f4f4f6", panelDark: false, shadow: "rgba(0,0,0,0)" };
    }
  }
}

// ── type ──────────────────────────────────────────────────────────────────
// Faces from the font library (public/fonts/library) a Director may set
// headlines in, and the quieter faces for cards and labels. `w`: average
// glyph width in em at weight 700 (for laying out before the browser can
// measure); `fixed`: one weight only.
export type Face = { slug: string; family: string; file: string; w: number; fixed?: number; upper?: boolean };
const face = (slug: string, w: number, opts: Partial<Face> = {}): Face => ({ slug, family: `C-${slug}`, file: `${slug}-latin-wght-normal.woff2`, w, ...opts });
export const DISPLAY_FACES: Face[] = [
  face("inter", 0.56, { file: "" }),
  face("sora", 0.6),
  face("manrope", 0.56),
  face("plus-jakarta-sans", 0.57),
  face("space-grotesk", 0.56),
  face("bricolage-grotesque", 0.55),
  face("syne", 0.62),
  face("unbounded", 0.72),
  face("outfit", 0.52),
  face("urbanist", 0.52),
  face("dm-sans", 0.55),
  face("geist", 0.56),
  face("mona-sans", 0.57),
  face("instrument-sans", 0.54),
  face("schibsted-grotesk", 0.55),
  face("red-hat-display", 0.54),
  face("epilogue", 0.58),
  face("archivo", 0.56),
  face("lexend", 0.6),
  face("onest", 0.56),
  face("figtree", 0.55),
  face("hanken-grotesk", 0.54),
  face("albert-sans", 0.55),
  face("montserrat", 0.64),
  face("oswald", 0.42, { upper: true }),
  face("big-shoulders-display", 0.4, { upper: true }),
  face("bebas-neue", 0.4, { file: "bebas-neue-latin-400-normal.woff2", fixed: 400, upper: true }),
  face("anton", 0.46, { file: "anton-latin-400-normal.woff2", fixed: 400, upper: true }),
  face("archivo-black", 0.66, { file: "archivo-black-latin-400-normal.woff2", fixed: 400 }),
  face("dela-gothic-one", 0.72, { file: "dela-gothic-one-latin-400-normal.woff2", fixed: 400 }),
  face("krona-one", 0.74, { file: "krona-one-latin-400-normal.woff2", fixed: 400 }),
  face("fraunces", 0.56),
  face("playfair-display", 0.55),
  face("instrument-serif", 0.44, { file: "instrument-serif-latin-400-normal.woff2", fixed: 400 }),
  face("dm-serif-display", 0.5, { file: "dm-serif-display-latin-400-normal.woff2", fixed: 400 }),
  face("young-serif", 0.56, { file: "young-serif-latin-400-normal.woff2", fixed: 400 }),
  face("newsreader", 0.5),
];
export const TEXT_FACES: Face[] = ["inter", "dm-sans", "manrope", "figtree", "geist", "onest", "plus-jakarta-sans", "hanken-grotesk", "instrument-sans", "public-sans", "work-sans", "albert-sans", "outfit"].map((s) => DISPLAY_FACES.find((f) => f.slug === s) ?? face(s, 0.55));
export const MONO_FACE = face("jetbrains-mono", 0.6);
export const faceOf = (slug: string, list = DISPLAY_FACES) => list.find((f) => f.slug === slug) ?? list[0];
export const fontUrl = (f: Face) => (f.slug === "inter" ? "fonts/inter-latin-wght.woff2" : `fonts/library/${f.slug}/${f.file}`);
export const familyOf = (f: Face) => `"${f.family}", InterClean, system-ui, sans-serif`;

// Rough width of a text in em (before the browser can measure it).
export function emWidth(text: string, f: Face, weight = 700, upper = false) {
  let w = 0;
  for (const ch of upper ? text.toUpperCase() : text) {
    if (ch === " ") w += 0.27;
    else if ("iljI.,:;'!|".includes(ch)) w += 0.5;
    else if ("mwMW".includes(ch)) w += 1.45;
    else if (ch >= "A" && ch <= "Z") w += 1.18;
    else if (ch >= "0" && ch <= "9") w += 1.05;
    else w += 1;
  }
  return w * f.w * (0.9 + 0.1 * (weight / 700));
}

// ── surfaces (cards, pills, tiles) ────────────────────────────────────────
export function surfaceStyle(surface: Surface, pal: Pal, radius: number, lift = 1): Record<string, string | number> {
  const r = Math.round(radius);
  // (a look draws its own cards)
  switch (pal.look) {
    case "cinematic": return { background: `linear-gradient(165deg, ${pal.panelSoft}, ${pal.panel})`, border: "1px solid rgba(255,255,255,0.10)", borderTop: "1px solid rgba(255,255,255,0.22)", boxShadow: `0 ${Math.round(40 * lift)}px ${Math.round(120 * lift)}px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)`, borderRadius: r };
    case "plates": return { background: pal.panel, boxShadow: `${Math.round(14 * lift)}px ${Math.round(14 * lift)}px 0 rgba(0,0,0,0.22)`, borderRadius: Math.max(r, 22) };
    case "kinetic": return { background: pal.panel, border: `3px solid ${pal.panelInk}`, borderRadius: Math.min(r, 10) };
    case "editorial": return { background: pal.panel, border: `1px solid ${pal.panelLine}`, boxShadow: `0 1px 0 ${pal.panelLine}, 0 ${Math.round(18 * lift)}px ${Math.round(40 * lift)}px ${pal.shadow}`, borderRadius: Math.min(r, 8) };
    case "neon": return { background: `linear-gradient(160deg, ${pal.panelSoft}, ${pal.panel})`, border: `1.5px solid ${pal.accent}`, boxShadow: `0 0 0 1px rgba(0,0,0,0.5), 0 0 ${Math.round(60 * lift)}px ${pal.shadow}`, borderRadius: r };
    case "swiss": return { background: pal.panel, border: `2.5px solid ${pal.panelInk}`, borderRadius: Math.min(r, 4) };
  }
  const shade = `0 ${Math.round(30 * lift)}px ${Math.round(80 * lift)}px ${pal.shadow}`;
  if (surface === "glass")
    return pal.panelDark
      ? { background: "linear-gradient(160deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04))", border: "1.5px solid rgba(255,255,255,0.16)", borderTop: "1.5px solid rgba(255,255,255,0.3)", boxShadow: shade, borderRadius: r }
      : { background: pal.dark ? "linear-gradient(160deg, rgba(255,255,255,0.99), rgba(250,250,255,0.93))" : "linear-gradient(160deg, rgba(255,255,255,0.95), rgba(255,255,255,0.82))", border: "1.5px solid rgba(255,255,255,0.95)", borderTop: "1.5px solid #fff", boxShadow: shade, borderRadius: r };
  if (surface === "outline") return { background: pal.panelDark ? "rgba(255,255,255,0.02)" : pal.panel, border: `2px solid ${pal.panelDark ? pal.faint : pal.panelInk}`, boxShadow: pal.panelDark ? "none" : `8px 8px 0 ${pal.panelInk}`, borderRadius: r };
  if (surface === "soft") return { background: pal.panel, boxShadow: `0 2px 0 ${pal.panelLine}, ${shade}`, borderRadius: r };
  if (surface === "tinted") return { background: pal.panel, border: `1.5px solid ${pal.panelLine}`, boxShadow: shade, borderRadius: r };
  if (surface === "ink") return { background: pal.panel, border: `1px solid ${pal.panelLine}`, boxShadow: shade, borderRadius: r };
  return { background: pal.panel, boxShadow: shade, borderRadius: r };
}
