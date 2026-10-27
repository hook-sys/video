import type { ReactNode } from "react";
import { Icon } from "../icons";
import { Concept } from "./concept";
import { familyOf } from "./faces";
import { fitWords } from "./fit";
import { type C, Glyph, blend, One, Words, clamp01, ease, keyStyle, panel, pop, rise, springAt, stagger, tint } from "./kit";
import { TYPE, WEIGHT } from "./geo";
import { Band, Phrases, Side, TEMPLATES_1, WordsIn, abs, center, display, itemAt, thingAt } from "./scenes";
import { phraseMode } from "./rhythm";
import type { Item, Scene, TemplateId } from "./types";

// The templates, part 2: compare (before → after), chart (it grows),
// kinetic (the words as the show), messages (the product talking) and bento
// (what it brings, as tiles) — three designed variants each.

const tall = (c: C) => c.g.shape !== "wide";
const things = (c: C): Item[] => (c.s.items.length ? c.s.items : [{ text: c.s.words.map((w) => w.t).join(" "), icon: c.s.icon }]);
const onPanel = (c: C) => (c.look.onPanelAccent);

// ── compare: the mess before, the order after ─────────────────────────────
function Compare({ c }: { c: C }) {
  const items = things(c);
  const n = items.length;
  const turn = [-9, 7, -4];
  // a row of the thing: crossed out (before) or ticked (after)
  const row = (it: Item, i: number, after: boolean, w: number) => (
    <div key={i} style={{ height: 120, display: "flex", alignItems: "center", gap: 22, padding: "0 28px", borderTop: i ? `1.5px solid ${c.look.line}` : undefined }}>
      <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={64} card />
      <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, flex: 1, color: after ? c.look.panelInk : c.look.panelSub }} fit={w - 200} face={c.look.text}>{it.text}</One>
      <div style={{ width: 52, height: 52, borderRadius: 99, background: after ? c.look.panelAccent : tint(c.look.bad, 0.16), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={after ? "check" : "x"} size={32} color={after ? onPanel(c) : c.look.bad} strokeWidth={3} />
      </div>
    </div>
  );
  if (c.s.variant === 0) {
    // side by side: the scattered things, then the same things in one card
    const w = 760, cardH = n * 120 + 40, dw = tall(c) ? w : w * 2 + 120, dh = tall(c) ? cardH * 2 + 140 : cardH + 80;
    const after = springAt(c, itemAt(c, n, n + 1) + 6);
    return (
      <Band c={c} dw={dw} dh={dh}>
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          return (
            <div key={`b${i}`} style={abs({ left: 40 + (i % 2) * 60, top: 30 + i * (cardH / n + 10), width: w - 120, height: 120, ...panel(c, 26), display: "flex", alignItems: "center", gap: 20, padding: "0 26px", boxSizing: "border-box", opacity: clamp01(k * 1.6) * (1 - 0.35 * after), transform: `rotate(${(turn[i] * k).toFixed(2)}deg)`, filter: undefined })}>
              <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={60} card />
              <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, color: c.look.panelSub }} fit={w - 280} face={c.look.text}>{it.text}</One>
            </div>
          );
        })}
        <div style={abs({ left: tall(c) ? 0 : w + 120, top: tall(c) ? cardH + 140 : 40, width: w, height: cardH, ...panel(c, 34), padding: "20px 0", boxSizing: "border-box", ...rise(after, 80) })}>
          {items.map((it, i) => row(it, i, true, w))}
        </div>
        <div style={center({ left: tall(c) ? w / 2 - 50 : w + 10, top: tall(c) ? cardH + 30 : cardH / 2 - 10, width: 100, height: 100, ...pop(after) })}>
          <Icon name={tall(c) ? "arrow-down" : "arrow-right"} size={80} color={c.look.accent} strokeWidth={2.6} />
        </div>
      </Band>
    );
  }
  const w = 860, dh = n * 120 + 180;
  if (c.s.variant === 1) {
    // a slider wipes the before into the after
    const slide = ease(clamp01((c.f - itemAt(c, n, n + 1)) / 24));
    const card = (after: boolean) => (
      <div style={abs({ left: 0, top: 100, width: w, height: n * 120 + 40, ...panel(c, 34), padding: "20px 0", boxSizing: "border-box" })}>{items.map((it, i) => row(it, i, after, w))}</div>
    );
    const k = springAt(c, c.s.from + 4, 1.3);
    return (
      <Side c={c} dw={w} dh={dh}>
        <div style={abs({ left: 0, top: 0, width: w, height: dh, ...rise(k, 60) })}>
          {card(false)}
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${((1 - slide) * 100).toFixed(2)}% 0 0)` }}>{card(true)}</div>
          <div style={abs({ left: slide * w - 4, top: 70, width: 8, height: n * 120 + 100, borderRadius: 9, background: c.look.accent })} />
          <div style={center({ left: slide * w - 40, top: 30, width: 80, height: 80, borderRadius: 99, background: c.look.accent })}>
            <Icon name="chevrons-left-right" size={44} color={c.look.onAccent} strokeWidth={2.6} />
          </div>
        </div>
      </Side>
    );
  }
  // a switch turns it on: every row turns from a cross to a tick
  const flip = ease(clamp01((c.f - itemAt(c, n, n + 1)) / 10));
  const k = springAt(c, c.s.from + 4, 1.3);
  return (
    <Side c={c} dw={w} dh={dh + 20}>
      <div style={abs({ left: 0, top: 0, width: w, height: dh + 20, ...rise(k, 60) })}>
        <div style={abs({ left: w / 2 - 110, top: 0, width: 220, height: 110, borderRadius: 99, background: blend(c.look.line, c.look.accent, clamp01((flip - 0.3) / 0.4)), padding: 10, boxSizing: "border-box" })}>
          <div style={{ width: 90, height: 90, borderRadius: 99, background: "#ffffff", transform: `translateX(${(flip * 110).toFixed(1)}px)`, boxShadow: "0 6px 16px rgba(0,0,0,0.2)" }} />
        </div>
        <div style={abs({ left: 0, top: 150, width: w, height: n * 120 + 40, ...panel(c, 34), padding: "20px 0", boxSizing: "border-box" })}>
          {items.map((it, i) => row(it, i, flip > 0.5 && c.f >= itemAt(c, n, n + 1) + 6 + i * 3, w))}
        </div>
      </div>
    </Side>
  );
}

// ── chart: it grows ───────────────────────────────────────────────────────
function Chart({ c }: { c: C }) {
  const k = springAt(c, c.s.from + 4, 1.3);
  const draw = ease(clamp01((c.f - c.s.from - 8) / 40));
  if (c.s.variant === 0) {
    // a line drawing up, the area under it, a dot at its end
    const dw = 860, dh = 640, ys = [0.78, 0.7, 0.74, 0.55, 0.6, 0.38, 0.3, 0.14];
    const px = (i: number) => 60 + i * ((dw - 120) / (ys.length - 1)), py = (y: number) => 60 + y * (dh - 160);
    const line = ys.map((y, i) => `${i ? "L" : "M"}${px(i).toFixed(0)} ${py(y).toFixed(0)}`).join(" ");
    const end = Math.min(ys.length - 1, Math.floor(draw * (ys.length - 1)));
    return (
      <Side c={c} dw={dw} dh={dh}>
        <div style={abs({ left: 0, top: 0, width: dw, height: dh, ...panel(c, 36), ...rise(k, 50) })}>
          {[0.25, 0.5, 0.75].map((y) => <div key={y} style={abs({ left: 50, right: 50, top: py(y), height: 2, background: c.look.line })} />)}
          <svg width={dw} height={dh} style={abs({ left: 0, top: 0 })}>
            <defs>
              <linearGradient id={`area${c.s.from}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.look.panelAccent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={c.look.panelAccent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={`${line} L${px(ys.length - 1)} ${dh - 100} L${px(0)} ${dh - 100} Z`} fill={`url(#area${c.s.from})`} opacity={draw} />
            <path d={line} fill="none" stroke={c.look.panelAccent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          </svg>
          {draw > 0.98 && <div style={abs({ left: px(end) - 22, top: py(ys[end]) - 22, width: 44, height: 44, borderRadius: 99, background: c.look.panelAccent, boxShadow: `0 0 0 ${(10 + 6 * Math.sin(c.f / 6)).toFixed(1)}px ${tint(c.look.panelAccent, 0.2)}` })} />}
        </div>
      </Side>
    );
  }
  if (c.s.variant === 1) {
    // a ring filling, the icon in its middle
    const R = 250, L = 2 * Math.PI * R, fill = 0.78 * draw;
    return (
      <Side c={c} dw={640} dh={640}>
        <svg width={640} height={640} style={{ ...abs({ left: 0, top: 0 }), ...pop(k) }}>
          <circle cx={320} cy={320} r={R} fill="none" stroke={tint(c.look.accent, c.look.dark ? 0.16 : 0.14)} strokeWidth={56} />
          <circle cx={320} cy={320} r={R} fill="none" stroke={c.look.accent} strokeWidth={56} strokeLinecap="round" strokeDasharray={`${(L * fill).toFixed(1)} ${L.toFixed(1)}`} transform="rotate(-90 320 320)" />
        </svg>
        <div style={center({ left: 0, top: 0, width: 640, height: 640, ...pop(springAt(c, c.s.from + 12)) })}>
          <Icon name={c.s.icon} size={200} color={c.look.accent} strokeWidth={1.8} />
        </div>
      </Side>
    );
  }
  // the things as bars growing, the last the longest
  const items = things(c);
  const n = items.length;
  const dw = 900, bh = 120, gap = 50, dh = n * (bh + gap);
  return (
    <Side c={c} dw={dw} dh={dh}>
      {items.map((it, i) => {
        const g = springAt(c, itemAt(c, i, n), 1.5);
        const len = (0.45 + (0.55 * (i + 1)) / n) * clamp01(g);
        const last = i === n - 1;
        return (
          <div key={i} style={abs({ left: 0, top: i * (bh + gap), width: dw, height: bh })}>
            <div style={abs({ left: 0, top: 0, width: dw * len, height: bh, borderRadius: 30, background: last ? c.look.accent : tint(c.look.accent, c.look.dark ? 0.24 : 0.2), display: "flex", alignItems: "center", gap: 20, padding: "0 30px", boxSizing: "border-box", overflow: "hidden" })}>
              <Icon name={it.icon ?? c.s.icon} size={56} color={last ? c.look.onAccent : c.look.ink} strokeWidth={2.2} />
              <One part="item" style={{ fontFamily: familyOf(c.look.text), fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, color: last ? c.look.onAccent : c.look.ink }} fit={dw * 0.45} face={c.look.text}>{it.text}</One>
            </div>
          </div>
        );
      })}
    </Side>
  );
}

