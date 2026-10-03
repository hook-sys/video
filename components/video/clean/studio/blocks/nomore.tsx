import { Icon } from "../../../icons";
import { IN_OUT, mix, OUT, rise } from "../../anim";
import { abs, AppWindow, at, Check, grow, Kpi, Person, soft, W } from "../../refs/common";
import { keyAt, strikeKey } from "../../refs/beats";
import { appTone, type Block, type BlockCtx, Say } from "../kit";
import { TOOLS, Win } from "./parts";

// Two "no more" lines: what stops.

// From Glow: the keyword in the look's mark; the second line swaps in.
function swap(c: BlockCtx) {
  const { f, T, L } = c;
  const sw = rise(f, T.no2 - 6, 14, IN_OUT);
  return (
    <>
      {at(W / 2, 540 - sw * 90, <Say c={c} words={L.noA} size={78} />, { opacity: 1 - sw, filter: `blur(${sw * 14}px)` })}
      {sw > 0 && at(W / 2, 540 + (1 - sw) * 90, <Say c={c} words={L.noB} size={78} />)}
    </>
  );
}

// From Dusk: the first line in a glowing pill, its word struck; then a ring
// fills to a check under the second line.
function ring(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const sw = rise(f, T.no2 - 8, 14, IN_OUT);
  const r = rise(f, T.no2 - 2, 34, IN_OUT);
  const C2 = 2 * Math.PI * 110;
  return (
    <>
      {at(W / 2, 540, (
        <div style={{ padding: "30px 64px", borderRadius: 999, background: `linear-gradient(180deg, ${pal.accent2}, ${pal.accent})`, boxShadow: `0 0 0 10px ${pal.accent}18, 0 0 90px ${pal.accent}aa`, transform: `scale(${grow(f, c.from + 4, 18)})` }}>
          <Say c={c} words={strikeKey(L.noA)} size={64} weight={500} ink="#fff" />
        </div>
      ), { opacity: soft(f, c.from + 2, 18) * (1 - sw), filter: `blur(${sw * 14}px)` })}
      {sw > 0 && (
        <>
          {at(W / 2, 420, (
            <svg width={280} height={280} viewBox="-140 -140 280 280">
              <circle r={110} fill="none" stroke={`${pal.glow}33`} strokeWidth={14} />
              <circle r={110} fill="none" stroke={pal.glow} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${r * C2} ${C2}`} transform="rotate(-90)" style={{ filter: `drop-shadow(0 0 12px ${pal.glow})` }} />
              <path d="M-42 4 L-12 34 L46 -30" stroke={pal.glow} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${rise(f, T.no2 + 30, 12)} 1`} />
            </svg>
          ), { opacity: sw })}
          {at(W / 2, 700, <Say c={c} words={keyAt(L.noB, -1)} size={66} weight={500} />)}
        </>
      )}
    </>
  );
}

// From Fly: the product pulled back and tilted, headlines over a soft veil.
function veil(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const tone = appTone(pal);
  const sw = T.no2 - 6;
  return (
    <>
      <div style={{ position: "absolute", left: 260, top: 330, transform: `perspective(2200px) rotateX(${mix(24, 16, rise(f, c.from, 100, IN_OUT))}deg) rotateZ(${mix(-3, 1, rise(f, c.from, 100, IN_OUT))}deg)`, transformOrigin: "50% 0" }}>
        <AppWindow w={1400} h={760} tone={tone}>
          <div style={{ display: "flex", gap: 18 }}>
            <Kpi tone={tone} w={340} label={C.metric.label} value={`${C.metric.unit === "$" ? "$" : ""}${C.metric.to.toLocaleString("en-US")}`} />
            {C.side.map((x) => <Kpi key={x.label} tone={tone} w={300} label={x.label} value={x.value} />)}
          </div>
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            {c.b.trio.map((x) => (
              <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, border: `1px solid ${tone.line}`, fontSize: 20 }}>
                <Icon name={x.icon} size={24} color={tone.accent} />
                <span style={{ flex: 1, fontWeight: 600 }}>{x.label}</span>
                <span style={{ color: "#16a34a", fontWeight: 650, fontSize: 16 }}>Live</span>
              </div>
            ))}
          </div>
        </AppWindow>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 330, background: `linear-gradient(180deg, ${pal.dark ? "rgba(0,0,0,0.6)" : "rgba(246,248,252,0.97)"} 60%, transparent)` }} />
      {f < sw + 4 && at(W / 2, 160, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Say c={c} words={L.noA1} size={68} weight={500} ink={pal.accent} from="up" />
          <Say c={c} words={L.noA2} size={68} weight={500} from="up" />
        </div>
      ), { opacity: 1 - rise(f, sw - 2, 6) })}
      {f >= sw - 2 && at(W / 2, 160, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Say c={c} words={L.noB1} size={68} weight={500} ink={pal.accent} from="up" />
          <Say c={c} words={L.noB2} size={68} weight={500} from="up" />
        </div>
      ))}
    </>
  );
}

