import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefUsage } from "@/lib/ai/product-brief";
import { countUsage, textAi } from "@/lib/ai/models";
import { DISPLAY_FACES, TEXT_FACES } from "@/components/video/composer/art";
import { CARD_VARIANTS, CHART_VARIANTS, DEVICE_VARIANTS, FIELDS, FLOW_VARIANTS, ITEM_KINDS, LAYOUTS, ARRANGES, type Word } from "@/components/video/composer/types";
import type { Ideas } from "@/components/video/composer/variants";

// Composer Director: one AI call reads the recorded narration and composes
// it scene by scene — where each scene starts, which of its words are on
// screen, and two or three different ways to picture it from the
// Composer's parts — plus four art directions. The four videos are built
// from these (components/video/composer/variants.ts); nothing is a fixed
// scene. Never throws: no model or a bad answer → null (the Composer's own
// director composes instead).

export const COMPOSER_INSTRUCTIONS = `You are the director and art director of short motion-graphics explainer videos for software products (the style of premium SaaS launch videos: kinetic type, the product's UI drawn as clean cards, light fields, smooth camera). The narration is final and already recorded; its words are given numbered (index:word). You decide every scene — nothing is a template.

SCENES
- A scene starts on a word ("at": the index of its first word) and lasts until the next scene. Scenes follow the narration in order and cover it all; the first scene starts at 0. A scene is at least ~1.4 s of speech; usually one sentence or one clause. 15 s → 4–6 scenes, 30 s → 7–10, 60 s → 12–18.
- "text": the words of the scene shown on screen as kinetic type: { from, to } word indexes inside the scene (usually all of its words; null for a scene that is pictured only — rare), "size" s|m|l|xl (xl for short punchy lines), "key": 1–2 words of it to light up (exact words).
- "kicker": optional 1–3 word eyebrow above the text ("Step 1", the product's name, "Before") or null.
- "options": 2 or 3 DIFFERENT ways to picture the scene. Each: { layout, arrange, items }. The videos made from your plan each take a different option, so make them genuinely different (e.g. a phone with the app vs. three chips vs. a big number), but each must picture THAT scene's words literally.

LAYOUTS: center (text above things), top (text band on top, big things below), bottom, split-left (text left, things right), split-right, corner, type (only big kinetic text; no things except a badge), visual (things fill the frame, text as a caption), over (text on a glass plate over a big thing).
ARRANGE (for 2+ things): single, row, column, grid, cascade (overlapping, fanned), orbit (one in the middle, others around), scatter, diagonal.

ITEMS (the parts). Every item: { kind, at (word index it appears on, inside the scene), hit (word index of its moment or null), id (same id on an item in the NEXT scene = it travels there: a match cut; else null), variant, title, sub, icon, value, values, rows, screen, size (s|m|l), tilt (-12..12 degrees or 0), enter (null) }.
- card: the product's UI as a clean card. variant: ${CARD_VARIANTS.join(", ")}. title (screen name), icon, rows: 2–5 realistic rows { title, meta, tag, icon } for THIS product (names of things, amounts, times, statuses — never lorem ipsum), value (a total/amount when the variant shows one). hit: the word where its moment happens (a row is checked, the invoice is stamped paid, the slot fills, the button is pressed).
- device: variant ${DEVICE_VARIANTS.join(", ")}; screen: one card variant shown on it (+ title, icon, rows as for a card).
- chips: 2–5 pills (rows with title + icon); variant row|column. A list spoken in the words: each part as a pill.
- flow: variant ${FLOW_VARIANTS.join(", ")}: things joined by lines (rows title + icon); hub/ring/fan/merge put the brand in the middle/side.
- steps: 2–4 numbered steps (rows).
- stat: one big number — value MUST be a number the narration says (e.g. "4 hours", "2x"); title: what it is.
- chart: variant ${CHART_VARIANTS.join(", ")}; values: 5–9 numbers rising/falling as the words say; value: the headline figure only if spoken; ring/progress: values [percent].
- compare: before vs after: rows { title: the old way, meta: the new way }; title "Before"-style label, sub: the product's name; hit: when the old way is struck out.
- icon: one big icon (+ optional title 1–2 words). badge: a small pill on a corner of a thing: icon + title (2–3 words: "Paid", "Reminder sent") or value.
- logo: the brand's mark and name (the product reveal). button: the call to action (title: the CTA text, sub: the website); hit: the click.
- avatars: people as initials only (rows titles = first names). quote: a short testimonial (title) by sub (a name).
- shape: decoration (ring, orb, arrow, spark, grid, line, plus, wave).
Icons: Lucide names that picture the thing LITERALLY (calendar, file-text, bell-ring, credit-card, receipt, messages-square, search, video, list-checks, clock, zap, shield-check, package…). Never people, faces, hands or animals.
- 1–3 items per scene (a badge may be added). Fewer, bigger things read better than many small ones. Use a phone/browser/laptop for "the app does X" moments; chips/flow/steps for spoken lists; stat/chart only for spoken numbers; compare for "no more …"; logo when the product is named first; button on the closing line.
- Never write on screen a number or claim the narration does not make (UI rows may carry realistic sample data).
- Vary the layouts scene to scene; never the same layout three scenes in a row.

ART DIRECTIONS: write 4 "arts", each a distinct, coherent visual identity for the whole video (they must differ from each other in field, face, scheme and mood):
{ name (2–3 words), hue 0–360 (the key colour; one of them close to the brand colour), harmony mono|analogous|complement|split|triad, scheme dark|light|mixed, field ${FIELDS.join("|")}, overlay none|grain|particles|sheen|vignette|lines, surface glass|solid|outline|soft|tinted|ink, radius 0–40, display (headline face) one of: ${DISPLAY_FACES.map((f) => f.slug).join(", ")}, text (UI face) one of: ${TEXT_FACES.map((f) => f.slug).join(", ")}, weight 500–850, case sentence|upper|lower, tracking -0.05..0.02, key color|pill|underline|gradient|box|outline|italic|glow, motion soft|snappy|springy|glide, pace 0.85–1.25, camera drift|push|pull|tilt|float|orbit|rise, icons tile|round|bare|duotone|outline|glass, energy 0.2–0.85 }.
Taste: condensed faces (oswald, bebas-neue, anton, big-shoulders-display) only in upper case; serif faces with sentence case and italic/underline/color keys; wide faces (unbounded, krona-one, dela-gothic-one) with smaller sizes. AVOID the faces and fields listed under SEEN (this customer has seen them).`;

