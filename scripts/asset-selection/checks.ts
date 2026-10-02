// Director → asset requirement → asset selection: hero allowlist filtering,
// exact match, fallback, unresolved, recipe application, stored-recipe
// reload and the single-direction Director flow with requirements.
import { applyAssetSelection, defaultRegistry, LIBRARY_ASSETS, type Registry, selectAsset } from "@/lib/asset-selection";
import { generateShotScript } from "@/lib/ai/shot-director";
import { HERO_ALLOWLIST, HERO_IDS } from "@/lib/hero-assets";
import type { AssetRequirement, SceneRecipe } from "@/lib/scene-recipe";
import { parseAsset } from "@/lib/scene-script";
import { zodTextFormat } from "openai/helpers/zod";
import { expandShots, isFixableNote, ShotScript, ShotScriptModel } from "@/lib/shots";
import { RECIPE_DURATION, RECIPE_NARRATION, RECIPE_SHOTS } from "@/components/video/flow/fixtures/recipe";

type Check = { section: string; name: string; ok: boolean; detail: string };
const checks: Check[] = [];
let section = "";
const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });
// JSON with sorted keys (zod returns keys in schema order).
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

const req = (r: Partial<AssetRequirement> & Pick<AssetRequirement, "category" | "concept">): AssetRequirement => ({
  role: r.category === "hero" ? "primary" : r.category === "accent" ? "accent" : "secondary",
  visual_need: "test",
  preferred_asset_id: null,
  fallback_allowed: true,
  slot: null,
  ...r,
});
// A registry where one hero object passed review (92) and one is held back.
const withHeroes = (): Registry => {
  const base = defaultRegistry();
  return {
    assets: base.assets.map((a) => (a.id === "hero:padlock" ? { ...a, score: 92 } : a.id === "hero:ai-chip" ? { ...a, score: 86 } : a)),
    allowlist: ["hero:padlock"],
  };
};

function allowlist() {
  section = "hero allowlist filtering";
  add("current allowlist is empty (all six held back)", HERO_ALLOWLIST.length === 0, `allowlist: [${HERO_ALLOWLIST.join(", ")}]`);
  const all = HERO_IDS.map((id) => selectAsset(req({ category: "hero", concept: "document", preferred_asset_id: id })));
  add("no held-back hero object is selected, even when preferred", all.every((s) => s.status === "unresolved" && s.asset_id === null), all.map((s) => `${s.requirement.preferred_asset_id}: ${s.status}`).join("; "));
  const cats = (["hero", "supporting", "accent"] as const).flatMap((category) => HERO_IDS.map((id) => selectAsset(req({ category, concept: "chart", preferred_asset_id: id }))));
  add("held-back hero objects are never used as supporting or accent either", cats.every((s) => !s.asset_id?.startsWith("hero:")), cats.map((s) => s.asset_id ?? "-").join(", "));
  const lib = selectAsset(req({ category: "hero", concept: "money", preferred_asset_id: "object:coin" }));
  add("an approved library asset below 90 is never a hero", lib.status === "unresolved", `${lib.status}: ${lib.reason}`);
  const reg = withHeroes();
  const ok = selectAsset(req({ category: "hero", concept: "security-lock" }), reg);
  const held = selectAsset(req({ category: "hero", concept: "ai-chip", fallback_allowed: false }), reg);
  add("an allowlisted 90+ hero is selected", ok.status === "exact" && ok.asset_id === "hero:padlock", `${ok.status} ${ok.asset_id}`);
  add("a hero not on the allowlist is not", held.status === "unresolved", `${held.status} ${held.asset_id ?? "-"}: ${held.reason}`);
  const off = selectAsset(req({ category: "hero", concept: "security-lock" }), { ...reg, allowlist: [] });
  add("a 90+ hero taken off the allowlist is not selected", off.status === "unresolved", `${off.status}: ${off.reason}`);
}

