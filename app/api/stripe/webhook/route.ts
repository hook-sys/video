import { createAdminClient } from "@/lib/supabase/admin";
import { finishPayment } from "@/lib/purchase";
import { stripe } from "@/lib/stripe";

// Stripe's webhook: a paid Checkout session credits its purchase (once), an
// expired one is marked failed. Set STRIPE_WEBHOOK_SECRET to the endpoint's
// signing secret (Stripe → Developers → Webhooks → this URL).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response("Not configured", { status: 503 });
  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.payment_status === "paid" && s.metadata?.payment_id) await finishPayment(s.metadata.payment_id);
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const id = event.data.object.metadata?.payment_id;
    if (id) await createAdminClient().from("payments").update({ status: "failed" }).eq("id", id).eq("status", "pending");
  }
  return Response.json({ received: true });
}
