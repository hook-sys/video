import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import { familyOf } from "./faces";
import { fitWords, noteHero } from "./fit";
import { TYPE, WEIGHT, fitIn } from "./geo";
import { type C, Glyph, One, blend, clamp01, countUp, ease, panel, pop, rise, springAt, tint } from "./kit";
import { Band, Side, abs } from "./scenes";
import { toAscii } from "./bangla";
import { numberOf } from "./points";
import { TINTS } from "./panel";
import type { Scene } from "./types";

// The ideas (docs/video-spec.md): a beat whose words picture one idea shows
// that idea, not an icon beside its words — an idea shut in a box, a pile of
// things put in order, a bar that will not fill, one word that is really
// another, a line taking off. Each has a turn (its lit word said): there it
// resolves — the box opens, the pile falls into a grid, the bar fills. A beat
// about what goes wrong (a hook, a problem) never resolves: the box stays shut.
// The variants: beside the words, under them, or the idea alone on the frame
// (the voice says the words). The truth is always alone: the two words are it.

const bare = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const first = (t: string) => bare(t.split(/\s+/)[0] ?? "");

// The turn: its lit word said (the truth: its second word said), never in its
// first 0.8 s nor its last 1.3 s
export function turnOf(s: Scene): number {
  let t: number | null = null;
  if (s.concept === "truth" && s.items.length >= 2) {
    const said = s.said ?? [];
    const x = said.findIndex((w) => bare(w.t) === first(s.items[0].text));
    const y = said.findIndex((w, i) => i > x && bare(w.t) === first(s.items[1].text));
    if (y >= 0) t = said[y].at - 2;
  }
  if (t == null) {
    const key = s.words.find((w) => w.key);
    t = key ? key.at : Math.round(s.from + (s.to - s.from) * 0.55);
  }
  return Math.max(s.from + 24, Math.min(s.to - 40, t));
}

// the idea in its place: beside the words, under them, or alone
function Place({ c, dw, dh, children }: { c: C; dw: number; dh: number; children: ReactNode }) {
  if (c.s.variant === 0) return <Side c={c} dw={dw} dh={dh}>{children}</Side>;
  if (c.s.variant === 1) return <Band c={c} dw={dw} dh={dh}>{children}</Band>;
  const { W, H, pad } = c.g;
  const box = { left: pad, top: pad * 0.5, width: W - 2 * pad, height: H - pad };
  const s = Math.min(1.5, box.width / dw, box.height / dh);
  noteHero((dw * s * dh * s) / (W * H));
  return <div style={fitIn(box, dw, dh, 1.5)}>{children}</div>;
}

// ── trapped: an idea bouncing off the walls of its box ───────────────────
const TR = { dw: 760, dh: 700, side: 580, th: 26, icon: 210, px: 21, py: 29, give: 18 };
// (a triangle wave: 0 at even u, 1 at odd)
const tri = (u: number) => 1 - Math.abs((((u % 2) + 2) % 2) - 1);
const trapStart = (s: Scene) => s.from + 6;
// the frames it hits a wall (until the turn, or to the end when it stays shut)
export function trappedHits(s: Scene): number[] {
  const end = s.resolves ? turnOf(s) : s.to;
  const out: number[] = [];
  for (const p of [TR.px, TR.py]) for (let n = 1; trapStart(s) + (n - 0.5) * p < end; n++) out.push(Math.round(trapStart(s) + (n - 0.5) * p));
  return out.sort((a, b) => a - b);
}
function Trapped({ c }: { c: C }) {
  const { dw, dh, th, icon, px, py, give } = TR;
  const { s, f, look } = c;
  const T = s.resolves ? turnOf(s) : Infinity;
  // (shut, the box closes in a little as the scene goes on)
  const side = TR.side * (s.resolves ? 1 : 1 - 0.1 * ease(clamp01((f - s.from) / Math.max(1, s.to - s.from))));
  const L = (dw - side) / 2, top = (dh - side) / 2;
  const travel = side - 2 * th - icon - 24;
  const tt = Math.min(f, T) - trapStart(s);
  const ux = tt / px + 0.5, uy = tt / py + 0.5;
  // (the wall last hit gives, and springs back: [the low wall, the high wall])
  const bump = (u: number, p: number): [number, number] => {
    if (f >= T || u < 1) return [0, 0];
    const k = Math.exp(-((u - Math.floor(u)) * p) / 4);
    return Math.floor(u) % 2 ? [0, k] : [k, 0];
  };
  const [bl, br] = bump(ux, px), [bt, bb] = bump(uy, py);
  const free = s.resolves ? ease(clamp01((f - T) / 16)) : 0;
  const away = free * 420;
  const wall = (style: CSSProperties, turn: number): CSSProperties => abs({ background: look.ink, borderRadius: th / 2, opacity: 0.88 * (1 - free), transform: `rotate(${(free * turn).toFixed(2)}deg)`, ...style });
  // the idea: where it was at the turn, then to the middle, bigger
  const x0 = L + th + 12 + tri(ux) * travel, y0 = top + th + 12 + tri(uy) * travel;
  const g = s.resolves ? ease(clamp01((f - T) / 14)) : 0;
  const x = x0 + ((dw - icon) / 2 - x0) * g, y = y0 + ((dh - icon) / 2 - y0) * g;
  const sx = 1 - 0.18 * (bl + br), sy = 1 - 0.18 * (bt + bb);
  const ring = s.resolves ? clamp01((f - T) / 22) : 0;
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ inset: 0, ...pop(springAt(c, s.from + 2)) })}>
        <div style={abs({ left: L + th / 2, top: top + th / 2, width: side - th, height: side - th, background: tint(look.ink, 0.06), opacity: 1 - free })} />
        <div style={wall({ left: L, top: top - bt * give - away, width: side, height: th }, -8)} />
        <div style={wall({ left: L, top: top + side - th + bb * give + away, width: side, height: th }, 8)} />
        <div style={wall({ left: L - bl * give - away, top, width: th, height: side }, 8)} />
        <div style={wall({ left: L + side - th + br * give + away, top, width: th, height: side }, -8)} />
      </div>
      {g > 0 && <div style={abs({ left: dw / 2 - icon * 1.6, top: dh / 2 - icon * 1.6, width: icon * 3.2, height: icon * 3.2, borderRadius: 999, background: `radial-gradient(closest-side, ${tint(look.accent, 0.35)}, transparent)`, opacity: g })} />}
      {ring > 0 && ring < 1 && <div style={abs({ left: dw / 2 - icon, top: dh / 2 - icon, width: icon * 2, height: icon * 2, borderRadius: 999, border: `8px solid ${look.accent}`, transform: `scale(${(0.5 + 1.6 * ring).toFixed(3)})`, opacity: 1 - ring })} />}
      <div style={abs({ left: x, top: y, width: icon, height: icon, transform: `scale(${(sx * (1 + 0.9 * g)).toFixed(3)}, ${(sy * (1 + 0.9 * g)).toFixed(3)})`, ...(f < s.from + 14 ? { opacity: clamp01(springAt(c, trapStart(s)) * 1.8) } : {}) })}>
        <Glyph c={c} part="icon" name={s.icon} size={icon} solid at={trapStart(s)} />
      </div>
    </Place>
  );
}

// ── chaos: things piling up, shaking — then in order ─────────────────────
const CH = { dw: 900, dh: 700, tile: 150, gap: 26 };
const THINGS = ["mail", "bell", "file-text", "calendar", "message-circle", "receipt", "sheet", "phone", "clipboard-list"];
const hash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// nine things: the scene's own first (its first in the middle of the grid), then everyday ones
function chaosThings(s: Scene): { icon: string; own: boolean }[] {
  const own = s.items.map((it) => it.icon).filter((x): x is string => !!x);
  const all = [...new Set([...own, ...THINGS])].slice(0, 9).map((icon) => ({ icon, own: own.includes(icon) }));
  if (own.length) all.splice(4, 0, ...all.splice(0, 1));
  return all;
}
export const chaosAt = (s: Scene, i: number) => s.from + 4 + Math.round(i * Math.max(1, Math.min(4, (turnOf(s) - s.from - 12) / 9)));
function Chaos({ c }: { c: C }) {
  const { dw, dh, tile, gap } = CH;
  const { s, f } = c;
  const T = s.resolves ? turnOf(s) : Infinity;
  const things = chaosThings(s);
  const grid = (dw - 3 * tile - 2 * gap) / 2, gridTop = (dh - 3 * tile - 2 * gap) / 2;
  const amp = 0.6 + 1.8 * clamp01((f - s.from) / Math.max(1, s.to - s.from));
  return (
    <Place c={c} dw={dw} dh={dh}>
      {things.map((t, i) => {
        const at = chaosAt(s, i);
        const k = springAt(c, at);
        const seed = i + s.from * 0.13;
        const px = 40 + hash(seed, 1) * (dw - tile - 80), py = 30 + hash(seed, 2) * (dh - tile - 60), pr = (hash(seed, 3) - 0.5) * 56;
        const g = Number.isFinite(T) ? clamp01(springAt(c, T + i * 1.5)) : 0;
        const shake = amp * (1 - g);
        const x = px + (grid + (i % 3) * (tile + gap) - px) * g + Math.sin((f + i * 7) / 1.7) * shake * 1.2;
        const y = py + (gridTop + Math.floor(i / 3) * (tile + gap) - py) * g + Math.cos((f + i * 5) / 2.1) * shake - (1 - k) * 300;
        const r = pr * (1 - g) + Math.sin((f + i * 13) / 2.3) * shake;
        // (the middle one lit as the grid settles: faded in, never snapped)
        const lit = i === 4 ? clamp01((g - 0.5) / 0.4) : 0;
        return (
          <div key={i} style={abs({ left: x, top: y, width: tile, height: tile, ...panel(c, 38), display: "flex", alignItems: "center", justifyContent: "center", opacity: clamp01(k * 2), transform: `rotate(${r.toFixed(2)}deg)` })}>
            <Glyph c={c} part={t.own ? "item-icon" : undefined} name={t.icon} size={96} card at={at} />
            {lit > 0 && <Glyph c={c} name={t.icon} size={96} card solid at={at} style={abs({ opacity: lit })} />}
          </div>
        );
      })}
    </Place>
  );
}

