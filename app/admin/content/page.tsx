import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { DEMOS } from "@/components/landing/demos";
import { Badge, Card, Notice, PageHeader, Table, td } from "../_components/ui";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader title="Content" sub="The example videos on the landing page." />
      <Notice>Demo videos are added in the code (components/landing/demos.ts, files in public/demos/) — send them and they will be added.</Notice>
      <Card title="Landing examples" action={<Link href="/#examples" className="text-xs text-[#9cc2ff] hover:underline">Open ↗</Link>}>
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
    </>
  );
}
