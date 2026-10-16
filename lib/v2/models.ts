import "server-only";
import { type AiConfig, type TextAi, getAiConfig, textClient } from "@/lib/ai/models";
import { buildInput, falRun, heardWords } from "@/lib/ai/fal";
import { retimeScript, type WordTiming } from "@/lib/voice-timing";

// "New version" models: only what a super admin chose on /admin/models —
// no OPENAI_MODEL, no gpt-5-mini, no OpenAI direct, no backup or fallback
// model. A missing choice is a clear error, never a silent substitute.

const SET_IT = "A super admin must choose it on /admin/models.";

// The text model (the Motion Director), through fal's OpenRouter router: the
// video's quality level's own model (/admin/billing), else "New version: text model".
export async function v2Text(tierModel?: string | null, opts: { timeout?: number; maxRetries?: number } = {}): Promise<TextAi> {
  const model = tierModel?.trim() || (await getAiConfig()).v2.text;
  if (!model) throw new Error(`No text model is set for the new version. ${SET_IT}`);
  return textClient("fal", model, false, opts, false);
}

export async function v2Whisper(config?: AiConfig): Promise<string> {
  const model = (config ?? (await getAiConfig())).v2.whisper;
  if (!model) throw new Error(`No Whisper model is set for the new version. ${SET_IT}`);
  return model;
}

// The voice name for this video: the customer's pick, else the gender's name,
// else the first listed voice of that gender (all from /admin/models).
export function v2VoiceName(voice: AiConfig["voice"], gender: string, picked?: string | null): string {
  const g = gender === "female" ? "female" : "male";
  const name = picked?.trim() || voice[g] || voice.choices.find((c) => c.gender === g)?.name;
  if (!name) throw new Error(`No ${g} voice name is set for the new version. ${SET_IT}`);
  return name;
}

// The script spoken by the voice model on /admin/models (its own template).
export async function v2Speak(input: { script: string; language: string; style: string; gender: string; voice?: string | null }) {
  const voice = (await getAiConfig()).voice;
  if (!voice.model) throw new Error(`No voice model is set for the new version. ${SET_IT}`);
  const text = input.script.trim();
  if (!text) throw new Error("There is no script to speak.");
  const body = buildInput(voice.template || '{"text":"{{text}}"}', { text, language: input.language, style: input.style, gender: input.gender, voice: v2VoiceName(voice, input.gender, input.voice) });
  const result = await falRun(voice.model, body, "audio");
  return { model: voice.model, requestId: result.requestId, audioUrl: result.url };
}

// The script's own words on the times the admin's Whisper hears them.
export async function v2TimeScript(audioUrl: string, script: string) {
  const model = await v2Whisper();
  const { heard, requestId } = await heardWords(model, audioUrl);
  const words = retimeScript(script, heard);
  if (!words?.length) throw new Error(`${model} could not time the voice to the script.`);
  return { words, model, requestId, seconds: lastEnd(heard) };
}

// The customer's own recording: what the admin's Whisper hears is the script.
export async function v2Transcribe(audioUrl: string) {
  const model = await v2Whisper();
  const { heard, requestId } = await heardWords(model, audioUrl);
  const words = heard.filter((w) => w.text.trim());
  if (!words.length) throw new Error(`${model} heard no words in the uploaded voice.`);
  return { words, script: words.map((w) => w.text).join(" "), model, requestId, seconds: lastEnd(words) };
}

const lastEnd = (words: WordTiming[]) => (words.length ? Math.max(...words.map((w) => w.end)) : 0);