function exact() {
  section = "exact asset match";
  const s = selectAsset(req({ category: "supporting", concept: "security-shield" }));
  add("concept → approved asset", s.status === "exact" && s.asset_id === "object:shield", `${s.status} ${s.asset_id}`);
  const p = selectAsset(req({ category: "supporting", concept: "money", preferred_asset_id: "object:coin" }));
  add("preferred approved asset wins", p.status === "exact" && p.asset_id === "object:coin" && p.reason === "preferred asset", `${p.status} ${p.asset_id} (${p.reason})`);
  const best = selectAsset(req({ category: "supporting", concept: "chart" }));
  add("the best-scoring match of the concept", best.status === "exact" && best.asset_id === "card:dashboard-mini/dark", `${best.status} ${best.asset_id}`);
  const accent = selectAsset(req({ category: "accent", concept: "speed" }));
  add("accent may use a 75+ accent asset", accent.status === "exact" && accent.asset_id === "object:bolt", `${accent.status} ${accent.asset_id}`);
  const bad = LIBRARY_ASSETS.filter((a) => !a.ref || !parseAsset(a.ref));
  add("every library asset is drawable by the scene renderer", !bad.length, bad.length ? bad.map((a) => a.id).join(", ") : `${LIBRARY_ASSETS.length} assets`);
}

function fallback() {
  section = "fallback";
  // object:lock is an accent (76): not good enough for a supporting role.
  const s = selectAsset(req({ category: "supporting", concept: "security-lock" }));
  add("no approved match → same family", s.status === "fallback" && s.asset_id === "object:shield", `${s.status} ${s.asset_id}: ${s.reason}`);
  const g = selectAsset(req({ category: "supporting", concept: "award" }));
  add("award → outcome family", g.status === "fallback" && ["object:target", "object:check"].includes(g.asset_id ?? ""), `${g.status} ${g.asset_id}`);
  const p = selectAsset(req({ category: "supporting", concept: "security-lock", preferred_asset_id: "object:gift" }));
  add("a rejected preferred asset is ignored, then fallback", p.status === "fallback" && p.asset_id === "object:shield" && p.reason.includes("object:gift is not approved"), `${p.status} ${p.asset_id}: ${p.reason}`);
  const h = selectAsset(req({ category: "hero", concept: "security-shield" }), withHeroes());
  add("a hero falls back only to another allowlisted hero", h.status === "fallback" && h.asset_id === "hero:padlock", `${h.status} ${h.asset_id}`);
}

function unresolved() {
  section = "unresolved asset";
  const a = selectAsset(req({ category: "supporting", concept: "security-lock", fallback_allowed: false }));
  add("no match and fallback not allowed", a.status === "unresolved" && a.asset_id === null, `${a.status}: ${a.reason}`);
  const b = selectAsset(req({ category: "supporting", concept: "other", visual_need: "a sailing boat" }));
  add("concept other never guesses", b.status === "unresolved", `${b.status}: ${b.reason}`);
  const c = selectAsset(req({ category: "hero", concept: "payment-card" }));
  add("hero with an empty allowlist", c.status === "unresolved" && c.reason.includes("allowlist is empty"), `${c.status}: ${c.reason}`);
  const d = selectAsset(req({ category: "supporting", concept: "speed" }));
  add("only a 76 accent exists: not forced into a supporting role", d.status === "unresolved", `${d.status}: ${d.reason}`);
}

