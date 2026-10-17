import type { ComposerPlan, PlacedItem, RowT, TextBlock, Word } from "./types";

// "New version": a video never shows a number the voice did not say.
// Runs with tidied() when a saved or new v2 video is staged (flow.ts), so a
// plan the Director already wrote is cleaned on load. Digits, codes
// (#TX-842), units (150D, 30s), ratios (3/3) and amounts (12,000) come off
// unless that number is in the voice timings. 12,000 and "twelve thousand"
// are the same number; "three" and 3 are the same number. A ratio or a
// clock needs those numbers said together ("three of three", "ten thirty").

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, twelfth: 12,
};
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000, billion: 1_000_000_000 };
const CONNECTOR = new Set("of out to by over per".split(" "));
// a leftover that only named the number's unit ("12,000 Pcs" → "Pcs")
const UNIT = /^(pcs|pc|pieces?|qty|units?|kg|mg|lb|oz|cm|mm|yd|hrs?|mins?|secs?|mo|wk)$/i;

export type Spoken = { values: Set<string>; seqs: string[][] };

const canon = (n: number) => {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? "0" : String(r);
};
// every number written in a token, thousands separators folded in (04 → 4)
const numsOf = (token: string): string[] =>
  (token.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map((m) => canon(Number(m.replace(/,/g, "")))).filter(Boolean);

const stem = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%/:.+-]+$/gu, "");

export function spokenOf(words: Pick<Word, "text">[]): Spoken {
  const values = new Set<string>();
  const seqs: string[][] = [];
  let seq: string[] = [];
  let result = 0;
  let current = 0;
  let active = false;
  const add = (n: number) => {
    const c = canon(n);
    if (c) values.add(c);
    return c;
  };
  const flush = () => {
    if (!active) return;
    const c = add(result + current);
    if (c) seq.push(c);
    result = 0;
    current = 0;
    active = false;
  };
  const close = () => {
    flush();
    if (seq.length) seqs.push(seq);
    seq = [];
  };
  const flat: string[] = [];
  for (const word of words) for (const bit of stem(word.text).split(/-/).filter(Boolean)) flat.push(bit);
  const numberAt = (i: number) => {
    for (let j = i; j < flat.length; j++) {
      if (SMALL[flat[j]] != null) return SMALL[flat[j]];
      if (SCALE[flat[j]]) return SCALE[flat[j]];
      if (CONNECTOR.has(flat[j]) || flat[j] === "and" || flat[j] === "a" || flat[j] === "an") continue;
      return null;
    }
    return null;
  };
  for (let i = 0; i < flat.length; i++) {
    const t = flat[i];
    if (/\d/.test(t)) {
      close();
      const parts = numsOf(t);
      for (const c of parts) values.add(c);
      if (parts.length) seqs.push(parts);
      continue;
    }
    if (t === "and") {
      const next = numberAt(i + 1);
      // "one hundred and fifty" stays one number; "three and three" is two
      if (active && next != null && next < 100 && result + current >= 100) continue;
      if (active) flush();
      else close();
      continue;
    }
    if (CONNECTOR.has(t)) {
      if (active) flush();
      else close();
      continue;
    }
    if ((t === "a" || t === "an") && SCALE[flat[i + 1]]) {
      if (!active) close();
      current = 1;
      active = true;
      add(1);
      continue;
    }
    const small = SMALL[t];
    if (small != null) {
      add(small);
      const whole = result + current;
      // "ten thirty" is 10 then 30, not 40; "twenty one" is 21; "hundred and fifty" stays 150
      if (active && whole > 0 && whole < 20 && small >= 20) flush();
      else if (active && current >= 20 && current < 100 && small >= 20) flush();
      current += small;
      active = true;
      continue;
    }
    const scale = SCALE[t];
    if (scale) {
      add(scale);
      if (scale === 100) current = (current || 1) * 100;
      else {
        result += (current || 1) * scale;
        current = 0;
      }
      active = true;
      continue;
    }
    close();
  }
  close();
  return { values, seqs };
}

const hasSeq = (spoken: Spoken, nums: string[]) =>
  spoken.seqs.some((seq) => seq.some((_, i) => nums.every((n, j) => seq[i + j] === n)));

const allowed = (token: string, spoken: Spoken) => {
  const nums = numsOf(token);
  if (!nums.length) return true;
  if (nums.length === 1) return spoken.values.has(nums[0]);
  return hasSeq(spoken, nums);
};

// ratios and clocks are one token even with spaces ("3 / 3", "9:41")
const RATIO = /\d[\d,.]*(\s*\/\s*\d[\d,.]*)+/g;
const CLOCK = /\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?/g;

const sweep = (text: string) =>
  text.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/(^|\s)[-–—/|]+(?=\s|$)/g, " ").replace(/\s+/g, " ").replace(/^[\s\-–—/|,.;:]+|[\s\-–—/|,.;:]+$/g, "").trim();

// The text with every unsaid number-token taken out. Null when nothing is left.
export function neutralize(text: string | null | undefined, spoken: Spoken): string | null {
  if (text == null) return null;
  if (!/\d/.test(text)) return text;
  let s = text.replace(RATIO, (m) => (allowed(m, spoken) ? m : " ")).replace(CLOCK, (m) => (allowed(m, spoken) ? m : " "));
  s = s.split(/(\s+)/).map((part) => (!part.trim() || !/\d/.test(part) || allowed(part, spoken) ? part : "")).join("");
  const out = sweep(s);
  return out && !UNIT.test(out) ? out : null;
}

