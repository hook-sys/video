import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, Img } from "remotion";
import { Icon } from "../../icons";
import { IN_OUT, mix, rise } from "../anim";
import type { KWord } from "../text";

// Shared parts of the four reference-style films (Glow, Dusk, Fly, Connect):
// shots with their own camera, kinetic and typed words, comet curves, glass
// pills, the brand mark and a flat app window. Everything is drawn in code
// (no 3D objects, no faces: a person is an initial).

export const W = 1920;
export const H = 1080;
export const IN = 16;
export const OUTF = 12;

// ── shots ─────────────────────────────────────────────────────────────────
// A shot is seen from `from` to `to` (one at a time: it goes in its last
// OUTF frames — blurring and moving on, never just vanishing — and the next
// comes in over IN frames from just before its cut).
// `cam(p, f)` is the camera over the shot (p 0..1 eased through it).
export type Enter = "blur" | "zoom" | "push" | "slide" | "rise" | "none";
// `inDur` / `outDur` lengthen the way in / out (big bright panels on a dark
// field need longer, so the frame never flashes).
export function Shot({ f, from, to, enter = "blur", exit = "blur", cam, last, children, style, inDur = IN, outDur = OUTF }: { f: number; from: number; to: number; enter?: Enter; exit?: Enter; cam?: (p: number, f: number) => string; last?: boolean; children: ReactNode; style?: CSSProperties; inDur?: number; outDur?: number }) {
  if (f < from - 2 || f > to) return null;
  const kin = enter === "none" ? 1 : rise(f, from - 2, inDur, IN_OUT);
  const kout = last || exit === "none" ? 0 : rise(f, to - outDur, outDur, IN_OUT);
  const p = IN_OUT(Math.min(1, Math.max(0, (f - from) / Math.max(1, to - from))));
  const fx: Record<Enter, (k: number, out: boolean) => { t: string; filter?: string; o: number }> = {
    blur: (k, out) => ({ t: `scale(${out ? mix(1.06, 1, k) : mix(0.97, 1, k)})`, filter: `blur(${(1 - k) * 18}px)`, o: k }),
    zoom: (k, out) => ({ t: `scale(${out ? mix(1.25, 1, k) : mix(0.82, 1, k)})`, filter: `blur(${(1 - k) * 10}px)`, o: k }),
    push: (k, out) => ({ t: `scale(${out ? mix(0.8, 1, k) : mix(1.3, 1, k)})`, filter: `blur(${(1 - k) * 14}px)`, o: k }),
    slide: (k, out) => ({ t: `translateX(${(1 - k) * (out ? -260 : 260)}px)`, filter: `blur(${(1 - k) * 12}px)`, o: k }),
    rise: (k, out) => ({ t: `translateY(${(1 - k) * (out ? -140 : 140)}px)`, filter: `blur(${(1 - k) * 12}px)`, o: k }),
    none: () => ({ t: "", o: 1 }),
  };
  const a = fx[enter](kin, false);
  const b = fx[exit](1 - kout, true);
  const filters = [a.filter, kout > 0 ? b.filter : undefined].filter(Boolean).join(" ");
  return (
    <AbsoluteFill style={{ opacity: a.o * (kout > 0 ? b.o : 1), filter: filters || undefined, transform: `${a.t} ${kout > 0 ? b.t : ""}`, ...style }}>
      <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: "50% 45%" }}>
        <AbsoluteFill style={{ transform: cam ? cam(p, f) : undefined, transformStyle: "preserve-3d" }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// A gentle ease (no overshoot): what every card, icon and pill comes in on.
export const SOFT = Easing.bezier(0.22, 1, 0.36, 1);
export const soft = (f: number, at: number, dur = 20) => rise(f, at, dur, SOFT);
// A card / icon / pill coming in: fades up from a slightly smaller, blurred
// state over `dur` frames — never from nothing, never with a bounce.
export function appear(f: number, at: number, dur = 20, from: "scale" | "up" | "left" | "right" = "scale", extra = ""): CSSProperties {
  const k = soft(f, at, dur);
  const move = from === "up" ? `translateY(${(1 - k) * 46}px)` : from === "left" ? `translateX(${(1 - k) * -90}px)` : from === "right" ? `translateX(${(1 - k) * 90}px)` : "";
  return { opacity: k, filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined, transform: `${extra} ${move} scale(${mix(0.86, 1, k)})` };
}
// A scale that eases in from 0.86 (pair it with an opacity).
export const grow = (f: number, at: number, dur = 20) => mix(0.86, 1, soft(f, at, dur));

// A slight hand-held float added to every camera.
export const float = (f: number, k = 1) => `translate(${Math.sin(f / 41) * 6 * k}px, ${Math.cos(f / 57) * 5 * k}px)`;

export const abs = (x: number, y: number, node: ReactNode, style?: CSSProperties) => (
  <div style={{ position: "absolute", left: x, top: y, width: "max-content", ...style }}>{node}</div>
);
// Centred at (x, y).
export const at = (x: number, y: number, node: ReactNode, style?: CSSProperties) => (
  <div style={{ position: "absolute", left: x, top: y, width: "max-content", maxWidth: 1760, transform: "translate(-50%, -50%)", ...style }}>{node}</div>
);

// ── words ─────────────────────────────────────────────────────────────────
type WStyle = { size: number; ink: string; weight?: number; key?: (w: KWord, k: number) => CSSProperties | null; gap?: number; align?: "center" | "left"; spacing?: string; font?: string };

// Words that come in one by one on their spoken frame (blur → sharp).
// `key` styles the keyword (a pill, a colour).
export function Words({ words, f, s, style, from = "blur" }: { words: KWord[]; f: number; s: WStyle; style?: CSSProperties; from?: "blur" | "up" | "right" }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: s.align === "left" ? "flex-start" : "center", alignItems: "baseline", columnGap: s.gap ?? s.size * 0.26, rowGap: s.size * 0.08, fontSize: s.size, fontWeight: s.weight ?? 600, letterSpacing: s.spacing ?? "-0.03em", lineHeight: 1.12, color: s.ink, fontFamily: s.font, ...style }}>
      {words.map((w, i) => {
        const k = rise(f, w.at, 14);
        const t = from === "up" ? `translateY(${(1 - k) * s.size * 0.4}px)` : from === "right" ? `translateX(${(1 - k) * s.size * 0.8}px)` : `scale(${mix(1.08, 1, k)})`;
        const ks = w.key ? s.key?.(w, rise(f, w.at + 4, 14)) : null;
        const sk = w.strike !== undefined ? rise(f, w.strike, 12) : 0;
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", whiteSpace: "nowrap", opacity: k * (sk ? 1 - sk * 0.45 : 1), filter: `blur(${(1 - k) * 12}px)`, transform: t, ...(ks ?? {}) }}>
            {w.t}
            {sk > 0 && <span style={{ position: "absolute", left: -4, top: "54%", height: Math.max(4, s.size * 0.07), width: `calc(${sk * 100}% + 8px)`, background: "currentColor", borderRadius: 99 }} />}
          </span>
        );
      })}
    </div>
  );
}

