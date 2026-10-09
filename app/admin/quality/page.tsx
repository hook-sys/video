import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { RULE_BY_ID, VIDEO_RULES } from "@/lib/video-rules";
import { addRule, toggleRule } from "../actions";
import { Badge, Card, HBar, Notice, PageHeader, Table, btn, btnPrimary, input, td } from "../_components/ui";
import { ago, daysAgo } from "../_components/format";

export const metadata = { title: "Video quality" };

export default async function QualityPage({ searchParams }: PageProps<"/admin/quality">) {
  const { error } = await searchParams;
  const { db } = await requireAdmin();
  const d30 = daysAgo(30);
  const [{ data: mistakes }, { data: recent }, { data: custom }] = await Promise.all([
    db.from("video_mistakes").select("rule_id, project_id").gte("created_at", d30).limit(20000),
    db.from("video_mistakes").select("rule_id, detail, project_id, created_at").order("created_at", { ascending: false }).limit(25),
    db.from("video_rules").select("*").order("created_at", { ascending: false }),
  ]);
  const byRule = new Map<string, number>();
  for (const m of mistakes ?? []) byRule.set(m.rule_id, (byRule.get(m.rule_id) ?? 0) + 1);
  const top = [...byRule.entries()].sort((a, b) => b[1] - a[1]);
  const videos = new Set((mistakes ?? []).map((m) => m.project_id)).size;

  return (
    <>
      <PageHeader title="Video quality" sub={`The composition rulebook and the mistakes caught in generated videos. ${mistakes?.length ?? 0} violations in ${videos} videos over 30 days.`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Rules broken most · 30 days">
          <div className="flex flex-col gap-3">
            {top.length ? top.map(([id, n]) => <HBar key={id} label={<span title={RULE_BY_ID.get(id)?.never}>{id}</span>} value={n} max={top[0][1]} />) : <p className="text-sm text-zinc-500">No mistakes logged.</p>}
          </div>
          <p className="mt-4 text-xs text-zinc-500">The most broken rules are stressed automatically in the Director&apos;s prompt.</p>
        </Card>
        <Card title="Latest violations">
          <Table head={["Rule", "Detail", "Video", "When"]} empty="No violations yet.">
            {(recent ?? []).map((m, i) => (
              <tr key={i}>
                <td className={td}><Badge tone="amber">{m.rule_id}</Badge></td>
                <td className={`${td} max-w-[220px] truncate text-xs text-zinc-400`} title={m.detail ?? ""}>{m.detail}</td>
                <td className={td}>{m.project_id ? <Link href={`/admin/videos/${m.project_id}`} className="text-xs text-[#9cc2ff] hover:underline">open</Link> : "—"}</td>
                <td className={`${td} text-xs text-zinc-500`}>{ago(m.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Card title="Add a rule (live without a deploy)">
        {typeof error === "string" && <div className="mb-3"><Notice tone="warn">{error}</Notice></div>}
        <form action={addRule} className="grid gap-3 md:grid-cols-[180px_1fr_200px_auto]">
          <input name="id" required placeholder="rule-id" pattern="[a-z0-9-]{2,40}" className={input} />
          <input name="never" required minLength={10} maxLength={300} placeholder="never … (what the Director must not do)" className={input} />
          <input name="note" placeholder="Where it went wrong (optional)" className={input} />
          <button className={btnPrimary}>Add rule</button>
        </form>
        <div className="mt-4">
          <Table head={["Rule", "Never", "Note", "Status", ""]} empty="No custom rules yet.">
            {(custom ?? []).map((r) => (
              <tr key={r.id}>
                <td className={td}><code className="text-xs text-[#9cc2ff]">{r.id}</code></td>
                <td className={`${td} text-sm`}>{r.never}</td>
                <td className={`${td} text-xs text-zinc-500`}>{r.note ?? "—"}</td>
                <td className={td}><Badge tone={r.active ? "green" : "gray"}>{r.active ? "active" : "off"}</Badge></td>
                <td className={`${td} text-right`}>
                  <form action={toggleRule.bind(null, r.id, !r.active)}>
                    <button className={btn}>{r.active ? "Turn off" : "Turn on"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>
      <Card title={`Built-in rules (${VIDEO_RULES.length})`}>
        <Table head={["Rule", "Never", "Enforced by", "Seen in"]}>
          {VIDEO_RULES.map((r) => (
            <tr key={r.id}>
              <td className={td}><code className="text-xs text-[#9cc2ff]">{r.id}</code></td>
              <td className={`${td} text-sm`}>{r.never}</td>
              <td className={td}><div className="flex flex-wrap gap-1">{r.enforced.map((e) => <Badge key={e} tone={e === "code" ? "green" : e === "detect" ? "blue" : "gray"}>{e}</Badge>)}</div></td>
              <td className={`${td} text-xs text-zinc-500`}>{r.seen}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
