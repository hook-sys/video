import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { countUsage, textAi } from "@/lib/ai/models";
import { HOUSE_RULES, extraRules } from "@/lib/ai/house-rules";
import { DISPLAY_FACES, TEXT_FACES } from "@/components/video/composer/art";
import { IN_USE, LANGUAGES, LANGUAGE_NOTES, type Language } from "@/components/video/composer/staging";
import { SHOWN } from "@/components/video/composer/highlight";
import { MIN_SCENE } from "@/components/video/composer/layout";
import { ARRANGES, CARD_VARIANTS, CHART_VARIANTS, DEVICE_VARIANTS, FIELDS, FLOW_VARIANTS, ITEM_KINDS, LAYOUTS, type ScriptT, type Word } from "@/components/video/composer/types";
import { type Ideas, composeVariants } from "@/components/video/composer/variants";
import { BEATS, BRAND_CATEGORIES, type BrandProfile, type CreativePlan, LANGUAGE_WEIGHTS, MOODS, type Mood, ruleCreative, ruleProfile, sentencesOf } from "@/lib/studio";
import { FPS } from "@/components/video/composer/types";
import { USE_NOTE, type Use } from "@/lib/project-details";

// The directors of a video. The Story Analyst reads the script first, deeply
// (who it speaks to, the pain, the promise, the proof) and splits it into
// scenes long enough to be seen, each with what it means and what to show.
// The Motion Director then plans the video on that breakdown. In one answer it decides
// everything a studio decides — the brand (what it is, its mood and look),
// the concept (the one idea, the motif, where the story turns, the hero
// moment), the staging (one camera language; dark, light, or dark until the
// turn), the art direction, and every scene — so no decision is made twice
// and nothing it decides is undone by another. It plans from the script
// alongside the voice; once the voice is timed it reviews its own plan with
// what our layout check found (twice when problems remain). Its plan
// is split here into the parts the Composer builds from (a brand profile, a
// creative plan, the scenes). Never throws: no model or a bad answer → the
// plan by rule (lib/studio.ts) and the Composer's own scenes.

const BRAND_PART = `1. BRAND — read what we know of the brand (its website's words, its name and colour, the script). Be specific to THIS brand; use only what the material says, never invent features, numbers or claims.
- category: one of ${BRAND_CATEGORIES.join(", ")}.
- personality: 3 adjectives for the brand's character. mood: one of ${MOODS.join(", ")}. audience: who the video speaks to, a few words. promise: the one thing the product promises, one short line.
- features: up to 3 the material names (2–4 words each). before: up to 3 old ways it replaces ("phone calls", "spreadsheets").
- keywords: up to 6 words from the SCRIPT that carry its meaning (exact words). numbers: the numbers the SCRIPT says, exactly as said; [] when none.
- look: face geometric|humanist|serif|condensed|rounded|wide (the headline type that suits the character), energy 0.2–0.85 (calm → low).`;

const CONCEPT_PART = `2. CONCEPT — what the whole video is built on:
- idea: the ONE idea, one line — a concrete visual concept for THIS brand, not a slogan ("the clinic's day as a calendar that fills itself").
- motif: one thing that comes back through the video: { icon (a Lucide icon that pictures it literally), label (1–3 words) } — show it in 2–3 scenes.
- turn: the word index where the product arrives and the story turns from the problem.
- hero: the word index of the hero moment — the strongest moment (usually the product's result or a spoken number); its scene has one big thing, few words, and is held.
- beats: one per sentence, in order: { at: the sentence's first word index, beat: ${BEATS.join("|")} }.
AVOID the ideas and camera languages listed under EARLIER (this brand's earlier videos).`;

const STAGING_PART = `3. STAGING — how the whole video moves (the camera and the ways between scenes are drawn from it; you picture the scenes):
- language: ONE camera language for the whole video (variety is between videos, never inside one):
${IN_USE.map((l) => `  ${l}: ${LANGUAGE_NOTES[l]}`).join("\n")}
- journey: for line|carry|words|guide, the canvas path right|zigzag|down|diagonal|snake; else null. guide: for guide, plane|cursor|orb; else null.
- recap: true to end by pulling back over the whole way the video came (canvas languages only).
- scheme: dark|light — ONE background for the whole video, never changing (the only place dark or light is decided; never mixed).`;

const ART_PART = `4. ART — exactly 1 "art" in "arts", the one visual identity that suits THIS brand:
{ name (2–3 words), hue 0–360 (close to the brand colour unless another serves the story better), harmony mono|analogous|complement|split|triad, field ${FIELDS.join("|")}, overlay none|grain|particles|sheen|vignette|lines, surface glass|solid|outline|soft|tinted|ink, radius 0–40, display (headline face) one of: ${DISPLAY_FACES.map((f) => f.slug).join(", ")}, text (UI face) one of: ${TEXT_FACES.map((f) => f.slug).join(", ")}, weight 500–850, case sentence|upper|lower, tracking -0.05..0.02, key color|pill|underline|gradient|box|outline|italic|glow, motion soft|snappy|springy|glide, pace 0.85–1.25, camera drift|push|pull|tilt|float|orbit|rise, icons tile|round|bare|duotone|outline|glass, energy 0.2–0.85 }.
Taste: condensed faces (oswald, bebas-neue, anton, big-shoulders-display) only in upper case; serif faces with sentence case and italic/underline/color keys; wide faces (unbounded, krona-one, dela-gothic-one) with smaller sizes. AVOID the faces and fields listed under SEEN (this customer has seen them).`;

