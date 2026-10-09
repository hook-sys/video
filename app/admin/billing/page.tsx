import { requireAdmin } from "@/lib/admin";
import { addPlan, savePlan } from "../actions";
import { Card, Notice, PageHeader, Stat, btn, btnPrimary, input } from "../_components/ui";
import { usd } from "../_components/format";

export const metadata = { title: "Plans & billing" };

export default async function BillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const { error } = await searchParams;
  const { db } = await requireAdmin();
  const [{ data: plans }, { data: users }] = await Promise.all([
    db.from("plans").select("*").order("sort"),
    db.from("profiles").select("plan_id"),
  ]);
  const onPlan = (id: string | null) => (users ?? []).filter((u) => u.plan_id === id).length;
  const mrr = (plans ?? []).reduce((a, p) => a + Number(p.price_usd_month) * onPlan(p.id), 0);

  return (
    <>
      <PageHeader title="Plans & billing" sub="Subscription plans and who is on them." />
      <Notice tone="warn">
        No payment provider is connected yet. Plans can be edited and assigned to users (Users → user → Plan), but nobody is charged and plan limits are not enforced until billing is wired up.
      </Notice>
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Plans" value={plans?.length ?? 0} />
        <Stat label="Paid users" value={(users ?? []).filter((u) => u.plan_id && u.plan_id !== "free").length} />
        <Stat label="Free users" value={onPlan(null) + onPlan("free")} />
        <Stat label="MRR if charged" value={usd(mrr)} hint="Price × users on the plan" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(plans ?? []).map((p) => (
          <Card key={p.id} title={p.name} action={<span className="text-xs text-zinc-500">{onPlan(p.id)} users</span>}>
            <form action={savePlan.bind(null, p.id)} className="flex flex-col gap-3 text-sm">
              <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Name</span><input name="name" defaultValue={p.name} className={input} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Price / month (USD)</span><input name="price" type="number" min={0} step="0.01" defaultValue={p.price_usd_month} className={input} /></label>
                <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Videos / month</span><input name="videos" type="number" min={0} defaultValue={p.videos_per_month} className={input} /></label>
              </div>
              <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" name="allow_4k" defaultChecked={p.allow_4k} className="accent-[#4f8ff0]" /> 4K downloads</label>
              <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" name="active" defaultChecked={p.active} className="accent-[#4f8ff0]" /> Available to customers</label>
              <button className={btn}>Save {p.name}</button>
            </form>
          </Card>
        ))}
        <Card title="New plan">
          <form action={addPlan} className="flex flex-col gap-3">
            <input name="name" required placeholder="Plan name, e.g. Agency" className={input} />
            <button className={btnPrimary}>Create plan</button>
          </form>
        </Card>
      </div>
    </>
  );
}
