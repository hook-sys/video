import { Icon } from "../../../icons";
import { count, IN_OUT, mix, OUT, rise } from "../../anim";
import { change, type FilmContent, show } from "../../content";
import { abs, Area, AppWindow, type AppTone, at, Check, glide, grow, Kpi, Person, Pointer, press, soft, W } from "../../refs/common";
import type { Moments } from "../../refs/beats";
import { appTone, type Block, type BlockCtx, box, card, Say } from "../kit";

// The event: something happens and the number changes, on the voice.

// A row of the list (a new one marked).
function Row({ name, amt, fresh, tone, s }: { name: string; amt: string; fresh?: boolean; tone: AppTone; s: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 20px", height: 64 * s, borderTop: `1px solid ${tone.line}`, fontSize: 18 * s }}>
      <span style={{ flex: 2, display: "flex", alignItems: "center", gap: 12, fontWeight: 600 }}>
        <Person letter={name[0]} size={34 * s} color={fresh ? tone.accent : "#9aa3b8"} />
        {name}
      </span>
      <span style={{ flex: 1, fontWeight: 650 }}>{amt}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15 * s, fontWeight: 650, color: "#0f9e6e", background: "#0f9e6e18", padding: "4px 12px", borderRadius: 99 }}>
          <Check size={18 * s} color="#0f9e6e" />
          {fresh ? "Just now" : "Done"}
        </span>
      </span>
    </div>
  );
}

// The list the event joins: the new row slides in on "payment", the figure
// counts up and glows on "updates".
function Board({ f, T, C, tone, big }: { f: number; T: Moments; C: FilmContent; tone: AppTone; big?: boolean }) {
  const row = rise(f, T.payment, 16, OUT);
  const hi = rise(f, T.updates, 10) * (1 - rise(f, T.instantly + 30, 20));
  const s = big ? 1.25 : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", gap: 18 }}>
        <Kpi tone={tone} w={300 * s} label={C.metric.label} value={show(C.metric.unit, count(f, T.revenue + 2, 26, C.metric.from, C.metric.to))} delta={f > T.updates ? change(C.metric) : undefined} hi={hi} />
        {C.side.map((x) => <Kpi key={x.label} tone={tone} w={260 * s} label={x.label} value={x.value} />)}
      </div>
      <div style={{ borderRadius: 16, border: `1px solid ${tone.line}`, overflow: "hidden" }}>
        <div style={{ height: row * 64 * s, overflow: "hidden", background: `${tone.accent}${Math.round(0x22 * (1 - rise(f, T.instantly + 30, 30))).toString(16).padStart(2, "0")}` }}>
          <Row name={C.event.source} amt={C.event.detail} fresh tone={tone} s={s} />
        </div>
        {C.rows.map((r) => <Row key={r.name} name={r.name} amt={r.value} tone={tone} s={s} />)}
      </div>
    </div>
  );
}

// From Glow: the app tilted in perspective; the line above it.
function board(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  return (
    <>
      {abs(250, 300, (
        <div style={{ transform: `perspective(2200px) rotateY(${mix(-16, -8, rise(f, c.from, 90, IN_OUT))}deg) rotateX(9deg)`, transformOrigin: "30% 50%" }}>
          <AppWindow w={1420} h={820} tone={appTone(pal)} active={2} title={c.b.trio[1]?.label ?? "Activity"}>
            <Board f={f} T={T} C={C} tone={appTone(pal)} />
          </AppWindow>
        </div>
      ))}
      {abs(160, 120, <Say c={c} words={L.payA} size={56} align="left" />)}
      {abs(1000, 120, <Say c={c} words={L.payB} size={56} align="left" />)}
    </>
  );
}

