// Deterministic StoryWorld checks that need no rendering: story validation,
// stored-brief compatibility, compiled-timeline frame checks and voice timing.
// Bundled and run by scripts/story-check/run.mjs.
import { creativeSimilarity, dnaSimilarity, downloadEntry, INSUFFICIENT_VISUAL_DIVERSITY, LOOK_FEATURES, MAX_BUILT_SIMILARITY, sameCreative, sameDna, scoreCandidate, searchCreative, searchVariants, seedFrom } from "@/lib/shot-search";
import { CREATIVE_A, CREATIVE_B, CREATIVE_C, CREATIVE_D, DIRECTION_A, DIRECTION_B, DIRECTION_D, DNA_A, DNA_B, DNA_C, DNA_D } from "@/components/video/flow/fixtures/creative-directions";
import { ProductBrief } from "@/lib/ai/product-brief";
import { fourDirectionsTimeout, generateShotScript, SINGLE_MS } from "@/lib/ai/shot-director";
import { flowBudgetMs } from "@/lib/pipeline";
import { DIRECTION_MAX, directionFor, LOOKS, lockBriefScript, lockedVoiceScript, STYLE_PRESETS, type StylePreset, VISUAL_STYLES, VOICE_SCRIPT_MAX } from "@/lib/projects";
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
import { paymentsHubPlan } from "@/components/video/flow/fixtures/payments-hub";
import { validateFlowPlan } from "@/components/video/flow/validate";
import { FLOW_SCRIPT_FIXTURES } from "@/components/video/flow/fixtures/scripts";
import { beatFrames, compileFlowScript } from "@/components/video/flow/compile";
import { num, vec } from "@/components/video/flow/eval";
import { spokenCueTimes } from "@/lib/voice-timing";
import { type FlowScript, flowScriptBlockers, repairFlowScript } from "@/lib/flow-script";
import { flowEngineEnabled, usableFlow } from "@/lib/story-engine";
import { planQuality, QUALITY_BAR, qualityProblems } from "@/components/video/flow/quality";
import { SCENE_FIXTURES } from "@/components/video/flow/fixtures/scenes";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { RECIPE_SHOTS, RECIPE_SHOTS_LEGACY, recipeFixture } from "@/components/video/flow/fixtures/recipe";
import { PARALLAX } from "@/lib/scene-recipe";

import { CARD_TEMPLATES } from "@/components/video/flow/cards/templates";
import { ASSET_COUNT } from "@/components/video/flow/cards/catalog";
import { CARD_STYLES } from "@/components/video/flow/cards/types";
import { DEPTH, LAYOUT_PRESETS, layoutFamily, layoutSlots, OVERLAPPING_FAMILIES } from "@/components/video/flow/layouts";
import { BACKDROPS } from "@/components/video/flow/backdrop-names";
import { CAMERA_MOVES, ENTER_STYLES, parseAsset, repairCues, repairSceneScript, type SceneBeat, type SceneScript, sceneScriptBlockers, TRANSITIONS } from "@/lib/scene-script";
import { usableScene } from "@/lib/story-engine";
import { compositionCheck } from "@/components/video/flow/composition-check";
import { BEHAVIOR_ACTION, type BehaviorReport, conceptsOf, continuityCheck, directionScripts, Dna, dnaLook, dnaProblems, expandShots, INTENT_CAMERA, SHOT_INTENTS, ShotObject as ShotObjectModel, type ShotObject, ShotScript, ShotScriptModel } from "@/lib/shots";
import { computeStates } from "@/components/video/flow/states";
import { REAL_SHOT_VIDEOS } from "@/components/video/flow/fixtures/real-shots";
import { OBJECTS } from "@/components/video/flow/object-names";
import { SHOT_FIXTURE, SHOT_NARRATION } from "@/components/video/flow/fixtures/shots";
import { neverList, VIDEO_RULES } from "@/lib/video-rules";
import { isIconName, resolveIcon as resolveIconName } from "@/components/video/icons";
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
export const ECOMMERCE_ASSETS = { parcel: placeholderPng(256, 256, 1.4), doorstep: placeholderPng(384, 216, 3.1) };

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
  for (const [name, make] of [["e-commerce", ecommercePlan], ["payments hub (UI plane, iris, orbit)", paymentsHubPlan]] as const)
    for (const theme of ["lavender", "midnight"] as const) {
      const plan = make(theme);
      const errors = validateFlowPlan(plan);
      add(`${name} plan is valid (${theme})`, errors.length === 0, errors.length ? errors.join("; ") : `${plan.nodes.length} nodes, ${plan.links.length} links, ${plan.duration} frames`);
    }
  const hubPlan = paymentsHubPlan();
  const brokenHub = { ...hubPlan, iris: [{ start: 10, dur: 10, members: ["ghost"], into: "nowhere" }], nodes: hubPlan.nodes.map((n) => (n.orbit ? { ...n, orbit: { ...n.orbit, center: "missing" } } : n)) };
  const hubErrs = validateFlowPlan(brokenHub);
  add("broken iris/orbit is reported", hubErrs.some((e) => e.includes("iris")) && hubErrs.some((e) => e.includes("orbit centre")), hubErrs.slice(0, 3).join("; "));
  const plan = ecommercePlan();
  const broken = { ...plan, links: [...plan.links, { id: "x", from: "order", to: "ghost", draw: [10, 5] as [number, number] }], nodes: [...plan.nodes, { ...plan.nodes[0], id: "bad", icon: [[0, "not-an-icon"]] as [number, string][] }] };
  const errs = validateFlowPlan(broken);
  add("broken plan is reported", errs.length >= 3, errs.join("; "));
  return checks;
}

// Flow Director output → compiler: fixtures in the Director's exact shape
// compile to valid plans, beats land on the voice's real word times, broken
// scripts are rejected, and the engine is Preview-only.
export const FLOW_SCRIPT_NAMES = FLOW_SCRIPT_FIXTURES.map((f) => f.name);
function flowDirector(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  for (const fx of FLOW_SCRIPT_FIXTURES) {
    const blockers = flowScriptBlockers(fx.script, fx.narration, fx.words, fx.durationSeconds);
    if (fx.name === "video-editor") {
      // The first real run, kept verbatim: its UI got 0.7 s, which the pacing
      // rules now reject (the Director must revise) — but it must still compile.
      const plan = compileFlowScript(fx.script, { narration: fx.narration, durationSeconds: fx.durationSeconds, words: fx.words });
      const errors = validateFlowPlan(plan);
      add("video-editor (first real run): pacing rules reject its 0.7 s UI; still compiles", blockers.some((e) => e.includes("ui_showcase")) && errors.length === 0, [...blockers, ...errors].slice(0, 2).join("; "));
      continue;
    }
    const plan = compileFlowScript(fx.script, { narration: fx.narration, durationSeconds: fx.durationSeconds, words: fx.words, brand: fx.brand, screenshots: fx.screenshots });
    const errors = validateFlowPlan(plan);
    add(`${fx.name}: script valid and compiles`, blockers.length + errors.length === 0, [...blockers, ...errors].join("; ") || `${fx.script.beats.length} beats → ${plan.nodes.length} nodes, ${plan.links.length} links, ${plan.sfx?.length ?? 0} sounds, ${plan.camera.center.length} camera keys`);
    const q = planQuality(plan);
    const qp = qualityProblems(q);
    add(`${fx.name}: meets the motion quality bar`, qp.length === 0, qp.join("; ") || `longest still ${(q.deadFrames / 30).toFixed(1)} s (≤ ${(QUALITY_BAR.deadFrames / 30).toFixed(1)}), smallest label ${q.minLabelPx}px, camera accel ${q.cameraAccel} px/f², no text overflow`);
  }
  for (const [name, plan] of [["hand-directed e-commerce", ecommercePlan()], ["hand-directed payments hub", paymentsHubPlan()]] as const) {
    const qp = qualityProblems(planQuality(plan));
    add(`${name}: meets the motion quality bar`, qp.length === 0, qp.join("; ") || "ok");
  }
  // Fuzz: many random but valid beat orders must compile without throwing and
  // produce valid plans (the first real run crashed on an unseen order).
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const fuzzFails: string[] = [];
  let fuzzCount = 0;
  for (let n = 0; n < 400; n++) {
    const len = 4 + Math.floor(rnd() * 9);
    const words = Array.from({ length: len * 6 + 6 }, (_, i) => `word${i}`);
    let w = 0;
    const beats: FlowScript["beats"] = [];
    let hero = false;
    let ui = false;
    let steps = 0;
    let uid = 0;
    for (let i = 0; i < len; i++) {
      const cue = words[w];
      const last = i === len - 1;
      const options = (
        i === 0
          ? ["hero_enter", "actor_enter", "ui_showcase"]
          : [
              ...(!hero ? ["hero_enter"] : ["hero_morph", "confirm", "celebrate", "orbit", "converge", ...(steps < 4 ? ["add_step"] : [])]),
              "actor_enter",
              "ui_showcase",
              "statement",
              "list",
              ...(ui ? ["iris_to_hub"] : []),
            ]
      ) as FlowScript["beats"][number]["action"][];
      const action = last ? "statement" : pick(options);
      w += action === "ui_showcase" || action === "list" ? 6 : 4;
      const b: FlowScript["beats"][number] = { cue, action, id: null, icon: null, label: null, packet_icon: null, ui: null, satellites: null, text: null, accent: null, lottie: null, layout: null, items: null };
      if (["hero_enter", "hero_morph", "actor_enter", "add_step", "iris_to_hub"].includes(action)) b.icon = pick(["package", "truck", "user", "wallet", "house", "bell"]);
      if (action === "actor_enter" || action === "add_step") b.id = `n${uid++}`;
      if (action === "orbit") b.satellites = Array.from({ length: 2 + Math.floor(rnd() * 5) }, () => ({ id: `n${uid++}`, icon: "cloud", label: rnd() < 0.5 ? "Label" : null }));
      if (["hero_enter", "hero_morph", "add_step", "actor_enter", "confirm"].includes(action) && rnd() < 0.7) b.label = pick(["Order", "Backed up", "Projects & data", "Easy access"]);
      if (action === "ui_showcase") b.ui = { title: "App", rows: [{ icon: "store", text: "A", value: "1", status: "Paid" }, { icon: "truck", text: "B", value: null, status: null }, { icon: "users", text: "C", value: null, status: null }], callouts: rnd() < 0.5 ? [{ text: "Fast", icon: "zap" }] : [], click_row: rnd() < 0.5 ? 1 : null };
      if (action === "title" || action === "statement") {
        b.text = "A short line of words";
        b.layout = pick([null, "display", "side", "pill", "panel"] as const);
      }
      if (action === "list") b.items = ["First item", "Second item", "Third item"].slice(0, 3 + Math.floor(rnd() * 2));
      if (action === "celebrate") b.lottie = "confetti-burst";
      if (action === "hero_enter") hero = true;
      if (action === "iris_to_hub") {
        hero = true;
        ui = false;
      }
      if (action === "ui_showcase") ui = true;
      if (action === "add_step") steps++;
      beats.push(b);
    }
    const script: FlowScript = { theme: pick(["lavender", "midnight", "mint", "teal"] as const), beats };
    const narration = words.join(" ");
    const dur = Math.max(10, Math.round(words.length * 0.3));
    if (flowScriptBlockers(script, narration, null, dur).length) continue;
    fuzzCount++;
    try {
      const plan = compileFlowScript(script, { narration, durationSeconds: dur, brand: rnd() < 0.5 ? { name: "Acme", cta: "Try it today" } : null });
      const errs = [...validateFlowPlan(plan), ...qualityProblems(planQuality(plan)).filter((p) => !p.includes("nothing new"))];
      if (errs.length) fuzzFails.push(`${beats.map((x) => x.action).join(">")}: ${errs[0]}`);
    } catch (e) {
      fuzzFails.push(`${beats.map((x) => x.action).join(">")}: threw ${e instanceof Error ? e.message : e}`);
    }
  }
  add("fuzz: random valid beat orders compile to valid, smooth, legible plans", fuzzFails.length === 0 && fuzzCount >= 100, fuzzFails.length ? `${fuzzFails.length}/${fuzzCount} failed, e.g. ${fuzzFails.slice(0, 2).join(" | ")}` : `${fuzzCount} random scripts compiled cleanly`);

  // Real voice timing: uneven word times (speech speeds up and pauses).
  const fx = FLOW_SCRIPT_FIXTURES[0];
  let clock = 0.3;
  const words = fx.narration.split(/\s+/).map((text, i) => {
    const start = clock;
    clock += 0.22 + (i % 5 === 4 ? 0.35 : 0) + (i % 3) * 0.04;
    return { text, start, end: clock - 0.03 };
  });
  const frames = beatFrames(fx.script, fx.narration, words, fx.durationSeconds);
  const expected = fx.script.beats.map((b) => {
    const first = b.cue.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
    const w = words.find((x, i) => x.text.toLowerCase().replace(/[^a-z]/g, "") === first && fx.narration.split(/\s+/).slice(i, i + b.cue.split(/\s+/).length).join(" ").toLowerCase().replace(/[^a-z ]/g, "") === b.cue.toLowerCase().replace(/[^a-z ]/g, ""));
    return w ? Math.round(w.start * 30) - 3 : null;
  });
  const off = frames.filter((f, i) => expected[i] !== null && f !== Math.max(expected[i]!, i ? frames[i - 1] + 10 : 0));
  add("beats start on the voice's word times (3-frame lead)", off.length === 0, off.length ? `${off.length} beat(s) off: ${frames.join(",")} vs ${expected.join(",")}` : `beat frames ${frames.join(", ")}`);
  // Broken scripts are rejected.
  const s0 = fx.script;
  const broken = { ...s0, beats: [s0.beats[3], { ...s0.beats[1], cue: "a sentence nobody says" }, { ...s0.beats[4], action: "orbit" as const, satellites: [] }] };
  const errs = flowScriptBlockers(broken, fx.narration, null, fx.durationSeconds);
  add("broken script is rejected", errs.some((e) => e.includes("not spoken")) && errs.some((e) => e.includes("must enter")) && errs.some((e) => e.includes("satellites")), errs.slice(0, 4).join("; "));
  const repaired = repairFlowScript({ ...s0, beats: s0.beats.map((b, i) => (i === 1 ? { ...b, icon: "shopping_cart_icon" } : b)) });
  add("unknown icons are repaired", repaired.beats[1].icon === "shopping-cart", `"shopping_cart_icon" → ${repaired.beats[1].icon}`);
  // Preview-only gating.
  const env = { VERCEL_ENV: process.env.VERCEL_ENV, VISUAL_ENGINE: process.env.VISUAL_ENGINE };
  const set = (e: Record<string, string | undefined>) => Object.entries(e).forEach(([k, v]) => (v === undefined ? delete process.env[k] : (process.env[k] = v)));
  try {
    set({ VERCEL_ENV: "preview", VISUAL_ENGINE: "flow" });
    const ok = flowEngineEnabled() && usableFlow(s0, fx.narration, "16:9", null, fx.durationSeconds) !== null && usableFlow(s0, fx.narration, "9:16", null, fx.durationSeconds) === null;
    const skip = !needsLegacyImages({ assets: [{ id: "a", type: "abstract", source: "generated", role: "background", prompt: "p", scene_ids: ["scene-1"] }] }, usableFlow(s0, fx.narration, "16:9", null, fx.durationSeconds));
    set({ VERCEL_ENV: "production", VISUAL_ENGINE: "flow" });
    const prodOff = !flowEngineEnabled() && usableFlow(s0, fx.narration, "16:9", null, fx.durationSeconds) === null;
    add("flow engine is Preview-only; legacy images skipped with a usable flow", ok && skip && prodOff, `preview 16:9 → flow, 9:16 → Storyboard, legacy images skipped: ${skip}, production → off: ${prodOff}`);
  } finally {
    set(env);
  }
  return checks;
}

