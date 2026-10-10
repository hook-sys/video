"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, type AdminRole, audit, isAdminRole, requireAdmin, requireSuperAdmin } from "@/lib/admin";
import { SETTINGS } from "@/lib/app-settings";
import { VIDEOS_BUCKET } from "@/lib/projects";
import { checkProjectFrames } from "@/lib/frame-check";
import { BILLING_KEY, TIER_IDS, changeCredits, getBilling, normalizeBilling, refundVideo } from "@/lib/billing";

// Admin actions. Each re-checks the caller's role (and that the role may
// use the section) on the server, runs with the service role, and is
// written to admin_audit_log.

const back = (path: string, msg: string, key = "error") => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);

async function target(userId: string, section: "users" | "credits" = "users") {
  const s = await requireAdmin(section);
  const { data } = await s.db.from("profiles").select("id, email, role, status, full_name, credits").eq("id", userId).maybeSingle();
  if (!data) throw new Error("User not found.");
  return { s, user: data };
}

// ── users ──────────────────────────────────────────────────────────────────
export async function setUserStatus(userId: string, status: "active" | "suspended") {
  const { s, user } = await target(userId);
  if (user.id === s.userId) throw new Error("You can't suspend your own account.");
  if (user.role !== "user" && s.role !== "super_admin") throw new Error("Only the super admin can suspend a team member.");
  await s.db.from("profiles").update({ status }).eq("id", userId);
  await audit(s, status === "suspended" ? "user.suspend" : "user.activate", { type: "user", id: userId }, { email: user.email });
  revalidatePath("/admin/users", "layout");
}

// The customer's own details (name, email) edited by the team.
export async function saveUser(userId: string, formData: FormData) {
  const { s, user } = await target(userId);
  const name = String(formData.get("full_name") ?? "").trim().slice(0, 80) || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const path = `/admin/users/${userId}`;
  if (user.role !== "user" && s.role !== "super_admin") back(path, "Only the super admin can edit a team member.");
  if (email && email !== user.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back(path, "That email doesn't look right.");
    const { error } = await s.db.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) back(path, error.message);
  }
  await s.db.from("profiles").update({ full_name: name, ...(email ? { email } : {}) }).eq("id", userId);
  await audit(s, "user.edit", { type: "user", id: userId }, { from: { name: user.full_name, email: user.email }, to: { name, email: email || user.email } });
  revalidatePath("/admin/users", "layout");
  redirect(`${path}?saved=1`);
}

// Credits added or taken by hand, always with a reason (in the user's history).
export async function adjustCredits(userId: string, formData: FormData) {
  const { s, user } = await target(userId, "credits");
  const amount = Math.round(Number(formData.get("amount")));
  const sign = formData.get("direction") === "remove" ? -1 : 1;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const path = `/admin/users/${userId}`;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) back(path, "Enter a number of credits (1 – 1,000,000).");
  if (!reason) back(path, "Write the reason (the customer's history shows it).");
  try {
    await changeCredits(userId, sign * amount, "admin", { note: reason, actor: s.userId });
  } catch (e) {
    back(path, e instanceof Error && e.message === "insufficient_credits" ? `They have only ${user.credits} credits.` : "Couldn't change the credits.");
  }
  await audit(s, sign > 0 ? "credits.add" : "credits.remove", { type: "user", id: userId }, { email: user.email, amount, reason });
  revalidatePath("/admin/users", "layout");
  redirect(`${path}?saved=1`);
}

// ── the team (super admin only) ───────────────────────────────────────────
export async function addTeamMember(formData: FormData) {
  const s = await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) as AdminRole;
  if (!isAdminRole(role) || role === "super_admin") back("/admin/team", "Choose a role.");
  const { data: u } = await s.db.from("profiles").select("id, role").ilike("email", email).maybeSingle();
  if (!u) back("/admin/team", `No account with ${email}. They need to sign up first.`);
  if (u!.role === "super_admin") back("/admin/team", "That's the super admin.");
  await s.db.from("profiles").update({ role, admin_active: true }).eq("id", u!.id);
  await audit(s, "team.add", { type: "user", id: u!.id }, { email, role });
  revalidatePath("/admin", "layout");
  redirect("/admin/team?saved=1");
}

