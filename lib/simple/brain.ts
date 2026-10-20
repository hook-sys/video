import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, temperatureFor } from "@/lib/ai/models";
import { type BriefUsage, estimateInput } from "@/lib/ai/product-brief";
import { searchIcons } from "@/lib/icons";
import { resolveIcon } from "@/components/video/icons";
import type { RoleAi } from "@/lib/v2/models";
import { type Beat, CONCEPTS, INTENTS, type Reading, SHOWS, type Word } from "@/components/video/simple/types";

// The simple engine's Director (docs/video-spec.md), in two calls to its
// model. First the story: the whole script read once — what the product does,
// its parts, the video's main moment and what each beat should show. Then the
// beats, read with that plan: what each is (hook, problem, solution, feature,
// proof, steps, the ask), the words to show (a run the voice says), an icon,
// up to 3 short things and the number said. It never picks a layout, a colour
// or a style. The beats call failing fails the video (no fallback); the story
// failing leaves the beats read without it (noted on the video).

const Answer = z.object({
  beats: z.array(
    z.object({
      beat: z.number(),
      intent: z.enum(INTENTS),
      from: z.number(),
      to: z.number(),
      key: z.number(),
      icon: z.string(),
      items: z.array(z.object({ text: z.string(), icon: z.string() })),
      number: z.string().nullable(),
      concept: z.enum([...CONCEPTS, "none"]),
    }),
  ),
});
const FORMAT = { format: zodTextFormat(Answer, "beats") };
const INSTRUCTIONS = `You read the voice-over of a short product video, beat by beat. For every beat listed answer:
- intent: hook (the opening question or pain), problem (what goes wrong today), solution (the product arrives — usually where it is named), feature (what it does), proof (a result or a number), steps (how it works, in steps), cta (the closing ask — always the last beat).
- from, to: the words to show on screen — 2 to 6 consecutive words of THAT beat (their numbers) that name what it is about; never a whole long sentence, never starting or ending on a little word (and, the, of, to, a…).
- key: the one word among them to light up (its number).
- icon: one Lucide icon name for the beat (e.g. "calendar-x", "truck", "chart-line").
- items: 0–3 short things the beat lists or implies — pains for a problem, what it brings together for a solution, rows of the product's screen for a feature, steps for steps — each 1–3 words (title case) and a Lucide icon name. Only things the script says or plainly means; never invented numbers, names or features. A hook or a cta: none unless the beat lists them.
- number: a number the voice says in this beat exactly as written in it ("3x", "50%", "2,400"), else null. Never a number it does not say.
- concept: the one idea the beat's words plainly picture, else none (most beats: none; never the last beat) — trapped (stuck, held back, shut in — or breaking free), chaos (a mess, scattered, too many things — or put in order), waiting (slow, delays, waiting — or no more waiting), truth (it says one thing is really another: "X is just Y" — then items are exactly [X, Y] as said, 1–2 words each, X first), launch (starting, launching, taking off, growing).
When a story plan is given, read each beat with it: its items fit what the beat shows (for product: rows of the product's screen, named from its parts when they fit; for pains: the pains; for steps: the steps).
Answer every beat listed, in order, nothing else.`;

const Story = z.object({
  about: z.string(),
  screens: z.array(z.string()),
  hero: z.number(),
  beats: z.array(z.object({ beat: z.number(), shows: z.enum(SHOWS) })),
});
export type StoryPlan = z.infer<typeof Story>;
const STORY_FORMAT = { format: zodTextFormat(Story, "story") };
const STORY_INSTRUCTIONS = `You plan a short product video from its voice-over, before its scenes are made. Read the whole script, then answer:
- about: what the product does, in one short sentence, only from the script.
- screens: 0–4 parts of the product the script names or plainly means (its screens, modules or views), each 1–3 words in title case. Never invented.
- hero: the number of the one beat that is the video's main moment (usually where the product shows what it does best; never the last beat).
- beats: for every beat, what it should show — pains (what goes wrong, as a list), before-after (the old way against the new), product (the product's screen doing it), list (what it brings, as tiles), number (only when the voice says a number in it), steps (how it works, in order), brand (the product named: its mark), words (a line to say big, nothing to show). The last beat: brand.
Answer every beat listed, in order, nothing else.`;

const effortOf = (ai: RoleAi) => (ai.reasoning === "default" ? (ai.quick ? { reasoning: { effort: "low" as const } } : {}) : ai.reasoning === "none" ? {} : { reasoning: { effort: ai.reasoning } });
const listed = (words: Word[], beats: Beat[], story?: StoryPlan | null) =>
  beats.map((b, i) => `Beat ${i + 1}${story ? ` (shows: ${story.beats.find((x) => Math.round(x.beat) === i + 1)?.shows ?? "words"})` : ""}: ${wordsIn(words, b).map((w, k) => `${b.first + k}:${w.text}`).join(" ")}`).join("\n");

