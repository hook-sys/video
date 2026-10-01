#!/usr/bin/env node
// Validates the rendered hero objects against public/hero3d/manifest.json:
// every file present, ≥ 2400 px, transparent background, the object never
// touching the frame edge, one non-empty accent mask, a soft shadow layer,
// 24 turntable frames that change smoothly, and the allowlist gate
// (production only with a reviewed score ≥ 90).
//
//   npm run check:hero3d

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { QUALITY } from "./quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pub = path.join(root, "public");
const manifest = JSON.parse(readFileSync(path.join(pub, "hero3d/manifest.json"), "utf8"));
const IDS = ["hero:payment-card", "hero:chart-block", "hero:padlock", "hero:ai-chip", "hero:document-stack", "hero:chat-bubble"];
const fails = [];
const fail = (id, m) => fails.push(`${id}: ${m}`);

async function alpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const coverage = ({ data }) => data.reduce((n, a) => n + (a > 8 ? 1 : 0), 0) / data.length;
function edgeMax({ data, w, h }) {
  let m = 0;
  for (let x = 0; x < w; x++) m = Math.max(m, data[x], data[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) m = Math.max(m, data[y * w], data[y * w + w - 1]);
  return m;
}

for (const id of IDS) {
  const e = manifest[id];
  if (!e) { fail(id, "missing from manifest"); continue; }
  for (const [v, view] of Object.entries(e.views)) {
    for (const k of ["beauty", "accent", "shadow"]) {
      const f = path.join(pub, view[k]);
      if (!existsSync(f)) { fail(id, `${v} ${k} missing`); continue; }
      const meta = await sharp(f).metadata();
      if (Math.max(meta.width, meta.height) < 2400) fail(id, `${v} ${k} ${meta.width}px < 2400`);
      if (!meta.hasAlpha) fail(id, `${v} ${k} has no alpha`);
      const a = await alpha(f);
      const c = coverage(a);
      if (k === "beauty") {
        if (edgeMax(a) > 8) fail(id, `${v} object touches the frame edge`);
        if (c < 0.08 || c > 0.7) fail(id, `${v} object covers ${(c * 100).toFixed(1)}% of the frame`);
      }
      if (k === "accent" && (c < 0.0005 || c > 0.12)) fail(id, `${v} accent mask covers ${(c * 100).toFixed(2)}% (want one small area)`);
      if (k === "shadow" && edgeMax(a) > 8) fail(id, `${v} shadow touches the frame edge`);
    }
  }
  // Turntable: 24 frames, all present, consecutive frames similar (no jumps).
  let prev = null;
  let worst = 0;
  for (let i = 0; i < e.turntable.frames; i++) {
    const f = path.join(pub, `/hero3d/${id.slice(5)}/turntable/${String(i).padStart(2, "0")}.webp`);
    if (!existsSync(f)) { fail(id, `turntable frame ${i} missing`); prev = null; continue; }
    const a = await alpha(f);
    if (a.w < 2400) fail(id, `turntable frame ${i} ${a.w}px`);
    if (edgeMax(a) > 8) fail(id, `turntable frame ${i} touches the frame edge`);
    const small = await sharp(f).resize(200, 200).ensureAlpha().raw().toBuffer();
    if (prev) {
      let d = 0;
      for (let j = 0; j < small.length; j++) d += Math.abs(small[j] - prev[j]);
      worst = Math.max(worst, d / small.length);
    }
    prev = small;
  }
  if (e.turntable.frames !== 24) fail(id, `turntable has ${e.turntable.frames} frames`);
  if (worst > 12) fail(id, `turntable jumps (mean step diff ${worst.toFixed(1)})`);
  const q = QUALITY[id];
  if (q.production && !(q.score >= 90)) fail(id, `on the allowlist with score ${q.score} (< 90)`);
  if (e.production !== q.production || e.score !== q.score) fail(id, "manifest gate out of date (re-run hero3d:build)");
  console.log(`hero3d: ${id} ${q.production ? "PRODUCTION" : "held back"} score ${q.score ?? "-"} turntable step ${worst.toFixed(1)}`);
}

if (fails.length) {
  console.error(fails.map((f) => `FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log("hero3d: all checks pass");
