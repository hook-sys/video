// Scene Recipe execution: assemble / transform / arrange run on screen,
// the scene boundary transition contract, and the palette precedence.
import { RECIPE_DURATION, RECIPE_NARRATION as RECIPE_NARRATION_, recipeFixture, RECIPE_SHOTS, RECIPE_SHOTS_LEGACY } from "@/components/video/flow/fixtures/recipe";
import { THEMES, withBrandColor } from "@/components/video/flow/themes";
import { plannedSfx } from "@/components/video/flow/flow-scene";
import type { FlowNode, Track, Vec } from "@/components/video/flow/types";
import { resolveTheme } from "@/lib/projects";
import { BACKDROP_ROLE, BACKDROPS, backdropStrength, ENV_APPROVED_BACKDROPS, REJECTED_BACKDROPS, renderableBackdrop } from "@/components/video/flow/backdrop-names";
import { compileSceneScript, DECOR_ACCENT } from "@/components/video/flow/compile-scene";
import { num, ramp, vec as vecOf } from "@/components/video/flow/eval";
const ramp24 = (f: number, start: number) => ramp(f, start, 24, "inOut");
import { boundaryTransition, ENV_BACKDROP, ENV_WORLD, ENVIRONMENTS, type SceneRecipe } from "@/lib/scene-recipe";
import { SceneScript } from "@/lib/scene-script";
import { createHash } from "node:crypto";
import { BG_DIRECTIONS, BG_TRANSITIONS, type BgChoreo, CAMERA_RETURN, cameraOffsets, type Choreography, choreoTimeline, MAX_TOTAL, normalizeBackground, normalizeCamera, normalizeChoreography, normalizeOffset, resolveRelationships, normalizeSfx, PHASE_BOUNDS, sfxFrame } from "@/lib/choreography";

import { zodTextFormat } from "openai/helpers/zod";
import { bgLength, type WorldEntry, worldContext, worldLayer } from "@/components/video/flow/world-transition";
import { StoredSceneRecipe } from "@/lib/scene-recipe";
import { fitRelationshipBudget, sceneChains } from "@/lib/relationship-budget";
import { budgetDirections, INSTRUCTIONS } from "@/lib/ai/shot-director";
import { estimateWords } from "@/lib/flow-script";
import { type Dna, dnaMove, isFixableNote, type ShotScript, ShotScript as ShotScriptSchema, ShotScriptModel } from "@/lib/shots";

type Check = { section: string; name: string; ok: boolean; detail: string };
const checks: Check[] = [];
let section = "";
const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });

// The fixture with one shot's recipe changed.
const withRecipe = (i: number, f: (r: SceneRecipe) => SceneRecipe): ShotScript => ({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((s, k) => (k === i ? { ...s, recipe: f(s.recipe!) } : s)) });
const node = (nodes: FlowNode[], id: string) => nodes.find((n) => n.id === id);
const last = <T,>(tr: Track<T> | undefined) => tr?.[tr.length - 1]?.[1];
const near = (a: Vec, b: Vec, d = 6) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= d;

function assemble() {
  section = "1. assemble executes";
  // s1: two scattered sources feed the question; they assemble into it.
  const shots = withRecipe(0, (r) => ({
    ...r,
    supporting: [...r.supporting, { id: "chart", asset: "icon:chart-line", role: "another source", layer: "midground", relation: "feeds-hero", persistence: "scene" }],
    behaviors: [{ type: "assemble", from: "sheet", to: "hero", cue: "ten different tools" }],
  }));
  const { script, plan, behaviors } = recipeFixture(shots);
  const beat = script.beats.find((b) => b.action === "merge" && b.style === "assemble");
  add("an assemble beat with every piece of the group", !!beat && beat.targets?.length === 2, `targets ${beat?.targets?.join(", ")} → ${beat?.to}`);
  const rep = behaviors.find((b) => b.type === "recipe:assemble");
  add("reported applied with what it did", rep?.status === "applied" && !!rep.reason?.startsWith("assembled: 2 pieces"), `${rep?.status}: ${rep?.reason}`);
  const target = node(plan.nodes, beat?.to ?? "");
  const pieces = (beat?.targets ?? []).map((id) => node(plan.nodes, id));
  const docked = pieces.every((p) => {
    const keys = (p?.pos ?? []).map(([, v]) => v);
    const end = keys[keys.length - 1];
    // a stop beside the target (not on it), then into it
    return !!target && !!end && keys.some((v) => !near(v, end, 40) && Math.hypot(v[0] - end[0], v[1] - end[1]) < 600) && last(p?.opacity) === 0;
  });
  add("pieces dock around the target, then fuse into it (gone)", docked, pieces.map((p) => `${p?.id}: ${(p?.pos ?? []).length} keys, opacity → ${last(p?.opacity)}`).join("; "));
  const grows = (target?.scale ?? []).some(([, v]) => v > (target?.scale?.[0]?.[1] ?? 1) * 1.1);
  add("the target grows as they fuse", grows, `scale keys ${(target?.scale ?? []).map(([, v]) => v.toFixed(2)).join(" ")}`);
}

function transform() {
  section = "2. transform executes";
  // s4: the sale (coin) becomes the revenue bars.
  const shots = withRecipe(3, (r) => ({ ...r, behaviors: [{ type: "transform", from: "coin", to: "hero", cue: "a sale happens" }] }));
  const { script, plan, behaviors } = recipeFixture(shots);
  const beat = script.beats.find((b) => b.action === "merge" && b.style === "transform");
  add("a transform beat (source → target)", !!beat && beat.targets?.length === 1, `${beat?.targets?.[0]} → ${beat?.to}`);
  const rep = behaviors.find((b) => b.type === "recipe:transform");
  add("reported applied with what it did", rep?.status === "applied" && !!rep.reason?.startsWith("transformed:"), `${rep?.status}: ${rep?.reason}`);
  const src = node(plan.nodes, beat?.targets?.[0] ?? "");
  const dst = node(plan.nodes, beat?.to ?? "");
  const srcTurns = (src?.tilt ?? []).some(([, v]) => v[1] === 90) && last(src?.opacity) === 0;
  // (where the target stands when the source arrives; it leaves with its scene later)
  const arrive = src?.pos?.[src.pos.length - 1];
  const there = dst && arrive ? [...dst.pos].reverse().find(([f]) => f <= arrive[0])?.[1] : undefined;
  add("the source travels to the target and turns edge-on (gone)", srcTurns && !!there && near(arrive![1], there, 2), `src → [${arrive?.[1].join(", ")}] at ${arrive?.[0]}, target at [${there?.join(", ")}] · tilt ${(src?.tilt ?? []).map(([f, v]) => `${f}:${v[1]}`).join(" ")}`);
  const dt = dst?.tilt ?? [];
  const k = dt.findIndex(([, v]) => v[1] === -90);
  const turnsIn = k > 0 && dt[k + 1]?.[1][1] === dt[k - 1]?.[1][1] && dt.every(([f], i) => i === 0 || f >= dt[i - 1][0]);
  const turnAt = dt[k]?.[0] ?? 0;
  const op = dst?.opacity ?? [];
  const hidden = op.some(([f, v]) => v === 0 && f < turnAt && f > 0) && op.some(([f, v]) => v === 1 && f > turnAt);
  add("the target turns in from the edge in its place (and stays)", turnsIn && hidden, `dst tilt ${dt.map(([f, v]) => `${f}:${v[1]}`).join(" ")} · opacity ${(dst?.opacity ?? []).map(([f, v]) => `${f}:${v.toFixed(1)}`).join(" ")}`);
}

function arrange() {
  section = "3. arrange is not silently dropped";
  const shots = withRecipe(0, (r) => ({ ...r, behaviors: [{ type: "arrange", from: "hero", to: null, cue: "ten different tools" }] }));
  const { script, plan, behaviors } = recipeFixture(shots);
  const beat = script.beats.find((b) => b.action === "arrange");
  const rep = behaviors.find((b) => b.type === "recipe:arrange");
  add("an arrange beat, reported applied", !!beat && beat.style === "recipe" && rep?.status === "applied", `${rep?.status}: ${rep?.reason}`);
  const scene = script.beats.find((b) => b.action === "scene" && b.recipe);
  const roles = scene?.recipe?.roles ?? {};
  const sup = Object.keys(roles).filter((id) => roles[id].role === "support").map((id) => node(plan.nodes, id)!).filter(Boolean);
  const ends = sup.map((n) => last(n.pos)!);
  const row = ends.every((e) => Math.abs(e[1] - ends[0][1]) < 1) || ends.every((e) => Math.abs(e[0] - ends[0][0]) < 1);
  add("the supporting objects line up (one row or column)", sup.length === 2 && row, ends.map((e) => `[${e.map(Math.round).join(", ")}]`).join(" "));
  const hero = node(plan.nodes, scene?.recipe?.hero ?? "");
  add("the hero does not move", !!hero && new Set((hero.pos ?? []).map(([, v]) => v.map(Math.round).join(","))).size === 1, `${(hero?.pos ?? []).length} position keys`);
  const lone = withRecipe(3, (r) => ({ ...r, behaviors: [{ type: "arrange", from: "hero", to: null, cue: "a sale happens" }] }));
  const one = recipeFixture(lone).behaviors.find((b) => b.type === "recipe:arrange");
  add("with one supporting object: dropped with the reason (reported)", one?.status === "dropped" && !!one.reason?.includes("needs 2+"), `${one?.status}: ${one?.reason}`);
}

function transitions() {
  section = "4. recipe → recipe transition_out";
  const sceneTr = (s: ShotScript) => recipeFixture(s).script.beats.filter((b) => b.action === "scene").map((b) => b.transition);
  const base = sceneTr(RECIPE_SHOTS);
  // s1 → s2: s2 asks panel-wipe; s1 now leaves with push.
  const out = sceneTr(withRecipe(0, (r) => ({ ...r, transition_out: "push" })));
  add("the outgoing scene's transition_out is used", base[1] === "panel-wipe" && (out[1] === "push-left" || out[1] === "push-up"), `s2 arrives: ${base[1]} → ${out[1]}`);
  add("other boundaries unchanged", out.filter((_, i) => i !== 1).join() === base.filter((_, i) => i !== 1).join(), out.join(", "));
  // s3 → s4: s4 carries the persistent bars (object-transform); s3's out does not break it.
  const carry = sceneTr(withRecipe(2, (r) => ({ ...r, transition_out: "panel-wipe" })));
  add("a carry (object-transform of the persistent hero) wins over transition_out", carry[3] === base[3] && carry[3] !== "panel-wipe", `s4 arrives: ${carry[3]}`);

  section = "5. transition precedence";
  const T = boundaryTransition;
  const rows: [string, ReturnType<typeof T>, string, string][] = [
    ["first scene", T({ first: true, out: "push", into: "iris", canCarry: true }), "cut", "first"],
    ["carry beats out", T({ first: false, out: "push", into: "object-transform", canCarry: true }), "object-transform", "carry"],
    ["object-transform with nothing to carry → out", T({ first: false, out: "push", into: "object-transform", canCarry: false }), "push", "out"],
    ["out beats in", T({ first: false, out: "panel-wipe", into: "iris", canCarry: true }), "panel-wipe", "out"],
    ["no out → in", T({ first: false, out: null, into: "iris", canCarry: true }), "iris", "in"],
    ["neither → template default", T({ first: false, out: null, into: null, canCarry: false }), "null", "default"],
  ];
  for (const [name, r, tr, src] of rows) add(name, String(r.transition) === tr && r.source === src, `${r.transition} (${r.source})`);
  const again = rows.every(([, r], i) => JSON.stringify(r) === JSON.stringify(rows[i][1]));
  add("deterministic (same input, same answer)", again && JSON.stringify(sceneTr(RECIPE_SHOTS)) === JSON.stringify(base), base.join(", "));
}

function palette() {
  section = "6. Director palette + project palette precedence";
  const names = ["lavender", "midnight", "mint", "teal"] as const;
  const looks = ["Auto", "Light glass", "Dark glow", "Warm brand"] as const;
  const table = names.flatMap((d) => looks.map((l) => ({ d, l, ...resolveTheme(d, l) })));
  add("the look's light/dark always holds", table.every((x) => (x.l === "Dark glow" ? THEMES[x.theme].dark : x.l === "Light glass" ? !THEMES[x.theme].dark : true)), table.filter((x) => x.l !== "Auto" && x.l !== "Warm brand").map((x) => `${x.d}+${x.l}→${x.theme}`).join(", "));
  add("the Director's theme is kept whenever it fits the look", table.every((x) => (x.source === "director") === (x.theme === x.d)) && table.filter((x) => x.source === "director").length === 12 && resolveTheme("mint", "Light glass").theme === "mint" && resolveTheme("teal", "Warm brand").theme === "teal", `${table.filter((x) => x.source === "director").length}/16 keep the Director's`);
  const brand = "#E4572E";
  const t = THEMES.mint;
  const b = withBrandColor(t, brand);
  const d = (x: string, y: string) => Math.hypot(...[1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16)));
  add("brand colour is the primary (identity kept)", b.primary.toLowerCase() === brand.toLowerCase(), `${t.primary} → ${b.primary}`);
  add("the Director's second colour survives (closer to the theme's than the brand's)", d(b.accent, t.accent) < d(b.accent, brand), `accent ${t.accent} → ${b.accent} (brand ${brand})`);
  add("ground and ink stay the Director's", b.bg === t.bg && b.ink === t.ink && b.dark === t.dark, `bg ${b.bg} ink ${b.ink}`);
  add("no brand colour: the theme as it is", withBrandColor(t, null) === t, "same object");
}

