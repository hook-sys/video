import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const rows: [string, string][] = [
    ["Website URL", project.website_url ?? "—"],
    ["Direction", project.direction],
    ["Duration", `${project.duration_seconds} sec`],
    ["Format", project.format],
    ["Voice language", project.voice_language],
    ["Voice style", project.voice_style],
    ["Status", project.status],
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/dashboard" className="text-sm text-foreground/70 underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">Project</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-foreground/60">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <button
        disabled
        title="Coming soon"
        className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background opacity-50"
      >
        Generate Video
      </button>
    </main>
  );
}
