import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { TIER_IDS, balanceOf, creditsFor, getBilling, grantSignupCredits } from "@/lib/billing";
import { confirmSession } from "@/lib/purchase";
import { buyCredits, redeem } from "./actions";

export const metadata: Metadata = { title: "Credits" };

const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const KIND: Record<string, string> = { signup: "Welcome credits", purchase: "Purchase", bonus: "Bonus", coupon: "Code", video: "Video", refund: "Refund", adjust: "Length adjustment", admin: "From MotionBrief" };

// The customer's credits: the balance, packs to buy (with a code), a code
// to redeem, and what was spent on what.
export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error, ok, paid, session, cancelled } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // back from Stripe: credited now if the webhook hasn't yet
  if (typeof session === "string") await confirmSession(user.id, session);
  await grantSignupCredits(user.id, !!user.email_confirmed_at).catch(() => {});
  const [{ admin }, billing, credits, { data: ledger }] = await Promise.all([
    userAccess(supabase, user.id),
    getBilling(),
    balanceOf(user.id),
    supabase.from("credit_ledger").select("created_at, delta, kind, note").order("created_at", { ascending: false }).limit(30),
  ]);
  const tiers = TIER_IDS.filter((id) => billing.tiers[id].status !== "off");

  return (
    <AppShell title="Credits" admin={admin} active="credits" initial={(user.email ?? "?")[0]}>
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-sm font-medium text-foreground/50">Your balance</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{admin ? "∞" : credits.toLocaleString("en-US")}</p>
          <p className="mt-2 text-sm text-foreground/55">
            {tiers.map((id) => `${billing.tiers[id].name}: ${billing.tiers[id].status === "soon" ? "coming soon" : `${creditsFor(billing, id, 30)} credits for 30 s`}`).join(" · ")}
          </p>
        </div>

        {typeof error === "string" && <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>}
        {typeof ok === "string" && <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</p>}
        {paid && <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Thank you — your credits are in your balance.</p>}
        {cancelled && <p className="rounded-xl border border-foreground/10 bg-white/70 px-4 py-3 text-sm text-foreground/70">Payment cancelled — nothing was charged.</p>}

        <form action={buyCredits} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Buy credits</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {billing.packs.map((p, i) => {
              const extra = p.credits - Math.round(p.usd * 100);
              return (
                <button key={i} name="pack" value={i} className="flex flex-col items-start gap-1 rounded-2xl border border-foreground/10 bg-white/80 p-5 text-left transition hover:border-[#0a66d6] hover:shadow-lg">
                  <span className="text-2xl font-semibold">${p.usd}</span>
                  <span className="text-sm text-foreground/70">{p.credits.toLocaleString("en-US")} credits</span>
                  {extra > 0 && <span className="rounded-full bg-[#0a66d6]/10 px-2 py-0.5 text-xs font-medium text-[#0a66d6]">+{extra.toLocaleString("en-US")} extra</span>}
                  <span className="mt-2 text-sm font-medium text-[#0a66d6]">Buy →</span>
                </button>
              );
            })}
          </div>
          <label className="flex max-w-sm flex-col gap-1.5 text-sm">
            <span className="text-foreground/60">Have a coupon? Enter it, then pick a pack.</span>
            <input name="code" placeholder="CODE" autoCapitalize="characters" className={`${input} uppercase`} />
          </label>
          <p className="text-xs text-foreground/45">Secure payment by Stripe.</p>
        </form>

        <form action={redeem} className="flex max-w-sm flex-col gap-2">
          <h2 className="text-lg font-semibold">Redeem a code</h2>
          <div className="flex gap-2">
            <input name="code" required placeholder="CODE" className={`${input} uppercase`} />
            <button className="gs-btn">Redeem</button>
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">History</h2>
          {(ledger ?? []).length === 0 ? (
            <p className="text-sm text-foreground/50">Nothing yet.</p>
          ) : (
            <div className="divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10 bg-white/70">
              {(ledger ?? []).map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{KIND[l.kind] ?? l.kind}</p>
                    <p className="truncate text-xs text-foreground/50">{[new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), l.note].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={`tabular-nums font-medium ${l.delta >= 0 ? "text-emerald-600" : "text-foreground/70"}`}>
                    {l.delta >= 0 ? "+" : ""}
                    {l.delta.toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