// ── kinetic: the words are the show ───────────────────────────────────────
function Kinetic({ c }: { c: C }) {
  const { W, H, pad, u } = c.g;
  const box = { left: pad, top: 0, width: W - 2 * pad, height: H };
  if (c.s.variant === 0) {
    // one word at a time, huge, each replacing the last; then the whole line
    const words = c.s.words;
    const settle = (words.at(-1)?.at ?? c.s.from) + 14;
    if (c.f >= settle) return <WordsIn c={c} box={box} place="center" />;
    const i = Math.max(0, words.findLastIndex((w) => c.f >= w.at - 2));
    const w = words[i];
    const k = springAt(c, w.at - 2);
    const size = fitWords([w.t], c.look.display, { width: W - 2 * pad, lines: 1, max: Math.round(320 * u), min: 90 }).size;
    return (
      <div style={center({ inset: 0 })}>
        <div style={{ ...display(c, size, { fontWeight: 800, color: c.look.ink, ...(w.key ? keyStyle(c.look, size) : {}) }), opacity: c.f >= w.at - 2 ? 1 : 0, transform: `scale(${(1.25 - 0.25 * k).toFixed(4)})` }}>{w.t}</div>
      </div>
    );
  }
  if (c.s.variant === 1) {
    // typed into a prompt bar, a sparkle and a send button
    const k = springAt(c, c.s.from + 2, 1.3);
    const bw = W - 2 * pad, fit = fitWords(c.s.words.map((w) => w.t), c.look.display, { width: bw - 300 * u, lines: tall(c) ? 4 : 2, max: Math.round(110 * u), min: 50 });
    const bh = Math.round(fit.lines.length * fit.size * 1.1 + 120 * u);
    const sent = c.f >= (c.s.words.at(-1)?.at ?? c.s.from) + 22;
    return (
      <div style={abs({ left: pad, top: (H - bh) / 2, width: bw, height: bh, ...panel(c, Math.round(50 * u)), display: "flex", alignItems: "center", gap: 30 * u, padding: `0 ${Math.round(50 * u)}px`, boxSizing: "border-box", ...rise(k, 50) })}>
        <Icon name="sparkles" size={Math.round(72 * u)} color={c.look.panelAccent} strokeWidth={2} />
        <div style={{ flex: 1, display: "flex" }}>
          <Words c={{ ...c, look: { ...c.look, ink: c.look.panelInk, accent: c.look.panelAccent, plate: false } }} width={bw - 300 * u} lines={tall(c) ? 4 : 2} max={Math.round(110 * u)} min={50} align="left" effect="type" />
        </div>
        <div style={center({ position: "relative", width: Math.round(110 * u), height: Math.round(110 * u), borderRadius: 99, flexShrink: 0, background: sent ? c.look.panelAccent : c.look.line, transform: `scale(${(1 + 0.1 * Math.sin(clamp01((c.f - (c.s.words.at(-1)?.at ?? 0) - 22) / 10) * Math.PI)).toFixed(3)})` })}>
          <Icon name="arrow-up" size={Math.round(60 * u)} color={sent ? onPanel(c) : c.look.panelSub} strokeWidth={2.8} />
        </div>
      </div>
    );
  }
  // big words, the key one growing in as it is said (the whole line phrase by phrase, when it says more)
  if (phraseMode(c.s)) return <Phrases c={c} effect="pop" />;
  return <WordsIn c={c} box={box} place="center" effect="pop" />;
}

