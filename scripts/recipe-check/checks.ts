// Scene Recipe execution: assemble / transform / arrange run on screen,
// the scene boundary transition contract, and the palette precedence.
import { RECIPE_NARRATION as RECIPE_NARRATION_, recipeFixture, RECIPE_SHOTS, RECIPE_SHOTS_LEGACY } from "@/components/video/flow/fixtures/recipe";
import { THEMES, withBrandColor } from "@/components/video/flow/themes";
import type { FlowNode, Track, Vec } from "@/components/video/flow/types";
import { resolveTheme } from "@/lib/projects";
import { BACKDROP_ROLE, BACKDROPS, backdropStrength, ENV_APPROVED_BACKDROPS, REJECTED_BACKDROPS, renderableBackdrop } from "@/components/video/flow/backdrop-names";
import { compileSceneScript, DECOR_ACCENT } from "@/components/video/flow/compile-scene";
import { num } from "@/components/video/flow/eval";
import { boundaryTransition, ENV_BACKDROP, ENV_WORLD, ENVIRONMENTS, type SceneRecipe } from "@/lib/scene-recipe";
import { SceneScript } from "@/lib/scene-script";
import { createHash } from "node:crypto";
import { type Choreography, choreoTimeline, MAX_TOTAL, normalizeChoreography, PHASE_BOUNDS } from "@/lib/choreography";
import { type Dna, dnaMove, isFixableNote, type ShotScript, ShotScript as ShotScriptSchema } from "@/lib/shots";

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
  const unsupported = recipeFixture(withRecipe(0, (r) => ({ ...r, behaviors: [{ type: "flow", from: "sheet", to: "hero", cue: "ten different tools", choreography: { anticipation: 0.2, action: 0.5, impact: null, settle: null } }] })));
  add("an event not choreographed yet keeps its timing and says so (never a revision)", unsupported.notes.some((n) => n.includes("flow keeps its own timing") && !isFixableNote(n)) && !unsupported.script.beats.some((b) => b.choreo), unsupported.notes.find((n) => n.includes("own timing")) ?? "-");
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
  return checks;
}