// Director v2 (SceneScript) → scene compiler: the asset and layout libraries
// hold their invariants, fixtures compile cleanly, random scene scripts stay
// valid and legible, broken scripts are rejected and the engine is Preview-only.
export const SCENE_NAMES = SCENE_FIXTURES.map((f) => f.name);
function sceneDirector(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  add("asset library: hundreds of assets", ASSET_COUNT.cards >= 1000 && LAYOUT_PRESETS.length >= 100, `${ASSET_COUNT.cards} card assets (${CARD_TEMPLATES.length} templates × ${CARD_STYLES.length} styles), ${ASSET_COUNT.devices} devices, ${ASSET_COUNT.crops} crops, ${LAYOUT_PRESETS.length} layout presets`);
  // Every kind of SaaS, not only commerce: each industry has its own cards.
  const byCat = new Map<string, number>();
  for (const t of CARD_TEMPLATES) byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1);
  const thin = [...byCat].filter(([, n]) => n < 2).map(([c]) => c);
  add("asset library covers every kind of SaaS", byCat.size >= 30 && thin.length === 0, `${byCat.size} categories: ${[...byCat].map(([c, n]) => `${c} ${n}`).join(", ")}${thin.length ? `; too thin: ${thin.join(", ")}` : ""}`);
  const badIcons: string[] = [];
  const walkIcons = (id: string, v: unknown, key = ""): void => {
    if (typeof v === "string" && key === "icon" && !isIconName(v)) badIcons.push(`${id}: ${v}`);
    else if (Array.isArray(v)) v.forEach((x) => walkIcons(id, x));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walkIcons(id, x, k));
  };
  for (const t of CARD_TEMPLATES) walkIcons(t.id, t.blocks);
  add("every card template icon exists", badIcons.length === 0, badIcons.slice(0, 5).join(", ") || `${CARD_TEMPLATES.length} templates checked`);
  // Non-commerce fixtures never show commerce or shipping cards.
  const COMMERCE = new Set(CARD_TEMPLATES.filter((t) => t.category === "commerce" || t.category === "logistics").map((t) => t.id));
  const leaks = SCENE_FIXTURES.filter((f) => f.name !== "selorax").flatMap((f) => f.script.beats.flatMap((b) => (b.elements ?? []).map((e) => e.asset ?? "").filter((a) => COMMERCE.has(a.replace(/^card:/, "").split("/")[0])).map((a) => `${f.name}: ${a}`)));
  add("industry fixtures use their own industry's cards", leaks.length === 0 && SCENE_FIXTURES.length >= 10, leaks.join(", ") || `${SCENE_FIXTURES.length - 1} non-commerce fixtures: ${SCENE_FIXTURES.filter((f) => f.name !== "selorax").map((f) => f.name).join(", ")}`);
  // Layout boxes of sharp elements never overlap (stacks and fans excepted).
  const boxHits: string[] = [];
  for (const name of LAYOUT_PRESETS) {
    if (OVERLAPPING_FAMILIES.includes(layoutFamily(name))) continue;
    for (let n = 1; n <= 8; n++) {
      const r = layoutSlots(name, n, n).map((sl) => ({ sl, k: sl.scale * DEPTH[sl.depth].scale }));
      for (let i = 0; i < r.length; i++)
        for (let j = i + 1; j < r.length; j++) {
          const [a, b] = [r[i], r[j]];
          if (!a.sl.depth || !b.sl.depth) continue;
          const ox = (a.sl.box[0] * a.k + b.sl.box[0] * b.k) / 2 - Math.abs(a.sl.pos[0] - b.sl.pos[0]);
          const oy = (a.sl.box[1] * a.k + b.sl.box[1] * b.k) / 2 - Math.abs(a.sl.pos[1] - b.sl.pos[1]);
          if (ox > 1 && oy > 1) boxHits.push(`${name} n${n}`);
        }
    }
  }
  add("layouts: element boxes never overlap", boxHits.length === 0, boxHits.length ? [...new Set(boxHits)].slice(0, 6).join(", ") : `${LAYOUT_PRESETS.length} presets × 1–8 elements`);
  for (const fx of SCENE_FIXTURES) {
    const blockers = sceneScriptBlockers(fx.script, fx.narration, fx.words, fx.durationSeconds);
    const plan = compileSceneScript(fx.script, { narration: fx.narration, durationSeconds: fx.durationSeconds, words: fx.words, brand: fx.brand, screenshots: fx.screenshots });
    const errs = [...blockers, ...validateFlowPlan(plan), ...qualityProblems(planQuality(plan))];
    add(`scene fixture ${fx.name}: passes blockers, validation and the quality bar`, errs.length === 0, errs.slice(0, 3).join("; ") || `${plan.nodes.length} elements, ${fx.script.beats.length} beats`);
  }
  // Fuzz: random scene scripts over every layout, transition and verb.
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const fx = SCENE_FIXTURES[0];
  const words = fx.narration.split(/\s+/);
  const C = { title: null, subtitle: null, value: null, label: null, status: null, name: null, amount: null, delta: null, note: null, action: null, date: null, items: null };
  const B = (b: Partial<SceneBeat>): SceneBeat => ({ cue: "", action: "place", elements: null, targets: null, to: null, layout: null, camera: null, transition: null, backdrop: null, style: null, content: null, text: null, accent: null, text_layout: null, items: null, lottie: null, ...b });
  const hard: string[] = [];
  const soft: string[] = [];
  let count = 0;
  for (let k = 0; k < 240; k++) {
    const nb = 8 + Math.floor(rnd() * 6);
    const beats: SceneBeat[] = [];
    let alive: string[] = [];
    let id = 0;
    const newEls = (n: number) => Array.from({ length: n }, () => ({ id: `e${id++}`, asset: `card:${pick(CARD_TEMPLATES).id}/${pick(CARD_STYLES)}`, content: { ...C, title: pick(["Orders", "Stock", "Courier", null]), status: pick(["New", "Live", null]) }, screen: null, label: null }));
    for (let i = 0; i < nb; i++) {
      const p = Math.floor((i * (words.length - 3)) / nb);
      const cue = words.slice(p, p + 2).join(" ");
      if (i === 0 || i === Math.floor(nb / 2)) {
        const els = newEls(2 + Math.floor(rnd() * 4));
        const carry = i && alive.length ? [{ id: alive[0], asset: null, content: null, screen: null, label: null }] : [];
        beats.push(B({ cue, action: "scene", layout: pick(LAYOUT_PRESETS), camera: pick(CAMERA_MOVES), transition: i ? pick(TRANSITIONS) : "cut", backdrop: pick(BACKDROPS), style: pick([null, ...ENTER_STYLES]), elements: [...carry, ...els] }));
        alive = [...carry.map((c) => c.id), ...els.map((e) => e.id)];
        continue;
      }
      if (i === nb - 1) {
        beats.push(B({ cue, action: "statement", text: words.slice(p, p + 5).join(" "), text_layout: pick(["display", "panel", "pill", "side"] as const) }));
        continue;
      }
      const a = pick(["update", "connect", "trigger", "move", "highlight", "focus", "reveal", "arrange", "erase", "place", "merge", "celebrate", "orbit", "expand", "trace", "flow", "disconnect"] as const);
      const [x, y] = [pick(alive), pick(alive.filter((q) => q !== alive[0]))];
      const last = beats[beats.length - 1].action;
      if (a === "arrange") beats.push(B({ cue, action: a, layout: pick(LAYOUT_PRESETS) }));
      else if (a === "reveal" && last !== "reveal") beats.push(B({ cue, action: a }));
      else if (alive.length < 3 || a === "reveal" || a === "place") {
        if (alive.length >= 6) beats.push(B({ cue, action: "highlight", targets: [x] }));
        else {
          const els = newEls(1);
          alive.push(els[0].id);
          beats.push(B({ cue, action: "place", elements: els }));
        }
      } else if (a === "erase") {
        alive = alive.filter((q) => q !== x);
        beats.push(B({ cue, action: a, targets: [x], style: pick(["wipe", "fade", "shrink", "fly-out", "burst", "sink"]) }));
      } else if (a === "orbit" && alive.length >= 3) {
        beats.push(B({ cue, action: a, targets: alive.filter((q) => q !== x).slice(0, 3), to: x }));
      } else if (a === "expand") {
        beats.push(B({ cue, action: a, targets: [x] }));
        if (i + 2 < nb - 1) {
          i++;
          const p2 = Math.floor((i * (words.length - 3)) / nb);
          beats.push(B({ cue: words.slice(p2, p2 + 2).join(" "), action: "collapse", targets: [x] }));
        }
      } else if (a === "trace") {
        beats.push(B({ cue, action: a, targets: alive.slice(0, 3) }));
      } else if (a === "flow" || a === "disconnect") {
        beats.push(B({ cue, action: x === y ? "highlight" : a, targets: [x], to: x === y ? null : y }));
      } else if (a === "merge") {
        const t = alive.filter((q) => q !== x).slice(0, 2);
        alive = alive.filter((q) => !t.includes(q));
        beats.push(B({ cue, action: a, targets: t, to: x }));
      } else if (x === y || a === "highlight" || a === "focus" || a === "celebrate") beats.push(B({ cue, action: x === y ? "highlight" : a, targets: [x], lottie: a === "celebrate" ? "confetti-burst" : null }));
      else if (a === "trigger") {
        alive = alive.filter((q) => q !== x);
        beats.push(B({ cue, action: a, targets: [x], to: y, content: { ...C, status: "Done" } }));
      } else if (a === "update") beats.push(B({ cue, action: a, targets: [x], content: { ...C, status: "Done", value: "42" } }));
      else beats.push(B({ cue, action: a, targets: [x], to: y }));
    }
    const script = repairSceneScript({ version: 2, theme: pick(["teal", "mint", "lavender", "midnight"] as const), beats });
    if (sceneScriptBlockers(script, fx.narration, null, 15).some((b) => !/between beat|no beat/.test(b))) continue;
    count++;
    const tag = script.beats.map((b) => b.action + (b.layout ? `:${b.layout}` : "")).join(">");
    try {
      const plan = compileSceneScript(script, { narration: fx.narration, durationSeconds: 15, brand: rnd() < 0.5 ? { name: "Acme", cta: "Try it" } : null });
      const q = qualityProblems(planQuality(plan));
      const bad = [...validateFlowPlan(plan), ...q.filter((x) => /overlap|empty frame|jolt|overflow/.test(x))];
      if (bad.length) hard.push(`${tag}: ${bad[0]}`);
      if (q.some((x) => x.includes("too small"))) soft.push(tag);
      if (process.env.SCENE_FUZZ_DEBUG && (bad.length || q.some((x) => x.includes("too small")))) console.log("FUZZ", tag, "|", [...bad, ...q.filter((x) => x.includes("too small"))].join(" ; "), bad.some((x) => x.includes("empty")) ? "JSON" + JSON.stringify(script) : "");
    } catch (e) {
      hard.push(`${tag}: threw ${e instanceof Error ? e.message : e}`);
    }
  }
  add("fuzz: random scene scripts compile to valid plans without overlaps, empty frames or jolts", hard.length <= Math.ceil(count * 0.01) && count >= 150, hard.length ? `${hard.length}/${count} failed, e.g. ${hard.slice(0, 2).join(" | ")}` : `${count} random scene scripts compiled cleanly`);
  add("fuzz: cards stay legible (the Director revises the rare exception)", soft.length <= Math.ceil(count * 0.04), `${soft.length}/${count} with a card below ${Math.round(QUALITY_BAR.minElementScale * 100)}%`);
  // Broken scripts are rejected; unknown assets and layouts are repaired.
  const s0 = fx.script;
  const broken = { ...s0, beats: [s0.beats[1], { ...s0.beats[2], cue: "a sentence nobody says" }, { ...s0.beats[3], targets: ["ghost"] }] };
  const errs = sceneScriptBlockers(broken, fx.narration, null, fx.durationSeconds);
  add("broken scene script is rejected", errs.some((e) => e.includes("first beat must be a scene")) && errs.some((e) => e.includes("not spoken")) && errs.some((e) => e.includes("on screen")), errs.slice(0, 4).join("; "));
  const repaired = repairSceneScript({ ...s0, beats: s0.beats.map((b, i) => (i === 0 ? { ...b, layout: "spiral-galaxy", elements: b.elements!.map((e, j) => (j === 0 ? { ...e, asset: "card:courier_dispatch/glass" } : e)) } : b)) });
  add("unknown card templates and layouts are repaired", repaired.beats[0].layout === "grid" && repaired.beats[0].elements![0].asset === "card:courier/glass", `layout → ${repaired.beats[0].layout}, "courier_dispatch" → ${repaired.beats[0].elements![0].asset}`);
  // Rulebook (lib/video-rules.ts): detectors catch a crowded scene of small
  // equal cards (the Plateful mistake); repairs and the NEVER list hold.
  const six = s0.beats[0].elements!.concat(s0.beats[0].elements!).slice(0, 6).map((e, j) => ({ ...e, id: `${e.id}-${j}` }));
  const crowded = { ...s0, beats: [{ ...s0.beats[0], layout: "grid", elements: six }, ...s0.beats.slice(1).filter((b) => !b.targets?.length && !b.to)] };
  const cplan = compileSceneScript(crowded, { narration: fx.narration, durationSeconds: fx.durationSeconds, words: fx.words, brand: fx.brand });
  const found = compositionCheck(crowded, cplan, { narration: fx.narration, words: fx.words, durationSeconds: fx.durationSeconds, screenshots: 3 }).map((v) => v.rule);
  add("rulebook detectors flag a crowded scene of small cards", ["crowded", "no-hero", "unused-screens"].every((r) => found.includes(r)), `found: ${found.join(", ")}`);
  const fixedLook = repairSceneScript({ ...s0, theme: "midnight", beats: s0.beats.map((b, i) => (i === 0 ? { ...b, transition: "panel-wipe", elements: b.elements!.map((e) => ({ ...e, asset: "card:kpi/dark" })) } : b)) });
  add("rulebook repairs: no panel-wipe, no dark cards on a dark theme", fixedLook.beats[0].transition === "dissolve" && fixedLook.beats[0].elements!.every((e) => e.asset === "card:kpi/solid"), `${fixedLook.beats[0].transition}, ${fixedLook.beats[0].elements![0].asset}`);
  const list = neverList([{ id: "new-rule", never: "never do the new thing" }], { "new-rule": 4, crowded: 1 });
  add("rulebook NEVER list: rules from the database, most-broken first", list.startsWith("- never do the new thing (broken in 4 recent videos") && list.split("\n").length === VIDEO_RULES.filter((r) => r.enforced.some((e) => e !== "code")).length + 1, list.split("\n")[0]);
  const env = { VERCEL_ENV: process.env.VERCEL_ENV, VISUAL_ENGINE: process.env.VISUAL_ENGINE };
  const set = (e: Record<string, string | undefined>) => Object.entries(e).forEach(([k, v]) => (v === undefined ? delete process.env[k] : (process.env[k] = v)));
  try {
    set({ VERCEL_ENV: "preview", VISUAL_ENGINE: "flow" });
    const ok = usableScene(s0, fx.narration, "16:9", null, fx.durationSeconds) !== null && usableScene(s0, fx.narration, "9:16", null, fx.durationSeconds) === null;
    set({ VERCEL_ENV: "production", VISUAL_ENGINE: "flow" });
    const prodOff = usableScene(s0, fx.narration, "16:9", null, fx.durationSeconds) === null;
    add("scene engine is Preview-only", ok && prodOff, `preview 16:9 → scene, 9:16 → Storyboard, production → off: ${prodOff}`);
  } finally {
    set(env);
  }
  return checks;
}

