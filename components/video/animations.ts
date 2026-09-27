import { interpolate, spring } from "remotion";

export type Motion = "fade" | "slide" | "zoom" | "pan" | "highlight" | "pop" | "blur" | "reveal" | "parallax";

// Maps the storyboard's free-text `animation` to a supported motion preset.
export function motionFor(animation: string): Motion {
  const a = animation.toLowerCase();
  if (/highlight|spotlight|focus/.test(a)) return "highlight";
  if (/parallax/.test(a)) return "parallax";
  if (/\bpan\b|scroll/.test(a)) return "pan";
  if (/pop|spring|bounce/.test(a)) return "pop";
  if (/blur/.test(a)) return "blur";
  if (/reveal|word by word|typewriter|mask/.test(a)) return "reveal";
  if (/zoom|scale|push/.test(a)) return "zoom";
  if (/slide|swipe|wipe/.test(a)) return "slide";
  return "fade";
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Entrance for text/UI elements, staggered by `delay` frames.
export function enter(motion: Motion, frame: number, fps: number, delay = 0) {
  if (motion === "pop") {
    const p = spring({ frame: frame - delay, fps, config: { damping: 9, mass: 0.6 } });
    return { opacity: Math.min(1, p * 1.5), transform: `scale(${0.6 + p * 0.4})` };
  }
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  if (motion === "slide") return { opacity, transform: `translateX(${(1 - p) * 80}px)` };
  if (motion === "zoom") return { opacity, transform: `scale(${0.85 + p * 0.15})` };
  if (motion === "blur") return { opacity, filter: `blur(${(1 - p) * 16}px)` };
  if (motion === "reveal") return { opacity: 1, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
  return { opacity, transform: `translateY(${(1 - p) * 30}px)` };
}