const rowOf = (r: RowT, spoken: Spoken): RowT | null => {
  const title = neutralize(r.title, spoken);
  const meta = r.meta ? neutralize(r.meta, spoken) : null;
  const tag = r.tag ? neutralize(r.tag, spoken) : null;
  if (title) return { ...r, title, meta, tag };
  const promoted = meta || tag;
  return promoted ? { ...r, title: promoted, meta: null, tag: null } : null;
};

const blank = (rows: RowT[], title: string | null, icon: string | null): RowT[] =>
  rows.length ? rows : [{ title: title || "Details", meta: null, tag: null, icon }];

// a counter or a chart that lost its number becomes a list, so the frame keeps a card
const asList = (it: PlacedItem, rows: RowT[], title: string | null): PlacedItem => {
  const safe = blank(rows, title, it.icon ?? null);
  if (it.kind === "device") return { ...it, screen: "list", title, rows: safe, value: null, cols: null };
  return { ...it, kind: "card", variant: "list", title, rows: safe, value: null, cols: null, screen: null };
};

function honestText(tb: TextBlock | null, spoken: Spoken): TextBlock | null {
  if (!tb) return null;
  const kept = tb.words.map((w) => ({ ...w, t: neutralize(w.t, spoken) })).map((w, i) => (w.t ? { w, i } : null)).filter((x): x is { w: TextBlock["words"][number]; i: number } => !!x);
  if (kept.length === tb.words.length && kept.every(({ w }, i) => w.t === tb.words[i].t)) return tb;
  if (!kept.length) return null;
  const at = new Map(kept.map(({ i }, n) => [i, n]));
  const lines = tb.lines.map((line) => line.flatMap((i) => (at.has(i) ? [at.get(i)!] : []))).filter((line) => line.length);
  return { ...tb, words: kept.map(({ w }) => w), lines: lines.length ? lines : [kept.map((_, i) => i)], kicker: neutralize(tb.kicker, spoken) };
}

function honestItem(it: PlacedItem, spoken: Spoken): PlacedItem {
  // a screenshot's value is which image, not words on screen
  const title = neutralize(it.title, spoken);
  const sub = neutralize(it.sub, spoken);
  const value = neutralize(it.value, spoken);
  if (it.kind === "screenshot") return { ...it, title, sub };
  const rows = (it.rows ?? []).map((r) => rowOf(r, spoken)).filter((r): r is RowT => !!r);
  const face = (it.kind === "device" ? it.screen : it.variant) ?? "";
  if (it.kind === "stat") {
    if (value && /\d/.test(value)) return { ...it, title, sub, value };
    return asList(it, title ? [{ title, meta: null, tag: null, icon: it.icon ?? null }] : [], null);
  }
  if (it.kind === "chart") {
    const spokenValue = value && /\d/.test(value) ? value : null;
    const prints = it.variant === "progress" || it.variant === "ring" || it.variant === "donut";
    if (prints && !spokenValue) return rows.length ? asList(it, rows, title) : { ...it, variant: "area", title, sub, value: null, rows: null };
    return { ...it, title, sub, value: spokenValue, rows: rows.length ? rows : null };
  }
  if (it.kind !== "card" && it.kind !== "device") return { ...it, title, sub, value, rows: it.rows ? rows : it.rows };
  if (face === "kpi") {
    const numbered = rows.filter((r) => r.meta && /\d/.test(r.meta));
    if (numbered.length && numbered.length === rows.length) return { ...it, title, sub, value, rows: numbered };
    const list = rows.map((r) => ({ ...r, meta: null, tag: r.tag && !/\d/.test(r.tag) ? r.tag : null })).filter((r) => r.title);
    return asList(it, list, title);
  }
  if ((face === "invoice" || face === "pay") && !(value && /\d/.test(value))) {
    // "" blocks the renderer's own "$2,400" / "#1042" (null would show them)
    const head = title || (face === "pay" ? "Payment" : "Invoice");
    return { ...it, title: head, sub, value: "", rows: blank(rows, head, null), cols: null, ...(it.kind === "device" ? { screen: "list" as const } : { variant: "list" as const }) };
  }
  if (face === "table" && rows.every((r) => !r.meta)) return asList(it, rows, title);
  const safe = blank(rows, title, it.icon ?? null);
  // the head already says this name: the single stand-in row would repeat it
  const titled = title && safe.length === 1 && safe[0].title === title ? null : title;
  return { ...it, title: titled, sub, value, rows: safe, ...(face === "table" ? {} : { cols: it.cols }) };
}

const named = (text: string | null | undefined, spoken: Spoken, fallback: string) => {
  const n = neutralize(text, spoken);
  return n && /\p{L}/u.test(n) ? n : fallback;
};

export function honest(plan: ComposerPlan): ComposerPlan {
  const spoken = spokenOf(plan.words);
  return {
    ...plan,
    brand: { ...plan.brand, name: named(plan.brand.name, spoken, "Brand"), cta: named(plan.brand.cta, spoken, "Get started"), url: neutralize(plan.brand.url, spoken) ?? "", tagline: neutralize(plan.brand.tagline, spoken) ?? "" },
    scenes: plan.scenes.map((sc) => ({ ...sc, text: honestText(sc.text, spoken), items: sc.items.map((it) => honestItem(it, spoken)) })),
  };
}

// The checklist's "3/3" and a step's "01" are drawn by the renderer, not stored
// on the plan. v2 draws neither; the old version keeps both.
export const countLabel = (done: number, total: number, v2?: boolean): string | null => (v2 ? null : `${done}/${total}`);
export const stepLabel = (index: number, v2?: boolean): string | null => (v2 ? null : String(index + 1).padStart(2, "0"));
