"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { login, signup } from "@/app/auth/actions";
import { DEMOS } from "@/components/landing/demos";
import "./site.css";

// The site before login: one glass window at a time over a still desk, and a
// dock for the menu. The one motion is a window opening — it grows smoothly
// straight out of the icon (or button) that was clicked, the way a Mac window
// comes out of its Dock icon, while the one it replaces shrinks back into its
// own icon. /, /login and /signup all render this; switching windows changes
// the address without loading a page, and Back goes to the window before.

export type SiteWindow = "overview" | "how" | "examples" | "login" | "signup";
const PATH: Record<SiteWindow, string> = { overview: "/", how: "/#how", examples: "/#examples", login: "/login", signup: "/signup" };
const TITLE: Record<SiteWindow, string> = { overview: "Overview", how: "How it works", examples: "Examples", login: "Log in", signup: "Start free" };
const windowAt = (l: Location): SiteWindow => (l.pathname.startsWith("/login") ? "login" : l.pathname.startsWith("/signup") ? "signup" : l.hash === "#how" ? "how" : l.hash === "#examples" ? "examples" : "overview");

const OPEN = { duration: 640, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };
const CLOSE = { duration: 360, easing: "cubic-bezier(0.55, 0, 0.75, 0.25)" };
const DELAY = 90;

// a window shrunk, evenly, onto the centre of an icon
function onto(win: HTMLElement, icon: Element) {
  const w = win.getBoundingClientRect(), r = icon.getBoundingClientRect();
  const dx = r.left + r.width / 2 - (w.left + w.width / 2), dy = r.top + r.height / 2 - (w.top + w.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${r.width / w.width})`;
}

type Props = { initial: SiteWindow; signedIn: boolean; error?: string; message?: string };

export function Site({ initial, signedIn, error, message }: Props) {
  const [current, setCurrent] = useState<SiteWindow>(initial);
  const [leaving, setLeaving] = useState<SiteWindow | null>(null);
  const now = useRef<SiteWindow>(initial);
  const wins = useRef<Partial<Record<SiteWindow, HTMLElement | null>>>({});
  const icons = useRef<Partial<Record<SiteWindow, HTMLElement | null>>>({});
  const from = useRef<Element | null>(null);
  const moving = useRef(false);

  const show = useCallback((id: SiteWindow, clicked: Element | null, push: boolean) => {
    if (id === now.current) return;
    from.current = clicked;
    // (with reduced motion the window simply changes)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    moving.current = !still;
    if (!still) setLeaving(now.current);
    now.current = id;
    setCurrent(id);
    if (push) window.history.pushState(null, "", PATH[id]);
  }, []);

  // the motion, once both windows are on the page
  useLayoutEffect(() => {
    if (!moving.current) return;
    moving.current = false;
    window.scrollTo({ top: 0 });
    const next = wins.current[current];
    if (!next) return;
    next.getAnimations().forEach((a) => a.cancel());
    next.style.visibility = "";
    const prev = leaving ? wins.current[leaving] : null;
    if (prev && leaving) {
      prev.getAnimations().forEach((a) => a.cancel());
      const back = icons.current[leaving];
      const out = prev.animate([{ transform: "none", opacity: 1 }, { opacity: 0, offset: 0.4 }, { transform: back ? onto(prev, back) : "scale(0.9)", opacity: 0 }], CLOSE);
      out.finished
        .then(() => {
          prev.style.visibility = "hidden";
          setLeaving((l) => (l === leaving ? null : l));
        })
        .catch(() => {});
    }
    const icon = from.current?.isConnected ? from.current : icons.current[current];
    if (icon) {
      next.animate([{ transform: onto(next, icon) }, { transform: "none" }], { ...OPEN, delay: DELAY, fill: "backwards" });
      next.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], { duration: OPEN.duration, delay: DELAY, easing: "linear", fill: "backwards" });
    }
  }, [current, leaving]);

  // Back and Forward move between windows; an address with #how or #examples opens that window
  useEffect(() => {
    const go = () => show(windowAt(window.location), icons.current[windowAt(window.location)] ?? null, false);
    if (windowAt(window.location) !== now.current) go();
    window.addEventListener("popstate", go);
    return () => window.removeEventListener("popstate", go);
  }, [show]);

  const open = (id: SiteWindow) => (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    show(id, e.currentTarget.querySelector(".gs-tile") ?? e.currentTarget, true);
  };
  const win = (id: SiteWindow, body: React.ReactNode) =>
    id === current || id === leaving ? (
      <section
        key={id}
        ref={(el) => {
          wins.current[id] = el;
        }}
        className={`gs-win gs-glass${id === leaving ? " leaving" : ""}`}
        aria-hidden={id === leaving || undefined}
      >
        <div className="gs-titlebar">
          <div className="gs-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>{TITLE[id]}</span>
        </div>
        <div className="gs-body">{body}</div>
      </section>
    ) : null;
  const play = (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M5 3v12l10-6z" fill="#1d1d1f" />
    </svg>
  );

  return (
    <div className="gs">
      <div className="gs-desk" aria-hidden="true">
        <i className="d1" />
        <i className="d2" />
        <i className="d3" />
      </div>

      <header className="gs-bar gs-glass">
        <Link href="/" className="gs-brand" onClick={open("overview")}>
          <span className="gs-mark">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3.2 1.6v8.8L10 6z" fill="#fff" />
            </svg>
          </span>
          MotionBrief
        </Link>
        {signedIn ? (
          <Link href="/dashboard" className="gs-btn">
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              ref={(el) => {
                icons.current.login = el;
              }}
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
                    <Link href="/projects/new" className="gs-btn big">
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
                <b>Three changes included</b>
                <span>Say what to change. A new version, the old one kept.</span>
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
                ["Tell us about the product", "Paste your website, or write the script yourself, word for word.", "website or script"],
                ["Hear the voice", "The script is read by a natural voice. Every word gets its own moment.", "automatic"],
                ["Watch, change, download", "Each scene follows the words. Ask for a change up to three times, then download.", "MP4"],
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
            ["overview", "t1", <path key="p" d="M9 7v10l8-5z" fill="#fff" />],
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
              ref={(el) => {
                icons.current[id] = el;
              }}
              className={`gs-tile ${tone}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {glyph}
              </svg>
            </span>
            <small>{TITLE[id]}</small>
          </Link>
        ))}
        <span className="gs-sep" aria-hidden="true" />
        {signedIn ? (
          <Link href="/projects/new">
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
              ref={(el) => {
                icons.current.signup = el;
              }}
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
