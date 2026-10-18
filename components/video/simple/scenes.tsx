import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import { emWidth, familyOf } from "./faces";
import { fitWords, measured } from "./fit";
import { type Box, TYPE, WEIGHT, bandOf, sideOf, splitOf, stackOf, wordsFit } from "./geo";
import { type C, Cursor, type Effect, Glyph, Mark, One, Words, clamp01, countUp, ease, keyStyle, panel, pop, rise, springAt, stagger, tint } from "./kit";
import type { Scene } from "./types";

// The templates (docs/video-spec.md), part 1: statement, trouble, reveal,
// feature, stat, steps and the ask — each in three designed variants,
// mirrored by `left`, on any frame. A hero is designed once at its own size
// and scaled into its place (geo.ts); words are fitted to theirs, so nothing
// can overlap.

export const abs = (style: CSSProperties): CSSProperties => ({ position: "absolute", ...style });
export const center = (style: CSSProperties = {}): CSSProperties => abs({ display: "flex", alignItems: "center", justifyContent: "center", ...style });
// when the scene's things come in: spread over its first half
export const thingAt = (s: Scene, i: number, n: number) => s.from + 10 + Math.round(i * Math.min(16, ((s.to - s.from) * 0.45) / Math.max(1, n)));
export const itemAt = (c: C, i: number, n: number) => thingAt(c.s, i, n);
export const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const saysName = (c: C) => norm(c.s.words.map((w) => w.t).join(" ")).includes(norm(c.brand.name));
export const display = (c: C, size: number, style: CSSProperties = {}): CSSProperties => ({ fontFamily: familyOf(c.look.display), fontWeight: 750, fontSize: size, letterSpacing: "-0.03em", color: c.look.ink, whiteSpace: "nowrap", ...style });

// The words in their place (beside a hero: left-aligned on a wide frame)
export function WordsIn({ c, box, place, effect, color, only }: { c: C; box: Box; place: "side" | "band" | "center"; effect?: Effect; color?: string; only?: (t: string) => boolean }) {
  const fit = wordsFit(c.g, place, box);
  const cc = only ? { ...c, s: { ...c.s, words: c.s.words.filter((w) => only(w.t)) } } : c;
  const left = place === "side" && c.g.shape === "wide";
  return (
    <div style={abs({ ...box, display: "flex", alignItems: "center", justifyContent: left ? "flex-start" : "center" })}>
      <Words c={cc} {...fit} align={left ? "left" : "center"} effect={effect} color={color} />
    </div>
  );
}
// how the words will come out in a place (to centre them with what is beside them)
const wordsIn = (c: C, box: Box, place: "side" | "band", only?: (t: string) => boolean) => {
  const shown = c.s.words.filter((w) => !only || only(w.t)).map((w) => w.t);
  return measured(shown, c.look.display, fitWords(shown, c.look.display, wordsFit(c.g, place, box)));
};
// the words and a hero of its own size (dw × dh), side by side or one above
// the other — together centred on the frame
export function Side({ c, dw, dh, hw = 860, effect, only, children }: { c: C; dw: number; dh: number; hw?: number; effect?: Effect; only?: (t: string) => boolean; children: ReactNode }) {
  const { words, hero } = sideOf(c.g, c.s.left, hw, wordsIn(c, splitOf(c.g, c.s.left, hw).words, "side", only), dw, dh);
  return (
    <>
      <WordsIn c={c} box={words} place="side" effect={effect} only={only} />
      <div style={hero}>{children}</div>
    </>
  );
}
// the words in a band on top, a group of its own size below them — together centred on the frame
export function Band({ c, dw, dh, effect, children }: { c: C; dw: number; dh: number; effect?: Effect; children: ReactNode }) {
  const { words, body } = bandOf(c.g, wordsIn(c, stackOf(c.g).words, "band"), dw, dh);
  return (
    <>
      <WordsIn c={c} box={words} place="band" effect={effect} />
      <div style={body}>{children}</div>
    </>
  );
}
const tall = (c: C) => c.g.shape !== "wide";

