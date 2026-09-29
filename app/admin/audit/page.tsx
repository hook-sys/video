import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Card, PageHeader, Table, td } from "../_components/ui";
import { ago } from "../_components/format";

export const metadata = { title: "Audit log" };

const LINK: Record<string, string> = { user: "/admin/users/", project: "/admin/videos/" };

export default async function AuditPage() {
  const { db } = await requireAdmin();
  const { data } = await db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300);
  return (
    <>
      <PageHeader title="Audit log" sub="Every change made from the admin panel (latest 300)." />
      <Card>
        <Table head={["When", "Admin", "Action", "Target", "Detail"]} empty="No admin actions yet.">
          {(data ?? []).map((l) => (
            <tr key={l.id}>
              <td className={`${td} whitespace-nowrap text-zinc-500`} title={new Date(l.created_at).toISOString()}>{ago(l.created_at)}</td>
              <td className={td}>{l.actor_email ?? "—"}</td>
              <td className={td}><code className="text-xs text-violet-300">{l.action}</code></td>
              <td className={td}>
                {l.target_id && LINK[l.target_type] ? (
                  <Link href={`${LINK[l.target_type]}${l.target_id}`} className="text-xs text-zinc-300 hover:underline">{l.target_type} {String(l.target_id).slice(0, 8)}</Link>
                ) : (
                  <span className="text-xs text-zinc-500">{l.target_type ?? "—"} {l.target_id && l.target_type !== "settings" ? l.target_id : ""}</span>
                )}
              </td>
              <td className={`${td} max-w-md break-words font-mono text-[11px] text-zinc-500`}>{JSON.stringify(l.detail)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