// ── messages: the product talking ─────────────────────────────────────────
function Messages({ c }: { c: C }) {
  const items = things(c);
  const n = items.length;
  if (c.s.variant === 0) {
    // a chat: each thing a bubble, a typing dot-dot-dot before it
    const dw = 860, dh = 220 + n * 170;
    const k = springAt(c, c.s.from + 2, 1.3);
    return (
      <Side c={c} dw={dw} dh={dh}>
        <div style={abs({ left: 0, top: 0, width: dw, height: dh, ...panel(c, 40), overflow: "hidden", ...rise(k, 60) })}>
          <div style={{ height: 130, display: "flex", alignItems: "center", gap: 22, padding: "0 40px", borderBottom: `1.5px solid ${c.look.line}` }}>
            <Glyph c={c} part="icon" name={c.s.icon} size={72} solid card />
            <One style={{ fontSize: TYPE.TITLE, fontWeight: WEIGHT.title }} fit={600} face={c.look.text}>{c.brand.name}</One>
          </div>
          {items.map((it, i) => {
            const at = itemAt(c, i, n) + 6;
            const typing = c.f >= at - 12 && c.f < at;
            const kb = springAt(c, at);
            const mine = i % 2 === 1;
            return (
              <div key={i} style={abs({ top: 170 + i * 170, [mine ? "right" : "left"]: 40, maxWidth: dw - 200 })}>
                {typing && <div style={{ display: "flex", gap: 10, padding: "26px 30px", borderRadius: 40, background: c.look.line }}>{[0, 1, 2].map((d) => <div key={d} style={{ width: 16, height: 16, borderRadius: 99, background: c.look.panelSub, opacity: 0.4 + 0.6 * clamp01(Math.sin((c.f + d * 4) / 3)) }} />)}</div>}
                {c.f >= at && (
                  <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "24px 34px", borderRadius: 44, background: mine ? c.look.panelAccent : tint(c.look.panelAccent, 0.12), color: mine ? onPanel(c) : c.look.panelInk, ...pop(kb), transformOrigin: mine ? "right center" : "left center" }}>
                    <Icon name={it.icon ?? c.s.icon} size={48} color={mine ? onPanel(c) : c.look.panelAccent} strokeWidth={2.2} />
                    <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item }} fit={dw - 360} face={c.look.text}>{it.text}</One>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Side>
    );
  }
  if (c.s.variant === 1) {
    // an inbox: rows land unread, then are read one by one
    const dw = 900, rowH = 150, dh = 130 + n * rowH + 20;
    const k = springAt(c, c.s.from + 2, 1.3);
    return (
      <Side c={c} dw={dw} dh={dh}>
        <div style={abs({ left: 0, top: 0, width: dw, height: dh, ...panel(c, 36), overflow: "hidden", ...rise(k, 60) })}>
          <div style={{ height: 130, display: "flex", alignItems: "center", gap: 20, padding: "0 40px", borderBottom: `1.5px solid ${c.look.line}` }}>
            <Icon name="inbox" size={56} color={c.look.panelAccent} strokeWidth={2.2} />
            <One style={{ fontSize: TYPE.TITLE, fontWeight: WEIGHT.title, flex: 1 }} fit={560} face={c.look.text}>{c.brand.name}</One>
            <div style={{ padding: "8px 20px", borderRadius: 99, background: c.look.panelAccent, color: onPanel(c), fontSize: TYPE.LABEL, fontWeight: 700 }}>{n}</div>
          </div>
          {items.map((it, i) => {
            const at = itemAt(c, i, n);
            const kr = springAt(c, at);
            const read = c.f >= at + 24 + i * 4;
            return (
              <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 24, padding: "0 40px", borderTop: i ? `1.5px solid ${c.look.line}` : undefined, ...rise(kr, 30) }}>
                <div style={{ width: 18, height: 18, borderRadius: 99, background: read ? "transparent" : c.look.panelAccent }} />
                <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={72} card />
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: read ? 550 : 750 }} fit={560} face={c.look.text}>{it.text}</One>
                  <div style={{ height: 14, width: 260 + i * 40, borderRadius: 9, background: c.look.line, marginTop: 14 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Side>
    );
  }
  // toasts landing on a quiet screen of the product
  const dw = 900, dh = 760;
  const k = springAt(c, c.s.from + 2, 1.3);
  return (
    <Side c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 0, top: 0, width: dw, height: dh, ...panel(c, 36), overflow: "hidden", ...rise(k, 60) })}>
        <div style={{ height: 90, display: "flex", alignItems: "center", gap: 14, padding: "0 34px", borderBottom: `1.5px solid ${c.look.line}` }}>
          {[0, 1, 2].map((d) => <div key={d} style={{ width: 18, height: 18, borderRadius: 99, background: c.look.line }} />)}
        </div>
        {[0, 1, 2, 3].map((r) => <div key={r} style={abs({ left: 50, top: 140 + r * 130, width: 360 - r * 40, height: 70, borderRadius: 18, background: c.look.line, opacity: 0.6 })} />)}
        {items.map((it, i) => {
          const kt = springAt(c, itemAt(c, i, n));
          return (
            <div key={i} style={abs({ right: 36, top: 130 + i * 160, width: 560, height: 136, ...panel(c, 30), display: "flex", alignItems: "center", gap: 20, padding: "0 26px", boxSizing: "border-box", opacity: clamp01(kt * 1.6), transform: `translateX(${((1 - kt) * 260).toFixed(1)}px)`, boxShadow: `0 24px 60px ${c.look.shadow}` })}>
              <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={72} solid card />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item }} fit={400} face={c.look.text}>{it.text}</One>
                <One style={{ fontSize: TYPE.LABEL, color: c.look.panelSub }}>{c.brand.name} · now</One>
              </div>
            </div>
          );
        })}
      </div>
    </Side>
  );
}

