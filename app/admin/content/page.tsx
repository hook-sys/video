import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { DEMOS } from "@/components/landing/demos";
import fonts from "@/public/fonts/library/catalog.json";
import { Badge, Card, Notice, PageHeader, Stat, Table, td } from "../_components/ui";

export const metadata = { title: "Content" };

// The landing-page SFX in public/sfx/.
const SFX = ["click", "digital_processing", "reveal", "soft_pop", "subtle_impact", "success_chime", "typing", "whoosh"];

export default async function ContentPage() {
  await requireAdmin();
  const ready = DEMOS.filter((d) => d.src).length;
  const categories = new Map<string, number>();
  for (const f of fonts as { category: string }[]) categories.set(f.category, (categories.get(f.category) ?? 0) + 1);

  return (
    <>
      <PageHeader title="Content" sub="What the landing page and the video engine use." />
      <Notice>Content is read-only here for now. Demo videos are added in the code (components/landing/demos.ts, files in public/demos/) — send them and they will be added.</Notice>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Demo videos" value={`${ready}/${DEMOS.length}`} hint="Ready on the landing page" tone={ready === DEMOS.length ? "good" : "warn"} />
        <Stat label="Sound effects" value={SFX.length} />
        <Stat label="Fonts" value={(fonts as unknown[]).length} hint={[...categories.entries()].map(([k, n]) => `${n} ${k}`).join(" · ")} />
        <Stat label="Landing page" value={<Link href="/" className="text-violet-300 hover:underline">Open ↗</Link>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Landing demo gallery">
          <Table head={["Demo", "Industry", "Status"]}>
            {DEMOS.map((d) => (
              <tr key={d.title}>
                <td className={td}>{d.title}</td>
                <td className={`${td} text-zinc-400`}>{d.industry}</td>
                <td className={td}><Badge tone={d.src ? "green" : "amber"}>{d.src ? "live" : "coming soon"}</Badge></td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Sound effects">
          <div className="flex flex-col gap-2">
            {SFX.map((s) => (
              <div key={s} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
                <code className="text-xs text-zinc-300">{s}</code>
                <audio controls preload="none" src={`/sfx/${s}.mp3`} className="h-8 w-56" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title={`Font library (${(fonts as unknown[]).length})`}>
        <div className="flex flex-wrap gap-1.5">
          {(fonts as { family: string; category: string }[]).map((f) => (
            <span key={f.family} className="rounded-md bg-white/[0.04] px-2 py-1 text-xs text-zinc-300" title={f.category}>{f.family}</span>
          ))}
        </div>
      </Card>
    </>
  );
}
