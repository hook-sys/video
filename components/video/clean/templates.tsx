import type { ReactNode } from "react";
import { Img } from "remotion";
import { Icon } from "../icons";
import { count, IN_OUT, mix, money, OUT, pop, rise } from "./anim";
import { Arrow, Bars, BrowserBar, Button, Cursor, IconTile, Initial, Label, LineChart, LottieAt, Panel, Stat, Toast } from "./kit";
import type { Look, Palette } from "./looks";
import { KLine, type KWord } from "./text";
import type { Brand, Scene, Variant } from "./types";

export type Ctx = { f: number; sc: Scene; look: Look; pal: Palette; v: Variant; brand: Brand };
export const W = 1920;
export const H = 1080;
const abs = (x: number, y: number, children: ReactNode, extra?: React.CSSProperties) => <div style={{ position: "absolute", left: x, top: y, ...extra }}>{children}</div>;
const words = (sc: Scene, k: string) => (sc.data[k] ?? []) as KWord[];
const str = (sc: Scene, k: string) => String(sc.data[k] ?? "");
// The UI cards follow the background: dark faces on a dark act.
const cardDark = (c: Ctx) => c.pal.dark || c.look.card === "dark";
const TEAM = [["A", "#6a5bff"], ["M", "#0fae7b"], ["J", "#ff6a2b"], ["S", "#2f9bff"]] as const;

// The product's mark: the uploaded icon, else a rounded tile in its colour.
export function Mark({ brand, size, look }: { brand: Brand; size: number; look: Look }) {
  if (brand.icon) return <Img src={brand.icon} style={{ width: size, height: size, objectFit: "contain" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, backgroundImage: `linear-gradient(135deg, ${brand.color}, ${look.accent[1]})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${size * 0.18}px ${size * 0.5}px ${brand.color}55` }}>
      <Icon name="zap" size={size * 0.56} color="#fff" strokeWidth={2.4} fill="rgba(255,255,255,0.35)" />
    </div>
  );
}

