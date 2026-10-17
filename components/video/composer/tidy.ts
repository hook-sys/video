import { TEXT_FACES, emWidth, faceOf } from "./art";
import { CARD_W } from "./sizes";
import type { ComposerPlan, PlacedItem, PlacedScene, RowT, TableCols } from "./types";

// "New version": what is on screen, tidied — no eyebrow label over the words,
// never the same words twice on one screen, and a table only when its cells
// are short (2–3 words each, on one line, under column names that say what
// they hold); else the rows are shown as a list. No React here: the server
// builds videos with it.

// (the same words: case, marks and a plural aside)
const norm = (t: string | null | undefined) =>
  (t ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean).map((w) => w.replace(/(es|s)$/, "")).join(" ");
// one repeats the other: the same words, or one of two or more words inside the other
function same(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.includes(" ") && ` ${l} `.includes(` ${s} `);
}
const wordsOf = (t: string | null | undefined) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;

// what a thing shows as its name (a card or a logo without one shows the brand's)
const shownTitle = (it: PlacedItem, brand: string): string | null =>
  it.kind === "card" || it.kind === "logo" ? it.title ?? brand : it.kind === "button" || it.kind === "cursor" || it.kind === "shape" ? null : it.title ?? null;

function withoutRepeats(sc: PlacedScene, brand: string, cta: string): PlacedScene {
  let text = sc.text ? { ...sc.text, kicker: null } : null;
  const head = text ? norm(text.words.map((w) => w.t).join(" ")) : "";
  // a logo or the call to action says it already: the words give way (the brand's mark, its button stay)
  const fixed = sc.items.flatMap((it) => (it.kind === "logo" ? [norm(it.title ?? brand)] : it.kind === "button" ? [norm(it.title ?? cta)] : []));
  if (text && fixed.some((t) => same(t, head))) text = null;
  const seen: string[] = text ? [head] : [];
  seen.push(...fixed);
  const items = sc.items.map((it) => {
    let out = it;
    const t = it.kind === "logo" || it.kind === "button" ? null : shownTitle(it, brand);
    if (t && seen.some((s) => same(s, norm(t)))) out = { ...out, title: "" };
    else if (t) seen.push(norm(t));
    if (out.rows?.length) {
      // (a row never repeats the words, the thing's name or a row before it)
      const kept: RowT[] = [];
      for (const r of out.rows) {
        const n = norm(r.title);
        if (n && (seen.some((s) => same(s, n)) || kept.some((k) => same(norm(k.title), n)))) continue;
        kept.push(r);
      }
      if (kept.length && kept.length !== out.rows.length) out = { ...out, rows: kept };
    }
    return out;
  });
  return { ...sc, text, items };
}

// ── tables: the cells each 2–3 words on one line, the columns named for what they hold
const MONEY = /^[-+]?[$€£¥₹৳]\s?\d|^\d[\d,.]*\s?(usd|eur|gbp|bdt|tk|k|m)?$/i;
const PERCENT = /^[-+]?\d[\d.,]*\s?%$/;
const TIME = /^(\d{1,2}:\d{2}\s?(am|pm)?|\d+\s?(s|m|h|min|mins|hr|hrs|sec)( ago)?|now|just now|\d+\s?(minutes?|hours?) ago)$/i;
const DATE = /\b(today|tomorrow|yesterday|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|in \d+ days?|\d+ days?|week|\d{1,2}\/\d{1,2})\b/i;
const COUNT = /^\d[\d,]*(\s?\w{0,8})?$/;
function headOf(metas: string[]): string {
  const all = (re: RegExp) => metas.length > 0 && metas.every((m) => re.test(m.trim()));
  if (all(PERCENT)) return "RATE";
  if (all(MONEY)) return /[$€£¥₹৳]/.test(metas.join("")) ? "AMOUNT" : "TOTAL";
  if (all(TIME)) return "TIME";
  if (all(DATE)) return "DATE";
  if (all(COUNT)) return "COUNT";
  return "DETAIL";
}
// the name column: the word every row starts with ("Order #4092…" → ORDER), else NAME
function nameOf(titles: string[]): string {
  const first = titles.map((t) => t.trim().split(/\s+/)[0]?.toLowerCase() ?? "");
  const w = first[0];
  return w && /^\p{L}{3,}$/u.test(w) && first.every((x) => x === w) && titles.length > 1 ? w.replace(/s$/, "").toUpperCase() : "NAME";
}

