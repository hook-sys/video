import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { camera, enter, fadeInOut, motionFor } from "./animations";
import type { RenderScene } from "./types";

const BG = "#0b0d12";
const FG = "#f5f7fb";
const ACCENT = "#6d8cff";
// AbsoluteFill defaults to 100% width/height; reset so top/bottom insets apply.
const inset = { width: "auto", height: "auto" } as const;

function OnScreenText({ scene, compact = false }: { scene: RenderScene; compact?: boolean }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const motion = motionFor(scene.animation);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: compact ? 0 : width * 0.07,
        gap: compact ? 8 : 16,
        textAlign: "center",
      }}
    >
      {scene.on_screen_text.map((line, i) => (
        <div
          key={i}
          style={{
            ...enter(motion, frame, fps, 6 + i * 8),
            color: FG,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: i === 0 ? 700 : 500,
            fontSize: width * (i === 0 ? 0.05 : 0.03) * (compact ? 0.7 : 1),
            lineHeight: 1.15,
          }}
        >
          {line}
        </div>
      ))}
    </AbsoluteFill>
  );
}

// Narration shown as a caption until voice sync exists.
function Caption({ text }: { text: string }) {
  const { width, height } = useVideoConfig();
  if (!text) return null;
  // Keep within the ~5% title-safe margins.
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
          fontFamily: "Inter, system-ui, sans-serif",
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

// `ui` and `screenshot`: real project screenshot with pan/zoom and optional highlight.
function ScreenshotScene({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const motion = motionFor(scene.animation);
  if (!scene.assetUrl) return <TypographyScene scene={scene} />;
  const glow = interpolate(frame, [15, 30, 45], [0, 1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: BG }}>
      <GeometricBackground />
      {/* Screenshot in the upper area; text sits on the dark band below it. */}
      <AbsoluteFill style={{ ...inset, top: height * 0.05, bottom: height * 0.3, left: "7%", right: "7%" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: 20,
            boxShadow: `0 30px 80px rgba(0,0,0,.5)${motion === "highlight" ? `, 0 0 0 ${6 * glow}px ${ACCENT}` : ""}`,
          }}
        >
          <Img
            src={scene.assetUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              transform: camera(motion, frame, durationInFrames),
            }}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ ...inset, top: height * 0.7, bottom: height * 0.1 }}>
        <OnScreenText scene={scene} compact />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function TypographyScene({ scene }: { scene: RenderScene }) {
  return (
    <AbsoluteFill>
      <GeometricBackground />
      <OnScreenText scene={scene} />
    </AbsoluteFill>
  );
}

function IconScene({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const size = width * 0.16;
  return (
    <AbsoluteFill>
      <GeometricBackground />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: "22%" }}>
        {scene.assetUrl ? (
          <Img src={scene.assetUrl} style={{ width: size, height: size, ...enter("zoom", frame, fps) }} />
        ) : (
          <div
            style={{
              width: size * 0.6,
              height: size * 0.6,
              borderRadius: "50%",
              border: `6px solid ${ACCENT}`,
              ...enter("zoom", frame, fps),
            }}
          />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ ...inset, top: "18%" }}>
        <OnScreenText scene={scene} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function AbstractScene({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: BG }}>
      {scene.assetUrl ? (
        <Img
          src={scene.assetUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.7,
            transform: camera("zoom", frame, durationInFrames),
          }}
        />
      ) : (
        <GeometricBackground />
      )}
      <OnScreenText scene={scene} />
    </AbsoluteFill>
  );
}

const VISUALS = {
  ui: ScreenshotScene,
  screenshot: ScreenshotScene,
  typography: TypographyScene,
  icon: IconScene,
  abstract: AbstractScene,
} satisfies Record<RenderScene["visual"], React.ComponentType<{ scene: RenderScene }>>;

export function SceneView({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const Visual = VISUALS[scene.visual];
  return (
    <AbsoluteFill style={{ background: BG, opacity: fadeInOut(frame, durationInFrames) }}>
      <Visual scene={scene} />
      <Caption text={scene.narration} />
    </AbsoluteFill>
  );
}
