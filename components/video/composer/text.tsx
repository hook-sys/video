import type { CSSProperties } from "react";
import { measureText } from "@remotion/layout-utils";
import { createRoundedTextBox } from "@remotion/rounded-text-box";
import type { Ctx } from "./kit";
import { clamp01, enterK, mix } from "./motion";
import type { TextBlock } from "./types";

// The spoken words on screen: each word comes in as it is said, in the art
// direction's face, case and tracking; the key words in its key style.

// (`si`: the scene it belongs to — marked for the frame check, probe.tsx)
export function Headline({ c, tb, out = 0, plate, hide, si }: { c: Ctx; tb: TextBlock; out?: number; plate?: boolean; hide?: (wi: number) => boolean; si?: number }) {
  const { art, pal, f, m } = c;
  const upper = art.case === "upper";
  const lower = art.case === "lower";
  const size = tb.size;
  const lh = upper ? 1.02 : 1.08;
  const box = tb.box;
  const lines = tb.lines;
  const kickerK = tb.kicker ? enterK(m, f, (tb.words[0]?.at ?? 0) - 8) : 0;
  if (tb.reveal === "beat") return <Beat c={c} tb={tb} si={si} hide={hide} />;
  return (
    <div data-scene={si} style={{ position: "absolute", left: box.x - box.w / 2, top: box.y - box.h / 2, width: box.w, height: box.h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: tb.align === "center" ? "center" : tb.align === "right" ? "flex-end" : "flex-start", opacity: 1 - out, zIndex: 3 }}>
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
                <span key={wi} data-qa="word" data-key={`${si ?? 0}:w${wi}`} style={{ position: "relative", display: "inline-block", marginRight: `${upper ? 0.24 : 0.26}em`, fontFamily: c.display, fontSize: size, fontWeight: art.weight, letterSpacing: `${art.tracking}em`, color: pal.ink, visibility: hide?.(wi) ? "hidden" : undefined, ...(tb.reveal === "mask" || tb.reveal === "rise" ? { overflow: tb.reveal === "mask" ? "hidden" : undefined, paddingBottom: "0.08em", marginBottom: "-0.08em" } : {}) }}>
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
    <svg width={bb.width} height={bb.height + 24} style={{ position: "absolute", left: -padX, top: -padY, overflow: "visible", opacity: k }}>
      {/* (its shadow a soft copy below it: the download draws an SVG's drop-shadow filter as nothing) */}
      <path d={d} fill={pal.shadow} opacity={0.5} transform="translate(0 16)" />
      <path d={d} fill={pal.dark ? "rgba(10,10,20,0.78)" : "rgba(255,255,255,0.9)"} />
    </svg>
  );
}

// One word at a time (refs 24, 26): each word big in the middle of the
// words' place as it is said, replacing the one before (held at least 12
// frames, so each can be read); the key words in the key style.
function Beat({ c, tb, si, hide }: { c: Ctx; tb: TextBlock; si?: number; hide?: (wi: number) => boolean }) {
  const { art, f, m } = c;
  const upper = art.case === "upper";
  const lower = art.case === "lower";
  const starts: number[] = [];
  tb.words.forEach((w, i) => starts.push(Math.max(w.at - 2, i ? starts[i - 1] + 12 : -Infinity)));
  const wi = starts.findLastIndex((s) => s <= f);
  if (wi < 0 || hide?.(wi)) return null;
  const w = tb.words[wi];
  const text = upper ? w.t.toUpperCase() : lower ? w.t.toLowerCase() : w.t;
  const box = tb.box;
  const est = (typeof document === "undefined" ? text.length * 0.6 : measureText({ text, fontFamily: c.display, fontSize: 100, fontWeight: art.weight, letterSpacing: `${art.tracking}em`, validateFontIsLoaded: false }).width / 100) || 1;
  const size = Math.max(tb.size, Math.min(tb.size * 2, (box.w * 0.94) / est, box.h * 0.9));
  const k = enterK(m, f, starts[wi], 8);
  return (
    <div data-scene={si} style={{ position: "absolute", left: box.x - box.w / 2, top: box.y - box.h / 2, width: box.w, height: box.h, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
      <span data-qa="word" data-key={`${si ?? 0}:w${wi}`} style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: c.display, fontSize: size, fontWeight: art.weight, letterSpacing: `${art.tracking}em`, color: c.pal.ink, transform: `scale(${mix(1.18, 1, k).toFixed(4)})`, opacity: clamp01(k * 2) }}>
        <Word c={c} text={text} k={1} reveal="word" keyed={w.key} at={starts[wi] + 2} />
      </span>
    </div>
  );
}

