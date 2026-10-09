"use client";

import Link from "next/link";
import { PIPELINE_STEPS } from "@/lib/pipeline";
import { Desk, Mark } from "@/components/site/windows";
import "@/components/site/site.css";

// Shown while a video is being made: one glass window over the still desk
// with the steps — done, now, next. Nothing moves; the page refreshes as the
// steps finish. Without a step the brief is still being sent (the form).
export function WaitingScreen({ step }: { step?: string | null }) {
  const sending = step === undefined;
  const now = sending ? -1 : Math.max(0, PIPELINE_STEPS.findIndex((s) => s.key === step));
  return (
    <div className="gs gs-wait" role="status" aria-live="polite">
      <Desk />
      <header className="gs-bar gs-glass">
        <span className="gs-brand">
          <Mark />
          MotionBrief
        </span>
        {!sending && (
          <Link href="/dashboard" className="gs-plain">
            Dashboard
          </Link>
        )}
      </header>
      <section className="gs-win gs-glass gs-wait-win">
        <div className="gs-titlebar">
          <div className="gs-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>{sending ? "Sending" : "Making your video"}</span>
        </div>
        <div className="gs-body">
          <h2>{sending ? "Sending your brief" : "Your video is being made"}</h2>
          <p className="gs-lead">
            {sending ? "Keep this page open while your script and icon upload." : "This takes a few minutes. You can close this page; your video will be on your dashboard when it is ready."}
          </p>
          <ol className="gs-wait-steps">
            {PIPELINE_STEPS.map((s, i) => {
              const state = i < now ? "done" : i === now ? "now" : "next";
              return (
                <li key={s.key} className={state}>
                  <span className="dot" aria-hidden="true">
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <b>{s.label}</b>
                  <em>{state === "done" ? "Done" : state === "now" ? "Now" : ""}</em>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
