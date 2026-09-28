import type { CSSProperties } from "react";
import ICONS from "./icons.json";

// Motion-graphics icon library: 24×24 line icons (Lucide, ISC), one compact
// path each. Built by `npm run icons:build` from scripts/icons/catalog.mjs.
// Search keywords and categories live in catalog.json (server/Director side).

// A string is the stroke path; a pair is [stroke, fill] for icons with solid dots.
type IconData = string | string[];
const DATA = ICONS as Record<string, IconData>;

export const ICON_NAMES = Object.keys(DATA);
export type IconName = keyof typeof ICONS;
export const isIconName = (name: unknown): name is IconName => typeof name === "string" && name in DATA;

export type IconProps = {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  // 0..1: how much of the line is drawn (1 = complete). Deterministic, so it
  // can be driven by the frame for a "draw-on" reveal.
  draw?: number;
  style?: CSSProperties;
};

export function Icon({ name, size = 24, color = "currentColor", strokeWidth = 2, draw = 1, style }: IconProps) {
  const data = DATA[name];
  if (!data) return null;
  const [stroke, fill] = typeof data === "string" ? [data, ""] : data;
  const t = Math.min(1, Math.max(0, draw));
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden>
      <path
        d={stroke}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...(t < 1 && { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - t })}
      />
      {fill && <path d={fill} fill={color} stroke={color} strokeWidth={strokeWidth} opacity={t} />}
    </svg>
  );
}