// ── waiting: a bar that will not fill, a clock ticking ───────────────────
const WT = { dw: 860, dh: 640 };
// the clock's ticks (until the turn, or to the end)
export function waitTicks(s: Scene): number[] {
  const end = s.resolves ? turnOf(s) : s.to;
  const out: number[] = [];
  for (let at = s.from + 20; at < end; at += 10) out.push(at);
  return out;
}
function Waiting({ c }: { c: C }) {
  const { dw, dh } = WT;
  const { s, f, look } = c;
  const T = s.resolves ? turnOf(s) : Infinity;
  const now = Math.min(f, T);
  const done = s.resolves ? ease(clamp01((f - T) / 18)) : 0;
  // (to a seventh, then barely moving — never a number on it)
  const start = 0.14 * ease(clamp01((f - s.from - 8) / 18)) + 0.035 * clamp01((now - s.from - 26) / 120);
  const fill = start + (1 - start) * done;
  const tick = Math.max(0, Math.floor((now - s.from - 10) / 10));
  const snap = ease(clamp01((now - s.from - 10 - tick * 10) / 3));
  const sec = (tick + snap) * 30, min = 120 + (now - s.from) * 0.4;
  const bw = 640, bh = 36;
  const gone = s.resolves ? clamp01((f - T - 4) / 10) : 0;
  const check = s.resolves ? springAt(c, T + 14) : 0;
  const ink = look.panelInk, accent = look.panelAccent;
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 20, top: 20, width: dw - 40, height: dh - 40, ...panel(c, 48), ...rise(springAt(c, s.from + 2)) })}>
        <svg width={300} height={300} viewBox="0 0 300 300" style={abs({ left: (dw - 40 - 300) / 2, top: 40, opacity: 1 - gone, transform: `scale(${(1 - 0.3 * gone).toFixed(3)})` })}>
          <circle cx={150} cy={150} r={128} fill="none" stroke={ink} strokeWidth={12} />
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={150} y1={36} x2={150} y2={i % 3 ? 48 : 58} stroke={ink} strokeWidth={i % 3 ? 5 : 8} strokeLinecap="round" transform={`rotate(${i * 30} 150 150)`} />)}
          <line x1={150} y1={150} x2={150} y2={78} stroke={ink} strokeWidth={12} strokeLinecap="round" transform={`rotate(${min.toFixed(1)} 150 150)`} />
          <line x1={150} y1={172} x2={150} y2={52} stroke={accent} strokeWidth={6} strokeLinecap="round" transform={`rotate(${sec.toFixed(1)} 150 150)`} />
          <circle cx={150} cy={150} r={12} fill={accent} />
        </svg>
        {check > 0 && (
          <div style={abs({ left: (dw - 40 - 240) / 2, top: 70, ...pop(check) })}>
            <Glyph c={c} name="circle-check" size={240} card solid at={T + 14} />
          </div>
        )}
        <div style={abs({ left: (dw - 40 - bw) / 2, top: 400, width: bw, height: bh, borderRadius: bh / 2, background: tint(accent, 0.16), overflow: "hidden" })}>
          <div style={abs({ left: 0, top: 0, bottom: 0, width: bw * fill, borderRadius: bh / 2, background: accent, overflow: "hidden" })}>
            <div style={abs({ top: 0, bottom: 0, width: 90, left: ((f - s.from) * 7) % (bw * fill + 180) - 90, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" })} />
          </div>
        </div>
        <div style={abs({ left: 0, right: 0, top: 476, display: "flex", justifyContent: "center", gap: 20, opacity: 1 - gone })}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 20, height: 20, borderRadius: 99, background: ink, opacity: 0.25 + 0.6 * Math.max(0, Math.sin((f - i * 5) / 4)) }} />)}
        </div>
      </div>
    </Place>
  );
}