const BASE = RECIPE_SHOTS.shots[0].recipe!;
const withAssets = (assets: AssetRequirement[]): SceneRecipe => ({ ...BASE, assets });
// A text-free kind asked for (an icon, a visual) never becomes a card: a
// compatible asset stands in, else the requirement stays unresolved.
function typeGuard() {
  section = "asset type compatibility";
  const isCard = (id: string | null) => !!id?.startsWith("card:");
  const bars = selectAsset(req({ category: "supporting", concept: "growth", preferred_asset_id: "visual:bars" }));
  add("visual:bars never falls back to a card", !isCard(bars.asset_id) && bars.status === "unresolved", `${bars.status} ${bars.asset_id ?? "-"}: ${bars.reason}`);
  const file = selectAsset(req({ category: "supporting", concept: "document" }), undefined, "icon:file-text");
  add("icon:file-text never falls back to a card", !isCard(file.asset_id) && file.status === "unresolved", `${file.status} ${file.asset_id ?? "-"}: ${file.reason}`);
  const own = { ...BASE, supporting: BASE.supporting.map((x) => (x.id === "sheet" ? { ...x, asset: "icon:file-text" } : x)), assets: [req({ category: "supporting", concept: "document", slot: "sheet" })] };
  const kept = applyAssetSelection(own);
  add("the slot's own icon decides (applied): icon:file-text kept", kept.recipe.supporting.find((x) => x.id === "sheet")?.asset === "icon:file-text" && kept.selections[0].status === "unresolved", `sheet → ${kept.recipe.supporting.find((x) => x.id === "sheet")?.asset} (${kept.selections[0].status})`);
  const mail = applyAssetSelection(withAssets([req({ category: "supporting", concept: "security-shield", slot: "mail" })]));
  add("icon:mail → object:shield is still a compatible replacement", mail.recipe.supporting.find((x) => x.id === "mail")?.asset === "object:shield" && mail.selections[0].status === "exact", `mail → ${mail.recipe.supporting.find((x) => x.id === "mail")?.asset} (${mail.selections[0].status})`);
  const stand = selectAsset(req({ category: "supporting", concept: "security-shield", preferred_asset_id: "icon:shield" }));
  add("preferred not approved, compatible concept asset → fallback (not exact)", stand.status === "fallback" && stand.asset_id === "object:shield" && stand.reason.includes("icon:shield is not approved"), `${stand.status} ${stand.asset_id}: ${stand.reason}`);
  const chart = selectAsset(req({ category: "supporting", concept: "chart" }), undefined, "icon:chart-line");
  const viz = selectAsset(req({ category: "supporting", concept: "dashboard", preferred_asset_id: "visual:bars" }));
  add("icon / visual with no compatible asset → unresolved", chart.status === "unresolved" && chart.asset_id === null && viz.status === "unresolved" && viz.asset_id === null, `icon:chart-line ${chart.status}; visual:bars ${viz.status}`);
}

function recipeApply() {
  section = "recipe application";
  const r = withAssets([req({ category: "hero", concept: "question", slot: "hero" }), req({ category: "supporting", concept: "security-shield", slot: "mail" }), req({ category: "supporting", concept: "other", slot: "sheet" })]);
  const { recipe, selections } = applyAssetSelection(r);
  add("unresolved hero keeps the Director's hero", recipe.hero.asset === BASE.hero.asset && selections[0].status === "unresolved", `${recipe.hero.asset} (${selections[0].status})`);
  add("resolved supporting replaces its slot's asset", recipe.supporting.find((s) => s.id === "mail")?.asset === "object:shield", `mail → ${recipe.supporting.find((s) => s.id === "mail")?.asset}`);
  add("unresolved supporting keeps its asset", recipe.supporting.find((s) => s.id === "sheet")?.asset === BASE.supporting.find((s) => s.id === "sheet")?.asset, `sheet → ${recipe.supporting.find((s) => s.id === "sheet")?.asset}`);
  const sup = applyAssetSelection(withAssets([req({ category: "supporting", concept: "money", slot: "hero" })])).recipe;
  add("a supporting requirement never replaces the hero", sup.hero.asset === BASE.hero.asset, sup.hero.asset);
  add("the input recipe is not mutated", BASE.supporting.find((s) => s.id === "mail")?.asset === "icon:mail", "icon:mail");
  const none = applyAssetSelection(BASE);
  add("no requirements → recipe unchanged", none.recipe === BASE && !none.selections.length, "same object");
  // Through the expansion: the selected asset is what the scene draws.
  const shots = { ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((s, i) => (i === 0 ? { ...s, recipe: r } : s)) };
  const picked: Parameters<typeof expandShots>[5] = [];
  const notes: string[] = [];
  const scene = expandShots(shots, notes, RECIPE_NARRATION, undefined, undefined, picked);
  const drawn = scene.beats.flatMap((b) => b.elements ?? []).map((e) => e.asset);
  add("expansion draws the selected asset", drawn.includes("object:shield") && !drawn.includes("icon:mail"), drawn.filter(Boolean).slice(0, 6).join(", "));
  add("expansion reports every requirement", picked.length === 3 && picked.every((p) => p.shot === 0), picked.map((p) => `${p.requirement.slot}:${p.status}`).join(", "));
  add("selection adds no notes (no revision)", !notes.some((n) => /asset|unresolved|allowlist/.test(n)), `${notes.length} notes`);
}

