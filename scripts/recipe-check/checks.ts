// Scene Recipe execution: assemble / transform / arrange run on screen,
// the scene boundary transition contract, and the palette precedence.
import { recipeFixture, RECIPE_SHOTS } from "@/components/video/flow/fixtures/recipe";
import { THEMES, withBrandColor } from "@/components/video/flow/themes";
import type { FlowNode, Track, Vec } from "@/components/video/flow/types";
import { resolveTheme } from "@/lib/projects";
import { boundaryTransition, type SceneRecipe } from "@/lib/scene-recipe";
import type { ShotScript } from "@/lib/shots";

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

export async function runChecks(): Promise<Check[]> {
  assemble();
  transform();
  arrange();
  transitions();
  palette();
  return checks;
}
