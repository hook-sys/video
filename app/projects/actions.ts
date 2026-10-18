"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { userAccess } from "@/lib/admin";
import { getSettings } from "@/lib/app-settings";
import { startPipelineV2 } from "@/lib/v2/pipeline";
import { collectServerRender, startServerRender } from "@/lib/render-server";
import { TIER_IDS, type TierId, chargeVideo } from "@/lib/billing";

// The project page's actions (a video is created in v2-actions.ts).

// The MP4 made on the server for a finished video that has none yet (the
// project page asks once the video is ready; the render runs after the
// response, in this request's own time).
export async function startRender(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // RLS: only the owner's project
  const { data: project } = await supabase.from("projects").select("pipeline_status, render_status").eq("id", projectId).maybeSingle();
  // (once: a render that failed leaves the download in the browser)
  if (!project || project.pipeline_status !== "completed" || project.render_status !== "idle") return;
  if ((await getSettings()).feature_server_render === false) return;
  after(() => startServerRender(projectId).then(() => {}));
}

// Where the server's render of this video is (the project page asks while it
// waits; the file is stored when it is done).
export async function renderProgress(projectId: string) {
  const supabase = await createClient();
  // RLS: only the owner's project
  const { data } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!data) return { status: "failed" as const };
  return collectServerRender(projectId);
}

// Retries the pipeline from the failed step (the steps already done are kept).
export async function retryPipeline(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only returns the project if this user owns it.
  const { data: project } = await supabase.from("projects").select("pipeline_status, credits_charged, quality, duration_seconds").eq("id", projectId).maybeSingle();
  if (!project || !["failed", "idle"].includes(project.pipeline_status)) return;
  // its credits were given back when it failed: taken again for the new try
  const { admin: team } = await userAccess(supabase, user.id);
  if (!team && !project.credits_charged) {
    try {
      await chargeVideo(projectId, user.id, (TIER_IDS as readonly string[]).includes(project.quality) ? (project.quality as TierId) : "standard", Number(project.duration_seconds) || 0);
    } catch {
      redirect("/billing?error=" + encodeURIComponent("Not enough credits to try this video again. Add credits, then retry."));
    }
  }
  await startPipelineV2(projectId, user.id);
  revalidatePath(`/projects/${projectId}`);
}
