"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { userAccess } from "@/lib/admin";
import { getSettings } from "@/lib/app-settings";
import { startPipelineV2 } from "@/lib/v2/pipeline";
import { collectServerRender, startServerRender } from "@/lib/render-server";
import { TIER_IDS, type TierId, changeCredits, chargeVideo, editCost, getBilling } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { type PlanEdit, applyEdit } from "@/components/video/simple/edit";
import { checkPlan } from "@/components/video/simple/check";
import { isSimple } from "@/components/video/simple/types";

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
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project || !["failed", "idle"].includes(project.pipeline_status)) return;
  // its credits were given back when it failed: taken again for the new try (a free trial video: none)
  const { admin: team } = await userAccess(supabase, user.id);
  if (!team && !project.trial && !project.credits_charged) {
    try {
      await chargeVideo(projectId, user.id, (TIER_IDS as readonly string[]).includes(project.quality) ? (project.quality as TierId) : "standard", Number(project.duration_seconds) || 0);
    } catch {
      redirect("/billing?error=" + encodeURIComponent("Not enough credits to try this video again. Add credits, then retry."));
    }
  }
  await startPipelineV2(projectId, user.id);
  revalidatePath(`/projects/${projectId}`);
}

// A saved edit kept, and paid for: the first free, each after costs credits
// (/admin/billing; the team's own videos never). The charge is taken first and
// given back if the save doesn't land — also when another save of this video
// got in first (the count read is the count written over, or nothing is).
async function keepEdit(projectId: string, userId: string, brief: object): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: row, error: readError } = await db.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (readError || !row) return { ok: false, error: "The change could not be saved. Please try again." };
  // (a free trial video is shown as it was made)
  if (row.trial) return { ok: false, error: "Free trial videos can't be edited. Load credits on the Credits page to make videos you can edit." };
  const used = Number(row.edit_count) || 0;
  const supabase = await createClient();
  const team = (await userAccess(supabase, userId)).admin;
  const cost = team ? 0 : editCost(await getBilling(), used);
  if (cost > 0) {
    try {
      await changeCredits(userId, -cost, "edit", { project: projectId, note: `Video edit ${used + 1}` });
    } catch (e) {
      return { ok: false, error: e instanceof Error && e.message === "insufficient_credits" ? `Saving this edit needs ${cost} credits. Add credits on the Credits page.` : "The change could not be saved. Please try again." };
    }
  }
  const { data: saved, error } = await db
    .from("projects")
    .update({ brief, edit_count: used + 1, render_status: "idle", render_error: null, video_path: null })
    .eq("id", projectId)
    .eq("user_id", userId)
    .eq("edit_count", used)
    .select("id");
  if (error || !saved?.length) {
    if (cost > 0) await changeCredits(userId, cost, "edit", { project: projectId, note: "Edit not saved — credits returned" }).catch((e) => console.error("edit refund failed:", projectId, e));
    return { ok: false, error: "The change could not be saved. Please try again." };
  }
  return { ok: true };
}

// The customer's edit of their finished video (components/video/simple/edit.ts):
// applied to the plan as stored, checked like a drawn plan, then kept — the
// plan it was made as kept too, to go back to. The MP4 made before is no
// longer this video: it is made again (or rendered in the browser).
export async function saveVideoEdit(projectId: string, edit: PlanEdit): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  // RLS: only the owner's project
  const { data: project } = await supabase.from("projects").select("brief, pipeline_status").eq("id", projectId).maybeSingle();
  const composer = (project?.brief as { composer?: { simple?: unknown; original?: unknown } } | null)?.composer;
  if (!project || project.pipeline_status !== "completed" || !composer || !isSimple(composer.simple)) return { ok: false, error: "This video can't be edited." };
  const applied = applyEdit(composer.simple, edit);
  if (applied.error !== undefined) return { ok: false, error: applied.error };
  // (a problem the video had before the edit is not the edit's)
  const had = new Set(checkPlan(composer.simple).map((x) => `${x.scene}:${x.detail}`));
  const problems = checkPlan(applied.plan).filter((x) => !had.has(`${x.scene}:${x.detail}`));
  if (problems.length) return { ok: false, error: `This change doesn't fit: ${problems[0].detail}.` };
  const brief = { ...(project.brief as object), composer: { ...composer, simple: applied.plan, original: composer.original ?? composer.simple, edited: new Date().toISOString() } };
  const kept = await keepEdit(projectId, user.id, brief);
  if (kept.ok) revalidatePath(`/projects/${projectId}`);
  return kept;
}

// The video back as it was made (before any edit) — counted, and paid for, as an edit
export async function resetVideoEdit(projectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const { data: project } = await supabase.from("projects").select("brief").eq("id", projectId).maybeSingle();
  const composer = (project?.brief as { composer?: { simple?: unknown; original?: unknown } } | null)?.composer;
  if (!project || !composer || !isSimple(composer.original)) return { ok: false, error: "This video has no edit to undo." };
  // (the plan it was made as, and nothing left of the edit)
  const kept: Record<string, unknown> = { ...composer, simple: composer.original };
  delete kept.original;
  delete kept.edited;
  const brief = { ...(project.brief as object), composer: kept };
  const r = await keepEdit(projectId, user.id, brief);
  if (r.ok) revalidatePath(`/projects/${projectId}`);
  return r;
}
