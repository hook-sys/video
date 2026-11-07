import { Icon } from "../icons";
import { familyOf } from "./faces";
import { TYPE, WEIGHT } from "./geo";
import { type C, One, clamp01, ease, panel, springAt, tint } from "./kit";
import { WordsIn, abs } from "./scenes";
import type { Scene } from "./types";

// The panel (docs/video-spec.md, The panel): the hand-made reel's look — one frosted panel
// of rows, each a glossy tile in its own colour, the thing as said, and a small picture of
// what it means (bars for an age, a map for a place, a clock for a time, a line for orders…),
// coming in row by row as each is said. The words said run under it, small. A scene that
// goes on with more things (Scene.carry) keeps the rows it had and adds to them: no cut.

// the tiles' colours, one per row in turn
export const TINTS: [string, string][] = [
  ["#C084FC", "#7C3AED"],
  ["#93C5FD", "#3B82F6"],
  ["#FDBA74", "#F97316"],
  ["#6EE7B7", "#059669"],
  ["#FDA4AF", "#E11D48"],
];
const MOST = 5;

// when row k comes in (a carried row: already in)
export const rowAt = (s: Scene, k: number) => (k < (s.carry ?? 0) ? s.from - 30 : Math.max(s.from + 6 + (k - (s.carry ?? 0)) * 6, (s.tiles?.[k]?.at ?? s.from) - 3));

// what a row's picture is, by its icon
type Kind = "bars" | "map" | "clock" | "rise" | "fall" | "signal" | "page" | "play" | "check" | "fill";
const KIND: Record<string, Kind> = {
  cake: "bars", "chart-column": "bars", database: "bars", calendar: "bars", "layout-dashboard": "bars", percent: "bars",
  "map-pin": "map", store: "map", house: "map",
  clock: "clock", sun: "clock", moon: "clock", "alarm-clock": "clock", timer: "clock",
  "shopping-cart": "rise", package: "rise", heart: "rise", "trending-up": "rise", activity: "rise", star: "rise", "shopping-bag": "rise", banknote: "rise",
  "trending-down": "fall", "undo-2": "fall", "circle-x": "fall", "triangle-alert": "fall",
  megaphone: "signal", radar: "signal", target: "signal", bell: "signal",
  globe: "page", file: "page", "file-text": "page", "mouse-pointer-click": "page", image: "page", smartphone: "page", "id-card": "page",
  play: "play", "circle-check": "check", "badge-check": "check", "list-checks": "check",
};
export const kindOf = (icon: string): Kind => KIND[icon] ?? "fill";

