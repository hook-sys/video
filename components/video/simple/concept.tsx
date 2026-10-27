import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import { familyOf } from "./faces";
import { fitWords, noteHero } from "./fit";
import { TYPE, WEIGHT, fitIn } from "./geo";
import { type C, Glyph, One, clamp01, countUp, ease, panel, pop, rise, springAt, tint } from "./kit";
import { Band, Side, abs } from "./scenes";
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
  const m = n ? /^(\d+(?:\.\d+)?)\s*%$/.exec(n.trim()) : null;
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
    default: return [];
  }
}

// when it has settled (check.ts)
export function conceptSettled(s: Scene): number {
  if (s.concept === "truth") return turnOf(s) + 20;
  if (s.concept === "launch" && s.resolves) return arrivalOf(s) + 12;
  if (s.concept === "progress") return s.resolves ? progressArrival(s) + 12 : s.from + 54;
  if (s.concept === "cost" && !s.resolves) return costRowAt(s, costRows(s) - 1) + 20;
  if (s.concept === "barriers") return s.resolves ? turnOf(s) + 30 : barrierAt(s, Math.min(3, s.items.length) - 1) + 14;
  return s.resolves ? turnOf(s) + 30 : s.from + 30;
}