function storage() {
  section = "recipe save / reload";
  const old = JSON.parse(JSON.stringify(RECIPE_SHOTS));
  for (const s of old.shots) if (s.recipe) delete s.recipe.assets; // saved before requirements
  const back = ShotScript.parse(old);
  add("a recipe saved before requirements reloads (assets null)", back.shots.every((s, i) => !!s.recipe === !!RECIPE_SHOTS.shots[i].recipe && (s.recipe?.assets ?? null) === null), `${back.shots.filter((s) => s.recipe).length} recipes kept`);
  const reqs = [req({ category: "supporting", concept: "money", slot: "coin", preferred_asset_id: "object:coin" })];
  const saved = JSON.parse(JSON.stringify({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((s, i) => (i === 3 ? { ...s, recipe: { ...s.recipe!, assets: reqs } } : s)) }));
  const again = ShotScript.parse(saved);
  add("requirements survive save / reload", canon(again.shots[3].recipe?.assets) === canon(reqs), JSON.stringify(again.shots[3].recipe?.assets?.[0]));
  const broken = JSON.parse(JSON.stringify(saved));
  broken.shots[3].recipe.assets = [{ category: "nonsense" }];
  const kept = ShotScript.parse(broken);
  add("an unreadable requirement list drops only the list", !!kept.shots[3].recipe && kept.shots[3].recipe.assets === null, `recipe kept: ${!!kept.shots[3].recipe}`);
}