// ── truth: one word that is really another ───────────────────────────────
// (the first said big, then — as the second is said — it splits apart, is
// struck out, or turns over, and the second stands in its place on a plate)
function Truth({ c }: { c: C }) {
  const { W, H, pad, u } = c.g;
  const { s, f, look } = c;
  const [a, b] = s.items;
  if (!a || !b) return null;
  const T = turnOf(s);
  const v = s.variant;
  const fitOf = (t: string, max: number) => fitWords(t.split(/\s+/), look.display, { width: W - 2 * pad, lines: 2, max, min: 70 });
  const fa = fitOf(a.text, Math.round(TYPE.HERO * u)), fb = fitOf(b.text, Math.round(TYPE.HERO * u * 0.9));
  const text = (fit: typeof fa, t: string) => fit.lines.map((l) => l.map((i) => t.split(/\s+/)[i]).join(" "));
  const big = (size: number): CSSProperties => ({ fontFamily: familyOf(look.display), fontWeight: 800, fontSize: size, lineHeight: 1.06, letterSpacing: "-0.03em", whiteSpace: "nowrap", textAlign: "center" });
  const g = ease(clamp01((f - T) / 12));
  const kin = springAt(c, s.from + 2);
  const word = (style: CSSProperties) => (
    <div style={abs({ inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: look.ink, ...big(fa.size), ...style })}>
      {text(fa, a.text).map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
  // the first: as it goes
  let gone: ReactNode;
  if (v === 0) {
    // (a cut across it, then its halves apart)
    const cut = clamp01((f - (T - 6)) / 5) * (1 - clamp01((f - T - 4) / 6));
    gone = (
      <>
        {word({ clipPath: "inset(0 0 50% 0)", opacity: 1 - g, transform: `translate(${(-g * W * 0.22).toFixed(1)}px, ${(-g * H * 0.3).toFixed(1)}px) rotate(${(-g * 7).toFixed(2)}deg)` })}
        {word({ clipPath: "inset(50% 0 0 0)", opacity: 1 - g, transform: `translate(${(g * W * 0.22).toFixed(1)}px, ${(g * H * 0.3).toFixed(1)}px) rotate(${(g * 7).toFixed(2)}deg)` })}
        {cut > 0 && <div style={abs({ left: pad, top: H / 2 - 4, width: (W - 2 * pad) * clamp01((f - (T - 6)) / 5), height: 8, borderRadius: 4, background: look.accent, opacity: cut })} />}
      </>
    );
  } else if (v === 1) {
    // (struck through as the second is said, then dropped)
    const strike = ease(clamp01((f - (T - 8)) / 8));
    const lw = Math.max(...text(fa, a.text).map((l) => l.length)) * fa.size * 0.5;
    gone = (
      <div style={abs({ inset: 0, opacity: 1 - g, transform: `translateY(${(g * H * 0.28).toFixed(1)}px) rotate(${(g * 4).toFixed(2)}deg)` })}>
        {word({})}
        <div style={abs({ left: (W - lw * 1.1) / 2, top: H / 2 - fa.size * 0.05, width: lw * 1.1 * strike, height: Math.max(8, fa.size * 0.08), borderRadius: 99, background: look.bad })} />
      </div>
    );
  } else {
    // (turned over: its back is the second)
    const turn = clamp01((f - T) / 6);
    gone = word({ transform: `perspective(1600px) rotateX(${(ease(turn) * 90).toFixed(1)}deg)`, opacity: turn >= 1 ? 0 : 1 });
  }
  const kb = springAt(c, T + (v === 2 ? 6 : 4));
  const flip = v === 2 ? `perspective(1600px) rotateX(${((1 - clamp01((f - T - 6) / 8)) * -90).toFixed(1)}deg) ` : "";
  // (then the first back, small and struck through, above it: the one is really the other)
  const back = springAt(c, T + 24);
  const struck = ease(clamp01((f - T - 30) / 10));
  const small = Math.round(fb.size * 0.42);
  const push = 1 + 0.04 * clamp01((f - T) / Math.max(1, s.to - T));
  const plate: CSSProperties = look.plate ? { background: look.plateFill, color: look.bg } : { background: look.accent, color: look.onAccent };
  return (
    <>
      <div style={abs({ inset: 0, ...(f < T ? rise(kin, 50) : {}) })}>{f < T + 16 && gone}</div>
      {f >= T + 24 && (
        <div style={abs({ left: 0, right: 0, top: H / 2 - fb.size * fb.lines.length * 0.53 - small * 1.9, display: "flex", justifyContent: "center", ...rise(back, 30) })}>
          <div style={{ position: "relative", ...big(small), color: look.ink, opacity: 0.75 }}>
            {a.text}
            <div style={abs({ left: -small * 0.08, top: "54%", height: Math.max(5, small * 0.09), width: `calc(${(struck * 100).toFixed(1)}% + ${(struck * small * 0.16).toFixed(1)}px)`, borderRadius: 99, background: look.bad })} />
          </div>
        </div>
      )}
      {f >= T + (v === 2 ? 6 : 2) && (
        <div style={abs({ inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${push.toFixed(4)})` })}>
          <div data-part="item" data-text={b.text} style={{ ...big(fb.size), ...plate, borderRadius: Math.round(fb.size * 0.2), padding: `${Math.round(fb.size * 0.06)}px ${Math.round(fb.size * 0.22)}px ${Math.round(fb.size * 0.12)}px`, display: "flex", flexDirection: "column", alignItems: "center", opacity: clamp01(kb * 2), transform: `${flip}scale(${(1.25 - 0.25 * kb).toFixed(4)})` }}>
            {text(fb, b.text).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </>
  );
}

// ── launch: a line taking off, lighting what it passes ───────────────────
const LD = { dw: 900, dh: 700 };
const P = [[90, 600], [400, 620], [470, 250], [800, 100]] as const;
const bez = (t: number, k: 0 | 1) => {
  const m = 1 - t;
  return m * m * m * P[0][k] + 3 * m * m * t * P[1][k] + 3 * m * t * t * P[2][k] + t * t * t * P[3][k];
};
const slope = (t: number, k: 0 | 1) => {
  const m = 1 - t;
  return 3 * m * m * (P[1][k] - P[0][k]) + 6 * m * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k]);
};
// (how far along the line, as a share of its length, at each step — so the head moves with the line drawn)
const ARC = (() => {
  const out = [0];
  for (let i = 1; i <= 100; i++) out.push(out[i - 1] + Math.hypot(bez(i / 100, 0) - bez((i - 1) / 100, 0), bez(i / 100, 1) - bez((i - 1) / 100, 1)));
  return out.map((x) => x / out[100]);
})();
const tAt = (p: number) => {
  const i = Math.max(1, ARC.findIndex((x) => x >= p));
  if (p >= 1) return 1;
  return (i - 1 + (p - ARC[i - 1]) / Math.max(1e-6, ARC[i] - ARC[i - 1])) / 100;
};
// where its things are on the line (shares of its length)
const STOPS = [[0.3, 0.6, 0.86], [0.6], [0.4, 0.75], [0.3, 0.6, 0.86]];
// when it arrives (it does only when it resolves)
// (at its turn, but never before 60% of the scene: the take-off is the scene)
export const arrivalOf = (s: Scene) => Math.min(s.to - 32, Math.max(turnOf(s) + 16, Math.round(s.from + 0.6 * (s.to - s.from))));
function Launch({ c }: { c: C }) {
  const { dw, dh } = LD;
  const { s, f, look } = c;
  const go = s.from + 8;
  const p = s.resolves ? ease(clamp01((f - go) / Math.max(24, arrivalOf(s) - go))) : 0.4 * ease(clamp01((f - go) / 30)) + (f > go + 30 ? 0.006 * Math.sin((f - go) / 3) : 0);
  const t = tAt(clamp01(p));
  const hx = bez(t, 0), hy = bez(t, 1);
  const angle = (Math.atan2(slope(t, 1), slope(t, 0)) * 180) / Math.PI + 45;
  const A = arrivalOf(s);
  const ring = s.resolves ? clamp01((f - A) / 22) : 0;
  const bob = s.resolves && f > A ? Math.sin((f - A) / 10) * 6 : 0;
  const stall = !s.resolves && f > go + 30 ? Math.sin(f * 2.1) * 3 : 0;
  const items = s.items.slice(0, 3);
  // (its stops: its things, else three bare stops)
  const stops = STOPS[items.length];
  const disc = 170;
  return (
    <Place c={c} dw={dw} dh={dh}>
      <svg width={dw} height={dh} viewBox={`0 0 ${dw} ${dh}`} style={abs({ left: 0, top: 0, overflow: "visible", opacity: clamp01(springAt(c, s.from + 2) * 2) })}>
        <path d={`M${P[0].join(" ")} C${P[1].join(" ")}, ${P[2].join(" ")}, ${P[3].join(" ")}`} fill="none" stroke={look.sub} strokeOpacity={0.4} strokeWidth={10} strokeLinecap="round" strokeDasharray="1 26" />
        <path d={`M${P[0].join(" ")} C${P[1].join(" ")}, ${P[2].join(" ")}, ${P[3].join(" ")}`} fill="none" stroke={look.accent} strokeWidth={22} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp01(p)} />
        <circle cx={P[0][0]} cy={P[0][1]} r={26} fill="none" stroke={look.accent} strokeWidth={8} />
      </svg>
      {stops.map((at, i) => {
        const it = items[i];
        const tt = tAt(at), x = bez(tt, 0), y = bez(tt, 1);
        const lit = clamp01((p - at) / 0.04);
        const right = x < 560;
        return (
          <div key={i}>
            <div style={abs({ left: x - 28, top: y - 28, width: 56, height: 56, borderRadius: 99, border: `9px solid ${look.accent}`, background: `linear-gradient(${tint(look.accent, lit)}, ${tint(look.accent, lit)}), ${look.bg}`, transform: `scale(${(1 + 0.35 * Math.sin(Math.PI * lit)).toFixed(3)})` })} />
            {it && (
              <div style={abs({ ...(right ? { left: x + 50, top: y + 6 } : { right: dw - x + 50, top: y - 30 }), opacity: 0.3 + 0.7 * lit })}>
                <One part="item" face={look.text} fit={360} style={{ fontFamily: familyOf(look.text), fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, color: look.ink }}>{it.text}</One>
              </div>
            )}
          </div>
        );
      })}
      {ring > 0 && ring < 1 && Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3, r = disc * (0.6 + 1.4 * ease(ring));
        return <div key={i} style={abs({ left: hx + Math.cos(a) * r - 7, top: hy + Math.sin(a) * r - 7, width: 14, height: 14, borderRadius: 99, background: look.accent, opacity: 1 - ring, transform: `scale(${(1 - 0.6 * ring).toFixed(3)})` })} />;
      })}
      {ring > 0 && ring < 1 && <div style={abs({ left: hx - disc, top: hy - disc, width: disc * 2, height: disc * 2, borderRadius: 999, border: `8px solid ${look.accent}`, transform: `scale(${(0.5 + 1.5 * ring).toFixed(3)})`, opacity: 1 - ring })} />}
      <div data-part="icon" style={abs({ left: hx - disc / 2 + stall, top: hy - disc / 2 + bob, width: disc, height: disc, borderRadius: 99, background: look.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 16px 40px ${tint(look.accent, 0.35)}`, ...pop(springAt(c, s.from + 4)) })}>
        <div style={{ display: "flex", transform: `rotate(${angle.toFixed(1)}deg)` }}>
          <Icon name="rocket" size={92} color={look.onAccent} strokeWidth={2} />
        </div>
      </div>
    </Place>
  );
}

// ── cost: a bill getting longer — then cut down ──────────────────────────
// (its lines: the scene's things, else bare lines; a price is never made up —
// a number only when the voice says one, as its total)
const CO = { dw: 760, dh: 700, w: 690, row: 92 };
const costRows = (s: Scene) => Math.max(3, Math.min(4, s.items.length || 4));
export const costRowAt = (s: Scene, i: number) => s.from + 8 + Math.round(i * Math.max(4, Math.min(10, (turnOf(s) - s.from - 14) / costRows(s))));
function Cost({ c }: { c: C }) {
  const { dw, dh, w, row } = CO;
  const { s, f, look } = c;
  const T = s.resolves ? turnOf(s) : Infinity;
  const n = costRows(s);
  const cut = Number.isFinite(T) ? ease(clamp01((f - T) / 16)) : 0;
  const totalAt = costRowAt(s, n - 1) + 8;
  const kt = springAt(c, totalAt);
  // (the total: the number said, counting up; else a bar growing — shrunk to a third when it is cut)
  const grow = clamp01((f - totalAt) / Math.max(20, (Number.isFinite(T) ? T : s.to) - totalAt));
  const bar = (0.45 + 0.55 * ease(grow)) * (1 - 0.66 * cut);
  const top = (dh - (110 + n * row + 120)) / 2;
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: (dw - w) / 2, top, width: w, height: 110 + n * row + 120, ...panel(c, 36), ...rise(springAt(c, s.from + 2)) })}>
        <div style={abs({ left: 36, top: 30, display: "flex", alignItems: "center", gap: 20 })}>
          <Glyph c={c} name="receipt" size={76} card at={s.from + 4} />
          <div style={{ width: 200, height: 18, borderRadius: 9, background: tint(look.panelAccent, 0.14) }} />
        </div>
        {Array.from({ length: n }, (_, i) => {
          const it = s.items[i];
          const k = springAt(c, costRowAt(s, i));
          // (cut: every line but the first folds away)
          const gone = i ? cut : 0;
          return (
            <div key={i} style={abs({ left: 36, right: 36, top: 110 + i * row, height: row - 18, display: "flex", alignItems: "center", gap: 18, opacity: clamp01(k * 2) * (1 - gone), transform: `translateX(${((1 - k) * 40 + gone * -30).toFixed(1)}px)`, borderBottom: `2px dashed ${tint(look.panelAccent, 0.18)}` })}>
              {it ? <One part="item" face={look.text} fit={360} style={{ fontFamily: familyOf(look.text), fontSize: 44, fontWeight: WEIGHT.item, color: look.panelInk, flex: 1 }}>{it.text}</One> : <div style={{ flex: 1 }}><div style={{ width: `${40 + 30 * hash(i, 9)}%`, height: 16, borderRadius: 8, background: tint(look.panelAccent, 0.14) }} /></div>}
              <div style={{ width: 100 + 60 * hash(i, 4), height: 26, borderRadius: 13, background: tint(look.bad, 0.22) }} />
            </div>
          );
        })}
        <div style={abs({ left: 36, right: 36, top: 110 + n * row + 20, height: 76, display: "flex", alignItems: "center", gap: 18, opacity: clamp01(kt * 2) })}>
          <div style={{ flex: 1, height: 36, borderRadius: 18, background: tint(look.panelAccent, 0.1), overflow: "hidden", position: "relative" }}>
            <div style={abs({ left: 0, top: 0, bottom: 0, width: `${(bar * 100).toFixed(1)}%`, borderRadius: 15, background: look.bad })} />
            <div style={abs({ left: 0, top: 0, bottom: 0, width: `${(bar * 100).toFixed(1)}%`, borderRadius: 15, background: look.panelAccent, opacity: cut })} />
          </div>
          {s.number && <div style={{ fontFamily: familyOf(look.display), fontWeight: 800, fontSize: 64, color: look.panelInk, letterSpacing: "-0.02em" }}>{countUp(s.number, ease(grow))}</div>}
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <div style={abs({ inset: 0, opacity: 1 - cut })}><Icon name="trending-up" size={64} color={look.bad} strokeWidth={2.4} /></div>
            <div style={abs({ inset: 0, opacity: cut })}><Icon name="trending-down" size={64} color={look.panelAccent} strokeWidth={2.4} /></div>
          </div>
        </div>
        {cut > 0 && <div style={abs({ right: -30, top: -30, ...pop(springAt(c, T + 12)) })}><Glyph c={c} name="circle-check" size={110} card solid at={T + 12} /></div>}
      </div>
    </Place>
  );
}

