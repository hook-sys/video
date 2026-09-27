import type { ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BlueprintObject } from "@/lib/ai/product-brief";
import { tokenize } from "@/lib/voice-timing";
import { graphemes } from "./actions";
import { CONTAINER_ASPECT, type Pose, type ResolvedScene, type Track } from "./blueprint";
import { CameraLayer, useSceneSpan } from "./camera";
import { BrowserTab, Chip, Core, ProgressChart, SkeletonCard, TaskCard, TextCard, WorkspaceFrame, type IconName } from "./objects";
import { same, type SyncedScene } from "./sync";
import { ACCENT, ACCENT_2, BG, clamp, FG, FONT } from "./theme";

// Generic primitives the visual blueprint drives. Nothing here decides the
// story: every object, position, action and timing comes from the blueprint.

type Spoken = SyncedScene["spoken"] | undefined;
const TINTS = [ACCENT, ACCENT_2, "#34d399", "#febc2e", "#ff8ad8"];
const ICONS: IconName[] = ["sparkle", "bolt", "layers", "check", "dot"];
const DEPTH = { back: 1.1, mid: 1.3, front: 1.6 } as const;
const tint = (id: string) => TINTS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Frame at which narration reaches `cue` (a few words), else a stagger.
export function cueFrame(cue: string, spoken: Spoken, fps: number, span: number, index: number) {
  const want = tokenize(cue);
  const list = spoken ?? [];
  if (want.length) {
    const at = list.findIndex((_, i) => want.every((w, j) => list[i + j] && same(list[i + j].text, w)));
    const hit = at >= 0 ? list[at] : list.find((s) => same(s.text, want[0]));
    if (hit) return Math.max(0, Math.min(Math.round((hit.at - 0.12) * fps), Math.round(span * 0.85)));
  }
  return Math.min(6 + index * 4, Math.round(span * 0.6));
}

function Environment({ kind, imageUrl }: { kind: string; imageUrl?: string }) {
  const frame = useCurrentFrame();
  if (kind === "hero_image" && imageUrl) {
    return (
      <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
        <CameraLayer>
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.12)", filter: "brightness(0.8)" }} />
        </CameraLayer>
      </AbsoluteFill>
    );
  }
  const drift = Math.sin(frame / 60) * 2;
  const layer =
    kind === "grid" ? (
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${ACCENT}14 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}14 1px, transparent 1px)`, backgroundSize: "6% 10.6%", transform: "scale(1.2)" }} />
    ) : kind === "soft_glow" ? (
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + drift}% 45%, ${ACCENT_2}40, transparent 55%)`, transform: "scale(1.2)" }} />
    ) : kind === "dark_gradient" ? (
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${30 + drift}% 25%, #1b2340, ${BG} 70%)`, transform: "scale(1.2)" }} />
    ) : null;
  return (
    <AbsoluteFill style={{ background: BG }}>
      {layer && <CameraLayer>{layer}</CameraLayer>}
    </AbsoluteFill>
  );
}

// Frame each word appears: when the narration speaks it, else staggered.
function wordStarts(words: string[], spoken: Spoken, fps: number, start: number) {
  const out: number[] = [];
  let from = 0;
  let prev = start - 3;
  for (const w of words) {
    const tok = tokenize(w)[0];
    const k = tok ? (spoken ?? []).findIndex((s, j) => j >= from && same(s.text, tok)) : -1;
    if (k >= 0) from = k + 1;
    prev = Math.max(k >= 0 ? Math.round((spoken![k].at - 0.12) * fps) : prev + 3, prev + 2, start);
    out.push(prev);
  }
  return out;
}

// Text object: words reveal as the narration speaks them (or staggered).
function MotionText({ label, size, start, spoken, emphasis }: { label: string; size: number; start: number; spoken: Spoken; emphasis: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = label.split(/\s+/).filter(Boolean);
  const at = wordStarts(words, spoken, fps, start);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.25}px`, fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.1, color: FG, whiteSpace: "nowrap", textShadow: emphasis ? `0 0 ${size * 0.5}px ${ACCENT_2}` : "0 6px 30px rgba(0,0,0,.5)" }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - at[i], fps, config: { damping: 18, mass: 0.7 } });
        return (
          <span key={i} style={{ overflow: "hidden", display: "inline-block", paddingBottom: "0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 100}%)`, filter: `blur(${(1 - p) * 6}px)`, opacity: p }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}

