import { AbsoluteFill, Html5Audio, Sequence } from "remotion";
import { exitTransition, SceneView } from "./scenes";
import { syncToNarration } from "./sync";
import { TRANSITION_FRAMES } from "./transitions";
import { sceneTimings, type StoryboardProps } from "./types";

// Remotion composition: plays storyboard scenes back to back with the narration.
// Audio plays at normal speed from frame 0; a shorter track simply ends, a longer
// one is cut off at the end of the composition.
// Scene cuts, actions and their SFX follow the narration's word timing when available.
// Each scene starts exactly at its cut; all but the last run TRANSITION_FRAMES
// longer underneath the next scene so transitions blend two live scenes.
export function Storyboard({ scenes: planned, durationSeconds, audioUrl, words }: StoryboardProps) {
  const { scenes } = syncToNarration(planned, durationSeconds, words);
  const { frames } = sceneTimings(scenes, durationSeconds);
  const starts = frames.map((_, i) => frames.slice(0, i).reduce((n, f) => n + f, 0));
  return (
    <AbsoluteFill style={{ background: "#0b0d12" }}>
      {audioUrl && <Html5Audio src={audioUrl} />}
      {scenes.map((scene, i) => {
        const last = i === scenes.length - 1;
        return (
          <Sequence key={scene.id} from={starts[i]} durationInFrames={frames[i] + (last ? 0 : TRANSITION_FRAMES)}>
            <SceneView
              scene={scene}
              index={i}
              span={frames[i]}
              isFinal={last}
              prevTransition={i > 0 ? exitTransition(scenes[i - 1], false) : undefined}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
