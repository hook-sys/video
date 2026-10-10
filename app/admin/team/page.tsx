import Link from "next/link";
import { ADMIN_ROLES, ROLE_INFO, ROLE_SECTIONS, requireSuperAdmin } from "@/lib/admin";
import { addTeamMember, setTeamActive, setTeamRole } from "../actions";
import { ConfirmSubmit } from "../_components/confirm-submit";
import { Badge, Card, Notice, PageHeader, Table, btn, btnDanger, btnPrimary, input, td } from "../_components/ui";
import { ROLE_TONE } from "../_components/format";

export const metadata = { title: "Team" };

// The admin team (super admin only): who helps run MotionBrief, with which
// role, and whether their admin access is on.
export default async function TeamPage({ searchParams }: PageProps<"/admin/team">) {
  const { error, saved } = await searchParams;
  const s = await requireSuperAdmin();
  const { data: team } = await s.db.from("profiles").select("id, email, full_name, role, admin_active, created_at").neq("role", "user").order("created_at");
  const roles = ADMIN_ROLES.filter((r) => r !== "super_admin");

  return (
    <>
      <PageHeader title="Team" sub="The people who run MotionBrief with you. Add someone by the email they signed up with, choose their role, turn them on or off." />
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {saved && !error && <Notice tone="good">Saved.</Notice>}
      <Card title="Add a team member">
        <form action={addTeamMember} className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
          <input name="email" type="email" required placeholder="Their email (they must have signed up)" className={input} />
          <select name="role" defaultValue="support" className={input}>
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_INFO[r].label}</option>
            ))}
          </select>
          <button className={btnPrimary}>Add</button>
        </form>
      </Card>
      <Card title={`Team · ${team?.length ?? 0}`}>
        <Table head={["Member", "Role", "Admin access", ""]} empty="Only you so far.">
          {(team ?? []).map((m) => {
            const owner = m.role === "super_admin";
            return (
              <tr key={m.id}>
                <td className={td}>
                  <Link href={`/admin/users/${m.id}`} className="font-medium text-white hover:underline">{m.email}</Link>
                  {m.full_name && <p className="text-xs text-zinc-500">{m.full_name}</p>}
                </td>
                <td className={td}>
                  {owner ? (
                    <Badge tone={ROLE_TONE[m.role]}>Super admin</Badge>
                  ) : (
                    <form action={setTeamRole.bind(null, m.id)} className="flex gap-2">
                      <select name="role" defaultValue={m.role} className={input}>
                        {roles.map((r) => (
                          <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                        ))}
                      </select>
                      <button className={btn}>Save</button>
                    </form>
                  )}
                </td>
                <td className={td}>
                  {owner ? (
                    <Badge tone="green">Always on</Badge>
                  ) : (
                    <form action={setTeamActive.bind(null, m.id, !m.admin_active)}>
                      <button className={btn}>{m.admin_active ? "On · turn off" : "Off · turn on"}</button>
                    </form>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  {!owner && (
                    <form action={setTeamRole.bind(null, m.id)}>
                      <input type="hidden" name="role" value="user" />
                      <ConfirmSubmit message={`Remove ${m.email} from the team? Their customer account stays.`} className={btnDanger}>Remove</ConfirmSubmit>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title="What each role can open">
        <Table head={["Role", "Can", "Sections"]}>
          {ADMIN_ROLES.map((r) => (
            <tr key={r}>
              <td className={td}><Badge tone={ROLE_TONE[r]}>{ROLE_INFO[r].label}</Badge></td>
              <td className={`${td} text-sm`}>{ROLE_INFO[r].help}</td>
              <td className={`${td} text-xs text-zinc-500`}>{r === "super_admin" ? "everything" : ROLE_SECTIONS[r].join(", ")}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-xs text-zinc-500">Turned off, a member keeps their customer account but can&apos;t open the admin panel.</p>
      </Card>
    </>
  );
}