// ── 1. Hook: the opening line, the problem's keyword stands out ──────────
export function Hook(c: Ctx) {
  const { f, sc, pal, v, look } = c;
  const w = words(sc, "words");
  const ts = { ink: pal.ink, accent: look.accent, keyword: v.keyword };
  const tools = ["sheet", "mail", "message-square", "file-text", "credit-card", "calendar"];
  // the scattered tools behind the words
  const scatter = tools.map((name, i) => {
    const a = rise(f, sc.from + 6 + i * 4, 30);
    const px = [180, 1560, 300, 1480, 820, 1100][i];
    const py = [150, 170, 760, 740, 110, 820][i];
    const drift = Math.sin((f + i * 40) / 50) * 10;
    return abs(px, py + drift, <IconTile name={name} size={88} colors={look.accent} dark={pal.dark} style={{ transform: `rotate(${[-12, 9, 7, -8, 4, -5][i]}deg) scale(${0.8 + a * 0.2})` }} />, { opacity: a * 0.55 });
  });
  const keyAt = (w.find((x) => x.key) ?? w[0]).at;
  const lost = [
    <Arrow key="a1" f={f} at={keyAt + 4} from={[290, 220]} to={[560, 120]} bend={0.3} color={look.accent[1]} broken width={4} />,
    <Arrow key="a2" f={f} at={keyAt + 10} from={[1530, 830]} to={[1290, 900]} bend={-0.3} color={look.accent[1]} broken width={4} />,
  ];
  if (v.hook === "word") {
    const key = w.find((x) => x.key) ?? w[0];
    const k = rise(f, key.at, 22);
    return (
      <>
        {scatter}
        {lost}
        {abs(0, 250, <KLine words={w.map((x) => ({ ...x, key: false }))} f={f} s={{ ...ts, size: 54, weight: 600, align: "center" }} />, { width: W })}
        {abs(0, 400, (
          <div style={{ display: "flex", justifyContent: "center", fontSize: 230, fontWeight: 800, letterSpacing: "-0.05em", color: pal.ink }}>
            {key.t.split("").map((ch, i) => (
              <span key={i} style={{ display: "inline-block", opacity: k, margin: `0 ${10 + 8 * k}px`, transform: `translate(${Math.sin(i * 1.7) * 14 * k}px, ${Math.cos(i * 2.3) * 34 * k}px) rotate(${Math.sin(i * 3.1) * 12 * k}deg)`, backgroundImage: `linear-gradient(100deg, ${look.accent[0]}, ${look.accent[1]})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{ch}</span>
            ))}
          </div>
        ), { width: W })}
      </>
    );
  }
  if (v.hook === "stack") {
    const lines = [w.slice(0, 4), w.slice(4, 6), w.slice(6)];
    return (
      <>
        {scatter}
        {lost}
        {abs(170, 270, <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lines.map((l, i) => <KLine key={i} words={l} f={f} s={{ ...ts, size: 116 }} />)}</div>)}
      </>
    );
  }
  if (v.hook === "left")
    return (
      <>
        {scatter.slice(1, 4)}
        {abs(170, 330, <KLine words={w} f={f} s={{ ...ts, size: 112 }} style={{ maxWidth: 1250 }} />)}
      </>
    );
  return (
    <>
      {scatter}
      {lost}
      {abs(230, 360, <KLine words={w} f={f} s={{ ...ts, size: 120, align: "center" }} style={{ width: 1460 }} />)}
    </>
  );
}

// ── 2. Trio: three separate things, each on its word ─────────────────────
export function Trio(c: Ctx) {
  const { f, sc, pal, v, look } = c;
  const items = (sc.data.items ?? []) as { icon: string; label: string; sub: string; at: number }[];
  const tile = (it: (typeof items)[number], i: number, size: number) => {
    const k = pop(f, it.at, 18);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: Math.min(1, k * 1.4), transform: `scale(${0.6 + 0.4 * k})` }}>
        <IconTile name={it.icon} size={size} colors={[look.accent[i % 2], look.accent[(i + 1) % 2]]} dark={pal.dark} draw={rise(f, it.at + 4, 22)} solid at={it.at} f={f} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 46, fontWeight: 700, color: pal.ink, letterSpacing: "-0.03em" }}>{it.label}</div>
          <div style={{ fontSize: 28, color: pal.sub, marginTop: 6 }}>{it.sub}</div>
        </div>
      </div>
    );
  };
  if (v.trio === "stack")
    return abs(380, 210, (
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        {items.map((it, i) => {
          const k = rise(f, it.at, 18);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 40, opacity: k, transform: `translateX(${(1 - k) * -80}px)` }}>
              <IconTile name={it.icon} size={130} colors={look.accent} dark={pal.dark} draw={rise(f, it.at + 4, 22)} solid at={it.at} f={f} />
              <div style={{ fontSize: 92, fontWeight: 700, color: pal.ink, letterSpacing: "-0.04em" }}>{it.label}</div>
              <div style={{ fontSize: 50, color: pal.sub }}>{it.sub}</div>
            </div>
          );
        })}
      </div>
    ));
  if (v.trio === "scatter") {
    const pos = [[230, 190, -6], [1220, 120, 5], [760, 560, -3]] as const;
    return (
      <>
        {items.map((it, i) => abs(pos[i][0], pos[i][1], <div style={{ transform: `rotate(${pos[i][2]}deg) translateY(${Math.sin((f + i * 30) / 40) * 8}px)` }}>{tile(it, i, 170)}</div>))}
        <Arrow f={f} at={items[1]?.at ?? sc.from} from={[470, 260]} to={[1200, 210]} bend={-0.18} color={look.accent[1]} broken />
        <Arrow f={f} at={items[2]?.at ?? sc.from} from={[1290, 420]} to={[960, 600]} bend={-0.25} color={look.accent[1]} broken />
      </>
    );
  }
  if (v.trio === "orbit") {
    const turn = (f - sc.from) * 0.25;
    const ring = rise(f, sc.from, 30);
    return (
      <>
        {abs(W / 2 - 300, 470 - 300, <div style={{ width: 600, height: 600, borderRadius: 999, border: `3px dashed ${pal.sub}55`, opacity: ring, transform: `rotate(${turn}deg)` }} />)}
        {abs(W / 2 - 60, 470 - 60, <div style={{ width: 120, height: 120, borderRadius: 34, border: `3px dashed ${pal.sub}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, color: pal.sub, opacity: ring }}>?</div>)}
        {items.map((it, i) => {
          const a = ((-90 + i * 120 + turn) * Math.PI) / 180;
          return <Arrow key={`ar${i}`} f={f} at={it.at + 8} from={[W / 2 + Math.cos(a) * 225, 470 + Math.sin(a) * 225]} to={[W / 2 + Math.cos(a) * 100, 470 + Math.sin(a) * 100]} bend={0.2} color={look.accent[1]} dashed width={4} />;
        })}
        {items.map((it, i) => {
          const a = ((-90 + i * 120 + turn) * Math.PI) / 180;
          return abs(W / 2 + Math.cos(a) * 300 - 90, 470 + Math.sin(a) * 300 - 120, tile(it, i, 150));
        })}
      </>
    );
  }
  // row: three, cut off from each other
  return (
    <>
      {items.map((it, i) => abs(180 + i * 560, 300, <div style={{ width: 320, display: "flex", justifyContent: "center" }}>{tile(it, i, 180)}</div>))}
      {[0, 1].map((i) => <Arrow key={i} f={f} at={items[i + 1]?.at ?? sc.from} from={[460 + i * 560, 390]} to={[780 + i * 560, 390]} bend={0.22} color={look.accent[1]} broken />)}
    </>
  );
}

// ── 3. Logo reveal: the product's icon and name, mid-video ──────────────
export function Reveal(c: Ctx) {
  const { f, sc, pal, v, look, brand } = c;
  const at = sc.cues.name;
  const sub = words(sc, "sub");
  const name = (k: number, size = 150) => <div style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.05em", color: pal.ink, opacity: k, transform: `translateY(${(1 - k) * 40}px)`, filter: `blur(${(1 - k) * 12}px)` }}>{brand.name}</div>;
  const subLine = abs(0, 720, <KLine words={sub} f={f} s={{ ink: pal.ink, accent: ["#ffffff", "#ffffff"], keyword: "underline", size: 58, weight: 600, align: "center" }} />, { width: W });
  if (v.reveal === "converge") {
    const icons = (sc.data.icons ?? []) as string[];
    const m = rise(f, at - 6, 22, IN_OUT);
    const k = pop(f, at + 12, 20);
    return (
      <>
        {icons.map((ic, i) => {
          const sx = [-560, 0, 560][i], sy = [-80, -300, -80][i];
          return <div key={`t${i}`} style={{ opacity: 1 - rise(f, at + 14, 10) }}><Arrow f={f} at={at - 10} from={[W / 2 + sx, 440 + sy]} to={[W / 2 + sx * 0.18, 440 + sy * 0.18]} bend={0.12} color="#ffffff" width={4} dur={16} /></div>;
        })}
        {icons.map((ic, i) => {
          const sx = [-560, 0, 560][i], sy = [-80, -300, -80][i];
          return abs(W / 2 - 60 + sx * (1 - m), 380 + sy * (1 - m), <IconTile name={ic} size={120} colors={look.accent} dark={pal.dark} solid />, { opacity: 1 - rise(f, at + 10, 8) });
        })}
        {abs(W / 2 - 330, 300, <div style={{ display: "flex", alignItems: "center", gap: 40, transform: `scale(${k})`, opacity: Math.min(1, k * 2) }}><Mark brand={brand} size={180} look={look} />{name(rise(f, at + 18, 18))}</div>, { width: 900 })}
        {subLine}
      </>
    );
  }
  if (v.reveal === "ring") {
    const k = pop(f, at, 22);
    return (
      <>
        {[0, 1, 2].map((i) => {
          const r = rise(f, at + i * 6, 40);
          return abs(W / 2 - 400, 360 - 400, <div style={{ width: 800, height: 800, borderRadius: 999, border: `3px solid ${pal.ink}`, opacity: r > 0 ? (1 - r) * 0.5 : 0, transform: `scale(${0.2 + r})` }} />);
        })}
        {abs(W / 2 - 110, 250, <div style={{ transform: `scale(${k})` }}><Mark brand={brand} size={220} look={look} /></div>)}
        {abs(0, 500, <div style={{ display: "flex", justifyContent: "center" }}>{name(rise(f, at + 14, 18), 130)}</div>, { width: W })}
        {subLine}
      </>
    );
  }
  if (v.reveal === "split") {
    const k = pop(f, at, 18);
    const slide = rise(f, at + 12, 22, IN_OUT);
    return (
      <>
        {abs(W / 2 - 100 - slide * 320, 330, <div style={{ transform: `scale(${k})` }}><Mark brand={brand} size={200} look={look} /></div>)}
        {abs(W / 2 - 180, 345, <div style={{ clipPath: `inset(0 ${(1 - slide) * 100}% 0 0)` }}>{name(1, 160)}</div>)}
        {subLine}
      </>
    );
  }
  // wipe: a circle of the brand colour sweeps over, the name rises letter by letter
  const r = rise(f, at - 4, 26, IN_OUT);
  return (
    <>
      {abs(W / 2 - 1200, 450 - 1200, <div style={{ width: 2400, height: 2400, borderRadius: 9999, backgroundImage: `radial-gradient(circle, ${look.accent[1]}55, transparent 60%)`, transform: `scale(${r})` }} />)}
      {abs(0, 300, (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 36 }}>
          <div style={{ transform: `scale(${pop(f, at + 4, 18)})` }}><Mark brand={brand} size={170} look={look} /></div>
          <div style={{ display: "flex", fontSize: 160, fontWeight: 800, letterSpacing: "-0.05em", color: pal.ink }}>
            {brand.name.split("").map((ch, i) => {
              const k = rise(f, at + 10 + i * 3, 14);
              return <span key={i} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * 60}px)` }}>{ch}</span>;
            })}
          </div>
        </div>
      ), { width: W })}
      {subLine}
    </>
  );
}

// The headline column of a card scene (eyebrow + kinetic title).
function Headline({ c, x, width }: { c: Ctx; x: number; width: number }) {
  const { f, sc, pal, v, look } = c;
  const eb = rise(f, sc.from + 4, 18);
  return abs(x, 300, (
    <div style={{ width }}>
      <div style={{ fontSize: 30, fontWeight: 600, color: pal.sub, opacity: eb, marginBottom: 22 }}>{str(sc, "eyebrow")}</div>
      <KLine words={words(sc, "title")} f={f} s={{ ink: pal.ink, accent: look.accent, keyword: v.keyword, size: 92 }} />
    </div>
  ));
}

// ── 4. Pay: a payment arrives, revenue updates ───────────────────────────
export function Pay(c: Ctx) {
  const { f, sc, v, look } = c;
  const dark = cardDark(c);
  const { pay, rev, inst } = sc.cues;
  const textX = v.side === "left" ? 150 : 1150;
  const vx = v.side === "left" ? 860 : 120;
  const enter = rise(f, sc.from + 2, 24);
  const value = count(f, rev, 22, 48210, 49450);
  const live = rise(f, inst, 14);
  const accent = look.accent[0];
  let visual: ReactNode;
  if (v.pay === "dashboard") {
    visual = (
      <>
        <Panel dark={dark} w={900} h={600}>
          <BrowserBar dark={dark} url="app.flowly.io/revenue" />
          <div style={{ display: "flex", gap: 26 }}>
            <div style={{ width: 150, display: "flex", flexDirection: "column", gap: 18, paddingTop: 6 }}>
              {["layout-dashboard", "wallet", "chart-line", "users"].map((n, i) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i === 1 ? 1 : 0.45, fontSize: 18, fontWeight: 600 }}><Icon name={n} size={24} color={i === 1 ? accent : "currentColor"} />{["Home", "Revenue", "Reports", "Team"][i]}</div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Stat dark={dark} label="Revenue this month" value={money(value)} delta={f >= rev ? "+2.6%" : undefined} accent={accent} />
                <div style={{ opacity: live, transform: `scale(${0.8 + live * 0.2})`, display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, color: "#12b76a", background: "#12b76a1f", padding: "6px 14px", borderRadius: 99 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: "#12b76a" }} />Live</div>
              </div>
              <div style={{ marginTop: 30 }}>
                <LineChart points={[0.2, 0.35, 0.3, 0.5, 0.45, 0.62, 0.58, f >= rev ? 0.86 : 0.6]} draw={rise(f, sc.from + 8, 30)} w={600} h={250} color={accent} fill={look.accent[1]} />
              </div>
            </div>
          </div>
        </Panel>
        {abs(500, -50, <Toast dark={dark} icon="credit-card" title="Payment received" sub="+ $1,240 · just now" accent="#12b76a" />, { opacity: rise(f, pay, 14), transform: `translateY(${(1 - rise(f, pay, 18)) * -40}px)` })}
        <Arrow f={f} at={rev - 10} from={[610, 60]} to={[470, 140]} bend={0.35} color={accent} dur={14} />
      </>
    );
  } else if (v.pay === "phone") {
    visual = (
      <div style={{ marginLeft: 240, marginTop: -60 }}>
        <div style={{ width: 380, height: 720, borderRadius: 64, padding: 16, background: dark ? "#0d1022" : "#16123a", boxShadow: "0 50px 100px rgba(0,0,0,0.35)" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 50, background: dark ? "#161b3a" : "#f7f6fd", padding: 34, boxSizing: "border-box", color: dark ? "#eef1ff" : "#16123a", position: "relative", overflow: "hidden" }}>
            <div style={{ width: 120, height: 30, borderRadius: 99, background: "#000", margin: "-14px auto 130px" }} />
            <Label dark={dark}>Balance</Label>
            <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 8 }}>{money(value)}</div>
            <div style={{ marginTop: 22 }}><Bars values={[0.3, 0.5, 0.4, 0.65, 0.55, f >= rev ? 0.95 : 0.6]} grow={[1, 1, 1, 1, 1, 1]} w={290} h={150} colors={look.accent} gap={12} /></div>
            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 700, color: "#12b76a", opacity: live }}><Icon name="check" size={24} color="#12b76a" strokeWidth={3} />Updated instantly</div>
            <div style={{ position: "absolute", left: 18, right: 18, top: 62, opacity: rise(f, pay, 12), transform: `translateY(${(1 - rise(f, pay, 18, OUT)) * -120}px)` }}>
              <div style={{ background: dark ? "rgba(40,46,90,0.96)" : "rgba(255,255,255,0.97)", borderRadius: 22, padding: 18, display: "flex", gap: 14, alignItems: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: "#12b76a22", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="credit-card" size={24} color="#12b76a" /></div>
                <div><div style={{ fontSize: 18, fontWeight: 700 }}>Payment received</div><div style={{ fontSize: 15, opacity: 0.6 }}>+ $1,240</div></div>
              </div>
            </div>
          </div>
        </div>
        {abs(650, 230, <LottieAt name="payment-success" at={inst - 4} size={170} colors={{ primary: accent, accent: look.accent[1], success: "#12b76a" }} />)}
      </div>
    );
  } else if (v.pay === "cards") {
    visual = (
      <div style={{ position: "relative", width: 900, height: 600 }}>
        {abs(0, 150, <div style={{ transform: `scale(${0.85 + 0.15 * pop(f, pay, 16)})`, opacity: rise(f, pay, 12) }}><Panel dark={dark} w={380} pad={38}><Icon name="credit-card" size={56} color={accent} /><div style={{ fontSize: 26, opacity: 0.6, marginTop: 20 }}>New payment</div><div style={{ fontSize: 68, fontWeight: 700, letterSpacing: "-0.04em" }}>$1,240</div><div style={{ fontSize: 20, opacity: 0.55, marginTop: 6 }}>from Northwind · card</div></Panel></div>)}
        <Arrow f={f} at={pay + 6} from={[392, 300]} to={[540, 270]} bend={-0.3} color={accent} flow width={6} dur={18} />
        {abs(550, 40, <Panel dark={dark} w={420} pad={38}><Label dark={dark}>Revenue</Label><div style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 12 }}>{money(value)}</div><div style={{ marginTop: 18, fontSize: 21, fontWeight: 700, color: "#12b76a", opacity: live }}>● Updated just now</div><div style={{ marginTop: 26 }}><Bars values={[0.3, 0.45, 0.4, 0.6, f >= rev ? 0.95 : 0.55]} grow={[1, 1, 1, 1, 1]} w={344} h={190} colors={look.accent} /></div></Panel>)}
      </div>
    );
  } else {
    const rows = [["Acme Co.", "$860"], ["Northwind", "$2,140"], ["Globex", "$530"], ["Initech", "$1,005"]];
    const slide = rise(f, pay, 18);
    visual = (
      <div style={{ position: "relative" }}>
        <Panel dark={dark} w={760} pad={34}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><div style={{ fontSize: 28, fontWeight: 700 }}>Payments</div><div style={{ fontSize: 18, fontWeight: 700, color: "#12b76a", opacity: live }}>⚡ 0.2 s</div></div>
        <div style={{ height: 76 * slide, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderRadius: 16, background: `${accent}18`, fontSize: 24, fontWeight: 700 }}><span style={{ display: "flex", gap: 12, alignItems: "center" }}><Icon name="credit-card" size={26} color={accent} />New payment</span><span style={{ color: "#12b76a" }}>+$1,240</span></div>
        </div>
        {rows.map(([n, a]) => <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px", fontSize: 22, opacity: 0.75, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(30,24,80,0.06)"}` }}><span>{n}</span><span>{a}</span></div>)}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 26, fontWeight: 700 }}><span>Total revenue</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{money(value)}</span></div>
        </Panel>
        <Arrow f={f} at={rev - 6} from={[770, 150]} to={[775, 470]} bend={-0.35} color={accent} dur={18} />
      </div>
    );
  }
  return (
    <>
      <Headline c={c} x={textX} width={640} />
      {abs(vx, 210, <div style={{ position: "relative", opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}>{visual}</div>)}
    </>
  );
}

