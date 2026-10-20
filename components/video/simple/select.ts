import { rng } from "./faces";
import { framesOf } from "./beats";
import { type Beat, type Brand, FPS, GROUNDS, type Ground, PACES, type Reading, type Scene, type Show, type SimplePlan, TYPE_PAIRS, TEMPLATES, type TemplateId, type Theme, VARIANTS, WAYS, type Word } from "./types";

// The selector: each beat's template and variant, and the video's theme —
// drawn from a seed, never the same template twice in a row, and unlike
// this customer's last videos in what a viewer sees (docs/video-spec.md).

// what each intent can be played as, with how often (a template that needs
// things — tiles, steps, chips — only when the beat has them): the same
// script drawn again tells a beat another way
export function choices(r: Reading): [TemplateId, number][] {
  const many = r.items.length >= 2, three = r.items.length >= 3;
  const only = (xs: [TemplateId, number, boolean?][]) => xs.filter(([, , ok]) => ok !== false).map(([t, w]) => [t, w] as [TemplateId, number]);
  switch (r.intent) {
    case "hook": return only([["statement", 0.4], ["kinetic", 0.35], ["trouble", 0.25, many]]);
    case "problem": return only([["trouble", 0.45, many], ["compare", 0.2, many], ["kinetic", 0.2], ["statement", 0.15]]);
    case "solution": return only([["reveal", 0.5], ["compare", 0.2, many], ["bento", 0.15, three], ["statement", 0.15]]);
    case "feature": return many ? only([["feature", 0.4], ["messages", 0.2], ["bento", 0.2, three], ["chart", 0.1, !!r.number], ["statement", 0.1]]) : r.items.length ? [["feature", 0.5], ["messages", 0.3], ["statement", 0.2]] : [["statement", 0.6], ["kinetic", 0.4]];
    // (a chart or a number only when the voice says one)
    case "proof": return r.number ? [["stat", 0.75], ["chart", 0.25]] : only([["bento", 0.3, three], ["feature", 0.3, r.items.length > 0], ["statement", 0.4]]);
    case "steps": return many ? only([["steps", 0.7], ["bento", 0.3, three]]) : [["statement", 1]];
    case "cta": return [["cta", 1]];
  }
}
// what the story plan says a beat shows, as the templates that show it (they are drawn three times as often)
const SHOWN_AS: Record<Show, TemplateId[]> = { pains: ["trouble", "compare"], "before-after": ["compare"], product: ["screen", "feature", "messages"], list: ["bento", "feature"], number: ["stat", "chart"], steps: ["steps"], brand: ["reveal"], words: ["statement", "kinetic"] };
// (and one the intent alone would not draw, when the beat has what it needs: things to list, a number said)
const fits = (t: TemplateId, r: Reading) => {
  const n = r.items.length;
  // (a picture of the product is offered by the draw, while there are pictures left)
  if (t === "screen") return false;
  return t === "bento" ? n >= 3 : t === "trouble" || t === "compare" || t === "steps" ? n >= 2 : t === "messages" ? n >= 1 : t === "stat" || t === "chart" ? !!r.number : t !== "cta";
};
export function planned(r: Reading, list: [TemplateId, number][]): [TemplateId, number][] {
  if (!r.shows) return list;
  const top = Math.max(0.1, ...list.map(([, w]) => w));
  const added = SHOWN_AS[r.shows].filter((t) => !list.some(([x]) => x === t) && fits(t, r)).map((t): [TemplateId, number] => [t, top]);
  return [...list, ...added].map(([t, w]) => [t, SHOWN_AS[r.shows!].includes(t) ? w * 3 : w]);
}

// one of them by its weight, never the one before (unless it is all there is)
function pickOf(list: [TemplateId, number][], prev: TemplateId | null, R: ReturnType<typeof rng>): TemplateId {
  const open = list.filter(([t]) => t !== prev);
  const from = open.length ? open : list;
  let x = R.next() * from.reduce((a, [, w]) => a + w, 0);
  for (const [t, w] of from) if ((x -= w) <= 0) return t;
  return from[from.length - 1][0];
}

// a colour too grey to fill the ground with
export function grey(hex: string): boolean {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(r, g, b) - Math.min(r, g, b) < 40;
}

