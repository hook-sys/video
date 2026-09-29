"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Sphere, UiWindow } from "./primitives";
import { Words } from "./reveal";

// Full-screen hero: a deep blue stage with a perspective floor, drifting glow,
// floating spheres and glass UI windows that follow the pointer (parallax).
export function Hero({ signedIn }: { signedIn: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", String(((e.clientX - r.left) / r.width) * 2 - 1));
        el.style.setProperty("--my", String(((e.clientY - r.top) / r.height) * 2 - 1));
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={ref} className="lp-hero" data-in="true">
      <div className="lp-hero-glow" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="lp-floor" aria-hidden="true" />

      <div className="lp-depth" style={{ "--depth": 10 } as React.CSSProperties}>
        <Sphere size={46} tone="blue" className="lp-float" style={{ left: "12%", top: "30%", "--f": "7s" } as React.CSSProperties} />
        <Sphere size={22} tone="pink" className="lp-float" style={{ left: "78%", top: "22%", "--f": "6s" } as React.CSSProperties} />
      </div>
      <div className="lp-depth" style={{ "--depth": 24 } as React.CSSProperties}>
        <UiWindow w={260} h={170} variant="glass" className="lp-float lp-tilt-l lp-hide-sm" style={{ left: "4%", top: "56%", "--f": "9s" } as React.CSSProperties} />
        <UiWindow w={230} h={150} variant="blue" className="lp-float lp-tilt-r lp-hide-sm" style={{ right: "5%", top: "50%", "--f": "8s" } as React.CSSProperties} />
      </div>
      <div className="lp-depth" style={{ "--depth": 44 } as React.CSSProperties}>
        <Sphere size={120} tone="violet" className="lp-float lp-hide-sm" style={{ left: "70%", top: "64%", "--f": "10s" } as React.CSSProperties} />
        <Sphere size={70} tone="coral" className="lp-float" style={{ left: "18%", top: "74%", "--f": "8.5s" } as React.CSSProperties} />
      </div>

      <div className="lp-hero-content">
        <h1 className="lp-h1">
          <Words text="Your brief," />
          <br />
          <Words text="in motion." className="lp-glow-text" delay={220} />
        </h1>
        <p className="lp-sub">Turn a short brief into a motion-graphics promo video.</p>
        <div className="lp-ctas">
          <Link href={signedIn ? "/projects/new" : "/signup"} className="lp-btn lp-btn-primary">
            {signedIn ? "Create video" : "Start free"}
          </Link>
          {!signedIn && (
            <Link href="/login" className="lp-btn lp-btn-ghost">
              Log in
            </Link>
          )}
        </div>
      </div>
      <div className="lp-scroll-hint" aria-hidden="true" />
    </section>
  );
}