const n = <T extends z.ZodTypeAny>(t: T) => t.nullable();
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
const ArtM = z.object({ name: z.string(), hue: z.number(), harmony: z.string(), scheme: z.string(), field: z.string(), overlay: z.string(), surface: z.string(), radius: z.number(), display: z.string(), text: z.string(), weight: z.number(), case: z.string(), tracking: z.number(), key: z.string(), motion: z.string(), pace: z.number(), camera: z.string(), icons: z.string(), energy: z.number() });
export const ComposerModel = z.object({ arts: z.array(ArtM), scenes: z.array(SceneM) });

export type ComposerDirectorInput = { words: Word[]; brand: { name: string; color: string; cta: string; url: string }; product?: string | null; seen?: { display: string[]; field: string[] } };
export type ComposerDirectorResult = { ideas: Ideas | null; source: "ai" | "none"; problems: string[]; ms: number };

// What is wrong with an answer (the scenes must cover the narration in order).
export function ideaProblems(ideas: z.infer<typeof ComposerModel>, nWords: number): string[] {
  const p: string[] = [];
  if (ideas.arts.length < 2) p.push(`only ${ideas.arts.length} art directions (write 4)`);
  if (!ideas.scenes.length) p.push("no scenes");
  let last = -1;
  ideas.scenes.forEach((s, i) => {
    if (s.at <= last) p.push(`scene ${i + 1} starts at word ${s.at}, not after scene ${i}`);
    if (s.at >= nWords) p.push(`scene ${i + 1} starts after the last word`);
    last = s.at;
    if (!s.options.length) p.push(`scene ${i + 1} has no options`);
    if (s.text && (s.text.from < s.at || s.text.to < s.text.from)) p.push(`scene ${i + 1}: text words ${s.text.from}–${s.text.to} are not the scene's own`);
  });
  if (ideas.scenes[0] && ideas.scenes[0].at !== 0) p.push("the first scene must start at word 0");
  return p;
}

