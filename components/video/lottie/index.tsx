import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import { type CSSProperties, useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import MANIFEST from "./manifest.json";
import { type LottieColors, recolorLottie } from "./recolor";
import { LOTTIE_LOADERS } from "./registry";

// Our own Lottie micro-animations (scripts/lottie), played frame-accurately by
// Remotion: the animation starts at the enclosing <Sequence>'s first frame.

export type LottieName = keyof typeof MANIFEST;
export const LOTTIE_NAMES = Object.keys(MANIFEST) as LottieName[];
export const LOTTIE_MANIFEST = MANIFEST as Record<LottieName, { category: string; loop: boolean; frames: number; description: string }>;
export const isLottieName = (n: unknown): n is LottieName => typeof n === "string" && n in MANIFEST;
export { recolorLottie, type LottieColors };

export async function loadLottie(name: LottieName, colors?: LottieColors) {
  const mod = await LOTTIE_LOADERS[name]();
  return recolorLottie(mod.default as LottieAnimationData, colors);
}

export function LottieAnim({
  name,
  colors,
  loop,
  playbackRate = 1,
  style,
}: {
  name: LottieName;
  colors?: LottieColors;
  loop?: boolean; // defaults to the animation's own setting
  playbackRate?: number;
  style?: CSSProperties;
}) {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const colorKey = JSON.stringify(colors ?? {});
  useEffect(() => {
    const handle = delayRender(`Loading Lottie "${name}"`);
    let alive = true;
    loadLottie(name, JSON.parse(colorKey))
      .then((d) => {
        if (alive) setData(d);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
      continueRender(handle);
    };
  }, [name, colorKey]);
  if (!data) return null;
  return <Lottie animationData={data} loop={loop ?? LOTTIE_MANIFEST[name].loop} playbackRate={playbackRate} style={style} />;
}
