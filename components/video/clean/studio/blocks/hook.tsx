import { mix, OUT, rise } from "../../anim";
import { at, Comet, soft, Token, Typed, W } from "../../refs/common";
import { type Block, type BlockCtx, Say } from "../kit";
import { Sheet, Tag, TOOLS, Win } from "./parts";

// The opening line (the problem). Every block keeps its things on screen for
// the whole part; the keyword is marked in the look's way.

// From Glow: comet lines cross the line; then the big word with flat tokens
// orbiting, which scatter on the keyword.
function comet(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const up = rise(f, T.data - 8, 18, OUT);
  const sc = rise(f, T.scattered, 34, OUT);
  return (
    <>
      <Comet f={f} at={c.from - 6} dur={50} pts={[[-100, 300], [500, 120], [900, 820], [1500, 760]]} color={pal.glow} width={6} big />
      <Comet f={f} at={c.from + 2} dur={46} pts={[[200, 1000], [700, 640], [1300, 260], [2000, 380]]} color={pal.accent2} width={4} />
      {TOOLS.map((t, i) => {
        const a = (i / TOOLS.length) * Math.PI * 2 + f / 90;
        const r = mix(300, 620, sc);
        const k = soft(f, T.data + 2 + i * 3, 22);
        return at(W / 2 + Math.cos(a) * r * 1.25, 600 + Math.sin(a) * r * 0.42, <Token icon={t.icon} size={mix(130, 100, sc)} bg={pal.panel} color={pal.accent} ring={`${pal.glow}55`} style={{ transform: `scale(${mix(0.6, 1, k)}) rotate(${sc * (i % 2 ? 28 : -28)}deg)` }} />, { opacity: k * (1 - sc * 0.3) }, t.icon);
      })}
      {at(W / 2, mix(520, 200, up), <Say c={c} words={L.hookA} size={mix(96, 60, up)} />)}
      {at(W / 2, 470, <div style={{ fontSize: 200, fontWeight: 700, letterSpacing: "-0.05em", backgroundImage: `linear-gradient(180deg, ${pal.ink}, ${pal.glow})`, WebkitBackgroundClip: "text", color: "transparent", opacity: rise(f, T.data - 2, 12), filter: `blur(${(1 - rise(f, T.data - 2, 12)) * 16}px)`, textTransform: "capitalize" }}>{L.hookBig.t}</div>)}
      {at(W / 2, 680, <Say c={c} words={L.hookB} size={56} />)}
    </>
  );
}

// From Dusk: the line typed with a caret between blurred UI sheets.
function typed(c: BlockCtx) {
  const { f, L, pal } = c;
  const sheets = [
    [150, -90, 420, 300, -3, 2, 0], [640, -140, 380, 260, 2, 3, 1], [1200, -60, 400, 290, -2, 1.5, 2], [1620, 60, 340, 260, 4, 4, 3],
    [-60, 760, 420, 300, 3, 4, 3], [420, 800, 460, 300, -2, 2, 1], [980, 780, 560, 300, 1, 1.5, 0], [1600, 840, 380, 260, -4, 3, 2],
  ];
  return (
    <>
      {sheets.map(([x, y, w, h, r, b, k], i) => <Sheet key={i} f={f} x={x} y={y} w={w} h={h} r={r} blur={b} kind={k} pal={pal} />)}
      {at(W / 2, 470, <Say c={c} words={L.hookA} size={54} weight={500} ink={pal.sub} />)}
      {at(W / 2, 575, <Typed f={f} words={L.hookTail} size={88} ink={pal.ink} weight={500} />)}
    </>
  );
}

