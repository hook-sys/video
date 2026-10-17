import type { Brand, CameraKind, HeroT, Word } from "../types";

// Slot checks for v2 hero scenes (hero-scenes-slots, draft-2). Text over
// maxChars is cut on a whole word, else the slot is dropped. A number is
// kept only when the spoken word contains it, digits as said (Bengali ০-৯
// included). A missing required slot drops the hero so the scene stays kinetic.

export const LAYOUTS = ["center", "left", "right", "split"] as const;
export const STAGGERS = ["cascade", "pop", "slide"] as const;
export type HeroLayout = (typeof LAYOUTS)[number];
export type HeroStagger = (typeof STAGGERS)[number];

export const HERO_CAMERAS: Record<"logo_end" | "growth_chart", readonly CameraKind[]> = {
  logo_end: ["push", "float", "rise"],
  growth_chart: ["push", "pull", "rise", "drift"],
};

const BN = "০১২৩৪৫৬৭৮৯";

export function foldDigits(s: string): string {
  return s.normalize("NFC").replace(/[০-৯]/g, (d) => {
    const i = BN.indexOf(d);
    return i < 0 ? d : String(i);
  });
}

// The number exactly as spoken: digits (and a % or x stuck to them), never a
// word like "twice" rewritten as 2x.
export function spokenToken(text: string): string | null {
  const m = text.normalize("NFC").match(/[0-9০-৯]+(?:[.,][0-9০-৯]+)?(?:%|[x×])?/i);
  return m ? m[0] : null;
}

export function wordContains(word: string, value: string): boolean {
  if (!value) return false;
  return foldDigits(word).toLowerCase().includes(foldDigits(value).toLowerCase());
}

export function cutWords(text: string, max: number): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const head = t.slice(0, max + 1);
  const sp = head.lastIndexOf(" ");
  if (sp <= 0) return null;
  const out = head.slice(0, sp).trim();
  return out.length ? out : null;
}

export type ResolvedText = { text: string; from: number | null; to: number | null };
export type ResolvedNumber = { value: string; unit: string | null; word: number };

export type ResolvedHero = {
  id: "logo_end" | "growth_chart";
  variant: number;
  layout: HeroLayout;
  stagger: HeroStagger;
  exit: "none" | "zoom-in";
  slots: {
    brandName?: string;
    tagline?: ResolvedText;
    cta?: ResolvedText;
    metricLabel?: ResolvedText;
    value?: ResolvedNumber | null;
    caption?: ResolvedText;
  };
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function textSlot(raw: unknown, words: Word[], max: number): ResolvedText | null {
  const o = typeof raw === "string" ? { text: raw } : asObj(raw);
  if (!o) return null;
  const pair = Array.isArray(o.words) && o.words.length >= 2 ? o.words : null;
  const range: [number, number] | null = pair && pair.every((n) => typeof n === "number" && Number.isFinite(n)) ? [Math.round(pair[0] as number), Math.round(pair[1] as number)] : null;
  let text = typeof o.text === "string" ? o.text : "";
  if (range) {
    const lo = Math.max(0, Math.min(range[0], range[1]));
    const hi = Math.min(words.length - 1, Math.max(range[0], range[1]));
    text = hi >= lo ? words.slice(lo, hi + 1).map((w) => w.text).join(" ") : "";
  }
  const cut = cutWords(text, max);
  if (!cut) return null;
  return { text: cut, from: range ? range[0] : null, to: range ? range[1] : null };
}

export function numberSlot(raw: unknown, words: Word[]): ResolvedNumber | null {
  const o = asObj(raw);
  if (!o || typeof o.word !== "number" || !Number.isFinite(o.word)) return null;
  const word = Math.round(o.word);
  const value = typeof o.value === "string" ? o.value.trim() : "";
  if (!value) return null;
  const said = words[word]?.text ?? "";
  if (!wordContains(said, value)) return null;
  const unit = typeof o.unit === "string" ? cutWords(o.unit, 6) : null;
  return { value, unit, word };
}

const toBn = (s: string) => s.replace(/\d/g, (d) => BN[Number(d)] ?? d);

// Count a spoken token up from 0. Bengali digits stay Bengali. A suffix
// stuck to the number (% or x) stays as spoken.
export function countSpoken(value: string, k: number): string {
  const bn = /[০-৯]/.test(value);
  const ascii = foldDigits(value);
  const m = /(-?\d[\d,]*(?:\.\d+)?)/.exec(ascii);
  if (!m) return value;
  const raw = m[1].replace(/,/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return value;
  const dec = raw.includes(".") ? raw.split(".")[1].length : 0;
  const cur = n * Math.max(0, Math.min(1, k));
  const shown = dec ? cur.toFixed(dec) : String(Math.round(cur));
  const withSep = m[1].includes(",") ? Number(shown).toLocaleString("en-US") : shown;
  const out = ascii.replace(m[1], withSep);
  return bn ? toBn(out) : out;
}

export function resolveHero(raw: HeroT | null | undefined, words: Word[], brand: Brand): ResolvedHero | null {
  if (!raw) return null;
  const variant = Number.isFinite(raw.variant) ? Math.max(0, Math.round(raw.variant)) : 0;
  const layout = LAYOUTS[variant % LAYOUTS.length];
  const stagger = STAGGERS[Math.floor(variant / LAYOUTS.length) % STAGGERS.length];
  const slots = raw.slots ?? {};
  if (raw.id === "logo_end") {
    if (!brand.icon || !brand.name?.trim()) return null;
    const tagline = textSlot(slots.tagline, words, 36);
    const cta = textSlot(slots.cta, words, 24);
    return { id: "logo_end", variant, layout, stagger, exit: "none", slots: { brandName: brand.name.trim(), ...(tagline ? { tagline } : {}), ...(cta ? { cta } : {}) } };
  }
  if (raw.id === "growth_chart") {
    const metricLabel = textSlot(slots.metricLabel, words, 20);
    if (!metricLabel) return null;
    const value = slots.value == null ? null : numberSlot(slots.value, words);
    const caption = textSlot(slots.caption, words, 36);
    return { id: "growth_chart", variant, layout, stagger, exit: "zoom-in", slots: { metricLabel, value, ...(caption && caption.text !== metricLabel.text ? { caption } : {}) } };
  }
  return null;
}

export function cameraFor(id: "logo_end" | "growth_chart", current: CameraKind | null | undefined, prev: CameraKind | null, seed: number): CameraKind {
  const list = HERO_CAMERAS[id];
  if (current && list.includes(current) && current !== prev) return current;
  const pool = list.filter((c) => c !== prev);
  return pool[Math.abs(seed) % pool.length] ?? list[0];
}

// The ending hero was stored, but the render had no logo file to sign.
export function logoReachNote(hasLogo: boolean, scenes: { hero?: { id?: string } | null }[]): string | null {
  if (hasLogo || !scenes.some((s) => s.hero?.id === "logo_end")) return null;
  return "The ending hero needs the uploaded logo. No logo file reached the composition, so that hero is not drawn and no letter is substituted for it.";
}