// a word's letters, scattered (seeded by the word) and coming together as k goes to 1 (ref 15)
function Letters({ text, k }: { text: string; k: number }) {
  const r = 1 - k;
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return (
    <>
      {[...text].map((ch, i) => {
        const a = ((h >>> (i % 24)) % 360) * (Math.PI / 180) + i * 2.4;
        const d = 0.9 + ((i * 37 + h) % 7) / 6;
        const kk = clamp01(k * 1.25 - (i % 5) * 0.05);
        const rr = 1 - kk;
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translate(${(Math.cos(a) * d * rr).toFixed(3)}em, ${(Math.sin(a) * d * rr).toFixed(3)}em) rotate(${((((h >> i) % 90) - 45) * rr).toFixed(1)}deg) scale(${mix(0.6, 1, kk).toFixed(3)})`, opacity: clamp01(kk * 1.8 + (r < 0.02 ? 1 : 0)) }}>
            {ch}
          </span>
        );
      })}
    </>
  );
}

function Word({ c, text, k, reveal, keyed, at }: { c: Ctx; text: string; k: number; reveal: TextBlock["reveal"]; keyed: boolean; at: number }) {
  const { pal, art, f, m } = c;
  const r = 1 - k;
  let style: CSSProperties;
  // (the letters themselves move: assemble)
  const body = reveal === "assemble" && k < 1 ? <Letters text={text} k={k} /> : text;
  switch (reveal) {
    case "assemble": style = { display: "inline-block" }; break;
    // (wide-spaced, closing up to the face's own spacing; the space it takes is the word's own)
    case "track": style = { display: "inline-block", letterSpacing: `${(r * 0.32).toFixed(3)}em`, marginRight: `${(-r * 0.32 * text.length).toFixed(3)}em`, opacity: clamp01(k * 1.5), filter: r > 0.02 ? `blur(${r * 6}px)` : undefined }; break;
    case "mask": style = { display: "inline-block", transform: `translateY(${r * 105}%)` }; break;
    case "rise": style = { display: "inline-block", transform: `translateY(${r * 0.45}em)`, opacity: clamp01(k * 1.6), filter: r > 0.02 ? `blur(${r * 8}px)` : undefined }; break;
    case "scale": style = { display: "inline-block", transform: `scale(${mix(1.5, 1, k)})`, opacity: clamp01(k * 1.6), filter: r > 0.02 ? `blur(${r * 10}px)` : undefined }; break;
    case "blur": style = { display: "inline-block", opacity: clamp01(k * 1.3), filter: r > 0.02 ? `blur(${r * 22}px)` : undefined }; break;
    // (from the right: a word sliding in from the left runs into the one before it)
    case "slide": style = { display: "inline-block", transform: `translateX(${r * 0.45}em)`, opacity: clamp01(k * 1.6) }; break;
    case "type": style = { display: "inline-block", clipPath: `inset(-10% ${(1 - k) * 100}% -20% 0)` }; break;
    case "line": style = { display: "inline-block", transform: `translateY(${r * 0.35}em)`, opacity: clamp01(k * 1.5), filter: r > 0.02 ? `blur(${r * 10}px)` : undefined }; break;
    default: style = { display: "inline-block", transform: `translateY(${r * 0.18}em)`, opacity: clamp01(k * 1.4), filter: r > 0.02 ? `blur(${r * 12}px)` : undefined };
  }
  if (!keyed) return <span style={style}>{body}</span>;
  // the key word's moment: just after it is said
  const kk = enterK(m, f, at + 4, 16);
  const key = art.key;
  if (key === "pill")
    return (
      <span style={{ ...style, position: "relative", color: pal.onFill, padding: "0 0.22em", margin: "0 -0.1em" }}>
        <span style={{ position: "absolute", inset: "0.06em 0", borderRadius: Math.min(999, art.radius * 2 + 12), background: `linear-gradient(120deg, ${pal.fill}, ${pal.fill2})`, transform: `scaleX(${mix(0.3, 1, kk)})`, opacity: clamp01(kk * 2), zIndex: 0 }} />
        <span style={{ position: "relative", color: kk > 0.4 ? pal.onFill : pal.ink }}>{body}</span>
      </span>
    );
  if (key === "underline")
    return (
      <span style={{ ...style, position: "relative" }}>
        {body}
        <span style={{ position: "absolute", left: 0, bottom: "0.02em", height: "0.09em", width: `${kk * 100}%`, borderRadius: 99, background: pal.accent }} />
      </span>
    );
  if (key === "box")
    return (
      <span style={{ ...style, position: "relative" }}>
        <span style={{ position: "absolute", inset: "0.02em -0.14em", border: `0.05em solid ${pal.accent}`, borderRadius: Math.min(24, art.radius), clipPath: `inset(0 ${(1 - kk) * 100}% 0 0)` }} />
        {body}
      </span>
    );
  if (key === "outline") return <span style={{ ...style, color: kk > 0.3 ? "transparent" : pal.ink, WebkitTextStroke: `0.03em ${pal.accent}` }}>{body}</span>;
  if (key === "italic") return <span style={{ ...style, fontStyle: "italic", color: pal.accent }}>{body}</span>;
  if (key === "glow") return <span style={{ ...style, color: pal.accent, textShadow: `0 0 ${Math.round(30 * kk)}px ${pal.glow}` }}>{body}</span>;
  if (key === "gradient")
    return <span style={{ ...style, background: `linear-gradient(110deg, ${pal.accent}, ${pal.accent2})`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", paddingRight: "0.04em" }}>{body}</span>;
  return <span style={{ ...style, color: mixColor(kk, pal.ink, pal.accent) }}>{body}</span>;
}
const mixColor = (k: number, a: string, b: string) => (k > 0.5 ? b : a);