const SCENES_PART = `5. SCENES — the narration is final; its words are given numbered (index:word). You decide every scene — nothing is a template.
- A scene starts on a word ("at": the index of its first word) and lasts until the next scene. Scenes follow the narration in order and cover it all; the first starts at 0. EVERY scene is at least 3 seconds of speech (about 8 words or more) so the viewer can see it: a short sentence or question ("Why should you?") joins the sentence before or after it. 15 s → 3–5 scenes, 30 s → 6–8, 60 s → 10–14. Follow the Story Analyst's scene split when one is given.
- "text": the words shown on screen as kinetic type: { from, to } word indexes inside the scene — the scene's whole sentence or clause when it is ${SHOWN} words or fewer, else its key clause (a complete phrase that ends where the voice pauses, never cut mid-phrase like "Install in two minutes and get"); "size" s|m|l|xl (xl for short punchy lines); "key": 1–2 words of it to light up (exact words). null for a scene that is pictured only (rare).
- "kicker": optional 1–3 word eyebrow above the text ("Step 1", the product's name, "Before") or null.
- "options": exactly ONE — the best way to picture the scene: { layout, arrange, items }, picturing THAT scene's words literally.
LAYOUTS: center (text above things), top (text band on top, big things below), bottom, split-left (text left, things right), split-right, corner, type (only big kinetic text; no things except a badge), visual (things fill the frame, text as a caption), over (text on a glass plate over a big thing).
COMPOSED LAYOUTS (the words composed WITH the things — use them often): inline (an icon beside the words on one line — needs an icon item), label (the words as the label on top of a card, a phone or a chart), caption (one card/phone/chart fills the frame, the words a small caption on a plate in a corner), around (the words in the middle, 2–4 small things around them), between (the words between two things, one left, one right).
Never the same layout twice in a row, and no layout more than twice in a video (the closing ask aside).
ARRANGE (for 2+ things): ${ARRANGES.join(", ")}.
ITEMS. Every item: { kind, at (word index it appears on, inside the scene), hit (word index of its moment or null), id (same id on an item in the NEXT scene = it travels there: a match cut; else null), variant, title, sub, icon, value, values, rows, screen, size (s|m|l), tilt (-12..12 or 0), enter (null) }.
- card: the product's UI as a clean card. variant: ${CARD_VARIANTS.join(", ")}. title (screen name), icon, rows: 2–5 realistic rows { title, meta, tag, icon } for THIS product (never lorem ipsum), value (a total when the variant shows one). hit: the word where its moment happens (a row is checked, the invoice is stamped paid).
- device: variant ${DEVICE_VARIANTS.join(", ")}; screen: one card variant shown on it (+ title, icon, rows as for a card).
- chips: 2–5 pills (rows with title + icon); variant row|column — a list spoken in the words.
- flow: variant ${FLOW_VARIANTS.join(", ")}: things joined by lines (rows title + icon). steps: 2–4 numbered steps (rows).
- stat: one big number — value MUST be a number the narration says; title: what it is.
- chart: variant ${CHART_VARIANTS.join(", ")}; values: 5–9 numbers rising/falling as the words say; value only if spoken; ring/progress: values [percent].
- compare: before vs after: rows { title: the old way, meta: the new way }; sub: the product's name; hit: when the old way is struck out.
- icon: one big icon (+ optional title 1–2 words). badge: a small pill on a corner of a thing: icon + title (2–3 words) or value.
- logo: the brand's mark and name (the product reveal). button: the call to action (title: the CTA text, sub: the website); hit: the click.
- avatars: people as initials only. quote: a short testimonial (title) by sub (a name). shape: decoration (ring, orb, arrow, spark, grid, line, plus, wave, star, burst, hex).
Icons: Lucide names that picture the thing LITERALLY. Never people, faces, hands or animals.
- 1–2 main items per scene (a badge may be added): ONE focal point, big (size l for the main thing). Fewer, bigger things read better; never a small thing lost in a big frame.
- Every icon item names a Lucide icon (never null) and its title is 1–2 words that NAME the thing (never a feeling like "Restless").
- UI rows and titles are specific to THIS product and its customers (the customer's own features, real-sounding items for this business) — never placeholders ("Jane Doe", "John Doe", "Product X", "Order #12345", "Lorem", "Acme").
- The old way (what customers used before) appears ONLY in the problem scenes before the turn — never beside the product's features after it. A phone/browser/laptop for "the app does X" moments; chips/flow/steps for spoken lists; stat/chart only for spoken numbers; compare for "no more …"; logo when the product is named first; button on the closing line.
- Never write on screen a number or claim the narration does not make (UI rows may carry realistic sample data).
- Build every scene inside your concept and staging: the motif in 2–3 scenes, before the turn the problem and from it the product, the hero scene the strongest.`;

export const MOTION_INSTRUCTIONS = `You are the motion director of a studio known for premium explainer videos for software products (the style of premium SaaS launch videos: kinetic type, the product's UI drawn as clean cards, calm fields, a smooth camera). You alone direct the whole video and write its complete plan in five parts, all consistent with each other.

Work like a senior director, deeply: first analyse the material — who watches, the pain they feel, what the product promises, the proof, the one feeling the video leaves — then design every scene from that analysis. Premium means: one focal point per scene, generous space, a clear hierarchy (the words, then the thing), every scene held long enough to be seen, nothing generic, nothing crowded, every detail specific to THIS brand. Before you answer, check each scene against the narration and these rules; fix it if it fails.

${BRAND_PART}

${CONCEPT_PART}

${STAGING_PART}

${ART_PART}

${SCENES_PART}`;

