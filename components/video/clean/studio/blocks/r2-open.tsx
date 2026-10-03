import type { CSSProperties } from "react";
import { Icon } from "../../../icons";
import { IN_OUT, mix, OUT, rise } from "../../anim";
import type { KWord } from "../../text";
import { abs, at, FlowMark, glide, grow, Person, Pointer, press, soft, W } from "../../refs/common";
import { appTone, type Block, type BlockCtx, type Box, card, Say } from "../kit";
import type { Pal } from "../looks";
import { TOOLS } from "./parts";

// Blocks from the second set of references: Converse (banking, pastel),
// UrVote (voting, warm), Madison (local marketing, violet) and Alex (sales
// AI, azure). People are initials; brands are generic icons.

const markColors = (c: BlockCtx): [string, string] => [c.pal.accent2, c.pal.accent];
const glassCard = (pal: Pal, radius = 28): CSSProperties => ({
  borderRadius: radius,
  background: pal.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)",
  border: `1.5px solid ${pal.dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.9)"}`,
  boxShadow: pal.dark ? "0 30px 80px rgba(0,0,0,0.35)" : "0 30px 80px rgba(60,70,140,0.12)",
});

// Letters typed as they are spoken (1.3 frames a letter); the keyword in the
// accent. Returns the spans and how many letters are out (for the camera).
export function TypeIn({ f, words, size, pal, weight = 500, caret = true, keyColor }: { f: number; words: KWord[]; size: number; pal: Pal; weight?: number; caret?: boolean; keyColor?: string }) {
  const out = words.map((w) => (f < w.at ? 0 : Math.min(w.t.length, Math.floor((f - w.at) / 1.3) + 1)));
  const typing = out.some((n, i) => n > 0 && n < words[i].t.length);
  const spans = words.map((w, i) => {
    const n = out[i];
    return (
      <span
        key={i}
        style={{
          color: w.key ? (keyColor ?? pal.accent) : undefined,
          opacity: n ? 1 : 0,
          whiteSpace: "pre",
        }}
      >
        {w.t.slice(0, n)}
        {n === w.t.length && i < words.length - 1 ? " " : ""}
      </span>
    );
  });
  const blink = typing || Math.floor(f / 15) % 2 === 0;
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        color: pal.ink,
        letterSpacing: "-0.03em",
        whiteSpace: "nowrap",
        lineHeight: 1.1,
      }}
    >
      {spans}
      {caret && (
        <span
          style={{
            display: "inline-block",
            width: size * 0.05,
            height: size * 0.9,
            marginLeft: size * 0.04,
            verticalAlign: "-0.1em",
            background: pal.accent,
            opacity: blink ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}

// ── hook ──────────────────────────────────────────────────────────────────

// UrVote: the line with a pill whose word rolls like a slot — the three
// things, then the keyword as it is said.
function slot(c: BlockCtx) {
  const { f, L, b, pal } = c;
  const big = L.hookBig;
  const items = [...b.trio.map((x) => x.label), big.t.replace(/[.,!?]$/, "")];
  const t0 = c.from + 10;
  const step = Math.max(8, (big.at - t0) / (items.length - 1));
  const p = items.slice(1).reduce((a, _, k) => a + rise(f, t0 + (k + 1) * step - 8, 9, IN_OUT), 0);
  const lead = L.hookA.reduce((a, w) => a + w.t.length + 1, 0);
  const longest = Math.max(...items.map((t) => t.length));
  const size = Math.min(84, Math.floor(1700 / (lead * 0.5 + longest * 0.56 + 2)));
  const rowH = size * 1.4;
  const wPill = longest * size * 0.56 + 90;
  const mask = "linear-gradient(180deg, transparent, #000 32%, #000 68%, transparent)";
  return (
    <>
      {at(
        W / 2,
        540,
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Say c={c} words={L.hookA} size={size} weight={500} style={{ flexWrap: "nowrap" }} />
          <div
            style={{
              position: "relative",
              width: wPill,
              height: rowH * 3,
              opacity: soft(f, t0 - 6, 14),
              WebkitMaskImage: mask,
              maskImage: mask,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: rowH,
                width: wPill,
                height: rowH,
                borderRadius: 26,
                background: `linear-gradient(100deg, ${pal.accent}, ${pal.accent2})`,
                boxShadow: `0 24px 60px ${pal.accent}55`,
              }}
            />
            {items.map((t, k) => (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: 0,
                  width: wPill,
                  top: rowH * (1 + k - p),
                  height: rowH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: size,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  color: Math.abs(k - p) < 0.5 ? "#fff" : pal.sub,
                  opacity: 1 - Math.min(1, Math.abs(k - p)) * 0.55,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>,
      )}
    </>
  );
}

// Alex: the line typed in very large letters while the camera travels with
// the caret; the keyword lands in a gradient pill.
function bigtype(c: BlockCtx) {
  const { f, L, pal } = c;
  const size = 190;
  const lead = L.hookA;
  const key = L.hookBig;
  const pk = rise(f, key.at - 2, 16, OUT);
  // anchored at the right (x = 1700) with a minimum width: short text starts
  // at the left; once it is wider, it grows to the left — the camera follows
  // the caret
  return (
    <div
      style={{
        position: "absolute",
        right: W - 1720,
        top: 540,
        transform: "translateY(-50%)",
        display: "flex",
      }}
    >
      <div
        style={{
          minWidth: 1560,
          display: "flex",
          alignItems: "center",
          gap: 30,
        }}
      >
        <TypeIn f={f} words={lead} size={size} pal={pal} caret={pk < 0.5} />
        <div
          style={{
            // takes no room until the keyword is said
            maxWidth: pk * 1400,
            overflow: "hidden",
            marginLeft: pk > 0 ? 0 : -30,
            padding: `0 ${50 * pk}px`,
            height: size * 1.2,
            borderRadius: 60,
            display: "flex",
            alignItems: "center",
            fontSize: size * 0.9,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "#fff",
            background: `linear-gradient(100deg, ${pal.accent}, ${pal.accent2})`,
            boxShadow: `0 30px 80px ${pal.accent}55`,
            opacity: pk,
            transform: `scale(${mix(0.7, 1, pk)})`,
            filter: `blur(${(1 - pk) * 10}px)`,
            whiteSpace: "nowrap",
          }}
        >
          {key.t.replace(/[.,!?]$/, "")}
        </div>
      </div>
    </div>
  );
}

// Converse: a grid of frosted tiles of the product's figures comes into
// focus; the line is typed in the clear band between the rows.
function glassgrid(c: BlockCtx) {
  const { f, L, C, pal } = c;
  const focus = rise(f, c.from, Math.max(30, c.to - c.from - 10), OUT);
  const labels = [C.metric.label, ...C.side.map((s) => s.label), ...C.rows.map((r) => r.name), C.growth.label, C.event.label, ...TOOLS.map((t) => t.name)];
  const values = [C.side[0]?.value, C.rows[0]?.value, C.rows[1]?.value, C.side[1]?.value, C.rows[2]?.value];
  const tile = (x: number, y: number, w: number, h: number, i: number) => (
    <div
      key={`${x}:${y}`}
      style={{
        position: "absolute",
        left: x,
        top: y + (1 - focus) * (y < 540 ? -30 : 30),
        width: w,
        height: h,
        ...glassCard(pal, 26),
        padding: 22,
        filter: `blur(${(1 - focus) * 12 + (i % 3 === 0 ? 1.5 : 0)}px)`,
        opacity: mix(0.4, 1, focus),
      }}
    >
      <div style={{ fontSize: 20, color: pal.sub, fontWeight: 500 }}>{labels[i % labels.length]}</div>
      <div
        style={{
          marginTop: 12,
          fontSize: 30,
          fontWeight: 650,
          color: pal.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {values[i % values.length] ?? ""}
      </div>
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 20,
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${pal.accent}1c`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={TOOLS[i % TOOLS.length].icon} size={22} color={pal.accent} />
      </div>
    </div>
  );
  const top = [
    [-60, 70, 380, 200],
    [350, 40, 300, 240],
    [680, 70, 420, 200],
    [1130, 40, 330, 240],
    [1490, 70, 420, 200],
  ];
  const bot = [
    [-40, 730, 440, 230],
    [430, 760, 340, 200],
    [800, 730, 360, 240],
    [1190, 760, 300, 200],
    [1520, 730, 420, 230],
  ];
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${mix(1.08, 1, focus)})`,
        }}
      >
        {top.map(([x, y, w, h], i) => tile(x, y, w, h, i))}
        {bot.map(([x, y, w, h], i) => tile(x, y, w, h, i + 5))}
      </div>
      {at(W / 2, 540, <TypeIn f={f} words={L.hook} size={72} pal={pal} weight={450} />)}
    </>
  );
}

// Alex: alerts fly in from the right with a motion blur and stack in a
// notification panel; the line above.
function alerts(c: BlockCtx) {
  const { f, L, b, pal } = c;
  const items = [...b.trio.map((x) => ({ t: x.label, s: x.sub, icon: x.icon })), { t: TOOLS[3].name, s: TOOLS[1].name, icon: TOOLS[3].icon }];
  const panel = soft(f, c.from + 2, 18);
  return (
    <>
      {at(W / 2, 170, <Say c={c} words={L.hook} size={68} weight={550} from="up" />)}
      {at(
        W / 2,
        640,
        <div
          style={{
            width: 760,
            height: 560,
            ...card(pal, 36),
            padding: 34,
            opacity: panel,
            transform: `scale(${mix(0.94, 1, panel)})`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 700, color: pal.panelInk }}>Notifications</div>
          <div
            style={{
              position: "absolute",
              right: 34,
              top: 34,
              minWidth: 40,
              height: 40,
              padding: "0 12px",
              borderRadius: 99,
              background: "#ef4444",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {items.filter((_, i) => f >= c.from + 8 + i * 11).length}
          </div>
          {items.map((x, i) => {
            const k = rise(f, c.from + 8 + i * 11, 14, OUT);
            return (
              <div
                key={x.t + i}
                style={{
                  position: "absolute",
                  left: 34,
                  right: 34,
                  top: 100 + i * 108,
                  height: 92,
                  borderRadius: 20,
                  background: pal.panelDark ? "#2a2422" : "#f5f6fa",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 22px",
                  opacity: k,
                  transform: `translateX(${(1 - k) * 700}px)`,
                  filter: `blur(${(1 - k) * 14}px)`,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: `${pal.accent}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={x.icon} size={28} color={pal.accent} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 25,
                      fontWeight: 650,
                      color: pal.panelInk,
                    }}
                  >
                    {x.t}
                  </div>
                  <div style={{ fontSize: 20, color: pal.panelSub }}>{x.s}</div>
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    width: 14,
                    height: 14,
                    borderRadius: 99,
                    background: "#ef4444",
                  }}
                />
              </div>
            );
          })}
        </div>,
      )}
    </>
  );
}

// Madison: a bill of what the old way costs — each thing a line, the total
// counting up in red; the line beside it.
function bill(c: BlockCtx) {
  const { f, L, b, pal } = c;
  const hours = [6, 9, 12];
  const shown = b.trio.map((x, i) => ({
    ...x,
    h: hours[i % 3],
    k: rise(f, c.from + 10 + i * 12, 14, OUT),
  }));
  const total = shown.reduce((a, x) => a + x.h * x.k, 0);
  return (
    <>
      {abs(150, 380, <Say c={c} words={L.hook} size={76} weight={600} align="left" style={{ width: 760 }} />)}
      {at(
        1330,
        540,
        <div
          style={{
            width: 640,
            ...card(pal, 30),
            padding: "36px 40px",
            transform: `scale(${grow(f, c.from, 18)}) rotate(${mix(4, -2, soft(f, c.from, 40))}deg)`,
            opacity: soft(f, c.from, 14),
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 700 }}>Hours lost this month</div>
          <div
            style={{
              marginTop: 8,
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 10,
              background: pal.panelDark ? "#2a2422" : "#f2f2f6",
              fontSize: 18,
              color: pal.panelSub,
            }}
          >
            The old way
          </div>
          <div style={{ marginTop: 26, borderTop: `1px solid ${pal.line}` }}>
            {shown.map((x) => (
              <div
                key={x.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "18px 0",
                  borderBottom: `1px solid ${pal.line}`,
                  opacity: x.k,
                  transform: `translateY(${(1 - x.k) * 16}px)`,
                }}
              >
                <Icon name={x.icon} size={26} color={pal.panelSub} />
                <span style={{ fontSize: 24, fontWeight: 600 }}>{x.label}</span>
                <span style={{ fontSize: 20, color: pal.panelSub }}>{x.sub}</span>
                <span style={{ marginLeft: "auto", fontSize: 24, fontWeight: 650 }}>{x.h} h</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "flex-end",
              gap: 16,
              marginTop: 22,
            }}
          >
            <span style={{ fontSize: 22, color: pal.panelSub }}>Total</span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 750,
                color: "#e5484d",
                letterSpacing: "-0.03em",
              }}
            >
              {Math.round(total)} h
            </span>
          </div>
        </div>,
      )}
    </>
  );
}

// ── trio ──────────────────────────────────────────────────────────────────

// Alex: the three things in big glass bubbles, each on its word; small
// bubbles of other tools drift around them.
function bubbles(c: BlockCtx) {
  const { f, b, pal } = c;
  const small = TOOLS.map((t, i) => ({
    ...t,
    x: [180, 1640, 330, 1500, 860, 1080][i],
    y: [260, 300, 840, 860, 140, 930][i],
  }));
  return (
    <>
      {small.map((t, i) =>
        at(
          t.x + Math.sin(f / 40 + i) * 18,
          t.y + Math.cos(f / 50 + i) * 14,
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 99,
              ...glassCard(pal, 99),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              filter: i % 2 ? "blur(2px)" : undefined,
            }}
          >
            <Icon name={t.icon} size={44} color={pal.accent} />
          </div>,
          { opacity: soft(f, c.from + i * 4, 18) * 0.85 },
          t.icon,
        ),
      )}
      {b.trio.map((x, i) => {
        const k = soft(f, x.at - 6, 18);
        return at(
          460 + i * 500,
          520 + Math.sin(f / 36 + i) * 10,
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 22,
            }}
          >
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 999,
                ...glassCard(pal, 999),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${mix(0.6, 1, k)})`,
              }}
            >
              <div
                style={{
                  width: 190,
                  height: 190,
                  borderRadius: 999,
                  background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 20px 50px ${pal.accent}55`,
                }}
              >
                <Icon name={x.icon} size={96} color="#fff" />
              </div>
            </div>
            <div
              style={{
                fontSize: 62,
                fontWeight: 650,
                color: pal.ink,
                letterSpacing: "-0.02em",
              }}
            >
              {x.label}
            </div>
            <div style={{ fontSize: 38, color: pal.sub }}>{x.sub}</div>
          </div>,
          { opacity: k },
          x.label,
        );
      })}
    </>
  );
}

// Madison: one person (an initial) and the things they juggle, as chips
// that come in on their words and keep jostling.
function juggle(c: BlockCtx) {
  const { f, b, C, pal } = c;
  const who = C.people[0]?.name ?? "A";
  const chips = [
    ...b.trio.map((x, i) => ({
      t: `${x.label} ${x.sub}`,
      at: x.at - 4,
      x: [480, 1440, 480][i],
      y: [330, 420, 760][i],
      main: true,
    })),
    ...TOOLS.slice(0, 4).map((t, i) => ({
      t: t.name,
      at: c.from + 6 + i * 6,
      x: [860, 1480, 1060, 330][i],
      y: [190, 760, 900, 560][i],
      main: false,
    })),
  ];
  return (
    <>
      {at(
        W / 2,
        540,
        <div
          style={{
            borderRadius: 999,
            padding: 14,
            background: `${pal.accent}22`,
            transform: `scale(${grow(f, c.from, 18)})`,
          }}
        >
          <Person letter={who[0]} size={240} color={pal.accent} />
        </div>,
        { opacity: soft(f, c.from, 14) },
      )}
      {chips.map((x, i) => {
        const k = soft(f, x.at, 14);
        const jit = Math.sin(f / 6 + i * 2) * 3;
        return at(
          x.x + jit,
          x.y + Math.cos(f / 7 + i) * 3,
          <div
            style={{
              padding: x.main ? "22px 34px" : "14px 24px",
              borderRadius: 16,
              border: `2px solid ${x.main ? pal.accent : pal.line}`,
              background: pal.dark ? "rgba(255,255,255,0.08)" : "#fff",
              fontSize: x.main ? 44 : 28,
              fontWeight: x.main ? 650 : 500,
              color: x.main ? pal.ink : pal.sub,
              boxShadow: "0 14px 40px rgba(40,40,90,0.10)",
            }}
          >
            {x.t}
          </div>,
          {
            opacity: k * (x.main ? 1 : 0.7),
            transform: `translate(-50%, -50%) scale(${mix(0.8, 1, k)})`,
          },
          x.t + i,
        );
      })}
    </>
  );
}

// ── reveal ────────────────────────────────────────────────────────────────

// Alex: the name written with a pen (outline drawn, then filled), a swash
// under it; a four-point star flies in with the rest of the line.
function script(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const draw = rise(f, T.flowly - 10, 30, IN_OUT);
  const fill = rise(f, T.flowly + 12, 16);
  const star = rise(f, T.brings - 8, 18, OUT);
  const name = b.brand.name;
  const len = name.length * 260;
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
          <path
            d={`M ${80} 230 C 260 260, ${name.length * 70} 200, ${Math.max(620, name.length * 112)} 214`}
            stroke={pal.accent2}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
            pathLength={1}
            strokeDasharray={`${rise(f, T.flowly + 6, 18, OUT)} 1`}
          />
        </svg>,
      )}
      <div
        style={{
          position: "absolute",
          left: mix(-200, 0, star),
          top: 690,
          width: W,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${pal.glow}88, transparent)`,
          opacity: star * (1 - rise(f, T.brings + 14, 16)),
        }}
      />
      {at(
        W / 2,
        700,
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Say c={c} words={L.reveal} size={56} weight={450} />
          <svg
            width={64}
            height={64}
            viewBox="-10 -10 20 20"
            style={{
              transform: `translateX(${(1 - star) * -500}px) rotate(${(1 - star) * -180}deg) scale(${mix(0.4, 1, star)})`,
              opacity: star,
            }}
          >
            <path d="M0 -9 C1 -2 2 -1 9 0 C2 1 1 2 0 9 C-1 2 -2 1 -9 0 C-2 -1 -1 -2 0 -9 Z" fill={pal.accent} />
          </svg>
        </div>,
      )}
    </>
  );
}

// Madison: the name comes together letter by letter over a drawn line, two
// discs slide in from the edges, the promise typed under it.
function assemble(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const name = b.brand.name;
  const line = rise(f, T.flowly - 12, 16, OUT);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: mix(-520, -260, soft(f, c.from, 24)),
          top: 120,
          width: 520,
          height: 520,
          borderRadius: 999,
          background: pal.dark ? "rgba(255,255,255,0.16)" : pal.accent,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: mix(1920, 1660, soft(f, c.from + 6, 24)),
          top: 560,
          width: 460,
          height: 460,
          borderRadius: 999,
          background: pal.dark ? "rgba(255,255,255,0.1)" : pal.accent2,
          opacity: 0.8,
        }}
      />
      {at(
        W / 2,
        470,
        <div
          style={{
            display: "flex",
            fontSize: 190,
            fontWeight: 650,
            letterSpacing: "-0.04em",
            color: pal.ink,
          }}
        >
          {name.split("").map((ch, i) => {
            const k = rise(f, T.flowly - 8 + i * 2, 14, OUT);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  opacity: k,
                  transform: `translateY(${(1 - k) * (i % 2 ? 60 : -60)}px)`,
                  clipPath: `inset(${(1 - k) * 50}% 0 ${(1 - k) * 50}% 0)`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>,
      )}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 420 * line,
          top: 590,
          width: 840 * line,
          height: 5,
          borderRadius: 4,
          background: pal.accent,
          opacity: 1 - rise(f, T.flowly + 14, 12),
        }}
      />
      {at(W / 2, 660, <TypeIn f={f} words={L.reveal} size={48} pal={pal} weight={500} caret={false} />)}
    </>
  );
}

// Alex: the product's pill linked to another pill that flips through the
// three things and settles on what it brings.
function link(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const items = [...b.trio.map((x) => ({ t: x.label, icon: x.icon })), { t: b.label, icon: "layout-dashboard" }];
  const t0 = T.flowly + 2;
  const step = Math.max(8, (T.live - t0) / (items.length - 1));
  const idx = Math.min(items.length - 1, Math.max(0, Math.floor((f - t0) / step)));
  const flip = rise(f, t0 + idx * step, 8, IN_OUT);
  const k = soft(f, T.flowly - 6, 16);
  const pill: CSSProperties = {
    height: 150,
    padding: "0 54px",
    borderRadius: 34,
    display: "flex",
    alignItems: "center",
    gap: 22,
    fontSize: 66,
    fontWeight: 600,
    letterSpacing: "-0.02em",
  };
  return (
    <>
      {at(W / 2, 270, <Say c={c} words={L.revealA} size={70} weight={500} />)}
      {at(
        W / 2,
        540,
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            opacity: k,
            transform: `scale(${mix(0.9, 1, k)})`,
          }}
        >
          <div
            style={{
              ...pill,
              background: `${pal.accent}22`,
              color: pal.dark ? pal.ink : pal.accent,
              border: `2px solid ${pal.accent}55`,
            }}
          >
            <FlowMark size={76} colors={markColors(c)} />
            {b.brand.name}
          </div>
          <Icon name="link" size={60} color={pal.sub} />
          <div
            style={{
              ...pill,
              background: pal.dark ? "#ffffff" : "#15161d",
              color: pal.dark ? "#15161d" : "#fff",
              transform: `rotateX(${(1 - flip) * 80}deg)`,
              opacity: mix(0.2, 1, flip),
              minWidth: 320,
            }}
          >
            <Icon name={items[idx].icon} size={58} color={pal.dark ? pal.accent : pal.accent2} />
            {items[idx].t}
          </div>
        </div>,
      )}
      {at(W / 2, 810, <Say c={c} words={L.revealB} size={70} weight={500} />)}
    </>
  );
}

// Converse: the app icon grows out of nothing into a white card with the
// name; the promise below.
function appicon(c: BlockCtx) {
  const { f, T, L, b, pal } = c;
  const icon = rise(f, T.flowly - 14, 22, OUT);
  const cardK = rise(f, T.flowly + 4, 20, OUT);
  return (
    <>
      {at(
        W / 2,
        440,
        <div
          style={{
            width: mix(240, 560, cardK),
            height: mix(240, 520, cardK),
            borderRadius: mix(56, 48, cardK),
            background: cardK > 0 ? pal.panel : "transparent",
            boxShadow: cardK > 0 ? `0 50px 120px ${pal.dark ? "rgba(0,0,0,0.5)" : "rgba(40,50,120,0.18)"}` : undefined,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 34 * cardK,
          }}
        >
          <div
            style={{
              transform: `scale(${mix(0.2, 1, icon)})`,
              opacity: icon,
              borderRadius: 52,
              padding: 20,
              background: `linear-gradient(150deg, ${pal.accent}, ${pal.accent2})`,
              boxShadow: `0 30px 70px ${pal.accent}55`,
            }}
          >
            <FlowMark size={160} colors={["#ffffff", "#ffffff"]} plain />
          </div>
          <div
            style={{
              fontSize: 50 * cardK,
              fontWeight: 750,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: pal.panelInk,
              opacity: cardK,
              whiteSpace: "nowrap",
            }}
          >
            {b.brand.name.slice(0, Math.ceil(b.brand.name.length / 2))}
            <span style={{ color: pal.accent2 }}>{b.brand.name.slice(Math.ceil(b.brand.name.length / 2))}</span>
          </div>
        </div>,
      )}
      {at(W / 2, 820, <Say c={c} words={L.reveal} size={54} weight={500} />)}
    </>
  );
}

// ── pay ───────────────────────────────────────────────────────────────────

// Alex: the event typed into a command bar, a press on send (the camera
// leans in), then the list ticks over row by row.
function command(c: BlockCtx) {
  const { f, T, L, C, pal } = c;
  const tone = appTone(pal);
  const text = `${C.event.label} · ${C.event.detail} · ${C.event.source}`;
  const n = Math.max(0, Math.min(text.length, Math.floor((f - c.from - 4) / 1.1)));
  const send = T.payment + 4;
  const p = press(f, [send]);
  const zoom = rise(f, send - 14, 12, IN_OUT) * (1 - rise(f, send + 8, 16, IN_OUT));
  const list = soft(f, send + 10, 18);
  const rows = [C.event.source, ...C.rows.map((r) => r.name)].slice(0, 4);
  const [px, py] = glide(f, [
    [c.from, 1500, 900],
    [send - 4, 1500, 430],
  ]);
  return (
    <>
      {at(W / 2, 140, <Say c={c} words={L.payA} size={60} weight={500} />)}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${1 + zoom * 0.35})`,
          transformOrigin: "1490px 400px",
        }}
      >
        {at(
          W / 2,
          400 - list * 70,
          <div
            style={{
              width: 1180,
              height: 120,
              borderRadius: 999,
              background: tone.bg,
              boxShadow: "0 30px 80px rgba(30,40,100,0.18)",
              display: "flex",
              alignItems: "center",
              padding: "0 20px 0 48px",
              gap: 20,
            }}
          >
            <span
              style={{
                fontSize: 38,
                color: tone.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {text.slice(0, n)}
            </span>
            <span
              style={{
                width: 3,
                height: 44,
                background: pal.accent,
                opacity: Math.floor(f / 14) % 2 ? 1 : 0,
              }}
            />
            <div
              style={{
                marginLeft: "auto",
                width: 84,
                height: 84,
                borderRadius: 99,
                background: `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${1 - p * 0.12})`,
              }}
            >
              <Icon name="send" size={38} color="#fff" />
            </div>
          </div>,
        )}
        <Pointer x={px} y={py} press={p} hand />
      </div>
      {list > 0 &&
        rows.map((r, i) => {
          const k = soft(f, send + 12 + i * 5, 14);
          const done = rise(f, T.updates + i * 6, 10);
          return at(
            W / 2,
            520 + i * 104,
            <div
              style={{
                width: 980,
                height: 88,
                borderRadius: 22,
                background: tone.bg,
                boxShadow: "0 16px 40px rgba(30,40,100,0.10)",
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "0 26px",
              }}
            >
              <Person letter={r[0]} size={52} color={[pal.accent, "#f59e0b", "#10b981", "#ec4899"][i % 4]} />
              <span style={{ fontSize: 28, fontWeight: 600, color: tone.ink }}>{r}</span>
              <span style={{ fontSize: 22, color: tone.sub }}>{i === 0 ? C.event.detail : C.rows[i - 1]?.value}</span>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "10px 22px",
                  borderRadius: 99,
                  fontSize: 22,
                  fontWeight: 650,
                  color: done ? "#0f7a43" : "#fff",
                  background: done ? "#dcfce7" : pal.accent,
                  transition: "none",
                }}
              >
                {done > 0.5 ? `✓ ${C.event.done}` : "Update"}
              </span>
            </div>,
            {
              opacity: k,
              transform: `translate(-50%, -50%) translateY(${(1 - k) * 30}px)`,
            },
            r + i,
          );
        })}
      {at(W / 2, 960, <Say c={c} words={L.payB} size={52} weight={500} />, {
        opacity: rise(f, T.revenue - 4, 10),
      })}
    </>
  );
}

// Madison: a ranked list; when the event happens the product's row climbs
// to the top and lights up.
function rank(c: BlockCtx) {
  const { f, T, L, C, b, pal } = c;
  const tone = appTone(pal);
  const rows = [C.rows[0]?.name, C.rows[1]?.name, b.brand.name, C.rows[2]?.name].filter(Boolean) as string[];
  const up = rise(f, T.updates - 6, 24, IN_OUT);
  const slot = (i: number) => (i === 2 ? mix(2, 0, up) : i < 2 ? i + up : i);
  return (
    <>
      {abs(150, 300, <Say c={c} words={L.payA} size={70} weight={600} align="left" style={{ width: 640 }} />)}
      {abs(150, 520, <Say c={c} words={L.payB} size={70} weight={600} align="left" ink={pal.accent} style={{ width: 640 }} />)}
      {at(
        1300,
        540,
        <div
          style={{
            width: 760,
            height: 620,
            ...card(pal, 32),
            padding: 30,
            position: "relative",
            opacity: soft(f, c.from, 16),
            transform: `scale(${grow(f, c.from, 18)})`,
          }}
        >
          <div
            style={{
              height: 70,
              borderRadius: 99,
              background: tone.side,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "0 26px",
              fontSize: 24,
              color: tone.sub,
            }}
          >
            <Icon name="search" size={26} color={tone.sub} />
            {C.metric.label}
          </div>
          {rows.map((r, i) => {
            const me = i === 2;
            return (
              <div
                key={r}
                style={{
                  position: "absolute",
                  left: 30,
                  right: 30,
                  top: 130 + slot(i) * 118,
                  height: 100,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 20px",
                  background: me ? `${pal.accent}${Math.round(0x10 + up * 0x18).toString(16)}` : "transparent",
                  border: me ? `2px solid ${pal.accent}${up > 0.5 ? "" : "44"}` : `1px solid ${tone.line}`,
                  zIndex: me ? 2 : 1,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: me ? `linear-gradient(140deg, ${pal.accent}, ${pal.accent2})` : tone.side,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {me ? <FlowMark size={40} colors={["#fff", "#fff"]} plain /> : <span style={{ fontSize: 26, fontWeight: 700, color: tone.sub }}>{r[0]}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 650, color: tone.ink }}>{r}</div>
                  <div style={{ fontSize: 20, color: "#f59e0b", letterSpacing: 2 }}>
                    {"★★★★★".slice(0, me ? 5 : 4)}
                    <span style={{ color: tone.line }}>{me ? "" : "★"}</span>
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 26,
                    fontWeight: 700,
                    color: me ? pal.accent : tone.sub,
                  }}
                >
                  #{Math.round(slot(i)) + 1}
                </div>
              </div>
            );
          })}
        </div>,
      )}
    </>
  );
}

// ── where each block's main object stands (for the hand-off between parts)
const card$ = (x: number, y: number, w: number, h: number, r: number, fill: Box["fill"] = "card"): Box => ({ x, y, w, h, r, fill });
function slotBox(c: BlockCtx): Box {
  const lead = c.L.hookA.reduce((a, w) => a + w.t.length + 1, 0);
  const items = [...c.b.trio.map((x) => x.label), c.L.hookBig.t.replace(/[.,!?]$/, "")];
  const longest = Math.max(...items.map((t) => t.length));
  const size = Math.min(84, Math.floor(1700 / (lead * 0.5 + longest * 0.56 + 2)));
  const wPill = longest * size * 0.56 + 90;
  const row = lead * size * 0.5 + 26 + wPill;
  return card$(W / 2 + row / 2 - wPill / 2, 540, wPill, size * 1.4, 26, "accent");
}
function bigtypeBox(c: BlockCtx): Box {
  const w = c.L.hookBig.t.length * 190 * 0.52 + 100;
  return card$(1720 - w / 2, 540, w, 228, 60, "accent");
}
function linkBox(c: BlockCtx): Box {
  const brandW = 108 + 76 + 22 + c.b.brand.name.length * 66 * 0.55;
  const thingW = Math.max(320, 108 + 58 + 22 + c.b.label.length * 66 * 0.55);
  const row = brandW + 30 + 60 + 30 + thingW;
  return card$(W / 2 + row / 2 - thingW / 2, 540, thingW, 150, 34, "dark");
}

export const R2_OPEN: Block[] = [
  {
    id: "hook.slot",
    role: "hook",
    name: "Word rolls in a pill",
    from: "UrVote",
    draw: slot,
    obj: (c) => ({ a: slotBox(c), z: slotBox(c) }),
  },
  {
    id: "hook.bigtype",
    role: "hook",
    name: "Giant typing, keyword pill",
    from: "Alex",
    draw: bigtype,
    obj: (c) => ({ z: bigtypeBox(c) }),
  },
  {
    id: "hook.glassgrid",
    role: "hook",
    name: "Glass tiles come into focus",
    from: "Converse",
    draw: glassgrid,
  },
  {
    id: "hook.alerts",
    role: "hook",
    name: "Alerts pile up",
    from: "Alex",
    draw: alerts,
    obj: () => ({ a: card$(960, 640, 760, 560, 36), z: card$(960, 640, 760, 560, 36) }),
  },
  {
    id: "hook.bill",
    role: "hook",
    name: "Bill of hours lost",
    from: "Madison",
    draw: bill,
    obj: () => ({ a: card$(1330, 540, 640, 540, 30), z: card$(1330, 540, 640, 540, 30) }),
  },
  {
    id: "trio.bubbles",
    role: "trio",
    name: "Glass bubbles",
    from: "Alex",
    draw: bubbles,
    obj: () => ({ a: card$(460, 445, 300, 300, 150, "glass"), z: card$(960, 445, 300, 300, 150, "glass") }),
  },
  {
    id: "trio.juggle",
    role: "trio",
    name: "One person, many chips",
    from: "Madison",
    draw: juggle,
    obj: () => ({ a: card$(960, 540, 268, 268, 134, "accent"), z: card$(960, 540, 268, 268, 134, "accent") }),
  },
  {
    id: "reveal.script",
    role: "reveal",
    name: "Pen-written name + star",
    from: "Alex",
    draw: script,
  },
  {
    id: "reveal.assemble",
    role: "reveal",
    name: "Letters assemble, discs",
    from: "Madison",
    draw: assemble,
  },
  {
    id: "reveal.link",
    role: "reveal",
    name: "Linked pills flip",
    from: "Alex",
    draw: link,
    obj: (c) => ({ z: linkBox(c) }),
  },
  {
    id: "reveal.appicon",
    role: "reveal",
    name: "App icon → name card",
    from: "Converse",
    draw: appicon,
    obj: () => ({ a: card$(960, 440, 200, 200, 52, "accent"), z: card$(960, 440, 560, 520, 48) }),
  },
  {
    id: "pay.command",
    role: "pay",
    name: "Command bar → list ticks",
    from: "Alex",
    draw: command,
    obj: () => ({ a: card$(960, 400, 1180, 120, 60), z: card$(960, 330, 1180, 120, 60) }),
  },
  {
    id: "pay.rank",
    role: "pay",
    name: "Row climbs to the top",
    from: "Madison",
    draw: rank,
    obj: () => ({ a: card$(1300, 540, 760, 620, 32), z: card$(1300, 540, 760, 620, 32) }),
  },
];
