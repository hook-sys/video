import { type CSSProperties, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Html5Audio, interpolateColors, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SFX_LIBRARY } from "@/components/video/sfx";
import { Icon } from "@/components/video/icons";
import { isLottieName, LottieAnim } from "@/components/video/lottie";
import { clamp01, num, ramp, step, vec } from "./eval";
import { FLOW_FONT, type FlowTheme, lottieColors, THEMES } from "./themes";
import { UiPlane } from "./ui-plane";
import type { FlowLink, FlowNode, FlowPlan, FlowText, ThemeName, Vec } from "./types";

// Renders a FlowPlan: a themed world, persistent nodes under one camera,
// links with travelling packets, kinetic text and Lottie accents.
export { FLOW_SCENE_ID } from "@/components/video/types";
export type FlowSceneProps = { plan: FlowPlan; theme?: ThemeName; audioUrl?: string | null };

// Sound effects under the narration: spaced out and capped so they stay
// subtle (and within the Player's shared audio tags).
const SFX_VOLUME = 0.22;
const SFX_MIN_GAP = 8;
const SFX_MAX = 14;
export function plannedSfx(plan: FlowPlan) {
  const out: { frame: number; src: string }[] = [];
  for (const s of [...(plan.sfx ?? [])].sort((a, b) => a.frame - b.frame)) {
    const src = SFX_LIBRARY[s.kind];
    if (!src || s.frame >= plan.duration - 6 || out.length >= SFX_MAX) continue;
    if (out.length && s.frame - out[out.length - 1].frame < SFX_MIN_GAP) continue;
    out.push({ frame: s.frame, src });
  }
  return out;
}

let fontReady = false;
function useFlowFont() {
  useState(() => {
    if (fontReady || typeof document === "undefined") return;
    const handle = delayRender("Loading Inter");
    const face = new FontFace("InterFlow", `url(${staticFile("fonts/inter-latin-wght.woff2")}) format("woff2")`, { weight: "100 900" });
    face
      .load()
      .then(() => {
        document.fonts.add(face);
        fontReady = true;
      })
      .finally(() => continueRender(handle));
  });
}

type NodeState = { node: FlowNode; pos: Vec; scale: number; opacity: number };

// Node positions at a frame; orbiting nodes circle their centre node
// (blending in and out of their own keyed path).
function computeStates(plan: FlowPlan, frame: number) {
  const states = new Map<string, NodeState>();
  const base = (n: FlowNode): NodeState => ({ node: n, pos: vec(n.pos, frame), scale: num(n.scale, frame, 1), opacity: num(n.opacity, frame, 1) });
  for (const n of plan.nodes) if (!n.orbit) states.set(n.id, base(n));
  for (const n of plan.nodes) {
    if (!n.orbit) continue;
    const s = base(n);
    const o = n.orbit;
    const c = states.get(o.center)?.pos ?? [0, 0];
    const a = ((o.angle + o.speed * (frame - o.start)) * Math.PI) / 180;
    const r = num(o.radius, frame, 0);
    const w = ramp(frame, o.start, 14, "inOut") * (1 - (o.end !== undefined ? ramp(frame, o.end, 14, "inOut") : 0));
    const orbitPos: Vec = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
    states.set(n.id, { ...s, pos: [s.pos[0] + (orbitPos[0] - s.pos[0]) * w, s.pos[1] + (orbitPos[1] - s.pos[1]) * w] });
  }
  return states;
}

