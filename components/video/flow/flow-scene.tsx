import { type CSSProperties, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Html5Audio, Img, interpolateColors, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { SFX_LIBRARY } from "@/components/video/sfx";
import { Icon } from "@/components/video/icons";
import { isLottieName, LottieAnim } from "@/components/video/lottie";
import { clamp01, num, ramp, step, vec } from "./eval";
import { MOTIONBRIEF_MARK, MotionBriefMark } from "./motionbrief-mark";
import { EXPLAINER_FONT, FLOW_FONT, type FlowTheme, lottieColors, THEMES, tint, withBrandColor } from "./themes";
import { computeStates, type NodeState } from "./states";
import { UiPlane } from "./ui-plane";
import { ElementView } from "./element";
import { Backdrop } from "./backdrops";
import { isBackdrop } from "./backdrop-names";
import { fitSize, labelWorldSize, splitLines, TYPE } from "./typography";
import { MARK_DELAY, type FlowBrand, type FlowLink, type FlowList, type FlowNode, type FlowPanel, type FlowPlan, type FlowText, type ThemeName, type Vec } from "./types";
import { blurFilter } from "./blur";

// Renders a FlowPlan: a themed world, persistent nodes under one camera,
// links with travelling packets, kinetic text and Lottie accents.
export { FLOW_SCENE_ID } from "@/components/video/types";
// webAudio: sound through @remotion/media, which the in-browser renderer
// (@remotion/web-renderer) can mix into the file; Html5Audio is only heard.
export type FlowSceneProps = { plan: FlowPlan; theme?: ThemeName; audioUrl?: string | null; webAudio?: boolean };

// Sound effects under the narration. A repeated event may repeat its sound
// (five logos = five pops), but two sounds never land closer than 0.2 s.
// When they collide or the cap is hit, the more important sound wins, so the
// logo reveal and clicks are never the ones dropped.
const SFX_VOLUME = 0.22;
const SFX_MIN_GAP = 6;
const SFX_MAX = 40;
// Every file is under 1.5 s; unmounting after that frees the Player's shared audio tags.
export const SFX_LENGTH = 45;
const SFX_RANK: Record<string, number> = { reveal: 0, success_chime: 0, click: 1, subtle_impact: 1, whoosh: 2, soft_pop: 3, typing: 4, digital_processing: 4 };
export function plannedSfx(plan: FlowPlan) {
  const want = (plan.sfx ?? []).filter((s) => SFX_LIBRARY[s.kind] && s.frame < plan.duration - 6);
  want.sort((a, b) => (SFX_RANK[a.kind] ?? 5) - (SFX_RANK[b.kind] ?? 5) || a.frame - b.frame);
  const kept: typeof want = [];
  for (const s of want) {
    if (kept.length >= SFX_MAX) break;
    if (!kept.some((k) => Math.abs(k.frame - s.frame) < SFX_MIN_GAP)) kept.push(s);
  }
  return kept.sort((a, b) => a.frame - b.frame).map((s) => ({ frame: s.frame, src: SFX_LIBRARY[s.kind]! }));
}

let fontReady = false;
function useFlowFont() {
  useState(() => {
    if (fontReady || typeof document === "undefined") return;
    const handle = delayRender("Loading Inter");
    const faces = [
      new FontFace("InterFlow", `url(${staticFile("fonts/inter-latin-wght.woff2")}) format("woff2")`, { weight: "100 900" }),
      new FontFace("NunitoFlow", `url(${staticFile("fonts/nunito-latin-wght.woff2")}) format("woff2")`, { weight: "200 1000" }),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        for (const f of loaded) document.fonts.add(f);
        fontReady = true;
      })
      .finally(() => continueRender(handle));
  });
}

