import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { userAccess } from "@/lib/admin";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { admin } = await userAccess(supabase, user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={logout}>
          <button className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm">
            Log out
          </button>
        </form>
      </div>
      <p className="text-foreground/70">Signed in as {user.email}</p>
      <div className="flex gap-3">
        <Link
          href="/projects/new"
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background"
        >
          Create Video
        </Link>
        <Link href="/crm" className="rounded-md border border-foreground/20 px-4 py-2 font-medium">
          CRM
        </Link>
        {admin && (
          <Link href="/admin" className="rounded-md border border-violet-500/40 px-4 py-2 font-medium text-violet-400">
            Admin
          </Link>
        )}
      </div>
    </main>
  );
}
