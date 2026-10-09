import { requireAdmin } from "@/lib/admin";
import { VIDEO_RULES } from "@/lib/video-rules";
import { addRule, toggleRule } from "../actions";
import { Badge, Card, Notice, PageHeader, Table, btn, btnPrimary, input, td } from "../_components/ui";

export const metadata = { title: "Video rules" };

export default async function QualityPage({ searchParams }: PageProps<"/admin/quality">) {
  const { error } = await searchParams;
  const { db } = await requireAdmin();
  const { data: custom } = await db.from("video_rules").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Video rules" sub="What the Motion Director must never do. Rules you add here apply to the next video, without a deploy." />
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
