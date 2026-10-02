import type { ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { Icon } from "../../icons";
import { count, IN_OUT, mix, money, OUT, pop, rise } from "../anim";
import { Area, at, Check, float, FlowMark, glide, Logo, Person, Pointer, press, Shot, W, Words } from "./common";
import type { KWord } from "../text";
import { type Beats, type Moments, plainW } from "./beats";

// Film 3 — "Fly" (reference: a SaaS dashboard film on cool white): one large
// product canvas the camera flies over — from the numbers to the chart to the
// team — tilting and pulling back, a black dot for a cursor, two-tone
// headlines (blue over black) and a dark brand badge in the corner.

const BLUE = "#2563eb";
const INK = "#0f1222";
const SUB = "#7b8099";
const LINE = "#e8eaf2";

function FlyBg({ f }: { f: number }) {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #f6f8fc, #e9eef8)", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1400, height: 1000, left: -300 + Math.sin(f / 80) * 200, top: 300 + Math.cos(f / 90) * 100, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(120,150,255,0.22), transparent 65%)", filter: "blur(30px)" }} />
      <div style={{ position: "absolute", width: 1200, height: 900, left: 1000 + Math.cos(f / 70) * 180, top: -300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,0.9), transparent 65%)", filter: "blur(20px)" }} />
      <div style={{ position: "absolute", top: -200, height: 1500, width: 500, left: ((f * 2) % 2800) - 700, transform: "rotate(20deg)", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }} />
    </AbsoluteFill>
  );
}

// Blue words over black words, each on its spoken frame.
function TwoTone({ f, a, b, size = 64 }: { f: number; a: KWord[]; b: KWord[]; size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <Words f={f} words={a} s={{ size, ink: BLUE, weight: 500 }} from="up" />
      <Words f={f} words={b} s={{ size, ink: INK, weight: 500 }} from="up" />
    </div>
  );
}

// A small app window (a tool) drawn flat.
function ToolWin({ title, icon, color, children, w = 520, h = 340 }: { title: string; icon: string; color: string; children?: ReactNode; w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 20, background: "#fff", boxShadow: "0 30px 80px rgba(30,50,120,0.16), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden" }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={18} color="#fff" strokeWidth={2.4} /></div>
        <span style={{ fontSize: 19, fontWeight: 650, color: INK }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>
        {children ??
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <span style={{ height: 12, width: `${36 + ((i * 23) % 40)}%`, borderRadius: 9, background: "#eceff6" }} />
              <span style={{ height: 12, width: "20%", borderRadius: 9, background: "#f2f4f9" }} />
            </div>
          ))}
      </div>
    </div>
  );
}

