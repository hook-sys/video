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
// (the check before playing lays scenes out by calling their parts as functions: it never steps into
// this one — Lottie uses React hooks, which may run only while React draws; in the editor that check
// runs inside a useMemo, and calling Lottie there broke the whole page)
LivingPlay.notLaidOut = true;
setLivingDraw((p) => <LivingPlay {...p} />);
