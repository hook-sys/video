import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { setUserPlan, setUserRole, setUserStatus } from "../../actions";
import { ConfirmSubmit } from "../../_components/confirm-submit";
import { Badge, Card, PageHeader, Stat, Table, btn, btnDanger, input, td } from "../../_components/ui";
import { PROJECT_COLUMNS, ROLE_LABEL, ROLE_TONE, STATE_LABEL, ago, projectTitle, usd, videoState, type ProjectRow } from "../../_components/format";

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const s = await requireAdmin();
  const { data: u } = await s.db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!u) notFound();
  const [{ data: projects }, { data: costs }, { data: plans }, { data: log }, { data: authUser }] = await Promise.all([
    s.db.from("projects").select(PROJECT_COLUMNS).eq("user_id", id).order("created_at", { ascending: false }).limit(200),
    s.db.from("cost_events").select("estimated_cost_usd").eq("user_id", id),
    s.db.from("plans").select("id, name").order("sort"),
    s.db.from("admin_audit_log").select("created_at, actor_email, action, detail").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
    s.db.auth.admin.getUserById(id),
  ]);
  const list = (projects ?? []) as ProjectRow[];
  const spent = (costs ?? []).reduce((a, c) => a + Number(c.estimated_cost_usd), 0);
  const self = id === s.userId;
  const lastSignIn = authUser?.user?.last_sign_in_at;

  return (
    <>
      <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-white">← Users</Link>
      <PageHeader title={u.email ?? "User"} sub={`${u.full_name ? `${u.full_name} · ` : ""}joined ${ago(u.created_at)} · last sign-in ${ago(lastSignIn)}`}>
        <div className="flex gap-2">
          <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
          <Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge>
        </div>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Videos" value={list.length} />
        <Stat label="Completed" value={list.filter((p) => videoState(p) === "completed").length} tone="good" />
        <Stat label="Failed" value={list.filter((p) => videoState(p) === "failed").length} tone="bad" />
        <Stat label="Cost" value={usd(spent)} hint="Estimated" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Account">
          <div className="flex flex-col gap-5 text-sm">
            <div>
              <p className="mb-2 text-xs text-zinc-500">Access</p>
              {self ? (
                <p className="text-zinc-500">This is your account.</p>
              ) : u.status === "active" ? (
                <form action={setUserStatus.bind(null, id, "suspended")}>
                  <ConfirmSubmit message={`Suspend ${u.email}? They'll be signed out at next login and can't create videos.`} className={btnDanger}>Suspend account</ConfirmSubmit>
                </form>
              ) : (
                <form action={setUserStatus.bind(null, id, "active")}>
                  <button className={btn}>Re-activate account</button>
                </form>
              )}
            </div>
            <form action={setUserPlan.bind(null, id)} className="flex flex-col gap-2">
              <p className="text-xs text-zinc-500">Plan</p>
              <div className="flex gap-2">
                <select name="plan" defaultValue={u.plan_id ?? ""} className={input}>
                  <option value="">Free (no plan)</option>
                  {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className={btn}>Save</button>
              </div>
            </form>
            <form action={setUserRole.bind(null, id)} className="flex flex-col gap-2">
              <p className="text-xs text-zinc-500">Role {s.role !== "super_admin" && "(super admin only)"}</p>
              <div className="flex gap-2">
                <select name="role" defaultValue={u.role} disabled={self || s.role !== "super_admin"} className={input}>
                  <option value="user">Customer</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
                <button disabled={self || s.role !== "super_admin"} className={btn}>Save</button>
              </div>
            </form>
            <p className="break-all text-xs text-zinc-600">ID {u.id}</p>
          </div>
        </Card>
        <Card title="Videos" className="lg:col-span-2">
          <Table head={["Video", "Status", "Length", "Created"]} empty="No videos yet.">
            {list.map((p) => {
              const [label, tone] = STATE_LABEL[videoState(p)];
              return (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className={td}><Link href={`/admin/videos/${p.id}`} className="font-medium text-white hover:underline">{projectTitle(p)}</Link></td>
                  <td className={td}><Badge tone={tone}>{label}</Badge></td>
                  <td className={`${td} tabular-nums text-zinc-400`}>{p.duration_seconds ? `${p.duration_seconds}s` : "—"}</td>
                  <td className={`${td} text-zinc-500`}>{ago(p.created_at)}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
      <Card title="Admin history for this user">
        <Table head={["When", "Admin", "Action", "Detail"]} empty="No admin actions yet.">
          {(log ?? []).map((l, i) => (
            <tr key={i}>
              <td className={`${td} text-zinc-500`}>{ago(l.created_at)}</td>
              <td className={td}>{l.actor_email}</td>
              <td className={td}><code className="text-xs text-violet-300">{l.action}</code></td>
              <td className={`${td} text-xs text-zinc-500`}>{JSON.stringify(l.detail)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
