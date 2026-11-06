import BN_WIDTHS from "./bn-widths.json";
// The simple engine's type and randomness: the faces from the font library
// (public/fonts/library) and a seeded random.

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

// ── type ──────────────────────────────────────────────────────────────────
// `w`: average glyph width in em at weight 700 (for laying out before the
// browser can measure); `fixed`: one weight only; `files`: a Bangla face's
// files — its Bangla letters and its Latin ones, each weight it has.
export type FontFile = { file: string; weight: string; range?: string };
export type Face = { slug: string; family: string; file: string; w: number; fixed?: number; upper?: boolean; files?: FontFile[] };
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
// ── Bangla ───────────────────────────────────────────────────────────────
// The faces the videos are set in (docs/video-spec.md, Bangla): each loads its
// Bangla file for the Bangla range and its Latin file for the rest (English
// words, digits inside a Bangla line).
const BN_RANGE = "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0-1CF9, U+200C-200D, U+20B9, U+25CC, U+A8F1";
const bangla = (slug: string, statics?: number[]): Face => ({
  slug,
  family: `C-${slug}`,
  file: "",
  w: 0.62,
  files: statics
    ? statics.flatMap((wt) => [{ file: `${slug}-bengali-${wt}-normal.woff2`, weight: String(wt), range: BN_RANGE }, { file: `${slug}-latin-${wt}-normal.woff2`, weight: String(wt) }])
    : [{ file: `${slug}-bengali-wght-normal.woff2`, weight: "100 900", range: BN_RANGE }, { file: `${slug}-latin-wght-normal.woff2`, weight: "100 900" }],
});
export const BANGLA_FACES: Face[] = [bangla("noto-sans-bengali"), bangla("anek-bangla"), bangla("atma", [400, 700]), bangla("baloo-da-2"), bangla("noto-serif-bengali"), bangla("hind-siliguri", [400, 700])];
DISPLAY_FACES.push(...BANGLA_FACES);

export const TEXT_FACES: Face[] = ["hind-siliguri", "noto-sans-bengali", "inter", "dm-sans", "manrope", "figtree", "geist", "onest", "plus-jakarta-sans", "hanken-grotesk", "instrument-sans", "public-sans", "work-sans", "albert-sans", "outfit"].map((s) => DISPLAY_FACES.find((f) => f.slug === s) ?? face(s, 0.55));
export const faceOf = (slug: string, list = DISPLAY_FACES) => list.find((f) => f.slug === slug) ?? list[0];
export const fontUrl = (f: Face) => (f.slug === "inter" ? "fonts/inter-latin-wght.woff2" : `fonts/library/${f.slug}/${f.file}`);
// every file a face loads, with its weight and range
export const fontFiles = (f: Face): { url: string; weight: string; range?: string }[] =>
  f.files ? f.files.map((x) => ({ url: `fonts/library/${f.slug}/${x.file}`, weight: x.weight, range: x.range })) : [{ url: fontUrl(f), weight: f.fixed ? String(f.fixed) : "100 900" }];
export const familyOf = (f: Face) => `"${f.family}", InterClean, system-ui, sans-serif`;

// Rough width of a text in em (before the browser can measure it). A Bangla
// face: from its measured table (scripts/bangla) — each character's width and
// the corrections for conjuncts and vowel signs that join their letter;
// a line's width within a percent or so, a word's within a few.
const BN_TABLE = BN_WIDTHS as Record<string, { space: number; chars: Record<string, number> }>;
const HASANTA = "\u09CD";
function bnWidth(text: string, t: { chars: Record<string, number> }) {
  const c = t.chars;
  const cs = [...text.normalize("NFC")];
  let w = 0;
  cs.forEach((ch, i) => {
    const prv = cs[i - 1] ?? "", nxt = cs[i + 1] ?? "";
    if (ch === " ") return void (w += 0.26 / 1.15);
    if (ch === HASANTA) {
      w += c[nxt === "য" ? "ya" : nxt === "র" ? "ra" : prv === "র" ? "reph" : "conj"] ?? 0;
      if (prv && nxt) w += c[`+${prv}${HASANTA}${nxt}`] ?? 0;
      return;
    }
    w += c[ch] ?? 0.55;
    if ("ুূৃ".includes(ch) && prv) w += c[`+${prv === "র" && cs[i - 2] === HASANTA ? "্র" : prv}${ch}`] ?? 0;
  });
  return w;
}
export function emWidth(text: string, f: Face, weight = 700, upper = false) {
  const table = BN_TABLE[f.slug];
  if (table) return bnWidth(text, table);
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
