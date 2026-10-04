import "server-only";
import { createFalClient } from "@fal-ai/client";
import { parseWordTimings, retimeScript, type WordTiming } from "@/lib/voice-timing";
import { type AiConfig, getAiConfig } from "@/lib/ai/models";

// voice: the customer's pick (a name of the model's), else the gender's default.
export type VoiceInput = { script: string; language: string; style: string; gender: string; voice?: string | null };
export type VoiceResult = {
  model: string;
  requestId: string;
  audioUrl: string;
  // Provider word timestamps; null when the model returned none we can read.
  words: WordTiming[] | null;
  // Short sample of an unreadable timestamp payload, for diagnosis only.
  timestampsSample?: string;
};
// `guardrails` replaces the default abstract-asset guardrails (story assets
// need photographic product/scene imagery).
export type ImageInput = { prompt: string; format: string; guardrails?: string };
export type ImageResult = { model: string; requestId: string; imageUrl: string };

const SCRIPT_MAX = 5_000;
const TIMEOUT_MS = 55_000;
// A whole script's voice: some models (Gemini TTS) take a minute or more.
const VOICE_TIMEOUT_MS = 180_000; // (the whole pipeline has 300 s)

// Input shape differs per Fal model, so it is configured, not guessed.
// FAL_VOICE_INPUT_TEMPLATE is JSON with {{text}}, {{language}}, {{style}}, {{gender}}, {{voice}} placeholders,
// e.g. {"text":"{{text}}","language":"{{language}}"}. Defaults to {"text":"{{text}}"}.
// FAL_IMAGE_INPUT_TEMPLATE uses {{prompt}}, {{format}}, {{aspect_ratio}} ("16:9"), {{image_size}}
// ("landscape_16_9"). Defaults to {"prompt":"{{prompt}}"}.
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

// fal's named image sizes per video shape ({{image_size}} in a template).
const IMAGE_SIZE: Record<string, string> = { "16:9": "landscape_16_9", "9:16": "portrait_16_9", "1:1": "square_hd" };

// Appended to every image prompt regardless of manifest content.
const IMAGE_GUARDRAILS =
  "Flat vector or clean 3D abstract style, not stock photography. " +
  "No animals, no animal characters, no mascots, no people, no readable text, no letters, no numbers, no logos.";

