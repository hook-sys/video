import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, temperatureFor } from "@/lib/ai/models";
import { type BriefUsage, estimateInput } from "@/lib/ai/product-brief";
import { searchIcons } from "@/lib/icons";
import { resolveIcon } from "@/components/video/icons";
import type { RoleAi } from "@/lib/v2/models";
import { type Beat, INTENTS, type Reading, type Word } from "@/components/video/simple/types";

// The simple engine's one AI call (docs/video-spec.md): every beat of the
// voice read for what it is (hook, problem, solution, feature, proof, steps,
// the ask), the words to show (a run the voice says), an icon, up to 3 short
// things and the number said. It never picks a layout, a colour or a style.
// A call that fails fails the video (no fallback).

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
Answer every beat listed, in order, nothing else.`;

// (an icon the library has: the name given, else the nearest to it and its words)
export const iconFor = (name: string | null, words: string) => (name && resolveIcon(name) ? name : searchIcons(`${(name ?? "").replace(/[-_]/g, " ")} ${words}`.trim(), 1)[0] ?? searchIcons(words, 1)[0] ?? null);
const wordsIn = (words: Word[], b: Beat) => words.slice(b.first, b.last + 1);
const trim3 = (t: string) => t.trim().split(/\s+/).slice(0, 3).join(" ");

export async function readBeats(words: Word[], beats: Beat[], brand: string, ai: RoleAi, onUsage: (u: BriefUsage) => void, timeoutMs = 90_000): Promise<{ readings: Reading[]; problems: string[] }> {
  const input = `Product: ${brand}\n` + beats.map((b, i) => `Beat ${i + 1}: ${wordsIn(words, b).map((w, k) => `${b.first + k}:${w.text}`).join(" ")}`).join("\n");
  const usage: BriefUsage = { model: ai.model, inputTokens: 0, outputTokens: 0 };
  const effort = ai.reasoning === "default" ? (ai.quick ? { reasoning: { effort: "low" as const } } : {}) : ai.reasoning === "none" ? {} : { reasoning: { effort: ai.reasoning } };
  try {
    const res = await ai.client.responses.parse({ model: ai.model, instructions: INSTRUCTIONS, input, text: FORMAT, ...effort, ...temperatureFor(ai.model, ai.reasoning, ai.temperature) }, { timeout: timeoutMs });
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
      return { intent: i === beats.length - 1 ? "cta" : a.intent, show: [from, to], key, icon: iconFor(a.icon, said), items, number };
    });
    return { readings, problems };
  } catch (e) {
    estimateInput(usage, INSTRUCTIONS, input);
    throw new Error(`The beat reader (${ai.model}) failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
  } finally {
    onUsage(usage);
  }
}
