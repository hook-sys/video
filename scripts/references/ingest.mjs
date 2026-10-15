// Reference promos in, recipes out. For each video given (files or folders):
//   - a contact sheet (12 frames, evenly spaced) → docs/reference/ref-NN.jpg
//   - its numbers (cuts, average shot, motion, still share, dark share,
//     colour) → docs/reference/metrics-3.json
//   - a draft recipe from those numbers (ground, colour turning, rhythm,
//     cuts) → components/video/composer/recipes.ts, marked "draft"
//   - a row in docs/reference/playbook-3.md
// The draft is then looked at (the contact sheet) and finished by hand:
// its cards, icons, accent, backdrop, type size and note.
//
//   npm run refs:ingest -- ~/videos/*.mp4
//   npm run refs:ingest -- https://example.com/promo.mp4   (a direct link)
//   npm run refs:ingest -- --dry ~/videos                  (numbers only)
//
// Uses Remotion's own ffmpeg (no system ffmpeg needed) and sharp.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const C = path.join(root, "node_modules/@remotion/compositor-linux-x64-gnu");
const env = { ...process.env, LD_LIBRARY_PATH: C };
const ffmpeg = (args) => execFileSync(path.join(C, "ffmpeg"), ["-hide_banner", "-loglevel", "error", ...args], { env, maxBuffer: 1 << 26 });
const ffprobe = (args) => execFileSync(path.join(C, "ffprobe"), ["-v", "error", ...args], { env }).toString();

