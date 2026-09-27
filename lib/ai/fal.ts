import "server-only";
import { createFalClient } from "@fal-ai/client";

export type VoiceInput = { script: string; language: string; style: string };
export type VoiceResult = { model: string; requestId: string; audioUrl: string };

const SCRIPT_MAX = 5_000;
const TIMEOUT_MS = 55_000;

// Input shape differs per Fal model, so it is configured, not guessed.
// FAL_VOICE_INPUT_TEMPLATE is JSON with {{text}}, {{language}}, {{style}} placeholders,
// e.g. {"text":"{{text}}","language":"{{language}}"}. Defaults to {"text":"{{text}}"}.
function buildInput(values: Record<string, string>): Record<string, unknown> {
  const template = JSON.parse(process.env.FAL_VOICE_INPUT_TEMPLATE || '{"text":"{{text}}"}');
  const fill = (v: unknown): unknown =>
    typeof v === "string"
      ? v.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m)
      : Array.isArray(v)
        ? v.map(fill)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]))
          : v;
  return fill(template) as Record<string, unknown>;
}

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|$)/i;

// Finds the audio URL in a model-specific response (e.g. `audio.url` or `audio_url`).
function findAudioUrl(value: unknown, inAudio = false): string | undefined {
  if (typeof value === "string")
    return /^https?:\/\//.test(value) && (inAudio || AUDIO_EXT.test(value)) ? value : undefined;
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  const audio =
    inAudio || (typeof obj.content_type === "string" && obj.content_type.startsWith("audio/"));
  for (const [k, v] of Object.entries(obj)) {
    const url = findAudioUrl(v, audio || /audio/i.test(k));
    if (url) return url;
  }
}

export async function generateVoice({ script, language, style }: VoiceInput): Promise<VoiceResult> {
  const credentials = process.env.FAL_KEY;
  const model = process.env.FAL_VOICE_MODEL;
  if (!credentials) throw new Error("FAL_KEY is not configured.");
  if (!model) throw new Error("FAL_VOICE_MODEL is not configured.");

  const text = script.trim().slice(0, SCRIPT_MAX);
  if (!text) throw new Error("The brief has no script to narrate.");

  const fal = createFalClient({ credentials });
  const result = await fal.subscribe(model, {
    input: buildInput({ text, language, style }),
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const audioUrl = findAudioUrl(result.data);
  if (!audioUrl) throw new Error("Voice model returned no audio URL.");
  return { model, requestId: result.requestId, audioUrl };
}
