import { useId, type ReactNode } from "react";
import { H, W } from "../frame";
import { Glass, Parallax, cam2d } from "../fake2d";
import { kIn, type Ctx } from "../kit";
import { clamp01 } from "../motion";
import type { CameraKind, Word } from "../types";
import { Atmosphere } from "./atmosphere";
import { fitType, saidAt, stageOf, type Rect } from "./stage";
import { countSpoken, type ResolvedHero } from "./slots";

// A spoken result, counted only from the word that said it, over a line that
// draws itself and then keeps a highlight moving. The last fraction of the
// scene zooms into the final point (flat scale, no fade to black).
export function GrowthChart({ hero, camera, c, words, from, to, si }: { hero: ResolvedHero; camera: CameraKind; c: Ctx; words: Word[]; from: number; to: number; si: number }) {
  const p = clamp01((c.f - from) / Math.max(1, to - from));
  const cam = cam2d(camera, p, c.f, c.art.energy);
  const { main, alt } = stageOf(hero.layout);
  const label = hero.slots.metricLabel!;
  const sheen = (c.f % 48) / 48;
  const air = () => <Atmosphere c={c} variant={hero.variant} />;
  const chart = <Chart c={c} hero={hero} from={from} to={to} />;
  return (
    <Parallax
      cam={cam}
      textBox={union(main, alt)}
      back={air()}
      mid={<Drift f={c.f} color={c.pal.fill} />}
      front={alt ? (
        <>
          <Pane c={c} rect={main} sheen={sheen} si={si} title={label.text} backdrop={air()}>{<Copy c={c} hero={hero} words={words} from={from} rect={main} si={si} stacked={false} />}</Pane>
          <Pane c={c} rect={alt} sheen={sheen} si={si} title={label.text} backdrop={air()}>{chart}</Pane>
        </>
      ) : (
        <Pane c={c} rect={main} sheen={sheen} si={si} title={label.text} backdrop={air()}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "6% 6% 5%", gap: 12 }}>
            <Copy c={c} hero={hero} words={words} from={from} rect={main} si={si} stacked />
            <div style={{ flex: 1, minHeight: 0 }}>{chart}</div>
          </div>
        </Pane>
      )}
    />
  );
}

function Drift({ f, color }: { f: number; color: string }) {
  return (
    <>
      {[0, 1, 2].map((i) => {
        const ang = f / (64 + i * 18) + i * 1.4;
        const x = W * (0.22 + i * 0.28) + Math.cos(ang) * 36;
        const y = H * (0.28 + (i % 2) * 0.38) + Math.sin(ang * 0.9) * 28;
        const s = Math.min(W, H) * (0.16 + i * 0.05);
        return <div key={i} style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: s, background: color, opacity: 0.16 }} />;
      })}
    </>
  );
}

function union(a: Rect, b: Rect | null): Rect {
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function Pane({ c, rect, sheen, si, title, backdrop, children }: { c: Ctx; rect: Rect; sheen: number; si: number; title: string; backdrop?: ReactNode; children: ReactNode }) {
  const fill = c.pal.dark ? "rgba(16,16,22,0.42)" : "rgba(255,255,255,0.42)";
  return (
    <Glass x={rect.x} y={rect.y} w={rect.w} h={rect.h} radius={Math.min(36, (c.art.radius || 16) + 12)} fill={fill} sheen={sheen} backdrop={backdrop}>
      <div data-qa="thing" data-key={`${si}:chart:${title}:${Math.round(rect.x)}:${Math.round(rect.y)}`} data-kind="chart" data-title={title} data-scene={si} style={{ width: "100%", height: "100%" }}>
        {children}
      </div>
    </Glass>
  );
}

function Copy({ c, hero, words, from, rect, si, stacked }: { c: Ctx; hero: ResolvedHero; words: Word[]; from: number; rect: Rect; si: number; stacked: boolean }) {
  const label = hero.slots.metricLabel!;
  const value = hero.slots.value;
  const step = hero.stagger === "pop" ? 2 : 8;
  const labelK = kIn(c, saidAt(words, label.from, from + 4), 14);
  const slide = hero.stagger === "slide" ? 24 : 0;
  const cap = Math.round(Math.min(rect.w * 0.2, rect.h * 0.28, value ? 148 : 120));
  const shown = value ? countSpoken(value.value, countK(c.f, words, value.word, from)) : "";
  const numSize = shown ? fitType(shown + (value?.unit ?? ""), rect.w - 64, cap, 56) : 0;
  const labelSize = Math.max(20, Math.round((numSize || cap) * (value ? 0.28 : 0.55)));
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, padding: stacked ? 0 : "10% 8%", height: stacked ? undefined : "100%" }}>
      <div style={{ fontFamily: c.text, fontWeight: 650, fontSize: labelSize, letterSpacing: "0.01em", color: c.pal.panelSub, opacity: clamp01(labelK * 1.3), transform: `translateY(${((1 - clamp01(labelK)) * slide).toFixed(1)}px)` }}>
        {label.text.split(" ").map((w, i) => (
          <span key={i} data-qa="word" data-key={`${si}:w${i}`} style={{ display: "inline-block", marginRight: "0.28em" }}>{w}</span>
        ))}
      </div>
      {value && shown && (
        <div data-qa="word" data-key={`${si}:n`} style={{ fontFamily: c.display, fontWeight: c.art.weight, fontSize: numSize, letterSpacing: "-0.04em", lineHeight: 0.92, color: c.pal.panelInk }}>
          {shown}
          {value.unit && !shown.endsWith(value.unit) ? <span style={{ fontSize: numSize * 0.38, marginLeft: 8, color: c.pal.fill }}>{value.unit}</span> : null}
        </div>
      )}
      {hero.slots.caption && <Caption c={c} text={hero.slots.caption.text} at={saidAt(words, hero.slots.caption.from, from + step * 2)} />}
    </div>
  );
}

