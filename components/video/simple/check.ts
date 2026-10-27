import { type ReactNode, isValidElement } from "react";
import { Icon, resolveIcon } from "../icons";
import { conceptSettled } from "./concept";
import { type FitNote, noting } from "./fit";
import { geoOf } from "./geo";
import { type C, ICON_SLOT, type Play, keyIconOf } from "./kit";
import { TEMPLATE, clickOf } from "./more";
import { norm, thingAt } from "./scenes";
import { choices, grey, planOf, printOf, variantOk, wordsAlone } from "./select";
import { contrast, lookOf, themeOf } from "./theme";
import { ideaNeedsThings, GROUNDS, type Ground, type Reading, type Scene, type SimplePlan, type TemplateId, VARIANTS } from "./types";

// The plan checked before it is played, by code (no AI, no browser): every
// scene laid out once at its last frame, and what would go wrong found —
// words that do not fit their place, a line cut short, an icon the library
// has not got, the same thing twice on one screen, a scene that ends before
// it has settled, colours that do not read. Each problem is mended the way
// written for it (another variant, another template for the same beat,
// fewer words, shorter things, another ground) and the plan checked again,
// at most 3 rounds; the plan with the fewest problems is played.

export type Problem = { scene: number | null; kind: "words" | "cut" | "icon" | "twice" | "rushed" | "empty" | "colour" | "meaning" | "small" | "error"; detail: string };

// A template that means something the words do not say: a chart or a number
// with no number said, a prompt being typed that is not a question.
export function meaningOf(s: Scene): string | null {
  if ((s.template === "stat" || s.template === "chart") && !s.number) return `a ${s.template} with no number said`;
  if (s.template === "concept" && !s.concept) return "an idea with no idea to show";
  if (s.template === "concept" && ideaNeedsThings(s.concept, s.items.length)) return `an idea (${s.concept}) without its two things`;
  if (s.template === "kinetic" && s.variant === 1 && !/\?["'”’)]*$/.test(s.words.at(-1)?.t ?? "")) return "words typed as a prompt that ask nothing";
  return null;
}
// (a hero under this much of the frame is too small to carry its scene)
const SMALL = 0.12;
export type CheckReport = { rounds: number; fixed: string[]; left: string[] };

// (laid out with every spring settled; no logo image)
const SETTLED: Play = { spring: (() => 1) as unknown as Play["spring"], Img: (() => null) as unknown as Play["Img"] };

// when a scene has settled (everything in and still), as its template moves
// (frames; scenes.tsx and more.tsx), and how long it should then be held
const HOLD = 9;
export function settledAt(s: Scene): number {
  const n = s.items.length;
  const lastWord = (s.words.at(-1)?.at ?? s.from) + 14;
  const lastThing = n ? thingAt(s, n - 1, n) : s.from;
  const t = s.template, v = s.variant;
  const own =
    t === "trouble" ? (v === 1 ? lastThing + 18 : lastThing + 30 + (n - 1) * 6)
    : t === "compare" ? thingAt(s, n, n + 1) + 28 + (v === 2 ? n * 3 : 0)
    : t === "reveal" ? Math.max(s.from + 44, lastThing + 30)
    : t === "feature" ? (v === 2 ? s.from + 70 : (clickOf(s) ?? lastThing) + 10)
    : t === "stat" || t === "chart" ? Math.max(s.from + 48, n && t === "chart" && v === 2 ? lastThing + 27 : 0)
    : t === "messages" ? lastThing + 24
    : t === "steps" ? lastThing + 22
    : t === "bento" ? Math.max(s.from + 36, lastThing + 18)
    : t === "cta" ? (clickOf(s) ?? s.from) + 10
    : t === "screen" ? s.from + 30
    : t === "concept" ? conceptSettled(s)
    : s.from;
  return Math.max(lastWord, n ? lastThing + 18 : s.from, own);
}

// A template's elements, laid out without a browser: function components are
// called (the simple engine's have no hooks); icons are noted
function walk(node: ReactNode, icons: string[]): void {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, icons));
  if (!isValidElement(node)) return;
  const props = node.props as { children?: ReactNode; name?: string; path?: unknown };
  if (node.type === Icon && !props.path && !resolveIcon(props.name ?? "")) icons.push(props.name ?? "");
  if (typeof node.type === "function") return walk((node.type as (p: unknown) => ReactNode)(props), icons);
  walk(props.children, icons);
}

