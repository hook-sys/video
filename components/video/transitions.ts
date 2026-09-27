import type { CSSProperties } from "react";
import { interpolate } from "remotion";

export type TransitionKind = "fade" | "slide" | "zoom" | "blur" | "wipe" | "morph";
type Direction = "left" | "right" | "up" | "down";

// Maps the storyboard's free-text `transition` onto a rendered transition.
export function transitionFor(text: string | undefined): { kind: TransitionKind; dir: Direction } {
  const t = (text ?? "").toLowerCase();
  const dir: Direction = /right/.test(t) ? "right" : /\bup\b/.test(t) ? "up" : /down/.test(t) ? "down" : "left";
  const kind: TransitionKind = /morph|match|shape/.test(t)
    ? "morph"
    : /wipe/.test(t)
      ? "wipe"
      : /slide|push|swipe/.test(t)
        ? "slide"
        : /zoom|through/.test(t)
          ? "zoom"
          : /blur/.test(t)
            ? "blur"
            : "fade";
  return { kind, dir };
}

export const TRANSITION_FRAMES = 12;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Style for a scene's edges. Scenes don't overlap, so a transition is split:
 * the outgoing scene plays the "out" half, the next scene the matching "in" half.
 * `p` goes 0→1 across the half (in: hidden→visible, out: visible→hidden).
 */
export function transitionStyle(
  { kind, dir }: { kind: TransitionKind; dir: Direction },
  phase: "in" | "out",
  p: number,
): CSSProperties {
  const hidden = phase === "in" ? 1 - p : p; // 1 = fully transitioned away
  const sign = (phase === "in" ? 1 : -1) * (dir === "left" || dir === "up" ? 1 : -1);
  const axis = dir === "up" || dir === "down" ? "Y" : "X";
  switch (kind) {
    case "slide":
      return { transform: `translate${axis}(${sign * hidden * 30}%)`, opacity: 1 - hidden * 0.6 };
    case "zoom":
      return { transform: `scale(${phase === "in" ? 1 + hidden * 0.25 : 1 - hidden * 0.15})`, opacity: 1 - hidden };
    case "blur":
      return { filter: `blur(${hidden * 18}px)`, opacity: 1 - hidden * 0.8 };
    case "wipe": {
      const side = { left: "right", right: "left", up: "bottom", down: "top" }[dir];
      const inset = { top: 0, right: 0, bottom: 0, left: 0, [side]: hidden * 100 };
      return { clipPath: `inset(${inset.top}% ${inset.right}% ${inset.bottom}% ${inset.left}%)` };
    }
    case "morph":
      return {
        transform: `scale(${1 - hidden * 0.12})`,
        borderRadius: `${hidden * 48}px`,
        filter: `blur(${hidden * 10}px)`,
        opacity: 1 - hidden * 0.7,
        overflow: "hidden",
      };
    default:
      return { opacity: 1 - hidden };
  }
}

export function sceneEdgeStyle(
  frame: number,
  total: number,
  enterWith: { kind: TransitionKind; dir: Direction } | null,
  exitWith: { kind: TransitionKind; dir: Direction } | null,
): CSSProperties {
  const n = Math.min(TRANSITION_FRAMES, Math.floor(total / 3));
  if (enterWith && frame < n) {
    return transitionStyle(enterWith, "in", interpolate(frame, [0, n], [0, 1], clamp));
  }
  if (exitWith && frame > total - n) {
    return transitionStyle(exitWith, "out", interpolate(frame, [total - n, total], [0, 1], clamp));
  }
  return {};
}
