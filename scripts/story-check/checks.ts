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
import zlib from "node:zlib";

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

export function runChecks(): Section[] {
  const sections: Section[] = [
    { name: "stored ProductBrief compatibility", checks: briefCompatibility() },
    { name: "VisualStory validation", checks: storyValidation() },
    { name: "legacy image generation gating", checks: legacyImageGating() },
    { name: "icon library", checks: iconLibrary() },
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