// ── the product canvas (world coordinates) ────────────────────────────────
const CW = 2400;
const CH = 1500;
function Canvas({ f, b }: { f: number; b: Beats }) {
  const T = b.t;
  const row = rise(f, T.payment, 16, OUT);
  const hi = rise(f, T.updates, 10) * (1 - rise(f, T.instantly + 26, 20));
  const chart = rise(f, T.when2 - 6, 30, OUT);
  const lift = rise(f, T.grow, 40, OUT);
  const kpi = (label: string, value: string, delta?: string, h = 0) => (
    <div style={{ width: 470, padding: "26px 30px", borderRadius: 22, background: "#fff", border: `1px solid ${LINE}`, boxShadow: h ? `0 0 0 ${4 * h}px ${BLUE}66, 0 20px 50px ${BLUE}22` : "0 10px 30px rgba(30,50,120,0.05)" }}>
      <div style={{ fontSize: 22, color: SUB }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
        <span style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.03em", color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {delta && <span style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", background: "#16a34a18", padding: "4px 12px", borderRadius: 99 }}>{delta}</span>}
      </div>
    </div>
  );
  const team = [
    ["M", "Maya Chen", "Sales", "#2563eb", T.entire - 2],
    ["R", "Ravi Patel", "Finance", "#e0475b", T.team],
    ["S", "Sara Kim", "Operations", "#0f9e6e", T.change - 6],
    ["J", "Jon Alvarez", "Support", "#f08a24", T.change + 2],
  ] as const;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH, borderRadius: 40, background: "#fbfcfe", boxShadow: "0 80px 200px rgba(30,50,120,0.25), 0 0 0 1px rgba(0,0,0,0.05)", overflow: "hidden", color: INK, fontFamily: "InterClean, system-ui, sans-serif" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 280, background: "#f3f5fa", padding: "40px 26px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
          <FlowMark size={44} colors={["#60a5fa", BLUE]} />
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>{b.brand.name}</span>
        </div>
        {[["house", "Overview"], ...b.trio.map((x) => [x.icon, x.label]), ["users", "Team"]].map(([ic, t], i) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, fontSize: 22, fontWeight: i ? 500 : 650, color: i ? SUB : INK, background: i ? undefined : "#fff" }}>
            <Icon name={ic} size={24} color={i ? SUB : BLUE} />
            {t}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 330, top: 40, fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>Overview</div>
      <div style={{ position: "absolute", left: 330, top: 120, display: "flex", gap: 30 }}>
        {kpi("Revenue", money(count(f, T.revenue, 26, 48300, 50700) + count(f, T.grow, 40, 0, 13200)), f > T.updates ? "+$2,400" : undefined, hi)}
        {kpi("Payments today", String(f > T.payment + 6 ? 18 : 17))}
        {kpi("Sales this month", String(count(f, T.grow, 40, 312, 396)), f > T.grow ? "+27%" : undefined)}
        {kpi("Reports", "Live")}
      </div>
      {/* payments */}
      <div style={{ position: "absolute", left: 330, top: 340, width: 900, height: 520, borderRadius: 24, background: "#fff", border: `1px solid ${LINE}`, overflow: "hidden" }}>
        <div style={{ padding: "24px 30px", fontSize: 26, fontWeight: 650 }}>Latest payments</div>
        <div style={{ height: row * 86, overflow: "hidden", background: `rgba(37,99,235,${0.08 * (1 - rise(f, T.instantly + 30, 30))})` }}>
          <PRow n="Lumen Co." a="$2,400" s="Just now" c={BLUE} />
        </div>
        <PRow n="Northwind" a="$1,240" s="2h ago" />
        <PRow n="Acme Studio" a="$860" s="5h ago" />
        <PRow n="Blue Harbor" a="$2,150" s="Yesterday" />
      </div>
      {/* chart */}
      <div style={{ position: "absolute", left: 1270, top: 340, width: 1080, height: 520, borderRadius: 24, background: "#fff", border: `1px solid ${LINE}`, padding: 30, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, color: SUB }}>Sales this month</div>
            <div style={{ fontSize: 46, fontWeight: 700, marginTop: 4 }}>{money(count(f, T.grow, 40, 41018, 52240))} <span style={{ fontSize: 20, color: "#16a34a", background: "#16a34a18", padding: "4px 10px", borderRadius: 99 }}>+{count(f, T.grow, 40, 4, 27)}%</span></div>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 18, color: SUB }}>{["1D", "1W", "1M", "3M"].map((t, i) => <span key={t} style={{ padding: "6px 14px", borderRadius: 10, border: `1px solid ${LINE}`, background: i === 2 ? "#eef2ff" : undefined, color: i === 2 ? BLUE : SUB }}>{t}</span>)}</div>
        </div>
        <div style={{ marginTop: 30 }}>
          <Area w={1010} h={290} draw={chart} color={BLUE} pts={[0.18, 0.22, 0.2, 0.3, 0.27, 0.36, 0.34, 0.4, 0.38, 0.46, 0.5, 0.56]} lift={lift * 3.2} dot />
        </div>
      </div>
      {/* team */}
      <div style={{ position: "absolute", left: 330, top: 900, width: 2020, height: 560, borderRadius: 24, background: "#fff", border: `1px solid ${LINE}`, overflow: "hidden" }}>
        <div style={{ padding: "24px 30px", fontSize: 26, fontWeight: 650, display: "flex", justifyContent: "space-between" }}>
          <span>Team <span style={{ color: SUB, fontWeight: 500 }}>4 members</span></span>
          <span style={{ fontSize: 20, color: SUB }}>Sees today&apos;s change</span>
        </div>
        {team.map(([l, n, r, c, cue]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 20, padding: "0 30px", height: 110, borderTop: `1px solid ${LINE}`, fontSize: 24 }}>
            <Person letter={l} size={60} color={c} />
            <span style={{ width: 380, fontWeight: 650 }}>{n}</span>
            <span style={{ width: 300, color: SUB }}>{r}</span>
            <span style={{ flex: 1, color: SUB }}>Revenue · Sales · Reports</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, color: "#16a34a", fontWeight: 650, opacity: rise(f, cue, 10) }}>
              <Check size={36} color="#22c55e" k={pop(f, cue, 14)} />
              Seen
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
function PRow({ n, a, s, c }: { n: string; a: string; s: string; c?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "0 30px", height: 86, borderTop: `1px solid ${LINE}`, fontSize: 24 }}>
      <Person letter={n[0]} size={48} color={c ?? "#a3a9bd"} />
      <span style={{ flex: 1, fontWeight: 600 }}>{n}</span>
      <span style={{ width: 160, fontWeight: 700 }}>{a}</span>
      <span style={{ width: 150, color: c ?? SUB, fontWeight: c ? 650 : 500 }}>{s}</span>
    </div>
  );
}

