"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { HeroPlayer } from "@/components/landing/hero-player";
import type { HeroCaption } from "@/components/landing/hero-plan";
import { Sphere } from "@/components/landing/primitives";
import { Words } from "@/components/landing/reveal";
import { SoundProvider, SoundToggle } from "@/components/landing/sound";
import type { FlowPlan } from "@/components/video/flow/types";
import { PIPELINE_STEPS } from "@/lib/pipeline";
import "@/components/landing/landing.css";

// Bold line per pipeline step (lib/pipeline.ts), shown while that step runs.
const LINES: Record<string, string> = {
  analyzing: "Reading your product.",
  writing: "Writing your script.",
  voice: "Recording the voice.",
  visuals: "Directing every scene.",
  validating: "Checking every detail.",
  rendering: "Rendering your video.",
};

// Shown while a video is being made: the landing page's stage (glow, floor,
// spheres), the looping logo, a bold line for the step that is running, the
// real progress, and MotionBrief's own promo to watch meanwhile. It covers the
// page. Without a known step (while the create form submits) the steps
// advance on a timer and stop before the last one.
export function WaitingScreen({ step, plan, captions }: { step?: string | null; plan: FlowPlan; captions: HeroCaption[] }) {
  const [ticked, setTicked] = useState(0);
  useEffect(() => {
    if (step !== undefined) return;
    const id = setInterval(() => setTicked((n) => Math.min(n + 1, PIPELINE_STEPS.length - 2)), 14000);
    return () => clearInterval(id);
  }, [step]);
  const current = step === undefined ? ticked : Math.max(0, PIPELINE_STEPS.findIndex((s) => s.key === step));
  const line = LINES[PIPELINE_STEPS[current].key] ?? "Making your video.";
  const pct = Math.round(((current + 0.5) / PIPELINE_STEPS.length) * 100);
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
            <LogoMark size={76} animated loopMs={4200} className="lp-wait-mark" />
            <h1 key={line} className="lp-h2 lp-wait-line">
              <Words text={line} />
            </h1>
            <p className="lp-sub">Your video is being made. You can stay here or come back later.</p>

            <div className="lp-wait-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
              <div className="lp-wait-bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <ol className="lp-wait-steps">
                {PIPELINE_STEPS.map((s, i) => (
                  <li key={s.key} data-state={i < current ? "done" : i === current ? "active" : "todo"}>
                    <span aria-hidden="true">{i < current ? "✓" : ""}</span>
                    {s.label}
                  </li>
                ))}
              </ol>
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