const ROW_FONT = 23, TAG_FONT = 19, PAD = 30, GAP = 20;
function tableOf(it: PlacedItem, text: string): PlacedItem {
  const rows = it.rows ?? [];
  if (!rows.length) return it;
  const f = faceOf(text, TEXT_FACES);
  const px = (t: string, size: number, weight: number, upper = false) => Math.ceil(emWidth(t, f, weight, upper) * size);
  const short = rows.every((r) => wordsOf(r.title) <= 3 && wordsOf(r.meta) <= 3 && wordsOf(r.tag) <= 2);
  const metas = rows.map((r) => r.meta ?? "").filter(Boolean);
  const tags = rows.map((r) => r.tag ?? "").filter(Boolean);
  const head: [string, string, string] = [nameOf(rows.map((r) => r.title)), metas.length ? headOf(metas) : "", tags.length ? "STATUS" : ""];
  const headPx = (h: string) => (h ? px(h, 17, 700, true) * 1.05 : 0);
  const meta = metas.length ? Math.max(headPx(head[1]), ...metas.map((m) => px(m, ROW_FONT, 650))) + GAP : 0;
  const tag = tags.length ? Math.max(headPx(head[2]), ...tags.map((t) => px(t, TAG_FONT, 650) + 28)) + GAP : 0;
  // (a tenth kept spare: the estimate is rough)
  const room = (CARD_W - PAD * 2 - meta - tag) * 0.9;
  const fits = Math.max(headPx(head[0]), ...rows.map((r) => px(r.title, ROW_FONT, 600))) <= room;
  if (short && fits) return { ...it, cols: { head, meta, tag } satisfies TableCols };
  // (too long for a table: a list)
  return listOf({ ...it, variant: "list", cols: null, rows: rows.map((r) => ({ ...r, meta: wordsOf(r.meta) <= 3 ? r.meta : null, tag: wordsOf(r.tag) <= 2 ? r.tag : null })) }, text);
}

// A list's row on one line: its name whole — a detail beside it only where it
// leaves the name room, then its status the same way.
// (a tenth kept spare: the estimate is rough)
const LIST_ROOM = (CARD_W - PAD * 2 - 42 - 16) * 0.9;
function listOf(it: PlacedItem, text: string): PlacedItem {
  if (!it.rows?.length) return it;
  const f = faceOf(text, TEXT_FACES);
  const name = (t: string) => Math.ceil(emWidth(t, f, 600) * 24);
  const beside = (r: RowT) => (r.meta ? Math.ceil(emWidth(r.meta, f, 500) * 20) + 16 : 0) + (r.tag ? Math.ceil(emWidth(r.tag, f, 650) * 19) + 28 + 16 : 0);
  const rows = it.rows.map((r) => {
    let out = r;
    if (name(out.title) + beside(out) > LIST_ROOM && out.meta) out = { ...out, meta: null };
    if (name(out.title) + beside(out) > LIST_ROOM && out.tag) out = { ...out, tag: null };
    return out;
  });
  return rows.some((r, i) => r !== it.rows![i]) ? { ...it, rows } : it;
}

export function tidied(plan: ComposerPlan): ComposerPlan {
  const scenes = plan.scenes.map((sc0) => {
    const sc = withoutRepeats(sc0, plan.brand.name, plan.brand.cta);
    const items = sc.items.map((it) => (it.kind !== "card" ? it : it.variant === "table" ? tableOf(it, plan.art.text) : (it.variant ?? "list") === "list" ? listOf(it, plan.art.text) : it));
    return { ...sc, items };
  });
  return { ...plan, scenes };
}
