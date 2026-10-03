import { Icon } from "../../../icons";
import { mix, OUT, rise } from "../../anim";
import { abs, at, Comet, FlowMark, Glass, grow, Logo, soft, W } from "../../refs/common";
import { type Block, type BlockCtx, box } from "../kit";

// The end card: logo, promise, call to action, address.
const cols = (c: BlockCtx): [string, string] => [c.pal.accent2, c.pal.accent];

// From Glow: logo, promise, a glass call-to-action pill, address; a comet
// underlines it.
function glow(c: BlockCtx) {
  const { f, pal, b } = c;
  const t = c.from;
  return (
    <>
      <Comet f={f} at={t - 4} dur={30} pts={[[-100, 900], [500, 980], [1300, 860], [2050, 600]]} color={pal.glow} width={5} />
      {at(W / 2, 420, <Logo size={180} ink={pal.ink} colors={cols(c)} k={rise(f, t, 26, OUT)} />)}
      {at(W / 2, 560, <div style={{ fontSize: 50, color: pal.sub, fontWeight: 500, opacity: rise(f, t + 14, 14) }}>{b.brand.tagline}</div>)}
      {at(W / 2, 690, <Glass dark={pal.dark} tint={pal.glass} glow={pal.dark ? pal.glow : undefined} pad="22px 52px" style={{ fontSize: 42, fontWeight: 700, color: pal.dark ? "#fff" : pal.ink, transform: `scale(${grow(f, t + 22, 18)})` }}>{b.brand.cta}<Icon name="arrow-right" size={32} color={pal.glow} strokeWidth={2.6} /></Glass>, { opacity: soft(f, t + 22, 14) })}
      {at(W / 2, 800, <div style={{ fontSize: 34, color: pal.sub, letterSpacing: "0.04em", opacity: rise(f, t + 30, 14) }}>{b.brand.url}</div>)}
    </>
  );
}

// From Dusk: the mark draws, the name writes on, the address in a dark pill.
function mark(c: BlockCtx) {
  const { f, pal, b } = c;
  const t = c.from;
  return (
    <>
      {at(W / 2, 470, <Logo size={180} ink={pal.ink} colors={cols(c)} k={rise(f, t, 30, OUT)} />)}
      {at(W / 2, 610, <div style={{ fontSize: 44, color: pal.sub, opacity: rise(f, t + 16, 14) }}>{b.brand.tagline}</div>)}
      {at(W / 2, 740, <div style={{ padding: "18px 44px", borderRadius: 999, background: pal.dark ? "#ffffff" : pal.ink, color: pal.dark ? "#111" : "#fff", fontSize: 36, fontWeight: 600, transform: `scale(${grow(f, t + 24, 16)})` }}>{b.brand.url ? `${b.brand.cta} · ${b.brand.url}` : b.brand.cta}</div>, { opacity: soft(f, t + 24, 12) })}
    </>
  );
}

