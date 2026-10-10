import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The admin panel (/admin) and its team. Roles live in profiles.role, which
// users can't change themselves. The super admin can do everything and is
// the only one who manages the team; every other role sees its own sections.
// profiles.admin_active turns a team member's admin access off (their
// customer account stays as it is).
export const ADMIN_ROLES = ["super_admin", "admin", "support", "finance", "content"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const isAdminRole = (role?: string | null): role is AdminRole => (ADMIN_ROLES as readonly string[]).includes(role ?? "");

export const SECTIONS = ["overview", "queue", "costs", "quality", "users", "credits", "videos", "billing", "coupons", "content", "settings", "models", "audit", "team"] as const;
export type Section = (typeof SECTIONS)[number];
// (the super admin: every section)
export const ROLE_SECTIONS: Record<Exclude<AdminRole, "super_admin">, readonly Section[]> = {
  admin: ["overview", "queue", "costs", "quality", "users", "credits", "videos", "billing", "coupons", "content", "settings", "models", "audit"],
  support: ["overview", "queue", "users", "videos"],
  finance: ["overview", "costs", "users", "credits", "billing", "coupons", "audit"],
  content: ["overview", "queue", "quality", "videos", "content"],
};
export const ROLE_INFO: Record<AdminRole, { label: string; help: string }> = {
  super_admin: { label: "Super admin", help: "Everything, and manages the team." },
  admin: { label: "Admin", help: "Everything but the team." },
  support: { label: "Support", help: "Users and videos: help customers, see their videos." },
  finance: { label: "Finance", help: "Credits, pricing, coupons, payments and costs." },
  content: { label: "Content", help: "Videos, video rules and site content." },
};
export const canSee = (role: AdminRole, section: Section) => role === "super_admin" || ROLE_SECTIONS[role].includes(section);

export type AdminSession = { userId: string; email: string; role: AdminRole; db: SupabaseClient; can: (s: Section) => boolean };

const session = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("role, status, admin_active").eq("id", user.id).maybeSingle();
  const role = data?.role;
  if (!isAdminRole(role) || data?.status !== "active" || (role !== "super_admin" && data?.admin_active === false)) notFound();
  return { userId: user.id, email: user.email ?? "", role, db: createAdminClient(), can: (s: Section) => canSee(role, s) };
});

// Non-team users (and a section the role may not see) get a 404, so the
// panel's existence isn't revealed.
export async function requireAdmin(section?: Section): Promise<AdminSession> {
  const s = await session();
  if (section && !s.can(section)) notFound();
  return s;
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const s = await session();
  if (s.role !== "super_admin") notFound();
  return s;
}

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

// For the customer app: is this user an admin (exempt from limits and
// credits: the super admin and active admins), or suspended? Reads the
// user's own profile with their session (RLS allows it).
export async function userAccess(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("role, status, admin_active").eq("id", userId).maybeSingle();
  const admin = data?.role === "super_admin" || (data?.role === "admin" && data?.admin_active !== false);
  // (pending: waiting for the team to approve it — app_settings "require_approval")
  return { admin, suspended: data?.status === "suspended", pending: data?.status === "pending" };
}