export function FlowScene({ plan, theme: themeOverride, audioUrl, webAudio }: FlowSceneProps) {
  const Sound = webAudio ? MediaAudio : Html5Audio;
  useFlowFont();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = withBrandColor(THEMES[themeOverride ?? plan.theme], plan.brandColor);
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
  // The world recedes behind a display line so the words carry the frame, and
  // clears completely for the brand lockup.
  const dim = Math.max(num(plan.dim, frame, 0), plan.brand ? ramp(frame, plan.brand.start - 6, 14, "inOut") : 0);
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
      {[...states.values()]
        .filter((s) => s.node.kind === "el" && include(s.node.id))
        .sort((a, b) => (a.node.z ?? 0) - (b.node.z ?? 0))
        .map((s) => (
          <ElementView key={s.node.id} s={s} frame={frame} theme={theme} calm={plan.calm} explainer={plan.explainer} iconStyle={plan.iconStyle} />
        ))}
      {plan.links.filter((l) => include(l.from) && include(l.to)).flatMap((l) => (l.packets ?? []).map((p, i) => <Packet key={`${l.id}-${i}`} link={l} packet={p} states={states} frame={frame} theme={theme} />))}
      {withExtras && plan.cursor && <Cursor cursor={plan.cursor} frame={frame} theme={theme} explainer={plan.explainer} />}
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
      {[...states.values()].filter((s) => s.node.kind !== "ui" && s.node.kind !== "el" && include(s.node.id)).map((s) => (s.node.kind === "orb" ? <Orb key={s.node.id} s={s} frame={frame} theme={theme} zoom={zoom} /> : <Pill key={s.node.id} s={s} frame={frame} theme={theme} />))}
    </div>
  );
  return (
    <AbsoluteFill style={{ fontFamily: plan.explainer ? EXPLAINER_FONT : FLOW_FONT, overflow: "hidden" }}>
      <World theme={theme} frame={frame} camera={[cx, cy]} seed={plan.seed} explainer={plan.explainer} flashes={plan.flashes} decor={plan.decor} tone={plan.tone} />
      {(plan.backdrops ?? []).map((b, i, all) => {
        // Cross-fade 24 frames into each backdrop; it fades as the next arrives
        // and clears for the brand lockup.
        const next = all[i + 1];
        const k = ramp(frame, b.start, 24, "inOut") * (next ? 1 - ramp(frame, next.start, 24, "inOut") : 1) * (plan.brand ? 1 - ramp(frame, plan.brand.start - 6, 14, "inOut") : 1);
        return isBackdrop(b.kind) && k > 0.001 ? <Backdrop key={i} kind={b.kind} frame={frame} theme={theme} camera={[cx, cy]} opacity={plan.calm ? k * 0.55 : k} /> : null;
      })}
      {dim < 0.999 && (
        <AbsoluteFill style={dim > 0.001 ? { opacity: 1 - dim, filter: blurFilter(dim * 14), transform: `scale(${1 - 0.05 * dim})` } : undefined}>{content((id) => !member.has(id), true)}</AbsoluteFill>
      )}
      {irises.filter((i) => !i.done).map((i, n) => (
        <AbsoluteFill key={n} style={{ clipPath: i.k > 0 ? `circle(${i.r}px at ${i.x}px ${i.y}px)` : undefined }}>
          {i.k > 0 && <World theme={theme} frame={frame} camera={[cx, cy]} seed={plan.seed} explainer={plan.explainer} flashes={plan.flashes} decor={plan.decor} tone={plan.tone} />}
          {content((id) => i.ir.members.includes(id), false)}
        </AbsoluteFill>
      ))}
      {irises.filter((i) => i.k > 0 && !i.done).map((i, n) => (
        <div key={n} style={{ position: "absolute", left: i.x - i.r, top: i.y - i.r, width: i.r * 2, height: i.r * 2, borderRadius: "50%", border: `${6 + i.k * 4}px solid ${theme.dark ? "rgba(255,255,255,.85)" : "#fff"}`, boxShadow: `0 0 60px ${theme.glow}0.45), inset 0 0 40px ${theme.glow}0.25)`, opacity: Math.min(1, i.k * 6) }} />
      ))}
      {(plan.panels ?? []).map((p, i) => (
        <Panel key={`panel-${i}`} p={p} frame={frame} theme={theme} width={width} height={height} toScreen={toScreen} />
      ))}
      {(plan.lists ?? []).map((l, i) => (
        <RollingList key={`list-${i}`} list={l} frame={frame} theme={theme} />
      ))}
      {plan.texts.map((t, i) => (
        <Kinetic key={i} t={t} frame={frame} theme={theme} explainer={plan.explainer} />
      ))}
      {plan.brand && <BrandLockup brand={plan.brand} frame={frame} theme={theme} />}
      {audioUrl && <Sound src={audioUrl} />}
      {plannedSfx(plan).map((s, i) => (
        <Sequence key={`sfx-${i}`} from={s.frame} durationInFrames={SFX_LENGTH} layout="none">
          <Sound src={staticFile(s.src)} volume={SFX_VOLUME} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

// ── cursor ──────────────────────────────────────────────────────────────────
// A pointer that glides to what the narration is about and clicks it (a ripple).
function Cursor({ cursor, frame, theme, explainer }: { cursor: NonNullable<FlowPlan["cursor"]>; frame: number; theme: FlowTheme; explainer?: boolean }) {
  const show = num(cursor.show, frame, 0);
  if (show <= 0.001) return null;
  const [x, y] = vec(cursor.path, frame);
  const press = cursor.clicks.reduce((k, c) => Math.max(k, frame >= c && frame < c + 10 ? 1 - Math.abs(frame - c - 3) / 7 : 0), 0);
  const ripples = cursor.clicks.filter((c) => frame >= c && frame < c + 22);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: show, pointerEvents: "none", zIndex: 50 }}>
      {ripples.map((c) => {
        const k = (frame - c) / 22;
        return <div key={c} style={{ position: "absolute", left: -60 * k - 10, top: -60 * k - 10, width: 20 + 120 * k, height: 20 + 120 * k, borderRadius: "50%", border: `3px solid ${theme.primary}`, opacity: 1 - k }} />;
      })}
      {explainer ? (
        // A big brand-gradient arrow (Keka's colourful pointer).
        <svg width={70} height={70} viewBox="0 0 24 24" style={{ position: "absolute", left: -10, top: -6, transform: `scale(${1 - press * 0.14})`, transformOrigin: "6px 4px", filter: `drop-shadow(0 8px 14px ${theme.glow}0.35))` }}>
          <defs>
            <linearGradient id="cur-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={theme.primary} />
              <stop offset="1" stopColor={theme.accent} />
            </linearGradient>
          </defs>
          <path d="M5 3l14 7.5-6.2 1.6L10 18.5z" fill="url(#cur-g)" stroke="#FFFFFF" strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
      ) : (
      <svg width={44} height={44} viewBox="0 0 24 24" style={{ position: "absolute", left: -6, top: -4, transform: `scale(${1 - press * 0.14})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.28))" }}>
        <path d="M5 3l14 7.5-6.2 1.6L10 18.5z" fill={theme.dark ? "#FFFFFF" : "#111827"} stroke={theme.dark ? "#111827" : "#FFFFFF"} strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
      )}
    </div>
  );
}

function OrbitRing({ ring, states, frame, theme }: { ring: NonNullable<FlowPlan["rings"]>[number]; states: Map<string, NodeState>; frame: number; theme: FlowTheme }) {
  const c = states.get(ring.center);
  const k = ramp(frame, ring.start, 20, "out") * (1 - (ring.end !== undefined ? ramp(frame, ring.end, 6, "in") : 0));
  if (!c || k <= 0) return null;
  return <circle cx={c.pos[0]} cy={c.pos[1]} r={ring.radius * (0.7 + 0.3 * k)} fill="none" stroke={theme.primary} strokeOpacity={0.35 * k} strokeWidth={3} strokeDasharray="3 14" strokeLinecap="round" />;
}

// ── world ───────────────────────────────────────────────────────────────────
// A soft mesh of coloured light that keeps drifting (and moves a little with
// the camera), so the frame breathes even when nothing else moves.
export function World({ theme, frame, camera, seed = 0, explainer, flashes, decor, tone }: { theme: FlowTheme; frame: number; camera: Vec; seed?: number; explainer?: boolean; flashes?: [number, number][]; decor?: string; tone?: string }) {
  if (explainer) return <FlatWorld theme={theme} frame={frame} camera={camera} seed={seed} flashes={flashes} decor={decor} tone={tone} />;
  const par = (k: number): Vec => [-camera[0] * k, -camera[1] * k];
  // Per-video variation: the blobs sit elsewhere and the light comes from another side.
  const sx = seed ? ((seed % 997) / 997 - 0.5) * 900 : 0;
  const sy = seed ? (((seed >> 3) % 991) / 991 - 0.5) * 500 : 0;
  const angle = 160 + (seed % 7) * 25;
  const flip = seed % 2 ? -1 : 1;
  const blob = (i: number, base: Vec, size: number, color: string, alpha: number) => {
    const [px, py] = par(0.1 + i * 0.04);
    const x = 960 + (base[0] - 960) * flip + sx + px + Math.sin(frame / (120 + i * 26) + i * 1.7) * 170;
    const y = base[1] + sy + py + Math.cos(frame / (150 + i * 22) + i * 2.3) * 120;
    const s = size * (1 + 0.08 * Math.sin(frame / (90 + i * 17) + i));
    // A soft radial falloff instead of a CSS blur: same look, and the in-browser
    // renderer (which skips large blur filters) draws it identically.
    const e = s + 300;
    return <div key={i} style={{ position: "absolute", left: x - e / 2, top: y - e / 2, width: e, height: e, borderRadius: "50%", background: `radial-gradient(circle, ${color} 0%, ${color} 22%, transparent 70%)`, opacity: alpha }} />;
  };
  return (
    <AbsoluteFill style={{ background: theme.dark ? `radial-gradient(120% 90% at ${50 + sx / 30}% ${40 + sy / 30}%, ${theme.bg[0]}, ${theme.bg[1]})` : `linear-gradient(${angle}deg, ${theme.bg[0]} 20%, ${theme.bg[1]})` }}>
      {theme.dark
        ? [blob(0, [120, -80], 900, theme.blobs[0], 0.5), blob(1, [1800, -60], 900, theme.blobs[1], 0.45), blob(2, [960, 1250], 800, theme.blobs[2], 0.18)]
        : [
            blob(0, [260, 180], 1100, theme.blobs[0], 0.42),
            blob(1, [1700, 900], 1200, theme.blobs[1], 0.55),
            blob(2, [1650, 120], 850, theme.blobs[2], 0.45),
            blob(3, [520, 1020], 950, theme.blobs[0], 0.28),
          ]}
      <AbsoluteFill style={{ background: theme.dark ? "radial-gradient(80% 70% at 50% 50%, transparent 55%, rgba(0,0,0,.45))" : `radial-gradient(90% 80% at 50% 50%, transparent 62%, ${theme.glow}0.06))` }} />
    </AbsoluteFill>
  );
}

// The explainer canvas (Keka): one flat, light, cool colour and quiet decor
// only at the edges — dot patches, a dashed curve, one thick accent arc half
// out of frame. Nothing sits behind the subject in the centre.
// A soft sine path across the frame (the waves decor).
const wavePath = (y: number, amp: number, len: number, phase: number) =>
  Array.from({ length: 56 }, (_, i) => {
    const x = -120 + i * 40;
    return `${i ? "L" : "M"}${x} ${(y + amp * Math.sin((x / len) * Math.PI * 2 + phase)).toFixed(1)}`;
  }).join(" ");

function FlatWorld({ theme, frame, camera, seed, flashes, decor = "dots", tone }: { theme: FlowTheme; frame: number; camera: Vec; seed: number; flashes?: [number, number][]; decor?: string; tone?: string }) {
  // The brand-colour moment: a circle of brand colour grows from the centre and
  // fills the canvas, then fades back.
  const flash = Math.max(0, ...(flashes ?? []).map(([s, e]) => ramp(frame, s - 4, 14, "out") * (1 - ramp(frame, e - 8, 12, "inOut"))));
  // The decor drifts on its own slow cycles (and a little against the camera),
  // so the canvas is never a still picture.
  const px = -camera[0] * 0.5 + Math.sin(frame / 70) * 10;
  const py = -camera[1] * 0.5 + Math.cos(frame / 90) * 8;
  const flip = seed % 2 ? -1 : 1;
  const dots = (x: number, y: number, cols: number, rows: number, color: string) => (
    <svg style={{ position: "absolute", left: x + px, top: y + py, overflow: "visible" }} width={cols * 18} height={rows * 18}>
      {Array.from({ length: cols * rows }, (_, i) => {
        // a soft twinkle travels across the patch
        const tw = 0.55 + 0.45 * Math.sin(frame / 14 - (i % cols) * 0.6 - Math.floor(i / cols) * 0.9);
        return <circle key={i} cx={(i % cols) * 18 + 3} cy={Math.floor(i / cols) * 18 + 3} r={2.2 + tw} fill={color} opacity={tw} />;
      })}
    </svg>
  );
  const bg = theme.dark ? theme.bg[1] : tint(theme.primary, tone === "white" ? 0.025 : tone === "deep" ? 0.13 : 0.07);
  const arcSpin = frame * 0.25;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: flip < 0 ? "scaleX(-1)" : undefined }}>
        {decor === "ribbons" && (
          // Flowing colour ribbons along the bottom edge (Flike), never behind the subject.
          <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
            {/* frame-sized box: the download renderer clips and misplaces SVGs that overhang the frame */}
            <g transform={`translate(${px} ${py})`}>
            {[theme.primary, theme.accent, theme.primary2].map((c, k) => {
              const w = Math.sin(frame / (48 + k * 9) + k * 2) * 40;
              return <path key={k} d={`M-120 ${1010 + k * 26} C 420 ${900 + w + k * 30}, 980 ${1120 - w}, 2040 ${930 + k * 36 + w / 2}`} fill="none" stroke={c} strokeWidth={30 - k * 7} strokeLinecap="round" opacity={0.3 - k * 0.05} />;
            })}
            <path d={`M1480 -40 C 1640 ${60 + Math.sin(frame / 55) * 30}, 1820 ${40 - Math.sin(frame / 55) * 20}, 1990 150`} fill="none" stroke={theme.accent} strokeWidth={22} strokeLinecap="round" opacity={0.28} />
            </g>
          </svg>
        )}
        {decor === "waves" && (
          // One quiet wave line with rings riding it (Desklog), plus outlined circles.
          <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
            {/* frame-sized box: the download renderer clips and misplaces SVGs that overhang the frame */}
            <g transform={`translate(${px} ${py})`}>
            <path d={wavePath(960, 34, 900, frame / 40)} fill="none" stroke={theme.primary} strokeOpacity={0.3} strokeWidth={3} />
            {[0, 1, 2].map((k) => {
              const x = ((frame * 2.2 + k * 700) % 2200) - 140;
              const y = 960 + 34 * Math.sin((x / 900) * Math.PI * 2 + frame / 40);
              return <circle key={k} cx={x} cy={y} r={9} fill={bg} stroke={theme.accent} strokeWidth={4} />;
            })}
            <circle cx={150} cy={140} r={70} fill="none" stroke={theme.primary} strokeOpacity={0.22} strokeWidth={3} />
            <circle cx={250 + Math.sin(frame / 60) * 12} cy={250} r={26} fill="none" stroke={theme.accent} strokeOpacity={0.5} strokeWidth={3} />
            </g>
          </svg>
        )}
        {decor === "glow" && (
          // Soft light pooling at the corners, drifting (Flike's blue air).
          <>
            <div style={{ position: "absolute", left: -380 + px * 2 + Math.sin(frame / 90) * 40, top: -420 + py * 2, width: 1100, height: 1100, borderRadius: "50%", background: `radial-gradient(circle, ${tint(theme.primary, 0.35)} 0%, transparent 65%)`, opacity: 0.55 }} />
            <div style={{ position: "absolute", left: 1300 + px * 2, top: 560 + py * 2 + Math.cos(frame / 80) * 40, width: 1000, height: 1000, borderRadius: "50%", background: `radial-gradient(circle, ${tint(theme.accent, 0.4)} 0%, transparent 65%)`, opacity: 0.45 }} />
            {dots(1640, 60, 6, 3, tint(theme.primary, 0.45))}
          </>
        )}
        {decor === "dots" && (<>
        {/* frame-sized box: the download renderer clips and misplaces SVGs that overhang the frame */}
        <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
          {/* one thick accent arc, half out of frame (bottom right) */}
          <circle cx={0} cy={0} r={300} fill="none" stroke={theme.accent} strokeWidth={52} strokeLinecap="round" strokeDasharray="520 2400" transform={`translate(${1990 + px * 2} ${1150 + py * 2}) rotate(${178 + arcSpin})`} opacity={0.85} />
          {/* a thin dashed curve (top left) */}
          <path d="M0 40 C 180 60, 260 180, 240 360" transform={`translate(${40 + px} ${-40 + py})`} fill="none" stroke={theme.sub} strokeOpacity={0.45} strokeWidth={2.5} strokeDasharray="6 10" strokeDashoffset={-frame * 0.6} />
        </svg>
        {dots(1560, 40, 9, 2, tint(theme.primary, 0.45))}
        {dots(90, 930, 7, 5, tint(theme.accent, 0.55))}
        </>)}
      </div>
      {flash > 0.001 && (
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 2400 * Math.min(1, flash * 1.2), height: 2400 * Math.min(1, flash * 1.2), transform: "translate(-50%, -50%)", borderRadius: "50%", background: `linear-gradient(150deg, ${theme.primary}, ${theme.primary2})`, opacity: Math.min(1, flash * 1.4) }}>
          <svg style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -960, marginTop: -540 }} width={1920} height={1080}>
            <g transform="translate(960 540)">
            {/* rings ripple outward from the centre while the colour holds */}
            {[0, 1, 2].map((k) => {
              const ph = ((frame / 75 + k / 3) % 1 + 1) % 1;
              return <circle key={k} cx={0} cy={0} r={260 + ph * 900} fill="none" stroke="#FFFFFF" strokeOpacity={0.16 * (1 - ph)} strokeWidth={50 - ph * 30} />;
            })}
            </g>
          </svg>
        </div>
      )}
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

function Caption({ track, frame, theme, y, size }: { track: FlowNode["label"]; frame: number; theme: FlowTheme; y: number; size: number }) {
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
    fontSize: size,
    fontWeight: 600,
    letterSpacing: -size * 0.012,
    color: theme.ink,
  });
  return (
    <>
      {st.prev && outK < 1 && <div style={style(1 - outK, -outK * 18)}>{st.prev}</div>}
      {st.cur && <div style={style(k, (1 - k) * 22)}>{st.cur}</div>}
    </>
  );
}

// The subject is a glossy sphere in the theme's gradient; every other node is
// a frosted glass tile (circle or rounded square) with a coloured icon.
function Orb({ s, frame, theme, zoom }: { s: NodeState; frame: number; theme: FlowTheme; zoom: number }) {
  const { node, pos, scale, opacity } = s;
  if (scale < 0.01 || opacity < 0.01) return null;
  const d = node.size;
  const solid = node.variant !== "soft";
  const tile = node.shape ? node.shape === "tile" : !solid;
  const radius = tile ? d * 0.26 : d / 2;
  const ring = num(node.ring, frame, 0);
  const ringR = d / 2 + 16;
  const badge = node.check !== undefined ? ramp(frame, node.check, 14, "back") : 0;
  const bg = solid
    ? `radial-gradient(circle at 32% 26%, rgba(255,255,255,.55), rgba(255,255,255,0) 38%), linear-gradient(145deg, ${theme.primary} 25%, ${theme.primary2})`
    : theme.dark
      ? "linear-gradient(160deg, rgba(255,255,255,.12), rgba(255,255,255,.03))"
      : "linear-gradient(160deg, rgba(255,255,255,.96), rgba(255,255,255,.72))";
  const shadow = solid
    ? `0 ${d * 0.16}px ${d * 0.45}px ${theme.glow}0.4), 0 0 0 ${d * 0.06}px ${theme.glow}0.08), inset 0 -${d * 0.06}px ${d * 0.14}px rgba(0,0,0,.12), inset 0 2px 0 rgba(255,255,255,.4)`
    : theme.dark
      ? "0 30px 80px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.14)"
      : `0 ${d * 0.12}px ${d * 0.36}px ${theme.glow}0.18), inset 0 0 0 1.5px rgba(255,255,255,.9), 0 0 0 1px ${theme.glow}0.08)`;
  // Progress ring: a circle, or a rounded square around a tile.
  const rw = tile ? d + 32 : ringR * 2;
  return (
    <div style={{ position: "absolute", left: pos[0], top: pos[1], width: 0, height: 0, opacity, transform: `scale(${scale})` }}>
      {(node.pulses ?? []).map((p, i) => {
        const k = clamp01((frame - p) / 34);
        if (frame < p || k >= 1) return null;
        const r = d * (1 + k * 1.1);
        return <div key={i} style={{ position: "absolute", left: -r / 2, top: -r / 2, width: r, height: r, borderRadius: tile ? r * 0.28 : "50%", border: `3px solid ${theme.primary}`, opacity: (1 - k) * 0.5 }} />;
      })}
      {ring > 0 && (
        <svg width={rw + 12} height={rw + 12} style={{ position: "absolute", left: -rw / 2 - 6, top: -rw / 2 - 6, overflow: "visible" }}>
          <defs>
            <linearGradient id={`rg-${node.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={theme.primary} />
              <stop offset="1" stopColor={theme.accent} />
            </linearGradient>
          </defs>
          {tile ? (
            <>
              <rect x={6} y={6} width={rw} height={rw} rx={rw * 0.28} fill="none" stroke={theme.soft} strokeWidth={8} />
              <rect x={6} y={6} width={rw} height={rw} rx={rw * 0.28} fill="none" stroke={`url(#rg-${node.id})`} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={`${ring} 1`} />
            </>
          ) : (
            <>
              <circle cx={ringR + 6} cy={ringR + 6} r={ringR} fill="none" stroke={theme.dark ? "rgba(255,255,255,.08)" : theme.soft} strokeWidth={8} />
              <circle cx={ringR + 6} cy={ringR + 6} r={ringR} fill="none" stroke={`url(#rg-${node.id})`} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={`${ring} 1`} transform={`rotate(-90 ${ringR + 6} ${ringR + 6})`} />
            </>
          )}
        </svg>
      )}
      <div style={{ position: "absolute", left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: radius, background: bg, boxShadow: shadow, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconMorph track={node.icon} frame={frame} size={d * (tile ? 0.42 : 0.44)} color={solid ? "#fff" : theme.primary} />
      </div>
      {badge > 0 && (
        <div style={{ position: "absolute", left: d * 0.36 - d * 0.15, top: -d * 0.36 - d * 0.15, width: d * 0.3, height: d * 0.3, borderRadius: "50%", background: theme.success, transform: `scale(${badge})`, boxShadow: `0 8px 20px ${theme.success}66`, display: "flex", alignItems: "center", justifyContent: "center", border: `4px solid ${theme.dark ? theme.bg[0] : "#fff"}` }}>
          <Icon name="check" size={d * 0.18} color="#fff" strokeWidth={3} draw={ramp(frame, (node.check ?? 0) + 4, 12)} />
        </div>
      )}
      <Caption track={node.label} frame={frame} theme={theme} y={d / 2 + (ring > 0 ? 40 : 26)} size={labelWorldSize(zoom * scale)} />
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
  // Elements (cards) are boxes: lines stop at their edge along the direction.
  const reach = (s: NodeState) => (s.node.kind === "el" ? Math.min(Math.abs((s.node.w ?? 0) / 2 / (ux || 1e-6)), Math.abs((s.node.h ?? 0) / 2 / (uy || 1e-6))) * s.scale + 10 : (s.node.size * s.scale) / 2 + 14);
  const ra = reach(a);
  const rb = reach(b);
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
      <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={link.style === "dashed" ? "2 16" : undefined} strokeDashoffset={link.style === "dashed" && link.arrow && t >= 1 ? -(frame - link.draw[1]) * 0.9 : undefined} />
      {link.arrow && t > 0.9 && (() => {
        const a = Math.atan2(end[1] - q1[1], end[0] - q1[0]);
        const h = (k: number): string => `${end[0] - 22 * Math.cos(a + k)},${end[1] - 22 * Math.sin(a + k)}`;
        return <polyline points={`${h(0.5)} ${end[0]},${end[1]} ${h(-0.5)}`} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={(t - 0.9) * 10} />;
      })()}
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
// Each word comes into focus (blur → sharp, rising slightly) exactly when it
// is spoken (its voice timestamp), then the line lifts away together.
function Kinetic({ t, frame, theme, explainer }: { t: FlowText; frame: number; theme: FlowTheme; explainer?: boolean }) {
  if (frame < t.start - 2 || frame > t.end + 16) return null;
  const style = t.style ?? "headline";
  const type = TYPE[style];
  const size = t.size || fitSize(t.text, style, t.accent);
  const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const accent = new Set((t.accent ?? "").split(/\s+/).map(bare).filter(Boolean));
  const at = (i: number) => t.words?.[i] ?? t.start + i * 3;
  const exit = ramp(frame, t.end, 12, "in");
  const lines = style === "side" ? splitLines(t.text, t.accent) : [t.text];
  const onPanel = style === "panel";
  const ink = onPanel ? "#FFFFFF" : theme.ink;
  const mark = t.mark ?? "gradient";
  // The mark (pill / strike) lands once the last accent word has been spoken.
  const allWords = t.text.split(/\s+/).filter(Boolean);
  const lastAccent = allWords.reduce((k, w, j) => (accent.has(bare(w)) ? j : k), -1);
  const firstAccent = allWords.findIndex((w) => accent.has(bare(w)));
  // A strike draws across the words as they are spoken; a pill lands after them.
  const markK =
    lastAccent < 0 || (t.swap && mark === "strike" && frame >= t.swap.at) ? 0
    : t.markAt !== undefined ? ramp(frame, t.markAt + MARK_DELAY, 14, "inOut")
    : mark === "strike" ? ramp(frame, at(firstAccent) + MARK_DELAY, Math.max(12, at(lastAccent) - at(firstAccent) + 8), "inOut")
    : ramp(frame, at(lastAccent) + MARK_DELAY, 14, "inOut");
  const word = (w0: string, last: boolean, strong: boolean, i: number) => {
    // A swapped accent word flips up into its new word.
    const swapped = t.swap && accent.has(bare(w0)) && frame >= t.swap.at;
    const w = swapped ? t.swap!.word + (w0.match(/[.,!?;:…]+$/)?.[0] ?? "") : w0;
    const k = swapped ? ramp(frame, t.swap!.at, 12, "out") : ramp(frame, at(i), 14, "out");
    const isAccent = (swapped || accent.has(bare(w))) && mark === "gradient";
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          marginRight: last ? 0 : "0.26em",
          opacity: k,
          filter: k < 0.99 ? blurFilter((1 - k) * 12) : undefined,
          transform: `translateY(${(1 - k) * 0.32}em)`,
          fontWeight: strong ? type.weight : Math.max(420, type.weight - 180),
          // Explainer: two-tone lines — the words in a light brand tint, the
          // accent bold (Keka: "are you working" / "Remotely").
          ...(explainer && !onPanel && !accent.has(bare(w)) && style !== "pill" && { color: tint(theme.primary, 0.62), fontWeight: 500 }),
          ...(isAccent &&
            (onPanel
              ? { color: theme.dark ? theme.bg[1] : theme.ink }
              : { backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" })),
        }}
      >
        {w}
      </span>
    );
  };
  const pillK = style === "pill" ? ramp(frame, t.start, 14, "back") : 1;
  const side = style === "side";
  return (
    <div
      style={{
        position: "absolute",
        left: side ? `calc(50% + ${t.pos[0]}px)` : "50%",
        top: "50%",
        transform: `translate(${side ? (t.align === "right" ? "-100%" : "0") : "-50%"}, calc(-50% + ${t.pos[1] - exit * 36}px)) scale(${pillK})`,
        opacity: 1 - exit,
        filter: exit > 0.01 ? blurFilter(exit * 10) : undefined,
        fontSize: size,
        fontWeight: type.weight,
        letterSpacing: `${type.track}em`,
        lineHeight: type.lineHeight,
        color: ink,
        textAlign: side ? (t.align === "right" ? "right" : "left") : "center",
        whiteSpace: "nowrap",
        ...(style === "pill" && {
          padding: `${size * 0.36}px ${size * 0.7}px`,
          borderRadius: size,
          background: theme.dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.78)",
          border: "1.5px solid rgba(255,255,255,.95)",
          boxShadow: `0 24px 60px ${theme.glow}0.2)`,
          backdropFilter: "blur(18px)",
        }),
      }}
    >
      {lines.map((line, li) => {
        const ws = line.split(/\s+/).filter(Boolean);
        // Index of this line's first word in the whole text (its spoken time).
        const base = lines.slice(0, li).reduce((n, l) => n + l.split(/\s+/).filter(Boolean).length, 0);
        // Side layout: a lighter lead-in line, then the strong accent line.
        const strong = !side || li === lines.length - 1 || lines.length === 1;
        if (mark === "gradient") return <div key={li}>{ws.map((w, j) => word(w, j === ws.length - 1, strong, base + j))}</div>;
        // Runs of accent words share one pill / one strike line; trailing
        // punctuation stays outside the mark. Each word keeps its spoken index.
        const runs: { words: { w: string; i: number }[]; accent: boolean; tail: string }[] = [];
        ws.forEach((raw, j) => {
          const a = accent.has(bare(raw));
          const [, w, tail] = a ? (raw.match(/^(.*?)([.,!?;:…]*)$/) as RegExpMatchArray) : [raw, raw, ""];
          if (runs.length && runs[runs.length - 1].accent === a && !runs[runs.length - 1].tail) runs[runs.length - 1].words.push({ w, i: base + j });
          else runs.push({ words: [{ w, i: base + j }], accent: a, tail: "" });
          if (tail) runs[runs.length - 1].tail = tail;
        });
        return (
          <div key={li}>
            {runs.map((r, ri) => {
              const lastRun = ri === runs.length - 1;
              const inner = r.words.map(({ w, i }, j) => word(w, j === r.words.length - 1, strong, i));
              const gap = lastRun ? 0 : "0.26em";
              if (!r.accent) return <span key={ri} style={{ marginRight: gap }}>{inner}</span>;
              const tail = r.tail && <span style={{ display: "inline-block", opacity: ramp(frame, at(r.words[r.words.length - 1].i), 14, "out") }}>{r.tail}</span>;
              return (
                <span key={ri} style={{ whiteSpace: "nowrap", marginRight: gap }}>
                <span style={{ position: "relative", display: "inline-block", isolation: "isolate", ...(mark === "pill" && { margin: "0 0.2em" }), ...(mark === "strike" && { opacity: 1 - markK * 0.5 }) }}>
                  {mark === "pill" && (
                    <span
                      style={{
                        position: "absolute",
                        inset: "-0.06em -0.2em -0.02em",
                        borderRadius: "0.32em",
                        background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`,
                        boxShadow: `0 0.3em 0.9em ${theme.glow}0.35)`,
                        clipPath: `inset(0 ${(1 - markK) * 100}% 0 0 round 0.32em)`,
                        zIndex: -1,
                      }}
                    />
                  )}
                  <span style={{ position: "relative" }}>
                    {inner}
                    {mark === "pill" && tail}
                  </span>
                  {mark === "pill" && (
                    // White copy of the words, revealed exactly where the pill has swept.
                    <span aria-hidden style={{ position: "absolute", left: 0, top: 0, color: "#FFFFFF", whiteSpace: "nowrap", clipPath: `inset(-0.2em ${(1 - markK) * 100}% -0.2em -0.2em)` }}>
                      {r.words.map(({ w, i }, j) => word(w, j === r.words.length - 1, strong, i))}
                      {tail}
                    </span>
                  )}
                  {mark === "strike" && (
                    <span style={{ position: "absolute", left: "-0.06em", top: "54%", height: "0.075em", width: `calc(${markK * 100}% + ${markK * 0.12}em)`, borderRadius: "0.04em", background: theme.primary }} />
                  )}
                </span>
                {mark === "strike" && tail}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── colour panel ────────────────────────────────────────────────────────────
// Grows as a circle from the subject until it fills the frame (the camera
// pushes through the subject), then sweeps off to the left.
function Panel({ p, frame, theme, width, height, toScreen }: { p: FlowPanel; frame: number; theme: FlowTheme; width: number; height: number; toScreen: (v: Vec) => Vec }) {
  if (frame < p.start || frame > p.end + 16) return null;
  const k = ramp(frame, p.start, 16, "inOut");
  const out = ramp(frame, p.end, 16, "in");
  const [x, y] = toScreen(p.from);
  const r = 40 + k * (Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 40);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r}px at ${x}px ${y}px)`, transform: `translateX(${-out * 105}%)` }}>
      <AbsoluteFill style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary2})` }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 70% at ${30 + Math.sin(frame / 60) * 10}% 30%, rgba(255,255,255,.28), transparent 70%), radial-gradient(50% 60% at 80% ${80 + Math.cos(frame / 70) * 8}%, rgba(0,0,0,.12), transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 2px, transparent 2.5px)", backgroundSize: "34px 34px", maskImage: "linear-gradient(90deg, #000, transparent 45%)", WebkitMaskImage: "linear-gradient(90deg, #000, transparent 45%)" }} />
    </AbsoluteFill>
  );
}

// ── rolling checklist ───────────────────────────────────────────────────────
function RollingList({ list, frame, theme }: { list: FlowList; frame: number; theme: FlowTheme }) {
  if (frame < list.at[0] - 4 || frame > list.end + 16) return null;
  const size = 64;
  const gap = size * 1.7;
  // Scroll position: advances by one item as each item is spoken.
  const pos = list.at.slice(1).reduce((acc, a) => acc + ramp(frame, a - 6, 16, "inOut"), 0);
  const inK = ramp(frame, list.at[0] - 4, 14, "out");
  const exit = ramp(frame, list.end, 14, "in");
  return (
    <AbsoluteFill style={{ opacity: inK * (1 - exit), transform: `translateY(${-exit * 40}px)` }}>
      {list.items.map((item, j) => {
        const dj = j - pos;
        if (Math.abs(dj) > 1.8) return null;
        const focus = 1 - Math.min(1, Math.abs(dj));
        const tick = ramp(frame, list.at[j] + 4, 12, "back");
        return (
          <div
            key={j}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, calc(-50% + ${dj * gap}px)) scale(${0.86 + 0.14 * focus})`,
              opacity: 0.18 + 0.82 * focus,
              filter: focus < 0.98 ? blurFilter((1 - focus) * 5) : undefined,
              display: "flex",
              alignItems: "center",
              gap: size * 0.4,
              whiteSpace: "nowrap",
              fontSize: size,
              fontWeight: 560,
              letterSpacing: "-0.02em",
              color: theme.ink,
            }}
          >
            <div style={{ width: size * 0.9, height: size * 0.9, borderRadius: size * 0.22, background: `linear-gradient(145deg, ${theme.primary}, ${theme.primary2})`, boxShadow: `0 10px 26px ${theme.glow}0.35)`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.6 + 0.4 * tick})` }}>
              <Icon name="check" size={size * 0.56} color="#fff" strokeWidth={3} draw={tick} />
            </div>
            {item}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// ── brand lockup ────────────────────────────────────────────────────────────
// The logo tile pops in with a turn, the logo inside it pops a beat later, a
// ring of light spreads behind it and a highlight sweeps across; it then
// slides aside as the product name reveals next to it, and keeps a gentle
// breathing motion. The call to action settles in below. A wide logo (a
// wordmark) is shown on its own.
function useImageAspect(src?: string) {
  const [aspect, setAspect] = useState<number | null>(null);
  useState(() => {
    if (!src || src === MOTIONBRIEF_MARK || typeof Image === "undefined") return;
    const handle = delayRender("Loading logo");
    const img = new Image();
    img.onload = () => {
      setAspect(img.naturalWidth / Math.max(1, img.naturalHeight));
      continueRender(handle);
    };
    img.onerror = () => continueRender(handle);
    img.src = src;
  });
  return aspect;
}

function BrandLockup({ brand, frame, theme }: { brand: FlowBrand; frame: number; theme: FlowTheme }) {
  const aspect = useImageAspect(brand.logo);
  if (frame < brand.start - 2) return null;
  const f = frame - brand.start;
  const inK = ramp(f, 0, 18, "out");
  const wordmark = !!brand.logo && ((aspect ?? 1) > 1.8 || !brand.name);
  const nameSize = 118;
  const mark = 170;
  const nameW = wordmark ? 0 : brand.name.length * 0.56 * nameSize;
  const slide = wordmark ? 0 : ramp(f, 14, 22, "inOut");
  const reveal = wordmark ? 0 : ramp(f, 18, 24, "out");
  const cta = ramp(f, 34, 18, "out");
  const breathe = 1 + 0.025 * clamp01(f / 120);
  const gapX = 40;
  // The logo is centred alone first, then the pair (logo, gap, name) is.
  const markX = slide * (mark / 2 - (mark + gapX + nameW) / 2);
  // MotionBrief's own mark animates itself (box, lines, play button).
  const ownMark = brand.logo === MOTIONBRIEF_MARK;
  const pop = ownMark ? 1 : ramp(f, 0, 22, "back");
  const inner = ramp(f, 8, 18, "back");
  const ring = ramp(f, 4, 34, "out");
  const shine = ramp(f, 20, 20, "inOut");
  const idle = clamp01((f - 40) / 30);
  const turn = (ownMark ? 0 : (1 - ramp(f, 0, 22, "out")) * -16) + Math.sin(f / 26) * 2.2 * idle;
  const bob = Math.sin(f / 32) * 5 * idle;
  const sweep =
    shine > 0 && shine < 1 ? (
      <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: "-20% -60%", background: "linear-gradient(110deg, transparent 38%, rgba(255,255,255,.75) 50%, transparent 62%)", transform: `translateX(${-60 + 120 * shine}%)` }} />
      </div>
    ) : null;
  const innerStyle = { transform: `scale(${0.4 + 0.6 * inner})`, opacity: clamp01(inner * 1.6) };
  return (
    <AbsoluteFill style={{ transform: `scale(${breathe})` }}>
      <div style={{ position: "absolute", left: "50%", top: "46%", transform: `translate(calc(-50% + ${markX}px), calc(-50% + ${bob}px)) scale(${0.45 + 0.55 * pop}) rotate(${turn}deg)`, opacity: inK, filter: inK < 0.99 ? blurFilter((1 - inK) * 16) : undefined }}>
        {!wordmark && ring > 0 && ring < 1 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: mark, height: mark, margin: -mark / 2, borderRadius: "50%", border: `4px solid ${theme.primary}`, boxShadow: `0 0 40px ${theme.glow}0.6)`, transform: `scale(${0.9 + ring * 1.3})`, opacity: (1 - ring) * 0.7 }} />
        )}
        {ownMark ? (
          <div style={{ position: "relative", width: mark, height: mark, borderRadius: mark * 0.26, boxShadow: `0 24px 60px ${theme.glow}0.3)` }}>
            <MotionBriefMark frame={f} size={mark} />
            {sweep}
          </div>
        ) : brand.logo ? (
          wordmark ? (
            <div style={{ position: "relative", borderRadius: 16 }}>
              <Img src={brand.logo} style={{ display: "block", height: Math.min(220, 860 / Math.max(1, aspect ?? 1)), width: "auto", maxWidth: 860, objectFit: "contain" }} />
              {sweep}
            </div>
          ) : (
            <div style={{ position: "relative", width: mark, height: mark, borderRadius: mark * 0.26, background: "rgba(255,255,255,.92)", boxSizing: "border-box", border: "1.5px solid #fff", boxShadow: `0 24px 60px ${theme.glow}0.25)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <Img src={brand.logo} style={{ width: mark * 0.74, height: mark * 0.74, objectFit: "contain", ...innerStyle }} />
              {sweep}
            </div>
          )
        ) : (
          <div style={{ position: "relative", width: mark, height: mark, borderRadius: mark * 0.26, background: `linear-gradient(145deg, ${theme.primary}, ${theme.primary2})`, boxShadow: `0 24px 60px ${theme.glow}0.35)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={innerStyle}>
              <Icon name={brand.icon ?? "sparkles"} size={mark * 0.46} color="#fff" strokeWidth={1.9} />
            </div>
            {sweep}
          </div>
        )}
      </div>
      {!wordmark && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            transform: `translate(${markX + mark / 2 + gapX}px, -50%)`,
            clipPath: `inset(-20% ${(1 - reveal) * 100}% -20% 0)`,
            fontSize: nameSize,
            fontWeight: 680,
            letterSpacing: "-0.035em",
            color: theme.ink,
            whiteSpace: "nowrap",
            opacity: reveal > 0 ? 1 : 0,
          }}
        >
          {brand.name}
        </div>
      )}
      {brand.cta && (
        <div style={{ position: "absolute", left: "50%", top: "62%", transform: `translate(-50%, ${(1 - cta) * 24}px)`, opacity: cta, filter: cta < 0.99 ? blurFilter((1 - cta) * 8) : undefined, fontSize: 40, fontWeight: 650, letterSpacing: "-0.01em", color: "#FFFFFF", whiteSpace: "nowrap", padding: "18px 44px", borderRadius: 999, background: `linear-gradient(90deg, ${theme.primary}, ${theme.primary2})`, boxShadow: `0 18px 40px ${theme.glow}0.3)` }}>
          {brand.cta}
        </div>
      )}
    </AbsoluteFill>
  );
}
