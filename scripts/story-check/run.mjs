#!/usr/bin/env node
// StoryWorld regression checks.
//
//   npm run check:story               timeline + timing + schema checks, then
//                                     renders every fixture and checks pixels
//   npm run check:story -- --no-render   skip rendering (fast)
//
// Deterministic: fixtures are fixed data and every frame is a pure function of
// its frame number. Exits 1 when any error-level check fails.
// Set REMOTION_BROWSER_EXECUTABLE to use a specific headless Chrome.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const render = !process.argv.includes("--no-render");
const failures = [];

// 1. Render-free checks (bundled so TS + the "@/" alias work in Node).
const cacheDir = path.join(root, "node_modules/.cache/story-check");
mkdirSync(cacheDir, { recursive: true });
const bundled = path.join(cacheDir, "checks.mjs");
await build({
  entryPoints: [path.join(root, "scripts/story-check/checks.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundled,
  // ("server-only" is Next's guard against client bundles; nothing to guard here.)
  alias: { "@": root, "server-only": path.join(root, "scripts/story-check/server-only.mjs") },
  jsx: "automatic",
  external: ["remotion", "react", "react-dom", "zod", "openai"],
  logLevel: "warning",
});
const { runChecks, FIXTURES, LOTTIE_NAMES, FLOW_SCRIPT_NAMES, SCENE_NAMES } = await import(pathToFileURL(bundled).href + `?t=${Date.now()}`);

const icon = (c) => (c.ok ? "ok  " : c.level === "error" ? "FAIL" : "warn");
const sec = (f) => (f / 30).toFixed(2) + "s";
for (const section of runChecks()) {
  console.log(`\n■ ${section.name}`);
  for (const c of section.checks) {
    console.log(`  ${icon(c)} ${c.name}: ${c.detail}`);
    if (!c.ok && c.level === "error") failures.push(`${section.name} · ${c.name}`);
  }
  if (section.rows?.some((r) => r.word !== null)) {
    console.log("  timing  cue                            word      cue frame   first action   nearest sound");
    for (const r of section.rows)
      console.log(`          ${r.cue.padEnd(30)} ${r.word === null ? "   –   " : r.word.toFixed(3) + "s"}  ${String(r.frame).padStart(4)} (${sec(r.frame)})  ${r.action === null ? "      –      " : `${String(r.action).padStart(4)} (${sec(r.action)})`}  ${r.sfx === null ? "–" : `${r.sfx} (${sec(r.sfx)})`}`);
  }
}

// 2. Pixel checks on actual rendered frames.
// Decoded 8-bit RGB(A) pixels of a PNG written by the renderer.
function decodePng(file) {
  const b = readFileSync(file);
  let o = 8;
  let w = 0;
  let h = 0;
  let ct = 2;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const type = b.toString("ascii", o + 4, o + 8);
    const d = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") [w, h, ct] = [d.readUInt32BE(0), d.readUInt32BE(4), d[9]];
    if (type === "IDAT") idat.push(d);
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const u = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (ft === 1) v += a;
      else if (ft === 2) v += u;
      else if (ft === 3) v += (a + u) >> 1;
      else if (ft === 4) {
        const p = a + u - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - u);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, out };
}

function lumaStats(file) {
  const { bpp, out } = decodePng(file);
  const vals = [];
  for (let i = 0; i < out.length; i += bpp) vals.push(0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2]);
  const mean = vals.reduce((n, v) => n + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((n, v) => n + (v - mean) ** 2, 0) / vals.length);
  return { mean, sd };
}

