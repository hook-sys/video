import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { WALLET_NAME, type WalletId, creditsForBdt, getBilling, priceOf, walletsOffered } from "@/lib/billing";
import { finishPayment } from "@/lib/purchase";

// Loading credits by hand (supabase/migrations/20261113000037_manual_payments.sql):
// the customer sends taka by bKash, Nagad or Rocket to the number on /billing
// and submits what they sent; the team checks its wallet and approves (the
// credits added once, by finishPayment) or rejects it with a note.

export const PENDING_MAX = 3;
export const TRX_RE = /^[A-Za-z0-9]{6,30}$/;
export const SENDER_RE = /^(\+?88)?01[3-9]\d{8}$/;

export async function submitManualPayment(userId: string, input: { method: string; bdt: number; sender: string; trxId: string }): Promise<{ credits: number } | { error: string }> {
  const billing = await getBilling();
  const method = walletsOffered(billing).find((w) => w === input.method) as WalletId | undefined;
  if (!method) return { error: "Choose bKash, Nagad or Rocket." };
  const bdt = Math.floor(Number(input.bdt));
  if (!Number.isFinite(bdt) || bdt <= 0) return { error: "Enter the amount you sent, in taka." };
  const credits = creditsForBdt(billing, bdt);
  if (credits < billing.minLoad) return { error: `The smallest load is ${billing.minLoad.toLocaleString("en-US")} credits (৳${priceOf(billing, billing.minLoad).bdt.toLocaleString("en-US")}).` };
  const sender = input.sender.replace(/[\s-]/g, "");
  if (!SENDER_RE.test(sender)) return { error: `Enter the ${WALLET_NAME[method]} number you sent from, like 01XXXXXXXXX.` };
  const trx = input.trxId.trim().toUpperCase();
  if (!TRX_RE.test(trx)) return { error: "Enter the transaction ID from your payment message (letters and numbers)." };

  const db = createAdminClient();
  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending");
  if ((count ?? 0) >= PENDING_MAX) return { error: "You have payments waiting to be checked. Please wait until they're approved." };
  const { error } = await db.from("payments").insert({
    user_id: userId,
    method,
    trx_id: trx,
    sender,
    bdt,
    usd: priceOf(billing, credits).usd,
    list_usd: priceOf(billing, credits).usd,
    credits,
    status: "pending",
  });
  if (error) return { error: error.code === "23505" ? "This transaction ID was already submitted." : "Couldn't submit your payment. Please try again." };
  return { credits };
}

// The team's check: approved (the credits, changed if the amount received differs) or rejected
export async function reviewManualPayment(paymentId: string, reviewer: string, approve: boolean, opts: { credits?: number; note?: string } = {}): Promise<{ ok: true; credits?: number } | { error: string }> {
  const db = createAdminClient();
  const { data: p } = await db.from("payments").select("id, status, credits, method").eq("id", paymentId).maybeSingle();
  if (!p || !p.method || p.method === "stripe") return { error: "Payment not found." };
  if (p.status !== "pending") return { error: "This payment was already checked." };
  const note = opts.note?.trim().slice(0, 300) || null;
  const stamp = { reviewed_by: reviewer, reviewed_at: new Date().toISOString(), review_note: note };
  if (!approve) {
    const { error } = await db.from("payments").update({ ...stamp, status: "failed" }).eq("id", paymentId).eq("status", "pending");
    return error ? { error: error.message } : { ok: true };
  }
  const credits = opts.credits !== undefined && Number.isFinite(opts.credits) && opts.credits > 0 ? Math.round(opts.credits) : p.credits;
  const billing = await getBilling();
  const { error } = await db.from("payments").update({ ...stamp, credits, usd: priceOf(billing, credits).usd }).eq("id", paymentId).eq("status", "pending");
  if (error) return { error: error.message };
  // (finishPayment marks it paid and adds the credits, once)
  if (!(await finishPayment(paymentId))) return { error: "This payment was already checked." };
  return { ok: true, credits };
}