// The flight: [frame, world x, world y, scale, tiltX, tiltY, screen y].
type Key = [number, number, number, number, number, number, number];
const flightOf = (T: Moments): Key[] => [
  [T.when1 - 10, 1200, 760, 0.6, 16, -12, 600],
  [T.when1 + 6, 790, 560, 1.1, 5, -5, 540],
  [T.revenue - 2, 760, 520, 1.15, 4, -3, 540],
  [T.instantly + 4, 560, 230, 1.55, 3, -2, 540],
  [T.when2 + 2, 1800, 600, 1.3, 3, 4, 540],
  [T.grow + 12, 1920, 590, 1.5, 2, 5, 540],
  [T.entire + 10, 1440, 1180, 0.92, 4, -3, 540],
  [T.change + 14, 1500, 1180, 0.98, 3, -2, 540],
  [T.view + 4, 1200, 760, 0.62, 6, 0, 560],
  [T.no1 - 2, 1200, 820, 0.56, 24, -14, 700],
  [T.no2 + 10, 1220, 780, 0.58, 22, 12, 700],
  [T.just + 4, 1200, 760, 0.6, 18, -8, 710],
  [T.end + 6, 1180, 740, 0.64, 14, 6, 710],
];
function camera(f: number, T: Moments) {
  const FLIGHT = flightOf(T);
  const fr = FLIGHT.map((k) => k[0]);
  const v = (i: number) => interpolate(f, fr, FLIGHT.map((k) => k[i]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: IN_OUT });
  return { x: v(1), y: v(2), s: v(3), rx: v(4), ry: v(5), sy: v(6) };
}

