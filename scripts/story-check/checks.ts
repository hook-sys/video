// Deterministic StoryWorld checks that need no rendering: story validation,
// stored-brief compatibility, compiled-timeline frame checks and voice timing.
// Bundled and run by scripts/story-check/run.mjs.
import { ProductBrief } from "@/lib/ai/product-brief";
import { validateStory, VisualStory } from "@/lib/visual-story";
import { compileStory } from "@/components/video/engine/compiler";
import { normalizeStory } from "@/components/video/engine/normalize";
import { checkTimeline, checkTiming, type Check, type TimingRow } from "@/components/video/engine/validate";
import { REFERENCE_NARRATION, REFERENCE_STORY } from "@/components/video/engine/fixtures/reference-story";
import { REFERENCE_VOICE_WORDS } from "@/components/video/engine/fixtures/reference-voice-words";
import { DEV_NARRATION, DEV_STORY } from "@/components/video/engine/fixtures/devtool-story";
import { ECOMMERCE_NARRATION, ECOMMERCE_STORY } from "@/components/video/engine/fixtures/ecommerce-assets-story";
import { evaluatePose } from "@/components/video/engine/timeline";
import { needsLegacyImages, usableStory } from "@/lib/story-engine";
import type { AssetManifest } from "@/lib/asset-manifest";
import ICONS from "@/components/video/icons/icons.json";
import ALIASES from "@/components/video/icons/aliases.json";
import { ICON_CATEGORIES, searchIcons } from "@/lib/icons";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import { LOTTIE_LOADERS } from "@/components/video/lottie/registry";
import { LOTTIE_PALETTE, recolorLottie } from "@/components/video/lottie/recolor";
import { readdirSync, readFileSync } from "node:fs";
import { ecommercePlan } from "@/components/video/flow/fixtures/ecommerce";
import { validateFlowPlan } from "@/components/video/flow/validate";
import zlib from "node:zlib";
import path from "node:path";

// Deterministic stand-in images for generated assets (a lit gradient with a
// soft subject disc), as data URLs, so asset rendering is checked offline.
function placeholderPng(w: number, h: number, hue: number) {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2, y - h / 2) / (Math.min(w, h) / 2.4);
      const k = d < 1 ? 1 : Math.max(0.25, 1 - (d - 1) * 0.8);
      const t = y / h;
      const c = [Math.cos(hue) * 0.5 + 0.5, Math.cos(hue + 2.1) * 0.5 + 0.5, Math.cos(hue + 4.2) * 0.5 + 0.5];
      c.forEach((v, i) => (row[1 + x * 3 + i] = Math.round(255 * Math.min(1, (0.25 + 0.6 * v * (1 - t * 0.4)) * k + (d < 1 ? 0.15 : 0)))));
    }
    rows.push(row);
  }
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}
export const ECOMMERCE_ASSETS = { product: placeholderPng(256, 256, 0.2), parcel: placeholderPng(256, 256, 1.4), doorstep: placeholderPng(384, 216, 3.1) };

export type Fixture = { name: string; story: unknown; narration: string; durationSeconds: number; words?: typeof REFERENCE_VOICE_WORDS; assets?: Record<string, string> };
export const FIXTURES: Fixture[] = [
  { name: "reference (estimated timing)", story: REFERENCE_STORY, narration: REFERENCE_NARRATION, durationSeconds: 15 },
  { name: "reference (real ElevenLabs v3 timestamps)", story: REFERENCE_STORY, narration: REFERENCE_NARRATION, durationSeconds: 15, words: REFERENCE_VOICE_WORDS },
  { name: "developer tool (non-workspace story)", story: DEV_STORY, narration: DEV_NARRATION, durationSeconds: 12 },
  { name: "e-commerce with generated assets", story: ECOMMERCE_STORY, narration: ECOMMERCE_NARRATION, durationSeconds: 15, assets: ECOMMERCE_ASSETS },
];