// ── statement: the words are the hero ─────────────────────────────────────
function Statement({ c }: { c: C }) {
  const { W, H, pad } = c.g;
  if (c.s.variant === 0) return <WordsIn c={c} box={{ left: pad, top: 0, width: W - 2 * pad, height: H }} place="center" />;
  if (c.s.variant === 1) {
    const k = springAt(c, c.s.from + 4, 1.4);
    const float = Math.sin((c.f - c.s.from) / 22) * 10;
    return (
      <Side c={c} dw={420} dh={420} hw={560}>
        <div style={{ ...center({ inset: 0 }), opacity: clamp01(k * 1.8), transform: `scale(${(0.6 + 0.4 * k).toFixed(4)}) translateY(${float.toFixed(1)}px) rotate(${((1 - k) * -14).toFixed(2)}deg)` }}>
          <Glyph c={c} name={c.s.icon} size={320} solid />
        </div>
      </Side>
    );
  }
  // the lines come in from alternate sides, the key word in the accent
  const fit = fitWords(c.s.words.map((w) => w.t), c.look.display, { width: W - 2 * pad, lines: c.g.shape === "wide" ? 3 : 4, max: Math.round(TYPE.HERO * c.g.u), min: 70 });
  return (
    <div style={center({ left: pad, top: 0, width: W - 2 * pad, height: H, flexDirection: "column" })}>
      {fit.lines.map((line, li) => {
        const k = springAt(c, Math.min(...line.map((i) => c.s.words[i].at)) - 4);
        const from = (li % 2 ? 1 : -1) * W * 0.4;
        return (
          <div key={li} style={{ ...display(c, fit.size, { fontWeight: 800, lineHeight: 1.06 }), display: "flex", gap: `0 ${(fit.size * 0.26).toFixed(0)}px`, opacity: clamp01(k * 1.6), transform: `translateX(${((1 - k) * from).toFixed(1)}px)` }}>
            {line.map((i) => <span key={i} style={c.s.words[i].key ? keyStyle(c.look, fit.size) : undefined}>{c.s.words[i].t}</span>)}
          </div>
        );
      })}
    </div>
  );
}

// ── trouble: the pains, struck out, piling up, or struck through ───────────
function Trouble({ c }: { c: C }) {
  const items = c.s.items;
  const n = items.length;
  const last = itemAt(c, n - 1, n);
  const strikeAt = (i: number) => ease(clamp01((c.f - (last + 18 + i * 6)) / 12));
  if (c.s.variant === 0) {
    // tiles: a row on a wide frame, a column on a tall one
    const row = !tall(c);
    const tw = row ? 470 : 920, th = row ? 420 : 210, gap = row ? 60 : 30;
    const dw = row ? n * tw + (n - 1) * gap : tw, dh = row ? th : n * th + (n - 1) * gap;
    return (
      <Band c={c} dw={dw} dh={dh}>
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          const strike = strikeAt(i);
          return (
            <div key={i} style={abs({ left: row ? i * (tw + gap) : 0, top: row ? 0 : i * (th + gap), width: tw, height: th, ...rise(k, 80) })}>
              <div style={{ ...panel(c), width: "100%", height: "100%", display: "flex", flexDirection: row ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 30, padding: row ? 0 : "0 40px", boxSizing: "border-box", opacity: 1 - strike * 0.45 }}>
                <Glyph c={c} name={it.icon ?? c.s.icon} size={row ? 170 : 120} card />
                <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, maxWidth: row ? tw - 50 : tw - 240, flex: row ? undefined : 1 }} fit={row ? tw - 60 : tw - 240} face={c.look.text}>{it.text}</One>
              </div>
              <svg width={tw} height={th} style={abs({ left: 0, top: 0 })}>
                <line x1={50} y1={th - 50} x2={tw - 50} y2={50} stroke={c.look.bad} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} />
              </svg>
            </div>
          );
        })}
      </Band>
    );
  }
  if (c.s.variant === 1) {
    const turn = [-7, 5, -2];
    return (
      <Side c={c} dw={860} dh={n * 190 + 80}>
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          return (
            <div key={i} style={abs({ left: 20, top: 40 + i * 190, width: 820, height: 180, opacity: clamp01(k * 1.6), transform: `translateY(${((1 - k) * -420).toFixed(1)}px) rotate(${(turn[i] * (0.4 + 0.6 * k)).toFixed(2)}deg)` })}>
              <div style={{ ...panel(c, 26), height: "100%", display: "flex", alignItems: "center", gap: 28, padding: "0 34px" }}>
                <div style={{ width: 100, height: 100, borderRadius: 26, background: tint(c.look.bad, 0.14), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={it.icon ?? "triangle-alert"} size={54} color={c.look.bad} strokeWidth={2.2} />
                </div>
                <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, flex: 1 }} fit={560} face={c.look.text}>{it.text}</One>
                <div style={{ width: 20, height: 20, borderRadius: 99, background: c.look.bad }} />
              </div>
            </div>
          );
        })}
      </Side>
    );
  }
  // the pains in big type, struck through one by one
  const dw = tall(c) ? 920 : 1400, lh = tall(c) ? 150 : 140;
  return (
    <Band c={c} dw={dw} dh={n * lh}>
      {items.map((it, i) => {
        const k = springAt(c, itemAt(c, i, n));
        const strike = strikeAt(i);
        const size = fitWords([it.text], c.look.display, { width: dw - 80, lines: 1, max: 110, min: 50 }).size;
        return (
          <div key={i} style={center({ left: 0, top: i * lh, width: dw, height: lh, ...rise(k, 40) })}>
            <div style={{ position: "relative", ...display(c, size, { color: strike > 0.5 ? c.look.sub : c.look.ink }) }}>
              {it.text}
              <div style={abs({ left: -size * 0.05, top: "52%", height: Math.max(8, size * 0.09), width: `calc(${(strike * 100).toFixed(1)}% + ${(strike * size * 0.1).toFixed(1)}px)`, background: c.look.bad, borderRadius: 99 })} />
            </div>
          </div>
        );
      })}
    </Band>
  );
}

