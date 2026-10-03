import { interpolate } from "remotion";
import { Icon } from "../../../icons";
import { IN_OUT, mix, OUT, rise } from "../../anim";
import { Area, at, Glass, glide, grow, Pointer, press, soft, W } from "../../refs/common";
import { type Block, type BlockCtx, box, card, Say } from "../kit";
import { Win } from "./parts";

// The three things (each on its own spoken word). All three stay on screen
// once they have come in.
const COLORS = ["#16a34a", "#2563eb", "#9333ea"];

// From Glow: tilted glass slabs beside a glass notch with a "?".
function slabs(c: BlockCtx) {
  const { f, b, pal } = c;
  const pos = [
    { x: 720, y: 290, r: -9, z: 1 },
    { x: 600, y: 520, r: 6, z: 1.18 },
    { x: 760, y: 760, r: -7, z: 0.96 },
  ];
  return (
    <>
      <div style={{ position: "absolute", left: 1330, top: -60, width: 900, height: 1200, borderRadius: 120, background: `linear-gradient(180deg, ${pal.glass}1a, ${pal.glass}08)`, borderLeft: `2px solid ${pal.glass}55`, boxShadow: `inset 30px 0 80px -30px ${pal.glow}66` }} />
      {at(1400, 520, <div style={{ width: 128, height: 128, borderRadius: 999, backgroundColor: pal.accent, backgroundImage: `radial-gradient(circle at 40% 35%, #ffffff, ${pal.accent2} 60%, ${pal.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 70, fontWeight: 700, color: "#fff", boxShadow: `0 0 80px ${pal.glow}aa`, transform: `scale(${grow(f, c.from + 6, 18)})`, opacity: soft(f, c.from + 6, 20) }}>?</div>)}
      {b.trio.map((it, i) => {
        const k = soft(f, it.at - 3, 22);
        const p = pos[i];
        return at(
          p.x + (1 - k) * -120,
          p.y,
          <div style={{ transform: `rotate(${p.r}deg) scale(${p.z})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Glass dark={pal.dark} tint={pal.glass} radius={14} pad="18px 48px" style={{ fontSize: 66, fontWeight: 700, color: pal.dark ? "#fff" : pal.ink, letterSpacing: "-0.02em" }}>
              {it.label}
            </Glass>
            <span style={{ fontSize: 26, color: pal.sub, fontWeight: 500, opacity: rise(f, it.at + 10, 14) }}>{it.sub}</span>
          </div>,
          { opacity: k, filter: `blur(${(1 - k) * 10}px)` },
          it.label,
        );
      })}
    </>
  );
}