// A scene of the words alone, with no hero (docs/reference: the promos show
// the product; words alone are a beat for emphasis, not the video)
export const wordsAlone = (t: TemplateId, v: number) => t === "kinetic" || (t === "statement" && v !== 1);

function draw(words: Word[], beats: Beat[], readings: Reading[], brand: Brand, seed: number, duration: number): Omit<SimplePlan, "w" | "h"> {
  const R = rng(seed);
  const grounds: Ground[] = grey(brand.color) ? GROUNDS.filter((g) => g !== "brand") : [...GROUNDS];
  const theme: Theme = { ground: R.pick(grounds), type: R.int(0, TYPE_PAIRS.length - 1), way: R.pick(WAYS), pace: R.pick(PACES) };
  const frames = framesOf(words, beats, duration);
  // (words alone: at most one scene in four, never two in a row)
  const most = Math.max(1, Math.floor((readings.length - 1) / 4));
  let alone = 0, wasAlone = false;
  // (the product's pictures: each shown once, in a beat about the product)
  const shots = brand.screens?.length ?? 0;
  let pictured = 0;
  let prev: TemplateId | null = null;
  const scenes: Scene[] = readings.map((read, i) => {
    // (a thing that only repeats the words shown beside it is not shown again)
    const [c0, c1] = keyRun(words, read.show, read.key, 4);
    const said = words.slice(c0, c1 + 1).map((w) => w.text).join(" ");
    const r = { ...read, items: read.items.filter((it) => !repeats(it.text, said)) };
    // (the last beat is always the brand and the ask)
    const about = r.intent === "feature" || r.intent === "solution" || r.shows === "product";
    const base: [TemplateId, number][] = i === readings.length - 1 ? [["cta", 1]] : [...choices(r).filter(([t]) => t !== "cta"), ...(pictured < shots && about ? [["screen", r.intent === "solution" ? 0.35 : 0.6] as [TemplateId, number]] : [])];
    const list = i === readings.length - 1 ? base : planned(r, base);
    let template = pickOf(list, prev, R);
    // (a variant that needs things only when there are some)
    let variant = R.int(0, VARIANTS - 1);
    if (!variantOk(template, variant, r.items.length)) variant = template === "chart" ? R.int(0, 1) : 0;
    // (the video's main moment always shows something)
    if (wordsAlone(template, variant) && (wasAlone || alone >= most || r.hero)) {
      // another way to tell it with a hero, else the words beside its icon
      const shown = list.filter(([t]) => t !== "statement" && t !== "kinetic");
      if (shown.length) {
        template = pickOf(shown, prev, R);
        variant = R.int(0, VARIANTS - 1);
        if (!variantOk(template, variant, r.items.length)) variant = template === "chart" ? R.int(0, 1) : 0;
      } else [template, variant] = ["statement", 1];
    }
    // (words typed as a prompt only when they ask something)
    if (template === "kinetic" && variant === 1 && !/\?["'”’)]*$/.test(words[r.show[1]]?.text ?? "")) variant = R.chance(0.5) ? 0 : 2;
    wasAlone = wordsAlone(template, variant);
    if (wasAlone) alone++;
    const screen = template === "screen" ? pictured++ : undefined;
    prev = template;
    // (beside a hero — or under the brand's mark — the words are its caption: at most four of them, around the key one)
    const [start, end] = wasAlone || template === "cta" ? r.show : keyRun(words, r.show, r.key, 4);
    const shown = words.slice(start, end + 1);
    // (the words come in as they are said — the first never later than 4 frames into the scene, the
    // video's very first at once: no empty start)
    const late = Math.max(0, Math.round((shown[0]?.start ?? 0) * FPS) - (frames[i].from + (frames[i].from ? 4 : 0)));
    return {
      ...frames[i],
      template,
      variant,
      left: R.chance(0.5),
      words: shown.map((w, k) => ({ t: shownWord(w.text, k, shown.length), at: Math.max(frames[i].from, Math.round(w.start * FPS) - late), key: start + k === r.key })),
      icon: r.icon ?? "sparkles",
      items: r.items.slice(0, 3),
      number: r.number,
      ...(screen != null ? { screen } : {}),
      said: words.slice(beats[i].first, beats[i].last + 1).map((w) => ({ t: w.text, at: Math.round(w.start * FPS) })),
    };
  });
  return { engine: "simple", v: 1, duration, seed, brand, theme, scenes, print: printOf(theme, scenes) };
}

// a variant that needs things (the things flying into the mark, bars of the things) only when there are some
// (and a search that types one thing and shows the rest as results only with two or more)
export const variantOk = (template: TemplateId, variant: number, items: number) => !(template === "reveal" && variant > 0 && items < 2) && !(template === "chart" && variant === 2 && items < 2) && !(template === "feature" && variant === 2 && items < 2);

// what makes a video look like itself: its ground, type, transitions, pace and template order
// (and the scenes on a ground of their own, when there are any)
export const printOf = (theme: Theme, scenes: Scene[]) => {
  const own = scenes.map((s) => (s.ground && s.ground !== theme.ground ? s.ground[0] : "-")).join("");
  return [theme.ground, theme.type, theme.way, theme.pace, scenes.map((s) => `${TEMPLATES.indexOf(s.template).toString(36)}${s.variant}`).join(""), ...(/[^-]/.test(own) ? [own] : [])].join("|");
};

// One scene, one idea: what is shown once is not shown twice
const LITTLE = new Set(["a", "an", "the", "and", "or", "but", "of", "to", "for", "in", "on", "at", "by", "with", "from", "your", "our", "its", "is", "are", "be", "it", "that", "this"]);
const tokens = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, " ").trim().split(" ").filter((x) => x && !LITTLE.has(x));
// a thing whose words are (nearly) all in the words shown
export function repeats(thing: string, said: string): boolean {
  const a = tokens(thing), b = new Set(tokens(said));
  return !!a.length && a.filter((x) => b.has(x)).length / a.length >= 0.66;
}
// the run of at most `most` words around the key one, never starting or ending on a little word (when it can be helped)
export function keyRun(words: Word[], [a, b]: [number, number], key: number | null, most: number): [number, number] {
  if (b - a + 1 <= most) return [a, b];
  const k = key ?? a;
  const little = (i: number) => LITTLE.has(words[i].text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""));
  const runs: [number, number][] = [];
  for (let n = most; n >= 2; n--) for (let from = Math.max(a, k - n + 1); from <= Math.min(k, b - n + 1); from++) runs.push([from, from + n - 1]);
  // (the longest that does not start or end on a little word, the key nearest its middle)
  const clean = runs.filter(([x, y]) => !little(x) && !little(y));
  const pool = clean.length ? clean : runs;
  const n = pool[0][1] - pool[0][0];
  return pool.filter(([x, y]) => y - x === n).sort((p, q) => Math.abs((p[0] + p[1]) / 2 - k) - Math.abs((q[0] + q[1]) / 2 - k))[0];
}