// ── what the Motion Director writes ────────────────────────────────────────
const n = <T extends z.ZodTypeAny>(t: T) => t.nullable();
const BrandM = z.object({
  category: z.enum(BRAND_CATEGORIES),
  personality: z.array(z.string()),
  mood: z.enum(MOODS),
  audience: z.string(),
  promise: z.string(),
  features: z.array(z.string()),
  before: z.array(z.string()),
  keywords: z.array(z.string()),
  numbers: z.array(z.string()),
  look: z.object({ face: z.enum(["geometric", "humanist", "serif", "condensed", "rounded", "wide"]), energy: z.number() }),
});
const ConceptM = z.object({ idea: z.string(), motif: z.object({ icon: z.string(), label: z.string() }), turn: z.number(), hero: z.number(), beats: z.array(z.object({ at: z.number(), beat: z.enum(BEATS) })) });
const StagingM = z.object({
  language: z.enum(LANGUAGES),
  journey: n(z.enum(["right", "zigzag", "down", "diagonal", "snake"])),
  guide: n(z.enum(["plane", "cursor", "orb"])),
  recap: z.boolean(),
  scheme: z.enum(["dark", "light", "mixed"]),
});
const RowM = z.object({ title: z.string(), meta: n(z.string()), tag: n(z.string()), icon: n(z.string()) });
const ItemM = z.object({
  kind: z.enum(ITEM_KINDS),
  at: z.number(),
  hit: n(z.number()),
  id: n(z.string()),
  variant: n(z.string()),
  title: n(z.string()),
  sub: n(z.string()),
  icon: n(z.string()),
  value: n(z.string()),
  values: n(z.array(z.number())),
  rows: n(z.array(RowM)),
  screen: n(z.string()),
  size: n(z.enum(["s", "m", "l"])),
  tilt: n(z.number()),
  enter: n(z.string()),
});
const OptionM = z.object({ layout: z.enum(LAYOUTS), arrange: n(z.enum(ARRANGES)), items: z.array(ItemM) });
const SceneM = z.object({ at: z.number(), text: n(z.object({ from: z.number(), to: z.number(), size: z.enum(["s", "m", "l", "xl"]), key: z.array(z.string()) })), kicker: n(z.string()), options: z.array(OptionM) });
// (no scheme: the staging decides dark or light)
const ArtM = z.object({ name: z.string(), hue: z.number(), harmony: z.string(), field: z.string(), overlay: z.string(), surface: z.string(), radius: z.number(), display: z.string(), text: z.string(), weight: z.number(), case: z.string(), tracking: z.number(), key: z.string(), motion: z.string(), pace: z.number(), camera: z.string(), icons: z.string(), energy: z.number() });
export const MotionModel = z.object({ brand: BrandM, concept: ConceptM, staging: StagingM, arts: z.array(ArtM), scenes: z.array(SceneM) });
type Answer = z.infer<typeof MotionModel>;

// What the Composer builds from: the brand's profile, the creative plan, the scenes.
export type MotionPlan = { profile: BrandProfile; creative: CreativePlan; ideas: Ideas | null; source: "ai" | "rule" };
export type MotionResult = { plan: MotionPlan; problems: string[]; ms: number; analysis?: Analysis | null };
export type MotionInput = {
  name: string;
  color: string;
  cta: string;
  url?: string;
  product?: string | null;
  // the narration's words (the script's own words; times are the voice's once it is made)
  words: Word[];
  website?: { url?: string | null; title?: string | null; description?: string | null; text?: string | null } | null;
  category?: string | null;
  seen?: { display: string[]; field: string[] };
  earlier?: { idea: string; language: Language | null }[];
  // this brand's profile from an earlier video (kept consistent)
  known?: BrandProfile | null;
  never?: string | null;
  // what the customer told us in the form (facts, not guesses)
  customer?: Customer | null;
  // the Story Analyst's breakdown (made first; the Director plans on it)
  analysis?: Analysis | null;
  seed: number;
};
export type Customer = { audience: string; features: string[]; before: string[]; mood: Mood; use: Use };

// The customer's answers win over what the Director (or the rule) read from the script.
const withCustomer = (p: BrandProfile, c: Customer | null | undefined): BrandProfile =>
  c ? { ...p, audience: c.audience.slice(0, 60) || p.audience, features: c.features.length ? c.features.slice(0, 3) : p.features, before: c.before.length ? c.before.slice(0, 3) : p.before, mood: c.mood } : p;

const narrationOf = (words: Word[]) => words.map((w) => w.text).join(" ");

// The plan by rule (no model, or a model that failed): the Composer pictures the scenes.
export function rulePlan(input: Pick<MotionInput, "name" | "words" | "website" | "category" | "known" | "earlier" | "seed" | "customer">): MotionPlan {
  const profile = withCustomer(input.known ?? ruleProfile({ name: input.name, script: narrationOf(input.words), category: input.category, website: input.website }), input.customer);
  const creative = ruleCreative(profile, input.words, input.name, input.seed, (input.earlier ?? []).map((e) => e.language));
  return { profile, creative, ideas: null, source: "rule" };
}

// ── the answer, mended ─────────────────────────────────────────────────────
function profileOf(o: Answer["brand"], script: string, category: string | null | undefined, scheme: BrandProfile["look"]["scheme"]): BrandProfile {
  // what the script really says (a number or keyword it does not say is dropped)
  const said = script.toLowerCase();
  return {
    category: category && (BRAND_CATEGORIES as readonly string[]).includes(category) ? (category as BrandProfile["category"]) : o.category,
    personality: o.personality.slice(0, 3).map((x) => x.slice(0, 24)),
    mood: o.mood,
    audience: o.audience.slice(0, 60),
    promise: o.promise.slice(0, 120),
    features: o.features.slice(0, 3).map((x) => x.slice(0, 40)),
    before: o.before.slice(0, 3).map((x) => x.slice(0, 40)),
    keywords: o.keywords.filter((k) => said.includes(k.toLowerCase())).slice(0, 6),
    numbers: o.numbers.filter((k) => said.includes(k.toLowerCase())).slice(0, 4),
    look: { scheme, face: o.look.face, energy: Math.max(0.2, Math.min(0.85, o.look.energy)) },
    source: "ai",
  };
}

