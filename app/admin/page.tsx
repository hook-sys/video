import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { RULE_BY_ID } from "@/lib/video-rules";
import { Badge, Bars, Card, HBar, PageHeader, Stat, Table, td } from "./_components/ui";
import { PROJECT_COLUMNS, STATE_LABEL, ago, daysAgo, lastDays, projectTitle, usd, videoState, type ProjectRow } from "./_components/format";

export default async function AdminOverview() {
  const { db } = await requireAdmin();
  const d30 = daysAgo(30);
  const [users, projects, costs, mistakes] = await Promise.all([
    db.from("profiles").select("id, email, created_at, status"),
    db.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }).limit(5000),
    db.from("cost_events").select("estimated_cost_usd, created_at").gte("created_at", d30),
    db.from("video_mistakes").select("rule_id").gte("created_at", d30),
  ]);
  const people = users.data ?? [];
  const all = (projects.data ?? []) as ProjectRow[];
  const email = new Map(people.map((u) => [u.id, u.email]));

  const today = daysAgo(0).slice(0, 10);
  const month = today.slice(0, 7);
  const states = all.map((p) => videoState(p));
  const count = (st: string) => states.filter((x) => x === st).length;
  const finished = count("completed") + count("failed");
  const successRate = finished ? Math.round((count("completed") / finished) * 100) : null;
  const cost30 = (costs.data ?? []).reduce((a, c) => a + Number(c.estimated_cost_usd), 0);
  const newUsers7 = people.filter((u) => u.created_at > daysAgo(7)).length;

  const days = lastDays(14).map((d) => {
    const on = all.filter((p) => p.created_at.slice(0, 10) === d.key);
    return { label: d.label.split(" ")[0], a: on.filter((p) => videoState(p) !== "failed").length, b: on.filter((p) => videoState(p) === "failed").length };
  });

  const byRule = new Map<string, number>();
  for (const m of mistakes.data ?? []) byRule.set(m.rule_id, (byRule.get(m.rule_id) ?? 0) + 1);
  const topRules = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" sub="Everything happening on MotionBrief, at a glance." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={people.length} hint={`${newUsers7} new in 7 days`} />
        <Stat label="Videos today" value={all.filter((p) => p.created_at.startsWith(today)).length} hint={`${all.filter((p) => p.created_at.startsWith(month)).length} this month · ${all.length} total`} />
        <Stat label="Success rate" value={successRate === null ? "—" : `${successRate}%`} hint={`${count("completed")} completed · ${count("failed")} failed`} tone={successRate === null ? "default" : successRate >= 80 ? "good" : successRate >= 50 ? "warn" : "bad"} />
        <Stat label="Cost · 30 days" value={usd(cost30)} hint="Estimated provider cost" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Videos per day · last 14 days" className="lg:col-span-2" action={<span className="flex gap-3 text-xs text-zinc-500"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#0a66d6]" />created</span><span><i className="mr-1 inline-block size-2 rounded-full bg-rose-400" />failed</span></span>}>
          <Bars data={days} />
        </Card>
        <Card title="Right now">
          <div className="flex flex-col gap-3 text-sm">
            {(["generating", "rendering", "needs_input", "preview_ready", "draft"] as const).map((st) => (
              <div key={st} className="flex items-center justify-between">
                <Badge tone={STATE_LABEL[st][1]}>{STATE_LABEL[st][0]}</Badge>
                <span className="tabular-nums text-zinc-300">{count(st)}</span>
              </div>
            ))}
            <Link href="/admin/queue" className="mt-2 text-xs text-[#9cc2ff] hover:underline">Open render queue →</Link>
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Latest videos" className="lg:col-span-2" action={<Link href="/admin/videos" className="text-xs text-[#9cc2ff] hover:underline">All videos →</Link>}>
          <Table head={["Video", "Owner", "Status", "Created"]}>
            {all.slice(0, 8).map((p) => {
              const [label, tone] = STATE_LABEL[videoState(p)];
              return (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className={td}><Link href={`/admin/videos/${p.id}`} className="font-medium text-white hover:underline">{projectTitle(p)}</Link></td>
                  <td className={`${td} text-zinc-400`}>{email.get(p.user_id) ?? "—"}</td>
                  <td className={td}><Badge tone={tone}>{label}</Badge></td>
                  <td className={`${td} text-zinc-500`}>{ago(p.created_at)}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <Card title="Most broken video rules · 30 days" action={<Link href="/admin/quality" className="text-xs text-[#9cc2ff] hover:underline">Quality →</Link>}>
          <div className="flex flex-col gap-3">
            {topRules.length ? topRules.map(([id, n]) => <HBar key={id} label={<span title={RULE_BY_ID.get(id)?.never}>{id}</span>} value={n} max={topRules[0][1]} />) : <p className="text-sm text-zinc-500">No mistakes logged in 30 days.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
