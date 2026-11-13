import { createAdminClient } from "@/lib/supabase/admin";

// Keeps the Supabase project awake: on the free plan a project with no
// activity for a week is paused (and sign-in stops working until it is
// restored). Vercel's cron (vercel.json) calls this once a day on the
// production deployment; one small read through the database API is the
// activity. With CRON_SECRET set in Vercel, only Vercel's cron may call it.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const started = Date.now();
  const { error } = await createAdminClient().from("app_settings").select("key").limit(1);
  if (error) {
    console.error("keep-alive: database read failed:", error.message);
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true, ms: Date.now() - started });
}