const DNA: Dna = { composition: "object-story", cards: "accent", icons: "outline", typography: "editorial", transitions: "push", motion: "transform", camera: "push", background: "open" };
function dnaMappings() {
  section = "7. DNA mappings (shots without a recipe)";
  const run = (d: Partial<Dna>, shots: ShotScript = RECIPE_SHOTS_LEGACY) => recipeFixture({ ...shots, dna: { ...DNA, ...d } });
  const scenes = (r: ReturnType<typeof run>) => r.script.beats.filter((b) => b.action === "scene");
  const grid = run({ background: "grid" });
  add("DNA grid → perspective-grid backdrop (not ribbons)", scenes(grid).every((b) => b.backdrop === "perspective-grid") && (grid.plan.backdrops ?? []).every((x) => x.kind === "perspective-grid") && (grid.plan.backdrops ?? []).length > 0 && grid.script.look?.decor !== "ribbons", `scene backdrops ${scenes(grid).map((b) => b.backdrop).join(", ")} · plan ${(grid.plan.backdrops ?? []).map((x) => x.kind).join(", ")} · decor ${grid.script.look?.decor}`);
  const open = run({ background: "open" });
  add("other backgrounds keep the plain canvas", scenes(open)[0].backdrop === "mesh" && scenes(open).slice(1).every((b) => b.backdrop === null), scenes(open).map((b) => b.backdrop).join(", "));
  // Mixed: recipe scenes first, then shots without one — those show the DNA grid.
  // (shot 2 follows a studio scene, so the grid is a change of world there)
  const mixed = run({ background: "grid" }, { ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 1 ? { ...x, recipe: null } : x)) });
  const kinds = (mixed.plan.backdrops ?? []).map((x) => `${x.kind}${x.source === "recipe" ? "" : "*"}`);
  add("after recipe scenes a DNA-grid shot keeps the grid (* = non-recipe)", kinds.includes("perspective-grid*"), kinds.join(", "));
  const panel = run({ transitions: "panel" });
  const handovers = scenes(panel).slice(1).map((b) => b.transition);
  add("DNA panel → panel-wipe handovers (never push-up)", handovers.includes("panel-wipe") && !handovers.includes("push-up") && handovers.every((x) => x === "panel-wipe" || x === "dissolve"), handovers.join(", "));
  add("the panel wipe is drawn (a panel in the plan)", (panel.plan.panels ?? []).length > 0, `${(panel.plan.panels ?? []).length} panel wipes`);
  const orbit = run({ camera: "orbit" });
  const cams = scenes(orbit).map((b) => b.camera);
  add("DNA orbit → the orbit camera on moving shots (holds, openings, reveals stay)", cams.includes("orbit") && !cams.includes("pull-back") && dnaMove({ ...DNA, camera: "orbit" }, "hold") === "hold" && dnaMove({ ...DNA, camera: "orbit" }, "pull_back") === "orbit" && dnaMove({ ...DNA, camera: "orbit" }, "establish") === "drift", cams.join(", "));
  const turned = orbit.plan.nodes.filter((n) => (n.tilt ?? []).some(([, v]) => Math.abs(v[1]) === 14));
  add("the orbit turns the shot's subject in 3D (recipe orbit-intent camera)", turned.length >= 1, `${turned.length} subjects turn ±14°`);
  add("without DNA orbit nothing changes", dnaMove({ ...DNA, camera: "push" }, "pull_back") === "pull-back" && dnaMove(null, "follow") === "pan-right", "push / none → the intent's own move");

  section = "8. recipe camera / transition unchanged";
  const all = { background: "grid", transitions: "panel", camera: "orbit" } as const;
  const base = recipeFixture(RECIPE_SHOTS);
  const withDna = run(all, RECIPE_SHOTS);
  const key = (r: typeof base) => r.script.beats.filter((b) => b.action === "scene" && b.recipe).map((b) => `${b.transition}|${b.camera}|${b.backdrop}|${b.recipe?.camera.intent}`).join(" · ");
  add("recipe scenes keep their transition, camera and environment under any DNA", key(base) === key(withDna) && key(base).length > 0, key(withDna));
  const camKeys = (r: typeof base) => JSON.stringify(r.plan.camera);
  add("the recipe camera path is identical", camKeys(base) === camKeys(withDna), `${base.plan.camera.center.length} camera keys`);
}

function environments() {
  section = "9. environment → approved backdrop";
  add("studio no longer selects the rejected spotlight", (ENV_BACKDROP.studio as string) !== "spotlight" && ENV_BACKDROP.studio === "mesh", `studio → ${ENV_BACKDROP.studio}`);
  add("data-space no longer selects the rejected data-stream", (ENV_BACKDROP["data-space"] as string) !== "data-stream" && ENV_BACKDROP["data-space"] === "perspective-grid", `data-space → ${ENV_BACKDROP["data-space"]}`);
  add("every environment resolves to an approved backdrop", ENVIRONMENTS.every((e) => (ENV_APPROVED_BACKDROPS as readonly string[]).includes(ENV_BACKDROP[e]) && !(ENV_BACKDROP[e] in REJECTED_BACKDROPS)), ENVIRONMENTS.map((e) => `${e} → ${ENV_BACKDROP[e]}`).join(", "));
  add("approved backdrops exist in the renderer", ENV_APPROVED_BACKDROPS.every((k) => (BACKDROPS as readonly string[]).includes(k)), ENV_APPROVED_BACKDROPS.join(", "));
  // A rejected backdrop named anywhere (Scene Director, older scripts) never reaches the plan.
  const { script } = recipeFixture(RECIPE_SHOTS_LEGACY);
  const named = (k: string) => {
    const s = SceneScript.parse({ ...script, pace: "lively", beats: script.beats.map((b, i) => (b.action === "scene" ? { ...b, backdrop: i === 0 ? k : null } : b)) });
    return (compileSceneScript(s, { narration: RECIPE_NARRATION_, durationSeconds: 26 }).backdrops ?? []).map((x) => x.kind);
  };
  const leaks = Object.keys(REJECTED_BACKDROPS).map((k) => [k, named(k)] as const);
  add("a rejected backdrop is drawn as its approved replacement", leaks.every(([k, kinds]) => !kinds.includes(k) && kinds.includes(renderableBackdrop(k)) || (renderableBackdrop(k) === "mesh" && !kinds.length)), leaks.map(([k, v]) => `${k} → ${v.join("/") || "mesh"}`).join(", "));

  section = "10. recipe world precedence";
  const base = recipeFixture(RECIPE_SHOTS);
  const envs = (r: typeof base) => r.script.beats.filter((b) => b.action === "scene" && b.recipe).map((b) => b.backdrop).join(",");
  const stack = (r: typeof base) => (r.plan.backdrops ?? []).map((x) => `${x.slot}:${x.kind}@${x.start}${x.end ? `–${x.end}` : ""}(${x.source})`).join(" ");
  const withDna = recipeFixture({ ...RECIPE_SHOTS, dna: { ...DNA, background: "grid" } });
  const withBold = recipeFixture({ ...RECIPE_SHOTS, dna: { ...DNA, background: "bold-field" } });
  add("recipe backdrops are not overridden by a DNA background", envs(base) === envs(withDna) && stack(base) === stack(withDna) && stack(base) === stack(withBold), stack(withDna));
  add("plan backdrop stack: approved kinds only", (base.plan.backdrops ?? []).every((x) => (ENV_APPROVED_BACKDROPS as readonly string[]).includes(x.kind)), stack(base));
  // One world: under a recipe environment the canvas decor is an accent only.
  const lvl = (r: typeof base, f: number) => num(r.plan.decorLevel, f, 1);
  const firstRecipe = base.script.beats.length ? 5 : 0; // the first scene starts at frame 5
  add("recipe scenes turn the decor down to an accent", Math.abs(lvl(base, firstRecipe + 30) - DECOR_ACCENT) < 1e-6, `decor level ${lvl(base, firstRecipe + 30)} (accent ${DECOR_ACCENT})`);
  const glow = recipeFixture({ ...RECIPE_SHOTS, dna: { ...DNA, background: "bold-field" } });
  add("the glow decor (an atmosphere itself) goes entirely", glow.script.look?.decor === "glow" && lvl(glow, firstRecipe + 30) === 0, `decor ${glow.script.look?.decor}: level ${lvl(glow, firstRecipe + 30)}`);
  const mixed = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 4 ? { ...x, recipe: null } : x)) });
  const sc = mixed.script.beats.map((b, i) => [b, i] as const).filter(([b]) => b.action === "scene");
  // (the shot without a recipe starts where the recipe world's open layer ends)
  const plainAt = (mixed.plan.backdrops ?? []).find((x) => x.source === "recipe" && x.end !== undefined)?.end;
  add("a shot without a recipe brings the full decor back", plainAt !== undefined && lvl(mixed, plainAt + 30) === 1, `non-recipe scene at ${plainAt}: level ${plainAt !== undefined ? lvl(mixed, plainAt + 30) : "-"} (${sc.length} scenes)`);

  section = "11. legacy DNA shots unchanged";
  const legacy = recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA, background: "environment" } });
  add("no recipe: no decor change, no recipe backdrop", legacy.plan.decorLevel === undefined && !(legacy.plan.backdrops ?? []).some((x) => x.source === "recipe"), `decorLevel ${legacy.plan.decorLevel ? "set" : "none"} · backdrops ${(legacy.plan.backdrops ?? []).map((x) => x.kind).join(", ") || "mesh"} · decor ${legacy.script.look?.decor}`);
  const g = recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA, background: "grid" } });
  add("DNA grid shots keep their perspective-grid", (g.plan.backdrops ?? []).map((x) => x.kind).join() === "perspective-grid" && g.plan.decorLevel === undefined, (g.plan.backdrops ?? []).map((x) => x.kind).join());
}

function worldStack() {
  section = "12. world stack";
  const base = recipeFixture(RECIPE_SHOTS);
  const bd = base.plan.backdrops ?? [];
  const show = bd.map((x) => `${x.slot}:${x.kind}@${x.start}${x.end ? `–${x.end}` : ""}`).join(" ");
  add("mesh is never a timeline entry", !bd.some((x) => x.kind === "mesh") && !recipeFixture(RECIPE_SHOTS_LEGACY).plan.backdrops, show || "none");
  // s1–s2 studio (canvas) · s3 product-space (grid) · s4–s5 data-space (grid continues) · s6 cinematic (grid + aurora)
  add("only drawable layers, in their slots, in time order", show.replace(/@\d+/g, "@") === "environment:perspective-grid@ atmosphere:aurora@" && bd.every((x, i) => i === 0 || x.start >= bd[i - 1].start) && bd.every((x) => BACKDROP_ROLE[x.kind as keyof typeof BACKDROP_ROLE] !== "base"), show);
  // A world back to the canvas ends the layer (no lingering backdrop).
  const back = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 3 ? { ...x, recipe: { ...x.recipe!, environment: "studio" } } : x)) });
  const g = (back.plan.backdrops ?? []).find((x) => x.kind === "perspective-grid");
  add("going back to the plain canvas ends the open layer", !!g?.end && (back.plan.backdrops ?? []).filter((x) => x.kind === "perspective-grid").length === 2, (back.plan.backdrops ?? []).map((x) => `${x.kind}@${x.start}${x.end ? `–${x.end}` : ""}`).join(" "));
  add("dark-space, product-space and cinematic are three different worlds", new Set(["dark-space", "product-space", "cinematic"].map((e) => JSON.stringify(ENV_WORLD[e as keyof typeof ENV_WORLD]))).size === 3, ["dark-space", "product-space", "cinematic"].map((e) => `${e}: ${JSON.stringify(ENV_WORLD[e as keyof typeof ENV_WORLD])}`).join(" · "));
  add("environment and atmosphere roles are explicit", ENVIRONMENTS.every((e) => (!ENV_WORLD[e].environment || BACKDROP_ROLE[ENV_WORLD[e].environment!] === "environment") && (!ENV_WORLD[e].atmosphere || BACKDROP_ROLE[ENV_WORLD[e].atmosphere!] === "atmosphere")) && BACKDROP_ROLE.aurora === "atmosphere" && BACKDROP_ROLE["perspective-grid"] === "environment", "aurora = atmosphere · perspective-grid = environment");
  // One strength per backdrop, whatever the source or pace.
  const calmGrid = recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA, background: "grid" } });
  const pg = [...bd, ...(calmGrid.plan.backdrops ?? [])].filter((x) => x.kind === "perspective-grid");
  add("same backdrop, same default strength (recipe, calm shot, lively)", pg.length >= 2 && pg.every((x) => x.strength === undefined) && backdropStrength("perspective-grid") === 0.9 && backdropStrength("aurora") === 0.9 && backdropStrength("particles") === 0.55, `perspective-grid ${backdropStrength("perspective-grid")} from ${[...new Set(pg.map((x) => x.source))].join(" + ")}; overrides: ${pg.filter((x) => x.strength !== undefined).length}`);
  // recipe (grid) → a shot with no backdrop: the plain canvas, never the first scene's world.
  const mixed = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 4 ? { ...x, recipe: null } : x)) });
  const mb = mixed.plan.backdrops ?? [];
  const at = (f: number) => mb.filter((x) => x.start <= f && (x.end === undefined || x.end > f) && !mb.some((y) => y.slot === x.slot && y.start > x.start && y.start <= f)).map((x) => x.kind);
  const shotScene = mixed.script.beats.filter((b) => b.action === "scene")[4];
  const gEnd = mb.find((x) => x.kind === "perspective-grid")?.end;
  add("recipe → shot: no stale backdrop inherited (plain canvas)", gEnd !== undefined && at(gEnd + 30).length === 0 && !shotScene.recipe, `shot scene from ${gEnd}: ${gEnd !== undefined ? at(gEnd + 30).join("+") || "canvas" : "-"} · ${mb.map((x) => `${x.kind}@${x.start}${x.end ? `–${x.end}` : ""}(${x.source})`).join(" ")}`);
}