// The visual for one object type, in its current action state.
function Skin({ obj, px, t, start, spoken }: { obj: BlueprintObject; px: number; t: number; start: number; spoken: Spoken }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const span = useSceneSpan();
  const local = frame - start;
  const act = spring({ frame: local, fps, config: { damping: 12 } });
  switch (obj.type) {
    case "task_card":
      return <TaskCard w={px} tint={tint(obj.id)} done={obj.action === "complete" ? act : 0} />;
    case "browser_tab":
      return <BrowserTab w={px} tint={tint(obj.id)} />;
    case "workspace":
      return <WorkspaceFrame w={px} h={px * CONTAINER_ASPECT} />;
    case "progress_chart": {
      const grows = ["generate", "reveal", "enter", "expand"].includes(obj.action);
      const grow = grows ? interpolate(local, [0, fps * 1.2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
      return <ProgressChart w={px} h={px * 0.5} grow={grow} />;
    }
    case "processing_core":
      return <Core size={px} frame={frame} progress={obj.action === "process" || obj.action === "generate" ? interpolate(local, [0, Math.max(span - start, 1)], [0.05, 1], clamp) : 1} />;
    case "result_card":
    case "video_card":
      return <SkeletonCard w={px} variant="result" fill={["generate", "reveal"].includes(obj.action) ? act : 1} check={obj.action === "complete" ? act : 0} glow={obj.emphasis ? 0.6 : 0} />;
    case "feature_card":
      return <TextCard text={obj.label || " "} size={px * 0.13} icon={ICONS[obj.id.length % ICONS.length]} glow={obj.emphasis ? 0.6 : 0.1} />;
    case "icon":
      return <Chip icon={ICONS[obj.id.length % ICONS.length]} size={px} tint={tint(obj.id)} />;
    case "input_field": {
      const chars = graphemes(obj.label);
      const shown = obj.action === "type" ? Math.floor(interpolate(local, [0, Math.max(chars.length * 2.5, 10)], [0, chars.length], clamp)) : chars.length;
      return (
        <div style={{ width: px, padding: px * 0.05, borderRadius: px * 0.04, background: "rgba(16,19,32,0.88)", border: `2px solid ${obj.action === "type" && local >= 0 ? ACCENT : `${ACCENT}55`}`, color: FG, fontFamily: FONT, fontSize: px * 0.06, minHeight: px * 0.18 }}>
          {chars.slice(0, shown).join("")}
          <span style={{ color: ACCENT, opacity: Math.floor(frame / 12) % 2 ? 0 : 1 }}>▍</span>
        </div>
      );
    }
    case "button": {
      const press = obj.action === "click" ? interpolate(local, [0, 3, 8], [1, 0.9, 1], clamp) : 1;
      return (
        <div style={{ padding: `${px * 0.12}px ${px * 0.25}px`, borderRadius: 999, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`, color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: px * 0.16, whiteSpace: "nowrap", transform: `scale(${press})`, boxShadow: obj.action === "click" && local >= 0 && local < 12 ? `0 0 30px ${ACCENT_2}` : "none" }}>
          {obj.label || "→"}
        </div>
      );
    }
    case "cursor": {
      const tap = obj.action === "click" ? interpolate(local, [0, 3, 7], [1, 0.8, 1], clamp) : 1;
      const ring = obj.action === "click" ? interpolate(local, [0, 14], [0, 1], clamp) : 1;
      return (
        <div style={{ position: "relative", width: px, height: px }}>
          <div style={{ position: "absolute", left: -px * 0.6, top: -px * 0.6, width: px * 1.2, height: px * 1.2, borderRadius: "50%", border: `2px solid ${ACCENT}`, opacity: (1 - ring) * 0.8, transform: `scale(${0.3 + ring})` }} />
          <svg width={px} height={px} viewBox="0 0 24 24" style={{ transform: `scale(${tap})`, transformOrigin: "top left", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.5))" }}>
            <path d="M3 2l17 9.5-7.2 1.8L9.5 21z" fill={FG} stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </div>
      );
    }
    case "text": {
      const size = px * (obj.scale === "large" ? 0.1 : obj.scale === "small" ? 0.05 : 0.07);
      return <MotionText label={obj.label} size={size} start={start} spoken={spoken} emphasis={obj.emphasis} />;
    }
    case "hero_visual":
      return <div style={{ width: px, height: px * 0.6, borderRadius: px * 0.04, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2} 60%, #ff8ad8)`, opacity: 0.9 + 0.1 * t }} />;
  }
}

// One blueprint object: moves from its resolved start pose to its end pose
// when the narration reaches its cue, while performing its action.
function MotionObject({ track, start, spoken, heroUrl }: { track: Track; start: number; spoken: Spoken; heroUrl?: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const { obj, from, to } = track;
  const p = track.exiting
    ? Easing.in(Easing.cubic)(interpolate(frame - start, [0, 16], [0, 1], clamp))
    : spring({ frame: frame - start, fps, config: { damping: 14, mass: 0.8 } });
  const pose: Pose = { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), w: lerp(from.w, to.w, p), rot: lerp(from.rot, to.rot, p), o: lerp(from.o, to.o, Math.min(1, p * 1.4)) };
  const pulse = obj.action === "pulse" || obj.emphasis ? 1 + 0.05 * Math.sin(Math.max(0, frame - start) / 6) * Math.exp(-Math.max(0, frame - start) / 30) : 1;
  const px = pose.w * base;
  const body =
    obj.type === "hero_visual" && heroUrl ? (
      <Img src={heroUrl} style={{ width: px, height: px * 0.6, objectFit: "cover", borderRadius: px * 0.04 }} />
    ) : (
      <Skin obj={obj} px={px} t={p} start={start} spoken={spoken} />
    );
  return (
    <div
      style={{
        position: "absolute",
        left: `${pose.x}%`,
        top: `${pose.y}%`,
        opacity: pose.o,
        transform: `translate(-50%, -50%) rotate(${pose.rot}deg) scale(${pulse})`,
        filter: obj.emphasis && p > 0.5 ? `drop-shadow(0 0 ${base * 0.02}px ${ACCENT_2}88)` : undefined,
        zIndex: obj.type === "workspace" ? 0 : 1,
      }}
    >
      {track.fromType && track.fromType !== obj.type ? (
        // transform: the previous form turns into this one
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) rotateY(${p * 90}deg)`, opacity: 1 - p }}>
            <Skin obj={{ ...obj, type: track.fromType }} px={px} t={p} start={start} spoken={spoken} />
          </div>
          <div style={{ transform: `rotateY(${(1 - p) * -90}deg)`, opacity: p }}>{body}</div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}

// connects_to: a line that draws between two objects as they settle.
function MotionConnection({ a, b, start }: { a: Pose; b: Pose; start: number }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame - start, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * t} y2={a.y + (b.y - a.y) * t} stroke={ACCENT} strokeOpacity={0.7} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// A scene composed entirely from its blueprint: optional environment, then the
// objects on three depth planes so the camera move produces parallax.
export function BlueprintScene({ scene, resolved }: { scene: SyncedScene | (Omit<SyncedScene, "spoken" | "timedActions"> & Partial<SyncedScene>); resolved: ResolvedScene }) {
  const { fps } = useVideoConfig();
  const span = useSceneSpan();
  const bp = scene.visual_plan!;
  const spoken = scene.spoken;
  const starts = new Map(resolved.tracks.map((t, i) => [t.obj.id, t.exiting && !bp.objects.some((o) => o.id === t.obj.id) ? 0 : cueFrame(t.obj.cue, spoken, fps, span, i)]));
  const layer = (depth: BlueprintObject["depth"], children: ReactNode) => (
    <CameraLayer depth={DEPTH[depth]} zoom={depth === "back" ? 0.9 : 1} blur={depth === "back" ? 1.2 : 0}>
      {children}
    </CameraLayer>
  );
  const byDepth = (d: BlueprintObject["depth"]) =>
    resolved.tracks
      .filter((t) => t.obj.depth === d)
      .sort((a, b) => (a.obj.type === "workspace" ? -1 : 0) - (b.obj.type === "workspace" ? -1 : 0))
      .map((t) => <MotionObject key={t.obj.id} track={t} start={starts.get(t.obj.id) ?? 0} spoken={spoken} heroUrl={scene.backgroundUrl} />);
  const pose = (id: string) => resolved.tracks.find((t) => t.obj.id === id)?.to;
  return (
    <AbsoluteFill>
      <Environment kind={bp.environment} imageUrl={scene.backgroundUrl} />
      {layer("back", byDepth("back"))}
      {layer(
        "mid",
        <>
          {resolved.connections.map(([a, b]) => {
            const pa = pose(a);
            const pb = pose(b);
            return pa && pb ? <MotionConnection key={`${a}-${b}`} a={pa} b={pb} start={Math.max(starts.get(a) ?? 0, starts.get(b) ?? 0) + 10} /> : null;
          })}
          {byDepth("mid")}
        </>,
      )}
      {layer("front", byDepth("front"))}
    </AbsoluteFill>
  );
}
