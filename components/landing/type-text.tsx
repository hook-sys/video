"use client";

import { useEffect, useRef, useState } from "react";

// Types its text out letter by letter whenever it scrolls into view.
export function TypeText({ text, delayMs = 250, perCharMs = 22 }: { text: string; delayMs?: number; perCharMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setTimeout(() => setN(text.length), 0);
      return () => clearTimeout(timer);
    }
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (!e.isIntersecting) return setN(0);
      const start = performance.now() + delayMs;
      const tick = () => {
        const k = Math.max(0, Math.floor((performance.now() - start) / perCharMs));
        setN(Math.min(text.length, k));
        if (k < text.length) timer = window.setTimeout(tick, perCharMs);
      };
      timer = window.setTimeout(tick, delayMs);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [text, delayMs, perCharMs]);
  return (
    <span ref={ref} aria-label={text}>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      <span aria-hidden="true" className={`b-caret ${n >= text.length ? "is-done" : ""}`} />
    </span>
  );
}