// Plan fingerprints from before choreography existed (commit 64f7170): an
// event without choreography must compile to exactly the same plan.
const PRE_CHOREO: Record<string, string> = { base: "ea6e409b38595cfe", legacy: "3e2e8f88b481c1cb", assemble: "7981d8c18737d641", transform: "a4b67c921a494901", move: "8744b8be42c7597e" };
const fingerprint = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
function choreography() {
  section = "13. motion choreography";
  const moveWith = (c: Choreography | null) => withRecipe(0, (r) => ({ ...r, behaviors: [{ type: "move", from: "sheet", to: "hero", cue: "ten different tools", ...(c ? { choreography: c } : {}) }] }));
  const actor = (r: ReturnType<typeof recipeFixture>) => {
    const b = r.script.beats.find((x) => x.action === "move")!;
    return { b, n: r.plan.nodes.find((x) => x.id === b.targets![0])! };
  };
  const plain = actor(recipeFixture(moveWith(null)));
  const t = plain.n.paths!.at(-1)!.start; // the cue frame (the move starts on it)

  // 1. full four phases
  const full = normalizeChoreography({ anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 }, 26);
  const four = actor(recipeFixture(moveWith({ anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 })));
  const tl = choreoTimeline(four.b.choreo!, t);
  const path = four.n.paths!.at(-1)!;
  const sc = four.n.scale ?? [];
  const fit = sc.find(([f]) => f === tl.impactAt + tl.impact)?.[1];
  add("full: phases normalized to frames", JSON.stringify(full) === JSON.stringify({ anticipation: 6, action: 18, impact: 5, settle: 9 }) && JSON.stringify(four.b.choreo) === JSON.stringify(full), JSON.stringify(full));
  add("full: anticipation dip, action after it, impact pop, settle to rest", path.start === tl.actionAt && path.end === tl.impactAt && sc.some(([f, v]) => f === tl.actionAt && v < sc[sc.length - 1][1]) && !!fit && sc.some(([f, v]) => f === tl.end && Math.abs(v * 1.08 - fit) < 1e-6), `cue ${t} · dip →${tl.actionAt} · travel ${path.start}–${path.end} · impact →${tl.impactAt + tl.impact} · settle →${tl.end}`);

  // 2. action + settle only
  const as = normalizeChoreography({ anticipation: null, action: 0.5, impact: null, settle: 0.4 }, 26);
  const two = actor(recipeFixture(moveWith({ anticipation: null, action: 0.5, impact: null, settle: 0.4 })));
  const tl2 = choreoTimeline(two.b.choreo!, t);
  const p2 = two.n.paths!.at(-1)!;
  add("action + settle: starts on the cue, soft overshoot settles", JSON.stringify(as) === JSON.stringify({ anticipation: 0, action: 15, impact: 0, settle: 12 }) && p2.start === t && p2.end === t + 15 && (two.n.scale ?? []).some(([f]) => f === tl2.end), `${JSON.stringify(as)} · travel ${p2.start}–${p2.end} · rest at ${tl2.end}`);

  // 3. missing optional phases
  const none = normalizeChoreography({ anticipation: null, action: null, impact: null, settle: null }, 26);
  const impactOnly = normalizeChoreography({ impact: 0.2 }, 20);
  add("missing phases: action keeps the event's own length, others absent", JSON.stringify(none) === JSON.stringify({ anticipation: 0, action: 26, impact: 0, settle: 0 }), JSON.stringify(none));
  add("an impact without a settle gets a safe 10-frame settle", JSON.stringify(impactOnly) === JSON.stringify({ anticipation: 0, action: 20, impact: 6, settle: 10 }), JSON.stringify(impactOnly));

  // 4. invalid / negative / unrealistic
  const bad = normalizeChoreography({ anticipation: -1, action: Number.NaN, impact: 5, settle: 0.05 }, 26);
  add("negative / NaN → default, too long → max, too short → min", JSON.stringify(bad) === JSON.stringify({ anticipation: 0, action: 26, impact: 12, settle: 4 }), JSON.stringify(bad));
  const tiny = normalizeChoreography({ anticipation: 0.04, action: 0.05, impact: 0.01, settle: null }, 26);
  add("tiny phases clamp up (0 frames = absent)", JSON.stringify(tiny) === JSON.stringify({ anticipation: 4, action: 6, impact: 0, settle: 0 }), JSON.stringify(tiny));
  const long = normalizeChoreography({ anticipation: 1, action: 5, impact: 1, settle: 2 }, 26);
  const lt = long.anticipation + long.action + long.impact + long.settle;
  add("total capped: never over MAX_TOTAL, phases within bounds", lt <= MAX_TOTAL && (Object.keys(PHASE_BOUNDS) as (keyof typeof PHASE_BOUNDS)[]).every((k) => long[k] === 0 || (long[k] >= PHASE_BOUNDS[k][0] && long[k] <= PHASE_BOUNDS[k][1])), `${JSON.stringify(long)} = ${lt} ≤ ${MAX_TOTAL}`);

  // 5. deterministic total
  const again = normalizeChoreography({ anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 }, 26);
  const tlA = choreoTimeline(full, 100);
  add("deterministic: same input, same frames; total = sum of phases", JSON.stringify(again) === JSON.stringify(full) && tlA.total === 6 + 18 + 5 + 9 && tlA.end === 138 && fingerprint(recipeFixture(moveWith({ anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 })).plan) === fingerprint(recipeFixture(moveWith({ anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 })).plan), `total ${tlA.total} · ${tlA.start}→${tlA.actionAt}→${tlA.impactAt}→${tlA.settleAt}→${tlA.end}`);

  // 6. compatibility: no choreography → the same plan as before it existed
  const R0 = (i: number, f: (r: SceneRecipe) => SceneRecipe) => withRecipe(i, f);
  const cases: Record<string, ShotScript> = {
    base: RECIPE_SHOTS,
    legacy: RECIPE_SHOTS_LEGACY,
    assemble: R0(0, (r) => ({ ...r, supporting: [...r.supporting, { id: "chart", asset: "icon:chart-line", role: "x", layer: "midground", relation: "feeds-hero", persistence: "scene" }], behaviors: [{ type: "assemble", from: "sheet", to: "hero", cue: "ten different tools" }] })),
    transform: R0(3, (r) => ({ ...r, behaviors: [{ type: "transform", from: "coin", to: "hero", cue: "a sale happens" }] })),
    move: moveWith(null),
  };
  const fp = Object.entries(cases).map(([k, v]) => [k, fingerprint(recipeFixture(v).plan)] as const);
  add("non-choreographed motion compiles exactly as before", fp.every(([k, h]) => h === PRE_CHOREO[k]), fp.map(([k, h]) => `${k} ${h === PRE_CHOREO[k] ? "=" : "≠"}`).join(", "));
  const nulls = fingerprint(recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x) => (x.recipe ? { ...x, recipe: { ...x.recipe, behaviors: x.recipe.behaviors.map((b) => ({ ...b, choreography: null })) } } : x)) }).plan);
  add("choreography null = no choreography", nulls === PRE_CHOREO.base, nulls);
  const stored = JSON.parse(JSON.stringify(RECIPE_SHOTS));
  const back = ShotScriptSchema.parse(stored);
  add("stored recipes without choreography reload (behaviors kept)", back.shots.every((x, i) => (x.recipe?.behaviors.length ?? 0) === (RECIPE_SHOTS.shots[i].recipe?.behaviors.length ?? 0)), `${back.shots.filter((x) => x.recipe).length} recipes`);
  // Visual review (acc10fb): a short choreographed transform compressed the
  // turn — the source vanished barely turned, a blank frame, the target cut
  // in. The turn now keeps its own 16 frames (as without choreography).
  const swap = (c: Choreography | null) => {
    const r = recipeFixture(withRecipe(3, (rc) => ({ ...rc, behaviors: [{ type: "transform", from: "coin", to: "hero", cue: "a sale happens", ...(c ? { choreography: c } : {}) }] })));
    const b = r.script.beats.find((x) => x.style === "transform")!;
    const src = r.plan.nodes.find((n) => n.id === b.targets![0])!;
    const dst = r.plan.nodes.find((n) => n.id === b.to)!;
    const st = src.tilt ?? [];
    const out = st[st.length - 1][0] - st[st.length - 2][0]; // the source's turn to edge-on
    const dt = dst.tilt ?? [];
    const k = dt.findIndex(([, v]) => v[1] === -90);
    const inn = dt[k + 1][0] - dt[k][0]; // the target's turn in
    const fade = (src.opacity ?? []).filter(([, v]) => v === 0).map(([f]) => f).pop()!; // source gone
    return { out, inn, gap: dt[k][0] - (fade - 1), end: dt[k + 1][0], b };
  };
  const plainSwap = swap(null);
  const shortSwap = swap({ anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 });
  const tlS = choreoTimeline({ ...shortSwap.b.choreo!, action: Math.max(shortSwap.b.choreo!.action, 22) }, 0);
  add("choreographed transform keeps its turn (no blank frame, no hard cut)", shortSwap.out === plainSwap.out && shortSwap.inn === plainSwap.inn && shortSwap.gap === plainSwap.gap, `turn out ${shortSwap.out} (plain ${plainSwap.out}) · in ${shortSwap.inn} (plain ${plainSwap.inn}) · handover gap ${shortSwap.gap} (plain ${plainSwap.gap})`);
  const cueAt = plainSwap.end - 32; // (without choreography the turn ends 32 frames after the cue)
  add("a short transform action stretches to 22 frames; the turn ends on the impact", tlS.action === 22 && shortSwap.end === cueAt + tlS.impactAt, `action ${shortSwap.b.choreo!.action} → ${tlS.action} · turn ends ${shortSwap.end} = cue ${cueAt} + ${tlS.impactAt}`);
  const unsupported = recipeFixture(withRecipe(0, (r) => ({ ...r, behaviors: [{ type: "flow", from: "sheet", to: "hero", cue: "ten different tools", choreography: { anticipation: 0.2, action: 0.5, impact: null, settle: null } }] })));
  add("an event not choreographed yet keeps its timing and says so (never a revision)", unsupported.notes.some((n) => n.includes("flow keeps its own timing") && !isFixableNote(n)) && !unsupported.script.beats.some((b) => b.choreo), unsupported.notes.find((n) => n.includes("own timing")) ?? "-");
}