// ── hours: a crowded timeline, a clock racing — swept into one clean clip ──
const HO = { dw: 900, dh: 620, w: 860, tracks: 3 };
export const hoursSweep = (s: Scene) => turnOf(s);
function Hours({ c }: { c: C }) {
  const { dw, dh, w, tracks } = HO;
  const { s, f, look } = c;
  const T = s.resolves ? turnOf(s) : Infinity;
  const lane = 70, left = 150, right = w - 40, top = 200;
  // the sweep: across the tracks over 16 frames
  const sweep = Number.isFinite(T) ? clamp01((f - T) / 16) : 0;
  const sx = left + (right - left) * ease(sweep);
  // the clock: racing until the sweep, then easing to a stop
  const race = (fr: number) => (fr - s.from) * 9;
  const sec = Number.isFinite(T) && f > T ? race(T) + 140 * ease(clamp01((f - T) / 24)) : race(f);
  const clips = Array.from({ length: tracks }, (_, t) => {
    const out: { x: number; w: number; at: number }[] = [];
    let x = left + 6 + hash(t, 1) * 30, k = 0;
    while (x < right - 30) {
      const cw = 30 + hash(t * 31 + k, 2) * 70;
      out.push({ x, w: Math.min(cw, right - x), at: s.from + 6 + Math.round((t * 7 + k * 5) % 34) });
      x += cw + 8 + hash(t * 17 + k, 3) * 18;
      k++;
    }
    return out;
  });
  const glyphs = ["film", "type", "music"];
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: (dw - w) / 2, top: 20, width: w, height: dh - 40, ...panel(c, 34), overflow: "hidden", ...rise(springAt(c, s.from + 2)) })}>
        <div style={abs({ left: 30, top: 26, display: "flex", gap: 12 })}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 16, height: 16, borderRadius: 8, background: tint(look.panelAccent, 0.25) }} />)}</div>
        <svg width={120} height={120} viewBox="0 0 120 120" style={abs({ left: (w - 120) / 2, top: 50 })}>
          <circle cx={60} cy={60} r={52} fill="none" stroke={look.panelInk} strokeWidth={7} />
          <line x1={60} y1={60} x2={60} y2={30} stroke={look.panelInk} strokeWidth={7} strokeLinecap="round" transform={`rotate(${(sec / 12).toFixed(1)} 60 60)`} />
          <line x1={60} y1={66} x2={60} y2={16} stroke={look.panelAccent} strokeWidth={4} strokeLinecap="round" transform={`rotate(${sec.toFixed(1)} 60 60)`} />
          <circle cx={60} cy={60} r={6} fill={look.panelAccent} />
        </svg>
        {Array.from({ length: tracks }, (_, t) => (
          <div key={t}>
            <div style={abs({ left: 30, top: top + t * (lane + 22) + 10, width: 90, height: lane - 20, display: "flex", alignItems: "center", gap: 8 })}>
              <Icon name={glyphs[t]} size={34} color={look.panelSub} strokeWidth={2} />
            </div>
            <div style={abs({ left, top: top + t * (lane + 22), width: right - left, height: lane, borderRadius: 14, background: tint(look.panelAccent, 0.06) })} />
            {clips[t].map((cl, k) => {
              const kk = springAt(c, cl.at);
              // (gone where the sweep has passed)
              const past = clamp01((sx - cl.x) / 40);
              return <div key={k} style={abs({ left: cl.x, top: top + t * (lane + 22) + 8, width: cl.w, height: lane - 16, borderRadius: 10, background: tint(look.panelAccent, 0.22 + 0.2 * hash(t * 13 + k, 5)), opacity: clamp01(kk * 2) * (1 - past), transform: `scaleY(${(0.5 + 0.5 * clamp01(kk)).toFixed(3)})` })} />;
            })}
            {/* (the clean clip, drawn as the sweep passes) */}
            {sweep > 0 && <div style={abs({ left, top: top + t * (lane + 22) + 8, width: Math.max(0, sx - left), height: lane - 16, borderRadius: 10, background: t ? tint(look.panelAccent, 0.35) : look.accentFill })} />}
          </div>
        ))}
        {/* cut marks, until the sweep takes them */}
        {[0.22, 0.47, 0.71, 0.88].map((u, i) => {
          const x = left + (right - left) * u;
          return <div key={i} style={abs({ left: x - 2, top: top - 14, width: 4, height: tracks * (lane + 22) + 6, borderRadius: 2, background: look.bad, opacity: clamp01((f - s.from - 20 - i * 6) / 6) * (1 - clamp01((sx - x) / 20)) * 0.8 })} />;
        })}
        {sweep > 0 && sweep < 1 && <div style={abs({ left: sx - 40, top: top - 30, width: 80, height: tracks * (lane + 22) + 40, background: `linear-gradient(90deg, transparent, ${tint(look.panelAccent, 0.45)}, transparent)` })} />}
        {Number.isFinite(T) && f > T + 16 && <div style={abs({ right: 36, top: 40, ...pop(springAt(c, T + 18)) })}><Glyph c={c} name="circle-check" size={96} card solid at={T + 18} /></div>}
      </div>
    </Place>
  );
}

