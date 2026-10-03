import type { CSSProperties } from "react";
import { Icon } from "../../../icons";
import { compact, show } from "../../content";
import { IN_OUT, mix, OUT, rise } from "../../anim";
import { Area, at, FlowMark, glide, grow, Pointer, press, soft, W } from "../../refs/common";
import { appTone, type Block, type BlockCtx, type Box, card, Say } from "../kit";
import type { Pal } from "../looks";
import { TOOLS } from "./parts";

// The second set of references (Converse, UrVote, Madison, Alex): growth,
// "no more", the closing line and the end card.

const glass = (pal: Pal, radius = 24): CSSProperties => ({
  borderRadius: radius,
  background: pal.dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.62)",
  border: `1.5px solid ${pal.dark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.95)"}`,
  boxShadow: pal.dark ? "0 30px 80px rgba(0,0,0,0.35)" : "0 30px 80px rgba(60,70,140,0.14)",
});
// A figure counting from its start to its end between two frames.
const count = (f: number, from: number, dur: number, a: number, b: number) => mix(a, b, rise(f, from, dur, OUT));

// ── growth ────────────────────────────────────────────────────────────────

// Alex: a desktop screen on a stand with the product's dashboard; glass
// figures float beside it and count up.
function monitor(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const tone = appTone(pal);
  const g = C.growth;
  const k = soft(f, c.from, 20);
  const up = (d: number) => count(f, T.grow - 4 + d, 40, 0, 1);
  const side = C.side.slice(0, 2);
  return (
    <>
      {at(
        W / 2,
        120,
        <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
          <Say c={c} words={L.growA} size={58} weight={500} />
          <Say c={c} words={L.growB} size={58} weight={500} />
        </div>,
      )}
      {at(
        W / 2,
        600,
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: k, transform: `scale(${mix(0.92, 1, k)})` }}>
          <div style={{ width: 1060, height: 620, borderRadius: 34, background: "#111318", padding: 22, boxShadow: "0 60px 140px rgba(20,30,80,0.30)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 14, background: tone.bg, padding: 34, overflow: "hidden" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: tone.ink }}>{g.label}</div>
              <div style={{ fontSize: 64, fontWeight: 750, color: tone.ink, letterSpacing: "-0.03em", marginTop: 6 }}>{show(g.unit, count(f, T.grow - 4, 40, g.from, g.to))}</div>
              <div style={{ marginTop: 20 }}>
                <Area w={930} h={300} draw={rise(f, T.grow - 8, 40, OUT)} color={tone.accent} pts={[0.2, 0.28, 0.24, 0.34, 0.32, 0.42, 0.4, 0.5, 0.66, 0.9]} dot />
              </div>
            </div>
          </div>
          <div style={{ width: 120, height: 90, background: "linear-gradient(180deg, #c9ccd6, #e7e9ef)" }} />
          <div style={{ width: 340, height: 18, borderRadius: 12, background: "#d4d7e0" }} />
        </div>,
      )}
      {side.map((s, i) => {
        const kk = soft(f, T.team - 6 + i * 8, 18);
        return at(
          i ? 1640 : 280,
          i ? 680 : 520,
          <div style={{ ...glass(pal, 24), padding: "24px 30px", minWidth: 260 }}>
            <div style={{ fontSize: 22, color: pal.sub }}>{s.label}</div>
            <div style={{ fontSize: 46, fontWeight: 700, color: pal.ink, letterSpacing: "-0.02em", opacity: up(i * 6) > 0 ? 1 : 0.4 }}>{s.value}</div>
          </div>,
          { opacity: kk, transform: `translate(-50%, -50%) translateX(${(1 - kk) * (i ? 80 : -80)}px)` },
          s.label,
        );
      })}
    </>
  );
}

