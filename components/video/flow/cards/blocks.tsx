import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/video/icons";
import { clamp01, ramp } from "../eval";
import type { FlowTheme } from "../themes";
import type { Block, CardStyle, Row, Tone } from "./types";

// Block renderers. Every block is deterministic in `t` (frames since the block
// started to appear): numbers count up, bars grow, lines draw, checklists tick.

export type Palette = { bg: string; ink: string; sub: string; track: string; line: string; brand: string; brand2: string; onBrand: string; shadow: string; border: string; blur: boolean };

export function palette(theme: FlowTheme, style: CardStyle): Palette {
  const dark = style === "dark" || (theme.dark && style !== "accent" && style !== "tinted");
  const base = {
    brand: theme.primary,
    brand2: theme.primary2,
    onBrand: "#FFFFFF",
    line: dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.07)",
  };
  if (style === "accent")
    return { ...base, bg: `linear-gradient(145deg, ${theme.primary}, ${theme.primary2})`, ink: "#FFFFFF", sub: "rgba(255,255,255,.78)", track: "rgba(255,255,255,.22)", line: "rgba(255,255,255,.18)", brand: "#FFFFFF", brand2: "rgba(255,255,255,.7)", onBrand: theme.primary, shadow: `0 30px 70px ${theme.glow}0.35)`, border: "rgba(255,255,255,.25)", blur: false };
  if (dark)
    return { ...base, bg: style === "glass" ? "rgba(24,26,34,.78)" : "#171920", ink: "#F3F4F8", sub: "#9BA0AE", track: "rgba(255,255,255,.08)", shadow: "0 30px 70px rgba(0,0,0,.45)", border: "rgba(255,255,255,.09)", blur: style === "glass" };
  if (style === "tinted") return { ...base, bg: theme.soft, ink: theme.ink, sub: theme.sub, track: "rgba(255,255,255,.7)", shadow: `0 24px 60px ${theme.glow}0.16)`, border: "rgba(255,255,255,.8)", blur: false };
  return { ...base, bg: style === "glass" ? "rgba(255,255,255,.8)" : "#FFFFFF", ink: theme.ink, sub: theme.sub, track: theme.soft, shadow: `0 28px 70px ${theme.glow}0.18)`, border: style === "glass" ? "rgba(255,255,255,.95)" : "rgba(15,23,42,.06)", blur: style === "glass" };
}

export const toneColor = (tone: Tone | undefined, p: Palette, theme: FlowTheme) =>
  tone === "success" ? theme.success : tone === "warn" ? "#F59E0B" : tone === "danger" ? "#EF4444" : tone === "info" ? "#3B82F6" : tone === "neutral" ? p.sub : p.brand;

const CHAR = 0.56; // em per character (Inter), for size estimates

// Height of a block at card inner width `w` (px) — used for layout and camera
// framing, and as the block's fixed height when rendered.
export function blockHeight(b: Block, w: number): number {
  switch (b.type) {
    case "header":
    case "avatar":
      return 64;
    case "bignum":
      return b.label ? 96 : 70;
    case "chip":
      return 40;
    case "rows":
      return (Array.isArray(b.items) ? b.items.length : 3) * 58;
    case "progress":
      return b.label ? 54 : 22;
    case "bars":
      return 120;
    case "line":
      return 110;
    case "donut":
      return 150;
    case "button":
      return 58;
    case "bubble":
      return 30 * Math.max(1, Math.ceil((b.text.length * CHAR * 22) / Math.max(120, w * 0.78 - 40))) + 30;
    case "stars":
      return 36;
    case "steps":
      return 66;
    case "toggle":
      return 48;
    case "kv":
      return b.pairs.length * 38;
    case "tags":
      return 44;
    case "code":
      return b.lines.length * 28 + 24;
    case "checklist":
      return (Array.isArray(b.items) ? b.items.length : 3) * 46;
    case "price":
      return 84;
    case "input":
      return 74;
    case "calendar":
      return 206;
    case "map":
      return 180;
    case "media":
      return Math.round(w / (b.ratio ?? 1.9));
    case "table":
      return (b.rows.length + 1) * 38;
    case "heat":
      return 118;
    case "typing":
      return 44;
    case "text":
      return (b.size === "l" ? 50 : b.size === "s" ? 28 : 34) * Math.max(1, Math.ceil((b.text.length * CHAR * (b.size === "l" ? 34 : b.size === "s" ? 18 : 22)) / w));
    case "qr":
      return 150;
    case "divider":
      return 14;
    case "stages":
      return 104;
    case "slots":
      return Math.ceil((Array.isArray(b.items) ? b.items.length : 6) / 3) * 56;
    case "log":
      return (Array.isArray(b.lines) ? b.lines.length : 4) * 30 + 24;
    case "signature":
      return 104;
    case "meter":
      return 132;
    case "avatars":
      return 56;
    case "timeline":
      return (Array.isArray(b.items) ? b.items.length : 3) * 52;
  }
}

