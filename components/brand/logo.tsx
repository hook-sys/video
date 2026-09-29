import { useId } from "react";

// The MotionBrief mark: lines of a brief turning into a play button.
// `animated` plays the intro once (box pops in, the lines type out, the play
// button arrives); see the .mb-* rules in globals.css.
export function LogoMark({ size = 32, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`${animated ? "mb-animated" : ""} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <rect className="mb-box" width="64" height="64" rx="15" fill={`url(#${id})`} />
      <rect className="mb-line mb-l1" x="12" y="19" width="15" height="5.5" rx="2.75" fill="#fff" />
      <rect className="mb-line mb-l2" x="12" y="29.25" width="21" height="5.5" rx="2.75" fill="#fff" opacity=".9" />
      <rect className="mb-line mb-l3" x="12" y="39.5" width="11" height="5.5" rx="2.75" fill="#fff" opacity=".75" />
      <path className="mb-play" d="M33 18.6v26.8a2.2 2.2 0 0 0 3.4 1.8l17-13.4a2.2 2.2 0 0 0 0-3.6l-17-13.4a2.2 2.2 0 0 0-3.4 1.8z" fill="#fff" />
    </svg>
  );
}

// Mark + wordmark ("Brief" in the brand gradient).
export function Logo({ size = 28, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark size={size} animated={animated} />
      <span className={animated ? "mb-word" : ""}>
        Motion<span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Brief</span>
      </span>
    </span>
  );
}