// `override`: unsaved settings, for the admin page's test.
export async function generateImage({ prompt, format, guardrails = IMAGE_GUARDRAILS }: ImageInput, override?: Partial<AiConfig["image"]>): Promise<ImageResult> {
  // /admin/models first, then the environment
  const image = { ...(await getAiConfig()).image, ...override };
  if (!image.on) throw new Error("Image generation is turned off on /admin/models.");
  const model = image.model || process.env.FAL_IMAGE_MODEL;
  if (!model) throw new Error("FAL_IMAGE_MODEL is not configured.");

  const input = buildInput(image.template || process.env.FAL_IMAGE_INPUT_TEMPLATE || '{"prompt":"{{prompt}}"}', {
    prompt: `${prompt.trim().slice(0, 1_000)} ${guardrails}`,
    format,
    aspect_ratio: format,
    image_size: IMAGE_SIZE[format] ?? "landscape_16_9",
  });
  // FLUX and Recraft take a named size: the video's shape unless the template set one.
  if (/flux|recraft/.test(model) && input.image_size === undefined && IMAGE_SIZE[format]) input.image_size = IMAGE_SIZE[format];
  // fal-ai/nano-banana-2 takes the video's aspect ratio directly ("16:9", "9:16", "1:1").
  if (model.includes("nano-banana") && input.aspect_ratio === undefined && ["16:9", "9:16", "1:1"].includes(format)) {
    input.aspect_ratio = format;
  }
  try {
    const result = await falRun(model, input, "image");
    return { model, requestId: result.requestId, imageUrl: result.url };
  } catch (e) {
    // A model chosen on /admin/models that fails falls back to the
    // environment's (not in the admin page's test).
    const envModel = process.env.FAL_IMAGE_MODEL;
    if (override || !image.model || !envModel || envModel === model) throw e;
    console.warn("image model failed; environment model instead:", { model, error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
    return generateImage({ prompt, format, guardrails }, { model: envModel, template: process.env.FAL_IMAGE_INPUT_TEMPLATE || "" });
  }
}

// Model voice for the customer's gender choice. Defaults are ElevenLabs preset
// voices (the configured fal-ai/elevenlabs model); override per model via env.
// /admin/models names win over the environment's.
export function voiceForGender(gender: string, names: { female?: string; male?: string } = {}) {
  return gender === "female"
    ? names.female || process.env.FAL_VOICE_FEMALE || "Sarah"
    : names.male || process.env.FAL_VOICE_MALE || "Brian";
}

export async function generateVoice({
  script,
  language,
  style,
  gender,
  voice: picked,
}: VoiceInput, override?: Partial<AiConfig["voice"]>): Promise<VoiceResult> {
  // /admin/models first, then the environment
  const voice = { ...(await getAiConfig()).voice, ...override };
  if (!voice.on) throw new Error("Voice is turned off on /admin/models.");
  const model = voice.model || process.env.FAL_VOICE_MODEL;
  if (!model) throw new Error("FAL_VOICE_MODEL is not configured.");

  const text = script.trim().slice(0, SCRIPT_MAX);
  if (!text) throw new Error("The brief has no script to narrate.");
  // The admin's model speaks with its own voice names: the customer's pick, the
  // gender's name, else the first listed voice of that gender. (The
  // environment's default names belong to its own model and are never sent.)
  if (voice.model && !picked) {
    const own = gender === "female" ? voice.female : voice.male;
    const listed = voice.choices.find((c) => c.gender === (gender === "female" ? "female" : "male"))?.name;
    if (!own && listed) voice[gender === "female" ? "female" : "male"] = listed;
    if (!own && !listed) throw new Error(`No ${gender === "female" ? "female" : "male"} voice name is set for ${voice.model} on /admin/models.`);
  }
  const speak = (m: string, template: string, names: { female?: string; male?: string }) => {
    const input = buildInput(template || '{"text":"{{text}}"}', { text, language, style, gender, voice: (names === voice && picked) || voiceForGender(gender, names) });
    // fal-ai/elevenlabs/tts/* return per-word timestamps only when asked.
    if (m.includes("elevenlabs/tts/") && input.timestamps === undefined) input.timestamps = true;
    return falRun(m, input, "audio");
  };
  const envModel = process.env.FAL_VOICE_MODEL;
  let used = model;
  let result: Awaited<ReturnType<typeof falRun>>;
  try {
    result = await speak(model, voice.template || process.env.FAL_VOICE_INPUT_TEMPLATE || "", voice);
  } catch (e) {
    // A model chosen on /admin/models that fails never stops a video: the
    // environment's voice speaks instead. (The admin page's test has no fallback.)
    if (override || !voice.fallback || !voice.model || !envModel || envModel === model) throw e;
    console.warn("voice model failed; environment voice instead:", { model, error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
    used = envModel;
    result = await speak(envModel, process.env.FAL_VOICE_INPUT_TEMPLATE || "", {});
  }
  const raw = (result.data as Record<string, unknown> | null)?.timestamps;
  const words = parseWordTimings(raw);
  const timestampsSample = !words && raw != null ? JSON.stringify(raw).slice(0, 300) : undefined;
  return { model: used, requestId: result.requestId, audioUrl: result.url, words, timestampsSample };
}

// Word times for a voice that came without them: fal's Whisper hears the audio
// word by word, and the script's own words are placed on those times
// (lib/voice-timing.ts retimeScript). Null when nothing usable came back.
export const WORD_TIMING_MODEL = "fal-ai/whisper";
export async function timeWords(audioUrl: string, script: string): Promise<{ words: WordTiming[]; requestId: string; model: string; seconds: number } | null> {
  const result = await falClient().subscribe(WORD_TIMING_MODEL, {
    input: { audio_url: audioUrl, task: "transcribe", chunk_level: "word" },
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const chunks = ((result.data as { chunks?: unknown } | null)?.chunks ?? []) as { timestamp?: unknown; text?: unknown }[];
  const heard: WordTiming[] = [];
  for (const ch of Array.isArray(chunks) ? chunks : []) {
    const ts = Array.isArray(ch.timestamp) ? ch.timestamp : [];
    const [start, end] = [Number(ts[0]), Number(ts[1] ?? ts[0])];
    const text = typeof ch.text === "string" ? ch.text.trim() : "";
    if (!text || !Number.isFinite(start)) continue;
    // a chunk of several words (segment level): its words share its time evenly
    const parts = text.split(/\s+/);
    const stop = Number.isFinite(end) && end >= start ? end : start + 0.3 * parts.length;
    parts.forEach((t, i) => heard.push({ text: t, start: start + ((stop - start) * i) / parts.length, end: start + ((stop - start) * (i + 1)) / parts.length }));
  }
  const words = retimeScript(script, heard);
  return words ? { words, requestId: result.requestId, model: WORD_TIMING_MODEL, seconds: heard.length ? heard[heard.length - 1].end : 0 } : null;
}

// One fal call that returns media; errors carry fal's reason (which input
// field it rejected), not just "Unprocessable Entity".
async function falRun(model: string, input: Record<string, unknown>, kind: "audio" | "image") {
  try {
    const result = await falClient().subscribe(model, { input, abortSignal: AbortSignal.timeout(kind === "audio" ? VOICE_TIMEOUT_MS : TIMEOUT_MS) });
    const url = findMediaUrl(result.data, kind);
    if (!url) throw new Error(`${model} returned no ${kind} URL. Its answer: ${JSON.stringify(result.data).slice(0, 300)}`);
    return { data: result.data, requestId: result.requestId, url };
  } catch (e) {
    const err = e as { status?: number; body?: { detail?: unknown } | unknown; message?: string; name?: string };
    if (err?.name === "TimeoutError" || /aborted due to timeout/i.test(err?.message ?? ""))
      throw new Error(`${model} took longer than ${Math.round((kind === "audio" ? VOICE_TIMEOUT_MS : TIMEOUT_MS) / 1000)} s and was stopped.`);
    if (!err?.status) throw e;
    const body = err.body as { detail?: unknown } | undefined;
    const detail = Array.isArray(body?.detail)
      ? (body!.detail as { loc?: unknown[]; msg?: string }[]).map((d) => `${(d.loc ?? []).filter((x) => x !== "body").join(".")}: ${d.msg ?? ""}`).join("; ")
      : JSON.stringify(body?.detail ?? body ?? "");
    throw new Error(`${model}: ${err.status} ${err.message ?? ""}${detail && detail !== '""' ? ` — ${detail}` : ""}`.slice(0, 600));
  }
}

// One sound effect (fal-ai/elevenlabs/sound-effects/v2), for building the
// SFX library in public/sfx. Returns the audio file's bytes.
export async function generateSoundEffect(text: string, durationSeconds: number): Promise<{ requestId: string; url: string; audio: ArrayBuffer }> {
  const fal = falClient();
  const result = await fal.subscribe("fal-ai/elevenlabs/sound-effects/v2", {
    input: { text, duration_seconds: Math.max(0.5, durationSeconds), prompt_influence: 0.5, output_format: "mp3_44100_128" },
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const url = findMediaUrl(result.data, "audio");
  if (!url) throw new Error("Sound-effects model returned no audio URL.");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Audio download failed: ${res.status}`);
  return { requestId: result.requestId, url, audio: await res.arrayBuffer() };
}
