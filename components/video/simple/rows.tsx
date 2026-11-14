import type { CSSProperties } from "react";
import { Icon } from "../icons";
import { familyOf } from "./faces";
import { TYPE, WEIGHT } from "./geo";
import { type C, Mark, One, clamp01, ease, panel, rad, springAt, tint } from "./kit";
import { Mini, TINTS, kindOf, rowAt } from "./panel";
import { dealAt } from "./deck";
import { Band, abs } from "./scenes";

// More ways to show a beat's things (docs/video-spec.md, Variants): the panel's rows and the
// deck's cards laid out and brought in other ways. Every thing still comes in as its word is
// said (rowAt, dealAt — the picture is the word said), each its own tile colour and icon;
// the words said stay in their band. A panel that goes on (Scene.carry) keeps its layout:
// laid out for the most rows it comes to (Scene.rows).

const MOST = 5;
type Row = { text: string; icon: string; at: number };

// the glossy tile of row k: its colours, its icon in white
function Tile({ c, k, icon, size }: { c: C; k: number; icon: string; size: number }) {
  const [a, b] = TINTS[k % TINTS.length];
  return (
    <div data-part="item-icon" style={{ width: size, height: size, borderRadius: rad(c, size * 0.27), background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `inset 0 ${(size * 0.05).toFixed(0)}px ${(size * 0.07).toFixed(0)}px rgba(255,255,255,0.5), 0 ${(size * 0.12).toFixed(0)}px ${(size * 0.28).toFixed(0)}px ${b}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...(c.look.style === "bold" ? { border: `${Math.max(2, size * 0.03).toFixed(1)}px solid ${c.look.line}` } : {}) }}>
      <Icon name={icon} size={size * 0.52} color="#ffffff" strokeWidth={2.2} />
    </div>
  );
}
const label = (c: C, size: number, fit: number, text: string, style: CSSProperties = {}) => (
  <One part="item" face={c.look.display} fit={fit} style={{ fontFamily: familyOf(c.look.display), fontSize: Math.round(size), fontWeight: WEIGHT.item, color: c.look.panelInk, ...style }}>{text}</One>
);
const rowsOf = (c: C): Row[] => (c.s.tiles ?? []).slice(0, MOST);
// the most rows the layout is made for (a panel going on keeps its place)
const most = (c: C, n: number) => Math.min(MOST, Math.max(n, c.s.rows ?? 0, 1));
// the row said last (all lit at the end)
const nowOf = (c: C, rows: Row[]) => rows.reduce((a, _, k) => (c.f >= rowAt(c.s, k) ? k : a), -1);

// 1 · pills: each thing a pill of its own, sliding in from alternate sides
function Pills({ c }: { c: C }) {
  const rows = rowsOf(c);
  const m = most(c, rows.length);
  const tall = c.g.shape === "tall";
  const pw = 880, ph = tall ? 172 : 136, gap = tall ? 30 : 24;
  const dh = m * ph + (m - 1) * gap;
  const now = nowOf(c, rows);
  return (
    <Band c={c} dw={pw} dh={dh}>
      {rows.map((r, k) => {
        const at = rowAt(c.s, k);
        const kr = springAt(c, at);
        const from = (k % 2 ? 1 : -1) * 320;
        const lit = k === now ? clamp01((c.f - at + 3) / 8) : 0;
        return (
          <div key={k} style={abs({ left: 0, top: k * (ph + gap), width: pw, height: ph, ...panel(c, 99), display: "flex", alignItems: "center", gap: 28, padding: "0 34px 0 18px", boxSizing: "border-box", opacity: clamp01(kr * 1.6), transform: `translateX(${((1 - kr) * from).toFixed(1)}px) scale(${(1 + 0.03 * lit).toFixed(4)})` })}>
            <Tile c={c} k={k} icon={r.icon} size={tall ? 120 : 100} />
            <div style={{ flex: 1, minWidth: 0 }}>{label(c, TYPE.ITEM * (tall ? 1.2 : 1.05), 520, r.text)}</div>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: lit ? TINTS[k % TINTS.length][1] : tint(c.look.panelInk, 0.12), flexShrink: 0 }} />
          </div>
        );
      })}
    </Band>
  );
}

// 2 · grid: a card for each — its tile, its word and its small picture — popping in, two by two
function Grid({ c }: { c: C }) {
  const rows = rowsOf(c);
  const m = most(c, rows.length);
  const cols = m <= 1 ? 1 : m <= 4 ? 2 : 3;
  const lines = Math.ceil(m / cols);
  const cw = cols === 3 ? 300 : 400, ch = c.g.shape === "tall" ? 400 : 330, gap = 28;
  const dw = cols * cw + (cols - 1) * gap, dh = lines * ch + (lines - 1) * gap;
  return (
    <Band c={c} dw={dw} dh={dh}>
      {rows.map((r, k) => {
        const at = rowAt(c.s, k);
        const kr = springAt(c, at);
        const [, b] = TINTS[k % TINTS.length];
        const x = (k % cols) * (cw + gap), y = Math.floor(k / cols) * (ch + gap);
        return (
          <div key={k} style={abs({ left: x, top: y, width: cw, height: ch, ...panel(c, 34), padding: 26, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: clamp01(kr * 1.8), transform: `scale(${(0.7 + 0.3 * kr).toFixed(4)}) rotate(${((1 - kr) * (k % 2 ? 6 : -6)).toFixed(2)}deg)` })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Tile c={c} k={k} icon={r.icon} size={96} />
              <div style={{ position: "relative", width: cw - 26 * 2 - 96 - 20, height: 80, overflow: "hidden" }}>
                <Mini kind={kindOf(r.icon)} w={cw - 26 * 2 - 96 - 20} h={80} f={c.f} at={at} col={b} soft={tint(b, 0.2)} line={tint(c.look.panelInk, 0.12)} />
              </div>
            </div>
            {label(c, TYPE.ITEM * 1.05, cw - 52, r.text)}
          </div>
        );
      })}
    </Band>
  );
}

// 3 · timeline: a line drawing down, a node lighting on it for each, its card beside it
function Timeline({ c }: { c: C }) {
  const rows = rowsOf(c);
  const m = most(c, rows.length);
  const step = c.g.shape === "tall" ? 206 : 168, dw = 840, dh = m * step - 24;
  const now = nowOf(c, rows);
  // (the line drawn down to the newest node, from the one before it)
  const to = Math.max(0, now) * step, was = Math.max(0, now - 1) * step;
  const line = was + (to - was) * ease(clamp01((c.f - rowAt(c.s, Math.max(0, now))) / 12));
  return (
    <Band c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 46, top: step / 2 - 12, width: 4, height: Math.max(0, (m - 1) * step), borderRadius: 2, background: tint(c.look.ink, 0.12) })} />
      <div style={abs({ left: 46, top: step / 2 - 12, width: 4, height: line, borderRadius: 2, background: c.look.accentFill })} />
      {rows.map((r, k) => {
        const at = rowAt(c.s, k);
        const kr = springAt(c, at);
        const [a, b] = TINTS[k % TINTS.length];
        const lit = k === now ? 1 : 0.6;
        const y = k * step;
        return (
          <div key={k}>
            <div style={abs({ left: 30, top: y + step / 2 - 12 - 18, width: 36, height: 36, borderRadius: 18, background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `0 0 0 ${(8 * kr * lit).toFixed(1)}px ${tint(b, 0.18)}`, transform: `scale(${(0.4 + 0.6 * kr).toFixed(4)})`, opacity: clamp01(kr * 2) })} />
            <div style={abs({ left: 100, top: y, width: dw - 100, height: step - 24, ...panel(c, 28), display: "flex", alignItems: "center", gap: 24, padding: "0 28px", boxSizing: "border-box", opacity: clamp01(kr * 1.6), transform: `translateX(${((1 - kr) * 60).toFixed(1)}px)` })}>
              <Tile c={c} k={k} icon={r.icon} size={88} />
              {label(c, TYPE.ITEM, dw - 100 - 56 - 88 - 24, r.text)}
            </div>
          </div>
        );
      })}
    </Band>
  );
}

// 4 · focus: the thing just said big in the middle; those before it in a strip above
function Focus({ c }: { c: C }) {
  const rows = rowsOf(c);
  const dw = 900, dh = 780;
  const now = Math.max(0, nowOf(c, rows));
  const chip = 150, gap = 22;
  return (
    <Band c={c} dw={dw} dh={dh}>
      {rows.map((r, k) => {
        const at = rowAt(c.s, k);
        if (c.f < at - 2) return null;
        // (big while it is the one said; then it goes up into the strip)
        const nextAt = k + 1 < rows.length ? rowAt(c.s, k + 1) : Infinity;
        const up = k < now ? ease(clamp01((c.f - nextAt) / 14)) : 0;
        const kr = springAt(c, at);
        const n = Math.max(1, now);
        const sx = (dw - (n * chip + (n - 1) * gap)) / 2 + k * (chip + gap);
        const big = 320;
        const bx = (dw - big) / 2, by = 230;
        const x = bx + (sx - bx) * up, y = by + (0 - by) * up;
        const size = big + (chip - big) * up;
        return (
          <div key={k} style={abs({ left: x, top: y, width: size, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * (1 - up) + 8, opacity: clamp01(kr * 1.8), transform: `scale(${(0.6 + 0.4 * kr).toFixed(4)})` })}>
            <Tile c={c} k={k} icon={r.icon} size={size * 0.8} />
            {label(c, TYPE.ITEM * (1.5 - 0.75 * up), Math.max(chip, size * 1.6), r.text, { color: c.look.ink, textAlign: "center" })}
          </div>
        );
      })}
    </Band>
  );
}

// 5 · checklist: a card of rows, each box ticking as its word is said
function Checklist({ c }: { c: C }) {
  const rows = rowsOf(c);
  const m = most(c, rows.length);
  const rh = c.g.shape === "tall" ? 164 : 130, dw = 860, dh = m * rh + 40;
  return (
    <Band c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 0, top: 0, width: dw, height: dh, ...panel(c, 36), opacity: clamp01(springAt(c, c.s.carry ? c.s.from - 30 : c.s.from + 2) * 1.6) })}>
        {rows.map((r, k) => {
          const at = rowAt(c.s, k);
          const kr = springAt(c, at);
          const tick = ease(clamp01((c.f - at - 4) / 10));
          const [, b] = TINTS[k % TINTS.length];
          return (
            <div key={k} style={abs({ left: 30, right: 30, top: 20 + k * rh, height: rh - 10, display: "flex", alignItems: "center", gap: 26, borderBottom: k < m - 1 ? `1px solid ${tint(c.look.panelInk, 0.07)}` : undefined, opacity: clamp01(kr * 1.6), transform: `translateY(${((1 - kr) * 24).toFixed(1)}px)` })}>
              <div style={{ width: 62, height: 62, borderRadius: rad(c, 18), border: `3px solid ${tick > 0.05 ? b : tint(c.look.panelInk, 0.25)}`, background: tint(b, 0.14 * tick), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="38" height="38" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={b} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" strokeDashoffset={(24 * (1 - tick)).toFixed(2)} /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>{label(c, TYPE.ITEM * 1.05, dw - 60 - 62 - 26 - 72 - 26, r.text)}</div>
              <Tile c={c} k={k} icon={r.icon} size={72} />
            </div>
          );
        })}
      </div>
    </Band>
  );
}

// 6 · bars: each thing a bar growing out from its tile, the first the longest
function Bars({ c }: { c: C }) {
  const rows = rowsOf(c);
  const m = most(c, rows.length);
  const step = c.g.shape === "tall" ? 190 : 160, dw = 900, dh = m * step - 20;
  const lens = [1, 0.84, 0.7, 0.58, 0.48];
  return (
    <Band c={c} dw={dw} dh={dh}>
      {rows.map((r, k) => {
        const at = rowAt(c.s, k);
        const kr = springAt(c, at);
        const grow = ease(clamp01((c.f - at - 2) / 18));
        const [a, b] = TINTS[k % TINTS.length];
        const track = dw - 110 - 20;
        return (
          <div key={k} style={abs({ left: 0, top: k * step, width: dw, height: step - 20, opacity: clamp01(kr * 1.8) })}>
            <div style={abs({ left: 0, top: (step - 20 - 90) / 2 })}><Tile c={c} k={k} icon={r.icon} size={90} /></div>
            <div style={abs({ left: 110, top: 0, width: track, height: 64, display: "flex", alignItems: "flex-end" })}>{label(c, TYPE.ITEM * 0.95, track, r.text, { color: c.look.ink, lineHeight: 1.25 })}</div>
            <div style={abs({ left: 110, top: 82, width: track, height: 40, borderRadius: rad(c, 20), background: tint(c.look.ink, 0.08) })} />
            <div style={abs({ left: 110, top: 82, width: track * lens[k] * grow, height: 40, borderRadius: rad(c, 22), background: `linear-gradient(90deg, ${a}, ${b})`, boxShadow: `0 8px 24px ${b}44` })} />
          </div>
        );
      })}
    </Band>
  );
}

// 7 · hub: the brand's mark in the middle, each thing a node round it, a line drawn out to it
function Hub({ c }: { c: C }) {
  const rows = rowsOf(c);
  const m = most(c, rows.length);
  const dw = 900, dh = 900, cx = dw / 2, cy = dh / 2, R = 320, node = 132;
  const k0 = springAt(c, c.s.carry ? c.s.from - 30 : c.s.from + 2);
  const pos = (k: number) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / Math.max(m, 3);
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  };
  return (
    <Band c={c} dw={dw} dh={dh}>
      <svg width={dw} height={dh} style={abs({ left: 0, top: 0 })}>
        {rows.map((_, k) => {
          const { x, y } = pos(k);
          const t = ease(clamp01((c.f - rowAt(c.s, k) + 6) / 12));
          return <line key={k} x1={cx} y1={cy} x2={cx + (x - cx) * t} y2={cy + (y - cy) * t} stroke={TINTS[k % TINTS.length][1]} strokeOpacity={0.45} strokeWidth={4} strokeDasharray="10 10" />;
        })}
      </svg>
      <div style={abs({ left: cx - 110, top: cy - 110, width: 220, height: 220, borderRadius: 110, ...panel(c, 99), display: "flex", alignItems: "center", justifyContent: "center", opacity: clamp01(k0 * 1.6), transform: `scale(${(0.7 + 0.3 * k0).toFixed(4)})` })}>
        <Mark c={c} size={120} />
      </div>
      {rows.map((r, k) => {
        const { x, y } = pos(k);
        const kr = springAt(c, rowAt(c.s, k));
        return (
          <div key={k} style={abs({ left: x - 130, top: y - node / 2, width: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: clamp01(kr * 1.8), transform: `scale(${(0.5 + 0.5 * kr).toFixed(4)})` })}>
            <Tile c={c} k={k} icon={r.icon} size={node} />
            {label(c, TYPE.ITEM * 0.95, 260, r.text, { color: c.look.ink, textAlign: "center" })}
          </div>
        );
      })}
    </Band>
  );
}

export const PANEL_VARIANTS = [null, Pills, Grid, Timeline, Focus, Checklist, Bars, Hub] as const;

// ── the deck, other ways ──
type Card = Row;
const cardsOf = (c: C): Card[] => (c.s.tiles ?? []).slice(0, 4);
function Face({ c, k, t, w, h }: { c: C; k: number; t: Card; w: number; h: number }) {
  const [a, b] = TINTS[k % TINTS.length];
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: rad(c, 34), background: c.look.panelFill, border: c.look.cardBorder ?? `1px solid ${c.look.line}`, boxShadow: c.look.cardShadow ?? `0 24px 60px ${c.look.shadow}`, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: h * 0.08 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: h * 0.5, background: `linear-gradient(160deg, ${a}33, ${b}14)` }} />
      <div style={{ position: "relative" }}><Tile c={c} k={k} icon={t.icon} size={w * 0.42} /></div>
      <div style={{ position: "relative", width: w - 40, display: "flex", justifyContent: "center" }}>{label(c, TYPE.ITEM * 1.15, w - 40, t.text)}</div>
    </div>
  );
}

// 1 · fan: the cards spread from one point like a hand, each turning out to its place
function Fan({ c }: { c: C }) {
  const cards = cardsOf(c);
  const n = Math.max(1, cards.length);
  const cw = 360, ch = 470, dw = 1000, dh = 640;
  return (
    <Band c={c} dw={dw} dh={dh}>
      {cards.map((t, k) => {
        const at = dealAt(c.s, k);
        const p = springAt(c, at, 1.1);
        const spread = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2;
        const ang = spread * 16 * p;
        const x = dw / 2 - cw / 2 + spread * 230 * p;
        return (
          <div key={k} style={abs({ left: x, top: dh - ch - 20 + Math.abs(spread) * 40 * p, width: cw, height: ch, transformOrigin: "50% 120%", transform: `rotate(${ang.toFixed(2)}deg) translateY(${((1 - p) * 120).toFixed(1)}px)`, opacity: clamp01((c.f - at + 2) / 6) })}>
            <Face c={c} k={k} t={t} w={cw} h={ch} />
          </div>
        );
      })}
    </Band>
  );
}

// 2 · pile: each card slides in from the side onto the one before it, a step down and over
function Pile({ c }: { c: C }) {
  const cards = cardsOf(c);
  const n = Math.max(1, cards.length);
  const cw = 560, ch = 300, step = 70, dw = cw + (n - 1) * step, dh = ch + (n - 1) * step;
  return (
    <Band c={c} dw={dw} dh={dh}>
      {cards.map((t, k) => {
        const at = dealAt(c.s, k);
        const p = springAt(c, at);
        const [a, b] = TINTS[k % TINTS.length];
        return (
          <div key={k} style={abs({ left: k * step, top: k * step, width: cw, height: ch, ...panel(c, 30), display: "flex", alignItems: "center", gap: 30, padding: "0 36px", boxSizing: "border-box", opacity: clamp01(p * 1.8), transform: `translateX(${((1 - p) * 700).toFixed(1)}px) rotate(${((1 - p) * 8).toFixed(2)}deg)`, background: `linear-gradient(135deg, ${a}22, transparent 60%), ${c.look.panel}` })}>
            <Tile c={c} k={k} icon={t.icon} size={130} />
            {label(c, TYPE.ITEM * 1.2, cw - 72 - 130 - 30, t.text)}
            <div style={{ position: "absolute", right: 22, top: 22, width: 16, height: 16, borderRadius: 8, background: b }} />
          </div>
        );
      })}
    </Band>
  );
}

// 3 · flip: a row of cards, each falling forward from its top edge to face us as it is said
function Flip({ c }: { c: C }) {
  const cards = cardsOf(c);
  const n = Math.max(1, cards.length);
  const wide = c.g.shape === "wide";
  const cols = wide ? n : n <= 2 ? n : 2;
  const lines = Math.ceil(n / cols);
  const cw = wide ? 340 : 420, ch = wide ? 420 : 470, gap = 30;
  const dw = cols * cw + (cols - 1) * gap, dh = lines * ch + (lines - 1) * gap;
  return (
    <Band c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 0, top: 0, width: dw, height: dh, perspective: 1400 })}>
        {cards.map((t, k) => {
          const at = dealAt(c.s, k);
          const p = springAt(c, at, 1.2);
          const x = (k % cols) * (cw + gap), y = Math.floor(k / cols) * (ch + gap);
          return (
            <div key={k} style={abs({ left: x, top: y, width: cw, height: ch, transformOrigin: "50% 0%", transform: `rotateX(${((1 - p) * -95).toFixed(2)}deg)`, opacity: clamp01((c.f - at + 2) / 5) })}>
              <Face c={c} k={k} t={t} w={cw} h={ch} />
            </div>
          );
        })}
      </div>
    </Band>
  );
}

// 4 · badges: round badges popping in, each with a ring that pulses once
function Badges({ c }: { c: C }) {
  const cards = cardsOf(c);
  const n = Math.max(1, cards.length);
  const wide = c.g.shape === "wide";
  const cols = wide ? n : n <= 2 ? n : 2;
  const lines = Math.ceil(n / cols);
  const d = 300, cell = 380, labelH = 80;
  const dw = cols * cell, dh = lines * (d + labelH + 40);
  return (
    <Band c={c} dw={dw} dh={dh}>
      {cards.map((t, k) => {
        const at = dealAt(c.s, k);
        const p = springAt(c, at, 0.9);
        const ring = clamp01((c.f - at - 6) / 20);
        const [a, b] = TINTS[k % TINTS.length];
        const x = (k % cols) * cell + (cell - d) / 2, y = Math.floor(k / cols) * (d + labelH + 40);
        return (
          <div key={k} style={abs({ left: x, top: y, width: d, opacity: clamp01(p * 2), transform: `scale(${(0.3 + 0.7 * p).toFixed(4)})` })}>
            <div style={{ position: "relative", width: d, height: d }}>
              <div style={abs({ inset: 0, borderRadius: d / 2, border: `4px solid ${b}`, opacity: 1 - ring, transform: `scale(${(1 + 0.25 * ring).toFixed(4)})` })} />
              <div style={abs({ inset: 18, borderRadius: d / 2, background: `radial-gradient(circle at 35% 30%, ${a}, ${b})`, boxShadow: `inset 0 10px 18px rgba(255,255,255,0.4), 0 22px 50px ${b}55`, display: "flex", alignItems: "center", justifyContent: "center" })}>
                <div data-part="item-icon"><Icon name={t.icon} size={d * 0.4} color="#ffffff" strokeWidth={2.1} /></div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center", width: d }}>{label(c, TYPE.ITEM * 1.1, cell - 20, t.text, { color: c.look.ink })}</div>
          </div>
        );
      })}
    </Band>
  );
}

export const DECK_VARIANTS = [null, Fan, Pile, Flip, Badges] as const;
