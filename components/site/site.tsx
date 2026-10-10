"use client";

import Link from "next/link";
import { login, signup } from "@/app/auth/actions";
import { DEMOS } from "@/components/landing/demos";
import { Desk, Mark, remember, useWindows } from "./windows";
import "./site.css";

// The site before login: one glass window at a time over a still desk, and a
// dock for the menu; a window opens out of the icon clicked (windows.tsx).
// /, /login and /signup all render this.

export type SiteWindow = "overview" | "how" | "examples" | "login" | "signup";
const PATH: Record<SiteWindow, string> = { overview: "/", how: "/#how", examples: "/#examples", login: "/login", signup: "/signup" };
const TITLE: Record<SiteWindow, string> = { overview: "Overview", how: "How it works", examples: "Examples", login: "Log in", signup: "Start free" };
const windowAt = (l: Location): SiteWindow => (l.pathname.startsWith("/login") ? "login" : l.pathname.startsWith("/signup") ? "signup" : l.hash === "#how" ? "how" : l.hash === "#examples" ? "examples" : "overview");

type Props = { initial: SiteWindow; signedIn: boolean; error?: string; message?: string };

export function Site({ initial, signedIn, error, message }: Props) {
  const { current, open, win, iconRef } = useWindows(initial, PATH, windowAt, TITLE);
  const play = (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M5 3v12l10-6z" fill="#1d1d1f" />
    </svg>
  );

  return (
    <div className="gs">
      <Desk />

      <header className="gs-bar gs-glass">
        <Link href="/" className="gs-brand" onClick={open("overview")}>
          <Mark />
          MotionBrief
        </Link>
        {signedIn ? (
          <Link href="/dashboard" className="gs-btn" onClick={remember}>
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              ref={iconRef("login")}
              className="gs-plain"
              onClick={open("login")}
            >
              Log in
            </Link>
            <Link href="/signup" className="gs-btn" onClick={open("signup")}>
              Start free
            </Link>
          </>
        )}
      </header>

      <main className="gs-stage">
        {win(
          "overview",
          <>
            <div className="gs-ov">
              <div>
                <h1>
                  Your product,
                  <br />
                  explained in one video.
                </h1>
                <p className="gs-lead">Send us your website or your own script. You get a narrated motion video, every scene drawn for the words spoken in it.</p>
                <div className="gs-row">
                  {signedIn ? (
                    <Link href="/projects/new" onClick={remember} className="gs-btn big">
                      Create video
                    </Link>
                  ) : (
                    <Link href="/signup" className="gs-btn big" onClick={open("signup")}>
                      Start free
                    </Link>
                  )}
                  <Link href="/#examples" className="gs-btn ghost big" onClick={open("examples")}>
                    See examples
                  </Link>
                </div>
              </div>
              <div className="gs-screen">
                <div className="gs-frame">
                  <div className="card">
                    <b>Today&apos;s bookings</b>
                    <i className="on" />
                    <i />
                    <i />
                  </div>
                  <button type="button" className="gs-play" aria-label="See examples" onClick={open("examples")}>
                    {play}
                  </button>
                  <div className="num">
                    40%<small>fewer no-shows</small>
                  </div>
                </div>
                <div className="gs-meta">
                  <span>A clinic booking app · 32 s</span>
                  <span className="gs-formats">
                    <span>16:9</span>
                    <span>9:16</span>
                    <span>1:1</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="gs-facts">
              <div>
                <b>Your words, read aloud</b>
                <span>A natural voice, timed word by word.</span>
              </div>
              <div>
                <b>Made for your brand</b>
                <span>Your icon, name and colour in every scene.</span>
              </div>
              <div>
                <b>Download as MP4</b>
                <span>Wide, tall or square, ready to post.</span>
              </div>
            </div>
          </>,
        )}

        {win(
          "how",
          <>
            <h2>Three steps. No editing.</h2>
            <p className="gs-lead">You bring what the product does. MotionBrief does the rest.</p>
            <div className="gs-steps">
              {[
                ["Tell us about the product", "Write the script word for word, add your icon, and answer six short questions.", "6 questions"],
                ["Hear the voice", "The script is read by a natural voice. Every word gets its own moment.", "automatic"],
                ["Watch and download", "Each scene follows the words. Download it ready to post.", "MP4"],
              ].map(([title, text, tag], i) => (
                <div key={title} className="gs-step">
                  <span className="n">{i + 1}</span>
                  <div>
                    <b>{title}</b>
                    <span>{text}</span>
                  </div>
                  <em>{tag}</em>
                </div>
              ))}
            </div>
          </>,
        )}

        {win(
          "examples",
          <>
            <h2>Made with MotionBrief.</h2>
            <p className="gs-lead">Promo videos made from a short brief.</p>
            <div className="gs-grid">
              {DEMOS.map((d, i) => (
                <figure key={i} className="gs-ex">
                  {d.src ? <video src={d.src} poster={d.poster ?? undefined} controls playsInline preload="metadata" /> : <div className="soon">Coming soon</div>}
                  <figcaption>
                    <b>{d.title}</b>
                    <span>{d.industry}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>,
        )}

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
            <div className="gs-switch">
              Have an account?{" "}
              <button type="button" onClick={open("login")}>
                Log in
              </button>
            </div>
          </form>,
        )}
      </main>

      <footer className="gs-footer">© MotionBrief</footer>

      <nav className="gs-dock gs-glass" aria-label="Main">
        {(
          [
            // (the black one carries the MotionBrief mark: the brand is not repeated above it)
            ["overview", "t1", null],
            ["how", "t2", <path key="p" d="M6 7h12M6 12h8M6 17h10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />],
            [
              "examples",
              "t3",
              <g key="p" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="4" y="5" width="7" height="6" rx="1.5" />
                <rect x="13" y="5" width="7" height="6" rx="1.5" />
                <rect x="4" y="13" width="7" height="6" rx="1.5" />
                <rect x="13" y="13" width="7" height="6" rx="1.5" />
              </g>,
            ],
          ] as const
        ).map(([id, tone, glyph]) => (
          <Link key={id} href={PATH[id]} onClick={open(id)} aria-current={current === id ? "page" : undefined}>
              <span
              ref={iconRef(id)}
              className={`gs-tile ${tone}`}
            >
              {glyph ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {glyph}
                </svg>
              ) : (
                <Mark />
              )}
            </span>
            <small>{TITLE[id]}</small>
          </Link>
        ))}
        <span className="gs-sep" aria-hidden="true" />
        {signedIn ? (
          <Link href="/dashboard" onClick={remember} className="gs-only-wide">
            <span className="gs-tile t1">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
                <rect x="4" y="5" width="7" height="6" rx="1.5" />
                <rect x="13" y="5" width="7" height="6" rx="1.5" />
                <rect x="4" y="13" width="7" height="6" rx="1.5" />
                <rect x="13" y="13" width="7" height="6" rx="1.5" />
              </svg>
            </span>
            <small>Dashboard</small>
          </Link>
        ) : (
          <Link href="/login" onClick={open("login")} className="gs-only-wide" aria-current={current === "login" ? "page" : undefined}>
            <span ref={iconRef("login")} className="gs-tile t2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" />
              </svg>
            </span>
            <small>Log in</small>
          </Link>
        )}
        {signedIn ? (
          <Link href="/projects/new" onClick={remember}>
            <span className="gs-tile t4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0a66d6" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </span>
            <small>New video</small>
          </Link>
        ) : (
          <Link href="/signup" onClick={open("signup")} aria-current={current === "signup" ? "page" : undefined}>
            <span
              ref={iconRef("signup")}
              className="gs-tile t4"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#0a66d6" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </span>
            <small>Start free</small>
          </Link>
        )}
      </nav>
    </div>
  );
}
