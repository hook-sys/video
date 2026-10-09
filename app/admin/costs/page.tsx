import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Bars, Card, HBar, Notice, PageHeader, Stat, Table, td } from "../_components/ui";
import { daysAgo, lastDays, usd } from "../_components/format";

export const metadata = { title: "Costs" };

// What each AI text call was for (cost_events.metadata.kind).
const JOBS: Record<string, string> = { brief: "Script & brief", motion_director: "Motion Director", composer_director: "Composer Director (before Oct 2026)", composer_change: "Change it", story_director: "Studio Director", flow_director: "Old Shot/Scene Director", screenshots: "Screenshot reading" };
const OPS: Record<string, string> = { openai_brief: "Script & director (AI)", fal_voice: "Voice (FAL)", fal_image: "Images (FAL)", remotion_render: "Rendering", storage: "Storage" };

export default async function CostsPage() {
  const { db } = await requireAdmin();
  const d30 = daysAgo(30);
  const [{ data: events }, { data: users }, { count: videos30 }, { data: bench }] = await Promise.all([
    db.from("cost_events").select("user_id, project_id, operation, model, estimated_cost_usd, created_at, kind:metadata->>kind").gte("created_at", d30).limit(50000),
    db.from("profiles").select("id, email"),
    db.from("projects").select("id", { count: "exact", head: true }).gte("created_at", d30),
    db.from("benchmark_runs").select("duration_seconds, resolution, estimated_cost_usd, render_ms, status").eq("status", "completed").order("started_at", { ascending: false }).limit(20),
  ]);
  const list = events ?? [];
  const total = list.reduce((a, e) => a + Number(e.estimated_cost_usd), 0);
  const sum = (key: (e: (typeof list)[number]) => string) => {
    const m = new Map<string, number>();
    for (const e of list) m.set(key(e), (m.get(key(e)) ?? 0) + Number(e.estimated_cost_usd));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byOp = sum((e) => e.operation);
  const byModel = sum((e) => e.model ?? "—").slice(0, 8);
  const byUser = sum((e) => e.user_id).slice(0, 10);
  // AI text jobs: total, and per video that ran the job
  const jobs = [...list.filter((e) => e.operation === "openai_brief").reduce((m, e) => {
    const k = String(e.kind ?? "other");
    const j = m.get(k) ?? { cost: 0, videos: new Set<string>() };
    j.cost += Number(e.estimated_cost_usd);
    if (e.project_id) j.videos.add(e.project_id);
    return m.set(k, j);
  }, new Map<string, { cost: number; videos: Set<string> }>())].sort((a, b) => b[1].cost - a[1].cost);
  const email = new Map((users ?? []).map((u) => [u.id, u.email]));
  const days = lastDays(30).map((d) => ({ label: d.label.split(" ")[0], a: Math.round(list.filter((e) => e.created_at.startsWith(d.key)).reduce((a, e) => a + Number(e.estimated_cost_usd), 0) * 100) / 100 }));

  return (
    <>
      <PageHeader title="Costs" sub="Estimated provider cost (AI, voice, images, rendering) over the last 30 days." />
      {list.length === 0 && (
        <Notice tone="warn">
          The cost ledger has no entries for the last 30 days.
        </Notice>
      )}
      <Notice>
        Script, director, voice and image calls are recorded at the prices on <Link href="/admin/models" className="underline">AI models</Link> (or the environment&apos;s pricing when a model has none, which may be $0). Downloads render in the customer&apos;s browser.
      </Notice>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total · 30 days" value={usd(total)} />
        <Stat label="Videos · 30 days" value={videos30 ?? 0} />
        <Stat label="Per video" value={videos30 ? usd(total / videos30) : "—"} hint="Ledger total ÷ videos" />
        <Stat label="Biggest cost" value={byOp[0] ? OPS[byOp[0][0]] ?? byOp[0][0] : "—"} />
      </div>
      <Card title="Cost per day · 30 days (USD)">
        <Bars data={days} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="By operation">
          <div className="flex flex-col gap-3">{byOp.length ? byOp.map(([k, v]) => <HBar key={k} label={OPS[k] ?? k} value={Math.round(v * 100) / 100} max={byOp[0][1]} prefix="$" />) : <p className="text-sm text-zinc-500">No data.</p>}</div>
        </Card>
        <Card title="By model">
          <div className="flex flex-col gap-3">{byModel.length ? byModel.map(([k, v]) => <HBar key={k} label={k} value={Math.round(v * 100) / 100} max={byModel[0][1]} prefix="$" />) : <p className="text-sm text-zinc-500">No data.</p>}</div>
        </Card>
        <Card title="Top users">
          <div className="flex flex-col gap-3">
            {byUser.length ? byUser.map(([k, v]) => <HBar key={k} label={<Link href={`/admin/users/${k}`} className="hover:underline">{email.get(k) ?? k.slice(0, 8)}</Link>} value={Math.round(v * 100) / 100} max={byUser[0][1]} prefix="$" />) : <p className="text-sm text-zinc-500">No data.</p>}
          </div>
        </Card>
      </div>
      <Card title="AI text jobs · 30 days">
        <Table head={["Job", "Total", "Videos", "Per video"]} empty="No AI text calls recorded.">
          {jobs.map(([k, j]) => (
            <tr key={k}>
              <td className={td}>{JOBS[k] ?? k}</td>
              <td className={`${td} tabular-nums`}>{usd(j.cost)}</td>
              <td className={`${td} tabular-nums`}>{j.videos.size}</td>
              <td className={`${td} tabular-nums text-zinc-400`}>{j.videos.size ? usd(j.cost / j.videos.size) : "—"}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-zinc-500">Before Oct 8 the three Directors were recorded together as &quot;Old Shot/Scene Director&quot;.</p>
      </Card>
      <Card title="Benchmark runs (measured, latest 20)">
        <Table head={["Length", "Resolution", "Render time", "Cost", "Cost / minute"]} empty="No completed benchmark runs.">
          {(bench ?? []).map((b, i) => (
            <tr key={i}>
              <td className={td}>{b.duration_seconds}s</td>
              <td className={td}>{b.resolution}</td>
              <td className={`${td} tabular-nums`}>{b.render_ms ? `${Math.round(b.render_ms / 1000)} s` : "—"}</td>
              <td className={`${td} tabular-nums`}>{usd(Number(b.estimated_cost_usd ?? 0))}</td>
              <td className={`${td} tabular-nums text-zinc-400`}>{b.duration_seconds ? usd((Number(b.estimated_cost_usd ?? 0) / b.duration_seconds) * 60) : "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