// From Dusk: a receipt scanned in corner brackets; the key fields boxed as
// the number updates.
function receipt(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const big = rise(f, T.revenue - 6, 22, IN_OUT);
  const scan = rise(f, T.revenue, 26, IN_OUT);
  const k1 = rise(f, T.updates, 10), k2 = rise(f, T.instantly, 10);
  const box = (k: number) => ({ boxShadow: `0 0 0 ${3 * k}px ${pal.accent}`, borderRadius: 8, padding: "2px 8px", background: k > 0 ? `${pal.accent}14` : undefined });
  return (
    <>
      {abs(140, 500, <Say c={c} words={L.payA} size={62} weight={500} align="left" />, { opacity: 1 - big })}
      {abs(1260, 420, <Say c={c} words={L.payB} size={62} weight={500} align="left" style={{ width: 520 }} />, { opacity: rise(f, T.revenue - 2, 8) })}
      {at(mix(1380, 960, big) - big * 200, 540, (
        <div style={{ position: "relative", transform: `perspective(1400px) rotateY(${mix(-18, 0, big)}deg) rotateZ(${mix(-4, 0, big)}deg) scale(${mix(0.55, 1, big)})` }}>
          {big > 0.2 &&
            [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
              <div key={i} style={{ position: "absolute", left: x ? undefined : -34, right: x ? -34 : undefined, top: y ? undefined : -34, bottom: y ? -34 : undefined, width: 70, height: 70, borderLeft: x ? undefined : `5px solid ${pal.accent}`, borderRight: x ? `5px solid ${pal.accent}` : undefined, borderTop: y ? undefined : `5px solid ${pal.accent}`, borderBottom: y ? `5px solid ${pal.accent}` : undefined, borderRadius: 6, opacity: big }} />
            ))}
          <div style={{ width: 560, height: 700, ...card(pal, 10), padding: 40, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: pal.accent }}>{C.event.source}</span>
              <span style={{ fontSize: 15, color: pal.panelSub }}>#1048</span>
            </div>
            <div style={{ marginTop: 30, display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, color: pal.panelSub, lineHeight: 1.7 }}>For<br /><b style={{ color: pal.panelInk }}>{c.b.brand.name}</b><br />{C.event.label}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, color: pal.panelSub }}>Amount</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: pal.accent, ...box(k1) }}>{C.event.detail}</div>
              </div>
            </div>
            <div style={{ marginTop: 34, borderTop: `1px solid ${pal.line}`, paddingTop: 18 }}>
              {C.rows.slice(0, 2).map((r) => (
                <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 18, padding: "10px 0", borderBottom: `1px solid ${pal.line}` }}><span>{r.name}</span><span>{r.value}</span></div>
              ))}
            </div>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 18, color: pal.panelSub }}>{C.metric.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", ...box(k2) }}>{show(C.metric.unit, count(f, T.updates, 20, C.metric.from, C.metric.to))}</span>
            </div>
            <div style={{ marginTop: 30, display: "flex", gap: 10, alignItems: "center", fontSize: 17, color: "#12a150", fontWeight: 650, opacity: k2 }}><Check size={26} color="#22c983" k={k2} />{C.event.done}</div>
            <div style={{ position: "absolute", left: 0, right: 0, top: mix(-80, 720, scan), height: 80, background: `linear-gradient(180deg, transparent, ${pal.accent}38, transparent)`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
          </div>
        </div>
      ), { opacity: soft(f, T.payment - 4, 20) })}
    </>
  );
}

