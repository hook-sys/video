import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { projectTitle, videoState } from "@/lib/project-status";
import { Logo, LogoMark } from "@/components/brand/logo";
import { AutoRefresh } from "@/components/auto-refresh";
import { STATE_UI, ago, monthStart, pipelineProgress } from "./helpers";
import type { DashboardRow } from "./page";

// The customer dashboard (presentational; data comes from page.tsx).
export function DashboardView({
  email,
  name,
  admin,
  plan,
  projects,
  previews,
}: {
  email: string;
  name: string;
  admin: boolean;
  plan: string;
  projects: DashboardRow[];
  previews: Record<string, string>;
}) {
  const withState = projects.map((p) => ({ ...p, state: videoState(p) }));
  const ready = withState.filter((p) => p.state === "completed");
  const active = withState.filter((p) => p.state === "generating" || p.state === "rendering");
  const thisMonth = projects.filter((p) => p.created_at >= monthStart()).length;
  const seconds = ready.reduce((a, p) => a + (p.duration_seconds ?? 0), 0);


  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AutoRefresh active={active.length > 0} intervalMs={8000} />
      <header className="sticky top-0 z-20 border-b border-foreground/[0.07] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" aria-label="MotionBrief home">
            <Logo size={28} className="text-lg" />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-sm md:flex">
            <Link href="/dashboard" className="rounded-lg bg-foreground/[0.06] px-3 py-1.5 font-medium">Videos</Link>
            {admin && (
              <Link href="/admin" className="rounded-lg px-3 py-1.5 text-violet-600 transition hover:bg-violet-500/10 dark:text-violet-300">Admin</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/projects/new" className="inline-flex rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90">
              + New video
            </Link>
            <details className="relative">
              <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-semibold uppercase text-white [&::-webkit-details-marker]:hidden">
                {(email || "?")[0]}
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-foreground/10 bg-background p-2 shadow-2xl shadow-black/20">
                <p className="truncate px-3 py-2 text-xs text-foreground/50">{email}</p>
                {admin && <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm text-violet-600 hover:bg-violet-500/10 md:hidden dark:text-violet-300">Admin panel</Link>}
                <form action={logout}>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/[0.05]">Log out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-500/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-white/70">Welcome back, {name}</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What are we making today?</h1>
              <p className="max-w-md text-white/75">Write a brief. MotionBrief directs, voices and renders your promo video.</p>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/projects/new" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-semibold text-violet-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:flex-none">
                Create a video <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: "Videos", value: projects.length, hint: `${thisMonth} this month` },
            { label: "Ready", value: ready.length, hint: "Ready to download" },
            { label: "In progress", value: active.length, hint: active.length ? "Updating live" : "Nothing running" },
            { label: "Plan", value: plan, hint: `${Math.round(seconds / 6) / 10} min of video made` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-foreground/45">{s.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-foreground/50">{s.hint}</p>
            </div>
          ))}
        </section>

        {active.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">In progress</h2>
            {active.map((p) => {
              const { pct, label } = pipelineProgress(p.pipeline_step, p.state);
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-4 rounded-2xl bg-violet-500/[0.05] p-4 ring-1 ring-violet-500/20 transition hover:ring-violet-500/40">
                  <LogoMark size={40} animated loopMs={3000} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium">{projectTitle(p)}</p>
                      <p className="shrink-0 text-xs text-foreground/50">{label}…</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-700" style={{ width: `${Math.round(pct * 100)}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold">Your videos</h2>
            {projects.length > 0 && <p className="text-sm text-foreground/50">{projects.length} total</p>}
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-foreground/15 px-6 py-16 text-center">
              <LogoMark size={56} animated loopMs={5000} />
              <div>
                <p className="text-lg font-semibold">No videos yet</p>
                <p className="mt-1 text-sm text-foreground/55">Your first promo is one brief away.</p>
              </div>
              <Link href="/projects/new" className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background">Create your first video</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {withState.map((p) => {
                const ui = STATE_UI[p.state];
                const src = p.video_path ? previews[p.video_path] : undefined;
                const color = p.brand_color ?? "#7c3aed";
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="group overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-xl hover:shadow-black/10">
                    <div className="relative aspect-video overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, #1e1b4b)` }}>
                      {src ? (
                        <video src={`${src}#t=1.5`} preload="metadata" muted playsInline className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                            <LogoMark size={40} animated={p.state === "generating" || p.state === "rendering"} loopMs={3000} />
                          </div>
                        </div>
                      )}
                      {src && (
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                          <span className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">▶</span>
                        </span>
                      )}
                      {p.duration_seconds ? <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">{Math.floor(p.duration_seconds / 60)}:{String(p.duration_seconds % 60).padStart(2, "0")}</span> : null}
                    </div>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{projectTitle(p)}</p>
                        <p className="mt-0.5 text-xs text-foreground/50">{ago(p.created_at)}{p.format ? ` · ${p.format}` : ""}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ui.cls}`}>{ui.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Link href="/projects/new" aria-label="Create a video" className="fixed bottom-5 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-3xl text-white shadow-xl shadow-violet-500/40 sm:hidden">
        +
      </Link>
    </div>
  );
}
