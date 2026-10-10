import { after } from "next/server";
import { internalAllowed } from "@/lib/internal-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIDEOS_BUCKET, seedFrom } from "@/lib/projects";
import { getBilling } from "@/lib/billing";
import { parseDetails } from "@/lib/project-details";
import { parseWordTimings } from "@/lib/voice-timing";
import { neverList } from "@/lib/video-rules";
import { type BriefUsage } from "@/lib/ai/product-brief";
import { DIRECTOR_PROMPTS, type DirectorPrompt, type MotionInput, type PastLook, directMotion, pastLookOf, reviewMotion } from "@/lib/ai/motion-director";
import { type StoredComposition, composeVariants } from "@/components/video/composer/variants";
import { scriptWords } from "@/components/video/composer/words";
import { frameOf } from "@/components/video/composer/frame";

// Preview only, with the team's key (lib/internal-key.ts): the Motion
// Director's plan for one project's script, with the classic or the creative
// instructions, as the pipeline makes it (plan → review on the voice's times
// → the video built) — nothing on the project changes. `after` names earlier
// test runs (newest first) that stand for what this customer has already
// seen, so a chain of runs is a customer's videos one after another. The run
// is stored in project-videos under internal/director-test/<name>.json and
// read back with ?get=<name>.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DIR = "internal/director-test";
const NAME = /^[a-z0-9-]{1,60}$/;
type Run = { name: string; prompt: DirectorPrompt; project: string; brand: string; video: StoredComposition | null; plan: unknown; idea: string | null; source: string; problems: string[]; usage: BriefUsage[]; ms: number };

async function readRun(name: string): Promise<Run | null> {
  const { data } = await createAdminClient().storage.from(VIDEOS_BUCKET).download(`${DIR}/${name}.json`);
  return data ? (JSON.parse(await data.text()) as Run) : null;
}

export async function GET(request: Request) {
  if (!(await internalAllowed(request))) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const get = url.searchParams.get("get") ?? "";
  if (get) {
    if (!NAME.test(get)) return Response.json({ error: "get=<name>" }, { status: 400 });
    const run = await readRun(get);
    return run ? Response.json(run) : Response.json({ pending: get }, { status: 404 });
  }
  const id = url.searchParams.get("project") ?? "";
  const name = url.searchParams.get("name") ?? "";
  const prompt = url.searchParams.get("prompt") as DirectorPrompt;
  const before = (url.searchParams.get("after") ?? "").split(",").filter(Boolean);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !NAME.test(name) || !DIRECTOR_PROMPTS.includes(prompt) || !before.every((b) => NAME.test(b))) {
    return Response.json({ error: "project=<id>&name=<run>&prompt=classic|creative[&after=<run>,<run>]" }, { status: 400 });
  }
  after(async () => {
    const t0 = Date.now();
    try {
      const run = await direct(id, name, prompt, before);
      await createAdminClient().storage.from(VIDEOS_BUCKET).upload(`${DIR}/${name}.json`, JSON.stringify({ ...run, ms: Date.now() - t0 }), { contentType: "application/json", upsert: true });
      console.info("director-test:", name, prompt, run.source, Math.round((Date.now() - t0) / 1000), "s");
    } catch (e) {
      console.warn("director-test failed:", name, e instanceof Error ? e.message : e);
    }
  });
  return Response.json({ started: name, prompt, project: id, after: before });
}

async function direct(projectId: string, name: string, prompt: DirectorPrompt, before: string[]): Promise<Omit<Run, "ms">> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("brief, format, duration_seconds, brand_name, brand_color, call_to_action, website_url, details, target_audience, voice_result")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("project not found");
  const brief = (project.brief ?? {}) as { script?: string; product_name?: string; product_summary?: string; cta?: string };
  const narration = brief.script ?? "";
  const voice = parseWordTimings((project.voice_result as { timing?: { words?: unknown } } | null)?.timing?.words);
  if (!narration || !voice?.length) throw new Error("no script or voice");
  // what this "customer" has seen: the earlier runs of the chain (as pastOf reads real videos)
  const past = (await Promise.all(before.map(readRun))).filter((r): r is Run => !!r?.video);
  const pastVideos = past.map((r) => r.video!);
  const arts = pastVideos.map((v) => v.script.art);
  const seen = { display: [...new Set(arts.map((a) => a.display))].slice(0, 12), field: [...new Set(arts.map((a) => a.field))].slice(0, 6) };
  const brandName = project.brand_name?.trim() || brief.product_name || "Your product";
  const earlier = past.filter((r) => r.brand.toLowerCase() === brandName.toLowerCase() && r.idea).map((r) => ({ idea: r.idea!, language: r.video?.staging?.language ?? null })).slice(0, 6);
  const looks = pastVideos.map((v) => pastLookOf(v)).filter((x): x is PastLook => !!x).slice(0, 6);
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const brand = { name: brandName, color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || brief.cta || "Get started", url: host, icon: null };
  const details = parseDetails(project.details);
  const [{ data: capture }, billing] = await Promise.all([
    admin.from("website_captures").select("url, title, meta_description, visible_text").eq("project_id", projectId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getBilling(),
  ]);
  const usage: BriefUsage[] = [];
  const input: MotionInput = {
    name: brand.name,
    color: brand.color,
    cta: brand.cta,
    url: brand.url,
    product: brief.product_summary ?? null,
    words: narration.split(/\s+/).filter(Boolean).map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 })),
    website: capture ? { url: capture.url, title: capture.title, description: capture.meta_description, text: capture.visible_text } : null,
    seen,
    earlier,
    known: null,
    never: neverList(),
    category: details?.category ?? null,
    customer: details ? { audience: project.target_audience?.trim() ?? "", features: details.features, before: details.before, mood: details.mood, use: details.use } : null,
    seed: seedFrom(`${projectId}:${name}`),
    model: billing.tiers.pro.model || null,
    prompt,
    recent: looks,
  };
  const first = await directMotion(input, (u) => usage.push(u));
  const words = scriptWords(narration, voice);
  const reviewed = await reviewMotion(first.plan, { ...input, words }, (u) => usage.push(u));
  const plan = reviewed.plan;
  const set = composeVariants({ words, brand, duration: Math.round(project.duration_seconds * 30), seed: input.seed, ideas: plan.ideas, count: 1, avoid: { display: seen.display, field: seen.field.slice(0, 3) }, screens: 0, avoidStaging: pastVideos.map((v) => v.staging ?? null).reverse(), creative: plan.creative, look: { scheme: plan.profile.look.scheme, energy: plan.profile.look.energy }, size: frameOf(project.format) });
  return { name, prompt, project: projectId, brand: brand.name, video: set.videos[0] ?? null, plan: set.plans[0] ?? null, idea: plan.creative.idea, source: plan.source, problems: [...first.problems, ...reviewed.problems, ...set.problems].slice(0, 20), usage };
}
