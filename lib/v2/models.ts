import "server-only";
import { type AiConfig, type Reasoning, type TextAi, type V2Role, V2_ROLES, getAiConfig, textClient } from "@/lib/ai/models";
import { buildInput, falRun, heardWords } from "@/lib/ai/fal";
import { retimeScript, type WordTiming } from "@/lib/voice-timing";
import { alignVoice } from "@/lib/voice-pcm";
import { geminiSpeak, openaiSpeak } from "@/lib/ai/speech";

// "New version" models: only what a super admin chose on /admin/models —
// no OPENAI_MODEL, no gpt-5-mini, no OpenAI direct, no backup or fallback
// model. A missing choice is a clear error, never a silent substitute.

const SET_IT = "A super admin must choose it on /admin/models.";

// A role's model (Director, Director review, Copywriter…), through fal's
// OpenRouter router, with the reasoning chosen for it: only what is set on
// /admin/models under "New version" (one level: no quality level's model).
export type RoleAi = TextAi & { reasoning: Reasoning; temperature: number | null };
export async function v2Role(role: V2Role, opts: { timeout?: number; maxRetries?: number } = {}, config?: AiConfig): Promise<RoleAi> {
  const c = (config ?? (await getAiConfig())).v2.roles[role];
  const label = V2_ROLES.find((r) => r.id === role)?.label ?? role;
  if (!c.model.trim()) throw new Error(`No ${label} model is set. ${SET_IT}`);
  // (its provider as chosen: fal's router, or Google's, OpenAI's or Anthropic's own API)
  return { ...textClient(c.provider, c.model.trim(), false, opts, true), reasoning: c.reasoning, temperature: c.temperature };
}

// The Director's model, checked right before each call: an empty one would
// make lib/ai/motion-director.ts fall back to OPENAI_MODEL / gpt-5-mini.
export function v2DirectorModel(model: unknown): string {
  const m = typeof model === "string" ? model.trim() : "";
  if (!m) throw new Error(`The Director has no model. ${SET_IT}`);
  return m;
}

export async function v2Whisper(config?: AiConfig): Promise<string> {
  const model = (config ?? (await getAiConfig())).v2.whisper;
  if (!model) throw new Error(`No Whisper model is set. ${SET_IT}`);
  return model;
}

// The voice name for this video: the customer's pick, else the gender's name,
// else the first listed voice of that gender (all from /admin/models).
export function v2VoiceName(voice: AiConfig["voice"], gender: string, picked?: string | null): string {
  const g = gender === "female" ? "female" : "male";
  const name = picked?.trim() || voice[g] || voice.choices.find((c) => c.gender === g)?.name;
  if (!name) throw new Error(`No ${g} voice name is set. ${SET_IT}`);
  return name;
}

// The script spoken by the voice model on /admin/models (its own template).
// The voice's provider: a fal model (it answers with a URL), or Google's Gemini TTS or OpenAI's speech (they
// answer with the audio itself, `audio`) — `units` priced per the admin's per-unit price: characters (fal,
// OpenAI) or audio tokens (Gemini).
export async function v2Speak(input: { script: string; language: string; style: string; gender: string; voice?: string | null }): Promise<{ model: string; requestId: string | null; audioUrl?: string; audio?: { bytes: Uint8Array; type: string }; units: number }> {
  const voice = (await getAiConfig()).voice;
  if (!voice.model) throw new Error(`No voice model is set. ${SET_IT}`);
  const text = input.script.trim();
  if (!text) throw new Error("There is no script to speak.");
  const name = v2VoiceName(voice, input.gender, input.voice);
  const fill = (t: string) => t.replace(/\{\{text\}\}/g, text).replace(/\{\{style\}\}/g, input.style).replace(/\{\{language\}\}/g, input.language).replace(/\{\{gender\}\}/g, input.gender).replace(/\{\{voice\}\}/g, name);
  if (voice.provider === "google") {
    // (the template is Gemini's whole instruction, the script in it — "Say it warmly and fast: {{text}}"; none: the
    // script alone, the safe way: Gemini can read an instruction aloud before the script, as part of the voice)
    const prompt = voice.template.includes("{{text}}") ? fill(voice.template) : text;
    const spoken = await geminiSpeak(voice.model, prompt, name);
    return { model: voice.model, requestId: null, audio: spoken, units: spoken.units };
  }
  if (voice.provider === "openai") {
    const spoken = await openaiSpeak(voice.model, text, name, fill(voice.template.replace(/\{\{text\}\}/g, "")));
    return { model: voice.model, requestId: null, audio: spoken, units: spoken.units };
  }
  const body = buildInput(voice.template || '{"text":"{{text}}"}', { text, language: input.language, style: input.style, gender: input.gender, voice: v2VoiceName(voice, input.gender, input.voice) });
  const result = await falRun(voice.model, body, "audio");
  return { model: voice.model, requestId: result.requestId, audioUrl: result.url, units: text.length };
}

// The script's own words on its voice: by the voice's pauses (no AI — lib/voice-align.ts: Whisper
// hears Bangla badly, writing it in another script and losing its place), else on the times the
// admin's Whisper hears, told the voice is Bangla. `heard`: whether Whisper was called (it is priced).
export async function v2TimeScript(audioUrl: string, script: string): Promise<{ words: WordTiming[]; model: string; requestId: string | null; seconds: number; heard: boolean }> {
  const aligned = await alignVoice(audioUrl, script).catch((e) => (console.warn("pause timing failed:", e instanceof Error ? e.message : e), null));
  if (aligned?.length) return { words: aligned, model: "pauses", requestId: null, seconds: lastEnd(aligned), heard: false };
  const model = await v2Whisper();
  const { heard, requestId } = await heardWords(model, audioUrl, "bn");
  const words = retimeScript(script, heard);
  if (!words?.length) throw new Error(`${model} could not time the voice to the script.`);
  return { words, model, requestId, seconds: lastEnd(heard), heard: true };
}

// The customer's own recording with no script written (videos made before the script was asked
// for): what the admin's Whisper hears is the script.
export async function v2Transcribe(audioUrl: string) {
  const model = await v2Whisper();
  const { heard, requestId } = await heardWords(model, audioUrl, "bn");
  const words = heard.filter((w) => w.text.trim());
  if (!words.length) throw new Error(`${model} heard no words in the uploaded voice.`);
  return { words, script: words.map((w) => w.text).join(" "), model, requestId, seconds: lastEnd(words) };
}

const lastEnd = (words: WordTiming[]) => (words.length ? Math.max(...words.map((w) => w.end)) : 0);
