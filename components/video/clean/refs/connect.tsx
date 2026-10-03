import { AbsoluteFill } from "remotion";
import { Icon } from "../../icons";
import { type FilmContent, pct, show } from "../content";
import { count, IN_OUT, mix, OUT, pop, rise } from "../anim";
import { Area, at, Check, float, FlowMark, glide, Logo, Person, Pointer, press, Shot, useBrand, W, Words } from "./common";
import { type Beats, type Moments, plainW } from "./beats";

// Film 4 — "Connect" (reference: a creator-platform film on soft lavender
// white): depth-of-field tag pills around a question, a profile-style card
// with an indigo header, a wall of person cards that all tick when a button
// is pressed, a "live" campaign card, the app tilted under a blue headline,
// a black dot cursor and a dark corner badge. People are initials.

const IND = "#3b3fd8";
const BLUE = "#1f6feb";
const INK = "#14152a";
const SUB = "#7a7d96";
const LINE = "#e9eaf3";

function ConnectBg({ f }: { f: number }) {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(170deg, #f7f7fc, #ecedf8)", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1500, height: 900, left: 200 + Math.sin(f / 90) * 260, top: 500 + Math.cos(f / 70) * 80, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(110,120,255,0.18), transparent 65%)", filter: "blur(30px)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.0) 0 120px, rgba(255,255,255,0.55) 160px, rgba(255,255,255,0) 220px)", backgroundPosition: `${f * 1.2}px 0`, opacity: 0.7 }} />
    </AbsoluteFill>
  );
}

// A tag pill at a depth (far ones blurred and faint).
function Tag({ t, x, y, z, f, at: a, icon }: { t: string; x: number; y: number; z: number; f: number; at: number; icon?: string }) {
  const k = rise(f, a, 16, OUT);
  return (
    <div style={{ position: "absolute", left: x + Math.sin(f / 50 + x) * 10 * z, top: y + Math.cos(f / 60 + y) * 8 * z + (1 - k) * 40, display: "flex", alignItems: "center", gap: 10, padding: `${10 * z}px ${22 * z}px`, borderRadius: 12 * z, background: "rgba(225,228,255,0.85)", color: IND, fontSize: 40 * z, fontWeight: 600, opacity: k * (0.35 + 0.65 * Math.min(1, z)), filter: `blur(${Math.abs(1 - z) * 7}px)`, whiteSpace: "nowrap" }}>
      {icon && <Icon name={icon} size={40 * z} color={IND} />}
      {t}
    </div>
  );
}