function choreoSfxChecks() {
  section = "14. choreography SFX";
  const FULL = { anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 };
  const moveWith = (c: Choreography | null) => withRecipe(0, (r) => ({ ...r, behaviors: [{ type: "move", from: "sheet", to: "hero", cue: "ten different tools", ...(c ? { choreography: c } : {}) }] }));
  const run = (c: Choreography | null) => {
    const r = recipeFixture(moveWith(c));
    const b = r.script.beats.find((x) => x.action === "move")!;
    const n = r.plan.nodes.find((x) => x.id === b.targets![0])!;
    return { r, b, n };
  };
  const plain = run(null);
  const cue = plain.n.paths!.at(-1)!.start; // the move starts on its cue frame
  const sfxAround = (r: ReturnType<typeof recipeFixture>) => (r.plan.sfx ?? []).filter((x) => x.frame >= cue - 2 && x.frame <= cue + 60);
  // impact → the landing frame
  const imp = run({ ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }] });
  const tl = choreoTimeline(imp.b.choreo!, cue);
  add("impact SFX on the impact frame", sfxAround(imp.r).some((x) => x.kind === "subtle_impact" && x.frame === tl.impactAt) && tl.impactAt === cue + 6 + 18, `cue ${cue} · impact at ${tl.impactAt} · ${JSON.stringify(sfxAround(imp.r))}`);
  // anticipation → the event start
  const ant = run({ ...FULL, sfx: [{ phase: "anticipation", kind: "whoosh" }, { phase: "impact", kind: "soft_pop" }] });
  const tlA = choreoTimeline(ant.b.choreo!, cue);
  add("anticipation SFX on the event start (with an impact cue)", sfxAround(ant.r).some((x) => x.kind === "whoosh" && x.frame === tlA.start) && sfxAround(ant.r).some((x) => x.kind === "soft_pop" && x.frame === tlA.impactAt), JSON.stringify(sfxAround(ant.r)));
  add("action / settle SFX on their frames", sfxFrame(tl, "action") === tl.actionAt && sfxFrame(tl, "settle") === tl.settleAt && tl.settleAt === tl.impactAt + tl.impact, `action ${tl.actionAt} · settle ${tl.settleAt}`);
  // missing SFX → no new audio event; the event keeps its own fixed sounds (unchanged)
  const none = run(FULL);
  const fixedOnly = JSON.stringify((none.r.plan.sfx ?? []).filter((x) => x.frame >= cue - 2 && x.frame <= cue + 60)) === JSON.stringify((plain.r.plan.sfx ?? []).filter((x) => x.frame >= cue - 2 && x.frame <= cue + 60));
  add("no SFX cues → no choreography audio event (the fixed sounds as before)", !none.b.choreo!.sfx && fixedOnly, JSON.stringify(sfxAround(none.r)));
  // choreography absent → the plan, sounds included, exactly as before
  add("choreography absent → unchanged (plan fingerprint)", fingerprint(plain.r.plan) === PRE_CHOREO.move, fingerprint(plain.r.plan));
  // invalid timing / kind → safe fallback
  const bad = normalizeSfx([{ phase: "after-lunch", kind: "subtle_impact" }, { phase: "impact", kind: "laser-blast" }, { phase: 7, kind: null }]);
  const many = normalizeSfx([{ phase: "impact", kind: "click" }, { phase: "impact", kind: "reveal" }, { phase: "settle", kind: "soft_pop" }, { phase: "action", kind: "whoosh" }]);
  add("unknown phase → impact; unknown kind → dropped; ≤ 2 per event, one per phase", JSON.stringify(bad) === JSON.stringify([{ phase: "impact", kind: "subtle_impact" }]) && JSON.stringify(many) === JSON.stringify([{ phase: "impact", kind: "click" }, { phase: "settle", kind: "soft_pop" }]), `${JSON.stringify(bad)} · ${JSON.stringify(many)}`);
  // deterministic
  const a1 = run({ ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }] });
  add("deterministic: same input, same SFX frames", JSON.stringify(a1.r.plan.sfx) === JSON.stringify(imp.r.plan.sfx), `${(imp.r.plan.sfx ?? []).length} cues`);
  // the voice's own timing is untouched: every word-timed text and the cue frames stay
  const words = (r: ReturnType<typeof recipeFixture>) => JSON.stringify(r.plan.texts.map((t) => [t.text, t.start, t.end ?? null]));
  add("voice cue timing unchanged by SFX", words(imp.r) === words(none.r) && plain.n.paths!.at(-1)!.start === cue && imp.b.cue === plain.b.cue, `${imp.r.plan.texts.length} texts, same frames`);
  // the sound has its own length (the renderer plays each for SFX_LENGTH), not a phase's
  const short = run({ anticipation: null, action: 0.2, impact: null, settle: null, sfx: [{ phase: "action", kind: "whoosh" }] });
  add("an SFX cue is a start frame only (own duration)", (short.r.plan.sfx ?? []).every((x) => Object.keys(x).every((k) => k === "frame" || k === "kind" || k === "choreo")), JSON.stringify(sfxAround(short.r)));
  // Audio render review (9cdd6a0): a choreography cue within the renderer's
  // 6-frame gap of a fixed sound was dropped for it (the transform's landing
  // pop, 5 frames before the next scene's whoosh, played silent). A cue now
  // goes first; the fixed sound gives way.
  const longT = recipeFixture(withRecipe(3, (r) => ({ ...r, behaviors: [{ type: "transform", from: "coin", to: "hero", cue: "a sale happens", choreography: { anticipation: 0.2, action: 0.9, impact: null, settle: null, sfx: [{ phase: "impact", kind: "soft_pop" }] } }] })));
  const cueSfx = (longT.plan.sfx ?? []).find((x) => x.choreo)!;
  const near = (longT.plan.sfx ?? []).filter((x) => !x.choreo && Math.abs(x.frame - cueSfx.frame) < 6);
  const kept = plannedSfx(longT.plan);
  add("a cue near a fixed sound is kept; the fixed one gives way", near.length > 0 && kept.some((x) => x.frame === cueSfx.frame && x.src.endsWith("soft_pop.mp3")) && !near.some((n) => kept.some((x) => x.frame === n.frame)), `cue ${cueSfx.frame} soft_pop vs fixed ${near.map((n) => `${n.frame} ${n.kind}`).join(", ")} → kept ${kept.filter((x) => Math.abs(x.frame - cueSfx.frame) < 8).map((x) => `${x.frame} ${x.src.split("/").pop()}`).join(", ")}`);
  const fixedOnlyPlan = recipeFixture(RECIPE_SHOTS).plan;
  add("without cues the renderer keeps exactly what it kept before", !(fixedOnlyPlan.sfx ?? []).some((x) => x.choreo) && fingerprint(fixedOnlyPlan) === PRE_CHOREO.base, `${plannedSfx(fixedOnlyPlan).length} sounds`);
  // the Director's strict schema carries the cue list
  const schema = JSON.stringify(zodTextFormat(ShotScriptModel, "s"));
  add("Director schema: choreography.sfx (phase, kind)", schema.includes("\"sfx\"") && schema.includes("\"phase\""), "ok");
}

// Camera fingerprints from before camera choreography existed (66a6b82).
const PRE_CAMERA: Record<string, string> = { dnaOrbit: "093b1b3e1b249145", dnaPush: "8d53a92de7e6cb3e", recipeOrbitDna: "ea6e409b38595cfe", baseCamera: "239c0a100f5f066f" };
function cameraChoreo() {
  section = "15. camera choreography";
  const FULL = { anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 };
  const moveWith = (c: Choreography | null) => withRecipe(0, (r) => ({ ...r, behaviors: [{ type: "move", from: "sheet", to: "hero", cue: "ten different tools", ...(c ? { choreography: c } : {}) }] }));
  const plain = recipeFixture(moveWith(null));
  const plainB = plain.script.beats.find((x) => x.action === "move")!;
  const cue = plain.plan.nodes.find((n) => n.id === plainB.targets![0])!.paths!.at(-1)!.start;
  // the camera at a frame, after smoothing (what the renderer shows)
  const camAt = (r: ReturnType<typeof recipeFixture>, f: number) => ({ c: vecOf(r.plan.camera.center, f), z: num(r.plan.camera.zoom, f, 1) });
  const run = (response: string, intensity: string | null = "medium", extra: Partial<Choreography> = {}) => recipeFixture(moveWith({ ...FULL, ...extra, camera: { response, intensity } }));
  // normalization
  add("normalize: valid response kept, bad intensity → medium, unknown response → none", JSON.stringify(normalizeCamera({ response: "push", intensity: "high" })) === JSON.stringify({ response: "push", intensity: "high" }) && normalizeCamera({ response: "pan", intensity: "extreme" })?.intensity === "medium" && normalizeCamera({ response: "spin", intensity: "low" }) === null && normalizeCamera(null) === null, "push/high · pan/extreme→medium · spin→none");
  const nc = normalizeChoreography({ ...FULL, camera: { response: "push", intensity: null } }, 26);
  add("normalized choreography carries the camera (frames unchanged)", JSON.stringify(nc) === JSON.stringify({ anticipation: 6, action: 18, impact: 5, settle: 9, camera: { response: "push", intensity: "medium" } }), JSON.stringify(nc));
  const tl = choreoTimeline(nc, cue);
  const at = (r: ReturnType<typeof recipeFixture>, f: number) => camAt(r, f);
  const d = (r: ReturnType<typeof recipeFixture>, f: number) => { const a = at(r, f), b = at(plain, f); return { dx: a.c[0] - b.c[0], dy: a.c[1] - b.c[1], dz: a.z / b.z }; };
  // after smoothing the peak lags the anchor a little: look across the event
  const peak = (r: ReturnType<typeof recipeFixture>, key: "dx" | "dy" | "dz") => { let best = key === "dz" ? 1 : 0; for (let f = tl.start; f <= tl.end + 20; f++) { const v = d(r, f)[key]; if (Math.abs(key === "dz" ? v - 1 : v) > Math.abs(key === "dz" ? best - 1 : best)) best = v; } return best; };
  const push = run("push"), pull = run("pull"), pan = run("pan"), orbit = run("orbit"), rise = run("rise"), fall = run("fall");
  add("push: the camera moves in (zoom up) toward the subject", peak(push, "dz") > 1.03, `peak zoom ×${peak(push, "dz").toFixed(3)}`);
  add("pull: the camera moves out (zoom down)", peak(pull, "dz") < 0.98, `peak zoom ×${peak(pull, "dz").toFixed(3)}`);
  add("pan: a lateral move, no zoom", Math.abs(peak(pan, "dx")) > 25 && Math.abs(peak(pan, "dz") - 1) < 0.005, `peak dx ${peak(pan, "dx").toFixed(1)} · zoom ×${peak(pan, "dz").toFixed(3)}`);
  add("orbit: an arc (lateral + lift + slight zoom)", Math.abs(peak(orbit, "dx")) > 15 && peak(orbit, "dy") < -3 && peak(orbit, "dz") > 1.005, `dx ${peak(orbit, "dx").toFixed(1)} · dy ${peak(orbit, "dy").toFixed(1)} · zoom ×${peak(orbit, "dz").toFixed(3)}`);
  add("rise / fall: up and down, opposite", peak(rise, "dy") < -20 && peak(fall, "dy") > 20, `rise dy ${peak(rise, "dy").toFixed(1)} · fall dy ${peak(fall, "dy").toFixed(1)}`);
  // frame-aligned and returning: no change before the event, back after it
  // (the renderer's camera smoothing spreads a move a few frames either way:
  // well under a pixel 30 frames out)
  const before = d(push, tl.start - 30), after = d(push, tl.end + 60);
  let peakAt = tl.start;
  for (let f = tl.start; f <= tl.end + 20; f++) if (d(push, f).dz > d(push, peakAt).dz) peakAt = f;
  add("frame-aligned: the move peaks within the event; untouched before, back after", peakAt >= tl.actionAt && peakAt <= tl.end + 6 && Math.abs(before.dx) < 0.5 && Math.abs(before.dz - 1) < 0.001 && Math.abs(after.dx) < 0.5 && Math.abs(after.dz - 1) < 0.002, `peak at ${peakAt} (action ${tl.actionAt}, impact ${tl.impactAt}, end ${tl.end}) · before Δ ${before.dx.toFixed(2)}/${before.dz.toFixed(4)} · after Δ ${after.dx.toFixed(2)}/${after.dz.toFixed(4)}`);
  // Visual review (e684e7b): the response's extra keys re-eased the scene's
  // own long camera moves, so the camera drifted for seconds before and
  // after the event (3.5 px, 0.7 % zoom, 40 frames early). Now the scene's
  // camera is kept frame for frame and only the offset is added.
  const drift = (r: ReturnType<typeof recipeFixture>, a: number, b: number) => { let m = 0, mz = 0; for (let f = a; f <= b; f++) { const x = d(r, f); m = Math.max(m, Math.abs(x.dx), Math.abs(x.dy)); mz = Math.max(mz, Math.abs(x.dz - 1)); } return { m, mz }; };
  const early = drift(pan, tl.start - 60, tl.start - 15);
  add("no drift before the event (the scene's own camera is kept)", early.m < 1 && early.mz < 0.002, `max Δ ${early.m.toFixed(2)} px · ${(early.mz * 100).toFixed(3)} % zoom, 60–15 frames before`);
  let fastest = 0, fastestBase = 0;
  for (let f = tl.start - 10; f <= tl.end + 40; f++) { const a = camAt(pan, f).c, b = camAt(pan, f + 1).c, p0 = camAt(plain, f).c, p1 = camAt(plain, f + 1).c; fastest = Math.max(fastest, Math.hypot(b[0] - a[0], b[1] - a[1])); fastestBase = Math.max(fastestBase, Math.hypot(p1[0] - p0[0], p1[1] - p0[1])); }
  add("the response moves at the camera's own pace (no snap)", fastest <= 4, `fastest ${fastest.toFixed(2)} px/frame (scene camera ${fastestBase.toFixed(2)})`);
  const raw = (resp: string) => { const o = cameraOffsets({ response: resp as never, intensity: "high" }, [900, 600]); return Math.max(Math.abs(o.impact.center[0]), Math.abs(o.impact.center[1])); };
  add("no excessive movement: shift ≤ 120 px, zoom within ±10 %", ["push", "pull", "pan", "orbit", "rise", "fall"].every((r) => raw(r) <= 120) && ["push", "pull", "orbit"].every((r) => { const o = cameraOffsets({ response: r as never, intensity: "high" }, [0, 0]); return [o.anticipation.zoom, o.action.zoom, o.impact.zoom].every((z) => z >= 0.9 && z <= 1.1); }), ["push", "pan", "orbit", "rise"].map((r) => `${r} ${raw(r)}px`).join(" · "));
  // missing optional phases: action only → anchors start, impact, impact + CAMERA_RETURN
  const actOnly = recipeFixture(moveWith({ anticipation: null, action: 0.5, impact: null, settle: null, camera: { response: "pan", intensity: "low" } }));
  const tl2 = choreoTimeline(normalizeChoreography({ action: 0.5 }, 26), cue);
  add("missing phases: the move on the action, back over 12 frames", Math.abs(d(actOnly, tl2.impactAt + CAMERA_RETURN + 40).dx) < 0.5 && Math.abs(d(actOnly, tl2.impactAt).dx) > 5, `Δx at impact ${d(actOnly, tl2.impactAt).dx.toFixed(1)} · after return ${d(actOnly, tl2.impactAt + CAMERA_RETURN + 40).dx.toFixed(2)}`);
  // invalid → safe fallback
  const bad = recipeFixture(moveWith({ ...FULL, camera: { response: "shake", intensity: "max" } }));
  const badMove = bad.script.beats.find((x) => x.action === "move")!;
  add("invalid response → no camera response (camera untouched)", !badMove.choreo?.camera && JSON.stringify(bad.plan.camera) === JSON.stringify(recipeFixture(moveWith(FULL)).plan.camera), "shake → none");
  add("invalid intensity → medium (same as medium)", JSON.stringify(run("pan", "max").plan.camera) === JSON.stringify(run("pan", "medium").plan.camera), "max → medium");
  // deterministic
  add("deterministic camera output", JSON.stringify(run("orbit").plan.camera) === JSON.stringify(orbit.plan.camera), fingerprint(orbit.plan.camera));
  // compatibility
  const DNA0: Dna = { ...DNA, camera: "orbit" };
  const fps = { dnaOrbit: fingerprint(recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: DNA0 }).plan), dnaPush: fingerprint(recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA0, camera: "push" } }).plan), recipeOrbitDna: fingerprint(recipeFixture({ ...RECIPE_SHOTS, dna: DNA0 }).plan), baseCamera: fingerprint(recipeFixture(RECIPE_SHOTS).plan.camera) };
  add("choreography absent → camera output unchanged (fingerprints)", Object.entries(fps).every(([k, v]) => v === PRE_CAMERA[k]), Object.entries(fps).map(([k, v]) => `${k} ${v === PRE_CAMERA[k] ? "=" : "≠"}`).join(", "));
  add("recipe camera unchanged without a camera response (choreography with SFX only)", JSON.stringify(recipeFixture(moveWith({ ...FULL, sfx: [{ phase: "impact", kind: "soft_pop" }] })).plan.camera) === JSON.stringify(plain.plan.camera), "same camera keys");
  add("legacy / DNA orbit keeps its own orbit move", fps.dnaOrbit === PRE_CAMERA.dnaOrbit && recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: DNA0 }).script.beats.some((b) => b.camera === "orbit"), "DNA orbit → scene camera orbit");
  const schema = JSON.stringify(zodTextFormat(ShotScriptModel, "s"));
  add("Director schema: choreography.camera (response, intensity)", schema.includes("\"response\"") && schema.includes("\"intensity\""), "ok");
}

