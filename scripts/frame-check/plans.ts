// The frame check on a machine (scripts/frame-check/local.mjs): a project's
// video as the customer sees it (the plan, from the database), and what the
// check finds in the frames. No AI, no Vercel Sandbox.
import { createAdminClient } from "@/lib/supabase/admin";
import { RENDER_PROJECT_COLUMNS, type RenderProject, buildRenderInput } from "@/lib/render-input";
import { checkFrames, type ProbeSample } from "@/components/video/composer/frame-check";
import type { ComposerPlan } from "@/components/video/composer/types";

export { checkFrames, framesToCheck, PROBE_PREFIX } from "@/components/video/composer/frame-check";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// every video kept with the project (its 4 versions where it has them) — by its full id, matched exactly
export async function plansOf(projectId: string): Promise<{ id: string; plans: ComposerPlan[] }> {
  if (!UUID.test(projectId)) throw new Error(`${projectId}: give the project's full id (a UUID, as on its admin page)`);
  const db = createAdminClient();
  const { data, error } = await db.from("projects").select(RENDER_PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`no project ${projectId}`);
  const project = data as unknown as RenderProject & { id: string };
  const { composer, problems } = await buildRenderInput(db, project);
  if (!composer?.plans.length) throw new Error(`${projectId}: no video (${problems.join("; ")})`);
  return { id: project.id, plans: composer.plans };
}

export const check = (plan: ComposerPlan, samples: ProbeSample[]) => checkFrames(plan, samples);
