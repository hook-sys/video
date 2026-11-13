import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { WALLETS, WALLET_NAME, creditsFor, getBilling, priceOf, walletsOffered } from "@/lib/billing";
import { reviewPayment, saveBilling } from "../actions";
import { Badge, Card, Notice, PageHeader, Stat, Table, btnDanger, btnPrimary, input, td } from "../_components/ui";
import { ago, daysAgo, usd } from "../_components/format";

export const metadata = { title: "Pricing & payments" };

const label = "flex flex-col gap-1";
const small = "text-xs text-zinc-500";
const taka = (n: number) => `৳${n.toLocaleString("en-US")}`;

// Pay per use: what a video costs, a credit's price, the numbers customers
// send to, and the payments — loads by bKash, Nagad or Rocket waiting to be
// checked against the wallet, approved (credits added) or rejected.
export default async function BillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const { error, saved, reviewed } = await searchParams;
  const { db } = await requireAdmin("billing");
  const billing = await getBilling();
  const since = daysAgo(30);
  const cols = "id, user_id, usd, credits, bonus, status, created_at, paid_at, method, trx_id, sender, bdt, review_note";
  const [{ data: pending }, { data: payments }, { data: recent }, { data: balances }] = await Promise.all([
    db.from("payments").select(cols).eq("status", "pending").order("created_at", { ascending: true }).limit(100),
    db.from("payments").select(cols).neq("status", "pending").order("created_at", { ascending: false }).limit(50),
    db.from("payments").select("usd, bdt, credits, bonus").eq("status", "paid").gte("paid_at", since),
    db.from("profiles").select("credits").gt("credits", 0),
  ]);
  const ids = [...new Set([...(pending ?? []), ...(payments ?? [])].map((p) => p.user_id))];
  const { data: who } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = new Map((who ?? []).map((u) => [u.id, u.email]));
  const revenue = (recent ?? []).reduce((a, p) => a + Number(p.bdt ?? 0), 0);
  const sold = (recent ?? []).reduce((a, p) => a + p.credits + p.bonus, 0);
  const outstanding = (balances ?? []).reduce((a, p) => a + p.credits, 0);
  const st = billing.tiers.standard;
  const example = (s: number) => `${s} s = ${creditsFor(billing, "standard", s)} credits (${taka(priceOf(billing, creditsFor(billing, "standard", s)).bdt)})`;
  const who_ = (id: string) => <Link href={`/admin/users/${id}`} className="hover:underline">{email.get(id) ?? id}</Link>;

  return (
    <>
      <PageHeader title="Pricing & payments" sub="Pay per use: customers load credits by bKash, Nagad or Rocket and you approve each payment here." />
      {!walletsOffered(billing).length && <Notice tone="warn">No payment number yet: customers can&apos;t load credits. Add your bKash, Nagad or Rocket number below and save.</Notice>}
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {saved && !error && <Notice tone="good">Pricing saved — it applies to the next video and the next payment.</Notice>}
      {reviewed && !error && <Notice tone="good">{reviewed === "approved" ? "Approved — the credits are in the customer's balance." : "Rejected — the customer sees it as not received."}</Notice>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Waiting to check" value={(pending ?? []).length} tone={(pending ?? []).length ? "warn" : "default"} />
        <Stat label="Received · 30 days" value={taka(Math.round(revenue))} />
        <Stat label="Credits sold · 30 days" value={sold.toLocaleString("en-US")} />
        <Stat label="Credits held by customers" value={outstanding.toLocaleString("en-US")} hint={`≈ ${usd(outstanding * billing.creditUsd)} of videos owed`} />
      </div>

      <Card title="Payments to check" action={<span className={small}>Check each transaction ID in your wallet app before approving</span>}>
        <Table head={["When", "Customer", "Sent", "From · Trx ID", "Credits", ""]} empty="Nothing waiting.">
          {(pending ?? []).map((p) => (
            <tr key={p.id}>
              <td className={`${td} text-zinc-500`}>{ago(p.created_at)}</td>
              <td className={td}>{who_(p.user_id)}</td>
              <td className={`${td} tabular-nums`}>
                {taka(Number(p.bdt ?? 0))} <span className="text-zinc-500">{WALLET_NAME[p.method as keyof typeof WALLET_NAME] ?? p.method}</span>
              </td>
              <td className={`${td} font-mono text-xs`}>
                {p.sender}
                <br />
                <b className="text-sm text-white">{p.trx_id}</b>
              </td>
              <td className={td} colSpan={2}>
                <form action={reviewPayment} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="credits" type="number" min={1} defaultValue={p.credits} className={`${input} w-24 tabular-nums`} title="Credits to add (change it if a different amount arrived)" />
                  <input name="note" placeholder="Note (optional)" maxLength={300} className={`${input} w-40`} />
                  <button name="decision" value="approve" className={btnPrimary}>Approve</button>
                  <button name="decision" value="reject" className={btnDanger}>Reject</button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <form action={saveBilling} className="flex flex-col gap-4">
        <Card title="Price per video" action={<span className={small}>{example(15)} · {example(30)} · {example(60)}</span>}>
          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
            <label className={label}><span className={small}>First seconds at a set price</span><input name="base_seconds" type="number" min={0} max={600} defaultValue={billing.baseSeconds} className={input} /></label>
            <label className={label}><span className={small}>Credits for those seconds</span><input name="base_credits" type="number" min={0} defaultValue={billing.baseCredits} className={input} /></label>
            <label className={label}><span className={small}>Credits for each second after</span><input name="standard_rate" type="number" min={0} step="0.1" defaultValue={st.perSecond} className={input} /></label>
          </div>
          {/* (the other levels are kept as they are, hidden: one level for every video) */}
          {(["standard", "pro", "ultra"] as const).map((id) => {
            const t = billing.tiers[id];
            return (
              <div key={id} className="hidden">
                {id !== "standard" && <input type="hidden" name={`${id}_rate`} value={t.perSecond} />}
                <input type="hidden" name={`${id}_name`} value={t.name} />
                <input type="hidden" name={`${id}_blurb`} value={t.blurb} />
                <input type="hidden" name={`${id}_badge`} value={t.badge} />
                <input type="hidden" name={`${id}_model`} value={t.model} />
                {id !== "standard" && <input type="hidden" name={`${id}_status`} value={t.status} />}
                {t.paidOnly && <input type="hidden" name={`${id}_paid`} value="on" />}
              </div>
            );
          })}
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
            <label className={label}><span className={small}>Price of 1 credit (USD)</span><input name="credit_usd" type="number" min={0.0001} step="0.0001" defaultValue={billing.creditUsd} className={input} /></label>
            <label className={label}><span className={small}>Taka for 1 USD (prices shown in taka)</span><input name="bdt_per_usd" type="number" min={1} step="0.01" defaultValue={billing.bdtPerUsd} className={input} /></label>
            <label className={label}><span className={small}>Smallest load (credits) = {taka(priceOf(billing, billing.minLoad).bdt)}</span><input name="min_load" type="number" min={1} defaultValue={billing.minLoad} className={input} /></label>
            <label className={label}><span className={small}>Welcome credits (once, after email is confirmed)</span><input name="signup_credits" type="number" min={0} defaultValue={billing.signupCredits} className={input} /></label>
            <label className={label}><span className={small}>Free edits per video (saved edits; going back to the original counts)</span><input name="free_edits" type="number" min={0} max={100} defaultValue={billing.freeEdits} className={input} /></label>
            <label className={label}><span className={small}>Credits for each edit after the free ones</span><input name="edit_credits" type="number" min={0} defaultValue={billing.editCredits} className={input} /></label>
            <label className={label}><span className={small}>Script limit before the first load (characters)</span><input name="trial_script_max" type="number" min={50} max={1000} defaultValue={billing.trialScriptMax} className={input} /></label>
          </div>
          <p className={`${small} mt-2`}>1 credit = {usd(billing.creditUsd)} = ৳{(billing.creditUsd * billing.bdtPerUsd).toFixed(2)}</p>
        </Card>
        <Card title="Where customers send money" action={<span className={small}>Leave a number empty to hide that method</span>}>
          <div className="grid gap-4 sm:grid-cols-3">
            {WALLETS.map((id) => (
              <div key={id} className="flex flex-col gap-2 rounded-xl border border-white/[0.07] p-3">
                <p className="text-sm font-semibold">{WALLET_NAME[id]}</p>
                <label className={label}><span className={small}>Number</span><input name={`${id}_number`} type="tel" maxLength={14} placeholder="01XXXXXXXXX" defaultValue={billing.wallets[id].number} className={input} /></label>
                <label className={label}>
                  <span className={small}>Kind</span>
                  <select name={`${id}_kind`} defaultValue={billing.wallets[id].kind} className={input}>
                    <option value="Personal">Personal (Send Money)</option>
                    <option value="Agent">Agent (Cash Out)</option>
                    <option value="Merchant">Merchant (Payment)</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
        </Card>
        <div>
          <button className={btnPrimary}>Save pricing</button>
        </div>
      </form>

      <Card title="Checked payments">
        <Table head={["When", "Customer", "Sent", "Trx ID", "Credits", "Status"]} empty="No payments yet.">
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td className={`${td} text-zinc-500`}>{ago(p.paid_at ?? p.created_at)}</td>
              <td className={td}>{who_(p.user_id)}</td>
              <td className={`${td} tabular-nums`}>{p.method ? `${taka(Number(p.bdt ?? 0))} ${WALLET_NAME[p.method as keyof typeof WALLET_NAME] ?? p.method}` : usd(Number(p.usd))}</td>
              <td className={`${td} font-mono text-xs`}>{p.trx_id ?? "—"}</td>
              <td className={`${td} tabular-nums`}>{p.credits.toLocaleString("en-US")}{p.bonus > 0 && <span className="text-emerald-400"> +{p.bonus.toLocaleString("en-US")}</span>}</td>
              <td className={td}>
                <Badge tone={p.status === "paid" ? "green" : "red"}>{p.status === "paid" ? "approved" : "rejected"}</Badge>
                {p.review_note && <span className="ml-2 text-xs text-zinc-500">{p.review_note}</span>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