// ── bento: what it brings, as tiles ───────────────────────────────────────
function Bento({ c }: { c: C }) {
  const items = things(c);
  const n = items.length;
  const tile = (it: Item, i: number, w: number, h: number, big: boolean) => {
    const k = springAt(c, itemAt(c, i, n));
    return (
      <div style={{ width: w, height: h, ...panel(c, 34), padding: 40, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", background: big ? c.look.fill : c.look.panel, color: big ? c.look.onFill : c.look.panelInk, ...rise(k, 50) }}>
        {big ? (
          <div style={center({ position: "relative", width: 110, height: 110, borderRadius: 30, background: tint(c.look.onFill, 0.18) })}>
            <Icon name={it.icon ?? c.s.icon} size={64} color={c.look.onFill} strokeWidth={2.2} />
          </div>
        ) : (
          <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={big ? 110 : 92} card />
        )}
        <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.title }} fit={w - 80} face={c.look.text}>{it.text}</One>
      </div>
    );
  };
  if (c.s.variant === 0) {
    // one big tile and the rest beside it (stacked under it on a tall frame)
    const wide = !tall(c);
    const dw = wide ? 1500 : 920, dh = wide ? 480 : 1000;
    const rest = items.slice(1);
    return (
      <Band c={c} dw={dw} dh={dh}>
        <div style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: 30, width: dw, height: dh }}>
          {tile(items[0], 0, wide ? 720 : 920, wide ? 480 : 500, true)}
          <div style={{ display: "flex", flexDirection: wide ? "column" : "row", gap: 30, flex: 1 }}>
            {rest.map((it, i) => <div key={i}>{tile(it, i + 1, wide ? 750 : (920 - 30 * (rest.length - 1)) / Math.max(1, rest.length), wide ? (480 - 30 * (rest.length - 1)) / Math.max(1, rest.length) : 470, false)}</div>)}
          </div>
        </div>
      </Band>
    );
  }
  if (c.s.variant === 1) {
    // pills around the words
    const { W, H, pad, u } = c.g;
    const spots = tall(c) ? [{ x: 0.3, y: 0.2 }, { x: 0.7, y: 0.8 }, { x: 0.32, y: 0.82 }] : [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.25 }, { x: 0.5, y: 0.82 }];
    return (
      <>
        <WordsIn c={c} box={{ left: pad + W * 0.08, top: H * 0.3, width: W - 2 * pad - W * 0.16, height: H * 0.4 }} place="band" />
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          const float = Math.sin((c.f - c.s.from) / 26 + i * 2) * 8;
          return (
            <div key={i} style={abs({ left: W * spots[i].x - 240, top: H * spots[i].y - 60, width: 480, height: 120, display: "flex", justifyContent: "center", opacity: clamp01(k * 1.6), transform: `translateY(${float.toFixed(1)}px) scale(${((0.6 + 0.4 * k) * Math.max(0.75, u)).toFixed(3)})` })}>
              <div style={{ ...panel(c, 99), height: 120, display: "flex", alignItems: "center", gap: 20, padding: "0 34px 0 20px" }}>
                <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={80} card />
                <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item }} fit={300} face={c.look.text}>{it.text}</One>
              </div>
            </div>
          );
        })}
      </>
    );
  }
  // cards fanning out from a stack
  const dw = 1300, dh = 560, cw = 420, ch = 480;
  const spread = ease(clamp01((c.f - c.s.from - 14) / 22));
  return (
    <Band c={c} dw={dw} dh={dh}>
      {items.map((it, i) => {
        const off = i - (n - 1) / 2;
        const k = springAt(c, c.s.from + 4 + i * stagger(c));
        return (
          <div key={i} style={abs({ left: dw / 2 - cw / 2 + off * 430 * spread, top: (dh - ch) / 2 + Math.abs(off) * 30 * spread, width: cw, height: ch, opacity: clamp01(k * 1.6), transform: `rotate(${(off * 8 * spread).toFixed(2)}deg)`, zIndex: 10 - Math.abs(off) })}>
            <div style={{ width: cw, height: ch, ...panel(c, 34), padding: 44, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <Glyph c={c} part="item-icon" at={thingAt(c.s, i, c.s.items.length)} name={it.icon ?? c.s.icon} size={120} card />
              <One part="item" style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item }} fit={cw - 88} face={c.look.text}>{it.text}</One>
            </div>
          </div>
        );
      })}
    </Band>
  );
}

