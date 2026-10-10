"use client";

import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { projectTitle, videoState } from "@/lib/project-status";
import { AutoRefresh } from "@/components/auto-refresh";
import { Desk, Mark, remember, useWindows } from "@/components/site/windows";
import { STATE_UI, ago, monthStart, pipelineProgress } from "./helpers";
import type { DashboardRow } from "./page";
import "@/components/site/site.css";

// The customer dashboard, in the site's glass: the videos and the account,
// one window at a time, and a dock (data comes from page.tsx).

type DashWindow = "videos" | "account";
const PATH: Record<DashWindow, string> = { videos: "/dashboard", account: "/dashboard#account" };
const TITLE: Record<DashWindow, string> = { videos: "Videos", account: "Account" };
const windowAt = (l: Location): DashWindow => (l.hash === "#account" ? "account" : "videos");

export function DashboardView({ email, name, admin, plan, projects, previews }: { email: string; name: string; admin: boolean; plan: string; projects: DashboardRow[]; previews: Record<string, string> }) {
  const { current, open, win, iconRef } = useWindows<DashWindow>("videos", PATH, windowAt, TITLE);
  const withState = projects.map((p) => ({ ...p, state: videoState(p) }));
  const ready = withState.filter((p) => p.state === "completed");
  const active = withState.filter((p) => p.state === "generating" || p.state === "rendering");
  const thisMonth = projects.filter((p) => p.created_at >= monthStart()).length;
  const seconds = ready.reduce((a, p) => a + (p.duration_seconds ?? 0), 0);
  const minutes = Math.round(seconds / 6) / 10;
  const initial = (name || email || "?")[0];

  return (
    <div className="gs">
      <AutoRefresh active={active.length > 0} intervalMs={8000} />
      <Desk />

      <header className="gs-bar gs-glass">
        <Link href="/dashboard" className="gs-brand" onClick={open("videos")}>
          <Mark />
          MotionBrief
        </Link>
        <Link href="/projects/new" onClick={remember} className="gs-btn">
          New video
        </Link>
      </header>

      <main className="gs-stage">
        {win(
          "videos",
          <>
            <div className="gs-head">
              <div>
                <p className="gs-kicker">Welcome back, {name}</p>
                <h2>Your videos</h2>
              </div>
              <Link href="/projects/new" onClick={remember} className="gs-btn big">
                Create a video
              </Link>
            </div>

            <div className="gs-facts four">
              {[
                { label: "Videos", value: projects.length, hint: `${thisMonth} this month` },
                { label: "Ready", value: ready.length, hint: "To watch and download" },
                { label: "In progress", value: active.length, hint: active.length ? "Updating live" : "Nothing running" },
                { label: "Plan", value: plan, hint: `${minutes} min of video made` },
              ].map((s) => (
                <div key={s.label}>
                  <small>{s.label}</small>
                  <strong>{s.value}</strong>
                  <span>{s.hint}</span>
                </div>
              ))}
            </div>

            {active.length > 0 && (
              <div className="gs-section">
                <h3>In progress</h3>
                <div className="gs-running">
                  {active.map((p) => {
                    const { pct, label } = pipelineProgress(p.pipeline_step, p.state);
                    return (
                      <Link key={p.id} href={`/projects/${p.id}`} className="gs-run" onClick={remember}>
                        <b>{projectTitle(p)}</b>
                        <span>{label}…</span>
                        <div className="gs-bar-track">
                          <i style={{ width: `${Math.round(pct * 100)}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="gs-section">
              <h3>{projects.length ? `All videos · ${projects.length}` : "All videos"}</h3>
              {projects.length === 0 ? (
                <div className="gs-empty">
                  <b>No videos yet</b>
                  <p>Your first video is one brief away.</p>
                  <Link href="/projects/new" onClick={remember} className="gs-btn">
                    Create your first video
                  </Link>
                </div>
              ) : (
                <div className="gs-videos">
                  {withState.map((p) => {
                    const ui = STATE_UI[p.state];
                    const src = p.video_path ? previews[p.video_path] : undefined;
                    return (
                      <Link key={p.id} href={`/projects/${p.id}`} className="gs-card" onClick={remember}>
                        <div className="gs-thumb" style={{ background: p.brand_color ?? "#1d1d1f" }}>
                          {src ? <video src={`${src}#t=1.5`} preload="metadata" muted playsInline /> : <Mark />}
                          {p.duration_seconds ? (
                            <span className="len">
                              {Math.floor(p.duration_seconds / 60)}:{String(p.duration_seconds % 60).padStart(2, "0")}
                            </span>
                          ) : null}
                        </div>
                        <div className="gs-card-body">
                          <div>
                            <b>{projectTitle(p)}</b>
                            <span suppressHydrationWarning>
                              {ago(p.created_at)}
                              {p.format ? ` · ${p.format}` : ""}
                            </span>
                          </div>
                          <span className={`gs-pill ${ui.tone}`}>{ui.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>,
        )}

        {win(
          "account",
          <>
            <p className="gs-kicker">Signed in</p>
            <h2>Your account</h2>
            <div className="gs-account">
              <div>
                <span>Email</span>
                <b>{email}</b>
              </div>
              <div>
                <span>Plan</span>
                <b>{plan}</b>
              </div>
              <div>
                <span>Videos made</span>
                <b>
                  {projects.length} · {minutes} min
                </b>
              </div>
            </div>
            <div className="gs-row" style={{ marginTop: 24 }}>
              {admin && (
                <Link href="/admin" onClick={remember} className="gs-btn ghost">
                  Admin panel
                </Link>
              )}
              <form action={logout}>
                <button className="gs-btn ghost">Log out</button>
              </form>
            </div>
          </>,
        )}
      </main>

      <footer className="gs-footer">© MotionBrief</footer>

      <nav className="gs-dock gs-glass" aria-label="Main">
        <Link href="/" className="gs-dock-brand gs-only-wide" onClick={remember} aria-label="MotionBrief home">
          <Mark />
        </Link>
        <Link href={PATH.videos} onClick={open("videos")} aria-current={current === "videos" ? "page" : undefined}>
          <span ref={iconRef("videos")} className="gs-tile t1">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="5" width="7" height="6" rx="1.5" />
              <rect x="13" y="5" width="7" height="6" rx="1.5" />
              <rect x="4" y="13" width="7" height="6" rx="1.5" />
              <rect x="13" y="13" width="7" height="6" rx="1.5" />
            </svg>
          </span>
          <small>Videos</small>
        </Link>
        <Link href={PATH.account} onClick={open("account")} aria-current={current === "account" ? "page" : undefined}>
          <span ref={iconRef("account")} className="gs-tile t5">
            <span className="initial">{initial}</span>
          </span>
          <small>Account</small>
        </Link>
        {admin && (
          <Link href="/admin" onClick={remember}>
            <span className="gs-tile t3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 7h14M5 12h14M5 17h14" />
                <circle cx="9" cy="7" r="1.6" fill="#fff" />
                <circle cx="15" cy="12" r="1.6" fill="#fff" />
                <circle cx="8" cy="17" r="1.6" fill="#fff" />
              </svg>
            </span>
            <small>Admin</small>
          </Link>
        )}
        <span className="gs-sep" aria-hidden="true" />
        <Link href="/projects/new" onClick={remember}>
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
