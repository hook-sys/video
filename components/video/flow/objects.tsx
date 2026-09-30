import { ramp } from "./eval";
import type { ObjectName } from "./object-names";
import { tint, type FlowTheme } from "./themes";

// Glossy "clay" 3D objects for the explainer look (Keka's 3D question mark,
// rocket …), drawn in SVG so they render the same in the browser download:
// a soft floor shadow, a darker extruded side, a gradient face and a white
// highlight. Never people or animals (the owner's rule).

// Warm objects read as feelings (a question, an idea, a win); the rest wear the brand.
const WARM = new Set<ObjectName>(["question", "exclaim", "bulb", "star", "trophy", "coin", "bolt"]);
const GREEN = new Set<ObjectName>(["check"]);

// Silhouettes in a 100×100 box (filled shapes, not outlines).
const SHAPE: Record<ObjectName, string> = {
  question: "M30 34a20 20 0 1 1 30 17c-6 4-8 7-8 13v3H40v-4c0-9 4-14 11-19 4-3 6-5 6-9a8 8 0 0 0-16 1z M46 74a8 8 0 1 1 0 16 8 8 0 0 1 0-16z",
  exclaim: "M40 12h20l-3 52H43z M50 72a9 9 0 1 1 0 18 9 9 0 0 1 0-18z",
  check: "M50 8a42 42 0 1 1 0 84 42 42 0 0 1 0-84z",
  rocket: "M50 6c14 10 20 26 20 44v18H30V50c0-18 6-34 20-44z M30 54 16 70v14l14-8z M70 54l14 16v14l-14-8z M40 72h20l-4 16h-12z",
  bulb: "M50 8a30 30 0 0 1 18 54c-4 3-6 7-6 12H38c0-5-2-9-6-12A30 30 0 0 1 50 8z M38 78h24v6a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6z",
  star: "M50 6l12.4 27 29.6 3.4-22 20.2 6 29.4L50 71.2 24 86l6-29.4-22-20.2 29.6-3.4z",
  trophy: "M26 12h48v22a24 24 0 0 1-48 0z M26 18H12v6a16 16 0 0 0 16 16z M74 18h14v6a16 16 0 0 1-16 16z M44 56h12v16H44z M30 72h40v14H30z",
  shield: "M50 6l36 12v26c0 24-16 40-36 50C30 84 14 68 14 44V18z",
  lock: "M30 42V30a20 20 0 0 1 40 0v12h-10V30a10 10 0 0 0-20 0v12z M20 42h60a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V48a6 6 0 0 1 6-6z",
  bell: "M50 8a6 6 0 0 1 6 6v3a26 26 0 0 1 20 26v18l8 10v4H16v-4l8-10V43a26 26 0 0 1 20-26v-3a6 6 0 0 1 6-6z M40 79h20a10 10 0 0 1-20 0z",
  gift: "M14 36h72v16H14z M20 52h60v36H20z M44 36h12v52H44z M50 36c-6-14-24-18-24-6 0 6 10 6 24 6z M50 36c6-14 24-18 24-6 0 6-10 6-24 6z",
  target: "M50 8a42 42 0 1 1 0 84 42 42 0 0 1 0-84z",
  coin: "M50 8a42 42 0 1 1 0 84 42 42 0 0 1 0-84z",
  bolt: "M58 4 18 56h26l-6 40 44-56H56z",
  chart: "M14 60h16v28H14z M40 40h16v48H40z M66 18h16v70H66z",
};
// Details drawn on the face in white (a tick, a window, rings, a $ …).
const DETAIL: Partial<Record<ObjectName, string>> = {
  check: "M32 52l12 12 24-26",
  rocket: "M50 30a8 8 0 1 1 0 16 8 8 0 0 1 0-16z",
  target: "M50 24a26 26 0 1 1 0 52 26 26 0 0 1 0-52z M50 38a12 12 0 1 1 0 24 12 12 0 0 1 0-24z",
  coin: "M58 36c-2-4-6-6-10-6-6 0-10 3-10 8 0 11 22 6 22 18 0 5-5 8-11 8-5 0-9-2-11-6 M49 24v8 M49 64v8",
  shield: "M36 50l10 10 18-20",
};

export function ObjectView({ name, label, w, h, t, frame, theme, labelPx }: { name: ObjectName; label?: string; w: number; h: number; t: number; frame: number; theme: FlowTheme; labelPx?: number }) {
  const base = GREEN.has(name) ? theme.success : WARM.has(name) ? "#F59E0B" : theme.primary;
  const light = tint(base, 0.45);
  const dark = shade(base, 0.72);
  const id = `obj-${name}-${Math.round(w)}`;
  // A gentle bob and sway, so the object feels alive but never busy.
  const bob = Math.sin(frame / 22) * 4;
  const sway = Math.sin(frame / 31) * 3;
  const pop = ramp(t, 0, 16, "back");
  const size = Math.min(w, label ? h - 60 : h);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", transform: `translateY(${bob}px) rotate(${sway}deg) scale(${pop})` }}>
        <defs>
          <linearGradient id={`${id}-face`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={base} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
          <radialGradient id={`${id}-shine`} cx="0.32" cy="0.22" r="0.45">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={dark} stopOpacity="0.35" />
            <stop offset="1" stopColor={dark} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}-clip`}>
            <path d={SHAPE[name]} />
          </clipPath>
        </defs>
        <ellipse cx="52" cy={102 - bob / 3} rx={34 - bob / 2} ry="7" fill={`url(#${id}-floor)`} />
        {/* the extruded side: the silhouette again, deeper and darker */}
        <path d={SHAPE[name]} fill={dark} transform="translate(3 4)" />
        <path d={SHAPE[name]} fill={`url(#${id}-face)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <ellipse cx="34" cy="22" rx="40" ry="30" fill={`url(#${id}-shine)`} />
        </g>
        {DETAIL[name] && <path d={DETAIL[name]} fill="none" stroke="#FFFFFF" strokeWidth={name === "target" ? 6 : 8} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />}
      </svg>
      {label && <div style={{ fontSize: labelPx ?? 32, fontWeight: 700, color: theme.ink, whiteSpace: "nowrap", opacity: ramp(t, 10, 12) }}>{label}</div>}
    </div>
  );
}

// A colour mixed toward black: k = 1 is the colour, 0 is black.
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k)).join(",")})`;
}