// Shot templates (lib/shots.ts): the fixture expands, compiles and breaks no
// composition rule; the guards turn bad picks into safe ones.
// Phase 6.5: a stored shot as the Director writes it (compact groups).
const toModelShot = (x: ShotScript["shots"][number]) => ({
  shot: x.shot,
  cue: x.cue,
  subject: x.subject,
  label: x.label,
  text: x.line ? { line: x.line, line_cue: x.line_cue, accent: x.accent, mark: x.mark } : null,
  ui: x.card ? { card: x.card, title: x.title, input: x.input, button: x.button, action_cue: x.action_cue, result: x.result, result_cue: x.result_cue } : null,
  items: x.items,
  camera: x.camera,
  objects: x.objects,
  recipe: x.recipe ?? null,
});
const fakeAnswer = (scripts: ShotScript[]) => ({ theme: scripts[0].theme, creative: scripts[0].creative ?? { message: "m", audience: "a", tone: "t", pace: "calm" as const }, variants: scripts.map((x) => ({ id: x.variant, dna: x.dna, direction: x.direction, shots: x.shots.map(toModelShot) })) });
// The real Shot Director with a stand-in client: four directions; four
// timing out (then one); too little time for four; no time at all.
async function directorRun(budget: number, fourFails: boolean) {
  const v = REAL_SHOT_VIDEOS[REAL_SHOT_VIDEOS.length - 1];
  const W = v.words.split(" ").map((x) => x.split("@"));
  const words = W.map(([text, st], i) => ({ text, start: +st, end: W[i + 1] ? +W[i + 1][1] : +st + 0.5 }));
  const narration = W.map(([x]) => x).join(" ");
  const four = [CREATIVE_A(ShotScript.parse(v.shots)), ...[CREATIVE_B, CREATIVE_C, CREATIVE_D].map((x) => ShotScript.parse(x))];
  const calls: { single: boolean; timeout: number }[] = [];
  const client = {
    responses: {
      parse: async (params: { instructions?: string | null }, opts?: { timeout?: number }) => {
        const single = !!params.instructions?.includes("ONE variant only");
        calls.push({ single, timeout: opts?.timeout ?? 0 });
        if (!single && fourFails) throw new Error("Request timed out.");
        return { id: `r${calls.length}`, usage: { input_tokens: 1, output_tokens: 1 }, output_parsed: fakeAnswer(single ? [four[0]] : four) };
      },
    },
  } as unknown as Parameters<typeof generateShotScript>[3];
  const r = await generateShotScript({ narration, words, duration_seconds: v.duration, product_name: "MotionBrief", seed: 12345 }, undefined, budget, client);
  return { ...r, calls };
}
const DIRECTOR_RUNS = { four: await directorRun(150_000, false), fallback: await directorRun(150_000, true), short: await directorRun(60_000, false), none: await directorRun(35_000, false) };