// Generated visuals: one persistent object per continuity_id, visible at every
// moment that references it, and never alone on screen (not a slideshow).
function assetChecks(tl: ReturnType<typeof compileStory>, story: VisualStory, assets: Record<string, string>): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string, level: Check["level"] = "error") => checks.push({ frame: 0, name, ok, level, detail });
  const ids = [...new Set(story.moments.flatMap((m) => (m.asset?.required && assets[m.asset.continuity_id] ? [m.asset.continuity_id] : [])))];
  const tracks = tl.objects.filter((o) => o.kind === "asset_wide" || o.kind === "asset_square");
  add("one object per continuity_id", tracks.length === ids.length && ids.every((id) => tracks.some((t) => t.id === `asset_${id}`)), `${tracks.length} asset object(s) for ${ids.length} continuity id(s): ${ids.join(", ")}`);
  story.moments.forEach((m, i) => {
    if (!m.asset?.required || !assets[m.asset.continuity_id]) return;
    const mark = tl.moments[i];
    const frame = Math.min(tl.durationInFrames - 1, Math.round(mark.frame + (mark.end - mark.frame) * 0.8));
    const t = tracks.find((x) => x.id === `asset_${m.asset!.continuity_id}`);
    const shown = !!t && evaluatePose(t, frame).opacity > 0.9;
    const others = tl.objects.filter((o) => !o.id.startsWith("asset_") && evaluatePose(o, frame).opacity > 0.5).length;
    add(`asset shown · "${m.cue}" (${m.asset.continuity_id})`, shown, shown ? `visible, with ${others} procedural object(s) alongside` : "not visible at its moment");
    add(`not a slideshow · "${m.cue}"`, others > 0, others ? "procedural objects stay on screen with the image" : "the image is alone on screen", "warn");
  });
  const reused = story.moments.filter((m) => m.asset?.continuity_id === "parcel").length;
  if (reused > 1) add("continuity: reused asset is the same object", tracks.filter((t) => t.id === "asset_parcel").length === 1, `"parcel" referenced by ${reused} moments → 1 object, 1 image`);
  return checks;
}

type Section = { name: string; checks: Check[]; rows?: TimingRow[] };

// Stored briefs: old shapes still parse exactly as before; `story` is optional.
function briefCompatibility(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const scene = { duration_seconds: 3, purpose: "p", narration: "Too many tasks.", on_screen_text: [], visual: "ui", animation: "fade" };
  const base = { product_name: "X", product_summary: "s", supported_features: [], supported_claims: [], cta: "Go", script: "Too many tasks." };
  const legacy = [
    { ...base, scenes: [scene] }, // before transitions/SFX/cast/plans
    { ...base, scenes: [{ ...scene, plan: { primary_object: "text" } }] }, // V3.1 `plan`
    { ...base, cast: [{ id: "task_1", type: "task_card", role: "primary" }], scenes: [{ ...scene, transition: "fade", sound_effects: [], actions: [], visual_plan: null }] },
  ];
  const withoutStory = ProductBrief.omit({ story: true });
  legacy.forEach((raw, i) => {
    const a = ProductBrief.safeParse(raw);
    const b = withoutStory.safeParse(raw);
    const same = a.success && b.success && JSON.stringify({ ...a.data, story: undefined }) === JSON.stringify(b.data);
    add(`legacy brief ${i + 1} parses unchanged`, same && a.success && a.data.story === null, same ? "identical to parsing without `story`; story = null" : "parse differs");
  });
  const ok = ProductBrief.parse({ ...legacy[2], story: REFERENCE_STORY });
  add("brief with a valid story keeps it", VisualStory.safeParse(ok.story).success && ok.story?.cast.length === REFERENCE_STORY.cast.length, `${ok.story?.moments.length ?? 0} moments stored`);
  const bad = ProductBrief.safeParse({ ...legacy[2], story: { version: 9, junk: true } });
  add("brief with an invalid story still parses (story = null)", bad.success && bad.data.story === null, bad.success ? "invalid story dropped, brief intact" : "brief failed to parse");
  return checks;
}

function storyValidation(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string, level: Check["level"] = "error") => checks.push({ frame: 0, name, ok, level, detail });
  for (const f of FIXTURES.slice(1)) {
    const parsed = VisualStory.parse(f.story);
    const r = validateStory(parsed, f.narration);
    add(`valid story · ${f.name}`, r.errors.length === 0, r.errors.length ? r.errors.join("; ") : `0 errors, ${r.warnings.length} warning(s)${r.warnings.length ? ": " + r.warnings.join("; ") : ""}`);
  }
  // A broken story is reported, not silently accepted.
  const broken = VisualStory.parse({ ...REFERENCE_STORY, moments: [{ cue: "Too many tasks", intent: "accumulate", area: "nowhere", events: [{ verb: "accumulate", targets: "group:ghosts" }] }], closing: { text: ["Finalize Q3 report"] } });
  const r = validateStory(broken, REFERENCE_NARRATION);
  add("invalid story is reported", r.errors.length >= 3, r.errors.join("; "));
  return checks;
}

