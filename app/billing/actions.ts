"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userAccess } from "@/lib/admin";
import { redeemCode, startPurchase } from "@/lib/purchase";
import { stripeReady } from "@/lib/stripe";

// The customer's credit purchases: a pack (with an optional code) sent to
// Stripe Checkout, and a code that gives credits redeemed.

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // (an account still waiting for approval can't buy or redeem yet)
  if ((await userAccess(supabase, user.id)).pending) back("Your account is waiting for approval. You can buy credits as soon as it's approved.");
  return user;
}

const back = (msg: string, key = "error") => redirect(`/billing?${key}=${encodeURIComponent(msg)}`);

export async function buyCredits(formData: FormData) {
  const user = await signedIn();
  if (!stripeReady()) back("Payments are being set up. Please try again soon.");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const r = await startPurchase(user.id, user.email ?? null, Number(formData.get("pack")), String(formData.get("code") ?? ""), origin);
  if ("error" in r) back(r.error);
  redirect((r as { url: string }).url);
}

export async function redeem(formData: FormData) {
  const user = await signedIn();
  const r = await redeemCode(user.id, String(formData.get("code") ?? ""));
  if ("error" in r) back(r.error);
  back(`${(r as { credits: number }).credits.toLocaleString("en-US")} credits added.`, "ok");
}