function backgroundChoreo() {
  section = "16. background choreography";
  // normalization
  const n = (c: Parameters<typeof normalizeBackground>[0]) => JSON.stringify(normalizeBackground(c));
  add("normalize: the four transitions, default direction left and intensity medium", BG_TRANSITIONS.every((t) => normalizeBackground({ transition: t })?.transition === t) && n({ transition: "push" }) === JSON.stringify({ transition: "push", direction: "left", intensity: "medium" }), n({ transition: "push" }));
  add("normalize: direction / intensity kept when valid, unknown → default", n({ transition: "wipe", direction: "up", intensity: "strong" }) === JSON.stringify({ transition: "wipe", direction: "up", intensity: "strong" }) && n({ transition: "slide", direction: "diagonal", intensity: "max" }) === JSON.stringify({ transition: "slide", direction: "left", intensity: "medium" }) && n({ transition: "slide", direction: null, intensity: null }) === n({ transition: "slide" }), "up/strong kept · diagonal/max → left/medium");
  add("missing / invalid transition → none (the default dissolve)", normalizeBackground(null) === null && normalizeBackground(undefined) === null && normalizeBackground({}) === null && normalizeBackground({ transition: "spin", direction: "up" }) === null && normalizeBackground({ transition: null }) === null, "null · {} · spin → none");

  // The layers of one slot, A → B at frame 100, with a transition.
  const AT = 100;
  const pair = (c: BgChoreo | undefined): WorldEntry[] => [{ start: 0, end: AT, slot: "environment" }, { start: AT, slot: "environment", ...(c ? { enter: c } : {}) }];
  const states = (es: WorldEntry[], f: number) => es.map((e, i) => worldLayer(e, worldContext(es, i), f));
  // how much of the slot shows at a point (alpha over alpha), the clip in the
  // layer's own box (it moves with the layer, as in CSS)
  const cover = (es: WorldEntry[], f: number, x: number, y: number) =>
    1 - states(es, f).reduce((acc, st) => {
      const lx = x - st.shift[0], ly = y - st.shift[1];
      const c = st.clip ?? [0, 0, 0, 0];
      const inside = lx >= c[3] && lx <= 1 - c[1] && ly >= c[0] && ly <= 1 - c[2] && lx >= 0 && lx <= 1 && ly >= 0 && ly <= 1;
      return acc * (1 - (inside ? st.opacity : 0));
    }, 1);
  const minCover = (es: WorldEntry[], a: number, b: number) => { let m = 1; for (let f = a; f <= b; f++) for (let gx = 0; gx < 20; gx++) for (let gy = 0; gy < 20; gy++) m = Math.min(m, cover(es, f, (gx + 0.5) / 20, (gy + 0.5) / 20)); return m; };
  const mk = (transition: BgChoreo["transition"], direction: BgChoreo["direction"] = "left", intensity: BgChoreo["intensity"] = "medium"): BgChoreo => ({ transition, direction, intensity });
  const mid = (c: BgChoreo) => AT + Math.round(bgLength(c) / 2);
  const st = (c: BgChoreo, f: number) => states(pair(c), f);
  // 1. the four transitions
  const cf = st(mk("crossfade"), mid(mk("crossfade")));
  add("crossfade: a dissolve (both partly visible, nothing moves)", cf.every((x) => x.opacity > 0.2 && x.opacity < 0.8 && !x.shift[0] && !x.shift[1] && !x.clip), cf.map((x) => x.opacity.toFixed(2)).join(" / "));
  const sl = st(mk("slide"), mid(mk("slide")));
  add("slide: the current world moves away (on top), the target is revealed in place", sl[0].shift[0] < -0.1 && sl[0].top && sl[0].opacity > 0 && sl[0].opacity < 1 && sl[1].opacity === 1 && !sl[1].shift[0] && !sl[1].clip, `old shift ${sl[0].shift[0].toFixed(2)} α ${sl[0].opacity.toFixed(2)} top · new α ${sl[1].opacity}`);
  const pu = st(mk("push"), mid(mk("push")));
  add("push: the target pushes the current world out (both travel one way, whole)", pu[0].shift[0] < -0.3 && pu[1].shift[0] > 0.3 && Math.abs(pu[1].shift[0] - pu[0].shift[0] - 1) < 1e-9 && pu.every((x) => x.opacity === 1), `old ${pu[0].shift[0].toFixed(2)} · new ${pu[1].shift[0].toFixed(2)}`);
  const wp = st(mk("wipe"), mid(mk("wipe")));
  add("wipe: the target revealed from an edge (complementary clips, nothing moves)", !!wp[0].clip && !!wp[1].clip && wp[1].clip[3] > 0 && Math.abs(wp[1].clip[3] - (1 - wp[0].clip[1])) < 1e-9 && wp.every((x) => x.opacity === 1 && !x.shift[0]), `new inset-left ${wp[1].clip?.[3].toFixed(2)} · old inset-right ${wp[0].clip?.[1].toFixed(2)}`);
  // 2. direction and intensity
  const dirs = BG_DIRECTIONS.map((d) => st(mk("push", d), mid(mk("push", d)))[1].shift);
  add("direction: the target comes from the opposite side of each direction", JSON.stringify(dirs.map((v) => [Math.sign(v[0]), Math.sign(v[1])])) === JSON.stringify([[1, 0], [-1, 0], [0, 1], [0, -1]]), dirs.map((v, i) => `${BG_DIRECTIONS[i]} ${v.map((x) => x.toFixed(2)).join(",")}`).join(" · "));
  const far = (i: BgChoreo["intensity"]) => -st(mk("slide", "left", i), AT + 23)[0].shift[0];
  add("intensity: slide distance subtle < medium < strong; crossfade / push / wipe slower when subtle", far("subtle") < far("medium") && far("medium") < far("strong") && bgLength(mk("crossfade", "left", "subtle")) > bgLength(mk("crossfade")) && bgLength(mk("push", "left", "strong")) < bgLength(mk("push")) && bgLength(mk("wipe", "left", "subtle")) > bgLength(mk("wipe")), `slide ${far("subtle").toFixed(2)} < ${far("medium").toFixed(2)} < ${far("strong").toFixed(2)} · lengths ${["subtle", "medium", "strong"].map((i) => bgLength(mk("push", "left", i as BgChoreo["intensity"]))).join("/")}`);
  // 3. no blank frame, the old world ends, the target is established
  const all = BG_TRANSITIONS.flatMap((t) => BG_DIRECTIONS.flatMap((d) => (["subtle", "medium", "strong"] as const).map((i) => mk(t, d, i))));
  const covers = all.map((c) => minCover(pair(c), AT - 4, AT + bgLength(c) + 4));
  const base = minCover(pair(undefined), AT - 4, AT + 30);
  add("no blank frame: the slot stays covered through every transition (≥ the default dissolve)", base > 0.7 && covers.every((v) => v >= base - 1e-9), `min cover ${Math.min(...covers).toFixed(3)} (default dissolve ${base.toFixed(3)}), ${all.length} variants`);
  const done = all.every((c) => { const e = AT + bgLength(c); return [e, e + 1, e + 30].every((f) => { const [a, b] = st(c, f); return a.opacity === 0 && b.opacity === 1 && !b.shift[0] && !b.shift[1] && !b.clip; }); });
  add("old world gone and target fully established when the transition ends", done, "every transition × direction × intensity");
  const before = all.every((c) => { const [a, b] = st(c, AT - 1); return b.opacity === 0 && a.opacity === 1 && !a.shift[0] && !a.clip; });
  add("target starts on the event frame (nothing before it)", before, `frame ${AT - 1}: old whole, new hidden`);
  add("deterministic", JSON.stringify(all.map((c) => st(c, mid(c)))) === JSON.stringify(all.map((c) => st(c, mid(c)))), `${all.length} variants`);

  // In the compiler: s4 data-space → dark-space with a background push: the
  // grid (environment) leaves, aurora (atmosphere) arrives on the same event.
  const withBg = (i: number, bg: SceneRecipe["background"], env?: SceneRecipe["environment"]) => recipeFixture(withRecipe(i, (r) => ({ ...r, ...(env ? { environment: env } : {}), background: bg })));
  const dark = withBg(3, { transition: "push", direction: "left" }, "dark-space");
  const darkPlain = recipeFixture(withRecipe(3, (r) => ({ ...r, environment: "dark-space" })));
  const db = dark.plan.backdrops ?? [];
  const sceneT = dark.script.beats.filter((b) => b.action === "scene")[3];
  const grid = db.find((x) => x.kind === "perspective-grid" && x.exit);
  const aur = db.find((x) => x.kind === "aurora" && x.enter);
  const push = { transition: "push", direction: "left", intensity: "medium" };
  add("one event drives both slots (environment exits, atmosphere enters)", !!grid && !!aur && grid.end === aur.start && JSON.stringify(grid.exit) === JSON.stringify(push) && JSON.stringify(aur.enter) === JSON.stringify(push) && JSON.stringify(sceneT.recipe?.background) === JSON.stringify(push), db.map((x) => `${x.slot}:${x.kind}@${x.start}${x.end ? `–${x.end}` : ""}${x.enter ? ` in:${x.enter.transition}` : ""}${x.exit ? ` out:${x.exit.transition}` : ""}`).join(" "));
  const gi = db.indexOf(grid!), ai = db.indexOf(aur!);
  const gEnd = grid!.end! + bgLength(grid!.exit);
  add("old backdrop ends correctly (no leak into the new scene)", worldLayer(grid!, worldContext(db, gi), gEnd).opacity === 0 && worldLayer(grid!, worldContext(db, gi), gEnd + 60).opacity === 0 && worldLayer(grid!, worldContext(db, gi), grid!.end! - 1).opacity === 1, `grid gone at ${gEnd}`);
  const aEst = worldLayer(aur!, worldContext(db, ai), aur!.start + bgLength(aur!.enter));
  add("target starts on its scene and is fully established", aur!.start === (dark.plan.backdrops ?? []).find((x) => x.kind === "aurora")!.start && worldLayer(aur!, worldContext(db, ai), aur!.start - 1).opacity === 0 && aEst.opacity === 1 && !aEst.shift[0] && !aEst.clip, `aurora from ${aur!.start}`);
  add("same world timeline as without choreography (only how it moves)", JSON.stringify(db.map((x) => { const r = { ...x }; delete r.enter; delete r.exit; return r; })) === JSON.stringify(darkPlain.plan.backdrops), `${db.length} entries`);
  // slots kept: a background on a scene whose world does not change adds nothing
  const sameEnv = withBg(4, { transition: "wipe", direction: "right", intensity: "strong" }); // s5 data-space after s4 data-space
  add("environment slot preserved (unchanged world: no new entry, no transition)", fingerprint(sameEnv.plan) === PRE_CHOREO.base, fingerprint(sameEnv.plan));
  const cine = withBg(5, { transition: "slide", direction: "up" }); // s6 cinematic: grid continues, aurora arrives
  const cb = cine.plan.backdrops ?? [];
  const baseB = recipeFixture(RECIPE_SHOTS).plan.backdrops ?? [];
  add("atmosphere slot changes on its own; the environment layer is kept", cb.length === baseB.length && cb.filter((x) => x.slot === "environment").every((x) => !x.enter && !x.exit) && JSON.stringify(cb.find((x) => x.kind === "aurora")?.enter) === JSON.stringify({ transition: "slide", direction: "up", intensity: "medium" }), cb.map((x) => `${x.slot}:${x.kind}${x.enter ? ` in:${x.enter.transition}` : ""}`).join(" "));
  // the rest of the scene untouched
  const scenes = (r: ReturnType<typeof recipeFixture>) => r.script.beats.filter((b) => b.action === "scene").map((b) => b.transition).join(",");
  add("recipe transitions unchanged (transition_in / out are not overridden)", scenes(dark) === scenes(darkPlain) && scenes(cine) === scenes(recipeFixture(RECIPE_SHOTS)), scenes(dark));
  add("camera unchanged", JSON.stringify(dark.plan.camera) === JSON.stringify(darkPlain.plan.camera) && JSON.stringify(cine.plan.camera) === JSON.stringify(recipeFixture(RECIPE_SHOTS).plan.camera), "same camera keys");
  add("SFX unchanged", JSON.stringify(dark.plan.sfx) === JSON.stringify(darkPlain.plan.sfx) && JSON.stringify(plannedSfx(cine.plan)) === JSON.stringify(plannedSfx(recipeFixture(RECIPE_SHOTS).plan)), `${(dark.plan.sfx ?? []).length} cues`);
  add("objects unchanged", JSON.stringify(dark.plan.nodes) === JSON.stringify(darkPlain.plan.nodes) && JSON.stringify(cine.plan.nodes) === JSON.stringify(recipeFixture(RECIPE_SHOTS).plan.nodes), "same nodes");
  // compatibility
  const nul = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x) => (x.recipe ? { ...x, recipe: { ...x.recipe, background: null } } : x)) });
  const bad = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x) => (x.recipe ? { ...x, recipe: { ...x.recipe, background: { transition: "spin" } } } : x)) });
  const fps = { base: fingerprint(recipeFixture(RECIPE_SHOTS).plan), nul: fingerprint(nul.plan), bad: fingerprint(bad.plan), legacy: fingerprint(recipeFixture(RECIPE_SHOTS_LEGACY).plan) };
  add("choreography absent → existing plan fingerprint unchanged", fps.base === PRE_CHOREO.base && fps.nul === PRE_CHOREO.base && fps.legacy === PRE_CHOREO.legacy, Object.entries(fps).filter(([k]) => k !== "bad").map(([k, v]) => `${k} ${v}`).join(" · "));
  add("invalid transition → the default (same plan as none)", fps.bad === PRE_CHOREO.base && !bad.script.beats.some((b) => b.recipe?.background), "spin → none");
  const DNA0: Dna = { ...DNA, camera: "orbit" };
  const dnaFp = fingerprint(recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: DNA0 }).plan);
  const gridDna = recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA, background: "grid" } }).plan.backdrops ?? [];
  add("DNA / legacy backgrounds unchanged (no transition on shots)", dnaFp === PRE_CAMERA.dnaOrbit && gridDna.length > 0 && gridDna.every((x) => !x.enter && !x.exit), `dna ${dnaFp} · grid ${gridDna.length} entries`);
  // the default render path: exactly the old cross-fade
  const oldK = (es: WorldEntry[], i: number, f: number) => { const e = es[i]; const out = es.slice(i + 1).find((x) => (x.slot ?? "environment") === (e.slot ?? "environment"))?.start ?? e.end; return ramp24(f, e.start) * (out !== undefined ? 1 - ramp24(f, out) : 1); };
  const plainB = recipeFixture(RECIPE_SHOTS).plan.backdrops ?? [];
  let worst = 0;
  for (let f = 0; f < 900; f += 3) plainB.forEach((_, i) => { const l = worldLayer(plainB[i], worldContext(plainB, i), f); worst = Math.max(worst, Math.abs(l.opacity - oldK(plainB, i, f)), Math.abs(l.shift[0]) + Math.abs(l.shift[1]), l.clip ? 1 : 0, l.top ? 1 : 0); });
  add("without choreography the renderer draws exactly the old cross-fade", worst === 0, `max difference ${worst}`);
  // stored / Director
  const stored = StoredSceneRecipe.parse({ ...RECIPE_SHOTS.shots.find((x) => x.recipe)!.recipe, background: 42 });
  const old = StoredSceneRecipe.parse(JSON.parse(JSON.stringify(RECIPE_SHOTS.shots.find((x) => x.recipe)!.recipe)));
  add("stored recipes: none reloads as none, unreadable → none", old.background === undefined && stored.background === null, `old ${String(old.background)} · unreadable ${String(stored.background)}`);
  const schema = JSON.stringify(zodTextFormat(ShotScriptModel, "s"));
  add("Director schema: background (transition, direction, intensity)", schema.includes("\"background\"") && schema.includes("\"transition\"") && schema.includes("\"direction\""), "ok");
}