// From Connect: the app's rows tick from "Waiting" to "Live" as each thing
// is said, under the headline.
function board(c: BlockCtx) {
  const { f, T, L, C, b, pal } = c;
  const tone = appTone(pal);
  const rows = [
    { n: b.trio[0]?.label ?? "", s: "Synced automatically", at: T.switching + 4 },
    { n: b.trio[1]?.label ?? "", s: "Synced automatically", at: T.between + 2 },
    { n: b.trio[2]?.label ?? "", s: "Built automatically", at: T.waiting + 4 },
    { n: "Team", s: "Everyone sees the same view", at: T.reports2 + 4 },
  ];
  const sw = T.no2 - 6;
  return (
    <>
      {at(W / 2, 720, (
        <div style={{ transform: `perspective(2200px) rotateX(${mix(26, 14, rise(f, c.from, 120, IN_OUT))}deg) scale(0.86)` }}>
          <AppWindow w={1600} h={900} tone={tone} title="All in one place">
            <div style={{ borderRadius: 18, border: `1px solid ${tone.line}`, overflow: "hidden" }}>
              {rows.map((r, i) => {
                const done = f >= r.at;
                return (
                  <div key={r.n + i} style={{ display: "flex", alignItems: "center", gap: 16, height: 84, padding: "0 24px", borderTop: i ? `1px solid ${tone.line}` : undefined, fontSize: 21 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, border: `2px solid ${done ? tone.accent : "#c9cbdb"}`, background: done ? tone.accent : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>{done && <Icon name="check" size={18} color="#fff" strokeWidth={3} />}</div>
                    <Person letter={r.n[0] ?? "•"} size={44} color={["#2563eb", "#7c3aed", "#0d9488", "#f59e0b"][i]} />
                    <span style={{ width: 280, fontWeight: 600 }}>{r.n}</span>
                    <span style={{ flex: 1, color: tone.sub }}>{r.s}</span>
                    <span style={{ fontSize: 17, fontWeight: 650, padding: "6px 14px", borderRadius: 99, color: done ? "#16a34a" : "#c2710c", background: done ? "#16a34a16" : "#f59e0b1c" }}>{done ? "Live" : "Waiting"}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 18, fontSize: 18, color: tone.sub }}>{C.metric.label}: {C.metric.to.toLocaleString("en-US")}</div>
          </AppWindow>
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 330, background: `linear-gradient(180deg, ${pal.dark ? "rgba(0,0,0,0.6)" : "rgba(246,246,252,0.97)"} 60%, transparent)` }} />
      {f < sw + 4 && at(W / 2, 150, <Say c={c} words={L.noA} size={70} weight={500} />, { opacity: 1 - rise(f, sw - 2, 6) })}
      {f >= sw - 2 && at(W / 2, 150, <Say c={c} words={L.noB} size={70} weight={500} />)}
    </>
  );
}

// New: the old ways shown and crossed out — the tools fall away on the first
// line, the waiting clock on the second — and one check takes their place.
function cross(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const x1 = rise(f, T.between, 14, OUT);
  const fall1 = rise(f, T.between + 10, 24, IN_OUT);
  // the clock comes in as the windows fall, so the part is never empty
  const clock = soft(f, Math.min(T.no2 - 2, T.between + 26), 18);
  const x2 = rise(f, T.reports2, 14, OUT);
  const fall2 = rise(f, T.reports2 + 10, 24, IN_OUT);
  const ok = soft(f, T.reports2 + 12, 16);
  const X = (k: number) => (
    <svg width={200} height={200} viewBox="0 0 100 100" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
      <path d="M20 20 L80 80 M80 20 L20 80" stroke="#ef4444" strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={`${k} 1`} />
    </svg>
  );
  return (
    <>
      {abs(160, 150, <Say c={c} words={f < T.no2 - 4 ? L.noA : L.noB} size={66} align="left" />)}
      {TOOLS.slice(0, 3).map((t, i) =>
        at(560 + i * 400, 600 + fall1 * 500, (
          <div style={{ position: "relative" }}>
            <Win title={t.name} icon={t.icon} color={t.color} pal={pal} w={340} h={230} style={{ transform: `rotate(${fall1 * (i - 1) * 24}deg)` }} />
            {X(x1)}
          </div>
        ), { opacity: soft(f, c.from + i * 4, 16) * (1 - fall1) }, t.name),
      )}
      {at(W / 2, 600 + fall2 * 500, (
        <div style={{ position: "relative", width: 260, height: 260, borderRadius: 999, background: pal.panel, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.25)" }}>
          <svg width={180} height={180} viewBox="-50 -50 100 100">
            <circle r={40} fill="none" stroke={pal.panelInk} strokeWidth={6} />
            <line x1={0} y1={0} x2={0} y2={-28} stroke={pal.panelInk} strokeWidth={6} strokeLinecap="round" transform={`rotate(${f * 6})`} />
            <line x1={0} y1={0} x2={18} y2={0} stroke={pal.panelInk} strokeWidth={6} strokeLinecap="round" transform={`rotate(${f * 0.5})`} />
          </svg>
          {X(x2)}
        </div>
      ), { opacity: clock * (1 - fall2) })}
      {at(W / 2, 620, <Check size={220} color="#22c55e" k={ok} />, { opacity: ok })}
    </>
  );
}

export const NOMORE_BLOCKS: Block[] = [
  { id: "nomore.swap", role: "nomore", name: "Keyword swap", from: "Glow", draw: swap },
  { id: "nomore.ring", role: "nomore", name: "Struck pill → ring check", from: "Dusk", draw: ring },
  { id: "nomore.veil", role: "nomore", name: "Headlines over the product", from: "Fly", draw: veil },
  { id: "nomore.board", role: "nomore", name: "Rows tick to Live", from: "Connect", draw: board },
  { id: "nomore.cross", role: "nomore", name: "Old ways crossed out", from: "new", draw: cross },
];
