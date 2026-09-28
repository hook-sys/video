import { useMemo } from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { WordTiming } from "@/lib/voice-timing";
import { compileStory } from "./compiler";
import { normalizeStory } from "./normalize";
import { reveal, ramp, sec } from "./motion-patterns";
import { FONT, INDIGO, INK, ObjectView } from "./objects";
import { evaluateCamera, evaluatePose, evaluateState, type RenderTimeline } from "./timeline";
import { CameraSpace, WorldBackdrop } from "./world";

// StoryWorld: the generic continuous renderer. One world, one camera path,
// every object mounted once for the whole video; it only plays a compiled
// RenderTimeline.

export type StoryWorldProps = {
  story: unknown; // raw VisualStory (normalized + compiled here)
  narration: string;
  durationSeconds: number;
  words?: WordTiming[] | null;
  audioUrl?: string;
  title?: string;
  assets?: Record<string, string> | null; // generated visuals: continuity_id → image URL
};

export { STORY_WORLD_ID } from "../types";
const SFX_VOLUME = 0.25;

export function useTimeline({ story, narration, durationSeconds, words, title, assets }: StoryWorldProps) {
  return useMemo(() => {
    const n = normalizeStory(story, title);
    const tl = compileStory({ story: n.story, narration, durationSeconds, words, assets });
    return { ...tl, issues: [...n.issues, ...tl.issues] };
  }, [story, narration, durationSeconds, words, title, assets]);
}

export function StoryWorld(props: StoryWorldProps) {
  const tl = useTimeline(props);
  return <TimelinePlayer tl={tl} audioUrl={props.audioUrl} />;
}

function TextLayer({ tl, frame }: { tl: RenderTimeline; frame: number }) {
  const closing = tl.text.filter((t) => t.role === "closing");
  const support = tl.text.filter((t) => t.role === "support");
  const dark = tl.textTone === "dark";
  const current = [...support].reverse().find((t) => t.frame <= frame);
  const next = current ? support[support.indexOf(current) + 1] : undefined;
  return (
    <>
      {closing.length > 0 && (
        <AbsoluteFill style={{ left: 130, top: 330, width: 640, height: "auto" }}>
          {closing.map((t) => {
            const k = reveal(frame, t.frame, sec(0.55));
            return (
              <div key={t.line} style={{ overflow: "hidden", paddingBottom: 12 }}>
                <div style={{ fontFamily: FONT, fontSize: 104, fontWeight: 850, letterSpacing: -3.6, lineHeight: 1.05, color: t.line === closing.length - 1 && closing.length > 1 ? INDIGO : dark ? INK : "#fff", transform: `translateY(${(1 - k) * 105}%)`, opacity: k > 0 ? 1 : 0 }}>{t.content}</div>
              </div>
            );
          })}
          <div style={{ marginTop: 26, height: 8, width: 220 * reveal(frame, closing[closing.length - 1].frame + sec(0.35), sec(0.6)), borderRadius: 4, background: "linear-gradient(90deg, #5b6cff, #22c55e)" }} />
        </AbsoluteFill>
      )}
      {current && (!next || frame < next.frame) && (
        <AbsoluteFill style={{ top: "auto", bottom: 70, height: "auto", display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: FONT, fontSize: 44, fontWeight: 750, color: "#fff", padding: "14px 30px", borderRadius: 18, background: "rgba(10,12,30,0.45)", opacity: reveal(frame, current.frame, sec(0.3)) }}>{current.content}</div>
        </AbsoluteFill>
      )}
    </>
  );
}

export function TimelinePlayer({ tl, audioUrl }: { tl: RenderTimeline; audioUrl?: string }) {
  const frame = useCurrentFrame();
  const cam = evaluateCamera(tl.camera, frame, tl.fps);
  const objects = tl.objects
    .map((t) => ({ t, pose: evaluatePose(t, frame), s: evaluateState(t, frame) }))
    .filter((o) => o.pose.opacity > 0.001)
    .sort((a, b) => a.t.z - b.t.z);
  const glows = objects.filter((o) => (o.t.kind === "progress_panel" || o.t.kind === "metric") && o.s.build > 0).map((o) => ({ x: o.pose.x, y: o.pose.y, k: Math.min(1, o.s.build * 1.5) }));
  const first = tl.areas.find((a) => !a.colocated);
  const vignette = first?.kind === "chaos" ? 1 - ramp(frame, first.leave + sec(0.4), sec(1.6)) : 0.5 * (1 - ramp(frame, tl.durationInFrames - sec(3), sec(1)));
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <WorldBackdrop tl={tl} frame={frame} cam={cam} glows={glows} />
      <CameraSpace cam={cam} width={tl.width} height={tl.height}>
        {objects.map(({ t, pose, s }) => (
          <div key={t.id} style={{ position: "absolute", left: pose.x, top: pose.y, zIndex: t.z, opacity: pose.opacity, transform: `translate(-50%, -50%) rotate(${pose.rot}deg) scale(${pose.scale})` }}>
            <ObjectView t={t} s={s} lift={pose.lift} frame={frame} />
          </div>
        ))}
      </CameraSpace>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)", opacity: vignette }} />
      <TextLayer tl={tl} frame={frame} />
      {audioUrl && <Html5Audio src={audioUrl} />}
      {tl.sfx.map((c) => (
        <Sequence key={`${c.frame}-${c.kind}`} from={c.frame} layout="none">
          <Html5Audio src={staticFile(c.src)} volume={SFX_VOLUME} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
