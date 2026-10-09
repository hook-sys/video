import type { CSSProperties, ReactNode } from "react";
import { noise2D } from "@remotion/noise";
import { ItemBody, baseSize } from "./items";
import type { Ctx } from "./kit";
import { CtxC } from "./kit";
import { isAccent } from "./layout";
import { EASE, type Ends, type P, bez, road } from "./journey";
import { clamp01, mix, ramp } from "./motion";
import type { Box, ComposerPlan, GuideKind, LinkKind, PlacedItem, TextBlock } from "./types";

// How one scene leads to the next on a journey, other than a drawn line:
//  carry — the scene's main thing lifts off, flies to the next scene and
//          becomes its main thing (the others there fly into it with it);
//  lead  — a guide (a paper plane, a cursor, a point of light) flies ahead
//          from scene to scene and the camera follows it;
//  word  — a word of the scene's words stays, travels with the camera and
//          turns into the next scene's first word as the voice says it.
// The camera keeps the travelling thing in view (see cameraAt's `ends`). A
// hop with nothing to carry falls back to the line.

type Move = { start: number; dur: number };
export const LEAD = 4; // the travelling thing sets off a little before the camera

type Carry = { kind: "carry"; a: P; b: P; main: number; extras: number[]; dest: number };
type WordAt = { t: string; at: number; size: number; p: P; keyed: boolean; wi: number };
type WordHop = { kind: "word"; a: P; b: P; from: WordAt; to: WordAt; swap: number };
type Lead = { kind: "lead"; a: P; b: P; loop: boolean };
export type Hop = Carry | WordHop | Lead | null;
export type Links = { dim: (scene: number, f: number) => number; link: LinkKind; plan: ComposerPlan; hops: Hop[]; ends: Ends[]; rests: P[]; guide: GuideKind; hidden: (scene: number, item: number, f: number) => boolean; hiddenWord: (scene: number, wi: number, f: number) => boolean };

// a scene's point (on its 1920×1080 frame) → the canvas
const onCanvas = (st: P, p: P): P => ({ x: st.x - 960 + p.x, y: st.y - 540 + p.y });
const area = (b: Box) => b.w * b.h;
const liftOf = (m: Move) => m.start - LEAD;
const landOf = (m: Move) => m.start - LEAD + m.dur;
export const travelK = (f: number, m: Move) => EASE(ramp(f, liftOf(m), m.dur));

// Where a word of the words sits (its middle, on the scene's frame) — the
// same layout as the Headline: lines in the box, the kicker above them.
export function wordPlace(tb: TextBlock, wi: number, measure: (t: string, size: number) => number, upper: boolean): P {
  const size = tb.size;
  const lh = upper ? 1.02 : 1.08;
  const gap = size * (upper ? 0.24 : 0.26);
  const widths = tb.lines.map((line) => line.map((i) => measure(tb.words[i].t, size)));
  const lineW = widths.map((ws) => ws.reduce((s, w) => s + w + gap, 0));
  const inner = Math.max(0, ...lineW);
  const kf = Math.max(24, Math.round(size * 0.26));
  const kickerH = tb.kicker ? kf * 1.22 + Math.round(size * 0.22) : 0;
  const content = kickerH + tb.lines.length * size * lh;
  const top = tb.box.y - content / 2 + kickerH;
  const left = tb.align === "left" ? tb.box.x - tb.box.w / 2 : tb.align === "right" ? tb.box.x + tb.box.w / 2 - inner : tb.box.x - inner / 2;
  const li = Math.max(0, tb.lines.findIndex((l) => l.includes(wi)));
  const line = tb.lines[li] ?? [];
  const lw = lineW[li] ?? 0;
  const x0 = tb.align === "left" ? left : tb.align === "right" ? left + inner - lw : left + (inner - lw) / 2;
  let x = x0;
  for (const [j, i] of line.entries()) {
    if (i === wi) return { x: x + widths[li][j] / 2, y: top + li * size * lh + (size * lh) / 2 };
    x += widths[li][j] + gap;
  }
  return { x: tb.box.x, y: tb.box.y };
}

