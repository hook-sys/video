import type { CSSProperties, ReactNode } from "react";
import type { Img as RemotionImg, spring as remotionSpring } from "remotion";
import { interpolate } from "remotion/no-react";
import { Icon } from "../icons";
import { type Face, familyOf } from "./faces";
import { fitWords } from "./fit";
import type { Geo } from "./geo";
import { SPRINGS, type Look } from "./theme";
import { type Brand, FPS, type Pace, type Scene } from "./types";

// What every template is made of: words coming in as they are said, an icon
// on a tile, a card, the brand's mark, a cursor, a number counting up.

// What plays the templates: the film passes Remotion's spring and image; the
// check before playing (check.ts, on the server, where Remotion cannot load)
// lays them out with every spring settled.
export type Play = { spring: typeof remotionSpring; Img: typeof RemotionImg };
export type C = { f: number; s: Scene; look: Look; pace: Pace; brand: Brand; g: Geo; play: Play };

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// a thing's spring from frame `at` (0 → 1, a visible settle)
export const springAt = (c: C, at: number, slow = 1) => {
  const { damping, stiffness, mass } = SPRINGS[c.pace];
  return c.play.spring({ frame: c.f - at, fps: FPS, config: { damping, stiffness: stiffness / slow, mass } });
};
export const stagger = (c: C) => SPRINGS[c.pace].stagger;
// a hex colour at an alpha
export function tint(hex: string, a: number): string {
  if (!/^#[0-9a-f]{6}/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// in: from below, settling (the spring's own small overshoot)
export const rise = (k: number, by = 60): CSSProperties => ({ opacity: clamp01(k * 1.6), transform: `translateY(${((1 - k) * by).toFixed(1)}px)` });
export const pop = (k: number): CSSProperties => ({ opacity: clamp01(k * 1.8), transform: `scale(${(0.6 + 0.4 * k).toFixed(4)})` });

// the keyword's look at a size: the accent colour, or (on the brand's own
// colour) the ground's colour on a plate of the brand colour made as light
// or as dark as the words
export const keyStyle = (look: Look, size: number): CSSProperties =>
  // (the plate a little deeper than the line, so letters that hang below it stay on it)
  look.plate ? { color: look.bg, background: look.plateFill, borderRadius: Math.round(size * 0.16), padding: `${Math.round(size * 0.02)}px ${Math.round(size * 0.14)}px ${Math.round(size * 0.1)}px`, margin: `0 ${-Math.round(size * 0.06)}px` } : { color: look.accent };

// The voice's words in their place: each as it is said, the key one in the
// accent colour (on the brand's own colour: on a plate, keyStyle) — or with an effect: struck
// through (what goes away), typed letter by letter, or the key word growing in.
export type Effect = "strike" | "type" | "pop";
export function Words({ c, width, lines, max, min, align = "center", color, effect, style }: { c: C; width: number; lines: number; max: number; min?: number; align?: "left" | "center" | "right"; color?: string; effect?: Effect; style?: CSSProperties }) {
  const { look } = c;
  const words = c.s.words;
  const fit = fitWords(words.map((w) => w.t), look.display, { width, lines, max, min });
  const lh = 1.08;
  const lastTyped = effect === "type" ? words.findLastIndex((w) => c.f >= w.at - 2) : -1;
  return (
    <div style={{ width, display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end", fontFamily: familyOf(look.display), fontWeight: 700, fontSize: fit.size, lineHeight: lh, letterSpacing: "-0.03em", color: color ?? look.ink, ...style }}>
      {fit.lines.map((line, li) => (
        <div key={li} style={{ display: "flex", gap: `0 ${(fit.size * 0.26).toFixed(0)}px`, whiteSpace: "nowrap" }}>
          {line.map((i) => {
            const w = words[i];
            const k = springAt(c, w.at - 2);
            const after = clamp01((c.f - w.at - 8) / 14);
            const lit = w.key && effect !== "strike";
            if (effect === "type") {
              // (its letters as they are said, a caret after the last one)
              const shown = c.f < w.at - 2 ? 0 : Math.min(w.t.length, Math.ceil((c.f - w.at + 3) / 1.6));
              return (
                <span key={i} style={{ display: "inline-block", position: "relative", ...(lit ? keyStyle(look, fit.size) : {}), opacity: shown ? 1 : 0 }}>
                  {w.t.slice(0, shown)}
                  <span style={{ opacity: 0 }}>{w.t.slice(shown)}</span>
                  {i === lastTyped && Math.floor(c.f / 8) % 2 === 0 && <span style={{ position: "absolute", right: -fit.size * 0.12, top: "8%", width: Math.max(4, fit.size * 0.06), height: "84%", background: look.accent }} />}
                </span>
              );
            }
            const grow = effect === "pop" && w.key ? springAt(c, w.at + 2, 0.8) : 1;
            return (
              <span key={i} style={{ display: "inline-block", position: "relative", ...rise(k, fit.size * 0.45), ...(lit ? keyStyle(look, fit.size) : {}), ...(effect === "pop" && w.key ? { transform: `${rise(k, fit.size * 0.45).transform} scale(${(1.35 - 0.35 * grow).toFixed(4)})` } : {}) }}>
                {w.t}
                {effect === "strike" && <span style={{ position: "absolute", left: -fit.size * 0.04, top: "52%", height: Math.max(6, fit.size * 0.08), width: `calc(${(ease(after) * 100).toFixed(1)}% + ${(ease(after) * fit.size * 0.08).toFixed(1)}px)`, background: look.bad, borderRadius: 99 }} />}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// An icon on a tile, one way everywhere: the accent's icon on a soft tile of
// the same colour (on a card: the card's accent), or solid — the accent tile.
export function Glyph({ c, name, size, solid = false, card = false, style }: { c: C; name: string; size: number; solid?: boolean; card?: boolean; style?: CSSProperties }) {
  const { look } = c;
  const accent = card ? look.panelAccent : look.accent;
  const on = card ? look.onPanelAccent : look.onAccent;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: solid ? accent : tint(accent, 0.14), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: solid ? `0 ${(size * 0.12).toFixed(0)}px ${(size * 0.3).toFixed(0)}px ${tint(accent, 0.28)}` : undefined, ...style }}>
      <Icon name={name} size={size * 0.5} color={solid ? on : accent} strokeWidth={2} />
    </div>
  );
}

// a card's surface
// (a thin border and a layered, soft shadow; on a dark ground: glass)
export const panel = (c: C, radius = 30): CSSProperties => ({ background: c.look.panelFill, border: `1px solid ${c.look.line}`, borderRadius: radius, boxShadow: `0 1px 2px ${c.look.shadow}, 0 18px 50px ${c.look.shadow}`, color: c.look.panelInk, fontFamily: familyOf(c.look.text) });

// The brand's mark: its logo, else its initial on the accent
export function Mark({ c, size }: { c: C; size: number }) {
  const { look, brand } = c;
  const { Img } = c.play;
  if (brand.icon) return <Img src={brand.icon} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: look.accent, color: look.onAccent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: familyOf(look.display), fontWeight: 800, fontSize: size * 0.52, flexShrink: 0 }}>
      {brand.name.trim().charAt(0).toUpperCase() || "•"}
    </div>
  );
}

// The big cursor: comes in, presses at `click`, a ring opens
export function Cursor({ c, from, to, click }: { c: C; from: { x: number; y: number }; to: { x: number; y: number }; click: number }) {
  const t = ease(clamp01((c.f - (click - 26)) / 22));
  if (c.f < click - 30) return null;
  const x = interpolate(t, [0, 1], [from.x, to.x]), y = interpolate(t, [0, 1], [from.y, to.y]) - Math.sin(t * Math.PI) * 40;
  const press = clamp01(1 - Math.abs(c.f - click) / 4);
  const ring = clamp01((c.f - click) / 18);
  const ink = c.look.dark ? "#ffffff" : "#111111";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: clamp01((c.f - click + 30) / 6) }}>
      {ring > 0 && ring < 1 && <div style={{ position: "absolute", left: to.x - 50, top: to.y - 50, width: 100, height: 100, borderRadius: 99, border: `4px solid ${c.look.accent}`, transform: `scale(${(0.3 + 1.3 * ring).toFixed(3)})`, opacity: 1 - ring }} />}
      <div style={{ position: "absolute", left: x - 24, top: y - 14, width: 110, height: 110, transform: `scale(${(1 - press * 0.15).toFixed(3)})`, transformOrigin: "22% 13%" }}>
        <svg width={110} height={110} viewBox="0 0 24 24">
          <path d="M5.9 4.4 L19.9 13.4 L12.9 14.9 L9.9 21.4 Z" fill="#000000" fillOpacity={c.look.dark ? 0.5 : 0.22} />
          <path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill={ink} stroke={c.look.dark ? "#111111" : "#ffffff"} strokeWidth={1.3} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// A number as said ("3x", "50%", "$2,400") counting up to itself
export function countUp(value: string, k: number): string {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value.trim());
  if (!m) return value;
  const [, pre, num, post] = m;
  const n = parseFloat(num.replace(/,/g, ""));
  const dec = num.includes(".") ? num.split(".")[1].length : 0;
  const now = n * clamp01(k);
  const shown = dec ? now.toFixed(dec) : Math.round(now).toString();
  return `${pre}${num.includes(",") ? Number(shown).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : shown}${post}`;
}

// a short line of UI text: one line, never wrapping; with `fit` its size
// comes down (to 0.6 of it at most) until it fits that width
export function One({ children, style, fit, face }: { children: ReactNode; style?: CSSProperties; fit?: number; face?: Face }) {
  const size = typeof style?.fontSize === "number" ? style.fontSize : null;
  const sized = fit && size && face && typeof children === "string" ? fitWords([children], face, { width: fit, lines: 1, max: size, min: Math.round(size * 0.6), weight: Number(style?.fontWeight ?? 600) }).size : size;
  return <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...style, ...(sized ? { fontSize: sized } : {}) }}>{children}</span>;
}
