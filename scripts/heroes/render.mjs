#!/usr/bin/env node
// Stills (and short Player clips) of the v2 heroes, from the Player
// (@remotion/renderer) and the in-browser download (@remotion/web-renderer).
//
//   node scripts/heroes/render.mjs
//
// Writes PNG/MP4 under HERO_OUT (default /opt/cursor/artifacts/heroes).
import http from "node:http";
import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = process.env.HERO_OUT || "/opt/cursor/artifacts/heroes";
const logoSrc = process.env.HERO_LOGO || "/home/ubuntu/.cursor/projects/workspace/uploads/test-logo_1f7d.png";
const chrome = process.env.REMOTION_BROWSER_EXECUTABLE || process.env.PARITY_CHROME || "/opt/google/chrome/chrome";
if (!existsSync(chrome)) {
  console.error(`heroes: no Chrome at ${chrome}`);
  process.exit(1);
}
if (!existsSync(logoSrc)) {
  console.error(`heroes: no logo at ${logoSrc}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const pub = path.join(root, "public");
const cache = path.join(root, "node_modules/.cache/heroes");
mkdirSync(cache, { recursive: true });
copyFileSync(logoSrc, path.join(cache, "logo.png"));

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || "/").split("?")[0]);
  if (u === "/") return res.writeHead(200, { "content-type": "text/html" }), res.end('<!doctype html><html><body><script type="module" src="/app.js"></script></body></html>');
  const file = u === "/app.js" ? path.join(cache, "app.js") : u === "/logo.png" ? path.join(cache, "logo.png") : path.join(pub, u);
  const allowed = file === path.join(cache, "app.js") || file === path.join(cache, "logo.png") || file.startsWith(pub + path.sep);
  if (!allowed) return res.writeHead(403), res.end();
  if (!existsSync(file)) return res.writeHead(404), res.end();
  const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".png") ? "image/png" : file.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
  res.writeHead(200, { "content-type": type, "access-control-allow-origin": "*" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const logoUrl = `http://127.0.0.1:${port}/logo.png`;
console.log(`heroes: logo ${logoUrl}`);

await build({
  entryPoints: [path.join(root, "scripts/heroes/plans.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(cache, "plans.mjs"),
  alias: { "@": root },
  jsx: "automatic",
  external: ["remotion", "react", "react-dom", "zod"],
  logLevel: "warning",
});
const { heroPlans } = await import(pathToFileURL(path.join(cache, "plans.mjs")).href + `?t=${Date.now()}`);
const shots = heroPlans(logoUrl);
console.log(`heroes: ${shots.map((s) => `${s.name} ${s.plan.w ?? 1920}x${s.plan.h ?? 1080} f${s.frame}`).join(" · ")}`);

const chromeArgs = ["--no-sandbox", "--disable-dev-shm-usage"];
const { bundle } = await import("@remotion/bundler");
const { renderStill, renderMedia, selectComposition } = await import("@remotion/renderer");
console.log("heroes: bundling Player…");
const serveUrl = await bundle({
  entryPoint: path.join(root, "remotion/index.ts"),
  webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...c.resolve?.alias, "@": root } } }),
});

for (const shot of shots) {
  const inputProps = { plan: shot.plan, audioUrl: null };
  const composition = await selectComposition({ serveUrl, id: "ComposerFilm", inputProps, browserExecutable: chrome, chromiumOptions: { args: chromeArgs }, logLevel: "error" });
  const still = path.join(outDir, `${shot.name}-player.png`);
  console.log(`heroes: player still ${shot.name}`);
  await renderStill({ composition, serveUrl, inputProps, frame: shot.frame, output: still, scale: 1, browserExecutable: chrome, chromiumOptions: { args: chromeArgs }, logLevel: "error" });
  if (shot.name.startsWith("growth_chart")) {
    const exit = path.join(outDir, `${shot.name}-exit-player.png`);
    await renderStill({ composition, serveUrl, inputProps, frame: 108, output: exit, scale: 1, browserExecutable: chrome, chromiumOptions: { args: chromeArgs }, logLevel: "error" });
  }
}

const clips = shots.filter((s) => s.name.endsWith("-16x9"));
for (const shot of clips) {
  const inputProps = { plan: shot.plan, audioUrl: null };
  const composition = await selectComposition({ serveUrl, id: "ComposerFilm", inputProps, browserExecutable: chrome, chromiumOptions: { args: chromeArgs }, logLevel: "error" });
  const file = path.join(outDir, `${shot.name}-player.mp4`);
  console.log(`heroes: player clip ${shot.name}`);
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    outputLocation: file,
    browserExecutable: chrome,
    chromiumOptions: { args: chromeArgs },
    logLevel: "error",
    crf: 20,
  });
}

await build({
  entryPoints: [path.join(root, "scripts/parity/web-entry.tsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(cache, "app.js"),
  alias: { "@": root },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ executablePath: chrome, args: chromeArgs });
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || (m.type() === "warning" && m.text().includes("web-renderer"))) console.log(`web: ${m.text().slice(0, 240)}`);
});
page.on("pageerror", (e) => console.log(`web pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => typeof window.renderFrame === "function", null, { timeout: 90000 });
for (const shot of shots) {
  const frames = shot.name.startsWith("growth_chart") ? [shot.frame, 108] : [shot.frame];
  for (const frame of frames) {
    const tag = frame === shot.frame ? "web" : "exit-web";
    console.log(`heroes: web still ${shot.name} f${frame}`);
    const b64 = await page.evaluate(([p, fr]) => window.renderFrame(p, fr, 1), [shot.plan, frame]);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(outDir, `${shot.name}-${tag}.png`), Buffer.from(b64, "base64"));
  }
}
await browser.close();
server.close();
console.log(`heroes: wrote ${outDir}`);