// ── the small pictures: w × h, from frame `at`, in the row's colour ──
function Mini({ kind, w, h, f, at, col, soft, line }: { kind: Kind; w: number; h: number; f: number; at: number; col: string; soft: string; line: string }) {
  const t = (d = 0, len = 18) => ease(clamp01((f - at - d) / len));
  const box = { position: "absolute" as const, left: 0, top: 0, width: w, height: h };
  if (kind === "bars") {
    const hs = [0.35, 0.7, 1, 0.78, 0.48, 0.28];
    return (
      <div style={{ ...box, display: "flex", alignItems: "flex-end", gap: w * 0.04 }}>
        {hs.map((x, i) => <div key={i} style={{ flex: 1, height: `${(x * t(4 + i * 3, 14) * 100).toFixed(1)}%`, borderRadius: 10, background: i === 2 ? col : soft }} />)}
      </div>
    );
  }
  if (kind === "map") {
    const p = t(6, 14);
    return (
      <svg width={w} height={h} style={box}>
        <path d={`M0 ${h * 0.7} C ${w * 0.25} ${h * 0.4}, ${w * 0.5} ${h * 0.95}, ${w} ${h * 0.5}`} stroke={line} strokeWidth={4} fill="none" strokeDasharray="10 10" />
        <path d={`M${w * 0.2} 0 L ${w * 0.35} ${h}`} stroke={line} strokeWidth={4} fill="none" />
        {[0.3, 0.72].map((u, i) => <circle key={i} cx={w * u} cy={h * (i ? 0.62 : 0.4)} r={8} fill={soft} />)}
        <g transform={`translate(${w * 0.56} ${h * 0.12 + (1 - p) * -30}) scale(${(0.6 + 0.4 * p).toFixed(3)})`} opacity={p}>
          <circle cx={0} cy={h * 0.62} r={22 * p} fill="none" stroke={col} strokeOpacity={0.35} strokeWidth={4} />
          <path d="M0 0 C -22 0 -30 20 -24 34 L 0 66 L 24 34 C 30 20 22 0 0 0 Z" fill={col} />
          <circle cx={0} cy={22} r={9} fill="#fff" />
        </g>
      </svg>
    );
  }
  if (kind === "clock") {
    const r = Math.min(w, h) * 0.42, cx = w / 2, cy = h / 2;
    const a = -Math.PI / 2 + t(4, 30) * Math.PI * 1.4;
    return (
      <svg width={w} height={h} style={box}>
        <circle cx={cx} cy={cy} r={r} fill={soft} />
        <path d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${a > Math.PI / 2 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} Z`} fill={col} opacity={0.35} />
        <line x1={cx} y1={cy} x2={cx + r * 0.8 * Math.cos(a)} y2={cy + r * 0.8 * Math.sin(a)} stroke={col} strokeWidth={6} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={7} fill={col} />
      </svg>
    );
  }
  if (kind === "rise" || kind === "fall") {
    const ys = kind === "rise" ? [0.8, 0.66, 0.72, 0.5, 0.42, 0.22, 0.12] : [0.15, 0.3, 0.26, 0.5, 0.58, 0.76, 0.86];
    const p = t(4, 26);
    const pts = ys.map((y, i) => [(i / (ys.length - 1)) * w, y * h]);
    const n = 1 + p * (pts.length - 1);
    const shown = pts.slice(0, Math.floor(n));
    const fr = n - Math.floor(n), nx = pts[Math.min(pts.length - 1, Math.floor(n))];
    const last = shown[shown.length - 1];
    const tip = fr > 0 && Math.floor(n) < pts.length ? [last[0] + (nx[0] - last[0]) * fr, last[1] + (nx[1] - last[1]) * fr] : last;
    const all = [...shown, tip];
    return (
      <svg width={w} height={h} style={{ ...box, overflow: "visible" }}>
        <path d={`M0 ${h} L ${all.map((q) => q.join(" ")).join(" L ")} L ${tip[0]} ${h} Z`} fill={soft} />
        <polyline points={all.map((q) => q.join(",")).join(" ")} fill="none" stroke={col} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={tip[0]} cy={tip[1]} r={9} fill={col} />
      </svg>
    );
  }
  if (kind === "signal") {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: w * 0.035 }}>
        {Array.from({ length: 9 }, (_, i) => {
          const wave = 0.3 + 0.7 * Math.abs(Math.sin((f - at) / 7 + i * 0.8));
          return <div key={i} style={{ flex: 1, height: `${(wave * t(i * 2, 10) * 90).toFixed(1)}%`, borderRadius: 99, background: i % 3 === 1 ? col : soft }} />;
        })}
      </div>
    );
  }
  if (kind === "page") {
    const p = t(4, 16), cur = t(16, 20);
    return (
      <div style={box}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 16, border: `3px solid ${soft}`, opacity: p }}>
          <div style={{ position: "absolute", left: 12, right: 12, top: 12, height: h * 0.22, borderRadius: 8, background: soft }} />
          {[0.45, 0.62, 0.79].map((y, i) => <div key={i} style={{ position: "absolute", left: 12, width: `${[70, 52, 60][i]}%`, top: h * y, height: h * 0.09, borderRadius: 6, background: line }} />)}
        </div>
        <div style={{ position: "absolute", left: w * (0.9 - 0.3 * cur), top: h * (0.9 - 0.3 * cur), opacity: cur }}>
          <Icon name="mouse-pointer-2" size={36} color={col} strokeWidth={2.4} />
        </div>
      </div>
    );
  }
  if (kind === "play") {
    const p = t(6, 40);
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: h * 0.5, height: h * 0.5, borderRadius: h * 0.25, background: col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="play" size={h * 0.24} color="#fff" strokeWidth={2.6} />
        </div>
        <div style={{ flex: 1, height: 12, borderRadius: 6, background: soft, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(p * 100).toFixed(1)}%`, borderRadius: 6, background: col }} />
        </div>
      </div>
    );
  }
  if (kind === "check") {
    return (
      <div style={{ ...box, display: "flex", flexDirection: "column", justifyContent: "center", gap: h * 0.1 }}>
        {[0, 1, 2].map((i) => {
          const k = t(4 + i * 6, 10);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.3 + 0.7 * k }}>
              <div style={{ width: h * 0.2, height: h * 0.2, borderRadius: h * 0.1, background: k > 0.02 ? col : soft, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${(0.7 + 0.3 * k).toFixed(3)})` }}>
                <Icon name="check" size={h * 0.13} color="#fff" strokeWidth={3} />
              </div>
              <div style={{ flex: 1, height: h * 0.08, borderRadius: 6, background: soft }} />
            </div>
          );
        })}
      </div>
    );
  }
  // fill: a meter filling, its end lit
  const p = t(4, 22);
  return (
    <div style={{ ...box, display: "flex", alignItems: "center" }}>
      <div style={{ flex: 1, height: 16, borderRadius: 8, background: soft, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(p * 78).toFixed(1)}%`, borderRadius: 8, background: col }} />
      </div>
    </div>
  );
}

