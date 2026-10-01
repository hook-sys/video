import type { CompileBrand } from "@/components/video/flow/compile";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { compositionCheck, type Violation } from "@/components/video/flow/composition-check";
import type { FlowPlan } from "@/components/video/flow/types";
import { validateFlowPlan } from "@/components/video/flow/validate";
import { repairCues, sceneScriptBlockers, type SceneScript } from "@/lib/scene-script";
import { BEHAVIOR_ACTION, type BehaviorReport, type Direction, type Dna, expandShots, type ShotScript } from "@/lib/shots";
import type { WordTiming } from "@/lib/voice-timing";

// Variant search: the same shots are built several ways (look, hand-over,
// entrances — lib/shots.ts ShotVariant), each is compiled on the real voice
// timing and measured, and the cleanest is kept. No model call: a few
// hundred milliseconds per variant. The first seed comes from the project,
// so two projects with the same script look different, while one project
// always rebuilds the same video.

export type SearchContext = { narration: string; words?: WordTiming[] | null; durationSeconds: number; screenshots?: number; brand: CompileBrand };
export type Candidate = { seed: number; script: SceneScript; plan: FlowPlan; violations: Violation[]; notes: string[]; score: number; shots?: ShotScript; behaviors?: BehaviorReport[] };

// How much each broken rule costs a variant (what a viewer notices most weighs
// most). Pacing (idle, long-scene) is the shots' cut, the same in every
// variant: not counted here (the Director's revision handles it).
const WEIGHT: Record<string, number> = { stacked: 10, "overlap-text": 10, "empty-frame": 8, crowded: 6, "lonely-icon": 6, "tiny-screens": 6, "camera-swing": 6, "no-hero": 5, idle: 0, "long-scene": 0 };

export const seedFrom = (text: string) => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 1_000_003;

export function scoreCandidate(violations: Violation[], plan: FlowPlan) {
  // ("nothing new on screen" is pacing too.)
  const cost = (v: Violation) => (v.rule === "quality" && v.detail.includes("nothing new") ? 0 : (WEIGHT[v.rule] ?? 3));
  return violations.reduce((s, v) => s + cost(v), 0) + 4 * (plan.resolved?.left.length ?? 0);
}

// What happened to the tries: how many were built, compiled and valid, and why the others failed.
export type SearchStats = { attempts: number; compiled: number; valid: number; failures: string[] };
export type SearchResult = { best: Candidate | null; picks: Candidate[]; blockers: string[]; tried: { seed: number; score: number; decor: string | null }[]; stats?: SearchStats };
// A broken DNA rule (the shots do not follow their direction's DNA) costs as
// much as a crowded frame.
const DNA_COST = 6;
// What customers kept: how often each look feature was downloaded
// (feature → value → count). Only the first of the picks follows it; the
// others explore, so the taste keeps learning.
export type Taste = Record<string, Record<string, number>>;
export const LOOK_FEATURES = ["decor", "tone", "icons", "cut", "side"] as const;
// What a download records (brief.taste.downloads): the look the taste counts
// and, since Phase 6.5, the creative direction chosen — structured data for later.
export const downloadEntry = (v: { seed: number; scene: SceneScript; variant?: string | null; direction?: Direction | null; dna?: Dna | null }, at: string) => ({ seed: v.seed, look: v.scene.look ?? null, at, selected_variant: v.variant ?? null, direction: v.direction ?? null, dna: v.dna ?? null });

const feature = (c: Candidate, f: (typeof LOOK_FEATURES)[number]) => String(c.script.look?.[f] ?? "");
// How many look features two variants do not share (0–5).
const distance = (a: Candidate, b: Candidate) => LOOK_FEATURES.filter((f) => feature(a, f) !== feature(b, f)).length;
export function tasteScore(c: Candidate, taste?: Taste | null) {
  if (!taste) return 0;
  return LOOK_FEATURES.reduce((s, f) => {
    const counts = taste[f] ?? {};
    const vals = Object.values(counts);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return s + Math.log(((counts[feature(c, f)] ?? 0) + 1) / (mean + 1));
  }, 0);
}