function creativeOf(o: Answer, nWords: number, fallback: CreativePlan): CreativePlan {
  const inRange = (i: number, d: number) => (Number.isFinite(i) && i >= 0 && i < nWords ? Math.round(i) : d);
  const beats = o.concept.beats.filter((b) => b.at >= 0 && b.at < nWords).sort((a, b) => a.at - b.at);
  const s = o.staging;
  const path = ["line", "carry", "words", "guide"].includes(s.language);
  return {
    idea: o.concept.idea.slice(0, 160),
    motif: o.concept.motif.icon ? { icon: o.concept.motif.icon.slice(0, 40), label: o.concept.motif.label.slice(0, 30) } : fallback.motif,
    hero: inRange(o.concept.hero, fallback.hero),
    turn: inRange(o.concept.turn, fallback.turn),
    beats: beats.length ? beats : fallback.beats,
    language: s.language,
    journey: path ? (s.journey ?? fallback.journey ?? "right") : null,
    guide: s.language === "guide" ? (s.guide ?? "plane") : null,
    recap: s.recap,
    scheme: s.scheme,
    source: "ai",
  };
}

// Scenes in order from word 0 (what can be mended); the art takes the staging's scheme.
function ideasOf(o: Answer, nWords: number): Ideas | null {
  const scenes = [...o.scenes].filter((x) => x.at >= 0 && x.at < nWords).sort((a, b) => a.at - b.at).filter((x, i, xs) => !i || x.at > xs[i - 1].at);
  if (!scenes.length || !o.arts.length) return null;
  scenes[0] = { ...scenes[0], at: 0 };
  return { arts: [{ ...o.arts[0], scheme: o.staging.scheme }] as unknown as Record<string, unknown>[], scenes: scenes as unknown as Ideas["scenes"] };
}

// What is wrong with an answer's scenes (they must cover the narration in order).
export function ideaProblems(o: Pick<Answer, "arts" | "scenes">, nWords: number): string[] {
  const p: string[] = [];
  if (o.arts.length < 1) p.push("no art direction (write 1)");
  if (!o.scenes.length) p.push("no scenes");
  let last = -1;
  o.scenes.forEach((s, i) => {
    if (s.at <= last) p.push(`scene ${i + 1} starts at word ${s.at}, not after scene ${i}`);
    if (s.at >= nWords) p.push(`scene ${i + 1} starts after the last word`);
    last = s.at;
    if (!s.options.length) p.push(`scene ${i + 1} has no options`);
    if (s.text && (s.text.from < s.at || s.text.to < s.text.from)) p.push(`scene ${i + 1}: text words ${s.text.from}–${s.text.to} are not the scene's own`);
  });
  if (o.scenes[0] && o.scenes[0].at !== 0) p.push("the first scene must start at word 0");
  return p;
}

// The plan in the Motion Director's own format (for its review and "Change it").
export function answerOf(plan: MotionPlan, script?: ScriptT | null): Record<string, unknown> {
  const p = plan.profile, c = plan.creative;
  const ideas = script ? scenesOf(script) : plan.ideas;
  const art = { ...((ideas?.arts[0] ?? {}) as Record<string, unknown>) };
  delete art.scheme;
  return {
    brand: { category: p.category, personality: p.personality, mood: p.mood, audience: p.audience, promise: p.promise, features: p.features, before: p.before, keywords: p.keywords, numbers: p.numbers, look: { face: p.look.face, energy: p.look.energy } },
    concept: { idea: c.idea, motif: c.motif ?? { icon: "sparkles", label: "" }, turn: c.turn, hero: c.hero, beats: c.beats },
    staging: { language: c.language, journey: c.journey, guide: c.guide, recap: c.recap, scheme: c.scheme },
    arts: [art],
    scenes: ideas?.scenes ?? [],
  };
}

// A stored video's scenes in the format the Director writes.
export function scenesOf(script: ScriptT): Ideas {
  return {
    arts: [script.art as unknown as Record<string, unknown>],
    scenes: script.scenes.map((sc) => ({ at: sc.at, text: sc.text ? { from: sc.text.from, to: sc.text.to, size: sc.text.size, key: sc.text.key ?? [] } : null, kicker: sc.kicker ?? null, options: [{ layout: sc.layout, arrange: sc.arrange ?? null, items: sc.items as unknown as Record<string, unknown>[] }] })),
  };
}