// Where a guide waits in a scene: beside the scene's main thing (a cursor:
// on it), clear of the words and the other things.
function restOf(plan: ComposerPlan, i: number, guide: GuideKind): P {
  const sc = plan.scenes[i];
  const things = sc.items.filter((it) => !isAccent(it));
  const button = i === plan.scenes.length - 1 ? things.find((it) => it.kind === "button") : undefined;
  const main = button ?? [...things].sort((x, y) => area(y.box) - area(x.box))[0];
  const tb = sc.text?.area ?? sc.text?.box;
  if (guide === "cursor" && main) {
    const b = main.box;
    return button ? { x: b.x + b.w * 0.18, y: b.y + b.h * 0.12 } : { x: b.x + b.w * 0.22, y: b.y - b.h * 0.18 };
  }
  // the plane is ~200px across: it waits where it covers least of the words
  // and things, near the main thing when it can
  const r = 110;
  const boxes = [...(tb ? [{ ...tb, w: tb.w + 30, h: tb.h + 30 }] : []), ...sc.items.map((it) => it.box)];
  const cover = (p: P) => boxes.reduce((s, b) => s + Math.max(0, Math.min(p.x + r, b.x + b.w / 2) - Math.max(p.x - r, b.x - b.w / 2)) * Math.max(0, Math.min(p.y + r * 0.7, b.y + b.h / 2) - Math.max(p.y - r * 0.7, b.y - b.h / 2)), 0);
  const near = main?.box ?? tb;
  const spots: P[] = [];
  if (near) {
    const dx = near.w / 2 + 140, dy = near.h / 2 - 20;
    spots.push({ x: near.x + dx, y: near.y - dy }, { x: near.x - dx, y: near.y - dy }, { x: near.x + dx, y: near.y + dy }, { x: near.x - dx, y: near.y + dy }, { x: near.x, y: near.y - near.h / 2 - 130 }, { x: near.x, y: near.y + near.h / 2 + 120 });
  }
  for (let x = 170; x <= 1750; x += 158) for (let y = 130; y <= 950; y += 164) spots.push({ x, y });
  const inside = (p: P) => p.x > 140 && p.x < 1780 && p.y > 110 && p.y < 970;
  const cost = (p: P, j: number) => cover(p) + (near ? Math.hypot(p.x - near.x, p.y - near.y) * 4 : 0) + (j < 6 ? 0 : 1500);
  return spots.map((p, j) => ({ p, c: cost(p, j) })).filter(({ p }) => inside(p)).sort((x, y) => x.c - y.c)[0]?.p ?? { x: 1740, y: 150 };
}

