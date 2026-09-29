"use client";

import { useEffect, useRef, useState } from "react";

// A "next" arrow at the bottom of a scene. Once the scene has been in view
// for `afterMs` (its animation) the ring fills for `waitMs`, then the page
// scrolls to the next section. Once per page view; any scrolling, touch or
// key press by the visitor cancels it, and reduced motion turns it off.
export function AutoNext({ afterMs, waitMs = 3000 }: { afterMs: number; waitMs?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [counting, setCounting] = useState(false);
  const next = () => {
    const section = ref.current?.closest("section");
    const target = section?.nextElementSibling as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    if (!el || !section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let done = false;
    let timers: number[] = [];
    const cancel = () => {
      timers.forEach(clearTimeout);
      timers = [];
      setCounting(false);
    };
    const stopForGood = () => {
      done = true;
      cancel();
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (done) return;
        if (e.intersectionRatio >= 0.6) {
          timers.push(window.setTimeout(() => setCounting(true), afterMs));
          timers.push(
            window.setTimeout(() => {
              done = true;
              setCounting(false);
              next();
            }, afterMs + waitMs),
          );
        } else cancel();
      },
      { threshold: [0, 0.6] },
    );
    io.observe(section);
    // The visitor taking over cancels the automatic move.
    const takeover = () => timers.length && stopForGood();
    window.addEventListener("wheel", takeover, { passive: true });
    window.addEventListener("touchstart", takeover, { passive: true });
    window.addEventListener("keydown", takeover);
    return () => {
      io.disconnect();
      cancel();
      window.removeEventListener("wheel", takeover);
      window.removeEventListener("touchstart", takeover);
      window.removeEventListener("keydown", takeover);
    };
  }, [afterMs, waitMs]);
  return (
    <button ref={ref} type="button" onClick={next} className={`lp-next ${counting ? "is-counting" : ""}`} style={{ "--wait": `${waitMs}ms` } as React.CSSProperties} aria-label="Next">
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle className="lp-next-track" cx="24" cy="24" r="21" />
        <circle className="lp-next-ring" cx="24" cy="24" r="21" pathLength="100" />
        <path d="M24 15v17M17 26l7 7 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
