import { AbsoluteFill, Series } from "remotion";
import { SceneView } from "./scenes";
import { sceneFrames, type StoryboardProps } from "./types";

// Remotion composition: plays storyboard scenes back to back.
export function Storyboard({ scenes }: StoryboardProps) {
  return (
    <AbsoluteFill style={{ background: "#0b0d12" }}>
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene)}>
            <SceneView scene={scene} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
