import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Img } from "remotion";
import { Icon, resolveIcon } from "../icons";
import { type Pal, surfaceStyle } from "./art";
import { type Mover, clamp01, enterK, mix } from "./motion";
import type { ArtT, Brand } from "./types";

// What every Composer part draws with: the frame, the scene's palette, the
// art direction, its motion and faces, and the brand.
export type Ctx = { f: number; pal: Pal; art: ArtT; m: Mover; display: string; text: string; brand: Brand; screens: string[] };
export const CtxC = createContext<Ctx | null>(null);
export const useCtx = () => useContext(CtxC)!;

export const iconName = (name: string | null | undefined, fallback = "sparkles") => resolveIcon(name ?? "") ?? fallback;
export const surf = (c: Ctx, lift = 1, radius = c.art.radius): CSSProperties => surfaceStyle(c.art.surface, c.pal, radius, lift) as CSSProperties;

// A row / tile / pill coming in at `at` (0 → 1 on the art's curve).
export const kIn = (c: Ctx, at: number, dur?: number) => enterK(c.m, c.f, at, dur);
export const show = (k: number, dy = 18): CSSProperties => ({ opacity: clamp01(k * 1.5), transform: `translateY(${(1 - k) * dy}px)` });

// An icon in the art's icon style.
export function Glyph({ c, name, size, tone = "accent", k = 1 }: { c: Ctx; name: string | null | undefined; size: number; tone?: "accent" | "panel" | "fill2"; k?: number }) {
  const icon = iconName(name);
  const { pal, art } = c;
  const fill = tone === "fill2" ? pal.fill2 : pal.fill;
  const r = Math.min(size * 0.32, art.radius * 0.7 + 6);
  const box = (bg: string, color: string, extra?: CSSProperties) => (
    <div style={{ width: size, height: size, flexShrink: 0, borderRadius: art.icons === "round" ? 9999 : r, background: bg, display: "flex", alignItems: "center", justifyContent: "center", ...extra }}>
      <Icon name={icon} size={size * 0.5} color={color} strokeWidth={2.1} draw={k} />
    </div>
  );
  const onPanel = tone === "panel";
  // on a dark field an icon is a bright thing too (a lit tile)
  if (pal.dark && !onPanel && art.icons !== "tile" && art.icons !== "round" && art.icons !== "bare")
    return box("rgba(255,255,255,0.94)", fill, { border: "1.5px solid #ffffff", boxShadow: `0 ${size * 0.12}px ${size * 0.4}px ${pal.shadow}` });
  switch (art.icons) {
    case "bare": return <Icon name={icon} size={size * 0.86} color={onPanel ? pal.accent : pal.accent} strokeWidth={2} draw={k} />;
    case "outline": return box("transparent", onPanel ? pal.panelInk : pal.accent, { border: `2px solid ${onPanel ? pal.panelLine : pal.accent}` });
    case "duotone": return box(onPanel ? pal.panelSoft : `${fill}22`, fill, { border: `1.5px solid ${fill}33` });
    case "glass": return box(onPanel ? pal.panelSoft : "rgba(255,255,255,0.92)", pal.fill, { border: "1.5px solid rgba(255,255,255,1)", boxShadow: `0 10px 30px ${pal.shadow}` });
    default: return box(`linear-gradient(140deg, ${fill}, ${tone === "fill2" ? pal.fill : pal.fill2})`, pal.onFill, { boxShadow: `0 ${size * 0.14}px ${size * 0.4}px ${fill}55` });
  }
}

// A person is an initial, never a face.
export const Initial = ({ c, letter, size = 52, hue = 0 }: { c: Ctx; letter: string; size?: number; hue?: number }) => (
  <div style={{ width: size, height: size, borderRadius: 9999, flexShrink: 0, background: hue % 2 ? c.pal.fill2 : c.pal.fill, color: c.pal.onFill, fontWeight: 700, fontSize: size * 0.42, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: c.text, boxShadow: `0 0 0 3px ${c.pal.panel}` }}>
    {(letter.trim()[0] ?? "A").toUpperCase()}
  </div>
);

export const Tick = ({ c, size = 30, k = 1, color }: { c: Ctx; size?: number; k?: number; color?: string }) => (
  <div style={{ width: size, height: size, borderRadius: 9999, flexShrink: 0, background: color ?? c.pal.fill, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${mix(0.5, 1, clamp01(k))})`, opacity: clamp01(k * 2) }}>
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
      <path d="M5 12.5 L10 17 L19 7" stroke={c.pal.onFill} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${clamp01(k)} 1`} />
    </svg>
  </div>
);

export const Tag = ({ c, children, tone = "accent", style }: { c: Ctx; children: ReactNode; tone?: "accent" | "soft" | "good" | "warn"; style?: CSSProperties }) => {
  const { pal } = c;
  const bg = tone === "accent" ? `${pal.fill}1f` : tone === "good" ? "rgba(16,185,129,0.14)" : tone === "warn" ? "rgba(245,158,11,0.16)" : pal.panelSoft;
  const ink = tone === "accent" ? (pal.panelDark ? pal.accent : pal.fill) : tone === "good" ? (pal.panelDark ? "#6ee7b7" : "#047857") : tone === "warn" ? (pal.panelDark ? "#fcd34d" : "#b45309") : pal.panelSub;
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 999, background: bg, color: ink, fontSize: 19, fontWeight: 650, whiteSpace: "nowrap", ...style }}>{children}</span>;
};
export const toneOf = (tag: string | null | undefined): "accent" | "good" | "warn" | "soft" => {
  const t = (tag ?? "").toLowerCase();
  if (/paid|done|sent|live|ok|active|on|new|synced|ready|booked|won|\+/.test(t)) return "good";
  if (/late|due|wait|pending|overdue|soon|risk|-/.test(t)) return "warn";
  return t ? "accent" : "soft";
};

// The brand's mark: the uploaded icon, else a tile with its initial.
export function Mark({ c, size, k = 1 }: { c: Ctx; size: number; k?: number }) {
  if (c.brand.icon) return <Img src={c.brand.icon} style={{ width: size, height: size, objectFit: "contain", opacity: clamp01(k * 1.5) }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: Math.min(size * 0.3, c.art.radius + 8), background: `linear-gradient(140deg, ${c.pal.fill}, ${c.pal.fill2})`, display: "flex", alignItems: "center", justifyContent: "center", color: c.pal.onFill, fontFamily: c.display, fontWeight: 800, fontSize: size * 0.56, boxShadow: `0 ${size * 0.16}px ${size * 0.45}px ${c.pal.fill}55`, transform: `scale(${mix(0.6, 1, clamp01(k))}) rotate(${(1 - clamp01(k)) * -12}deg)`, opacity: clamp01(k * 2) }}>
      {(c.brand.name.trim()[0] ?? "B").toUpperCase()}
    </div>
  );
}

// The numeric part of "$12,480" / "98%" / "3x", counted from 0 at `k`.
export function countUp(value: string, k: number) {
  const m = /(-?\d[\d,]*(?:\.\d+)?)/.exec(value);
  if (!m) return value;
  const raw = m[1].replace(/,/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return value;
  const dec = raw.includes(".") ? raw.split(".")[1].length : 0;
  const cur = n * clamp01(k);
  const shown = dec ? cur.toFixed(dec) : Math.round(cur).toLocaleString("en-US");
  return value.replace(m[1], m[1].includes(",") || n >= 10000 ? shown : shown.replace(/,/g, ""));
}
