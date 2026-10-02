import { AbsoluteFill, interpolate, interpolateColors } from "remotion";
import { Icon } from "../../icons";
import { count, IN_OUT, mix, money, OUT, pop, rise } from "../anim";
import { abs, AppWindow, at, Check, float, Kpi, LIGHT_APP, Logo, Person, Pointer, press, Shot, Typed, W, Words } from "./common";
import { kw, T } from "./timing";

// Film 2 — "Dusk" (reference: a payments-assistant explainer): a near-black
// plum field lit purple from below, typed words with a caret, blurred UI
// sheets drifting at the edges, a word carousel, a big pill button, the app
// tilted in deep perspective, a document scanned in corner brackets; then
// the field turns white with a lavender glow for the solution and the end.

const VIO = "#8b5cf6";
const VIO2 = "#c4a8ff";
const APP = LIGHT_APP("#7c4dff", "#b18cff");

// The field: dark plum lit from below; from the growth shot on it turns
// white with a lavender light; dark again for "no more", white for the end.
function DuskBg({ f, cuts }: { f: number; cuts: { light: number; dark: number; light2: number } }) {
  // a quick flip on the cut (a slow blend shows a flat grey frame)
  const l = rise(f, cuts.light - 2, 3) * (1 - rise(f, cuts.dark - 2, 3)) + rise(f, cuts.light2 - 2, 3);
  const bg = interpolateColors(l, [0, 1], ["#0d0612", "#f7f5fb"]);
  const glow = interpolateColors(l, [0, 1], ["rgba(139,92,246,0.85)", "rgba(196,168,255,0.55)"]);
  const lift = Math.sin(f / 45) * 40;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -300 + Math.sin(f / 70) * 160, width: W + 600, height: 900, top: 760 + lift, borderRadius: "50%", background: `radial-gradient(ellipse at 50% 30%, ${glow}, transparent 62%)`, filter: "blur(30px)" }} />
      <div style={{ position: "absolute", left: 500 + Math.cos(f / 60) * 300, width: 900, height: 600, top: -380, borderRadius: "50%", background: `radial-gradient(ellipse, ${l > 0.5 ? "rgba(196,168,255,0.25)" : "rgba(139,92,246,0.14)"}, transparent 65%)`, filter: "blur(30px)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: `linear-gradient(90deg, transparent, rgba(110,255,200,${0.5 * (1 - l)}), ${VIO}, transparent)`, opacity: 0.8 }} />
    </AbsoluteFill>
  );
}

// A blurred UI sheet (an invoice, a form, a list) drifting at an edge.
function Sheet({ x, y, w, h, r, blur, f, kind }: { x: number; y: number; w: number; h: number; r: number; blur: number; f: number; kind: number }) {
  return (
    <div style={{ position: "absolute", left: x + Math.sin(f / 50 + kind) * 14, top: y + Math.cos(f / 60 + kind) * 10, width: w, height: h, borderRadius: 14, background: kind % 2 ? "#ffffff" : "#1d1426", border: "1px solid rgba(255,255,255,0.12)", transform: `rotate(${r}deg)`, filter: `blur(${blur}px)`, padding: 22, boxSizing: "border-box", boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: kind % 2 ? "#222" : "#ddd", marginBottom: 14 }}>{["INVOICE", "Payment details", "Report Q3", "Sales export"][kind % 4]}</div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span style={{ height: 9, width: `${40 + ((i * 17 + kind * 11) % 40)}%`, borderRadius: 9, background: kind % 2 ? "#e6e3ee" : "#3a2d47" }} />
          <span style={{ height: 9, width: "18%", borderRadius: 9, background: kind % 2 ? "#efedf5" : "#2c2236" }} />
        </div>
      ))}
    </div>
  );
}

