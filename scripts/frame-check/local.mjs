#!/usr/bin/env node
// The frame check on this machine, not in a Vercel Sandbox: opens the film in
// a browser here, measures where every word and thing is on every few frames
// and prints what a viewer would see wrong (words covered, things on each
// other, cut off by the edge, an empty screen). No AI, no cost.
//
//   npm run check:frames -- <project id or its first 8 letters> [more ids]
//   npm run check:frames -- --plan plan.json        (a plan from a file)
//
//   --stills <folder>   a picture of each finding (and one per scene)
//   --save              keep the result with the project (as the server's check does)
//   --browser <path>    a Chrome to use (else Remotion's own, downloaded once)
//
// Needs .env.local (the project's database) for an id; the film is bundled
// first when .remotion-bundle is missing (npm run build makes it too).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : null;
};
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? !!args.splice(i, 1) : false;
};
const planFile = opt("--plan");
const stills = opt("--stills");
const browser = opt("--browser");
const save = flag("--save");
if (!planFile && !args.length) {
  console.error("usage: npm run check:frames -- <project id> [--stills folder] [--save] [--browser path]\n       npm run check:frames -- --plan plan.json");
  process.exit(1);
}
if (existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));

// the plan reader, bundled like the other checks (the app's code, as is)
const cacheDir = path.join(root, "node_modules/.cache/frame-check");
mkdirSync(cacheDir, { recursive: true });
const outfile = path.join(cacheDir, "plans.mjs");
await build({
  entryPoints: [path.join(root, "scripts/frame-check/plans.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  alias: { "@": root, "server-only": path.join(root, "scripts/clean-check/server-only.mjs") },
  jsx: "automatic",
  packages: "external",
  logLevel: "warning",
});
const P = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);

const serveUrl = path.join(root, ".remotion-bundle");
// (bundled again when the film's code is newer than the bundle)
const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((m, e) => Math.max(m, e.isDirectory() ? newest(path.join(dir, e.name)) : statSync(path.join(dir, e.name)).mtimeMs), 0);
const stale = !existsSync(path.join(serveUrl, "index.html")) || Math.max(newest(path.join(root, "components/video")), newest(path.join(root, "remotion"))) > statSync(path.join(serveUrl, "index.html")).mtimeMs;
if (stale) execFileSync(process.execPath, [path.join(root, "scripts/frame-check/bundle.mjs")], { stdio: "inherit" });
const { renderFrames, selectComposition } = await import("@remotion/renderer");
const base = { serveUrl, browserExecutable: browser, chromeMode: "headless-shell", logLevel: "error", timeoutInMilliseconds: 120000 };

async function run(label, plan) {
  const t0 = Date.now();
  const inputProps = { plan, audioUrl: null, qa: true };
  const composition = await selectComposition({ ...base, id: "ComposerFilm", inputProps });
  const lines = [];
  await renderFrames({
    ...base,
    composition,
    inputProps,
    outputDir: null,
    imageFormat: "none",
    frames: P.framesToCheck(plan.duration),
    concurrency: 4,
    muted: true,
    onStart: () => {},
    onFrameUpdate: () => {},
    onBrowserLog: (log) => {
      if (log.text.startsWith(P.PROBE_PREFIX)) lines.push(log.text.slice(P.PROBE_PREFIX.length));
    },
  });
  const samples = lines.flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
  const result = P.check(plan, samples);
  console.log(`\n${label}: ${result.ok ? "clean" : `${result.findings.length} finding(s)`} (${result.frames} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  for (const f of result.findings) console.log(`  ${(f.from / 30).toFixed(1)}–${(f.to / 30).toFixed(1)} s, scene ${f.scene + 1}: ${f.what}`);
  if (stills) {
    const dir = path.join(stills, label.replace(/[^\w.-]+/g, "-"));
    mkdirSync(dir, { recursive: true });
    const at = [...new Set([...result.findings.map((f) => f.from), ...plan.scenes.map((s) => Math.min(plan.duration - 1, Math.round((s.from + s.to) / 2)))])].sort((a, b) => a - b);
    await renderFrames({ ...base, composition, inputProps: { plan, audioUrl: null }, outputDir: dir, imageFormat: "jpeg", jpegQuality: 80, frames: at, concurrency: 4, muted: true, onStart: () => {}, onFrameUpdate: () => {} });
    console.log(`  stills: ${dir}`);
  }
  return { ...result, at: new Date().toISOString(), ms: Date.now() - t0 };
}

let failed = 0;
if (planFile) {
  const r = await run(path.basename(planFile, ".json"), JSON.parse(readFileSync(planFile, "utf8")));
  if (!r.ok) failed++;
}
for (const id of args) {
  const { id: full, plans } = await P.plansOf(id);
  for (const [i, plan] of plans.entries()) {
    const r = await run(`${full.slice(0, 8)}${plans.length > 1 ? `-v${i + 1}` : ""}`, plan);
    if (!r.ok) failed++;
    if (save && i === 0) {
      await P.saveResult(full, r);
      console.log("  saved with the project");
    }
  }
}
process.exit(failed ? 1 : 0);
