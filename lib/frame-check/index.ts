import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Sandbox } from "@vercel/sandbox";
import { addBundleToSandbox, createSandbox } from "@remotion/vercel";
import { createAdminClient } from "@/lib/supabase/admin";
import { RENDER_PROJECT_COLUMNS, type RenderProject, buildRenderInput } from "@/lib/render-input";
import { type FrameCheck, PROBE_PREFIX, type ProbeSample, checkFrames, framesToCheck } from "@/components/video/composer/frame-check";
import { COMPOSER_ID, type ComposerPlan } from "@/components/video/composer/types";
import { FRAME_SCRIPT } from "./script";

// The frame check, on the server: the video is opened in a browser in a
// Vercel Sandbox (Vercel Functions have none), every few frames are laid out
// with the probe on, and what was on screen is checked (frame-check.ts) —
// before the customer sees the video.
//
// The sandbox is made once per film (the bundle built before `next build`,
// scripts/frame-check/bundle.mjs) and kept as a snapshot; each check starts
// from it in seconds. Never throws: a check that cannot run says why.

const BUNDLE_DIR = path.join(process.cwd(), ".remotion-bundle");
const SNAPSHOT_KEY = "frame_check_snapshot";
const HOME = "/vercel/sandbox";
const SCRIPT = "frame-check.mjs";
const VCPUS = 4;

export type FrameCheckResult = FrameCheck & { at: string; ms: number } | { at: string; ms: number; skipped: string };

async function bundleHash() {
  return (await readFile(path.join(BUNDLE_DIR, "frame-check.hash"), "utf8").catch(() => "")).trim();
}

// The snapshot of a sandbox ready to check this film (made the first time;
// one making at a time on a server).
const making = new Map<string, Promise<string>>();
function snapshotFor(hash: string, signal: AbortSignal): Promise<string> {
  if (!making.has(hash)) making.set(hash, makeSnapshot(hash, signal).catch((e) => (making.delete(hash), Promise.reject(e))));
  return making.get(hash)!;
}

// The snapshot for the film this server was built with (the server render,
// lib/render-server.ts, starts from it too).
export async function filmSnapshot(signal: AbortSignal): Promise<string> {
  const hash = await bundleHash();
  if (!hash) throw new Error("the film was not bundled");
  return snapshotFor(hash, signal);
}

// Gets the sandbox ready while the video is still being made (the first
// check after a new film takes a few minutes otherwise).
export async function prepareFrameCheck(budgetMs: number) {
  const hash = await bundleHash();
  if (hash) await snapshotFor(hash, AbortSignal.timeout(budgetMs)).catch((e) => console.warn("frame check: not ready:", e instanceof Error ? e.message : e));
}

async function makeSnapshot(hash: string, signal: AbortSignal): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", SNAPSHOT_KEY).maybeSingle();
  const saved = data?.value as { id?: string; bundle?: string } | null;
  if (saved?.id && saved.bundle === hash) return saved.id;
  // a browser, the renderer, the film and the script — then kept
  const sandbox = await createSandbox({ resources: { vcpus: VCPUS }, timeoutInMilliseconds: 10 * 60_000 });
  try {
    // (addBundleToSandbox makes the bundle's folders but not the bundle's own)
    await sandbox.mkDir("remotion-bundle", { signal }).catch(() => {});
    await addBundleToSandbox({ sandbox, bundleDir: BUNDLE_DIR });
    await sandbox.writeFiles([{ path: SCRIPT, content: Buffer.from(FRAME_SCRIPT) }], { signal });
    const snap = await sandbox.snapshot({ expiration: 0, signal });
    await admin.from("app_settings").upsert({ key: SNAPSHOT_KEY, value: { id: snap.snapshotId, bundle: hash, at: new Date().toISOString() }, updated_at: new Date().toISOString() });
    return snap.snapshotId;
  } catch (e) {
    await sandbox.stop().catch(() => {});
    throw e;
  }
}

// Where each word and thing is on every few frames of the video.
async function probe(plan: ComposerPlan, budgetMs: number): Promise<ProbeSample[]> {
  const hash = await bundleHash();
  if (!hash) throw new Error("the film was not bundled for the check");
  const signal = AbortSignal.timeout(budgetMs);
  const snapshotId = await snapshotFor(hash, signal);
  const sandbox = await Sandbox.create({ source: { type: "snapshot", snapshotId }, resources: { vcpus: VCPUS }, timeout: Math.max(60_000, budgetMs), signal });
  try {
    const cfg = { serveUrl: `${HOME}/remotion-bundle`, id: COMPOSER_ID, plan, frames: framesToCheck(plan.duration), concurrency: VCPUS, prefix: PROBE_PREFIX, out: `${HOME}/frame-check.json` };
    await sandbox.writeFiles([{ path: "frame-check-input.json", content: Buffer.from(JSON.stringify(cfg)) }], { signal });
    const run = await sandbox.runCommand({ cmd: "node", args: [SCRIPT, "frame-check-input.json"], cwd: HOME, signal });
    if (run.exitCode !== 0) throw new Error(`the check did not run: ${(await run.stderr()).slice(-300)}`);
    const out = await sandbox.readFileToBuffer({ path: cfg.out }, { signal });
    if (!out) throw new Error("the check wrote nothing");
    return (JSON.parse(out.toString("utf8")) as { samples: ProbeSample[] }).samples;
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

// The video checked frame by frame, within the time given.
export async function frameCheck(plan: ComposerPlan, budgetMs: number): Promise<FrameCheckResult> {
  const t0 = Date.now();
  const at = new Date().toISOString();
  if (budgetMs < 45_000) return { at, ms: 0, skipped: "no time left for the check" };
  try {
    const samples = await probe(plan, budgetMs);
    if (!samples.length) return { at, ms: Date.now() - t0, skipped: "the check saw no frames" };
    return { ...checkFrames(plan, samples), at, ms: Date.now() - t0 };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    console.warn("frame check:", why);
    return { at, ms: Date.now() - t0, skipped: why.slice(0, 300) };
  }
}

// The project's video (as the customer will see it) checked, and what was
// found kept with it (brief.composer.frames, shown on the admin's video page).
export async function checkProjectFrames(projectId: string, budgetMs: number): Promise<FrameCheckResult | null> {
  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select(RENDER_PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  if (!project) return null;
  const { composer } = await buildRenderInput(admin, project as RenderProject);
  const plan = composer?.plans[0];
  if (!plan) return null;
  const result = await frameCheck(plan, budgetMs);
  const { data: fresh } = await admin.from("projects").select("brief").eq("id", projectId).single();
  const brief = (fresh?.brief as { composer?: object } | null) ?? {};
  if (brief.composer) await admin.from("projects").update({ brief: { ...brief, composer: { ...brief.composer, frames: result } } }).eq("id", projectId);
  console.info("frame check:", { projectId, ...("skipped" in result ? { skipped: result.skipped } : { ok: result.ok, frames: result.frames, findings: result.findings.slice(0, 8).map((f) => `${(f.from / 30).toFixed(1)}s: ${f.what}`) }), ms: result.ms });
  return result;
}
