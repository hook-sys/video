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
import { CameraLayer, CameraProvider, cameraPresetFor, useSceneSpan } from "./camera";
import { SceneSfx } from "./sfx";
import { same, type SyncedScene, type TimedAction } from "./sync";
import { sceneEdgeStyle, transitionFor } from "./transitions";
import type { RenderScene } from "./types";

type SyncedView = RenderScene & Partial<Pick<SyncedScene, "timedActions" | "spoken">>;

const BG = "#0b0d12";
const FG = "#f5f7fb";
const ACCENT = "#6d8cff";
const ACCENT_2 = "#a071ff";
const FONT = "Inter, system-ui, sans-serif";
// AbsoluteFill defaults to 100% width/height; reset so top/bottom insets apply.
const inset = { width: "auto", height: "auto" } as const;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const glass = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 30px 80px rgba(0,0,0,.45)",
  backdropFilter: "blur(18px)",
} as const;

// Parallax depths: background moves 1x, the main subject and text move more.
const DEPTH = { subject: 1.3, text: 1.6 };

// Full-frame generated image on the camera's background plane.
function ImageBackground({ scene }: { scene: RenderScene }) {
  if (!scene.backgroundUrl) return <GeometricBackground />;
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <CameraLayer>
        <Img src={scene.backgroundUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.06)" }} />
      </CameraLayer>
      {/* Legibility scrim keeps text crisp over any image. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8,10,18,0.15) 0%, rgba(8,10,18,0.35) 55%, rgba(8,10,18,0.8) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

function GeometricBackground() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const shapes = [
    { x: 0.15, y: 0.25, size: 0.22, speed: 0.6, round: true },
    { x: 0.8, y: 0.7, size: 0.3, speed: -0.4, round: false },
    { x: 0.7, y: 0.15, size: 0.12, speed: 0.9, round: true },
  ];
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <CameraLayer>
        <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, #1b2340, ${BG})`, transform: "scale(1.1)" }} />
      </CameraLayer>
      {/* Shapes sit nearer the lens than the gradient: extra parallax. */}
      <CameraLayer depth={1.4}>
        {shapes.map((s, i) => {
          const d = Math.min(width, height) * s.size;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: s.x * width - d / 2,
                top: s.y * height - d / 2 + Math.sin(frame / 40 + i) * 20,
                width: d,
                height: d,
                borderRadius: s.round ? "50%" : 24,
                border: `3px solid ${ACCENT}`,
                opacity: 0.25,
                transform: `rotate(${frame * s.speed}deg)`,
              }}
            />
          );
        })}
      </CameraLayer>
    </AbsoluteFill>
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