// Alex: an analytics card — three figures counting up beside a bar chart
// that grows bar by bar.
function analytics(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const tone = appTone(pal);
  const g = C.growth;
  const k = soft(f, c.from, 18);
  const bars = [0.38, 0.62, 0.45, 0.8, 0.56, 0.92, 0.7];
  const figs = [{ label: g.label, value: show(g.unit, count(f, T.grow - 4, 36, g.from, g.to)), icon: "trending-up" }, ...C.side.slice(0, 2).map((s, i) => ({ label: s.label, value: s.value, icon: ["users", "receipt"][i] }))];
  return (
    <>
      {at(
        W / 2,
        140,
        <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
          <Say c={c} words={L.growA} size={58} weight={500} />
          <Say c={c} words={L.growB} size={58} weight={500} />
        </div>,
      )}
      {at(
        W / 2,
        590,
        <div style={{ width: 1300, height: 620, ...card(pal, 36), padding: 44, display: "flex", gap: 50, opacity: k, transform: `perspective(2200px) rotateY(${mix(-10, -4, soft(f, c.from, 80))}deg) scale(${mix(0.94, 1, k)})` }}>
          <div style={{ width: 420, display: "flex", flexDirection: "column", gap: 40 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: tone.ink }}>{g.label}</div>
            {figs.map((x, i) => (
              <div key={x.label} style={{ display: "flex", gap: 20, alignItems: "center", opacity: soft(f, T.grow - 6 + i * 6, 14) }}>
                <div style={{ width: 70, height: 70, borderRadius: 99, background: `${tone.accent}1f`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={x.icon} size={34} color={tone.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 22, color: tone.sub }}>{x.label}</div>
                  <div style={{ fontSize: 46, fontWeight: 700, color: tone.accent, letterSpacing: "-0.02em" }}>{x.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 34, borderLeft: `1px solid ${tone.line}`, paddingLeft: 40 }}>
            {bars.map((h, i) => {
              const gk = rise(f, T.grow + i * 4, 20, OUT);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ height: `${h * 88 * gk}%`, borderRadius: 999, background: i % 2 ? `linear-gradient(180deg, ${tone.accent2}, ${tone.accent})` : `${tone.accent}55` }} />
                  <div style={{ marginTop: 12, textAlign: "center", fontSize: 18, color: tone.sub }}>{compact(g.unit, g.to * h)}</div>
                </div>
              );
            })}
          </div>
        </div>,
      )}
    </>
  );
}

// ── no more ───────────────────────────────────────────────────────────────