// Words typed letter by letter as they are spoken, with a caret.
export function Typed({ words, f, size, ink, caret = true, weight = 400, style }: { words: KWord[]; f: number; size: number; ink: string; caret?: boolean; weight?: number; style?: CSSProperties }) {
  let out = "";
  let typing = false;
  for (const w of words) {
    if (f < w.at) break;
    const n = Math.min(w.t.length, Math.floor((f - w.at) / 1.3) + 1);
    out += (out ? " " : "") + w.t.slice(0, n);
    typing = n < w.t.length;
  }
  const blink = typing || Math.floor(f / 15) % 2 === 0;
  return (
    <div style={{ fontSize: size, fontWeight: weight, color: ink, letterSpacing: "-0.02em", whiteSpace: "nowrap", ...style }}>
      {out}
      {caret && <span style={{ display: "inline-block", width: size * 0.06, height: size * 0.95, marginLeft: size * 0.06, verticalAlign: "-0.12em", background: ink, opacity: blink ? 1 : 0 }} />}
    </div>
  );
}

// ── comet curves ──────────────────────────────────────────────────────────
type P = [number, number];
const cubic = (a: P, b: P, c: P, d: P, t: number): P => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};
// A glowing line that travels along a curve from `at` over `dur` frames: a
// fading tail, a bright head dot (a ring on `big`), the full path ghosted.
export function Comet({ f, at, dur = 40, pts, color, width = 5, tail = 0.55, big, ghost = 0.18, stay }: { f: number; at: number; dur?: number; pts: [P, P, P, P]; color: string; width?: number; tail?: number; big?: boolean; ghost?: number; stay?: boolean }) {
  const t = rise(f, at, dur, IN_OUT);
  if (t <= 0) return null;
  const N = 36;
  const t0 = stay ? 0 : Math.max(0, t - tail);
  const seg = Array.from({ length: N + 1 }, (_, i) => cubic(...pts, mix(t0, t, i / N)));
  const ghostD = Array.from({ length: 41 }, (_, i) => cubic(...pts, i / 40)).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const head = seg[N];
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      {ghost > 0 && <path d={ghostD} stroke={color} strokeOpacity={ghost * Math.min(1, t * 3)} strokeWidth={width * 0.4} fill="none" />}
      <g style={{ filter: `drop-shadow(0 0 ${width * 1.6}px ${color})` }}>
        {seg.slice(1).map((p, i) => (
          <line key={i} x1={seg[i][0]} y1={seg[i][1]} x2={p[0]} y2={p[1]} stroke={color} strokeWidth={width * (0.35 + 0.65 * (i / N))} strokeOpacity={stay ? 0.9 : 0.05 + 0.95 * (i / N) ** 1.6} strokeLinecap="round" />
        ))}
      </g>
      <circle cx={head[0]} cy={head[1]} r={big ? width * 3.4 : width * 2} fill="#fff" style={{ filter: `drop-shadow(0 0 ${width * 3}px ${color})` }} />
    </svg>
  );
}