function sceneProblems(plan: SimplePlan, i: number, look: ReturnType<typeof lookOf>): Problem[] {
  const s = plan.scenes[i];
  const out: Problem[] = [];
  if (!s.words.length) out.push({ scene: i, kind: "empty", detail: "no words to show" });
  // laid out at its last frame (everything in)
  const c: C = { f: s.to - 1, s, look, pace: plan.theme.pace, brand: { ...plan.brand, icon: null }, g: geoOf(plan.w ?? 1920, plan.h ?? 1080), play: SETTLED };
  const icons: string[] = [];
  let notes: FitNote[] = [];
  let heroes: number[] = [];
  try {
    ({ notes, heroes } = noting(() => walk(TEMPLATE[s.template]({ c }), icons)));
  } catch (e) {
    out.push({ scene: i, kind: "error", detail: e instanceof Error ? e.message.slice(0, 120) : String(e) });
  }
  const said = norm(s.words.map((w) => w.t).join(" "));
  // (a fitting made twice — to measure, then to set — is one problem)
  for (const n of notes.filter((n, k) => !n.ok && notes.findIndex((m) => m.text === n.text && m.size === n.size) === k)) out.push({ scene: i, kind: norm(n.text.split(" ").filter((t) => t !== ICON_SLOT).join(" ")) === said ? "words" : "cut", detail: `"${n.text}" does not fit (${n.size}px)` });
  for (const name of new Set(icons)) out.push({ scene: i, kind: "icon", detail: `no icon "${name}"` });
  // the same thing twice on one screen: a thing that is the words shown, or two things alike
  const things = s.items.map((it) => norm(it.text));
  things.forEach((t, k) => {
    if (t && (t === said || things.indexOf(t) !== k)) out.push({ scene: i, kind: "twice", detail: `"${s.items[k].text}" twice on screen` });
  });
  // what it means, and how big its hero is
  const meaning = meaningOf(s);
  if (meaning) out.push({ scene: i, kind: "meaning", detail: meaning });
  if (heroes.length && Math.max(...heroes) < SMALL) out.push({ scene: i, kind: "small", detail: `its hero is ${Math.round(Math.max(...heroes) * 100)}% of the frame` });
  // settled, and held long enough to be read, before the scene ends
  const settled = settledAt(s);
  if (s.to - settled < HOLD) out.push({ scene: i, kind: "rushed", detail: `settles ${((settled + HOLD - s.to) / 30).toFixed(1)} s too late to be read` });
  return out;
}

// colours that read: the words on the ground, the keyword, a button's words, a card's accent
function colourProblems(look: ReturnType<typeof lookOf>): Problem[] {
  const out: Problem[] = [];
  const hex = (x: string) => /^#[0-9a-f]{6}$/i.test(x);
  const pairs: [string, string, number, string][] = [
    [look.ink, look.bg, 4.5, "the words on the ground"],
    // (on a plate: the ground's colour on the plate's)
    look.plate ? [look.bg, look.plateFill, 3, "the keyword on its plate"] : [look.accent, look.bg, 3, "the keyword on the ground"],
    [look.onAccent, look.accent, 3, "a button's words"],
    [look.panelAccent, look.panel, 3, "a card's accent"],
  ];
  for (const [a, b, ratio, what] of pairs) if (hex(a) && hex(b) && contrast(a, b) < ratio) out.push({ scene: null, kind: "colour", detail: `${what}: ${contrast(a, b).toFixed(1)}:1` });
  return out;
}

// a scene's look (its own ground, when it has one)
const lookIn = (plan: SimplePlan, i: number) => lookOf(themeOf(plan.theme, plan.scenes[i]), plan.brand.color);
// every ground the video is on, each with its colours checked (named when it is a scene's own)
function coloursOf(plan: SimplePlan): Problem[] {
  const grounds = [plan.theme.ground, ...new Set(plan.scenes.map((s) => s.ground).filter((g): g is Ground => !!g && g !== plan.theme.ground))];
  return grounds.flatMap((g, k) => colourProblems(lookOf({ ...plan.theme, ground: g }, plan.brand.color)).map((x) => (k ? { ...x, detail: `${g} background — ${x.detail}` } : x)));
}

// How much of the frame each scene's hero takes (null: the words alone), laid out at its last frame
export function heroShares(plan: SimplePlan): (number | null)[] {
  return plan.scenes.map((s, i) => {
    const look = lookIn(plan, i);
    const c: C = { f: s.to - 1, s, look, pace: plan.theme.pace, brand: { ...plan.brand, icon: null }, g: geoOf(plan.w ?? 1920, plan.h ?? 1080), play: SETTLED };
    try {
      const { heroes } = noting(() => walk(TEMPLATE[s.template]({ c }), []));
      return heroes.length ? Math.max(...heroes) : null;
    } catch {
      return null;
    }
  });
}