// From Dusk: a word carousel — each thing in a glowing pill slides in.
function carousel(c: BlockCtx) {
  const { f, b, T, pal } = c;
  const pos = interpolate(f, [T.sales - 6, T.payments - 12, T.payments + 6, T.reports - 12, T.reports + 6], [0, 0, 1, 1, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: IN_OUT });
  return (
    <>
      {b.trio.map((it, i) => {
        const d = i - pos;
        const k = soft(f, it.at - 6, 20);
        const on = Math.abs(d) < 0.5;
        return at(
          W / 2 + d * 780,
          500,
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "26px 56px 26px 30px", borderRadius: 999, background: on ? `linear-gradient(180deg, ${pal.accent}, ${pal.accent}cc)` : pal.dark ? "rgba(255,255,255,0.06)" : `${pal.accent}10`, boxShadow: on ? `0 0 0 10px ${pal.accent}22, 0 30px 90px ${pal.accent}77` : undefined }}>
              <div style={{ width: 92, height: 92, borderRadius: 999, background: on ? "rgba(255,255,255,0.18)" : `${pal.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={it.icon} size={52} color={on ? "#fff" : pal.accent} strokeWidth={2.2} />
              </div>
              <span style={{ fontSize: 96, fontWeight: 600, color: on ? "#fff" : pal.ink, letterSpacing: "-0.03em" }}>{it.label}</span>
            </div>
            <span style={{ fontSize: 40, color: pal.sub, opacity: rise(f, it.at + 10, 12) }}>{it.sub}</span>
          </div>,
          { opacity: k * Math.max(0, 1 - Math.abs(d) * 0.75), filter: `blur(${Math.min(14, Math.abs(d) * 10)}px)` },
          it.label,
        );
      })}
    </>
  );
}

// From Fly: three tool windows; a dot cursor hops from one to the next.
function windows(c: BlockCtx) {
  const { f, b, L, pal } = c;
  const xs = [90, 700, 1310];
  const [px, py] = glide(f, [[b.trio[0].at - 6, 300, 760], [b.trio[1].at - 8, 330, 640], [b.trio[1].at + 4, 940, 640], [b.trio[2].at - 6, 960, 640], [b.trio[2].at + 6, 1560, 640]]);
  return (
    <>
      {b.trio.map((it, i) => {
        const k = rise(f, it.at - 6, 16, OUT);
        return (
          <div key={it.label} style={{ position: "absolute", left: xs[i], top: 400, opacity: k, transform: `translateY(${(1 - k) * 80}px) scale(${mix(0.9, 1, k)})` }}>
            <Win title={it.label} icon={it.icon} color={COLORS[i]} pal={pal} w={520} h={340}>
              <Area w={480} h={150} draw={rise(f, it.at, 24)} color={COLORS[i]} pts={[0.3, 0.5, 0.35, 0.6, 0.45, 0.7]} />
            </Win>
            <div style={{ textAlign: "center", marginTop: 20, fontSize: 32, color: pal.sub, opacity: rise(f, it.at + 8, 12) }}>{it.sub}</div>
          </div>
        );
      })}
      <Pointer x={px} y={py} dot press={press(f, [b.trio[1].at, b.trio[2].at])} ink={pal.dark ? "#fff" : "#111"} />
      {at(W / 2, 200, <Say c={c} words={L.trio} size={52} weight={500} from="up" />)}
    </>
  );
}

// From Connect: three cards with a coloured header, each zooming on its word.
function cards(c: BlockCtx) {
  const { f, b, pal } = c;
  return (
    <>
      {b.trio.map((it, i, all) => {
        const k = rise(f, it.at - 6, 16, OUT);
        const next = all[i + 1]?.at ?? 99999;
        const focus = rise(f, it.at - 4, 12) * (1 - rise(f, next - 6, 12));
        return at(
          [360, 960, 1560][i],
          540,
          <div style={{ width: 500, borderRadius: 24, overflow: "hidden", ...card(pal), transform: `scale(${mix(0.86, 1.08, focus)})` }}>
            <div style={{ height: 150, background: `linear-gradient(120deg, ${pal.accent}, ${COLORS[i]})`, padding: "28px 30px", boxSizing: "border-box", color: "#fff", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <span style={{ fontSize: 38, fontWeight: 650 }}>{it.label}</span>
              <div style={{ width: 70, height: 70, borderRadius: 20, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={it.icon} size={38} color="#fff" strokeWidth={2.2} />
              </div>
            </div>
            <div style={{ padding: 28 }}>
              <Area w={444} h={130} draw={rise(f, it.at, 26)} color={COLORS[i]} pts={[0.3, 0.42, 0.36, 0.55, 0.5, 0.66]} />
              <div style={{ marginTop: 18, fontSize: 28, color: pal.panelSub }}>{it.sub}</div>
            </div>
          </div>,
          { opacity: k },
          it.label,
        );
      })}
    </>
  );
}

// New: the frame splits into three tall panels; each slides in on its word
// (from above, below, above) with a big icon, the name and its place.
function split(c: BlockCtx) {
  const { f, b, pal } = c;
  return (
    <>
      {b.trio.map((it, i) => {
        const k = rise(f, it.at - 6, 22, OUT);
        const dir = i % 2 ? 1 : -1;
        return (
          <div key={it.label} style={{ position: "absolute", left: 90 + i * 590, top: 110, width: 560, height: 860, borderRadius: 36, ...card(pal, 36), transform: `translateY(${(1 - k) * dir * 700}px)`, opacity: k, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
            <div style={{ width: 200, height: 200, borderRadius: 56, background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 30px 70px ${pal.accent}55`, transform: `rotate(${(1 - rise(f, it.at, 20)) * -12}deg)` }}>
              <Icon name={it.icon} size={110} color="#fff" strokeWidth={1.9} draw={rise(f, it.at - 2, 22)} />
            </div>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.035em", color: pal.panelInk }}>{it.label}</div>
            <div style={{ fontSize: 34, color: pal.panelSub, opacity: rise(f, it.at + 8, 14) }}>{it.sub}</div>
          </div>
        );
      })}
    </>
  );
}

export const TRIO_BLOCKS: Block[] = [
  { id: "trio.slabs", role: "trio", name: "Glass slabs", from: "Glow", draw: slabs },
  { id: "trio.carousel", role: "trio", name: "Word carousel", from: "Dusk", draw: carousel },
  { id: "trio.windows", role: "trio", name: "Tool windows + cursor", from: "Fly", draw: windows },
  { id: "trio.cards", role: "trio", name: "Header cards", from: "Connect", draw: cards },
  { id: "trio.split", role: "trio", name: "Three panels", from: "new", draw: split, obj: () => ({ a: box(370, 540, 560, 860, 36), z: box(960, 540, 560, 860, 36) }) },
];