// UrVote: each "no more" a white pill with an accent icon button beside
// it, coming in at different depths.
function pills(c: BlockCtx) {
  const { f, L, b, pal } = c;
  const lines = [L.noA, L.noB];
  const icons = [b.trio[0]?.icon ?? "copy", b.trio[2]?.icon ?? "file-text"];
  const pos = [
    [620, 380, 1, 0],
    [1180, 640, 1, 0],
  ];
  const ghosts = [
    [300, 820],
    [1600, 260],
    [1560, 880],
  ];
  return (
    <>
      {ghosts.map(([x, y], i) =>
        at(
          x + Math.sin(f / 50 + i) * 20,
          y,
          <div style={{ display: "flex", gap: 18 }}>
            <div style={{ width: 300, height: 92, borderRadius: 22, background: pal.dark ? "rgba(255,255,255,0.1)" : "#fff", boxShadow: "0 20px 50px rgba(40,40,80,0.10)" }} />
            <div style={{ width: 92, height: 92, borderRadius: 22, background: pal.accent, opacity: 0.7 }} />
          </div>,
          { filter: "blur(7px)", opacity: 0.6 * soft(f, c.from + i * 6, 20) },
          i,
        ),
      )}
      {lines.map((ws, i) => {
        const [x, y] = pos[i];
        const k = soft(f, (ws[0]?.at ?? c.from) - 6, 16);
        return at(
          x,
          y,
          <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
            <div style={{ padding: "26px 44px", borderRadius: 26, background: pal.dark ? "rgba(255,255,255,0.12)" : "#fff", boxShadow: "0 30px 70px rgba(40,40,80,0.14)" }}>
              <Say c={c} words={ws} size={54} weight={550} />
            </div>
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: 28,
                background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 24px 60px ${pal.accent}66`,
                transform: `scale(${grow(f, (ws[0]?.at ?? c.from) + 4, 14)})`,
              }}
            >
              <Icon name={icons[i]} size={56} color="#fff" />
            </div>
          </div>,
          { opacity: k, filter: `blur(${(1 - k) * 12}px)` },
          i,
        );
      })}
    </>
  );
}

// Alex: the pile of alerts in its panel; on the second line a hand presses
// "Clear" (the camera leans in) and they fly away — all clear.
function clear(c: BlockCtx) {
  const { f, L, b, pal } = c;
  const hit = (L.noB[0]?.at ?? c.from + 40) - 2;
  const p = press(f, [hit]);
  const zoom = rise(f, hit - 16, 12, IN_OUT) * (1 - rise(f, hit + 8, 16, IN_OUT));
  const items = [...b.trio.map((x) => ({ t: x.label, s: x.sub, icon: x.icon })), { t: TOOLS[1].name, s: TOOLS[3].name, icon: TOOLS[1].icon }];
  const [px, py] = glide(f, [
    [c.from + 4, 1500, 1000],
    [hit - 4, 1300, 335],
  ]);
  const done = soft(f, hit + 18, 16);
  return (
    <>
      {at(W / 2, 140, <Say c={c} words={f < hit ? L.noA : L.noB} size={62} weight={550} />)}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + zoom * 0.45})`, transformOrigin: "1290px 335px" }}>
        {at(
          W / 2,
          620,
          <div style={{ width: 760, height: 620, ...card(pal, 36), padding: 34, position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>Notifications</div>
            <div
              style={{
                position: "absolute",
                right: 30,
                top: 26,
                padding: "12px 28px",
                borderRadius: 99,
                background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`,
                color: "#fff",
                fontSize: 24,
                fontWeight: 650,
                transform: `scale(${1 - p * 0.1})`,
              }}
            >
              Clear
            </div>
            {items.map((x, i) => {
              const out = rise(f, hit + 4 + i * 3, 12, IN_OUT);
              return (
                <div
                  key={x.t + i}
                  style={{
                    position: "absolute",
                    left: 34,
                    right: 34,
                    top: 110 + i * 112,
                    height: 94,
                    borderRadius: 20,
                    background: pal.panelDark ? "#2a2422" : "#f5f6fa",
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "0 22px",
                    transform: `translateX(${out * 900}px)`,
                    filter: `blur(${out * 12}px)`,
                    opacity: 1 - out,
                  }}
                >
                  <Icon name={x.icon} size={30} color={pal.accent} />
                  <span style={{ fontSize: 25, fontWeight: 650 }}>{x.t}</span>
                  <span style={{ fontSize: 20, color: pal.panelSub }}>{x.s}</span>
                  <span style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: 99, background: "#ef4444" }} />
                </div>
              );
            })}
            <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: done }}>
              <div style={{ width: 120, height: 120, borderRadius: 99, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${mix(0.6, 1, done)})` }}>
                <Icon name="check" size={70} color="#fff" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 34, fontWeight: 650 }}>All clear</div>
            </div>
          </div>,
        )}
        <Pointer x={px} y={py} press={p} hand />
      </div>
    </>
  );
}

// UrVote: a list of records; a glowing lock rises behind it and the
// entries scramble into code — nothing to lose, nothing to leak.
const HEX = "0123456789abcdef";
const scramble = (s: string, k: number, seed: number) =>
  s
    .split("")
    .map((ch, i) => (i / s.length < k ? HEX[(i * 7 + seed * 13 + Math.floor(k * 40)) % 16] : ch))
    .join("");
function lock(c: BlockCtx) {
  const { f, L, C, pal } = c;
  const tone = appTone(pal);
  const lk = soft(f, c.from + 6, 22);
  const scr = rise(f, (L.noB[0]?.at ?? c.from + 50) - 4, 30, IN_OUT);
  const rows = [C.event.source, ...C.rows.map((r) => r.name)].slice(0, 4).map((n, i) => `${n.toLowerCase().replace(/\s+/g, ".")}@${["mail", "inbox", "post", "mail"][i]}.com`);
  return (
    <>
      {at(W / 2, 140, <Say c={c} words={f < (L.noB[0]?.at ?? 1e9) - 6 ? L.noA : L.noB} size={60} weight={550} />)}
      {at(
        W / 2,
        mix(560, 330, lk),
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 999,
            background: `linear-gradient(150deg, ${pal.accent2}, ${pal.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 22px ${pal.accent}22, 0 0 120px ${pal.accent}aa`,
          }}
        >
          <Icon name="lock" size={96} color="#1b1716" strokeWidth={2.4} />
        </div>,
        { opacity: lk, zIndex: 1 },
      )}
      {at(
        W / 2,
        650,
        <div style={{ width: 1000, ...card(pal, 30), padding: "30px 36px", position: "relative", zIndex: 2, transform: `perspective(1800px) rotateX(${mix(0, 14, scr)}deg)` }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: tone.ink, marginBottom: 16 }}>{C.metric.label}</div>
          {rows.map((r, i) => (
            <div
              key={r}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                height: 74,
                padding: "0 22px",
                marginTop: 12,
                borderRadius: 16,
                background: tone.side,
                border: `1.5px solid ${scr > 0.6 ? "#22c55e88" : tone.line}`,
                fontFamily: scr > 0.05 ? "ui-monospace, monospace" : undefined,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 99, background: scr > 0.6 ? "#22c55e" : pal.accent }} />
              <span style={{ fontSize: 24, color: tone.ink, whiteSpace: "nowrap", overflow: "hidden" }}>{scramble(r, rise(f, (L.noB[0]?.at ?? c.from + 50) - 4 + i * 4, 22), i + f)}</span>
            </div>
          ))}
        </div>,
      )}
    </>
  );
}

