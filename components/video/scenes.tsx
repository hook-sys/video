import { type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { tokenize } from "@/lib/voice-timing";
import { enter, motionFor } from "./animations";
import { ActionLayer, graphemes } from "./actions";
import { CameraLayer, CameraProvider, focusOn, orderKeys, pose, useSceneSpan, type CameraKey } from "./camera";
import { Burst, Chip, Core, Obj, Particles, SkeletonCard, TextCard, type IconName } from "./objects";
import type { ResolvedScene } from "./blueprint";
import { BlueprintScene } from "./motion";
import { SceneSfx } from "./sfx";
import { same, type SyncedScene, type TimedAction } from "./sync";
import { sceneEdgeStyle, TRANSITION_FRAMES, transitionFor } from "./transitions";
import { ACCENT, ACCENT_2, BG, clamp, FG, FONT, glass, inset } from "./theme";
import type { RenderScene } from "./types";

type SyncedView = RenderScene & Partial<Pick<SyncedScene, "timedActions" | "spoken">>;

// Parallax depths: background 1x, midground objects, main subject, text, then
// the blurred foreground nearest the lens.
const DEPTH = { mid: 1.2, subject: 1.3, text: 1.45, fore: 1.65 };
// App window placement, as fractions of the frame.
const WINDOW = { top: 0.07, bottom: 0.3, left: 0.09 };

// Full-frame generated image on the camera's background plane. Softened and
// dimmed so it supports the composition instead of being the main visual.
function ImageBackground({ scene, hero = false }: { scene: RenderScene; hero?: boolean }) {
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <CameraLayer>
        {scene.backgroundUrl ? (
          <Img
            src={scene.backgroundUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.15)", filter: hero ? "brightness(0.85)" : "blur(6px) saturate(0.7) brightness(0.55)" }}
          />
        ) : (
          <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, #1b2340, ${BG})`, transform: "scale(1.15)" }} />
        )}
      </CameraLayer>
      <Atmosphere />
      {/* Legibility scrim keeps text crisp over any image. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(8,10,18,0.1), rgba(8,10,18,0.7) 85%)" }} />
    </AbsoluteFill>
  );
}

// Soft brand-coloured light just in front of the background (1.02x): gives the
// space depth without competing with the objects.
function Atmosphere() {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 2;
  return (
    <CameraLayer depth={1.02}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${30 + drift}% 30%, ${ACCENT}26, transparent 45%), radial-gradient(circle at ${72 - drift}% 72%, ${ACCENT_2}22, transparent 50%)`,
        }}
      />
    </CameraLayer>
  );
}

// When each headline word enters: just before the narration says it, otherwise
// staggered after the previous word; never later than ~half the scene.
function wordFrames(words: string[], spoken: SyncedView["spoken"], fps: number, span: number) {
  let from = 0;
  let prev = 0;
  return words.map((w, i) => {
    const tok = tokenize(w)[0];
    const k = tok ? (spoken ?? []).findIndex((s, j) => j >= from && same(s.text, tok)) : -1;
    if (k >= 0) from = k + 1;
    const heard = k >= 0 ? Math.round((spoken![k].at - 0.15) * fps) : undefined;
    const f = Math.min(Math.max(heard ?? (i === 0 ? 6 : prev + 3), i === 0 ? 4 : prev + 2), Math.round(span * 0.55));
    prev = f;
    return f;
  });
}

// Which headline word carries the emphasis: the one the storyboard highlights,
// otherwise the longest word (the content word, not a connector).
function emphasisIndex(words: string[], scene: SyncedView) {
  if (words.length < 2) return -1;
  const trigger = tokenize(scene.timedActions?.find((a) => a.action === "highlight")?.trigger ?? "");
  const hit = words.findIndex((w) => trigger.some((t) => same(tokenize(w)[0] ?? "", t)));
  if (hit >= 0) return hit;
  let best = 0;
  words.forEach((w, i) => (graphemes(w).length > graphemes(words[best]).length ? (best = i) : 0));
  return best;
}

// Title words and their entry frames, shared by the headline and by objects
// that react to the emphasised word.
function headlineBeats(scene: SyncedView, lines: string[], fps: number, span: number) {
  const words = (lines[0] ?? "").split(/\s+/).filter(Boolean);
  const at = wordFrames(words, scene.spoken, fps, span);
  const emphasis = emphasisIndex(words, scene);
  return { words, at, emphasis, emphasisAt: emphasis >= 0 ? at[emphasis] : undefined };
}

// Kinetic headline: words slide up out of a mask as the narration speaks them,
// sharpening from a blur. The emphasised word lands harder: scale overshoot,
// tracking that tightens into place and a glow that settles. A timed
// "highlight" action also draws an accent underline.
function Headline({
  scene,
  lines,
  scale = 1,
}: {
  scene: SyncedView;
  lines: string[];
  scale?: number;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const rest = lines.slice(1);
  const { words, at, emphasis } = headlineBeats(scene, lines, fps, span);
  const motion = motionFor(scene.animation);
  const highlight = actionFrames(scene, "highlight", fps);
  const mark = highlight ? spring({ frame: frame - highlight[0], fps, config: { damping: 16 } }) : 0;
  const restFrom = (at.at(-1) ?? 0) + 10;
  if (!words.length && !rest.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: base * 0.02 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: `0 ${base * 0.018}px`,
          fontFamily: FONT,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          fontSize: base * 0.085 * scale,
          lineHeight: 1.05,
          color: FG,
          textShadow: "0 6px 40px rgba(0,0,0,.45)",
        }}
      >
        {words.map((w, i) => {
          if (i === emphasis) {
            const e = spring({ frame: frame - at[i], fps, config: { damping: 9, mass: 0.7 } });
            const glow = interpolate(frame - at[i], [0, 8, 30], [0, 1, 0.35], clamp);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: Math.min(1, e * 1.6),
                  transform: `scale(${1.28 - 0.28 * e})`,
                  letterSpacing: `${0.14 * Math.max(0, 1 - e) - 0.02}em`,
                  filter: `blur(${Math.max(0, 1 - e) * 10}px)`,
                  color: "#e4e9ff",
                  textShadow: `0 6px 40px rgba(0,0,0,.45), 0 0 ${base * 0.03 * glow}px ${ACCENT_2}`,
                  paddingBottom: "0.08em",
                }}
              >
                {w}
              </span>
            );
          }
          const p = spring({ frame: frame - at[i], fps, config: { damping: 20, mass: 0.7 } });
          return (
            <span key={i} style={{ overflow: "hidden", display: "inline-block", paddingBottom: "0.08em" }}>
              <span
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - p) * 100}%) scale(${0.94 + 0.06 * p})`,
                  filter: `blur(${(1 - p) * 8}px)`,
                  opacity: p,
                }}
              >
                {w}
              </span>
            </span>
          );
        })}
      </div>
      {highlight && (
        <div
          style={{
            height: base * 0.008 * scale + 2,
            width: `${Math.min(90, words.length * 12)}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
            boxShadow: `0 0 24px ${ACCENT_2}`,
            transform: `scaleX(${mark})`,
            marginTop: -base * 0.012,
          }}
        />
      )}
      {rest.map((line, i) => (
        <div
          key={i}
          style={{
            ...enter(motion === "fade" ? "blur" : motion, frame, fps, restFrom + i * 6),
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: base * 0.04 * scale,
            color: "rgba(245,247,251,0.85)",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

// `lines`: on-screen text not already shown elsewhere; `typed`: the line the UI types.
// `prevKind`/`prevTyped` let a scene continue the previous one's focal object.
type VisualProps = { scene: SyncedView; isFinal?: boolean; lines: string[]; typed: string; prevKind?: Kind; prevTyped?: string };

// Foreground depth-of-field layer (nearest, softly blurred): one object that
// reacts to a story beat. No ambient particles.
function Foreground({ seed, chip, at }: { seed: number; chip: IconName; at: number }) {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  return (
    <CameraLayer depth={DEPTH.fore} zoom={1} blur={1.5}>
      <Obj x={seed % 2 ? 86 : 14} y={seed % 2 ? 26 : 68} at={at} from="depth" float={1.5} seed={seed}>
        <Chip icon={chip} size={base * 0.1} />
      </Obj>
    </CameraLayer>
  );
}

const CHIP_ICONS: IconName[] = ["sparkle", "bolt", "layers", "dot"];

// typography / abstract: kinetic headline with objects around it at three depths.
function KineticScene({ scene, lines }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const { emphasisAt } = headlineBeats(scene, lines, fps, span);
  const idx = Number(scene.id.split("-")[1] ?? 0);
  // Light behind the headline swells when the emphasised word lands.
  const lit = emphasisAt === undefined ? 0 : spring({ frame: frame - emphasisAt, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <CameraLayer depth={DEPTH.mid} zoom={0.9}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: height * 0.08 }}>
          <div style={{ width: base * 0.9, height: base * 0.45, borderRadius: "50%", background: `radial-gradient(closest-side, ${ACCENT_2}${lit > 0.5 ? "55" : "22"}, transparent)`, transform: `scale(${0.85 + 0.25 * lit})` }} />
        </AbsoluteFill>
      </CameraLayer>
      <CameraLayer depth={DEPTH.text} zoom={0.45}>
        <AbsoluteFill style={{ flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 10%", paddingBottom: height * 0.08 }}>
          <Headline scene={scene} lines={lines} />
        </AbsoluteFill>
      </CameraLayer>
      {emphasisAt !== undefined && <Foreground seed={idx} chip={CHIP_ICONS[idx % 4]} at={emphasisAt + 4} />}
    </AbsoluteFill>
  );
}

// When each feature phrase is spoken (its first word), else staggered.
function lineFrames(lines: string[], spoken: SyncedView["spoken"], fps: number, span: number) {
  let from = 0;
  let prev = 0;
  return lines.map((line, i) => {
    const tok = tokenize(line)[0];
    const k = tok ? (spoken ?? []).findIndex((s, j) => j >= from && same(s.text, tok)) : -1;
    if (k >= 0) from = k + 1;
    const heard = k >= 0 ? Math.round((spoken![k].at - 0.12) * fps) : undefined;
    const f = Math.min(Math.max(heard ?? (i === 0 ? 8 : prev + 14), i === 0 ? 4 : prev + 6), Math.round(span * 0.7));
    prev = f;
    return f;
  });
}

// Feature showcase slots (% of frame) and depths, for up to three phrases.
const FEATURE_SLOTS: Point[][] = [[[50, 48]], [[36, 40], [64, 60]], [[30, 32], [52, 50], [72, 68]]];
const FEATURE_ICONS: IconName[] = ["bolt", "sparkle", "check"];

// A phrase card that is on screen as a placeholder, then "generates" its
// phrase (masked slide-up + glow) exactly when the narration says it.
function FeatureCard({ text, icon, size, fillAt, focus }: { text: string; icon: IconName; size: number; fillAt: number; focus: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - fillAt, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        ...glass,
        display: "flex",
        alignItems: "center",
        gap: size * 0.5,
        minWidth: size * 6,
        padding: `${size * 0.55}px ${size * 0.8}px`,
        borderRadius: size * 0.6,
        background: "rgba(16,19,32,0.82)",
        border: `1px solid ${ACCENT}${focus ? "cc" : "44"}`,
        boxShadow: `0 30px 80px rgba(0,0,0,.45), 0 0 ${size * (focus ? 1.2 : 0.2) * p}px ${ACCENT}88`,
        transform: `scale(${focus ? 1 + 0.05 * p : 1})`,
        opacity: focus || p < 0.5 ? 1 : 0.85,
      }}
    >
      <div style={{ opacity: 0.4 + 0.6 * p }}>
        <Chip icon={icon} size={size * 1.7} />
      </div>
      <div style={{ position: "relative", flex: 1, height: size * 1.3, overflow: "hidden" }}>
        {/* Placeholder bar until the phrase is spoken. */}
        <div style={{ position: "absolute", top: "35%", height: "30%", width: "80%", borderRadius: 99, background: "rgba(255,255,255,0.12)", opacity: 1 - p }} />
        <div
          style={{
            color: FG,
            fontFamily: FONT,
            fontSize: size,
            fontWeight: 700,
            whiteSpace: "nowrap",
            transform: `translateY(${(1 - p) * 110}%)`,
            filter: `blur(${(1 - p) * 6}px)`,
            opacity: p,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

// Each short on-screen phrase becomes a card that arrives exactly as the
// narration says it; the camera moves to each one, then pulls back to show
// them together.
function FeatureScene({ scene, lines }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const phrases = lines.slice(0, 3);
  const at = lineFrames(phrases, scene.spoken, fps, span);
  const slots = FEATURE_SLOTS[phrases.length - 1] ?? FEATURE_SLOTS[0];
  const current = at.filter((f) => frame >= f).length - 1;
  const allIn = frame >= (at.at(-1) ?? 0) + 18;
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      {phrases.map((line, i) => (
        <CameraLayer key={i} depth={1.12 + 0.12 * i} zoom={0.75}>
          <Obj x={slots[i][0]} y={slots[i][1]} at={6 + i * 6} from={i % 2 ? "right" : "left"} float={0.6} seed={i}>
            <FeatureCard text={line} icon={FEATURE_ICONS[i]} size={base * 0.062} fillAt={at[i]} focus={i === current && !allIn} />
          </Obj>
        </CameraLayer>
      ))}
    </AbsoluteFill>
  );
}

// Beats of a scene that turns input into a result: input card flies into the
// processing core, particles stream in while progress advances, then the core
// bursts into a result card (which the camera flies through into the next scene).
function processBeats(scene: SyncedView, fps: number, span: number) {
  const P = actionFrames(scene, "processing", fps)?.[0] ?? 14;
  const R = actionFrames(scene, "reveal", fps)?.[0] ?? Math.max(P + fps * 1.5, Math.round(span * 0.6));
  return { P: Math.max(P, 8), R: Math.max(R, P + 18) };
}
const CORE: Point = [50, 56];

function ProcessingScene({ scene, lines, prevKind, prevTyped }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const { P, R } = processBeats(scene, fps, span);
  const progress = interpolate(frame, [P, R], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const reveal = spring({ frame: frame - R, fps, config: { damping: 14 } });
  // In the transition tail the result card rushes toward the camera.
  const through = Easing.in(Easing.cubic)(interpolate(frame, [span, span + TRANSITION_FRAMES], [0, 1], clamp));
  // Shared element: the input typed in the previous app scene arrives large
  // where the camera left it, then travels into the core and is absorbed.
  const handoff = prevKind === "product" && !!prevTyped;
  const arrive = Math.max(P + 2, 32);
  const h = Easing.inOut(Easing.cubic)(interpolate(frame, [TRANSITION_FRAMES - 2, arrive], [0, 1], clamp));
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <CameraLayer depth={1.1} zoom={0.95}>
        <Particles n={22} seed={11} size={base * 0.008} into={{ x: CORE[0], y: CORE[1], from: P, to: R }} color={ACCENT_2} />
        <Obj x={27} y={60} at={R + 6} from="left" float={0.8} seed={2} style={{ transform: "translate(-50%,-50%) rotate(-7deg)" }}>
          <SkeletonCard w={base * 0.22} variant="panel" fill={reveal} />
        </Obj>
        <Obj x={73} y={60} at={R + 10} from="right" float={0.8} seed={3} style={{ transform: "translate(-50%,-50%) rotate(7deg)" }}>
          <SkeletonCard w={base * 0.22} variant="doc" fill={reveal} />
        </Obj>
      </CameraLayer>
      <CameraLayer depth={DEPTH.mid} zoom={0.8}>
        {handoff ? (
          <div
            style={{
              position: "absolute",
              left: `${54 + (CORE[0] - 54) * h}%`,
              top: `${38 + (CORE[1] - 38) * h}%`,
              transform: `translate(-50%, -50%) scale(${1 - 0.75 * h})`,
              opacity: interpolate(frame, [arrive - 6, arrive + 2], [1, 0], clamp),
              filter: `blur(${h > 0.8 ? (h - 0.8) * 20 : 0}px)`,
            }}
          >
            <TextCard text={prevTyped!} size={base * 0.06} w={width * 0.52} glow={1 - h} />
          </div>
        ) : (
          /* Input card enters, then is pulled into the core. */
          <Obj x={24} y={CORE[1]} at={Math.max(4, P - 16)} from="left" exitAt={P + 4} exitTo="right" seed={1}>
            <SkeletonCard w={base * 0.24} variant="doc" fill={interpolate(frame, [P - 16, P], [0.3, 1], clamp)} />
          </Obj>
        )}
        <Obj x={CORE[0]} y={CORE[1]} at={P - 6} from="depth" exitAt={R - 3} exitTo="depth" float={0.5}>
          <Core size={base * 0.26} progress={progress} frame={frame} />
        </Obj>
        <Burst x={CORE[0]} y={CORE[1]} at={R} size={base * 0.5} />
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + through * 2.4})`, transformOrigin: `${CORE[0]}% ${CORE[1]}%` }}>
          <Obj x={CORE[0]} y={CORE[1]} at={R} from="depth" float={0.6}>
            <SkeletonCard w={base * 0.34} variant="result" fill={reveal} glow={reveal * (1 - through)} />
          </Obj>
        </div>
      </CameraLayer>
      <CameraLayer depth={DEPTH.text} zoom={0.4}>
        <AbsoluteFill style={{ ...inset, top: height * 0.08, height: height * 0.24, justifyContent: "center", padding: "0 10%" }}>
          <Headline scene={scene} lines={lines} scale={0.7} />
        </AbsoluteFill>
      </CameraLayer>
    </AbsoluteFill>
  );
}

// Closing scene: the result settles among other cards at different depths,
// the camera pulls back to reveal them, and the call-to-action enters.
function ResultScene({ scene, lines, isFinal }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const success = actionFrames(scene, "success", fps);
  const check = success ? spring({ frame: frame - success[0], fps, config: { damping: 10 } }) : 0;
  const ctaAt = Math.round(span * 0.42);
  const cta = isFinal ? spring({ frame: frame - ctaAt, fps, config: { damping: 12 } }) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 8);
  const fill = interpolate(frame, [6, 30], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      {/* Finished results fanned out behind the main one, each on its own depth. */}
      <CameraLayer depth={1.05} zoom={0.9}>
        <Obj x={31} y={47} at={16} from="depth" float={0.8} seed={4} style={{ transform: "translate(-50%,-50%) rotate(-12deg)" }}>
          <SkeletonCard w={base * 0.22} variant="result" fill={fill} />
        </Obj>
        <Obj x={69} y={47} at={20} from="depth" float={0.8} seed={5} style={{ transform: "translate(-50%,-50%) rotate(12deg)" }}>
          <SkeletonCard w={base * 0.22} variant="result" fill={fill} />
        </Obj>
      </CameraLayer>
      <CameraLayer depth={1.18} zoom={0.9}>
        <Obj x={18} y={36} at={24} from="left" float={1.4} seed={9}>
          <Chip icon="layers" size={base * 0.08} />
        </Obj>
        <Obj x={82} y={62} at={28} from="right" float={1.4} seed={10}>
          <Chip icon="sparkle" size={base * 0.08} tint={ACCENT_2} />
        </Obj>
      </CameraLayer>
      <CameraLayer depth={DEPTH.mid} zoom={0.8}>
        <Obj x={50} y={50} at={4} from="depth" float={0.6} seed={6}>
          <SkeletonCard w={base * 0.32} variant="result" fill={fill} check={check} glow={0.4 + 0.3 * check} />
        </Obj>
      </CameraLayer>
      <CameraLayer depth={DEPTH.text} zoom={0.4}>
        <AbsoluteFill style={{ ...inset, top: height * 0.06, height: height * 0.22, justifyContent: "center", padding: "0 10%" }}>
          <Headline scene={scene} lines={lines} scale={0.7} />
        </AbsoluteFill>
        <AbsoluteFill style={{ ...inset, top: height * 0.72, height: height * 0.1, alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              width: base * 0.3,
              height: base * 0.08,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
              boxShadow: `0 0 ${base * (0.03 + pulse * 0.03)}px ${ACCENT_2}aa`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: base * 0.04,
              opacity: Math.min(1, cta * 1.5),
              transform: `translateY(${(1 - cta) * 30}px) scale(${0.8 + 0.2 * cta})`,
            }}
          >
            →
          </div>
        </AbsoluteFill>
      </CameraLayer>
      {success && <Foreground seed={8} chip="check" at={success[0] + 4} />}
    </AbsoluteFill>
  );
}

// ui / screenshot: real screenshot in a tilted frame, or the animated app mockup.
function ProductScene({ scene, lines, typed }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const rise = spring({ frame: frame - 4, fps, config: { damping: 18, mass: 0.9 } });
  const tilt = interpolate(frame, [0, span], [8, 2], clamp);
  const screenshot = scene.assetKind === "screenshot" ? scene.assetUrl : undefined;
  // Inside the window the screenshot scrolls gently: a second, independent move.
  const scroll = interpolate(frame, [0, span], [0, -6], clamp);
  const beats = mockupBeats(scene, fps, span, graphemes(typed).length);

  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <CameraLayer depth={DEPTH.subject} zoom={0.7}>
        <AbsoluteFill
          style={{
            ...inset,
            top: height * WINDOW.top,
            bottom: height * WINDOW.bottom,
            left: `${WINDOW.left * 100}%`,
            right: `${WINDOW.left * 100}%`,
            perspective: 1600,
          }}
        >
          <div
            style={{
              ...glass,
              width: "100%",
              height: "100%",
              borderRadius: base * 0.025,
              overflow: "hidden",
              transform: `translateY(${(1 - rise) * 25}%) rotateX(${tilt}deg) scale(${0.94 + rise * 0.06})`,
              opacity: rise,
            }}
          >
            {screenshot ? (
              <Img
                src={screenshot}
                style={{
                  width: "100%",
                  height: "112%",
                  objectFit: "cover",
                  objectPosition: "top",
                  transform: `translateY(${scroll}%)`,
                }}
              />
            ) : (
              <AppMockup scene={scene} typed={typed} />
            )}
          </div>
        </AbsoluteFill>
        {/* A completion badge pops off the window once results are in. */}
        {!screenshot && beats.full && (
          <Obj x={88} y={14} at={beats.progEnd + 4} from="depth" float={1.2}>
            <Chip icon="check" size={base * 0.09} tint="#34d399" />
          </Obj>
        )}
      </CameraLayer>
      <CameraLayer depth={DEPTH.text} zoom={0.35}>
        <AbsoluteFill style={{ ...inset, top: height * 0.72, bottom: height * 0.1, justifyContent: "center" }}>
          <Headline scene={scene} lines={lines} scale={0.55} />
        </AbsoluteFill>
      </CameraLayer>
    </AbsoluteFill>
  );
}

// Frame window of the scene's first action of `kind`, if the storyboard timed one.
function actionFrames(scene: SyncedView, kind: TimedAction["action"], fps: number) {
  const a = scene.timedActions?.find((x) => x.action === kind);
  return a && ([Math.round(a.at * fps), Math.round(a.until * fps)] as const);
}

// Cursor travel with a little anticipation and overshoot.
const TRANSITION_IN = 10;
const travel = Easing.inOut(Easing.back(0.9));
type Point = [number, number];

function cursorAt(frame: number, keys: { f: number; to: Point }[], start: Point): Point {
  let pos = start;
  for (let i = 0; i < keys.length; i++) {
    const { f, to } = keys[i];
    const from = i === 0 ? start : keys[i - 1].to;
    // First move starts once the scene has transitioned in, when there is time.
    const begin = i === 0 ? Math.min(Math.max(TRANSITION_IN, f - 20), f - 13) : Math.max(keys[i - 1].f + 6, f - 20);
    if (frame < begin) return pos;
    const p = travel(interpolate(frame, [begin, Math.max(f - 5, begin + 1)], [0, 1], clamp));
    pos = [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p];
  }
  return pos;
}

// Beats of the app-mockup interaction, shared by the UI and the camera. Typing
// runs at a readable pace (it may continue into the transition). Short scenes
// get the simple version (cursor enters, clicks the input, types) instead of a
// rushed click → processing → result sequence.
function mockupBeats(scene: SyncedView, fps: number, span: number, typedLength: number) {
  const typing = actionFrames(scene, "typing", fps);
  const T = typing ? typing[0] : Math.round(fps * 0.9);
  const typeEnd = T + Math.max(10, Math.min(typedLength * 2.5, fps * 2.4));
  const proc = actionFrames(scene, "processing", fps);
  const clickAct = actionFrames(scene, "click", fps);
  const clickButton = clickAct?.[0] ?? proc?.[0] ?? Math.round(typeEnd + fps * 0.5);
  const full = !!clickAct || !!proc || clickButton + fps * 1.2 <= span;
  const progEnd = Math.max(proc ? proc[1] : Math.min(span - 6, clickButton + fps * 1.2), clickButton + 12);
  return { T, clickInput: T - 3, typeEnd, clickButton, progEnd, full };
}

// Generic editor-style window with a scripted interaction: the cursor glides
// in, clicks the input, the scene's line types in, the cursor moves to the
// generate button, hovers, clicks, the progress bar runs and results pop in.
// Timed from the narration's typing / click / processing moments when present.
// Illustrative only: no product claims, no invented labels.
function AppMockup({ scene, typed }: { scene: SyncedView; typed: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const span = useSceneSpan();
  const base = Math.min(width, height);
  const text = graphemes(typed);

  const { T, clickInput, typeEnd, clickButton, progEnd, full } = mockupBeats(scene, fps, span, text.length);

  const shown = Math.floor(interpolate(frame, [T, typeEnd], [0, text.length], clamp));
  const progress = full ? interpolate(frame, [clickButton + 3, Math.max(progEnd, clickButton + 4)], [0, 1], clamp) : 0;
  const focused = frame >= clickInput;
  const hover = full && frame >= clickButton - 7 && frame < clickButton;
  const press = full ? interpolate(frame - clickButton, [0, 3, 8], [1, 0.9, 1], clamp) : 1;
  const done = full && frame >= progEnd;

  // Cursor keyframes in % of the window: input, button, then drifts aside.
  const INPUT: Point = [30, 26];
  const BUTTON: Point = [93, 91];
  const keys = full
    ? [
        { f: clickInput, to: INPUT },
        { f: clickButton, to: BUTTON },
        { f: clickButton + 28, to: [78, 70] as Point },
      ]
    : [
        { f: clickInput, to: INPUT },
        // Moves aside while the text types, out of the way of the reader.
        { f: clickInput + 26, to: [46, 58] as Point },
      ];
  const [cx, cy] = cursorAt(frame, keys, [112, 118]);
  const clicks = full ? [clickInput, clickButton] : [clickInput];
  const lastClick = clicks.filter((c) => frame >= c).at(-1);
  const tap = clicks.reduce((s, c) => s * interpolate(frame - c, [0, 3, 7], [1, 0.8, 1], clamp), 1);
  const ripple = lastClick === undefined ? 1 : interpolate(frame - lastClick, [0, 14], [0, 1], clamp);

  const pad = base * 0.025;
  const bar = (w: string, delay: number, color = "rgba(255,255,255,0.14)") => {
    const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
    return (
      <div style={{ height: base * 0.014, width: w, borderRadius: 99, background: color, transform: `scaleX(${p})`, transformOrigin: "left" }} />
    );
  };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "rgba(10,12,22,0.72)" }}>
      <div style={{ display: "flex", gap: base * 0.01, padding: pad, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: base * 0.014, height: base * 0.014, borderRadius: 99, background: c }} />
        ))}
      </div>
      <div style={{ display: "flex", flex: 1, gap: pad, padding: pad }}>
        <div style={{ width: "22%", display: "flex", flexDirection: "column", gap: pad * 0.8 }}>
          {bar("80%", 6)}
          {bar("60%", 9)}
          {bar("70%", 12)}
          {bar("50%", 15)}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: pad }}>
          <div
            style={{
              flex: 1,
              borderRadius: base * 0.015,
              border: `1px solid ${focused ? ACCENT : `${ACCENT}44`}`,
              // Input expands slightly as it takes focus (empty → focused → filled).
              transform: `scale(${1 + 0.02 * spring({ frame: frame - clickInput, fps, config: { damping: 14 } })})`,
              transformOrigin: "left top",
              boxShadow: focused ? `0 0 0 ${base * 0.004}px ${ACCENT}44, 0 0 30px ${ACCENT}33` : "none",
              background: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
              padding: pad,
              color: FG,
              fontFamily: FONT,
              fontSize: base * 0.03,
              lineHeight: 1.4,
            }}
          >
            {text.slice(0, shown).join("")}
            {focused && <span style={{ opacity: Math.floor(frame / 12) % 2 ? 0 : 1, color: ACCENT }}>▍</span>}
          </div>
          <div style={{ display: "flex", gap: pad * 0.6 }}>
            {[0, 1, 2, 3, 4].map((i) => {
              // Placeholder tiles until processing finishes, then results pop in.
              const p = done ? spring({ frame: frame - progEnd - i * 3, fps, config: { damping: 12 } }) : 0;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: "16 / 9",
                    borderRadius: base * 0.01,
                    background: `linear-gradient(135deg, ${ACCENT}${i % 2 ? "55" : "33"}, ${ACCENT_2}44)`,
                    opacity: 0.25 + 0.75 * p,
                    transform: `scale(${0.9 + 0.1 * p})`,
                    boxShadow: p > 0.5 ? `0 0 24px ${ACCENT}55` : "none",
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: pad }}>
            <div style={{ flex: 1, height: base * 0.012, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})` }} />
            </div>
            <div
              style={{
                width: base * 0.1,
                height: base * 0.045,
                borderRadius: 99,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: base * 0.024,
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
                filter: `brightness(${hover ? 1.25 : 1})`,
                boxShadow: hover || (progress > 0 && !done) ? `0 0 28px ${ACCENT_2}` : "none",
                transform: `scale(${(hover ? 1.06 : 1) * press})`,
              }}
            >
              {done ? "✓" : progress > 0 ? (
                <span style={{ display: "inline-block", transform: `rotate(${frame * 14}deg)` }}>◌</span>
              ) : (
                "✦"
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Click ripple + cursor */}
      <div
        style={{
          position: "absolute",
          left: `${cx}%`,
          top: `${cy}%`,
          width: base * 0.07,
          height: base * 0.07,
          marginLeft: -base * 0.035,
          marginTop: -base * 0.035,
          borderRadius: "50%",
          border: `2px solid ${ACCENT}`,
          opacity: (1 - ripple) * 0.8,
          transform: `scale(${0.3 + ripple})`,
        }}
      />
      <svg
        width={base * 0.04}
        height={base * 0.04}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: `${cx}%`,
          top: `${cy}%`,
          transform: `scale(${tap})`,
          transformOrigin: "top left",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,.5))",
        }}
      >
        <path d="M3 2l17 9.5-7.2 1.8L9.5 21z" fill={FG} stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// icon: generated icon large in a glass card, with text chips orbiting in.
