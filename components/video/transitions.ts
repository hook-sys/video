import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";

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

// Scenes overlap by this many frames: the next scene starts at its cut point and
// plays its "in" half on top, while the previous scene keeps moving underneath
// for the same frames ("out" half). The outgoing scene never fades, so no frame
// ever shows the empty (black) background between scenes.
export const TRANSITION_FRAMES = 16;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

/** `p` goes 0→1 across the overlap for both halves. */
export function transitionStyle(
  { kind, dir }: { kind: TransitionKind; dir: Direction },
  phase: "in" | "out",
  p: number,
): CSSProperties {
  const e = ease(p);
  // Content travels toward `dir`: "left" = new scene enters from the right.
  const sign = dir === "left" || dir === "up" ? 1 : -1;
  const axis = dir === "up" || dir === "down" ? "Y" : "X";
  if (phase === "in") {
    switch (kind) {
      case "slide": // push: both scenes travel together, fully opaque
        return { transform: `translate${axis}(${sign * (1 - e) * 100}%)`, boxShadow: "0 0 80px rgba(0,0,0,.5)" };
      case "zoom": // camera flies through the old scene into the new one
        return { transform: `scale(${0.72 + 0.28 * e})`, opacity: Math.min(1, e * 1.6), filter: `blur(${(1 - e) * 8}px)` };
      case "blur":
        return { transform: `scale(${1.08 - 0.08 * e})`, opacity: e, filter: `blur(${(1 - e) * 24}px)` };
      case "wipe": {
        const side = { left: "right", right: "left", up: "bottom", down: "top" }[dir];
        const inset = { top: 0, right: 0, bottom: 0, left: 0, [side]: (1 - e) * 100 };
        return { clipPath: `inset(${inset.top}% ${inset.right}% ${inset.bottom}% ${inset.left}%)` };
      }
      case "morph": { // the new scene grows out of a rounded card in the middle
        const i = (1 - e) * 28;
        return { clipPath: `inset(${i}% ${i}% ${i}% ${i}% round ${(1 - e) * 64}px)`, transform: `scale(${1.1 - 0.1 * e})` };
      }
      default: // cross-dissolve with a settling push
        return { opacity: e, transform: `scale(${1.05 - 0.05 * e})` };
    }
  }
  switch (kind) {
    case "slide":
      return { transform: `translate${axis}(${-sign * e * 35}%) scale(${1 - 0.04 * e})`, filter: `brightness(${1 - 0.25 * e})` };
    case "zoom":
      return { transform: `scale(${1 + 0.9 * e})`, filter: `blur(${e * 12}px)` };
    case "blur":
      return { transform: `scale(${1 + 0.08 * e})`, filter: `blur(${e * 20}px)` };
    case "wipe":
      return { transform: `translate${axis}(${-sign * e * 12}%)` };
    case "morph":
      return { transform: `scale(${1 + 0.15 * e})`, filter: `blur(${e * 6}px)` };
    default:
      return { transform: `scale(${1 + 0.05 * e})` };
  }
}

// `span` is the scene's own length; frames beyond it are the overlap tail.
export function sceneEdgeStyle(
  frame: number,
  span: number,
  enterWith: { kind: TransitionKind; dir: Direction } | null,
  exitWith: { kind: TransitionKind; dir: Direction } | null,
): CSSProperties {
  const n = TRANSITION_FRAMES;
  if (enterWith && frame < n) return transitionStyle(enterWith, "in", interpolate(frame, [0, n], [0, 1], clamp));
  if (exitWith && frame >= span) return transitionStyle(exitWith, "out", interpolate(frame, [span, span + n], [0, 1], clamp));
  return {};
}
