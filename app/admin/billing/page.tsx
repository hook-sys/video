import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { TIER_IDS, creditsFor, getBilling } from "@/lib/billing";
import { stripeReady } from "@/lib/stripe";
import { saveBilling } from "../actions";
import { Badge, Card, Notice, PageHeader, Stat, Table, btnPrimary, input, td } from "../_components/ui";
import { ago, daysAgo, usd } from "../_components/format";

export const metadata = { title: "Pricing & payments" };

const label = "flex flex-col gap-1";
const small = "text-xs text-zinc-500";

export default async function BillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const { error, saved } = await searchParams;
  const { db } = await requireAdmin("billing");
  const billing = await getBilling();
  const since = daysAgo(30);
  const [{ data: payments }, { data: recent }, { data: balances }] = await Promise.all([
    db.from("payments").select("id, user_id, usd, list_usd, credits, bonus, status, created_at, paid_at, coupon_id").order("created_at", { ascending: false }).limit(50),
    db.from("payments").select("usd, credits, bonus").eq("status", "paid").gte("paid_at", since),
    db.from("profiles").select("credits").gt("credits", 0),
  ]);
  const ids = [...new Set((payments ?? []).map((p) => p.user_id))];
  const { data: who } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = new Map((who ?? []).map((u) => [u.id, u.email]));
  const revenue = (recent ?? []).reduce((a, p) => a + Number(p.usd), 0);
  const sold = (recent ?? []).reduce((a, p) => a + p.credits + p.bonus, 0);
  const outstanding = (balances ?? []).reduce((a, p) => a + p.credits, 0);
  const packRows = [...billing.packs, ...Array.from({ length: Math.max(0, 6 - billing.packs.length) }, () => ({ usd: 0, credits: 0 }))];

  return (
    <>
      <PageHeader title="Pricing & payments" sub="What a video costs in credits, the credit packs customers buy, and the payments." />
      {!stripeReady() && (
        <Notice tone="warn">
          Stripe isn&apos;t connected yet: customers can&apos;t buy credits. Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> in Vercel → Settings → Environment Variables (test keys first), then redeploy.
        </Notice>
      )}
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {saved && !error && <Notice tone="good">Pricing saved — it applies to the next video and the next purchase.</Notice>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue · 30 days" value={usd(revenue)} />
        <Stat label="Credits sold · 30 days" value={sold.toLocaleString("en-US")} />
        <Stat label="Credits held by customers" value={outstanding.toLocaleString("en-US")} hint={`≈ ${usd(outstanding / 100)} of videos owed`} />
        <Stat label="Payments" value={(payments ?? []).filter((p) => p.status === "paid").length} hint="Last 50 shown below" />
      </div>

      <form action={saveBilling} className="flex flex-col gap-4">
        <Card title="Quality levels" action={<span className={small}>1 credit = $0.01 · charged per second of video</span>}>
          <div className="grid gap-4 lg:grid-cols-3">
            {TIER_IDS.map((id) => {
              const t = billing.tiers[id];
              return (
                <div key={id} className="flex flex-col gap-3 rounded-xl border border-white/[0.07] p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-[#9cc2ff]">{id}</code>
                    <Badge tone={t.status === "on" ? "green" : t.status === "soon" ? "amber" : "gray"}>{t.status === "on" ? "On" : t.status === "soon" ? "Coming soon" : "Hidden"}</Badge>
                  </div>
                  <label className={label}><span className={small}>Name customers see</span><input name={`${id}_name`} defaultValue={t.name} className={input} /></label>
                  <label className={label}><span className={small}>One line about it</span><input name={`${id}_blurb`} defaultValue={t.blurb} className={input} /></label>
                  <label className={label}><span className={small}>Badge (optional, e.g. “Best result”)</span><input name={`${id}_badge`} defaultValue={t.badge} className={input} /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={label}><span className={small}>Credits / second</span><input name={`${id}_rate`} type="number" min={0} step="0.1" defaultValue={t.perSecond} className={input} /></label>
                    <label className={label}>
                      <span className={small}>Status</span>
                      <select name={`${id}_status`} defaultValue={t.status} disabled={id === "standard"} className={input}>
                        <option value="on">On</option>
                        <option value="soon">Coming soon</option>
                        <option value="off">Hidden</option>
                      </select>
                    </label>
                  </div>
                  {id !== "standard" && (
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input type="checkbox" name={`${id}_paid`} defaultChecked={t.paidOnly} className="accent-[#4f8ff0]" /> Only for customers who have bought credits
                    </label>
                  )}
                  <label className={label}><span className={small}>Director model (empty = the one on AI models)</span><input name={`${id}_model`} defaultValue={t.model} placeholder="e.g. anthropic/claude-opus-5.5" className={input} /></label>
                  <p className={small}>30 s video = {creditsFor(billing, id, 30)} credits (${(creditsFor(billing, id, 30) / 100).toFixed(2)})</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label className={label}><span className={small}>Welcome credits (once, after email is confirmed; 15 s Standard = {creditsFor(billing, "standard", 15)})</span><input name="signup_credits" type="number" min={0} defaultValue={billing.signupCredits} className={input} /></label>
            <label className={label}><span className={small}>Shortest charge (seconds)</span><input name="min_seconds" type="number" min={0} max={120} defaultValue={billing.minSeconds} className={input} /></label>
          </div>
        </Card>
        <Card title="Credit packs" action={<span className={small}>Leave a row empty to remove it</span>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packRows.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <label className={label}><span className={small}>Price (USD)</span><input name={`pack_usd_${i}`} type="number" min={0} step="0.01" defaultValue={p.usd || ""} className={input} /></label>
                <label className={label}><span className={small}>Credits</span><input name={`pack_credits_${i}`} type="number" min={0} defaultValue={p.credits || ""} className={input} /></label>
              </div>
            ))}
          </div>
        </Card>
        <div>
          <button className={btnPrimary}>Save pricing</button>
        </div>
      </form>

      <Card title="Payments">
        <Table head={["When", "Customer", "Paid", "Credits", "Status"]} empty="No payments yet.">
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td className={`${td} text-zinc-500`}>{ago(p.paid_at ?? p.created_at)}</td>
              <td className={td}><Link href={`/admin/users/${p.user_id}`} className="hover:underline">{email.get(p.user_id) ?? p.user_id}</Link></td>
              <td className={`${td} tabular-nums`}>{usd(Number(p.usd))}{Number(p.list_usd) > Number(p.usd) && <span className="ml-1 text-xs text-zinc-500 line-through">{usd(Number(p.list_usd))}</span>}</td>
              <td className={`${td} tabular-nums`}>{p.credits.toLocaleString("en-US")}{p.bonus > 0 && <span className="text-emerald-400"> +{p.bonus.toLocaleString("en-US")}</span>}</td>
              <td className={td}><Badge tone={p.status === "paid" ? "green" : p.status === "failed" ? "red" : "gray"}>{p.status}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
