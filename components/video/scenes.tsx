import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { camera, enter, fadeInOut, motionFor } from "./animations";
import type { RenderScene } from "./types";

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

// Full-frame generated image with a slow Ken Burns move (the main visual layer).
function ImageBackground({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], clamp);
  const idx = Number(scene.id.split("-")[1] ?? 0);
  const dir = idx % 2 ? -1 : 1;
  if (!scene.backgroundUrl) return <GeometricBackground />;
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <Img
        src={scene.backgroundUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.08 + t * 0.12}) translateX(${dir * (t * 3 - 1.5)}%)`,
        }}
      />
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
    <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, #1b2340, ${BG})` }}>
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
    </AbsoluteFill>
  );
}

// Headline with a word-by-word masked reveal, plus supporting lines.
function Headline({ scene, scale = 1 }: { scene: RenderScene; scale?: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const [title = "", ...rest] = scene.on_screen_text;
  const words = title.split(/\s+/).filter(Boolean);
  const motion = motionFor(scene.animation);
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
        }}
      >
        {words.map((w, i) => {
          const p = spring({ frame: frame - 6 - i * 4, fps, config: { damping: 200 } });
          return (
            <span key={i} style={{ overflow: "hidden", display: "inline-block", paddingBottom: "0.08em" }}>
              <span
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - p) * 100}%)`,
                  opacity: p,
                }}
              >
                {w}
              </span>
            </span>
          );
        })}
      </div>
      {rest.map((line, i) => (
        <div
          key={i}
          style={{
            ...enter(motion, frame, fps, 14 + words.length * 4 + i * 6),
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

// Narration shown as a caption, inside ~5% title-safe margins.
function Caption({ text }: { text: string }) {
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
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

// typography / abstract: image-led hero with animated headline.
function HeroScene({ scene, isFinal }: { scene: RenderScene; isFinal?: boolean }) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const base = Math.min(width, height);
  const cta = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 8);
  // Parallax: foreground drifts faster than the background image.
  const drift = interpolate(frame, [0, 200], [12, -12], clamp);
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
      <AbsoluteFill
        style={{
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 8%",
          paddingBottom: height * 0.08,
          transform: `translateY(${drift}px)`,
        }}
      >
        <Headline scene={scene} />
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
    </AbsoluteFill>
  );
}

// ui / screenshot: real screenshot in a tilted frame, or an animated app mockup.
function ProductScene({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height, width } = useVideoConfig();
  const base = Math.min(width, height);
  const rise = spring({ frame: frame - 4, fps, config: { damping: 18, mass: 0.9 } });
  const tilt = interpolate(frame, [0, durationInFrames], [8, 2], clamp);
  const motion = motionFor(scene.animation);
  const screenshot = scene.assetKind === "screenshot" ? scene.assetUrl : undefined;

  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
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
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
                transform: camera(motion, frame, durationInFrames),
              }}
            />
          ) : (
            <AppMockup scene={scene} />
          )}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ ...inset, top: height * 0.72, bottom: height * 0.1, justifyContent: "center" }}>
        <Headline scene={scene} scale={0.55} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Generic editor-style window: the scene's words type into an input while
// panels and a progress bar animate. Illustrative only; no product claims.
function AppMockup({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const text = scene.on_screen_text.join(" · ") || scene.narration;
  const typed = Math.floor(interpolate(frame, [8, durationInFrames * 0.6], [0, text.length], clamp));
  const progress = interpolate(frame, [durationInFrames * 0.35, durationInFrames * 0.95], [0, 1], clamp);
  const pad = base * 0.025;
  const bar = (w: string, delay: number, color = "rgba(255,255,255,0.14)") => {
    const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
    return (
      <div style={{ height: base * 0.014, width: w, borderRadius: 99, background: color, transform: `scaleX(${p})`, transformOrigin: "left" }} />
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "rgba(10,12,22,0.72)" }}>
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
              border: `1px solid ${ACCENT}66`,
              background: "rgba(255,255,255,0.04)",
              padding: pad,
              color: FG,
              fontFamily: FONT,
              fontSize: base * 0.03,
              lineHeight: 1.4,
            }}
          >
            {text.slice(0, typed)}
            <span style={{ opacity: Math.floor(frame / 12) % 2 ? 0 : 1, color: ACCENT }}>▍</span>
          </div>
          <div style={{ display: "flex", gap: pad * 0.6 }}>
            {[0, 1, 2, 3, 4].map((i) => {
              const p = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 14 } });
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: "16 / 9",
                    borderRadius: base * 0.01,
                    background: `linear-gradient(135deg, ${ACCENT}${i % 2 ? "55" : "33"}, ${ACCENT_2}44)`,
                    transform: `scale(${p})`,
                  }}
                />
              );
            })}
          </div>
          <div style={{ height: base * 0.012, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// icon: generated icon large in a glass card, with text chips orbiting in.
function IconScene({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const pop = spring({ frame: frame - 4, fps, config: { damping: 12 } });
  const float = Math.sin(frame / 18) * base * 0.01;
  const size = base * 0.3;
  const chips = scene.on_screen_text.slice(0, 3);
  return (
    <AbsoluteFill>
      <ImageBackground scene={scene} />
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
            transform: `translateY(${float}px) scale(${pop})`,
          }}
        >
          {scene.assetUrl ? (
            <Img src={scene.assetUrl} style={{ width: "72%", height: "72%", objectFit: "contain" }} />
          ) : (
            <div style={{ width: "45%", height: "45%", borderRadius: "50%", border: `6px solid ${ACCENT}` }} />
          )}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ ...inset, top: height * 0.62, bottom: height * 0.12, justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: base * 0.015, padding: "0 6%" }}>
          {chips.map((c, i) => {
            const p = spring({ frame: frame - 12 - i * 6, fps, config: { damping: 200 } });
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
                  transform: `translateY(${(1 - p) * 40}px)`,
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const VISUALS: Record<
  RenderScene["visual"],
  React.ComponentType<{ scene: RenderScene; isFinal?: boolean }>
> = {
  ui: ProductScene,
  screenshot: ProductScene,
  typography: HeroScene,
  icon: IconScene,
  abstract: HeroScene,
};

export function SceneView({ scene, isFinal }: { scene: RenderScene; isFinal?: boolean }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const Visual = VISUALS[scene.visual];
  // Entrance: blur + scale settle; exit: fade (with the scene's own motion).
  const blur = interpolate(frame, [0, 12], [14, 0], clamp);
  const scale = interpolate(frame, [0, 14], [1.04, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        background: BG,
        opacity: fadeInOut(frame, durationInFrames, 8),
        filter: `blur(${blur}px)`,
        transform: `scale(${scale})`,
      }}
    >
      <Visual scene={scene} isFinal={isFinal} />
      <Caption text={scene.narration} />
    </AbsoluteFill>
  );
}