// ── closing line ──────────────────────────────────────────────────────────

// Converse: an app-store card — icon, name, promise; "Get" is tapped,
// spins and becomes "Open".
function store(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const tap = T.every2;
  const p = press(f, [tap]);
  const spin = rise(f, tap + 4, 4) * (1 - rise(f, tap + 28, 4));
  const open = rise(f, tap + 30, 8);
  const [px, py] = glide(f, [
    [c.from, 1300, 1000],
    [tap - 4, 1020, 720],
  ]);
  return (
    <>
      {at(W / 2, 200, <Say c={c} words={L.cta} size={62} weight={500} style={{ maxWidth: 1500 }} />)}
      {at(
        W / 2,
        600,
        <div style={{ width: 1240, ...glass(pal, 44), padding: 54, display: "flex", gap: 50, alignItems: "center", opacity: soft(f, c.from + 4, 16), transform: `scale(${grow(f, c.from + 4, 18)})` }}>
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: 60,
              background: `linear-gradient(150deg, ${pal.accent}, ${pal.accent2})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 24px 60px ${pal.accent}55`,
            }}
          >
            <FlowMark size={160} colors={["#fff", "#fff"]} plain />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 66, fontWeight: 700, color: pal.ink, letterSpacing: "-0.02em" }}>{b.brand.name}</div>
            <div style={{ fontSize: 36, color: pal.sub, marginTop: 6 }}>{b.brand.tagline}</div>
            <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  minWidth: 190,
                  height: 84,
                  padding: "0 38px",
                  borderRadius: 99,
                  background: open ? `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})` : spin ? `${pal.accent}22` : pal.accent,
                  color: "#fff",
                  fontSize: 36,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${1 - p * 0.1})`,
                }}
              >
                {spin > 0.5 && !open ? (
                  <svg width={40} height={40} viewBox="0 0 40 40" style={{ transform: `rotate(${f * 18}deg)` }}>
                    <circle cx={20} cy={20} r={15} stroke={pal.accent} strokeWidth={5} fill="none" strokeDasharray="60 40" strokeLinecap="round" />
                  </svg>
                ) : open ? (
                  "Open"
                ) : (
                  b.brand.cta
                )}
              </div>
              <span style={{ fontSize: 30, color: pal.sub }}>{b.brand.url}</span>
            </div>
          </div>
        </div>,
      )}
      <Pointer x={px} y={py} press={p} hand />
    </>
  );
}

// UrVote: the mark in a disc inside rings; lines bring dots in from both
// sides and ticks go round the ring.
function rings(c: BlockCtx) {
  const { f, L, pal } = c;
  const k = soft(f, c.from, 20);
  const ticks = rise(f, (L.ctaB[0]?.at ?? c.from + 40) - 6, 30, OUT);
  return (
    <>
      <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: k }}>
        {[440, 600].map((y, i) => (
          <path key={y} d={`M -20 ${y} C 400 ${y + (i ? -60 : 60)}, 600 ${y}, 760 540 M 1940 ${y + (i ? 0 : 40)} C 1500 ${y - 40}, 1300 ${y}, 1160 540`} stroke={`${pal.accent}88`} strokeWidth={3} fill="none" />
        ))}
        {[0, 1, 2, 3].map((i) => {
          const t = ((f / 60 + i * 0.25) % 1) * 1;
          const left = i % 2 === 0;
          return <circle key={i} cx={left ? mix(0, 760, t) : mix(1920, 1160, t)} cy={mix(i < 2 ? 440 : 600, 540, t * t)} r={10} fill={pal.accent} />;
        })}
      </svg>
      {[300, 230].map((d, i) => at(W / 2, 540, <div style={{ width: d * 2, height: d * 2, borderRadius: 999, border: `2px solid ${pal.accent}${i ? "44" : "22"}`, background: i ? `${pal.accent}10` : undefined }} />, { opacity: k }, d))}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + f / 80;
        const on = ticks > i / 8;
        return at(
          W / 2 + Math.cos(a) * 230,
          540 + Math.sin(a) * 230,
          <div style={{ width: 44, height: 44, borderRadius: 99, background: on ? "#fff" : `${pal.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: on ? "0 8px 20px rgba(0,0,0,0.12)" : undefined }}>
            {on && <Icon name="check" size={26} color={pal.accent} strokeWidth={3} />}
          </div>,
          undefined,
          i,
        );
      })}
      {at(
        W / 2,
        540,
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 999,
            background: `linear-gradient(150deg, ${pal.accent2}, ${pal.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 120px ${pal.accent}88`,
            transform: `scale(${grow(f, c.from, 20)})`,
          }}
        >
          <FlowMark size={150} colors={["#fff", "#fff"]} plain />
        </div>,
        { opacity: k },
      )}
      {at(W / 2, 140, <Say c={c} words={L.ctaA} size={64} weight={550} />)}
      {at(W / 2, 950, <Say c={c} words={L.ctaB} size={64} weight={550} />)}
    </>
  );
}