// From Fly: the camera flies into the product: the list, then the number.
function flight(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const tone = appTone(pal);
  const zoom = rise(f, T.revenue - 6, 30, IN_OUT);
  const ox = mix(960, 600, zoom), oy = mix(660, 420, zoom);
  const s = mix(0.9, 1.04, rise(f, c.from, 40, IN_OUT)) + zoom * 0.6;
  const [px, py] = glide(f, [[T.when1, 1200, 820], [T.payment, 980, 600], [T.revenue, 860, 470]]);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px` }}>
        <div style={{ position: "absolute", left: 260, top: 280 }}>
          <AppWindow w={1400} h={760} tone={tone} active={2}>
            <Board f={f} T={T} C={C} tone={tone} />
          </AppWindow>
        </div>
        <Pointer x={px} y={py} dot press={press(f, [T.revenue + 2])} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 240, background: `linear-gradient(180deg, ${pal.dark ? "rgba(0,0,0,0.6)" : "rgba(246,248,252,0.96)"} 55%, transparent)` }} />
      {at(W / 2, 110, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Say c={c} words={L.payA} size={54} weight={500} ink={pal.accent} from="up" />
          <Say c={c} words={L.payB} size={54} weight={500} from="up" />
        </div>
      ))}
    </>
  );
}

// From Connect: a wall of people; the event button changes and every card
// ticks.
function wall(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const sent = rise(f, T.updates, 10);
  const people = [...C.people.map((p) => [p.name, p.role]), [C.event.source, C.event.label], ...C.rows.map((r) => [r.name, r.value])].slice(0, 8);
  const pos = [[200, 230], [700, 230], [1220, 230], [1720, 230], [200, 830], [700, 830], [1220, 830], [1720, 830]];
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#ec4899", "#14b8a6"];
  return (
    <>
      {people.map(([n, r], i) => {
        const tick = soft(f, T.updates + 4 + i * 2, 12);
        return at(pos[i][0], pos[i][1], (
          <div style={{ width: 420, height: 112, ...card(pal, 18), display: "flex", alignItems: "center", gap: 18, padding: "0 22px", boxSizing: "border-box" }}>
            <div style={{ position: "relative", width: 66, height: 66 }}>
              <Person letter={n[0]} size={66} color={colors[i]} />
              {tick > 0 && <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: pal.accent, opacity: tick, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={44} color={pal.accent} k={tick} /></div>}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 600, color: pal.panelInk }}>{n}</div>
              <div style={{ fontSize: 19, color: pal.panelSub }}>{r}</div>
            </div>
          </div>
        ), { opacity: soft(f, c.from + i * 2, 14) }, i);
      })}
      {at(W / 2, 420, <Say c={c} words={L.payA} size={52} weight={500} />)}
      {at(W / 2, 560, (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 50px", borderRadius: 16, background: sent > 0.5 ? pal.accent : pal.dark ? "#ffffff" : "#14152a", color: sent > 0.5 || !pal.dark ? "#fff" : "#14152a", fontSize: 38, fontWeight: 600, boxShadow: "0 24px 60px rgba(30,30,100,0.3)", transform: `scale(${grow(f, T.payment, 16) * (1 - press(f, [T.revenue]) * 0.06)})` }}>
          {sent > 0.5 ? <>{C.event.done}<Check size={36} color="#22c55e" /></> : <>{C.event.label} · {C.event.detail}<Icon name="send" size={32} color="currentColor" /></>}
        </div>
      ), { opacity: soft(f, T.payment - 2, 10) })}
      {at(W / 2, 680, <Say c={c} words={L.payB} size={48} weight={500} />)}
    </>
  );
}

// New: a notification drops in; the big number counts up with its change
// and a line draws under it.
function notify(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const drop = rise(f, T.payment - 4, 20, OUT);
  const num = count(f, T.revenue, 26, C.metric.from, C.metric.to);
  const glowK = rise(f, T.updates, 10) * (1 - rise(f, T.instantly + 30, 24));
  return (
    <>
      {abs(160, 150, <Say c={c} words={L.payA} size={60} align="left" />)}
      {at(1460, mix(-120, 250, drop), (
        <div style={{ width: 560, ...card(pal, 22), padding: "20px 24px", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="bell" size={34} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: pal.panelInk }}>{C.event.label} · {C.event.detail}</div>
            <div style={{ fontSize: 19, color: pal.panelSub }}>{C.event.source} · just now</div>
          </div>
        </div>
      ), { opacity: drop })}
      {at(W / 2, 560, (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 30, color: pal.sub, fontWeight: 600 }}>{C.metric.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontSize: 190, fontWeight: 700, letterSpacing: "-0.05em", color: pal.ink, fontVariantNumeric: "tabular-nums", textShadow: glowK ? `0 0 ${60 * glowK}px ${pal.glow}` : undefined }}>{show(C.metric.unit, num)}</span>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#16a34a", background: "#16a34a1c", padding: "6px 18px", borderRadius: 99, opacity: rise(f, T.updates, 12), transform: `scale(${grow(f, T.updates, 16)})` }}>{change(C.metric)}</span>
          </div>
          <Area w={1100} h={150} draw={rise(f, T.revenue, 40)} color={pal.accent} pts={[0.3, 0.34, 0.31, 0.4, 0.38, 0.46, 0.52, 0.5, 0.62, 0.8]} dot />
        </div>
      ), { opacity: soft(f, T.revenue - 8, 18) })}
      {at(W / 2, 960, <Say c={c} words={L.payB} size={50} weight={500} />)}
    </>
  );
}

export const PAY_BLOCKS: Block[] = [
  { id: "pay.board", role: "pay", name: "Tilted app list", from: "Glow", draw: board },
  { id: "pay.receipt", role: "pay", name: "Receipt scanned", from: "Dusk", draw: receipt, obj: () => ({ a: box(1380, 540, 308, 385, 6), z: box(760, 540, 560, 700, 10) }) },
  { id: "pay.flight", role: "pay", name: "Camera into the product", from: "Fly", draw: flight },
  { id: "pay.wall", role: "pay", name: "Wall of people ticks", from: "Connect", draw: wall },
  { id: "pay.notify", role: "pay", name: "Notification → big number", from: "new", draw: notify, obj: () => ({ z: box(1460, 250, 560, 104, 22) }) },
];
