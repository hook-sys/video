import { Lottie } from "@remotion/lottie";
import { Sequence } from "remotion";
import { setLivingDraw } from "./living";
import { LIVING_DATA } from "./living-data";

// The living icons drawn (living.tsx): Lottie from the scene's frame on — in the player and the renderer only
function LivingPlay({ name, size, at }: { name: string; size: number; at: number }) {
  const data = LIVING_DATA[name];
  if (!data) return <div style={{ width: size, height: size }} />;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <Sequence from={at} layout="none">
        <Lottie animationData={data} loop={false} style={{ width: size, height: size }} />
      </Sequence>
    </div>
  );
}
setLivingDraw((p) => <LivingPlay {...p} />);