// ── the panel ──
export function Panel({ c }: { c: C }) {
  const { W, H, pad, shape } = c.g;
  const { s, f, look } = c;
  const rows = (s.tiles ?? []).slice(0, MOST);
  const n = rows.length;
  const wide = shape === "wide";
  // (the words said, small, under the panel — or beside it on a wide frame)
  const capH = wide ? H * 0.5 : shape === "tall" ? 300 : 220;
  const pw = wide ? W * 0.56 : W - 2 * pad;
  const m = Math.max(n, s.rows ?? 0);
  const rh = Math.min(wide ? 150 : shape === "tall" ? 230 : 190, ((wide ? H - 2 * pad : H - capH - pad * 1.4) - 40) / Math.max(1, m));
  const ph = m * rh + 40;
  const px = wide ? pad : (W - pw) / 2;
  // (the panel and the words under it centred together: the words take about two lines)
  const said = shape === "tall" ? 230 : 170;
  const py = wide ? (H - ph) / 2 : Math.max(pad * 0.7, (H - ph - 30 - said) / 2);
  const tileS = Math.round(rh * 0.56);
  const labelW = Math.min(360, pw * 0.38);
  const miniW = pw - 40 - 52 - tileS - 26 - labelW - 30;
  const k0 = springAt(c, s.carry ? s.from - 30 : s.from + 2);
  // (the row said last lit; all lit at the end)
  const now = rows.reduce((a, _, k) => (f >= rowAt(s, k) ? k : a), -1);
  return (
    <>
      <div style={abs({ left: px, top: py, width: pw, height: ph, ...panel(c, 40), opacity: clamp01(k0 * 1.6), transform: `translateY(${((1 - k0) * 40).toFixed(1)}px)` })}>
        {rows.map((r, k) => {
          const at = rowAt(s, k);
          const kr = springAt(c, at);
          const [a, b] = TINTS[k % TINTS.length];
          const lit = k === now ? clamp01((f - at + 3) / 8) : 0;
          return (
            <div key={k} style={abs({ left: 20, right: 20, top: 20 + k * rh, height: rh - 12, borderRadius: 28, background: tint(b, 0.08 * lit), display: "flex", alignItems: "center", gap: 26, padding: "0 26px", boxSizing: "border-box", opacity: clamp01(kr * 1.6), transform: `translateY(${((1 - kr) * 30).toFixed(1)}px)`, filter: kr < 0.98 ? `blur(${((1 - kr) * 8).toFixed(1)}px)` : undefined })}>
              <div data-part="item-icon" style={{ width: tileS, height: tileS, borderRadius: tileS * 0.27, background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `inset 0 ${(tileS * 0.05).toFixed(0)}px ${(tileS * 0.07).toFixed(0)}px rgba(255,255,255,0.5), 0 ${(tileS * 0.12).toFixed(0)}px ${(tileS * 0.28).toFixed(0)}px ${b}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={r.icon} size={tileS * 0.52} color="#ffffff" strokeWidth={2.2} />
              </div>
              <div style={{ width: labelW, flexShrink: 0 }}>
                <One part="item" face={look.display} fit={labelW} style={{ fontFamily: familyOf(look.display), fontSize: Math.round(Math.min(TYPE.ITEM * 1.1, rh * 0.3)), fontWeight: WEIGHT.item, color: look.panelInk }}>{r.text}</One>
              </div>
              <div style={{ position: "relative", width: miniW, height: rh * 0.62, flexShrink: 0 }}>
                <Mini kind={kindOf(r.icon)} w={miniW} h={rh * 0.62} f={f} at={at} col={b} soft={tint(b, 0.2)} line={tint(look.panelInk, 0.12)} />
              </div>
            </div>
          );
        })}
      </div>
      <WordsIn c={c} box={wide ? { left: px + pw + pad * 0.6, top: pad, width: W - px - pw - pad * 1.6, height: H - 2 * pad } : { left: pad, top: py + ph + 30, width: W - 2 * pad, height: said }} place={wide ? "side" : "band"} />
    </>
  );
}