// A person card (an initial, a name, a role) that ticks on `tick`.
function PCard({ l, n, r, c, f, tick }: { l: string; n: string; r: string; c: string; f: number; tick?: number }) {
  const k = tick !== undefined ? rise(f, tick, 12) : 0;
  return (
    <div style={{ width: 420, height: 112, borderRadius: 18, background: "#fff", boxShadow: "0 16px 40px rgba(50,50,140,0.08), 0 0 0 1px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 18, padding: "0 22px", boxSizing: "border-box", position: "relative" }}>
      <div style={{ position: "relative", width: 66, height: 66 }}>
        <Person letter={l} size={66} color={c} />
        {k > 0 && <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: IND, opacity: k, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={44} color={IND} k={k} /></div>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: INK }}>{n}</div>
        <div style={{ fontSize: 19, color: SUB }}>{r}</div>
      </div>
      <Icon name="link" size={22} color="#b8bbd0" style={{ position: "absolute", right: 18, top: 16 }} />
    </div>
  );
}

// The app frame used tilted (a table of tools/rows), drawn flat.
function Board({ f, title, rows, live, C }: { f: number; title: string; rows: { n: string; s: string; c: string; at?: number; st?: string }[]; live?: number; C: FilmContent }) {
  const brand = useBrand();
  const name = brand.name;
  return (
    <div style={{ width: 1600, height: 960, borderRadius: 32, background: "#fff", boxShadow: "0 60px 160px rgba(50,50,140,0.22), 0 0 0 10px rgba(255,255,255,0.6)", display: "flex", overflow: "hidden", color: INK }}>
      <div style={{ width: 280, background: "#f6f7fb", padding: "34px 24px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 34 }}>
          <FlowMark size={40} colors={["#6b7bff", IND]} />
          <span style={{ fontSize: 26, fontWeight: 700 }}>{name}</span>
        </div>
        {[["house", "Overview"], ...brand.things.map((x) => [x.icon, x.label]), ["users", "Team"], ["plug", "Integrations"]].map(([ic, t], i) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, fontSize: 20, color: i ? SUB : INK, fontWeight: i ? 500 : 650, background: i ? undefined : "#fff" }}>
            <Icon name={ic} size={22} color={i ? SUB : IND} />
            {t}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 40 }}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>{title}</div>
        <div style={{ display: "flex", gap: 20, marginTop: 26 }}>
          {[[C.metric.label, show(C.metric.unit, C.metric.to)], [C.growth.label, show(C.growth.unit, count(f, live ?? 0, 30, C.growth.from, C.growth.to))], [C.side[0].label, C.side[0].value]].map(([a, b]) => (
            <div key={a} style={{ flex: 1, padding: "20px 24px", borderRadius: 18, border: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 18, color: SUB }}>{a}</div>
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>{b}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, borderRadius: 18, border: `1px solid ${LINE}`, overflow: "hidden" }}>
          {rows.map((r) => (
            <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 16, height: 84, padding: "0 24px", borderTop: `1px solid ${LINE}`, fontSize: 21 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, border: `2px solid ${r.at !== undefined && f >= r.at ? IND : "#c9cbdb"}`, background: r.at !== undefined && f >= r.at ? IND : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>{r.at !== undefined && f >= r.at && <Icon name="check" size={18} color="#fff" strokeWidth={3} />}</div>
              <Person letter={r.n[0]} size={44} color={r.c} />
              <span style={{ width: 280, fontWeight: 600 }}>{r.n}</span>
              <span style={{ flex: 1, color: SUB }}>{r.s}</span>
              <span style={{ fontSize: 17, fontWeight: 650, padding: "6px 14px", borderRadius: 99, color: r.st === "Live" ? "#16a34a" : "#c2710c", background: r.st === "Live" ? "#16a34a16" : "#f59e0b1c" }}>{r.st ?? "Waiting"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The shot cuts, in shot order (each shot runs from its cut to the next).
export const connectCuts = (T: Moments) => ({ tools: T.sales - 8, reveal: T.flowly - 10, wall: T.when1 - 8, live: T.when2 - 8, board: T.no1 - 8, end: T.end + 6, dur: T.duration });

export function ConnectFilm({ f, b }: { f: number; b: Beats }) {
  const T = b.t;
  const L = b.line;
  const cut = connectCuts(T);
  const C = b.content;
  // the wall: the team, then the people/accounts of the list (initials only)
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#ec4899", "#14b8a6"];
  const people = [...C.people.map((p) => [p.name, p.role] as const), [C.event.source, C.event.label] as const, ...C.rows.map((r) => [r.name, r.value] as const)]
    .slice(0, 8)
    .map(([n, r], i) => [n.trim()[0]?.toUpperCase() ?? "•", n, r, COLORS[i]] as const);
  return (
    <AbsoluteFill style={{ fontFamily: "InterClean, system-ui, sans-serif" }}>
      <ConnectBg f={f} />

      {/* 1. A question among tag pills at different depths */}
      <Shot f={f} from={0} to={cut.tools} enter="none" exit="push" cam={(p, f) => `${float(f)} scale(${mix(1.08, 1, p)})`}>
        <Tag f={f} at={2} t="Spreadsheets" icon="sheet" x={330} y={250} z={0.9} />
        <Tag f={f} at={8} t="Invoices" icon="receipt" x={1180} y={210} z={1} />
        <Tag f={f} at={14} t="Email" icon="mail" x={1500} y={380} z={0.75} />
        <Tag f={f} at={20} t="CRM" icon="contact" x={260} y={700} z={1.1} />
        <Tag f={f} at={T.scattered} t="Exports" icon="download" x={1280} y={760} z={1.35} />
        <Tag f={f} at={T.scattered + 4} t="Chat" icon="message-square" x={720} y={840} z={0.6} />
        <Tag f={f} at={T.tools} t="Reports" icon="file-text" x={150} y={460} z={0.55} />
        {at(W / 2, 520, <Words f={f} words={L.hook} s={{ size: 70, ink: INK, weight: 500, key: () => ({ color: IND }) }} style={{ maxWidth: 1300 }} />)}
      </Shot>

      {/* 2. Three tool cards, each with an indigo header, zooming on its word */}
      <Shot f={f} from={cut.tools} to={cut.reveal} enter="push" cam={(p, f) => `${float(f)} translateX(${mix(60, -60, p)}px)`}>
        {[
          { t: b.trio[0].label, s: b.trio[0].sub, i: b.trio[0].icon, cue: T.sales, x: 360, c: "#2563eb" },
          { t: b.trio[1].label, s: b.trio[1].sub, i: b.trio[1].icon, cue: T.payments, x: 960, c: "#7c3aed" },
          { t: b.trio[2].label, s: b.trio[2].sub, i: b.trio[2].icon, cue: T.reports, x: 1560, c: "#0d9488" },
        ].map((w, i, all) => {
          const k = rise(f, w.cue - 6, 16, OUT);
          const next = all[i + 1]?.cue ?? 99999;
          const focus = rise(f, w.cue - 4, 12) * (1 - rise(f, next - 6, 12));
          return at(
            w.x,
            540,
            <div style={{ width: 500, borderRadius: 24, background: "#fff", overflow: "hidden", boxShadow: `0 ${30 + focus * 30}px ${80 + focus * 40}px rgba(50,50,140,${0.12 + focus * 0.1})`, transform: `scale(${mix(0.86, 1.08, focus)})`, filter: `blur(${(1 - focus) * (f > w.cue ? 1.5 : 0)}px)` }}>
              <div style={{ height: 150, background: `linear-gradient(120deg, ${IND}, ${w.c})`, padding: "28px 30px", boxSizing: "border-box", color: "#fff", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={{ fontSize: 38, fontWeight: 650 }}>{w.t}</span>
                <div style={{ width: 70, height: 70, borderRadius: 20, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={w.i} size={38} color="#fff" strokeWidth={2.2} /></div>
              </div>
              <div style={{ padding: 28 }}>
                <Area w={444} h={130} draw={rise(f, w.cue, 26)} color={w.c} pts={[0.3, 0.42, 0.36, 0.55, 0.5, 0.66]} />
                <div style={{ marginTop: 18, fontSize: 28, color: SUB }}>{w.s}</div>
              </div>
            </div>,
            { opacity: k },
          );
        })}
      </Shot>

      {/* 3. The product's card: an indigo header with the name, zooming in */}
      <Shot f={f} from={cut.reveal} to={cut.wall} enter="zoom" cam={(p, f) => `${float(f)} scale(${mix(0.8, 1.06, p)})`}>
        {at(W / 2, 540, (
          <div style={{ width: 1100, borderRadius: 30, background: "#fff", overflow: "hidden", boxShadow: "0 60px 140px rgba(50,50,140,0.22)" }}>
            <div style={{ height: 230, background: `linear-gradient(110deg, #20237a, ${IND} 55%, #6b7bff)`, position: "relative", padding: "40px 50px", boxSizing: "border-box" }}>
              <div style={{ color: "#fff", fontSize: 44, fontWeight: 600 }}>
                <Words f={f} words={L.reveal} s={{ size: 44, ink: "#fff", weight: 600, align: "left", key: () => ({ color: "#c7ccff" }) }} />
              </div>
              <div style={{ position: "absolute", left: 50, bottom: -70, width: 140, height: 140, borderRadius: 34, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px rgba(30,30,100,0.25)", transform: `scale(${pop(f, T.flowly - 4, 18)})` }}>
                <FlowMark size={112} colors={["#6b7bff", IND]} draw={rise(f, T.flowly - 4, 20)} />
              </div>
            </div>
            <div style={{ padding: "90px 50px 44px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 48, fontWeight: 700, color: INK, letterSpacing: "-0.03em", opacity: rise(f, T.flowly, 10) }}>{b.brand.name}</span>
                {[["Live", "#16a34a"], ["All your tools", IND]].map(([t, c], i) => (
                  <span key={t} style={{ fontSize: 20, fontWeight: 650, color: c, background: `${c}16`, padding: "6px 14px", borderRadius: 8, opacity: rise(f, T.brings + i * 8, 10) }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 30 }}>
                {b.trio.map(({ label: t, icon: ic }, i) => {
                  const k = rise(f, T.everything + i * 5, 14);
                  return (
                    <div key={t} style={{ flex: 1, padding: "18px 22px", borderRadius: 16, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 14, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
                      <Icon name={ic} size={28} color={IND} />
                      <span style={{ fontSize: 24, fontWeight: 600, color: INK }}>{t}</span>
                      <Check size={28} color="#16a34a" k={rise(f, T.dashboard + i * 3, 10)} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </Shot>

      {/* 4. A wall of people; a payment arrives → the button → every card ticks */}
      <Shot f={f} from={cut.wall} to={cut.live} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(1.12, 1.0, p)})`}>
        {(() => {
          const sent = rise(f, T.updates, 10);
          const pos = [[200, 230], [700, 230], [1220, 230], [1720, 230], [200, 830], [700, 830], [1220, 830], [1720, 830]];
          const [px, py] = glide(f, [[T.when1, 1300, 760], [T.revenue - 4, 990, 560], [T.instantly + 10, 1100, 700]]);
          return (
            <>
              {people.map(([l, n, r, c], i) =>
                at(pos[i][0], pos[i][1], <PCard l={l} n={n} r={r} c={c} f={f} tick={T.updates + 4 + i * 2} />, { opacity: rise(f, cut.wall + i * 2, 12), filter: `blur(${i === 0 || i === 3 || i === 4 || i === 7 ? 1.5 : 0}px)` }),
              )}
              {at(W / 2, 420, <Words f={f} words={L.payA} s={{ size: 52, ink: INK, weight: 500 }} />)}
              {at(W / 2, 560, (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 50px", borderRadius: 16, background: sent > 0.5 ? IND : INK, color: "#fff", fontSize: 38, fontWeight: 600, boxShadow: "0 24px 60px rgba(30,30,100,0.3)", transform: `scale(${pop(f, T.payment, 16) * (1 - press(f, [T.revenue]) * 0.06)})` }}>
                  {sent > 0.5 ? <>{C.event.done}<Check size={36} color="#22c55e" /></> : <>{C.event.label} · {C.event.detail}<Icon name="send" size={32} color="#fff" /></>}
                </div>
              ), { opacity: rise(f, T.payment - 2, 8) })}
              {at(W / 2, 680, <Words f={f} words={L.payB} s={{ size: 48, ink: INK, weight: 500, key: () => ({ color: IND }) }} />)}
              <Pointer x={px} y={py} dot press={press(f, [T.revenue])} />
            </>
          );
        })()}
      </Shot>

      {/* 5. A "live" card: sales grow; the whole team sees it */}
      <Shot f={f} from={cut.live} to={cut.board} enter="rise" cam={(p, f) => `${float(f)} scale(${mix(0.96, 1.04, p)})`}>
        {at(W / 2, 150, <Words f={f} words={L.growA} s={{ size: 66, ink: INK, weight: 500, key: () => ({ color: BLUE }) }} />)}
        {at(W / 2, 520, (
          <div style={{ width: 1180, borderRadius: 28, background: "#fff", padding: "36px 44px", boxSizing: "border-box", boxShadow: "0 50px 120px rgba(50,50,140,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, color: "#16a34a" }}><span style={{ width: 12, height: 12, borderRadius: 99, background: "#16a34a", opacity: 0.5 + 0.5 * Math.sin(f / 4) }} />LIVE</span>
              <span style={{ fontSize: 34, fontWeight: 650, color: INK }}>{C.growth.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 40, fontWeight: 700, color: INK }}>{show(C.growth.unit, count(f, T.grow, 34, C.growth.from, C.growth.to))}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", background: "#16a34a16", padding: "4px 12px", borderRadius: 99 }}>+{count(f, T.grow, 34, Math.round(pct(C.growth) / 6), pct(C.growth))}%</span>
            </div>
            <div style={{ marginTop: 26 }}>
              <Area w={1090} h={230} draw={rise(f, cut.live + 4, 24)} color={BLUE} pts={[0.2, 0.26, 0.22, 0.32, 0.3, 0.38, 0.36, 0.42, 0.46, 0.5]} lift={rise(f, T.grow, 34, OUT) * 3.4} dot />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, borderTop: `1px solid ${LINE}`, paddingTop: 22 }}>
              <div style={{ display: "flex" }}>
                {people.slice(0, 6).map(([l, , , c], i) => (
                  <div key={l} style={{ marginLeft: i ? -14 : 0, opacity: rise(f, T.entire + i * 3, 10), transform: `scale(${pop(f, T.entire + i * 3, 14)})` }}><Person letter={l} size={58} color={c} ring="#fff" /></div>
                ))}
              </div>
              <Words f={f} words={L.growB} s={{ size: 34, ink: INK, weight: 500, align: "left", key: () => ({ color: BLUE }) }} />
            </div>
          </div>
        ))}
      </Shot>

      {/* 6. The app tilted under the headline: no more switching, no more waiting */}
      <Shot f={f} from={cut.board} to={cut.end} enter="push" cam={(p, f) => `${float(f)} translateY(${mix(40, -10, p)}px)`}>
        {at(W / 2, 700, (
          <div style={{ transform: `perspective(2200px) rotateX(${mix(26, 14, rise(f, cut.board, 120, IN_OUT))}deg) rotateZ(${mix(-3, 0, rise(f, cut.board, 120, IN_OUT))}deg) scale(0.86)` }}>
            <Board
              C={C}
              f={f}
              title="All tools, one place"
              live={cut.board}
              rows={[
                { n: b.trio[0].label, s: "Synced automatically", c: "#2563eb", at: T.switching + 4, st: f >= T.switching + 4 ? "Live" : undefined },
                { n: b.trio[1].label, s: "Synced automatically", c: "#7c3aed", at: T.between + 2, st: f >= T.between + 2 ? "Live" : undefined },
                { n: b.trio[2].label, s: "Built automatically", c: "#0d9488", at: T.waiting + 4, st: f >= T.waiting + 4 ? "Live" : undefined },
                { n: "Team", s: "Everyone sees the same view", c: "#f59e0b", at: T.reports2 + 4, st: f >= T.reports2 + 4 ? "Live" : undefined },
              ]}
            />
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 330, background: "linear-gradient(180deg, rgba(246,246,252,0.97) 60%, rgba(246,246,252,0))" }} />
        {f < T.no2 - 4 && at(W / 2, 150, <Words f={f} words={L.noA} s={{ size: 70, ink: INK, weight: 500, key: () => ({ color: BLUE }) }} />, { opacity: 1 - rise(f, T.no2 - 8, 6) })}
        {f >= T.no2 - 8 && f < T.just - 4 && at(W / 2, 150, <Words f={f} words={L.noB} s={{ size: 70, ink: INK, weight: 500, key: () => ({ color: BLUE }) }} />, { opacity: 1 - rise(f, T.just - 8, 6) })}
        {f >= T.just - 8 && at(W / 2, 150, (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Words f={f} words={plainW(L.ctaA)} s={{ size: 64, ink: BLUE, weight: 500 }} />
            <Words f={f} words={plainW(L.ctaB)} s={{ size: 64, ink: INK, weight: 500 }} />
          </div>
        ))}
      </Shot>

      {/* 7. End card */}
      <Shot f={f} from={cut.end} to={cut.dur} last enter="zoom" cam={(p, f) => `${float(f, 0.4)} scale(${mix(1.03, 1, p)})`}>
        {at(W / 2, 450, <Logo size={180} ink={INK} colors={["#6b7bff", IND]} k={rise(f, cut.end, 28, OUT)} />)}
        {at(W / 2, 590, <div style={{ fontSize: 46, color: BLUE, fontWeight: 500, opacity: rise(f, cut.end + 14, 14) }}>{b.brand.tagline}</div>)}
        {at(W / 2, 720, <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 44px", borderRadius: 16, background: IND, color: "#fff", fontSize: 36, fontWeight: 600, transform: `scale(${pop(f, cut.end + 22, 16)})` }}>{b.brand.cta}<Icon name="arrow-right" size={32} color="#fff" /></div>, { opacity: rise(f, cut.end + 22, 10) })}
        {at(W / 2, 830, <div style={{ fontSize: 32, color: SUB, opacity: rise(f, cut.end + 30, 12) }}>{b.brand.url}</div>)}
      </Shot>

      {f > T.flowly + 30 && f < cut.end && (
        <div style={{ position: "absolute", left: 40, top: 34, display: "flex", alignItems: "center", gap: 10, padding: "10px 18px 10px 12px", borderRadius: 14, background: INK, color: "#fff", fontSize: 24, fontWeight: 700, opacity: rise(f, T.flowly + 30, 12) }}>
          <FlowMark size={34} colors={["#6b7bff", IND]} />
          {b.brand.name}
        </div>
      )}
    </AbsoluteFill>
  );
}