// ── end ───────────────────────────────────────────────────────────────────

// Alex: the name written with a pen; the call to action in a pill that a
// hand taps; the address.
function pen(c: BlockCtx) {
  const { f, b, pal } = c;
  const t = c.from;
  const draw = rise(f, t, 30, IN_OUT);
  const fill = rise(f, t + 20, 14);
  const name = b.brand.name;
  const len = name.length * 260;
  const tap = t + 40;
  const p = press(f, [tap]);
  const [px, py] = glide(f, [
    [t + 10, 1200, 980],
    [tap - 4, 975, 690],
  ]);
  return (
    <>
      {at(
        W / 2,
        430,
        <svg width={Math.max(700, name.length * 120)} height={260} style={{ overflow: "visible" }}>
          <text
            x="50%"
            y={190}
            textAnchor="middle"
            fontSize={200}
            fontStyle="italic"
            fontWeight={500}
            letterSpacing="-6"
            fill={pal.accent}
            fillOpacity={fill}
            stroke={pal.accent}
            strokeWidth={3}
            strokeDasharray={len}
            strokeDashoffset={len * (1 - draw)}
            style={{ fontFamily: "InterClean, system-ui, sans-serif" }}
          >
            {name}
          </text>
        </svg>,
      )}
      {at(
        W / 2,
        660,
        <div
          style={{
            padding: "20px 50px",
            borderRadius: 99,
            background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`,
            color: "#fff",
            fontSize: 40,
            fontWeight: 650,
            boxShadow: `0 24px 60px ${pal.accent}66`,
            transform: `scale(${grow(f, t + 18, 14) * (1 - p * 0.08)})`,
          }}
        >
          {b.brand.cta}
        </div>,
        { opacity: soft(f, t + 18, 12) },
      )}
      {at(W / 2, 790, <div style={{ fontSize: 34, color: pal.sub }}>{b.brand.url}</div>, { opacity: soft(f, t + 26, 14) })}
      <Pointer x={px} y={py} press={p} hand />
    </>
  );
}

// Converse: the mark's outline draws, then fills; the name in two tones
// under it, the promise below.
function outline(c: BlockCtx) {
  const { f, b, pal } = c;
  const t = c.from;
  const name = b.brand.name;
  const half = Math.ceil(name.length / 2);
  const fill = rise(f, t + 18, 14);
  return (
    <>
      {at(
        W / 2,
        380,
        <div style={{ position: "relative", width: 230, height: 230 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 60, border: `4px solid ${pal.accent}`, opacity: 1 - fill, clipPath: `inset(0 ${(1 - rise(f, t, 22, IN_OUT)) * 100}% 0 0)` }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 60,
              background: `linear-gradient(150deg, ${pal.accent}, ${pal.accent2})`,
              opacity: fill,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${mix(0.9, 1, fill)})`,
            }}
          >
            <FlowMark size={140} colors={["#fff", "#fff"]} plain />
          </div>
        </div>,
      )}
      {at(
        W / 2,
        600,
        <div style={{ fontSize: 96, fontWeight: 750, letterSpacing: "0.02em", textTransform: "uppercase", color: pal.ink, opacity: soft(f, t + 20, 16) }}>
          {name.slice(0, half)}
          <span style={{ color: pal.accent2 }}>{name.slice(half)}</span>
        </div>,
      )}
      {at(W / 2, 710, <div style={{ fontSize: 40, color: pal.sub }}>{b.brand.tagline || b.brand.url}</div>, { opacity: soft(f, t + 30, 14) })}
      {b.brand.url && b.brand.tagline ? at(W / 2, 800, <div style={{ fontSize: 30, color: pal.sub, opacity: 0.8 }}>{b.brand.url}</div>, { opacity: soft(f, t + 36, 14) }) : null}
    </>
  );
}

