import { tokenize, type WordTiming } from "@/lib/voice-timing";
import { same } from "../sync";

// Voice cue → absolute time. Narration words get a time from the voice's word
// timestamps when they align, otherwise from an estimate of natural pacing.

export type SpokenWord = { text: string; at: number };

type Tok = { text: string; pause: number; at: number };

function narrationTokens(narration: string): Tok[] {
  return narration.split(/\s+/).flatMap((raw) => {
    const toks = tokenize(raw);
    const pause = /[.!?]["')\]]*$/.test(raw) ? 0.38 : /[,;:—–-]["')\]]*$/.test(raw) ? 0.16 : 0;
    return toks.map((text, i) => ({ text, pause: i === toks.length - 1 ? pause : 0, at: NaN }));
  });
}

// Natural pacing: time proportional to word length plus punctuation pauses.
function estimate(toks: Tok[], duration: number) {
  const start = 0.15;
  const end = Math.max(start + 1, duration - 0.9);
  const weight = (t: Tok) => 0.09 * (t.text.length + 2.5);
  const total = toks.reduce((n, t) => n + weight(t) + t.pause, 0) || 1;
  const k = (end - start) / total;
  let at = start;
  for (const t of toks) {
    t.at = at;
    at += (weight(t) + t.pause) * k;
  }
}

// Walks narration and voice words in order; unmatched words are interpolated.
function align(toks: Tok[], words: WordTiming[]) {
  const stream = words.flatMap((w) => tokenize(w.text).map((t) => ({ t, start: w.start })));
  let p = 0;
  let matched = 0;
  for (const tok of toks) {
    for (let q = p; q < Math.min(stream.length, p + 6); q++) {
      if (same(stream[q].t, tok.text)) {
        tok.at = stream[q].start;
        p = q + 1;
        matched++;
        break;
      }
    }
  }
  if (matched < toks.length * 0.5) return false;
  for (let i = 0; i < toks.length; i++) {
    if (!Number.isNaN(toks[i].at)) continue;
    const prev = [...toks.slice(0, i)].reverse().find((t) => !Number.isNaN(t.at));
    const next = toks.slice(i + 1).find((t) => !Number.isNaN(t.at));
    toks[i].at = prev && next ? (prev.at + next.at) / 2 : (prev?.at ?? next?.at ?? 0);
  }
  return true;
}

export function spokenWords(narration: string, durationSeconds: number, words?: WordTiming[] | null) {
  const toks = narrationTokens(narration);
  const synced = !!words?.length && align(toks, words);
  if (!synced) estimate(toks, durationSeconds);
  return { spoken: toks.map(({ text, at }) => ({ text, at })), synced };
}

// First occurrence of the cue's words at or after `from` (word index).
export function findCue(spoken: SpokenWord[], cue: string, from: number) {
  const want = tokenize(cue);
  if (!want.length) return null;
  for (let i = from; i < spoken.length; i++) {
    if (want.every((w, j) => spoken[i + j] && same(spoken[i + j].text, w))) return { index: i, at: spoken[i].at };
  }
  // Tolerate a partial cue: its first two words.
  for (let i = from; i < spoken.length; i++) {
    if (want.slice(0, 2).every((w, j) => spoken[i + j] && same(spoken[i + j].text, w))) return { index: i, at: spoken[i].at };
  }
  return null;
}