export function linksOf(plan: ComposerPlan, st: P[], mv: Move[], texts: (TextBlock | null)[], measure: (t: string, size: number) => number, upper: boolean): Links {
  const link = plan.link ?? "line";
  const n = plan.scenes.length;
  const guide: GuideKind = plan.guide ?? (["plane", "cursor", "orb"] as const)[plan.seed % 3];
  const hops: Hop[] = Array(n).fill(null);
  const hide = new Map<string, [number, number]>();
  const hideW = new Map<string, [number, number]>();
  const scenes = plan.scenes.map((s) => ({ ...s, items: [...s.items] }));
  const rests = link === "lead" ? plan.scenes.map((_, i) => onCanvas(st[i], restOf(plan, i, guide))) : [];
  for (let i = 1; i < n; i++) {
    const A = plan.scenes[i - 1], B = plan.scenes[i];
    const m = mv[i], lift = liftOf(m), land = landOf(m);
    if (link === "lead") {
      hops[i] = { kind: "lead", a: rests[i - 1], b: rests[i], loop: guide === "plane" && i % 2 === 1 };
    } else if (link === "carry") {
      const there = (it: PlacedItem) => !isAccent(it) && it.at <= lift;
      const src = A.items.map((it, j) => ({ it, j })).filter(({ it }) => there(it)).sort((x, y) => area(y.it.box) - area(x.it.box));
      const dst = B.items.map((it, j) => ({ it, j })).filter(({ it }) => !isAccent(it) && it.at <= B.from + 24).sort((x, y) => area(y.it.box) - area(x.it.box));
      if (!src.length || !dst.length) continue;
      const main = src[0], dest = dst[0];
      hops[i] = { kind: "carry", a: onCanvas(st[i - 1], main.it.box), b: onCanvas(st[i], dest.it.box), main: main.j, extras: src.slice(1, 5).map((s) => s.j), dest: dest.j };
      for (const s of src.slice(0, 5)) hide.set(`${i - 1}:${s.j}`, [lift, Infinity]);
      hide.set(`${i}:${dest.j}`, [-Infinity, land]);
      // it lands whole (its own way in already over)
      scenes[i].items[dest.j] = { ...dest.it, at: Math.min(dest.it.at, land - 30) };
    } else if (link === "word") {
      const ta = texts[i - 1], tb = texts[i];
      if (!ta || !tb || !tb.words.length) continue;
      const said = ta.words.map((w, wi) => ({ w, wi })).filter(({ w }) => w.at <= lift - 4);
      const pick = [...said].reverse().find(({ w }) => w.key) ?? [...said].sort((x, y) => y.w.t.length - x.w.t.length)[0];
      if (!pick) continue;
      const from: WordAt = { t: pick.w.t, at: pick.w.at, size: ta.size, p: onCanvas(st[i - 1], wordPlace(ta, pick.wi, measure, upper)), keyed: pick.w.key, wi: pick.wi };
      const w0 = tb.words[0];
      const to: WordAt = { t: w0.t, at: w0.at, size: tb.size, p: onCanvas(st[i], wordPlace(tb, 0, measure, upper)), keyed: w0.key, wi: 0 };
      // it turns into the new word as the voice says it (never before)
      const swap = Math.max(lift + m.dur * 0.45, w0.at - 4);
      hops[i] = { kind: "word", a: from.p, b: to.p, from, to, swap };
      hideW.set(`${i - 1}:${pick.wi}`, [lift, Infinity]);
      hideW.set(`${i}:0`, [-Infinity, Math.max(land, swap + 10)]);
    }
  }
  const inside = (r: [number, number] | undefined, f: number) => !!r && f >= r[0] && f < r[1];
  return {
    link,
    plan: { ...plan, scenes },
    hops,
    ends: hops.map((h) => (h ? { a: h.a, b: h.b } : null)),
    rests,
    guide,
    hidden: (s, j, f) => inside(hide.get(`${s}:${j}`), f),
    // the words a travelling word left dim as it goes (it is what to read now)
    dim: (s, f) => (hops[s + 1]?.kind === "word" ? 0.6 * travelK(f, mv[s + 1]) : 0),
    hiddenWord: (s, wi, f) => inside(hideW.get(`${s}:${wi}`), f),
  };
}

// ── what travels (drawn on the canvas, above the scenes) ──────────────────

type DrawProps = { f: number; L: Links; st: P[]; mv: Move[]; ctxOf: (scene: number) => Ctx; display: string; weight: number; tracking: number; upper: boolean; lower: boolean };

export function Travellers(props: DrawProps) {
  const { f, L, mv } = props;
  const out: ReactNode[] = [];
  if (L.link === "lead") out.push(<Guide key="guide" {...props} />);
  L.hops.forEach((h, i) => {
    if (!h || h.kind === "lead") return;
    if (f < liftOf(mv[i])) return;
    if (h.kind === "carry") out.push(<Carried key={i} {...props} i={i} h={h} />);
    else out.push(<TravellingWord key={i} {...props} i={i} h={h} />);
  });
  return <>{out}</>;
}