// sample data that reads as a template, never as this product
const PLACEHOLDER = /\b(jane doe|john doe|lorem|ipsum|product x|acme|foo|bar baz|#12345|user ?\d+|customer name)\b/i;

// What a reviewer should look at: our layout check on the plan as it would be
// built (in its own staging), and the plan's own repetition.
export function reviewNotes(ideas: Ideas, words: Word[], brand: { name: string; color: string; cta: string; url?: string }, creative?: CreativePlan | null): string[] {
  const notes: string[] = [];
  const duration = Math.round(((words[words.length - 1]?.end ?? 0) + 1) * 30);
  const set = composeVariants({ words, brand: { ...brand, url: brand.url ?? "", tagline: "", icon: null }, duration, seed: 1, ideas, count: 1, creative });
  notes.push(...set.problems.map((p) => p.replace(/^video 1, /, "")));
  const sc = ideas.scenes;
  const layoutOf = (i: number) => sc[i]?.options[0]?.layout ?? "";
  const kindsOf = (i: number) => (sc[i]?.options[0]?.items ?? []).map((it) => String(it.kind)).sort().join("+");
  for (let i = 2; i < sc.length; i++) {
    if (layoutOf(i) && layoutOf(i) === layoutOf(i - 1) && layoutOf(i) === layoutOf(i - 2)) notes.push(`scenes ${i - 1}–${i + 1} all use the ${layoutOf(i)} layout`);
    if (kindsOf(i) && kindsOf(i) === kindsOf(i - 1) && kindsOf(i) === kindsOf(i - 2)) notes.push(`scenes ${i - 1}–${i + 1} all show ${kindsOf(i)}`);
  }
  sc.forEach((x, i) => {
    const items = x.options[0]?.items ?? [];
    const next = sc[i + 1]?.at ?? words.length;
    const secs = (words[Math.min(words.length - 1, next - 1)]?.end ?? 0) - (words[x.at]?.start ?? 0);
    if (!items.length && secs > 2.5) notes.push(`scene ${i + 1} (${secs.toFixed(1)} s) shows only words`);
    if (i < sc.length - 1 && secs < MIN_SCENE / FPS) notes.push(`scene ${i + 1} lasts ${secs.toFixed(1)} s — too short to be seen: join it with its neighbour (every scene at least 3 s)`);
    const main = items.filter((it) => it.kind !== "badge" && it.kind !== "shape" && it.kind !== "cursor");
    if (main.length > 2) notes.push(`scene ${i + 1} is crowded (${main.length} things) — one focal point, at most 2 things`);
    if (items.some((it) => it.kind === "icon" && !String(it.icon ?? "").trim())) notes.push(`scene ${i + 1} has an icon with no icon name`);
    const said = JSON.stringify(items);
    if (PLACEHOLDER.test(said)) notes.push(`scene ${i + 1} shows placeholder data (${said.match(PLACEHOLDER)?.[0]}) — write rows specific to this product`);
    if (x.text && x.text.to - x.text.from + 1 > SHOWN) notes.push(`scene ${i + 1}'s on-screen words are ${x.text.to - x.text.from + 1} — choose its key clause (at most ${SHOWN})`);
  });
  return [...new Set(notes)].slice(0, 20);
}

// ── the Story Analyst ──────────────────────────────────────────────────────
// It reads the script before anything is designed: who it speaks to, the
// pain, the promise, the proof, the feeling it leaves — and splits the
// narration into scenes long enough to be seen, each with what it means,
// what to picture (concretely, for THIS product) and the words to show.
export const ANALYST_INSTRUCTIONS = `You are the story analyst of a studio known for premium explainer videos for software products. Before any design, you read the script DEEPLY and write the breakdown the motion director will build on.
1. The audience (who watches, in a few words), their pain (what hurts today, concretely), the promise (what the product changes), the proof (what makes it believable: a number, a feature, a result), the arc (the story in one line: from … to …), the look (the visual feeling that suits this brand, a few words).
2. Scenes: split the narration (its words are numbered index:word) into scenes, in order, covering every word: { from, to } word indexes. Every scene is at least 3 seconds of speech (about 8 words or more): a short sentence or question joins its neighbour. 15 s → 3–5 scenes, 30 s → 6–8, 60 s → 10–14. For each scene:
- beat: ${BEATS.join("|")}.
- message: what the scene must make the viewer understand, one line.
- show: the ONE concrete thing to picture, specific to THIS product and the words (e.g. "the store's order list with a new order arriving and a confirmation sent", not "an icon"); the product's own screens when the words say what it does; the old way only before the product arrives.
- words: the words to show on screen, copied exactly from the scene's narration — the whole sentence when it is ${SHOWN} words or fewer, else its key clause, never cut mid-phrase.
- why: why this picture is the strongest choice, one line.
Be specific to THIS brand and these words; never generic; never invent features, numbers or claims the material does not make.`;

const AnalysisM = z.object({
  audience: z.string(),
  pain: z.string(),
  promise: z.string(),
  proof: z.string(),
  arc: z.string(),
  look: z.string(),
  scenes: z.array(z.object({ from: z.number(), to: z.number(), beat: z.string(), message: z.string(), show: z.string(), words: z.string(), why: z.string() })),
});
export type Analysis = z.infer<typeof AnalysisM>;
const mendAnalysis = (raw: unknown) => {
  const o = obj(raw);
  return {
    audience: str(o.audience) ?? "", pain: str(o.pain) ?? "", promise: str(o.promise) ?? "", proof: str(o.proof) ?? "", arc: str(o.arc) ?? "", look: str(o.look) ?? "",
    scenes: list(o.scenes).map((x) => obj(x)).map((x) => ({ from: num(x.from), to: num(x.to), beat: str(x.beat) ?? "", message: str(x.message) ?? "", show: str(x.show) ?? "", words: str(x.words) ?? "", why: str(x.why) ?? "" })),
  };
};
const BASE_ANALYSIS = zodTextFormat(AnalysisM, "story_analysis");
const ANALYSIS_FORMAT = { format: { ...BASE_ANALYSIS, $parseRaw: (text: string) => AnalysisM.parse(mendAnalysis(JSON.parse(text))) } as typeof BASE_ANALYSIS };

// The breakdown as the Director reads it.
function analysisText(a: Analysis, words: Word[]): string {
  const said = (from: number, to: number) => words.slice(Math.max(0, from), Math.min(words.length, to + 1)).map((w) => w.text).join(" ");
  return [
    `THE STORY ANALYST'S BREAKDOWN (build on it: its scene split, its pictures, its words):`,
    `Audience: ${a.audience}. Pain: ${a.pain}. Promise: ${a.promise}. Proof: ${a.proof}. Arc: ${a.arc}. Look: ${a.look}.`,
    ...a.scenes.map((x, i) => `Scene ${i + 1} (words ${x.from}–${x.to}: "${said(x.from, x.to)}") — ${x.beat}. Message: ${x.message}. Show: ${x.show}. On screen: "${x.words}". Why: ${x.why}`),
  ].join("\n");
}

// ── the calls ──────────────────────────────────────────────────────────────
type Client = Pick<OpenAI, "responses">;
async function modelOf(client?: Client) {
  const picked = client ? null : await textAi("composer").catch(() => null);
  const model = picked?.model ?? (process.env.OPENAI_MODEL || "gpt-5-mini");
  const quick = (picked ? picked.quick : /(^|\/)(gpt-5|o\d)/.test(model)) ? { reasoning: { effort: "low" as const } } : {};
  return { ai: client ?? picked?.client ?? null, model, quick };
}
// An answer mended before it is checked: a value outside the choices (a size
// "xl" for a thing, an unknown layout) becomes the nearest allowed one, and a
// thing of an unknown kind is left out — a whole plan is never lost to one slip.
const pick = <T extends string>(xs: readonly T[], v: unknown, d: T, near: Record<string, T> = {}): T => (typeof v === "string" && (xs as readonly string[]).includes(v) ? (v as T) : typeof v === "string" && near[v.toLowerCase()] ? near[v.toLowerCase()] : d);
const orNull = <T extends string>(xs: readonly T[], v: unknown, near: Record<string, T> = {}): T | null => (v == null ? null : typeof v === "string" && (xs as readonly string[]).includes(v) ? (v as T) : typeof v === "string" && near[v.toLowerCase()] ? near[v.toLowerCase()] : null);
const str = (v: unknown): string | null => (v == null ? null : typeof v === "string" ? v : String(v));
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const SIZE3 = ["s", "m", "l"] as const;
const SIZE4 = ["s", "m", "l", "xl"] as const;
const NEAR3 = { xs: "s", small: "s", medium: "m", large: "l", xl: "l", xxl: "l" } as const;
const NEAR4 = { xs: "s", small: "s", medium: "m", large: "l", xxl: "xl" } as const;

export function mendAnswer(raw: unknown): unknown {
  const o = obj(raw);
  const b = obj(o.brand), c = obj(o.concept), st = obj(o.staging);
  const item = (x: unknown) => {
    const it = obj(x);
    if (!(ITEM_KINDS as readonly string[]).includes(String(it.kind))) return null;
    return {
      kind: it.kind, at: num(it.at), hit: numOrNull(it.hit), id: str(it.id), variant: str(it.variant), title: str(it.title), sub: str(it.sub), icon: str(it.icon), value: str(it.value),
      values: it.values == null ? null : list(it.values).map((v) => num(v)),
      rows: it.rows == null ? null : list(it.rows).map((r) => obj(r)).map((r) => ({ title: str(r.title) ?? "", meta: str(r.meta), tag: str(r.tag), icon: str(r.icon) })),
      screen: str(it.screen), size: orNull(SIZE3, it.size, NEAR3), tilt: numOrNull(it.tilt), enter: str(it.enter),
    };
  };
  return {
    brand: {
      category: pick(BRAND_CATEGORIES, b.category, "other"), personality: list(b.personality).map(String), mood: pick(MOODS, b.mood, "professional"), audience: str(b.audience) ?? "", promise: str(b.promise) ?? "",
      features: list(b.features).map(String), before: list(b.before).map(String), keywords: list(b.keywords).map(String), numbers: list(b.numbers).map(String),
      look: { face: pick(["geometric", "humanist", "serif", "condensed", "rounded", "wide"] as const, obj(b.look).face, "geometric"), energy: num(obj(b.look).energy, 0.5) },
    },
    concept: {
      idea: str(c.idea) ?? "", motif: { icon: str(obj(c.motif).icon) ?? "", label: str(obj(c.motif).label) ?? "" }, turn: num(c.turn), hero: num(c.hero),
      beats: list(c.beats).map((x) => obj(x)).filter((x) => (BEATS as readonly string[]).includes(String(x.beat))).map((x) => ({ at: num(x.at), beat: x.beat })),
    },
    staging: {
      language: st.language === "whip" ? "line" : pick(LANGUAGES, st.language, "cuts"), journey: orNull(["right", "zigzag", "down", "diagonal", "snake"] as const, st.journey), guide: orNull(["plane", "cursor", "orb"] as const, st.guide),
      recap: st.recap === true, scheme: st.scheme === "light" ? "light" : "dark",
    },
    arts: list(o.arts).map((x) => obj(x)).map((a) => ({
      name: str(a.name) ?? "", hue: num(a.hue, 220), harmony: str(a.harmony) ?? "mono", field: str(a.field) ?? "aurora", overlay: str(a.overlay) ?? "none", surface: str(a.surface) ?? "glass", radius: num(a.radius, 16),
      display: str(a.display) ?? "", text: str(a.text) ?? "", weight: num(a.weight, 700), case: str(a.case) ?? "sentence", tracking: num(a.tracking), key: str(a.key) ?? "color", motion: str(a.motion) ?? "soft", pace: num(a.pace, 1),
      camera: str(a.camera) ?? "drift", icons: str(a.icons) ?? "tile", energy: num(a.energy, 0.5),
    })),
    scenes: list(o.scenes).map((x) => obj(x)).map((sc) => {
      const t = sc.text == null ? null : obj(sc.text);
      return {
        at: num(sc.at),
        text: t ? { from: num(t.from), to: num(t.to), size: pick(SIZE4, t.size, "m", NEAR4), key: list(t.key).map(String) } : null,
        kicker: str(sc.kicker),
        options: list(sc.options).map((y) => obj(y)).map((op) => ({
          layout: pick(LAYOUTS, op.layout, "center"), arrange: orNull(ARRANGES, op.arrange),
          items: list(op.items).map(item).filter((it): it is NonNullable<ReturnType<typeof item>> => !!it),
        })),
      };
    }),
  };
}
const BASE_FORMAT = zodTextFormat(MotionModel, "motion_plan");
const FORMAT = { format: { ...BASE_FORMAT, $parseRaw: (text: string) => MotionModel.parse(mendAnswer(JSON.parse(text))) } as typeof BASE_FORMAT };

function requestOf(input: MotionInput): string {
  const w = input.website, k = input.known;
  const seconds = input.words.length ? input.words[input.words.length - 1].end : 0;
  const sentences = sentencesOf(input.words).map((s) => input.words.slice(s.from, s.to + 1).map((x, j) => `${s.from + j}:${x.text}`).join(" "));
  return [
    `Brand: ${input.name}${input.product ? ` — ${input.product}` : ""}`,
    `Brand colour: ${input.color}`,
    `Call to action: ${input.cta}${input.url ? ` (${input.url})` : ""}`,
    input.category ? `Category (the customer's choice): ${input.category}` : "",
    input.customer
      ? `THE CUSTOMER'S ANSWERS (facts — build on them exactly as given): for ${input.customer.audience}; the three features: ${input.customer.features.join("; ")}; before it they used: ${input.customer.before.join(", ")} (picture that old way in the problem scenes); mood: ${input.customer.mood}; the video is ${USE_NOTE[input.customer.use]}.`
      : "",
    w?.url ? `Website: ${w.url}` : "",
    w?.title ? `Website title: ${w.title}` : "",
    w?.description ? `Website description: ${w.description}` : "",
    w?.text ? `Website text:\n${w.text.slice(0, 5000)}` : "",
    k ? `THIS BRAND (from its earlier video — keep it consistent): ${k.category}; ${k.personality.join(", ")}; mood ${k.mood}; for ${k.audience || "(not said)"}; promise: ${k.promise || "(not said)"}` : "",
    k ? `Camera languages that usually suit a ${k.mood} brand: ${Object.entries(LANGUAGE_WEIGHTS[k.mood]).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 5).map(([l]) => l).join(", ")}` : "",
    `EARLIER (this brand's videos): ${input.earlier?.length ? input.earlier.map((e) => `"${e.idea}" (${e.language ?? "?"})`).join("; ") : "(none)"}`,
    `SEEN faces: ${input.seen?.display.join(", ") || "(none)"}; SEEN fields: ${input.seen?.field.join(", ") || "(none)"}`,
    `Length: about ${Math.round(seconds)} s, ${input.words.length} words`,
    `NARRATION (index:word), one sentence per line:\n${sentences.join("\n")}`,
    input.analysis ? `\n${analysisText(input.analysis, input.words)}` : "",
  ].filter(Boolean).join("\n");
}

// A call with one more try: an answer that cannot be read is asked for again,
// with what was wrong (when the time allows).
async function ask<T>(ai: Client, body: Record<string, unknown>, deadline: number, onUsage: (u: unknown) => void): Promise<T | null> {
  let input = body.input as string;
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 15_000) throw new Error("no time left");
    try {
      const r = await ai.responses.parse({ ...body, input } as Parameters<Client["responses"]["parse"]>[0], { timeout: left });
      onUsage(r.usage);
      return (r.output_parsed as T | null) ?? null;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      // (a timeout or a refused call is not asked again)
      if (attempt || !/JSON|Zod|invalid|expected|Unexpected|parse/i.test(why)) throw e;
      input = `${input}\n\nYOUR PREVIOUS ANSWER COULD NOT BE READ: ${why.slice(0, 600)}\nAnswer again: ONE JSON object in exactly the format asked, every value one of its choices.`;
    }
  }
  return null;
}

