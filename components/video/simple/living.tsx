import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import { useEffect, useState } from "react";
import { Sequence, cancelRender, continueRender, delayRender, staticFile } from "remotion";

// Living icons (docs/video-spec.md, Living icons): Google's Noto animated emoji
// (CC BY 4.0, public/lottie/LICENSE.md) — objects only, never a face, a person
// or an animal (the owner's rule; the coin, with a face on it, is left out).
// Colour emoji, so only where one big picture stands alone (a beat's one icon),
// never on the cards, whose icons are the look's own.

// an icon of ours → its living one
export const LIVING: Record<string, string> = {
  megaphone: "megaphone", "trending-up": "chart-up", "trending-down": "chart-down", "chart-column": "bar-chart", "chart-bar": "bar-chart",
  package: "package", boxes: "package", "shopping-cart": "cart", lightbulb: "bulb", bell: "bell", "alarm-clock": "alarm", clock: "alarm",
  hourglass: "hourglass", timer: "hourglass", "circle-check": "check", "badge-check": "check", "circle-x": "cross", "triangle-alert": "warning",
  flame: "fire", sparkles: "sparkles", target: "target", trophy: "trophy", gift: "gift", lock: "lock", "shield-check": "lock",
  laptop: "laptop", monitor: "laptop", settings: "gear", workflow: "gear", banknote: "money-wings", "piggy-bank": "money-wings", wallet: "money-wings",
  star: "star", rocket: "rocket", zap: "zap", truck: "truck", "message-circle": "chat", play: "clapper", camera: "camera", gem: "gem",
  battery: "battery", "party-popper": "party", "octagon-x": "stop", tv: "tv",
};
export const livingOf = (icon: string | null | undefined) => (icon ? LIVING[icon] ?? null : null);

const cache = new Map<string, LottieAnimationData>();
// One living icon, `size` square, playing from frame `at` (and held on its last frame)
export function Living({ name, size, at }: { name: string; size: number; at: number }) {
  const [data, setData] = useState<LottieAnimationData | null>(cache.get(name) ?? null);
  const [handle] = useState(() => (cache.has(name) ? null : delayRender(`living icon ${name}`)));
  useEffect(() => {
    if (!handle) return;
    fetch(staticFile(`lottie/${name}.json`))
      .then((r) => r.json())
      .then((j: LottieAnimationData) => {
        cache.set(name, j);
        setData(j);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle, name]);
  if (!data) return <div style={{ width: size, height: size }} />;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <Sequence from={at} layout="none">
        <Lottie animationData={data} loop={false} style={{ width: size, height: size }} />
      </Sequence>
    </div>
  );
}
// (laid out without a browser, check.ts: a box of its size)
Living.noWalk = true;