function Caption({ c, text, at }: { c: Ctx; text: string; at: number }) {
  const k = kIn(c, at, 14);
  return <div style={{ fontFamily: c.text, fontSize: 22, fontWeight: 500, color: c.pal.panelSub, opacity: clamp01(k * 1.2), maxWidth: "96%" }}>{text}</div>;
}

function countK(f: number, words: Word[], index: number, from: number) {
  const hit = saidAt(words, index, from + 20);
  return clamp01((f - (hit - 16)) / 22);
}

function Chart({ c, hero, from, to }: { c: Ctx; hero: ResolvedHero; from: number; to: number }) {
  const gid = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const draw = clamp01((c.f - from - 4) / 34);
  const ys = [0.74, 0.62, 0.66, 0.48, 0.36, 0.18].map((y, i) => Math.max(0.1, Math.min(0.88, y + (((hero.variant * 3 + i * 5) % 7) - 3) * 0.02)));
  const pts = ys.map((y, i) => [(i / (ys.length - 1)) * 100, y * 100] as [number, number]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  const base = `L100 100 L0 100 Z`;
  const len = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const travel = ((c.f - from) / 46) % 1;
  const dot = along(pts, Math.min(travel, draw));
  const exitStart = to - Math.max(12, Math.round((to - from) * 0.2));
  const exit = hero.exit === "zoom-in" ? clamp01((c.f - exitStart) / Math.max(10, to - exitStart)) : 0;
  const focus = pts[pts.length - 1];
  const z = 1 + exit * 0.7;
  return (
    <div style={{ width: "100%", height: "100%", padding: "8% 7%", overflow: "hidden" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block", overflow: "visible", transform: `scale(${z.toFixed(4)})`, transformOrigin: `${focus[0]}% ${focus[1]}%` }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.pal.fill} stopOpacity={0.38} />
            <stop offset="1" stopColor={c.pal.fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[22, 44, 66, 84].map((y) => <line key={y} x1={0} y1={y} x2={100} y2={y} stroke={c.pal.panelLine} strokeWidth={0.4} opacity={0.7} />)}
        <path d={`${d} ${base}`} fill={`url(#${gid})`} opacity={draw} />
        <path d={d} fill="none" stroke={c.pal.fill} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
        {pts.map((p, i) => {
          const on = draw >= i / (pts.length - 1);
          const k = on ? clamp01((draw - i / (pts.length - 1)) * pts.length) : 0;
          const pulse = i === pts.length - 1 && on ? 1 + Math.sin(c.f / 8) * 0.12 : 1;
          return <circle key={i} cx={p[0]} cy={p[1]} r={1.5 * pulse} fill={c.pal.fill} opacity={k} />;
        })}
        {draw > 0.05 && <circle cx={dot[0]} cy={dot[1]} r={2.2} fill="#fff" stroke={c.pal.fill} strokeWidth={0.8} />}
      </svg>
    </div>
  );
}

function along(pts: [number, number][], u: number): [number, number] {
  const seg = Math.max(1, pts.length - 1);
  const x = Math.max(0, Math.min(0.999, u)) * seg;
  const i = Math.min(pts.length - 2, Math.floor(x));
  const t = x - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
}
