import "server-only";
import { createFalClient } from "@fal-ai/client";

export type VoiceInput = { script: string; language: string; style: string; gender: string };
export type VoiceResult = { model: string; requestId: string; audioUrl: string };
export type ImageInput = { prompt: string; format: string };
export type ImageResult = { model: string; requestId: string; imageUrl: string };

const SCRIPT_MAX = 5_000;
const TIMEOUT_MS = 55_000;

// Input shape differs per Fal model, so it is configured, not guessed.
// FAL_VOICE_INPUT_TEMPLATE is JSON with {{text}}, {{language}}, {{style}}, {{gender}}, {{voice}} placeholders,
// e.g. {"text":"{{text}}","language":"{{language}}"}. Defaults to {"text":"{{text}}"}.
// FAL_IMAGE_INPUT_TEMPLATE uses {{prompt}}, {{format}}. Defaults to {"prompt":"{{prompt}}"}.
function buildInput(templateJson: string, values: Record<string, string>): Record<string, unknown> {
  const template = JSON.parse(templateJson);
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

const MEDIA_EXT = {
  audio: /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|$)/i,
  image: /\.(png|jpe?g|webp)(\?|$)/i,
};

// Finds the media URL in a model-specific response (e.g. `audio.url`, `images[0].url`).
function findMediaUrl(
  value: unknown,
  kind: "audio" | "image",
  inKind = false,
): string | undefined {
  if (typeof value === "string")
    return /^https?:\/\//.test(value) && (inKind || MEDIA_EXT[kind].test(value)) ? value : undefined;
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  const matches =
    inKind || (typeof obj.content_type === "string" && obj.content_type.startsWith(`${kind}/`));
  for (const [k, v] of Object.entries(obj)) {
    const url = findMediaUrl(v, kind, matches || k.toLowerCase().includes(kind));
    if (url) return url;
  }
}

function falClient() {
  const credentials = process.env.FAL_KEY;
  if (!credentials) throw new Error("FAL_KEY is not configured.");
  return createFalClient({ credentials });
}

// Appended to every image prompt regardless of manifest content.
const IMAGE_GUARDRAILS =
  "Flat vector or clean 3D abstract style, not stock photography. " +
  "No animals, no animal characters, no mascots, no people, no readable text, no letters, no numbers, no logos.";

export async function generateImage({ prompt, format }: ImageInput): Promise<ImageResult> {
  const model = process.env.FAL_IMAGE_MODEL;
  if (!model) throw new Error("FAL_IMAGE_MODEL is not configured.");
  const fal = falClient();

  const result = await fal.subscribe(model, {
    input: buildInput(process.env.FAL_IMAGE_INPUT_TEMPLATE || '{"prompt":"{{prompt}}"}', {
      prompt: `${prompt.trim().slice(0, 1_000)} ${IMAGE_GUARDRAILS}`,
      format,
    }),
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const imageUrl = findMediaUrl(result.data, "image");
  if (!imageUrl) throw new Error("Image model returned no image URL.");
  return { model, requestId: result.requestId, imageUrl };
}

// Model voice for the customer's gender choice. Defaults are ElevenLabs preset
// voices (the configured fal-ai/elevenlabs model); override per model via env.
export function voiceForGender(gender: string) {
  return gender === "female"
    ? process.env.FAL_VOICE_FEMALE || "Sarah"
    : process.env.FAL_VOICE_MALE || "Brian";
}

export async function generateVoice({
  script,
  language,
  style,
  gender,
}: VoiceInput): Promise<VoiceResult> {
  const model = process.env.FAL_VOICE_MODEL;
  if (!model) throw new Error("FAL_VOICE_MODEL is not configured.");

  const text = script.trim().slice(0, SCRIPT_MAX);
  if (!text) throw new Error("The brief has no script to narrate.");

  const fal = falClient();
  const result = await fal.subscribe(model, {
    input: buildInput(process.env.FAL_VOICE_INPUT_TEMPLATE || '{"text":"{{text}}"}', {
      text,
      language,
      style,
      gender,
      voice: voiceForGender(gender),
    }),
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const audioUrl = findMediaUrl(result.data, "audio");
  if (!audioUrl) throw new Error("Voice model returned no audio URL.");
  return { model, requestId: result.requestId, audioUrl };
}
