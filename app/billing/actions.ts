"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userAccess } from "@/lib/admin";
import { submitManualPayment } from "@/lib/manual-payment";
import { redeemCode } from "@/lib/purchase";

// The customer's credits: a load by bKash, Nagad or Rocket submitted for the
// team to check (lib/manual-payment.ts), and a code that gives credits redeemed.

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // (an account still waiting for approval can't load or redeem yet)
  if ((await userAccess(supabase, user.id)).pending) back("Your account is waiting for approval. You can load credits as soon as it's approved.");
  return user;
}

const back = (msg: string, key = "error"): never => redirect(`/billing?${key}=${encodeURIComponent(msg)}`);

export async function loadCredits(formData: FormData) {
  const user = await signedIn();
  const r = await submitManualPayment(user.id, {
    method: String(formData.get("method") ?? ""),
    bdt: Number(formData.get("bdt")),
    sender: String(formData.get("sender") ?? ""),
    trxId: String(formData.get("trx_id") ?? ""),
  });
  if ("error" in r) back(r.error);
  revalidatePath("/billing");
  back(`Thank you — we're checking your payment. ${(r as { credits: number }).credits.toLocaleString("en-US")} credits will be added once it's confirmed.`, "ok");
}

export async function redeem(formData: FormData) {
  const user = await signedIn();
  const r = await redeemCode(user.id, String(formData.get("code") ?? ""));
  if ("error" in r) back(r.error);
  back(`${(r as { credits: number }).credits.toLocaleString("en-US")} credits added.`, "ok");
}