// a word as shown: the first capitalised, the last without a trailing comma or colon
export function shownWord(t: string, k: number, n: number): string {
  let out = k === n - 1 ? t.replace(/[,;:—–-]+$/, "") : t;
  if (k === 0) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

// how many of ground, type, transitions, pace and template order differ
export function differs(a: string, b: string): number {
  const x = a.split("|"), y = b.split("|");
  return x.reduce((n, v, i) => n + (v !== y[i] ? 1 : 0), 0);
}

// The video: the first of 12 draws unlike the recent ones in at least 3 ways
// (else the most unlike).
export function planOf({ words, beats, readings, brand, seed, duration, recent = [], size = [1920, 1080] }: { words: Word[]; beats: Beat[]; readings: Reading[]; brand: Brand; seed: number; duration: number; recent?: string[]; size?: [number, number] }): SimplePlan {
  let best: Omit<SimplePlan, "w" | "h"> | null = null, bestScore = -1;
  for (let k = 0; k < 12; k++) {
    const p = draw(words, beats, readings, brand, (seed + k * 7919) >>> 0, duration);
    const score = recent.length ? Math.min(...recent.map((r) => differs(p.print, r))) : 5;
    if (score > bestScore) [best, bestScore] = [p, score];
    if (score >= 3) break;
  }
  return { ...best!, w: size[0], h: size[1] };
}
