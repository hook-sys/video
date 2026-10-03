import { Icon } from "../../../icons";
import { count, IN_OUT, mix, OUT, rise } from "../../anim";
import { change, show } from "../../content";
import { appear, Area, AppWindow, at, Check, Comet, FlowMark, Glass, grow, Kpi, Logo, Pointer, press, soft, W } from "../../refs/common";
import { appTone, type Block, type BlockCtx, card, Say } from "../kit";

// The product comes in: its name on its spoken word, then what it does.
const markColors = (c: BlockCtx): [string, string] => [c.pal.accent2, c.pal.accent];

// From Glow: a light streak flies in and becomes the logo; then the logo
// rises and the product's cards link up under a glass label.
function streak(c: BlockCtx) {
  const { f, T, L, C, b, pal } = c;
  const k = rise(f, T.flowly - 2, 22, OUT);
  const flare = rise(f, T.flowly - 4, 10) * (1 - rise(f, T.flowly + 8, 24));
  const up = rise(f, T.into - 8, 24, IN_OUT);
  const lineK = rise(f, T.into + 6, 26, IN_OUT);
  const tone = appTone(pal);
  const cards = [
    { x: 960, y: 560, el: <Kpi tone={tone} w={420} label={C.metric.label} value={show(C.metric.unit, count(f, T.into + 4, 30, C.metric.from * 0.85, C.metric.to))} delta={change(C.metric)} /> },
    { x: 520, y: 820, el: <Kpi tone={tone} w={380} label={C.side[0].label} value={C.side[0].value} /> },
    { x: 1400, y: 820, el: <div style={{ width: 380, background: "#fff", borderRadius: 16, padding: 18 }}><div style={{ fontSize: 15, color: tone.sub }}>{C.growth.label}</div><Area w={344} h={90} draw={rise(f, T.live, 30)} color={pal.accent} pts={[0.2, 0.3, 0.26, 0.42, 0.4, 0.58, 0.66, 0.8]} /></div> },
  ];
  return (
    <>
      <div style={{ opacity: 1 - rise(f, T.flowly, 10) }}><Comet f={f} at={c.from} dur={18} pts={[[-200, 700], [400, 760], [700, 420], [W / 2 - 230, 480]]} color={pal.glow} width={7} big ghost={0} /></div>
      <div style={{ position: "absolute", left: 0, top: mix(480, 170, up), width: W, height: 6, background: `linear-gradient(90deg, transparent, ${pal.glow}, transparent)`, opacity: flare, boxShadow: `0 0 80px ${pal.glow}` }} />
      {at(W / 2, mix(480, 170, up), <div style={{ transform: `scale(${mix(1, 0.62, up)})` }}><Logo size={150} ink={pal.ink} colors={markColors(c)} k={k} /></div>)}
      {at(W / 2, mix(650, 290, up), <Say c={c} words={up < 0.5 ? L.revealA : L.reveal} size={mix(48, 44, up)} weight={500} />)}
      <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: up }}>
        {["M960 620 L960 700 L520 700 L520 770", "M960 620 L960 700 L1400 700 L1400 770"].map((d, i) => (
          <path key={i} d={d} stroke={pal.dark ? `${pal.glow}aa` : `${pal.accent}88`} strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={`${lineK} 1`} />
        ))}
        {lineK > 0.2 && <circle cx={mix(520, 1400, ((f - T.into) / 40) % 1)} cy={700} r={5} fill={pal.glow} />}
      </svg>
      {cards.map((x, i) => at(x.x, x.y, <div style={{ padding: 6, borderRadius: 22, background: `${pal.glass}22`, border: `1px solid ${pal.glass}55` }}>{x.el}</div>, appear(f, T.into - 2 + i * 6, 24, "up", "translate(-50%, -50%)"), i))}
      {up > 0.5 && at(W / 2, 400, <Glass dark={pal.dark} tint={pal.glass} pad="12px 30px" glow={pal.dark ? pal.glow : undefined} style={{ fontSize: 30, fontWeight: 650, color: pal.dark ? "#fff" : pal.accent }}><Icon name="activity" size={28} color={pal.dark ? pal.glow : pal.accent} strokeWidth={2.4} />{b.label}</Glass>, { opacity: rise(f, T.live - 2, 10) })}
    </>
  );
}

