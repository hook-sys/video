import { AbsoluteFill, interpolate } from "remotion";
import { Icon } from "../../icons";
import { count, IN_OUT, mix, OUT, rise } from "../anim";
import { abs, appear, Area, AppWindow, at, BarsV, Check, Comet, float, FlowMark, Glass, grow, Kpi, LIGHT_APP, Logo, Person, Shot, soft, Token, W, Words } from "./common";

// Cards, icons and pills ease in from slightly smaller (never from nothing).
const pop = grow;
import { change, type FilmContent, pct, show, steps } from "../content";
import { type Beats, type Moments } from "./beats";

// Film 1 — "Glow" (reference: an AI-product explainer on deep green): a
// green field under large glowing light arcs, comet lines with bright heads,
// frosted pills, cards linked by thin circuit lines, a tilted white app, a
// toggle and a keyword pill. The reference's 3D coins, check and "AI" orb
// are drawn flat; its people are initials.

const MINT = "#46f2b0";
const EMER = "#14b889";
const DEEP = "#062a20";
const APP = LIGHT_APP("#0f9e6e", "#3ad69c");

// The field: a green gradient, two great arcs of light (top and bottom) whose
// shape changes from shot to shot, soft orbs drifting, a slow light pass.
const keysOf = (T: Moments): { f: number; top: number; bot: number; tilt: number; hue: number }[] => [
  { f: 0, top: -1180, bot: 1240, tilt: -4, hue: 0 },
  { f: T.sales - 8, top: -1260, bot: 980, tilt: 5, hue: 1 },
  { f: T.flowly - 10, top: -1040, bot: 1300, tilt: 0, hue: 2 },
  { f: T.when1 - 8, top: -1320, bot: 1100, tilt: -6, hue: 1 },
  { f: T.entire - 6, top: -1000, bot: 960, tilt: 0, hue: 0 },
  { f: T.no1 - 8, top: -1200, bot: 1200, tilt: 7, hue: 2 },
  { f: T.just - 8, top: -1080, bot: 1020, tilt: -3, hue: 1 },
];
function GlowBg({ f, T }: { f: number; T: Moments }) {
  const KEYS = keysOf(T);
  const fr = KEYS.map((k) => k.f);
  const v = (key: "top" | "bot" | "tilt" | "hue") => interpolate(f, fr.flatMap((x, i) => (i ? [x - 4, x + 18] : [x])), KEYS.flatMap((k, i) => (i ? [KEYS[i - 1][key], k[key]] : [k[key]])), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: IN_OUT });
  const top = v("top"), bot = v("bot"), tilt = v("tilt"), hue = v("hue");
  const c1 = ["#0d5a43", "#0b4f4a", "#0f5c3a"][Math.round(hue)];
  const arc = (y: number, flip: boolean, op: number) => (
    <div style={{ position: "absolute", left: -600, width: W + 1200, height: 2200, top: y, borderRadius: "50%", transform: `rotate(${tilt + (flip ? 0 : 0)}deg)`, borderTop: flip ? undefined : `3px solid rgba(150,255,215,${op})`, borderBottom: flip ? `3px solid rgba(150,255,215,${op})` : undefined, boxShadow: flip ? `0 40px 120px -20px rgba(70,242,176,${op * 0.6}), inset 0 -60px 160px -40px rgba(70,242,176,${op * 0.5})` : `0 -40px 120px -20px rgba(70,242,176,${op * 0.6}), inset 0 60px 160px -40px rgba(70,242,176,${op * 0.5})`, background: flip ? undefined : "radial-gradient(ellipse at 50% 0%, rgba(110,255,200,0.10), transparent 55%)" }} />
  );
  const pass = ((f * 2.2) % 2600) - 600;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 38%, ${c1} 0%, #0a3f30 38%, ${DEEP} 100%)`, overflow: "hidden" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, left: [-200, 1250, 600][i] + Math.sin(f / (70 + i * 13) + i) * 180, top: [-260, 380, 640][i] + Math.cos(f / (83 + i * 9)) * 120, background: `radial-gradient(circle, rgba(70,242,176,${[0.2, 0.16, 0.12][i]}), transparent 65%)`, filter: "blur(20px)" }} />
      ))}
      {arc(top + Math.sin(f / 60) * 16, false, 0.75)}
      {arc(bot - 2200 + Math.cos(f / 66) * 16, true, 0.55)}
      <div style={{ position: "absolute", top: -200, height: 1500, width: 420, left: pass, transform: "rotate(22deg)", background: "linear-gradient(90deg, transparent, rgba(160,255,220,0.06), transparent)" }} />
    </AbsoluteFill>
  );
}