// ── barriers: what stands in the way, each crossed out — then gone ────────
const BA = { dw: 820, dh: 640, card: 150 };
// when each is crossed: as it is said, else one after another — all before the turn
export function barrierAt(s: Scene, i: number): number {
  const said = s.said ?? [];
  const w = said.find((x) => bare(x.t) === first(s.items[i]?.text ?? ""));
  const T = turnOf(s);
  return Math.min(T - 6 - (s.items.length - 1 - i) * 6, Math.max(s.from + 14 + i * 8, (w?.at ?? 0) + 4));
}
function Barriers({ c }: { c: C }) {
  const { dw, dh, card } = BA;
  const { s, f, look } = c;
  const items = s.items.slice(0, 3);
  const T = s.resolves ? turnOf(s) : Infinity;
  const gone = Number.isFinite(T) ? ease(clamp01((f - T) / 14)) : 0;
  const gap = 26, h = items.length * card + (items.length - 1) * gap, top = (dh - h) / 2;
  return (
    <Place c={c} dw={dw} dh={dh}>
      {items.map((it, i) => {
        const k = springAt(c, s.from + 4 + i * 6);
        const x = springAt(c, barrierAt(s, i));
        return (
          <div key={i} style={abs({ left: 40, top: top + i * (card + gap), width: dw - 80, height: card, ...panel(c, 32), display: "flex", alignItems: "center", gap: 30, padding: "0 40px", boxSizing: "border-box", opacity: clamp01(k * 2) * (1 - 0.85 * gone), filter: gone > 0.01 ? `blur(${(gone * 4).toFixed(2)}px)` : undefined, transform: `translateY(${((1 - k) * 40 + gone * 30).toFixed(1)}px) scale(${(1 - 0.08 * gone).toFixed(3)})` })}>
            <Glyph c={c} part="item-icon" name={it.icon ?? s.icon} size={86} card at={s.from + 4 + i * 6} />
            <One part="item" face={look.text} fit={dw - 80 - 80 - 86 - 30 - 120} style={{ fontFamily: familyOf(look.text), fontSize: TYPE.ITEM, fontWeight: WEIGHT.item, color: look.panelInk }}>{it.text}</One>
            <div style={abs({ right: 34, top: (card - 84) / 2, width: 84, height: 84, borderRadius: 42, background: look.bad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 26px ${tint(look.bad, 0.35)}`, ...pop(x), ...(f < barrierAt(s, i) - 2 ? { opacity: 0 } : {}) })}>
              <Icon name="x" size={52} color="#ffffff" strokeWidth={3.2} />
            </div>
          </div>
        );
      })}
      {gone > 0 && (
        <div style={abs({ left: (dw - 230) / 2, top: (dh - 230) / 2, ...pop(springAt(c, T + 6)) })}>
          <Glyph c={c} name="circle-check" size={230} solid at={T + 8} />
        </div>
      )}
    </Place>
  );
}

// ── progress: a bar filling to its goal, its stops lighting ───────────────
// (to the number said when it is a share — "40%" — else all the way, a flag at its end)
const PR = { dw: 900, dh: 560, bw: 760 };
export const progressArrival = (s: Scene) => Math.min(s.to - 32, Math.max(turnOf(s) + 12, Math.round(s.from + 0.55 * (s.to - s.from))));
const shareOf = (n: string | null) => {
  const m = n ? /^(\d+(?:\.\d+)?)\s*%$/.exec(toAscii(n.trim())) : null;
  return m ? Math.min(1, Math.max(0.05, parseFloat(m[1]) / 100)) : 1;
};
function Progress({ c }: { c: C }) {
  const { dw, dh, bw } = PR;
  const { s, f, look } = c;
  // (short of it, the bar stalls a little past a third)
  const target = shareOf(s.number);
  const goal = s.resolves ? target : 0.38;
  const A = progressArrival(s);
  const p = goal * ease(clamp01((f - s.from - 10) / Math.max(20, (s.resolves ? A : s.from + 50) - s.from - 10)));
  const items = s.items.slice(0, 3);
  const stops = items.length ? items.map((_, i) => (target * (i + 1)) / (items.length + 1)) : [0.25, 0.5, 0.75].map((u) => u * target);
  const x0 = (dw - bw) / 2, by = 300, bh = 60;
  const done = s.resolves ? clamp01((f - A) / 10) : 0;
  return (
    <Place c={c} dw={dw} dh={dh}>
      {s.number && <div style={abs({ left: 0, right: 0, top: 70, textAlign: "center", fontFamily: familyOf(look.display), fontWeight: 800, fontSize: 150, letterSpacing: "-0.03em", lineHeight: 1, ...(look.keyFill ? { backgroundImage: look.keyFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: look.accent }), opacity: clamp01(springAt(c, s.from + 6) * 2) })}>{countUp(s.number, p / Math.max(0.01, goal))}</div>}
      <div style={abs({ left: x0, top: by, width: bw, height: bh, borderRadius: bh / 2, background: tint(look.accent, 0.14), ...rise(springAt(c, s.from + 2)) })}>
        <div style={abs({ left: 0, top: 0, bottom: 0, width: bw * p, borderRadius: bh / 2, background: look.accentFill, boxShadow: `0 10px 30px ${tint(look.accent, 0.3)}` })} />
      </div>
      {stops.map((u, i) => {
        const lit = clamp01((p - u) / 0.03);
        const x = x0 + bw * u;
        return (
          <div key={i}>
            <div style={abs({ left: x - 20, top: by + bh / 2 - 20, width: 40, height: 40, borderRadius: 20, border: `7px solid ${look.bg}`, boxSizing: "border-box", background: `linear-gradient(${tint(look.ink, 0.25 * (1 - lit))}, ${tint(look.ink, 0.25 * (1 - lit))}), ${look.accent}`, transform: `scale(${(1 + 0.3 * Math.sin(Math.PI * lit)).toFixed(3)})` })} />
            {items[i] && (
              <div style={abs({ left: x - 160, width: 320, top: by + bh + 26, display: "flex", justifyContent: "center", opacity: 0.35 + 0.65 * lit })}>
                <One part="item" face={look.text} fit={300} style={{ fontFamily: familyOf(look.text), fontSize: 40, fontWeight: WEIGHT.item, color: look.ink }}>{items[i].text}</One>
              </div>
            )}
          </div>
        );
      })}
      <div style={abs({ left: x0 + bw * target - 50, top: by - 130, opacity: s.resolves ? 0.35 + 0.65 * done : 0.35, ...(done > 0 ? pop(springAt(c, A)) : {}) })}>
        <Glyph c={c} name={target < 1 ? "target" : "flag"} size={100} at={A} />
        {done > 0 && <Glyph c={c} name={target < 1 ? "target" : "flag"} size={100} solid at={A} style={abs({ left: 0, top: 0, opacity: done })} />}
      </div>
    </Place>
  );
}

// ── agenda: the points ahead, each lit as the voice promises them ─────────
// (the titles of the points the script is told in — Scene.agenda — numbered)
const AG = { dw: 760, dh: 760, row: 132, gap: 24 };
export const agendaAt = (s: Scene, i: number) => {
  const n = Math.max(1, s.agenda?.length ?? 0);
  const span = Math.max(30, Math.round((s.to - s.from) * 0.6) - 14);
  return s.from + 10 + Math.round((span * i) / n);
};
function Agenda({ c }: { c: C }) {
  const { dw, dh, row, gap } = AG;
  const { s, look } = c;
  const list = (s.agenda ?? []).slice(0, 5);
  const h = list.length * row + (list.length - 1) * gap, top = (dh - h) / 2;
  return (
    <Place c={c} dw={dw} dh={dh}>
      {list.map((t, i) => {
        const k = springAt(c, agendaAt(s, i));
        return (
          <div key={i} style={abs({ left: 30, top: top + i * (row + gap), width: dw - 60, height: row, ...panel(c, 30), display: "flex", alignItems: "center", gap: 28, padding: "0 34px", boxSizing: "border-box", opacity: clamp01(k * 2), filter: k < 0.99 ? `blur(${((1 - k) * 8).toFixed(1)}px)` : undefined, transform: `translateX(${((1 - k) * 60).toFixed(1)}px)` })}>
            <div style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 38, background: look.accentFill, color: look.onAccent, fontFamily: familyOf(look.display), fontWeight: 800, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 6, boxSizing: "border-box", boxShadow: `0 8px 22px ${tint(look.accent, 0.3)}` }}>{numberOf(i + 1)}</div>
            <One part="item" face={look.text} fit={dw - 60 - 68 - 76 - 28} style={{ fontFamily: familyOf(look.text), fontSize: TYPE.ITEM * 1.15, fontWeight: WEIGHT.item, color: look.panelInk }}>{t}</One>
          </div>
        );
      })}
    </Place>
  );
}

// ── versus: less of one thing, more of another — two meters, one falling as the other fills ──
// (items[0] the less: "কম খরচ"; items[1] the more: "বেশি বিক্রি"; the turn its second said)
const VS = { dw: 700, dh: 720, bw: 230, bh: 420 };
function Versus({ c }: { c: C }) {
  const { dw, dh, bw, bh } = VS;
  const { s, f, look } = c;
  const T = turnOf(s);
  const a = s.items[0], b = s.items[1];
  if (!a || !b) return null;
  const k0 = springAt(c, s.from + 4), k1 = springAt(c, s.from + 10);
  // (the first falls from full to a quarter as it is said; the second fills at the turn)
  const fall = ease(clamp01((f - s.from - 12) / 26));
  const fill = ease(clamp01((f - T) / 22));
  const lv = [1 - 0.75 * fall, 0.2 + 0.75 * fill];
  const xs = [dw / 2 - bw - 50, dw / 2 + 50];
  // (each label in two lines at most, under its meter)
  const label = [a, b].map((it) => {
    const ws = it.text.split(" ");
    const fit = fitWords(ws, look.display, { width: bw + 120, lines: 2, max: 64, min: 40, weight: 800 });
    return { size: fit.size, lines: fit.lines.map((l) => l.map((k) => ws[k]).join(" ")) };
  });
  const top = 40;
  return (
    <Place c={c} dw={dw} dh={dh}>
      {[a, b].map((it, i) => {
        const k = i ? k1 : k0;
        const good = i === 1;
        const col = good ? look.accentFill : look.bad;
        return (
          <div key={i} style={abs({ left: xs[i], top, width: bw, height: dh - top, ...rise(k) })}>
            <div style={abs({ left: 0, top: 0, width: bw, height: bh, borderRadius: 40, background: tint(good ? look.accent : look.bad, 0.12), overflow: "hidden", boxShadow: `inset 0 0 0 2px ${tint(good ? look.accent : look.bad, 0.25)}` })}>
              <div style={abs({ left: 0, right: 0, bottom: 0, height: bh * lv[i], borderRadius: 40, background: col, boxShadow: `0 -8px 30px ${tint(good ? look.accent : look.bad, 0.3)}` })} />
              <div style={abs({ left: 0, right: 0, top: 26, display: "flex", justifyContent: "center" })}>
                <Glyph c={c} name={good ? "trending-up" : "trending-down"} size={92} card at={i ? T : s.from + 12} />
              </div>
            </div>
            <div data-part="item" style={abs({ left: -60, width: bw + 120, top: bh + 24, textAlign: "center", fontFamily: familyOf(look.display), fontSize: label[i].size, fontWeight: 800, color: i ? blend(look.sub, look.ink, fill) : look.ink, lineHeight: 1.25, paddingTop: label[i].size * 0.1 })}>
              {label[i].lines.map((l, k) => <div key={k}>{l}</div>)}
            </div>
          </div>
        );
      })}
    </Place>
  );
}

// ── funnel: stages narrowing, each as it is said; the last one lit ────────
const FU = { dw: 720, dh: 700, row: 124, gap: 18 };
export function funnelAt(s: Scene, i: number): number {
  const said = s.said ?? [];
  const n = Math.min(5, s.items.length);
  const w = said.find((x) => bare(x.t) === first(s.items[i]?.text ?? ""));
  const even = s.from + 10 + Math.round(((s.to - s.from) * 0.6 * i) / Math.max(1, n));
  return Math.min(s.to - 34 - (n - 1 - i) * 6, Math.max(s.from + 8 + i * 8, w ? w.at - 2 : even));
}
function Funnel({ c }: { c: C }) {
  const { dw, dh, row, gap } = FU;
  const { s, f, look } = c;
  const items = s.items.slice(0, 5);
  const n = items.length;
  const h = n * row + (n - 1) * gap, top = (dh - h) / 2;
  return (
    <Place c={c} dw={dw} dh={dh}>
      {items.map((it, i) => {
        const at = funnelAt(s, i);
        const k = springAt(c, at);
        const w = dw - 20 - (i * (dw * 0.36)) / Math.max(1, n - 1);
        const last = i === n - 1;
        // (each stage dims as the next one comes; the last stays lit)
        const next = i < n - 1 ? clamp01((f - funnelAt(s, i + 1)) / 10) : 0;
        return (
          <div key={i} style={abs({ left: (dw - w) / 2, top: top + i * (row + gap), width: w, height: row, borderRadius: 28, background: last ? look.accentFill : tint(look.accent, 0.16 + 0.1 * i), boxShadow: last ? `0 14px 36px ${tint(look.accent, 0.35)}` : undefined, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "0 28px", boxSizing: "border-box", opacity: clamp01(k * 2) * (1 - 0.35 * next), transform: `translateY(${((1 - k) * -40).toFixed(1)}px) scale(${(0.9 + 0.1 * k).toFixed(3)})` })}>
            {it.icon && <Glyph c={c} name={it.icon} size={60} at={at} />}
            <One part="item" face={look.text} fit={w - 56 - (it.icon ? 78 : 0)} style={{ fontFamily: familyOf(look.text), fontSize: TYPE.ITEM * 1.15, fontWeight: WEIGHT.item, color: last ? look.onAccent : look.ink }}>{it.text}</One>
          </div>
        );
      })}
    </Place>
  );
}

// ── split: what went right against what went wrong — a card each, stamped as said ──
// (items[0] the good — "সফল", "ডেলিভারড" — the rest the bad: "ক্যানসেল", "রিটার্ন")
const SP = { dw: 760, dh: 640, card: 150, gap: 26 };
export function splitAt(s: Scene, i: number): number {
  const said = s.said ?? [];
  const n = Math.min(3, s.items.length);
  const w = said.find((x) => bare(x.t).startsWith(bare(s.items[i]?.text ?? "")));
  const even = s.from + 12 + Math.round(((s.to - s.from) * 0.5 * i) / Math.max(1, n));
  return Math.min(s.to - 36 - (n - 1 - i) * 6, Math.max(s.from + 10 + i * 8, w ? w.at + 2 : even));
}
function Split({ c }: { c: C }) {
  const { dw, dh, card, gap } = SP;
  const { s, f, look } = c;
  const items = s.items.slice(0, 3);
  const h = items.length * card + (items.length - 1) * gap, top = (dh - h) / 2;
  return (
    <Place c={c} dw={dw} dh={dh}>
      {items.map((it, i) => {
        const good = i === 0;
        const at = splitAt(s, i);
        const k = springAt(c, s.from + 4 + i * 6);
        const x = springAt(c, at);
        const on = clamp01((f - at) / 8);
        const col = good ? look.accent : look.bad;
        // (a bad one shakes as it is stamped)
        const shake = good ? 0 : Math.sin((f - at) * 1.6) * 6 * clamp01(1 - (f - at) / 14) * (f >= at ? 1 : 0);
        return (
          <div key={i} style={abs({ left: 30, top: top + i * (card + gap), width: dw - 60, height: card, ...panel(c, 32), display: "flex", alignItems: "center", gap: 28, padding: "0 36px", boxSizing: "border-box", opacity: clamp01(k * 2), transform: `translate(${(shake + (1 - k) * (good ? -60 : 60)).toFixed(1)}px, 0)`, boxShadow: `0 0 0 ${(3 * on).toFixed(1)}px ${tint(col, 0.6 * on)}, ${panel(c).boxShadow}` })}>
            <Glyph c={c} part="item-icon" name={it.icon ?? (good ? "circle-check" : "circle-x")} size={90} card at={at} />
            <One part="item" face={look.text} fit={dw - 60 - 72 - 90 - 28 - 130} style={{ fontFamily: familyOf(look.text), fontSize: TYPE.ITEM * 1.2, fontWeight: WEIGHT.item, color: look.panelInk }}>{it.text}</One>
            <div style={abs({ right: 30, top: (card - 92) / 2, width: 92, height: 92, borderRadius: 46, background: good ? look.accentFill : look.bad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 26px ${tint(col, 0.35)}`, ...pop(x), ...(f < at - 2 ? { opacity: 0 } : {}) })}>
              <Icon name={good ? "check" : "x"} size={56} color="#ffffff" strokeWidth={3.4} />
            </div>
          </div>
        );
      })}
    </Place>
  );
}