export async function setTeamRole(userId: string, formData: FormData) {
  const s = await requireSuperAdmin();
  const role = String(formData.get("role"));
  if (!(ADMIN_ROLES as readonly string[]).includes(role) && role !== "user") throw new Error("Unknown role.");
  if (role === "super_admin") throw new Error("There is one super admin.");
  if (userId === s.userId) throw new Error("You can't change your own role.");
  const { data: u } = await s.db.from("profiles").select("email, role").eq("id", userId).maybeSingle();
  if (u?.role === "super_admin") throw new Error("The super admin's role can't be changed.");
  await s.db.from("profiles").update({ role }).eq("id", userId);
  await audit(s, role === "user" ? "team.remove" : "team.role", { type: "user", id: userId }, { email: u?.email, from: u?.role, to: role });
  revalidatePath("/admin", "layout");
}

export async function setTeamActive(userId: string, active: boolean) {
  const s = await requireSuperAdmin();
  if (userId === s.userId) throw new Error("You can't turn yourself off.");
  const { data: u } = await s.db.from("profiles").select("email, role").eq("id", userId).maybeSingle();
  if (u?.role === "super_admin") throw new Error("The super admin is always on.");
  await s.db.from("profiles").update({ admin_active: active }).eq("id", userId);
  await audit(s, active ? "team.on" : "team.off", { type: "user", id: userId }, { email: u?.email });
  revalidatePath("/admin", "layout");
}

// ── videos ─────────────────────────────────────────────────────────────────
const FAIL_FIELDS = {
  pipeline: { pipeline_status: "failed", pipeline_error: "Stopped by an admin." },
} as const;

// For jobs stuck in running/processing: frees the project so it can be
// retried (its credits go back to the customer).
export async function markFailed(projectId: string, what: keyof typeof FAIL_FIELDS) {
  const s = await requireAdmin("videos");
  const { data: p } = await s.db.from("projects").update(FAIL_FIELDS[what]).eq("id", projectId).select("user_id").maybeSingle();
  const refunded = p ? await refundVideo(projectId, p.user_id, "Stopped by the team — credits returned").catch(() => 0) : 0;
  await audit(s, `video.stop_${what}`, { type: "project", id: projectId }, { refunded });
  revalidatePath("/admin", "layout");
}

