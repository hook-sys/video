import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { WALLET_NAME, balanceOf, creditsFor, getBilling, grantSignupCredits, walletsOffered } from "@/lib/billing";
import { redeem } from "./actions";
import { LoadForm } from "./load-form";

export const metadata: Metadata = { title: "Credits" };

const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const KIND: Record<string, string> = { signup: "Welcome credits", purchase: "Credits loaded", bonus: "Bonus", coupon: "Code", video: "Video", refund: "Refund", adjust: "Length adjustment", admin: "From MotionBrief" };
const STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: "Checking", tone: "bg-amber-100 text-amber-900" },
  paid: { text: "Added", tone: "bg-emerald-100 text-emerald-900" },
  failed: { text: "Not received", tone: "bg-red-100 text-red-900" },
};

// The customer's credits: pay per use, no subscription. The balance, what a
// video costs, loading credits by bKash, Nagad or Rocket (checked by the
// team), a code to redeem, and what was spent on what.
export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await grantSignupCredits(user.id, !!user.email_confirmed_at).catch(() => {});
  const [{ admin }, billing, credits, { data: ledger }, { data: loads }] = await Promise.all([
    userAccess(supabase, user.id),
    getBilling(),
    balanceOf(user.id),
    supabase.from("credit_ledger").select("created_at, delta, kind, note").order("created_at", { ascending: false }).limit(30),
    supabase.from("payments").select("id, created_at, method, bdt, credits, status, review_note").not("method", "is", null).order("created_at", { ascending: false }).limit(10),
  ]);
  const wallets = walletsOffered(billing).map((id) => ({ id, ...billing.wallets[id] }));
  const perCredit = billing.creditUsd * billing.bdtPerUsd;
  const rate = billing.tiers.standard.perSecond;

  return (
    <AppShell title="Credits" admin={admin} active="credits" initial={(user.email ?? "?")[0]}>
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-sm font-medium text-foreground/50">Your balance</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{admin ? "∞" : credits.toLocaleString("en-US")}</p>
          <p className="mt-2 text-sm text-foreground/55">
            Pay only for what you make: up to {billing.baseSeconds} s = {billing.baseCredits} credits, then {rate} credit{rate === 1 ? "" : "s"} a second · a 30 s video = {creditsFor(billing, "standard", 30)} credits · no subscription
          </p>
        </div>

        {typeof error === "string" && <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>}
        {typeof ok === "string" && <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</p>}

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Load credits</h2>
          {wallets.length ? (
            <LoadForm wallets={wallets} perCredit={perCredit} minLoad={billing.minLoad} />
          ) : (
            <p className="rounded-xl border border-foreground/10 bg-white/70 px-4 py-3 text-sm text-foreground/70">Payments are being set up. Please check back soon.</p>
          )}
          {(loads ?? []).length > 0 && (
            <div className="divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10 bg-white/70">
              {(loads ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      ৳{Number(p.bdt ?? 0).toLocaleString("en-US")} by {WALLET_NAME[p.method as keyof typeof WALLET_NAME] ?? p.method} · {p.credits.toLocaleString("en-US")} credits
                    </p>
                    <p className="truncate text-xs text-foreground/50">{[new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), p.review_note].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[p.status]?.tone ?? ""}`}>{STATUS[p.status]?.text ?? p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

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