// Builds the shots `tries` ways and keeps `pick` of them: the cleanest, and
// among equally clean ones those that look most unlike each other (a
// different background, icons, hand-over, side). The first pick is the one
// the taste likes best.
export function searchVariants(shots: ShotScript, ctx: SearchContext, baseSeed: number, { tries = 14, pick = 4, taste = null }: { tries?: number; pick?: number; taste?: Taste | null } = {}): SearchResult {
  const tried: SearchResult["tried"] = [];
  const all: Candidate[] = [];
  let blockers: string[] = [];
  const stats: SearchStats = { attempts: 0, compiled: 0, valid: 0, failures: [] };
  for (let k = 0; k < tries; k++) {
    const seed = (baseSeed + k * 7919) % 1_000_003;
    const notes: string[] = [];
    const behaviors: BehaviorReport[] = [];
    stats.attempts++;
    // Cues the voice says differently are matched, not fatal (repairCues).
    const fixed = repairCues(expandShots(shots, notes, ctx.narration, { seed }, behaviors), ctx.narration, ctx.words, ctx.durationSeconds);
    const script = fixed.script;
    notes.push(...fixed.notes);
    const blocked = sceneScriptBlockers(script, ctx.narration, ctx.words, ctx.durationSeconds);
    if (blocked.length) {
      // The words decide these, not the variant: another try will not help.
      blockers = blocked;
      stats.failures.push(`blocked: ${blocked[0]}`.slice(0, 160));
      break;
    }
    let plan: FlowPlan;
    try {
      plan = compileSceneScript(script, { narration: ctx.narration, words: ctx.words, durationSeconds: ctx.durationSeconds, brand: ctx.brand });
    } catch (e) {
      stats.failures.push(`compile: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160));
      continue;
    }
    stats.compiled++;
    // A behavior whose beat the schedule could not place is not "applied".
    for (const x of behaviors) {
      if (x.status !== "dropped" && plan.skipped?.some((k) => k.cue === x.cue && k.action === BEHAVIOR_ACTION[x.type as keyof typeof BEHAVIOR_ACTION])) {
        x.status = "dropped";
        x.reason = "timing-conflict";
      }
    }
    const invalid = validateFlowPlan(plan);
    if (invalid.length) {
      stats.failures.push(`invalid plan: ${invalid[0]}`.slice(0, 160));
      continue;
    }
    stats.valid++;
    const violations = compositionCheck(script, plan, { narration: ctx.narration, words: ctx.words, durationSeconds: ctx.durationSeconds, screenshots: ctx.screenshots });
    const score = scoreCandidate(violations, plan) + DNA_COST * notes.filter((n) => n.startsWith("dna:")).length;
    tried.push({ seed, score, decor: script.look?.decor ?? null });
    all.push({ seed, script, plan, violations, notes, score, shots, behaviors });
    // Enough clean ones to choose from: stop early.
    if (all.filter((c) => c.score === 0).length >= pick * 3) break;
  }
  if (!all.length) return { best: null, picks: [], blockers, tried, stats };
  const floor = Math.min(...all.map((c) => c.score));
  // The pool: the cleanest variants (and, if too few, the next cleanest).
  const pool = [...all].sort((a, b) => a.score - b.score).filter((c, i) => c.score === floor || i < pick);
  const first = [...pool].filter((c) => c.score === floor).sort((a, b) => tasteScore(b, taste) - tasteScore(a, taste))[0];
  const picks = [first];
  while (picks.length < Math.min(pick, pool.length)) {
    const rest = pool.filter((c) => !picks.includes(c));
    // How different: features whose value no pick has yet (a new background,
    // new icons…), then the fewest features shared with the nearest pick.
    const fresh = (c: Candidate) => LOOK_FEATURES.filter((f) => !picks.some((p) => feature(p, f) === feature(c, f))).length;
    const far = (c: Candidate) => fresh(c) * 10 + Math.min(...picks.map((p) => distance(c, p)));
    rest.sort((a, b) => a.score - b.score || far(b) - far(a));
    // Clean first; among the cleanest, the most different.
    const best = rest.filter((c) => c.score === rest[0].score).sort((a, b) => far(b) - far(a))[0];
    picks.push(best);
  }
  return { best: picks[0], picks, blockers, tried, stats };
}

// The single best variant (the first pick).
export function searchShots(shots: ShotScript, ctx: SearchContext, baseSeed: number, tries = 8): SearchResult {
  return searchVariants(shots, ctx, baseSeed, { tries, pick: 1 });
}

// ── Phase 6.5: four creative directions ──
// The 14 tries are shared by the Director's directions (A–D: 4, 4, 3, 3);
// each direction keeps its cleanest try, then the four are checked for
// being genuinely different stories. A look (background, colours, icons,
// transitions, side) never counts as a difference.

const STOP = new Set("the a an and or of to in on with for from into then than this that your their its it is are be as at by one each every more most very".split(" "));
const wordsOf = (t: string | null | undefined) => new Set((t ?? "").toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? []);
const jaccard = <T,>(a: Set<T>, b: Set<T>) => {
  if (!a.size && !b.size) return 1;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
};
// How much of two sequences runs in the same order (longest common subsequence).
const sequence = (a: string[], b: string[]) => {
  if (!a.length && !b.length) return 1;
  const d = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  return d[a.length][b.length] / Math.max(a.length, b.length);
};
const assetsOf = (s: ShotScript) => new Set(s.shots.flatMap((x) => [x.subject, x.card && `card:${x.card}`, ...(x.items ?? []).map((i) => i.asset)]).filter((x): x is string => !!x));
const behaviorsOf = (s: ShotScript) => new Set(s.shots.flatMap((x) => (x.objects ?? []).map((o) => o.behavior?.type).filter((t): t is string => !!t)));
const layoutsOf = (sc: SceneScript | undefined, s: ShotScript) => (sc ? sc.beats.filter((b) => b.action === "scene").map((b) => b.layout ?? "") : s.shots.map((x) => x.shot));

export const CREATIVE_PARTS = ["concept", "metaphor", "hero", "story", "shots", "assets", "behavior", "camera", "composition"] as const;
// built: only what is actually on screen (shot sequence, assets, heroes,
// behaviors, layouts) — the director's words cannot argue it away.
export type CreativeSimilarity = { total: number; built: number; parts: Record<(typeof CREATIVE_PARTS)[number], number> };
// 0 (nothing shared) … 1 (the same creative). Text parts compare the
// direction's own words; the rest compare what is actually built.
export function creativeSimilarity(a: ShotScript, b: ShotScript, sa?: SceneScript, sb?: SceneScript): CreativeSimilarity {
  const da = a.direction;
  const db = b.direction;
  // (no direction on either — an older script: only what is built compares)
  const text = (f: (d: NonNullable<ShotScript["direction"]>) => string, built: number) => (da && db ? (jaccard(wordsOf(f(da)), wordsOf(f(db))) + built) / 2 : built);
  const kinds = sequence(a.shots.map((x) => x.shot), b.shots.map((x) => x.shot));
  const assets = jaccard(assetsOf(a), assetsOf(b));
  const heroes = jaccard(new Set((a.concepts ?? []).map((c) => c.hero).concat(a.shots.map((x) => x.subject ?? "").filter(Boolean))), new Set((b.concepts ?? []).map((c) => c.hero).concat(b.shots.map((x) => x.subject ?? "").filter(Boolean))));
  const parts = {
    // (what each concept shows, when both wrote concepts)
    concept: a.concepts?.length && b.concepts?.length ? text((d) => d.concept, jaccard(wordsOf(a.concepts.map((c) => c.see).join(" ")), wordsOf(b.concepts.map((c) => c.see).join(" ")))) : da && db ? jaccard(wordsOf(da.concept), wordsOf(db.concept)) : kinds,
    metaphor: text((d) => d.metaphor, assets),
    hero: text((d) => d.hero, heroes),
    story: text((d) => `${d.story} ${d.opening} ${d.ending}`, kinds),
    shots: text((d) => d.shot_approach, kinds),
    assets: text((d) => d.assets, assets),
    behavior: text((d) => d.motion, jaccard(behaviorsOf(a), behaviorsOf(b))),
    camera: text((d) => d.camera, sequence(a.shots.map((x) => x.camera ?? "-"), b.shots.map((x) => x.camera ?? "-"))),
    composition: sequence(layoutsOf(sa, a), layoutsOf(sb, b)),
  };
  const composition = parts.composition;
  const built = (kinds + assets + heroes + jaccard(behaviorsOf(a), behaviorsOf(b)) + composition) / 5;
  return { total: CREATIVE_PARTS.reduce((t, k) => t + parts[k], 0) / CREATIVE_PARTS.length, built, parts };
}
// Above these, two videos are the same creative (another look of one idea):
// alike overall, or the same shots built under other words.
export const MAX_CREATIVE_SIMILARITY = 0.6;
export const MAX_BUILT_SIMILARITY = 0.75;
export const sameCreative = (s: CreativeSimilarity) => s.total > MAX_CREATIVE_SIMILARITY || s.built > MAX_BUILT_SIMILARITY;

// ── Visual DNA similarity ──
// Nine dimensions: the eight DNA fields plus the shot sequence actually
// built. Structural ones weigh most; the icon style is nearly a look.
export const DNA_DIMS = ["composition", "cards", "typography", "motion", "transitions", "camera", "background", "shots", "icons"] as const;
const DNA_WEIGHT: Record<(typeof DNA_DIMS)[number], number> = { composition: 3, cards: 2, typography: 2, motion: 2, shots: 2, transitions: 1.5, camera: 1.5, background: 1.5, icons: 0.5 };
export const MIN_DNA_DIFFERENT = 6;
export const MAX_DNA_SHARED = 0.4; // share of the weight two directions may have in common
export type DnaSimilarity = { same: string[]; different: string[]; shared: number };
export function dnaSimilarity(a: ShotScript, b: ShotScript): DnaSimilarity | null {
  if (!a.dna || !b.dna) return null;
  const same = DNA_DIMS.filter((d) => (d === "shots" ? sequence(a.shots.map((x) => x.shot), b.shots.map((x) => x.shot)) > 0.7 : a.dna![d] === b.dna![d]));
  const total = DNA_DIMS.reduce((t, d) => t + DNA_WEIGHT[d], 0);
  return { same, different: DNA_DIMS.filter((d) => !same.includes(d)), shared: same.reduce((t, d) => t + DNA_WEIGHT[d], 0) / total };
}
// The same visual system: fewer than 6 of 9 dimensions differ, the same
// composition, or too much structural weight in common.
export const sameDna = (d: DnaSimilarity) => d.different.length < MIN_DNA_DIFFERENT || d.same.includes("composition") || d.shared > MAX_DNA_SHARED;

// What the search did with each direction (kept on the project, small).
export type DirectionDiagnostics = {
  direction_id: string;
  dna: ShotScript["dna"];
  candidate_attempts: number;
  compiled_count: number;
  valid_count: number;
  rejected_count: number;
  rejection_reasons: string[];
  blocker_reasons: string[];
  quality_score: number | null;
  diversity_score: number | null; // highest similarity to a video already chosen
  selected: boolean;
  rejected_against_variant: string | null;
  similarity_dimensions: string[]; // DNA dimensions shared with that video
  dna_violations: string[];
  behaviors: { applied: number; delayed: number; dropped: number; reasons: Record<string, number> };
};
export const INSUFFICIENT_VISUAL_DIVERSITY = "INSUFFICIENT_VISUAL_DIVERSITY";
export type CreativeResult = SearchResult & { insufficient: boolean; status: "ok" | typeof INSUFFICIENT_VISUAL_DIVERSITY; skipped: { variant: string; reason: string }[]; diagnostics: DirectionDiagnostics[] };
export function searchCreative(scripts: ShotScript[], ctx: SearchContext, baseSeed: number, { tries = 14, pick = 4, taste = null }: { tries?: number; pick?: number; taste?: Taste | null } = {}): CreativeResult {
  const k = Math.max(1, scripts.length);
  const tried: SearchResult["tried"] = [];
  const skipped: CreativeResult["skipped"] = [];
  const bests: Candidate[] = [];
  const diagnostics: DirectionDiagnostics[] = [];
  let blockers: string[] = [];
  scripts.forEach((shots, i) => {
    // (each direction its own seeds; all of them together at most `tries`)
    const n = Math.floor(tries / k) + (i < tries % k ? 1 : 0);
    const id = shots.variant ?? String.fromCharCode(65 + i);
    const r: SearchResult = n ? searchVariants(shots, ctx, (baseSeed + i * 104_729) % 1_000_003, { tries: n, pick: 1, taste }) : { best: null, picks: [], blockers: [], tried: [], stats: { attempts: 0, compiled: 0, valid: 0, failures: ["no tries left"] } };
    tried.push(...r.tried);
    const st = r.stats ?? { attempts: 0, compiled: 0, valid: 0, failures: [] };
    const reasons: Record<string, number> = {};
    for (const x of r.best?.behaviors ?? []) if (x.status === "dropped") reasons[x.reason ?? "?"] = (reasons[x.reason ?? "?"] ?? 0) + 1;
    diagnostics.push({
      direction_id: id,
      dna: shots.dna ?? null,
      candidate_attempts: st.attempts,
      compiled_count: st.compiled,
      valid_count: st.valid,
      rejected_count: st.attempts - st.valid,
      rejection_reasons: [...new Set(st.failures)].slice(0, 4),
      blocker_reasons: r.blockers.slice(0, 3),
      quality_score: r.best?.score ?? null,
      diversity_score: null,
      selected: false,
      rejected_against_variant: null,
      similarity_dimensions: [],
      dna_violations: (r.best?.notes ?? []).filter((x) => x.startsWith("dna:")).map((x) => x.slice(5)).slice(0, 4),
      behaviors: { applied: (r.best?.behaviors ?? []).filter((x) => x.status === "applied").length, delayed: (r.best?.behaviors ?? []).filter((x) => x.status === "delayed").length, dropped: (r.best?.behaviors ?? []).filter((x) => x.status === "dropped").length, reasons },
    });
    if (r.best) bests.push(r.best);
    else {
      skipped.push({ variant: id, reason: r.blockers.length ? `blocked: ${r.blockers.slice(0, 2).join("; ")}` : "no try compiled" });
      if (r.blockers.length) blockers = blockers.length ? blockers : r.blockers.map((b) => `direction ${id}: ${b}`);
    }
  });
  const diag = (c: Candidate) => diagnostics.find((d) => d.direction_id === c.shots?.variant);
  // Cleanest first (then the taste); a direction joins only if its story AND
  // its visual DNA are unlike every one already chosen — diversity never
  // outranks quality, and a direction is never shown twice.
  const order = [...bests].sort((a, b) => a.score - b.score || tasteScore(b, taste) - tasteScore(a, taste));
  const picks: Candidate[] = [];
  for (const c of order) {
    const d = diag(c);
    const sims = picks.map((p) => ({ p, story: creativeSimilarity(p.shots!, c.shots!, p.script, c.script), dna: dnaSimilarity(p.shots!, c.shots!) }));
    if (d) d.diversity_score = sims.length ? Math.round(Math.max(...sims.map((x) => x.story.total)) * 100) / 100 : null;
    if (picks.length >= pick) {
      if (d) d.rejection_reasons.push("four videos were already chosen");
      continue;
    }
    const id = c.shots?.variant ?? null;
    const twin = sims.find((x) => (id !== null && x.p.shots?.variant === id) || sameCreative(x.story) || (x.dna && sameDna(x.dna)));
    if (twin) {
      const why =
        twin.p.shots?.variant === id
          ? `the same direction as ${id}`
          : twin.dna && sameDna(twin.dna)
            ? `same visual DNA as ${twin.p.shots?.variant ?? "?"} (shares ${twin.dna.same.join(", ") || "nothing"}; ${twin.dna.different.length}/9 differ)`
            : `too close to ${twin.p.shots?.variant ?? "?"} (similarity ${twin.story.total.toFixed(2)}, built ${twin.story.built.toFixed(2)})`;
      skipped.push({ variant: id ?? "?", reason: why });
      if (d) {
        d.rejection_reasons.push(why);
        d.rejected_against_variant = twin.p.shots?.variant ?? null;
        d.similarity_dimensions = twin.dna?.same ?? [];
      }
      continue;
    }
    if (d) d.selected = true;
    picks.push(c);
  }
  const insufficient = picks.length < pick;
  if (insufficient) console.warn(`${INSUFFICIENT_VISUAL_DIVERSITY}:`, { directions: scripts.length, kept: picks.map((p) => p.shots?.variant), skipped });
  return { best: picks[0] ?? null, picks, blockers: picks.length ? [] : blockers, tried, insufficient, status: insufficient ? INSUFFICIENT_VISUAL_DIVERSITY : "ok", skipped, diagnostics };
}
