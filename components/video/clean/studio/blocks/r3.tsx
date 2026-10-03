import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../../../icons";
import { show, steps } from "../../content";
import { IN_OUT, mix, OUT, rise } from "../../anim";
import { abs, at, FlowMark, glide, grow, Pointer, press, soft, W } from "../../refs/common";
import { type Block, type BlockCtx, box, card, Say } from "../kit";
import type { Pal } from "../looks";
import { TypeIn } from "./r2-open";

// Blocks from the third set of references: Kitaabh (AI search for books,
// night blue), Assembly (payments, flat line drawing, indigo) and FSS
// (payments, black and crimson). People are never drawn (initials only).

const tAccent = (pal: Pal) => pal.panelAccent ?? pal.accent;
const count = (f: number, from: number, dur: number, a: number, b: number) => mix(a, b, rise(f, from, dur, OUT));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// A glossy sphere (linear gradients only: the download renderer has no radial).
function Sphere({ size, children, style, pal }: { size: number; children?: ReactNode; style?: CSSProperties; pal?: Pal }) {
  const [hi, mid] = pal ? [pal.accent2, pal.accent] : ["#ff5b6c", "#d8102a"];
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: 999, background: `linear-gradient(150deg, ${hi} 0%, ${mid} 45%, #0a0610 140%)`, boxShadow: `0 ${size * 0.12}px ${size * 0.4}px ${mid}77, inset 0 -${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      <div style={{ position: "absolute", left: size * 0.2, top: size * 0.1, width: size * 0.4, height: size * 0.22, borderRadius: 999, background: "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0))", filter: `blur(${size * 0.02}px)` }} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
// A dark glass card with a lit edge (Night, Crimson).
const glowCard = (pal: Pal, radius = 30): CSSProperties => ({
  borderRadius: radius,
  background: `linear-gradient(160deg, ${pal.panelSide ?? pal.panel}, ${pal.panel})`,
  border: `2px solid ${pal.glow}88`,
  boxShadow: `0 0 0 1px ${pal.glow}22, 0 0 60px ${pal.glow}55, 0 40px 100px rgba(0,0,0,0.5)`,
  color: pal.panelInk,
});
// A sparkle (four-point star).
const Star = ({ size, color = "#fff", style }: { size: number; color?: string; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" style={style}>
    <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10 Z" fill={color} />
  </svg>
);

// ── Night (Kitaabh) ───────────────────────────────────────────────────────

// Rings of blue light around a question; they breathe, then the camera
// goes through them.
function tunnel(c: BlockCtx) {
  const { f, L, pal } = c;
  const into = rise(f, c.to - 26, 26, IN_OUT);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${mix(1, 2.6, into)})`, opacity: 1 - into * 0.6 }}>
        {[1640, 1320, 1040, 800, 600].map((d, k) => {
          const k2 = soft(f, c.from + k * 4, 22);
          const pulse = Math.sin(f / 18 - k * 0.7) * 10;
          return (
            <div key={d} style={{ position: "absolute", left: 960 - (d + pulse) / 2, top: 540 - (d + pulse) / 2, width: d + pulse, height: d + pulse, borderRadius: 9999, border: `${28 - k * 3}px solid rgba(${50 + k * 10},${90 + k * 12},255,${0.18 + k * 0.08})`, boxShadow: `0 0 60px rgba(60,100,255,${0.25 + k * 0.05}), inset 0 0 60px rgba(60,100,255,${0.2 + k * 0.05})`, opacity: k2, transform: `scale(${mix(0.7, 1, k2)}) rotate(${f * (k % 2 ? 0.3 : -0.3)}deg)` }} />
          );
        })}
        <div style={{ position: "absolute", left: 960 - 300, top: 540 - 300, width: 600, height: 600, borderRadius: 9999, background: "linear-gradient(160deg, #2c56ff, #0f2bb0)", opacity: soft(f, c.from + 14, 20) * 0.9 }} />
      </div>
      {at(W / 2, 540, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <TypeIn f={f} words={L.hookA} size={L.hookA.length > 5 ? 40 : 48} pal={pal} weight={600} caret={false} />
          <TypeIn f={f} words={L.hookTail} size={L.hookA.length > 5 ? 40 : 48} pal={pal} weight={600} keyColor={pal.accent2} />
        </div>
      ), { opacity: 1 - into })}
      <Star size={46} color="#9fc0ff" style={{ position: "absolute", left: 1150, top: 420 + Math.sin(f / 10) * 6, opacity: soft(f, c.from + 20, 12) * (1 - into) }} />
    </>
  );
}

