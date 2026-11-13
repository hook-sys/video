"use client";

import Link from "next/link";
import { useRef } from "react";
import { Desk, remember, useArrival } from "./windows";
import { Avatar, TopNav } from "./top-nav";
import { LegalFooterLinks } from "./legal-links";
import "./site.css";

// The signed-in pages in the site's glass: the bar, one window, and the dock
// (Videos, Account, Credits, Admin, New video). The window opens out of what was
// clicked to come here (windows.tsx remember/useArrival).

export type ShellPlace = "videos" | "account" | "brand" | "credits" | "admin" | "new" | null;

export function AppShell({ title, admin, active, initial, wide, action, children }: { title: string; admin: boolean; active: ShellPlace; initial: string; wide?: boolean; action?: React.ReactNode; children: React.ReactNode }) {
  const win = useRef<HTMLElement>(null);
  useArrival(win);
  return (
    <div className="gs">
      <Desk />
      <TopNav
        wide={wide}
        home="/dashboard"
        onHome={remember}
        items={[
          { href: "/dashboard", label: "Videos", active: active === "videos", onClick: remember },
          { href: "/brand", label: "Brand kits", active: active === "brand", onClick: remember },
          { href: "/billing", label: "Credits", active: active === "credits", onClick: remember },
          ...(admin ? [{ href: "/admin", label: "Admin", active: active === "admin", onClick: remember }] : []),
        ]}
        right={
          <>
            {action ?? (
              <Link href="/projects/new" className="gs-btn" onClick={remember}>
                + New video
              </Link>
            )}
            <Avatar href="/dashboard#account" initial={initial} onClick={remember} active={active === "account"} />
          </>
        }
      />
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
      <footer className={`gs-footer${wide ? " wide" : ""}`}><LegalFooterLinks /></footer>
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