// ── 5. Growth: sales grow, the whole team sees it ────────────────────────
export function Growth(c: Ctx) {
  const { f, sc, v, look } = c;
  const dark = cardDark(c);
  const { grow, team } = sc.cues;
  const textX = v.side === "left" ? 150 : 1150;
  const vx = v.side === "left" ? 860 : 120;
  const enter = rise(f, sc.from + 2, 24);
  const g = rise(f, grow, 30, IN_OUT);
  const tm = (i: number) => pop(f, team + i * 4, 16);
  const people = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {TEAM.map(([l, col], i) => <div key={l} style={{ transform: `scale(${tm(i)})`, marginLeft: i ? -14 : 0 }}><Initial letter={l} color={col} size={58} ring={dark ? "#161b3a" : "#fff"} /></div>)}
      <span style={{ marginLeft: 14, fontSize: 21, fontWeight: 700, opacity: tm(3) }}>Seen by your team</span>
    </div>
  );
  let body: ReactNode;
  if (v.growth === "bars") body = <Bars values={[0.28, 0.4, 0.36, 0.55, 0.62, 0.8, 0.95]} grow={[0, 1, 2, 3, 4, 5, 6].map((i) => Math.min(1, Math.max(0.15, g * 1.6 - i * 0.1)))} w={720} h={300} colors={look.accent} />;
  else if (v.growth === "line") body = <LineChart points={[0.15, 0.25, 0.22, 0.4, 0.5, 0.48, 0.7, 0.92]} draw={Math.max(0.18, g)} w={720} h={300} color={look.accent[0]} fill={look.accent[1]} />;
  else if (v.growth === "tiles")
    body = (
      <div style={{ display: "flex", gap: 18 }}>
        {[["Sales", 38], ["Orders", 24], ["Customers", 17]].map(([l, p], i) => (
          <div key={l} style={{ flex: 1, padding: 22, borderRadius: 20, background: dark ? "rgba(255,255,255,0.05)" : `${look.accent[0]}0d` }}>
            <div style={{ fontSize: 18, opacity: 0.6, fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 8 }}>+{count(f, grow + i * 5, 26, 0, Number(p))}%</div>
            <Icon name="trending-up" size={34} color={look.accent[0]} />
          </div>
        ))}
      </div>
    );
  else {
    const r = 120, C = 2 * Math.PI * r;
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 50 }}>
        <svg width={300} height={300} viewBox="0 0 300 300">
          <circle cx={150} cy={150} r={r} fill="none" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(30,24,80,0.07)"} strokeWidth={34} />
          <circle cx={150} cy={150} r={r} fill="none" stroke={look.accent[0]} strokeWidth={34} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - 0.78 * g)} transform="rotate(-90 150 150)" />
          <text x={150} y={168} textAnchor="middle" fontSize={56} fontWeight={700} fill="currentColor">{count(f, grow, 30, 0, 78)}%</text>
        </svg>
        <div style={{ fontSize: 26, lineHeight: 1.8 }}>{["Goal reached", "Sales up", "Shared live"].map((t, i) => <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, opacity: rise(f, grow + i * 6, 14) }}><span style={{ width: 14, height: 14, borderRadius: 99, background: look.accent[i % 2] }} />{t}</div>)}</div>
      </div>
    );
  }
  return (
    <>
      <Headline c={c} x={textX} width={660} />
      {abs(vx, 230, (
        <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}>
          <Panel dark={dark} w={860} pad={38}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
              <div style={{ fontSize: 30, fontWeight: 700 }}>Sales overview</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: look.accent[0], opacity: g }}>▲ {count(f, grow, 30, 0, 38)}%</div>
            </div>
            {body}
            <div style={{ marginTop: 34 }}>{people}</div>
            {(v.growth === "bars" || v.growth === "line") && <Arrow f={f} at={grow + 12} from={[70, 400]} to={[790, 120]} bend={0.1} color={look.accent[1]} width={7} dur={24} />}
            {(v.growth === "tiles" || v.growth === "donut") && abs(560, 4, <LottieAt name="trend-up" at={grow} size={110} colors={{ primary: look.accent[0], accent: look.accent[1] }} />)}
          </Panel>
        </div>
      ))}
    </>
  );
}

