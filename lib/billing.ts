import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Billing, type TierId, creditsFor, normalizeBilling, BILLING_KEY } from "@/lib/billing-config";

export * from "@/lib/billing-config";

// Credits on the server: the pricing the super admin set (/admin/billing),
// and every change to a balance — through credit_change() in the database,
// so each one is atomic, logged in credit_ledger and never below zero.

export async function getBilling(): Promise<Billing> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", BILLING_KEY).maybeSingle();
    return normalizeBilling(data?.value);
  } catch {
    return normalizeBilling(null);
  }
}

type Change = { note?: string | null; project?: string | null; payment?: string | null; coupon?: string | null; actor?: string | null; allowNegative?: boolean };

// The balance after; throws "insufficient_credits" when it would go below zero.
export async function changeCredits(userId: string, delta: number, kind: "signup" | "purchase" | "bonus" | "coupon" | "video" | "refund" | "adjust" | "admin", c: Change = {}): Promise<number> {
  const { data, error } = await createAdminClient().rpc("credit_change", {
    p_user: userId,
    p_delta: Math.round(delta),
    p_kind: kind,
    p_note: c.note ?? null,
    p_project: c.project ?? null,
    p_payment: c.payment ?? null,
    p_coupon: c.coupon ?? null,
    p_actor: c.actor ?? null,
    p_allow_negative: c.allowNegative ?? false,
  });
  if (error) throw new Error(error.message.includes("insufficient_credits") ? "insufficient_credits" : error.message);
  return data as number;
}

// Has this customer paid (a purchase, or credits the team added)? Paid-only levels need it.
export async function hasPaid(userId: string) {
  const db = createAdminClient();
  const [{ count: bought }, { count: given }] = await Promise.all([
    db.from("payments").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "paid").gt("usd", 0),
    db.from("credit_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "admin").gt("delta", 0),
  ]);
  return (bought ?? 0) + (given ?? 0) > 0;
}

export async function balanceOf(userId: string) {
  const { data } = await createAdminClient().from("profiles").select("credits").eq("id", userId).maybeSingle();
  return data?.credits ?? 0;
}

// The sign-up credits, once per account, after the email is confirmed (and
// the account approved, when the team approves new accounts).
export async function grantSignupCredits(userId: string, emailConfirmed: boolean) {
  if (!emailConfirmed) return;
  const billing = await getBilling();
  if (billing.signupCredits <= 0) return;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("status").eq("id", userId).maybeSingle();
  if (profile?.status !== "active") return;
  const { count } = await admin.from("credit_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "signup");
  if (count) return;
  // (a second call at the same moment meets the unique index and is ignored)
  await changeCredits(userId, billing.signupCredits, "signup", { note: "Welcome credits" }).catch(() => {});
}

// A video's credits are taken when it starts (its estimated length) and
// held by the project: settled to its real length when it is made, given
// back if it fails.
export async function chargeVideo(projectId: string, userId: string, tier: TierId, seconds: number) {
  const billing = await getBilling();
  const credits = creditsFor(billing, tier, seconds);
  if (credits <= 0) return 0;
  await changeCredits(userId, -credits, "video", { project: projectId, note: `${billing.tiers[tier].name} video · ~${Math.ceil(seconds)} s` });
  await createAdminClient().from("projects").update({ credits_charged: credits }).eq("id", projectId);
  return credits;
}

// What the project still holds (from the ledger, never from a column a client could touch).
async function held(projectId: string) {
  const { data } = await createAdminClient().from("credit_ledger").select("delta, kind").eq("project_id", projectId);
  return -(data ?? []).filter((r) => r.kind === "video" || r.kind === "refund" || r.kind === "adjust").reduce((a, r) => a + r.delta, 0);
}

export async function refundVideo(projectId: string, userId: string, why = "Video failed — credits returned") {
  const credits = await held(projectId);
  if (credits <= 0) return 0;
  await changeCredits(userId, credits, "refund", { project: projectId, note: why });
  await createAdminClient().from("projects").update({ credits_charged: 0 }).eq("id", projectId);
  return credits;
}

// The real length known (the voice): the difference taken or given back.
export async function settleVideo(projectId: string, userId: string, tier: TierId, seconds: number) {
  const billing = await getBilling();
  const due = creditsFor(billing, tier, seconds);
  const now = await held(projectId);
  if (now <= 0 || due === now) return now;
  await changeCredits(userId, now - due, "adjust", { project: projectId, note: `Real length ${Math.ceil(seconds)} s`, allowNegative: true });
  await createAdminClient().from("projects").update({ credits_charged: due }).eq("id", projectId);
  return due;
}