const numberParts = (v: string) => {
  const m = v.match(/^(\D*)([\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const digits = m[2].replace(/,/g, "");
  return { pre: m[1], n: parseFloat(digits), decimals: (digits.split(".")[1] ?? "").length, post: m[3], commas: m[2].includes(",") };
};
// "৳48,000" counts up from 0 with the same format.
export function countUp(v: string, k: number) {
  const p = numberParts(v);
  if (!p || k >= 1) return v;
  const x = p.n * k;
  const s = x.toFixed(p.decimals);
  return `${p.pre}${p.commas ? Number(s).toLocaleString("en-US", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals }) : s}${p.post}`;
}

type Ctx = { p: Palette; theme: FlowTheme; t: number; w: number };

// On an accent card (white ink on the brand colour) coloured tones would
// vanish: chips and tiles turn white with the brand colour inside.
const onAccent = (p: Palette) => p.onBrand !== "#FFFFFF";

function IconTile({ name, size, ctx, tone }: { name: string; size: number; ctx: Ctx; tone?: Tone }) {
  const c = onAccent(ctx.p) ? "#FFFFFF" : toneColor(tone, ctx.p, ctx.theme);
  if (onAccent(ctx.p))
    return (
      <div style={{ width: size, height: size, borderRadius: size * 0.3, background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={name} size={size * 0.52} color={c} strokeWidth={2.1} />
      </div>
    );
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.3, background: tone ? `${c}22` : ctx.p.track, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <Icon name={name} size={size * 0.52} color={c} strokeWidth={2.1} />
    </div>
  );
}

export function Chip({ text, tone, icon, ctx }: { text: string; tone?: Tone; icon?: string; ctx: Ctx }) {
  const accent = onAccent(ctx.p);
  const c = accent ? ctx.p.onBrand : toneColor(tone ?? "success", ctx.p, ctx.theme);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, fontSize: 16, fontWeight: 650, color: c, background: accent ? "rgba(255,255,255,.95)" : `${c}1F`, whiteSpace: "nowrap" }}>
      {icon && <Icon name={icon} size={16} color={c} strokeWidth={2.4} />}
      {text}
    </span>
  );
}

function RowView({ r, ctx, k }: { r: Row; ctx: Ctx; k: number }) {
  return (
    <div style={{ height: 50, marginBottom: 8, display: "flex", alignItems: "center", gap: 14, padding: "0 14px", borderRadius: 14, background: ctx.p.track, opacity: k, transform: `translateX(${(1 - k) * 24}px)` }}>
      {r.icon && <Icon name={r.icon} size={22} color={ctx.p.brand} strokeWidth={2.1} />}
      <span style={{ fontSize: 19, fontWeight: 600, color: ctx.p.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.text}</span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {r.value && <span style={{ fontSize: 19, fontWeight: 700, color: ctx.p.ink }}>{r.value}</span>}
        {r.status && <Chip text={r.status} tone={r.tone} ctx={ctx} />}
      </span>
    </div>
  );
}

// Rows from strings: "Text · value · status" (value and status optional).
const asRows = (items: Row[] | string[] | string, icon = "circle-check"): Row[] =>
  (Array.isArray(items) ? items : items.split("|")).map((r) => {
    if (typeof r !== "string") return r;
    const [text, value, status] = r.split(/\s*·\s*/).map((x) => x.trim());
    return { icon, text, value: value || undefined, status: status || undefined };
  });
const asList = (items: string[] | string): string[] => (Array.isArray(items) ? items : items.split("|"));

export function BlockView({ b, ctx }: { b: Block; ctx: Ctx }): ReactNode {
  const { p, theme, t, w } = ctx;
  const h = blockHeight(b, w);
  const box: CSSProperties = { height: h, position: "relative" };
  switch (b.type) {
    case "header":
      return (
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 16 }}>
          <IconTile name={b.icon} size={52} ctx={ctx} tone={b.tone} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 23, fontWeight: 700, color: p.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
            {b.sub && <div style={{ fontSize: 17, color: p.sub, marginTop: 2, whiteSpace: "nowrap" }}>{b.sub}</div>}
          </div>
          {b.badge && (
            <span style={{ marginLeft: "auto" }}>
              <Chip text={b.badge} tone={b.tone} ctx={ctx} />
            </span>
          )}
        </div>
      );
    case "avatar": {
      const initials = b.name.split(/\s+/).map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
      return (
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: `linear-gradient(145deg, ${p.brand}, ${p.brand2})`, color: p.onBrand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 700, flex: "none" }}>{initials}</div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: p.ink }}>{b.name}</div>
            {b.sub && <div style={{ fontSize: 17, color: p.sub }}>{b.sub}</div>}
          </div>
          {b.badge && (
            <span style={{ marginLeft: "auto" }}>
              <Chip text={b.badge} tone={b.tone} ctx={ctx} />
            </span>
          )}
        </div>
      );
    }
    case "bignum": {
      const k = ramp(t, 4, 26, "out");
      return (
        <div style={box}>
          {b.label && <div style={{ fontSize: 17, color: p.sub, fontWeight: 550 }}>{b.label}</div>}
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 54, fontWeight: 750, color: p.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{countUp(b.value, k)}</span>
            {b.delta && <span style={{ fontSize: 19, fontWeight: 700, color: toneColor(b.tone ?? "success", p, theme), opacity: ramp(t, 20, 10) }}>{b.delta}</span>}
          </div>
        </div>
      );
    }
    case "chip":
      return (
        <div style={{ ...box, display: "flex", alignItems: "center" }}>
          <Chip text={b.text} tone={b.tone} icon={b.icon} ctx={ctx} />
        </div>
      );
    case "rows":
      return <div style={box}>{asRows(b.items, b.icon).map((r, i) => <RowView key={i} r={r} ctx={ctx} k={ramp(t, 3 + i * 4, 12, "out")} />)}</div>;
    case "progress": {
      const k = ramp(t, 4, 34, "inOut");
      const c = toneColor(b.tone, p, theme);
      return (
        <div style={box}>
          {b.label && (
            <div style={{ display: "flex", fontSize: 17, color: p.sub, marginBottom: 10 }}>
              <span>{b.label}</span>
              <span style={{ marginLeft: "auto", color: p.ink, fontWeight: 700 }}>{Math.round(b.value * k)}%</span>
            </div>
          )}
          <div style={{ height: 12, borderRadius: 6, background: p.track, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${b.value * k}%`, borderRadius: 6, background: `linear-gradient(90deg, ${c}, ${p.brand2})` }} />
          </div>
        </div>
      );
    }
    case "bars": {
      const max = Math.max(...b.values, 1);
      return (
        <div style={{ ...box, display: "flex", alignItems: "flex-end", gap: 10 }}>
          {b.values.map((v, i) => {
            const k = ramp(t, 3 + i * 2, 18, "out");
            return <div key={i} style={{ flex: 1, height: `${(v / max) * 100 * k}%`, borderRadius: 8, background: i === b.values.length - 1 ? `linear-gradient(180deg, ${p.brand}, ${p.brand2})` : p.track }} />;
          })}
        </div>
      );
    }
    case "line": {
      const max = Math.max(...b.values);
      const min = Math.min(...b.values);
      const pts = b.values.map((v, i) => [(i / (b.values.length - 1)) * w, h - 8 - ((v - min) / Math.max(1, max - min)) * (h - 24)]);
      const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
      const k = ramp(t, 3, 32, "inOut");
      const c = toneColor(b.tone, p, theme);
      return (
        <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
          <path d={`${d}L${w} ${h}L0 ${h}Z`} fill={c} opacity={0.1 * k} />
          <path d={d} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${k} 1`} />
          {k > 0.98 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={7} fill={c} stroke="#fff" strokeWidth={3} />}
        </svg>
      );
    }
    case "donut": {
      const k = ramp(t, 4, 34, "inOut");
      const r = 56;
      return (
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 22 }}>
          <svg width={140} height={140} viewBox="0 0 140 140">
            <circle cx={70} cy={70} r={r} fill="none" stroke={p.track} strokeWidth={16} />
            <circle cx={70} cy={70} r={r} fill="none" stroke={p.brand} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={`${(b.value / 100) * k} 1`} transform="rotate(-90 70 70)" />
            <text x={70} y={78} textAnchor="middle" fontSize={26} fontWeight={750} fill={p.ink}>{Math.round(b.value * k)}%</text>
          </svg>
          {b.label && <div style={{ fontSize: 19, color: p.sub, fontWeight: 550 }}>{b.label}</div>}
        </div>
      );
    }
    case "button": {
      const c = toneColor(b.tone, p, theme);
      const press = ramp(t, 26, 6, "in") * (1 - ramp(t, 32, 8, "out"));
      return (
        <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, background: p.brand === "#FFFFFF" ? "#FFFFFF" : `linear-gradient(135deg, ${c}, ${p.brand2})`, color: p.brand === "#FFFFFF" ? p.onBrand : "#fff", fontSize: 20, fontWeight: 700, transform: `scale(${1 - press * 0.05})` }}>
          {b.icon && <Icon name={b.icon} size={22} color={p.brand === "#FFFFFF" ? p.onBrand : "#fff"} strokeWidth={2.3} />}
          {b.text}
        </div>
      );
    }
    case "bubble": {
      const right = b.side === "right";
      return (
        <div style={{ ...box, display: "flex", justifyContent: right ? "flex-end" : "flex-start" }}>
          <div style={{ maxWidth: "78%", padding: "12px 18px", borderRadius: 20, borderBottomRightRadius: right ? 6 : 20, borderBottomLeftRadius: right ? 20 : 6, background: right ? `linear-gradient(135deg, ${p.brand}, ${p.brand2})` : p.track, color: right && p.brand !== "#FFFFFF" ? "#fff" : p.ink, fontSize: 19, lineHeight: 1.35 }}>{b.text}</div>
        </div>
      );
    }
    case "stars":
      return (
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 4 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ transform: `scale(${ramp(t, 4 + i * 3, 10, "back")})` }}>
              <Icon name="star" size={26} color={i < b.n ? "#F5B301" : p.track} strokeWidth={2} />
            </div>
          ))}
          {b.label && <span style={{ marginLeft: 10, fontSize: 18, color: p.sub }}>{b.label}</span>}
        </div>
      );
    case "steps": {
      const items = asList(b.items);
      const n = items.length;
      const k = ramp(t, 4, 30, "inOut") * (b.active / Math.max(1, n - 1));
      return (
        <div style={box}>
          <div style={{ position: "absolute", left: 12, right: 12, top: 11, height: 4, borderRadius: 2, background: p.track }} />
          <div style={{ position: "absolute", left: 12, top: 11, height: 4, borderRadius: 2, width: `calc(${k * 100}% - ${k * 24}px)`, background: p.brand }} />
          {items.map((s, i) => {
            const on = i / Math.max(1, n - 1) <= k + 0.001;
            return (
              <div key={i} style={{ position: "absolute", left: `calc(${(i / Math.max(1, n - 1)) * 100}% - ${(i / Math.max(1, n - 1)) * 24}px)`, top: 0, width: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: on ? p.brand : p.track, border: `4px solid ${on ? p.brand : p.track}`, boxSizing: "border-box" }} />
                <div style={{ marginTop: 8, fontSize: 15, color: on ? p.ink : p.sub, whiteSpace: "nowrap", fontWeight: on ? 650 : 500 }}>{s}</div>
              </div>
            );
          })}
        </div>
      );
    }
    case "toggle": {
      const k = b.on ? ramp(t, 10, 10, "out") : 0;
      return (
        <div style={{ ...box, display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 19, color: p.ink, fontWeight: 600 }}>{b.label}</span>
          <div style={{ marginLeft: "auto", width: 56, height: 32, borderRadius: 16, background: k > 0.5 ? p.brand : p.track, position: "relative" }}>
            <div style={{ position: "absolute", top: 4, left: 4 + k * 24, width: 24, height: 24, borderRadius: 12, background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,.2)" }} />
          </div>
        </div>
      );
    }
    case "kv":
      return (
        <div style={box}>
          {b.pairs.map(([k, v], i) => (
            <div key={i} style={{ height: 38, display: "flex", alignItems: "center", fontSize: 18, borderBottom: i < b.pairs.length - 1 ? `1px solid ${p.line}` : "none", opacity: ramp(t, 3 + i * 3, 10) }}>
              <span style={{ color: p.sub }}>{k}</span>
              <span style={{ marginLeft: "auto", color: p.ink, fontWeight: 650 }}>{v}</span>
            </div>
          ))}
        </div>
      );
    case "tags":
      return (
        <div style={{ ...box, display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}>
          {asList(b.items).map((s, i) => (
            <span key={i} style={{ padding: "7px 14px", borderRadius: 999, background: i === 0 ? p.brand : p.track, color: i === 0 ? (onAccent(p) ? p.onBrand : "#fff") : p.ink, fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", transform: `scale(${ramp(t, 3 + i * 3, 10, "back")})` }}>{s}</span>
          ))}
        </div>
      );
    case "code":
      return (
        <div style={{ ...box, borderRadius: 14, background: "#0F1220", padding: "12px 16px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 16, lineHeight: "28px" }}>
          {b.lines.map((l, i) => {
            const shown = Math.max(0, Math.min(l.length, Math.floor((t - 4 - i * 10) * 1.6)));
            return (
              <div key={i} style={{ color: i % 3 === 0 ? "#8BE9FD" : i % 3 === 1 ? "#F1FA8C" : "#E6E6F0", whiteSpace: "pre" }}>
                {l.slice(0, shown)}
              </div>
            );
          })}
        </div>
      );
    case "checklist":
      return (
        <div style={box}>
          {asList(b.items).map((s, i) => {
            const k = ramp(t, 8 + i * 9, 10, "back");
            return (
              <div key={i} style={{ height: 46, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: k > 0.5 ? p.brand : p.track, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.8 + 0.2 * k})` }}>
                  {k > 0.1 && <Icon name="check" size={18} color={p.brand === "#FFFFFF" ? p.onBrand : "#fff"} strokeWidth={3} draw={clamp01(k)} />}
                </div>
                <span style={{ fontSize: 19, color: p.ink, fontWeight: 550, textDecoration: k > 0.9 ? "none" : "none" }}>{s}</span>
              </div>
            );
          })}
        </div>
      );
    case "price":
      return (
        <div style={{ ...box, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 60, fontWeight: 780, color: p.ink, letterSpacing: "-0.03em" }}>{countUp(b.amount, ramp(t, 4, 24, "out"))}</span>
          {b.period && <span style={{ fontSize: 20, color: p.sub }}>{b.period}</span>}
        </div>
      );
    case "input": {
      const shown = b.value.slice(0, Math.max(0, Math.floor((t - 6) * 0.9)));
      const caret = Math.floor(t / 8) % 2 === 0 && shown.length < b.value.length;
      return (
        <div style={box}>
          <div style={{ fontSize: 16, color: p.sub, marginBottom: 8 }}>{b.label}</div>
          <div style={{ height: 44, borderRadius: 12, border: `2px solid ${shown.length ? p.brand : p.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontSize: 19, color: p.ink }}>
            {b.icon && <Icon name={b.icon} size={20} color={p.sub} />}
            <span>{shown}</span>
            {caret && <span style={{ width: 2, height: 22, background: p.brand }} />}
          </div>
        </div>
      );
    }
    case "calendar": {
      const cell = (w - 6 * 6) / 7;
      return (
        <div style={{ ...box, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {Array.from({ length: 28 }, (_, i) => {
            const on = b.days.includes(i + 1);
            const k = on ? ramp(t, 6 + b.days.indexOf(i + 1) * 5, 10, "back") : 0;
            return (
              <div key={i} style={{ height: Math.min(cell, 40), borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: on ? 700 : 500, color: on && k > 0.5 ? (p.brand === "#FFFFFF" ? p.onBrand : "#fff") : p.sub, background: on ? (k > 0.5 ? p.brand : p.track) : "transparent", transform: `scale(${on ? 0.8 + 0.2 * k : 1})` }}>
                {i + 1}
              </div>
            );
          })}
        </div>
      );
    }
    case "map": {
      const k = ramp(t, 6, 40, "inOut");
      return (
        <svg width={w} height={h} style={{ display: "block", borderRadius: 16, background: p.track }}>
          {[0.2, 0.45, 0.7].map((y, i) => <line key={i} x1={0} x2={w} y1={h * y} y2={h * y + 30} stroke={p.line} strokeWidth={10} />)}
          {[0.25, 0.6].map((x, i) => <line key={i} x1={w * x} x2={w * x - 20} y1={0} y2={h} stroke={p.line} strokeWidth={10} />)}
          <path d={`M${w * 0.12} ${h * 0.8} C ${w * 0.35} ${h * 0.2}, ${w * 0.6} ${h * 0.9}, ${w * 0.86} ${h * 0.25}`} fill="none" stroke={p.brand} strokeWidth={5} strokeDasharray="3 10" strokeLinecap="round" pathLength={1} style={{ strokeDasharray: `${k} 1` }} />
          <circle cx={w * 0.12} cy={h * 0.8} r={9} fill={p.brand} />
          <g transform={`translate(${w * 0.86}, ${h * 0.25 - 18 * ramp(t, 40, 10, "back")})`}>
            <circle r={14} fill={theme.success} stroke="#fff" strokeWidth={4} opacity={ramp(t, 40, 6)} />
          </g>
        </svg>
      );
    }
    case "media":
      return (
        <div style={{ ...box, borderRadius: 16, background: `linear-gradient(135deg, ${p.track}, ${p.brand}33)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ transform: `scale(${0.85 + 0.15 * ramp(t, 4, 16, "back")})` }}>
            <Icon name={b.icon} size={Math.min(72, h * 0.45)} color={p.brand} strokeWidth={1.8} />
          </div>
        </div>
      );
    case "table":
      return (
        <div style={box}>
          {[b.cols, ...b.rows].map((r, i) => (
            <div key={i} style={{ height: 38, display: "grid", gridTemplateColumns: `repeat(${b.cols.length}, 1fr)`, alignItems: "center", fontSize: i ? 17 : 15, fontWeight: i ? 550 : 650, color: i ? p.ink : p.sub, borderBottom: `1px solid ${p.line}`, opacity: i ? ramp(t, 3 + i * 3, 10) : 1 }}>
              {r.map((c, j) => (
                <span key={j} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: j ? "right" : "left" }}>{c}</span>
              ))}
            </div>
          ))}
        </div>
      );
    case "heat":
      return (
        <div style={{ ...box, display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 4 }}>
          {Array.from({ length: 42 }, (_, i) => {
            const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
            const a = Math.abs(v) * ramp(t, 2 + (i % 14), 10);
            return <div key={i} style={{ borderRadius: 4, background: p.brand, opacity: 0.12 + 0.88 * a }} />;
          })}
        </div>
      );
    case "typing":
      return (
        <div style={{ ...box, display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, padding: "12px 16px", borderRadius: 18, background: p.track }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: 5, background: p.sub, transform: `translateY(${Math.sin((t - i * 4) / 4) * 3}px)` }} />
            ))}
          </div>
        </div>
      );
    case "text":
      return <div style={{ ...box, fontSize: b.size === "l" ? 34 : b.size === "s" ? 18 : 22, fontWeight: b.size === "l" ? 750 : 500, color: b.muted ? p.sub : p.ink, lineHeight: 1.4, letterSpacing: b.size === "l" ? "-0.02em" : 0 }}>{b.text}</div>;
    case "qr":
      return (
        <div style={{ ...box, display: "grid", gridTemplateColumns: "repeat(9, 14px)", gap: 2, justifyContent: "center" }}>
          {Array.from({ length: 81 }, (_, i) => {
            const corner = (x: number, y: number) => x < 3 && y < 3;
            const [x, y] = [i % 9, Math.floor(i / 9)];
            const on = corner(x, y) || corner(8 - x, y) || corner(x, 8 - y) || Math.abs(Math.sin(i * 7.31)) > 0.5;
            return <div key={i} style={{ width: 14, height: 14, borderRadius: 2, background: on ? p.ink : "transparent", opacity: ramp(t, 2 + ((x + y) % 9), 8) }} />;
          })}
        </div>
      );
    case "divider":
      return <div style={{ ...box, display: "flex", alignItems: "center" }}><div style={{ height: 1, width: "100%", background: p.line }} /></div>;
    case "stages": {
      const items = asList(b.items);
      return (
        <div style={{ ...box, display: "flex", gap: 8 }}>
          {items.map((s, i) => {
            const on = i <= b.active;
            const k = ramp(t, 3 + i * 5, 12, "out");
            const cur = i === b.active;
            return (
              <div key={i} style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: "12px 10px", background: cur ? `linear-gradient(145deg, ${p.brand}, ${p.brand2})` : on ? `${p.brand}22` : p.track, opacity: k, transform: `translateY(${(1 - k) * 16}px)`, boxShadow: cur ? `0 10px 24px ${p.brand}55` : "none" }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: cur ? (onAccent(p) ? p.onBrand : "#fff") : p.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
                <div style={{ fontSize: 30, fontWeight: 750, color: cur ? (onAccent(p) ? p.onBrand : "#fff") : p.ink, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{countUp(String(b.counts?.[i] ?? Math.max(1, 24 - i * 6)), ramp(t, 6 + i * 5, 20, "out"))}</div>
              </div>
            );
          })}
        </div>
      );
    }
    case "slots": {
      const items = asList(b.items);
      return (
        <div style={{ ...box, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, alignContent: "start" }}>
          {items.map((s, i) => {
            const pick = i === b.active ? ramp(t, 22, 10, "back") : 0;
            return (
              <div key={i} style={{ height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: pick > 0.5 ? 700 : 550, color: pick > 0.5 ? (onAccent(p) ? p.onBrand : "#fff") : p.ink, background: pick > 0.5 ? p.brand : p.track, border: `2px solid ${pick > 0.5 ? p.brand : "transparent"}`, opacity: ramp(t, 2 + i * 2, 8), transform: `scale(${1 + pick * 0.04})` }}>{s}</div>
            );
          })}
        </div>
      );
    }
    case "log": {
      const lines = asList(b.lines);
      return (
        <div style={{ ...box, borderRadius: 14, background: "#0F1220", padding: "12px 16px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 16, lineHeight: "30px", overflow: "hidden" }}>
          {lines.map((l, i) => {
            const k = t - 4 - i * 9;
            if (k < 0) return null;
            const bad = /^(✗|!|error|fail)/i.test(l);
            const done = k > 8;
            return (
              <div key={i} style={{ whiteSpace: "pre", color: bad ? "#FF7A85" : done ? "#E6E6F0" : "#8B90A8" }}>
                <span style={{ color: bad ? "#FF7A85" : done ? "#5EE6A8" : "#8BE9FD" }}>{bad ? "✗ " : done ? "✓ " : "› "}</span>
                {l.replace(/^(✗|!)\s*/, "").slice(0, Math.floor(k * 3))}
              </div>
            );
          })}
        </div>
      );
    }
    case "signature": {
      const k = ramp(t, 8, 30, "inOut");
      return (
        <div style={{ ...box, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 50, color: p.ink, lineHeight: 1, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)`, whiteSpace: "nowrap", paddingBottom: 8 }}>{b.name}</div>
          <div style={{ height: 2, background: p.line }} />
          <div style={{ fontSize: 14, color: p.sub, marginTop: 6 }}>Signed electronically</div>
        </div>
      );
    }
    case "meter": {
      const k = ramp(t, 4, 34, "inOut");
      const r = 84;
      return (
        <div style={{ ...box, display: "flex", alignItems: "flex-end", gap: 20 }}>
          <svg width={2 * r + 20} height={r + 20} viewBox={`0 0 ${2 * r + 20} ${r + 20}`}>
            <path d={`M10 ${r + 10} A${r} ${r} 0 0 1 ${2 * r + 10} ${r + 10}`} fill="none" stroke={p.track} strokeWidth={16} strokeLinecap="round" />
            <path d={`M10 ${r + 10} A${r} ${r} 0 0 1 ${2 * r + 10} ${r + 10}`} fill="none" stroke={p.brand} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={`${(b.value / 100) * k} 1`} />
            <text x={r + 10} y={r + 2} textAnchor="middle" fontSize={32} fontWeight={750} fill={p.ink}>{Math.round(b.value * k)}</text>
          </svg>
          {b.label && <div style={{ fontSize: 19, color: p.sub, fontWeight: 550, paddingBottom: 14 }}>{b.label}</div>}
        </div>
      );
    }
    case "avatars": {
      const shown = Math.min(5, b.n);
      return (
        <div style={{ ...box, display: "flex", alignItems: "center" }}>
          {Array.from({ length: shown }, (_, i) => (
            <div key={i} style={{ width: 48, height: 48, borderRadius: 24, marginLeft: i ? -14 : 0, border: `3px solid ${p.bg.startsWith("rgba") || p.bg.startsWith("linear") ? "#fff" : p.bg}`, background: `linear-gradient(145deg, hsl(${(i * 67 + 190) % 360} 70% 62%), hsl(${(i * 67 + 230) % 360} 70% 52%))`, transform: `scale(${ramp(t, 3 + i * 3, 10, "back")})` }} />
          ))}
          {b.n > shown && <span style={{ marginLeft: 12, fontSize: 18, fontWeight: 700, color: p.ink }}>+{b.n - shown}</span>}
          {b.label && <span style={{ marginLeft: 12, fontSize: 18, color: p.sub }}>{b.label}</span>}
        </div>
      );
    }
    case "timeline": {
      const items = asList(b.items);
      return (
        <div style={box}>
          <div style={{ position: "absolute", left: 11, top: 14, bottom: 14, width: 2, background: p.track }} />
          {items.map((s, i) => {
            const k = ramp(t, 4 + i * 7, 10, "out");
            const [text, when] = s.split(/\s*·\s*/);
            return (
              <div key={i} style={{ height: 52, display: "flex", alignItems: "center", gap: 16, opacity: k, transform: `translateX(${(1 - k) * 18}px)` }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: i === items.length - 1 ? p.brand : p.bg.startsWith("#") ? p.bg : "#fff", border: `4px solid ${p.brand}`, boxSizing: "border-box", position: "relative", zIndex: 1 }} />
                <span style={{ fontSize: 18, fontWeight: 600, color: p.ink, whiteSpace: "nowrap" }}>{text}</span>
                {when && <span style={{ marginLeft: "auto", fontSize: 16, color: p.sub }}>{when}</span>}
              </div>
            );
          })}
        </div>
      );
    }
  }
}
