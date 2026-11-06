import type { WordTiming } from "@/lib/voice-timing";

// The script's own words on its own voice, by the voice's pauses — no speech
// recognition: a recogniser that hears Bangla badly (Whisper writes it in
// another script, loses its place for whole sentences) cannot misplace them.
// The script is cut where it pauses in writing (। ? ! , ; :); the voice is
// cut where it is silent. Each run of the script's phrases is fitted to a run
// of the voice between two pauses so that its length in letters matches its
// length in time (the reader's pace, found from the whole), the phrases'
// ends kept on real pauses; inside a run, each word takes its share of the
// speech by its letters (pauses inside skipped).

export type Span = { start: number; end: number };

// ── where the voice is silent ──────────────────────────────────────────────
// pcm: mono samples; a pause is a stretch quieter than the speech's own floor
// for at least `least` seconds
export function pausesOf(pcm: Int16Array | Float32Array, rate: number, least = 0.22): { pauses: Span[]; duration: number } {
  const hop = Math.round(rate * 0.01);
  const n = Math.floor(pcm.length / hop);
  const scale = pcm instanceof Int16Array ? 32768 : 1;
  const db: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = i * hop; k < (i + 1) * hop; k++) s += (pcm[k] / scale) ** 2;
    db.push(10 * Math.log10(s / hop + 1e-10));
  }
  // (the speech's level: its loud tenth; silence is well under it)
  const sorted = [...db].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)];
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const cut = Math.max(floor + 6, loud - 30);
  const pauses: Span[] = [];
  let from = -1;
  for (let i = 0; i <= n; i++) {
    const quiet = i < n && db[i] < cut;
    if (quiet && from < 0) from = i;
    if (!quiet && from >= 0) {
      if ((i - from) / 100 >= least) pauses.push({ start: from / 100, end: i / 100 });
      from = -1;
    }
  }
  return { pauses, duration: pcm.length / rate };
}

// ── the script's phrases ───────────────────────────────────────────────────
const letters = (w: string) => Math.max(1, w.replace(/[^\p{L}\p{M}\p{N}]/gu, "").length);
// (a phrase ends where the writing pauses; a sentence's end weighs more)
const ends = (w: string) => /[।?!.,;:—–]["'”’)]*$/.test(w);
const strong = (w: string) => /[।?!.]["'”’)]*$/.test(w);

export function alignScript(script: string, pauses: Span[], duration: number): WordTiming[] | null {
  const words = script.normalize("NFC").split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  // phrases: runs of words up to a pause in the writing
  const phrases: { from: number; to: number; letters: number; strong: boolean }[] = [];
  let a = 0;
  words.forEach((w, i) => {
    if (ends(w) || i === words.length - 1) {
      phrases.push({ from: a, to: i, letters: words.slice(a, i + 1).reduce((s, x) => s + letters(x), 0), strong: strong(w) || i === words.length - 1 });
      a = i + 1;
    }
  });
  // the voice: from its first sound to its last; the pauses inside it are where phrases may end
  const lead = pauses[0]?.start === 0 ? pauses[0].end : 0;
  const tail = pauses.length && Math.abs(pauses[pauses.length - 1].end - duration) < 0.05 ? pauses[pauses.length - 1].start : duration;
  const inner = pauses.filter((p) => p.start > lead && p.end < tail);
  // (cut points: each inner pause; the speech between cut j-1 and j)
  const cuts = [{ start: lead, end: lead }, ...inner, { start: tail, end: tail }];
  const K = cuts.length - 1, P = phrases.length;
  const speech = (j0: number, j1: number) => {
    // speaking time from cut j0's end to cut j1's start, without the pauses between
    let t = cuts[j1].start - cuts[j0].end;
    for (let j = j0 + 1; j < j1; j++) t -= cuts[j].end - cuts[j].start;
    return t;
  };
  const totalLetters = phrases.reduce((s, p) => s + p.letters, 0);
  const pace = speech(0, K) / totalLetters;
  // dp[i][j]: the best cost with the first i phrases ending on cut j
  const INF = 1e18;
  const dp = Array.from({ length: P + 1 }, () => new Float64Array(K + 1).fill(INF));
  const back = Array.from({ length: P + 1 }, () => new Int32Array((K + 1) * 2).fill(-1));
  dp[0][0] = 0;
  for (let i = 0; i < P; i++) {
    for (let j = 0; j < K; j++) {
      if (dp[i][j] >= INF) continue;
      let lt = 0;
      for (let i2 = i + 1; i2 <= Math.min(P, i + 4); i2++) {
        lt += phrases[i2 - 1].letters;
        // (a phrase run that ends a sentence must not be glued past it without a cost)
        const glued = i2 - i - 1;
        const gluedCost = phrases.slice(i, i2 - 1).reduce((s, p) => s + (p.strong ? 2.5 : 0.6), 0);
        const want = lt * pace;
        for (let j2 = j + 1; j2 <= K; j2++) {
          const got = speech(j, j2);
          if (got > want * 2.2 + 1) break;
          // (pauses passed over inside a run: a long one is more likely a phrase's end)
          let skipped = 0;
          for (let jj = j + 1; jj < j2; jj++) skipped += Math.min(1.5, (cuts[jj].end - cuts[jj].start) * 2);
          const rel = (got - want) / Math.max(0.6, Math.sqrt(want));
          const c = dp[i][j] + rel * rel + skipped + gluedCost + (glued ? 0 : 0);
          if (c < dp[i2][j2]) {
            dp[i2][j2] = c;
            back[i2][j2 * 2] = i;
            back[i2][j2 * 2 + 1] = j;
          }
        }
      }
    }
  }
  if (dp[P][K] >= INF) return null;
  // the runs, back from the end
  const runs: { i0: number; i1: number; j0: number; j1: number }[] = [];
  for (let i = P, j = K; i > 0; ) {
    const pi = back[i][j * 2], pj = back[i][j * 2 + 1];
    runs.unshift({ i0: pi, i1: i, j0: pj, j1: j });
    [i, j] = [pi, pj];
  }
  // inside a run: words by their letters over its speech, pauses inside skipped
  const out: WordTiming[] = [];
  for (const r of runs) {
    const segs: Span[] = [];
    for (let j = r.j0; j < r.j1; j++) segs.push({ start: cuts[j].end, end: cuts[j + 1].start });
    const total = segs.reduce((s, x) => s + (x.end - x.start), 0);
    const at = (x: number) => {
      // the time at speaking-time x into the run
      for (const s of segs) {
        const d = s.end - s.start;
        if (x <= d + 1e-9) return s.start + x;
        x -= d;
      }
      return segs[segs.length - 1].end;
    };
    const ws = words.slice(phrases[r.i0].from, phrases[r.i1 - 1].to + 1);
    const lt = ws.reduce((s, w) => s + letters(w), 0);
    let x = 0;
    for (const w of ws) {
      const d = (letters(w) / lt) * total;
      out.push({ text: w, start: Number(at(x + 0.001).toFixed(3)), end: Number(at(x + d).toFixed(3)) });
      x += d;
    }
  }
  return out;
}
