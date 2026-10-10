import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Waiting for approval" };

// A new account waiting for the team's approval (app_settings
// "require_approval") sees only this; approved, it goes on to its videos.
export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const access = await userAccess(supabase, user.id);
  if (access.suspended) redirect("/login?error=" + encodeURIComponent("This account is suspended. Contact support."));
  if (!access.pending) redirect("/dashboard");
  return (
    <AppShell
      title="Waiting for approval"
      admin={false}
      active={null}
      initial={(user.email ?? "?")[0]}
      action={
        <form action={logout}>
          <button className="gs-btn">Log out</button>
        </form>
      }
    >
      <div className="flex flex-col gap-3 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Thanks for signing up!</h1>
        <p className="text-foreground/70">
          Your account <b>{user.email}</b> is waiting for approval. We&apos;re letting people in a few at a time — you&apos;ll be able to make videos as soon as it&apos;s approved.
        </p>
        <p className="text-sm text-foreground/50">Come back to this page any time; it opens your videos once you&apos;re in.</p>
      </div>
    </AppShell>
  );
}
