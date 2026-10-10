// The frame check's script, run where a browser is (a Vercel Sandbox; or on
// a machine, for a test): it opens the bundled film with the probe on, goes
// through the frames asked for (drawing nothing — only laying each frame
// out) and writes what the probe saw to a file. Its one argument: a JSON file
// { serveUrl, id, plan, frames, concurrency, prefix, out, browserExecutable? }.
export const FRAME_SCRIPT = `
import { readFile, writeFile } from "node:fs/promises";
import { renderFrames, selectComposition } from "@remotion/renderer";
const cfg = JSON.parse(await readFile(process.argv[2], "utf8"));
const inputProps = { plan: cfg.plan, audioUrl: null, qa: true };
const base = { serveUrl: cfg.serveUrl, browserExecutable: cfg.browserExecutable ?? null, chromeMode: "headless-shell", logLevel: "error", timeoutInMilliseconds: 60000 };
const t0 = Date.now();
const composition = await selectComposition({ ...base, id: cfg.id, inputProps });
const lines = [];
await renderFrames({
  ...base,
  composition,
  inputProps,
  outputDir: null,
  imageFormat: "none",
  frames: cfg.frames,
  concurrency: cfg.concurrency,
  muted: true,
  onStart: () => {},
  onFrameUpdate: () => {},
  onBrowserLog: (log) => {
    if (log.text.startsWith(cfg.prefix)) lines.push(log.text.slice(cfg.prefix.length));
  },
});
const samples = [];
for (const l of lines) {
  try {
    samples.push(JSON.parse(l));
  } catch {}
}
await writeFile(cfg.out, JSON.stringify({ ms: Date.now() - t0, samples }));
console.log(JSON.stringify({ type: "done", samples: samples.length, ms: Date.now() - t0 }));
`;
