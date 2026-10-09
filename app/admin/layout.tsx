import type { Metadata } from "next";
import Link from "next/link";
import { Desk, Mark } from "@/components/site/windows";
import "@/components/site/site.css";
import { logout } from "@/app/auth/actions";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "./_components/nav";
import { Badge } from "./_components/ui";
import { ROLE_LABEL, daysAgo } from "./_components/format";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · MotionBrief" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const s = await requireAdmin();
  // Sidebar badge: videos stuck or failed in the last 24 hours.
  const since = daysAgo(1);
  const { count: failed } = await s.db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", since)
    .eq("pipeline_status", "failed");

  return (
    <div className="gs gs-dark">
      <Desk />
      <header className="gs-bar gs-glass admin">
        <Link href="/admin" className="gs-brand">
          <Mark />
          MotionBrief
        </Link>
        <Badge tone="violet">{ROLE_LABEL[s.role]}</Badge>
        <div className="ml-auto hidden items-center gap-3 text-sm sm:flex">
          <span className="text-zinc-500">{s.email}</span>
          <Link href="/dashboard" className="gs-plain">
            Open app
          </Link>
          <form action={logout}>
            <button className="gs-btn ghost">Log out</button>
          </form>
        </div>
      </header>
      <AdminNav badges={{ "/admin/queue": failed ?? 0 }} />
      <main className="gs-admin-stage">
        <section className="gs-win gs-glass">
          <div className="gs-titlebar">
            <div className="gs-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>Admin</span>
          </div>
          <div className="flex flex-col gap-6 p-5 sm:p-8">{children}</div>
        </section>
      </main>
    </div>
  );
}