function IconScene({ scene, lines }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const pop = spring({ frame: frame - 4, fps, config: { damping: 12 } });
  const float = Math.sin(frame / 18) * base * 0.01;
  const size = base * 0.3;
  const chips = lines.slice(0, 3);
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <CameraLayer depth={DEPTH.subject} zoom={0.8}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: height * 0.22 }}>
          <div
            style={{
              ...glass,
              width: size,
              height: size,
              borderRadius: size * 0.22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${float}px) scale(${pop}) rotate(${(1 - pop) * -8}deg)`,
            }}
          >
            {scene.assetUrl ? (
              <Img src={scene.assetUrl} style={{ width: "72%", height: "72%", objectFit: "contain" }} />
            ) : (
              <div style={{ width: "45%", height: "45%", borderRadius: "50%", border: `6px solid ${ACCENT}` }} />
            )}
          </div>
        </AbsoluteFill>
      </CameraLayer>
      <CameraLayer depth={DEPTH.text} zoom={0.4}>
        <AbsoluteFill style={{ ...inset, top: height * 0.62, bottom: height * 0.12, justifyContent: "center", alignItems: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: base * 0.015, padding: "0 6%" }}>
            {chips.map((c, i) => {
              const p = spring({ frame: frame - 12 - i * 6, fps, config: { damping: 18 } });
              return (
                <div
                  key={i}
                  style={{
                    ...glass,
                    padding: `${base * 0.012}px ${base * 0.028}px`,
                    borderRadius: 999,
                    color: FG,
                    fontFamily: FONT,
                    fontWeight: i === 0 ? 700 : 500,
                    fontSize: base * (i === 0 ? 0.045 : 0.032),
                    opacity: p,
                    filter: `blur(${(1 - p) * 6}px)`,
                    transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})`,
                  }}
                >
                  {c}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      </CameraLayer>
    </AbsoluteFill>
  );
}

