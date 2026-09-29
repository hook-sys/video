"use client";

import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { HeroPlayer } from "@/components/landing/hero-player";
import type { HeroCaption } from "@/components/landing/hero-plan";
import { Sphere } from "@/components/landing/primitives";
import { SoundProvider, SoundToggle } from "@/components/landing/sound";
import type { FlowPlan } from "@/components/video/flow/types";
import "@/components/landing/landing.css";

// Shown while a video is being made: the landing page's stage (glow, floor,
// spheres), the looping logo as the loading sign, and MotionBrief's own promo
// right below it to watch meanwhile. It covers the page. `step` is the running
// pipeline step (not shown; kept for callers).
export function WaitingScreen({ plan, captions }: { step?: string | null; plan: FlowPlan; captions: HeroCaption[] }) {
  return (
    <SoundProvider>
      <div className="lp fixed inset-0 z-50 overflow-y-auto">
        <section className="lp-hero lp-wait" data-in="true">
          <div className="lp-hero-glow" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="lp-floor" aria-hidden="true" />
          <Sphere size={40} tone="blue" className="lp-float" style={{ left: "10%", top: "24%", "--f": "7s" } as React.CSSProperties} />
          <Sphere size={90} tone="violet" className="lp-float lp-hide-sm" style={{ right: "8%", top: "58%", "--f": "9s" } as React.CSSProperties} />
          <Sphere size={24} tone="pink" className="lp-float" style={{ right: "18%", top: "18%", "--f": "6s" } as React.CSSProperties} />

          <header className="lp-nav">
            <Logo />
            <nav className="lp-nav-links">
              <Link href="/dashboard">← Dashboard</Link>
            </nav>
          </header>

          <div className="lp-hero-content lp-wait-content">
            <div role="status" aria-label="Your video is being made">
              <LogoMark size={76} animated loopMs={4200} className="lp-wait-mark" />
            </div>

            <div className="lp-hero-player">
              <HeroPlayer plan={plan} captions={captions} />
            </div>
          </div>
        </section>
        <SoundToggle />
      </div>
    </SoundProvider>
  );
}