// ── reveal: the brand lands ────────────────────────────────────────────────
function Reveal({ c }: { c: C }) {
  const { W, H, pad, u } = c.g;
  const k = springAt(c, c.s.from + 6, 1.3);
  const ring = clamp01((c.f - c.s.from - 10) / 34);
  // (orbiting things keep clear of the mark and of the words under it)
  const orbiting = c.s.variant === 2 && c.s.items.length >= 2;
  const my = Math.round(H * (c.s.variant === 0 ? 0.37 : orbiting ? 0.36 : 0.42));
  const ms = Math.round((c.s.variant === 0 ? 260 : 200) * Math.max(0.8, u));
  const ry = ms / 2 + 90 * u;
  const below = orbiting ? my + ry + 70 * u : my + ms / 2 + 50 * u;
  const wordsBox = { left: pad, top: below, width: W - 2 * pad, height: H - below - 60 };
  const words = saysName(c) ? (
    <WordsIn c={c} box={wordsBox} place="band" />
  ) : (
    <div style={center({ ...wordsBox, flexDirection: "column", gap: 18 })}>
      <div style={{ ...display(c, Math.round(TYPE.HEAD * u)), ...rise(k) }}>{c.brand.name}</div>
      <Words c={c} width={wordsBox.width} lines={tall(c) ? 2 : 1} max={Math.round(TYPE.SUB * u)} min={40} color={c.look.sub} />
    </div>
  );
  const rings = [0, 0.35].map((d, i) => {
    const r = clamp01(ring - d);
    return r > 0 && r < 1 ? <div key={`r${i}`} style={abs({ left: W / 2 - 160, top: my - 160, width: 320, height: 320, borderRadius: 999, border: `5px solid ${c.look.accent}`, transform: `scale(${(0.7 + 0.9 * r).toFixed(3)})`, opacity: 1 - r })} /> : null;
  });
  const mark = (extra = 1) => (
    <div style={center({ left: 0, width: W, top: my - ms / 2 - 20, height: ms + 40 })}>
      <div style={{ opacity: clamp01(k * 1.8), transform: `scale(${((0.6 + 0.4 * k) * extra).toFixed(4)})` }}>
        <Mark c={c} size={ms} />
      </div>
    </div>
  );
  if (c.s.variant === 0 || c.s.items.length < 2)
    return (
      <>
        {rings}
        {mark()}
        {words}
      </>
    );
  const chip = (it: { text: string; icon: string | null }, style: CSSProperties, key: number) => (
    <div key={key} style={abs({ width: 460, height: 110, ...style })}>
      <div style={{ ...panel(c, 99), height: "100%", display: "flex", alignItems: "center", gap: 20, padding: "0 28px 0 18px", boxSizing: "border-box" }}>
        <Glyph c={c} name={it.icon ?? c.s.icon} size={74} card />
        <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item }} fit={300} face={c.look.text}>{it.text}</One>
      </div>
    </div>
  );
  if (c.s.variant === 1) {
    // the things it brings together fly into it (their paths stay above the words)
    const homes = [{ x: W * 0.2, y: H * 0.2 }, { x: W * 0.8, y: H * 0.2 }, { x: W * 0.8, y: H * 0.5 }];
    const land = c.s.from + 22 + c.s.items.length * stagger(c) * 3;
    return (
      <>
        {c.s.items.map((it, i) => {
          const kin = springAt(c, c.s.from + 4 + i * stagger(c) * 2);
          const go = ease(clamp01((c.f - land - i * 3) / 18));
          const x = homes[i].x + (W / 2 - homes[i].x) * go, y = homes[i].y + (my - homes[i].y) * go;
          return chip(it, { left: x - 230, top: y - 55, opacity: clamp01(kin * 1.6) * (1 - go), transform: `scale(${((0.7 + 0.3 * kin) * (1 - 0.6 * go) * Math.max(0.8, u)).toFixed(3)})` }, i);
        })}
        {rings}
        {mark(1 + 0.08 * Math.sin(clamp01((c.f - land - 16) / 14) * Math.PI))}
        {words}
      </>
    );
  }
  // they orbit it (the near side bigger and in front)
  const rx = Math.min(W * 0.32, 600);
  const t = (c.f - c.s.from) / 30;
  const orbit = c.s.items.map((it, i) => {
    const a = t * 0.55 + (i / c.s.items.length) * Math.PI * 2;
    const depth = (Math.sin(a) + 1) / 2;
    const kin = springAt(c, c.s.from + 6 + i * stagger(c) * 2);
    return { it, i, depth, style: { left: W / 2 + Math.cos(a) * rx - 230, top: my + Math.sin(a) * ry - 55, opacity: clamp01(kin * 1.6) * (0.55 + 0.45 * depth), transform: `scale(${((0.62 + 0.38 * depth) * Math.max(0.75, u) * (0.6 + 0.4 * kin)).toFixed(3)})`, zIndex: depth > 0.5 ? 3 : 1 } };
  });
  return (
    <>
      {orbit.filter((o) => o.depth <= 0.5).map((o) => chip(o.it, o.style, o.i))}
      <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        {rings}
        {mark()}
      </div>
      {orbit.filter((o) => o.depth > 0.5).map((o) => chip(o.it, o.style, o.i))}
      <div style={{ position: "absolute", inset: 0, zIndex: 4 }}>{words}</div>
    </>
  );
}