// Compositions: kinetic intro, script input (app), AI processing, feature
// showcase, icon, and the closing result + CTA.
export type Kind = "product" | "processing" | "result" | "feature" | "icon" | "kinetic" | "blueprint";

// Composition chosen from what the storyboard (AI) decided for the scene: its
// visual type, its timed actions and its on-screen phrases.
export function sceneKind(scene: SyncedView, isFinal?: boolean): Kind {
  const has = (k: TimedAction["action"]) => scene.timedActions?.some((a) => a.action === k);
  // A scene with a visual blueprint is composed only from that blueprint.
  if (scene.visual_plan) return "blueprint";
  if (scene.visual === "ui" || scene.visual === "screenshot") return "product";
  if (isFinal) return "result";
  if (has("processing") || has("reveal")) return "processing";
  if (scene.on_screen_text.length >= 2 && !has("typing")) return "feature";
  if (scene.visual === "icon") return "icon";
  return "kinetic";
}

// The transition a scene leaves with, continuing its focal object: processing
// flies through its result card, the app scene pushes through its input into
// processing (where the input reappears), otherwise the storyboard's choice.
export function exitTransition(scene: SyncedView, isFinal?: boolean, next?: Kind) {
  const kind = sceneKind(scene, isFinal);
  if (kind === "processing") return "zoom through";
  if (kind === "product" && next === "processing") return "zoom through";
  // Blueprint scenes use the blueprint's own transition ("continue"/"cut" keep
  // the shared objects in place with a plain dissolve; never through black).
  if (kind === "blueprint") {
    const t = scene.visual_plan?.transition;
    return t === "zoom_through" ? "zoom through" : t === "slide" ? "slide left" : "dissolve";
  }
  return scene.transition ?? "fade";
}