// ── few: many against few — a field of dots, most fading as the few is said ──
// (items[0] the many as said — "৫,০০০ ভিজিটর" — items[1] the few: "৫ জন")
const FW = { dw: 780, dh: 760, cols: 12, rows: 8 };
const valueOf = (t: string) => Number(toAscii(t).replace(/[^\d.]/g, "")) || 0;
export const fewTurn = (s: Scene) => {
  const said = s.said ?? [];
  const second = s.items[1] ? said.find((x) => bare(x.t).startsWith(bare(fromBnNumber(s.items[1].text)))) : undefined;
  return Math.max(s.from + 30, Math.min(s.to - 40, second ? second.at : turnOf(s)));
};
// (the few as said: its first word — "৫ জন" was said "পাঁচজন")
const fromBnNumber = (t: string) => t.split(" ")[0];
function Few({ c }: { c: C }) {
  const { dw, dh, cols, rows } = FW;
  const { s, f, look } = c;
  const T = fewTurn(s);
  const n = cols * rows;
  const a = valueOf(s.items[0]?.text ?? ""), b = valueOf(s.items[1]?.text ?? "");
  const few = Math.max(1, Math.min(8, Math.round((n * b) / Math.max(1, a))));
  const fade = ease(clamp01((f - T) / 18));
  const cell = 52, gx = (dw - cols * cell) / 2, gy = 230;
  // (the few: spread over the field, not in a row)
  const lit = new Set(Array.from({ length: few }, (_, k) => (k * 37 + 17) % n));
  const label = (t: string, on: number, big: boolean) => (
    <div style={{ fontFamily: familyOf(look.display), fontWeight: 800, fontSize: big ? 96 : 64, lineHeight: 1.15, paddingTop: 8, ...(big ? (look.keyFill ? { backgroundImage: look.keyFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: look.accent }) : { color: look.sub }), opacity: on }}>{t}</div>
  );
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 0, right: 0, top: 40, height: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 40 })}>
        {label(s.items[0]?.text ?? "", 1 - 0.55 * fade, fade < 0.5)}
        {fade > 0 && label(s.items[1]?.text ?? "", fade, true)}
      </div>
      {Array.from({ length: n }, (_, k) => {
        const r = Math.floor(k / cols), q = k % cols;
        const kin = springAt(c, s.from + 4 + Math.round((r + q) * 0.9));
        const keep = lit.has(k);
        const size = cell * 0.62 * (keep ? 1 + 0.45 * fade : 1 - 0.15 * fade);
        return (
          <div key={k} style={abs({ left: gx + q * cell + (cell - size) / 2, top: gy + r * cell + (cell - size) / 2, width: size, height: size, borderRadius: size / 2, background: keep ? look.accent : blend(look.accent, look.line, fade), opacity: clamp01(kin * 2) * (keep ? 1 : 1 - 0.5 * fade), boxShadow: keep && fade > 0.3 ? `0 0 ${(22 * fade).toFixed(0)}px ${tint(look.accent, 0.6)}` : undefined })} />
        );
      })}
    </Place>
  );
}

