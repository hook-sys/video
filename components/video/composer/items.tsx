import type { ReactNode } from "react";
import { Img } from "remotion";
import { Icon } from "../icons";
import { CARD_W, Card, cardHeight } from "./cards";
export { baseSize } from "./sizes";
import { LivingIcon, lottieFor } from "./lottie";
import { Radial, Tiles } from "./radial";
import { makePolygon, makeSpark, makeStar } from "@remotion/shapes";
import { noise2D } from "@remotion/noise";
import { Connector, drawn, smoothPath } from "./paths";
import { type Ctx, Glyph, Initial, Mark, Tick, countUp, kIn, show, surf } from "./kit";
import { clamp01, mix } from "./motion";
import type { PlacedItem } from "./types";

// The Composer's things (besides cards): each is drawn at its own natural
// size and scaled into the box the layout gives it.


type P = { c: Ctx; it: PlacedItem; w: number; h: number };

export function ItemBody(p: P): ReactNode {
  switch (p.it.kind) {
    case "card": return <Card {...p} />;
    case "icon": return <IconThing {...p} />;
    case "chips": return <Chips {...p} />;
    case "stat": return <Stat {...p} />;
    case "chart": return <Chart {...p} />;
    case "device": return <Device {...p} />;
    case "screenshot": return <Device {...p} it={{ ...p.it, variant: "browser" }} shot />;
    case "logo": return <Logo {...p} />;
    case "button": return <Button {...p} />;
    case "compare": return <Compare {...p} />;
    case "flow": return <Flow {...p} />;
    case "steps": return <Steps {...p} />;
    case "avatars": return <Avatars {...p} />;
    case "badge": return <Badge {...p} />;
    case "quote": return <Quote {...p} />;
    case "shape": return <Shape {...p} />;
    case "cursor": return <Cursor {...p} />;
    default: return null;
  }
}

const hitK = (c: Ctx, it: PlacedItem, dur = 14) => (it.hit == null ? 0 : kIn(c, it.hit, dur));
const stepAt = (c: Ctx, it: PlacedItem, i: number, n: number) => {
  const start = it.at + Math.round(c.m.dur * 0.5);
  const end = it.hit != null && it.hit > start + 6 ? it.hit : start + n * c.m.stagger * 3;
  return Math.round(start + (n <= 1 ? 0 : ((end - start) * i) / n));
};
const label = (c: Ctx, size: number, color = c.pal.ink) => ({ fontFamily: c.text, fontSize: size, fontWeight: 650, color, letterSpacing: "-0.01em" }) as const;

function IconThing({ c, it, w }: P) {
  const hk = hitK(c, it, 20);
  const s = it.title ? 200 : 220;
  const living = lottieFor(it.icon);
  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{ position: "relative", transform: `scale(${1 + Math.sin(clamp01(hk) * Math.PI) * 0.12})` }}>
        {hk > 0 && hk < 1 && <div style={{ position: "absolute", inset: -40 * hk, borderRadius: 9999, border: `3px solid ${c.pal.accent}`, opacity: 1 - hk }} />}
        {living ? (
          <div style={{ width: s, height: s, ...surf(c, 0.8, Math.min(s * 0.3, c.art.radius * 0.7 + 10)), borderRadius: c.art.icons === "round" ? 9999 : Math.min(s * 0.3, c.art.radius * 0.7 + 10), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LivingIcon c={c} name={living} size={s * 0.92} at={it.at} />
          </div>
        ) : (
          <Glyph c={c} name={it.icon} size={s} k={kIn(c, it.at, 30)} />
        )}
      </div>
      {it.title && <div style={{ ...label(c, 34), textAlign: "center", whiteSpace: "nowrap" }}>{it.title}</div>}
    </div>
  );
}

