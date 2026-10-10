import { retimeScript } from "@/lib/voice-timing";
import type { ScriptT, Word } from "./types";

// The words a Composer film shows: the script's own words on the voice's
// times. Some voices time pieces of words ("s" "upport", "ang" "ry") and the
// stops on their own ("."); shown as they come they read as broken words.

const letters = (t: string) => t.replace(/[^\p{L}\p{M}\p{N}]/gu, "").length;

export function scriptWords(script: string | null | undefined, voice: Word[]): Word[] {
  const heard = voice.filter((w) => letters(w.text) > 0);
  const text = (script ?? "").trim();
  if (!text || !heard.length) return voice;
  return retimeScript(text, heard) ?? voice;
}

// Older Composer videos were written on the voice's own pieces: each piece's
// index → the index of the script word it is part of (by its place in the letters).
export function pieceToWord(voice: Word[], words: Word[]) {
  const total = (ws: Word[]) => Math.max(1, ws.reduce((n, w) => n + letters(w.text), 0));
  const vt = total(voice), wt = total(words);
  const wordAt: number[] = [];
  let acc = 0;
  for (const w of words) {
    wordAt.push(acc / wt);
    acc += letters(w.text);
  }
  let v = 0;
  const map = voice.map((p) => {
    const x = v / vt;
    v += letters(p.text);
    let j = 0;
    while (j + 1 < wordAt.length && wordAt[j + 1] <= x + 1e-9) j++;
    return j;
  });
  return (i: number) => map[Math.max(0, Math.min(map.length - 1, i))] ?? 0;
}

export function remapScript(script: ScriptT, to: (i: number) => number): ScriptT {
  return {
    ...script,
    scenes: script.scenes.map((s) => ({
      ...s,
      at: to(s.at),
      text: s.text ? { ...s.text, from: to(s.text.from), to: to(s.text.to) } : s.text,
      items: s.items.map((it) => ({ ...it, at: to(it.at), hit: it.hit == null ? it.hit : to(it.hit) })),
    })),
  };
}