function shotTemplates(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const notes: string[] = [];
  const script = expandShots(SHOT_FIXTURE, notes);
  const blockers = sceneScriptBlockers(script, SHOT_NARRATION, null, 30);
  const plan = compileSceneScript(script, { narration: SHOT_NARRATION, durationSeconds: 30, brand: { name: "MotionBrief", logo: "logo", cta: "Try it free today" } });
  const invalid = validateFlowPlan(plan);
  add("shots: the MotionBrief fixture expands and compiles", blockers.length + invalid.length + notes.length === 0, [...blockers, ...invalid, ...notes].join("; ") || `${SHOT_FIXTURE.shots.length} shots → ${script.beats.length} beats, ${plan.nodes.length} nodes`);
  const bad = compositionCheck(script, plan, { narration: SHOT_NARRATION, durationSeconds: 30 }).filter((v) => ["crowded", "no-hero", "tiny-screens", "stacked", "overlap-text", "empty-frame", "camera-swing", "busy-backdrop", "same-layouts", "cut-spam"].includes(v.rule));
  add("shots: no composition rule broken (crowded, no hero, overlaps, backdrops …)", bad.length === 0, bad.map((v) => `${v.rule}: ${v.detail}`).join("; ") || "clean");
  const arrows = plan.links.filter((l) => l.arrow && l.style === "dashed").length;
  const lit = plan.nodes.filter((n) => n.lit).length;
  add("shots: steps are joined by dashed arrows and the spoken step lights up (explainer look)", !!plan.explainer && arrows >= 2 && lit >= 2, `${arrows} arrows, ${lit} lit tiles, explainer ${!!plan.explainer}`);
  const ghosts = compileSceneScript(expandShots(SHOT_FIXTURE, [], "Making a promo video usually takes weeks."), { narration: SHOT_NARRATION, durationSeconds: 30 });
  add("shots: a caption the voice does not say is dropped", !ghosts.texts.some((x) => x.text === "Your video is ready"), ghosts.texts.map((x) => x.text).join(" | "));
  // The owner's rule: never people or animals, wherever an icon is asked for.
  const living = ["users", "user", "user-round", "baby", "smile", "face-grinning", "hand-heart", "handshake", "cat", "dog", "bird", "fish", "paw-print"].filter((n) => { const r = resolveIconName(n); return r === n; });
  const found = searchIcons("team people customer", 8).filter((n) => resolveIconName(n) !== n);
  add("shots: no people, faces, hands or animals ever resolve (icons, search)", living.length === 0 && found.length === 0, living.length || found.length ? `still living: ${[...living, ...found].join(", ")}` : `users → ${resolveIconName("users")}, smile → ${resolveIconName("smile")}, cat → ${resolveIconName("cat")}`);
  const objs = OBJECTS.filter((o) => parseAsset(`object:${o}`)?.kind !== "object");
  add("shots: all 3D objects parse as assets", objs.length === 0, objs.join(", ") || `${OBJECTS.length} objects`);
  // A word swap: the accent flips to the new word as the voice says it.
  const swapNarr = "Planning a launch takes weeks, not minutes. With Acme it is easy.";
  const z = null;
  const b0 = { subject: z, label: z, line: z, line_cue: z, accent: z, mark: z, card: z, title: z, input: z, button: z, action_cue: z, result: z, result_cue: z, items: z };
  const swapPlan = compileSceneScript(expandShots({ version: 3, theme: "lavender", shots: [
    { ...b0, shot: "problem", cue: "Planning a launch", subject: "object:question", line: "Takes weeks", line_cue: "takes weeks,", accent: "weeks", mark: "strike", items: [{ cue: z, asset: "text:minutes", label: z }] },
    { ...b0, shot: "reveal", cue: "With Acme" },
  ] }, [], swapNarr), { narration: swapNarr, durationSeconds: 6, brand: { name: "Acme", logo: "logo" } });
  const sw = swapPlan.texts.find((x) => x.swap);
  add("shots: a word swap lands when the voice says the new word (weeks → minutes)", !!sw && sw.swap!.word === "minutes" && sw.swap!.at > sw.start, sw ? `"${sw.text}" → ${sw.swap!.word} at frame ${sw.swap!.at}` : "no swap");
  // Phase 2: the Director writes creative + concepts before the shots; scripts
  // stored before that still parse (both null) and render the same.
  const oldStored = ShotScript.safeParse(REAL_SHOT_VIDEOS[0].shots);
  add("phase 2: shot scripts stored before concepts still parse", oldStored.success && oldStored.data.creative === null && oldStored.data.concepts === null, oldStored.success ? "creative = null, concepts = null" : "failed to parse");
  const withConcepts = ShotScript.safeParse({ ...(REAL_SHOT_VIDEOS[0].shots as object), creative: { message: "Video in minutes", audience: "SaaS teams", tone: "calm", pace: "balanced" }, concepts: [{ cue: "Making a product video", see: "a filmstrip stalls under a pile of steps", hero: "visual:filmstrip", persists: null, avoid: "people" }] });
  add("phase 2: creative + concepts are kept with the shots", withConcepts.success && withConcepts.data.concepts?.length === 1 && withConcepts.data.creative?.pace === "balanced", withConcepts.success ? "stored" : "failed to parse");
  // (a model answer: shared creative + directions A–D, each with compact shots)
  const modelAnswer = (shots: object[]) => ({ theme: "lavender", creative: { message: "m", audience: "a", tone: "t", pace: "calm" }, variants: [{ id: "A", dna: DNA_A, direction: DIRECTION_A, shots }] });
  const fullShots = ShotScript.parse(REAL_SHOT_VIDEOS[0].shots).shots.map((x) => toModelShot({ ...x, objects: null }));
  const fromModel = directionScripts(ShotScriptModel.parse(modelAnswer(fullShots)))[0];
  add("phase 2: the Director must write creative; concepts are read off its shots", !ShotScriptModel.safeParse({ ...modelAnswer(fullShots), creative: undefined }).success && fromModel.concepts?.length === fullShots.length && fromModel.concepts.every((c, i) => c.cue === fromModel.shots[i].cue && !!c.hero), `${fromModel.concepts?.length} concepts, e.g. ${fromModel.concepts?.[0].cue} → ${fromModel.concepts?.[0].hero}: ${fromModel.concepts?.[0].see}`);
  // Phase 3: a camera intent per shot. Older shots have none (null) and keep
  // the alternating move; each intent becomes a camera move the compiler
  // resolves, and no intent pushes a subject out of frame or breaks a rule.
  const p3 = REAL_SHOT_VIDEOS[REAL_SHOT_VIDEOS.length - 1];
  const p3Words = p3.words.split(" ").map((x) => x.split("@"));
  const p3w = p3Words.map(([text, st], i) => ({ text, start: +st, end: p3Words[i + 1] ? +p3Words[i + 1][1] : +st + 0.5 }));
  const p3n = p3Words.map(([x]) => x).join(" ");
  const p3Parsed = ShotScript.parse(p3.shots);
  add("phase 3: shots stored before camera intents parse (camera = null)", p3Parsed.shots.every((x) => x.camera === null), `${p3Parsed.shots.length} shots, camera null`);
  const p3Default = repairCues(expandShots(p3Parsed, [], p3n), p3n, p3w, p3.duration).script;
  add("phase 3: no intent keeps the default camera", p3Default.beats.filter((x) => x.action === "scene").every((x) => x.camera === "static"), "scene camera = static (alternating in/out)");
  const intentRows: string[] = [];
  let intentsOk = true;
  for (const intent of SHOT_INTENTS) {
    const withIntent = { ...p3Parsed, shots: p3Parsed.shots.map((x) => ({ ...x, camera: intent })) };
    const sc = repairCues(expandShots(withIntent, [], p3n), p3n, p3w, p3.duration).script;
    const mapped = sc.beats.filter((x) => x.action === "scene").every((x) => x.camera === INTENT_CAMERA[intent]);
    const pl = compileSceneScript(sc, { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo", cta: "Try it free today" } });
    const bad = compositionCheck(sc, pl, { narration: p3n, words: p3w, durationSeconds: p3.duration }).filter((x) => ["crowded", "no-hero", "lonely-icon", "stacked", "overlap-text", "empty-frame", "camera-swing", "tiny-screens"].includes(x.rule));
    // The move is real: the zoom differs between a shot's start and end (or holds for hold).
    const second = sc.beats.findIndex((x, i) => i > 0 && x.action === "scene");
    const t0 = Math.round((spokenCueTimes([sc.beats[second].cue], p3w)[0] ?? 0) * 30);
    const z = (f: number) => num(pl.camera.zoom, f, 1);
    const moved = INTENT_CAMERA[intent] === "hold" ? Math.abs(z(t0 + 30) - z(t0 + 50)) < 0.01 : true;
    if (!mapped || bad.length || validateFlowPlan(pl).length || !moved) intentsOk = false;
    intentRows.push(`${intent}→${INTENT_CAMERA[intent]}${bad.length ? ` (${bad.map((x) => x.rule).join(",")})` : ""}`);
  }
  add("phase 3: every camera intent maps to a move and renders cleanly", intentsOk, intentRows.join(" · "));
  // Phase 4: story objects keep one identity from shot to shot. One rocket
  // shown in three shots is ONE element that travels (carried, asset null),
  // not three copies; new objects next to it stay new.
  const obj = (id: string, asset: string, enters: boolean, persistent: boolean, extra: Partial<ShotObject> = {}): ShotObject => ({ id, role: "hero", asset, enters, persistent, exits: false, transforms_from: null, transforms_to: null, ...extra });
  const p4Shots = p3Parsed.shots.map((x, i) =>
    i === 6 ? { ...x, shot: "problem" as const, subject: "object:rocket", label: null, line: null, line_cue: null, items: null, objects: [obj("launch", "object:rocket", true, true)] }
    : i === 7 ? { ...x, items: [{ cue: null, asset: "object:rocket", label: "Launch" }, ...(x.items ?? []).slice(0, 2)], objects: [obj("launch", "object:rocket", false, true), obj("site", "icon:globe", true, false, { role: "support" })] }
    : i === 8 ? { ...x, objects: [obj("launch", "object:rocket", false, false)] }
    : x,
  );
  const p4 = { ...p3Parsed, shots: p4Shots };
  const p4Notes: string[] = [];
  const p4Script = repairCues(expandShots(p4, p4Notes, p3n), p3n, p3w, p3.duration).script;
  const sceneOf = (cue: string) => p4Script.beats.find((x) => x.action === "scene" && x.cue === cue);
  const rocketEls = [p4Shots[6].cue, p4Shots[7].cue, p4Shots[8].cue].map((c) => sceneOf(c)?.elements?.find((e) => e.asset === "object:rocket" || e.asset === null));
  const sameId = rocketEls.every((e) => e && e.id === rocketEls[0]!.id);
  add("phase 4 A: one object persists across 3 shots (carried, not re-created)", sameId && rocketEls[0]!.asset === "object:rocket" && rocketEls.slice(1).every((e) => e!.asset === null), rocketEls.map((e) => `${e?.id ?? "?"}:${e?.asset ?? "carried"}`).join(" → "));
  const shot7 = sceneOf(p4Shots[7].cue)?.elements ?? [];
  add("phase 4 B: new and persistent objects are told apart", shot7.filter((e) => e.asset === null).length === 1 && shot7.filter((e) => e.asset?.startsWith("icon:")).length === 2, shot7.map((e) => `${e.id}=${e.asset ?? "carried"}`).join(", "));
  const p4Plan = compileSceneScript(p4Script, { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo", cta: "Try it free today" } });
  const rocketNodes = p4Plan.nodes.filter((x) => x.id === rocketEls[0]!.id || x.id.startsWith(`${rocketEls[0]!.id}~`));
  const p4Bad = compositionCheck(p4Script, p4Plan, { narration: p3n, words: p3w, durationSeconds: p3.duration }).filter((x) => ["crowded", "no-hero", "lonely-icon", "stacked", "overlap-text", "empty-frame", "tiny-screens"].includes(x.rule));
  add("phase 4 F: identity holds through the render (one node for the rocket, plan valid)", rocketNodes.length === 1 && !sceneScriptBlockers(p4Script, p3n, p3w, p3.duration).length && !validateFlowPlan(p4Plan).length && !p4Notes.some((n) => n.startsWith("continuity")), `${rocketNodes.length} rocket node(s)${p4Bad.length ? `; review: ${p4Bad.map((x) => x.rule).join(",")}` : ""}`);
  // Wrong chains are caught before anything is drawn.
  const unknownNotes: string[] = [];
  const withUnknown = { ...p3Parsed, shots: p3Parsed.shots.map((x, i) => (i === 8 ? { ...x, objects: [obj("ghost", "object:rocket", false, false)] } : x)) };
  const unknownScript = expandShots(withUnknown, unknownNotes, p3n);
  const conflict = continuityCheck([{ objects: [obj("a", "icon:mail", true, true), obj("a", "icon:globe", true, false)] }, { objects: [obj("b", "icon:mail", true, true, { exits: true }), obj("c", "icon:mail", true, false)] }]);
  const gone = continuityCheck([{ objects: [obj("a", "icon:mail", true, true)] }, { objects: [] }, { objects: [obj("a", "icon:mail", false, false)] }]);
  add("phase 4 C: an unknown persistent object is caught (and ignored, never drawn wrong)", unknownNotes.some((n) => n.includes('unknown object "ghost"')) && unknownScript.beats.every((b) => (b.elements ?? []).every((e) => e.asset !== null)), unknownNotes.find((n) => n.includes("ghost")) ?? "not caught");
  add("phase 4 C: conflicting identity, stay+exit and a disappearance are caught", conflict.errors.length === 3 && gone.warnings.some((w) => w.includes("disappears")) && gone.warnings.some((w) => w.includes("not on screen")), [...conflict.errors, ...gone.warnings].join(" · "));
  add("phase 4 D: shots stored before object identity parse (objects = null) and expand as before", p3Parsed.shots.every((x) => x.objects === null) && JSON.stringify(expandShots(p3Parsed, [], p3n)) === JSON.stringify(expandShots({ ...p3Parsed, shots: p3Parsed.shots.map((x) => ({ ...x, objects: [] })) }, [], p3n)), `${p3Parsed.shots.length} shots, objects null`);
  add("phase 4: the Director must write each shot's objects (null allowed)", !ShotScriptModel.safeParse(modelAnswer(p3Parsed.shots.map((x) => Object.fromEntries(Object.entries(toModelShot(x)).filter(([k]) => k !== "objects"))))).success, "a model answer without them is rejected");
  // Phase 5: objects get a semantic behavior (what, never how); the
  // compiler maps each to a tested scene action. A five-shot chain:
  // a video enters → persists → clips accumulate beside it → they converge
  // into it → it transforms into a rocket.
  const act = (type: string, target: string | null, cue: string | null) => ({ type, target, cue });
  const o5 = (id: string, asset: string, enters: boolean, persistent: boolean, behavior: ReturnType<typeof act> | null, extra: Partial<ShotObject> = {}): ShotObject => ({ ...obj(id, asset, enters, persistent, extra), behavior });
  const it = (asset: string, label: string | null = null) => ({ cue: null, asset, label });
  const j5Shots = p3Parsed.shots.map((x, i) =>
    i === 5 ? { ...x, shot: "problem" as const, subject: "visual:filmstrip", label: null, line: null, line_cue: null, items: null, objects: [o5("video", "visual:filmstrip", true, true, act("enter", null, null))] }
    : i === 6 ? { ...x, shot: "group" as const, cue: "Pick your favorite,", subject: null, line: null, line_cue: null, items: [it("visual:filmstrip"), it("visual:play", "Clip"), it("visual:play", "Clip")], objects: [o5("video", "visual:filmstrip", false, true, null), o5("clip1", "visual:play", true, true, act("accumulate", "video", "download all four")), o5("clip2", "visual:play", true, true, act("accumulate", "video", "download all four"))] }
    : i === 7 ? { ...x, items: [it("visual:filmstrip"), it("visual:play", "Clip"), it("visual:play", "Clip")], objects: [o5("video", "visual:filmstrip", false, true, null), o5("clip1", "visual:play", false, false, act("converge", "video", "in email")), o5("clip2", "visual:play", false, false, act("converge", "video", "in email"))] }
    : i === 8 ? { ...x, shot: "group" as const, line: null, subject: null, items: [it("visual:filmstrip"), it("object:rocket", "Launch")], objects: [o5("video", "visual:filmstrip", false, false, act("transform", "launch", "deserves a video"), { transforms_to: "launch" }), o5("launch", "object:rocket", true, false, null, { transforms_from: "video" })] }
    : x,
  );
  const j5 = { ...p3Parsed, shots: j5Shots };
  const j5Build = () => {
    const notes: string[] = [];
    const sc = repairCues(expandShots(j5, notes, p3n), p3n, p3w, p3.duration);
    return { notes: [...notes, ...sc.notes.filter((n) => !n.startsWith("cue "))], sc: sc.script, plan: compileSceneScript(sc.script, { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo", cta: "Try it free today" } }) };
  };
  const j5a = j5Build();
  const stored5 = ShotScript.safeParse(JSON.parse(JSON.stringify(j5)));
  const model5 = ShotObjectModel.safeParse(o5("clip1", "visual:play", true, true, act("accumulate", "video", "download all four")));
  add("phase 5 A: an accumulate behavior parses (stored and from the Director)", stored5.success && stored5.data.shots[6].objects?.[1].behavior?.type === "accumulate" && model5.success, stored5.success ? `shot 7: ${stored5.data.shots[6].objects?.map((x) => `${x.id}:${x.behavior?.type ?? "-"}`).join(", ")}` : "failed");
  const vEl = j5a.sc.beats.find((b) => b.action === "scene" && b.cue === j5Shots[5].cue)?.elements?.[0]?.id;
  const acc = j5a.sc.beats.find((b) => b.action === "move" && b.cue === "download all four");
  const conv = j5a.sc.beats.find((b) => b.action === "merge" && b.cue === "in email");
  const tf = j5a.sc.beats.find((b) => b.action === "merge" && b.cue === "deserves a video");
  add("phase 5 B: converge resolves several objects onto one target", !!conv && conv.to === vEl && conv.targets!.length === 3 && conv.targets![2] === vEl && !!acc && acc.targets!.length === 2 && acc.to === vEl, `accumulate: move ${acc?.targets?.join("+")} → ${acc?.to} · converge: merge ${conv?.targets?.join("+")} → ${conv?.to}`);
  const tfBad1 = continuityCheck(j5Shots.map((x, i) => (i === 8 ? { objects: [o5("video", "visual:filmstrip", false, false, act("transform", "launch", "deserves a video"), { transforms_to: "rocket2" }), o5("launch", "object:rocket", true, false, null)] } : { objects: x.objects ?? null })));
  const tfBad2 = continuityCheck(j5Shots.map((x, i) => (i === 8 ? { objects: [o5("video", "visual:filmstrip", false, false, act("transform", "launch", "deserves a video")), o5("launch", "object:rocket", true, false, null, { transforms_from: "clip1" })] } : { objects: x.objects ?? null })));
  const tfOk = continuityCheck(j5Shots);
  add("phase 5 C: transform source → target is validated", !!tf && tf.targets![0] === vEl && tf.to !== vEl && !tfOk.errors.length && tfBad1.errors.some((e) => e.includes('transforms_to is "rocket2"')) && tfBad2.errors.some((e) => e.includes('comes from "clip1"')), `video ${tf?.targets?.[0]} → launch ${tf?.to}; wrong chains: ${[...tfBad1.errors, ...tfBad2.errors].join(" · ")}`);
  // A wrong behavior is dropped, the object stays as it was.
  const withBehavior = (shotIndex: number, objects: ShotObject[]) => ({ ...p3Parsed, shots: p3Parsed.shots.map((x, i) => (i === shotIndex ? { ...x, objects } : x)) });
  const actionsOf = (sc: SceneScript) => sc.beats.map((b) => b.action).join(",");
  const plainP3 = actionsOf(expandShots(p3Parsed, [], p3n));
  const dNotes: string[] = [];
  const dScript = expandShots(withBehavior(7, [o5("site", "icon:globe", true, false, act("connect", "crm", "in email"))]), dNotes, p3n);
  add("phase 5 D: connect to an unknown object is caught (and dropped)", dNotes.some((n) => n.includes('targets unknown object "crm"')) && actionsOf(dScript) === plainP3, dNotes.find((n) => n.includes("crm")) ?? "not caught");
  const eNotes: string[] = [];
  const eScript = expandShots(withBehavior(7, [o5("site", "icon:globe", true, false, act("dock", null, "in email"))]), eNotes, p3n);
  const eNotes2: string[] = [];
  expandShots(withBehavior(7, [o5("site", "icon:globe", true, false, act("dock", "site", "in email"))]), eNotes2, p3n);
  add("phase 5 E: dock without a valid target is rejected", eNotes.some((n) => n.includes("dock needs a target")) && eNotes2.some((n) => n.includes("cannot target itself")) && actionsOf(eScript) === plainP3, [...eNotes, ...eNotes2].filter((n) => n.includes("dock")).join(" · "));
  const unknownB: string[] = [];
  const uScript = expandShots(ShotScript.parse({ ...p3.shots as object, shots: (p3.shots as { shots: object[] }).shots.map((x, i) => (i === 7 ? { ...x, objects: [{ id: "site", role: "hero", asset: "icon:globe", enters: true, persistent: false, exits: false, transforms_from: null, transforms_to: null, behavior: { type: "explode", target: null, cue: "in email" } }] } : x)) }), unknownB, p3n);
  add("phase 5: an unknown behavior is caught and the video falls back to no behavior", unknownB.some((n) => n.includes('unknown behavior "explode"')) && actionsOf(uScript) === plainP3, unknownB.find((n) => n.includes("explode")) ?? "not caught");
  const oldObjects = ShotScript.safeParse({ ...(p3.shots as object), shots: (p3.shots as { shots: object[] }).shots.map((x, i) => (i === 7 ? { ...x, objects: [{ id: "site", role: "hero", asset: "icon:globe", enters: true, persistent: false, exits: false, transforms_from: null, transforms_to: null }] } : x)) });
  add("phase 5 F: Phase 1–4 data still parses (objects without behavior → null)", oldObjects.success && oldObjects.data.shots[7].objects?.[0].behavior === null && REAL_SHOT_VIDEOS.every((v) => ShotScript.safeParse(v.shots).success), "stored shots, Phase 4 objects: behavior = null");
  add("phase 5 G: objects without a behavior work as before (no extra beats)", actionsOf(expandShots(p4, [], p3n)) === actionsOf(expandShots({ ...p4, shots: p4.shots.map((x) => ({ ...x, objects: x.objects?.map((y) => ({ ...y, behavior: null })) ?? null })) }, [], p3n)) && !actionsOf(expandShots(p4, [], p3n)).includes("merge"), "Phase 4 chain: same beats");
  const j5b = j5Build();
  add("phase 5 H: the compiler resolves behaviors to the same motion every time", JSON.stringify(j5a.plan) === JSON.stringify(j5b.plan) && acc?.action === BEHAVIOR_ACTION.accumulate && conv?.action === BEHAVIOR_ACTION.converge && tf?.action === BEHAVIOR_ACTION.transform, "accumulate→move · converge→merge · transform→merge (identical plans)");
  // While a behavior runs, what it moves stays in the frame.
  let outside = "";
  for (const b of j5a.sc.beats.filter((x) => ["move", "merge"].includes(x.action))) {
    const t0 = Math.round((spokenCueTimes([b.cue], p3w)[0] ?? 0) * 30);
    for (let f = t0; f < t0 + 40; f += 2) {
      const zoom = num(j5a.plan.camera.zoom, f, 1);
      const c = vec(j5a.plan.camera.center, f);
      for (const st of computeStates(j5a.plan, f).values()) {
        if (![...(b.targets ?? []), b.to].includes(st.node.id) || st.opacity < 0.3) continue;
        const [x, y] = [960 + zoom * (st.pos[0] - c[0]), 540 + zoom * (st.pos[1] - c[1])];
        if (x < 0 || x > 1920 || y < 0 || y > 1080) outside ||= `${st.node.id} at ${Math.round(x)},${Math.round(y)} (frame ${f}, ${b.action})`;
      }
    }
  }
  add("phase 5 I: no behavior takes an object out of the frame", !outside, outside || "every moving object stays inside 1920×1080");
  const j5Bad = compositionCheck(j5a.sc, j5a.plan, { narration: p3n, words: p3w, durationSeconds: p3.duration }).filter((x) => ["crowded", "no-hero", "lonely-icon", "stacked", "overlap-text", "empty-frame", "tiny-screens"].includes(x.rule));
  add("phase 5 J: enter → persist → accumulate → converge → transform compiles validly", !sceneScriptBlockers(j5a.sc, p3n, p3w, p3.duration).length && !validateFlowPlan(j5a.plan).length && !j5a.notes.length && !tfOk.errors.length && !!acc && !!conv && !!tf, `${j5a.notes.join(" · ") || "no notes"}${j5Bad.length ? `; review: ${j5Bad.map((x) => `${x.rule}@${x.detail.slice(0, 60)}`).join(" | ")}` : ""}`);
  // Phase 6.5: four creative directions (A–D) for one locked script. The
  // 14 tries are shared by the directions; each keeps its cleanest try, and
  // only genuinely different stories are offered — a look never counts.
  const ctx65 = { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo" } };
  const dirA = CREATIVE_A(p3Parsed);
  const [dirB, dirC, dirD] = [CREATIVE_B, CREATIVE_C, CREATIVE_D].map((x) => ShotScript.parse(x));
  const four = searchCreative([dirA, dirB, dirC, dirD], ctx65, 12345);
  const ids = four.picks.map((p) => p.shots?.variant);
  add("phase 6.5 A: all four videos speak the same locked script", four.picks.length === 4 && four.picks.every((p) => !sceneScriptBlockers(p.script, p3n, p3w, p3.duration).length && p.script.beats.every((b) => repairCues({ ...p.script, beats: [b] }, p3n, p3w, p3.duration).script.beats.length === 1)), `${four.picks.length} videos, every cue spoken in the one narration`);
  const durations = new Set(four.picks.map((p) => p.plan.duration));
  const studio = readFileSync("app/projects/[id]/variant-studio.tsx", "utf8");
  add("phase 6.5 B: all four use the same voice (one timing, one audio track)", durations.size === 1 && /inputProps=\{\{ plan: v\.plan, audioUrl \}/.test(studio) && /renderPlanToFile\(\{ plan: variants\[i\]\.plan, audioUrl,/.test(studio), `one length: ${[...durations][0]} frames; the studio plays and renders every video with the project's audioUrl`);
  add("phase 6.5 C: the four directions are different stories", new Set(ids).size === 4 && new Set(four.picks.map((p) => p.shots?.direction?.concept)).size === 4, four.picks.map((p) => `${p.shots?.variant}: ${p.shots?.direction?.concept}`).join(" · "));
  // A only-look change: the same shots under another seed (look), or under
  // other words and other cameras — never a second creative.
  const lookA = searchVariants(dirA, ctx65, 999, { tries: 2, pick: 1 }).best!;
  const lookA2 = searchVariants(dirA, ctx65, 4242, { tries: 2, pick: 1 }).best!;
  const reworded = { ...dirA, variant: "B", direction: DIRECTION_B, shots: dirA.shots.map((x) => ({ ...x, camera: "follow" as const })) };
  const simLook = creativeSimilarity(dirA, dirA, lookA.script, lookA2.script);
  const simWords = creativeSimilarity(dirA, reworded);
  add("phase 6.5 D: a look, camera or wording change alone is not creative diversity", lookA.script.look?.decor !== undefined && sameCreative(simLook) && sameCreative(simWords), `other look: similarity ${simLook.total.toFixed(2)} · same shots, new words + camera: built ${simWords.built.toFixed(2)} (> ${MAX_BUILT_SIMILARITY})`);
  const twice = searchCreative([dirA, dirB, { ...dirC, variant: "A" }], ctx65, 12345);
  add("phase 6.5 E: one direction is never offered twice", twice.picks.filter((p) => p.shots?.variant === "A").length === 1 && twice.skipped.some((x) => x.reason.startsWith("the same direction")), `${twice.picks.map((p) => p.shots?.variant).join(", ")}; skipped: ${twice.skipped.map((x) => `${x.variant} (${x.reason})`).join(", ")}`);
  const ab = creativeSimilarity(dirA, dirB, four.picks.find((p) => p.shots?.variant === "A")?.script, four.picks.find((p) => p.shots?.variant === "B")?.script);
  add("phase 6.5 F: concept, hero, story and shot differences are measured", ab.parts.concept < 0.5 && ab.parts.hero < 0.5 && ab.parts.story < 0.7 && ab.parts.shots < 0.7 && !sameCreative(ab) && simLook.parts.concept === 1 && simLook.parts.shots === 1, Object.entries(ab.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" · "));
  const one = searchCreative([dirA], ctx65, 7);
  add("phase 6.5 G: never more than 14 candidates", four.tried.length <= 14 && one.tried.length <= 14 && searchCreative([dirA, dirB, dirC, dirD, { ...dirB, variant: "E" }], ctx65, 3).tried.length <= 14, `four directions: ${four.tried.length} tries · one direction: ${one.tried.length}`);
  add("phase 6.5 H: the quality score still decides (cleanest first)", four.picks.every((p) => p.score === scoreCandidate(p.violations, p.plan)) && four.picks.every((p, i) => i === 0 || p.score >= four.picks[i - 1].score), four.picks.map((p) => `${p.shots?.variant}=${p.score}`).join(" · "));
  const lookAlikes = [dirA, { ...dirA, variant: "B", direction: DIRECTION_B }, dirC, { ...dirC, variant: "D", direction: DIRECTION_D }];
  const thin = searchCreative(lookAlikes, ctx65, 12345);
  add("phase 6.5 I: clean but alike directions are dropped, not shown", thin.picks.length === 2 && thin.insufficient && thin.skipped.filter((x) => x.reason.startsWith("too close") || x.reason.startsWith("same visual DNA")).length === 2, `${thin.picks.map((p) => p.shots?.variant).join(", ")}; skipped: ${thin.skipped.map((x) => `${x.variant} (${x.reason})`).join(", ")}`);
  add("phase 6.5 J: four independent valid directions → all four are offered", four.picks.length === 4 && !four.insufficient && [...ids].sort().join("") === "ABCD", ids.join(", "));
  const copies = searchCreative([dirA, { ...dirA, variant: "B" }, { ...dirA, variant: "C" }, { ...dirA, variant: "D" }], ctx65, 12345);
  add("phase 6.5 K: without independent directions it never pads to four", copies.picks.length === 1 && copies.insufficient, `${copies.picks.length} video; insufficient creative diversity reported`);
  const BRIEF_FIXTURE = { product_name: "MotionBrief", product_summary: "s", supported_features: [], supported_claims: [], cta: "Go", scenes: [{ duration_seconds: 3, purpose: "p", narration: "x", on_screen_text: [], visual: "ui", animation: "fade" }], script: p3n };
  const chosen = { seed: four.picks[1].seed, scene: four.picks[1].script, variant: four.picks[1].shots?.variant ?? null, direction: four.picks[1].shots?.direction ?? null };
  const entry = downloadEntry(chosen, "2026-10-01T00:00:00.000Z");
  const tasted = ProductBrief.safeParse({ ...BRIEF_FIXTURE, variants: [chosen], taste: { downloads: [entry] } });
  const actions65 = readFileSync("app/projects/actions.ts", "utf8");
  add("phase 6.5 L: a download saves its direction with its look", tasted.success && tasted.data.taste?.downloads[0].selected_variant === chosen.variant && tasted.data.taste?.downloads[0].direction?.camera === chosen.direction?.camera && !!entry.look && /downloadEntry\(variant, new Date\(\)\.toISOString\(\)\)/.test(actions65), `selected ${entry.selected_variant}: ${entry.direction?.concept} · look ${entry.look?.decor}/${entry.look?.icons}`);
  const oldBrief = ProductBrief.safeParse({ ...BRIEF_FIXTURE, variants: [{ seed: 1, score: 0, scene: lookA.script }], taste: { downloads: [{ seed: 1, look: lookA.script.look ?? null, at: "2026-09-30T00:00:00.000Z" }] } });
  add("phase 6.5 M: older projects (no directions) still parse and render", oldBrief.success && oldBrief.data.variants?.[0].direction === undefined && p3Parsed.direction === null && p3Parsed.variant === null && REAL_SHOT_VIDEOS.every((v) => ShotScript.safeParse(v.shots).success) && !!searchCreative([p3Parsed], ctx65, 1).best, "old variants, taste and shot scripts parse; a script without a direction still builds");
  // Phase 6.5 compaction: the Director writes compact shots (text/ui groups,
  // no per-direction concepts); every Phase 2–5 field comes back intact.
  const flat4 = [dirA, dirB, dirC, dirD];
  const compact = fakeAnswer(flat4);
  const legacy = { theme: "lavender", creative: dirA.creative, variants: flat4.map((x) => ({ id: x.variant, dna: x.dna, direction: x.direction, concepts: conceptsOf(x.shots), shots: x.shots })) };
  const [cLen, lLen] = [JSON.stringify(compact).length, JSON.stringify(legacy).length];
  add("phase 6.5: the four-direction answer is much more compact than before", cLen <= lLen * 0.7, `${cLen} vs ${lLen} characters (${Math.round((1 - cLen / lLen) * 100)}% shorter, about ${Math.round(cLen / 3.5)} vs ${Math.round(lLen / 3.5)} tokens)`);
  const parsedCompact = ShotScriptModel.safeParse(compact);
  add("phase 6.5 H: the compact schema is valid", parsedCompact.success && parsedCompact.data.variants.length === 4, parsedCompact.success ? "4 variants parse" : JSON.stringify(parsedCompact.error.issues.slice(0, 2)));
  const back = parsedCompact.success ? directionScripts(parsedCompact.data) : [];
  const same = back.length === 4 && back.every((x, i) => JSON.stringify(x.shots) === JSON.stringify(flat4[i].shots) && JSON.stringify(x.direction) === JSON.stringify(flat4[i].direction) && x.variant === flat4[i].variant);
  const dObjects = back[3]?.shots.flatMap((x) => x.objects ?? []) ?? [];
  add("phase 6.5 G: Phase 2–5 fields survive the compact answer", same && dObjects.some((o) => o.behavior?.type === "connect" && o.behavior.target === "mail" && o.behavior.cue === "in email") && back.slice(1).every((x) => x.shots.every((y) => y.camera !== null)) && back.every((x) => x.concepts?.length === x.shots.length), `shots, cameras, objects, behaviors, targets, cues and directions identical after the round trip; ${dObjects.length} objects in D`);
  const bad1 = ShotScriptModel.safeParse({ ...compact, variants: compact.variants.map((v, i) => (i ? v : { ...v, shots: [{ ...v.shots[0], shot: "montage" }] })) });
  const bad2 = ShotScriptModel.safeParse({ ...compact, variants: compact.variants.map((v) => ({ id: v.id, shots: v.shots })) });
  const bad3 = ShotScriptModel.safeParse({ ...compact, variants: compact.variants.map((v) => ({ ...v, shots: v.shots.map((x) => ({ ...x, x: 120, duration: 2 })) })) });
  add("phase 6.5 I: an invalid answer is rejected", !bad1.success && !bad2.success && bad3.success && !JSON.stringify(directionScripts(bad3.data)).includes('"duration"'), "unknown shot kind and missing direction rejected; stray numbers (x, duration) never reach the shots");
  const run4 = DIRECTOR_RUNS.four;
  add("phase 6.5 C: the Director's four directions come back as four videos", !!run4.script && run4.variants.length === 4 && run4.variants.map((v) => v.variant).join("") === "ABCD" && !run4.calls[0].single && !run4.calls.some((c) => c.single) && !run4.errors.includes("fallback: one direction"), `${run4.variants.map((v) => `${v.variant}: ${v.direction?.concept}`).join(" · ")} · calls: ${run4.calls.map((c) => (c.single ? "one" : "four")).join(" → ")} (the second is the review round)`);
  add("phase 6.5 D: the four videos are genuinely different", run4.variants.every((a, i) => run4.variants.every((b, j) => i === j || a.direction?.concept !== b.direction?.concept)) && !run4.errors.some((e) => e.startsWith("insufficient")), "no direction dropped as too close");
  const fb = DIRECTOR_RUNS.fallback;
  add("phase 6.5 J: four directions time out → one direction through the shot engine", !!fb.script && fb.script.style === "explainer" && fb.errors[0] === "fallback: one direction" && fb.errors.some((e) => e.includes("timed out")) && fb.calls.length === 2 && !fb.calls[0].single && fb.calls[1].single && fb.calls[0].timeout <= 150_000 - 8_000 - 40_000, `calls: ${fb.calls.map((c) => `${c.single ? "one" : "four"} (${Math.round(c.timeout / 1000)} s)`).join(" → ")}; ${fb.errors.slice(0, 2).join(" · ")}`);
  const short = DIRECTOR_RUNS.short;
  add("phase 6.5 K: with little time left it asks for one direction only", !!short.script && short.calls.length === 1 && short.calls[0].single && short.variants.length === 1, `budget 60 s: ${short.calls.map((c) => `${c.single ? "one" : "four"} (${Math.round(c.timeout / 1000)} s)`).join(", ")}`);
  const none5 = DIRECTOR_RUNS.none;
  add("phase 6.5: no time for either → a clear failure, no request beyond the budget", !none5.script && none5.calls.length === 0 && none5.errors.some((e) => e.startsWith("four directions skipped")) && none5.errors.some((e) => e.startsWith("single direction skipped")), none5.errors.join(" · "));
  // ── Director time budget, from REAL runs (cost_events / DB timestamps) ──
  // b4b89fdf: brief 135 s, voice 23 s → Director had ~90 s and both calls
  // timed out. bddeedc8: the uncompacted four-direction call took ~95 s.
  // With a locked script the brief now runs alongside voice + Director.
  const REAL = { brief: 135_000, voice: 23_000, analyse: 5_000, fourCall: 95_000, oneCall: 75_000 };
  const before = flowBudgetMs(REAL.analyse + REAL.brief + REAL.voice);
  const after = flowBudgetMs(REAL.analyse + REAL.voice);
  const fourBefore = Math.min(90_000, before - 8_000 - 40_000);
  const fourAfter = fourDirectionsTimeout(after);
  add("budget: with the brief alongside, the four-direction call gets the time a real run needed", fourBefore < REAL.fourCall && fourAfter >= REAL.fourCall && after - fourAfter >= SINGLE_MS - 8_000, `real brief 135 s + voice 23 s: before ${Math.round(before / 1000)} s (four ${Math.round(fourBefore / 1000)} s < needed 95 s) · now ${Math.round(after / 1000)} s (four ${Math.round(fourAfter / 1000)} s, one-direction reserve ${Math.round((after - fourAfter - 8_000) / 1000)} s)`);
  const actionsSrc = readFileSync("app/projects/actions.ts", "utf8");
  add("budget: brief, voice and Director run in the order that gives the Director that time", /const alongside = !!own2 && !!lockedScriptOf\(own2\) && !storyEngineEnabled\(\);/.test(actionsSrc) && /lockedScriptOf\(project\) \|\| undefined/.test(actionsSrc) && /\["scene", "flow", "story", "shots", "variants", "diagnostics", "taste"\]/.test(actionsSrc) && /if \(b\?\.brief_status === "completed" \|\| b\?\.brief_status === "failed"\) break;/.test(actionsSrc), "voice from the locked script · brief keeps the Director's scene/shots/variants · the Director waits for the brief before storing");
  // ── Phase 6.5 visual DNA, diagnostics, timing, behaviors, overlap ──
  const dnas = [DNA_A, DNA_B, DNA_C, DNA_D];
  add("DNA A: the visual DNA schema is valid", dnas.every((d) => Dna.safeParse(d).success), dnas.map((d) => d.composition).join(" · "));
  const badDna = Dna.safeParse({ ...DNA_A, composition: "magazine" });
  const badAnswer = ShotScriptModel.safeParse({ ...compact, variants: compact.variants.map((v, i) => (i ? v : { ...v, dna: { ...v.dna, cards: "lots" } })) });
  add("DNA B: a DNA value outside the list is rejected", !badDna.success && !badAnswer.success, "composition \"magazine\" and cards \"lots\" rejected");
  add("DNA C: all four directions carry their DNA", run4.variants.length === 4 && run4.variants.every((v) => !!v.dna) && back.every((x) => !!x.dna), run4.variants.map((v) => `${v.variant}: ${v.dna?.composition}/${v.dna?.cards}/${v.dna?.typography}`).join(" · "));
  const pairs = four.picks.flatMap((a, i) => four.picks.slice(i + 1).map((b) => ({ a, b, d: dnaSimilarity(a.shots!, b.shots!)! })));
  add("DNA D: every pair of the four differs in at least 6 of 9 DNA dimensions", pairs.length === 6 && pairs.every((x) => x.d.different.length >= 6 && !sameDna(x.d)), pairs.map((x) => `${x.a.shots?.variant}${x.b.shots?.variant} ${x.d.different.length}/9`).join(" · "));
  const lookOnly = dnaSimilarity(dirA, { ...dirA, dna: { ...DNA_A, icons: "outline" } })!;
  const lookDna = dnaSimilarity(lookA.shots!, lookA2.shots!)!;
  add("DNA E: a look-only difference does not count as another DNA", sameDna(lookOnly) && sameDna(lookDna) && lookA.script.look?.decor === lookA2.script.look?.decor, `other icon style: ${lookOnly.different.length}/9 differ · other seed: ${lookDna.different.length}/9 differ (same background ${lookA.script.look?.decor})`);
  const sameStruct = searchCreative([dirA, { ...dirB, dna: DNA_A }], ctx65, 12345);
  add("DNA F: a direction with the same structural DNA is rejected", sameStruct.picks.length === 1 && sameStruct.status === INSUFFICIENT_VISUAL_DIVERSITY && sameStruct.skipped.some((x) => x.reason.startsWith("same visual DNA as A")), sameStruct.skipped.map((x) => `${x.variant}: ${x.reason}`).join(" · "));
  const wrongFamily = dnaProblems(dirB.shots, DNA_D);
  const followsA = [11, 222, 3333].map((sd) => expandShots(dirA, [], p3n, { seed: sd }));
  const lookOk = followsA.every((sc) => JSON.stringify({ decor: sc.look?.decor, tone: sc.look?.tone, icons: sc.look?.icons, cut: sc.look?.cut }) === JSON.stringify(dnaLook(DNA_A)));
  const camOk = followsA[0].beats.filter((b) => b.action === "scene").every((b) => ["drift", "push-in", "pull-back", "hold"].includes(b.camera ?? ""));
  const penalised = searchVariants({ ...dirB, dna: DNA_D }, ctx65, 7, { tries: 2, pick: 1 }).best;
  add("DNA G: the DNA decides the look, the camera and the allowed shots", wrongFamily.some((x) => x.startsWith("cards none")) && wrongFamily.some((x) => x.startsWith("composition object-story")) && lookOk && camOk && !!penalised && penalised.score >= 6 && dnas.every((d, i) => !dnaProblems(flat4[i].shots, d).length), `B's shots under D's DNA: ${wrongFamily.join("; ")} (score ${penalised?.score}); A's look = ${JSON.stringify(dnaLook(DNA_A))} for every seed`);
  // Timing: the voice's words place every moment.
  const groupPlan = compileSceneScript(repairCues(expandShots(p3Parsed, [], p3n), p3n, p3w, p3.duration).script, { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo" } });
  const wordAt = (w: string) => Math.round(p3w.find((x) => x.text.toLowerCase().startsWith(w))!.start * 30);
  const litAt = (label: string) => {
    const node = groupPlan.nodes.find((n) => n.kind === "el" && JSON.stringify(n.el ?? {}).includes(`"${label}"`) && n.lit && n.lit.length > 2);
    // (it starts lighting 10 frames before it is fully lit)
    const on = node?.lit?.find(([f2, v2]) => v2 === 1 && f2 > 0);
    return on ? on[0] - 10 : null;
  };
  const [emailLit, linkedLit] = [litAt("Email"), litAt("LinkedIn")];
  add("timing H: each moment starts on its spoken word", emailLit !== null && Math.abs(emailLit - wordAt("email")) <= 8 && linkedLit !== null && Math.abs(linkedLit - wordAt("linkedin")) <= 8, `"email" said at ${wordAt("email")}, lit at ${emailLit} · "LinkedIn" said at ${wordAt("linkedin")}, lit at ${linkedLit} (frames)`);
  const groupBeats = expandShots(p3Parsed, [], p3n).beats;
  const shareAt = groupBeats.findIndex((b) => b.cue === "Share them on your website,");
  add("timing I: a group said item by item lights each item on its own word", groupBeats[shareAt]?.style === "steps" && groupBeats.slice(shareAt + 1, shareAt + 3).map((b) => `${b.action}@${b.cue}`).join(",") === "activate@email,activate@LinkedIn", groupBeats.slice(shareAt, shareAt + 3).map((b) => `${b.action}@${b.cue}`).join(" → "));
  const resultShots = { ...p3Parsed, shots: p3Parsed.shots.map((x, i) => (i === 4 ? { ...x, result: "Videos ready", result_cue: "In about two minutes" } : i === 5 ? { ...x, shot: "outputs" as const, subject: null, line: null, items: [{ cue: null, asset: "visual:filmstrip", label: "Videos" }] } : x)) };
  const resultScript = repairCues(expandShots(resultShots, [], p3n), p3n, p3w, p3.duration).script;
  const upd = resultScript.beats.find((b) => b.action === "update" && b.cue === "In about two minutes");
  const resultPlan = compileSceneScript(resultScript, { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo" } });
  const cardUpd = resultPlan.nodes.flatMap((n) => (n.el?.type === "card" ? (n.el.updates ?? []) : [])).find((u) => JSON.stringify(u.content).includes("Videos ready"));
  add("timing J: the result appears when it is said (also with outputs after it)", !!upd && !!cardUpd && cardUpd.at >= wordAt("in") - 6 && cardUpd.at - wordAt("in") <= 15 && !resultScript.beats.some((b) => (b.elements ?? []).some((e) => e.asset?.startsWith("card:success"))), `"In about two minutes" at ${wordAt("in")}: the card reads "Videos ready" at ${cardUpd?.at} (the click before it needs its 20 frames)`);
  // Behaviors: two moments on one word — the second moves to the next free word.
  const busy: BehaviorReport[] = [];
  const busyScript = expandShots({ ...p3Parsed, shots: p3Parsed.shots.map((x, i) => (i === 0 ? { ...x, objects: [o5("bell", "object:bell", true, false, act("highlight", null, "nobody sees them."))] } : x)) }, [], p3n, undefined, busy);
  const busyBeat = busyScript.beats.find((b) => b.action === "highlight");
  add("behavior K: a valid behavior on a busy word is delayed, not dropped", busy[0]?.status === "delayed" && !!busyBeat && busyBeat.cue !== "nobody sees them.", `${busy[0]?.type} of ${busy[0]?.object}: ${busy[0]?.status} to "${busyBeat?.cue}" (${busy[0]?.reason})`);
  const joined: BehaviorReport[] = [];
  const joinScript = expandShots({ ...p3Parsed, shots: p3Parsed.shots.map((x, i) => (i === 4 ? { ...x, objects: [o5("wave", "visual:waveform", true, false, act("dock", "panel", "choose a voice,")), o5("panel", "card", true, false, null)] } : x)) }, [], p3n, undefined, joined);
  const uiScene = joinScript.beats.find((b) => b.action === "scene" && (b.elements ?? []).some((e) => e.asset?.startsWith("card:")));
  add("behavior K: an acting object the shot does not draw joins it when there is room", joined[0]?.status === "applied" && (uiScene?.elements ?? []).some((e) => e.asset === "visual:waveform") && joinScript.beats.some((b) => b.action === "trigger" && b.cue === "choose a voice,"), `ui scene: ${(uiScene?.elements ?? []).map((e) => e.asset).join(" + ")} (${uiScene?.layout}); dock → trigger on "choose a voice,"`);
  const why: BehaviorReport[] = [];
  expandShots({ ...p3Parsed, shots: p3Parsed.shots.map((x, i) => (i === 7 ? { ...x, objects: [o5("site", "icon:globe", true, false, act("dock", null, "in email")), o5("wave", "visual:waveform", true, false, act("highlight", null, "on LinkedIn."))] } : x)) }, [], p3n, undefined, why);
  add("behavior L: a dropped behavior always says why", why.length === 2 && why.every((x) => x.status === "dropped" && !!x.reason) && why.some((x) => x.reason === "unsupported-composition") && why.some((x) => x.reason === "invalid-target"), why.map((x) => `${x.type} of ${x.object}: ${x.reason}`).join(" · "));
  // Overlap: the detector catches overlaps planted in a clean plan.
  const clean = planQuality(groupPlan);
  const planted = JSON.parse(JSON.stringify(groupPlan)) as typeof groupPlan;
  const side = planted.texts.find((t) => t.style === "side")!;
  planted.texts.push({ ...side, text: `${side.text} again` });
  const settled = planted.nodes.filter((n) => n.kind === "el" && n.appear !== undefined);
  const [n1, n2] = [settled[0], settled[1]];
  if (n1 && n2) n2.pos = n1.pos;
  const caught = planQuality(planted);
  add("overlap M: planted text/text and element overlaps are caught", clean.collisions.length === 0 && caught.collisions.some((c) => c.what.startsWith("text") && c.what.includes("over text")) && caught.collisions.length >= 1, `clean: ${clean.collisions.length} · planted: ${caught.collisions.map((c) => `${c.what} (${(c.at / 30).toFixed(1)} s)`).slice(0, 3).join(" · ")}`);
  // Diagnostics: why a direction was left out, kept for the project.
  const rej = sameStruct.diagnostics.find((d) => d.direction_id === "B");
  const generate = readFileSync("app/projects/actions.ts", "utf8");
  add("diagnostics N: a rejected direction's reason is kept with the project", !!rej && !rej.selected && rej.rejected_against_variant === "A" && rej.similarity_dimensions.includes("composition") && rej.rejection_reasons.length > 0 && rej.candidate_attempts > 0 && run4.diagnostics?.directions.length === 4 && /brief: \{ \.\.\.\(\(fresh\?\.brief as object \| null\) \?\? \{\}\), \.\.\.\(stored \?\? \{\}\), diagnostics \}/.test(generate), `B: ${rej?.rejection_reasons[0]} · attempts ${rej?.candidate_attempts}, valid ${rej?.valid_count} · saved as brief.diagnostics`);
  add("diversity O: four valid, different directions stay four", four.picks.length === 4 && four.status === "ok" && four.diagnostics.every((d) => d.selected), four.diagnostics.map((d) => `${d.direction_id} q${d.quality_score}`).join(" · "));
  add("diversity P: without enough different directions it never copies to four", copies.picks.length === 1 && copies.status === INSUFFICIENT_VISUAL_DIVERSITY && copies.diagnostics.filter((d) => !d.selected).every((d) => d.rejected_against_variant === "A"), `${copies.picks.length} video · ${copies.status}`);
  const oldWithDiag = ProductBrief.safeParse({ ...BRIEF_FIXTURE });
  add("compat Q: old projects (no DNA, no diagnostics) still parse and build", oldWithDiag.success && oldWithDiag.data.diagnostics === null && p3Parsed.dna === null && expandShots(p3Parsed, [], p3n).beats.length > 0, "dna = null, diagnostics = null");
  // The call to action: a closing brand sentence without its own shot brings the lockup in on its first word.
  const noCta = { ...p3Parsed, shots: p3Parsed.shots.slice(0, -1) };
  const ctaPlan = compileSceneScript(repairCues(expandShots(noCta, [], p3n), p3n, p3w, p3.duration).script, { narration: p3n, words: p3w, durationSeconds: p3.duration, brand: { name: "MotionBrief", logo: "logo", cta: "Start free" } });
  add("timing: the lockup arrives with the spoken call to action", !!ctaPlan.brand && Math.abs(ctaPlan.brand.start - wordAt("start")) <= 6 && !!groupPlan.brand && groupPlan.brand.start > wordAt("start"), `"Start free with MotionBrief" at ${wordAt("start")}: lockup at ${ctaPlan.brand?.start} (with its own shot: ${groupPlan.brand?.start})`);
  // Every real video made so far must still render cleanly (regressions).
  const BAD = ["crowded", "no-hero", "lonely-icon", "stacked", "overlap-text", "empty-frame", "camera-swing", "busy-backdrop", "tiny-screens"];
  for (const v of REAL_SHOT_VIDEOS) {
    const W = v.words.split(" ").map((x) => x.split("@"));
    const vw = W.map(([text, st], i) => ({ text, start: +st, end: W[i + 1] ? +W[i + 1][1] : +st + 0.5 }));
    const narr = W.map(([x]) => x).join(" ");
    const vn: string[] = [];
    // (as in production: cues the voice says differently are matched first)
    const vs = repairCues(expandShots(ShotScript.parse(v.shots), vn, narr), narr, vw, v.duration).script;
    const vp = compileSceneScript(vs, { narration: narr, words: vw, durationSeconds: v.duration, brand: { name: "MotionBrief", logo: "logo", cta: "Try it free today" } });
    const block = sceneScriptBlockers(vs, narr, vw, v.duration);
    const broken = compositionCheck(vs, vp, { narration: narr, words: vw, durationSeconds: v.duration }).filter((x) => BAD.includes(x.rule));
    add(`real video ${v.name}: renders cleanly`, block.length + broken.length + validateFlowPlan(vp).length === 0, [...block, ...broken.map((x) => `${x.rule}: ${x.detail}`)].join("; ") || `${vs.beats.length} beats, no rule broken`);
    // The resolve pass enforces its rules on every real video, leaving nothing.
    const left = vp.resolved?.left ?? ["not resolved"];
    add(`real video ${v.name}: resolve pass leaves nothing`, left.length === 0, left.join("; ") || `${vp.resolved!.fixed.length} fix(es): ${vp.resolved!.fixed.slice(0, 3).join("; ") || "none needed"}`);
    // Variant search: the four videos offered for these shots are all clean
    // and look unlike each other (background, icons, hand-over, side).
    const found = searchVariants(ShotScript.parse(v.shots), { narration: narr, words: vw, durationSeconds: v.duration, brand: { name: "MotionBrief", logo: "logo" } }, seedFrom(v.name));
    const picks = found.picks;
    const key = (c: (typeof picks)[number]) => LOOK_FEATURES.map((f) => c.script.look?.[f]).join("/");
    const differ = picks.every((a, i) => picks.every((b, j) => i >= j || LOOK_FEATURES.filter((f) => a.script.look?.[f] !== b.script.look?.[f]).length >= 2));
    // The taste: when customers kept "waves" and outline icons, the first video follows.
    const liked = searchVariants(ShotScript.parse(v.shots), { narration: narr, words: vw, durationSeconds: v.duration, brand: { name: "MotionBrief", logo: "logo" } }, seedFrom(v.name), { taste: { decor: { waves: 9, dots: 1 }, icons: { outline: 9, tile: 1 } } });
    const top = liked.picks[0]?.script.look;
    const couldFollow = liked.picks.some((c) => c.script.look?.decor === "waves" || c.script.look?.icons === "outline");
    add(`real video ${v.name}: the first video follows the taste`, !couldFollow || top?.decor === "waves" || top?.icons === "outline", `first: ${top?.decor}/${top?.icons}`);
    add(`real video ${v.name}: four clean videos that look different`, picks.length === 4 && picks.every((c) => c.score === 0) && differ, `${picks.map((c) => `${key(c)} (score ${c.score})`).join(", ")} from ${found.tried.length} tried`);
  }
  const pops = (plan.sfx ?? []).filter((x) => x.kind === "soft_pop").length;
  add("shots: a group pops once per element", pops >= 3, `${pops} pops`);
  // Guards: a word as a "number", a second logo reveal and an unknown icon.
  const N = null;
  const base = { subject: N, label: N, line: N, line_cue: N, accent: N, mark: N, card: N, title: N, input: N, button: N, action_cue: N, result: N, result_cue: N, items: N };
  const guardNotes: string[] = [];
  const guarded = expandShots({ version: 3, theme: "lavender", shots: [
    { ...base, shot: "number", cue: "Your product stays the hero", subject: "text:HERO" },
    { ...base, shot: "reveal", cue: "With MotionBrief" },
    { ...base, shot: "reveal", cue: "MotionBrief" },
    { ...base, shot: "group", cue: "share it anywhere", items: [{ cue: N, asset: "icon:youtube-logo-x", label: "YouTube" }] },
  ] }, guardNotes);
  const assets = guarded.beats.flatMap((b) => (b.elements ?? []).map((e) => e.asset));
  const ok = !assets.includes("text:HERO") && assets.filter((a) => a === "logo").length === 1 && assets.includes("shape:pill");
  add("shots: guards (no word as a number, one logo reveal, unknown icons → labelled pill)", ok && guardNotes.length === 2, `${assets.join(", ")} · ${guardNotes.join("; ")}`);
  return checks;
}

// Phase 1: the customer's script is the narration, word for word.
function lockedScript(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const userScript = "Your team ships new features every week, but nobody sees them.\nMaking a launch video takes days — MotionBrief changes that.  Start free.";
  // As the form stores it: the script, then the style suffix.
  const direction = `${userScript}\n\nVisual style: Minimal\nLook: Light glass`;
  const scene = { duration_seconds: 3, purpose: "p", narration: "x", on_screen_text: [], visual: "ui", animation: "fade" };
  const generated = { product_name: "MotionBrief", product_summary: "s", supported_features: [], supported_claims: [], cta: "Go", scenes: [scene], script: "Your team releases features weekly, yet no one notices. MotionBrief fixes that." };
  const locked = lockBriefScript(generated, { direction, advanced_direction: "Minimal explainer, one idea at a time." });
  add("brief.script === user script (form suffix removed only)", locked.script === userScript, JSON.stringify(locked.script));
  const parsed = ProductBrief.safeParse(locked);
  add("the locked brief parses and keeps the script", parsed.success && parsed.data.script === userScript, parsed.success ? "stored brief.script is the user's script" : "brief failed to parse");
  // As a browser really submits it (line breaks as \r\n): the stored Finora project.
  const crlf = "Managing business finances shouldn’t mean dealing with scattered spreadsheets and numbers.\r\n\r\nFinora brings your financial data into one clear view.";
  const crlfLocked = lockedVoiceScript(`${crlf}\r\n\r\nVisual style: Bold\r\nLook: Dark glow`);
  add("browser line breaks (\\r\\n): the suffix is removed, the script kept", crlfLocked === crlf, JSON.stringify(crlfLocked.slice(-40)));
  add("no suffix: the whole script is kept", lockedVoiceScript(`  ${userScript}  `) === userScript, "trimmed ends only");
  const midText = "Pick a Visual style: bold or calm.";
  add("\"Visual style:\" inside the script is not cut", lockedVoiceScript(`${midText}\n\nVisual style: Bold`) === midText, JSON.stringify(lockedVoiceScript(`${midText}\n\nVisual style: Bold`)));
  const old = lockBriefScript(generated, { direction: "Make a video about our app", advanced_direction: null });
  add("older projects (no video direction) keep the brief's script", old.script === generated.script, JSON.stringify(old.script));
  // The voice speaks brief.script itself (generateVoice → generateFalVoice).
  const src = readFileSync("app/projects/actions.ts", "utf8");
  const voice = src.slice(src.indexOf("export async function generateVoice"), src.indexOf("export async function prepareAssets"));
  add("generateVoice sends brief.script to the voice unchanged", /const script = project\.brief_status === "completed" \? project\.brief\?\.script : lockedScriptOf\(project\) \|\| undefined;/.test(voice) && /generateFalVoice\(\{\s*script,/.test(voice), "script = brief.script (or, before the brief, the same locked script) → generateFalVoice({ script })");
  add("generateBrief stores the locked script", /let next = lockBriefScript\(brief, project\);/.test(src) && /brief: \{ \.\.\.next, \.\.\.kept \}/.test(src), "briefUpdate({ brief: { ...lockBriefScript(brief, project), ...kept } })");
  return checks;
}

// Phase 6: the simple customer form — script, logo, brand name, one style,
// voice, format. Everything else is decided from the script; the backend
// keeps its fields (defaults) so old and new projects run the same way.
function simpleForm(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const userScript = "Managing business finances shouldn’t mean scattered spreadsheets.\n\nFinora brings your financial data into one clear view.";
  const generated = { product_name: "Finora", product_summary: "s", supported_features: [], supported_claims: [], cta: "Go", scenes: [{ duration_seconds: 3, purpose: "p", narration: "x", on_screen_text: [], visual: "ui", animation: "fade" }], script: "Finora puts finance in one view." };
  const rows: string[] = [];
  let lockedAll = true;
  for (const preset of Object.keys(STYLE_PRESETS) as StylePreset[]) {
    const direction = directionFor(userScript, preset);
    // (as the browser may send it: \r\n line breaks; no video direction)
    for (const d of [direction, direction.replace(/\n/g, "\r\n")]) {
      const locked = lockBriefScript(generated, { direction: d, advanced_direction: "" });
      if (locked.script !== lockedVoiceScript(d) || lockedVoiceScript(d).replace(/\r/g, "") !== userScript) lockedAll = false;
    }
    // What the backend reads back (creativePreferences, direction library).
    const style = direction.match(/Visual style:\s*(.+)\s*$/m)?.[1];
    const look = direction.match(/^Look:\s*(.+)$/m)?.[1]?.trim() ?? "Auto";
    if (style !== STYLE_PRESETS[preset].visual_style || look !== STYLE_PRESETS[preset].look || !(VISUAL_STYLES as readonly string[]).includes(style) || !(LOOKS as readonly string[]).includes(look)) lockedAll = false;
    rows.push(`${preset}→${style}/${look}`);
  }
  add("every style locks the script, without a video direction (\\n and \\r\\n)", lockedAll, rows.join(" · "));
  const longest = Math.max(...(Object.keys(STYLE_PRESETS) as StylePreset[]).map((p) => directionFor("x".repeat(VOICE_SCRIPT_MAX), p).length));
  add("the longest script + style fits the stored direction", longest <= DIRECTION_MAX, `${longest} ≤ ${DIRECTION_MAX}`);
  const oldSuffix = lockBriefScript(generated, { direction: "Make a video about our app\n\nVisual style: Minimal", advanced_direction: null });
  add("older projects (no video direction, no lock line) keep the brief's script", oldSuffix.script === generated.script, JSON.stringify(oldSuffix.script));
  const form = readFileSync("app/projects/new/create-project-form.tsx", "utf8");
  const names = [...form.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]);
  const kept = ["direction", "visual_style", "format", "voice_style", "voice_language", "voice_gender", "logo", "brand_name"];
  const hidden = ["advanced_direction", "creative_direction", "motion_level", "visual_density", "screenshots", "call_to_action", "target_audience", "brand_color", "look"];
  add("the form sends script, logo, brand name, style, voice and format", kept.every((n) => names.includes(n)), kept.join(", "));
  add("internal decisions are not on the customer form", !hidden.some((n) => names.includes(n)), `not shown: ${hidden.join(", ")}`);
  const actions = readFileSync("app/projects/actions.ts", "utf8");
  const create = actions.slice(actions.indexOf("export async function createProject"), actions.indexOf("export async function", actions.indexOf("export async function createProject") + 10));
  add("the backend accepts a project without the removed fields (defaults kept)", !/VIDEO_DIRECTION_MIN/.test(create) && /creative_direction"\)\) \?\? CREATIVE_DEFAULTS\.creative_direction/.test(create) && /motion_level"\)\) \?\? CREATIVE_DEFAULTS\.motion_level/.test(create) && /visual_density"\)\) \?\? CREATIVE_DEFAULTS\.visual_density/.test(create) && /\.filter\(\(f\): f is File => f instanceof File && f\.size > 0\)/.test(create), "video direction optional; story, motion, density default; no screenshots is fine");
  add("the logo stays required", /const logoError = validateLogo\(logo\);/.test(create) && /name="logo"[\s\S]{0,80}required/.test(form), "validateLogo on the server, required on the form");
  return checks;
}

// Scene Recipe: every recipe field traced from the shot to the compiled plan
// (and through computeStates, which is what the renderer draws).
function sceneRecipeChecks(): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ frame: 0, name, ok, level: "error", detail });
  const { script, plan, notes, behaviors } = recipeFixture();
  const scenes = script.beats.filter((b) => b.action === "scene");
  const recipes = scenes.map((b) => b.recipe);
  add("recipe A: every recipe shot becomes a recipe scene", recipes.length === RECIPE_SHOTS.shots.length && recipes.every(Boolean), `${recipes.filter(Boolean).length} of ${RECIPE_SHOTS.shots.length} scenes carry their recipe`);
  add("recipe B: the compiled plan is valid and the resolve pass leaves nothing", validateFlowPlan(plan).length === 0 && (plan.resolved?.left.length ?? 0) === 0, `invalid: ${validateFlowPlan(plan).join("; ") || "none"} · left: ${plan.resolved?.left.join("; ") || "none"}`);
  // environment → the backdrops behind each scene (one shared by two scenes continues)
  const kinds = (plan.backdrops ?? []).map((b) => b.kind);
  add("recipe C: environment → the scene's backdrop (studio, product-space, data-space, cinematic)", kinds.join(",") === "spotlight,horizon,data-stream,light-beams" && (plan.backdrops ?? []).every((b) => b.strength === 0.9), kinds.join(" → "));
  // hero + supporting at their depth layers
  const node = (id: string) => plan.nodes.find((n) => n.id === id);
  const heroes = recipes.map((r) => node(r!.hero));
  // (an object that is a support here and the hero of a later scene ends on the hero layer)
  const heroIds = new Set(recipes.map((r) => r!.hero));
  const supports = recipes.flatMap((r) => Object.entries(r!.roles).filter(([id, v]) => v.role === "support" && !heroIds.has(id)).map(([id, v]) => ({ n: node(id), layer: v.layer })));
  add("recipe D: each hero is drawn on the hero layer, in front of its supporting objects", heroes.every((h) => h?.layer === 2 && (h.z ?? 0) >= 20), heroes.map((h) => `${h?.id}:${h?.el?.type}@L${h?.layer}`).join(" "));
  add("recipe E: supporting objects are drawn on their layers (background, midground, foreground)", supports.every((x) => x.n?.layer === x.layer) && new Set(supports.map((x) => x.layer)).size === 3, supports.map((x) => `${x.n?.id}@L${x.n?.layer}`).join(" "));
  // composition → where the hero stands
  // When each scene starts: its first new element appears.
  const sceneStart = (k: number) => Math.min(...(scenes[k].elements ?? []).filter((e) => e.asset !== null).map((e) => node(e.id)?.appear ?? Infinity));
  const heroX = (k: number) => vec(heroes[k]!.pos, sceneStart(k) + 40)[0];
  add("recipe F: composition places the hero (right, centred-wide, left, type-led right)", heroX(0) > 300 && heroX(3) < -300 && Math.abs(heroX(4)) < 100 && heroX(5) > 400, `hero x: ${[0, 3, 4, 5].map(heroX).join(", ")}`);
  // depth → parallax in what the renderer draws
  const f0 = scenes.length ? 30 : 0;
  const st0 = computeStates(plan, f0);
  const back = supports.find((x) => x.layer === 0)!.n!;
  const raw = (n: typeof back, f: number) => n.pos.reduce((p, [k, v]) => (k <= f ? v : p), n.pos[0][1]);
  const moved = Math.abs(st0.get(back.id)!.pos[0] - raw(back, f0)[0]) + Math.abs(st0.get(back.id)!.scale - 0);
  const heroSt = st0.get(heroes[0]!.id)!;
  add("recipe G: depth layers respond to the camera differently (parallax)", PARALLAX[0] < 1 && PARALLAX[3] > 1 && moved > 0 && Math.abs(heroSt.pos[0] - raw(heroes[0]!, f0)[0]) < 0.01, `background ${back.id} shifted ${(st0.get(back.id)!.pos[0] - raw(back, f0)[0]).toFixed(1)} px at frame ${f0}; hero unshifted`);
  // typography → placed, not a centred caption
  const t = plan.texts;
  add("recipe H: the words go where the recipe puts them (left side, top-left, right aligned, top)", t[0].style === "side" && t[0].pos[0] === -800 && t[1].pos[1] === -300 && t[2].align === "right" && t[2].pos[0] === 800 && t[3].style === "headline" && t[3].pos[1] === -390, t.map((x) => `"${x.text}" ${x.style} [${x.pos}]${x.align ? " right" : ""}`).join(" · "));
  // camera intent → the scene's camera move
  const zoomAt = (f: number) => num(plan.camera.zoom, f, 1);
  const s = scenes.map((_, k) => sceneStart(k));
  add("recipe I: camera intent moves the camera (push-in closes in, pull-back opens up)", zoomAt(s[1] - 10) > zoomAt(s[0] + 15) + 0.05 && zoomAt(s[3] + 15) > zoomAt(s[4] - 15) + 0.05, `push-in ${zoomAt(s[0] + 15).toFixed(2)} → ${zoomAt(s[1] - 10).toFixed(2)} · pull-back ${zoomAt(s[3] + 15).toFixed(2)} → ${zoomAt(s[4] - 15).toFixed(2)}`);
  // behaviors → executed (data flows, a merge, a reveal), none silently lost
  const flows = plan.links.filter((l) => (l.packets?.length ?? 0) >= 3);
  const coin = plan.nodes.find((n) => n.el?.type === "object" && n.el.object === "coin")!;
  const revealed = plan.nodes.find((n) => n.el?.type === "object" && n.el.object === "check")!;
  add("recipe J: behaviors run on their words (flow, merge, reveal) and every one is reported", behaviors.length === 7 && behaviors.every((b) => b.status === "applied") && flows.length === 2 && num(coin.opacity, plan.duration - 1, 1) < 0.05 && (revealed.appear ?? 0) > s[5] + 15 && !plan.skipped?.length, `${behaviors.map((b) => `${b.type}:${b.status}`).join(" ")} · ${flows.length} flows · coin merged · check revealed ${(((revealed.appear ?? 0) - s[5]) / 30).toFixed(1)} s into its scene`);
  // transitions → panel wipe, iris (flash), object carried, zoom-through, push
  const carried = scenes[3].elements?.some((e) => e.asset === null && e.id === recipes[3]!.hero);
  add("recipe K: transitions are the recipe's (panel-wipe, iris → flash, object-transform carries the bars, morph-intent → zoom-through, push)", plan.panels?.length === 1 && (plan.flashes ?? []).some(([a, , soft]) => !!soft && Math.abs(a - s[2]) < 20) && !!carried && scenes.map((b) => b.transition).join(",") === "cut,panel-wipe,dissolve,dissolve,push-left,zoom-through" && notes.some((n) => n.includes("iris")) && notes.some((n) => n.includes("morph-intent")), scenes.map((b) => b.transition).join(" → "));
  // the ui-plane hero is a plane in 3D
  const ui = heroes[2]!;
  add("recipe L: a ui-plane hero stays tilted in 3D", ui.el?.type === "card" && JSON.stringify(ui.tilt?.[ui.tilt.length - 1]?.[1]) === "[14,-20,2]", `tilt ${JSON.stringify(ui.tilt?.[ui.tilt.length - 1])}`);
  // fallbacks
  const legacy = recipeFixture(RECIPE_SHOTS_LEGACY);
  add("recipe M: shots without a recipe keep the template composition", legacy.script.beats.every((b) => !b.recipe) && legacy.script.beats.filter((b) => b.action === "scene").every((b) => b.layout?.startsWith("stage")) && validateFlowPlan(legacy.plan).length === 0, legacy.script.beats.filter((b) => b.action === "scene").map((b) => b.layout).join(", "));
  const stored = ShotScript.parse({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 0 ? { ...x, recipe: { scene_id: "x", environment: "moon" } } : x)) });
  add("recipe N: a stored recipe that no longer parses is dropped, never a failed project", stored.shots[0].recipe === null && stored.shots[1].recipe !== null, `shot 1 recipe: ${stored.shots[0].recipe}`);
  const odd = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 0 ? { ...x, recipe: { ...x.recipe!, hero: { ...x.recipe!.hero, asset: "icon:mail" } } } : i === 1 ? { ...x, recipe: { ...x.recipe!, behaviors: [{ type: "arrange", from: "hero", to: null, cue: "to build" }] } } : x)) });
  add("recipe O: an icon hero falls back to the template; an unsupported behavior is reported, not faked", odd.script.beats[0].layout !== "recipe" && odd.notes.some((n) => n.includes("not a drawable hero")) && odd.behaviors.some((b) => b.type === "recipe:arrange" && b.status === "dropped" && !!b.reason), `${odd.script.beats[0].layout} · ${odd.behaviors.filter((b) => b.status === "dropped").map((b) => `${b.type}: ${b.reason}`).join("; ")}`);
  return checks;
}

export function runChecks(): Section[] {
  const sections: Section[] = [
    { name: "stored ProductBrief compatibility", checks: briefCompatibility() },
    { name: "locked user script (phase 1)", checks: lockedScript() },
    { name: "simple customer form (phase 6)", checks: simpleForm() },
    { name: "VisualStory validation", checks: storyValidation() },
    { name: "legacy image generation gating", checks: legacyImageGating() },
    { name: "icon library", checks: iconLibrary() },
    { name: "lottie library", checks: lottieLibrary() },
    { name: "flow engine plans", checks: flowPlans() },
    { name: "flow director scripts", checks: flowDirector() },
    { name: "scene director (v2) scripts", checks: sceneDirector() },
    { name: "shot templates", checks: shotTemplates() },
    { name: "scene recipe", checks: sceneRecipeChecks() },
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
