import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import { emWidth, familyOf } from "../composer/art";
import { fitWords } from "./fit";
import { type C, Cursor, Glyph, Mark, One, Words, clamp01, countUp, ease, panel, pop, rise, springAt, stagger, tint } from "./kit";
import type { Scene, TemplateId } from "./types";

// The templates (docs/video-spec.md): every scene is one of these, each in
// two designed variants, mirrored by `left`. Everything has its place on the
// 1920 × 1080 frame; words are fitted to theirs, so nothing can overlap.

const W = 1920, H = 1080, X0 = 140, X1 = W - 140;
const abs = (style: CSSProperties): CSSProperties => ({ position: "absolute", ...style });
const center = (style: CSSProperties = {}): CSSProperties => abs({ display: "flex", alignItems: "center", justifyContent: "center", ...style });
// the two columns of a split scene: the hero's and the words'
const cols = (left: boolean) => (left ? { hero: { left: X0, width: 860 }, text: { left: 1100, width: X1 - 1100 } } : { hero: { left: X1 - 860, width: 860 }, text: { left: X0, width: 680 } });
// when the scene's things come in: spread over its first half
const thingAt = (s: Scene, i: number, n: number) => s.from + 10 + Math.round(i * Math.min(16, ((s.to - s.from) * 0.45) / Math.max(1, n)));
const itemAt = (c: C, i: number, n: number) => thingAt(c.s, i, n);
// the scene's click (its cursor's or its button's), for its sound
export function clickOf(s: Scene): number | null {
  if (s.template === "feature" && s.variant === 0) return thingAt(s, Math.max(1, s.items.length) - 1, Math.max(1, s.items.length)) + 26;
  if (s.template === "cta") return s.from + 52;
  return null;
}
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const saysName = (c: C) => norm(c.s.words.map((w) => w.t).join(" ")).includes(norm(c.brand.name));

// ── statement: the words are the hero ─────────────────────────────────────
function Statement({ c }: { c: C }) {
  if (c.s.variant === 0)
    return (
      <div style={center({ inset: 0 })}>
        <Words c={c} width={1640} lines={2} max={210} min={90} />
      </div>
    );
  // (the words the wider side: the icon is a mark beside them)
  const hero = c.s.left ? { left: X0, width: 560 } : { left: X1 - 560, width: 560 };
  const text = c.s.left ? { left: X0 + 640, width: X1 - X0 - 640 } : { left: X0, width: X1 - X0 - 640 };
  const k = springAt(c, c.s.from + 4, 1.4);
  const float = Math.sin((c.f - c.s.from) / 22) * 10;
  return (
    <>
      <div style={abs({ ...text, top: 0, bottom: 0, display: "flex", alignItems: "center" })}>
        <Words c={c} width={text.width} lines={3} max={160} min={70} align="left" />
      </div>
      <div style={center({ ...hero, top: 0, bottom: 0 })}>
        <div style={{ ...pop(k), transform: `${pop(k).transform} translateY(${float.toFixed(1)}px) rotate(${((1 - k) * -14).toFixed(2)}deg)` }}>
          <Glyph c={c} name={c.s.icon} size={320} solid />
        </div>
      </div>
    </>
  );
}