export function DuskFilm({ f }: { f: number }) {
  const cut = { carousel: T.sales - 8, logo: T.flowly - 10, button: T.into - 6, app: T.dashboard - 4, scan: T.when1 - 8, star: T.when2 - 8, dash: T.grow - 2, team: T.change - 8, nomore: T.no1 - 8, approved: T.no2 - 8, save: T.just - 8, control: T.every2 - 8, end: T.end + 6, dur: T.duration };
  const dark = "#f4f0ff";
  const ink = "#16121f";
  const bg = { light: cut.star, dark: cut.nomore, light2: cut.save };
  return (
    <AbsoluteFill style={{ fontFamily: "InterClean, system-ui, sans-serif" }}>
      <DuskBg f={f} cuts={bg} />

      {/* 1. Typed question between blurred sheets */}
      <Shot f={f} from={0} to={cut.carousel} enter="none" exit="zoom" cam={(p, f) => `${float(f)} scale(${mix(1, 1.08, p)})`}>
        <Sheet f={f} x={150} y={-90} w={420} h={300} r={-3} blur={2} kind={0} />
        <Sheet f={f} x={640} y={-140} w={380} h={260} r={2} blur={3} kind={1} />
        <Sheet f={f} x={1200} y={-60} w={400} h={290} r={-2} blur={1.5} kind={2} />
        <Sheet f={f} x={1620} y={60} w={340} h={260} r={4} blur={4} kind={3} />
        <Sheet f={f} x={-60} y={760} w={420} h={300} r={3} blur={4} kind={3} />
        <Sheet f={f} x={420} y={800} w={460} h={300} r={-2} blur={2} kind={1} />
        <Sheet f={f} x={980} y={780} w={560} h={300} r={1} blur={1.5} kind={0} />
        <Sheet f={f} x={1600} y={840} w={380} h={260} r={-4} blur={3} kind={2} />
        {at(W / 2, 470, <Words f={f} words={kw("Every team starts with")} s={{ size: 54, ink: "#b9aecb", weight: 500 }} />)}
        {at(W / 2, 570, <Typed f={f} words={kw("data scattered across different tools.")} size={92} ink={dark} weight={500} />)}
      </Shot>

      {/* 2. A word carousel: Sales → Payments → Reports slide past */}
      <Shot f={f} from={cut.carousel} to={cut.logo} enter="zoom" cam={(p, f) => `${float(f)} scale(${mix(1.04, 1, p)})`}>
        {(() => {
          const items = [
            { t: "Sales", s: "in one place", c: T.sales, icon: "chart-line" },
            { t: "Payments", s: "in another", c: T.payments, icon: "credit-card" },
            { t: "Reports", s: "somewhere else", c: T.reports, icon: "file-text" },
          ];
          const pos = interpolate(f, [T.sales - 6, T.payments - 6, T.payments + 4, T.reports - 6, T.reports + 4], [0, 0, 1, 1, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: IN_OUT });
          return items.map((it, i) => {
            const d = i - pos;
            const k = rise(f, it.c - 4, 12);
            return at(
              W / 2 + d * 780,
              500,
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "26px 56px 26px 30px", borderRadius: 999, background: Math.abs(d) < 0.5 ? "linear-gradient(180deg, #7c4dff, #5b2fd9)" : "rgba(255,255,255,0.06)", boxShadow: Math.abs(d) < 0.5 ? "0 0 0 10px rgba(255,255,255,0.06), 0 30px 90px rgba(124,77,255,0.55), inset 0 2px 0 rgba(255,255,255,0.3)" : undefined }}>
                  <div style={{ width: 92, height: 92, borderRadius: 999, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={it.icon} size={52} color="#fff" strokeWidth={2.2} /></div>
                  <span style={{ fontSize: 96, fontWeight: 600, color: "#fff", letterSpacing: "-0.03em" }}>{it.t}</span>
                </div>
                <span style={{ fontSize: 40, color: "#b9aecb", opacity: rise(f, it.c + 10, 12) }}>{it.s}</span>
              </div>,
              { opacity: k * Math.max(0, 1 - Math.abs(d) * 0.75), filter: `blur(${Math.min(14, Math.abs(d) * 10)}px)` },
            );
          });
        })()}
      </Shot>

      {/* 3. The name, with a glowing tagline pill */}
      <Shot f={f} from={cut.logo} to={cut.button} enter="blur" cam={(p, f) => `${float(f, 0.5)} scale(${mix(0.96, 1.04, p)})`}>
        {at(W / 2, 450, <Logo size={170} ink="#ffffff" colors={["#a78bfa", "#6d28d9"]} k={rise(f, T.flowly - 4, 26, OUT)} />)}
        {at(W / 2, 640, (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 34px", borderRadius: 999, border: "2px solid rgba(196,168,255,0.65)", boxShadow: "0 0 40px rgba(139,92,246,0.6), inset 0 0 20px rgba(139,92,246,0.3)", color: "#efe8ff", fontSize: 40, fontWeight: 500 }}>
            <Icon name="sparkles" size={34} color="#e9ddff" />
            <Words f={f} words={kw("brings everything")} s={{ size: 40, ink: "#efe8ff", weight: 500 }} />
          </div>
        ), { opacity: rise(f, T.brings - 4, 12), transform: `translate(-50%, -50%) scale(${pop(f, T.brings - 4, 16)})` })}
      </Shot>

      {/* 4. A big pill button, pressed */}
      <Shot f={f} from={cut.button} to={cut.app} enter="zoom" exit="push" cam={(p, f) => `${float(f)} scale(${mix(1.1, 1.22, p)})`}>
        {(() => {
          const pr = press(f, [T.live + 4]);
          return (
            <>
              <div style={{ position: "absolute", left: 0, top: 400, width: W, height: 280, background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))", borderTop: "1px solid rgba(255,255,255,0.16)", borderBottom: "1px solid rgba(255,255,255,0.16)" }} />
              {at(W / 2, 540, (
                <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "34px 66px", borderRadius: 999, background: "linear-gradient(180deg, #7c4dff, #4c1fd1)", color: "#fff", fontSize: 64, fontWeight: 600, boxShadow: `0 0 0 ${8 + pr * 6}px rgba(255,255,255,0.12), 0 30px 80px rgba(124,77,255,0.55)`, transform: `scale(${1 - pr * 0.05})` }}>
                  <Icon name="layout-dashboard" size={66} color="#fff" strokeWidth={2} />
                  <Words f={f} words={kw("into one live dashboard.")} s={{ size: 64, ink: "#fff", weight: 600 }} />
                </div>
              ))}
              {abs(380, 515, <Icon name="menu" size={56} color="rgba(255,255,255,0.35)" />)}
              {abs(1490, 515, <Icon name="send" size={56} color="rgba(255,255,255,0.35)" />)}
              <Pointer x={mix(1300, 1040, rise(f, T.into, 16, IN_OUT))} y={mix(760, 575, rise(f, T.into, 16, IN_OUT))} press={pr} hand />
            </>
          );
        })()}
      </Shot>

      {/* 5. The app in deep perspective, sweeping in */}
      <Shot f={f} from={cut.app} to={cut.scan} enter="push" cam={(p, f) => `${float(f)} translateX(${mix(120, -60, p)}px)`}>
        {abs(260, 240, (
          <div style={{ transform: `perspective(1600px) rotateY(${mix(-30, -14, rise(f, cut.app, 40, IN_OUT))}deg) rotateX(${mix(18, 8, rise(f, cut.app, 40, IN_OUT))}deg) rotateZ(-2deg)`, transformOrigin: "20% 50%" }}>
            <AppWindow w={1500} h={820} tone={APP} active={0}>
              <DashBody f={f} live={cut.app} />
            </AppWindow>
          </div>
        ))}
      </Shot>

      {/* 6. A payment arrives: a receipt, scanned in brackets, revenue updates */}
      <Shot f={f} from={cut.scan} to={cut.star} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(0.96, 1.08, p)})`}>
        {(() => {
          const big = rise(f, T.revenue - 6, 22, IN_OUT);
          const scan = rise(f, T.revenue, 26, IN_OUT);
          const docX = mix(1380, 960, big);
          return (
            <>
              {abs(140, 500, <Words f={f} words={kw("When a payment arrives,")} s={{ size: 62, ink: dark, weight: 500, align: "left" }} />, { opacity: 1 - big })}
              {abs(1260, 420, <Words f={f} words={kw("revenue updates instantly.", ["instantly."])} s={{ size: 62, ink: dark, weight: 500, align: "left", key: () => ({ color: VIO2 }) }} style={{ width: 520 }} />, { opacity: rise(f, T.revenue - 2, 8) })}
              {at(docX - big * 200, 540, (
                <div style={{ position: "relative", transform: `perspective(1400px) rotateY(${mix(-18, 0, big)}deg) rotateZ(${mix(-4, 0, big)}deg) scale(${mix(0.55, 1, big)})` }}>
                  {big > 0.2 && [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
                    <div key={i} style={{ position: "absolute", left: x ? undefined : -34, right: x ? -34 : undefined, top: y ? undefined : -34, bottom: y ? -34 : undefined, width: 70, height: 70, borderLeft: x ? undefined : `5px solid ${VIO}`, borderRight: x ? `5px solid ${VIO}` : undefined, borderTop: y ? undefined : `5px solid ${VIO}`, borderBottom: y ? `5px solid ${VIO}` : undefined, borderRadius: 6, opacity: big }} />
                  ))}
                  <Receipt f={f} scan={scan} />
                </div>
              ), { opacity: rise(f, T.payment - 4, 12) })}
            </>
          );
        })()}
      </Shot>

      {/* 7. White: a sparkle, then "When sales grow," */}
      <Shot f={f} from={cut.star} to={cut.dash} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(1, 1.06, p)})`}>
        {(() => {
          const s = pop(f, cut.star + 2, 18);
          const fly = rise(f, T.sales + 0, 16, IN_OUT);
          return (
            <>
              {at(mix(W / 2, 1290, fly), mix(540, 470, fly), <Star size={mix(170, 70, fly)} k={s} f={f} />)}
              {at(W / 2 - 40, 550, <Words f={f} words={kw("When sales grow,", ["grow,"])} s={{ size: 104, ink, weight: 500, key: () => ({ color: VIO }) }} />)}
            </>
          );
        })()}
      </Shot>

      {/* 8. The tilted dashboard: the numbers and the chart rise */}
      <Shot f={f} from={cut.dash} to={cut.team} enter="push" cam={(p, f) => `${float(f)} translate(${mix(80, -60, p)}px, ${mix(20, 0, p)}px) scale(${mix(1, 1.05, p)})`}>
        {at(W / 2, 140, <Words f={f} words={kw("the entire team sees", ["team"])} s={{ size: 64, ink, weight: 500, key: () => ({ color: VIO }) }} />)}
        {abs(260, 230, (
          <div style={{ transform: "perspective(1600px) rotateY(-22deg) rotateX(14deg) rotateZ(-3deg)", transformOrigin: "30% 50%" }}>
            <AppWindow w={1500} h={860} tone={APP} active={1} title="Sales">
              <DashBody f={f} live={T.grow} grow />
            </AppWindow>
          </div>
        ))}
      </Shot>

      {/* 9. The entire team: rows with initials, each ticked */}
      <Shot f={f} from={cut.team} to={cut.nomore} enter="rise" cam={(p, f) => `${float(f)} scale(${mix(0.98, 1.06, p)})`}>
        {at(W / 2, 200, <Words f={f} words={kw("the change in one view.", ["view."])} s={{ size: 64, ink, weight: 500, key: () => ({ color: VIO }) }} />)}
        {at(W / 2, 560, (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ width: 760, display: "flex", justifyContent: "space-between", padding: "22px 30px", borderRadius: 18, background: "#fff", boxShadow: "0 20px 60px rgba(80,50,160,0.12)", fontSize: 30, fontWeight: 600, color: ink }}>
              <span>Team</span>
              <span>Seen</span>
            </div>
            {[
              ["M", "Maya Chen", "Head of Sales", T.change - 2],
              ["R", "Ravi Patel", "Finance lead", T.change + 8],
              ["S", "Sara Kim", "Operations", T.view - 4],
            ].map(([l, n, r, c], i) => (
              <div key={i} style={{ width: 760, display: "flex", alignItems: "center", gap: 22, padding: "20px 30px", borderRadius: 18, background: "#fff", boxShadow: "0 20px 60px rgba(80,50,160,0.12)", opacity: rise(f, (c as number) - 6, 12), transform: `translateY(${(1 - rise(f, (c as number) - 6, 16)) * 40}px)` }}>
                <Person letter={l as string} size={64} color={["#7c4dff", "#e0475b", "#0f9e6e"][i]} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 26, fontWeight: 650, color: ink }}>{n}</div>
                  <div style={{ fontSize: 22, color: "#77738a" }}>{r}</div>
                </div>
                <Check size={46} color="#22c983" k={pop(f, c as number, 14)} />
              </div>
            ))}
          </div>
        ))}
      </Shot>

      {/* 10. Dark again: "No more switching between tools." in a glowing pill */}
      <Shot f={f} from={cut.nomore} to={cut.approved} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(0.96, 1.04, p)})`}>
        {at(W / 2, 540, (
          <div style={{ padding: "30px 64px", borderRadius: 999, background: "linear-gradient(180deg, rgba(167,139,250,0.95), rgba(124,77,255,0.9))", boxShadow: "0 0 0 10px rgba(255,255,255,0.08), 0 0 90px rgba(139,92,246,0.7)", transform: `scale(${pop(f, cut.nomore + 4, 18)})` }}>
            <Words f={f} words={kw("No more switching between tools.", [], { switching: T.between })} s={{ size: 66, ink: "#fff", weight: 500 }} />
          </div>
        ))}
      </Shot>

      {/* 11. "No more waiting for reports." — a ring fills, a check */}
      <Shot f={f} from={cut.approved} to={cut.save} enter="zoom" cam={(p, f) => `${float(f)} scale(${mix(1.05, 0.98, p)})`}>
        {(() => {
          const ring = rise(f, cut.approved + 4, 34, IN_OUT);
          const c = 2 * Math.PI * 110;
          return (
            <>
              {at(W / 2, 420, (
                <svg width={280} height={280} viewBox="-140 -140 280 280">
                  <circle r={110} fill="none" stroke="rgba(110,255,200,0.15)" strokeWidth={14} />
                  <circle r={110} fill="none" stroke="#5ef0b4" strokeWidth={14} strokeLinecap="round" strokeDasharray={`${ring * c} ${c}`} transform="rotate(-90)" style={{ filter: "drop-shadow(0 0 12px #5ef0b4)" }} />
                  <path d="M-42 4 L-12 34 L46 -30" stroke="#5ef0b4" strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${rise(f, cut.approved + 34, 12)} 1`} />
                </svg>
              ))}
              {at(W / 2, 700, <Words f={f} words={kw("No more waiting for reports.", ["reports."], {}, 21)} s={{ size: 66, ink: "#fff", weight: 500, key: () => ({ color: "#5ef0b4" }) }} />)}
            </>
          );
        })()}
      </Shot>

      {/* 12. White: "Just one live dashboard" — words resolve out of blur */}
      <Shot f={f} from={cut.save} to={cut.control} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(1.1, 1, p)})`}>
        {at(W / 2, 540, <Words f={f} words={kw("Just one live dashboard", ["live"])} s={{ size: 120, ink, weight: 500, key: () => ({ color: VIO }) }} />)}
      </Shot>

      {/* 13. "with every answer you need." inside curved lines */}
      <Shot f={f} from={cut.control} to={cut.end} enter="blur" cam={(p, f) => `${float(f)} scale(${mix(0.96, 1.04, p)})`}>
        <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          {["M0 0 C 500 420, 500 660, 0 1080", "M1920 0 C 1420 420, 1420 660, 1920 1080", "M0 0 C 700 300, 1220 300, 1920 0", "M0 1080 C 700 780, 1220 780, 1920 1080"].map((d, i) => (
            <path key={i} d={d} stroke={VIO2} strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={`${rise(f, cut.control + i * 3, 30, IN_OUT)} 1`} />
          ))}
        </svg>
        {at(W / 2, 540, <Words f={f} words={kw("with every answer you need.", ["answer"])} s={{ size: 92, ink, weight: 500, key: () => ({ color: VIO }) }} />)}
      </Shot>

      {/* 14. End: the mark draws, the name, the address in a pill */}
      <Shot f={f} from={cut.end} to={cut.dur} last enter="blur" cam={(p, f) => `${float(f, 0.4)} scale(${mix(1.03, 1, p)})`}>
        {at(W / 2, 470, <Logo size={180} ink={ink} colors={["#a78bfa", "#6d28d9"]} k={rise(f, cut.end, 30, OUT)} />)}
        {at(W / 2, 610, <div style={{ fontSize: 44, color: "#5d5870", opacity: rise(f, cut.end + 16, 14) }}>Every answer you need</div>)}
        {at(W / 2, 740, <div style={{ padding: "18px 44px", borderRadius: 999, background: ink, color: "#fff", fontSize: 36, fontWeight: 600, transform: `scale(${pop(f, cut.end + 24, 16)})` }}>Try Flowly free · flowly.app</div>, { opacity: rise(f, cut.end + 24, 10) })}
      </Shot>
    </AbsoluteFill>
  );
}

// A four-point sparkle.
function Star({ size, k, f }: { size: number; k: number; f: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ transform: `scale(${k}) rotate(${Math.sin(f / 20) * 8}deg)`, filter: "drop-shadow(0 10px 30px rgba(139,92,246,0.5))" }}>
      <defs>
        <linearGradient id="dstar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4a8ff" />
          <stop offset="1" stopColor="#7c4dff" />
        </linearGradient>
      </defs>
      <path d="M0 -48 C6 -10 10 -6 48 0 C10 6 6 10 0 48 C-6 10 -10 6 -48 0 C-10 -6 -6 -10 0 -48 Z" fill="url(#dstar)" />
    </svg>
  );
}

// A payment receipt; `scan` sweeps a light over it and boxes the key fields.
function Receipt({ f, scan }: { f: number; scan: number }) {
  const box = (k: number) => ({ boxShadow: `0 0 0 ${3 * k}px ${VIO}`, borderRadius: 8, padding: "2px 8px", background: k > 0 ? "rgba(139,92,246,0.08)" : undefined });
  const k1 = rise(f, T.updates, 10), k2 = rise(f, T.instantly, 10);
  return (
    <div style={{ width: 560, height: 700, background: "#fff", borderRadius: 10, padding: 40, boxSizing: "border-box", position: "relative", overflow: "hidden", color: "#1b1630", boxShadow: "0 40px 100px rgba(0,0,0,0.45)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#6d28d9" }}>Lumen Co.</span>
        <span style={{ fontSize: 15, color: "#8a85a0" }}>Receipt #1048</span>
      </div>
      <div style={{ marginTop: 30, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, color: "#8a85a0", lineHeight: 1.7 }}>Billed to<br /><b style={{ color: "#1b1630" }}>Flowly Inc.</b><br />Payment received</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, color: "#8a85a0" }}>Amount</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#6d28d9", ...box(k1) }}>$2,400</div>
        </div>
      </div>
      <div style={{ marginTop: 34, borderTop: "1px solid #eee", paddingTop: 18 }}>
        {[["Pro plan · annual", "$2,000"], ["Seats × 4", "$400"]].map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 18, padding: "10px 0", borderBottom: "1px solid #f2f2f2" }}><span>{a}</span><span>{b}</span></div>
        ))}
      </div>
      <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 18, color: "#8a85a0" }}>Revenue</span>
        <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", ...box(k2) }}>{money(count(f, T.updates, 20, 48300, 50700))}</span>
      </div>
      <div style={{ marginTop: 30, display: "flex", gap: 10, alignItems: "center", fontSize: 17, color: "#12a150", fontWeight: 650, opacity: k2 }}><Check size={26} color="#22c983" k={k2} />Updated instantly</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: mix(-80, 720, scan), height: 80, background: "linear-gradient(180deg, transparent, rgba(139,92,246,0.22), transparent)", opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
    </div>
  );
}

// The dashboard body of the app: KPIs, a sales chart, recent payments.
function DashBody({ f, live, grow }: { f: number; live: number; grow?: boolean }) {
  const g = rise(f, live, 40, OUT);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ fontSize: 32, fontWeight: 650 }}>Welcome back, <span style={{ color: APP.accent }}>Maya</span></div>
      <div style={{ display: "flex", gap: 18 }}>
        <Kpi tone={APP} w={300} label="Revenue" value={money(count(f, live, 40, grow ? 50700 : 41200, grow ? 63900 : 50700))} delta={grow ? "+26%" : "+12%"} />
        <Kpi tone={APP} w={260} label="Sales" value={String(count(f, live, 40, grow ? 312 : 280, grow ? 396 : 312))} />
        <Kpi tone={APP} w={260} label="Reports" value="Live" />
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ flex: 1.4, borderRadius: 16, border: `1px solid ${APP.line}`, padding: 20 }}>
          <div style={{ fontSize: 16, color: APP.sub, marginBottom: 12 }}>Sales this month</div>
          <svg width={620} height={240}>
            {(() => {
              const pts = [0.2, 0.28, 0.24, 0.36, 0.34, 0.46, 0.5, 0.62, 0.7, 0.86].map((v, i, a) => [i * (620 / (a.length - 1)), 230 - (grow ? v * g : v * 0.9) * 210]);
              const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
              return (
                <>
                  <path d={`${d} L620 240 L0 240 Z`} fill="rgba(124,77,255,0.12)" />
                  <path d={d} stroke={APP.accent} strokeWidth={4} fill="none" />
                </>
              );
            })()}
          </svg>
        </div>
        <div style={{ flex: 1, borderRadius: 16, border: `1px solid ${APP.line}`, padding: 20 }}>
          <div style={{ fontSize: 16, color: APP.sub, marginBottom: 10 }}>Latest payments</div>
          {[["Lumen Co.", "$2,400"], ["Northwind", "$1,240"], ["Acme Studio", "$860"], ["Blue Harbor", "$2,150"]].map(([n, a], i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${APP.line}`, fontSize: 17 }}>
              <Person letter={n[0]} size={32} color={["#7c4dff", "#9aa3b8", "#9aa3b8", "#9aa3b8"][i]} />
              <span style={{ flex: 1, fontWeight: 600 }}>{n}</span>
              <span style={{ fontWeight: 650 }}>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