// ── glass parts ───────────────────────────────────────────────────────────
// A frosted pill with a soft inner light (labels, chips, toggles).
export function Glass({ children, dark = true, tint = "#ffffff", radius = 999, pad = "18px 36px", glow, style }: { children?: ReactNode; dark?: boolean; tint?: string; radius?: number; pad?: string; glow?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        padding: pad,
        borderRadius: radius,
        background: dark ? `linear-gradient(180deg, ${tint}38, ${tint}12)` : `linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.78))`,
        border: `1.5px solid ${dark ? `${tint}55` : "rgba(255,255,255,0.9)"}`,
        boxShadow: `${glow ? `0 0 60px ${glow}88, ` : ""}inset 0 1.5px 0 ${dark ? "rgba(255,255,255,0.35)" : "#fff"}, 0 24px 60px ${dark ? "rgba(0,0,0,0.35)" : "rgba(60,50,140,0.14)"}`,
        backdropFilter: "blur(16px)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// A flat token (a round tile with an icon) — what the reference's 3D coins
// become: flat face, soft rim light, no depth.
export function Token({ icon, size = 110, bg = "#ffffff", color = "#111", ring, style }: { icon: string; size?: number; bg?: string; color?: string; ring?: string; style?: CSSProperties }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 999, background: bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 ${size * 0.06}px ${ring ?? "rgba(255,255,255,0.35)"}, 0 ${size * 0.2}px ${size * 0.5}px rgba(0,0,0,0.28)`, ...style }}>
      <Icon name={icon} size={size * 0.46} color={color} strokeWidth={2.2} />
    </div>
  );
}

// ── the brand ─────────────────────────────────────────────────────────────
// The film's brand (name, uploaded icon, tagline, call to action, address),
// given once by the film and read by the mark, the logo and the app window.
export type FilmBrand = { name: string; icon?: string | null; tagline: string; cta: string; url: string; things: { label: string; icon: string }[] };
export const BrandCtx = createContext<FilmBrand>({ name: "Brand", tagline: "", cta: "", url: "", things: [] });
export const useBrand = () => useContext(BrandCtx);

// The brand's mark: the uploaded icon when there is one; otherwise a
// gradient tile with its initial — an "F" is drawn as two flowing strokes.
// `draw` 0..1 draws it on.
export function FlowMark({ size, colors, draw = 1, plain, ink = "#fff" }: { size: number; colors: [string, string]; draw?: number; plain?: boolean; ink?: string }) {
  const brand = useBrand();
  const id = `fm${colors[0].slice(1)}${plain ? "p" : ""}`;
  if (brand.icon) return <Img src={brand.icon} style={{ width: size, height: size, objectFit: "contain", opacity: Math.min(1, draw * 1.5) }} />;
  const letter = (brand.name.trim()[0] ?? "B").toUpperCase();
  if (letter !== "F")
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        {!plain && <rect x="2" y="2" width="96" height="96" rx="28" fill={`url(#${id})`} />}
        <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="62" fontWeight="800" fontFamily="InterClean, system-ui, sans-serif" fill={plain ? `url(#${id})` : ink} opacity={Math.min(1, draw * 1.5)}>
          {letter}
        </text>
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      {!plain && <rect x="2" y="2" width="96" height="96" rx="28" fill={`url(#${id})`} />}
      <path d="M33 80 L33 44 C33 28 44 22 58 22 L72 22" pathLength={1} strokeDasharray={`${draw} 1`} stroke={plain ? `url(#${id})` : ink} strokeWidth={12} strokeLinecap="round" fill="none" />
      <path d="M33 54 C42 50 52 50 64 52" pathLength={1} strokeDasharray={`${Math.max(0, draw * 1.4 - 0.4)} 1`} stroke={plain ? `url(#${id})` : ink} strokeWidth={12} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ size, ink, colors, plain, k = 1 }: { size: number; ink: string; colors: [string, string]; plain?: boolean; k?: number }) {
  const brand = useBrand();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      <FlowMark size={size} colors={colors} draw={Math.min(1, k * 1.3)} plain={plain} ink="#fff" />
      <div style={{ fontSize: size * 0.82, fontWeight: 700, letterSpacing: "-0.045em", color: ink, clipPath: `inset(-20% ${(1 - Math.min(1, Math.max(0, k * 1.6 - 0.5))) * 100}% -20% 0)` }}>{brand.name}</div>
    </div>
  );
}

// ── people: an initial, never a face ──────────────────────────────────────
export const Person = ({ letter, size = 56, color, ring }: { letter: string; size?: number; color: string; ring?: string }) => (
  <div style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, background: `linear-gradient(140deg, ${color}, ${color}bb)`, color: "#fff", fontWeight: 700, fontSize: size * 0.4, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }}>{letter}</div>
);