function Chips({ c, it, w }: P) {
  const rows = (it.rows?.length ? it.rows : [{ title: it.title ?? "Fast", icon: it.icon }]).slice(0, 6);
  const row = it.variant === "row";
  const hk = hitK(c, it);
  return (
    <div style={{ width: w, display: "flex", flexDirection: row ? "row" : "column", gap: 16, justifyContent: "center" }}>
      {rows.map((r, i) => {
        const k = kIn(c, stepAt(c, it, i, rows.length));
        return (
          <div key={i} style={{ ...show(k, row ? 0 : 20), transform: `translateX(${(1 - k) * (row ? 0 : -40)}px) translateY(${row ? (1 - k) * 30 : 0}px)`, ...surf(c, 0.6, Math.max(14, c.art.radius)), display: "flex", alignItems: "center", gap: 18, height: row ? 110 : 96, padding: "0 26px", boxSizing: "border-box", flex: row ? 1 : undefined }}>
            <Glyph c={c} name={r.icon ?? it.icon} size={56} tone={i % 2 ? "fill2" : "accent"} />
            <div style={{ ...label(c, 28, c.pal.panelInk), flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
            {it.hit != null && <Tick c={c} size={34} k={hk} />}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ c, it, w, h }: P) {
  const v = it.value ?? "3x";
  const k = kIn(c, it.at + 2, it.hit != null ? Math.max(12, it.hit - it.at) : 36);
  const up = !/^-|less|down|fewer/i.test(`${it.icon ?? ""} ${it.sub ?? ""}`);
  return (
    <div style={{ width: w, height: h, ...surf(c, 1, Math.max(c.art.radius, 18)), display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 44px", boxSizing: "border-box", fontFamily: c.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Glyph c={c} name={it.icon ?? (up ? "trending-up" : "trending-down")} size={48} tone="panel" />
        <div style={{ fontSize: 26, fontWeight: 650, color: c.pal.panelSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title ?? ""}</div>
      </div>
      <div style={{ fontFamily: c.display, fontSize: 132, fontWeight: 800, letterSpacing: "-0.05em", color: c.pal.panelInk, lineHeight: 1.05, marginTop: 6, background: `linear-gradient(120deg, ${c.pal.panelInk} 30%, ${c.pal.fill})`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{countUp(v, k)}</div>
      {it.sub && <div style={{ fontSize: 24, color: c.pal.panelSub, fontWeight: 550 }}>{it.sub}</div>}
    </div>
  );
}

function Chart({ c, it, w, h }: P) {
  const vals = (it.values?.length ? it.values : [3, 4, 3.5, 5, 6, 7.5, 9]).slice(0, 12).map((x) => Math.max(0, x));
  const max = Math.max(...vals, 1);
  const draw = kIn(c, it.at + 4, it.hit != null ? Math.max(16, it.hit - it.at) : 40);
  const v = it.variant ?? "bars";
  const { pal } = c;
  const head = (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "26px 32px 0" }}>
      <div style={{ fontSize: 24, fontWeight: 650, color: pal.panelSub }}>{it.title ?? ""}</div>
      {it.value && <div style={{ fontFamily: c.display, fontSize: 44, fontWeight: 800, color: pal.panelInk, letterSpacing: "-0.03em" }}>{countUp(it.value, draw)}</div>}
    </div>
  );
  if (v === "ring" || v === "donut" || v === "progress") {
    const pct = Math.min(1, (it.values?.[0] ?? 72) / (it.values?.[0] && it.values[0] <= 1 ? 1 : 100));
    if (v === "progress")
      return (
        <div style={{ width: w, height: h, ...surf(c), fontFamily: c.text, boxSizing: "border-box" }}>
          {head}
          <div style={{ padding: "40px 32px" }}>
            {vals.slice(0, 4).map((x, i) => (
              <div key={i} style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: pal.panelSub, fontWeight: 600, marginBottom: 8 }}><span>{it.rows?.[i]?.title ?? ""}</span><span>{Math.round((x / max) * 100 * draw)}%</span></div>
                <div style={{ height: 18, borderRadius: 99, background: pal.panelSoft }}><div style={{ height: "100%", width: `${(x / max) * 100 * clamp01(draw * 1.2 - i * 0.1)}%`, borderRadius: 99, background: `linear-gradient(90deg, ${pal.fill}, ${pal.fill2})` }} /></div>
              </div>
            ))}
          </div>
        </div>
      );
    const R = 190, sw = v === "ring" ? 34 : 70;
    const segs = v === "donut" ? vals.slice(0, 4) : [pct, 1 - pct];
    const tot = segs.reduce((a, b) => a + b, 0) || 1;
    const starts = segs.map((_, i) => segs.slice(0, i).reduce((a, b) => a + (b / tot) * draw, 0));
    return (
      <div style={{ width: w, height: h, ...surf(c, 1, 9999), display: "flex", alignItems: "center", justifyContent: "center", position: "relative", fontFamily: c.text, borderRadius: 9999 }}>
        <svg width={460} height={460} viewBox="-230 -230 460 460" style={{ transform: "rotate(-90deg)" }}>
          <circle r={R} fill="none" stroke={pal.panelSoft} strokeWidth={sw} />
          {segs.map((s, i) => {
            if (v === "ring" && i > 0) return null;
            const part = (s / tot) * draw;
            const el = <circle key={i} r={R} fill="none" stroke={[pal.fill, pal.fill2, pal.accent3, pal.faint][i % 4]} strokeWidth={sw} strokeLinecap={v === "ring" ? "round" : "butt"} pathLength={1} strokeDasharray={`${Math.max(0, part - 0.004)} 1`} strokeDashoffset={-starts[i]} />;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontFamily: c.display, fontSize: 92, fontWeight: 800, color: pal.panelInk, letterSpacing: "-0.04em" }}>{it.value ? countUp(it.value, draw) : `${Math.round(pct * 100 * draw)}%`}</div>
          {it.title && <div style={{ fontSize: 24, color: pal.panelSub, fontWeight: 600 }}>{it.title}</div>}
        </div>
      </div>
    );
  }
  const cw = w - 64, ch = h - 150;
  const pts = vals.map((x, i) => [(i / Math.max(1, vals.length - 1)) * cw, ch - (x / max) * ch * 0.92] as const);
  // the line is a smooth curve that draws itself; the area fills in behind it
  const line = smoothPath(pts);
  const ink = drawn(line, draw);
  return (
    <div style={{ width: w, height: h, ...surf(c), fontFamily: c.text, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
      {head}
      <div style={{ position: "absolute", left: 32, bottom: 30, width: cw, height: ch }}>
        {[0.25, 0.5, 0.75].map((g) => <div key={g} style={{ position: "absolute", left: 0, right: 0, top: ch * g, height: 1.5, background: pal.panelLine }} />)}
        {v === "bars" || v === "columns" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 14 }}>
            {vals.map((x, i) => {
              const g = clamp01(draw * 1.4 - (i / vals.length) * 0.4);
              const last = i === vals.length - 1;
              return <div key={i} style={{ flex: 1, height: `${(x / max) * 92 * g}%`, borderRadius: `${Math.min(14, c.art.radius * 0.5)}px ${Math.min(14, c.art.radius * 0.5)}px 4px 4px`, background: last ? `linear-gradient(180deg, ${pal.fill2}, ${pal.fill})` : v === "columns" ? pal.panelLine : `${pal.fill}${i % 2 ? "88" : "55"}` }} />;
            })}
          </div>
        ) : (
          <svg width={cw} height={ch} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <defs>
              <linearGradient id={`cg${it.at}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={pal.fill} stopOpacity={0.35} /><stop offset="1" stopColor={pal.fill} stopOpacity={0} /></linearGradient>
              <clipPath id={`cc${it.at}`}><rect x={-10} y={-20} width={ink.head ? ink.head.x + 10 : 0} height={ch + 40} /></clipPath>
            </defs>
            {v !== "spark" && (
              <g clipPath={`url(#cc${it.at})`}>
                <path d={`${line} L${cw},${ch} L0,${ch} Z`} fill={`url(#cg${it.at})`} />
              </g>
            )}
            <path d={line} stroke={pal.fill} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ink.strokeDasharray} strokeDashoffset={ink.strokeDashoffset} />
            {draw > 0.05 && ink.head && <circle cx={ink.head.x} cy={ink.head.y} r={11} fill={pal.panel} stroke={pal.fill} strokeWidth={5} />}
          </svg>
        )}
      </div>
    </div>
  );
}

function Device({ c, it, w, h, shot }: P & { shot?: boolean }) {
  const v = it.variant ?? "phone";
  const { pal } = c;
  const src = shot ? c.screens[Math.abs(it.at) % Math.max(1, c.screens.length)] : undefined;
  const screen = (sw: number, sh: number) => {
    if (src) return <Img src={src} style={{ width: sw, height: sh, objectFit: "cover", objectPosition: "top" }} />;
    const variant = it.screen ?? "list";
    const small = v === "phone" || v === "watch";
    // a phone shows the app: its status bar, the screen, its tab bar
    const top = small ? (v === "watch" ? 0 : 54) : 0;
    const bottom = v === "phone" ? 92 : 0;
    const scale = Math.min(1.2, sw / CARD_W);
    const inner = (sh - top - bottom) / scale;
    return (
      <div style={{ width: sw, height: sh, background: pal.panel, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: c.text }}>
        {top > 0 && (
          <div style={{ height: top, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 34px 8px", fontSize: 20, fontWeight: 700, color: pal.panelInk, boxSizing: "border-box" }}>
            <span>9:41</span>
            <span style={{ display: "flex", gap: 6 }}><Icon name="signal" size={20} color={pal.panelInk} /><Icon name="wifi" size={20} color={pal.panelInk} /><Icon name="battery-full" size={22} color={pal.panelInk} /></span>
          </div>
        )}
        <div style={{ height: sh - top - bottom, overflow: "hidden" }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "0% 0%", width: CARD_W }}>
            <Card c={{ ...c, art: { ...c.art, surface: "solid", radius: 0 } }} it={{ ...it, kind: "card", variant }} w={CARD_W} h={Math.max(inner, cardHeight(variant, it.rows?.length ?? 3))} />
          </div>
        </div>
        {bottom > 0 && (
          <div style={{ height: bottom, borderTop: `1.5px solid ${pal.panelLine}`, display: "flex", alignItems: "center", justifyContent: "space-around", paddingBottom: 14, boxSizing: "border-box" }}>
            {["house", it.icon ?? "layout-grid", "bell", "settings"].map((ic, i) => <Icon key={i} name={ic} size={32} color={i === 1 ? pal.fill : pal.panelSub} />)}
          </div>
        )}
      </div>
    );
  };
  const frame = pal.dark ? "#1b1d24" : "#16171d";
  if (v === "browser" || v === "laptop" || v === "tablet") {
    const bar = v === "browser" ? 56 : 0;
    const bezel = v === "browser" ? 0 : 22;
    const sw = w - bezel * 2, sh = h - bar - bezel * 2 - (v === "laptop" ? 50 : 0);
    return (
      <div style={{ width: w, height: h, position: "relative" }}>
        <div style={{ width: w, height: v === "laptop" ? h - 50 : h, borderRadius: v === "tablet" ? 44 : 22, background: v === "browser" ? pal.panel : frame, padding: bezel, boxSizing: "border-box", boxShadow: `0 50px 120px ${pal.shadow}`, overflow: "hidden", border: v === "browser" ? `1.5px solid ${pal.panelLine}` : undefined }}>
          {bar > 0 && (
            <div style={{ height: bar, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1.5px solid ${pal.panelLine}`, background: pal.panelSoft }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((col) => <div key={col} style={{ width: 14, height: 14, borderRadius: 9, background: col }} />)}
              <div style={{ marginLeft: 20, flex: 1, height: 32, borderRadius: 9, background: pal.panel, display: "flex", alignItems: "center", padding: "0 16px", fontSize: 18, color: pal.panelSub, fontFamily: c.text }}>{c.brand.url || `${c.brand.name.toLowerCase().replace(/\s+/g, "")}.com`}</div>
            </div>
          )}
          <div style={{ borderRadius: v === "tablet" ? 24 : v === "laptop" ? 8 : 0, overflow: "hidden" }}>{screen(sw, sh)}</div>
        </div>
        {v === "laptop" && <div style={{ position: "absolute", left: -60, right: -60, bottom: 0, height: 50, borderRadius: "0 0 30px 30px", background: `linear-gradient(180deg, #2a2c34, #0e0f13)` }} />}
      </div>
    );
  }
  const r = v === "watch" ? 70 : 64;
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: frame, padding: v === "watch" ? 22 : 16, boxSizing: "border-box", border: "2px solid #3a3d48", boxShadow: `0 50px 120px ${pal.shadow}` }}>
      <div style={{ width: "100%", height: "100%", borderRadius: r - 14, overflow: "hidden", position: "relative" }}>
        {screen(w - (v === "watch" ? 44 : 32), h - (v === "watch" ? 44 : 32))}
        {v === "phone" && <div style={{ position: "absolute", top: 14, left: "50%", marginLeft: -60, width: 120, height: 34, borderRadius: 20, background: "#000" }} />}
      </div>
    </div>
  );
}

function Logo({ c, it, w, h }: P) {
  const k = kIn(c, it.at, 30);
  const name = it.title ?? c.brand.name;
  const wipe = clamp01(k * 1.5 - 0.4);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <Mark c={c} size={170} k={k} />
        <div style={{ fontFamily: c.display, fontSize: 150, fontWeight: Math.max(650, c.art.weight), letterSpacing: "-0.045em", color: c.pal.ink, clipPath: `inset(-20% ${(1 - wipe) * 100}% -20% 0)`, whiteSpace: "nowrap" }}>{name}</div>
      </div>
      {it.sub && <div style={{ ...label(c, 40, c.pal.sub), ...show(kIn(c, it.at + 18), 16), textAlign: "center" }}>{it.sub}</div>}
    </div>
  );
}

function Button({ c, it, w }: P) {
  const hk = it.hit != null ? it.hit : it.at + 30;
  const press = clamp01(kIn(c, hk - 3, 4) - kIn(c, hk + 3, 8));
  const pressed = c.f >= hk;
  const travel = kIn(c, hk - 26, 24);
  const glow = pressed ? clamp01(1 - (c.f - hk) / 30) : 0;
  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, position: "relative" }}>
      <div style={{ position: "relative", transform: `scale(${1 - press * 0.06})` }}>
        {glow > 0 && <div style={{ position: "absolute", inset: -30 * (1 - glow), borderRadius: 999, border: `3px solid ${c.pal.accent}`, opacity: glow }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "0 56px", height: 120, borderRadius: Math.max(20, Math.min(999, c.art.radius * 3)), background: `linear-gradient(140deg, ${c.pal.fill}, ${c.pal.fill2})`, color: c.pal.onFill, fontFamily: c.display, fontSize: 50, fontWeight: 750, letterSpacing: "-0.02em", boxShadow: `0 30px 70px ${c.pal.fill}66`, whiteSpace: "nowrap" }}>
          {it.title ?? c.brand.cta}
          <Icon name="arrow-right" size={46} color={c.pal.onFill} strokeWidth={2.6} />
        </div>
        <div style={{ position: "absolute", left: mix(w * 0.8, w * 0.55, travel), top: mix(170, 70, travel), opacity: clamp01(kIn(c, hk - 30, 8)) * (1 - kIn(c, hk + 24, 10)), transform: `scale(${1 - press * 0.15})` }}>
          <svg width={54} height={54} viewBox="0 0 24 24"><path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill={c.pal.dark ? "#fff" : "#111"} stroke={c.pal.dark ? "#111" : "#fff"} strokeWidth={1.4} strokeLinejoin="round" /></svg>
        </div>
      </div>
      {it.sub && <div style={{ ...label(c, 34, c.pal.sub), ...show(kIn(c, it.at + 10)) }}>{it.sub}</div>}
    </div>
  );
}

function Compare({ c, it, w, h }: P) {
  const rows = (it.rows?.length ? it.rows : [{ title: "Manual work", meta: "Automatic", icon: null, tag: null }]).slice(0, 4);
  const hk = it.hit != null ? it.hit : it.at + 30;
  const { pal } = c;
  return (
    <div style={{ width: w, height: h, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, fontFamily: c.text }}>
      {[0, 1].map((side) => (
        <div key={side} style={{ ...surf(c, side ? 1 : 0.5), padding: "26px 28px", opacity: side ? clamp01(kIn(c, hk - 6) * 1.4) : 1, transform: side ? `translateX(${(1 - kIn(c, hk - 6)) * 40}px)` : undefined, ...(side ? {} : { background: pal.panelSoft }), boxSizing: "border-box" }}>
          <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: "0.1em", color: side ? pal.fill : pal.panelSub, marginBottom: 12 }}>{side ? (it.sub ?? "NOW").toUpperCase() : (it.title ?? "BEFORE").toUpperCase()}</div>
          {rows.map((r, i) => {
            const k = kIn(c, stepAt(c, { ...it, hit: side ? null : hk - 8 } as PlacedItem, i, rows.length) + (side ? hk - it.at : 0));
            const strike = side ? 0 : kIn(c, hk + i * 3, 12);
            return (
              <div key={i} style={{ ...show(k, 10), display: "flex", alignItems: "center", gap: 14, height: 86, borderTop: i ? `1.5px solid ${pal.panelLine}` : undefined }}>
                {side ? <Tick c={c} size={34} k={k} /> : <div style={{ width: 34, height: 34, borderRadius: 99, background: "rgba(225,29,72,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={20} color="#e11d48" strokeWidth={3} /></div>}
                <div style={{ position: "relative", fontSize: 26, fontWeight: 600, color: side ? pal.panelInk : pal.panelSub }}>
                  {side ? (r.meta ?? r.title) : r.title}
                  {!side && <div style={{ position: "absolute", left: 0, top: "52%", height: 3, width: `${strike * 100}%`, background: "#e11d48", borderRadius: 2 }} />}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Flow({ c, it, w, h }: P) {
  const rows = (it.rows?.length ? it.rows : [{ title: "Input", icon: "inbox" }, { title: "Process", icon: "cog" }, { title: "Done", icon: "check" }]).slice(0, it.variant === "hub" || it.variant === "ring" ? 6 : 5);
  const v = it.variant ?? "chain";
  const { pal } = c;
  const node = (r: { title: string; icon?: string | null }, i: number, k: number, size = 120) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: 250, opacity: clamp01(k * 1.6), transform: `scale(${mix(0.7, 1, k)})` }}>
      <div style={{ padding: 20, ...surf(c, 0.7, Math.max(20, c.art.radius)), borderRadius: c.art.icons === "round" ? 9999 : Math.max(20, c.art.radius) }}>
        <Glyph c={c} name={r.icon} size={size} tone={i % 2 ? "fill2" : "accent"} />
      </div>
      <div style={{ ...label(c, 28), textAlign: "center", width: 250, lineHeight: 1.15, maxHeight: 66, overflow: "hidden" }}>{r.title}</div>
    </div>
  );
  if (v === "chain") {
    const gap = 80;
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "flex-start", gap, position: "relative" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {rows.slice(0, -1).map((_, i) => {
            const x0 = i * (250 + gap) + 125 + 92, x1 = (i + 1) * (250 + gap) + 125 - 92;
            const link = kIn(c, stepAt(c, it, i, rows.length) + 4, 18);
            return <Connector key={i} d={`M${x0},80 Q${(x0 + x1) / 2},${i % 2 ? 118 : 42} ${x1},80`} k={link} f={c.f} color={pal.accent} seed={i} />;
          })}
        </svg>
        {rows.map((r, i) => (
          <div key={i} style={{ position: "relative" }}>{node(r, i, kIn(c, stepAt(c, it, i, rows.length)))}</div>
        ))}
      </div>
    );
  }
  // hub / ring / fan / merge: things around a centre (the brand)
  const cx = w / 2, cy = h / 2;
  const n = rows.length;
  const pos = rows.map((_, i) => {
    if (v === "fan") return [w * 0.82, (h / (n + 1)) * (i + 1)];
    if (v === "merge") return [w * 0.14, (h / (n + 1)) * (i + 1)];
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * w * 0.36, cy + Math.sin(a) * h * 0.36];
  });
  const centre = v === "fan" ? [w * 0.14, cy] : v === "merge" ? [w * 0.86, cy] : [cx, cy];
  const ck = kIn(c, it.at, 24);
  if (v === "fan" || v === "merge") {
    // the brand on one side; each thing a card on the other, joined by a curve
    const side = v === "fan" ? 1 : -1;
    return (
      <div style={{ width: w, height: h, position: "relative" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {pos.map(([, y], i) => {
            const k = kIn(c, stepAt(c, it, i, n) - 2, 18);
            const x0 = centre[0] + side * 90, x1 = v === "fan" ? w * 0.46 : w * 0.54;
            const d = v === "fan" ? `M${x0},${centre[1]} C${(x0 + x1) / 2},${centre[1]} ${(x0 + x1) / 2},${y} ${x1},${y}` : `M${x1},${y} C${(x0 + x1) / 2},${y} ${(x0 + x1) / 2},${centre[1]} ${x0},${centre[1]}`;
            return <Connector key={i} d={d} k={k} f={c.f} color={pal.accent} seed={i} />;
          })}
        </svg>
        <div style={{ position: "absolute", left: centre[0], top: centre[1], transform: "translate(-50%,-50%)" }}><Mark c={c} size={170} k={ck} /></div>
        {pos.map(([, y], i) => {
          const k = kIn(c, stepAt(c, it, i, n));
          return (
            <div key={i} style={{ position: "absolute", top: y, left: v === "fan" ? w * 0.46 : undefined, right: v === "merge" ? w * 0.46 : undefined, transform: `translateY(-50%) translateX(${(1 - k) * 40 * side}px)`, opacity: clamp01(k * 1.6), ...surf(c, 0.6, Math.max(16, c.art.radius)), display: "flex", alignItems: "center", gap: 18, height: Math.min(120, h / (n + 0.6)), padding: "0 30px 0 18px", boxSizing: "border-box", width: w * 0.54 }}>
              <Glyph c={c} name={rows[i].icon} size={70} tone={i % 2 ? "fill2" : "accent"} />
              <div style={{ ...label(c, 32, c.pal.panelInk), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rows[i].title}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ width: w, height: h, position: "relative" }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        {pos.map(([x, y], i) => {
          const k = kIn(c, stepAt(c, it, i, n) + 2, 18);
          return <Connector key={i} d={`M${x},${y} L${centre[0]},${centre[1]}`} k={k} f={c.f} color={pal.accent} dash={v === "ring"} seed={i} />;
        })}
        {v === "ring" && <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.36} fill="none" stroke={pal.faint} strokeWidth={2} opacity={ck * 0.5} />}
      </svg>
      <div style={{ position: "absolute", left: centre[0], top: centre[1], transform: "translate(-50%,-50%)" }}><Mark c={c} size={150} k={ck} /></div>
      {pos.map(([x, y], i) => (
        <div key={i} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -38%)" }}>{node(rows[i], i, kIn(c, stepAt(c, it, i, n)), 80)}</div>
      ))}
    </div>
  );
}

function Steps({ c, it, w, h }: P) {
  const rows = (it.rows?.length ? it.rows : [{ title: "Connect" }, { title: "Talk" }, { title: "Done" }]).slice(0, 4);
  return (
    <div style={{ width: w, height: h, display: "flex", gap: 30 }}>
      {rows.map((r, i) => {
        const at = stepAt(c, it, i, rows.length);
        const k = kIn(c, at);
        const lit = it.hit != null ? (c.f >= stepAt(c, it, i, rows.length) + 8 ? 1 : 0) : 1;
        return (
          <div key={i} style={{ ...show(k, 30), flex: 1, ...surf(c, 0.8), padding: 28, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16, outline: lit && i === rows.length - 1 ? `3px solid ${c.pal.fill}` : undefined }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: c.display, fontSize: 64, fontWeight: 800, color: c.pal.fill, letterSpacing: "-0.04em" }}>{String(i + 1).padStart(2, "0")}</div>
              <Glyph c={c} name={r.icon} size={58} tone="panel" />
            </div>
            <div style={{ fontFamily: c.text, fontSize: 30, fontWeight: 700, color: c.pal.panelInk, lineHeight: 1.15 }}>{r.title}</div>
            {r.meta && <div style={{ fontFamily: c.text, fontSize: 21, color: c.pal.panelSub }}>{r.meta}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Avatars({ c, it, w }: P) {
  const rows = (it.rows?.length ? it.rows : [{ title: "A" }, { title: "M" }, { title: "S" }, { title: "J" }]).slice(0, 5);
  return (
    <div style={{ width: w, display: "flex", alignItems: "center", gap: 26, ...surf(c, 0.6, 999), padding: "20px 34px", boxSizing: "border-box" }}>
      <div style={{ display: "flex" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ marginLeft: i ? -22 : 0, ...show(kIn(c, it.at + i * c.m.stagger), 0), transform: `scale(${mix(0.4, 1, kIn(c, it.at + i * c.m.stagger))})` }}>
            <Initial c={c} letter={r.title} size={90} hue={i} />
          </div>
        ))}
      </div>
      <div style={{ ...label(c, 30, c.pal.panelInk), whiteSpace: "nowrap" }}>{it.title ?? ""}</div>
    </div>
  );
}

function Badge({ c, it, w }: P) {
  const hk = hitK(c, it, 16);
  return (
    <div style={{ width: w, height: 96, display: "flex", alignItems: "center", gap: 14, padding: "0 26px 0 14px", boxSizing: "border-box", ...surf(c, 0.7, 999), transform: `scale(${1 + Math.sin(hk * Math.PI) * 0.1})` }}>
      {lottieFor(it.icon) ? <LivingIcon c={c} name={lottieFor(it.icon)!} size={76} at={it.at} /> : <Glyph c={c} name={it.icon ?? "sparkles"} size={68} />}
      <div style={{ fontFamily: c.text, fontSize: 30, fontWeight: 750, color: c.pal.panelInk, whiteSpace: "nowrap" }}>{it.value ? countUp(it.value, kIn(c, it.at, 26)) : ""}{it.value && it.title ? " " : ""}<span style={{ fontWeight: it.value ? 550 : 750, color: it.value ? c.pal.panelSub : c.pal.panelInk }}>{it.title ?? ""}</span></div>
    </div>
  );
}

function Quote({ c, it, w, h }: P) {
  return (
    <div style={{ width: w, height: h, ...surf(c), padding: 40, boxSizing: "border-box", fontFamily: c.text, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2, 3, 4].map((s) => <Icon key={s} name="star" size={34} color="#f5b301" fill="#f5b301" draw={clamp01(kIn(c, it.at + 4 + s * 3, 10))} />)}</div>
      <div style={{ fontSize: 36, fontWeight: 600, color: c.pal.panelInk, lineHeight: 1.3, letterSpacing: "-0.01em" }}>“{it.title ?? ""}”</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Initial c={c} letter={it.sub ?? "A"} size={60} />
        <div style={{ fontSize: 24, fontWeight: 650, color: c.pal.panelSub }}>{it.sub ?? ""}</div>
      </div>
    </div>
  );
}

function Shape({ c, it, w, h }: P) {
  const v = it.variant ?? "ring";
  const { pal, f } = c;
  if (v === "orb")
    return (
      <div style={{ width: w, height: h, borderRadius: 9999, boxShadow: `0 40px 120px ${pal.fill}66`, transform: `translateY(${Math.sin(f / 30) * 10}px)` }}>
        <Radial w={w} h={h} at={[0.35, 0.3]} circle round stops={[[0, pal.glow], [0.45, pal.fill], [1, pal.fill2]]} />
      </div>
    );
  if (v === "grid")
    return (
      <div style={{ position: "relative", width: w, height: h, opacity: 0.5 }}>
        <Tiles w={w} h={h} kind="dots" gap={36} size={3.2} color={pal.accent} />
      </div>
    );
  if (v === "plus") return <Icon name="plus" size={w} color={pal.accent} strokeWidth={1.5} />;
  // Remotion's shapes: drawn on (outline first), then filled; a spark twinkles,
  // a burst turns slowly, a star and a hex settle with a little spin
  if (v === "spark" || v === "star" || v === "burst" || v === "hex") {
    const s = Math.min(w, h);
    const shape =
      v === "spark" ? makeSpark({ width: s * 0.8, height: s * 0.8, edgeRoundness: 0.9 }) :
      v === "star" ? makeStar({ points: 5, innerRadius: s * 0.2, outerRadius: s * 0.42, cornerRadius: s * 0.04 }) :
      v === "burst" ? makeStar({ points: 14, innerRadius: s * 0.33, outerRadius: s * 0.44, cornerRadius: s * 0.01 }) :
      makePolygon({ points: 6, radius: s * 0.42, cornerRadius: s * 0.06 });
    const draw = kIn(c, it.at, 26);
    const fill = kIn(c, it.at + 14, 16);
    const turn = v === "burst" ? f * 0.4 : v === "spark" ? 0 : (1 - draw) * -40;
    const twinkle = v === "spark" ? 1 + noise2D(`spark${it.id ?? ""}`, f / 25, 0) * 0.12 : 1;
    return (
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        <g transform={`translate(${w / 2} ${h / 2}) rotate(${turn}) scale(${twinkle}) translate(${-shape.width / 2} ${-shape.height / 2})`}>
          <path d={shape.path} fill={v === "burst" ? pal.fill2 : pal.accent} fillOpacity={fill * (v === "hex" ? 0.22 : 0.95)} stroke={pal.accent} strokeWidth={Math.max(3, s * 0.02)} strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`} />
        </g>
      </svg>
    );
  }
  if (v === "arrow") return <Icon name="arrow-up-right" size={w} color={pal.accent} strokeWidth={1.6} draw={kIn(c, it.at, 24)} />;
  if (v === "line" || v === "wave")
    return (
      <svg width={w} height={h}>
        <path d={v === "wave" ? `M0,${h / 2} C${w * 0.25},${h * 0.1} ${w * 0.25},${h * 0.9} ${w / 2},${h / 2} S${w * 0.75},${h * 0.1} ${w},${h / 2}` : `M0,${h * 0.8} L${w},${h * 0.2}`} stroke={pal.accent} strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${kIn(c, it.at, 30)} 1`} />
      </svg>
    );
  return <div style={{ width: w, height: h, borderRadius: 9999, border: `${Math.max(3, w * 0.03)}px solid ${pal.accent}`, opacity: 0.6, transform: `rotate(${f}deg)`, borderRightColor: "transparent" }} />;
}

function Cursor({ c, it }: P) {
  const at = it.hit ?? it.at + 20;
  const press = clamp01(kIn(c, at - 3, 4) - kIn(c, at + 3, 8));
  return (
    <div style={{ transform: `scale(${1 - press * 0.18})` }}>
      <svg width={90} height={90} viewBox="0 0 24 24"><path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill={c.pal.dark ? "#fff" : "#111"} stroke={c.pal.dark ? "#111" : "#fff"} strokeWidth={1.3} strokeLinejoin="round" /></svg>
    </div>
  );
}