// From Fly / Connect: logo, the promise in the accent, a solid button and the
// address under it.
function button(c: BlockCtx) {
  const { f, pal, b } = c;
  const t = c.from;
  return (
    <>
      {at(W / 2, 450, <Logo size={180} ink={pal.ink} colors={cols(c)} k={rise(f, t, 28, OUT)} />)}
      {at(W / 2, 590, <div style={{ fontSize: 46, color: pal.accent, fontWeight: 500, opacity: rise(f, t + 14, 14) }}>{b.brand.tagline}</div>)}
      {at(W / 2, 720, <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 44px", borderRadius: 16, background: pal.accent, color: "#fff", fontSize: 36, fontWeight: 600, transform: `scale(${grow(f, t + 22, 16)})` }}>{b.brand.cta}<Icon name="arrow-right" size={32} color="#fff" /></div>, { opacity: soft(f, t + 22, 12) })}
      {at(W / 2, 830, <div style={{ fontSize: 32, color: pal.sub, opacity: rise(f, t + 30, 12) }}>{b.brand.url}</div>)}
    </>
  );
}

// New: the mark big on the left, a line draws down, the name, promise and
// button stacked on the right.
function split(c: BlockCtx) {
  const { f, pal, b } = c;
  const t = c.from;
  const line = rise(f, t + 6, 24, OUT);
  return (
    <>
      {at(620, 540, <div style={{ transform: `scale(${grow(f, t, 22)})`, opacity: soft(f, t, 18), filter: `drop-shadow(0 30px 60px ${pal.accent}66)` }}><FlowMark size={300} colors={cols(c)} draw={rise(f, t, 30)} /></div>)}
      <div style={{ position: "absolute", left: 900, top: 540 - 230 * line, width: 4, height: 460 * line, borderRadius: 4, background: `linear-gradient(180deg, ${pal.accent2}, ${pal.accent})` }} />
      {abs(980, 330, <div style={{ fontSize: 130, fontWeight: 700, letterSpacing: "-0.045em", color: pal.ink, opacity: soft(f, t + 8, 18), transform: `translateX(${(1 - soft(f, t + 8, 20)) * 60}px)` }}>{b.brand.name}</div>)}
      {abs(986, 500, <div style={{ fontSize: 44, color: pal.sub, opacity: soft(f, t + 16, 16) }}>{b.brand.tagline}</div>)}
      {abs(986, 600, <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "20px 40px", borderRadius: 999, background: `linear-gradient(100deg, ${pal.accent}, ${pal.accent2})`, color: "#fff", fontSize: 36, fontWeight: 650 }}>{b.brand.cta}<Icon name="arrow-right" size={30} color="#fff" /></div>, { opacity: soft(f, t + 24, 14) })}
      {abs(990, 720, <div style={{ fontSize: 30, color: pal.sub, opacity: soft(f, t + 30, 14) }}>{b.brand.url}</div>)}
    </>
  );
}

// New: the mark in a slowly turning ring of light; the name below; the
// address in a chip.
function spotlight(c: BlockCtx) {
  const { f, pal, b } = c;
  const t = c.from;
  const k = soft(f, t, 24);
  return (
    <>
      {at(W / 2, 400, (
        <div style={{ position: "relative", width: 420, height: 420, opacity: k, transform: `scale(${mix(0.8, 1, k)})` }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `3px solid ${pal.glow}55`, background: `conic-gradient(from ${f * 1.5}deg, transparent, ${pal.glow}aa, transparent 30%, transparent 50%, ${pal.accent2}aa, transparent 80%)`, filter: "blur(6px)" }} />
          <div style={{ position: "absolute", inset: 18, borderRadius: 999, background: pal.dark ? "#00000055" : "#ffffffcc", display: "flex", alignItems: "center", justifyContent: "center" }}><FlowMark size={200} colors={cols(c)} draw={rise(f, t + 4, 26)} /></div>
        </div>
      ))}
      {at(W / 2, 700, <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: "-0.045em", color: pal.ink, opacity: soft(f, t + 10, 16) }}>{b.brand.name}</div>)}
      {at(W / 2, 810, <div style={{ fontSize: 38, color: pal.sub, opacity: soft(f, t + 18, 14) }}>{b.brand.tagline}</div>)}
      {at(W / 2, 900, <div style={{ padding: "12px 30px", borderRadius: 999, border: `2px solid ${pal.accent}`, color: pal.dark ? pal.ink : pal.accent, fontSize: 30, fontWeight: 600 }}>{b.brand.url ? `${b.brand.cta} · ${b.brand.url}` : b.brand.cta}</div>, { opacity: soft(f, t + 26, 14) })}
    </>
  );
}

export const END_BLOCKS: Block[] = [
  { id: "end.glow", role: "end", name: "Logo + glass pill", from: "Glow", draw: glow },
  { id: "end.mark", role: "end", name: "Mark draws, dark pill", from: "Dusk", draw: mark },
  { id: "end.button", role: "end", name: "Logo + solid button", from: "Fly / Connect", draw: button },
  { id: "end.split", role: "end", name: "Mark | name, button", from: "new", draw: split },
  { id: "end.spotlight", role: "end", name: "Mark in a ring of light", from: "new", draw: spotlight, obj: () => ({ a: box(960, 400, 420, 420, 210, "glass") }) },
];