// The Story Analyst's breakdown (null when there is no model or it fails: the Director plans alone).
export async function analyseStory(input: Pick<MotionInput, "name" | "product" | "customer" | "category" | "website" | "words" | "cta">, onUsage?: (u: BriefUsage) => void, client?: Client, budgetMs = 45_000): Promise<Analysis | null> {
  const { ai, model, quick } = await modelOf(client);
  if (!ai || !input.words.length) return null;
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const w = input.website;
  const sentences = sentencesOf(input.words).map((x) => input.words.slice(x.from, x.to + 1).map((y, j) => `${x.from + j}:${y.text}`).join(" "));
  const request = [
    `Brand: ${input.name}${input.product ? ` — ${input.product}` : ""}`,
    `Call to action: ${input.cta}`,
    input.category ? `Business: ${input.category}` : "",
    input.customer ? `THE CUSTOMER'S ANSWERS (facts): for ${input.customer.audience}; features: ${input.customer.features.join("; ")}; before it they used: ${input.customer.before.join(", ")}; mood: ${input.customer.mood}; the video is ${USE_NOTE[input.customer.use]}.` : "",
    w?.title ? `Website title: ${w.title}` : "",
    w?.description ? `Website description: ${w.description}` : "",
    w?.text ? `Website text:\n${w.text.slice(0, 3000)}` : "",
    `NARRATION (index:word), one sentence per line:\n${sentences.join("\n")}`,
  ].filter(Boolean).join("\n");
  try {
    const o = await ask<Analysis>(ai, { model, instructions: ANALYST_INSTRUCTIONS, input: request, text: ANALYSIS_FORMAT, ...quick }, Date.now() + budgetMs, (u) => countUsage(usage, u as Parameters<typeof countUsage>[1]));
    onUsage?.(usage);
    if (!o?.scenes.length) return null;
    // in order, inside the narration
    const n = input.words.length;
    return { ...o, scenes: o.scenes.filter((x) => x.from >= 0 && x.from < n).sort((a, b) => a.from - b.from).map((x) => ({ ...x, to: Math.max(x.from, Math.min(n - 1, x.to)) })) };
  } catch (e) {
    onUsage?.(usage);
    console.warn("story analyst failed:", e instanceof Error ? e.message.slice(0, 200) : e);
    return null;
  }
}

