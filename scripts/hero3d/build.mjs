#!/usr/bin/env node
// Renders the Priority A premium 3D hero objects.
//
//   npm run hero3d:build                 all six, full size
//   npm run hero3d:build -- chat-bubble  one object
//   HERO3D_PREVIEW=dir npm run hero3d:build   small previews into dir only
//   npm run hero3d:build -- --gate       only copy quality.mjs into the manifest
//
// Models and materials live in scripts/hero3d/objects.js, the studio and the
// passes in scene.js (three.js, rendered in local headless Chromium — no
// network, no generation API). For each object it writes to
// public/hero3d/<name>/:
//   front|three-quarter|side.webp   beauty, transparent background
//   *-accent.webp                   white + alpha mask of the one emissive area (tint it)
//   *-shadow.webp                   soft contact shadow, its own layer
//   turntable/00..23.webp           0–60° yaw at the 3/4 elevation (orbit)
// and public/hero3d/manifest.json. Production use is gated by quality.mjs.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import sharp from "sharp";
import { QUALITY } from "./quality.mjs";
import { fadeShadow } from "./shadow.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const preview = process.env.HERO3D_PREVIEW;
const SIZE = preview ? 900 : 2400;
const RENDER = Math.round(SIZE * 1.34); // supersample, then downscale
const FRAMES = 24;
const ALL = ["payment-card", "chart-block", "padlock", "ai-chip", "document-stack", "chat-bubble"];
const only = process.argv.slice(2).filter((a) => ALL.includes(a));
const names = only.length ? only : ALL;

export const VIEWS = {
  front: { yaw: 0, elevation: 6 },
  "three-quarter": { yaw: 32, elevation: 18 },
  side: { yaw: 66, elevation: 12 },
};

if (process.argv.includes("--gate")) {
  const file = path.join(root, "public/hero3d/manifest.json");
  const m = JSON.parse(readFileSync(file, "utf8"));
  for (const id of Object.keys(m)) Object.assign(m[id], QUALITY[id]);
  writeFileSync(file, JSON.stringify(m, null, 1) + "\n");
  console.log("hero3d: quality gate written to the manifest");
  process.exit(0);
}

const chrome = process.env.HERO3D_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
if (!existsSync(chrome)) {
  console.error("hero3d: no local Chromium (set HERO3D_CHROME)");
  process.exit(1);
}

const bundle = await esbuild.build({ entryPoints: [path.join(here, "scene.js")], bundle: true, format: "iife", write: false, minify: true });
const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page:", e.message));
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: bundle.outputFiles[0].text });
await page.waitForFunction(() => window.heroReady === true);

const shoot = async (name, view, pass) => {
  const url = await page.evaluate((a) => window.renderHero(a), { name, ...view, size: RENDER, pass });
  return Buffer.from(url.split(",")[1], "base64");
};
const down = (buf) => sharp(buf).resize(SIZE, SIZE, { kernel: "lanczos3" });
const webp = (img, file, q = 92) => img.webp({ quality: q, alphaQuality: 100, effort: 5 }).toFile(file);
// Luminance mask → white image whose alpha is the mask.
async function accent(buf, file) {
  const { data } = await down(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(SIZE * SIZE * 4, 255);
  for (let i = 0; i < SIZE * SIZE; i++) rgba[i * 4 + 3] = data[i];
  await webp(sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } }), file, 90);
}

const outRoot = preview ? path.resolve(preview) : path.join(root, "public/hero3d");
const manifest = {};
for (const name of names) {
  const dir = path.join(outRoot, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "turntable"), { recursive: true });
  const t0 = Date.now();
  for (const [v, view] of Object.entries(VIEWS)) {
    await webp(down(await shoot(name, view, "beauty")), path.join(dir, `${v}.webp`));
    await accent(await shoot(name, view, "mask"), path.join(dir, `${v}-accent.webp`));
    await webp(await fadeShadow(down(await shoot(name, view, "shadow")).blur(SIZE / 160), SIZE), path.join(dir, `${v}-shadow.webp`), 80);
  }
  const frames = preview ? [0, 12, 23] : [...Array(FRAMES).keys()];
  for (const i of frames) {
    const yaw = (i * 60) / (FRAMES - 1);
    await webp(down(await shoot(name, { yaw, elevation: VIEWS["three-quarter"].elevation }, "beauty")), path.join(dir, "turntable", `${String(i).padStart(2, "0")}.webp`), 88);
  }
  console.log(`hero3d: ${name} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const base = `/hero3d/${name}`;
  manifest[`hero:${name}`] = {
    size: SIZE,
    views: Object.fromEntries(Object.keys(VIEWS).map((v) => [v, { beauty: `${base}/${v}.webp`, accent: `${base}/${v}-accent.webp`, shadow: `${base}/${v}-shadow.webp`, ...VIEWS[v] }])),
    turntable: { frames: FRAMES, yawFrom: 0, yawTo: 60, elevation: VIEWS["three-quarter"].elevation, pattern: `${base}/turntable/{00..23}.webp` },
    ...QUALITY[`hero:${name}`],
  };
}
await browser.close();

if (!preview) {
  const file = path.join(outRoot, "manifest.json");
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  writeFileSync(file, JSON.stringify({ ...prev, ...manifest }, null, 1) + "\n");
}
