import { requireAdmin } from "@/lib/admin";
import { createCoupon, saveCoupon, toggleCoupon } from "../actions";
import { Badge, Card, Notice, PageHeader, Table, btn, btnPrimary, input, td } from "../_components/ui";
import { ago, isPast } from "../_components/format";

export const metadata = { title: "Coupons" };

const KIND = {
  discount: { label: "% off", help: "The pack costs less (e.g. 10 → 10% off). 100 = free." },
  bonus: { label: "% more credits", help: "More credits for the same price (e.g. 100 → double credits)." },
  credits: { label: "Free credits", help: "Credits given outright, no purchase (the customer redeems the code)." },
} as const;
const label = "flex flex-col gap-1";
const small = "text-xs text-zinc-500";
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function Fields({ c }: { c?: { kind: string; value: number; max_uses: number | null; expires_at: string | null; per_user_once: boolean; min_usd: number; note: string | null } }) {
  return (
    <>
      <label className={label}>
        <span className={small}>What it does</span>
        <select name="kind" defaultValue={c?.kind ?? "discount"} className={input}>
          {Object.entries(KIND).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </label>
      <label className={label}><span className={small}>Value (% or credits)</span><input name="value" type="number" min={1} required defaultValue={c?.value ?? 10} className={input} /></label>
      <label className={label}><span className={small}>Uses in total (empty = no limit)</span><input name="max_uses" type="number" min={1} defaultValue={c?.max_uses ?? ""} className={input} /></label>
      <label className={label}><span className={small}>Expires (empty = never)</span><input name="expires_at" type="date" defaultValue={day(c?.expires_at ?? null)} className={input} /></label>
      <label className={label}><span className={small}>Smallest pack it works on (USD)</span><input name="min_usd" type="number" min={0} step="0.01" defaultValue={c?.min_usd ?? 0} className={input} /></label>
      <label className={label}><span className={small}>Note (only the team sees it)</span><input name="note" defaultValue={c?.note ?? ""} className={input} /></label>
      <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="per_user_once" defaultChecked={c?.per_user_once ?? true} className="accent-[#4f8ff0]" /> Once per customer</label>
    </>
  );
}

// Coupon codes: a discount or extra credits when credits are bought, or
// credits given outright. Each can be turned off, limited and dated.
export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  const { error, saved } = await searchParams;
  const { db } = await requireAdmin("coupons");
  const { data: coupons } = await db.from("coupons").select("*").order("created_at", { ascending: false });
  const describe = (c: { kind: keyof typeof KIND; value: number }) => (c.kind === "discount" ? `${c.value}% off` : c.kind === "bonus" ? `+${c.value}% credits` : `${c.value.toLocaleString("en-US")} free credits`);
  const expired = (c: { expires_at: string | null }) => isPast(c.expires_at);

  return (
    <>
      <PageHeader title="Coupons" sub="Codes customers enter when they buy credits (or redeem for free credits)." />
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {saved && !error && <Notice tone="good">Saved.</Notice>}
      <Card title="New coupon">
        <form action={createCoupon} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className={label}><span className={small}>Code (letters, digits, - _)</span><input name="code" required placeholder="LAUNCH50" className={`${input} uppercase`} /></label>
          <Fields />
          <div className="flex items-end"><button className={btnPrimary}>Create coupon</button></div>
        </form>
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          {Object.values(KIND).map((k) => (
            <li key={k.label}><b className="text-zinc-400">{k.label}:</b> {k.help}</li>
          ))}
        </ul>
      </Card>
      <Card title={`Coupons · ${coupons?.length ?? 0}`}>
        <Table head={["Code", "Gives", "Used", "Expires", "Status", ""]} empty="No coupons yet.">
          {(coupons ?? []).map((c) => (
            <tr key={c.id} className="align-top">
              <td className={td}>
                <code className="text-sm font-semibold text-white">{c.code}</code>
                {c.note && <p className="text-xs text-zinc-500">{c.note}</p>}
              </td>
              <td className={td}>{describe(c)}{Number(c.min_usd) > 0 && <p className="text-xs text-zinc-500">packs ≥ ${Number(c.min_usd)}</p>}</td>
              <td className={`${td} tabular-nums`}>{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}{c.per_user_once && <p className="text-xs text-zinc-500">once each</p>}</td>
              <td className={`${td} text-zinc-400`}>{c.expires_at ? ago(c.expires_at) : "Never"}</td>
              <td className={td}><Badge tone={!c.active ? "gray" : expired(c) ? "amber" : "green"}>{!c.active ? "Off" : expired(c) ? "Expired" : "On"}</Badge></td>
              <td className={`${td} text-right`}>
                <div className="flex flex-col items-end gap-2">
                  <form action={toggleCoupon.bind(null, c.id, !c.active)}>
                    <button className={btn}>{c.active ? "Turn off" : "Turn on"}</button>
                  </form>
                  <details className="text-left">
                    <summary className="cursor-pointer text-xs text-[#9cc2ff]">Edit</summary>
                    <form action={saveCoupon.bind(null, c.id)} className="mt-2 grid w-72 gap-2">
                      <Fields c={{ ...c, min_usd: Number(c.min_usd) }} />
                      <button className={btn}>Save {c.code}</button>
                    </form>
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