// The Motion Director's plan: one call, from the script (alongside the voice).
export async function directMotion(input: MotionInput, onUsage?: (u: BriefUsage) => void, client?: Client, budgetMs = 130_000): Promise<MotionResult> {
  const t0 = Date.now();
  const fallback = rulePlan(input);
  const { ai, model, quick } = await modelOf(client);
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const done = (plan: MotionPlan, problems: string[]): MotionResult => {
    onUsage?.(usage);
    return { plan, problems, ms: Date.now() - t0 };
  };
  if (!ai || !input.words.length) return done(fallback, ["no model (turned off on /admin/models, or no key) — plan by rule"]);
  const deadline = t0 + budgetMs;
  try {
    // the Story Analyst first (its breakdown is what the Director builds on)
    const analysis = input.analysis ?? (await analyseStory(input, (u) => countUsage(usage, { input_tokens: u.inputTokens, output_tokens: u.outputTokens, ...(u.reportedUsd !== undefined ? { cost: u.reportedUsd } : {}) } as Parameters<typeof countUsage>[1]), client, Math.min(45_000, budgetMs * 0.4)));
    const o = await ask<Answer>(ai, { model, instructions: `${MOTION_INSTRUCTIONS}\n\n${HOUSE_RULES}${extraRules(input.never)}`, input: requestOf({ ...input, analysis }), text: FORMAT, ...quick }, deadline, (u) => countUsage(usage, u as Parameters<typeof countUsage>[1]));
    if (!o) return done(fallback, ["no answer — plan by rule"]);
    const result = done(planOf(o, input, fallback), ideaProblems(o, input.words.length));
    result.analysis = analysis;
    return result;
  } catch (e) {
    return done(fallback, [`model call failed: ${e instanceof Error ? e.message : String(e)} — plan by rule`]);
  }
}