// Visual validation (Phase 4A): without choreography a layer whose slot went
// empty stayed on screen until the slot's next entry (the grid 339 → 451, the
// aurora 451 → 595 with s4 dark-space). An entry's own end is authoritative.
const CHOREO_LAYERS = "b1447f50bdb918be"; // before this fix (11337e6)
function worldEnds() {
  section = "17. world entries end at their end";
  const plan = recipeFixture(withRecipe(3, (r) => ({ ...r, environment: "dark-space" }))).plan;
  const bd = plan.backdrops ?? [];
  const show = bd.map((x) => `${x.slot}:${x.kind}@${x.start}${x.end ? `–${x.end}` : ""}`).join(" ");
  const op = (es: WorldEntry[], i: number, f: number) => worldLayer(es[i], worldContext(es, i), f).opacity;
  const gi = bd.findIndex((x) => x.kind === "perspective-grid" && x.end !== undefined);
  const ai = bd.findIndex((x) => x.kind === "aurora" && x.end !== undefined);
  const g = bd[gi], a = bd[ai];
  const laterG = bd.find((x, i) => i > gi && x.slot === g.slot)!, laterA = bd.find((x, i) => i > ai && x.slot === a.slot)!;
  add("the case: both slots empty for a while, then a later entry", g.slot === "environment" && a.slot === "atmosphere" && laterG.start > g.end! && laterA.start > a.end! && !bd.some((x) => x.kind === "mesh"), show);
  // explicit end, next entry later than it: gone 24 frames after its end
  add("environment: an ended layer is gone after its end (no leak until the next entry)", op(bd, gi, g.end! + 24) === 0 && op(bd, gi, Math.round((g.end! + laterG.start) / 2)) === 0 && op(bd, gi, laterG.start - 1) === 0, `grid at ${g.end! + 24}: ${op(bd, gi, g.end! + 24).toFixed(2)} · at ${laterG.start - 1}: ${op(bd, gi, laterG.start - 1).toFixed(2)}`);
  add("atmosphere: an ended layer is gone after its end (no leak until the next entry)", op(bd, ai, a.end! + 24) === 0 && op(bd, ai, laterA.start - 1) === 0, `aurora at ${a.end! + 24}: ${op(bd, ai, a.end! + 24).toFixed(2)} · at ${laterA.start - 1}: ${op(bd, ai, laterA.start - 1).toFixed(2)}`);
  // active entries: fully in from start + 24 until their end; the same 24-frame fade out
  const active = [gi, ai].every((i) => { const e = bd[i]; let ok = true; for (let f = e.start + 24; f <= e.end!; f++) ok &&= op(bd, i, f) === 1; return ok && op(bd, i, e.end! + 12) > 0 && op(bd, i, e.end! + 12) < 1; });
  add("active entries stay fully visible until their end, then the usual 24-frame fade", active, "grid + aurora");
  // missing end: the last entry of a slot stays (until the brand lockup, drawn elsewhere)
  const open = bd.map((x, i) => [x, i] as const).filter(([x]) => x.end === undefined);
  add("missing end: a slot's last entry stays visible", open.length === 2 && open.every(([x, i]) => op(bd, i, x.start + 30) === 1 && op(bd, i, x.start + 200) === 1), open.map(([x]) => `${x.slot}:${x.kind}@${x.start}`).join(" "));
  // the next entry arrives as before; an entry replaced in its slot leaves as its successor arrives
  const later = [bd.indexOf(laterG), bd.indexOf(laterA)];
  add("the next entry's arrival is unchanged (24-frame fade in from its start)", later.every((i) => op(bd, i, bd[i].start - 1) === 0 && op(bd, i, bd[i].start + 12) > 0 && op(bd, i, bd[i].start + 24) === 1), later.map((i) => `${bd[i].kind}@${bd[i].start}`).join(" "));
  const swap: WorldEntry[] = [{ start: 0, end: 100, slot: "environment" }, { start: 100, slot: "environment" }];
  const ramp24k = (f: number) => ramp24(f, 100);
  let sw = 0;
  for (let f = 90; f <= 130; f++) sw = Math.max(sw, Math.abs(op(swap, 0, f) - (1 - ramp24k(f))), Math.abs(op(swap, 1, f) - ramp24k(f)));
  add("replaced in its slot (end = next start): the same cross-fade as before", sw === 0, `max difference ${sw}`);
  const noEnd: WorldEntry[] = [{ start: 0, slot: "atmosphere" }, { start: 100, slot: "atmosphere" }];
  add("no end but a next entry: leaves as the next one arrives", op(noEnd, 0, 99) === 1 && op(noEnd, 0, 124) === 0, "start of the next entry");
  // no blank frame: at an empty slot's end only the base canvas is left (no layer flicker)
  let blink = false;
  for (let f = g.end! - 2; f <= g.end! + 30; f++) if (op(bd, gi, f) > op(bd, gi, f - 1) + 1e-9) blink = true;
  add("no flicker: an ended layer only fades out", !blink, `${g.end}–${g.end! + 30}`);
  // choreography present: unchanged
  const ch = recipeFixture(withRecipe(3, (r) => ({ ...r, environment: "dark-space", background: { transition: "push", direction: "left" } }))).plan.backdrops ?? [];
  const layers = fingerprint(ch.map((_, i) => [0, 200, 339, 345, 351, 363, 451, 460, 470, 500, 595, 610, 700].map((f) => worldLayer(ch[i], worldContext(ch, i), f))));
  add("choreography present: layers unchanged", layers === CHOREO_LAYERS, layers);
  // plan / camera / objects / SFX untouched (the renderer only)
  add("plans unchanged (fingerprints)", fingerprint(recipeFixture(RECIPE_SHOTS).plan) === PRE_CHOREO.base && fingerprint(recipeFixture(RECIPE_SHOTS_LEGACY).plan) === PRE_CHOREO.legacy && fingerprint(recipeFixture(RECIPE_SHOTS).plan.camera) === PRE_CAMERA.baseCamera, "base · legacy · camera");
}

