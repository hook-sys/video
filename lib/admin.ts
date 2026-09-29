import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Super admin panel (/admin). Roles live in profiles.role, which users can't
// change themselves. 'super_admin' can also change roles; 'admin' can do the rest.
export type AdminRole = "admin" | "super_admin";
export const isAdminRole = (role?: string | null): role is AdminRole => role === "admin" || role === "super_admin";

export type AdminSession = { userId: string; email: string; role: AdminRole; db: SupabaseClient };

// Non-admins get a 404, so the panel's existence isn't revealed.
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (!isAdminRole(data?.role) || data?.status !== "active") notFound();
  return { userId: user.id, email: user.email ?? "", role: data.role, db: createAdminClient() };
});

export async function audit(
  s: AdminSession,
  action: string,
  target?: { type: string; id: string },
  detail: Record<string, unknown> = {},
) {
  await s.db.from("admin_audit_log").insert({
    actor_id: s.userId,
    actor_email: s.email,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    detail,
  });
}

// For the customer app: is this user an admin (exempt from limits), or
// suspended? Reads the user's own profile with their session (RLS allows it).
export async function userAccess(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("role, status").eq("id", userId).maybeSingle();
  return { admin: isAdminRole(data?.role), suspended: data?.status === "suspended" };
}