const card$ = (x: number, y: number, w: number, h: number, r: number, fill: Box["fill"] = "card"): Box => ({ x, y, w, h, r, fill });

export const R2_CLOSE: Block[] = [
  { id: "growth.monitor", role: "growth", name: "Desktop + floating figures", from: "Alex", draw: monitor, obj: () => ({ a: card$(960, 546, 1016, 576, 14), z: card$(960, 546, 1016, 576, 14) }) },
  { id: "growth.analytics", role: "growth", name: "Figures + bar chart", from: "Alex", draw: analytics, obj: () => ({ a: card$(960, 590, 1300, 620, 36), z: card$(960, 590, 1300, 620, 36) }) },
  { id: "nomore.pills", role: "nomore", name: '"No more" pills + icons', from: "UrVote", draw: pills },
  { id: "nomore.clear", role: "nomore", name: "Alerts cleared", from: "Alex", draw: clear, obj: () => ({ a: card$(960, 620, 760, 620, 36), z: card$(960, 620, 760, 620, 36) }) },
  { id: "nomore.lock", role: "nomore", name: "Lock, entries scramble", from: "UrVote", draw: lock, obj: () => ({ a: card$(960, 650, 1000, 460, 30), z: card$(960, 650, 1000, 460, 30) }) },
  { id: "cta.store", role: "cta", name: "App-store card, Get → Open", from: "Converse", draw: store, obj: () => ({ a: card$(960, 600, 1240, 370, 44, "glass"), z: card$(960, 600, 1240, 370, 44, "glass") }) },
  { id: "cta.rings", role: "cta", name: "Mark in rings, ticks", from: "UrVote", draw: rings, obj: () => ({ a: card$(960, 540, 280, 280, 140, "accent"), z: card$(960, 540, 280, 280, 140, "accent") }) },
  { id: "end.pen", role: "end", name: "Pen name + tapped pill", from: "Alex", draw: pen, obj: () => ({ a: card$(960, 660, 330, 100, 50, "accent") }) },
  { id: "end.outline", role: "end", name: "Outline fills, two-tone name", from: "Converse", draw: outline, obj: () => ({ a: card$(960, 380, 230, 230, 60, "accent") }) },
];
