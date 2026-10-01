import type { FlowTheme } from "../themes";
import { ramp } from "../eval";
import { BlockView, blockHeight, palette } from "./blocks";
import type { Block, CardContent, CardStyle, CardTemplate } from "./types";

// Fill a template's blocks with content: "{slot}" in any string is replaced by
// the content (or the template's default); a string that is exactly "{items}"
// becomes the item list.
export function fillBlocks(tpl: CardTemplate, content: CardContent = {}): Block[] {
  const get = (k: string) => (content as Record<string, unknown>)[k] ?? (tpl.defaults as Record<string, unknown>)[k];
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (v === "{items}") {
        const items = get("items");
        return Array.isArray(items) ? items.map(String) : [];
      }
      return v.replace(/\{(\w+)\}/g, (_, k) => {
        const x = get(k);
        return Array.isArray(x) ? x.join(", ") : x === undefined ? "" : String(x);
      });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return tpl.blocks.map((b) => walk(b) as Block);
}

export const CARD_PAD = 28;
export const CARD_GAP = 14;

// Card size in world px (width from the template, height from its blocks).
export function cardSize(tpl: CardTemplate, content?: CardContent) {
  const inner = tpl.w - CARD_PAD * 2;
  const blocks = fillBlocks(tpl, content);
  const h = blocks.reduce((s, b) => s + blockHeight(b, inner), 0) + CARD_GAP * (blocks.length - 1) + CARD_PAD * 2;
  return { w: tpl.w, h: Math.round(h) };
}

// A card whose blocks cascade in from `t` = 0 (frames since the card began to
// appear) and then keep animating (counts, fills, ticks).
export function Card({ tpl, content, style, theme, t }: { tpl: CardTemplate; content?: CardContent; style: CardStyle; theme: FlowTheme; t: number }) {
  const p = palette(theme, style);
  const inner = tpl.w - CARD_PAD * 2;
  const blocks = fillBlocks(tpl, content);
  return (
    <div
      style={{
        width: tpl.w,
        boxSizing: "border-box",
        padding: CARD_PAD,
        borderRadius: 28,
        background: p.bg,
        border: `1.5px solid ${p.border}`,
        boxShadow: p.shadow,
        backdropFilter: p.blur ? "blur(22px)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: CARD_GAP,
        fontFamily: "inherit",
      }}
    >
      {blocks.map((b, i) => {
        const bt = t - i * 3;
        const k = ramp(bt, 0, 12, "out");
        return (
          <div key={i} style={{ opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
            <BlockView b={b} ctx={{ p, theme, t: bt, w: inner }} />
          </div>
        );
      })}
    </div>
  );
}