// s3 with a flow, a highlight related to it (+4) and the reveal of the bars: fits before s4's words.
const fitsS3 = (rel: boolean) => withRecipe(2, (r) => ({ ...r, behaviors: [
  { type: "flow", from: "db", to: "hero", cue: "every source", id: "f" },
  { type: "highlight", from: "hero", to: null, cue: "into one", id: "h", ...(rel ? { relationship: { after: "f", offset: 4 } } : {}) },
  { type: "reveal", from: "bars", to: null, cue: "one live dashboard", id: "r" },
] }));
// Object relationships (Phase 5): event B after event A starts when A ends (+ offset).
function relationships() {
  section = "18. object relationships";
  type Bh = SceneRecipe["behaviors"][number];
  // s1 rebuilt: a card (sheet) moves to the hero, two pieces assemble into the chart, the chart is highlighted
  const scene = (behaviors: Bh[]) => withRecipe(0, (r) => ({ ...r,
    supporting: [
      { id: "sheet", asset: "icon:file-spreadsheet", role: "a card", layer: "midground", relation: "feeds-hero", persistence: "scene" },
      { id: "chart", asset: "visual:bars", role: "the chart", layer: "foreground", relation: "beside-hero", persistence: "scene" },
      { id: "p1", asset: "icon:database", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" },
      { id: "p2", asset: "icon:chart-line", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" },
    ],
    behaviors }));
  const A = (x: Partial<Bh> = {}): Bh => ({ type: "move", from: "sheet", to: "hero", cue: "ten different tools", id: "a", ...x });
  const B = (x: Partial<Bh> = {}): Bh => ({ type: "assemble", from: "p1", to: "chart", cue: "different tools", id: "b", ...x });
  const C = (x: Partial<Bh> = {}): Bh => ({ type: "highlight", from: "chart", to: null, cue: "tools", id: "c", ...x });
  const run = (bs: Bh[]) => recipeFixture(scene(bs));
  const rel = (r: ReturnType<typeof run>, ev: string) => r.plan.relations?.find((x) => x.event === ev);
  const start = (r: ReturnType<typeof run>, kind: string) => { const b = r.script.beats.find((x) => (x.style ? `${x.action}/${x.style}` : x.action) === kind)!; const n = r.plan.nodes.find((x) => x.id === b.targets![0])!; return { b, n }; };
  const moveEnd = (r: ReturnType<typeof run>) => start(r, "move/recipe").n.paths!.at(-1)!.end;
  // the chain A → B (+6) → C (+4)
  const chain = run([A(), B({ relationship: { after: "a", offset: 6 } }), C({ relationship: { after: "b", offset: 4 } })]);
  const plain = run([A(), B(), C()]);
  const rb = rel(chain, "s1#1")!, rc = rel(chain, "s1#2")!;
  const aEnd = moveEnd(chain);
  add("single after + offset: B starts 6 frames after A ends (A's own 26-frame move)", rb.status === "applied" && rb.dependencyEnd === aEnd && rb.start === aEnd + 6 && aEnd - start(chain, "move/recipe").n.paths!.at(-1)!.start === 26, `A ends ${aEnd} · B ${rb.start}`);
  add("chained A → B → C: C starts 4 frames after B ends", rc.status === "applied" && rc.start === rc.dependencyEnd! + 4 && rc.dependencyEnd === rb.start + 56, `B ${rb.start}–${rc.dependencyEnd} · C ${rc.start}`);
  // the dependency's duration is what it really runs: the pieces are fused and the chart at rest before C
  const asm = start(chain, "merge/assemble").b;
  const pieces = chain.plan.nodes.filter((n) => asm.targets!.includes(n.id) && n.id !== asm.to);
  const chartScale = start(chain, "highlight").n.scale ?? [];
  // each piece's fade to nothing (its first 0-opacity key after B starts)
  const lastPiece = Math.max(...pieces.map((n) => (n.opacity ?? []).find(([f, v]) => f >= rb.start && v === 0)?.[0] ?? Infinity));
  const chartRest = Math.max(...chartScale.filter(([f]) => f < rc.start).map(([f]) => f));
  add("dependency duration respected: B fully done (pieces gone, chart at rest) before C", lastPiece <= rc.start && chartRest <= rc.dependencyEnd! && chartScale.some(([f]) => f === rc.start + 2), `pieces gone ${lastPiece} · chart at rest ${chartRest} · C bump ${rc.start + 2}`);
  // without the relationship the same events crowd on their words
  const pb = plain.script.beats.find((x) => x.style === "assemble")!;
  add("without relationships: the same events on their words (overlapping)", !plain.plan.relations && !pb.after && !pb.event && moveEnd(plain) === aEnd, `no relations · A ends ${moveEnd(plain)}`);
  // zero offset, negative offset
  const zero = rel(run([A(), B({ relationship: { after: "a", offset: 0 } })]), "s1#1")!;
  const neg = rel(run([A(), B({ relationship: { after: "a", offset: -12 } })]), "s1#1")!;
  add("zero offset: B starts the frame A ends", zero.start === zero.dependencyEnd && zero.offset === 0, `${zero.dependencyEnd} → ${zero.start}`);
  add("negative offset normalized to 0 (never before A ends); too long capped", neg.offset === 0 && neg.start === neg.dependencyEnd && normalizeOffset(-3) === 0 && normalizeOffset(500) === 90 && normalizeOffset(4.6) === 5 && normalizeOffset(Number.NaN) === 0 && normalizeOffset(null) === 0, `-12 → ${neg.offset}`);
  // missing dependency, circular dependency, self, forward
  const missing = run([A(), B({ relationship: { after: "nope", offset: 6 } }), C()]);
  add("missing dependency: reported, B timed on its words (the same plan as none)", missing.notes.some((n) => n.includes('after unknown event "nope"')) && fingerprint(missing.plan) === fingerprint(plain.plan), missing.notes.find((n) => n.includes("nope")) ?? "-");
  const circ = run([A({ relationship: { after: "b", offset: 2 } }), B({ relationship: { after: "a", offset: 6 } }), C()]);
  add("circular dependency: reported, both timed on their words (the same plan as none)", circ.notes.some((n) => n.includes("circular dependency")) && fingerprint(circ.plan) === fingerprint(plain.plan), circ.notes.find((n) => n.includes("circular")) ?? "-");
  const r3 = resolveRelationships([{ id: "x", relationship: { after: "z" } }, { id: "y", relationship: { after: "x" } }, { id: "z", relationship: { after: "y" } }, { id: "w", relationship: { after: "w" } }, { id: "x" }, { id: "v", relationship: { after: "q" } }]);
  add("resolver: 3-cycle, self, duplicate id, forward reference — all reported and dropped", r3.relations.every((x) => x === null) && r3.errors.some((e) => e.includes('"x" → "z" → "y" → "x"') || e.includes("circular")) && r3.errors.some((e) => e.includes("after itself")) && r3.errors.some((e) => e.includes("duplicate id")) && r3.errors.length === 4, r3.errors.join(" · "));
  const fwd = resolveRelationships([{ id: "a", relationship: { after: "b" } }, { id: "b" }]);
  add("after an event later in the list: reported, timed on its words", fwd.relations[0] === null && fwd.errors[0]?.includes("later in the list"), fwd.errors[0] ?? "-");
  const dropped = run([A({ from: "nobody" }), B({ relationship: { after: "a", offset: 6 } })]);
  add("dependency not in the video (dropped event): fallback on its words, exposed", rel(dropped, "s1#1")?.status === "fallback", JSON.stringify(rel(dropped, "s1#1")));
  // compatibility: relationship absent → old fingerprints
  const nul = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x) => (x.recipe ? { ...x, recipe: { ...x.recipe, behaviors: x.recipe.behaviors.map((b) => ({ ...b, id: null, relationship: null })) } } : x)) });
  add("relationship absent → old plan fingerprints", fingerprint(recipeFixture(RECIPE_SHOTS).plan) === PRE_CHOREO.base && fingerprint(nul.plan) === PRE_CHOREO.base && fingerprint(recipeFixture(RECIPE_SHOTS_LEGACY).plan) === PRE_CHOREO.legacy, "base · ids/relationships null · legacy");
  const R0 = (i: number, f: (r: SceneRecipe) => SceneRecipe) => withRecipe(i, f);
  const old: Record<string, ShotScript> = {
    assemble: R0(0, (r) => ({ ...r, supporting: [...r.supporting, { id: "chart", asset: "icon:chart-line", role: "x", layer: "midground", relation: "feeds-hero", persistence: "scene" }], behaviors: [{ type: "assemble", from: "sheet", to: "hero", cue: "ten different tools", id: "only" }] })),
    transform: R0(3, (r) => ({ ...r, behaviors: [{ type: "transform", from: "coin", to: "hero", cue: "a sale happens", id: "t" }] })),
    move: R0(0, (r) => ({ ...r, behaviors: [{ type: "move", from: "sheet", to: "hero", cue: "ten different tools", id: "m", relationship: null }] })),
  };
  const ofp = Object.entries(old).map(([k, v]) => [k, fingerprint(recipeFixture(v).plan)] as const);
  add("move / merge / assemble / transform / highlight without relationships unchanged (ids alone change nothing)", ofp.every(([k, h]) => h === PRE_CHOREO[k]), ofp.map(([k, h]) => `${k} ${h === PRE_CHOREO[k] ? "=" : "≠"}`).join(", ") + " · merge, highlight: base");
  // choreography + relationship: B's phases unchanged, just placed later
  const FULL = { anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 };
  const chB = run([A(), B({ choreography: { ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }], camera: { response: "push", intensity: "medium" } }, relationship: { after: "a", offset: 6 } })]);
  const chPlain = run([A(), B({ choreography: { ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }], camera: { response: "push", intensity: "medium" } } })]);
  const bb = chB.script.beats.find((x) => x.style === "assemble")!, bp = chPlain.script.beats.find((x) => x.style === "assemble")!;
  const rB = rel(chB, "s1#1")!;
  const tl = choreoTimeline(bb.choreo!, rB.start);
  const pieceStart = (r: ReturnType<typeof run>, b: typeof bb, from: number) => Math.min(...r.plan.nodes.filter((n) => b.targets!.includes(n.id) && n.id !== b.to).flatMap((n) => (n.paths ?? []).filter((p) => p.start >= from).map((p) => p.start)));
  // where B sits without the relationship (on its words): from its impact sound (impact = start + anticipation + action)
  const impP = (chPlain.plan.sfx ?? []).find((x) => x.choreo && x.kind === "subtle_impact")!.frame;
  const tlP = choreoTimeline(bp.choreo!, impP - bp.choreo!.anticipation - bp.choreo!.action);
  add("choreography + relationship: phases identical, the event placed after A", JSON.stringify(bb.choreo) === JSON.stringify(bp.choreo) && rB.start === rB.dependencyEnd! + 6 && pieceStart(chB, bb, rB.start) - tl.actionAt === pieceStart(chPlain, bp, tlP.start) - tlP.actionAt, `phases ${JSON.stringify(bb.choreo)} · B ${rB.start} · action at ${tl.actionAt} · pieces fly at ${pieceStart(chB, bb, rB.start)} (on its words: action ${tlP.actionAt}, fly ${pieceStart(chPlain, bp, tlP.start)})`);
  add("SFX stays on the choreography phase (impact of the placed event)", (chB.plan.sfx ?? []).some((x) => x.choreo && x.kind === "subtle_impact" && x.frame === sfxFrame(tl, "impact")), `impact sound at ${sfxFrame(tl, "impact")}`);
  const camAt = (r: ReturnType<typeof run>, f: number) => num(r.plan.camera.zoom, f, 1);
  const noCam = run([A(), B({ choreography: { ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }] }, relationship: { after: "a", offset: 6 } })]);
  let peakAt = tl.start, peak = 0;
  for (let f = tl.start - 20; f <= tl.end + 20; f++) { const d = camAt(chB, f) / camAt(noCam, f); if (d > peak) { peak = d; peakAt = f; } }
  add("camera response follows the placed event's phases (and only them)", peak > 1.02 && peakAt >= tl.actionAt && peakAt <= tl.end + 6 && Math.abs(camAt(chB, tl.start - 30) / camAt(noCam, tl.start - 30) - 1) < 0.001, `peak ×${peak.toFixed(3)} at ${peakAt} (event ${tl.start}–${tl.end})`);
  // a chain that fits its scene (s3: flow, then highlight +4, all before s4's words): background, scene timing, camera before it untouched
  // (s1 was used here before the timing guards: its A → C chain ends at 144, after s2's words at 132 — it never fitted)
  const fit = recipeFixture(fitsS3(true));
  const fitPlain = recipeFixture(fitsS3(false));
  const scenes = (r: ReturnType<typeof run>) => r.plan.backdrops?.map((b) => `${b.kind}@${b.start}`).join(" ");
  const aStart = fit.plan.relations![0].dependencyEnd! - 20;
  let camSame = true;
  for (let f = 0; f < aStart - 20; f++) camSame &&= camAt(fit, f) === camAt(fitPlain, f) && JSON.stringify(vecOf(fit.plan.camera.center, f)) === JSON.stringify(vecOf(fitPlain.plan.camera.center, f));
  add("background timing unchanged (a chain within its scene)", scenes(fit) === scenes(fitPlain) && JSON.stringify(fit.plan.backdrops) === JSON.stringify(fitPlain.plan.backdrops), scenes(fit) ?? "-");
  add("camera unchanged up to the related events", camSame, `frames 0–${aStart - 20}`);
  // identity
  const ids = (r: ReturnType<typeof run>) => r.plan.nodes.map((n) => n.id).sort().join(",");
  add("object identity preserved (same nodes, same ids)", ids(chain) === ids(plain) && ids(fit) === ids(fitPlain), `${chain.plan.nodes.length} nodes`);
  add("deterministic compilation", fingerprint(chain.plan) === fingerprint(run([A(), B({ relationship: { after: "a", offset: 6 } }), C({ relationship: { after: "b", offset: 4 } })]).plan), fingerprint(chain.plan));
  const schema = JSON.stringify(zodTextFormat(ShotScriptModel, "s"));
  add("Director schema: behavior id + relationship (after, offset)", schema.includes("\"relationship\"") && schema.includes("\"after\"") && schema.includes("\"offset\""), "ok");
}

// Relationship timing guards: the voice is authoritative.
function relationGuards() {
  section = "19. relationship timing guards";
  type Bh = SceneRecipe["behaviors"][number];
  const s1 = (behaviors: Bh[]) => withRecipe(0, (r) => ({ ...r,
    supporting: [
      { id: "sheet", asset: "icon:file-spreadsheet", role: "a card", layer: "midground", relation: "feeds-hero", persistence: "scene" },
      { id: "chart", asset: "visual:bars", role: "the chart", layer: "foreground", relation: "beside-hero", persistence: "scene" },
      { id: "p1", asset: "icon:database", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" },
      { id: "p2", asset: "icon:chart-line", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" },
    ],
    behaviors }));
  const A: Bh = { type: "move", from: "sheet", to: "hero", cue: "ten different tools", id: "a" };
  const B: Bh = { type: "assemble", from: "p1", to: "chart", cue: "different tools", id: "b" };
  const C: Bh = { type: "highlight", from: "chart", to: null, cue: "tools", id: "c" };
  const chainOf = (extra: Partial<Bh> = {}) => [A, { ...B, relationship: { after: "a", offset: 6 } }, { ...C, ...extra, relationship: { after: "b", offset: 4 } }];
  // 1. fits → no warning
  const fit = recipeFixture(fitsS3(true));
  add("chain fits its scene's words → no warning", !fit.plan.relationWarnings && fit.plan.relations?.[0].status === "applied", JSON.stringify(fit.plan.relations?.[0]));
  // 2 – 4. exceeds → overflow, with the chain's full span (its last event's settle included)
  const over = recipeFixture(s1(chainOf()));
  const w = over.plan.relationWarnings ?? [];
  const ov = w.find((x) => x.code === "RELATIONSHIP_SCENE_OVERFLOW")!;
  const rel = over.plan.relations!;
  const aStart = rel[0].dependencyEnd! - 26; // A: the 26-frame move
  const cEnd = rel[1].start + 34; // C: a highlight is at rest 34 frames in
  add("chain exceeds its scene's words → RELATIONSHIP_SCENE_OVERFLOW", !!ov && ov.scene === "s1" && JSON.stringify(ov.chain) === JSON.stringify(["s1#0", "s1#1", "s1#2"]), JSON.stringify(ov));
  add("required duration = first event's start → last event at rest (A 26 + 6 + B 56 + 4 + C 34)", ov.requiredFrames === cEnd - aStart && ov.requiredFrames === 26 + 6 + 56 + 4 + 34 && ov.availableFrames < ov.requiredFrames, `required ${ov.requiredFrames} · available ${ov.availableFrames}`);
  const chC = recipeFixture(s1(chainOf({ choreography: { anticipation: 0.2, action: 0.4, impact: 0.15, settle: 0.6 } })));
  const ovC = chC.plan.relationWarnings!.find((x) => x.code === "RELATIONSHIP_SCENE_OVERFLOW")!;
  const cc = chC.script.beats.find((b) => b.action === "highlight" && b.after)!.choreo!;
  const ctl = choreoTimeline(cc, chC.plan.relations![1].start);
  add("final event's settle counted (choreographed: anticipation + action + impact + settle)", ovC.requiredFrames === Math.max(ctl.end, ctl.actionAt + 26) - aStart && ctl.settle === 18, `C ${ctl.start}→${ctl.end} (settle ${ctl.settle}) · required ${ovC.requiredFrames}`);
  // 5. the next scene never cuts the final event: held until it is at rest, and the delay against the words reported
  const ext = w.find((x) => x.code === "RELATIONSHIP_BOUNDARY_EXTENDED")!;
  // s2 arrives with a panel wipe that starts on its scene's first frame
  const s2Start = over.plan.panels?.[0]?.start;
  const plainS2 = recipeFixture(s1([A, B, C])).plan.panels?.[0]?.start;
  // the chart (C's subject) is not taken off screen before C is at rest
  const chartGone = (over.plan.nodes.find((n) => n.id === over.script.beats.find((b) => b.action === "highlight" && b.after)!.targets![0])!.opacity ?? []).find(([f, v]) => f >= rel[1].start && v === 0)?.[0];
  add("scene boundary held until the final event is at rest (never cut mid-settle)", !!ext && ext.extendedTo === cEnd && ext.boundary! < cEnd && s2Start === cEnd && (chartGone === undefined || chartGone >= cEnd), `boundary ${ext.boundary} → ${ext.extendedTo} · s2 panel wipe at ${s2Start} (without relationships ${plainS2}) · chart leaves ${chartGone}`);
  add("…and the voice conflict is reported, not hidden (voiceDelayFrames)", ext.voiceDelayFrames === ext.extendedTo! - (ov.availableFrames + aStart) && ext.voiceDelayFrames! > 0, `${ext.voiceDelayFrames} frames behind its words`);
  // 6 – 8. phases, SFX and camera keep their own timing in an overflowing chain
  const FULL = { anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3 };
  const ch = recipeFixture(s1([A, { ...B, choreography: { ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }], camera: { response: "push", intensity: "medium" } }, relationship: { after: "a", offset: 6 } }, { ...C, relationship: { after: "b", offset: 4 } }]));
  const bb = ch.script.beats.find((b) => b.style === "assemble")!;
  const btl = choreoTimeline(bb.choreo!, ch.plan.relations![0].start);
  add("choreography phases unchanged (no compression)", JSON.stringify(bb.choreo) === JSON.stringify(normalizeChoreography({ ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }], camera: { response: "push", intensity: "medium" } }, 40)) && !!ch.plan.relationWarnings, JSON.stringify(bb.choreo));
  add("SFX on its phase (impact of the placed event)", (ch.plan.sfx ?? []).some((x) => x.choreo && x.kind === "subtle_impact" && x.frame === sfxFrame(btl, "impact")), `impact ${sfxFrame(btl, "impact")}`);
  const noCam = recipeFixture(s1([A, { ...B, choreography: { ...FULL, sfx: [{ phase: "impact", kind: "subtle_impact" }] }, relationship: { after: "a", offset: 6 } }, { ...C, relationship: { after: "b", offset: 4 } }]));
  let peakAt = 0, peak = 0;
  for (let f = btl.start - 20; f <= btl.end + 20; f++) { const d = num(ch.plan.camera.zoom, f, 1) / num(noCam.plan.camera.zoom, f, 1); if (d > peak) { peak = d; peakAt = f; } }
  add("camera response on the placed event's phases", peak > 1.02 && peakAt >= btl.actionAt && peakAt <= btl.end + 6, `peak ×${peak.toFixed(3)} at ${peakAt} (${btl.start}–${btl.end})`);
  // 9. background: entries still start with their scenes (a held scene takes its world along)
  const grid = (over.plan.backdrops ?? []).find((x) => x.kind === "perspective-grid")!.start; // s3's world arrives with s3
  add("background unchanged where the chain fits; follows its scene where held", JSON.stringify(fit.plan.backdrops) === JSON.stringify(recipeFixture(fitsS3(false)).plan.backdrops) && grid > 212, `fits: ${fit.plan.backdrops?.map((x) => x.start).join(",")} · held: grid from ${grid} (was 212)`);
  // 10 / 12. without relationships: exactly as before
  add("relationship-free fingerprints unchanged", fingerprint(recipeFixture(RECIPE_SHOTS).plan) === PRE_CHOREO.base && fingerprint(recipeFixture(RECIPE_SHOTS_LEGACY).plan) === PRE_CHOREO.legacy && fingerprint(recipeFixture(RECIPE_SHOTS).plan.camera) === PRE_CAMERA.baseCamera, "base · legacy · camera");
  const plain = recipeFixture(s1([A, B, C]));
  add("scheduler without relationships unchanged (no warnings, no relations, events on their words)", !plain.plan.relationWarnings && !plain.plan.relations && fingerprint(recipeFixture(fitsS3(false)).plan) === fingerprint(recipeFixture(withRecipe(2, (r) => ({ ...r, behaviors: [{ type: "flow", from: "db", to: "hero", cue: "every source" }, { type: "highlight", from: "hero", to: null, cue: "into one" }, { type: "reveal", from: "bars", to: null, cue: "one live dashboard" }] }))).plan), "ids alone change nothing");
  // 11. deterministic
  add("deterministic warnings / result", JSON.stringify(recipeFixture(s1(chainOf())).plan.relationWarnings) === JSON.stringify(w) && fingerprint(recipeFixture(s1(chainOf())).plan) === fingerprint(over.plan), fingerprint(over.plan));
}