// ── screen: the product itself, a picture of it in a browser window ───────
// (its website's pages, or pictures the customer uploaded). Without a picture
// (the gallery, the check) a plain page of the brand's colours stands in.
const SW = 1040, BAR = 52, SH = Math.round((SW * 900) / 1440);
function Page({ c }: { c: C }) {
  const ink = c.look.panelSub;
  return (
    <div style={{ position: "absolute", inset: 0, background: c.look.panel === "#ffffff" ? "#ffffff" : "#15171d", padding: 48, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Glyph c={c} part="icon" name={c.s.icon} size={44} solid card />
        <div style={{ height: 14, width: 120, borderRadius: 9, background: tint(ink, 0.3) }} />
        <div style={{ flex: 1 }} />
        {[70, 70, 70].map((w, i) => <div key={i} style={{ height: 12, width: w, borderRadius: 9, background: tint(ink, 0.22) }} />)}
        <div style={{ height: 40, width: 120, borderRadius: 99, background: c.look.panelAccent }} />
      </div>
      <div style={{ display: "flex", gap: 40, flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18, paddingTop: 40 }}>
          {[0.9, 0.7].map((w, i) => <div key={i} style={{ height: 44, width: `${w * 100}%`, borderRadius: 12, background: tint(ink, 0.45) }} />)}
          {[0.95, 0.8, 0.6].map((w, i) => <div key={i} style={{ height: 14, width: `${w * 100}%`, borderRadius: 9, background: tint(ink, 0.2) }} />)}
          <div style={{ height: 52, width: 200, borderRadius: 99, background: c.look.panelAccent, marginTop: 14 }} />
        </div>
        <div style={{ flex: 1, borderRadius: 24, background: tint(c.look.panelAccent, 0.16), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={c.s.icon} size={120} color={c.look.panelAccent} strokeWidth={1.6} />
        </div>
      </div>
    </div>
  );
}
function Screen({ c }: { c: C }) {
  const { Img } = c.play;
  const src = c.brand.screens?.[c.s.screen ?? 0] || null;
  const k = springAt(c, c.s.from + 2, 1.3);
  const p = clamp01((c.f - c.s.from) / Math.max(1, c.s.to - c.s.from));
  // how the picture moves inside its window: a slow push in, a slow scroll down,
  // or a closer push into the top of the page (where its headline and main
  // screen are) — never a click on a spot we cannot know is a button
  const v = c.s.variant;
  const zoom = v === 0 ? 1 + 0.12 * ease(p) : v === 2 ? 1 + 0.4 * ease(clamp01((c.f - c.s.from - 8) / 60)) : 1.18;
  const shiftY = v === 1 ? -SH * 0.16 * ease(p) : 0;
  const origin = v === 2 ? "50% 18%" : "50% 30%";
  return (
    <Side c={c} dw={SW} dh={SH + BAR}>
      <div style={abs({ left: 0, top: 0, width: SW, height: SH + BAR, ...panel(c, 22), overflow: "hidden", opacity: clamp01(k * 1.6), transform: `translateY(${((1 - k) * 60).toFixed(1)}px) perspective(1800px) rotateY(${((c.s.left ? 1 : -1) * (v === 1 ? 0 : 6) * (1 - 0.5 * p)).toFixed(2)}deg)` })}>
        <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1.5px solid ${c.look.line}` }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((col) => <div key={col} style={{ width: 14, height: 14, borderRadius: 99, background: col }} />)}
          <div style={{ marginLeft: 18, height: 30, flex: 1, maxWidth: 520, borderRadius: 99, background: tint(c.look.panelSub, 0.14), display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
            <Icon name="lock" size={16} color={c.look.panelSub} strokeWidth={2.4} />
            {c.brand.site && <One style={{ fontSize: 18, color: c.look.panelSub }}>{c.brand.site}</One>}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, top: BAR, width: SW, height: SH, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${shiftY.toFixed(1)}px) scale(${zoom.toFixed(4)})`, transformOrigin: origin }}>
            {src ? <Img data-part="picture" src={src} style={{ width: SW, height: "auto", minHeight: SH, objectFit: "cover", objectPosition: "top", display: "block" }} /> : <Page c={c} />}
          </div>
        </div>
      </div>
    </Side>
  );
}

export const TEMPLATE: Record<TemplateId, (p: { c: C }) => ReactNode> = { ...TEMPLATES_1, kinetic: Kinetic, compare: Compare, chart: Chart, messages: Messages, bento: Bento, screen: Screen, concept: Concept };

// the scene's click (its cursor's or its button's — the last scene has a button only when the voice asks), for its sound
export function clickOf(s: Scene, asks = true): number | null {
  if (s.template === "feature" && s.variant === 0) return thingAt(s, Math.max(1, s.items.length) - 1, Math.max(1, s.items.length)) + 26;
  if (s.template === "cta") return asks ? s.from + 52 : null;
  return null;
}
