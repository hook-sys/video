import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_ROLES, ROLE_INFO } from "@/lib/admin";
import { createUser } from "../actions";
import { Badge, Card, Filters, Notice, PageHeader, Table, btnPrimary, input, td } from "../_components/ui";
import { ROLE_LABEL, ROLE_TONE, ago, cleanSearch, usd } from "../_components/format";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { q, status, error } = await searchParams;
  const search = cleanSearch(q);
  const filter = typeof status === "string" ? status : "";
  const { db, role, can } = await requireAdmin("users");

  let query = db.from("profiles").select("id, email, full_name, role, status, credits, created_at").order("created_at", { ascending: false }).limit(500);
  if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  if (filter === "admins") query = query.neq("role", "user");
  else if (filter) query = query.eq("status", filter);
  const [{ data: users }, { data: projects }, { data: costs }] = await Promise.all([
    query,
    db.from("projects").select("user_id, created_at, render_status").limit(20000),
    db.from("cost_events").select("user_id, estimated_cost_usd").limit(50000),
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

  return (
    <>
      <PageHeader title="Users" sub={`${users?.length ?? 0} accounts${search ? ` matching “${search}”` : ""}`}>
        <form className="w-full sm:w-72">
          <input name="q" defaultValue={search} placeholder="Search email or name…" className={input} />
        </form>
      </PageHeader>
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      <details className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-200">+ Add a user</summary>
        <form action={createUser} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Email</span><input name="email" type="email" required className={input} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Password (8+ characters; give it to them)</span><input name="password" type="text" required minLength={8} autoComplete="off" className={input} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Name (optional)</span><input name="full_name" className={input} /></label>
          {can("credits") && <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">Starting credits</span><input name="credits" type="number" min={0} max={1000000} defaultValue={0} className={input} /></label>}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Role</span>
            <select name="role" defaultValue="user" disabled={role !== "super_admin"} className={input}>
              <option value="user">Customer</option>
              {ADMIN_ROLES.filter((r) => r !== "super_admin").map((r) => (
                <option key={r} value={r}>{ROLE_INFO[r].label}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end"><button className={btnPrimary}>Create account</button></div>
        </form>
        <p className="mt-3 text-xs text-zinc-500">The account is ready at once (email confirmed): they sign in with this email and password. A new password can be set on their page.</p>
      </details>
      <Filters base="/admin/users" current={filter} items={[{ value: "", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "admins", label: "Team" }]} />
      <Card>
        <Table head={["User", "Role", "Status", "Credits", "Videos", "Cost", "Last video", "Joined"]} empty="No users match.">
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
                <td className={`${td} tabular-nums text-zinc-300`}>{(u.credits ?? 0).toLocaleString("en-US")}</td>
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
