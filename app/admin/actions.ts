"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, requireAdmin } from "@/lib/admin";
import { SETTINGS } from "@/lib/app-settings";
import { VIDEOS_BUCKET } from "@/lib/projects";

// Admin actions. Each re-checks the caller's role on the server, runs with
// the service role, and is written to admin_audit_log.

const ROLES = ["user", "admin", "super_admin"] as const;

async function target(userId: string) {
  const s = await requireAdmin();
  const { data } = await s.db.from("profiles").select("id, email, role, status").eq("id", userId).maybeSingle();
  if (!data) throw new Error("User not found.");
  return { s, user: data };
}

export async function setUserStatus(userId: string, status: "active" | "suspended") {
  const { s, user } = await target(userId);
  if (user.id === s.userId) throw new Error("You can't suspend your own account.");
  if (user.role !== "user" && s.role !== "super_admin") throw new Error("Only a super admin can suspend an admin.");
  await s.db.from("profiles").update({ status }).eq("id", userId);
  await audit(s, status === "suspended" ? "user.suspend" : "user.activate", { type: "user", id: userId }, { email: user.email });
  revalidatePath("/admin/users", "layout");
}

export async function setUserRole(userId: string, formData: FormData) {
  const role = String(formData.get("role"));
  if (!ROLES.includes(role as (typeof ROLES)[number])) throw new Error("Unknown role.");
  const { s, user } = await target(userId);
  if (s.role !== "super_admin") throw new Error("Only a super admin can change roles.");
  if (user.id === s.userId) throw new Error("You can't change your own role.");
  await s.db.from("profiles").update({ role }).eq("id", userId);
  await audit(s, "user.role", { type: "user", id: userId }, { email: user.email, from: user.role, to: role });
  revalidatePath("/admin/users", "layout");
}

export async function setUserPlan(userId: string, formData: FormData) {
  const plan = String(formData.get("plan") ?? "") || null;
  const { s, user } = await target(userId);
  await s.db.from("profiles").update({ plan_id: plan }).eq("id", userId);
  await audit(s, "user.plan", { type: "user", id: userId }, { email: user.email, plan });
  revalidatePath("/admin/users", "layout");
}

const FAIL_FIELDS = {
  pipeline: { pipeline_status: "failed", pipeline_error: "Stopped by an admin." },
  render: { render_status: "failed", render_error: "Stopped by an admin." },
  render4k: { render_4k_status: "failed", render_4k_error: "Stopped by an admin." },
} as const;

// For jobs stuck in running/processing: frees the project so it can be retried.
export async function markFailed(projectId: string, what: keyof typeof FAIL_FIELDS) {
  const s = await requireAdmin();
  await s.db.from("projects").update(FAIL_FIELDS[what]).eq("id", projectId);
  await audit(s, `video.stop_${what}`, { type: "project", id: projectId });
  revalidatePath("/admin", "layout");
}

export async function deleteProject(projectId: string) {
  const s = await requireAdmin();
  const { data: p } = await s.db.from("projects").select("id, user_id, brand_name, video_path, video_4k_path").eq("id", projectId).maybeSingle();
  if (!p) throw new Error("Video not found.");
  const files = [p.video_path, p.video_4k_path].filter((f): f is string => !!f);
  if (files.length) await s.db.storage.from(VIDEOS_BUCKET).remove(files);
  const { error } = await s.db.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  await audit(s, "video.delete", { type: "project", id: projectId }, { owner: p.user_id, brand: p.brand_name });
  revalidatePath("/admin", "layout");
  redirect("/admin/videos");
}

export async function saveSettings(formData: FormData) {
  const s = await requireAdmin();
  const { data: before } = await s.db.from("app_settings").select("key, value");
  const old = Object.fromEntries((before ?? []).map((r) => [r.key, r.value]));
  const rows = SETTINGS.map((def) => {
    const raw = formData.get(def.key);
    const value =
      def.type === "bool" ? raw === "on" : def.type === "number" ? Math.max(0, Math.round(Number(raw) || 0)) : String(raw ?? "").trim().slice(0, 300);
    return { key: def.key, value, updated_at: new Date().toISOString(), updated_by: s.userId };
  });
  const changed = rows.filter((r) => JSON.stringify(old[r.key]) !== JSON.stringify(r.value));
  if (changed.length) {
    const { error } = await s.db.from("app_settings").upsert(changed);
    if (error) throw new Error(error.message);
    await audit(s, "settings.update", { type: "settings", id: "app" }, Object.fromEntries(changed.map((r) => [r.key, { from: old[r.key] ?? null, to: r.value }])));
  }
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?saved=${changed.length}`);
}

export async function savePlan(planId: string, formData: FormData) {
  const s = await requireAdmin();
  const fields = {
    name: String(formData.get("name") ?? "").trim().slice(0, 40) || planId,
    price_usd_month: Math.max(0, Number(formData.get("price")) || 0),
    videos_per_month: Math.max(0, Math.round(Number(formData.get("videos")) || 0)),
    allow_4k: formData.get("allow_4k") === "on",
    active: formData.get("active") === "on",
  };
  const { error } = await s.db.from("plans").update(fields).eq("id", planId);
  if (error) throw new Error(error.message);
  await audit(s, "plan.update", { type: "plan", id: planId }, fields);
  revalidatePath("/admin/billing");
}

export async function addPlan(formData: FormData) {
  const s = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (id.length < 2) redirect("/admin/billing?error=Plan name is too short.");
  const { error } = await s.db.from("plans").insert({ id, name, sort: 99 });
  if (error) redirect(`/admin/billing?error=${encodeURIComponent(error.message)}`);
  await audit(s, "plan.create", { type: "plan", id }, { name });
  revalidatePath("/admin/billing");
}

export async function addRule(formData: FormData) {
  const s = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim().toLowerCase();
  let never = String(formData.get("never") ?? "").trim();
  if (never && !/^never\b/i.test(never)) never = `never ${never}`;
  const { error } = await s.db.from("video_rules").insert({ id, never, note: String(formData.get("note") ?? "").trim() || null });
  if (error) redirect(`/admin/quality?error=${encodeURIComponent(error.message.includes("check") ? "Id: 2–40 lowercase letters, digits or dashes. Rule: 10–300 characters." : error.message)}`);
  await audit(s, "rule.create", { type: "rule", id }, { never });
  revalidatePath("/admin/quality");
}

export async function toggleRule(id: string, active: boolean) {
  const s = await requireAdmin();
  await s.db.from("video_rules").update({ active }).eq("id", id);
  await audit(s, active ? "rule.enable" : "rule.disable", { type: "rule", id });
  revalidatePath("/admin/quality");
}
