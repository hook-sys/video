import type { WordTiming } from "@/lib/voice-timing";

// Real word timestamps for REFERENCE_NARRATION from a stored ElevenLabs v3
// (fal-ai/elevenlabs/tts/eleven-v3) voice result, as saved in
// voice_result.timing.words. Kept verbatim, including the standalone "." token
// the provider returned, so timing alignment is tested on real-world output.
export const REFERENCE_VOICE_WORDS: WordTiming[] = [
  { text: "Too", start: 0, end: 0.08 },
  { text: "many", start: 0.144, end: 0.4 },
  { text: "tasks", start: 0.507, end: 1.04 },
  { text: ".", start: 1.04, end: 1.32 },
  { text: "Too", start: 1.39, end: 1.6 },
  { text: "many", start: 1.648, end: 1.84 },
  { text: "tabs.", start: 1.968, end: 2.64 },
  { text: "Too", start: 2.74, end: 3.04 },
  { text: "much", start: 3.104, end: 3.36 },
  { text: "to", start: 3.413, end: 3.52 },
  { text: "manage.", start: 3.589, end: 4.36 },
  { text: "Bring", start: 4.42, end: 4.72 },
  { text: "everything", start: 4.756, end: 5.12 },
  { text: "together", start: 5.173, end: 5.6 },
  { text: "in", start: 5.68, end: 5.84 },
  { text: "one", start: 5.9, end: 6.08 },
  { text: "simple", start: 6.137, end: 6.48 },
  { text: "workspace.", start: 6.552, end: 7.28 },
  { text: "Organize", start: 7.413, end: 8.32 },
  { text: "your", start: 8.352, end: 8.48 },
  { text: "work,", start: 8.56, end: 9.2 },
  { text: "track", start: 9.253, end: 9.52 },
  { text: "your", start: 9.552, end: 9.68 },
  { text: "progress,", start: 9.751, end: 10.72 },
  { text: "and", start: 10.74, end: 10.8 },
  { text: "get", start: 10.86, end: 11.04 },
  { text: "more", start: 11.088, end: 11.28 },
  { text: "done.", start: 11.36, end: 11.84 },
  { text: "Less", start: 11.984, end: 12.56 },
  { text: "chaos.", start: 12.68, end: 13.6 },
  { text: "More", start: 13.664, end: 13.92 },
  { text: "clarity.", start: 13.99, end: 14.56 },
];
