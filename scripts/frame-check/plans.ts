// The frame check on a machine (scripts/frame-check/local.mjs): a project's
// video as the customer sees it (the plan, from the database), and what the
// check finds in the frames. No AI, no Vercel Sandbox.
import { createAdminClient } from "@/lib/supabase/admin";
import { RENDER_PROJECT_COLUMNS, type RenderProject, buildRenderInput } from "@/lib/render-input";
import { checkFrames, type ProbeSample } from "@/components/video/composer/frame-check";
import type { ComposerPlan } from "@/components/video/composer/types";

export { checkFrames, framesToCheck, PROBE_PREFIX } from "@/components/video/composer/frame-check";

// every video kept with the project (its 4 versions where it has them)
export async function plansOf(projectId: string): Promise<{ id: string; plans: ComposerPlan[] }> {
  const db = createAdminClient();
  const q = db.from("projects").select(RENDER_PROJECT_COLUMNS);
  const { data, error } = await (projectId.length < 36 ? q.like("id", `${projectId}%`).limit(2) : q.eq("id", projectId).limit(1));
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`no project ${projectId}`);
  if (data.length > 1) throw new Error(`${projectId}: more than one project starts so — give more of the id`);
  const project = data[0] as unknown as RenderProject & { id: string };
  const { composer, problems } = await buildRenderInput(db, project);
  if (!composer?.plans.length) throw new Error(`${projectId}: no video (${problems.join("; ")})`);
  return { id: project.id, plans: composer.plans };
}

export const check = (plan: ComposerPlan, samples: ProbeSample[]) => checkFrames(plan, samples);
