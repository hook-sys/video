import { Icon } from "../icons";
import { familyOf } from "./faces";
import { TYPE, WEIGHT } from "./geo";
import { type C, rad, One, clamp01, ease, springAt } from "./kit";
import { TINTS } from "./panel";
import { Band, abs } from "./scenes";
import type { Scene } from "./types";
import { DECK_VARIANTS } from "./rows";

// The deck (docs/video-spec.md, Cards): the things a beat names as cards dealt from a
// stack — each flies to its place turning over (its back the colour of its tile), lands
// with a light sweeping across it, and floats; its icon in a glossy tile, its word under
// it. Two side by side, three two-and-one, four two by two (a wide frame: a row). In place
// of a product's screenshots: the owner's choice for Bangla videos — cards, moving.

export const dealAt = (s: Scene, k: number) => Math.max(s.from + 6 + k * 7, (s.tiles?.[k]?.at ?? s.from) - 6);

export function Deck({ c }: { c: C }) {
  // (its other designs: rows.tsx)
  const Alt = DECK_VARIANTS[c.s.variant];
  if (Alt) return <Alt c={c} />;
  const { s, f, look, g } = c;
  const cards = (s.tiles ?? []).slice(0, 4);
  const n = cards.length;
  const wide = g.shape === "wide";
  const cols = wide ? n : n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const cw = wide ? 360 : 450, ch = wide ? 420 : 540, gap = 36;
  const dw = cols * cw + (cols - 1) * gap, dh = rows * ch + (rows - 1) * gap;
  // (where each lands; a last odd one centred)
  const slot = (k: number) => {
    const r = Math.floor(k / cols), q = k % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const x0 = (dw - (inRow * cw + (inRow - 1) * gap)) / 2;
    return { x: x0 + q * (cw + gap), y: r * (ch + gap) };
  };
  return (
    <Band c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 0, top: 0, width: dw, height: dh, perspective: 1600 })}>
        {cards.map((t, k) => {
          const at = dealAt(s, k);
          const p = ease(clamp01((f - at) / 16));
          const settle = springAt(c, at + 10, 1.2);
          const { x, y } = slot(k);
          // (from the stack, low in the middle, to its place)
          const sx = (dw - cw) / 2, sy = dh + 60;
          const cx = sx + (x - sx) * p, cy = sy + (y - sy) * p - Math.sin(p * Math.PI) * 120;
          const turn = 180 * (1 - p);
          const [a, b] = TINTS[k % TINTS.length];
          const float = Math.sin((f - at) / 26 + k * 1.4) * 6 * clamp01((f - at - 20) / 12);
          const sweep = clamp01((f - at - 14) / 22);
          const front = turn < 90;
          return (
            <div key={k} style={abs({ left: cx, top: cy + float, width: cw, height: ch, opacity: clamp01((f - at + 2) / 6), transform: `rotateY(${turn.toFixed(1)}deg) rotateZ(${((1 - settle) * (k % 2 ? 5 : -5)).toFixed(2)}deg) scale(${(0.8 + 0.2 * settle).toFixed(4)})`, transformStyle: "preserve-3d" })}>
              {front ? (
                <div style={{ position: "absolute", inset: 0, borderRadius: rad(c, 36), background: look.panelFill, border: look.cardBorder ?? `1px solid ${look.line}`, boxShadow: look.cardShadow ?? `0 0 0 1px ${look.ring ?? "transparent"}, 0 24px 60px ${look.shadow}`, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ch * 0.5, background: `linear-gradient(160deg, ${a}33, ${b}14)` }} />
                  <div data-part="item-icon" style={{ marginTop: ch * 0.13, width: cw * 0.42, height: cw * 0.42, borderRadius: cw * 0.11, background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `inset 0 6px 9px rgba(255,255,255,0.5), 0 16px 34px ${b}55`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <Icon name={t.icon} size={cw * 0.22} color="#ffffff" strokeWidth={2.2} />
                  </div>
                  <div style={{ marginTop: ch * 0.1, width: cw - 50, display: "flex", justifyContent: "center", position: "relative" }}>
                    <One part="item" face={look.display} fit={cw - 50} style={{ fontFamily: familyOf(look.display), fontSize: TYPE.ITEM * 1.25, fontWeight: WEIGHT.item, color: look.panelInk }}>{t.text}</One>
                  </div>
                  {/* the light across it as it lands */}
                  {sweep > 0 && sweep < 1 && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 60%)", backgroundSize: "300% 100%", backgroundPosition: `${(130 - 160 * sweep).toFixed(1)}% 0` }} />}
                </div>
              ) : (
                <div style={{ position: "absolute", inset: 0, borderRadius: rad(c, 36), background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `0 24px 60px ${b}44`, transform: "rotateY(180deg)" }}>
                  <div style={{ position: "absolute", inset: 18, borderRadius: rad(c, 24), border: "3px solid rgba(255,255,255,0.35)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Band>
  );
}
