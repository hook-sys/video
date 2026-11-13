"use client";

import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { projectTitle, videoState } from "@/lib/project-status";
import { AutoRefresh } from "@/components/auto-refresh";
import { Desk, Mark, remember, useWindows } from "@/components/site/windows";
import { Avatar, TopNav } from "@/components/site/top-nav";
import { STATE_UI, ago, monthStart, pipelineProgress } from "./helpers";
import type { DashboardRow } from "./page";
import { LegalFooterLinks } from "@/components/site/legal-links";
import "@/components/site/site.css";

// The customer dashboard, in the site's glass: the videos and the account,
// one window at a time, and a dock (data comes from page.tsx).

type DashWindow = "videos" | "account";
const PATH: Record<DashWindow, string> = { videos: "/dashboard", account: "/dashboard#account" };
const TITLE: Record<DashWindow, string> = { videos: "Videos", account: "Account" };
const windowAt = (l: Location): DashWindow => (l.hash === "#account" ? "account" : "videos");

// (pending: the account is waiting for the team's approval — no welcome credits yet)
export function DashboardView({ email, name, admin, pending = false, credits, projects, previews }: { email: string; name: string; admin: boolean; pending?: boolean; credits: number; projects: DashboardRow[]; previews: Record<string, string> }) {
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

      <TopNav
        home="/dashboard"
        onHome={open("videos")}
        items={[
          { href: PATH.videos, label: "Videos", active: current === "videos", onClick: open("videos"), anchor: iconRef("videos") },
          { href: "/brand", label: "Brand kits", onClick: remember },
          { href: "/billing", label: "Credits", onClick: remember },
          ...(admin ? [{ href: "/admin", label: "Admin", onClick: remember }] : []),
        ]}
        right={
          <>
            <Link href="/billing" className="md-credits" onClick={remember}>
              {admin ? "∞" : credits.toLocaleString("en-US")} credits
            </Link>
            <Link href="/projects/new" onClick={remember} className="gs-btn">
              + New video
            </Link>
            <Avatar href={PATH.account} initial={initial} onClick={open("account")} active={current === "account"} />
          </>
        }
      />

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

            {pending && <p className="gs-note info">Your account is waiting for approval. Look around and get your video ready — your welcome credits arrive as soon as it&apos;s approved.</p>}

            <div className="gs-facts four">
              {[
                { label: "Videos", value: projects.length, hint: `${thisMonth} this month` },
                { label: "Ready", value: ready.length, hint: "To watch and download" },
                { label: "In progress", value: active.length, hint: active.length ? "Updating live" : "Nothing running" },
                { label: "Credits", value: admin ? "∞" : credits.toLocaleString("en-US"), hint: `${minutes} min of video made` },
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
                <span>Credits</span>
                <b>{admin ? "Unlimited (team)" : credits.toLocaleString("en-US")}</b>
              </div>
              <div>
                <span>Videos made</span>
                <b>
                  {projects.length} · {minutes} min
                </b>
              </div>
            </div>
            <div className="gs-row" style={{ marginTop: 24 }}>
              <Link href="/billing" onClick={remember} className="gs-btn">
                Buy credits
              </Link>
              <Link href="/brand" onClick={remember} className="gs-btn ghost">
                Brand kits
              </Link>
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

      <footer className="gs-footer">
        <LegalFooterLinks />
      </footer>

    </div>
  );
}
