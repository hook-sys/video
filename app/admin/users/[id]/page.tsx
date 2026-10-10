import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { adjustCredits, saveUser, setUserStatus } from "../../actions";
import { ConfirmSubmit } from "../../_components/confirm-submit";
import { Badge, Card, Notice, PageHeader, Stat, Table, btn, btnDanger, btnPrimary, input, td } from "../../_components/ui";
import { PROJECT_COLUMNS, ROLE_LABEL, ROLE_TONE, STATE_LABEL, ago, projectTitle, usd, videoState, type ProjectRow } from "../../_components/format";

// what each kind of credit change is called in the history
const KIND: Record<string, string> = { signup: "Welcome", purchase: "Purchase", bonus: "Bonus", coupon: "Coupon", video: "Video", refund: "Refund", adjust: "Length adjust", admin: "Team" };

export default async function UserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const s = await requireAdmin("users");
  const { data: u } = await s.db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!u) notFound();
  const [{ data: projects }, { data: costs }, { data: ledger }, { data: log }, { data: authUser }] = await Promise.all([
    s.db.from("projects").select(PROJECT_COLUMNS).eq("user_id", id).order("created_at", { ascending: false }).limit(200),
    s.db.from("cost_events").select("estimated_cost_usd").eq("user_id", id),
    s.db.from("credit_ledger").select("created_at, delta, balance_after, kind, note, project_id").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    s.db.from("admin_audit_log").select("created_at, actor_email, action, detail").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
    s.db.auth.admin.getUserById(id),
  ]);
  const list = (projects ?? []) as ProjectRow[];
  const spent = (costs ?? []).reduce((a, c) => a + Number(c.estimated_cost_usd), 0);
  const self = id === s.userId;
  // a team member is edited only by the super admin
  const editable = u.role === "user" || s.role === "super_admin";
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
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {saved && !error && <Notice tone="good">Saved.</Notice>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Videos" value={list.length} />
        <Stat label="Completed" value={list.filter((p) => videoState(p) === "completed").length} tone="good" />
        <Stat label="Failed" value={list.filter((p) => videoState(p) === "failed").length} tone="bad" />
        <Stat label="Credits" value={(u.credits ?? 0).toLocaleString("en-US")} hint={`≈ $${((u.credits ?? 0) / 100).toFixed(2)} · our cost so far ${usd(spent)}`} />
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
            <form action={saveUser.bind(null, id)} className="flex flex-col gap-2">
              <p className="text-xs text-zinc-500">Details</p>
              <input name="full_name" defaultValue={u.full_name ?? ""} placeholder="Name" disabled={!editable} className={input} />
              <input name="email" type="email" defaultValue={u.email ?? ""} placeholder="Email" disabled={!editable} className={input} />
              <input name="password" type="text" minLength={8} autoComplete="off" placeholder="New password (leave empty to keep)" disabled={!editable} className={input} />
              <button disabled={!editable} className={btn}>Save details</button>
            </form>
            <p className="text-xs text-zinc-500">
              Role: {ROLE_LABEL[u.role] ?? u.role}
              {s.role === "super_admin" && !self && (
                <>
                  {" "}· <Link href="/admin/team" className="text-[#9cc2ff] hover:underline">change on Team</Link>
                </>
              )}
            </p>
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
      {s.can("credits") && (
        <Card title={`Credits · ${(u.credits ?? 0).toLocaleString("en-US")}`}>
          <form action={adjustCredits.bind(null, id)} className="mb-5 grid gap-3 md:grid-cols-[150px_140px_1fr_auto]">
            <select name="direction" className={input} defaultValue="add">
              <option value="add">Add credits</option>
              <option value="remove">Remove credits</option>
            </select>
            <input name="amount" type="number" min={1} max={1000000} required placeholder="Credits" className={input} />
            <input name="reason" required maxLength={200} placeholder="Reason (the customer sees it in their history)" className={input} />
            <button className={btnPrimary}>Apply</button>
          </form>
          <Table head={["When", "What", "Change", "Balance", "Note"]} empty="No credit changes yet.">
            {(ledger ?? []).map((l, i) => (
              <tr key={i}>
                <td className={`${td} text-zinc-500`}>{ago(l.created_at)}</td>
                <td className={td}>{l.project_id ? <Link href={`/admin/videos/${l.project_id}`} className="hover:underline">{KIND[l.kind] ?? l.kind}</Link> : KIND[l.kind] ?? l.kind}</td>
                <td className={`${td} tabular-nums ${l.delta >= 0 ? "text-emerald-400" : "text-rose-300"}`}>{l.delta >= 0 ? "+" : ""}{l.delta.toLocaleString("en-US")}</td>
                <td className={`${td} tabular-nums text-zinc-400`}>{l.balance_after.toLocaleString("en-US")}</td>
                <td className={`${td} text-xs text-zinc-500`}>{l.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <Card title="Admin history for this user">
        <Table head={["When", "Admin", "Action", "Detail"]} empty="No admin actions yet.">
          {(log ?? []).map((l, i) => (
            <tr key={i}>
              <td className={`${td} text-zinc-500`}>{ago(l.created_at)}</td>
              <td className={td}>{l.actor_email}</td>
              <td className={td}><code className="text-xs text-[#9cc2ff]">{l.action}</code></td>
              <td className={`${td} text-xs text-zinc-500`}>{JSON.stringify(l.detail)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
