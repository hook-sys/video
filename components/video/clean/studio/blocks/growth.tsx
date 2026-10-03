import { Icon } from "../../../icons";
import { count, IN_OUT, mix, OUT, rise } from "../../anim";
import { pct, show, steps } from "../../content";
import { abs, Area, AppWindow, at, BarsV, Check, glide, grow, Kpi, Person, Pointer, soft, W } from "../../refs/common";
import { appTone, type Block, type BlockCtx, card, Say } from "../kit";

// Growth, seen by the whole team (initials only).
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9"];
const initials = (c: BlockCtx, n = 5) => [...c.C.people.map((p) => p.name), c.C.event.source, ...c.C.rows.map((r) => r.name)].slice(0, n);

// From Glow: a big bar card the camera leans into; beside it a glass toggle
// that brings the team in, the line under it.
function bars(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const on = rise(f, T.team - 4, 20, IN_OUT);
  const st = steps(C.growth);
  return (
    <>
      {abs(120, 100, <Say c={c} words={L.growA} size={58} align="left" />)}
      {abs(100, 230, (
        <div style={{ width: 1000, height: 620, ...card(pal, 34), padding: 42, boxSizing: "border-box", transform: "perspective(2000px) rotateY(-8deg) rotateX(5deg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 99, background: pal.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trending-up" size={30} color="#fff" strokeWidth={2.6} /></div>
            <span style={{ fontSize: 40, fontWeight: 650, letterSpacing: "-0.02em" }}>{C.growth.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 30, fontWeight: 700, color: pal.accent }}>{`+${count(f, T.grow, 40, 0, pct(C.growth))}%`}</span>
          </div>
          <div style={{ marginTop: 36 }}>
            <BarsV w={916} h={420} values={st.values} grow={rise(f, T.grow - 4, 40, OUT)} base={0.3} color={pal.accent} sub={pal.panelSub} labels={st.labels} />
          </div>
        </div>
      ))}
      {abs(1200, 400, (
        <div style={{ width: mix(150, 600, on), height: 140, borderRadius: 999, padding: 12, boxSizing: "border-box", background: pal.dark ? `linear-gradient(180deg, ${pal.glass}3d, ${pal.glass}14)` : "#ffffff", border: `1.5px solid ${pal.dark ? `${pal.glass}77` : pal.line}`, boxShadow: pal.dark ? "0 30px 80px rgba(0,0,0,0.35)" : "0 30px 80px rgba(40,40,110,0.14)", display: "flex", alignItems: "center", overflow: "hidden" }}>
          <div style={{ width: 116, height: 116, borderRadius: 999, backgroundColor: pal.accent, backgroundImage: `radial-gradient(circle at 40% 35%, #fff, ${pal.accent2} 30%, ${pal.accent} 75%)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 99, background: "#fff", opacity: 0.5 + 0.5 * Math.sin(f / 5 - i) }} />)}
          </div>
          <div style={{ display: "flex", gap: 12, marginLeft: 18 }}>
            {initials(c, 4).map((n, i) => (
              <div key={n} style={{ opacity: soft(f, T.entire + i * 4, 14), transform: `scale(${grow(f, T.entire + i * 4, 16)})` }}><Person letter={n[0]} size={96} color={COLORS[i]} ring="#fff" /></div>
            ))}
          </div>
        </div>
      ), { opacity: soft(f, T.entire - 8, 14) })}
      {abs(1200, 600, <Say c={c} words={L.growB} size={52} align="left" style={{ width: 620 }} />)}
    </>
  );
}

// From Dusk: a sparkle and the words; the tilted dashboard rises; the team
// list ticks one by one.
function dashboard(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const up = rise(f, T.grow - 2, 24, IN_OUT);
  const team = rise(f, T.change - 10, 20, OUT);
  const tone = appTone(pal);
  const g = rise(f, T.grow, 40, OUT);
  const pts = [0.2, 0.28, 0.24, 0.36, 0.34, 0.46, 0.5, 0.62, 0.7, 0.86].map((v, i, a) => [i * (620 / (a.length - 1)), 230 - v * g * 210]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <>
      {at(mix(W / 2, 400, up), mix(540, 120, up), <div style={{ transform: `scale(${mix(1, 0.62, up)})`, display: "flex", alignItems: "center", gap: 30 }}><Say c={c} words={L.growA} size={100} weight={500} /><svg width={90} height={90} viewBox="-50 -50 100 100" style={{ opacity: soft(f, c.from + 2, 20) }}><path d="M0 -48 C6 -10 10 -6 48 0 C10 6 6 10 0 48 C-6 10 -10 6 -48 0 C-10 -6 -6 -10 0 -48 Z" fill={pal.accent} /></svg></div>)}
      <div style={{ position: "absolute", left: 90, top: mix(1100, 260, up), transform: "perspective(1800px) rotateY(-18deg) rotateX(12deg) rotateZ(-2deg)", transformOrigin: "30% 50%" }}>
        <AppWindow w={1150} h={720} tone={tone} active={1} title={c.b.trio[0]?.label}>
          <div style={{ display: "flex", gap: 18 }}>
            <Kpi tone={tone} w={320} label={C.growth.label} value={show(C.growth.unit, count(f, T.grow, 40, C.growth.from, C.growth.to))} delta={`+${pct(C.growth)}%`} />
            {C.side.map((x) => <Kpi key={x.label} tone={tone} w={260} label={x.label} value={x.value} />)}
          </div>
          <div style={{ marginTop: 22, borderRadius: 16, border: `1px solid ${tone.line}`, padding: 20, width: 660 }}>
            <svg width={620} height={240}>
              <path d={`${d} L620 240 L0 240 Z`} fill={`${pal.accent}1f`} />
              <path d={d} stroke={pal.accent} strokeWidth={4} fill="none" />
            </svg>
          </div>
        </AppWindow>
      </div>
      {abs(mix(1960, 1250, team), 300, (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {C.people.slice(0, 3).map((p, i) => {
            const cue = [T.change - 2, T.change + 8, T.view - 4][i];
            return (
              <div key={p.name} style={{ width: 560, display: "flex", alignItems: "center", gap: 20, padding: "18px 26px", ...card(pal, 18), opacity: soft(f, cue - 8, 18) }}>
                <Person letter={p.name[0]} size={60} color={COLORS[i]} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 26, fontWeight: 650 }}>{p.name}</div>
                  <div style={{ fontSize: 21, color: pal.panelSub }}>{p.role}</div>
                </div>
                <Check size={44} color="#22c983" k={soft(f, cue, 16)} />
              </div>
            );
          })}
        </div>
      ))}
      {abs(1250, 760, <Say c={c} words={L.growB2} size={46} weight={500} align="left" style={{ width: 580 }} />)}
    </>
  );
}

// From Fly: the camera on the chart as it rises (a dot riding the line), then
// it pulls back to the team table ticking "seen".
function chart(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const back = rise(f, T.entire - 4, 30, IN_OUT);
  const [px, py] = glide(f, [[T.when2, 300, 520], [T.grow + 30, 1300, 300]]);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${mix(1.18, 0.86, back)})`, transformOrigin: `960px ${mix(420, 560, back)}px` }}>
        <div style={{ position: "absolute", left: 260, top: 180, width: 1400, height: 520, ...card(pal, 24), padding: 32, boxSizing: "border-box" }}>
          <div style={{ fontSize: 24, color: pal.panelSub }}>{C.growth.label}</div>
          <div style={{ fontSize: 52, fontWeight: 700, marginTop: 4 }}>{show(C.growth.unit, count(f, T.grow, 40, C.growth.from, C.growth.to))} <span style={{ fontSize: 22, color: "#16a34a", background: "#16a34a18", padding: "4px 12px", borderRadius: 99 }}>+{count(f, T.grow, 40, 0, pct(C.growth))}%</span></div>
          <div style={{ marginTop: 26 }}>
            <Area w={1330} h={290} draw={rise(f, c.from, 30, OUT)} color={pal.accent} pts={[0.18, 0.22, 0.2, 0.3, 0.27, 0.36, 0.34, 0.4, 0.38, 0.46, 0.5, 0.56]} lift={rise(f, T.grow, 40, OUT) * 3.2} dot />
          </div>
          <Pointer x={px} y={py} dot />
        </div>
        <div style={{ position: "absolute", left: 260, top: 730, width: 1400, ...card(pal, 24), overflow: "hidden" }}>
          {C.people.map((p, i) => {
            const cue = [T.entire, T.team, T.change - 6, T.change + 2][i];
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 20, padding: "0 30px", height: 96, borderTop: i ? `1px solid ${pal.line}` : undefined, fontSize: 24 }}>
                <Person letter={p.name[0]} size={56} color={COLORS[i]} />
                <span style={{ width: 380, fontWeight: 650 }}>{p.name}</span>
                <span style={{ flex: 1, color: pal.panelSub }}>{p.role}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, color: "#16a34a", fontWeight: 650, opacity: rise(f, cue, 10) }}><Check size={34} color="#22c55e" k={soft(f, cue, 14)} />Seen</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 200, background: `linear-gradient(180deg, ${pal.dark ? "rgba(0,0,0,0.55)" : "rgba(246,248,252,0.96)"} 55%, transparent)` }} />
      {at(W / 2, 90, <Say c={c} words={back < 0.5 ? L.growA : L.growB} size={56} weight={500} from="up" />)}
    </>
  );
}

// From Connect: a LIVE card — the chart rises, the team's initials join.
function live(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  return (
    <>
      {at(W / 2, 150, <Say c={c} words={L.growA} size={66} weight={500} />)}
      {at(W / 2, 540, (
        <div style={{ width: 1180, ...card(pal, 28), padding: "36px 44px", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, color: "#16a34a" }}><span style={{ width: 12, height: 12, borderRadius: 99, background: "#16a34a", opacity: 0.5 + 0.5 * Math.sin(f / 4) }} />LIVE</span>
            <span style={{ fontSize: 34, fontWeight: 650 }}>{C.growth.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 40, fontWeight: 700 }}>{show(C.growth.unit, count(f, T.grow, 34, C.growth.from, C.growth.to))}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", background: "#16a34a16", padding: "4px 12px", borderRadius: 99 }}>+{count(f, T.grow, 34, 0, pct(C.growth))}%</span>
          </div>
          <div style={{ marginTop: 26 }}>
            <Area w={1090} h={230} draw={rise(f, c.from + 4, 24)} color={pal.accent} pts={[0.2, 0.26, 0.22, 0.32, 0.3, 0.38, 0.36, 0.42, 0.46, 0.5]} lift={rise(f, T.grow, 34, OUT) * 3.4} dot />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, borderTop: `1px solid ${pal.line}`, paddingTop: 22 }}>
            <div style={{ display: "flex" }}>
              {initials(c, 6).map((n, i) => (
                <div key={n} style={{ marginLeft: i ? -14 : 0, opacity: soft(f, T.entire + i * 3, 12), transform: `scale(${grow(f, T.entire + i * 3, 16)})` }}><Person letter={n[0]} size={58} color={COLORS[i]} ring="#fff" /></div>
              ))}
            </div>
            <Say c={c} words={L.growB} size={32} weight={500} align="left" ink={pal.panelInk} />
          </div>
        </div>
      ))}
    </>
  );
}

