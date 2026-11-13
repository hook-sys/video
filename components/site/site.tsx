"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { login, signup } from "@/app/auth/actions";
import { Desk, remember, useWindows } from "./windows";
import { TopNav } from "./top-nav";
import { Landing } from "./landing";
import { LegalFooterLinks } from "./legal-links";
import "./site.css";

// The site before login: one glass window at a time over a still desk, and a
// dock for the menu; a window opens out of the icon clicked (windows.tsx).
// /, /login and /signup all render this.

export type SiteWindow = "overview" | "how" | "examples" | "login" | "signup";
const PATH: Record<SiteWindow, string> = { overview: "/", how: "/#how", examples: "/#examples", login: "/login", signup: "/signup" };
const TITLE: Record<SiteWindow, string> = { overview: "Overview", how: "How it works", examples: "Examples", login: "Log in", signup: "Start free" };
const windowAt = (l: Location): SiteWindow => (l.pathname.startsWith("/login") ? "login" : l.pathname.startsWith("/signup") ? "signup" : l.hash === "#how" ? "how" : l.hash === "#examples" ? "examples" : "overview");

// What only the browser knows, read once the page is there (the page itself is
// made once for everyone): a session cookie of Supabase's (sb-…-auth-token; a
// stale one only shows "Dashboard", which sends you to log in), and the note
// after a try to log in or sign up (?error=, ?message=).
const none = () => () => {};
const browserState = () => {
  const q = new URLSearchParams(location.search);
  return JSON.stringify([/(^|; )sb-[^=]+-auth-token/.test(document.cookie), q.get("error") ?? "", q.get("message") ?? ""]);
};

export function Site({ initial }: { initial: SiteWindow }) {
  const [signedIn, error, message] = JSON.parse(useSyncExternalStore(none, browserState, () => '[false,"",""]')) as [boolean, string, string];
  const { current, open, win, iconRef } = useWindows(initial, PATH, windowAt, TITLE);

  return (
    <div className="gs gs-dark gs-site">
      <Desk />

      <TopNav
        onHome={open("overview")}
        items={[
          { href: PATH.overview, label: "Overview", active: current === "overview", onClick: open("overview"), anchor: iconRef("overview") },
          { href: PATH.how, label: "How it works", active: current === "how", onClick: open("how"), anchor: iconRef("how") },
          { href: PATH.examples, label: "Examples", active: current === "examples", onClick: open("examples"), anchor: iconRef("examples") },
        ]}
        right={
          signedIn ? (
            <Link href="/dashboard" className="gs-btn" onClick={remember}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" ref={iconRef("login")} className="gs-plain" onClick={open("login")}>
                Log in
              </Link>
              <Link href="/signup" ref={iconRef("signup")} className="gs-btn" onClick={open("signup")}>
                Start free
              </Link>
            </>
          )
        }
      />

      {/* the landing page: one long page (Overview, How it works and Examples are places on it) */}
      {current === "overview" || current === "how" || current === "examples" ? <Landing signedIn={signedIn} start={open("signup")} examples="#examples" focus={current} /> : null}

      <main className="gs-stage">
        {win(
          "login",
          <form action={login} className="gs-auth">
            <h2>Welcome back</h2>
            <p>Log in to see your videos.</p>
            {initial === "login" && error && <p className="gs-note error">{error}</p>}
            {initial === "login" && message && <p className="gs-note info">{message}</p>}
            <label htmlFor="gs-login-email">Email</label>
            <input id="gs-login-email" name="email" type="email" required autoComplete="email" />
            <label htmlFor="gs-login-password">Password</label>
            <input id="gs-login-password" name="password" type="password" required minLength={6} autoComplete="current-password" />
            <button className="gs-btn">Log in</button>
            <div className="gs-switch">
              New here?{" "}
              <button type="button" onClick={open("signup")}>
                Start free
              </button>
            </div>
          </form>,
        )}

        {win(
          "signup",
          <form action={signup} className="gs-auth">
            <h2>Make your first video</h2>
            <p>Just an email and a password.</p>
            {initial === "signup" && error && <p className="gs-note error">{error}</p>}
            <label htmlFor="gs-signup-email">Email</label>
            <input id="gs-signup-email" name="email" type="email" required autoComplete="email" />
            <label htmlFor="gs-signup-password">Password</label>
            <input id="gs-signup-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
            <button className="gs-btn">Create account</button>
            <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
              By creating an account you agree to our <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/refund">Refund Policy</Link>.
            </p>
            <div className="gs-switch">
              Have an account?{" "}
              <button type="button" onClick={open("login")}>
                Log in
              </button>
            </div>
          </form>,
        )}
      </main>

      <footer className="gs-footer"><LegalFooterLinks /></footer>

    </div>
  );
}
