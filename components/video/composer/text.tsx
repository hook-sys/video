import type { CSSProperties } from "react";
import { measureText } from "@remotion/layout-utils";
import { createRoundedTextBox } from "@remotion/rounded-text-box";
import type { Ctx } from "./kit";
import { clamp01, enterK, mix } from "./motion";
import type { TextBlock } from "./types";

// The spoken words on screen: each word comes in as it is said, in the art
// direction's face, case and tracking; the key words in its key style.

export function Headline({ c, tb, out = 0, plate, hide }: { c: Ctx; tb: TextBlock; out?: number; plate?: boolean; hide?: (wi: number) => boolean }) {
  const { art, pal, f, m } = c;
  const upper = art.case === "upper";
  const lower = art.case === "lower";
  const size = tb.size;
  const lh = upper ? 1.02 : 1.08;
  const box = tb.box;
  const lines = tb.lines;
  const kickerK = tb.kicker ? enterK(m, f, (tb.words[0]?.at ?? 0) - 8) : 0;
  return (
    <div style={{ position: "absolute", left: box.x - box.w / 2, top: box.y - box.h / 2, width: box.w, height: box.h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: tb.align === "center" ? "center" : tb.align === "right" ? "flex-end" : "flex-start", opacity: 1 - out, zIndex: 3 }}>
      {tb.kicker && (
        <div style={{ fontFamily: c.text, fontSize: Math.max(24, Math.round(size * 0.26)), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: pal.accent, marginBottom: Math.round(size * 0.22), opacity: clamp01(kickerK * 1.5), transform: `translateY(${(1 - kickerK) * 14}px)`, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 36 * kickerK, height: 3, background: pal.accent, borderRadius: 2 }} />
          {tb.kicker}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {plate && <Plate c={c} tb={tb} lh={lh} upper={upper} lower={lower} />}
        {lines.map((line, li) => (
          <div key={li} style={{ display: "flex", flexWrap: "nowrap", justifyContent: tb.align === "center" ? "center" : tb.align === "right" ? "flex-end" : "flex-start", lineHeight: lh, whiteSpace: "nowrap" }}>
            {line.map((wi) => {
              const w = tb.words[wi];
              const lineAt = tb.words[line[0]].at;
              const at = tb.reveal === "line" ? lineAt : w.at;
              const k = enterK(m, f, at - 2, tb.reveal === "type" ? Math.max(6, w.t.length * 1.6) : m.dur);
              const text = upper ? w.t.toUpperCase() : lower ? w.t.toLowerCase() : w.t;
              return (
                <span key={wi} style={{ position: "relative", display: "inline-block", marginRight: `${upper ? 0.24 : 0.26}em`, fontFamily: c.display, fontSize: size, fontWeight: art.weight, letterSpacing: `${art.tracking}em`, color: pal.ink, visibility: hide?.(wi) ? "hidden" : undefined, ...(tb.reveal === "mask" || tb.reveal === "rise" ? { overflow: tb.reveal === "mask" ? "hidden" : undefined, paddingBottom: "0.08em", marginBottom: "-0.08em" } : {}) }}>
                  <Word c={c} text={text} k={k} reveal={tb.reveal} keyed={w.key} at={at} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// The plate behind words laid over a picture: a box that hugs each line
// (Remotion's rounded text box, on the lines measured in the face), drawn as
// SVG so the download paints it as the Preview does.
function Plate({ c, tb, lh, upper, lower }: { c: Ctx; tb: TextBlock; lh: number; upper: boolean; lower: boolean }) {
  const { art, pal, f, m } = c;
  const size = tb.size;
  const gap = (upper ? 0.24 : 0.26) * size;
  const widthOf = (t: string) => (typeof document === "undefined" ? t.length * size * 0.55 : measureText({ text: upper ? t.toUpperCase() : lower ? t.toLowerCase() : t, fontFamily: c.display, fontSize: size, fontWeight: art.weight, letterSpacing: `${art.tracking}em`, validateFontIsLoaded: false }).width);
  const padY = size * 0.28;
  // a line's box opens as the line starts (the words fill it as they are said)
  const shown = tb.lines.map((line) => enterK(m, f, tb.words[line[0]].at - 6, 10)).filter((k) => k > 0);
  if (!shown.length) return null;
  const rows = shown.map((k, li) => {
    const line = tb.lines[li];
    const width = line.reduce((sum, wi) => sum + widthOf(tb.words[wi].t) + gap, 0);
    return { width: width * mix(0.4, 1, k), height: (size * lh + (li === 0 ? padY : 0) + (li === tb.lines.length - 1 ? padY : 0)) * (li === 0 ? 1 : k) };
  });
  const padX = size * 0.42;
  const { d, boundingBox: bb } = createRoundedTextBox({ textMeasurements: rows, textAlign: tb.align, horizontalPadding: padX, borderRadius: Math.max(18, size * 0.32) });
  const k = clamp01(enterK(m, f, (tb.words[0]?.at ?? 0) - 10) * 1.4);
  return (
    <svg width={bb.width} height={bb.height} style={{ position: "absolute", left: -padX, top: -padY, overflow: "visible", opacity: k, filter: `drop-shadow(0 24px 48px ${pal.shadow})` }}>
      <path d={d} fill={pal.dark ? "rgba(10,10,20,0.78)" : "rgba(255,255,255,0.9)"} />
    </svg>
  );
}

function Word({ c, text, k, reveal, keyed, at }: { c: Ctx; text: string; k: number; reveal: TextBlock["reveal"]; keyed: boolean; at: number }) {
  const { pal, art, f, m } = c;
  const r = 1 - k;
  let style: CSSProperties;
  switch (reveal) {
    case "mask": style = { display: "inline-block", transform: `translateY(${r * 105}%)` }; break;
    case "rise": style = { display: "inline-block", transform: `translateY(${r * 0.45}em)`, opacity: clamp01(k * 1.6), filter: r > 0.02 ? `blur(${r * 8}px)` : undefined }; break;
    case "scale": style = { display: "inline-block", transform: `scale(${mix(1.5, 1, k)})`, opacity: clamp01(k * 1.6), filter: r > 0.02 ? `blur(${r * 10}px)` : undefined }; break;
    case "blur": style = { display: "inline-block", opacity: clamp01(k * 1.3), filter: r > 0.02 ? `blur(${r * 22}px)` : undefined }; break;
    case "slide": style = { display: "inline-block", transform: `translateX(${-r * 0.6}em)`, opacity: clamp01(k * 1.6) }; break;
    case "type": style = { display: "inline-block", clipPath: `inset(-10% ${(1 - k) * 100}% -20% 0)` }; break;
    case "line": style = { display: "inline-block", transform: `translateY(${r * 0.35}em)`, opacity: clamp01(k * 1.5), filter: r > 0.02 ? `blur(${r * 10}px)` : undefined }; break;
    default: style = { display: "inline-block", transform: `translateY(${r * 0.18}em)`, opacity: clamp01(k * 1.4), filter: r > 0.02 ? `blur(${r * 12}px)` : undefined };
  }
  if (!keyed) return <span style={style}>{text}</span>;
  // the key word's moment: just after it is said
  const kk = enterK(m, f, at + 4, 16);
  const key = art.key;
  if (key === "pill")
    return (
      <span style={{ ...style, position: "relative", color: pal.onFill, padding: "0 0.22em", margin: "0 -0.1em" }}>
        <span style={{ position: "absolute", inset: "0.06em 0", borderRadius: Math.min(999, art.radius * 2 + 12), background: `linear-gradient(120deg, ${pal.fill}, ${pal.fill2})`, transform: `scaleX(${mix(0.3, 1, kk)})`, opacity: clamp01(kk * 2), zIndex: 0 }} />
        <span style={{ position: "relative", color: kk > 0.4 ? pal.onFill : pal.ink }}>{text}</span>
      </span>
    );
  if (key === "underline")
    return (
      <span style={{ ...style, position: "relative" }}>
        {text}
        <span style={{ position: "absolute", left: 0, bottom: "0.02em", height: "0.09em", width: `${kk * 100}%`, borderRadius: 99, background: pal.accent }} />
      </span>
    );
  if (key === "box")
    return (
      <span style={{ ...style, position: "relative" }}>
        <span style={{ position: "absolute", inset: "0.02em -0.14em", border: `0.05em solid ${pal.accent}`, borderRadius: Math.min(24, art.radius), clipPath: `inset(0 ${(1 - kk) * 100}% 0 0)` }} />
        {text}
      </span>
    );
  if (key === "outline") return <span style={{ ...style, color: kk > 0.3 ? "transparent" : pal.ink, WebkitTextStroke: `0.03em ${pal.accent}` }}>{text}</span>;
  if (key === "italic") return <span style={{ ...style, fontStyle: "italic", color: pal.accent }}>{text}</span>;
  if (key === "glow") return <span style={{ ...style, color: pal.accent, textShadow: `0 0 ${Math.round(30 * kk)}px ${pal.glow}` }}>{text}</span>;
  if (key === "gradient")
    return <span style={{ ...style, background: `linear-gradient(110deg, ${pal.accent}, ${pal.accent2})`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", paddingRight: "0.04em" }}>{text}</span>;
  return <span style={{ ...style, color: mixColor(kk, pal.ink, pal.accent) }}>{text}</span>;
}
const mixColor = (k: number, a: string, b: string) => (k > 0.5 ? b : a);