// ── exit: people leaving a page — dots come into a page and most drift out its side ──
const EX = { dw: 820, dh: 640, pw: 560, ph: 470 };
function Exit({ c }: { c: C }) {
  const { dw, dh, pw, ph } = EX;
  const { s, f, look } = c;
  const T = turnOf(s);
  const k = springAt(c, s.from + 2);
  const px = 30, py = (dh - ph) / 2;
  // (the spot they leave from, lit at the turn)
  const spot = clamp01((f - T) / 10);
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: px, top: py, width: pw, height: ph, ...panel(c, 30), overflow: "hidden", ...rise(k) })}>
        <div style={abs({ left: 0, right: 0, top: 0, height: 54, background: tint(look.ink, 0.05), display: "flex", alignItems: "center", gap: 10, padding: "0 22px" })}>
          {[0, 1, 2].map((d) => <div key={d} style={{ width: 14, height: 14, borderRadius: 7, background: tint(look.ink, 0.18) }} />)}
          <div style={{ marginLeft: 16, height: 20, flex: 1, borderRadius: 10, background: tint(look.ink, 0.08) }} />
        </div>
        <div style={abs({ left: 34, top: 84, width: pw - 68, height: 150, borderRadius: 20, background: tint(look.accent, 0.12) })} />
        {[0, 1, 2].map((r) => <div key={r} style={abs({ left: 34, top: 262 + r * 44, width: (pw - 68) * [0.9, 0.7, 0.8][r], height: 22, borderRadius: 11, background: tint(look.ink, 0.08) })} />)}
        <div style={abs({ right: 34, bottom: 30, width: 180, height: 56, borderRadius: 28, background: blend(tint(look.ink, 0.1), look.bad, spot), boxShadow: spot > 0 ? `0 0 0 ${(6 * spot).toFixed(1)}px ${tint(look.bad, 0.25)}` : undefined })} />
      </div>
      {Array.from({ length: 9 }, (_, i) => {
        // each comes in from the left, into the page, and (all but two) out its right side
        const t0 = s.from + 8 + i * 9;
        const stays = i === 2 || i === 6;
        const u = clamp01((f - t0) / 54);
        const y = py + 110 + ((i * 53) % (ph - 170));
        const x = stays ? -40 + ease(clamp01(u * 1.6)) * (px + pw * 0.45) : -40 + ease(u) * (dw + 40);
        const leaving = !stays && x > px + pw - 20;
        return (
          <div key={i} style={abs({ left: x, top: y, width: 30, height: 30, borderRadius: 15, background: leaving ? look.bad : look.accent, opacity: f < t0 ? 0 : u >= 1 && !stays ? 0 : 0.9, boxShadow: `0 6px 16px ${tint(leaving ? look.bad : look.accent, 0.35)}` })} />
        );
      })}
      <div style={abs({ left: px + pw + 40, top: dh / 2 - 60, opacity: clamp01((f - s.from - 30) / 10) })}>
        <Glyph c={c} name="log-out" size={120} at={s.from + 30} />
      </div>
    </Place>
  );
}

// ── retention: a video watched less and less — the curve drawn as it plays, the drop marked ──
const RT = { dw: 840, dh: 620, cw: 700, ch: 400 };
const curveAt = (u: number) => 0.92 * Math.exp(-1.1 * u) - (u > 0.28 ? 0.22 * Math.min(1, (u - 0.28) / 0.08) : 0) + 0.06;
function Retention({ c }: { c: C }) {
  const { dw, dh, cw, ch } = RT;
  const { s, f, look } = c;
  const T = turnOf(s);
  const k = springAt(c, s.from + 2);
  const x0 = (dw - cw) / 2, y0 = 90;
  const drawn = ease(clamp01((f - s.from - 8) / Math.max(30, T - s.from + 10)));
  const pts = Array.from({ length: 61 }, (_, i) => i / 60).filter((u) => u <= drawn + 1e-6).map((u) => `${(x0 + u * cw).toFixed(1)},${(y0 + ch - curveAt(u) * ch).toFixed(1)}`);
  const area = pts.length > 1 ? `M${x0},${y0 + ch} L${pts.join(" L")} L${(x0 + drawn * cw).toFixed(1)},${y0 + ch} Z` : "";
  const drop = clamp01((f - T) / 10);
  const dx = x0 + 0.32 * cw, dy = y0 + ch - curveAt(0.32) * ch;
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: x0 - 40, top: y0 - 50, width: cw + 80, height: ch + 170, ...panel(c, 32), ...rise(k) })} />
      <svg width={dw} height={dh} style={abs({ left: 0, top: 0, overflow: "visible", opacity: clamp01(k * 2) })}>
        <line x1={x0} y1={y0 + ch} x2={x0 + cw} y2={y0 + ch} stroke={look.line} strokeWidth={3} />
        <line x1={x0} y1={y0} x2={x0} y2={y0 + ch} stroke={look.line} strokeWidth={3} />
        {area && <path d={area} fill={tint(look.accent, 0.14)} />}
        {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={look.accent} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />}
        {drop > 0 && <circle cx={dx} cy={dy} r={18 + 26 * drop} fill="none" stroke={look.bad} strokeOpacity={0.5 * (1 - drop) + 0.2} strokeWidth={5} />}
        {drop > 0 && <circle cx={dx} cy={dy} r={8 + 8 * drop} fill={look.bad} opacity={drop} />}
      </svg>
      {/* the video playing along the bottom: its bar filling as the curve is drawn */}
      <div style={abs({ left: x0, top: y0 + ch + 40, width: cw, height: 54, display: "flex", alignItems: "center", gap: 20, opacity: clamp01(k * 2) })}>
        <Glyph c={c} name="play" size={54} at={s.from + 8} />
        <div style={{ flex: 1, height: 14, borderRadius: 7, background: tint(look.ink, 0.1), position: "relative" }}>
          <div style={abs({ left: 0, top: 0, bottom: 0, width: `${(drawn * 100).toFixed(1)}%`, borderRadius: 7, background: look.accentFill })} />
        </div>
      </div>
    </Place>
  );
}