// The main thing on its way: it lifts, flies along its road (a little ahead
// of the camera), turns into the next scene's main thing on the way and
// lands in its place; the scene's other things fly into it and are gone.
function Carried({ f, L, st, mv, ctxOf, i, h }: DrawProps & { i: number; h: Carry }) {
  const m = mv[i];
  const k = travelK(f, m);
  if (f >= landOf(m)) return null;
  const A = L.plan.scenes[i - 1], B = L.plan.scenes[i];
  const src = A.items[h.main], dst = B.items[h.dest];
  const r = road(h.a, h.b);
  const p = bez(r, k);
  const ab = src.box, bb = dst.box;
  const w = mix(ab.w, bb.w, k), hh = mix(ab.h, bb.h, k);
  // it rises off the canvas as it leaves and settles as it lands
  const lift = Math.sin(k * Math.PI);
  const turn = clamp01((k - 0.3) / 0.4);
  const t = turn * turn * (3 - 2 * turn);
  const p2 = bez(r, Math.min(1, k + 0.02));
  const lean = Math.max(-8, Math.min(8, (p2.x - p.x) * 0.04)) * lift;
  const body = (it: PlacedItem, c: Ctx, o: number) => {
    const [bw, bh] = baseSize(it);
    const s = Math.min(w / bw, hh / bh);
    return (
      <div style={{ position: "absolute", left: -bw / 2, top: -bh / 2, width: bw, height: bh, transform: `scale(${s.toFixed(4)})`, opacity: o }}>
        <CtxC.Provider value={c}>
          <ItemBody c={c} it={it} w={bw} h={bh} />
        </CtxC.Provider>
      </div>
    );
  };
  const extras = h.extras.map((j, n) => {
    const it = A.items[j];
    const from = onCanvas(st[i - 1], it.box);
    // they follow the main thing, a little behind, and fold into it
    const ke = EASE(ramp(f, liftOf(m) + 3 + n * 3, m.dur * 0.85));
    const q = bez(road(from, h.b), ke);
    const [bw, bh] = baseSize(it);
    const s = (it.box.w / bw) * mix(1, 0.3, ke);
    const o = 1 - clamp01((ke - 0.7) / 0.3);
    if (o <= 0) return null;
    return (
      <div key={j} style={{ position: "absolute", left: q.x - bw / 2, top: q.y - bh / 2, width: bw, height: bh, transform: `scale(${s.toFixed(4)})`, opacity: o, zIndex: 40 }}>
        <CtxC.Provider value={ctxOf(i - 1)}>
          <ItemBody c={ctxOf(i - 1)} it={it} w={bw} h={bh} />
        </CtxC.Provider>
      </div>
    );
  });
  return (
    <>
      {extras}
      <div style={{ position: "absolute", left: p.x, top: p.y, width: 0, height: 0, transform: `scale(${(1 + lift * 0.06).toFixed(4)}) rotate(${lean.toFixed(2)}deg)`, zIndex: 41, filter: lift > 0.05 ? `drop-shadow(0 ${Math.round(40 * lift)}px ${Math.round(60 * lift)}px rgba(0,0,0,${(0.35 * lift).toFixed(2)}))` : undefined }}>
        {t < 1 && body(src, ctxOf(i - 1), 1 - t)}
        {t > 0 && body(dst, ctxOf(i), t)}
      </div>
    </>
  );
}

const mixHex = (a: string, b: string, t: number) => {
  const x = /^#([0-9a-f]{6})$/i.exec(a.trim()), y = /^#([0-9a-f]{6})$/i.exec(b.trim());
  if (!x || !y) return t < 0.5 ? a : b;
  const ch = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return `rgb(${[0, 2, 4].map((i) => Math.round(mix(ch(x[1], i), ch(y[1], i), t))).join(",")})`;
};

// The word on its way: it lifts out of its line, travels with the camera and
// becomes the next scene's first word as the voice says it.
function TravellingWord({ f, mv, ctxOf, i, h, display, weight, tracking, upper, lower }: DrawProps & { i: number; h: WordHop }) {
  const m = mv[i];
  const k = travelK(f, m);
  const p = bez(road(h.a, h.b), k);
  const end = Math.max(landOf(m), h.swap + 10);
  if (f >= end) return null;
  const ca = ctxOf(i - 1), cb = ctxOf(i);
  const size = mix(h.from.size, h.to.size, k);
  const sw = clamp01((f - h.swap) / 10);
  const s = sw * sw * (3 - 2 * sw);
  const colA = h.from.keyed ? ca.pal.accent : ca.pal.ink;
  const color = mixHex(colA, cb.pal.ink, k);
  const lift = Math.sin(k * Math.PI);
  const word = (t: string, o: number, dy: number): ReactNode => {
    const text = upper ? t.toUpperCase() : lower ? t.toLowerCase() : t;
    const style: CSSProperties = { position: "absolute", left: 0, top: 0, transform: `translate(-50%, -50%) translateY(${dy.toFixed(1)}em)`, whiteSpace: "nowrap", fontFamily: display, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, lineHeight: upper ? 1.02 : 1.08, color, opacity: o, filter: o < 0.98 && o > 0.02 ? `blur(${((1 - o) * 10).toFixed(1)}px)` : undefined };
    return <div style={style}>{text}</div>;
  };
  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, width: 0, height: 0, zIndex: 42, transform: `scale(${(1 + lift * 0.08).toFixed(4)})` }}>
      {s < 1 && word(h.from.t, 1 - s, -0.35 * s)}
      {s > 0 && word(h.to.t, s, 0.35 * (1 - s))}
    </div>
  );
}

