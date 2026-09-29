import { clamp01, ramp } from "./eval";

// The MotionBrief mark, animated frame by frame for videos: the box pops in,
// the brief's lines type out, and the play button arrives with a nudge — the
// same intro as the website's LogoMark (components/brand/logo.tsx).
export const MOTIONBRIEF_MARK = "motionbrief:mark";

export function MotionBriefMark({ frame, size }: { frame: number; size: number }) {
  const box = ramp(frame, 0, 14, "back");
  const line = (start: number) => ramp(frame, start, 9, "out");
  const play = ramp(frame, 22, 18, "out");
  const nudge = Math.sin(clamp01((frame - 30) / 10) * Math.PI) * 2.5;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="mb-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <g transform={`translate(32 32) scale(${0.4 + 0.6 * box}) rotate(${(1 - clamp01(box)) * -12}) translate(-32 -32)`} opacity={clamp01(box * 1.5)}>
        <rect width="64" height="64" rx="15" fill="url(#mb-mark-g)" />
      </g>
      {[
        [19, 15, 1, 9],
        [29.25, 21, 0.9, 13],
        [39.5, 11, 0.75, 16],
      ].map(([y, w, o, start]) => (
        <rect key={y} x="12" y={y} width={w * line(start)} height="5.5" rx="2.75" fill="#fff" opacity={line(start) > 0 ? o : 0} />
      ))}
      <path
        d="M33 18.6v26.8a2.2 2.2 0 0 0 3.4 1.8l17-13.4a2.2 2.2 0 0 0 0-3.6l-17-13.4a2.2 2.2 0 0 0-3.4 1.8z"
        fill="#fff"
        opacity={clamp01(play * 2)}
        transform={`translate(${(1 - play) * -16 + nudge} 0)`}
      />
    </svg>
  );
}
