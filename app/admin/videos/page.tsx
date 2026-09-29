import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Badge, Card, Filters, PageHeader, Table, input, td } from "../_components/ui";
import { PROJECT_COLUMNS, STATE_LABEL, ago, cleanSearch, projectTitle, videoState, type ProjectRow, type VideoState } from "../_components/format";

export const metadata = { title: "Videos" };

// Status filters, as database conditions matching videoState().
const FILTER: Record<string, string> = {
  completed: "render_status.eq.completed",
  rendering: "render_status.eq.processing",
  failed: "pipeline_status.eq.failed,render_status.eq.failed",
  generating: "pipeline_status.eq.running",
  needs_input: "pipeline_status.eq.needs_input",
};

export default async function VideosPage({ searchParams }: PageProps<"/admin/videos">) {
  const { q, status } = await searchParams;
  const search = cleanSearch(q);
  const filter = typeof status === "string" && status in FILTER ? status : "";
  const { db } = await requireAdmin();

  let query = db.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (search) query = query.or(`brand_name.ilike.%${search}%,website_url.ilike.%${search}%`);
  if (filter) query = query.or(FILTER[filter]);
  const [{ data }, { data: users }] = await Promise.all([query, db.from("profiles").select("id, email")]);
  const email = new Map((users ?? []).map((u) => [u.id, u.email]));
  const rows = ((data ?? []) as ProjectRow[]).filter((p) => !filter || videoState(p) === (filter as VideoState));

  return (
    <>
      <PageHeader title="Videos" sub={`${rows.length} shown (newest 300 at most)`}>
        <form className="w-full sm:w-72">
          <input name="q" defaultValue={search} placeholder="Search brand or website…" className={input} />
        </form>
      </PageHeader>
      <Filters
        base="/admin/videos"
        current={filter}
        items={[{ value: "", label: "All" }, ...Object.keys(FILTER).map((k) => ({ value: k, label: STATE_LABEL[k as VideoState][0] }))]}
      />
      <Card>
        <Table head={["Video", "Owner", "Status", "Step", "Length", "4K", "Created"]} empty="No videos match.">
          {rows.map((p) => {
            const [label, tone] = STATE_LABEL[videoState(p)];
            return (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className={td}><Link href={`/admin/videos/${p.id}`} className="font-medium text-white hover:underline">{projectTitle(p)}</Link></td>
                <td className={td}><Link href={`/admin/users/${p.user_id}`} className="text-zinc-400 hover:text-white">{email.get(p.user_id) ?? "—"}</Link></td>
                <td className={td}><Badge tone={tone}>{label}</Badge></td>
                <td className={`${td} text-xs text-zinc-500`}>{p.pipeline_step ?? "—"}</td>
                <td className={`${td} tabular-nums text-zinc-400`}>{p.duration_seconds ? `${p.duration_seconds}s` : "—"}</td>
                <td className={td}>{p.render_4k_status && p.render_4k_status !== "idle" ? <Badge tone={p.render_4k_status === "completed" ? "green" : p.render_4k_status === "failed" ? "red" : "blue"}>{p.render_4k_status}</Badge> : <span className="text-zinc-600">—</span>}</td>
                <td className={`${td} text-zinc-500`}>{ago(p.created_at)}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
