#!/usr/bin/env node
// The app's checks: the simple engine, the AI models' plumbing, projects,
// credits and settings — everything that can be checked without a render.
//
//   npm run check:clean
//   npm run check:clean -- --allow-known   (CI: the checks listed in
//                                           known-failures.json may fail)
//
// Exits 1 when any check fails (with --allow-known: any check not listed).

import { mkdirSync, readFileSync } from "node:fs";
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
  external: ["remotion", "react", "react-dom", "zod", "openai", "playwright-core", "@sparticuz/chromium"],
  logLevel: "warning",
});
const { runChecks } = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
const checks = await runChecks();
const known = process.argv.includes("--allow-known") ? new Set(JSON.parse(readFileSync(path.join(root, "scripts/clean-check/known-failures.json"), "utf8")).checks) : new Set();
let failed = 0;
let unknown = 0;
let section = "";
for (const c of checks) {
  if (c.section !== section) console.log(`\n■ ${(section = c.section)}`);
  console.log(`  ${c.ok ? "ok  " : known.has(c.name) ? "KNOWN" : "FAIL"} ${c.name}: ${c.detail}`);
  if (!c.ok) failed++;
  if (!c.ok && !known.has(c.name)) unknown++;
}
console.log(`\n${checks.length - failed}/${checks.length} checks pass`);
if (known.size) {
  const fixed = [...known].filter((name) => checks.some((c) => c.name === name && c.ok));
  console.log(`${failed - unknown} known failure(s) allowed (scripts/clean-check/known-failures.json); ${unknown} new failure(s)`);
  if (fixed.length) console.log(`now passing — remove from known-failures.json: ${fixed.join(" · ")}`);
}
process.exit(unknown ? 1 : 0);
