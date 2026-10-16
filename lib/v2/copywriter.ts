import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, temperatureFor } from "@/lib/ai/models";
import { type BriefUsage, estimateInput } from "@/lib/ai/product-brief";
import type { Ideas } from "@/components/video/composer/variants";
import type { Word } from "@/components/video/composer/types";
import type { RoleAi } from "@/lib/v2/models";
import { V2_SHOWN } from "@/lib/v2/rules";

// "New version": the Copywriter shortens every scene's on-screen words to its
// 2–6 key words — always a run of words the voice says in that scene (so they
// still come in as they are said). Its own model and reasoning (admin → AI
// models); a call that fails fails the video (no fallback).

const Copy = z.object({ scenes: z.array(z.object({ scene: z.number(), from: z.number(), to: z.number(), key: z.array(z.string()) })) });
const FORMAT = { format: zodTextFormat(Copy, "on_screen_words") };
const INSTRUCTIONS = `You are the copywriter of a premium explainer video. Each scene shows only its hook on screen: 2 to ${V2_SHOWN} consecutive words that the voice says in THAT scene and that name what the scene shows (the thing named, the number, the key phrase) — never the whole sentence, never a phrase that starts or ends on a little word (and, the, of, to…).
For every scene listed, answer { scene (its number), from, to (word indexes INSIDE that scene, from ≤ to, to − from + 1 between 2 and ${V2_SHOWN}; a scene of one word: that word), key: 1–2 of those words to light up (exact words) }. Answer every scene listed, nothing else.`;

export async function copywrite(ideas: Ideas, words: Word[], ai: RoleAi, onUsage: (u: BriefUsage) => void, timeoutMs = 60_000): Promise<{ ideas: Ideas; problems: string[] }> {
  const sc = ideas.scenes;
  const ranges = sc.map((x, i) => ({ i, from: x.at, to: Math.min(words.length - 1, (sc[i + 1]?.at ?? words.length) - 1) }));
  // (scenes the Director left without words — icons, each with its word — stay so)
  const asked = ranges.filter((r) => sc[r.i].text && r.to >= r.from);
  if (!asked.length) return { ideas, problems: [] };
  const input = asked.map((r) => `Scene ${r.i + 1}: ${words.slice(r.from, r.to + 1).map((w, k) => `${r.from + k}:${w.text}`).join(" ")}`).join("\n");
  const usage: BriefUsage = { model: ai.model, inputTokens: 0, outputTokens: 0 };
  const effort = ai.reasoning === "default" ? (ai.quick ? { reasoning: { effort: "low" as const } } : {}) : ai.reasoning === "none" ? {} : { reasoning: { effort: ai.reasoning } };
  try {
    const res = await ai.client.responses.parse({ model: ai.model, instructions: INSTRUCTIONS, input, text: FORMAT, ...effort, ...temperatureFor(ai.model, ai.reasoning, ai.temperature) }, { timeout: timeoutMs });
    countUsage(usage, res.usage as Parameters<typeof countUsage>[1]);
    const answer = res.output_parsed;
    if (!answer) throw new Error("no answer");
    const problems: string[] = [];
    const scenes = sc.map((x, i) => {
      const r = ranges[i];
      if (!x.text) return x;
      const a = answer.scenes.find((s) => Math.round(s.scene) === i + 1);
      const from = Math.round(a?.from ?? NaN), to = Math.round(a?.to ?? NaN);
      const ok = a && Number.isFinite(from) && Number.isFinite(to) && from >= r.from && to <= r.to && from <= to && to - from + 1 <= V2_SHOWN && (to - from + 1 >= 2 || r.to === r.from);
      if (!ok) {
        problems.push(`copywriter: scene ${i + 1}'s words could not be used — the Director's are kept`);
        return x;
      }
      const shown = new Set(words.slice(from, to + 1).map((w) => w.text.toLowerCase()));
      const key = a.key.map((k) => k.trim()).filter((k) => k && shown.has(k.toLowerCase())).slice(0, 2);
      return { ...x, text: { ...x.text, from, to, key } };
    });
    return { ideas: { ...ideas, scenes }, problems };
  } catch (e) {
    estimateInput(usage, INSTRUCTIONS, input);
    throw new Error(`The Copywriter (${ai.model}) failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
  } finally {
    onUsage(usage);
  }
}
