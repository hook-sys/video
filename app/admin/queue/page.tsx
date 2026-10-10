import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { markFailed } from "../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmSubmit } from "../_components/confirm-submit";
import { Badge, Card, PageHeader, Stat, Table, btn, td } from "../_components/ui";
import { PROJECT_COLUMNS, ago, daysAgo, minutesSince, projectTitle, type ProjectRow } from "../_components/format";

export const metadata = { title: "Video queue" };

// A job with no update for this long is probably stuck.
const STUCK_MIN = 30;

export default async function QueuePage() {
  const { db } = await requireAdmin("queue");
  const since = daysAgo(1);
  const [{ data: running }, { data: failed }, { data: users }] = await Promise.all([
    db.from("projects").select(PROJECT_COLUMNS).eq("pipeline_status", "running").order("updated_at"),
    db.from("projects").select(PROJECT_COLUMNS).gte("updated_at", since).eq("pipeline_status", "failed").order("updated_at", { ascending: false }),
    db.from("profiles").select("id, email"),
  ]);
  const email = new Map((users ?? []).map((u) => [u.id, u.email]));
  const jobs = ((running ?? []) as ProjectRow[]).flatMap((p) => [
    p.pipeline_status === "running" && { p, what: "pipeline" as const, label: `Generating · ${p.pipeline_step ?? "…"}` },
  ]).filter((j) => !!j);
  const stuck = jobs.filter((j) => minutesSince(j.p.updated_at) > STUCK_MIN).length;

  return (
    <>
      <AutoRefresh active={jobs.length > 0} intervalMs={10000} />
      <PageHeader title="Video queue" sub="Videos being made now, and everything that failed in the last 24 hours. Refreshes on its own while jobs run." />
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Running" value={jobs.length} />
        <Stat label={`Stuck (> ${STUCK_MIN} min)`} value={stuck} tone={stuck ? "warn" : "default"} />
        <Stat label="Failed · 24 h" value={failed?.length ?? 0} tone={failed?.length ? "bad" : "default"} />
      </div>
      <Card title="Running now">
        <Table head={["Video", "Owner", "Job", "Running for", ""]} empty="Nothing is running.">
          {jobs.map(({ p, what, label }) => {
            const min = minutesSince(p.updated_at);
            return (
              <tr key={`${p.id}-${what}`}>
                <td className={td}><Link href={`/admin/videos/${p.id}`} className="font-medium text-white hover:underline">{projectTitle(p)}</Link></td>
                <td className={`${td} text-zinc-400`}>{email.get(p.user_id) ?? "—"}</td>
                <td className={td}><Badge tone="blue">{label}</Badge></td>
                <td className={td}>{min > STUCK_MIN ? <Badge tone="amber">stuck · {Math.round(min)} min</Badge> : <span className="text-zinc-400">{Math.round(min)} min</span>}</td>
                <td className={`${td} text-right`}>
                  <form action={markFailed.bind(null, p.id, what)}>
                    <ConfirmSubmit message="Stop this job? It will be marked failed so the customer can retry." className={btn}>Stop</ConfirmSubmit>
                  </form>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title="Failed · last 24 hours">
        <Table head={["Video", "Owner", "Error", "When"]} empty="No failures in the last 24 hours.">
          {((failed ?? []) as ProjectRow[]).map((p) => (
            <tr key={p.id}>
              <td className={td}><Link href={`/admin/videos/${p.id}`} className="font-medium text-white hover:underline">{projectTitle(p)}</Link></td>
              <td className={`${td} text-zinc-400`}>{email.get(p.user_id) ?? "—"}</td>
              <td className={`${td} max-w-md text-xs text-rose-300`}>{p.pipeline_error ?? "—"}</td>
              <td className={`${td} text-zinc-500`}>{ago(p.updated_at)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