// From Fly: tool windows at different depths under a two-tone headline.
function depth(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const wins = [
    { x: 140, y: 520, r: -6, z: -200, b: 2 },
    { x: 700, y: 660, r: 3, z: 40, b: 0 },
    { x: 1280, y: 500, r: 5, z: -120, b: 1.5 },
    { x: 1500, y: 800, r: -4, z: -260, b: 3 },
    { x: 60, y: 880, r: 4, z: -320, b: 3.5 },
  ];
  const sc = rise(f, T.scattered, 30, OUT);
  return (
    <>
      {wins.map((w, i) => {
        const k = rise(f, c.from + 4 + i * 5, 22, OUT);
        const t = TOOLS[i];
        return (
          <div key={i} style={{ position: "absolute", left: w.x + (w.x - 900) * sc * 0.18, top: w.y + Math.sin(f / 40 + i) * 10 + (1 - k) * 120, transform: `translateZ(${w.z}px) rotate(${w.r * (1 + sc)}deg)`, opacity: k, filter: `blur(${w.b}px)` }}>
            <Win title={t.name} icon={t.icon} color={t.color} pal={pal} w={440} h={290} />
          </div>
        );
      })}
      {at(
        W / 2,
        220,
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Say c={c} words={L.hookA} size={70} weight={500} ink={pal.accent} from="up" />
          <Say c={c} words={L.hookTail} size={70} weight={500} from="up" />
        </div>,
      )}
    </>
  );
}

// From Connect: the line among tag pills at different depths.
function tags(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const pills = [
    { t: "Spreadsheets", icon: "sheet", x: 330, y: 250, z: 0.9, a: c.from + 2 },
    { t: "Invoices", icon: "receipt", x: 1180, y: 210, z: 1, a: c.from + 8 },
    { t: "Email", icon: "mail", x: 1500, y: 380, z: 0.75, a: c.from + 14 },
    { t: "CRM", icon: "contact", x: 260, y: 700, z: 1.1, a: c.from + 20 },
    { t: "Exports", icon: "download", x: 1280, y: 760, z: 1.35, a: T.scattered },
    { t: "Chat", icon: "message-square", x: 720, y: 840, z: 0.6, a: T.scattered + 4 },
    { t: "Reports", icon: "file-text", x: 150, y: 460, z: 0.55, a: T.tools },
  ];
  return (
    <>
      {pills.map((p) => <Tag key={p.t} t={p.t} icon={p.icon} x={p.x} y={p.y} z={p.z} f={f} k={rise(f, p.a, 16, OUT)} pal={pal} />)}
      {at(W / 2, 520, <Say c={c} words={L.hook} size={70} weight={500} style={{ maxWidth: 1300 }} />)}
    </>
  );
}

// New: a neat stack of the tools in the middle fans out to the edges on the
// keyword — the "scattered" made literal.
function fan(c: BlockCtx) {
  const { f, T, L, pal } = c;
  const out = rise(f, T.scattered - 2, 30, OUT);
  const spots = [[-640, -230, -14], [620, -250, 12], [-700, 120, 9], [680, 140, -10], [-80, -300, -4], [90, 170, 6]];
  return (
    <>
      {TOOLS.map((t, i) => {
        const k = soft(f, c.from + 2 + i * 4, 18);
        const [dx, dy, r] = spots[i];
        return at(W / 2 + dx * out + (i - 2.5) * 10 * (1 - out), 470 + dy * out + (i - 2.5) * -8 * (1 - out), <Win title={t.name} icon={t.icon} color={t.color} pal={pal} w={420} h={270} style={{ transform: `rotate(${r * out + (i - 2.5) * 2 * (1 - out)}deg) scale(${mix(0.9, 0.78, out)})` }} />, { opacity: k, zIndex: i }, t.name);
      })}
      {at(W / 2, 900, <Say c={c} words={L.hook} size={60} weight={600} style={{ maxWidth: 1500 }} />, { zIndex: 20 })}
    </>
  );
}

export const HOOK_BLOCKS: Block[] = [
  { id: "hook.comet", role: "hook", name: "Comets & big word", from: "Glow", draw: comet },
  { id: "hook.typed", role: "hook", name: "Typed between sheets", from: "Dusk", draw: typed },
  { id: "hook.depth", role: "hook", name: "Windows at depth", from: "Fly", draw: depth },
  { id: "hook.tags", role: "hook", name: "Tags at depth", from: "Connect", draw: tags },
  { id: "hook.fan", role: "hook", name: "Stack fans out", from: "new", draw: fan },
];
