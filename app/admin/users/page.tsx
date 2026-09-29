import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Badge, Card, Filters, PageHeader, Table, input, td } from "../_components/ui";
import { ROLE_LABEL, ROLE_TONE, ago, cleanSearch, usd } from "../_components/format";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { q, status } = await searchParams;
  const search = cleanSearch(q);
  const filter = typeof status === "string" ? status : "";
  const { db } = await requireAdmin();

  let query = db.from("profiles").select("id, email, full_name, role, status, plan_id, created_at").order("created_at", { ascending: false }).limit(500);
  if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  if (filter === "admins") query = query.in("role", ["admin", "super_admin"]);
  else if (filter) query = query.eq("status", filter);
  const [{ data: users }, { data: projects }, { data: costs }, { data: plans }] = await Promise.all([
    query,
    db.from("projects").select("user_id, created_at, render_status").limit(20000),
    db.from("cost_events").select("user_id, estimated_cost_usd").limit(50000),
    db.from("plans").select("id, name"),
  ]);
  const videos = new Map<string, { n: number; done: number; last: string }>();
  for (const p of projects ?? []) {
    const v = videos.get(p.user_id) ?? { n: 0, done: 0, last: "" };
    v.n++;
    if (p.render_status === "completed") v.done++;
    if (p.created_at > v.last) v.last = p.created_at;
    videos.set(p.user_id, v);
  }
  const spend = new Map<string, number>();
  for (const c of costs ?? []) spend.set(c.user_id, (spend.get(c.user_id) ?? 0) + Number(c.estimated_cost_usd));
  const planName = new Map((plans ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader title="Users" sub={`${users?.length ?? 0} accounts${search ? ` matching “${search}”` : ""}`}>
        <form className="w-full sm:w-72">
          <input name="q" defaultValue={search} placeholder="Search email or name…" className={input} />
        </form>
      </PageHeader>
      <Filters base="/admin/users" current={filter} items={[{ value: "", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "admins", label: "Admins" }]} />
      <Card>
        <Table head={["User", "Role", "Status", "Plan", "Videos", "Cost", "Last video", "Joined"]} empty="No users match.">
          {(users ?? []).map((u) => {
            const v = videos.get(u.id);
            return (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:underline">{u.email ?? "—"}</Link>
                  {u.full_name && <p className="text-xs text-zinc-500">{u.full_name}</p>}
                </td>
                <td className={td}><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge></td>
                <td className={td}><Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge></td>
                <td className={`${td} text-zinc-400`}>{u.plan_id ? planName.get(u.plan_id) ?? u.plan_id : "Free"}</td>
                <td className={`${td} tabular-nums`}>{v ? `${v.done}/${v.n}` : 0}</td>
                <td className={`${td} tabular-nums text-zinc-400`}>{usd(spend.get(u.id) ?? 0)}</td>
                <td className={`${td} text-zinc-500`}>{ago(v?.last)}</td>
                <td className={`${td} text-zinc-500`}>{ago(u.created_at)}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <p className="text-xs text-zinc-600">Videos = completed / started. Cost = estimated provider cost from the cost ledger.</p>
    </>
  );
}