const white = (sz: number, extra = {}) => ({ size: sz, ink: "#effff8", weight: 650, ...extra });
const pillKey = () => (_: unknown, k: number) => ({ color: "#04261b", padding: "0 0.28em", margin: "0 0.08em", borderRadius: 14, background: `rgba(70,242,176,${0.4 + 0.6 * k})`, boxShadow: `0 0 ${40 * k}px rgba(70,242,176,0.6)` });

// The shot cuts, in shot order (each shot runs from its cut to the next).
export const glowCuts = (T: Moments) => ({ data: T.data - 4, trio: T.sales - 4, logo: T.flowly - 10, cards: T.into - 6, app: T.when1 - 4, bars: T.when2 - 4, team: T.entire - 6, nomore: T.no1 - 4, slot: T.just - 4, check: T.every2 - 6, end: T.end + 6, dur: T.duration });

export function GlowFilm({ f, b }: { f: number; b: Beats }) {
  const T = b.t;
  const L = b.line;
  const C = b.content;
  const cut = glowCuts(T);
  return (
    <AbsoluteFill style={{ fontFamily: "InterClean, system-ui, sans-serif" }}>
      <GlowBg f={f} T={T} />

      {/* 1. Comet lines cross the words */}
      <Shot f={f} from={0} to={cut.data} enter="none" cam={(p, f) => `${float(f)} scale(${mix(1.06, 1, p)})`}>
        <Comet f={f} at={-6} dur={50} pts={[[-100, 300], [500, 120], [900, 820], [1500, 760]]} color={MINT} width={6} big />
        <Comet f={f} at={2} dur={46} pts={[[200, 1000], [700, 640], [1300, 260], [2000, 380]]} color="#f5d27a" width={4} />
        <Comet f={f} at={8} dur={44} pts={[[2000, 900], [1500, 760], [900, 760], [400, 860]]} color="#d9fff0" width={4} />
        {at(W / 2, 540, <Words f={f} words={L.hookA} s={white(96)} />)}
      </Shot>

      {/* 2. "Data" — flat tokens orbit, then scatter on "scattered" */}
      <Shot f={f} from={cut.data} to={cut.trio} enter="zoom" cam={(p, f) => `${float(f)} scale(${mix(0.96, 1.05, p)})`}>
        {(() => {
          const sc = rise(f, T.scattered, 34, OUT);
          const icons = ["sheet", "mail", "message-square", "file-text", "credit-card", "calendar"];
          return icons.map((ic, i) => {
            const a = (i / icons.length) * Math.PI * 2 + f / 90;
            const r = mix(300, 620, sc);
            const k = soft(f, T.data + 2 + i * 3, 22);
            const x = W / 2 + Math.cos(a) * r * 1.25;
            const y = 520 + Math.sin(a) * r * 0.6;
            return at(x, y, <Token icon={ic} size={mix(140, 104, sc)} bg="#f4fff9" color="#0b6b4b" ring="rgba(120,255,200,0.35)" style={{ transform: `scale(${mix(0.6, 1, k)}) rotate(${sc * (i % 2 ? 28 : -28)}deg)` }} />, { opacity: k * (1 - sc * 0.35), filter: `blur(${sc * (i % 3 === 0 ? 4 : 0)}px)` }, ic);
          });
        })()}
        {at(W / 2, 440, <div style={{ fontSize: 210, fontWeight: 700, letterSpacing: "-0.05em", backgroundImage: `linear-gradient(180deg, #ffffff, ${MINT})`, WebkitBackgroundClip: "text", color: "transparent", opacity: rise(f, T.data - 2, 12), filter: `blur(${(1 - rise(f, T.data - 2, 12)) * 16}px)` }}>Data</div>)}
        {at(W / 2, 640, <Words f={f} words={L.hookB} s={white(54, { key: pillKey() })} />)}
      </Shot>

      {/* 3. Sales / Payments / Reports: tilted glass slabs, a "?" in a glass notch */}
      <Shot f={f} from={cut.trio} to={cut.logo} enter="slide" cam={(p, f) => `${float(f)} translateX(${mix(40, -40, p)}px) rotateY(${mix(-4, 3, p)}deg)`}>
        <div style={{ position: "absolute", left: 1330, top: -60, width: 900, height: 1200, borderRadius: 120, background: "linear-gradient(180deg, rgba(160,255,220,0.10), rgba(160,255,220,0.03))", borderLeft: "2px solid rgba(160,255,220,0.35)", boxShadow: "inset 30px 0 80px -30px rgba(70,242,176,0.4)" }} />
        {at(1400, 520, <div style={{ width: 128, height: 128, borderRadius: 999, background: "radial-gradient(circle at 40% 35%, #c8ffe9, #3ad69c 60%, #0e8c63)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 70, fontWeight: 700, color: "#fff", boxShadow: "0 0 80px rgba(70,242,176,0.7), inset 0 2px 0 rgba(255,255,255,0.6)", transform: `scale(${pop(f, cut.trio + 6, 18)})`, opacity: soft(f, cut.trio + 6, 20) }}>?</div>)}
        {[
          { t: b.trio[0].label, s: b.trio[0].sub, c: T.sales, x: 720, y: 290, r: -9, z: 1 },
          { t: b.trio[1].label, s: b.trio[1].sub, c: T.payments, x: 600, y: 520, r: 6, z: 1.18 },
          { t: b.trio[2].label, s: b.trio[2].sub, c: T.reports, x: 760, y: 760, r: -7, z: 0.96 },
        ].map((it) => {
          const k = soft(f, it.c - 3, 22);
          return at(
            it.x + (1 - k) * -120,
            it.y,
            <div style={{ transform: `rotate(${it.r}deg) scale(${it.z})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Glass dark tint="#bfffe6" radius={14} pad="18px 48px" style={{ fontSize: 66, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>
                {it.t}
              </Glass>
              <span style={{ fontSize: 26, color: "#bff5df", fontWeight: 500, opacity: rise(f, it.c + 10, 14) }}>{it.s}</span>
            </div>,
            { opacity: k, filter: `blur(${(1 - k) * 10}px)` },
            it.t,
          );
        })}
      </Shot>

      {/* 4. The logo: a light streak flies in and becomes the name */}
      <Shot f={f} from={cut.logo} to={cut.cards} enter="none" cam={(p, f) => `${float(f, 0.6)} scale(${mix(0.94, 1.04, p)})`}>
        <Comet f={f} at={cut.logo} dur={18} pts={[[-200, 700], [400, 760], [700, 420], [W / 2 - 230, 530]]} color={MINT} width={7} big ghost={0} />
        {(() => {
          const k = rise(f, T.flowly - 2, 22, OUT);
          const flare = rise(f, T.flowly - 4, 10) * (1 - rise(f, T.flowly + 8, 24));
          return (
            <>
              <div style={{ position: "absolute", left: 0, top: 530, width: W, height: 6, background: `linear-gradient(90deg, transparent, rgba(220,255,240,${flare}), transparent)`, filter: "blur(2px)", boxShadow: `0 0 80px rgba(160,255,220,${flare})` }} />
              {at(W / 2, 530, <Logo size={150} ink="#ffffff" colors={[MINT, EMER]} k={k} />, { filter: `drop-shadow(0 0 ${40 * flare}px rgba(160,255,220,0.8))` })}
              {at(W / 2, 700, <Words f={f} words={L.revealA} s={white(48, { weight: 500 })} />)}
            </>
          );
        })()}
      </Shot>

      {/* 5. One live dashboard: a glass label, cards linked by circuit lines */}
      <Shot f={f} from={cut.cards} to={cut.app} enter="zoom" cam={(p, f) => `${float(f)} rotateX(${mix(8, 2, p)}deg) scale(${mix(0.92, 1.03, p)})`}>
        {(() => {
          const lineK = rise(f, T.into + 6, 26, IN_OUT);
          const cards = [
            { x: 960, y: 300, w: 400, el: <Kpi tone={APP} w={400} label={C.metric.label} value={show(C.metric.unit, count(f, T.into + 4, 30, C.metric.from * 0.85, C.metric.to))} delta={`+${pct(C.growth)}%`} /> },
            { x: 560, y: 640, w: 330, el: <MiniPie f={f} at={T.live} /> },
            { x: 1360, y: 640, w: 330, el: <div style={{ width: 330, background: "#fff", borderRadius: 16, padding: 18 }}><div style={{ fontSize: 14, color: APP.sub }}>{C.growth.label}</div><Area w={294} h={110} draw={rise(f, T.live, 30)} color={APP.accent} pts={[0.2, 0.3, 0.26, 0.42, 0.4, 0.58, 0.66, 0.8]} /></div> },
          ];
          const node = (x: number, y: number, k: number) => <circle cx={x} cy={y} r={7 * k} fill={MINT} style={{ filter: "drop-shadow(0 0 8px #46f2b0)" }} />;
          return (
            <>
              <svg width={W} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", left: 0, top: 0, transform: "translateY(110px) scale(1.5)", transformOrigin: "960px 500px" }}>
                {[
                  "M960 380 L960 470 L560 470 L560 560",
                  "M960 380 L960 470 L1360 470 L1360 560",
                  "M725 700 L1195 700",
                ].map((d, i) => (
                  <path key={i} d={d} stroke="rgba(160,255,220,0.65)" strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={`${lineK} 1`} />
                ))}
                {lineK > 0.9 && [node(960, 470, 1), node(560, 470, 1), node(1360, 470, 1)]}
                {lineK > 0.2 && [0, 1].map((i) => {
                  const t = ((f - T.into) / 40 + i / 2) % 1;
                  return <circle key={i} cx={mix(560, 1360, t)} cy={470} r={5} fill="#fff" opacity={0.9} />;
                })}
              </svg>
              {cards.map((c, i) => at(c.x + (c.x - 960) * 0.5, c.y + (c.y - 500) * 0.5 + 110, <div style={{ padding: 6, borderRadius: 22, background: "rgba(200,255,235,0.18)", border: "1px solid rgba(200,255,235,0.4)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}>{c.el}</div>, appear(f, T.into - 4 + i * 6, 24, "up", "translate(-50%, -50%) scale(1.45)"), i))}
              {at(W / 2, 110, <Glass dark tint="#bfffe6" pad="16px 38px" glow={MINT} style={{ fontSize: 40, fontWeight: 650, color: "#fff", transform: `scale(${pop(f, T.live - 2, 16)})` }}><Icon name="activity" size={36} color={MINT} strokeWidth={2.4} />{b.label}</Glass>, { opacity: rise(f, T.live - 2, 10) })}
            </>
          );
        })()}
      </Shot>

      {/* 6. A payment arrives: the tilted app, revenue updates instantly */}
      <Shot f={f} from={cut.app} to={cut.bars} enter="push" inDur={22} outDur={20} cam={(p, f) => `${float(f)} translateX(${mix(60, -40, p)}px) scale(${mix(0.96, 1.06, p)})`}>
        {abs(250, 300, (
          <div style={{ transform: `perspective(2200px) rotateY(${mix(-16, -8, rise(f, cut.app, 90, IN_OUT))}deg) rotateX(9deg)`, transformOrigin: "30% 50%" }}>
            <AppWindow w={1420} h={820} tone={APP} active={2} title={b.trio[1]?.label ?? "Payments"}>
              <PayBoard f={f} T={T} C={C} />
            </AppWindow>
          </div>
        ))}
        {abs(160, 120, <Words f={f} words={L.payA} s={white(56, { align: "left" })} />)}
        {abs(1000, 120, <Words f={f} words={L.payB} s={white(56, { align: "left", key: pillKey() })} />)}
      </Shot>

      {/* 7. Sales grow: a big bar card, the camera pushes in */}
      <Shot f={f} from={cut.bars} to={cut.team} enter="zoom" inDur={22} outDur={20} cam={(p, f) => `${float(f)} translateY(${mix(40, 0, p)}px) scale(${mix(0.92, 1.1, p)})`}>
        {abs(420, 250, (
          <div style={{ width: 1080, height: 640, borderRadius: 36, padding: 46, background: "linear-gradient(180deg, #ffffff, #effcf6)", boxShadow: "0 0 0 10px rgba(200,255,235,0.18), 0 60px 140px rgba(0,0,0,0.4)", transform: "rotateY(-10deg) rotateX(6deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 58, height: 58, borderRadius: 99, background: EMER, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trending-up" size={32} color="#fff" strokeWidth={2.6} /></div>
              <span style={{ fontSize: 44, fontWeight: 650, color: "#0d2a21", letterSpacing: "-0.02em" }}>{C.growth.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 30, fontWeight: 700, color: EMER }}>{`+${count(f, T.grow, 40, 0, pct(C.growth))}%`}</span>
            </div>
            <div style={{ marginTop: 40 }}>
              <BarsV w={990} h={420} values={steps(C.growth).values} grow={rise(f, T.grow - 4, 40, OUT)} base={0.3} color={EMER} sub="#5c7a6f" labels={steps(C.growth).labels} />
            </div>
          </div>
        ))}
        {abs(260, 120, <Words f={f} words={L.growA} s={white(60, { align: "left", key: pillKey() })} />)}
      </Shot>

      {/* 8. The entire team: a toggle that brings everyone in, one view */}
      <Shot f={f} from={cut.team} to={cut.nomore} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(1.08, 1, p)})`}>
        {(() => {
          const on = rise(f, T.team - 4, 20, IN_OUT);
          
          const people = ["A", "M", "R", "S", "J"];
          const pw = mix(380, 830, on);
          return (
            <>
              {at(W / 2, 470, (
                <div style={{ width: pw, height: 164, borderRadius: 999, padding: 14, boxSizing: "border-box", background: "linear-gradient(180deg, rgba(200,255,235,0.24), rgba(200,255,235,0.08))", border: "1.5px solid rgba(200,255,235,0.45)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3), 0 30px 80px rgba(0,0,0,0.35)", position: "relative", display: "flex", alignItems: "center" }}>
                  <div style={{ width: 122, height: 122, borderRadius: 999, background: `radial-gradient(circle at 40% 35%, #b8ffe2, ${EMER} 70%)`, boxShadow: "0 0 50px rgba(70,242,176,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0 }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 99, background: "#fff", opacity: 0.5 + 0.5 * Math.sin(f / 5 - i) }} />)}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginLeft: 22 }}>
                    {people.map((p, i) => (
                      <div key={p} style={{ opacity: rise(f, T.entire + i * 4, 12), transform: `scale(${pop(f, T.entire + i * 4, 14)})` }}>
                        <Person letter={p} size={110} color={["#0f9e6e", "#3a7bd5", "#9b5de5", "#f08a24", "#e0475b"][i]} ring="rgba(255,255,255,0.8)" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {at(W / 2, 690, <Words f={f} words={L.growB} s={white(64, { key: pillKey() })} />)}
            </>
          );
        })()}
      </Shot>

      {/* 9. No more …: the keyword pill swaps */}
      <Shot f={f} from={cut.nomore} to={cut.slot} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(1, 1.06, p)})`}>
        {(() => {
          const sw = rise(f, T.no2 - 6, 14, IN_OUT);
          return (
            <>
              {at(W / 2, 540 - sw * 90, <Words f={f} words={L.noA} s={white(72, { key: pillKey() })} />, { opacity: 1 - sw, filter: `blur(${sw * 14}px)` })}
              {sw > 0 && at(W / 2, 540 + (1 - sw) * 90, <Words f={f} words={L.noB} s={white(72, { key: pillKey() })} />)}
            </>
          );
        })()}
      </Shot>

      {/* 10. Just one live dashboard: the mark settles in a glass notch */}
      <Shot f={f} from={cut.slot} to={cut.check} enter="rise" cam={(p, f) => `${float(f)} scale(${mix(0.96, 1.04, p)})`}>
        <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M-20 560 L640 560 C760 560 760 760 960 760 C1160 760 1160 560 1280 560 L1940 560 L1940 1100 L-20 1100 Z" fill="rgba(200,255,235,0.10)" stroke="rgba(200,255,235,0.6)" strokeWidth={3} style={{ filter: "drop-shadow(0 0 20px rgba(70,242,176,0.6))" }} />
        </svg>
        {at(W / 2, mix(420, 600, rise(f, cut.slot + 4, 26, OUT)), <div style={{ padding: 18, borderRadius: 999, background: "radial-gradient(circle, rgba(200,255,235,0.3), rgba(200,255,235,0.05))", boxShadow: "0 0 90px rgba(70,242,176,0.55)" }}><div style={{ width: 170, height: 170, borderRadius: 999, background: "#eafff6", display: "flex", alignItems: "center", justifyContent: "center" }}><FlowMark size={120} colors={[EMER, "#0a7d58"]} /></div></div>, { clipPath: "inset(0 0 0 0 round 999px)" })}
        {at(W / 2, 250, <Words f={f} words={L.ctaA} s={white(80, { key: pillKey() })} />)}
      </Shot>

      {/* 11. Every answer you need: a flat glowing check, a glass toggle */}
      <Shot f={f} from={cut.check} to={cut.end} enter="zoom" cam={(p, f) => `${float(f)} scale(${mix(0.95, 1.05, p)})`}>
        {at(640, 520, (
          <div style={{ width: 300, height: 300, borderRadius: 999, background: `radial-gradient(circle at 40% 30%, #8dffd2, ${EMER} 65%, #0a7d58)`, boxShadow: "0 0 0 26px rgba(70,242,176,0.12), 0 0 140px rgba(70,242,176,0.6)", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop(f, cut.check + 2, 18)})`, opacity: soft(f, cut.check + 2, 20) }}>
            <svg width={170} height={170} viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7" stroke="#fff" strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${rise(f, T.every2, 16)} 1`} /></svg>
          </div>
        ))}
        {abs(900, 380, <Words f={f} words={L.ctaB} s={white(70, { align: "left", key: pillKey() })} style={{ width: 860 }} />)}
        {abs(900, 590, (
          <Glass dark tint="#bfffe6" pad="14px 34px 14px 14px" glow={MINT} style={{ opacity: rise(f, T.need, 12), transform: `scale(${pop(f, T.need, 16)})` }}>
            <div style={{ width: 70, height: 70, borderRadius: 99, background: EMER, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 30 }}><Icon name="sparkles" size={36} color="#fff" /></div>
            <span style={{ fontSize: 34, fontWeight: 650, color: "#fff", lineHeight: 1.1 }}>{b.brand.tagline}</span>
          </Glass>
        ))}
      </Shot>

      {/* 12. End card */}
      <Shot f={f} from={cut.end} to={cut.dur} last enter="blur" cam={(p, f) => `${float(f, 0.5)} scale(${mix(1.04, 1, p)})`}>
        <Comet f={f} at={cut.end - 4} dur={30} pts={[[-100, 900], [500, 980], [1300, 860], [2050, 600]]} color={MINT} width={5} />
        {at(W / 2, 420, <Logo size={180} ink="#ffffff" colors={[MINT, EMER]} k={rise(f, cut.end, 26, OUT)} />)}
        {at(W / 2, 560, <div style={{ fontSize: 50, color: "#c9f7e6", fontWeight: 500, opacity: rise(f, cut.end + 14, 14) }}>{b.brand.tagline}</div>)}
        {at(W / 2, 690, <Glass dark tint="#bfffe6" glow={MINT} pad="22px 52px" style={{ fontSize: 42, fontWeight: 700, color: "#fff", transform: `scale(${pop(f, cut.end + 22, 16)})` }}>{b.brand.cta}<Icon name="arrow-right" size={32} color={MINT} strokeWidth={2.6} /></Glass>, { opacity: rise(f, cut.end + 22, 10) })}
        {at(W / 2, 800, <div style={{ fontSize: 34, color: "#9fe3c9", letterSpacing: "0.04em", opacity: rise(f, cut.end + 30, 14) }}>{b.brand.url}</div>)}
      </Shot>
    </AbsoluteFill>
  );
}

function MiniPie({ f, at: a }: { f: number; at: number }) {
  const k = rise(f, a, 30, OUT);
  const parts = [0.46, 0.32, 0.22];
  let acc = 0;
  return (
    <div style={{ width: 330, background: "#fff", borderRadius: 16, padding: 18, display: "flex", gap: 18, alignItems: "center" }}>
      <svg width={120} height={120} viewBox="-60 -60 120 120" style={{ transform: "rotate(-90deg)" }}>
        {parts.map((p, i) => {
          const c = 2 * Math.PI * 42;
          const el = <circle key={i} r={42} fill="none" stroke={["#0f9e6e", "#3ad69c", "#bdeedb"][i]} strokeWidth={30} strokeDasharray={`${p * c * k} ${c}`} strokeDashoffset={-acc * c * k} />;
          acc += p;
          return el;
        })}
      </svg>
      <div style={{ fontSize: 15, color: APP.sub, lineHeight: 1.8 }}>
        <div style={{ fontWeight: 650, color: APP.ink, fontSize: 17 }}>Sales &amp; Profit</div>
        {["Online 46%", "Retail 32%", "Other 22%"].map((t) => <div key={t}>{t}</div>)}
      </div>
    </div>
  );
}

// The app's payments board: a new payment slides in, revenue counts up.
function PayBoard({ f, T, C }: { f: number; T: Moments; C: FilmContent }) {
  const row = rise(f, T.payment, 16, OUT);
  const hi = rise(f, T.updates, 10) * (1 - rise(f, T.instantly + 20, 20));
  const rows = C.rows.map((r) => [r.name, r.value]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", gap: 18 }}>
        <Kpi tone={APP} w={300} label={C.metric.label} value={show(C.metric.unit, count(f, T.revenue + 2, 26, C.metric.from, C.metric.to))} delta={f > T.updates ? change(C.metric) : undefined} hi={hi} />
        {C.side.map((x) => <Kpi key={x.label} tone={APP} w={260} label={x.label} value={x.value} />)}
      </div>
      <div style={{ borderRadius: 16, border: `1px solid ${APP.line}`, overflow: "hidden" }}>
        <div style={{ display: "flex", padding: "12px 20px", fontSize: 14, color: APP.sub, background: APP.side }}>
          <span style={{ flex: 2 }}>Customer</span><span style={{ flex: 1 }}>Amount</span><span style={{ flex: 1 }}>Status</span>
        </div>
        <div style={{ height: row * 64, overflow: "hidden", background: `rgba(58,214,156,${0.16 * (1 - rise(f, T.instantly + 30, 30))})` }}>
          <PayRow name={C.event.source} amt={C.event.detail} k={row} fresh />
        </div>
        {rows.map((r) => <PayRow key={r[0]} name={r[0]} amt={r[1]} k={1} />)}
      </div>
    </div>
  );
}
function PayRow({ name, amt, k, fresh }: { name: string; amt: string; k: number; fresh?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 20px", height: 64, borderTop: `1px solid ${APP.line}`, fontSize: 18, opacity: k }}>
      <span style={{ flex: 2, display: "flex", alignItems: "center", gap: 12, fontWeight: 600 }}><Person letter={name[0]} size={34} color={fresh ? APP.accent : "#9aa3b8"} />{name}</span>
      <span style={{ flex: 1, fontWeight: 650 }}>{amt}</span>
      <span style={{ flex: 1 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 650, color: "#0f9e6e", background: "#0f9e6e18", padding: "4px 12px", borderRadius: 99 }}><Check size={18} color="#0f9e6e" />{fresh ? "Just now" : "Paid"}</span></span>
    </div>
  );
}
