import type { CSSProperties } from "react";
import ALIASES from "./aliases.json";
import ICONS from "./icons.json";
import { livingStandIn } from "./living";

// Motion-graphics icon library: every Lucide icon (ISC) as a 24×24 line icon,
// one compact path each; Lucide's older names resolve through aliases.json.
// Built by `npm run icons:build` (curated categories in scripts/icons/catalog.mjs).
// Search keywords and categories live in catalog.json (server/Director side).

// A string is the stroke path; a pair is [stroke, fill] for icons with solid dots.
type IconData = string | string[];
const DATA = ICONS as Record<string, IconData>;
const ALIAS = ALIASES as Record<string, string>;

export const ICON_NAMES = Object.keys(DATA).filter((n) => !livingStandIn(n));
export type IconName = keyof typeof ICONS | keyof typeof ALIASES;
// Current name for any accepted name (older Lucide names included), else null.
export const resolveIcon = (name: unknown): string | null => {
  if (typeof name !== "string") return null;
  const key = name in DATA ? name : (ALIAS[name] ?? null);
  return key ? (livingStandIn(key) ?? key) : null;
};
export const isIconName = (name: unknown): name is IconName => resolveIcon(name) !== null;

export type IconProps = {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  // 0..1: how much of the line is drawn (1 = complete). Deterministic, so it
  // can be driven by the frame for a "draw-on" reveal.
  draw?: number;
  style?: CSSProperties;
  // Fill the outline's closed shapes too (duotone illustrations).
  fill?: string;
};

export function Icon({ name, size = 24, color = "currentColor", strokeWidth = 2, draw = 1, style, fill }: IconProps) {
  const key = resolveIcon(name);
  if (!key) return null;
  const data = DATA[key];
  const [stroke, dots] = typeof data === "string" ? [data, ""] : data;
  const t = Math.min(1, Math.max(0, draw));
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden>
      {fill && <path d={stroke} fill={fill} stroke="none" opacity={t} transform="translate(1.4 1.4)" />}
      <path
        d={stroke}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...(t < 1 && { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - t })}
      />
      {dots && <path d={dots} fill={color} stroke={color} strokeWidth={strokeWidth} opacity={t} />}
    </svg>
  );
}