// From Dusk: the name with a glowing tagline pill; then a big pill button
// is pressed.
function pill(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const press1 = press(f, [T.live + 4]);
  const swap = rise(f, T.into - 8, 16, IN_OUT);
  return (
    <>
      <div style={{ opacity: 1 - swap, filter: `blur(${swap * 14}px)` }}>
        {at(W / 2, 450, <Logo size={170} ink={pal.ink} colors={markColors(c)} k={rise(f, T.flowly - 4, 26, OUT)} />)}
        {at(W / 2, 640, (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 34px", borderRadius: 999, border: `2px solid ${pal.accent2}aa`, boxShadow: `0 0 40px ${pal.accent}77, inset 0 0 20px ${pal.accent}44` }}>
            <Icon name="sparkles" size={34} color={pal.accent2} />
            <Say c={c} words={L.revealA} size={40} weight={500} />
          </div>
        ), { opacity: soft(f, T.brings - 4, 14), transform: `translate(-50%, -50%) scale(${grow(f, T.brings - 4, 18)})` })}
      </div>
      {swap > 0 && (
        <div style={{ opacity: swap }}>
          <div style={{ position: "absolute", left: 0, top: 400, width: W, height: 280, background: pal.dark ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))" : `${pal.accent}0c`, borderTop: `1px solid ${pal.dark ? "rgba(255,255,255,0.16)" : `${pal.accent}22`}`, borderBottom: `1px solid ${pal.dark ? "rgba(255,255,255,0.16)" : `${pal.accent}22`}` }} />
          {at(W / 2, 540, (
            <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "34px 66px", borderRadius: 999, background: `linear-gradient(180deg, ${pal.accent}, ${pal.accent}dd)`, color: "#fff", boxShadow: `0 0 0 ${8 + press1 * 6}px ${pal.accent}22, 0 30px 80px ${pal.accent}77`, transform: `scale(${(1 - press1 * 0.05) * mix(0.9, 1, swap)})` }}>
              <Icon name="layout-dashboard" size={66} color="#fff" strokeWidth={2} />
              <Say c={c} words={L.revealB} size={60} weight={600} ink="#fff" />
            </div>
          ))}
          <Pointer x={mix(1300, 1040, rise(f, T.into, 16, IN_OUT))} y={mix(760, 575, rise(f, T.into, 16, IN_OUT))} press={press1} hand />
        </div>
      )}
    </>
  );
}

// From Fly: the name, the headline, the product rising underneath, tilted.
function rising(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const up = rise(f, T.into - 4, 30, IN_OUT);
  const tone = appTone(pal);
  return (
    <>
      {at(W / 2, mix(470, 130, up), <div style={{ transform: `scale(${mix(1, 0.55, up)})` }}><Logo size={170} ink={pal.ink} colors={markColors(c)} k={rise(f, T.flowly - 4, 26, OUT)} /></div>)}
      {at(W / 2, mix(650, 250, up), <Say c={c} words={L.reveal} size={56} weight={500} from="up" />)}
      <div style={{ position: "absolute", left: 210, top: mix(1150, 370, up), transform: `perspective(2000px) rotateX(${mix(38, 16, up)}deg)`, transformOrigin: "50% 0" }}>
        <AppWindow w={1500} h={760} tone={tone}>
          <div style={{ display: "flex", gap: 18 }}>
            <Kpi tone={tone} w={340} label={C.metric.label} value={show(C.metric.unit, C.metric.from)} />
            {C.side.map((x) => <Kpi key={x.label} tone={tone} w={300} label={x.label} value={x.value} />)}
          </div>
          <div style={{ marginTop: 22, borderRadius: 16, border: `1px solid ${tone.line}`, padding: 20 }}>
            <div style={{ fontSize: 16, color: tone.sub, marginBottom: 10 }}>{C.growth.label}</div>
            <Area w={1100} h={220} draw={rise(f, T.into + 6, 40)} color={pal.accent} pts={[0.2, 0.28, 0.24, 0.36, 0.34, 0.46, 0.5, 0.62, 0.7, 0.86]} />
          </div>
        </AppWindow>
      </div>
    </>
  );
}

