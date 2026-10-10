import "server-only";
import Stripe from "stripe";

// Stripe (credit purchases). Keys come from the environment: STRIPE_SECRET_KEY
// (test keys first) and STRIPE_WEBHOOK_SECRET (the webhook that credits a
// paid purchase, /api/stripe/webhook).
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not connected.");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