const REF = path.join(root, "docs/reference");
const METRICS = path.join(REF, "metrics-3.json");
const PLAYBOOK = path.join(REF, "playbook-3.md");
const RECIPES = path.join(root, "components/video/composer/recipes.ts");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const VIDEO = /\.(mp4|mov|webm|mkv|m4v)$/i;
// (a direct link is downloaded first)
async function local(a) {
  if (!/^https?:\/\//i.test(a)) return statSync(a).isDirectory() ? readdirSync(a).filter((f) => VIDEO.test(f)).sort().map((f) => path.join(a, f)) : [a];
  const res = await fetch(a);
  if (!res.ok) throw new Error(`${a}: ${res.status}`);
  const name = decodeURIComponent(new URL(a).pathname.split("/").pop() || "video.mp4").replace(/[^\w.-]+/g, "-");
  const file = path.join(mkdtempSync(path.join(tmpdir(), "ref-dl-")), VIDEO.test(name) ? name : `${name}.mp4`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return [file];
}
const inputs = (await Promise.all(args.filter((a) => !a.startsWith("--")).map(local))).flat();
if (!inputs.length) {
  console.error("usage: node scripts/references/ingest.mjs [--dry] <videos or folders>");
  process.exit(1);
}

// the next reference number (after ref-NN.jpg already there)
let next = Math.max(0, ...readdirSync(REF).map((f) => /^ref-(\d+)\.jpg$/.exec(f)?.[1]).filter(Boolean).map(Number)) + 1;

// ── reading a video ──────────────────────────────────────────────────────
function probe(file) {
  const j = JSON.parse(ffprobe(["-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]));
  return { seconds: Number(j.format.duration), w: j.streams[0].width, h: j.streams[0].height };
}

async function sheet(file, seconds, out) {
  const dir = mkdtempSync(path.join(tmpdir(), "ref-sheet-"));
  const tiles = [];
  for (let i = 0; i < 12; i++) {
    const at = ((i + 0.5) / 12) * seconds;
    const f = path.join(dir, `t${i}.jpg`);
    ffmpeg(["-ss", at.toFixed(2), "-i", file, "-frames:v", "1", "-s", "480x270", "-q:v", "4", "-y", f]);
    tiles.push({ input: await sharp(f).resize(480, 270, { fit: "contain", background: "#111" }).toBuffer(), left: (i % 4) * 484, top: Math.floor(i / 4) * 274 });
  }
  await sharp({ create: { width: 4 * 484 - 4, height: 3 * 274 - 4, channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
  rmSync(dir, { recursive: true, force: true });
}

// 5 frames a second at 96×54: frame-to-frame change (motion, cuts, stills),
// brightness (dark share), colour (saturation, hue, how much the hue turns)
async function measure(file, seconds) {
  const dir = mkdtempSync(path.join(tmpdir(), "ref-frames-"));
  ffmpeg(["-i", file, "-r", "5", "-s", "96x54", "-q:v", "5", "-y", path.join(dir, "f%05d.jpg")]);
  const names = readdirSync(dir).sort();
  let prev = null;
  const diffs = [], lumas = [], sats = [], hues = [];
  for (const n of names) {
    const { data } = await sharp(path.join(dir, n)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = data.length / 3;
    const grey = new Float32Array(px);
    let l = 0, s = 0, hx = 0, hy = 0, coloured = 0;
    for (let i = 0; i < px; i++) {
      const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      grey[i] = (0.299 * r + 0.587 * g + 0.114 * b) * 255;
      l += grey[i];
      const sat = max === 0 ? 0 : (max - min) / max;
      s += sat;
      if (sat > 0.35 && max > 0.2) {
        const d = max - min;
        const h = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
        hx += Math.cos((h * Math.PI) / 180);
        hy += Math.sin((h * Math.PI) / 180);
        coloured++;
      }
    }
    lumas.push(l / px);
    sats.push(s / px);
    hues.push(coloured > px * 0.05 ? (((Math.atan2(hy, hx) * 180) / Math.PI) + 360) % 360 : null);
    if (prev) {
      let d = 0;
      for (let i = 0; i < px; i++) d += Math.abs(grey[i] - prev[i]);
      diffs.push(d / px);
    }
    prev = grey;
  }
  rmSync(dir, { recursive: true, force: true });
  const cuts = diffs.filter((d) => d > 38).length;
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const hs = hues.filter((h) => h != null);
  // how far the frame's main hue wanders (degrees, circular)
  const hueSpread = hs.length > 3 ? Math.round(Math.sqrt(-2 * Math.log(Math.max(1e-6, Math.hypot(mean(hs.map((h) => Math.cos((h * Math.PI) / 180))), mean(hs.map((h) => Math.sin((h * Math.PI) / 180))))))) * (180 / Math.PI)) : 0;
  const hueMain = hs.length ? Math.round(((Math.atan2(mean(hs.map((h) => Math.sin((h * Math.PI) / 180))), mean(hs.map((h) => Math.cos((h * Math.PI) / 180)))) * 180) / Math.PI + 360) % 360) : null;
  return {
    seconds: Number(seconds.toFixed(1)),
    cuts,
    shot_avg: Number((seconds / (cuts + 1)).toFixed(1)),
    motion: Number(mean(diffs).toFixed(1)),
    still_share: Number((diffs.filter((d) => d < 2).length / Math.max(1, diffs.length)).toFixed(2)),
    dark_share: Number((lumas.filter((l) => l < 70).length / Math.max(1, lumas.length)).toFixed(2)),
    light: Math.round(mean(lumas)),
    saturation: Number(mean(sats).toFixed(2)),
    hue: hueMain,
    hue_spread: hueSpread,
  };
}

// ── a draft recipe from the numbers ──────────────────────────────────────
function draft(m) {
  const dark = m.dark_share >= 0.55;
  const warm = m.hue != null && m.hue >= 20 && m.hue <= 55;
  const ground = dark
    ? m.saturation < 0.12 ? "black" : m.saturation < 0.28 ? "night" : m.light > 55 ? "plate" : "deep"
    : m.saturation < 0.06 ? "white" : warm && m.saturation < 0.2 ? "paper" : m.saturation < 0.32 ? "tint" : m.light > 140 ? "bright" : "plate";
  const rhythm = m.shot_avg < 1.6 ? "rapid" : m.shot_avg < 3.2 ? "quick" : m.shot_avg < 8 ? "steady" : "calm";
  const cuts = m.shot_avg < 1.6 ? "hard" : m.cuts <= 2 ? "soft" : m.motion > 9 ? "push" : "graphic";
  const shift = ["plate", "bright", "deep", "tint"].includes(ground) && m.hue_spread > 45 ? "scene" : "none";
  const words = [ground === "plate" || ground === "bright" ? "colour" : dark ? "dark" : "light", ground, rhythm === "rapid" || rhythm === "quick" ? "fast cuts" : rhythm === "calm" ? "long calm takes" : "steady", shift === "scene" ? "colour turning by section" : null].filter(Boolean);
  return { style: { ground, shift, rhythm, cuts }, note: words.join(", ") };
}

// ── writing it down ──────────────────────────────────────────────────────
const metrics = existsSync(METRICS) ? JSON.parse(readFileSync(METRICS, "utf8")) : [];
const rows = [];
const lines = [];
for (const file of inputs) {
  const id = `ref-${String(next).padStart(2, "0")}`;
  const { seconds, w, h } = probe(file);
  const m = await measure(file, seconds);
  const d = draft(m);
  console.log(`${id}  ${path.basename(file)}  ${JSON.stringify(m)}  →  ${JSON.stringify(d.style)}`);
  if (dry) continue;
  await sheet(file, seconds, path.join(REF, `${id}.jpg`));
  metrics.push({ video: id, file: path.basename(file), size: `${w}x${h}`, ...m });
  rows.push(`| ${id.slice(4)} | ${path.basename(file).replace(/\|/g, "/")} | ${Math.round(m.seconds)} | ${m.cuts} | ${m.shot_avg} s | ${m.motion} | ${m.still_share} | ${m.dark_share} | ${d.note} (draft) |`);
  const from = path.basename(file).replace(/\.[^.]+$/, "").replace(/"/g, "'").slice(0, 60);
  lines.push(`  // draft (scripts/references/ingest.mjs): look at docs/reference/${id}.jpg and finish its parts and note\n  { id: "${id}", from: "${from}", note: "${d.note}", style: { ${Object.entries(d.style).map(([k, v]) => `${k}: "${v}"`).join(", ")} } },`);
  next++;
}
if (!dry && lines.length) {
  writeFileSync(METRICS, JSON.stringify(metrics, null, 1) + "\n");
  if (!existsSync(PLAYBOOK))
    writeFileSync(PLAYBOOK, "# Reference playbook 3 — the next promos\n\nAdded by `scripts/references/ingest.mjs`: contact sheets `ref-NN.jpg`, numbers in `metrics-3.json`, a draft recipe each in `components/video/composer/recipes.ts`.\n\n| ref | file | sec | cuts | avg shot | motion | still share | dark share | look |\n|---|---|---|---|---|---|---|---|---|\n");
  writeFileSync(PLAYBOOK, readFileSync(PLAYBOOK, "utf8") + rows.join("\n") + "\n");
  // the drafts go in before the house looks
  const src = readFileSync(RECIPES, "utf8");
  const at = src.indexOf("  // (the six looks of the first build");
  writeFileSync(RECIPES, at > 0 ? src.slice(0, at) + lines.join("\n") + "\n" + src.slice(at) : src.replace(/\n\];\s*$/, `\n${lines.join("\n")}\n];\n`));
  console.log(`\n${lines.length} reference(s) added: sheets in docs/reference, drafts in recipes.ts — finish each draft from its sheet.`);
}
