import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBilling, withCoupon, type CouponKind } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

// Buying credits: a pack (and a coupon), paid with Stripe Checkout, credited
// once — by the webhook, or when the customer comes back from Stripe,
// whichever is first. Coupons that give credits outright are redeemed here too.
// What must not half-happen runs in one database transaction
// (supabase/migrations/20261016000034_atomic_payments.sql): starting a
// purchase with a coupon (its limits checked under a row lock), crediting a
// paid purchase, and redeeming a credits code.

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

// What the database's coupon refusals say to the customer.
function couponError(message: string, redeem: boolean): string | null {
  if (message.includes("coupon_invalid")) return "That code isn't valid.";
  if (message.includes("coupon_expired")) return "That code has expired.";
  if (message.includes("coupon_wrong_kind")) return redeem ? "This code works when you buy credits — enter it on a pack." : "This code gives credits — use “Redeem a code” below.";
  if (message.includes("coupon_min_usd")) return "This code needs a bigger pack.";
  if (message.includes("coupon_used_up")) return "That code has been used up.";
  if (message.includes("coupon_used_by_you")) return "You've already used this code (or have a checkout open with it — finish it, or try again in 30 minutes).";
  return null;
}

// A code that gives credits outright (checked, recorded and credited in one transaction).
export async function redeemCode(userId: string, code: string): Promise<{ credits: number } | { error: string }> {
  if (!code.trim()) return { error: "Enter a code." };
  const { data, error } = await createAdminClient().rpc("redeem_coupon", { p_user: userId, p_code: code });
  if (error) return { error: couponError(error.message, true) ?? "Couldn't redeem the code. Please try again." };
  return { credits: data as number };
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
  // (the coupon's limits checked again, under its row lock, as the payment is made)
  const { data: paymentId, error } = await db.rpc("start_payment", { p_user: userId, p_usd: deal.usd, p_list_usd: pack.usd, p_credits: deal.credits, p_bonus: deal.bonus, p_coupon: coupon?.id ?? null });
  if (error || !paymentId) return { error: (error && couponError(error.message, false)) ?? "Couldn't start the purchase. Please try again." };
  const payment = { id: paymentId as string };
  if (deal.usd <= 0) {
    try {
      await finishPayment(payment.id);
    } catch (e) {
      console.error("free purchase not credited:", e instanceof Error ? e.message : e);
      return { error: "Couldn't add the credits. Please try again." };
    }
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
      // (an open checkout holds its coupon's use for 40 minutes: it expires before that)
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
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

// A paid purchase credited — once, in one transaction: marked paid, its
// credits, bonus and coupon use, or (on any error) none of them, the payment
// left pending for Stripe's retry. Throws on a database error, so the
// webhook answers 500 and Stripe sends it again.
export async function finishPayment(paymentId: string) {
  const { data, error } = await createAdminClient().rpc("finish_payment", { p_payment: paymentId });
  if (error) throw new Error(`finish_payment: ${error.message}`);
  return data === true;
}

// Back from Stripe: the session checked with Stripe itself, then credited.
export async function confirmSession(userId: string, sessionId: string) {
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    if (s.payment_status !== "paid" || s.metadata?.user_id !== userId || !s.metadata?.payment_id) return false;
    return await finishPayment(s.metadata.payment_id);
  } catch {
    return false;
  }
}
