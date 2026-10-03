import { Icon } from "../../../icons";
import { IN_OUT, mix, OUT, rise } from "../../anim";
import { plainW } from "../../refs/beats";
import { abs, Area, AppWindow, at, FlowMark, Glass, glide, grow, Kpi, Pointer, press, soft, W } from "../../refs/common";
import { appTone, type Block, type BlockCtx, box, card, Say } from "../kit";

// The closing line: the promise.

// From Glow: the mark settles in a glass notch; then a flat glowing check
// with the last words and a glass pill.
function notch(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const sw = rise(f, T.every2 - 10, 14, IN_OUT);
  return (
    <>
      <div style={{ opacity: 1 - sw, filter: `blur(${sw * 12}px)` }}>
        <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M-20 560 L640 560 C760 560 760 760 960 760 C1160 760 1160 560 1280 560 L1940 560 L1940 1100 L-20 1100 Z" fill={`${pal.glass}1a`} stroke={`${pal.glass}99`} strokeWidth={3} />
        </svg>
        {at(W / 2, mix(420, 600, rise(f, c.from + 4, 26, OUT)), <div style={{ padding: 18, borderRadius: 999, backgroundColor: `${pal.glass}22`, backgroundImage: `radial-gradient(circle, ${pal.glass}55, ${pal.glass}10)`, boxShadow: `0 0 90px ${pal.glow}88` }}><div style={{ width: 170, height: 170, borderRadius: 999, background: pal.panel, display: "flex", alignItems: "center", justifyContent: "center" }}><FlowMark size={120} colors={[pal.accent2, pal.accent]} /></div></div>)}
        {at(W / 2, 250, <Say c={c} words={L.ctaA} size={80} />)}
      </div>
      {sw > 0 && (
        <div style={{ opacity: sw }}>
          {at(640, 520, (
            <div style={{ width: 300, height: 300, borderRadius: 999, backgroundColor: pal.accent, backgroundImage: `radial-gradient(circle at 40% 30%, #ffffff, ${pal.accent2} 30%, ${pal.accent} 80%)`, boxShadow: `0 0 0 26px ${pal.glow}22, 0 0 140px ${pal.glow}99`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${grow(f, T.every2 - 8, 18)})` }}>
              <svg width={170} height={170} viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7" stroke="#fff" strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${rise(f, T.every2, 16)} 1`} /></svg>
            </div>
          ))}
          {abs(900, 380, <Say c={c} words={L.ctaB} size={70} align="left" style={{ width: 860 }} />)}
          {abs(900, 590, <Glass dark={pal.dark} tint={pal.glass} pad="14px 34px 14px 14px" glow={pal.dark ? pal.glow : undefined}><div style={{ width: 66, height: 66, borderRadius: 99, background: pal.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="sparkles" size={34} color="#fff" /></div><span style={{ fontSize: 32, fontWeight: 650, color: pal.dark ? "#fff" : pal.ink }}>{c.b.brand.tagline || c.b.brand.name}</span></Glass>, { opacity: soft(f, T.need, 14) })}
        </div>
      )}
    </>
  );
}

// From Dusk: the line resolves out of blur; then the last words inside
// curved lines.
function frame(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const sw = rise(f, T.every2 - 10, 14, IN_OUT);
  return (
    <>
      {at(W / 2, 540, <Say c={c} words={L.ctaA} size={120} weight={500} />, { opacity: 1 - rise(f, T.every2 - 10, 8), filter: `blur(${sw * 14}px)` })}
      {sw > 0 && (
        <>
          <svg width={W} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
            {["M0 0 C 500 420, 500 660, 0 1080", "M1920 0 C 1420 420, 1420 660, 1920 1080", "M0 0 C 700 300, 1220 300, 1920 0", "M0 1080 C 700 780, 1220 780, 1920 1080"].map((d, i) => (
              <path key={i} d={d} stroke={pal.accent2} strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={`${rise(f, T.every2 - 8 + i * 3, 30, IN_OUT)} 1`} />
            ))}
          </svg>
          {/* the second line only once the first has gone (same place) */}
          {at(W / 2, 540, <Say c={c} words={L.ctaB} size={92} weight={500} />, { opacity: rise(f, T.every2 - 2, 8) })}
        </>
      )}
    </>
  );
}

// From Fly: the closing line in two tones over the product, tilted.
function overview(c: BlockCtx) {
  const { f, L, C, pal } = c;
  const tone = appTone(pal);
  return (
    <>
      <div style={{ position: "absolute", left: 260, top: 330, transform: `perspective(2200px) rotateX(16deg) rotateY(${mix(-6, 4, rise(f, c.from, 110, IN_OUT))}deg)`, transformOrigin: "50% 0" }}>
        <AppWindow w={1400} h={760} tone={tone}>
          <div style={{ display: "flex", gap: 18 }}>
            <Kpi tone={tone} w={340} label={C.growth.label} value={`${C.growth.unit === "$" ? "$" : ""}${C.growth.to.toLocaleString("en-US")}`} />
            {C.side.map((x) => <Kpi key={x.label} tone={tone} w={300} label={x.label} value={x.value} />)}
          </div>
          <div style={{ marginTop: 22, borderRadius: 16, border: `1px solid ${tone.line}`, padding: 20 }}>
            <Area w={1100} h={240} draw={1} color={pal.accent} pts={[0.2, 0.26, 0.22, 0.32, 0.3, 0.38, 0.36, 0.42, 0.6, 0.86]} dot />
          </div>
        </AppWindow>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 330, background: `linear-gradient(180deg, ${pal.dark ? "rgba(0,0,0,0.6)" : "rgba(246,248,252,0.97)"} 60%, transparent)` }} />
      {at(W / 2, 160, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Say c={c} words={plainW(L.ctaA)} size={68} weight={500} ink={pal.accent} from="up" />
          <Say c={c} words={plainW(L.ctaB)} size={68} weight={500} from="up" />
        </div>
      ))}
    </>
  );
}