// Short phrase the UI types: the scene's first on-screen line, else the start
// of the narration (never the full narration).
export function typedPhrase(scene: RenderScene) {
  return scene.on_screen_text[0] || scene.narration.split(/\s+/).slice(0, 6).join(" ");
}

const COMPOSITIONS: Record<Kind, React.ComponentType<VisualProps>> = {
  product: ProductScene,
  processing: ProcessingScene,
  result: ResultScene,
  feature: FeatureScene,
  blueprint: () => null, // rendered by BlueprintScene with its resolved blueprint
  icon: IconScene,
  kinetic: KineticScene,
};

// Camera choreography per composition: starts slightly close (the scene
// emerges from the transition), opens wide as objects enter, follows the
// action to its focal point, and keeps pushing into the transition tail.
function choreography(kind: Kind, scene: SyncedView, fps: number, span: number, typedLength: number, index: number, prevKind?: Kind, resolved?: ResolvedScene | null): CameraKey[] {
  const end = span + TRANSITION_FRAMES;
  const side = index % 2 ? -1 : 1;
  const k = (f: number, p: CameraKey["pose"]) => ({ f: Math.round(f), pose: p });
  const push = (p: CameraKey["pose"], by: number) => ({ ...p, scale: p.scale + by });
  if (kind === "product") {
    const mockup = !(scene.assetKind === "screenshot" && scene.assetUrl);
    if (!mockup) return orderKeys([k(0, pose(1.1, 0, 2)), k(16, pose(1, 0, 0)), k(span * 0.5, focusOn(0, -10, 1.14, 1.3, 0.45, -1)), k(span, focusOn(0, -10, 1.2, 1.3, 0.45, 1)), k(end, focusOn(0, -10, 1.45))]);
    const b = mockupBeats(scene, fps, span, typedLength);
    // Frame offsets (%) of the input box, the button and the results row.
    const input = focusOn(8, -21, 1.22);
    const keys = [k(0, pose(1.1, 0, 3)), k(14, pose(1, 0, 0)), k(b.clickInput - 10, input), k(b.typeEnd, push(input, 0.05))];
    if (b.full) keys.push(k(b.clickButton - 6, focusOn(35, 14, 1.2)), k(b.progEnd, focusOn(8, 2, 1.08)), k(span, focusOn(8, 2, 1.12)));
    keys.push(k(end, push(keys[keys.length - 1].pose, 0.25)));
    return orderKeys(keys);
  }
  if (kind === "processing") {
    const { P, R } = processBeats(scene, fps, span);
    const core = (s: number) => focusOn(CORE[0] - 50, CORE[1] - 50, s);
    const handoff = prevKind === "product";
    return orderKeys([
      // After the app scene: start close on the carried-over input, then follow it down into the core.
      ...(handoff ? [k(0, focusOn(4, -12, 1.18)), k(Math.max(P + 2, 22), focusOn(0, 6, 1.1))] : [k(0, pose(1.12, 6, 0)), k(P - 8, pose(1, 6, 0))]), // wide, looking toward the incoming input card
      k(P + 16, core(1.12)), // follows it into the core
      k(R - 4, core(1.26)), // pushes in while it processes
      k(R + 14, core(1.12)), // eases back as the result appears
      k(span, core(1.18)),
      k(end, core(1.55)), // flies into the result card
    ]);
  }
  if (kind === "result") {
    return orderKeys([k(0, pose(1.32, 0, -2)), k(14, pose(1.3, 0, -2)), k(span * 0.5, pose(1.02, 0, 0)), k(span, pose(1, 0, 0))]);
  }
  if (kind === "blueprint" && resolved) {
    // The blueprint's camera: from its start framing to its end framing.
    const cam = (c: ResolvedScene["camera"]["from"]) => pose(c.scale, c.x / DEPTH.subject, c.y / DEPTH.subject, c.rot);
    return orderKeys([k(0, cam(resolved.camera.from)), k(span, cam(resolved.camera.to)), k(end, cam({ ...resolved.camera.to, scale: resolved.camera.to.scale + 0.03 }))]);
  }
  if (kind === "feature") {
    // Visit each phrase card as it is spoken, then pull back to show them together.
    const phrases = scene.on_screen_text.slice(0, 3);
    const at = lineFrames(phrases, scene.spoken, fps, span);
    const slots = FEATURE_SLOTS[phrases.length - 1] ?? FEATURE_SLOTS[0];
    const visits = at.map((f, i) => k(f + 4, focusOn(slots[i][0] - 50, slots[i][1] - 50, 1.16, 1.12 + 0.12 * i, 0.4)));
    const last = (at.at(-1) ?? 0) + 22;
    return orderKeys([k(0, pose(1.12, 0, 0)), k(Math.min(20, at[0] - 6), pose(1.02, 0, 0)), ...visits, k(last, pose(1.02, 0, 0)), k(span, pose(1.06, 0, 0)), k(end, pose(1.4, 0, 0))]);
  }
  if (kind === "icon") {
    return orderKeys([k(0, pose(1.1, 0, 0, -2 * side)), k(16, pose(1, 2 * side, 0, -1.5 * side)), k(span, pose(1.16, -2 * side, -1, 1.5 * side)), k(end, pose(1.4, -2 * side, -1, 2 * side))]);
  }
  const hl = actionFrames(scene, "highlight", fps);
  const beat = hl ? hl[0] - 6 : span * 0.5;
  return orderKeys([
    k(0, pose(1.12, 2 * side, 0)),
    k(16, pose(1, 3 * side, 1, -0.6 * side)),
    k(beat, focusOn(0, -4, 1.12, 1.45, 0.45, 0.4 * side)), // settles on the headline as the key phrase is heard
    k(span, pose(1.18, -2 * side, -1, 0.8 * side)),
    k(end, pose(1.45, -2 * side, -1, 1 * side)),
  ]);
}