export function FlyFilm({ f, b }: { f: number; b: Beats }) {
  const T = b.t;
  const L = b.line;
  const cut = { trio: T.sales - 8, reveal: T.flowly - 10, fly: T.when1 - 8, end: T.end + 6, dur: T.duration };
  const c = camera(f, T);
  const headK = (a: number) => rise(f, a, 14);
  return (
    <AbsoluteFill style={{ fontFamily: "InterClean, system-ui, sans-serif" }}>
      <FlyBg f={f} />

      {/* 1. Tools scattered at different depths, the headline above */}
      <Shot f={f} from={0} to={cut.trio} enter="none" cam={(p, f) => `${float(f)} translateZ(${mix(0, 120, p)}px)`}>
        {[
          { t: "Spreadsheet", i: "sheet", c: "#16a34a", x: 140, y: 520, r: -6, z: -200, b: 2 },
          { t: "Inbox", i: "mail", c: "#2563eb", x: 700, y: 660, r: 3, z: 40, b: 0 },
          { t: "Invoices", i: "receipt", c: "#9333ea", x: 1280, y: 500, r: 5, z: -120, b: 1.5 },
          { t: "Chat", i: "message-square", c: "#f97316", x: 1500, y: 800, r: -4, z: -260, b: 3 },
          { t: "Exports", i: "download", c: "#64748b", x: 60, y: 880, r: 4, z: -320, b: 3.5 },
        ].map((w, i) => {
          const k = rise(f, 4 + i * 5, 22, OUT);
          const sc = rise(f, T.scattered, 30, OUT);
          return (
            <div key={i} style={{ position: "absolute", left: w.x + (w.x - 900) * sc * 0.18, top: w.y + Math.sin(f / 40 + i) * 10 + (1 - k) * 120, transform: `translateZ(${w.z}px) rotate(${w.r * (1 + sc)}deg)`, opacity: k, filter: `blur(${w.b}px)` }}>
              <ToolWin title={w.t} icon={w.i} color={w.c} w={440} h={290} />
            </div>
          );
        })}
        {at(W / 2, 220, <TwoTone f={f} a={L.hookA} b={L.hookTail} size={70} />)}
      </Shot>

      {/* 2. Three tools, a dot cursor hops from one to the next */}
      <Shot f={f} from={cut.trio} to={cut.reveal} enter="slide" cam={(p, f) => `${float(f)} translateX(${mix(120, -120, p)}px) rotateY(${mix(10, -10, p)}deg)`}>
        {(() => {
          const tools = [
            { t: b.trio[0].label, s: b.trio[0].sub, i: b.trio[0].icon, c: "#16a34a", x: 90, cue: T.sales },
            { t: b.trio[1].label, s: b.trio[1].sub, i: b.trio[1].icon, c: "#2563eb", x: 700, cue: T.payments },
            { t: b.trio[2].label, s: b.trio[2].sub, i: b.trio[2].icon, c: "#9333ea", x: 1310, cue: T.reports },
          ];
          const [px, py] = glide(f, [[T.sales - 6, 300, 760], [T.payments - 8, 330, 640], [T.payments + 4, 940, 640], [T.reports - 6, 960, 640], [T.reports + 6, 1560, 640]]);
          return (
            <>
              {tools.map((w) => {
                const k = rise(f, w.cue - 6, 16, OUT);
                return (
                  <div key={w.t} style={{ position: "absolute", left: w.x, top: 400, opacity: k, transform: `translateY(${(1 - k) * 80}px) scale(${mix(0.9, 1, k)})` }}>
                    <ToolWin title={w.t} icon={w.i} color={w.c}>
                      <Area w={480} h={150} draw={rise(f, w.cue, 24)} color={w.c} pts={[0.3, 0.5, 0.35, 0.6, 0.45, 0.7]} />
                    </ToolWin>
                    <div style={{ textAlign: "center", marginTop: 20, fontSize: 32, color: SUB, opacity: rise(f, w.cue + 8, 12) }}>{w.s}</div>
                  </div>
                );
              })}
              <Pointer x={px} y={py} dot press={press(f, [T.payments, T.reports])} />
              {at(W / 2, 200, <Words f={f} words={L.trio} s={{ size: 52, ink: INK, weight: 500, key: () => ({ color: BLUE }) }} from="up" />)}
            </>
          );
        })()}
      </Shot>

      {/* 3. The name, then the canvas rises under the headline */}
      <Shot f={f} from={cut.reveal} to={cut.fly} enter="zoom" cam={(p, f) => `${float(f)}`}>
        {(() => {
          const up = rise(f, T.into - 4, 30, IN_OUT);
          return (
            <>
              {at(W / 2, mix(500, 140, up), <div style={{ transform: `scale(${mix(1, 0.55, up)})` }}><Logo size={170} ink={INK} colors={["#60a5fa", BLUE]} k={rise(f, T.flowly - 4, 26, OUT)} /></div>)}
              {at(W / 2, mix(680, 270, up), <Words f={f} words={L.reveal} s={{ size: 58, ink: INK, weight: 500, key: () => ({ color: BLUE }) }} from="up" />)}
              <div style={{ position: "absolute", left: W / 2, top: mix(1300, 640, up), transformStyle: "preserve-3d" }}>
                <div style={{ position: "absolute", left: 0, top: 0, transform: `rotateX(${mix(40, 18, up)}deg) scale(0.52) translate(-1200px, 0)`, transformOrigin: "0 0" }}>
                  <Canvas f={f} b={b} />
                </div>
              </div>
            </>
          );
        })()}
      </Shot>

      {/* 4. The flight over the product, one continuous shot */}
      <Shot f={f} from={cut.fly} to={cut.end} enter="blur" exit="blur">
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 1080, perspective: 2000 }}>
          <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transformStyle: "preserve-3d", transform: `${float(f, 0.6)} translate(${W / 2}px, ${c.sy}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale(${c.s}) translate(${-c.x}px, ${-c.y}px)` }}>
            <Canvas f={f} b={b} />
            <Pointer
              dot
              {...(() => {
                const [x, y] = glide(f, [[T.when1, 1100, 700], [T.payment, 980, 470], [T.revenue, 700, 260], [T.when2 + 4, 1700, 700], [T.grow + 30, 2280, 450], [T.entire, 2000, 1110], [T.view, 2100, 1360]]);
                return { x, y };
              })()}
              press={press(f, [T.revenue + 2, T.entire + 4])}
            />
          </div>
        </div>
        {/* headlines over the far views (a white veil keeps them clear) */}
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 360, background: "linear-gradient(180deg, rgba(244,247,252,0.96) 55%, rgba(244,247,252,0))", opacity: headK(T.no1 - 8) }} />
        {f < T.no2 - 4 && at(W / 2, 170, <TwoTone f={f} a={L.noA1} b={L.noA2} size={68} />, { opacity: 1 - rise(f, T.no2 - 8, 6) })}
        {f >= T.no2 - 8 && f < T.just - 4 && at(W / 2, 170, <TwoTone f={f} a={L.noB1} b={L.noB2} size={68} />, { opacity: 1 - rise(f, T.just - 8, 6) })}
        {f >= T.just - 8 && at(W / 2, 170, <TwoTone f={f} a={plainW(L.ctaA)} b={plainW(L.ctaB)} size={68} />)}
      </Shot>

      {/* 5. End card */}
      <Shot f={f} from={cut.end} to={cut.dur} last enter="zoom" cam={(p, f) => `${float(f, 0.4)} scale(${mix(1.03, 1, p)})`}>
        {at(W / 2, 450, <Logo size={180} ink={INK} colors={["#60a5fa", BLUE]} k={rise(f, cut.end, 28, OUT)} />)}
        {at(W / 2, 590, <div style={{ fontSize: 46, color: BLUE, fontWeight: 500, opacity: rise(f, cut.end + 14, 14) }}>{b.brand.tagline}</div>)}
        {at(W / 2, 720, <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 44px", borderRadius: 16, background: INK, color: "#fff", fontSize: 36, fontWeight: 600, transform: `scale(${pop(f, cut.end + 22, 16)})` }}>{b.brand.cta}<Icon name="arrow-right" size={32} color="#fff" /></div>, { opacity: rise(f, cut.end + 22, 10) })}
        {at(W / 2, 830, <div style={{ fontSize: 32, color: SUB, opacity: rise(f, cut.end + 30, 12) }}>{b.brand.url}</div>)}
      </Shot>

      {/* the brand badge (after the reveal), as the reference's corner badge */}
      {f > T.flowly + 30 && f < cut.end && (
        <div style={{ position: "absolute", left: 40, top: 34, display: "flex", alignItems: "center", gap: 10, padding: "10px 18px 10px 12px", borderRadius: 14, background: INK, color: "#fff", fontSize: 24, fontWeight: 700, opacity: rise(f, T.flowly + 30, 12) }}>
          <FlowMark size={34} colors={["#60a5fa", BLUE]} />
          {b.brand.name}
        </div>
      )}
    </AbsoluteFill>
  );
}
