import type { ReactNode } from "react";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { flip } from "@remotion/transitions/flip";
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
  if (kind === "flip") return flip({ direction: FLIPS[seed % FLIPS.length], perspective: 2400 }) as unknown as P;
  return null;
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