export const Check = ({ size = 34, color, k = 1, bg }: { size?: number; color: string; k?: number; bg?: string }) => (
  <div style={{ width: size, height: size, borderRadius: 999, background: bg ?? color, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${mix(0.6, 1, k)})`, opacity: Math.min(1, k * 2), flexShrink: 0 }}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
      <path d="M5 12.5 L10 17 L19 7" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${Math.min(1, k)} 1`} />
    </svg>
  </div>
);

// ── a flat app window (the product, drawn) ────────────────────────────────
export type AppTone = { bg: string; side: string; ink: string; sub: string; line: string; accent: string; accent2: string; card: string };
export const LIGHT_APP = (accent: string, accent2: string): AppTone => ({ bg: "#ffffff", side: "#f6f6fb", ink: "#16172b", sub: "#8a8ca6", line: "#ececf4", accent, accent2, card: "#ffffff" });

export function AppWindow({ w, h, tone, title = "Dashboard", children, nav: navIn, active = 0, style }: { w: number; h: number; tone: AppTone; title?: string; children: ReactNode; nav?: string[]; active?: number; style?: CSSProperties }) {
  const brand = useBrand();
  const nav = navIn ?? ["Home", ...brand.things.map((x) => x.label), "Team"];
  const icons = ["house", ...brand.things.map((x) => x.icon), "users"];
  const host = brand.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "app";
  return (
    <div style={{ width: w, height: h, borderRadius: 26, background: tone.bg, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 60px 140px rgba(20,20,60,0.28), 0 0 0 1px rgba(0,0,0,0.04)", color: tone.ink, ...style }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1px solid ${tone.line}`, flexShrink: 0 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
        ))}
        <span style={{ marginLeft: 20, height: 28, width: 360, borderRadius: 9, background: tone.side, fontSize: 14, color: tone.sub, display: "flex", alignItems: "center", paddingLeft: 12 }}>app.{host}/{title.toLowerCase()}</span>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 230, background: tone.side, padding: "26px 18px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingLeft: 6 }}>
            <FlowMark size={30} colors={[tone.accent, tone.accent2]} />
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>{brand.name}</span>
          </div>
          {nav.map((n, i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, fontSize: 16, fontWeight: i === active ? 650 : 500, color: i === active ? tone.ink : tone.sub, background: i === active ? tone.bg : "transparent", boxShadow: i === active ? "0 2px 8px rgba(20,20,60,0.06)" : undefined }}>
              <Icon name={icons[i] ?? "circle"} size={18} color={i === active ? tone.accent : tone.sub} strokeWidth={2} />
              {n}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 30, position: "relative", minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

// A KPI tile.
export function Kpi({ label, value, delta, tone, w = 250, hi }: { label: string; value: string; delta?: string; tone: AppTone; w?: number; hi?: number }) {
  return (
    <div style={{ width: w, padding: "18px 20px", borderRadius: 16, border: `1px solid ${tone.line}`, background: tone.card, boxShadow: hi ? `0 0 0 ${3 * hi}px ${tone.accent}55, 0 18px 40px ${tone.accent}${Math.round(hi * 40).toString(16).padStart(2, "0")}` : undefined }}>
      <div style={{ fontSize: 14, color: tone.sub, fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
        <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {delta && <span style={{ fontSize: 14, fontWeight: 700, color: "#12a150", background: "#12a15018", padding: "2px 8px", borderRadius: 99 }}>{delta}</span>}
      </div>
    </div>
  );
}

// An area line chart drawn on (draw 0..1); `lift` raises its last points.
export function Area({ w, h, draw, color, pts, lift = 0, dot }: { w: number; h: number; draw: number; color: string; pts: number[]; lift?: number; dot?: boolean }) {
  const ys = pts.map((p, i) => Math.min(1, p + (i >= pts.length - 3 ? lift * (i - pts.length + 4) * 0.12 : 0)));
  const xy = ys.map((p, i) => [(i / (ys.length - 1)) * w, h - p * h] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const id = `ar${color.slice(1)}${w}`;
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.3} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect x={-10} y={-40} width={w * draw + 10} height={h + 80} />
        </clipPath>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke="#000" strokeOpacity={0.05} />
      ))}
      <g clipPath={`url(#${id}c)`}>
        <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
        <path d={d} stroke={color} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {dot && draw > 0.97 && <circle cx={last[0]} cy={last[1]} r={9} fill={color} stroke="#fff" strokeWidth={4} />}
    </svg>
  );
}