// ── trouble: the pains, struck out or piling up ────────────────────────────
function Trouble({ c }: { c: C }) {
  const items = c.s.items;
  const n = items.length;
  if (c.s.variant === 0) {
    const last = itemAt(c, n - 1, n);
    const tw = 470, gap = 60, x0 = (W - (n * tw + (n - 1) * gap)) / 2;
    return (
      <>
        <div style={center({ left: X0, width: X1 - X0, top: 110, height: 280 })}>
          <Words c={c} width={X1 - X0} lines={2} max={120} min={60} />
        </div>
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          const strike = ease(clamp01((c.f - (last + 18 + i * 6)) / 12));
          return (
            <div key={i} style={abs({ left: x0 + i * (tw + gap), top: 430, width: tw, height: 420, ...rise(k, 80) })}>
              <div style={{ ...panel(c), width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, opacity: 1 - strike * 0.45 }}>
                <Glyph c={c} name={it.icon ?? c.s.icon} size={170} card />
                <One style={{ fontSize: 48, fontWeight: 650, maxWidth: tw - 50 }} fit={tw - 60} face={c.look.text}>{it.text}</One>
              </div>
              <svg width={tw} height={420} style={abs({ left: 0, top: 0 })}>
                <line x1={50} y1={370} x2={tw - 50} y2={50} stroke={c.look.bad} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} />
              </svg>
            </div>
          );
        })}
      </>
    );
  }
  const { hero, text } = cols(c.s.left);
  const turn = [-7, 5, -2];
  return (
    <>
      <div style={abs({ ...text, top: 0, bottom: 0, display: "flex", alignItems: "center" })}>
        <Words c={c} width={text.width} lines={4} max={130} min={64} align="left" />
      </div>
      {items.map((it, i) => {
        const k = springAt(c, itemAt(c, i, n));
        const y = 540 - ((n - 1) * 190) / 2 + i * 190 - 90;
        return (
          <div key={i} style={abs({ left: hero.left + 20, top: y, width: 820, height: 180, opacity: clamp01(k * 1.6), transform: `translateY(${((1 - k) * -420).toFixed(1)}px) rotate(${(turn[i] * (0.4 + 0.6 * k)).toFixed(2)}deg)` })}>
            <div style={{ ...panel(c, 26), height: "100%", display: "flex", alignItems: "center", gap: 28, padding: "0 34px" }}>
              <div style={{ width: 100, height: 100, borderRadius: 26, background: tint(c.look.bad, 0.14), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={it.icon ?? "triangle-alert"} size={54} color={c.look.bad} strokeWidth={2.2} />
              </div>
              <One style={{ fontSize: 54, fontWeight: 650, flex: 1 }} fit={560} face={c.look.text}>{it.text}</One>
              <div style={{ width: 20, height: 20, borderRadius: 99, background: c.look.bad }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── reveal: the brand lands ────────────────────────────────────────────────
function Reveal({ c }: { c: C }) {
  const k = springAt(c, c.s.from + 6, 1.3);
  const ring = clamp01((c.f - c.s.from - 10) / 34);
  const words = saysName(c) ? (
    <Words c={c} width={1500} lines={2} max={130} min={64} />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ fontFamily: familyOf(c.look.display), fontWeight: 750, fontSize: 120, letterSpacing: "-0.03em", color: c.look.ink, whiteSpace: "nowrap", ...rise(k) }}>{c.brand.name}</div>
      <Words c={c} width={1400} lines={1} max={84} min={44} color={c.look.sub} />
    </div>
  );
  const rings = (
    <>
      {[0, 0.35].map((d, i) => {
        const r = clamp01(ring - d);
        return r > 0 && r < 1 ? <div key={i} style={center({ left: W / 2 - 160, top: (c.s.variant ? 470 : 400) - 160, width: 320, height: 320, borderRadius: 999, border: `5px solid ${c.look.accent}`, transform: `scale(${(0.7 + 0.9 * r).toFixed(3)})`, opacity: 1 - r })} /> : null;
      })}
    </>
  );
  if (c.s.variant === 0 || c.s.items.length < 2)
    return (
      <>
        {rings}
        <div style={center({ left: 0, width: W, top: 400 - 140, height: 280 })}>
          <div style={pop(k)}>
            <Mark c={c} size={260} />
          </div>
        </div>
        <div style={center({ left: X0, width: X1 - X0, top: 640, height: 340 })}>{words}</div>
      </>
    );
  // the things it brings together fly into it
  // (their paths stay above the words)
  const homes = [{ x: 360, y: 240 }, { x: 1560, y: 230 }, { x: 1580, y: 540 }];
  const land = c.s.from + 22 + c.s.items.length * stagger(c) * 3;
  return (
    <>
      {c.s.items.map((it, i) => {
        const kin = springAt(c, c.s.from + 4 + i * stagger(c) * 2);
        const go = ease(clamp01((c.f - land - i * 3) / 18));
        const x = homes[i].x + (W / 2 - homes[i].x) * go, y = homes[i].y + (470 - homes[i].y) * go;
        return (
          <div key={i} style={abs({ left: x - 230, top: y - 55, width: 460, height: 110, opacity: clamp01(kin * 1.6) * (1 - go), transform: `scale(${((0.7 + 0.3 * kin) * (1 - 0.6 * go)).toFixed(3)})` })}>
            <div style={{ ...panel(c, 99), height: "100%", display: "flex", alignItems: "center", gap: 20, padding: "0 28px 0 18px" }}>
              <Glyph c={c} name={it.icon ?? c.s.icon} size={74} card />
              <One style={{ fontSize: 40, fontWeight: 650 }} fit={300} face={c.look.text}>{it.text}</One>
            </div>
          </div>
        );
      })}
      {rings}
      <div style={center({ left: 0, width: W, top: 470 - 110, height: 220 })}>
        <div style={{ ...pop(k), transform: `scale(${((0.6 + 0.4 * k) * (1 + 0.08 * Math.sin(clamp01((c.f - land - 16) / 14) * Math.PI))).toFixed(4)})` }}>
          <Mark c={c} size={200} />
        </div>
      </div>
      <div style={center({ left: X0, width: X1 - X0, top: 680, height: 300 })}>{words}</div>
    </>
  );
}

// ── feature: the product's UI doing it ─────────────────────────────────────
function Feature({ c }: { c: C }) {
  const { hero, text } = cols(c.s.left);
  const items = c.s.items.length ? c.s.items : [{ text: c.s.words.map((w) => w.t).join(" "), icon: c.s.icon }];
  const n = items.length;
  const k = springAt(c, c.s.from + 2, 1.3);
  const words = (
    <div style={abs({ ...text, top: 0, bottom: 0, display: "flex", alignItems: "center" })}>
      <Words c={c} width={text.width} lines={4} max={120} min={60} align="left" />
    </div>
  );
  if (c.s.variant === 0) {
    const click = itemAt(c, n - 1, n) + 26;
    const done = c.f >= click;
    const cardW = 860, rowH = 140, cardH = 140 + n * rowH + 30, top = (H - cardH) / 2;
    const lastY = top + 140 + (n - 1) * rowH + rowH / 2;
    return (
      <>
        {words}
        <div style={abs({ left: hero.left, top, width: cardW, height: cardH, perspective: 1600 })}>
          <div style={{ ...panel(c, 34), width: "100%", height: "100%", opacity: clamp01(k * 1.6), transform: `rotateY(${((1 - k) * (c.s.left ? 18 : -18)).toFixed(2)}deg) translateY(${((1 - k) * 60).toFixed(1)}px)`, overflow: "hidden" }}>
            <div style={{ height: 140, display: "flex", alignItems: "center", gap: 24, padding: "0 40px", borderBottom: `1.5px solid ${c.look.line}` }}>
              <Glyph c={c} name={c.s.icon} size={76} solid card />
              <One style={{ fontSize: 44, fontWeight: 700, flex: 1 }} fit={540} face={c.look.text}>{c.brand.name}</One>
              {[0, 1, 2].map((d) => <div key={d} style={{ width: 14, height: 14, borderRadius: 99, background: c.look.line }} />)}
            </div>
            {items.map((it, i) => {
              const kr = springAt(c, itemAt(c, i, n));
              const lit = i === n - 1 && done;
              return (
                <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 24, padding: "0 36px", borderBottom: i < n - 1 ? `1.5px solid ${c.look.line}` : undefined, background: lit ? tint(c.look.panelAccent, 0.1) : undefined, ...rise(kr, 30) }}>
                  <Glyph c={c} name={it.icon ?? c.s.icon} size={72} card />
                  <One style={{ fontSize: 50, fontWeight: 600, flex: 1 }} fit={580} face={c.look.text}>{it.text}</One>
                  <div style={{ width: 52, height: 52, borderRadius: 99, border: `3px solid ${lit ? c.look.panelAccent : c.look.line}`, background: lit ? c.look.panelAccent : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {lit && <Icon name="check" size={32} color={c.look.panelAccent === c.look.accent ? c.look.onAccent : "#ffffff"} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Cursor c={c} from={{ x: hero.left + cardW * 0.3, y: H + 60 }} to={{ x: hero.left + cardW - 58, y: lastY }} click={click} />
      </>
    );
  }
  // a phone, its notifications coming in
  const pw = 480, ph = 940, px = hero.left + (hero.width - pw) / 2, py = (H - ph) / 2;
  return (
    <>
      {words}
      <div style={abs({ left: px, top: py, width: pw, height: ph, ...rise(k, 120) })}>
        <div style={{ width: "100%", height: "100%", borderRadius: 64, background: c.look.dark ? "#0b0c10" : "#15171c", padding: 14, boxShadow: `0 50px 120px ${c.look.shadow}` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 52, background: c.look.dark ? "#16181f" : "#f2f3f6", position: "relative", overflow: "hidden", fontFamily: familyOf(c.look.text) }}>
            <div style={abs({ left: pw / 2 - 70 - 14, top: 16, width: 140, height: 36, borderRadius: 99, background: "#000" })} />
            <div style={abs({ left: 0, right: 0, top: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: c.look.dark ? "#fff" : "#111" })}>
              <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: "-0.03em" }}>9:41</div>
            </div>
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
    </>
  );
}

// ── stat: a number the voice says ──────────────────────────────────────────
function Stat({ c }: { c: C }) {
  const value = c.s.number ?? "";
  const k = springAt(c, c.s.from + 6, 1.2);
  const count = ease(clamp01((c.f - c.s.from - 8) / 40));
  const rest = { ...c, s: { ...c.s, words: c.s.words.filter((w) => !/\d/.test(w.t)) } };
  if (c.s.variant === 0) {
    const fit = fitWords([value], c.look.display, { width: 1500, lines: 1, max: 440, min: 160, weight: 800 });
    return (
      <>
        <div style={center({ left: 0, width: W, top: 110, height: 540 })}>
          <div style={{ fontFamily: familyOf(c.look.display), fontWeight: 800, fontSize: fit.size, letterSpacing: "-0.05em", color: c.look.accent, ...pop(k), whiteSpace: "nowrap" }}>{countUp(value, count)}</div>
        </div>
        <div style={center({ left: X0, width: X1 - X0, top: 640, height: 260 })}>
          <Words c={rest} width={1400} lines={2} max={100} min={52} />
        </div>
      </>
    );
  }
  const { hero, text } = cols(c.s.left);
  const bars = [0.3, 0.42, 0.38, 0.58, 0.7, 1];
  const bw = 96, gap = 34, chartH = 520, x0 = hero.left + (hero.width - (bars.length * bw + (bars.length - 1) * gap)) / 2, base = 820;
  return (
    <>
      <div style={abs({ ...text, top: 0, bottom: 0, display: "flex", alignItems: "center" })}>
        <Words c={rest} width={text.width} lines={4} max={110} min={56} align="left" />
      </div>
      <div style={abs({ left: x0 - 30, top: base, width: bars.length * (bw + gap) + 30, height: 3, background: c.look.line })} />
      {bars.map((b, i) => {
        const g = springAt(c, c.s.from + 6 + i * stagger(c) * 2, 1.4);
        const h = chartH * b * clamp01(g);
        const last = i === bars.length - 1;
        return (
          <div key={i} style={abs({ left: x0 + i * (bw + gap), top: base - h, width: bw, height: h, borderRadius: "18px 18px 6px 6px", background: last ? c.look.accent : tint(c.look.accent, c.look.dark ? 0.22 : 0.18), boxShadow: last ? `0 20px 50px ${tint(c.look.accent, 0.35)}` : undefined })} />
        );
      })}
      <div style={center({ left: x0 + (bars.length - 1) * (bw + gap) - 200 + bw / 2, width: 400, top: base - chartH - 130, height: 110 })}>
        <div style={{ fontFamily: familyOf(c.look.display), fontWeight: 800, fontSize: 96, color: c.look.ink, letterSpacing: "-0.04em", whiteSpace: "nowrap", ...pop(k) }}>{countUp(value, count)}</div>
      </div>
    </>
  );
}

// ── steps: how it works ────────────────────────────────────────────────────
function Steps({ c }: { c: C }) {
  const items = c.s.items;
  const n = items.length;
  if (c.s.variant === 0) {
    const xs = items.map((_, i) => W / 2 + (i - (n - 1) / 2) * 520);
    return (
      <>
        <div style={center({ left: X0, width: X1 - X0, top: 100, height: 280 })}>
          <Words c={c} width={X1 - X0} lines={2} max={116} min={60} />
        </div>
        {items.slice(0, -1).map((_, i) => {
          const d = ease(clamp01((c.f - itemAt(c, i, n) - 8) / 14));
          return <div key={`l${i}`} style={abs({ left: xs[i] + 100, top: 588, width: (xs[i + 1] - xs[i] - 200) * d, height: 6, borderRadius: 9, background: c.look.accent })} />;
        })}
        {items.map((it, i) => {
          const k = springAt(c, itemAt(c, i, n));
          return (
            <div key={i} style={abs({ left: xs[i] - 220, top: 470, width: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, ...rise(k, 50) })}>
              <div style={{ position: "relative" }}>
                <div style={{ ...panel(c, 999), width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={it.icon ?? c.s.icon} size={110} color={c.look.panelAccent} strokeWidth={1.8} />
                </div>
                <div style={center({ right: -6, top: -6, width: 70, height: 70, borderRadius: 99, background: c.look.accent, color: c.look.onAccent, fontFamily: familyOf(c.look.display), fontWeight: 800, fontSize: 36 })}>{i + 1}</div>
              </div>
              <One style={{ fontFamily: familyOf(c.look.text), fontSize: 44, fontWeight: 650, color: c.look.ink, maxWidth: 440 }} fit={430} face={c.look.text}>{it.text}</One>
            </div>
          );
        })}
      </>
    );
  }
  const { hero, text } = cols(c.s.left);
  const rowH = 150, top = (H - n * rowH - 60) / 2;
  return (
    <>
      <div style={abs({ ...text, top: 0, bottom: 0, display: "flex", alignItems: "center" })}>
        <Words c={c} width={text.width} lines={4} max={120} min={60} align="left" />
      </div>
      <div style={abs({ left: hero.left + 20, top, width: 840, height: n * rowH + 60, ...panel(c, 34), padding: "30px 40px", boxSizing: "border-box" })}>
        {items.map((it, i) => {
          const at = itemAt(c, i, n);
          const k = springAt(c, at);
          const tick = ease(clamp01((c.f - at - 10) / 10));
          return (
            <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 28, borderTop: i ? `1.5px solid ${c.look.line}` : undefined, ...rise(k, 30) }}>
              <div style={{ width: 64, height: 64, borderRadius: 99, border: `4px solid ${tick > 0.5 ? c.look.panelAccent : c.look.line}`, background: tint(c.look.panelAccent, tick), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width={36} height={36} viewBox="0 0 24 24">
                  <path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke={c.look.panelAccent === c.look.accent ? c.look.onAccent : "#ffffff"} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
                </svg>
              </div>
              <One style={{ fontSize: 54, fontWeight: 600, flex: 1 }} fit={640} face={c.look.text}>{it.text}</One>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── cta: the brand and the ask ─────────────────────────────────────────────
// (its width: the words, the arrow and the padding)
const buttonWidth = (c: C, size: number) => {
  const fit = fitWords([c.brand.cta], c.look.display, { width: 720, lines: 1, max: size, min: 32 });
  return emWidth(c.brand.cta, c.look.display, 750) * fit.size + fit.size * 2.7;
};
function Button({ c, at, size = 60 }: { c: C; at: number; size?: number }) {
  const k = springAt(c, at);
  const fit = fitWords([c.brand.cta], c.look.display, { width: 720, lines: 1, max: size, min: 32 });
  const press = clamp01(1 - Math.abs(c.f - (at + 34)) / 5);
  return (
    <div style={{ ...pop(k), display: "flex", alignItems: "center", gap: 22, padding: `${fit.size * 0.55}px ${fit.size * 0.9}px`, borderRadius: 999, background: c.look.accent, color: c.look.onAccent, fontFamily: familyOf(c.look.display), fontWeight: 750, fontSize: fit.size, whiteSpace: "nowrap", boxShadow: `0 24px 60px ${tint(c.look.accent, 0.4)}`, transform: `${pop(k).transform} scale(${(1 - press * 0.06).toFixed(3)})` }}>
      {c.brand.cta}
      <Icon name="arrow-right" size={fit.size * 0.9} color={c.look.onAccent} strokeWidth={2.6} />
    </div>
  );
}
function Cta({ c }: { c: C }) {
  // (its click: clickOf)
  const at = c.s.from + 18;
  const k = springAt(c, c.s.from + 2, 1.3);
  const name = (size: number): ReactNode => <div style={{ fontFamily: familyOf(c.look.display), fontWeight: 750, fontSize: size, letterSpacing: "-0.03em", color: c.look.ink, whiteSpace: "nowrap" }}>{c.brand.name}</div>;
  const repeat = norm(c.s.words.map((w) => w.t).join(" ")) === norm(c.brand.name);
  if (c.s.variant === 0)
    return (
      <>
        <div style={center({ left: 0, width: W, top: 200, height: 200, gap: 36, ...rise(k) })}>
          <Mark c={c} size={150} />
          {name(120)}
        </div>
        {!repeat && (
          <div style={center({ left: X0, width: X1 - X0, top: 440, height: 200 })}>
            <Words c={c} width={1500} lines={2} max={96} min={52} />
          </div>
        )}
        <div style={center({ left: 0, width: W, top: 680, height: 200 })}>
          <Button c={c} at={at} />
        </div>
        <Cursor c={c} from={{ x: W / 2 + 460, y: H + 40 }} to={{ x: W / 2 + buttonWidth(c, 60) / 2 - 40, y: 800 }} click={at + 34} />
      </>
    );
  return (
    <>
      <div style={abs({ left: X0, top: 96, display: "flex", alignItems: "center", gap: 22, ...rise(k, 30) })}>
        <Mark c={c} size={84} />
        {/* (the words say the name already: the mark alone) */}
        {!repeat && name(54)}
      </div>
      <div style={abs({ left: X0, width: X1 - X0, top: 300, height: 360, display: "flex", alignItems: "center" })}>
        <Words c={c} width={X1 - X0} lines={2} max={150} min={70} align="left" />
      </div>
      <div style={abs({ left: X0, top: 720 })}>
        <Button c={c} at={at} size={56} />
      </div>
    </>
  );
}

export const TEMPLATE: Record<TemplateId, (p: { c: C }) => ReactNode> = { statement: Statement, trouble: Trouble, reveal: Reveal, feature: Feature, stat: Stat, steps: Steps, cta: Cta };
