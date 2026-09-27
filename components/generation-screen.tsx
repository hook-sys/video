"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Creating your video...",
  "Designing the animation...",
  "Adding voiceover...",
  "Bringing everything together...",
  "Rendering your video...",
];

// Calm, abstract "AI at work" visual with rotating friendly status text.
export function GenerationScreen() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="gen-motion flex flex-col items-center gap-8 py-10 text-center">
      <div className="relative h-56 w-56 sm:h-64 sm:w-64" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-sky-400/30 blur-2xl animate-[gen-float_7s_ease-in-out_infinite]" />
        <div className="absolute inset-6 rounded-full border border-indigo-400/30 animate-[gen-spin_18s_linear_infinite]">
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-indigo-400 shadow-[0_0_16px] shadow-indigo-400" />
        </div>
        <div className="absolute inset-14 rounded-full border border-violet-400/30 animate-[gen-spin_11s_linear_infinite_reverse]">
          <span className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_12px] shadow-violet-400" />
        </div>
        <div className="absolute inset-[5.5rem] rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30 animate-[gen-float_5s_ease-in-out_infinite]" />
        {[18, 38, 58, 78].map((left, n) => (
          <span
            key={left}
            className="absolute bottom-6 h-1.5 w-1.5 rounded-full bg-sky-400/80 animate-[gen-rise_4s_ease-out_infinite]"
            style={{ left: `${left}%`, animationDelay: `${n * 0.9}s` }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p key={i} className="text-xl font-semibold tracking-tight animate-[gen-fade_0.6s_ease-out] sm:text-2xl" aria-live="polite">
          {MESSAGES[i]}
        </p>
        <p className="text-sm text-foreground/60">Your video is being designed automatically</p>
      </div>
    </div>
  );
}