// The frame check run again on a video (its result replaces the last one).
export async function recheckFrames(projectId: string) {
  const s = await requireAdmin("videos");
  await checkProjectFrames(projectId, 270_000);
  await audit(s, "video.frame_check", { type: "project", id: projectId });
  revalidatePath(`/admin/videos/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const s = await requireAdmin("videos");
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

// ── settings ───────────────────────────────────────────────────────────────
export async function saveSettings(formData: FormData) {
  const s = await requireAdmin("settings");
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

// ── pricing (levels, credit packs, sign-up credits) ─────────────────────────
export async function saveBilling(formData: FormData) {
  const s = await requireAdmin("billing");
  const before = await getBilling();
  const f = (k: string) => formData.get(k);
  const packs = Array.from({ length: 8 }, (_, i) => ({ usd: Number(f(`pack_usd_${i}`)), credits: Number(f(`pack_credits_${i}`)) })).filter((p) => p.usd > 0 && p.credits > 0);
  const next = normalizeBilling({
    tiers: Object.fromEntries(TIER_IDS.map((id) => [id, { name: f(`${id}_name`), blurb: f(`${id}_blurb`), badge: f(`${id}_badge`), perSecond: f(`${id}_rate`), model: f(`${id}_model`), status: f(`${id}_status`) }])),
    packs,
    signupCredits: f("signup_credits"),
    minSeconds: f("min_seconds"),
  });
  const { error } = await s.db.from("app_settings").upsert({ key: BILLING_KEY, value: next, updated_at: new Date().toISOString(), updated_by: s.userId });
  if (error) back("/admin/billing", error.message);
  await audit(s, "billing.update", { type: "settings", id: BILLING_KEY }, { from: before, to: next });
  revalidatePath("/admin/billing");
  redirect("/admin/billing?saved=1");
}

// ── coupons ────────────────────────────────────────────────────────────────
function couponFields(formData: FormData) {
  const kind = String(formData.get("kind"));
  const value = Math.round(Number(formData.get("value")));
  const maxUses = Math.round(Number(formData.get("max_uses")));
  const expires = String(formData.get("expires_at") ?? "").trim();
  return {
    kind: (["discount", "bonus", "credits"] as const).find((k) => k === kind) ?? null,
    value,
    max_uses: maxUses > 0 ? maxUses : null,
    expires_at: expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
    per_user_once: formData.get("per_user_once") === "on",
    min_usd: Math.max(0, Number(formData.get("min_usd")) || 0),
    note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
  };
}
const couponError = (c: ReturnType<typeof couponFields>) =>
  !c.kind ? "Choose what the coupon does." : !Number.isFinite(c.value) || c.value <= 0 ? "Enter the coupon's value." : c.kind === "discount" && c.value > 100 ? "A discount is at most 100%." : null;

export async function createCoupon(formData: FormData) {
  const s = await requireAdmin("coupons");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const c = couponFields(formData);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) back("/admin/coupons", "Code: 3–32 letters, digits, - or _.");
  const err = couponError(c);
  if (err) back("/admin/coupons", err);
  const { data, error } = await s.db.from("coupons").insert({ code, ...c, created_by: s.userId }).select("id").single();
  if (error) back("/admin/coupons", error.message.includes("duplicate") ? `${code} already exists.` : error.message);
  await audit(s, "coupon.create", { type: "coupon", id: data!.id }, { code, ...c });
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons?saved=1");
}

export async function saveCoupon(id: string, formData: FormData) {
  const s = await requireAdmin("coupons");
  const c = couponFields(formData);
  const err = couponError(c);
  if (err) back("/admin/coupons", err);
  const { error } = await s.db.from("coupons").update(c).eq("id", id);
  if (error) back("/admin/coupons", error.message);
  await audit(s, "coupon.update", { type: "coupon", id }, c);
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons?saved=1");
}

export async function toggleCoupon(id: string, active: boolean) {
  const s = await requireAdmin("coupons");
  await s.db.from("coupons").update({ active }).eq("id", id);
  await audit(s, active ? "coupon.on" : "coupon.off", { type: "coupon", id });
  revalidatePath("/admin/coupons");
}

// ── video rules ────────────────────────────────────────────────────────────
export async function addRule(formData: FormData) {
  const s = await requireAdmin("quality");
  const id = String(formData.get("id") ?? "").trim().toLowerCase();
  let never = String(formData.get("never") ?? "").trim();
  if (never && !/^never\b/i.test(never)) never = `never ${never}`;
  const { error } = await s.db.from("video_rules").insert({ id, never, note: String(formData.get("note") ?? "").trim() || null });
  if (error) redirect(`/admin/quality?error=${encodeURIComponent(error.message.includes("check") ? "Id: 2–40 lowercase letters, digits or dashes. Rule: 10–300 characters." : error.message)}`);
  await audit(s, "rule.create", { type: "rule", id }, { never });
  revalidatePath("/admin/quality");
}

export async function toggleRule(id: string, active: boolean) {
  const s = await requireAdmin("quality");
  await s.db.from("video_rules").update({ active }).eq("id", id);
  await audit(s, active ? "rule.enable" : "rule.disable", { type: "rule", id });
  revalidatePath("/admin/quality");
}