// From Connect: the three things fanned behind the product's card; the
// closing line above.
function stack(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const fanK = rise(f, T.live2 - 6, 24, OUT);
  return (
    <>
      {at(W / 2, 160, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Say c={c} words={L.ctaA} size={66} weight={500} />
          <Say c={c} words={L.ctaB} size={66} weight={500} />
        </div>
      ))}
      {b.trio.map((x, i) => at(W / 2 + (i - 1) * 420 * fanK, 640 + Math.abs(i - 1) * 40 * fanK, (
        <div style={{ width: 380, height: 300, ...card(pal, 24), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, transform: `rotate(${(i - 1) * 8 * fanK}deg)` }}>
          <div style={{ width: 96, height: 96, borderRadius: 28, background: `${pal.accent}16`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={x.icon} size={52} color={pal.accent} /></div>
          <div style={{ fontSize: 34, fontWeight: 650 }}>{x.label}</div>
        </div>
      ), { opacity: fanK, zIndex: 1 }, x.label))}
      {at(W / 2, 620, (
        <div style={{ width: 420, height: 340, ...card(pal, 28), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <FlowMark size={130} colors={[pal.accent2, pal.accent]} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>{b.brand.name}</div>
        </div>
      ), { zIndex: 2, transform: `translate(-50%, -50%) scale(${grow(f, c.from + 4, 20)})` })}
    </>
  );
}

// New: the line big; the call-to-action button is clicked on the last
// words.
function button(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const [px, py] = glide(f, [[T.every2 - 10, 1500, 900], [T.answer + 4, 1080, 700]]);
  const p = press(f, [T.answer + 6]);
  return (
    <>
      {at(W / 2, 330, <Say c={c} words={L.cta} size={84} style={{ maxWidth: 1500 }} />)}
      {at(W / 2, 680, (
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "34px 70px", borderRadius: 999, background: `linear-gradient(100deg, ${pal.accent}, ${pal.accent2})`, color: "#fff", fontSize: 56, fontWeight: 700, boxShadow: `0 ${30 - p * 14}px ${80 - p * 30}px ${pal.accent}77`, transform: `scale(${grow(f, T.every2 - 8, 18) * (1 - p * 0.06)})` }}>
          {b.brand.cta}
          <span style={{ width: 70, height: 70, borderRadius: 99, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="arrow-right" size={44} color="#fff" strokeWidth={2.6} /></span>
        </div>
      ), { opacity: soft(f, T.every2 - 8, 16) })}
      <Pointer x={px} y={py} press={p} />
    </>
  );
}

export const CTA_BLOCKS: Block[] = [
  { id: "cta.notch", role: "cta", name: "Glass notch → glowing check", from: "Glow", draw: notch },
  { id: "cta.frame", role: "cta", name: "Words in curved lines", from: "Dusk", draw: frame },
  { id: "cta.overview", role: "cta", name: "Two tones over the product", from: "Fly", draw: overview },
  { id: "cta.stack", role: "cta", name: "Things fan behind the card", from: "Connect", draw: stack, obj: () => ({ a: box(960, 620, 420, 340, 28), z: box(960, 620, 420, 340, 28) }) },
  { id: "cta.button", role: "cta", name: "Button clicked", from: "new", draw: button, obj: (c) => ({ a: box(960, 680, 230 + c.b.brand.cta.length * 31, 138, 69, "accent"), z: box(960, 680, 230 + c.b.brand.cta.length * 31, 138, 69, "accent") }) },
];
