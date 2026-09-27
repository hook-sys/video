import { AbsoluteFill, Html5Audio, Series } from "remotion";
import { SceneView } from "./scenes";
import { sceneTimings, type StoryboardProps } from "./types";

// Remotion composition: plays storyboard scenes back to back with the narration.
// Audio plays at normal speed from frame 0; a shorter track simply ends, a longer
// one is cut off at the end of the composition.
export function Storyboard({ scenes, durationSeconds, audioUrl }: StoryboardProps) {
  const { frames } = sceneTimings(scenes, durationSeconds);
  return (
    <AbsoluteFill style={{ background: "#0b0d12" }}>
      {audioUrl && <Html5Audio src={audioUrl} />}
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={scene.id} durationInFrames={frames[i]}>
            <SceneView
              scene={scene}
              isFinal={i === scenes.length - 1}
              prevTransition={i > 0 ? (scenes[i - 1].transition ?? "fade") : undefined}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