// Director timing budget: chains planned within the scene's narration time.
type Bh20 = SceneRecipe["behaviors"][number];
// Case A — enough time (s5): the rocket moves to the number, a coin flows in, the number is highlighted.
const budgetFits = withRecipe(4, (r) => ({ ...r, supporting: [...r.supporting, { id: "coin", asset: "object:coin", role: "a sale", layer: "midground", relation: "feeds-hero", persistence: "scene" }], behaviors: [
  { type: "move", from: "rocket", to: "hero", cue: "up 40%", id: "a" },
  { type: "flow", from: "coin", to: "hero", cue: "up 40%", id: "b", relationship: { after: "a", offset: 4 } },
  { type: "highlight", from: "hero", to: null, cue: "first month", id: "c", relationship: { after: "b", offset: 4 } },
] }));
// Case B — not enough time (s3): five events in one chain, then the dashboard is revealed.
const budgetFive = (e: Partial<Bh20> = {}) => withRecipe(2, (r) => ({ ...r, supporting: [...r.supporting,
  { id: "chip", asset: "icon:cpu", role: "a step", layer: "background", relation: "behind-hero", persistence: "scene" },
  { id: "p2", asset: "icon:chart-line", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" }], behaviors: [
  { type: "flow", from: "db", to: "hero", cue: "every", id: "a" },
  { type: "merge", from: "chip", to: "hero", cue: "source", id: "b", relationship: { after: "a", offset: 4 } },
  { type: "highlight", from: "hero", to: null, cue: "into", id: "c", relationship: { after: "b", offset: 4 } },
  { type: "move", from: "p2", to: "hero", cue: "one", id: "d", relationship: { after: "c", offset: 4 } },
  { type: "highlight", from: "hero", to: null, cue: "live", id: "e", relationship: { after: "d", offset: 4 }, ...e },
  { type: "reveal", from: "bars", to: null, cue: "dashboard", id: "r" },
] }));
function directorBudget() {
  section = "20. director timing budget";
  const words = estimateWords(RECIPE_NARRATION_, RECIPE_DURATION);
  const ids = (sh: ShotScript, i: number) => sh.shots[i].recipe!.behaviors.map((b) => `${b.id}${b.relationship?.after ? `<${b.relationship.after}` : ""}`).join(" ");
  // 1. fits → unchanged
  const a = fitRelationshipBudget(budgetFits, words);
  const aPlan = recipeFixture(a.shots).plan;
  add("chain fits the narration → unchanged (same recipe, no warning)", a.shots === budgetFits && !a.notes.length && !aPlan.relationWarnings && aPlan.relations?.every((x) => x.status === "applied") === true, `${ids(a.shots, 4)} · chain ${sceneChains(budgetFits.shots[4].recipe!.behaviors)[0].frames} frames`);
  // 2. the Director is told; its answer is fitted before it is compiled
  const told = ["plan a chain within the scene's narration time", "prefer fewer meaningful events over many rushed ones", "never shorten choreography phases"].every((x) => INSTRUCTIONS.includes(x));
  const dir = budgetDirections([budgetFive()], words);
  add("chain exceeds → the Director's instruction exists and its answer is fitted", told && dir.notes.length > 0 && dir.notes.every((n) => n.startsWith("direction A: ")) && ids(dir.scripts[0], 2) !== ids(budgetFive(), 2), dir.notes[0] ?? "-");
  // 3. fewer meaningful events: the cause and the final emphasis kept, the least important dropped first
  const b = fitRelationshipBudget(budgetFive(), words);
  const rawB = recipeFixture(budgetFive()).plan, fitB = recipeFixture(b.shots).plan;
  const dropped = b.notes.map((n) => /dropped "(\w)"/.exec(n)?.[1]).join("");
  add("fewer meaningful events: a → b → c → d → e becomes a → e (d, then b, then c dropped)", ids(b.shots, 2) === "a e<a r" && dropped === "dbc" && !resolveRelationships(b.shots.shots[2].recipe!.behaviors).errors.length, `${ids(b.shots, 2)} · dropped in order ${dropped}`);
  add("…and the simplified chain fits the voice (the raw one overflowed)", !!rawB.relationWarnings?.some((w) => w.code === "RELATIONSHIP_SCENE_OVERFLOW") && !fitB.relationWarnings, `raw: ${JSON.stringify(rawB.relationWarnings?.[0])} · fitted: none`);
  // 4 – 6. choreography, SFX and camera of the kept events untouched
  const FULL = { anticipation: 0.2, action: 0.6, impact: 0.15, settle: 0.3, sfx: [{ phase: "impact", kind: "soft_pop" }], camera: { response: "push", intensity: "medium" } };
  const c = fitRelationshipBudget(budgetFive({ choreography: FULL }), words);
  const eKept = c.shots.shots[2].recipe!.behaviors.find((x) => x.id === "e")!;
  const cPlan = recipeFixture(c.shots);
  const eBeat = cPlan.script.beats.find((x) => x.action === "highlight" && x.after)!;
  const eRel = cPlan.plan.relations!.find((x) => x.event === eBeat.event)!;
  const etl = choreoTimeline(eBeat.choreo!, eRel.start);
  add("choreography never compressed (kept event's phases as written)", JSON.stringify(eKept.choreography) === JSON.stringify(FULL) && JSON.stringify(eBeat.choreo) === JSON.stringify(normalizeChoreography(FULL, 8)), JSON.stringify(eBeat.choreo));
  add("SFX on its phase (unchanged length and place)", (cPlan.plan.sfx ?? []).some((x) => x.choreo && x.kind === "soft_pop" && x.frame === sfxFrame(etl, "impact")), `impact ${sfxFrame(etl, "impact")}`);
  const noCamPlan = recipeFixture(fitRelationshipBudget(budgetFive({ choreography: { ...FULL, camera: null } }), words).shots).plan;
  let peak = 0, peakAt = 0;
  for (let f = etl.start - 10; f <= etl.end + 20; f++) { const d = num(cPlan.plan.camera.zoom, f, 1) / num(noCamPlan.camera.zoom, f, 1); if (d > peak) { peak = d; peakAt = f; } }
  add("camera choreography unchanged (the response on the kept event's phases)", peak > 1.02 && peakAt >= etl.actionAt && peakAt <= etl.end + 6, `peak ×${peak.toFixed(3)} at ${peakAt} (${etl.start}–${etl.end})`);
  // 7. background: a fitted chain leaves the scenes (and their worlds) on their words
  add("background unchanged (fitted chain: the worlds as without relationships)", JSON.stringify(fitB.backdrops) === JSON.stringify(recipeFixture(RECIPE_SHOTS).plan.backdrops), `fitted ${fitB.backdrops?.map((x) => x.start).join(",")} (s4 continues s3's world, so even the raw overflow keeps ${rawB.backdrops?.map((x) => x.start).join(",")})`);
  // 8. relationship-free: nothing touched
  const base = fitRelationshipBudget(RECIPE_SHOTS, words), legacy = fitRelationshipBudget(RECIPE_SHOTS_LEGACY, words);
  add("relationship-free scripts untouched; fingerprints unchanged", base.shots === RECIPE_SHOTS && legacy.shots === RECIPE_SHOTS_LEGACY && !base.notes.length && fingerprint(recipeFixture(base.shots).plan) === PRE_CHOREO.base && fingerprint(recipeFixture(legacy.shots).plan) === PRE_CHOREO.legacy, "base · legacy");
  // 9. schema
  const schema = JSON.stringify(zodTextFormat(ShotScriptModel, "s"));
  add("Director output schema valid (relationship kept; fitted scripts parse)", schema.includes("\"relationship\"") && ShotScriptSchema.safeParse(JSON.parse(JSON.stringify(b.shots))).success, "ok");
  // 10. what the Director cannot fit: kept, and the compiler still warns
  const s1Chain = withRecipe(0, (r) => ({ ...r, supporting: [
    { id: "sheet", asset: "icon:file-spreadsheet", role: "a card", layer: "midground", relation: "feeds-hero", persistence: "scene" },
    { id: "chart", asset: "visual:bars", role: "the chart", layer: "foreground", relation: "beside-hero", persistence: "scene" },
    { id: "p1", asset: "icon:database", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" },
    { id: "p2", asset: "icon:chart-line", role: "a piece", layer: "background", relation: "behind-hero", persistence: "scene" }], behaviors: [
    { type: "move", from: "sheet", to: "hero", cue: "ten different tools", id: "a" },
    { type: "assemble", from: "p1", to: "chart", cue: "different tools", id: "b", relationship: { after: "a", offset: 6 } },
    { type: "highlight", from: "chart", to: null, cue: "tools", id: "c", relationship: { after: "b", offset: 4 } },
  ] }));
  const d = fitRelationshipBudget(s1Chain, words);
  const dPlan = recipeFixture(d.shots).plan;
  add("still too long after simplifying: kept (cause + one effect), compiler overflow warning as fallback", ids(d.shots, 0) === "a b<a" && d.notes.some((n) => n.includes("kept")) && !!dPlan.relationWarnings?.some((w) => w.code === "RELATIONSHIP_SCENE_OVERFLOW"), `${ids(d.shots, 0)} · ${JSON.stringify(dPlan.relationWarnings?.[0])}`);
  add("deterministic", JSON.stringify(fitRelationshipBudget(budgetFive(), words)) === JSON.stringify(b), `${b.notes.length} notes`);
}

export async function runChecks(): Promise<Check[]> {
  assemble();
  transform();
  arrange();
  transitions();
  palette();
  dnaMappings();
  environments();
  worldStack();
  choreography();
  choreoSfxChecks();
  cameraChoreo();
  backgroundChoreo();
  worldEnds();
  relationships();
  relationGuards();
  directorBudget();
  return checks;
}
