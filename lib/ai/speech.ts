import "server-only";
import { providerKey } from "@/lib/ai/keys";

// The voice from a provider's own speech API (docs/video-spec.md, AI providers): Google's Gemini TTS or
// OpenAI's speech, with the key saved on /admin/models or the environment's. Each answers with the audio
// itself, kept as it is (no URL to fetch). `prompt`: the admin's template with the script in it — Gemini
// reads it as the whole instruction ("Say this energetically: {{text}}"); OpenAI takes it as its
// `instructions` (how to say it) while the script is spoken as written.

const TIMEOUT_MS = 180_000;

// raw 16-bit little-endian PCM → a WAV file
function wav(pcm: Uint8Array, rate: number, channels = 1): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export type Spoken = { bytes: Uint8Array; type: string; units: number };

// Gemini TTS: generateContent with an audio answer (PCM, its rate in the MIME type); `units`: audio tokens
export async function geminiSpeak(model: string, prompt: string, voice: string): Promise<Spoken> {
  const key = providerKey("google");
  if (!key) throw new Error("No Google (Gemini) API key: save one on /admin/models or set GEMINI_API_KEY.");
  const id = model.replace(/^google\//, "").replace(/^models\//, "");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    usageMetadata?: { candidatesTokenCount?: number };
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(`${id}: ${res.status} ${body?.error?.message ?? ""}`.slice(0, 500));
  const part = body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!part?.data) throw new Error(`${id} returned no audio.`);
  const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24000);
  const pcm = Uint8Array.from(Buffer.from(part.data, "base64"));
  return { bytes: wav(pcm, rate), type: "audio/wav", units: body?.usageMetadata?.candidatesTokenCount ?? Math.round((pcm.length / 2 / rate) * 25) };
}

// OpenAI speech: the script as written, the template as how to say it; `units`: characters
export async function openaiSpeak(model: string, text: string, voice: string, instructions: string): Promise<Spoken> {
  const key = providerKey("openai");
  if (!key) throw new Error("No OpenAI API key: save one on /admin/models or set OPENAI_API_KEY.");
  const id = model.replace(/^openai\//, "");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: id, voice, input: text, response_format: "mp3", ...(instructions.trim() ? { instructions: instructions.trim() } : {}) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`${id}: ${res.status} ${e?.error?.message ?? ""}`.slice(0, 500));
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new Error(`${id} returned no audio.`);
  return { bytes, type: "audio/mpeg", units: text.length };
}