// Legacy manifest images (Fal) are skipped only when StoryWorld will render.
function legacyImageGating(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const manifest: AssetManifest = { assets: [
    { id: "abstract-1", type: "abstract", source: "generated", role: "background", prompt: "p", scene_ids: ["scene-1"] },
    { id: "icon-1", type: "icon", source: "generated", role: "foreground", prompt: "p", scene_ids: ["scene-2"] },
  ] };
  const env = { VERCEL_ENV: process.env.VERCEL_ENV, VISUAL_ENGINE: process.env.VISUAL_ENGINE };
  const set = (e: Record<string, string | undefined>) => Object.entries(e).forEach(([k, v]) => (v === undefined ? delete process.env[k] : (process.env[k] = v)));
  try {
    set({ VERCEL_ENV: "preview", VISUAL_ENGINE: "story" });
    const story = usableStory(VisualStory.parse(ECOMMERCE_STORY), ECOMMERCE_NARRATION, "16:9");
    add("valid StoryWorld → legacy images skipped", story !== null && !needsLegacyImages(manifest, story), story ? "usable story, 0 legacy Fal calls" : "fixture story not usable");
    const invalid = usableStory(VisualStory.parse(ECOMMERCE_STORY), "A completely different narration.", "16:9");
    add("invalid story → legacy images still generated", invalid === null && needsLegacyImages(manifest, invalid), "story fails validation → Storyboard path");
    const vertical = usableStory(VisualStory.parse(ECOMMERCE_STORY), ECOMMERCE_NARRATION, "9:16");
    add("unsupported format → legacy images still generated", vertical === null && needsLegacyImages(manifest, vertical), "9:16 → Storyboard path");
    add("story generation failed → legacy images still generated", needsLegacyImages(manifest, usableStory(null, ECOMMERCE_NARRATION, "16:9")), "no story stored → Storyboard path");
    set({ VERCEL_ENV: "production", VISUAL_ENGINE: "story" });
    const prod = usableStory(VisualStory.parse(ECOMMERCE_STORY), ECOMMERCE_NARRATION, "16:9");
    add("no StoryWorld (engine off) → legacy images still generated", prod === null && needsLegacyImages(manifest, prod), "Production → Storyboard path, unchanged");
    const done: AssetManifest = { assets: manifest.assets.map((a) => ({ ...a, status: "completed" as const, storage_path: "x" })) };
    add("already generated → no repeat calls", !needsLegacyImages(done, null), "completed assets are not regenerated");
  } finally {
    set(env);
  }
  return checks;
}

// Motion-graphics icon library: enough icons, all valid, small, searchable.
function iconLibrary(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const icons = ICONS as Record<string, string | string[]>;
  const names = Object.keys(icons);
  const aliases = ALIASES as Record<string, string>;
  add("full Lucide set", names.length >= 1800, `${names.length} icons + ${Object.keys(aliases).length} older names = ${names.length + Object.keys(aliases).length} usable names; ${Object.keys(ICON_CATEGORIES).length} curated categories`);
  const dangling = Object.entries(aliases).filter(([, to]) => !(to in icons));
  add("every alias points to an icon", dangling.length === 0, dangling.length ? dangling.map(([a]) => a).join(", ") : "all aliases resolve");
  const PATH = /^[Mm][-+.\d\sMmLlHhVvCcSsQqTtAaZz]*$/;
  const bad = names.filter((n) => [icons[n]].flat().some((d) => !d || !PATH.test(d)));
  add("every icon has valid path data", bad.length === 0, bad.length ? `invalid: ${bad.slice(0, 5).join(", ")}` : "all paths are plain SVG path syntax");
  const orphans = Object.values(ICON_CATEGORIES).flat().filter((n) => !(n in icons));
  add("every catalog name has geometry", orphans.length === 0, orphans.length ? orphans.join(", ") : "catalog and geometry agree");
  const bytes = new TextEncoder().encode(JSON.stringify(icons)).byteLength;
  add("library stays small", bytes < 360 * 1024, `${(bytes / 1024).toFixed(1)} KB raw (budget 360 KB)`);
  const probes: [string, string][] = [["shopping cart", "shopping-cart"], ["delivery truck", "truck"], ["credit card", "credit-card"], ["package", "package"], ["security shield", "shield"]];
  const misses = probes.filter(([q, want]) => !searchIcons(q, 3).includes(want));
  add("concept search finds the obvious icon", misses.length === 0, misses.length ? misses.map(([q]) => `"${q}" → ${searchIcons(q, 3).join("/")}`).join("; ") : probes.map(([q]) => `"${q}" → ${searchIcons(q, 1)[0]}`).join(", "));
  return checks;
}

