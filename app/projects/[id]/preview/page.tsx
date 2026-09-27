import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RENDER_PROJECT_COLUMNS, buildRenderInput } from "@/lib/render-input";
import { PreviewPlayer } from "./preview-player";

// Storyboard preview for the project owner (RLS-scoped).
export default async function PreviewPage({ params }: PageProps<"/projects/[id]/preview">) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(RENDER_PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  // Preview tolerates missing voice/assets; the final render does not.
  const { props } = await buildRenderInput(supabase, project);
  if (!props) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href={`/projects/${id}`} className="text-sm text-foreground/70 underline">
        ← Project
      </Link>
      <h1 className="text-xl font-semibold">Video preview</h1>
      <PreviewPlayer {...props} />
      {!props.audioUrl && <p className="text-sm text-foreground/60">No voice yet — silent preview.</p>}
    </main>
  );
}
