import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
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
    .or("pipeline_status.eq.failed,render_status.eq.failed,render_4k_status.eq.failed");

  return (
    <div className="min-h-screen bg-[#08080c] text-zinc-200 [color-scheme:dark]">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-4 border-b border-white/[0.06] bg-[#08080c]/85 px-5 backdrop-blur">
        <Link href="/admin" className="text-white">
          <Logo size={26} />
        </Link>
        <Badge tone="violet">{ROLE_LABEL[s.role]}</Badge>
        <div className="ml-auto hidden items-center gap-4 text-sm sm:flex lg:mr-0">
          <span className="text-zinc-500">{s.email}</span>
          <Link href="/dashboard" className="text-zinc-400 hover:text-white">Open app →</Link>
          <form action={logout}>
            <button className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-300 hover:bg-white/5">Log out</button>
          </form>
        </div>
      </header>
      <div className="pt-16">
        <AdminNav badges={{ "/admin/queue": failed ?? 0 }} />
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:pl-[calc(16rem+2rem)]">{children}</main>
      </div>
    </div>
  );
}