// ── 6. No more: the old ways, struck out ─────────────────────────────────
export function NoMore(c: Ctx) {
  const { f, sc, pal, v, look } = c;
  const a = words(sc, "a"), b = words(sc, "b");
  const ts = { ink: pal.ink, accent: look.accent, keyword: v.keyword };
  if (v.nomore === "swap") {
    const out = rise(f, b[0].at - 6, 12);
    return (
      <>
        {abs(0, 400 - out * 120, <KLine words={a} f={f} s={{ ...ts, size: 120, align: "center" }} />, { width: W, opacity: 1 - out })}
        {abs(0, 400, <KLine words={b} f={f} s={{ ...ts, size: 120, align: "center" }} />, { width: W })}
      </>
    );
  }
  if (v.nomore === "split")
    return (
      <>
        {abs(130, 380, <KLine words={a} f={f} s={{ ...ts, size: 84 }} style={{ width: 760 }} />)}
        {abs(W / 2 - 1, 300, <div style={{ width: 2, height: 380, background: `${pal.sub}55`, transform: `scaleY(${rise(f, sc.from + 6, 24)})` }} />)}
        {abs(1030, 380, <KLine words={b} f={f} s={{ ...ts, size: 84 }} style={{ width: 760 }} />)}
      </>
    );
  if (v.nomore === "icons") {
    const tools = ["sheet", "mail", "message-square", "calendar"];
    const strikeA = a.find((w) => w.strike !== undefined)?.strike ?? sc.from;
    const strikeB = b.find((w) => w.strike !== undefined)?.strike ?? sc.from;
    return (
      <>
        {abs(150, 250, <div style={{ display: "flex", flexDirection: "column", gap: 50, width: 1050 }}><KLine words={a} f={f} s={{ ...ts, size: 88 }} /><KLine words={b} f={f} s={{ ...ts, size: 88 }} /></div>)}
        {tools.map((n, i) => {
          const gone = rise(f, (i < 2 ? strikeA : strikeB) + i * 3, 16);
          return abs(1350 + (i % 2) * 200, 250 + Math.floor(i / 2) * 230, <div style={{ opacity: 1 - gone * 0.75, filter: `grayscale(${gone})`, transform: `scale(${1 - gone * 0.15})` }}><IconTile name={n} size={150} colors={look.accent} dark={pal.dark} /></div>);
        })}
        {abs(1320, 420, <div style={{ width: 400, height: 4, background: look.accent[1], borderRadius: 9, transform: `rotate(-24deg) scaleX(${rise(f, strikeB + 10, 14)})`, transformOrigin: "left" }} />)}
      </>
    );
  }
  return abs(0, 300, <div style={{ display: "flex", flexDirection: "column", gap: 30, alignItems: "center" }}><KLine words={a} f={f} s={{ ...ts, size: 96, align: "center" }} /><KLine words={b} f={f} s={{ ...ts, size: 96, align: "center" }} /></div>, { width: W });
}

