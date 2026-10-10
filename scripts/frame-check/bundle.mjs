// Bundles the Composer's film for the frame check (lib/frame-check): run
// before `next build`, so the server has the film to open in a browser.
// Never fails the build: without the bundle the check is simply skipped.
import path from "node:path";
import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, ".remotion-bundle");

async function files(dir, base = "") {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = path.join(base, e.name);
    if (e.isDirectory()) out.push(...(await files(path.join(dir, e.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

try {
  const t0 = Date.now();
  await rm(outDir, { recursive: true, force: true });
  await bundle({
    entryPoint: path.join(root, "remotion/index.ts"),
    publicDir: path.join(root, "public"),
    outDir,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...c.resolve?.alias, "@": root } } }),
  });
  // (the bundle's own fingerprint: a new film needs a new sandbox)
  const hash = createHash("sha256");
  for (const f of await files(outDir)) hash.update(f).update(await readFile(path.join(outDir, f)));
  await writeFile(path.join(outDir, "frame-check.hash"), hash.digest("hex").slice(0, 16));
  console.log(`frame check: film bundled in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} catch (e) {
  console.warn("frame check: the film could not be bundled; the check will be skipped:", e instanceof Error ? e.message : e);
  await rm(outDir, { recursive: true, force: true }).catch(() => {});
}
