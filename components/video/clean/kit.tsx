import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";

// The UI kit: small flat parts every card is built from (no screenshots
// needed). `dark` picks the face for a dark or a light background.

export function Panel({ dark, w, h, pad = 28, radius = 26, children, style }: { dark: boolean; w: number; h?: number; pad?: number; radius?: number; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        padding: pad,
        borderRadius: radius,
        background: dark ? "rgba(22,26,58,0.78)" : "rgba(255,255,255,0.9)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.09)" : "rgba(30,24,80,0.07)"}`,
        boxShadow: dark ? "0 40px 90px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)" : "0 40px 90px rgba(40,30,110,0.16), 0 8px 24px rgba(40,30,110,0.06)",
        backdropFilter: "blur(18px)",
        color: dark ? "#eef1ff" : "#16123a",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function BrowserBar({ dark, url }: { dark: boolean; url: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c, opacity: 0.9 }} />
      ))}
      <span style={{ marginLeft: 14, flex: 1, height: 30, borderRadius: 10, background: dark ? "rgba(255,255,255,0.06)" : "rgba(30,24,80,0.05)", fontSize: 15, display: "flex", alignItems: "center", paddingLeft: 14, color: dark ? "#8f9ac2" : "#8a86a8" }}>{url}</span>
    </div>
  );
}

export const Label = ({ children, dark, style }: { children: ReactNode; dark: boolean; style?: CSSProperties }) => (
  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: dark ? "#8f9ac2" : "#8a86a8", ...style }}>{children}</div>
);

export function Stat({ label, value, delta, dark, size = 64, accent }: { label: string; value: string; delta?: string; dark: boolean; size?: number; accent: string }) {
  return (
    <div>
      <Label dark={dark}>{label}</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
        <span style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {delta && <span style={{ fontSize: 18, fontWeight: 700, color: accent, background: `${accent}1f`, padding: "4px 10px", borderRadius: 99 }}>{delta}</span>}
      </div>
    </div>
  );
}

// Bars that grow: heights 0..1, `grow` per bar 0..1.
export function Bars({ values, grow, w, h, colors, gap = 14 }: { values: number[]; grow: number[]; w: number; h: number; colors: [string, string]; gap?: number }) {
  const bw = (w - gap * (values.length - 1)) / values.length;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap, width: w, height: h }}>
      {values.map((v, i) => (
        <div key={i} style={{ width: bw, height: Math.max(4, v * h * (grow[i] ?? 1)), borderRadius: 10, backgroundImage: `linear-gradient(180deg, ${colors[1]}, ${colors[0]})`, opacity: 0.35 + 0.65 * (i / (values.length - 1 || 1)) }} />
      ))}
    </div>
  );
}

// A line chart drawn on (0..1).
export function LineChart({ points, draw, w, h, color, fill }: { points: number[]; draw: number; w: number; h: number; color: string; fill: string }) {
  const pts = points.map((p, i) => [(i / (points.length - 1)) * w, h - p * h] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={fill} stopOpacity={0.35} />
          <stop offset="1" stopColor={fill} stopOpacity={0} />
        </linearGradient>
        <clipPath id="lc-clip">
          <rect x={0} y={-20} width={w * draw} height={h + 40} />
        </clipPath>
      </defs>
      <g clipPath="url(#lc-clip)">
        <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#lc-fill)" />
        <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {draw > 0.98 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={9} fill={color} stroke="#fff" strokeWidth={4} />}
    </svg>
  );
}

export function IconTile({ name, size = 96, colors, dark, draw = 1, style }: { name: string; size?: number; colors: [string, string]; dark: boolean; draw?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: dark ? "rgba(255,255,255,0.07)" : "#ffffff",
        border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(30,24,80,0.08)"}`,
        boxShadow: dark ? `0 20px 50px rgba(0,0,0,0.45), 0 0 40px ${colors[0]}33` : `0 20px 50px ${colors[0]}2a`,
        ...style,
      }}
    >
      <Icon name={name} size={size * 0.5} color={colors[0]} fill={`${colors[1]}30`} strokeWidth={1.8} draw={draw} />
    </div>
  );
}

export function Toast({ icon, title, sub, dark, accent }: { icon: string; title: string; sub: string; dark: boolean; accent: string }) {
  return (
    <Panel dark={dark} w={440} pad={20} radius={20} style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 54, height: 54, borderRadius: 16, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={28} color={accent} strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 21, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 17, opacity: 0.6, marginTop: 4 }}>{sub}</div>
      </div>
    </Panel>
  );
}

// A person stands for an initial on a colour (never a face).
export const Initial = ({ letter, color, size = 56, ring }: { letter: string; color: string; size?: number; ring?: string }) => (
  <div style={{ width: size, height: size, borderRadius: 99, background: color, color: "#fff", fontWeight: 700, fontSize: size * 0.42, display: "flex", alignItems: "center", justifyContent: "center", border: ring ? `4px solid ${ring}` : undefined }}>{letter}</div>
);

export function Button({ label, colors, press = 0, size = 30 }: { label: string; colors: [string, string]; press?: number; size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: `${size * 0.62}px ${size * 1.3}px`, borderRadius: 999, backgroundImage: `linear-gradient(100deg, ${colors[0]}, ${colors[1]})`, color: "#fff", fontSize: size, fontWeight: 700, letterSpacing: "-0.01em", boxShadow: `0 ${18 - press * 10}px ${50 - press * 20}px ${colors[0]}66`, transform: `scale(${1 - press * 0.05})` }}>
      {label}
      <span style={{ width: size * 1.25, height: size * 1.25, borderRadius: 99, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="arrow-right" size={size * 0.8} color="#fff" strokeWidth={2.6} />
      </span>
    </div>
  );
}

export function Cursor({ x, y, press = 0, opacity = 1 }: { x: number; y: number; press?: number; opacity?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, transform: `scale(${1 - press * 0.15})`, transformOrigin: "0 0", zIndex: 50 }}>
      {press > 0 && <span style={{ position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: 99, border: "3px solid rgba(255,255,255,0.9)", opacity: 1 - press, transform: `scale(${0.4 + press * 1.4})` }} />}
      <svg width={44} height={52} viewBox="0 0 22 26">
        <path d="M2 1.5 L2 21 L7.2 16.2 L10.6 24 L14 22.5 L10.6 14.8 L17.5 14.8 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
