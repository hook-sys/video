import type { ReactNode } from "react";

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

// One living icon, `size` square, playing from frame `at` (and held on its last frame). Drawn by the
// player and the renderer (living-play.tsx, loaded by film.tsx); the server's checks, which never load
// Remotion, see a box of its size.
type LivingProps = { name: string; size: number; at: number };
let draw: ((p: LivingProps) => ReactNode) | null = null;
export const setLivingDraw = (fn: (p: LivingProps) => ReactNode) => {
  draw = fn;
};
export function Living(p: LivingProps) {
  return draw ? draw(p) : <div style={{ width: p.size, height: p.size }} />;
}
