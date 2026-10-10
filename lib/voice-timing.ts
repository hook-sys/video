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

// Same word, tolerating inflection ("video"/"videos"); matches sync.ts.
export const sameWord = (a: string, b: string) =>
  a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

// How many voice tokens from `i` spell the word `w`: voices sometimes split a
// word, a brand name above all ("Plateful" → "Pl" + "ateful"), so 1–3
// adjacent tokens may join into it. 0 when they don't.
export function tokensForWord(stream: { t: string }[], i: number, w: string): number {
  // The exact join wins: "Motion" + "Brief" is "MotionBrief" (a bare
  // "Motion" is only its start), "108" + "0p" is "1080p".
  let joined = "";
  let loose = 0;
  for (let k = 0; k < 3 && i + k < stream.length; k++) {
    joined += stream[i + k].t;
    if (joined === w) return k + 1;
    if (k === 0 && sameWord(joined, w)) loose = 1;
    if (!w.startsWith(joined)) break;
  }
  return loose;
}

// Where each cue phrase is actually spoken: the start time of its first word in
// the voice's word stream, matched in order (each cue after the previous one).
// null when the phrase isn't spoken (in that order).
export function spokenCueTimes(cues: string[], words: WordTiming[]): (number | null)[] {
  const stream = words.flatMap((w) => tokenize(w.text).map((t) => ({ t, start: w.start })));
  let from = 0;
  return cues.map((cue) => {
    const want = tokenize(cue);
    if (!want.length) return null;
    for (let i = from; i < stream.length; i++) {
      let at = i;
      const ok = want.every((w) => {
        const n = tokensForWord(stream, at, w);
        at += n;
        return n > 0;
      });
      if (ok) {
        from = i + 1;
        return stream[i].start;
      }
    }
    return null;
  });
}

// The script's own words on the times a speech-to-text pass heard (heard words
// may be spelled differently, merged or split): each script word is placed at
// the same share of the letters, read off the heard words' times. Null when
// nothing was heard.
export function retimeScript(script: string, heard: WordTiming[]): WordTiming[] | null {
  const letters = (w: string) => Math.max(1, w.replace(/[^\p{L}\p{M}\p{N}]/gu, "").length);
  const said = heard.filter((w) => isTime(w.start) && isTime(w.end) && w.end >= w.start);
  const words = script.split(/\s+/).filter(Boolean);
  if (!said.length || !words.length) return null;
  // (letter count so far → time) at every heard word's start and end
  const pts: [number, number][] = [];
  let c = 0;
  for (const w of said) {
    pts.push([c, w.start]);
    c += letters(w.text);
    pts.push([c, w.end]);
  }
  // the time at letter x; on a pause between heard words (two points at the
  // same x) a start takes the pause's end and an end its beginning
  const at = (x: number, late: boolean) => {
    const eps = 1e-9;
    if (late) {
      for (let i = pts.length - 1; i > 0; i--) {
        const [x0, t0] = pts[i - 1];
        const [x1, t1] = pts[i];
        if (x >= x0 - eps) return x >= x1 - eps ? t1 : t0 + ((x - x0) / (x1 - x0)) * (t1 - t0);
      }
      return pts[0][1];
    }
    if (x <= pts[0][0] + eps) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [x0, t0] = pts[i - 1];
      const [x1, t1] = pts[i];
      if (x <= x1 + eps) return x1 - x0 < eps ? t0 : t0 + ((x - x0) / (x1 - x0)) * (t1 - t0);
    }
    return pts[pts.length - 1][1];
  };
  const total = words.reduce((n, w) => n + letters(w), 0);
  const scale = c / total;
  let s = 0;
  const out = words.map((text) => {
    const start = at(s * scale, true);
    s += letters(text);
    return { text, start, end: Math.max(start, at(s * scale, false)) };
  });
  return out.every((w, i) => i === 0 || w.start >= out[i - 1].start) ? out : null;
}

// Words timed at an even pace over `durationSeconds` (no voice to time them).
export function estimateWords(narration: string, durationSeconds: number): WordTiming[] {
  const words = narration.split(/\s+/).filter(Boolean);
  const per = (durationSeconds * 0.92) / Math.max(1, words.length);
  return words.map((text, i) => ({ text, start: 0.25 + i * per, end: 0.25 + (i + 1) * per }));
}