export function FlowScene({ plan, theme: themeOverride, audioUrl }: FlowSceneProps) {
  useFlowFont();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = THEMES[themeOverride ?? plan.theme];
  const states = computeStates(plan, frame);
  // One camera: keyed framing plus a slow hand-held drift so nothing is ever static.
  const [cx, cy] = vec(plan.camera.center, frame);
  const zoom = num(plan.camera.zoom, frame, 1) * (1 + 0.006 * Math.sin(frame / 70));
  const drift: Vec = [Math.sin(frame / 83) * 7, Math.cos(frame / 97) * 5];
  const camera = `scale(${zoom}) translate(${-cx + drift[0]}px, ${-cy + drift[1]}px)`;
  const toScreen = (p: Vec): Vec => [width / 2 + zoom * (p[0] - cx + drift[0]), height / 2 + zoom * (p[1] - cy + drift[1])];
  // Iris: member nodes are seen through a circle that closes onto `into`.
  const irises = (plan.iris ?? []).map((ir) => {
    const k = ramp(frame, ir.start, ir.dur, "inOut");
    const into = states.get(ir.into);
    const [tx, ty] = into ? toScreen(into.pos) : [width / 2, height / 2];
    const r0 = Math.hypot(width, height) / 2 + 60;
    const r1 = into ? (into.node.size / 2) * zoom : 0;
    return { ir, k, x: width / 2 + (tx - width / 2) * k, y: height / 2 + (ty - height / 2) * k, r: r0 + (r1 - r0) * k, done: frame >= ir.start + ir.dur };
  });
  const member = new Set(irises.flatMap((i) => i.ir.members));
  const content = (include: (id: string) => boolean, withExtras: boolean) => (
    <div style={{ position: "absolute", left: width / 2, top: height / 2, transform: camera }}>
      {[...states.values()].filter((s) => s.node.kind === "ui" && include(s.node.id)).map((s) => (
        <div key={s.node.id} style={{ position: "absolute", left: s.pos[0], top: s.pos[1] }}>
          <UiPlane node={s.node} frame={frame} theme={theme} scale={s.scale} opacity={s.opacity} />
        </div>
      ))}
      <svg style={{ position: "absolute", left: -4000, top: -4000, width: 8000, height: 8000, overflow: "visible" }} viewBox="-4000 -4000 8000 8000">
        {withExtras && (plan.rings ?? []).map((r, i) => <OrbitRing key={i} ring={r} states={states} frame={frame} theme={theme} />)}
        {plan.links.filter((l) => include(l.from) && include(l.to)).map((l) => (
          <LinkLine key={l.id} link={l} states={states} frame={frame} theme={theme} />
        ))}
      </svg>
      {plan.links.filter((l) => include(l.from) && include(l.to)).flatMap((l) => (l.packets ?? []).map((p, i) => <Packet key={`${l.id}-${i}`} link={l} packet={p} states={states} frame={frame} theme={theme} />))}
      {withExtras && plan.lotties.filter((l) => isLottieName(l.name) && (!l.node || include(l.node))).map((l, i) => {
        const at = (l.node && states.get(l.node)?.pos) || l.pos || [0, 0];
        return (
          <Sequence key={i} from={l.start} layout="none">
            <div style={{ position: "absolute", left: at[0] - l.size / 2, top: at[1] - l.size / 2, width: l.size, height: l.size, pointerEvents: "none" }}>
              <LottieAnim name={l.name as never} colors={lottieColors(theme)} style={{ width: l.size, height: l.size }} />
            </div>
          </Sequence>
        );
      })}
      {[...states.values()].filter((s) => s.node.kind !== "ui" && include(s.node.id)).map((s) => (s.node.kind === "orb" ? <Orb key={s.node.id} s={s} frame={frame} theme={theme} /> : <Pill key={s.node.id} s={s} frame={frame} theme={theme} />))}
    </div>
  );
  return (
    <AbsoluteFill style={{ fontFamily: FLOW_FONT, overflow: "hidden" }}>
      <World theme={theme} frame={frame} camera={[cx, cy]} />
      {content((id) => !member.has(id), true)}
      {irises.filter((i) => !i.done).map((i, n) => (
        <AbsoluteFill key={n} style={{ clipPath: i.k > 0 ? `circle(${i.r}px at ${i.x}px ${i.y}px)` : undefined }}>
          {i.k > 0 && <World theme={theme} frame={frame} camera={[cx, cy]} />}
          {content((id) => i.ir.members.includes(id), false)}
        </AbsoluteFill>
      ))}
      {irises.filter((i) => i.k > 0 && !i.done).map((i, n) => (
        <div key={n} style={{ position: "absolute", left: i.x - i.r, top: i.y - i.r, width: i.r * 2, height: i.r * 2, borderRadius: "50%", border: `${6 + i.k * 4}px solid ${theme.dark ? "rgba(255,255,255,.85)" : "#fff"}`, boxShadow: `0 0 60px ${theme.glow}0.45), inset 0 0 40px ${theme.glow}0.25)`, opacity: Math.min(1, i.k * 6) }} />
      ))}
      {plan.texts.map((t, i) => (
        <Kinetic key={i} t={t} frame={frame} theme={theme} />
      ))}
      {audioUrl && <Html5Audio src={audioUrl} />}
      {plannedSfx(plan).map((s, i) => (
        <Sequence key={`sfx-${i}`} from={s.frame} layout="none">
          <Html5Audio src={staticFile(s.src)} volume={SFX_VOLUME} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function OrbitRing({ ring, states, frame, theme }: { ring: NonNullable<FlowPlan["rings"]>[number]; states: Map<string, NodeState>; frame: number; theme: FlowTheme }) {
  const c = states.get(ring.center);
  const k = ramp(frame, ring.start, 20, "out") * (1 - (ring.end !== undefined ? ramp(frame, ring.end, 14, "in") : 0));
  if (!c || k <= 0) return null;
  return <circle cx={c.pos[0]} cy={c.pos[1]} r={ring.radius * (0.7 + 0.3 * k)} fill="none" stroke={theme.primary} strokeOpacity={0.35 * k} strokeWidth={3} strokeDasharray="3 14" strokeLinecap="round" />;
}

// ── world ───────────────────────────────────────────────────────────────────
function World({ theme, frame, camera }: { theme: FlowTheme; frame: number; camera: Vec }) {
  const par = (k: number): Vec => [-camera[0] * k, -camera[1] * k];
  const blob = (i: number, base: Vec, size: number, color: string, alpha: number) => {
    const [px, py] = par(0.12 + i * 0.05);
    const x = base[0] + px + Math.sin(frame / (140 + i * 30) + i) * 60;
    const y = base[1] + py + Math.cos(frame / (160 + i * 25) + i * 2) * 40;
    return <div key={i} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", background: color, opacity: alpha, filter: "blur(140px)" }} />;
  };
  return (
    <AbsoluteFill style={{ background: theme.dark ? `radial-gradient(120% 90% at 50% 40%, ${theme.bg[0]}, ${theme.bg[1]})` : `radial-gradient(110% 90% at 50% 45%, ${theme.bg[0]} 30%, ${theme.bg[1]})` }}>
      {theme.dark
        ? [blob(0, [120, -80], 900, theme.blobs[0], 0.5), blob(1, [1800, -60], 900, theme.blobs[1], 0.45), blob(2, [960, 1250], 800, theme.blobs[2], 0.18)]
        : [blob(0, [200, 120], 900, theme.blobs[0], 0.45), blob(1, [1750, 950], 1000, theme.blobs[1], 0.7), blob(2, [1500, 80], 700, theme.blobs[2], 0.28)]}
      <AbsoluteFill style={{ background: theme.dark ? "radial-gradient(80% 70% at 50% 50%, transparent 55%, rgba(0,0,0,.45))" : "radial-gradient(90% 80% at 50% 50%, transparent 60%, rgba(91,79,245,.08))" }} />
    </AbsoluteFill>
  );
}

// ── nodes ───────────────────────────────────────────────────────────────────
function IconMorph({ track, frame, size, color }: { track: FlowNode["icon"]; frame: number; size: number; color: string }) {
  const st = step(track, frame, 16);
  if (!st) return null;
  const inK = st.prev ? ramp(frame, frame - st.since + 5, 16, "out") : 1;
  const draw = st.prev ? ramp(frame, frame - st.since + 5, 18, "inOut") : 1;
  const outK = st.prev ? ramp(frame, frame - st.since, 10, "in") : 1;
  const box: CSSProperties = { position: "absolute", left: 0, top: 0, width: size, height: size };
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {st.prev && outK < 1 && (
        <div style={{ ...box, transform: `scale(${1 - outK * 0.6}) rotate(${-outK * 40}deg)`, opacity: 1 - outK }}>
          <Icon name={st.prev} size={size} color={color} strokeWidth={1.9} />
        </div>
      )}
      <div style={{ ...box, transform: `scale(${0.6 + inK * 0.4})`, opacity: st.prev ? clamp01(inK * 3) : 1 }}>
        <Icon name={st.cur} size={size} color={color} strokeWidth={1.9} draw={draw} />
      </div>
    </div>
  );
}

function Caption({ track, frame, theme, y, small }: { track: FlowNode["label"]; frame: number; theme: FlowTheme; y: number; small?: boolean }) {
  const st = step(track, frame, 12);
  if (!st) return null;
  const k = ramp(frame, frame - st.since, 14, "out");
  const outK = st.prev ? ramp(frame, frame - st.since, 8, "in") : 1;
  const style = (v: number, dy: number): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: y,
    transform: `translate(-50%, ${dy}px)`,
    opacity: v,
    whiteSpace: "nowrap",
    fontSize: small ? 34 : 40,
    fontWeight: 650,
    letterSpacing: -0.4,
    color: theme.ink,
  });
  return (
    <>
      {st.prev && outK < 1 && <div style={style(1 - outK, -outK * 18)}>{st.prev}</div>}
      {st.cur && <div style={style(k, (1 - k) * 22)}>{st.cur}</div>}
    </>
  );
}

function Orb({ s, frame, theme }: { s: NodeState; frame: number; theme: FlowTheme }) {
  const { node, pos, scale, opacity } = s;
  if (scale < 0.01 || opacity < 0.01) return null;
  const d = node.size;
  const solid = node.variant !== "soft";
  const ring = num(node.ring, frame, 0);
  const ringR = d / 2 + 16;
  const circ = 2 * Math.PI * ringR;
  const badge = node.check !== undefined ? ramp(frame, node.check, 14, "back") : 0;
  const bg = solid
    ? `radial-gradient(circle at 35% 30%, ${theme.primary2}, ${theme.primary} 70%)`
    : theme.dark
      ? "linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.03))"
      : theme.surface;
  const shadow = solid
    ? `0 ${d * 0.18}px ${d * 0.5}px ${theme.glow}0.45), 0 0 0 ${d * 0.07}px ${theme.glow}0.10), inset 0 2px 0 rgba(255,255,255,.35)`
    : theme.dark
      ? "0 30px 80px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.12)"
      : `0 ${d * 0.14}px ${d * 0.42}px ${theme.glow}0.22), inset 0 0 0 1px rgba(91,79,245,.08)`;
  return (
    <div style={{ position: "absolute", left: pos[0], top: pos[1], width: 0, height: 0, opacity, transform: `scale(${scale})` }}>
      {(node.pulses ?? []).map((p, i) => {
        const k = clamp01((frame - p) / 34);
        if (frame < p || k >= 1) return null;
        const r = d * (1 + k * 1.1);
        return <div key={i} style={{ position: "absolute", left: -r / 2, top: -r / 2, width: r, height: r, borderRadius: "50%", border: `3px solid ${theme.primary}`, opacity: (1 - k) * 0.55 }} />;
      })}
      {ring > 0 && (
        <svg width={ringR * 2 + 12} height={ringR * 2 + 12} style={{ position: "absolute", left: -ringR - 6, top: -ringR - 6, transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id={`rg-${node.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={theme.primary} />
              <stop offset="1" stopColor={theme.accent} />
            </linearGradient>
          </defs>
          <circle cx={ringR + 6} cy={ringR + 6} r={ringR} fill="none" stroke={theme.dark ? "rgba(255,255,255,.08)" : "rgba(91,79,245,.12)"} strokeWidth={8} />
          <circle cx={ringR + 6} cy={ringR + 6} r={ringR} fill="none" stroke={`url(#rg-${node.id})`} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${circ * ring} ${circ}`} />
        </svg>
      )}
      <div style={{ position: "absolute", left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: "50%", background: bg, boxShadow: shadow, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconMorph track={node.icon} frame={frame} size={d * 0.44} color={solid ? "#fff" : theme.primary} />
      </div>
      {badge > 0 && (
        <div style={{ position: "absolute", left: d * 0.36 - d * 0.15, top: -d * 0.36 - d * 0.15, width: d * 0.3, height: d * 0.3, borderRadius: "50%", background: theme.success, transform: `scale(${badge})`, boxShadow: `0 8px 20px ${theme.success}66`, display: "flex", alignItems: "center", justifyContent: "center", border: `4px solid ${theme.dark ? theme.bg[0] : "#fff"}` }}>
          <Icon name="check" size={d * 0.18} color="#fff" strokeWidth={3} draw={ramp(frame, (node.check ?? 0) + 4, 12)} />
        </div>
      )}
      <Caption track={node.label} frame={frame} theme={theme} y={d / 2 + (ring > 0 ? 40 : 26)} />
    </div>
  );
}

function Pill({ s, frame, theme }: { s: NodeState; frame: number; theme: FlowTheme }) {
  const { node, pos, scale, opacity } = s;
  if (scale < 0.01 || opacity < 0.01) return null;
  const st = step(node.label, frame, 12);
  const h = node.size;
  const solid = node.variant === "solid";
  const k = st ? ramp(frame, frame - st.since, 14, "out") : 1;
  return (
    <div style={{ position: "absolute", left: pos[0], top: pos[1], transform: `translate(-50%, -50%) scale(${scale})`, opacity }}>
      <div style={{ height: h, padding: `0 ${h * 0.5}px`, borderRadius: h / 2, display: "flex", alignItems: "center", gap: h * 0.25, whiteSpace: "nowrap", background: solid ? `linear-gradient(135deg, ${theme.primary}, ${theme.primary2})` : theme.dark ? "rgba(255,255,255,.08)" : "#fff", boxShadow: solid ? `0 18px 40px ${theme.glow}0.35)` : `0 16px 40px ${theme.glow}0.16)`, color: solid ? "#fff" : theme.ink, fontSize: h * 0.4, fontWeight: 650, letterSpacing: -0.3 }}>
        {node.icon && <IconMorph track={node.icon} frame={frame} size={h * 0.46} color={solid ? "#fff" : theme.primary} />}
        <span style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * 10}px)` }}>{st?.cur}</span>
      </div>
    </div>
  );
}

// ── links & packets ────────────────────────────────────────────────────────
function curve(link: FlowLink, states: Map<string, NodeState>) {
  const a = states.get(link.from);
  const b = states.get(link.to);
  if (!a || !b) return null;
  const [dx, dy] = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]];
  const len = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / len, dy / len];
  const ra = (a.node.size * a.scale) / 2 + 14;
  const rb = (b.node.size * b.scale) / 2 + 14;
  const p0: Vec = [a.pos[0] + ux * ra, a.pos[1] + uy * ra];
  const p2: Vec = [b.pos[0] - ux * rb, b.pos[1] - uy * rb];
  const bend = link.bend ?? 0;
  const p1: Vec = [(p0[0] + p2[0]) / 2 - uy * bend, (p0[1] + p2[1]) / 2 + ux * bend];
  return { p0, p1, p2, visible: Math.min(a.opacity, b.opacity) * Math.min(1, a.scale, b.scale) };
}
const qpt = (p0: Vec, p1: Vec, p2: Vec, t: number): Vec => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
];

function LinkLine({ link, states, frame, theme }: { link: FlowLink; states: Map<string, NodeState>; frame: number; theme: FlowTheme }) {
  const c = curve(link, states);
  const t = ramp(frame, link.draw[0], link.draw[1] - link.draw[0], "inOut");
  if (!c || t <= 0) return null;
  // Partial quadratic 0..t (de Casteljau) so dashes stay fixed while drawing.
  const q1: Vec = [c.p0[0] + (c.p1[0] - c.p0[0]) * t, c.p0[1] + (c.p1[1] - c.p0[1]) * t];
  const end = qpt(c.p0, c.p1, c.p2, t);
  const fade = link.fade ? 1 - ramp(frame, link.fade[0], link.fade[1] - link.fade[0], "in") : 1;
  const color = link.success !== undefined ? interpolateColors(frame, [link.success, link.success + 14], [theme.primary, theme.success]) : theme.primary;
  const d = `M${c.p0[0]} ${c.p0[1]}Q${q1[0]} ${q1[1]} ${end[0]} ${end[1]}`;
  return (
    <g opacity={fade * c.visible}>
      <path d={d} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={14} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={link.style === "dashed" ? "2 16" : undefined} />
    </g>
  );
}

function Packet({ link, packet, states, frame, theme }: { link: FlowLink; packet: { icon: string; start: number; end: number }; states: Map<string, NodeState>; frame: number; theme: FlowTheme }) {
  const c = curve(link, states);
  if (!c || frame < packet.start || frame > packet.end + 8) return null;
  const u = ramp(frame, packet.start, packet.end - packet.start, "inOut");
  const [x, y] = qpt(c.p0, c.p1, c.p2, u);
  const k = ramp(frame, packet.start, 8, "back") * (1 - ramp(frame, packet.end, 8, "in"));
  const d = 64;
  return (
    <div style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: "50%", background: theme.dark ? theme.surface : "#fff", boxShadow: `0 12px 30px ${theme.glow}0.35), 0 0 0 3px ${theme.primary}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${k})` }}>
      <Icon name={packet.icon} size={32} color={theme.primary} strokeWidth={2.2} />
    </div>
  );
}

// ── kinetic text (screen space) ─────────────────────────────────────────────
function Kinetic({ t, frame, theme }: { t: FlowText; frame: number; theme: FlowTheme }) {
  if (frame < t.start - 2 || frame > t.end + 20) return null;
  const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const accent = new Set((t.accent ?? "").split(/\s+/).map(bare).filter(Boolean));
  let li = 0;
  const words = t.text.split(" ");
  // Letters cascade in, but the whole line lands within ~20 frames.
  const stagger = Math.min(1.1, 20 / Math.max(1, t.text.length));
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(calc(-50% + ${t.pos[0]}px), calc(-50% + ${t.pos[1]}px))`, fontSize: t.size, fontWeight: t.weight ?? 750, letterSpacing: -t.size * 0.03, color: theme.ink, whiteSpace: "nowrap", lineHeight: 1.1 }}>
      {words.map((w, wi) => {
        const isAccent = accent.has(bare(w));
        return (
          <span key={wi} style={{ display: "inline-block", marginRight: wi < words.length - 1 ? "0.26em" : 0 }}>
            {[...w].map((ch, ci) => {
              const i = li++;
              const kin = ramp(frame, t.start + i * stagger, 14, "out");
              const kout = ramp(frame, t.end + i * 0.5, 10, "in");
              const k = kin * (1 - kout);
              return (
                <span key={ci} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - kin) * 0.45 + kout * -0.3}em)`, filter: `blur(${(1 - k) * 8}px)`, ...(isAccent && { backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) }}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