// Headline: each word slides up out of a mask, sharpening from a blur and
// settling from 94% scale. A timed "highlight" action draws an accent underline.
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
  const [title = "", ...rest] = lines;
  const words = title.split(/\s+/).filter(Boolean);
  const at = wordFrames(words, scene.spoken, fps, span);
  const motion = motionFor(scene.animation);
  const highlight = actionFrames(scene, "highlight", fps);
  const mark = highlight ? spring({ frame: frame - highlight[0], fps, config: { damping: 16 } }) : 0;
  const pulse = highlight ? interpolate(frame - highlight[0], [0, 6, 18], [1, 1.04, 1], clamp) : 1;
  const restFrom = (at.at(-1) ?? 0) + 10;
  if (!words.length && !rest.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: base * 0.02 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `0 ${base * 0.018}px`,
          fontFamily: FONT,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          fontSize: base * 0.085 * scale,
          lineHeight: 1.05,
          color: FG,
          textShadow: "0 6px 40px rgba(0,0,0,.45)",
          transform: `scale(${pulse})`,
        }}
      >
        {words.map((w, i) => {
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

// Narration subtitle (a HUD element: not moved by the camera).
function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (!text) return null;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: `0 ${width * 0.05}px ${height * 0.05}px`,
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          background: "rgba(0,0,0,.55)",
          color: FG,
          fontFamily: FONT,
          fontSize: Math.min(width, height) * 0.032,
          lineHeight: 1.3,
          padding: "0.4em 0.8em",
          borderRadius: 8,
          textAlign: "center",
          opacity: interpolate(frame, [2, 10], [0, 1], clamp),
          transform: `translateY(${interpolate(frame, [2, 12], [12, 0], clamp)}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

// `lines`: on-screen text not already shown elsewhere; `typed`: the line the UI types.
type VisualProps = { scene: SyncedView; isFinal?: boolean; lines: string[]; typed: string };

// typography / abstract: image-led hero with animated headline.
function HeroScene({ scene, isFinal, lines }: VisualProps) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const base = Math.min(width, height);
  const cta = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 8);
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <CameraLayer depth={DEPTH.text} zoom={0.4}>
        <AbsoluteFill
          style={{
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 8%",
            paddingBottom: height * 0.08,
          }}
        >
          <Headline scene={scene} lines={lines} />
          {isFinal && (
            // Closing call-to-action: gradient button with a soft pulsing glow.
            <div
              style={{
                marginTop: base * 0.05,
                width: base * 0.34,
                height: base * 0.09,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
                boxShadow: `0 0 ${base * (0.04 + pulse * 0.04)}px ${ACCENT_2}aa`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: base * 0.04,
                transform: `scale(${cta})`,
              }}
            >
              →
            </div>
          )}
        </AbsoluteFill>
      </CameraLayer>
    </AbsoluteFill>
  );
}

// ui / screenshot: real screenshot in a tilted frame, or an animated app mockup.
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

  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <CameraLayer depth={DEPTH.subject} zoom={0.7}>
        <AbsoluteFill
          style={{
            ...inset,
            top: height * 0.07,
            bottom: height * 0.3,
            left: "9%",
            right: "9%",
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

  const typing = actionFrames(scene, "typing", fps);
  const T = typing ? typing[0] : Math.round(fps * 0.9);
  // Finish typing before the scene's end (or the next action), speeding up if needed.
  const typeEnd = Math.max(T + 6, Math.min((typing ? typing[1] : span * 0.6) - 8, T + fps * 2.4, T + text.length * 3));
  const clickInput = T - 3;
  const proc = actionFrames(scene, "processing", fps);
  const clickButton = actionFrames(scene, "click", fps)?.[0] ?? proc?.[0] ?? Math.round(typeEnd + fps * 0.4);
  // Results always follow the click (short scenes finish in the transition tail).
  const progEnd = Math.max(proc ? proc[1] : Math.min(span - 6, clickButton + fps * 1.2), clickButton + 12);

  const shown = Math.floor(interpolate(frame, [T, Math.max(typeEnd, T + 1)], [0, text.length], clamp));
  const progress = interpolate(frame, [clickButton + 3, Math.max(progEnd, clickButton + 4)], [0, 1], clamp);
  const focused = frame >= clickInput;
  const hover = frame >= clickButton - 7 && frame < clickButton;
  const press = interpolate(frame - clickButton, [0, 3, 8], [1, 0.9, 1], clamp);
  const done = frame >= progEnd;

  // Cursor keyframes in % of the window: input, button, then drifts aside.
  const INPUT: Point = [30, 26];
  const BUTTON: Point = [93, 91];
  const keys = [
    { f: clickInput, to: INPUT },
    { f: clickButton, to: BUTTON },
    { f: clickButton + 28, to: [78, 70] as Point },
  ];
  const [cx, cy] = cursorAt(frame, keys, [112, 118]);
  const clicks = [clickInput, clickButton];
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

const VISUALS: Record<RenderScene["visual"], React.ComponentType<VisualProps>> = {
  ui: ProductScene,
  screenshot: ProductScene,
  typography: HeroScene,
  icon: IconScene,
  abstract: HeroScene,
};

const sameText = (a: string, b: string) => tokenize(a).join(" ") === tokenize(b).join(" ");

// Overlays (actions, caption) are not moved by the camera and leave quickly
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
}: {
  scene: SyncedView;
  index: number;
  // The scene's own length; the Sequence runs a transition longer as it
  // stays under the next scene while that one transitions in.
  span: number;
  isFinal?: boolean;
  // The previous scene's transition plays its "in" half here.
  prevTransition?: string;
}) {
  const frame = useCurrentFrame();
  const Visual = VISUALS[scene.visual];
  const product = Visual === ProductScene;
  const mockup = product && !(scene.assetKind === "screenshot" && scene.assetUrl);
  const actions = scene.timedActions ?? [];
  const has = (kind: TimedAction["action"]) => actions.some((a) => a.action === kind);

  // Each line of on-screen text is rendered exactly once: a line typed by the
  // mockup or an action card is dropped from the headline, and the caption is
  // dropped when it would repeat on-screen text word for word.
  const typedHere = mockup || has("typing");
  const lines = typedHere ? scene.on_screen_text.slice(1) : scene.on_screen_text;
  const typedLine = scene.on_screen_text[0] || scene.narration;
  const headlineShown = Visual !== IconScene && lines.length > 0;
  const overlay = actions.filter(
    (a) =>
      !(mockup && (a.action === "typing" || a.action === "processing" || a.action === "click")) &&
      !(headlineShown && a.action === "highlight"),
  );
  const onScreen = [...scene.on_screen_text, ...(has("typing") && !scene.on_screen_text[0] ? [typedLine] : [])];
  const caption = onScreen.some((l) => sameText(l, scene.narration)) ? "" : scene.narration;

  const edge = sceneEdgeStyle(
    frame,
    span,
    prevTransition === undefined ? null : transitionFor(prevTransition),
    isFinal ? null : transitionFor(scene.transition),
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
        <CameraProvider value={{ preset: cameraPresetFor(scene.animation, index), frame, span }}>
          <Visual scene={scene} isFinal={isFinal} lines={lines} typed={typedLine} />
          <Hud span={span}>
            <ActionLayer actions={overlay} text={typedLine} placement={product ? "center" : "lower"} />
            <Caption text={caption} />
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

