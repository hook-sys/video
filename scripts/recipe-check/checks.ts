// Scene Recipe execution: assemble / transform / arrange run on screen,
// the scene boundary transition contract, and the palette precedence.
import { RECIPE_NARRATION as RECIPE_NARRATION_, recipeFixture, RECIPE_SHOTS, RECIPE_SHOTS_LEGACY } from "@/components/video/flow/fixtures/recipe";
import { THEMES, withBrandColor } from "@/components/video/flow/themes";
import type { FlowNode, Track, Vec } from "@/components/video/flow/types";
import { resolveTheme } from "@/lib/projects";
import { BACKDROPS, ENV_APPROVED_BACKDROPS, REJECTED_BACKDROPS, renderableBackdrop } from "@/components/video/flow/backdrop-names";
import { compileSceneScript, DECOR_ACCENT } from "@/components/video/flow/compile-scene";
import { num } from "@/components/video/flow/eval";
import { boundaryTransition, ENV_BACKDROP, ENVIRONMENTS, type SceneRecipe } from "@/lib/scene-recipe";
import { SceneScript } from "@/lib/scene-script";
import { type Dna, dnaMove, type ShotScript } from "@/lib/shots";

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
  const kinds = (mixed.plan.backdrops ?? []).map((x) => `${x.kind}${x.strength ? "" : "*"}`);
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
  const stack = (r: typeof base) => (r.plan.backdrops ?? []).map((x) => `${x.kind}@${x.start}:${x.strength}`).join(" ");
  const withDna = recipeFixture({ ...RECIPE_SHOTS, dna: { ...DNA, background: "grid" } });
  const withBold = recipeFixture({ ...RECIPE_SHOTS, dna: { ...DNA, background: "bold-field" } });
  add("recipe backdrops are not overridden by a DNA background", envs(base) === envs(withDna) && stack(base) === stack(withDna) && stack(base) === stack(withBold), stack(withDna));
  add("plan backdrop stack: approved kinds only", (base.plan.backdrops ?? []).every((x) => (ENV_APPROVED_BACKDROPS as readonly string[]).includes(x.kind)), stack(base));
  // One world: under a recipe environment the canvas decor is an accent only.
  const lvl = (r: typeof base, f: number) => num(r.plan.decorLevel, f, 1);
  const firstRecipe = (base.plan.backdrops ?? [])[0]?.start ?? 0;
  add("recipe scenes turn the decor down to an accent", Math.abs(lvl(base, firstRecipe + 30) - DECOR_ACCENT) < 1e-6, `decor level ${lvl(base, firstRecipe + 30)} (accent ${DECOR_ACCENT})`);
  const glow = recipeFixture({ ...RECIPE_SHOTS, dna: { ...DNA, background: "bold-field" } });
  add("the glow decor (an atmosphere itself) goes entirely", glow.script.look?.decor === "glow" && lvl(glow, firstRecipe + 30) === 0, `decor ${glow.script.look?.decor}: level ${lvl(glow, firstRecipe + 30)}`);
  const mixed = recipeFixture({ ...RECIPE_SHOTS, shots: RECIPE_SHOTS.shots.map((x, i) => (i === 4 ? { ...x, recipe: null } : x)) });
  const sc = mixed.script.beats.map((b, i) => [b, i] as const).filter(([b]) => b.action === "scene");
  const plain = (mixed.plan.backdrops ?? []).find((x) => !x.strength);
  add("a shot without a recipe brings the full decor back", !!plain && lvl(mixed, plain.start + 30) === 1, `non-recipe scene at ${plain?.start}: level ${plain ? lvl(mixed, plain.start + 30) : "-"} (${sc.length} scenes)`);

  section = "11. legacy DNA shots unchanged";
  const legacy = recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA, background: "environment" } });
  add("no recipe: no decor change, no recipe backdrop", legacy.plan.decorLevel === undefined && !(legacy.plan.backdrops ?? []).some((x) => x.strength), `decorLevel ${legacy.plan.decorLevel ? "set" : "none"} · backdrops ${(legacy.plan.backdrops ?? []).map((x) => x.kind).join(", ") || "mesh"} · decor ${legacy.script.look?.decor}`);
  const g = recipeFixture({ ...RECIPE_SHOTS_LEGACY, dna: { ...DNA, background: "grid" } });
  add("DNA grid shots keep their perspective-grid", (g.plan.backdrops ?? []).map((x) => x.kind).join() === "perspective-grid" && g.plan.decorLevel === undefined, (g.plan.backdrops ?? []).map((x) => x.kind).join());
}

export async function runChecks(): Promise<Check[]> {
  assemble();
  transform();
  arrange();
  transitions();
  palette();
  dnaMappings();
  environments();
  return checks;
}