if (render) {
  const { bundle } = await import("@remotion/bundler");
  const { renderFrames, selectComposition } = await import("@remotion/renderer");
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const serveUrl = await bundle({
    entryPoint: path.join(root, "remotion/index.ts"),
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...c.resolve?.alias, "@": root } } }),
  });
  // Pixel checks on every rendered frame of a composition.
  async function pixelSection(name, id, inputProps) {
    const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
    const dir = mkdtempSync(path.join(tmpdir(), "story-check-"));
    await renderFrames({ serveUrl, composition, inputProps, outputDir: dir, imageFormat: "png", scale: 0.1, browserExecutable, onStart: () => {}, onFrameUpdate: () => {} });
    const stats = readdirSync(dir).filter((n) => n.endsWith(".png")).sort().map((n) => lumaStats(path.join(dir, n)));
    rmSync(dir, { recursive: true, force: true });
    const checks = [];
    const add = (label, ok, detail) => checks.push({ name: label, ok, detail });
    // black flash: a (near-)black frame, or a sudden dip that recovers
    let flashes = 0;
    stats.forEach((st, i) => {
      const prev = stats[i - 1]?.mean ?? st.mean;
      const next = stats[i + 1]?.mean ?? st.mean;
      if (st.mean < 10 || (prev - st.mean > 40 && next - st.mean > 40)) flashes++;
    });
    add("no black flashes", flashes === 0, flashes ? `${flashes} flash frame(s)` : `darkest frame luma ${Math.min(...stats.map((st) => st.mean)).toFixed(1)}/255`);
    const jump = Math.max(...stats.slice(1).map((st, i) => Math.abs(st.mean - stats[i].mean)));
    add("no brightness jumps", jump < 40, `largest frame-to-frame change ${jump.toFixed(1)}/255`);
    const flat = stats.filter((st) => st.sd < 2.5).length;
    add("no empty (flat) frames", flat === 0, flat ? `${flat} frame(s) with no visible detail` : `all ${stats.length} frames have visible content`);
    console.log(`\n■ rendered pixels · ${name} (${stats.length} frames)`);
    for (const c of checks) {
      console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);
      if (!c.ok) failures.push(`pixels · ${name} · ${c.name}`);
    }
  }
  for (const f of FIXTURES) {
    await pixelSection(f.name, "StoryWorld", { story: f.story, narration: f.narration, durationSeconds: f.durationSeconds, words: f.words ?? null, assets: f.assets ?? null });
  }
  // Flow engine reference (default plan), in both themes.
  await pixelSection("flow · e-commerce (lavender)", "FlowScene", {});
  await pixelSection("flow · e-commerce (midnight)", "FlowScene", { theme: "midnight" });
  await pixelSection("flow · payments hub (lavender)", "FlowPaymentsHub", {});
  await pixelSection("flow · payments hub (midnight)", "FlowPaymentsHub", { theme: "midnight" });
  for (const name of FLOW_SCRIPT_NAMES) await pixelSection(`flow director script · ${name}`, `FlowScript-${name}`, {});
  // Director v2: scene fixtures, and every page of the card asset gallery.
  for (const name of SCENE_NAMES) await pixelSection(`scene director script · ${name}`, `SceneScript-${name}`, {});
  await pixelSection("card asset gallery (every template and device)", "CardGallery", {});
  await pixelSection("scene backdrop gallery (light)", "BackdropGallery", {});
  await pixelSection("scene backdrop gallery (dark)", "BackdropGallery", { theme: "midnight" });

  // Lottie micro-animations: every cell of the gallery must draw something and
  // actually move (sampled every 4th frame).
  const gallery = await selectComposition({ serveUrl, id: "LottieGallery", inputProps: {}, browserExecutable });
  const gdir = mkdtempSync(path.join(tmpdir(), "lottie-check-"));
  await renderFrames({ serveUrl, composition: gallery, inputProps: {}, outputDir: gdir, imageFormat: "png", scale: 0.5, everyNthFrame: 4, browserExecutable, onStart: () => {}, onFrameUpdate: () => {} });
  const frames = readdirSync(gdir).filter((n) => n.endsWith(".png")).sort().map((n) => decodePng(path.join(gdir, n)));
  rmSync(gdir, { recursive: true, force: true });
  const cols = 8;
  const cell = frames[0].w / cols;
  const blank = [];
  const still = [];
  LOTTIE_NAMES.forEach((name, i) => {
    const [cx, cy] = [(i % cols) * cell, Math.floor(i / cols) * cell];
    // Per frame: this cell's pixels, and which of them differ from the background.
    const cells = frames.map(({ w, bpp, out }) => {
      const px = [];
      for (let y = Math.round(cy); y < Math.round(cy + cell); y++)
        for (let x = Math.round(cx); x < Math.round(cx + cell); x++) {
          const o = (y * w + x) * bpp;
          px.push([out[o], out[o + 1], out[o + 2]]);
        }
      return px;
    });
    const ink = cells.map((px) => px.filter(([r, g, b]) => Math.abs(r - 247) + Math.abs(g - 247) + Math.abs(b - 251) > 40).length);
    if (Math.max(...ink) < 20) blank.push(name);
    // Movement = pixels whose colour changes between consecutive samples.
    const change = Math.max(...cells.slice(1).map((px, k) => px.filter((p, j) => Math.abs(p[0] - cells[k][j][0]) + Math.abs(p[1] - cells[k][j][1]) + Math.abs(p[2] - cells[k][j][2]) > 40).length));
    if (change < 10) still.push(name);
  });
  console.log(`\n■ rendered lottie gallery (${LOTTIE_NAMES.length} animations, ${frames.length} sampled frames)`);
  for (const [label, list, detail] of [["every animation draws something", blank, "all cells show a visible shape"], ["every animation moves", still, "all cells change over time"]]) {
    console.log(`  ${list.length ? "FAIL" : "ok  "} ${label}: ${list.length ? list.join(", ") : detail}`);
    if (list.length) failures.push(`lottie · ${label}`);
  }
}

console.log(failures.length ? `\n✗ ${failures.length} check(s) failed:\n  - ${failures.join("\n  - ")}` : "\n✓ all story checks passed");
process.exit(failures.length ? 1 : 0);
