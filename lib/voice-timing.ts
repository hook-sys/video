// Word-level narration timing from the TTS provider, in seconds from audio start.
export type WordTiming = { text: string; start: number; end: number };

const TEXT_KEYS = ["text", "word", "token", "value"];
const START_KEYS = ["start", "start_time", "start_seconds", "start_s", "startTime"];
const END_KEYS = ["end", "end_time", "end_seconds", "end_s", "endTime"];

const pick = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined);
const isTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

// ElevenLabs character alignment → words (split on whitespace).
function fromCharacters(o: Record<string, unknown>): WordTiming[] | null {
  const chars = o.characters;
  const starts = o.character_start_times_seconds;
  const ends = o.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) return null;
  const words: WordTiming[] = [];
  let cur: WordTiming | null = null;
  chars.forEach((c, i) => {
    if (typeof c !== "string" || !isTime(starts[i]) || !isTime(ends[i])) return;
    if (/^\s+$/.test(c)) return void (cur = null);
    if (!cur) words.push((cur = { text: "", start: starts[i], end: ends[i] }));
    cur.text += c;
    cur.end = ends[i];
  });
  return words;
}

// The provider's timestamp payload shape isn't formally documented, so accept
// a word list ({text,start,end}) or ElevenLabs character alignment (optionally
// chunked, absolute times). Returns null when nothing usable is found; never guesses times.
export function parseWordTimings(raw: unknown): WordTiming[] | null {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const words: WordTiming[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const alignment = (o.alignment ?? o.normalized_alignment ?? o) as Record<string, unknown>;
    const chars = fromCharacters(alignment);
    if (chars) {
      words.push(...chars);
      continue;
    }
    const text = pick(o, TEXT_KEYS);
    const start = pick(o, START_KEYS);
    const end = pick(o, END_KEYS);
    if (typeof text === "string" && text.trim() && isTime(start) && isTime(end) && end >= start) {
      words.push({ text: text.trim(), start, end });
    }
  }
  const sorted = words.every((w, i) => i === 0 || w.start >= words[i - 1].start);
  return words.length && sorted ? words : null;
}

// Script-agnostic tokens (Bangla, English, ...): lowercase letters/marks/digits only.
export function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}
