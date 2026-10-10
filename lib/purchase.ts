import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { changeCredits, getBilling, withCoupon, type CouponKind } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

// Buying credits: a pack (and a coupon), paid with Stripe Checkout, credited
// once — by the webhook, or when the customer comes back from Stripe,
// whichever is first. Coupons that give credits outright are redeemed here too.

type Coupon = { id: string; code: string; kind: CouponKind; value: number; active: boolean; expires_at: string | null; max_uses: number | null; per_user_once: boolean; min_usd: number };

// A coupon this customer may use now (else why not).
export async function couponFor(userId: string, rawCode: string, opts: { purchaseUsd?: number; redeem?: boolean } = {}): Promise<{ coupon: Coupon } | { error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Enter a code." };
  const db = createAdminClient();
  const { data: c } = await db.from("coupons").select("id, code, kind, value, active, expires_at, max_uses, per_user_once, min_usd").eq("code", code).maybeSingle();
  if (!c || !c.active) return { error: "That code isn't valid." };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { error: "That code has expired." };
  if (opts.redeem && c.kind !== "credits") return { error: "This code works when you buy credits — enter it on a pack." };
  if (!opts.redeem && c.kind === "credits") return { error: "This code gives credits — use “Redeem a code” below." };
  if (opts.purchaseUsd !== undefined && Number(c.min_usd) > opts.purchaseUsd) return { error: `This code needs a pack of $${Number(c.min_usd)} or more.` };
  const [{ count: used }, { count: mine }] = await Promise.all([
    db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id),
    db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id).eq("user_id", userId),
  ]);
  if (c.max_uses && (used ?? 0) >= c.max_uses) return { error: "That code has been used up." };
  if (c.per_user_once && (mine ?? 0) > 0) return { error: "You've already used this code." };
  return { coupon: { ...c, min_usd: Number(c.min_usd) } as Coupon };
}

async function redeemed(couponId: string, userId: string, credits: number, paymentId: string | null) {
  const db = createAdminClient();
  await db.from("coupon_redemptions").insert({ coupon_id: couponId, user_id: userId, credits, payment_id: paymentId });
  const { count } = await db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", couponId);
  await db.from("coupons").update({ uses: count ?? 0 }).eq("id", couponId);
}

// A code that gives credits outright.
export async function redeemCode(userId: string, code: string): Promise<{ credits: number } | { error: string }> {
  const r = await couponFor(userId, code, { redeem: true });
  if ("error" in r) return r;
  await changeCredits(userId, r.coupon.value, "coupon", { coupon: r.coupon.id, note: `Code ${r.coupon.code}` });
  await redeemed(r.coupon.id, userId, r.coupon.value, null);
  return { credits: r.coupon.value };
}

// A pack bought: the Stripe Checkout page to send the customer to (or, at
// $0 after a 100% discount, the credits straight away).
export async function startPurchase(userId: string, email: string | null, packIndex: number, code: string, origin: string): Promise<{ url: string } | { error: string }> {
  const billing = await getBilling();
  const pack = billing.packs[packIndex];
  if (!pack) return { error: "Choose a pack." };
  let coupon: Coupon | null = null;
  if (code.trim()) {
    const r = await couponFor(userId, code, { purchaseUsd: pack.usd });
    if ("error" in r) return r;
    coupon = r.coupon;
  }
  const deal = withCoupon(pack, coupon);
  const db = createAdminClient();
  const { data: payment, error } = await db
    .from("payments")
    .insert({ user_id: userId, usd: deal.usd, list_usd: pack.usd, credits: deal.credits, bonus: deal.bonus, coupon_id: coupon?.id ?? null })
    .select("id")
    .single();
  if (error || !payment) return { error: "Couldn't start the purchase. Please try again." };
  if (deal.usd <= 0) {
    await finishPayment(payment.id);
    return { url: `${origin}/billing?paid=1` };
  }
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email ?? undefined,
      client_reference_id: userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(deal.usd * 100),
            product_data: { name: `${(deal.credits + deal.bonus).toLocaleString("en-US")} MotionBrief credits`, description: coupon ? `Code ${coupon.code}` : undefined },
          },
        },
      ],
      metadata: { payment_id: payment.id, user_id: userId },
      success_url: `${origin}/billing?paid=1&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?cancelled=1`,
    });
    await db.from("payments").update({ stripe_session_id: session.id }).eq("id", payment.id);
    return { url: session.url! };
  } catch (e) {
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    console.error("stripe checkout failed:", e instanceof Error ? e.message : e);
    return { error: "Payments aren't available right now. Please try again later." };
  }
}

// A paid purchase credited — once (the first caller marks it paid).
export async function finishPayment(paymentId: string) {
  const db = createAdminClient();
  const { data: p } = await db.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "pending").select("id, user_id, credits, bonus, coupon_id, usd").maybeSingle();
  if (!p) return false;
  await changeCredits(p.user_id, p.credits, "purchase", { payment: p.id, note: `Bought ${p.credits.toLocaleString("en-US")} credits ($${Number(p.usd).toFixed(2)})` });
  if (p.bonus > 0) await changeCredits(p.user_id, p.bonus, "bonus", { payment: p.id, coupon: p.coupon_id, note: "Coupon bonus" });
  if (p.coupon_id) await redeemed(p.coupon_id, p.user_id, p.bonus, p.id);
  return true;
}

// Back from Stripe: the session checked with Stripe itself, then credited.
export async function confirmSession(userId: string, sessionId: string) {
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    if (s.payment_status !== "paid" || s.metadata?.user_id !== userId || !s.metadata?.payment_id) return false;
    return finishPayment(s.metadata.payment_id);
  } catch {
    return false;
  }
}
