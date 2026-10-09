import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { VIDEOS_BUCKET } from "@/lib/projects";
import { deleteProject, markFailed } from "../../actions";
import { ConfirmSubmit } from "../../_components/confirm-submit";
import { Badge, Card, PageHeader, Table, btn, btnDanger, td } from "../../_components/ui";
import { STATE_LABEL, ago, projectTitle, usd, videoState } from "../../_components/format";

export default async function VideoPage({ params }: PageProps<"/admin/videos/[id]">) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: p } = await db.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: owner }, { data: costs }, video] = await Promise.all([
    db.from("profiles").select("id, email").eq("id", p.user_id).maybeSingle(),
    db.from("cost_events").select("operation, model, estimated_cost_usd, created_at").eq("project_id", id).order("created_at"),
    p.video_path ? db.storage.from(VIDEOS_BUCKET).createSignedUrl(p.video_path, 3600) : null,
  ]);
  const [label, tone] = STATE_LABEL[videoState(p)];
  const total = (costs ?? []).reduce((a, c) => a + Number(c.estimated_cost_usd), 0);
  const errors = [
    ["Pipeline", p.pipeline_error],
    ["Brief", p.brief_error],
    ["Voice", p.voice_error],
    ["Assets", p.assets_error],
    ["Render", p.render_error],
  ].filter(([, e]) => e);
  const stages: [string, string | null][] = [
    ["Pipeline", p.pipeline_status],
    ["Brief", p.brief_status],
    ["Voice", p.voice_status],
    ["Assets", p.assets_status],
    ["Render", p.render_status],
  ];
  const stuck = [
    p.pipeline_status === "running" && (["pipeline", "Stop pipeline"] as const),
  ].filter((x) => !!x);

  return (
    <>
      <Link href="/admin/videos" className="text-sm text-zinc-500 hover:text-white">← Videos</Link>
      <PageHeader title={projectTitle(p)} sub={`by ${owner?.email ?? "unknown"} · created ${ago(p.created_at)} · updated ${ago(p.updated_at)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          <Link href={`/projects/${id}`} className={btn}>Open as customer view</Link>
          {stuck.map(([what, text]) => (
            <form key={what} action={markFailed.bind(null, id, what)}>
              <ConfirmSubmit message={`${text}? It will be marked failed so it can be retried.`} className={btn}>{text}</ConfirmSubmit>
            </form>
          ))}
          <form action={deleteProject.bind(null, id)}>
            <ConfirmSubmit message="Delete this video and its files permanently? This can't be undone." className={btnDanger}>Delete</ConfirmSubmit>
          </form>
        </div>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Video" className="lg:col-span-2">
          {video?.data?.signedUrl ? (
            <video src={video.data.signedUrl} controls className="aspect-video w-full rounded-xl bg-black" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl bg-black/40 text-sm text-zinc-500">No rendered video yet.</div>
          )}
          <div className="mt-3 flex gap-2">
            {video?.data?.signedUrl && <a href={video.data.signedUrl} className={btn}>↓ 1080p</a>}
          </div>
        </Card>
        <Card title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {[
              ["Owner", owner ? <Link key="o" href={`/admin/users/${owner.id}`} className="text-[#9cc2ff] hover:underline">{owner.email}</Link> : "—"],
              ["Website", p.website_url ?? "—"],
              ["Length", p.duration_seconds ? `${p.duration_seconds}s` : "—"],
              ["Format", p.format ?? "—"],
              ["Voice", [p.voice_language, p.voice_gender, p.voice_style].filter(Boolean).join(" · ") || "—"],
              ["Brand colour", p.brand_color ?? "—"],
              ["Step", p.pipeline_step ?? "—"],
              ["Cost", usd(total)],
            ].map(([k, v]) => (
              <div key={String(k)} className="contents">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="break-words text-zinc-200">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {stages.map(([k, v]) => (
              <Badge key={k} tone={v === "completed" ? "green" : v === "failed" ? "red" : v === "processing" || v === "running" ? "blue" : "gray"}>{k}: {v ?? "—"}</Badge>
            ))}
          </div>
        </Card>
      </div>
      {errors.length > 0 && (
        <Card title="Errors">
          <div className="flex flex-col gap-2">
            {errors.map(([k, e]) => (
              <p key={k} className="rounded-lg bg-rose-500/[0.07] px-3 py-2 text-sm text-rose-200"><b className="mr-2 text-rose-300">{k}</b>{e}</p>
            ))}
          </div>
        </Card>
      )}
      <Card title="Script & direction">
        <p className="whitespace-pre-wrap text-sm text-zinc-300">{p.direction}</p>
        {p.advanced_direction && <p className="mt-3 whitespace-pre-wrap border-t border-white/5 pt-3 text-sm text-zinc-400">{p.advanced_direction}</p>}
      </Card>
      <Card title="Cost events">
        <Table head={["Operation", "Model", "Cost", "When"]} empty="No cost events recorded for this video.">
          {(costs ?? []).map((c, i) => (
            <tr key={i}>
              <td className={td}>{c.operation}</td>
              <td className={`${td} text-zinc-400`}>{c.model ?? "—"}</td>
              <td className={`${td} tabular-nums`}>{usd(Number(c.estimated_cost_usd))}</td>
              <td className={`${td} text-zinc-500`}>{ago(c.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <details className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 text-sm">
        <summary className="cursor-pointer font-semibold text-zinc-200">Raw brief (JSON)</summary>
        <pre className="mt-3 max-h-[480px] overflow-auto text-xs text-zinc-400">{JSON.stringify(p.brief, null, 2)}</pre>
      </details>
    </>
  );
}