// ── cycle: things that feed each other round a loop — "ক্যাম্পেইন → ডেটা → আরও ভালো মার্কেটিং" ──
// (each node a glossy tile as it is said, the arrows between them drawn, then a light going round)
const CY = { dw: 820, dh: 820, r: 280, node: 190 };
export function cycleAt(s: Scene, i: number): number {
  const said = s.said ?? [];
  const n = Math.min(4, s.items.length);
  const w = said.find((x) => bare(x.t).startsWith(bare(s.items[i]?.text ?? "")));
  const even = s.from + 8 + Math.round(((s.to - s.from) * 0.45 * i) / Math.max(1, n));
  return Math.min(s.to - 40 - (n - 1 - i) * 6, Math.max(s.from + 6 + i * 8, w ? w.at - 2 : even));
}
function Cycle({ c }: { c: C }) {
  const { dw, dh, r, node } = CY;
  const { s, f, look } = c;
  const items = s.items.slice(0, 4);
  const n = items.length;
  const cx = dw / 2, cy = dh / 2;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const last = cycleAt(s, n - 1);
  const round = clamp01((f - last - 10) / 40);
  const spin = (f - last - 10) / 60;
  return (
    <Place c={c} dw={dw} dh={dh}>
      <svg width={dw} height={dh} style={abs({ left: 0, top: 0, overflow: "visible" })}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={tint(look.accent, 0.12)} strokeWidth={30} />
        {items.map((_, i) => {
          // the arc from node i to the next, drawn once both are in
          const a0 = ang(i) + 0.36, a1 = ang(i + 1) - 0.36;
          const t = ease(clamp01((f - cycleAt(s, Math.min(i + 1, n - 1)) - (i === n - 1 ? 10 : 0)) / 14));
          const len = r * (a1 - a0);
          const end = a0 + (a1 - a0) * t;
          return (
            <g key={i} opacity={t > 0 ? 1 : 0}>
              <path d={`M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(end)} ${cy + r * Math.sin(end)}`} fill="none" stroke={look.accent} strokeWidth={8} strokeLinecap="round" strokeDasharray={len > 0 ? undefined : undefined} />
              {t > 0.9 && <path d={`M 0 -14 L 18 0 L 0 14 Z`} fill={look.accent} transform={`translate(${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}) rotate(${((a1 * 180) / Math.PI + 90).toFixed(1)})`} />}
            </g>
          );
        })}
        {round > 0 && <circle cx={cx + r * Math.cos(ang(0) + spin * 2 * Math.PI)} cy={cy + r * Math.sin(ang(0) + spin * 2 * Math.PI)} r={14} fill="#fff" stroke={look.accent} strokeWidth={6} opacity={round} />}
      </svg>
      {items.map((it, i) => {
        const at = cycleAt(s, i);
        const k = springAt(c, at);
        const [a, b] = TINTS[i % TINTS.length];
        const x = cx + r * Math.cos(ang(i)), y = cy + r * Math.sin(ang(i));
        return (
          <div key={i} style={abs({ left: x - 150, top: y - node / 2, width: 300, height: node + 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...pop(k), ...(f < at - 2 ? { opacity: 0 } : {}) })}>
            <div data-part="item-icon" style={{ width: node, height: node, borderRadius: node * 0.28, background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `inset 0 7px 10px rgba(255,255,255,0.5), 0 16px 34px ${b}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={it.icon ?? "sparkles"} size={node * 0.5} color="#ffffff" strokeWidth={2.2} />
            </div>
            <div style={{ padding: "6px 18px", borderRadius: 20, background: look.panelFill, boxShadow: `0 8px 20px ${look.shadow}` }}>
              <One part="item" face={look.text} fit={260} style={{ fontFamily: familyOf(look.text), fontSize: 50, fontWeight: WEIGHT.item, color: look.panelInk }}>{it.text}</One>
            </div>
          </div>
        );
      })}
    </Place>
  );
}

// ── report: a report card — its rows the things the beat names, their bars filling as each is said ──
// (its title the word as said — "রিপোর্ট", "হিসাব" — never a number that was not said)
const RP = { dw: 820, dh: 700 };
const REPORT = /^(রিপোর্ট|হিসাব|ড্যাশবোর্ড|ট্র্যাক)/;
function Report({ c }: { c: C }) {
  const { dw, dh } = RP;
  const { s, f, look } = c;
  const items = s.items.slice(0, 4);
  const n = items.length;
  const title = (s.said ?? []).find((w) => REPORT.test(bare(w.t)))?.t.replace(/[,;:।.!?]+$/u, "") ?? "";
  const k = springAt(c, s.from + 2);
  const head = 120, rh = Math.min(130, (dh - head - 60) / Math.max(1, n));
  const lens = [0.86, 0.58, 0.72, 0.4];
  return (
    <Place c={c} dw={dw} dh={dh}>
      <div style={abs({ left: 20, top: 20, width: dw - 40, height: head + n * rh + 40, ...panel(c, 36), overflow: "hidden", ...rise(k) })}>
        <div style={abs({ left: 0, right: 0, top: 0, height: head, display: "flex", alignItems: "center", gap: 22, padding: "0 34px", borderBottom: `1px solid ${look.line}` })}>
          <Glyph c={c} name="chart-column" size={72} solid at={s.from + 6} />
          {title && <One face={look.display} fit={dw - 300} style={{ fontFamily: familyOf(look.display), fontSize: 50, fontWeight: 800, color: look.panelInk }}>{title}</One>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{[0, 1, 2].map((d) => <div key={d} style={{ width: 12, height: 12, borderRadius: 6, background: tint(look.ink, 0.15) }} />)}</div>
        </div>
        {items.map((it, i) => {
          const at = splitAt({ ...s, items }, i);
          const kr = springAt(c, at - 4);
          const fill = ease(clamp01((f - at) / 18));
          const [a, b] = TINTS[i % TINTS.length];
          return (
            <div key={i} style={abs({ left: 34, right: 34, top: head + 20 + i * rh, height: rh - 14, display: "flex", alignItems: "center", gap: 22, opacity: clamp01(kr * 1.6), transform: `translateX(${((1 - kr) * 40).toFixed(1)}px)` })}>
              <div data-part="item-icon" style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(160deg, ${a}, ${b})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={it.icon ?? "circle"} size={34} color="#ffffff" strokeWidth={2.3} />
              </div>
              <div style={{ width: 230, flexShrink: 0 }}>
                <One part="item" face={look.text} fit={230} style={{ fontFamily: familyOf(look.text), fontSize: 42, fontWeight: WEIGHT.item, color: look.panelInk }}>{it.text}</One>
              </div>
              <div style={{ flex: 1, height: 22, borderRadius: 11, background: tint(b, 0.15), position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(fill * lens[i % 4] * 100).toFixed(1)}%`, borderRadius: 11, background: `linear-gradient(90deg, ${a}, ${b})` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Place>
  );
}

export function Concept({ c }: { c: C }) {
  switch (c.s.concept) {
    case "trapped": return <Trapped c={c} />;
    case "chaos": return <Chaos c={c} />;
    case "waiting": return <Waiting c={c} />;
    case "truth": return <Truth c={c} />;
    case "launch": return <Launch c={c} />;
    case "cost": return <Cost c={c} />;
    case "hours": return <Hours c={c} />;
    case "barriers": return <Barriers c={c} />;
    case "progress": return <Progress c={c} />;
    case "agenda": return <Agenda c={c} />;
    case "versus": return <Versus c={c} />;
    case "funnel": return <Funnel c={c} />;
    case "split": return <Split c={c} />;
    case "few": return <Few c={c} />;
    case "exit": return <Exit c={c} />;
    case "retention": return <Retention c={c} />;
    case "cycle": return <Cycle c={c} />;
    case "report": return <Report c={c} />;
    default: return null;
  }
}

// its sounds: the idea hitting its walls and breaking out, the pile landing and
// locking into place, the clock ticking and the ding as it fills, the cut, the take-off
export function conceptSounds(s: Scene): { at: number; name: string; volume: number }[] {
  const T = turnOf(s);
  switch (s.concept) {
    case "trapped": return [...trappedHits(s).slice(0, 3).map((at) => ({ at, name: "click", volume: 0.2 })), ...(s.resolves ? [{ at: T, name: "reveal", volume: 0.32 }] : [])];
    case "chaos": return [{ at: chaosAt(s, 0), name: "soft_pop", volume: 0.26 }, { at: chaosAt(s, 5), name: "soft_pop", volume: 0.22 }, ...(s.resolves ? [{ at: T + 6, name: "lock", volume: 0.3 }] : [])];
    case "waiting": return [...waitTicks(s).slice(0, 4).map((at) => ({ at, name: "tick", volume: 0.22 })), ...(s.resolves ? [{ at: T + 14, name: "ding", volume: 0.24 }] : [])];
    case "truth": return [{ at: T, name: "subtle_impact", volume: 0.34 }];
    case "launch": return [{ at: s.from + 8, name: "rise", volume: 0.26 }, ...(s.resolves ? [{ at: arrivalOf(s), name: "shimmer", volume: 0.22 }] : [])];
    case "cost": return [{ at: costRowAt(s, 0), name: "soft_pop", volume: 0.24 }, { at: costRowAt(s, costRows(s) - 1) + 8, name: "subtle_impact", volume: 0.24 }, ...(s.resolves ? [{ at: T, name: "whoosh", volume: 0.2 }, { at: T + 12, name: "ding", volume: 0.22 }] : [])];
    case "hours": return [...[0, 10, 20].map((d) => ({ at: s.from + 10 + d, name: "tick", volume: 0.2 })), ...(s.resolves ? [{ at: T, name: "whoosh", volume: 0.24 }, { at: T + 18, name: "ding", volume: 0.22 }] : [])];
    case "barriers": return [...s.items.slice(0, 3).map((_, i) => ({ at: barrierAt(s, i), name: "lock", volume: 0.22 })), ...(s.resolves ? [{ at: T + 6, name: "reveal", volume: 0.3 }] : [])];
    case "progress": return [{ at: s.from + 10, name: "rise", volume: 0.24 }, ...(s.resolves ? [{ at: progressArrival(s), name: "ding", volume: 0.22 }] : [])];
    case "agenda": return (s.agenda ?? []).slice(0, 5).map((_, i) => ({ at: agendaAt(s, i), name: "soft_pop", volume: 0.2 }));
    case "versus": return [{ at: s.from + 12, name: "whoosh", volume: 0.18 }, { at: T, name: "rise", volume: 0.24 }];
    case "funnel": return s.items.slice(0, 5).map((_, i, a) => ({ at: funnelAt(s, i), name: i === a.length - 1 ? "ding" : "soft_pop", volume: 0.2 }));
    case "split": return s.items.slice(0, 3).map((_, i) => ({ at: splitAt(s, i), name: i ? "lock" : "ding", volume: 0.22 }));
    case "few": return [{ at: s.from + 6, name: "soft_pop", volume: 0.2 }, { at: fewTurn(s), name: "subtle_impact", volume: 0.3 }];
    case "exit": return [{ at: s.from + 8, name: "whoosh", volume: 0.16 }, { at: T, name: "subtle_impact", volume: 0.26 }];
    case "retention": return [{ at: s.from + 8, name: "rise", volume: 0.2 }, { at: T, name: "subtle_impact", volume: 0.28 }];
    case "cycle": return [...s.items.slice(0, 4).map((_, i) => ({ at: cycleAt(s, i), name: "soft_pop", volume: 0.2 })), { at: cycleAt(s, Math.min(4, s.items.length) - 1) + 12, name: "whoosh", volume: 0.16 }];
    case "report": return s.items.slice(0, 4).map((_, i) => ({ at: splitAt({ ...s, items: s.items.slice(0, 4) }, i), name: "tick", volume: 0.2 }));
    default: return [];
  }
}

// when it has settled (check.ts)
export function conceptSettled(s: Scene): number {
  if (s.concept === "truth") return turnOf(s) + 20;
  if (s.concept === "agenda") return agendaAt(s, Math.max(0, Math.min(5, s.agenda?.length ?? 0) - 1)) + 20;
  if (s.concept === "versus") return turnOf(s) + 26;
  if (s.concept === "funnel") return funnelAt(s, Math.min(5, s.items.length) - 1) + 20;
  if (s.concept === "split") return splitAt(s, Math.min(3, s.items.length) - 1) + 16;
  if (s.concept === "few") return fewTurn(s) + 22;
  if (s.concept === "exit" || s.concept === "retention") return turnOf(s) + 14;
  if (s.concept === "cycle") return cycleAt(s, Math.min(4, s.items.length) - 1) + 30;
  if (s.concept === "report") return splitAt({ ...s, items: s.items.slice(0, 4) }, Math.min(4, s.items.length) - 1) + 22;
  if (s.concept === "launch" && s.resolves) return arrivalOf(s) + 12;
  if (s.concept === "progress") return s.resolves ? progressArrival(s) + 12 : s.from + 54;
  if (s.concept === "cost" && !s.resolves) return costRowAt(s, costRows(s) - 1) + 20;
  if (s.concept === "barriers") return s.resolves ? turnOf(s) + 30 : barrierAt(s, Math.min(3, s.items.length) - 1) + 14;
  return s.resolves ? turnOf(s) + 30 : s.from + 30;
}