// ── the guide ──────────────────────────────────────────────────────────────

// Where the guide is at frame f, which way it faces, and how fast it goes.
function guideAt(f: number, L: Links, mv: Move[]): { p: P; moving: boolean; seg: number; k: number } {
  const n = L.rests.length;
  let seg = 0;
  for (let i = 1; i < n; i++) if (f >= liftOf(mv[i])) seg = i;
  if (seg) {
    const h = L.hops[seg] as Lead;
    const k = travelK(f, mv[seg]);
    if (k < 1) {
      const r = road(h.a, h.b);
      let p = bez(r, k);
      // a plane loops once on the way (every other flight)
      if (h.loop) {
        const u = clamp01((k - 0.32) / 0.36);
        if (u > 0 && u < 1) {
          const q = bez(r, Math.min(1, k + 0.01));
          const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
          const tx = (q.x - p.x) / d, ty = (q.y - p.y) / d;
          const R = 230, a = u * Math.PI * 2;
          p = { x: p.x + tx * Math.sin(a) * R, y: p.y + ty * Math.sin(a) * R - (1 - Math.cos(a)) * R };
        }
      }
      return { p, moving: true, seg, k };
    }
  }
  // it flies in at the start
  if (!seg && f < 40) {
    const r0 = L.rests[0];
    const k = EASE(ramp(f, 0, 40));
    return { p: bez(road({ x: r0.x - 1300, y: r0.y + 420 }, r0), k), moving: k < 1, seg: 0, k };
  }
  const r = L.rests[seg];
  const since = seg ? f - (liftOf(mv[seg]) + mv[seg].dur) : f - 40;
  const b = clamp01(since / 24);
  return { p: { x: r.x + noise2D("gx", f / 70, seg) * 14 * b, y: r.y + Math.sin(f / 16) * 9 * b }, moving: false, seg, k: 1 };
}

const angleOf = (a: P, b: P) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

