"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PIPELINE_STEPS } from "@/lib/pipeline";
import { Desk } from "@/components/site/windows";
import { TopNav } from "@/components/site/top-nav";
import "@/components/site/site.css";

// Shown while a video is being made: one glass window over the still desk
// with the steps — done, now, next — and how far along it is. Nothing moves;
// the page refreshes as the steps finish. Without a step the brief is still
// being sent (the form). It covers the whole screen: opened from inside a
// glass window (the form) it is put on the page itself (a portal), since
// glass would hold it inside the window.
const SENDING = { key: "sending", label: "Sending your brief" } as const;

export function WaitingScreen({ step, inline }: { step?: string | null; inline?: boolean }) {
  // (on the page only once it runs in the browser)
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const sending = step === undefined;
  const steps = sending ? [SENDING, ...PIPELINE_STEPS] : PIPELINE_STEPS;
  const now = sending ? 0 : Math.max(0, PIPELINE_STEPS.findIndex((s) => s.key === step));
  const share = Math.round(((now + 0.5) / steps.length) * 100);

  const screen = (
    <div className="gs gs-wait" role="status" aria-live="polite">
      <Desk />
      <TopNav
        home={sending ? null : "/dashboard"}
        right={
          !sending && (
            <Link href="/dashboard" className="gs-plain">
              Dashboard
            </Link>
          )
        }
      />
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
          <p className="gs-kicker">
            Step {now + 1} of {steps.length}
          </p>
          <h2>{sending ? "Sending your brief" : "Your video is being made"}</h2>
          <p className="gs-lead">{sending ? "Keep this page open for a moment while your script and icon upload." : "This takes a few minutes. You can close this page — your video will be on your dashboard when it is ready."}</p>
          <div className="gs-wait-meter" aria-hidden="true">
            <i style={{ width: `${share}%` }} />
          </div>
          <ol className="gs-wait-steps">
            {steps.map((s, i) => {
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
          {!sending && (
            <div className="gs-wait-foot">
              <Link href="/dashboard" className="gs-btn ghost">
                Back to dashboard
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
  if (inline) return screen;
  return mounted ? createPortal(screen, document.body) : null;
}