function planOf(o: Answer, input: Pick<MotionInput, "words" | "category" | "known" | "customer">, fallback: MotionPlan, keepBrand?: BrandProfile | null): MotionPlan {
  const count = input.words.length;
  const creative = creativeOf(o, count, fallback.creative);
  // (the brand's look takes the staging's scheme: dark or light is decided once)
  const kept = keepBrand ?? input.known;
  const profile = withCustomer(kept ? { ...kept, look: { ...kept.look, scheme: creative.scheme } } : profileOf(o.brand, narrationOf(input.words), input.category, creative.scheme), input.customer);
  return { profile, creative, ideas: ideasOf(o, count), source: "ai" };
}

// Its review once the voice is timed: the plan, with what our layout check
// found on the real timings; the improved plan is kept unless it is worse.
export async function reviewMotion(plan: MotionPlan, input: MotionInput, onUsage?: (u: BriefUsage) => void, client?: Client, budgetMs = 100_000): Promise<MotionResult> {
  const t0 = Date.now();
  const asked = plan.ideas ? reviewNotes(plan.ideas, input.words, input, plan.creative) : [];
  const { ai, model, quick } = await modelOf(client);
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const done = (p: MotionPlan, problems: string[]): MotionResult => {
    onUsage?.(usage);
    return { plan: p, problems, ms: Date.now() - t0 };
  };
  if (!ai || !plan.ideas || plan.source !== "ai") return done(plan, asked);
  const deadline = t0 + budgetMs;
  // up to two rounds: the plan is checked again after each, and a round
  // that makes it worse is not kept
  let best = plan, notes = asked;
  const log: string[] = [];
  for (let round = 1; round <= 2; round++) {
    if (round > 1 && (!notes.length || deadline - Date.now() < 40_000)) break;
    const request = `${requestOf(input)}\n\nYOUR PLAN:\n${JSON.stringify(answerOf(best))}\n\nProblems found by our checks on the recorded voice (fix every one):\n${notes.length ? notes.map((a) => `- ${a}`).join("\n") : "- (none; judge the design yourself)"}`;
    try {
      const o = await ask<Answer>(ai, { model, instructions: `${MOTION_INSTRUCTIONS}\n\n${HOUSE_RULES}${extraRules(input.never)}\n\n${REVIEW}`, input: request, text: FORMAT, ...quick }, deadline, (u) => countUsage(usage, u as Parameters<typeof countUsage>[1]));
      if (!o) {
        log.push(`review ${round}: no answer — the plan is kept`);
        break;
      }
      const revised = planOf(o, input, best, best.profile);
      if (!revised.ideas) {
        log.push(`review ${round}: no scenes — the plan is kept`);
        break;
      }
      const again = [...ideaProblems(o, input.words.length), ...reviewNotes(revised.ideas, input.words, input, revised.creative)];
      if (again.length > notes.length) {
        log.push(`review ${round} made it worse — the plan is kept`);
        break;
      }
      best = revised;
      notes = again;
    } catch (e) {
      log.push(`review ${round} failed: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }
  return done(best, [...log, ...notes]);
}

const REVIEW = `Now review YOUR PLAN as a senior motion designer before it is built, and return the WHOLE improved plan (same format). Check, scene by scene:
- Is every scene at least 3 s, held long enough to be seen? Is its one focal point big, with nothing small lost in the frame?
- Are the on-screen words a whole sentence or a complete clause (never cut mid-phrase)?
- Does every scene picture what ITS words say, literally? Is it one strong idea, not a crowd? Is the product's UI shown where the words describe what the app does? Is every detail specific to THIS product (no placeholder data, every icon named)?
- Do neighbouring scenes vary (layout, kind of thing, size) — words, cards and icons composed together in some scenes — and does it build to the reveal and the call to action?
- Is every scene's text a 2–6 word highlight? Every UI row realistic for THIS product, every icon literal, every number spoken?
- Do the concept and staging hold: the motif in 2–3 scenes, the turn where the product arrives, the hero scene the strongest, the scheme and camera language right for this brand?
Fix every weak scene and every problem listed, keep what is already strong.`;