// ── feature: the product's UI doing it ─────────────────────────────────────
function Feature({ c }: { c: C }) {
  const items = c.s.items.length ? c.s.items : [{ text: c.s.words.map((w) => w.t).join(" "), icon: c.s.icon }];
  const n = items.length;
  const k = springAt(c, c.s.from + 2, 1.3);
  if (c.s.variant === 0) {
    const click = itemAt(c, n - 1, n) + 26;
    const done = c.f >= click;
    const cardW = 860, rowH = 140, cardH = 140 + n * rowH + 30;
    const lastY = 140 + (n - 1) * rowH + rowH / 2;
    return (
      <Side c={c} dw={cardW} dh={cardH}>
        <div style={abs({ left: 0, top: 0, width: cardW, height: cardH, perspective: 1600 })}>
          <div style={{ ...panel(c, 34), width: "100%", height: "100%", opacity: clamp01(k * 1.6), transform: `rotateY(${((1 - k) * (c.s.left ? 18 : -18)).toFixed(2)}deg) translateY(${((1 - k) * 60).toFixed(1)}px)`, overflow: "hidden" }}>
            <div style={{ height: 140, display: "flex", alignItems: "center", gap: 24, padding: "0 40px", borderBottom: `1.5px solid ${c.look.line}` }}>
              <Glyph c={c} name={c.s.icon} size={76} solid card />
              <One style={{ fontSize: TYPE.TITLE, fontWeight: WEIGHT.title, flex: 1 }} fit={540} face={c.look.text}>{c.brand.name}</One>
              {[0, 1, 2].map((d) => <div key={d} style={{ width: 14, height: 14, borderRadius: 99, background: c.look.line }} />)}
            </div>
            {items.map((it, i) => {
              const kr = springAt(c, itemAt(c, i, n));
              const lit = i === n - 1 && done;
              return (
                <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 24, padding: "0 36px", borderBottom: i < n - 1 ? `1.5px solid ${c.look.line}` : undefined, background: lit ? tint(c.look.panelAccent, 0.1) : undefined, ...rise(kr, 30) }}>
                  <Glyph c={c} name={it.icon ?? c.s.icon} size={72} card />
                  <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, flex: 1 }} fit={580} face={c.look.text}>{it.text}</One>
                  <div style={{ width: 52, height: 52, borderRadius: 99, border: `3px solid ${lit ? c.look.panelAccent : c.look.line}`, background: lit ? c.look.panelAccent : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {lit && <Icon name="check" size={32} color={c.look.onPanelAccent} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Cursor c={c} from={{ x: cardW * 0.3, y: cardH + 300 }} to={{ x: cardW - 58, y: lastY }} click={click} />
      </Side>
    );
  }
  if (c.s.variant === 1) {
    // a phone, its notifications coming in
    const pw = 480, ph = 940;
    return (
      <Side c={c} dw={pw} dh={ph}>
        <div style={abs({ left: 0, top: 0, width: pw, height: ph, ...rise(k, 120) })}>
          <div style={{ width: "100%", height: "100%", borderRadius: 64, background: c.look.dark ? "#0b0c10" : "#15171c", padding: 14, boxSizing: "border-box", boxShadow: `0 50px 120px ${c.look.shadow}` }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 52, background: c.look.dark ? "#16181f" : "#f2f3f6", position: "relative", overflow: "hidden", fontFamily: familyOf(c.look.text) }}>
              <div style={abs({ left: pw / 2 - 70 - 14, top: 16, width: 140, height: 36, borderRadius: 99, background: "#000" })} />
              <div style={center({ left: 0, right: 0, top: 120, height: 90, fontSize: 76, fontWeight: 600, letterSpacing: "-0.03em", color: c.look.dark ? "#fff" : "#111" })}>9:41</div>
              {items.map((it, i) => {
                const kr = springAt(c, itemAt(c, i, n));
                return (
                  <div key={i} style={abs({ left: 18, right: 18, top: 300 + i * 148, height: 132, borderRadius: 30, background: c.look.dark ? "rgba(255,255,255,0.1)" : "#ffffff", boxShadow: "0 10px 30px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 18, padding: "0 20px", color: c.look.dark ? "#fff" : "#111", opacity: clamp01(kr * 1.6), transform: `translateY(${((1 - kr) * -80).toFixed(1)}px) scale(${(0.92 + 0.08 * kr).toFixed(3)})` })}>
                    <Glyph c={c} name={it.icon ?? c.s.icon} size={72} solid />
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <One style={{ fontSize: 36, fontWeight: 700 }} fit={270} face={c.look.text}>{it.text}</One>
                      <One style={{ fontSize: 24, opacity: 0.6 }}>{c.brand.name} · now</One>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Side>
    );
  }
  // a search bar typing the first thing; the rest come up as results
  const typed = items[0].text;
  const t0 = c.s.from + 12;
  const shown = Math.max(0, Math.min(typed.length, Math.floor((c.f - t0) / 2)));
  const doneAt = t0 + typed.length * 2 + 6;
  const results = items.slice(1);
  const dw = 860, dh = 170 + Math.max(1, results.length) * 130 + 40;
  return (
    <Side c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 0, top: 0, width: dw, height: 140, ...panel(c, 99), display: "flex", alignItems: "center", gap: 26, padding: "0 40px", boxSizing: "border-box", ...rise(k, 40) })}>
        <Icon name="search" size={56} color={c.look.panelAccent} strokeWidth={2.4} />
        <div style={{ flex: 1, fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, whiteSpace: "nowrap", overflow: "hidden", position: "relative" }}>
          {typed.slice(0, shown)}
          {c.f < doneAt + 20 && Math.floor(c.f / 8) % 2 === 0 && <span style={{ display: "inline-block", width: 4, height: 54, marginLeft: 4, verticalAlign: "middle", background: c.look.panelAccent }} />}
        </div>
        <div style={{ width: 84, height: 84, borderRadius: 99, background: c.look.panelAccent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${(1 - 0.12 * clamp01(1 - Math.abs(c.f - doneAt) / 5)).toFixed(3)})` }}>
          <Icon name="arrow-right" size={44} color={c.look.onPanelAccent} strokeWidth={2.6} />
        </div>
      </div>
      {results.map((it, i) => {
        const kr = springAt(c, doneAt + 4 + i * stagger(c) * 2);
        return (
          <div key={i} style={abs({ left: 30, top: 170 + i * 130, width: dw - 60, height: 112, ...panel(c, 26), display: "flex", alignItems: "center", gap: 24, padding: "0 30px", boxSizing: "border-box", ...rise(kr, 40) })}>
            <Glyph c={c} name={it.icon ?? c.s.icon} size={64} card />
            <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, flex: 1 }} fit={560} face={c.look.text}>{it.text}</One>
            <Icon name="chevron-right" size={40} color={c.look.panelSub} strokeWidth={2.4} />
          </div>
        );
      })}
    </Side>
  );
}

// ── stat: a number the voice says ──────────────────────────────────────────
function Stat({ c }: { c: C }) {
  const { W, H, pad, u } = c.g;
  const value = c.s.number ?? "";
  const k = springAt(c, c.s.from + 6, 1.2);
  const count = ease(clamp01((c.f - c.s.from - 8) / 40));
  const noNumber = (t: string) => !/\d/.test(t);
  if (c.s.variant === 0) {
    const fit = fitWords([value], c.look.display, { width: W - 2 * pad, lines: 1, max: Math.round(440 * u), min: 140, weight: 800 });
    return (
      <>
        <div style={center({ left: 0, width: W, top: H * 0.1, height: H * 0.5 })}>
          <div style={{ ...display(c, fit.size, { fontWeight: 800, letterSpacing: "-0.05em", color: c.look.accent }), ...pop(k) }}>{countUp(value, count)}</div>
        </div>
        <WordsIn c={c} box={{ left: pad, top: H * 0.6, width: W - 2 * pad, height: H * 0.26 }} place="band" only={noNumber} />
      </>
    );
  }
  if (c.s.variant === 1) {
    const bars = [0.3, 0.42, 0.38, 0.58, 0.7, 1];
    const bw = 96, gap = 34, chartH = 520, dw = 860, dh = 720, x0 = (dw - (bars.length * bw + (bars.length - 1) * gap)) / 2, base = 680;
    return (
      <Side c={c} dw={dw} dh={dh} only={noNumber}>
        <div style={abs({ left: x0 - 30, top: base, width: bars.length * (bw + gap) + 30, height: 3, background: c.look.line })} />
        {bars.map((b, i) => {
          const g = springAt(c, c.s.from + 6 + i * stagger(c) * 2, 1.4);
          const h = chartH * b * clamp01(g);
          const last = i === bars.length - 1;
          return <div key={i} style={abs({ left: x0 + i * (bw + gap), top: base - h, width: bw, height: h, borderRadius: "18px 18px 6px 6px", background: last ? c.look.accent : tint(c.look.accent, c.look.dark ? 0.22 : 0.18), boxShadow: last ? `0 20px 50px ${tint(c.look.accent, 0.35)}` : undefined })} />;
        })}
        <div style={center({ left: x0 + (bars.length - 1) * (bw + gap) - 200 + bw / 2, width: 400, top: base - chartH - 130, height: 110 })}>
          <div style={{ ...display(c, 96, { fontWeight: 800, letterSpacing: "-0.04em" }), ...pop(k) }}>{countUp(value, count)}</div>
        </div>
      </Side>
    );
  }
  // a card: the number ticking up, an arrow and a line drawing
  const dw = 860, dh = 600;
  const size = fitWords([value], c.look.display, { width: 560, lines: 1, max: 220, min: 90, weight: 800 }).size;
  const draw = ease(clamp01((c.f - c.s.from - 10) / 36));
  const pts = [0.82, 0.74, 0.78, 0.6, 0.52, 0.38, 0.3, 0.16].map((y, i) => `${i ? "L" : "M"}${(40 + i * 111).toFixed(0)} ${(380 + y * 160).toFixed(0)}`).join(" ");
  return (
    <Side c={c} dw={dw} dh={dh} only={noNumber}>
      <div style={abs({ left: 0, top: 0, width: dw, height: dh, ...panel(c, 40), overflow: "hidden", ...rise(k, 60) })}>
        <div style={abs({ left: 50, top: 50, display: "flex", alignItems: "center", gap: 20 })}>
          <Glyph c={c} name={c.s.icon} size={72} card />
          <One style={{ fontSize: TYPE.TITLE, fontWeight: WEIGHT.title, color: c.look.panelSub }} fit={500} face={c.look.text}>{c.brand.name}</One>
        </div>
        <div style={abs({ left: 50, top: 150, display: "flex", alignItems: "center", gap: 30 })}>
          <div style={display(c, size, { fontWeight: 800, letterSpacing: "-0.05em", color: c.look.panelInk })}>{countUp(value, count)}</div>
          <div style={{ width: 96, height: 96, borderRadius: 99, background: tint("#16a34a", 0.16), display: "flex", alignItems: "center", justifyContent: "center", ...pop(springAt(c, c.s.from + 30)) }}>
            <Icon name="trending-up" size={56} color="#16a34a" strokeWidth={2.6} />
          </div>
        </div>
        <svg width={dw} height={dh} style={abs({ left: 0, top: 0 })}>
          <path d={pts} fill="none" stroke={c.look.panelAccent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        </svg>
      </div>
    </Side>
  );
}

// ── steps: how it works ────────────────────────────────────────────────────
function Steps({ c }: { c: C }) {
  const items = c.s.items;
  const n = items.length;
  const badge = (i: number, size: number, style: CSSProperties = {}) => <div style={center({ width: size, height: size, borderRadius: 99, background: c.look.accent, color: c.look.onAccent, fontFamily: familyOf(c.look.display), fontWeight: 800, fontSize: size * 0.5, ...style })}>{i + 1}</div>;
  if (c.s.variant === 0) {
    // numbered nodes joined by a line: a row on a wide frame, a column on a tall one
    const row = !tall(c);
    const step = row ? 520 : 250;
    const dw = row ? (n - 1) * step + 440 : 920, dh = row ? 420 : (n - 1) * step + 220;
    const at = (i: number) => (row ? { x: 220 + i * step, y: 120 } : { x: 120, y: 110 + i * step });
    return (
      <Band c={c} dw={dw} dh={dh}>
        {items.slice(0, -1).map((_, i) => {
          const d = ease(clamp01((c.f - itemAt(c, i, n) - 8) / 14));
          const a = at(i), b = at(i + 1);
          return <div key={`l${i}`} style={abs(row ? { left: a.x + 100, top: a.y - 3, width: (b.x - a.x - 200) * d, height: 6, borderRadius: 9, background: c.look.accent } : { left: a.x - 3, top: a.y + 100, width: 6, height: (b.y - a.y - 200) * d, borderRadius: 9, background: c.look.accent })} />;
        })}
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          const a = at(i);
          return (
            <div key={i} style={abs({ left: a.x - (row ? 220 : 100), top: a.y - 100, width: row ? 440 : 900, display: "flex", flexDirection: row ? "column" : "row", alignItems: "center", gap: row ? 34 : 40, ...rise(k, 50) })}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ ...panel(c, 999), width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={it.icon ?? c.s.icon} size={96} color={c.look.panelAccent} strokeWidth={1.8} />
                </div>
                {badge(i, 64, { position: "absolute", right: -6, top: -6 })}
              </div>
              <One style={{ fontFamily: familyOf(c.look.text), fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, color: c.look.ink, maxWidth: row ? 440 : 640 }} fit={row ? 430 : 640} face={c.look.text}>{it.text}</One>
            </div>
          );
        })}
      </Band>
    );
  }
  if (c.s.variant === 1) {
    const rowH = 150;
    return (
      <Side c={c} dw={840} dh={n * rowH + 60}>
        <div style={abs({ left: 0, top: 0, width: 840, height: n * rowH + 60, ...panel(c, 34), padding: "30px 40px", boxSizing: "border-box" })}>
          {items.map((it, i) => {
            const at = itemAt(c, i, n);
            const k = springAt(c, at);
            const tick = ease(clamp01((c.f - at - 10) / 10));
            return (
              <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 28, borderTop: i ? `1.5px solid ${c.look.line}` : undefined, ...rise(k, 30) }}>
                <div style={{ width: 64, height: 64, borderRadius: 99, border: `4px solid ${tick > 0.5 ? c.look.panelAccent : c.look.line}`, background: tint(c.look.panelAccent, tick), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width={36} height={36} viewBox="0 0 24 24">
                    <path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke={c.look.onPanelAccent} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
                  </svg>
                </div>
                <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, flex: 1 }} fit={640} face={c.look.text}>{it.text}</One>
              </div>
            );
          })}
        </div>
      </Side>
    );
  }
  // cards cascading, one after another
  const row = !tall(c);
  const cw = 520, ch = 300, dx = row ? 400 : 0, dy = row ? 70 : 280;
  const dw = row ? cw + (n - 1) * dx : 920, dh = ch + (n - 1) * dy;
  return (
    <Band c={c} dw={dw} dh={dh}>
      {items.map((it, i) => {
        const k = springAt(c, itemAt(c, i, n));
        return (
          <div key={i} style={abs({ left: row ? i * dx : (920 - cw) / 2 + (i - (n - 1) / 2) * 60, top: i * dy, width: cw, height: ch, ...panel(c, 34), padding: 40, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: clamp01(k * 1.6), transform: `translate(${((1 - k) * -60).toFixed(1)}px, ${((1 - k) * 40).toFixed(1)}px) rotate(${((1 - k) * -6).toFixed(2)}deg)` })}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Glyph c={c} name={it.icon ?? c.s.icon} size={88} card />
              {badge(i, 70)}
            </div>
            <One style={{ fontSize: TYPE.ITEM, fontWeight: WEIGHT.item }} fit={cw - 80} face={c.look.text}>{it.text}</One>
          </div>
        );
      })}
    </Band>
  );
}

// ── cta: the brand and the ask ─────────────────────────────────────────────
// (a button's width: its words, the arrow and the padding)
const buttonWidth = (c: C, size: number) => {
  const fit = fitWords([c.brand.cta], c.look.display, { width: 720, lines: 1, max: size, min: 32 });
  return emWidth(c.brand.cta, c.look.display, 750) * fit.size + fit.size * 2.7;
};
export function Button({ c, at, size = 60, on }: { c: C; at: number; size?: number; on?: { bg: string; ink: string } }) {
  const k = springAt(c, at);
  const fit = fitWords([c.brand.cta], c.look.display, { width: 720 * c.g.u, lines: 1, max: size, min: 32 });
  const press = clamp01(1 - Math.abs(c.f - (at + 34)) / 5);
  const bg = on?.bg ?? c.look.accent, ink = on?.ink ?? c.look.onAccent;
  return (
    <div style={{ opacity: clamp01(k * 1.8), display: "flex", alignItems: "center", gap: 22, padding: `${fit.size * 0.55}px ${fit.size * 0.9}px`, borderRadius: 999, background: bg, color: ink, fontFamily: familyOf(c.look.display), fontWeight: 750, fontSize: fit.size, whiteSpace: "nowrap", boxShadow: `0 24px 60px ${tint(bg, 0.4)}`, transform: `scale(${((0.6 + 0.4 * k) * (1 - press * 0.06)).toFixed(4)})` }}>
      {c.brand.cta}
      <Icon name="arrow-right" size={fit.size * 0.9} color={ink} strokeWidth={2.6} />
    </div>
  );
}
// Every way of it centred on the frame (or on its half): its parts stacked
// as one group, the group in the middle — never one side left empty.
function Cta({ c }: { c: C }) {
  const { W, H, pad, u } = c.g;
  // (its click: clickOf)
  const at = c.s.from + 18;
  const k = springAt(c, c.s.from + 2, 1.3);
  const repeat = norm(c.s.words.map((w) => w.t).join(" ")) === norm(c.brand.name);
  const bs = Math.round(TYPE.BUTTON * Math.max(0.8, u));
  const bh = bs * 2.2;
  const words = c.s.words.map((w) => w.t);
  // the words' height at their size in a place
  const wordsH = (width: number, lines: number, max: number) => {
    const fit = fitWords(words, c.look.display, { width, lines, max, min: 44 });
    return { max, lines, height: fit.lines.length * fit.size * 1.08 };
  };
  // parts of these heights one under the other, the whole centred in a height: each one's top
  const stack = (heights: number[], gap: number, top: number, height: number) => {
    let y = top + Math.max(0, (height - heights.reduce((s, h) => s + h, 0) - gap * (heights.length - 1)) / 2);
    return heights.map((h) => ((y += h + gap), y - h - gap));
  };
  const nameSize = (width: number, max: number) => Math.round(fitWords([c.brand.name], c.look.display, { width, lines: 1, max, min: 44 }).size);
  if (c.s.variant === 0) {
    // the brand first: its mark and name, the words under them, the button
    const ms = Math.round(150 * u);
    const sub = wordsH(W - 2 * pad, tall(c) ? 3 : 2, Math.round(TYPE.SUB * u));
    const [yName, yWords, yButton] = stack([ms, repeat ? 0 : sub.height, bh], 56 * u, 0, H);
    return (
      <>
        <div style={center({ left: 0, width: W, top: yName, height: ms, gap: 36 * u, ...rise(k) })}>
          <Mark c={c} size={ms} />
          <div style={display(c, nameSize(W - 2 * pad - 200 * u, Math.round(TYPE.HEAD * u)))}>{c.brand.name}</div>
        </div>
        {!repeat && (
          <div style={center({ left: pad, width: W - 2 * pad, top: yWords, height: sub.height })}>
            <Words c={c} width={W - 2 * pad} lines={sub.lines} max={sub.max} min={44} color={c.look.sub} />
          </div>
        )}
        <div style={center({ left: 0, width: W, top: yButton, height: bh })}>
          <Button c={c} at={at} size={bs} />
        </div>
        <Cursor c={c} from={{ x: W / 2 + 460 * u, y: H + 40 }} to={{ x: W / 2 + buttonWidth(c, bs) / 2 - 40, y: yButton + bh / 2 + 20 }} click={at + 34} />
      </>
    );
  }
  if (c.s.variant === 1) {
    // the words first: big, the brand small above them, the button under them
    const ms = Math.round(84 * Math.max(0.8, u));
    const head = wordsH(W - 2 * pad, tall(c) ? 4 : 2, Math.round(TYPE.HEAD * u));
    const [yBrand, yWords, yButton] = stack([ms, repeat ? 0 : head.height, bh], 64 * u, 0, H);
    return (
      <>
        <div style={center({ left: pad, top: yBrand, width: W - 2 * pad, height: ms, gap: 22, ...rise(k, 30) })}>
          <Mark c={c} size={ms} />
          {/* (the words say the name already: the mark alone) */}
          {!repeat && <div style={display(c, Math.round(TYPE.TITLE * Math.max(0.8, u)))}>{c.brand.name}</div>}
        </div>
        {!repeat && (
          <div style={center({ left: pad, width: W - 2 * pad, top: yWords, height: head.height })}>
            <Words c={c} width={W - 2 * pad} lines={head.lines} max={head.max} min={44} />
          </div>
        )}
        <div style={center({ left: pad, width: W - 2 * pad, top: yButton, height: bh })}>
          <Button c={c} at={at} size={bs} />
        </div>
      </>
    );
  }
  // the brand on a half of its colour, the words and the ask centred on the other
  const wide = !tall(c);
  const m = pad * 0.6;
  const half = wide ? { left: c.s.left ? 0 : W / 2, top: 0, width: W / 2, height: H } : { left: 0, top: 0, width: W, height: H * 0.44 };
  const rest = wide ? { left: (c.s.left ? W / 2 : 0) + m, top: 0, width: W / 2 - 2 * m, height: H } : { left: pad, top: H * 0.44, width: W - 2 * pad, height: H * 0.56 };
  const head = wordsH(rest.width, 3, Math.round(TYPE.HEAD * u * (wide ? 0.85 : 1)));
  const [yWords, yButton] = stack([repeat ? 0 : head.height, bh], 60 * u, rest.top, rest.height);
  const wipe = ease(clamp01((c.f - c.s.from) / 18));
  const onA = c.look.onFill;
  return (
    <>
      <div style={center({ ...half, background: c.look.fill, flexDirection: "column", gap: 30 * u, clipPath: wide ? `inset(0 ${c.s.left ? (1 - wipe) * 100 : 0}% 0 ${c.s.left ? 0 : (1 - wipe) * 100}%)` : `inset(0 0 ${(1 - wipe) * 100}% 0)` })}>
        <div style={{ ...pop(springAt(c, c.s.from + 10)) }}>
          <Mark c={{ ...c, look: { ...c.look, accent: onA, onAccent: c.look.fill } }} size={Math.round(180 * u)} />
        </div>
        <div style={display(c, nameSize(half.width - 2 * m, Math.round(TYPE.HEAD * u)), { color: onA })}>{c.brand.name}</div>
      </div>
      {!repeat && (
        <div style={center({ left: rest.left, width: rest.width, top: yWords, height: head.height })}>
          <Words c={c} width={rest.width} lines={head.lines} max={head.max} min={44} />
        </div>
      )}
      <div style={center({ left: rest.left, width: rest.width, top: yButton, height: bh })}>
        <Button c={c} at={at} size={bs} />
      </div>
    </>
  );
}

export const TEMPLATES_1 = { statement: Statement, trouble: Trouble, reveal: Reveal, feature: Feature, stat: Stat, steps: Steps, cta: Cta };
