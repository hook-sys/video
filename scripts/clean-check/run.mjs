#!/usr/bin/env node
// The Composer's checks: its layouts, house rules, staging, Directors and
// AI settings — everything that can be checked without a render.
//
//   npm run check:clean
//
// Exits 1 when any check fails.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = path.join(root, "node_modules/.cache/clean-check");
mkdirSync(cacheDir, { recursive: true });
const outfile = path.join(cacheDir, "checks.mjs");
await build({
  entryPoints: [path.join(root, "scripts/clean-check/checks.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  alias: { "@": root, "server-only": path.join(root, "scripts/clean-check/server-only.mjs") },
  jsx: "automatic",
  external: ["remotion", "react", "react-dom", "zod", "openai"],
  logLevel: "warning",
});
const { runChecks } = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
const checks = await runChecks();
let failed = 0;
let section = "";
for (const c of checks) {
  if (c.section !== section) console.log(`\n■ ${(section = c.section)}`);
  console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} checks pass`);
process.exit(failed ? 1 : 0);