// one scene's problems (the editor asks this for every way a scene can be shown)
export const problemsOf = (plan: SimplePlan, i: number): Problem[] => sceneProblems(plan, i, lookIn(plan, i));
// the look's colours alone (the video's ground and any scene's own)
export const colourProblemsOf = (plan: SimplePlan): Problem[] => coloursOf(plan);

export function checkPlan(plan: SimplePlan): Problem[] {
  return [...coloursOf(plan), ...plan.scenes.flatMap((_, i) => sceneProblems(plan, i, lookIn(plan, i)))];
}

// ── mending ───────────────────────────────────────────────────────────────

const shortItems = (s: Scene, words: number, most = 3): Scene => ({ ...s, items: s.items.slice(0, most).map((it) => ({ ...it, text: it.text.split(/\s+/).slice(0, words).join(" ") })) });
// the words around the key one (at most `most`)
function fewerWords(s: Scene, most: number): Scene {
  if (s.words.length <= most) return s;
  const k = Math.max(0, s.words.findIndex((w) => w.key));
  const from = Math.max(0, Math.min(k - Math.floor((most - 1) / 2), s.words.length - most));
  const words = s.words.slice(from, from + most);
  return { ...s, words: words.map((w, j) => ({ ...w, t: j === 0 ? w.t.charAt(0).toUpperCase() + w.t.slice(1) : w.t })) };
}
// icons the library has (a thing without one shows the scene's)
const knownIcons = (s: Scene): Scene => ({ ...s, icon: resolveIcon(s.icon) ? s.icon : "sparkles", items: s.items.map((it) => (it.icon && !resolveIcon(it.icon) ? { ...it, icon: null } : it)) });
const unique = (s: Scene): Scene => {
  const said = norm(s.words.map((w) => w.t).join(" "));
  return { ...s, items: s.items.filter((it, k) => norm(it.text) !== said && s.items.findIndex((x) => norm(x.text) === norm(it.text)) === k) };
};

// what to try for a scene, in order: as it is mended where it can be, then
// another variant, then another template its beat can be played as
function candidates(plan: SimplePlan, i: number, kinds: Set<Problem["kind"]>, reading: Reading | undefined): Scene[] {
  const s = plan.scenes[i];
  const last = i === plan.scenes.length - 1;
  const base = [kinds.has("icon") ? knownIcons : null, kinds.has("twice") ? unique : null].reduce((x, f) => (f ? f(x) : x), s);
  const mended: Scene[] = [base];
  if (kinds.has("cut")) mended.push(shortItems(base, 2), shortItems(base, 2, 2));
  if (kinds.has("words")) mended.push(fewerWords(base, 4), fewerWords(base, 3));
  const variants = (x: Scene, t: TemplateId) => Array.from({ length: VARIANTS }, (_, v) => v).filter((v) => variantOk(t, v, x.items.length)).map((v) => ({ ...x, template: t, variant: v }));
  const out = mended.flatMap((x) => [x, ...variants(x, s.template).filter((y) => y.variant !== x.variant)]);
  if (!last && reading) {
    // (never the template of the scene before or after it)
    const near = new Set([plan.scenes[i - 1]?.template, plan.scenes[i + 1]?.template]);
    const others = choices(reading).filter(([t]) => t !== s.template && t !== "cta" && !near.has(t)).sort((a, b) => b[1] - a[1]);
    for (const [t] of others) for (const x of mended) out.push(...variants(x, t));
    // (the last resort: the words beside its icon, then the words alone)
    if (!near.has("statement")) out.push({ ...fewerWords(base, 4), template: "statement", variant: 1, items: [] }, { ...fewerWords(base, 4), template: "statement", variant: 0, items: [] });
  }
  return out;
}

// The lit word's icon kept only where it fits: a scene whose words fit
// without it but not with it goes without it (marked, so the film, its
// sounds and the editor all leave it out)
export function settleWordIcons(plan: SimplePlan): SimplePlan {
  let out = plan;
  plan.scenes.forEach((_, i) => (out = settleAt(out, i)));
  return out;
}
// (one scene)
function settleAt(plan: SimplePlan, i: number): SimplePlan {
  const s = plan.scenes[i];
  const bare = { ...s };
  delete bare.wordIcon;
  const fits = (sc: Scene) => !problemsOf({ ...plan, scenes: plan.scenes.map((x, k) => (k === i ? sc : x)) }, i).some((x) => x.kind === "words" || x.kind === "cut");
  const next = !keyIconOf(bare) || fits(bare) || !fits({ ...bare, wordIcon: false }) ? bare : { ...bare, wordIcon: false as const };
  return next.wordIcon === s.wordIcon ? plan : { ...plan, scenes: plan.scenes.map((x, k) => (k === i ? next : x)) };
}

