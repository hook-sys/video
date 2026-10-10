"use client";

import Link from "next/link";
import { useRef } from "react";
import { Desk, Mark, remember, useArrival } from "./windows";
import "./site.css";

// The signed-in pages in the site's glass: the bar, one window, and the dock
// (Videos, Account, Admin, New video). The window opens out of what was
// clicked to come here (windows.tsx remember/useArrival).

export type ShellPlace = "videos" | "account" | "admin" | "new" | null;

export function AppShell({ title, admin, active, initial, wide, action, children }: { title: string; admin: boolean; active: ShellPlace; initial: string; wide?: boolean; action?: React.ReactNode; children: React.ReactNode }) {
  const win = useRef<HTMLElement>(null);
  useArrival(win);
  return (
    <div className="gs">
      <Desk />
      <header className={`gs-bar gs-glass${wide ? " wide" : ""}`}>
        <Link href="/dashboard" className="gs-brand" onClick={remember}>
          <Mark />
          MotionBrief
        </Link>
        {action ?? (
          <Link href="/projects/new" className="gs-btn" onClick={remember}>
            New video
          </Link>
        )}
      </header>
      <main className={`gs-stage${wide ? " wide" : ""}`}>
        <section ref={win} className="gs-win gs-glass">
          <div className="gs-titlebar">
            <div className="gs-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>{title}</span>
          </div>
          <div className="gs-body gs-app">{children}</div>
        </section>
      </main>
      <footer className={`gs-footer${wide ? " wide" : ""}`}>© MotionBrief</footer>
      <nav className="gs-dock gs-glass" aria-label="Main">
        <Link href="/dashboard" className="gs-dock-brand gs-only-wide" onClick={remember} aria-label="MotionBrief">
          <Mark />
        </Link>
        <Link href="/dashboard" onClick={remember} aria-current={active === "videos" ? "page" : undefined}>
          <span className="gs-tile t1">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="5" width="7" height="6" rx="1.5" />
              <rect x="13" y="5" width="7" height="6" rx="1.5" />
              <rect x="4" y="13" width="7" height="6" rx="1.5" />
              <rect x="13" y="13" width="7" height="6" rx="1.5" />
            </svg>
          </span>
          <small>Videos</small>
        </Link>
        <Link href="/dashboard#account" onClick={remember} aria-current={active === "account" ? "page" : undefined}>
          <span className="gs-tile t5">
            <span className="initial">{initial}</span>
          </span>
          <small>Account</small>
        </Link>
        {admin && (
          <Link href="/admin" onClick={remember} aria-current={active === "admin" ? "page" : undefined}>
            <span className="gs-tile t3">
              <AdminGlyph />
            </span>
            <small>Admin</small>
          </Link>
        )}
        <span className="gs-sep" aria-hidden="true" />
        <Link href="/projects/new" onClick={remember} aria-current={active === "new" ? "page" : undefined}>
          <span className="gs-tile t4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0a66d6" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </span>
          <small>New video</small>
        </Link>
      </nav>
    </div>
  );
}

export function AdminGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="1.6" fill="#fff" />
      <circle cx="15" cy="12" r="1.6" fill="#fff" />
      <circle cx="8" cy="17" r="1.6" fill="#fff" />
    </svg>
  );
}
