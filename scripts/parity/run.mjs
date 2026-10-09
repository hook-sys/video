#!/usr/bin/env node
// Preview ↔ Download parity (the Composer's films, scripts/parity/plans.ts):
// the same plan, the same frames, rendered the
// way the Preview Player shows them (Remotion in Chromium: real CSS) and the
// way the Download button makes the MP4 (@remotion/web-renderer, which
// rasterises a subset of CSS itself). A frame where they differ by more than
// LIMIT means something on screen would be missing or different in the MP4.
//
//   npm run check:parity            (PARITY_KEEP=1 keeps the frames)
//
// Needs a local Chromium (REMOTION_BROWSER_EXECUTABLE / PARITY_CHROME, or the
// Playwright one under /opt/pw-browsers); skipped with a note without one.
import http from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Share of a frame's pixels allowed to differ by more than 40/255 in a channel
// (anti-aliasing of big type and the soft edges of large shadows and glows
// differ a little between the two renderers — up to ~1%; a thing missing or
// drawn differently is several %).
const LIMIT = Number(process.env.PARITY_LIMIT ?? 1.2);
const FRAMES = 12;
// The download renders at scale 1 (4K at 2). At 0.5, anti-aliasing alone
// differs on ~1% of pixels, which would hide real differences.
const SCALE = Number(process.env.PARITY_SCALE ?? 1);
const headless = process.env.REMOTION_BROWSER_EXECUTABLE || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const chrome = process.env.PARITY_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
if (!existsSync(headless) || !existsSync(chrome)) {
  console.log("parity: skipped (no local Chromium; set REMOTION_BROWSER_EXECUTABLE and PARITY_CHROME)");
  process.exit(0);
}

const work = mkdtempSync(path.join(tmpdir(), "parity-"));
// 1. The plans.
const cache = path.join(root, "node_modules/.cache/parity");
mkdirSync(cache, { recursive: true });
await build({ entryPoints: [path.join(root, "scripts/parity/plans.ts")], bundle: true, platform: "node", format: "esm", outfile: path.join(cache, "plans.mjs"), alias: { "@": root }, jsx: "automatic", external: ["remotion", "react", "react-dom", "zod"], logLevel: "warning" });
const { parityPlans, movingAt } = await import(pathToFileURL(path.join(cache, "plans.mjs")).href + `?t=${Date.now()}`);
// PARITY_PLANS=0,3 checks just those plans.
const pick = process.env.PARITY_PLANS?.split(",").map(Number);
const plans = parityPlans().filter((_, i) => (!pick || pick.includes(i)) && (!process.env.PARITY_PAIRS || process.env.PARITY_PAIRS.split(",").some((x) => Number(x.split(":")[0]) === i)));
// PARITY_FRAMES=30,40,50 checks just those frames (for digging into one moment).
const only = process.env.PARITY_FRAMES?.split(",").map(Number);
// PARITY_PAIRS=1:502,2:258 checks those frames of those plans (by their index before PARITY_PLANS).
const pairs = process.env.PARITY_PAIRS?.split(",").map((x) => x.split(":").map(Number));
const framesOf = (plan) => (pairs ? pairs.filter(([p]) => parityPlans()[p].plan.duration === plan.duration && parityPlans()[p].name === plans.find((x) => x.plan === plan)?.name).map(([, f]) => f) : null) ?? only ?? Array.from({ length: FRAMES }, (_, k) => Math.round((plan.duration - 60) * ((k + 0.5) / FRAMES)));

// 2. Preview side: Remotion renders the composition in Chromium.
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const serveUrl = await bundle({ entryPoint: path.join(root, "remotion/index.ts"), webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...c.resolve?.alias, "@": root } } }) });
for (const [i, { plan }] of plans.entries()) {
  const inputProps = { plan, audioUrl: null };
  const composition = await selectComposition({ serveUrl, id: "ComposerFilm", inputProps, browserExecutable: headless, logLevel: "error" });
  for (const f of framesOf(plan)) await renderStill({ serveUrl, composition, inputProps, frame: f, output: path.join(work, `p${i}-f${f}-preview.png`), scale: SCALE, browserExecutable: headless, logLevel: "error" });
}