export async function generateComposerIdeas(input: ComposerDirectorInput, onUsage?: (u: BriefUsage) => void, client?: Pick<OpenAI, "responses">, budgetMs = 80_000): Promise<ComposerDirectorResult> {
  const t0 = Date.now();
  const problems: string[] = [];
  const picked = client ? null : await textAi("composer").catch(() => null);
  const model = picked?.model ?? (process.env.OPENAI_MODEL || "gpt-5-mini");
  const quick = (picked ? picked.quick : /(^|\/)(gpt-5|o\d)/.test(model)) ? { reasoning: { effort: "low" as const } } : {};
  const ai = client ?? picked?.client ?? null;
  const usage: BriefUsage = { model, inputTokens: 0, outputTokens: 0 };
  const done = (ideas: Ideas | null): ComposerDirectorResult => {
    onUsage?.(usage);
    return { ideas, source: ideas ? "ai" : "none", problems, ms: Date.now() - t0 };
  };
  if (!ai) {
    problems.push("no model (turned off on /admin/models, or no key)");
    return done(null);
  }
  const seconds = input.words.length ? input.words[input.words.length - 1].end : 0;
  const numbered = input.words.map((w, i) => `${i}:${w.text}`).join(" ");
  const request = `Product: ${input.brand.name}${input.product ? ` — ${input.product}` : ""}\nBrand colour: ${input.brand.color}\nCall to action: ${input.brand.cta}${input.brand.url ? ` (${input.brand.url})` : ""}\nLength: ${Math.round(seconds)} s, ${input.words.length} words\nSEEN faces: ${input.seen?.display.join(", ") || "(none)"}; SEEN fields: ${input.seen?.field.join(", ") || "(none)"}\nNarration (index:word):\n${numbered}`;
  const format = { format: zodTextFormat(ComposerModel, "composer") };
  try {
    const first = await ai.responses.parse({ model, instructions: COMPOSER_INSTRUCTIONS, input: request, text: format, ...quick }, { timeout: budgetMs });
    countUsage(usage, first.usage);
    let out = first.output_parsed;
    let asked = out ? ideaProblems(out, input.words.length) : ["no answer"];
    const left = budgetMs - (Date.now() - t0);
    if (out && asked.length && left > 20_000) {
      const second = await ai.responses.parse({ model, instructions: COMPOSER_INSTRUCTIONS, previous_response_id: first.id, input: `Problems:\n- ${asked.slice(0, 12).join("\n- ")}\nFix them and return the whole plan again.`, text: format, ...quick }, { timeout: left });
      countUsage(usage, second.usage);
      if (second.output_parsed) {
        const again = ideaProblems(second.output_parsed, input.words.length);
        if (again.length <= asked.length) {
          out = second.output_parsed;
          asked = again;
        }
      }
    }
    problems.push(...asked);
    if (!out || !out.scenes.length) return done(null);
    // mend what can be mended: scenes in order from word 0
    const scenes = [...out.scenes].filter((s) => s.at >= 0 && s.at < input.words.length).sort((a, b) => a.at - b.at).filter((s, i, xs) => !i || s.at > xs[i - 1].at);
    if (scenes[0]) scenes[0].at = 0;
    return done({ arts: out.arts as unknown as Record<string, unknown>[], scenes: scenes as unknown as Ideas["scenes"] });
  } catch (e) {
    problems.push(`model call failed: ${e instanceof Error ? e.message : String(e)}`);
    return done(null);
  }
}