// Our Lottie micro-animations: enough of them, structurally valid, consistent
// with the manifest/registry, small, and themeable.
export const LOTTIE_NAMES = Object.keys(LOTTIE_MANIFEST);
function lottieLibrary(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const dir = path.join(process.cwd(), "components/video/lottie/anims");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const manifest = LOTTIE_MANIFEST as Record<string, { frames: number; loop: boolean; category: string }>;
  add("at least 50 animations", LOTTIE_NAMES.length >= 50, `${LOTTIE_NAMES.length} animations in ${new Set(Object.values(manifest).map((m) => m.category)).size} categories`);
  const mismatch = [...new Set([...files, ...LOTTIE_NAMES, ...Object.keys(LOTTIE_LOADERS)])].filter((n) => !files.includes(n) || !(n in manifest) || !(n in LOTTIE_LOADERS));
  add("files, manifest and registry agree", mismatch.length === 0, mismatch.length ? mismatch.join(", ") : "every animation has a file, a manifest entry and a loader");
  let bytes = 0;
  const invalid: string[] = [];
  for (const n of files) {
    const text = readFileSync(path.join(dir, `${n}.json`), "utf8");
    bytes += text.length;
    const d = JSON.parse(text);
    const ok = d.fr === 30 && d.w === 200 && d.h === 200 && d.ip === 0 && d.op === manifest[n]?.frames && Array.isArray(d.layers) && d.layers.length > 0 &&
      d.layers.every((l: { ty: number; ks: unknown; shapes: unknown[] }) => l.ty === 4 && l.ks && Array.isArray(l.shapes) && l.shapes.length > 0);
    if (!ok) invalid.push(n);
  }
  add("every animation is a valid 200×200 30fps Lottie", invalid.length === 0, invalid.length ? invalid.join(", ") : `${files.length} files valid`);
  add("animations stay small", bytes < 300 * 1024, `${(bytes / 1024).toFixed(1)} KB total (budget 300 KB)`);
  const sample = JSON.parse(readFileSync(path.join(dir, "success-check.json"), "utf8"));
  const before = JSON.stringify(sample);
  const red = recolorLottie(sample, { primary: "#FF0000" });
  const text = JSON.stringify(red);
  const primary = LOTTIE_PALETTE.primary;
  add("theme recolour works", JSON.stringify(sample) === before && text.includes("[1,0,0,1]") && !text.includes(JSON.stringify([0, 2, 4].map((i) => Math.round((parseInt(primary.slice(1 + i, 3 + i), 16) / 255) * 1000) / 1000).concat(1))),
    "primary → #FF0000 everywhere, source untouched");
  return checks;
}

// Flow engine: the reference plan is valid in both themes, and a broken plan
// is reported rather than rendered wrongly.
function flowPlans(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  for (const theme of ["lavender", "midnight"] as const) {
    const plan = ecommercePlan(theme);
    const errors = validateFlowPlan(plan);
    add(`e-commerce plan is valid (${theme})`, errors.length === 0, errors.length ? errors.join("; ") : `${plan.nodes.length} nodes, ${plan.links.length} links, ${plan.duration} frames`);
  }
  const plan = ecommercePlan();
  const broken = { ...plan, links: [...plan.links, { id: "x", from: "order", to: "ghost", draw: [10, 5] as [number, number] }], nodes: [...plan.nodes, { ...plan.nodes[0], id: "bad", icon: [[0, "not-an-icon"]] as [number, string][] }] };
  const errs = validateFlowPlan(broken);
  add("broken plan is reported", errs.length >= 3, errs.join("; "));
  return checks;
}

export function runChecks(): Section[] {
  const sections: Section[] = [
    { name: "stored ProductBrief compatibility", checks: briefCompatibility() },
    { name: "VisualStory validation", checks: storyValidation() },
    { name: "legacy image generation gating", checks: legacyImageGating() },
    { name: "icon library", checks: iconLibrary() },
    { name: "lottie library", checks: lottieLibrary() },
    { name: "flow engine plans", checks: flowPlans() },
  ];
  for (const f of FIXTURES) {
    const n = normalizeStory(f.story);
    const tl = compileStory({ story: n.story, narration: f.narration, durationSeconds: f.durationSeconds, words: f.words, assets: f.assets });
    const frames = checkTimeline(tl);
    const timing = checkTiming(tl, f.words);
    const assetResults = f.assets ? assetChecks(tl, n.story, f.assets) : [];
    sections.push({ name: `timeline · ${f.name}`, checks: [...frames.checks, ...timing.checks, ...assetResults], rows: timing.rows });
  }
  return sections;
}
