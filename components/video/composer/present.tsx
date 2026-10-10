import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionPresentation } from "@remotion/transitions";
import type { TransitionKind } from "./types";
import { W, H } from "./types";

// Remotion's own transitions (clock wipe, wipe, flip), driven by our timing (a scene's way in is
// on the voice's words, not a TransitionSeries'): only the ones drawn with
// CSS, so the browser's download renders them the same.
type P = TransitionPresentation<Record<string, unknown>>;
const WIPES = ["from-left", "from-top-left", "from-bottom", "from-right", "from-top-right"] as const;
const FLIPS = ["from-right", "from-left", "from-bottom"] as const;
export function presentationOf(kind: TransitionKind, seed = 0): P | null {
  if (kind === "clock") return clockWipe({ width: W, height: H }) as unknown as P;
  if (kind === "wipe") return wipe({ direction: WIPES[seed % WIPES.length] }) as unknown as P;
  if (kind === "flip") return { component: Flip, props: { direction: FLIPS[seed % FLIPS.length], perspective: 2400 } } as unknown as P;
  return null;
}

// Remotion's flip, with the perspective inside the transform: the browser's
// download (web-renderer) reads an element's own transform but not a parent's
// `perspective`, so @remotion/transitions' flip came out flat there.
// Fades out as the scene turns edge-on (the download skips the last few
// degrees before 90°, so it would vanish at once) and is gone past 90°.
const edgeOn = (deg: number) => Math.max(0, Math.min(1, (Math.abs(Math.cos((deg * Math.PI) / 180)) - 0.15) / 0.3)) * (Math.abs(deg) < 90 ? 1 : 0);
function Flip({ children, presentationDirection, presentationProgress: k, passedProps: { direction, perspective } }: { children: ReactNode; presentationDirection: "entering" | "exiting"; presentationProgress: number; passedProps: { direction: (typeof FLIPS)[number]; perspective: number } }) {
  const sign = direction === "from-right" ? 1 : -1;
  const turn = presentationDirection === "entering" ? sign * 180 * (1 - k) : -sign * 180 * k;
  const axis = direction === "from-bottom" ? "rotateX" : "rotateY";
  return (
    <AbsoluteFill style={{ transform: `perspective(${perspective}px) ${axis}(${turn}deg)`, backfaceVisibility: "hidden", opacity: edgeOn(turn) }}>
      {children}
    </AbsoluteFill>
  );
}

const noop = () => undefined;
export function Present({ p, dir, k, dur, children }: { p: P; dir: "entering" | "exiting"; k: number; dur: number; children: ReactNode }) {
  const C = p.component as unknown as (props: Record<string, unknown>) => ReactNode;
  return (
    <C presentationDirection={dir} presentationProgress={k} passedProps={p.props} presentationDurationInFrames={dur} onElementImage={noop} onUnmount={noop} bothEnteringAndExiting={false}>
      {children}
    </C>
  );
}
