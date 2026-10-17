import type { ItemT, RowT, ScriptT, Word } from "./types";

// "New version": the UI piece library — the product's UI as the reference
// films show it, in the brand's colour and in the script's own words: a
// dashboard card, a growing chart, a list, a search bar being typed, a stack
// of notifications, a phone, a number counting up. The Director picks them
// (as cards, charts, devices and stats); here each is filled from what the
// voice says in its scene — never placeholder rows, never a number the voice
// does not say (a dashboard or a counter without one becomes a list or a
// growing chart). No React here: the server builds videos with it.

export const PIECES = ["dashboard", "chart", "list", "search", "notifications", "phone", "counter"] as const;
export type Piece = (typeof PIECES)[number];

// what each piece is, as the Director writes it
export const PIECE_NOTES: Record<Piece, string> = {
  dashboard: "a dashboard card (card kpi: 2–4 rows, each a title and its number — only numbers the voice says)",
  chart: "a growing chart (chart line or area: values draw in; no numbers on it)",
  list: "a list (card list or checklist: 2–4 rows in the script's words; its hit ticks the last row)",
  search: "a search bar being typed (card search: value = what is typed, from the voice; rows = what it finds)",
  notifications: "a stack of notifications (card notify: 2–3 rows sliding in, one by one)",
  phone: "a phone (device phone; screen = list, notify, chat, calendar or pay; its rows in the script's words)",
  counter: "a number counting up (stat: value = a number the voice says, title = what it counts)",
};
export const piecesText = () => `UI PIECES (the product's UI, drawn in the brand's colour, in THIS script's own words — never placeholder rows): ${PIECES.map((p) => PIECE_NOTES[p]).join("; ")}.`;

export function pieceOf(it: Pick<ItemT, "kind" | "variant">): Piece | null {
  if (it.kind === "stat") return "counter";
  if (it.kind === "chart") return "chart";
  if (it.kind === "device") return it.variant === "phone" || !it.variant ? "phone" : null;
  if (it.kind !== "card") return null;
  switch (it.variant ?? "list") {
    case "kpi": return "dashboard";
    case "search": return "search";
    case "notify": return "notifications";
    case "list":
    case "checklist": return "list";
    default: return null;
  }
}

const STOP = new Set("the and for with that this your you our are was were will from have has had not but can into onto than then them they their there what when where which while who why how all any each more most much many some such very just also only even ever every make makes made get gets got give gives help helps start stop try today".split(" "));
// (the things a UI row names are nouns: common verbs and describing words are left out)
const NOT_A_THING = new Set("lands land stay stays arrive arrives run runs watch watches grow grows keep keeps take takes work works goes come comes need needs want wants know knows see sees use uses create creates creating track tracks search searches send sends find finds look looks looking feel feels move moves build builds turn turns show shows tell tells bring brings sign signs book books pay pays save saves set sets add adds manage manages instantly easily quickly simply always never again faster better easier tidy clear simple easy fast quick great best real smart new one".split(" "));
const PLACEHOLDER = /\b(jane doe|john doe|lorem|ipsum|product x|acme|foo|bar baz|#12345|user ?\d+|customer name|result (one|two)|new request|weekly report|team update)\b/i;
const clean = (t: string) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
const title = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const NUMBER = /\d/;

// the scene's own content words (said in it), title-cased, once each
function spokenOf(words: Word[], from: number, to: number): string[] {
  const out: string[] = [];
  for (const w of words.slice(Math.max(0, from), Math.max(from, to + 1))) {
    const t = clean(w.text);
    const low = t.toLowerCase();
    const stem = (x: string) => x.toLowerCase().replace(/(es|s)$/, "");
    if (t.length >= 4 && !STOP.has(low) && !NOT_A_THING.has(low) && !/ly$/.test(low) && !NUMBER.test(t) && !out.some((x) => stem(x) === stem(t))) out.push(title(t));
  }
  return out;
}
// the numbers the voice says (3x, 50%, 10, 2,400…) in this stretch
const numbersOf = (words: Word[], from: number, to: number) => words.slice(Math.max(0, from), Math.max(from, to + 1)).map((w) => clean(w.text)).filter((t) => NUMBER.test(t));

const rowsFrom = (spoken: string[], n: number, icon?: string | null): RowT[] => spoken.slice(0, n).map((t) => ({ title: t, meta: null, tag: null, icon: icon ?? null }));

// Every piece filled from its scene's words (the Director's own rows kept where they are real).
export function withPieces(script: ScriptT, words: Word[]): ScriptT {
  const all = numbersOf(words, 0, words.length - 1);
  const said = (v: string | null | undefined) => !!v && all.some((n) => n.replace(/[,%x×+]/gi, "") === v.replace(/[^\d.]/g, "") || n === v);
  const scenes = script.scenes.map((s, i) => {
    const end = (script.scenes[i + 1]?.at ?? words.length) - 1;
    // (a scene with no word to use: its on-screen words)
    const own = spokenOf(words, s.at, end);
    const spoken = own.length ? own : s.text ? [words.slice(s.text.from, s.text.to + 1).map((w) => clean(w.text)).join(" ")] : [];
    const nums = numbersOf(words, s.at, end);
    const items = s.items.map((it): ItemT => {
      const piece = pieceOf(it);
      if (!piece) return it;
      const fake = !it.rows?.length || PLACEHOLDER.test(JSON.stringify(it.rows));
      // (a row never repeats the piece's own title)
      const head = (it.title ?? "").toLowerCase().replace(/(es|s)$/, "");
      const own = spoken.filter((t) => t.toLowerCase().replace(/(es|s)$/, "") !== head);
      const rows = fake ? rowsFrom(own.length ? own : spoken, piece === "notifications" ? 3 : 4, piece === "notifications" ? it.icon ?? "bell" : null) : it.rows;
      if (piece === "counter") {
        // (a number the voice says, else the thing grows as a chart)
        const v = it.value && said(it.value) ? it.value : nums[0] ?? null;
        return v ? { ...it, value: v, title: it.title ?? spoken[0] ?? null } : { ...it, kind: "chart", variant: "area", value: null, title: it.title ?? spoken[0] ?? null };
      }
      if (piece === "dashboard") {
        // its numbers only where the voice says them; none said: a list of what it tracks
        const real = (rows ?? []).filter((r) => r.meta && said(r.meta));
        if (!real.length) return { ...it, variant: "list", rows: (rows ?? []).map((r) => ({ ...r, meta: null, tag: null })).slice(0, 4) };
        return { ...it, rows: real.slice(0, 4).map((r) => ({ ...r, tag: r.tag && said(r.tag) ? r.tag : null })) };
      }
      if (piece === "chart") return { ...it, variant: it.variant === "line" || it.variant === "area" || it.variant === "spark" ? it.variant : "area", value: it.value && said(it.value) ? it.value : null, rows: null };
      if (piece === "search") {
        // what is typed: the Director's, else the scene's words — whole words, up to 24 letters
        const said = s.text ? words.slice(s.text.from, s.text.to + 1).map((w) => clean(w.text)) : spoken;
        const q = said.reduce((a, w) => (!a ? w : `${a} ${w}`.length <= 24 ? `${a} ${w}` : a), "");
        return { ...it, value: it.value && !PLACEHOLDER.test(it.value) ? it.value.slice(0, 24) : q || null, rows };
      }
      if (piece === "phone") return { ...it, variant: "phone", screen: it.screen ?? "list", rows };
      return { ...it, rows };
    });
    return { ...s, items };
  });
  return { ...script, scenes };
}