// New: a ring fills to the growth with the figure inside; the team sits
// around it and lights up as it is named.
function ring(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const fill = rise(f, T.grow - 2, 40, OUT);
  const R = 230;
  const C2 = 2 * Math.PI * R;
  const ppl = initials(c, 6);
  return (
    <>
      {at(W / 2, 120, <Say c={c} words={L.growA} size={60} weight={600} />)}
      {at(W / 2, 520, (
        <div style={{ position: "relative", width: 640, height: 640 }}>
          <svg width={640} height={640} viewBox="-320 -320 640 640" style={{ position: "absolute", inset: 0 }}>
            <circle r={R} fill="none" stroke={pal.dark ? "rgba(255,255,255,0.12)" : `${pal.accent}1c`} strokeWidth={34} />
            <circle r={R} fill="none" stroke={pal.accent} strokeWidth={34} strokeLinecap="round" strokeDasharray={`${fill * Math.min(0.92, 0.35 + pct(C.growth) / 100) * C2} ${C2}`} transform="rotate(-90)" style={{ filter: `drop-shadow(0 0 18px ${pal.glow}88)` }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ fontSize: 26, color: pal.sub, fontWeight: 600 }}>{C.growth.label}</div>
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.04em", color: pal.ink, fontVariantNumeric: "tabular-nums" }}>{show(C.growth.unit, count(f, T.grow, 40, C.growth.from, C.growth.to))}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#16a34a" }}>+{count(f, T.grow, 40, 0, pct(C.growth))}%</div>
          </div>
          {ppl.map((n, i) => {
            const a = -Math.PI / 2 + (i / ppl.length) * Math.PI * 2 + f / 240;
            const lit = soft(f, T.entire + i * 5, 14);
            return (
              <div key={n} style={{ position: "absolute", left: 320 + Math.cos(a) * 300 - 40, top: 320 + Math.sin(a) * 300 - 40, opacity: 0.35 + 0.65 * lit, transform: `scale(${mix(0.8, 1, lit)})`, filter: lit < 1 ? `grayscale(${1 - lit})` : undefined }}>
                <Person letter={n[0]} size={80} color={COLORS[i]} ring={lit > 0.5 ? "#fff" : undefined} />
              </div>
            );
          })}
        </div>
      ))}
      {at(W / 2, 960, <Say c={c} words={L.growB} size={46} weight={500} />)}
    </>
  );
}

export const GROWTH_BLOCKS: Block[] = [
  { id: "growth.bars", role: "growth", name: "Bar card + team toggle", from: "Glow", draw: bars },
  { id: "growth.dashboard", role: "growth", name: "Sparkle → dashboard → team", from: "Dusk", draw: dashboard },
  { id: "growth.chart", role: "growth", name: "Chart, then the team table", from: "Fly", draw: chart },
  { id: "growth.live", role: "growth", name: "LIVE card", from: "Connect", draw: live },
  { id: "growth.ring", role: "growth", name: "Ring gauge + team around it", from: "new", draw: ring },
];