// The name over a glowing search window that rises from below; the line
// is typed into it and a sparkle presses "Search".
function searchwin(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const up = rise(f, T.flowly - 6, 26, OUT);
  const tap = T.live;
  const p = press(f, [tap]);
  const [px, py] = glide(f, [[T.flowly + 10, 1300, 900], [tap - 4, 1000, 735]]);
  return (
    <>
      {at(W / 2, 210, <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.03em", color: pal.ink }}>{b.brand.name}<Star size={34} color={pal.accent2} style={{ marginLeft: 10, verticalAlign: "top" }} /></div>, { opacity: soft(f, T.flowly - 10, 16) })}
      <div style={{ position: "absolute", left: 360, top: mix(1100, 360, up), width: 1200, height: 560, ...glowCard(pal, 36), transform: `perspective(1800px) rotateX(${mix(30, 14, up)}deg)`, transformOrigin: "50% 0", padding: 34, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, fontWeight: 700 }}>
          <FlowMark size={34} colors={[pal.accent2, pal.accent]} />
          {b.brand.name}
          <span style={{ marginLeft: 12, padding: "4px 14px", borderRadius: 99, border: `1px solid ${pal.line}`, fontSize: 16, color: pal.panelSub }}>{b.label}</span>
        </div>
        <div style={{ marginTop: 26, height: 150, borderRadius: 16, background: `linear-gradient(100deg, ${pal.accent}, #2a4fe0)`, padding: "26px 30px", boxSizing: "border-box" }}>
          <TypeIn f={f} words={L.revealB} size={40} pal={{ ...pal, ink: "#fff", accent: "#fff" }} weight={500} />
        </div>
        <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 34px", borderRadius: 99, background: pal.accent, color: "#fff", fontSize: 28, fontWeight: 650, transform: `scale(${1 - p * 0.08})`, boxShadow: `0 0 40px ${pal.glow}88` }}>
            <Icon name="search" size={28} color="#fff" />
            {f > tap + 4 ? "Searching…" : "Search"}
          </div>
        </div>
      </div>
      <Pointer x={px} y={py} press={p} />
      <Star size={40} style={{ position: "absolute", left: px + 34, top: py - 30, opacity: soft(f, T.flowly + 10, 10) }} />
    </>
  );
}

// A tilted search pill with the line in it; the answer comes up as a card of
// bars that turns to face the camera.
function query(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const face = rise(f, T.payment - 4, 30, IN_OUT);
  const rows = [{ name: C.event.source, value: C.event.detail }, ...C.rows].slice(0, 5);
  const vals = [0.55, 0.72, 0.4, 0.86, 0.63];
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `perspective(2000px) rotateY(${mix(-24, 0, face)}deg) rotateX(${mix(18, 0, face)}deg) rotateZ(${mix(-6, 0, face)}deg)`, transformOrigin: "50% 50%" }}>
        {at(W / 2, 220, (
          <div style={{ display: "flex", alignItems: "center", gap: 18, height: 96, padding: "0 12px 0 40px", borderRadius: 99, background: `linear-gradient(100deg, ${pal.accent}, #2a4fe0)`, boxShadow: `0 0 50px ${pal.glow}88`, minWidth: 900 }}>
            <div style={{ flex: 1 }}><TypeIn f={f} words={L.payA} size={40} pal={{ ...pal, ink: "#fff", accent: "#fff" }} weight={500} caret={false} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 28px", borderRadius: 99, background: "#0b0f24", color: "#fff", fontSize: 26 }}><Icon name="search" size={26} color="#fff" />Search</div>
          </div>
        ))}
        {at(W / 2, 600, (
          <div style={{ width: 1100, ...glowCard(pal, 30), padding: "34px 44px", boxSizing: "border-box", opacity: soft(f, T.payment - 8, 16) }}>
            <div style={{ fontSize: 26, fontWeight: 650, color: pal.panelSub, marginBottom: 18 }}>{C.metric.label}</div>
            {rows.map((r, i) => (
              <div key={r.name + i} style={{ display: "flex", alignItems: "center", gap: 20, height: 62 }}>
                <span style={{ width: 300, textAlign: "right", fontSize: 24, color: pal.panelInk }}>{clip(r.name, 22)}</span>
                <span style={{ height: 30, width: 560 * vals[i] * rise(f, T.payment + i * 4, 22, OUT), borderRadius: 99, background: "linear-gradient(90deg, #ffffff, #9fb6ff)" }} />
                <span style={{ fontSize: 22, color: pal.panelSub, opacity: rise(f, T.payment + 14 + i * 4, 10) }}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {at(W / 2, 980, <Say c={c} words={L.payB} size={52} weight={500} />)}
    </>
  );
}

// A ring chart: its segments grow round, names on leader lines.
function donut(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const segs = [0.34, 0.24, 0.22, 0.2];
  const names = [C.rows[0]?.name, C.rows[1]?.name, C.rows[2]?.name, C.event.source].map((n) => clip(n ?? "", 18));
  const colors = ["#3d6bff", "#6ee7c8", "#a9c1ff", "#5fd1ff"];
  const g = rise(f, T.grow - 8, 40, OUT);
  const tilt = rise(f, c.from, 50, IN_OUT);
  const R = 230;
  let acc = 0;
  return (
    <>
      {at(W / 2, 130, (
        <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
          <Say c={c} words={L.growA} size={58} weight={500} />
          <Say c={c} words={L.growB} size={58} weight={500} />
        </div>
      ))}
      {at(W / 2, 590, (
        <div style={{ position: "relative", width: 900, height: 620, transform: `perspective(1800px) rotateX(${mix(52, 0, tilt)}deg)` }}>
          <svg width={900} height={620} viewBox="-450 -310 900 620" style={{ overflow: "visible" }}>
            <circle r={R} fill="none" stroke={`${pal.glow}22`} strokeWidth={60} />
            {segs.map((s, i) => {
              const start = acc;
              acc += s;
              const len = Math.max(0, Math.min(s, g - start) - 0.012);
              const mid = (start + s / 2) * Math.PI * 2 - Math.PI / 2;
              const lx = Math.cos(mid) * (R + 120), ly = Math.sin(mid) * (R + 90);
              const on = rise(f, T.grow + 20 + i * 5, 12);
              return (
                <g key={i}>
                  <circle r={R} fill="none" stroke={colors[i]} strokeWidth={60} strokeLinecap="round" pathLength={1} strokeDasharray={`${len} 1`} strokeDashoffset={-start} transform="rotate(-90)" />
                  <line x1={Math.cos(mid) * (R + 40)} y1={Math.sin(mid) * (R + 40)} x2={lx} y2={ly} stroke="#ffffff66" strokeWidth={2} strokeDasharray="6 6" opacity={on} />
                  <text x={lx + (lx > 0 ? 12 : -12)} y={ly + 8} textAnchor={lx > 0 ? "start" : "end"} fontSize={26} fill="#fff" opacity={on}>{names[i]}</text>
                </g>
              );
            })}
            <text y={-8} textAnchor="middle" fontSize={64} fontWeight={700} fill="#fff" opacity={rise(f, T.grow, 16)}>{show(C.growth.unit, count(f, T.grow, 36, C.growth.from, C.growth.to))}</text>
            <text y={40} textAnchor="middle" fontSize={24} fill={pal.sub} opacity={rise(f, T.grow, 16)}>{C.growth.label}</text>
          </svg>
        </div>
      ))}
    </>
  );
}

// A table whose red "Missing" marks turn green "Matched", row by row, with a
// sparkle passing.
function reconcile(c: BlockCtx) {
  const { f, L, C, pal } = c;
  const rows = [C.event.source, ...C.rows.map((r) => r.name)].slice(0, 4);
  const start = (L.noB[0]?.at ?? c.from + 50) - 10;
  return (
    <>
      {at(W / 2, 140, <Say c={c} words={f < start ? L.noA : L.noB} size={60} weight={550} />)}
      {at(W / 2, 600, (
        <div style={{ width: 1300, ...glowCard(pal, 30), padding: "30px 40px", boxSizing: "border-box", background: "#f6f8ff", color: "#16204a", border: `2px solid ${pal.glow}66` }}>
          <div style={{ display: "flex", fontSize: 22, color: "#6c76a0", fontWeight: 650, padding: "0 0 16px", borderBottom: "1px solid #e1e6f6" }}>
            <span style={{ width: 300 }}>Status</span>
            <span style={{ width: 460 }}>Name</span>
            <span>Amount</span>
          </div>
          {rows.map((r, i) => {
            const ok = rise(f, start + i * 7, 8);
            return (
              <div key={r + i} style={{ display: "flex", alignItems: "center", height: 92, borderBottom: "1px solid #eef1fa", fontSize: 26 }}>
                <span style={{ width: 300 }}>
                  <span style={{ display: "inline-block", minWidth: 190, textAlign: "center", padding: "10px 22px", borderRadius: 99, fontSize: 22, fontWeight: 700, color: "#fff", background: ok > 0.5 ? "#22c55e" : "#ef4444", transform: `scale(${1 + Math.sin(ok * Math.PI) * 0.12})` }}>{ok > 0.5 ? "Matched" : "Missing"}</span>
                </span>
                <span style={{ width: 460 }}>{clip(r, 24)}</span>
                <span style={{ color: "#6c76a0" }}>{i === 0 ? C.event.detail : C.rows[i - 1]?.value}</span>
              </div>
            );
          })}
        </div>
      ))}
      <Star size={70} color="#cfe0ff" style={{ position: "absolute", left: 320 + rise(f, start, 30, IN_OUT) * 220, top: 380 + rise(f, start, 30, IN_OUT) * 330, opacity: rise(f, start - 2, 6) * (1 - rise(f, start + 30, 8)) }} />
    </>
  );
}

// The mark slides in and the name comes out from behind it; a streak of
// light runs along the promise; the address.
function wipeEnd(c: BlockCtx) {
  const { f, b, pal } = c;
  const t = c.from;
  const name = rise(f, t + 8, 22, OUT);
  const run = rise(f, t + 22, 24, IN_OUT);
  return (
    <>
      {at(W / 2, 440, (
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ transform: `translateX(${(1 - soft(f, t, 18)) * -120}px)`, opacity: soft(f, t, 14) }}><FlowMark size={150} colors={[pal.accent2, pal.accent]} /></div>
          <div style={{ fontSize: 150, fontWeight: 650, letterSpacing: "-0.03em", color: pal.ink, clipPath: `inset(-20% ${(1 - name) * 100}% -20% 0)`, transform: `translateX(${(1 - name) * -80}px)` }}>{b.brand.name}</div>
        </div>
      ))}
      {at(W / 2, 640, (
        <div style={{ position: "relative", padding: "18px 44px", borderRadius: 99, border: `2px solid ${pal.glow}55`, background: "rgba(20,30,80,0.5)", fontSize: 34, color: pal.ink, overflow: "hidden" }}>
          <span style={{ clipPath: `inset(0 ${(1 - run) * 100}% 0 0)`, display: "inline-block" }}>{b.brand.tagline}</span>
          <span style={{ position: "absolute", top: 0, bottom: 0, left: `${run * 100}%`, width: 120, marginLeft: -60, background: `linear-gradient(90deg, transparent, ${pal.accent2}, transparent)`, opacity: run < 1 ? 1 : 0 }} />
        </div>
      ), { opacity: soft(f, t, 10) })}
      {at(W / 2, 750, <div style={{ fontSize: 30, color: pal.accent2 }}>{b.brand.url}</div>, { opacity: soft(f, t + 40, 14) })}
    </>
  );
}

// ── Line (Assembly) ───────────────────────────────────────────────────────

// Three dots, one per thing, each sends out branching lines that fill the
// frame — scattered work.
const BRANCH = [
  [[0, 0], [160, 0], [220, -60], [520, -60], [580, -120], [900, -120], [960, -180], [1400, -180]],
  [[0, 0], [200, 0], [260, 60], [600, 60], [660, 0], [1000, 0], [1060, 70], [1400, 70]],
  [[0, 0], [140, 0], [200, 50], [480, 50], [540, 120], [880, 120], [940, 60], [1400, 60]],
];
function circuit(c: BlockCtx) {
  const { f, b, pal } = c;
  const cols = [pal.accent, pal.accent2, "#ffffff"];
  return (
    <>
      {b.trio.map((x, i) => {
        const y = 300 + i * 240;
        const k = rise(f, x.at - 6, 40, OUT);
        const pts = BRANCH[i];
        const d = pts.map(([px, py], j) => `${j ? "L" : "M"}${px} ${py}`).join(" ");
        return (
          <div key={x.label} style={{ position: "absolute", left: 300, top: y }}>
            <svg width={1600} height={400} viewBox="0 -200 1600 400" style={{ position: "absolute", left: 0, top: -200, overflow: "visible" }}>
              <path d={d} stroke={cols[i]} strokeWidth={4} fill="none" pathLength={1} strokeDasharray={`${k} 1`} />
              <path d={pts.slice(2, 5).map(([px, py], j) => `${j ? "L" : "M"}${px} ${py + (i % 2 ? -50 : 50)}`).join(" ")} stroke={cols[i]} strokeWidth={3} opacity={0.6} fill="none" pathLength={1} strokeDasharray={`${rise(f, x.at + 6, 30)} 1`} />
              {pts.slice(1, -1).map(([px, py], j) => <circle key={j} cx={px} cy={py} r={7} fill={cols[i]} opacity={k > (j + 1) / pts.length ? 1 : 0} />)}
            </svg>
            <div style={{ position: "absolute", left: -38, top: -38, width: 76, height: 76, borderRadius: 99, background: cols[i], display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 10px ${cols[i]}33`, transform: `scale(${grow(f, x.at - 8, 12)})`, opacity: soft(f, x.at - 8, 10) }}>
              <Icon name={x.icon} size={38} color={i === 2 ? "#2b0fa8" : "#fff"} />
            </div>
            <div style={{ position: "absolute", left: -260, top: -28, width: 200, textAlign: "right", fontSize: 40, fontWeight: 650, color: "#fff", opacity: soft(f, x.at - 4, 12) }}>{x.label}</div>
            <div style={{ position: "absolute", left: -260, top: 22, width: 200, textAlign: "right", fontSize: 26, color: pal.sub, opacity: soft(f, x.at, 12) }}>{x.sub}</div>
          </div>
        );
      })}
    </>
  );
}

// The mark in a line-drawn box, in a white disc; then the product between
// two things: a card — the mark — a building, linked by lines.
function diagram(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const draw = rise(f, T.flowly - 10, 20, IN_OUT);
  const side = rise(f, T.brings - 4, 24, IN_OUT);
  const a = tAccent(pal);
  const line = (x: number, k: number) => <path d={`M${x} 0 L${x + 40} 0 L${x + 60} -20 L${x + 120} -20`} stroke={a} strokeWidth={4} fill="none" pathLength={1} strokeDasharray={`${k} 1`} />;
  return (
    <>
      {at(mix(W / 2, 960, side), mix(470, 400, side), (
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div style={{ width: 300 * side, opacity: side, overflow: "hidden", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 230, height: 170, border: `4px solid ${a}`, borderRadius: 8, background: "#fff", padding: 18, boxSizing: "border-box" }}>
              <div style={{ height: 14, width: "60%", background: "#f06b7c", borderRadius: 4 }} />
              <div style={{ marginTop: 14, height: 12, width: "80%", background: pal.line, borderRadius: 4 }} />
              <div style={{ marginTop: 10, height: 30, width: "50%", background: "#9ae6e3", borderRadius: 4 }} />
            </div>
          </div>
          {side > 0 && <svg width={140 * side} height={60} viewBox="0 -30 140 60">{line(0, side)}</svg>}
          <div style={{ width: 260, height: 260, borderRadius: 999, background: side < 1 ? "#ffffff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: side < 0.5 ? "0 30px 80px rgba(40,20,120,0.18)" : undefined }}>
            <div style={{ width: 170, height: 170, borderRadius: 18, border: `5px solid ${a}`, display: "flex", alignItems: "center", justifyContent: "center", clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)` }}>
              <FlowMark size={110} colors={[pal.panelAccent ? "#24c6c0" : pal.accent2, a]} />
            </div>
          </div>
          {side > 0 && <svg width={140 * side} height={60} viewBox="0 -30 140 60">{line(0, side)}</svg>}
          <div style={{ width: 300 * side, opacity: side, overflow: "hidden" }}>
            <svg width={200} height={230} viewBox="0 0 200 230">
              <path d="M30 220 L30 60 L110 20 L110 220 Z" fill="#fff" stroke={a} strokeWidth={4} />
              <path d="M110 220 L110 70 L170 90 L170 220 Z" fill="#9ae6e3" stroke={a} strokeWidth={4} />
              {[80, 120, 160].map((y) => <line key={y} x1={50} y1={y} x2={90} y2={y} stroke={a} strokeWidth={4} />)}
              <line x1={10} y1={222} x2={195} y2={222} stroke={a} strokeWidth={4} />
            </svg>
          </div>
        </div>
      ))}
      {at(W / 2, 700, <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em", color: tAccent(pal) }}>{b.brand.name}</div>, { opacity: soft(f, T.flowly, 14) * (1 - side) })}
      {at(W / 2, 690, <TypeIn f={f} words={L.reveal} size={58} pal={{ ...pal, ink: tAccent(pal) }} weight={600} caret={false} />, { opacity: side })}
    </>
  );
}

// A coin runs from the source along a line that branches to three ends,
// each ticking as it arrives.
function route(c: BlockCtx) {
  const { f, T, L, C, b, pal } = c;
  const a = tAccent(pal);
  const run = rise(f, T.payment - 4, 34, IN_OUT);
  const ends = [{ y: -200, icon: b.trio[0]?.icon ?? "package", label: b.trio[0]?.label }, { y: 0, icon: b.trio[1]?.icon ?? "boxes", label: b.trio[1]?.label }, { y: 200, icon: b.trio[2]?.icon ?? "receipt", label: b.trio[2]?.label }];
  const coinX = mix(560, 1060, Math.min(1, run * 1.6));
  return (
    <>
      {abs(160, 110, <Say c={c} words={L.payA} size={58} weight={600} align="left" ink={a} />)}
      <div style={{ position: "absolute", left: 300, top: 580 }}>
        <div style={{ position: "absolute", left: -150, top: -150, width: 300, height: 300, background: "#e9e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={200} height={230} viewBox="0 0 200 230">
            <path d="M30 220 L30 60 L110 20 L110 220 Z" fill="#fff" stroke={a} strokeWidth={4} />
            <path d="M110 220 L110 70 L170 90 L170 220 Z" fill="#9ae6e3" stroke={a} strokeWidth={4} />
            {[80, 120, 160].map((y) => <line key={y} x1={50} y1={y} x2={90} y2={y} stroke={y === 120 ? "#f06b7c" : a} strokeWidth={6} />)}
          </svg>
        </div>
        <svg width={1500} height={600} viewBox="0 -300 1500 600" style={{ position: "absolute", left: 150, top: -300, overflow: "visible" }}>
          <path d="M0 0 L760 0" stroke={a} strokeWidth={4} pathLength={1} strokeDasharray={`${soft(f, c.from, 20)} 1`} />
          {ends.map((e, i) => {
            const k = rise(f, T.payment + 6 + i * 4, 24, OUT);
            const done = rise(f, T.updates + i * 5, 8);
            return (
              <g key={i}>
                <path d={`M760 0 L860 ${e.y} L1120 ${e.y}`} stroke={a} strokeWidth={4} fill="none" pathLength={1} strokeDasharray={`${k} 1`} />
                <g transform={`translate(1190 ${e.y})`} opacity={k}>
                  <rect x={-60} y={-60} width={120} height={120} fill={done > 0.5 ? "#9ae6e3" : "#e9e8f0"} />
                  <circle cx={46} cy={-46} r={20} fill={done > 0.5 ? "#22c55e" : "transparent"} />
                  {done > 0.5 && <path d="M37 -46 l7 7 l12 -14" stroke="#fff" strokeWidth={4} fill="none" />}
                </g>
                <text x={1280} y={e.y + 10} fontSize={30} fill={a} opacity={k}>{e.label}</text>
              </g>
            );
          })}
          <circle cx={760} cy={0} r={12} fill={a} opacity={soft(f, c.from + 10, 10)} />
        </svg>
        {ends.map((e, i) => {
          const k = rise(f, T.payment + 6 + i * 4, 24, OUT);
          return <div key={i} style={{ position: "absolute", left: 1340 - 22, top: e.y - 22, opacity: k }}><Icon name={e.icon} size={44} color={a} /></div>;
        })}
        <div style={{ position: "absolute", left: coinX - 34, top: -34, width: 68, height: 68, borderRadius: 99, background: "#fff", border: `4px solid ${a}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700, color: a, opacity: run > 0 && run < 0.95 ? 1 : 0 }}>$</div>
      </div>
      {abs(160, 900, <div style={{ display: "flex", gap: 20, alignItems: "baseline" }}><Say c={c} words={L.payB} size={50} weight={600} align="left" ink={a} /><span style={{ fontSize: 36, color: pal.sub, opacity: rise(f, T.updates, 10) }}>{C.event.detail}</span></div>)}
    </>
  );
}

// Buildings rise from the ground as the figure grows; the biggest carries
// the multiple.
function city(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const a = tAccent(pal);
  const st = steps(C.growth, 6);
  const mult = C.growth.from ? `${(C.growth.to / C.growth.from).toFixed(1)}x` : "";
  const fills = ["#fff", "#9ae6e3", "#fff", a, "#fff", "#f06b7c"];
  return (
    <>
      {at(W / 2, 130, (
        <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
          <Say c={c} words={L.growA} size={58} weight={600} ink={a} />
          <Say c={c} words={L.growB} size={58} weight={500} />
        </div>
      ))}
      <div style={{ position: "absolute", left: 260, top: 300, width: 1400, height: 620, background: "#e9e8f0" }} />
      <svg width={1400} height={620} viewBox="0 0 1400 620" style={{ position: "absolute", left: 260, top: 300 }}>
        {st.values.slice(0, 6).map((v, i) => {
          const h = 520 * v * rise(f, T.grow - 6 + i * 4, 26, OUT);
          const x = 90 + i * 210;
          return (
            <g key={i}>
              <rect x={x} y={600 - h} width={150} height={h} fill={fills[i]} stroke={a} strokeWidth={4} />
              {Array.from({ length: Math.floor(h / 70) }, (_, k) => <rect key={k} x={x + 30} y={600 - h + 30 + k * 70} width={90} height={22} fill="none" stroke={a} strokeWidth={3} />)}
              <text x={x + 75} y={600 - h - 18} textAnchor="middle" fontSize={26} fill={a} opacity={rise(f, T.grow + 10 + i * 4, 10)}>{st.labels[i]}</text>
            </g>
          );
        })}
        <line x1={20} y1={602} x2={1380} y2={602} stroke={a} strokeWidth={5} />
      </svg>
      {mult && at(1540, 360, <div style={{ fontSize: 110, fontWeight: 700, color: a, letterSpacing: "-0.03em" }}>{mult}</div>, { opacity: rise(f, T.team, 12), transform: `translate(-50%, -50%) scale(${grow(f, T.team, 14)})` })}
    </>
  );
}

// A stopwatch: the hand sweeps a filling wedge; the lines beside it.
function stopwatch(c: BlockCtx) {
  const { f, L, pal } = c;
  const a = tAccent(pal);
  const sweep = ((f - c.from) / 90) % 1;
  const ang = sweep * 360;
  const wedge = (deg: number) => {
    const r = 150, t = (deg - 90) * (Math.PI / 180);
    return `M0 0 L0 ${-r} A${r} ${r} 0 ${deg > 180 ? 1 : 0} 1 ${Math.cos(t) * r} ${Math.sin(t) * r} Z`;
  };
  return (
    <>
      {at(620, 540, (
        <svg width={420} height={480} viewBox="-210 -250 420 480" style={{ transform: `scale(${grow(f, c.from, 18)})` }}>
          <rect x={-22} y={-245} width={44} height={40} fill={a} />
          <circle r={190} fill={a} />
          <circle r={160} fill="#9ae6e3" />
          <path d={wedge(Math.max(1, ang))} fill="#ffffff" />
          <line x1={0} y1={0} x2={Math.cos(((ang - 90) * Math.PI) / 180) * 130} y2={Math.sin(((ang - 90) * Math.PI) / 180) * 130} stroke={a} strokeWidth={10} strokeLinecap="round" />
          <circle r={14} fill={a} />
        </svg>
      ), { opacity: soft(f, c.from, 14) })}
      {abs(940, 380, <Say c={c} words={L.noA} size={64} weight={600} align="left" ink={a} style={{ width: 860 }} />)}
      {abs(940, 560, <Say c={c} words={L.noB} size={64} weight={600} align="left" ink={a} style={{ width: 860 }} />)}
    </>
  );
}

// The mark's box draws; the address types into a solid bar under it.
function urlbar(c: BlockCtx) {
  const { f, b, pal } = c;
  const t = c.from;
  const a = tAccent(pal);
  const url = b.brand.url || b.brand.name;
  const n = Math.max(0, Math.min(url.length, Math.floor((f - t - 16) / 1.2)));
  return (
    <>
      {at(W / 2, 380, (
        <div style={{ width: 210, height: 210, borderRadius: 18, border: `6px solid ${a}`, display: "flex", alignItems: "center", justifyContent: "center", clipPath: `inset(0 ${(1 - rise(f, t, 20, IN_OUT)) * 100}% 0 0)` }}>
          <FlowMark size={130} colors={["#24c6c0", a]} />
        </div>
      ))}
      {at(W / 2, 640, (
        <div style={{ minWidth: 200, height: 120, padding: "0 50px", background: a, color: "#fff", fontSize: 56, fontWeight: 600, display: "flex", alignItems: "center", whiteSpace: "nowrap", transform: `scaleX(${mix(0.2, 1, rise(f, t + 8, 14, OUT))})` }}>{url.slice(0, n)}</div>
      ))}
      {at(W / 2, 770, <div style={{ fontSize: 34, color: pal.sub }}>{b.brand.tagline}</div>, { opacity: soft(f, t + 34, 14) })}
    </>
  );
}

// ── Crimson (FSS) ─────────────────────────────────────────────────────────

// A shop front lit red; the three things come up as glossy bubbles around it.
function storefront(c: BlockCtx) {
  const { f, b } = c;
  const k = soft(f, c.from, 22);
  const stripes = 9;
  const spots = [[520, 330], [1400, 330], [960, 170]];
  return (
    <>
      {at(W / 2, 640, (
        <svg width={760} height={560} viewBox="0 0 760 560" style={{ transform: `scale(${mix(0.85, 1, k)})` }}>
          <defs>
            <linearGradient id="r3glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1418" /><stop offset="1" stopColor="#c3132a" /></linearGradient>
          </defs>
          <rect x={90} y={210} width={580} height={300} fill="#141015" />
          <rect x={120} y={250} width={340} height={230} fill="url(#r3glass)" opacity={0.85} />
          {[1, 2, 3].map((i) => <line key={i} x1={120 + i * 85} y1={250} x2={120 + i * 85} y2={480} stroke="#ffd0d5" strokeWidth={3} opacity={0.6} />)}
          <line x1={120} y1={365} x2={460} y2={365} stroke="#ffd0d5" strokeWidth={3} opacity={0.6} />
          <rect x={500} y={270} width={130} height={240} fill="url(#r3glass)" opacity={0.7} stroke="#ffd0d5" strokeWidth={3} />
          {Array.from({ length: stripes }, (_, i) => (
            <path key={i} d={`M${40 + i * (680 / stripes)} 210 L${70 + i * (620 / stripes)} 70 L${70 + (i + 1) * (620 / stripes)} 70 L${40 + (i + 1) * (680 / stripes)} 210 Z`} fill={i % 2 ? "#f4f0f1" : "#d8102a"} />
          ))}
          {Array.from({ length: stripes }, (_, i) => <path key={i} d={`M${40 + i * (680 / stripes)} 210 a${680 / stripes / 2} 36 0 0 0 ${680 / stripes} 0 Z`} fill={i % 2 ? "#f4f0f1" : "#d8102a"} />)}
          <rect x={60} y={510} width={640} height={14} fill="#2a0a10" />
        </svg>
      ), { opacity: k })}
      {b.trio.map((x, i) => {
        const kk = soft(f, x.at - 6, 16);
        return at(spots[i][0], spots[i][1] + Math.sin(f / 30 + i) * 8, (
          <Sphere size={240} pal={c.pal}>
            <div style={{ textAlign: "center", color: "#fff", width: 200 }}>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{x.label}</div>
              <div style={{ fontSize: 22, opacity: 0.85 }}>{x.sub}</div>
            </div>
          </Sphere>
        ), { opacity: kk, transform: `translate(-50%, -50%) scale(${mix(0.4, 1, kk)})` }, x.label);
      })}
    </>
  );
}

// The mark in a white rounded diamond; lines of light run in from both
// sides; what it brings is typed under it.
function diamond(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const k = soft(f, T.flowly - 10, 18);
  const lines = rise(f, T.flowly - 16, 30, OUT);
  return (
    <>
      <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const y = 300 + i * 50;
          const side = i % 2 ? 1 : -1;
          return <path key={i} d={side < 0 ? `M -40 ${y} C 500 ${y}, 700 460, 880 460` : `M 1960 ${y} C 1420 ${y}, 1220 460, 1040 460`} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} fill="none" pathLength={1} strokeDasharray={`${lines} 1`} />;
        })}
      </svg>
      {at(W / 2, 460, (
        <div style={{ width: 240, height: 240, borderRadius: 44, background: "#ffffff", transform: `rotate(45deg) scale(${mix(0.5, 1, k)})`, boxShadow: `0 0 0 14px rgba(255,255,255,0.12), 0 0 90px ${pal.glow}aa`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: "rotate(-45deg)" }}><FlowMark size={130} colors={[pal.accent2, pal.accent]} /></div>
        </div>
      ), { opacity: k })}
      {at(W / 2, 720, <div style={{ fontSize: 76, fontWeight: 700, color: pal.ink, letterSpacing: "-0.02em" }}>{b.brand.name}</div>, { opacity: soft(f, T.flowly, 14) })}
      {at(W / 2, 830, <TypeIn f={f} words={L.reveal} size={44} pal={pal} weight={500} caret={false} />)}
    </>
  );
}

// A phone with the figure counting up and a LIVE badge that pops.
function live(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const m = C.metric;
  const k = soft(f, c.from, 18);
  const badge = rise(f, T.updates - 4, 12, OUT);
  return (
    <>
      {abs(150, 300, <Say c={c} words={L.payA} size={64} weight={650} align="left" style={{ width: 560 }} />)}
      {abs(150, 520, <Say c={c} words={L.payB} size={64} weight={650} align="left" style={{ width: 560 }} />)}
      {at(1180, 560, (
        <div style={{ position: "relative", width: 460, height: 860, borderRadius: 64, background: "linear-gradient(170deg, #3a3238, #0d0a0d 40%)", border: "3px solid #4a4046", boxShadow: "0 60px 140px rgba(0,0,0,0.6)", padding: "70px 40px", boxSizing: "border-box", transform: `translateY(${(1 - k) * 160}px)` }}>
          <div style={{ position: "absolute", left: 170, top: 26, width: 120, height: 30, borderRadius: 99, background: "#000", border: "2px solid #333" }} />
          <div style={{ fontSize: 34, color: "#fff", fontWeight: 600 }}>{m.label}</div>
          <div style={{ fontSize: 120, color: "#fff", fontWeight: 750, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{show(m.unit, count(f, T.payment - 4, 50, m.from, m.to))}</div>
          {[0, 1, 2].map((i) => <div key={i} style={{ display: "inline-block", marginTop: 26, marginRight: 14, width: [120, 70, 110][i], height: 22, borderRadius: 99, background: "#2a2328" }} />)}
          <div style={{ marginTop: 40, height: 180, borderRadius: 26, background: "#1b1619", padding: 24, boxSizing: "border-box" }}>
            <div style={{ fontSize: 24, color: "#fff" }}>{C.event.label}</div>
            <div style={{ fontSize: 20, color: pal.sub }}>{C.event.source} · {C.event.detail}</div>
          </div>
          <div style={{ position: "absolute", right: -90, top: -60, transform: `scale(${mix(0.2, 1, badge)})`, opacity: badge }}>
            <Sphere size={190} pal={pal}><span style={{ fontSize: 50, fontWeight: 800, color: "#fff" }}>LIVE</span></Sphere>
          </div>
        </div>
      ))}
    </>
  );
}

// The growth figure huge, counting, with red shards bursting behind it.
function bignum(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const g = C.growth;
  const burst = rise(f, T.grow - 8, 30, OUT);
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + i;
        const r = mix(60, 760, burst) * (0.6 + (i % 4) * 0.15);
        const s = 40 + (i % 5) * 26;
        return <div key={i} style={{ position: "absolute", left: 960 + Math.cos(a) * r - s / 2, top: 540 + Math.sin(a) * r * 0.6 - s / 2, width: s, height: s, background: "linear-gradient(140deg, #ff4a5c, #a80a1e)", transform: `rotate(${i * 37 + f * (i % 2 ? 1 : -1)}deg)`, clipPath: i % 3 ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined, opacity: (1 - burst * 0.4) * soft(f, T.grow - 8, 8) }} />;
      })}
      {at(W / 2, 470, <div style={{ fontSize: 230, fontWeight: 800, letterSpacing: "-0.04em", color: pal.accent, textShadow: `0 0 80px ${pal.glow}88` }}>{show(g.unit, count(f, T.grow - 4, 44, g.from, g.to))}<span style={{ fontSize: 160 }}> +</span></div>)}
      {at(W / 2, 650, <div style={{ fontSize: 56, fontWeight: 650, color: pal.ink }}>{g.label}</div>, { opacity: soft(f, T.grow + 6, 14) })}
      {at(W / 2, 140, <div style={{ display: "flex", gap: 18 }}><Say c={c} words={L.growA} size={54} weight={600} /><Say c={c} words={L.growB} size={54} weight={600} /></div>)}
    </>
  );
}

// A flood of warning cards fills the frame; on the second line they fall
// away and one green card remains.
function flood(c: BlockCtx) {
  const { f, L, b, C, pal } = c;
  const clear = rise(f, (L.noB[0]?.at ?? c.from + 50) - 4, 20, IN_OUT);
  const labels = [...b.trio.map((x) => `${x.label} — ${x.sub}`), C.event.label, ...C.rows.map((r) => r.name)];
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => {
        const x = 80 + ((i * 397) % 1700), y = 120 + ((i * 251) % 820);
        const k = soft(f, c.from + i * 2, 12);
        const red = i % 3 !== 1;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y + clear * (300 + (i % 4) * 120), width: 300 + (i % 3) * 40, padding: "18px 22px", borderRadius: 18, background: red ? "linear-gradient(150deg, #e3162d, #9a0c1d)" : "linear-gradient(150deg, #4a4247, #1f1a1e)", color: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.5)", opacity: k * (1 - clear), transform: `rotate(${((i % 5) - 2) * 3}deg) scale(${mix(0.8, 1, k)})`, filter: i % 4 === 0 ? "blur(2px)" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700 }}><Icon name="triangle-alert" size={24} color="#fff" />{clip(labels[i % labels.length] ?? "", 22)}</div>
            <div style={{ marginTop: 10, height: 10, width: "80%", borderRadius: 9, background: "rgba(255,255,255,0.35)" }} />
          </div>
        );
      })}
      {at(W / 2, 140, <div style={{ padding: "16px 34px", borderRadius: 20, background: "rgba(0,0,0,0.55)" }}><Say c={c} words={clear < 0.5 ? L.noA : L.noB} size={58} weight={650} /></div>, { zIndex: 5 })}
      {at(W / 2, 580, (
        <div style={{ width: 640, padding: "40px 46px", borderRadius: 30, ...card(pal, 30), display: "flex", alignItems: "center", gap: 26 }}>
          <div style={{ width: 110, height: 110, borderRadius: 99, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={66} color="#fff" strokeWidth={3} /></div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 700 }}>All clear</div>
            <div style={{ fontSize: 26, color: pal.panelSub }}>{C.event.done}</div>
          </div>
        </div>
      ), { opacity: rise(f, (L.noB[0]?.at ?? c.from + 50) + 8, 14), transform: `translate(-50%, -50%) scale(${grow(f, (L.noB[0]?.at ?? c.from + 50) + 8, 16)})` })}
    </>
  );
}

// A checkout card: red light sweeps across it, then a tick.
function checkout(c: BlockCtx) {
  const { f, T, L, b, C } = c;
  const sweep = rise(f, T.every2 - 8, 26, IN_OUT);
  const done = rise(f, T.answer + 6, 12, OUT);
  const field = (label: string, value: string) => (
    <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
      <span style={{ width: 260, fontSize: 26, color: "rgba(255,255,255,0.75)" }}>{label}</span>
      <span style={{ flex: 1, height: 52, borderRadius: 99, border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", padding: "0 22px", fontSize: 24, color: "#fff" }}>{value}</span>
    </div>
  );
  return (
    <>
      {at(W / 2, 150, <Say c={c} words={L.cta} size={60} weight={600} style={{ maxWidth: 1500 }} />)}
      {at(W / 2, 600, (
        <div style={{ position: "relative", width: 900, padding: "44px 54px", borderRadius: 40, overflow: "hidden", background: "linear-gradient(150deg, #8a8487, #3a3437 45%, #1c181b)", border: "2px solid rgba(255,255,255,0.25)", boxShadow: "0 50px 120px rgba(0,0,0,0.55)", transform: `scale(${grow(f, c.from, 18)})` }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(150deg, #ff5b6c, #d8102a 50%, #6d0712)", clipPath: `inset(0 0 0 ${(1 - sweep) * 100}%)` }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: "#fff" }}>{b.brand.cta}</div>
            {field(C.metric.label, show(C.metric.unit, C.metric.to))}
            {field(C.event.label, C.event.detail)}
            <div style={{ marginTop: 34, height: 64, borderRadius: 99, background: "rgba(255,255,255,0.92)", color: "#b00c20", fontSize: 28, fontWeight: 750, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              {done > 0.5 ? <><Icon name="check" size={30} color="#b00c20" strokeWidth={3} />Done</> : b.brand.cta}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// The mark (a bolt) in a glowing sphere with three orbits and electrons;
// the closing line above and below.
function atom(c: BlockCtx) {
  const { f, L, pal } = c;
  const k = soft(f, c.from, 22);
  return (
    <>
      <svg width={900} height={700} viewBox="-450 -350 900 700" style={{ position: "absolute", left: 510, top: 190, opacity: k, overflow: "visible" }}>
        {[0, 60, 120].map((rot, i) => {
          const a = f / (20 + i * 6) + i * 2;
          return (
            <g key={rot} transform={`rotate(${rot})`}>
              <ellipse rx={360} ry={120} fill="none" stroke={pal.glow} strokeOpacity={0.7} strokeWidth={4} />
              <circle cx={Math.cos(a) * 360} cy={Math.sin(a) * 120} r={14} fill="#fff" />
            </g>
          );
        })}
      </svg>
      {at(W / 2, 540, <Sphere size={240} pal={pal}><FlowMark size={120} colors={["#fff", "#fff"]} plain /></Sphere>, { opacity: k, transform: `translate(-50%, -50%) scale(${mix(0.5, 1, k)})` })}
      {at(W / 2, 130, <Say c={c} words={L.ctaA} size={64} weight={650} />)}
      {at(W / 2, 960, <Say c={c} words={L.ctaB} size={64} weight={650} />)}
    </>
  );
}

// The mark in a glossy sphere; the name; the promise typed; the address.
function glossy(c: BlockCtx) {
  const { f, b, pal } = c;
  const t = c.from;
  const tag = b.brand.tagline;
  const n = Math.max(0, Math.min(tag.length, Math.floor((f - t - 18) / 1.1)));
  return (
    <>
      {at(W / 2, 360, <Sphere size={230} pal={pal}><FlowMark size={120} colors={["#fff", "#fff"]} plain /></Sphere>, { opacity: soft(f, t, 16), transform: `translate(-50%, -50%) scale(${grow(f, t, 18)})` })}
      {at(W / 2, 590, <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.03em", color: pal.ink }}>{b.brand.name}</div>, { opacity: soft(f, t + 8, 14) })}
      {at(W / 2, 700, <div style={{ fontSize: 38, color: pal.sub, whiteSpace: "nowrap" }}>{tag.slice(0, n)}</div>)}
      {at(W / 2, 790, <div style={{ fontSize: 30, color: pal.accent2 }}>{b.brand.url}</div>, { opacity: soft(f, t + 40, 14) })}
    </>
  );
}

export const R3: Block[] = [
  { id: "hook.tunnel", role: "hook", name: "Rings of light, question typed", from: "Kitaabh", draw: tunnel },
  { id: "trio.circuit", role: "trio", name: "Dots branch into lines", from: "Assembly", draw: circuit },
  { id: "trio.storefront", role: "trio", name: "Shop front + glossy bubbles", from: "FSS", draw: storefront },
  { id: "reveal.searchwin", role: "reveal", name: "Name over a rising search window", from: "Kitaabh", draw: searchwin, obj: () => ({ a: box(960, 640, 1200, 560, 36, "card"), z: box(960, 640, 1200, 560, 36, "card") }) },
  { id: "reveal.diagram", role: "reveal", name: "Mark in a disc → card · mark · building", from: "Assembly", draw: diagram, obj: () => ({ a: box(960, 470, 260, 260, 130, "glass") }) },
  { id: "reveal.diamond", role: "reveal", name: "Mark in a diamond, lines converge", from: "FSS", draw: diamond, obj: () => ({ a: box(960, 460, 240, 240, 44, "glass") }) },
  { id: "pay.query", role: "pay", name: "Tilted search → bars face camera", from: "Kitaabh", draw: query, obj: () => ({ z: box(960, 600, 1100, 460, 30, "card") }) },
  { id: "pay.route", role: "pay", name: "Coin runs, line branches, ticks", from: "Assembly", draw: route },
  { id: "pay.live", role: "pay", name: "Phone counts, LIVE pops", from: "FSS", draw: live, obj: () => ({ a: box(1180, 560, 460, 860, 64, "dark"), z: box(1180, 560, 460, 860, 64, "dark") }) },
  { id: "growth.donut", role: "growth", name: "Ring chart with labels", from: "Kitaabh", draw: donut, obj: () => ({ a: box(960, 590, 520, 520, 260, "glass") }) },
  { id: "growth.city", role: "growth", name: "Buildings rise", from: "Assembly", draw: city },
  { id: "growth.bignum", role: "growth", name: "Huge figure, shards burst", from: "FSS", draw: bignum },
  { id: "nomore.reconcile", role: "nomore", name: "Missing → Matched", from: "Kitaabh", draw: reconcile, obj: () => ({ a: box(960, 600, 1300, 520, 30, "white"), z: box(960, 600, 1300, 520, 30, "white") }) },
  { id: "nomore.stopwatch", role: "nomore", name: "Stopwatch sweeps", from: "Assembly", draw: stopwatch, obj: () => ({ a: box(620, 560, 380, 380, 190, "accent"), z: box(620, 560, 380, 380, 190, "accent") }) },
  { id: "nomore.flood", role: "nomore", name: "Warnings flood, one tick stays", from: "FSS", draw: flood, obj: () => ({ z: box(960, 580, 640, 190, 30, "card") }) },
  { id: "cta.checkout", role: "cta", name: "Checkout card, red sweep, Done", from: "FSS", draw: checkout, obj: () => ({ a: box(960, 600, 900, 470, 40, "dark"), z: box(960, 600, 900, 470, 40, "accent") }) },
  { id: "cta.atom", role: "cta", name: "Mark in a sphere with orbits", from: "FSS", draw: atom, obj: () => ({ a: box(960, 540, 240, 240, 120, "accent"), z: box(960, 540, 240, 240, 120, "accent") }) },
  { id: "end.wipe", role: "end", name: "Name from behind the mark, light runs", from: "Kitaabh", draw: wipeEnd, obj: () => ({ a: box(960, 640, 700, 80, 40, "glass") }) },
  { id: "end.urlbar", role: "end", name: "Mark box, address in a bar", from: "Assembly", draw: urlbar, obj: () => ({ a: box(960, 380, 210, 210, 18, "glass") }) },
  { id: "end.glossy", role: "end", name: "Mark in a glossy sphere", from: "FSS", draw: glossy, obj: () => ({ a: box(960, 360, 230, 230, 115, "accent") }) },
];