function Guide({ f, L, mv, ctxOf }: DrawProps) {
  const g = guideAt(f, L, mv);
  const c = ctxOf(g.seg);
  const pal = c.pal;
  // which way it faces: where it is going (at rest, where it last went)
  const ahead = guideAt(f + 2, L, mv);
  const moving = Math.hypot(ahead.p.x - g.p.x, ahead.p.y - g.p.y) > 3;
  let heading = moving ? angleOf(g.p, ahead.p) : 0;
  if (!moving) {
    // at rest it faces the way it came in (and turns towards its next place before it goes)
    const s = g.seg;
    const came = s ? angleOf(L.rests[s - 1], L.rests[s]) : angleOf({ x: L.rests[0].x - 1300, y: L.rests[0].y + 420 }, L.rests[0]);
    const next = s + 1 < L.rests.length ? angleOf(L.rests[s], L.rests[s + 1]) : came;
    const turn = s + 1 < L.rests.length ? EASE(ramp(f, liftOf(mv[s + 1]) - 18, 18)) : 0;
    let d = next - came;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    heading = came + d * turn + Math.sin(f / 22) * 4;
  }
  // the trail it leaves (only while it flies): a dashed line for the plane
  // and the cursor, a comet's tail for the point of light
  const pts: P[] = [g.p];
  for (let j = 1; j <= 18; j++) {
    const q = guideAt(f - j * 1.2, L, mv).p;
    const prev = pts[pts.length - 1];
    if (Math.hypot(prev.x - q.x, prev.y - q.y) < 1.5) break;
    pts.push(q);
  }
  const orb = L.guide === "orb";
  const trail = pts.length > 2 && (
    <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", zIndex: 44 }}>
      {pts.slice(1).map((q, j) => {
        const a = pts[j];
        const fade = 1 - j / pts.length;
        return <line key={j} x1={a.x} y1={a.y} x2={q.x} y2={q.y} stroke={orb ? pal.accent2 : pal.accent} strokeWidth={(orb ? 30 : 7) * fade} strokeLinecap="round" strokeDasharray={orb ? undefined : "14 12"} opacity={(orb ? 0.7 : 0.75) * fade} />;
      })}
    </svg>
  );
  let body: ReactNode;
  if (L.guide === "plane") {
    body = (
      <svg width={120} height={120} viewBox="-60 -60 120 120" style={{ position: "absolute", left: -60, top: -60, transform: `rotate(${heading.toFixed(2)}deg) scale(1.7)`, overflow: "visible", filter: `drop-shadow(0 14px 18px ${pal.shadow})` }}>
        {/* a paper plane, nose to the right */}
        <path d="M52,0 L-44,-34 L-22,0 Z" fill="#ffffff" />
        <path d="M52,0 L-44,34 L-22,0 Z" fill={pal.dark ? "#d9def0" : "#e6e9f5"} />
        <path d="M52,0 L-22,0 L-30,14 Z" fill={pal.fill} />
        <path d="M52,0 L-44,-34 L-22,0 L-44,34 Z" fill="none" stroke={pal.dark ? "rgba(255,255,255,0.6)" : "rgba(20,24,40,0.25)"} strokeWidth={2} strokeLinejoin="round" />
      </svg>
    );
  } else if (L.guide === "cursor") {
    // a pointer: it clicks where it lands
    const land = g.seg ? liftOf(mv[g.seg]) + mv[g.seg].dur : 40;
    const ck = ramp(f, land, 16);
    const press = f >= land && f < land + 8 ? 0.88 : 1;
    body = (
      <>
        {ck > 0 && ck < 1 && <div style={{ position: "absolute", left: -10 - ck * 50, top: -10 - ck * 50, width: 20 + ck * 100, height: 20 + ck * 100, borderRadius: 999, border: `4px solid ${pal.accent}`, opacity: 1 - ck }} />}
        <svg width={64} height={78} viewBox="0 0 32 39" style={{ position: "absolute", left: -6, top: -4, transform: `scale(${press}) rotate(${moving ? Math.max(-14, Math.min(14, (heading > 90 || heading < -90 ? -1 : 1) * 8)) : -4}deg)`, transformOrigin: "6px 4px", filter: `drop-shadow(0 10px 14px ${pal.shadow})` }}>
          <path d="M3,2 L3,30 L10,23.5 L15,35 L20.5,32.6 L15.6,21.6 L25,21.6 Z" fill="#ffffff" stroke="#11131c" strokeWidth={2.2} strokeLinejoin="round" />
        </svg>
      </>
    );
  } else {
    body = (
      <svg width={240} height={240} viewBox="-120 -120 240 240" style={{ position: "absolute", left: -120, top: -120, overflow: "visible" }}>
        <defs>
          <radialGradient id="orbglow">
            <stop offset={0} stopColor={pal.accent} stopOpacity={0.7} />
            <stop offset={0.45} stopColor={pal.accent2} stopOpacity={0.22} />
            <stop offset={1} stopColor={pal.accent2} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle r={110 + Math.sin(f / 9) * 8} fill="url(#orbglow)" />
        <circle r={22} fill="#ffffff" />
        <circle r={22} fill="none" stroke={pal.accent} strokeWidth={4} opacity={0.8} />
      </svg>
    );
  }
  return (
    <>
      {trail}
      <div style={{ position: "absolute", left: g.p.x, top: g.p.y, width: 0, height: 0, zIndex: 45 }}>{body}</div>
    </>
  );
}
