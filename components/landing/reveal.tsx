"use client";

import { useEffect, useRef, useState } from "react";
import { useSound } from "./sound";

type Sfx = Parameters<ReturnType<typeof useSound>["play"]>[0];

// A section whose animations start when it scrolls into view (data-in), with
// optional sounds on entering. Replays each time it comes back into view.
export function Reveal({ id, className = "", sfx = [], children }: { id?: string; className?: string; sfx?: [Sfx, number][]; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const { play } = useSound();
  const sfxRef = useRef(sfx);
  useEffect(() => {
    sfxRef.current = sfx;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        timers.splice(0).forEach(clearTimeout);
        if (e.isIntersecting) for (const [s, ms] of sfxRef.current) timers.push(window.setTimeout(() => play(s), ms));
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [play]);
  return (
    <section ref={ref} id={id} className={`lp-scene ${className}`} data-in={inView}>
      {children}
    </section>
  );
}

// Words that rise in one by one when their section is in view.
export function Words({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={`lp-words ${className}`} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden="true" className="lp-word" style={{ "--d": `${delay + i * 90}ms` } as React.CSSProperties}>
          {w}&nbsp;
        </span>
      ))}
    </span>
  );
}
