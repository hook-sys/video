import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { addBundleToSandbox, createSandbox } from "@remotion/vercel";
import { createAdminClient } from "@/lib/supabase/admin";

// The film's sandbox: Vercel Functions have no browser, so the server render
// (lib/render-server.ts) runs in a Vercel Sandbox with Chrome, the renderer
// and the bundled film (scripts/film/bundle.mjs, built before `next build`).
// It is made once per film and kept as a snapshot; each render starts from
// it in seconds.

const BUNDLE_DIR = path.join(process.cwd(), ".remotion-bundle");
const SNAPSHOT_KEY = "film_snapshot";
const VCPUS = 4;

async function bundleHash() {
  return (await readFile(path.join(BUNDLE_DIR, "film.hash"), "utf8").catch(() => "")).trim();
}

// (made the first time; one making at a time on a server)
const making = new Map<string, Promise<string>>();
function snapshotFor(hash: string, signal: AbortSignal): Promise<string> {
  if (!making.has(hash)) making.set(hash, makeSnapshot(hash, signal).catch((e) => (making.delete(hash), Promise.reject(e))));
  return making.get(hash)!;
}

async function makeSnapshot(hash: string, signal: AbortSignal): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", SNAPSHOT_KEY).maybeSingle();
  const saved = data?.value as { id?: string; bundle?: string } | null;
  if (saved?.id && saved.bundle === hash) return saved.id;
  // a browser, the renderer and the film — then kept
  const sandbox = await createSandbox({ resources: { vcpus: VCPUS }, timeoutInMilliseconds: 10 * 60_000 });
  try {
    // (addBundleToSandbox makes the bundle's folders but not the bundle's own)
    await sandbox.mkDir("remotion-bundle", { signal }).catch(() => {});
    await addBundleToSandbox({ sandbox, bundleDir: BUNDLE_DIR });
    const snap = await sandbox.snapshot({ expiration: 0, signal });
    await admin.from("app_settings").upsert({ key: SNAPSHOT_KEY, value: { id: snap.snapshotId, bundle: hash, at: new Date().toISOString() }, updated_at: new Date().toISOString() });
    return snap.snapshotId;
  } catch (e) {
    await sandbox.stop().catch(() => {});
    throw e;
  }
}

// The snapshot for the film this server was built with.
export async function filmSnapshot(signal: AbortSignal): Promise<string> {
  const hash = await bundleHash();
  if (!hash) throw new Error("the film was not bundled");
  return snapshotFor(hash, signal);
}

// Gets the sandbox ready while the video is still being made (the first
// render after a new film takes a few minutes otherwise). Never throws.
export async function prepareFilm(budgetMs: number) {
  const hash = await bundleHash();
  if (hash) await snapshotFor(hash, AbortSignal.timeout(budgetMs)).catch((e) => console.warn("film snapshot: not ready:", e instanceof Error ? e.message : e));
}