// 3. Download side: the in-browser renderer, in a real Chromium page.
await build({ entryPoints: [path.join(root, "scripts/parity/web-entry.tsx")], bundle: true, format: "esm", platform: "browser", outfile: path.join(work, "app.js"), alias: { "@": root }, jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const pub = path.join(root, "public");
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/") return res.writeHead(200, { "content-type": "text/html" }), res.end('<!doctype html><html><body><script type="module" src="/app.js"></script></body></html>');
  const f = u === "/app.js" ? path.join(work, "app.js") : path.join(pub, u);
  if (!f.startsWith(pub) && f !== path.join(work, "app.js")) return res.writeHead(403), res.end();
  if (!existsSync(f)) return res.writeHead(404), res.end();
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".woff2") ? "font/woff2" : "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ executablePath: chrome });
const page = await browser.newPage();
const warnings = new Set();
page.on("console", (m) => m.type() === "warning" && m.text().includes("web-renderer") && warnings.add(m.text().slice(0, 160)));
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => typeof window.renderFrame === "function", null, { timeout: 60000 });
for (const [i, { plan }] of plans.entries()) {
  for (const f of framesOf(plan)) {
    const b64 = await page.evaluate(([p, fr, s]) => window.renderFrame(p, fr, s), [plan, f, SCALE]);
    writeFileSync(path.join(work, `p${i}-f${f}-download.png`), Buffer.from(b64, "base64"));
  }
}
await browser.close();
server.close();

// 4. Compare.
function decodePng(file) {
  const b = readFileSync(file);
  let [o, w, h, ct] = [8, 0, 0, 2];
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
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - u), Math.abs(p - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, out };
}
// While a scene comes in (a fade, a whip, a flip, a dive into the next) the
// download blends a fading group element by element where the Player blends
// it as one picture, so a white screen over a dark frame shows grey for those
// few frames — a limit of the in-browser renderer. Those frames are reported;
// the frames between moves must match.
const moving = (plan, f) => movingAt(plan, f);
const failures = [];
for (const [i, { name, plan }] of plans.entries()) {
  const rows = framesOf(plan).map((f) => {
    const a = decodePng(path.join(work, `p${i}-f${f}-preview.png`));
    const b = decodePng(path.join(work, `p${i}-f${f}-download.png`));
    let off = 0;
    for (let p = 0; p < a.w * a.h; p++) {
      let m = 0;
      for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.out[p * a.bpp + c] - b.out[p * b.bpp + c]));
      if (m > 40) off++;
    }
    return { f, share: (off / (a.w * a.h)) * 100, moving: moving(plan, f) };
  });
  const held = rows.filter((r) => !r.moving);
  const worst = (held.length ? held : rows).reduce((x, y) => (y.share > x.share ? y : x));
  const bad = held.filter((r) => r.share > LIMIT);
  const inMoves = rows.filter((r) => r.moving && r.share > LIMIT);
  console.log(`${bad.length ? "FAIL" : "ok  "} parity · ${name}: worst ${worst.share.toFixed(2)}% of pixels differ between moves (frame ${worst.f}); limit ${LIMIT}%${inMoves.length ? ` · during a move: ${inMoves.map((r) => `${r.f} ${r.share.toFixed(1)}%`).join(", ")}` : ""}`);
  console.log(`       ${rows.map((r) => `${r.f}${r.moving ? "~" : ""}:${r.share.toFixed(2)}`).join("  ")}`);
  if (bad.length) failures.push(`${name}: frames ${bad.map((r) => r.f).join(", ")}`);
}
if (warnings.size) console.log(`web-renderer warnings:\n  ${[...warnings].join("\n  ")}`);
if (process.env.PARITY_KEEP) console.log(`frames kept in ${work}`);
else rmSync(work, { recursive: true, force: true });
if (failures.length) {
  console.log(`✗ preview and download differ: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("✓ preview and download match");