export function BarsV({ w, h, values, grow, color, labels, sub, base = 0 }: { w: number; h: number; values: number[]; grow: number; color: string; labels?: string[]; sub?: string; base?: number }) {
  const bw = w / values.length;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", width: w, height: h, gap: 0 }}>
      {values.map((v, i) => {
        const g = base + (1 - base) * Math.min(1, Math.max(0, grow * values.length - i * 0.6));
        return (
          <div key={i} style={{ width: bw, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {labels && <span style={{ fontSize: 15, fontWeight: 650, color: sub, opacity: g }}>{labels[i]}</span>}
            <div style={{ width: bw * 0.56, height: Math.max(6, v * (h - 30) * g), borderRadius: 8, background: i === values.length - 1 ? color : `${color}66` }} />
          </div>
        );
      })}
    </div>
  );
}

// A cursor: the arrow, or the reference's black dot.
export function Pointer({ x, y, press = 0, dot, hand, ink = "#111" }: { x: number; y: number; press?: number; dot?: boolean; hand?: boolean; ink?: string }) {
  if (dot) return <div style={{ position: "absolute", left: x - 11, top: y - 11, width: 22, height: 22, borderRadius: 99, background: ink, transform: `scale(${1 - press * 0.3})`, boxShadow: press ? `0 0 0 ${press * 14}px ${ink}22` : undefined, zIndex: 60 }} />;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${1 - press * 0.14})`, transformOrigin: "0 0", zIndex: 60 }}>
      {press > 0 && <span style={{ position: "absolute", left: -28, top: -28, width: 56, height: 56, borderRadius: 99, border: "3px solid rgba(255,255,255,0.9)", opacity: 1 - press, transform: `scale(${0.4 + press * 1.3})` }} />}
      {hand ? (
        <svg width={44} height={50} viewBox="0 0 22 25">
          <path d="M8 1.6 a1.6 1.6 0 0 1 3.2 0 V10 l1-.2 a1.5 1.5 0 0 1 2.9.6 l.2 .1 a1.5 1.5 0 0 1 2.8 .9 a1.5 1.5 0 0 1 2.7 1 V17 c0 4-2.6 6.6-6.4 6.6 H12 c-2.5 0-4-1-5.3-3 L3 14.6 a1.6 1.6 0 0 1 2.6-1.8 L8 15.4 Z" fill="#fff" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width={40} height={48} viewBox="0 0 22 26">
          <path d="M2 1.5 L2 21 L7.2 16.2 L10.6 24 L14 22.5 L10.6 14.8 L17.5 14.8 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// A cursor that glides between points: [frame, x, y][] (eased), pressing at
// `clicks` frames.
export function glide(f: number, path: [number, number, number][]): [number, number] {
  if (f <= path[0][0]) return [path[0][1], path[0][2]];
  for (let i = 1; i < path.length; i++) {
    if (f <= path[i][0]) {
      const k = IN_OUT((f - path[i - 1][0]) / (path[i][0] - path[i - 1][0]));
      return [mix(path[i - 1][1], path[i][1], k), mix(path[i - 1][2], path[i][2], k)];
    }
  }
  const l = path[path.length - 1];
  return [l[1], l[2]];
}
export const press = (f: number, clicks: number[]) => clicks.reduce((a, c) => Math.max(a, rise(f, c, 4) * (1 - rise(f, c + 4, 10))), 0);
