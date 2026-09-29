import { generateSoundEffect } from "@/lib/ai/fal";
import { createAdminClient } from "@/lib/supabase/admin";

// Builds the SFX library: generates the sound effects queued in `sfx_jobs`
// (rows added by the team) with Fal and stores the audio on the row for
// review. Preview only; takes no input, so a call can only run queued work.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUDGET_MS = 240_000;
const BATCH = 8;

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return new Response("Not found", { status: 404 });
  const started = Date.now();
  const admin = createAdminClient();
  const counts = { done: 0, failed: 0 };
  while (Date.now() - started < BUDGET_MS) {
    const { data: queued } = await admin.from("sfx_jobs").select("id").eq("status", "queued").order("id").limit(BATCH);
    if (!queued?.length) break;
    // Claim the batch so parallel calls never generate the same row twice.
    const { data: jobs } = await admin
      .from("sfx_jobs")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .in("id", queued.map((q) => q.id))
      .eq("status", "queued")
      .select("id, prompt, duration_seconds");
    await Promise.all(
      (jobs ?? []).map(async (job) => {
        try {
          const { audio } = await generateSoundEffect(job.prompt, Number(job.duration_seconds));
          await admin.from("sfx_jobs").update({ status: "done", audio_b64: Buffer.from(audio).toString("base64"), error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
          counts.done++;
        } catch (e) {
          await admin.from("sfx_jobs").update({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", job.id);
          counts.failed++;
        }
      }),
    );
  }
  const { count: left } = await admin.from("sfx_jobs").select("id", { count: "exact", head: true }).eq("status", "queued");
  return Response.json({ ...counts, queued: left ?? 0, ms: Date.now() - started });
}