// From Connect: the product's card — a coloured header with the line, the
// mark, the name and the three things ticked.
function profile(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  return at(W / 2, 540, (
    <div style={{ width: 1100, overflow: "hidden", ...card(pal, 30), transform: `scale(${mix(0.86, 1.04, rise(f, c.from, 90, IN_OUT))})` }}>
      <div style={{ height: 230, background: `linear-gradient(110deg, ${pal.accent}, ${pal.accent2})`, position: "relative", padding: "40px 50px", boxSizing: "border-box" }}>
        <Say c={c} words={L.reveal} size={44} weight={600} ink="#fff" align="left" />
        <div style={{ position: "absolute", left: 50, bottom: -70, width: 140, height: 140, borderRadius: 34, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px rgba(30,30,100,0.25)", transform: `scale(${grow(f, T.flowly - 4, 18)})`, opacity: soft(f, T.flowly - 4, 16) }}>
          <FlowMark size={112} colors={markColors(c)} draw={rise(f, T.flowly - 4, 20)} />
        </div>
      </div>
      <div style={{ padding: "90px 50px 44px" }}>
        <span style={{ fontSize: 48, fontWeight: 700, color: pal.panelInk, letterSpacing: "-0.03em", opacity: rise(f, T.flowly, 10) }}>{c.b.brand.name}</span>
        <div style={{ display: "flex", gap: 24, marginTop: 30 }}>
          {b.trio.map((x, i) => {
            const k = soft(f, T.everything + i * 5, 18);
            return (
              <div key={x.label} style={{ flex: 1, padding: "18px 22px", borderRadius: 16, border: `1px solid ${pal.line}`, display: "flex", alignItems: "center", gap: 14, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
                <Icon name={x.icon} size={28} color={pal.accent} />
                <span style={{ fontSize: 24, fontWeight: 600, color: pal.panelInk }}>{x.label}</span>
                <Check size={28} color="#16a34a" k={soft(f, T.dashboard + i * 3, 12)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ));
}

// New: the three things fly in from three sides and merge into the mark;
// the name writes on beside it; what it does in a pill below.
function converge(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const m = rise(f, T.flowly - 14, 16, IN_OUT);
  const name = rise(f, T.flowly - 2, 22, OUT);
  const from = [[-760, -300], [760, -300], [0, 420]];
  return (
    <>
      {m < 1 && b.trio.map((x, i) => at(W / 2 + from[i][0] * (1 - m), 440 + from[i][1] * (1 - m), <div style={{ width: 130, height: 130, borderRadius: 36, background: pal.panel, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 20px 50px ${pal.dark ? "rgba(0,0,0,0.4)" : `${pal.accent}33`}` }}><Icon name={x.icon} size={64} color={pal.accent} /></div>, { opacity: 1 - m * m, transform: `translate(-50%, -50%) scale(${mix(1, 0.5, m)}) rotate(${(1 - m) * (i - 1) * 30}deg)` }, x.label))}
      {at(W / 2, 440, (
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ transform: `scale(${mix(0.4, 1, m)})`, opacity: m, filter: `drop-shadow(0 20px 50px ${pal.accent}66)` }}><FlowMark size={170} colors={markColors(c)} draw={m} /></div>
          <div style={{ maxWidth: 1300 * name, overflow: "hidden", whiteSpace: "nowrap", paddingLeft: 40 * name, fontSize: 150, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.2, color: pal.ink }}>{c.b.brand.name}</div>
        </div>
      ))}
      {at(W / 2, 680, <Glass dark={pal.dark} tint={pal.glass} pad="18px 40px" style={{ color: pal.dark ? "#fff" : pal.ink }}><Say c={c} words={L.reveal} size={42} weight={500} /></Glass>, { opacity: soft(f, T.brings - 4, 16) })}
    </>
  );
}

export const REVEAL_BLOCKS: Block[] = [
  { id: "reveal.streak", role: "reveal", name: "Light streak → linked cards", from: "Glow", draw: streak },
  { id: "reveal.pill", role: "reveal", name: "Tagline pill → big button", from: "Dusk", draw: pill },
  { id: "reveal.rising", role: "reveal", name: "Product rises under the name", from: "Fly", draw: rising },
  { id: "reveal.profile", role: "reveal", name: "Product card", from: "Connect", draw: profile },
  { id: "reveal.converge", role: "reveal", name: "Things merge into the mark", from: "new", draw: converge },
];