// The real Director (single direction, the primary path) with a stand-in client.
const toModel = (x: ShotScript["shots"][number]) => ({
  shot: x.shot, cue: x.cue, subject: x.subject, label: x.label,
  text: x.line ? { line: x.line, line_cue: x.line_cue, accent: x.accent, mark: x.mark } : null,
  ui: x.card ? { card: x.card, title: x.title, input: x.input, button: x.button, action_cue: x.action_cue, result: x.result, result_cue: x.result_cue } : null,
  items: x.items, camera: x.camera, objects: x.objects, recipe: x.recipe ?? null,
});
const DNA = { composition: "object-story", cards: "accent", icons: "outline", typography: "editorial", transitions: "object", motion: "transform", camera: "push", background: "environment" } as const;
const DIRECTION = { concept: "scattered data becomes one view", hero: "the live dashboard", metaphor: "pieces sorted", story: "problem → product → proof", shot_approach: "objects then ui", assets: "3D objects and one card", opening: "a question", ending: "one clear goal", motion: "pieces flow in", camera: "slow pushes" };
async function single(shots: ShotScript) {
  const calls: { single: boolean }[] = [];
  const client = {
    responses: {
      parse: async (params: { instructions?: string | null }) => {
        calls.push({ single: !!params.instructions?.includes("ONE variant only") });
        return { id: `r${calls.length}`, usage: { input_tokens: 1, output_tokens: 1 }, output_parsed: { theme: shots.theme, creative: { message: "m", audience: "a", tone: "t", pace: "calm" }, variants: [{ id: "A", dna: DNA, direction: DIRECTION, shots: shots.shots.map(toModel) }] } };
      },
    },
  } as unknown as Parameters<typeof generateShotScript>[3];
  const r = await generateShotScript({ narration: RECIPE_NARRATION, words: null, duration_seconds: RECIPE_DURATION, product_name: "Flowly", seed: 777 }, undefined, 150_000, client);
  return { ...r, calls };
}
async function directorFlow() {
  section = "single-direction flow compatibility";
  // The Director's structured output schema (strict JSON schema) carries the requirements.
  let schema = "";
  try {
    schema = JSON.stringify(zodTextFormat(ShotScriptModel, "shot_script"));
  } catch (e) {
    schema = `error: ${e instanceof Error ? e.message : e}`;
  }
  add("Director output schema has asset requirements", schema.includes("preferred_asset_id") && schema.includes("fallback_allowed") && !schema.startsWith("error"), schema.startsWith("error") ? schema : `${Math.round(schema.length / 1024)} KB schema`);
  const plain = await single(RECIPE_SHOTS);
  // (The fixture keeps one real note, so one review round follows, as in check:story single B.)
  add("without requirements: one direction, at most one revision, one video", plain.calls.length <= 2 && plain.calls.every((c) => c.single) && !!plain.script && plain.variants.length === 1 && plain.diagnostics?.mode === "single" && plain.diagnostics.status === "ok", `calls ${plain.calls.length}, mode ${plain.diagnostics?.mode}, status ${plain.diagnostics?.status}, videos ${plain.variants.length}`);
  add("without requirements: no asset diagnostics", (plain.diagnostics?.assets ?? []).length === 0, `${plain.diagnostics?.assets?.length ?? 0}`);
  const reqs: Record<number, AssetRequirement[]> = {
    0: [req({ category: "hero", concept: "question", slot: "hero", preferred_asset_id: "hero:document-stack" }), req({ category: "supporting", concept: "security-lock", slot: "mail" })],
    3: [req({ category: "supporting", concept: "money", slot: "coin", preferred_asset_id: "object:coin" })],
    5: [req({ category: "supporting", concept: "other", slot: "ok", visual_need: "a sailing boat" })],
  };
  const withReqs = ShotScript.parse({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((s, i) => (reqs[i] ? { ...s, recipe: { ...s.recipe!, assets: reqs[i] } } : s)) });
  const r = await single(withReqs);
  const a = r.diagnostics?.assets ?? [];
  const fixable = (x: { errors: string[] }) => canon(x.errors.filter(isFixableNote).sort());
  add("with requirements: same calls and review notes as without (unresolved never revises)", r.calls.length === plain.calls.length && r.calls.every((c) => c.single) && fixable(r) === fixable(plain) && !!r.script && r.variants.length === 1 && r.diagnostics?.status === "ok", `calls ${r.calls.length} vs ${plain.calls.length}, status ${r.diagnostics?.status}`);
  add("diagnostics report each requirement", a.length === 4, a.map((x) => `s${x.shot} ${x.slot}: ${x.status} ${x.asset_id ?? "-"}`).join("; "));
  add("held-back hero stays unresolved; Director's hero kept", a[0]?.status === "unresolved" && r.shots?.shots[0].recipe?.hero.asset === "object:question", `${a[0]?.status}; hero ${r.shots?.shots[0].recipe?.hero.asset}`);
  add("exact and fallback resolved", a.some((x) => x.status === "exact" && x.asset_id === "object:coin") && a.some((x) => x.status === "fallback" && x.asset_id === "object:shield"), a.map((x) => x.status).join(", "));
  add("stored shots keep the requirements", canon(r.shots?.shots[3].recipe?.assets) === canon(reqs[3]), "shot 4");
}

export async function runChecks(): Promise<Check[]> {
  allowlist();
  exact();
  fallback();
  unresolved();
  recipeApply();
  typeGuard();
  storage();
  await directorFlow();
  return checks;
}