// ── 7. CTA: the logo, name, tagline, button, address; a click ────────────
export function Cta(c: Ctx) {
  const { f, sc, pal, v, look, brand } = c;
  const { click } = sc.cues;
  const k = rise(f, sc.from + 4, 22);
  const tag = words(sc, "tagline");
  const press = f >= click ? Math.max(0, 1 - (f - click) / 12) : 0;
  const pressed = rise(f, click, 6) * (1 - rise(f, click + 6, 8));
  const cur = rise(f, click - 26, 24, IN_OUT);
  const brandRow = (size: number) => <div style={{ display: "flex", alignItems: "center", gap: size * 0.3, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}><Mark brand={brand} size={size} look={look} /><div style={{ fontSize: size * 0.9, fontWeight: 800, letterSpacing: "-0.05em", color: pal.ink }}>{brand.name}</div></div>;
  const url = <div style={{ fontSize: 30, color: pal.sub, fontWeight: 600, opacity: rise(f, sc.from + 30, 18) }}>{brand.url}</div>;
  const btn = (size: number) => <div style={{ opacity: rise(f, sc.from + 22, 18), transform: `scale(${0.9 + 0.1 * rise(f, sc.from + 22, 18)})` }}><Button label={brand.cta} colors={look.accent} press={pressed} size={size} /></div>;
  const cursorAt = (x: number, y: number) => <Cursor x={mix(x + 340, x, cur)} y={mix(y + 220, y, cur)} press={press} opacity={rise(f, click - 30, 10)} />;
  const point = (from: [number, number], to: [number, number], bend: number) => <Arrow f={f} at={sc.from + 34} from={from} to={to} bend={bend} color={look.accent[1]} width={5} dur={20} />;
  const tagLine = (size: number, align: "left" | "center") => <KLine words={tag} f={f} s={{ ink: pal.ink, accent: look.accent, keyword: v.keyword, size, weight: 600, align }} />;
  if (v.cta === "left")
    return (
      <>
        {abs(160, 250, <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>{brandRow(120)}<div style={{ width: 760 }}>{tagLine(64, "left")}</div>{btn(30)}{url}</div>)}
        {abs(1120, 250, <div style={{ opacity: rise(f, sc.from + 14, 22), transform: `rotate(-4deg)` }}><Panel dark={cardDark(c)} w={620} pad={30}><BrowserBar dark={cardDark(c)} url={brand.url} /><Stat dark={cardDark(c)} label="Live dashboard" value="$49,450" delta="+2.6%" accent={look.accent[0]} /><div style={{ marginTop: 22 }}><LineChart points={[0.2, 0.4, 0.35, 0.6, 0.55, 0.85]} draw={rise(f, sc.from + 16, 30)} w={540} h={170} color={look.accent[0]} fill={look.accent[1]} /></div></Panel></div>)}
        {point([720, 600], [545, 712], 0.3)}
        {cursorAt(470, 690)}
      </>
    );
  if (v.cta === "card")
    return (
      <>
        {abs(W / 2 - 560, 170, <div style={{ opacity: k, transform: `scale(${0.94 + 0.06 * k})` }}><Panel dark={pal.dark} w={1120} pad={70} radius={44} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>{brandRow(120)}{tagLine(58, "center")}{btn(30)}{url}</Panel></div>)}
        {point([1380, 520], [1160, 610], 0.3)}
        {cursorAt(W / 2 + 40, 600)}
      </>
    );
  if (v.cta === "minimal")
    return (
      <>
        {abs(0, 330, <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}><div style={{ fontSize: 210, fontWeight: 800, letterSpacing: "-0.06em", color: pal.ink, opacity: k }}>{brand.name}</div>{tagLine(54, "center")}<div style={{ display: "flex", alignItems: "center", gap: 30 }}>{btn(26)}{url}</div></div>, { width: W })}
        {point([560, 640], [715, 735], -0.3)}
        {cursorAt(W / 2 - 60, 740)}
      </>
    );
  return (
    <>
      {abs(0, 220, <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>{brandRow(130)}{tagLine(64, "center")}{btn(32)}{url}</div>, { width: W })}
      {point([1340, 470], [1140, 560], 0.3)}
      {cursorAt(W / 2 + 50, 560)}
    </>
  );
}

export const TEMPLATES = { hook: Hook, trio: Trio, reveal: Reveal, pay: Pay, growth: Growth, nomore: NoMore, cta: Cta } as const;