// Overlays (action cards) are not moved by the camera and leave quickly
// once the next scene starts covering this one.
function Hud({ span, children }: { span: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [span, span + 5], [1, 0], clamp) }}>{children}</AbsoluteFill>;
}

export function SceneView({
  scene,
  index,
  span,
  isFinal,
  prevTransition,
  prevKind,
  nextKind,
  prevTyped,
  resolved,
}: {
  scene: SyncedView;
  index: number;
  resolved?: ResolvedScene | null;
  // Neighbouring compositions, so focal objects and transitions can continue.
  prevKind?: Kind;
  nextKind?: Kind;
  prevTyped?: string;
  // The scene's own length; the Sequence runs a transition longer as it
  // stays under the next scene while that one transitions in.
  span: number;
  isFinal?: boolean;
  // The previous scene's transition plays its "in" half here.
  prevTransition?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kind = sceneKind(scene, isFinal);
  const Visual = COMPOSITIONS[kind];
  const product = kind === "product";
  const mockup = product && !(scene.assetKind === "screenshot" && scene.assetUrl);
  const actions = scene.timedActions ?? [];
  const has = (kind: TimedAction["action"]) => actions.some((a) => a.action === kind);

  // Only short on-screen phrases are shown (no narration subtitles), each once:
  // a line typed by the mockup or an action card is dropped from the headline.
  const typedHere = mockup || has("typing");
  const lines = typedHere ? scene.on_screen_text.slice(1) : scene.on_screen_text;
  const typedLine = typedPhrase(scene);
  const headlineShown = kind !== "icon" && kind !== "feature" && lines.length > 0;
  // Actions the composition itself performs are not repeated as overlay cards.
  const handled: Partial<Record<Kind, TimedAction["action"][]>> = {
    processing: ["processing", "reveal"],
    result: ["success", "reveal"],
  };
  // Blueprint scenes: every visible thing comes from the blueprint's objects.
  const overlay = kind === "blueprint" ? [] : actions.filter(
    (a) =>
      !(mockup && (a.action === "typing" || a.action === "processing" || a.action === "click")) &&
      !handled[kind]?.includes(a.action) &&
      !(headlineShown && a.action === "highlight"),
  );

  const edge = sceneEdgeStyle(
    frame,
    span,
    prevTransition === undefined ? null : transitionFor(prevTransition),
    isFinal ? null : transitionFor(exitTransition(scene, isFinal, nextKind)),
  );
  // Only the very start and end of the video touch black; every cut between
  // scenes blends two live scenes.
  const opacity =
    prevTransition === undefined
      ? interpolate(frame, [0, 8], [0, 1], clamp)
      : isFinal
        ? interpolate(frame, [span - 10, span], [1, 0], clamp)
        : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ ...edge, overflow: "hidden" }}>
        <CameraProvider value={{ keys: choreography(kind, scene, fps, span, graphemes(typedLine).length, index, prevKind, resolved), frame, span }}>
          {kind === "blueprint" && resolved ? (
            <BlueprintScene scene={scene as never} resolved={resolved} />
          ) : (
            <Visual scene={scene} isFinal={isFinal} lines={lines} typed={typedLine} prevKind={prevKind} prevTyped={prevTyped} />
          )}
          <Hud span={span}>
            <ActionLayer actions={overlay} text={typedLine} placement={product ? "center" : "lower"} />
          </Hud>
        </CameraProvider>
      </AbsoluteFill>
      {/* SFX keep the scene's own length, exactly as before the overlap. */}
      <Sequence durationInFrames={span} layout="none">
        <SceneSfx cues={scene.sound_effects ?? []} />
      </Sequence>
    </AbsoluteFill>
  );
}