// The story: the whole script read once, before its beats
export async function readStory(words: Word[], beats: Beat[], brand: string, ai: RoleAi, onUsage: (u: BriefUsage) => void, timeoutMs = 60_000): Promise<StoryPlan> {
  const input = `Product: ${brand}\n${listed(words, beats)}`;
  const usage: BriefUsage = { model: ai.model, inputTokens: 0, outputTokens: 0 };
  try {
    const res = await ai.client.responses.parse({ model: ai.model, instructions: STORY_INSTRUCTIONS, input, text: STORY_FORMAT, ...effortOf(ai), ...temperatureFor(ai.model, ai.reasoning, ai.temperature) }, { timeout: timeoutMs });
    countUsage(usage, res.usage as Parameters<typeof countUsage>[1]);
    if (!res.output_parsed) throw new Error("no answer");
    const story = res.output_parsed;
    // (its parts as short as the things are; its main moment a beat there is, not the last)
    const hero = Math.round(story.hero);
    return { ...story, screens: story.screens.slice(0, 4).map(trim3).filter(Boolean), hero: hero >= 1 && hero < beats.length ? hero : 0 };
  } catch (e) {
    estimateInput(usage, STORY_INSTRUCTIONS, input);
    throw new Error(`The story reader (${ai.model}) failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
  } finally {
    onUsage(usage);
  }
}

// (an icon the library has: the name given, else the nearest to it and its words)
export const iconFor = (name: string | null, words: string) => (name && resolveIcon(name) ? name : searchIcons(`${(name ?? "").replace(/[-_]/g, " ")} ${words}`.trim(), 1)[0] ?? searchIcons(words, 1)[0] ?? null);
const wordsIn = (words: Word[], b: Beat) => words.slice(b.first, b.last + 1);
const trim3 = (t: string) => t.trim().split(/\s+/).slice(0, 3).join(" ");

export async function readBeats(words: Word[], beats: Beat[], brand: string, ai: RoleAi, onUsage: (u: BriefUsage) => void, timeoutMs = 90_000, story?: StoryPlan | null): Promise<{ readings: Reading[]; problems: string[] }> {
  const plan = story ? `Story plan — the product: ${story.about}${story.screens.length ? ` Its parts: ${story.screens.join(", ")}.` : ""}${story.hero ? ` The main moment: beat ${story.hero}.` : ""}\n` : "";
  const input = `Product: ${brand}\n${plan}${listed(words, beats, story)}`;
  const usage: BriefUsage = { model: ai.model, inputTokens: 0, outputTokens: 0 };
  try {
    const res = await ai.client.responses.parse({ model: ai.model, instructions: INSTRUCTIONS, input, text: FORMAT, ...effortOf(ai), ...temperatureFor(ai.model, ai.reasoning, ai.temperature) }, { timeout: timeoutMs });
    countUsage(usage, res.usage as Parameters<typeof countUsage>[1]);
    const answer = res.output_parsed;
    if (!answer) throw new Error("no answer");
    const problems: string[] = [];
    const readings = beats.map((b, i): Reading => {
      const a = answer.beats.find((x) => Math.round(x.beat) === i + 1);
      const said = wordsIn(words, b).map((w) => w.text).join(" ");
      if (!a) {
        problems.push(`beat ${i + 1}: not read — its first words are shown`);
        return { intent: i === beats.length - 1 ? "cta" : "feature", show: [b.first, Math.min(b.last, b.first + 3)], key: null, icon: iconFor(null, said), items: [], number: null };
      }
      // (the words shown: inside the beat, 1–6 of them)
      let from = Math.round(a.from), to = Math.round(a.to);
      if (!(from >= b.first && to <= b.last && from <= to && to - from < 6)) {
        problems.push(`beat ${i + 1}: its words were outside it — its first words are shown`);
        [from, to] = [b.first, Math.min(b.last, b.first + 3)];
      }
      const key = Math.round(a.key) >= from && Math.round(a.key) <= to ? Math.round(a.key) : null;
      // (a number only as the voice says it)
      const number = a.number && said.includes(a.number.trim()) && /\d/.test(a.number) ? a.number.trim() : null;
      const items = a.items.slice(0, 3).map((x) => ({ text: trim3(x.text), icon: iconFor(x.icon, x.text) })).filter((x) => x.text);
      // (what the story plan says it shows — a number only when one is said — and whether it is the main moment)
      const planned = story?.beats.find((x) => Math.round(x.beat) === i + 1)?.shows;
      const shows = planned === "number" && !number ? undefined : planned;
      // (an idea — never in the last beat; the truth only with its two words)
      const concept = a.concept !== "none" && i < beats.length - 1 && (a.concept !== "truth" || items.length >= 2) ? a.concept : null;
      return { intent: i === beats.length - 1 ? "cta" : a.intent, show: [from, to], key, icon: iconFor(a.icon, said), items, number, ...(shows ? { shows } : {}), ...(story?.hero === i + 1 ? { hero: true } : {}), ...(concept ? { concept } : {}) };
    });
    return { readings, problems };
  } catch (e) {
    estimateInput(usage, INSTRUCTIONS, input);
    throw new Error(`The beat reader (${ai.model}) failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
  } finally {
    onUsage(usage);
  }
}