// The plan mended (readings: the beats' readings, to play a beat another way)
export function repairPlan(plan: SimplePlan, readings?: Reading[]): { plan: SimplePlan; report: CheckReport } {
  const fixed: string[] = [];
  let p = plan;
  let rounds = 0;
  for (; rounds < 3; rounds++) {
    p = settleWordIcons(p);
    const problems = checkPlan(p);
    if (!problems.length) break;
    // colours: another ground that reads
    if (problems.some((x) => x.kind === "colour")) {
      const grounds = GROUNDS.filter((g) => g !== p.theme.ground && !(g === "brand" && grey(p.brand.color))) as Ground[];
      const ok = grounds.find((g) => !colourProblems(lookOf({ ...p.theme, ground: g }, p.brand.color)).length);
      if (ok) {
        fixed.push(`colours: ${p.theme.ground} ground → ${ok} (${problems.filter((x) => x.kind === "colour").map((x) => x.detail).join("; ")})`);
        p = { ...p, theme: { ...p.theme, ground: ok } };
      }
    }
    const bad = [...new Set(problems.filter((x) => x.scene !== null).map((x) => x.scene!))];
    for (const i of bad) {
      const look = lookIn(p, i);
      const now = sceneProblems(p, i, look);
      if (!now.length) continue;
      let best: { s: Scene; n: number } | null = null;
      for (const s of candidates(p, i, new Set(now.map((x) => x.kind)), readings?.[i])) {
        // (with its lit word's icon only if it fits)
        const trial = settleAt({ ...p, scenes: p.scenes.map((x, k) => (k === i ? s : x)) }, i);
        const n = sceneProblems(trial, i, look).length;
        if (!best || n < best.n) best = { s: trial.scenes[i], n };
        if (!n) break;
      }
      if (best && best.n < now.length) {
        const was = p.scenes[i];
        fixed.push(`scene ${i + 1}: ${now.map((x) => x.detail).join("; ")} → ${best.s.template} ${"ABC"[best.s.variant]}${best.s.words.length < was.words.length ? `, ${best.s.words.length} words` : ""}${best.s.items.length < was.items.length || best.s.items.some((it, k) => it.text !== was.items[k]?.text) ? ", shorter things" : ""}`);
        p = { ...p, scenes: p.scenes.map((x, k) => (k === i ? best!.s : x)) };
      }
    }
  }
  p = settleWordIcons(p);
  const left = checkPlan(p).map((x) => `${x.scene === null ? "video" : `scene ${x.scene + 1}`}: ${x.detail}`);
  return { plan: !fixed.length && !left.length ? p : { ...p, print: printOf(p.theme, p.scenes), check: { fixed, left } }, report: { rounds, fixed, left } };
}

// ── several drafts, the best kept ─────────────────────────────────────────

// A mended plan scored by code: problems left weigh most, then how much of
// the frame its heroes take, how few scenes are words alone, how many
// templates it uses, how many of its ideas it shows as them, and how little it had to be mended.
export function scoreOf(plan: SimplePlan): number {
  const body = plan.scenes.slice(0, -1);
  const heroes = heroShares(plan).filter((x): x is number => x != null);
  const hero = heroes.length ? heroes.reduce((a, x) => a + x, 0) / heroes.length : 0;
  const alone = body.filter((s) => wordsAlone(s.template, s.variant)).length / Math.max(1, body.length);
  const kinds = new Set(body.map((s) => s.template)).size / Math.max(1, body.length);
  // (a beat whose words picture an idea, shown as that idea)
  const ideas = body.filter((s) => s.concept);
  const shown = ideas.length ? ideas.filter((s) => s.template === "concept").length / ideas.length : 0;
  return -1000 * checkPlan(plan).length + 100 * hero - 60 * alone + 20 * kinds + 40 * shown - 2 * (plan.check?.fixed.length ?? 0);
}

// The video: `drafts` plans drawn (each unlike this customer's recent videos),
// each mended, the best scored kept.
export function bestPlan(args: Parameters<typeof planOf>[0] & { readings: Reading[]; drafts?: number }): { plan: SimplePlan; report: CheckReport; scores: number[] } {
  const { drafts = 8, ...draw } = args;
  let best: { plan: SimplePlan; report: CheckReport; score: number } | null = null;
  const scores: number[] = [];
  for (let k = 0; k < drafts; k++) {
    const { plan, report } = repairPlan(planOf({ ...draw, seed: (draw.seed + k * 104729) >>> 0 }), args.readings);
    const score = scoreOf(plan);
    scores.push(Math.round(score));
    if (!best || score > best.score) best = { plan, report, score };
  }
  return { plan: best!.plan, report: best!.report, scores };
}
