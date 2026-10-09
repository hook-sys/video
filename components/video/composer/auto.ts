import { searchIcons } from "@/lib/icons";
import { DISPLAY_FACES, TEXT_FACES, hueOf, rng, type Rng } from "./art";
import type { ArtT, ArrangeKind, CameraKind, ItemT, LayoutKind, Reveal, RowT, SceneT, ScriptT, TransitionKind, Word } from "./types";
import { CAMERAS, FIELDS, ICON_STYLES, KEYS, MOTIONS, OVERLAYS, SURFACES } from "./types";

// The Composer's own director: reads the narration (questions, lists, steps,
// numbers, "no more…", the product's name, the ask at the end) and composes
// every scene from the parts — chosen at random within what fits the words,
// so no two videos are built the same way. Used when no model is set or its
// script fails, and as the measure the model's scripts are checked against.

const clean = (t: string) => t.replace(/[^\p{L}\p{N}%$€£৳'+.-]/gu, "").replace(/[.]+$/, "");
const low = (t: string) => clean(t).toLowerCase();
const STOP = new Set("the a an and or but to of in on at for with your you our we it is are be this that then just so as by from into every all any one their them they who what when how here there has have had its can will get gets".split(" "));

// ── reading the narration ─────────────────────────────────────────────────
export type Clause = { from: number; to: number; text: string; end: "." | "?" | "!" | "," | "" };
// (the Bengali দাঁড়ি "।" ends a sentence as a full stop does)
const endOf = (t: string): Clause["end"] => (/[?]["”’)]*$/.test(t) ? "?" : /[!]["”’)]*$/.test(t) ? "!" : /[।॥]["”’)]*$/.test(t) || (/[.]$/.test(t) && !/\d\.$/.test(t)) ? "." : /[,;:—–]$/.test(t) ? "," : "");
// Sentences; a long one (not a list) is cut at its commas or pauses.
export function clauses(words: Word[]): Clause[] {
  const sentences: Clause[] = [];
  let from = 0;
  words.forEach((w, i) => {
    const e = endOf(w.text.trim());
    if ((e && e !== ",") || i === words.length - 1) {
      sentences.push({ from, to: i, text: words.slice(from, i + 1).map((x) => x.text).join(" "), end: e === "," ? "" : e });
      from = i + 1;
    }
  });
  const out: Clause[] = [];
  for (const st of sentences) {
    const secs = words[st.to].end - words[st.from].start;
    if (listParts(st, words).length >= 3 || (secs <= 3.4 && st.to - st.from < 13)) {
      out.push(st);
      continue;
    }
    let a = st.from;
    for (let i = st.from; i <= st.to; i++) {
      const t = words[i].text.trim();
      const gap = (words[i + 1]?.start ?? words[i].end) - words[i].end;
      const len = i - a + 1;
      const rest = st.to - i;
      if (i === st.to || (rest >= 3 && len >= 4 && (endOf(t) === "," || (len >= 9 && gap > 0.18) || len >= 13))) {
        out.push({ from: a, to: i, text: words.slice(a, i + 1).map((x) => x.text).join(" "), end: i === st.to ? st.end : endOf(t) });
        a = i + 1;
      }
    }
  }
  return out;
}

type Kind = "question" | "brand" | "list" | "step" | "number" | "negation" | "cta" | "feature" | "statement";
type Concept = { card: string; icon: string; label: string; badge: string[]; rows: (r: Rng, brand: string) => RowT[]; value?: (r: Rng) => string };
const row = (title: string, meta?: string | null, tag?: string | null, icon?: string | null): RowT => ({ title, meta: meta ?? null, tag: tag ?? null, icon: icon ?? null });
const CLIENTS = ["Acme Studio", "Northwind", "Blue Harbor", "Pine & Co", "Lumen Labs", "Oakline", "Riverside", "Kite Media"];
const NAMES = ["Maya R.", "Sam K.", "Lena O.", "Ravi P.", "Noor A.", "Jonah T.", "Ines M.", "Theo B."];
const money = (r: Rng) => `$${(r.int(4, 48) * 50).toLocaleString("en-US")}`;
const CONCEPTS: [RegExp, Concept][] = [
  [/invoice|bill(s|ing)?\b/, { card: "invoice", icon: "receipt", label: "Invoices", badge: ["Sent", "Auto-sent", "On time"], rows: (r) => [row("Design sprint", money(r)), row("Monthly support", money(r)), row("Hosting", money(r))], value: money }],
  [/pay(ment|ments|s|ing)?\b|paid|money|collect|cash|checkout|charge/, { card: "pay", icon: "credit-card", label: "Payments", badge: ["Paid", "Collected", "+ $2,400"], rows: () => [row("Paid", null, "Paid")], value: money }],
  [/remind|reminder|notif|alert|nudge|follow.?up/, { card: "notify", icon: "bell-ring", label: "Reminders", badge: ["Reminder sent", "Automatic", "On time"], rows: (r) => [row(`Reminder sent to ${r.pick(CLIENTS)}`, "just now", "Sent", "send"), row("Payment due in 3 days", "today", "Due", "clock"), row(`${r.pick(CLIENTS)} opened it`, "2m ago", "Seen", "eye")] }],
  [/book|booking|appointment|slot|schedule|calendar|diary|visit/, { card: "calendar", icon: "calendar-check", label: "Bookings", badge: ["Booked", "Slot filled", "Confirmed"], rows: () => [row("Check-up", "9:00"), row("Follow-up", "11:30"), row("New visit", "14:00"), row("Review", "16:00")], value: () => "This week" }],
  [/meeting|call|zoom|meet\b|teams/, { card: "timeline", icon: "video", label: "Meetings", badge: ["Recording", "Joined", "Live"], rows: () => [row("Call started", "10:00"), row("Notes taken", "10:24"), row("Summary sent", "10:31")] }],
  [/summary|summar|notes?\b|write|writes|written|document|docs?\b|minutes/, { card: "doc", icon: "file-text", label: "Summary", badge: ["Summary ready", "Written for you", "Done"], rows: () => [row("Decisions"), row("Action items"), row("Next steps")], value: () => "Ready" }],
  [/task|action item|todo|to-do|owner|due date|assign/, { card: "checklist", icon: "list-checks", label: "Tasks", badge: ["Assigned", "Owner set", "Due Friday"], rows: (r) => [row("Send the proposal", r.pick(NAMES)), row("Book the review", r.pick(NAMES)), row("Share the deck", r.pick(NAMES))] }],
  [/slack|inbox|email|message|chat|reply|team sees|share/, { card: "chat", icon: "messages-square", label: "Messages", badge: ["Shared", "Delivered", "Seen"], rows: (r) => [row("Did the summary go out?", null, null), row("Yes — it's in Slack and your inbox.", null, "me"), row("Perfect, thanks!", r.pick(NAMES).slice(0, 1))] }],
  [/search|find|look up|last month/, { card: "search", icon: "search", label: "Search", badge: ["Found", "In seconds", "1 result"], rows: () => [row("Weekly sync", "Last month", null, "file-text"), row("Pricing review", "3 weeks ago", null, "file-text"), row("Launch plan", "2 weeks ago", null, "file-text")] }],
  [/dashboard|report|revenue|sales|growth|analytics|numbers|metrics|one view|at a glance/, { card: "kpi", icon: "layout-dashboard", label: "Dashboard", badge: ["Live", "Updated", "+18%"], rows: (r) => [row("Revenue", money(r), `+${r.int(8, 32)}%`), row("Orders", `${r.int(120, 980)}`, `+${r.int(5, 20)}%`), row("Customers", `${r.int(40, 400)}`, `+${r.int(3, 18)}%`), row("Avg. order", money(r), `+${r.int(2, 9)}%`)] }],
  [/stock|order|inventory|store|shop/, { card: "table", icon: "package", label: "Orders", badge: ["Synced", "Updated", "In stock"], rows: (r) => [row("Order #1042", money(r), "Paid"), row("Order #1043", money(r), "Packed"), row("Order #1044", money(r), "New")] }],
  [/patient|client|customer|file|record|profile/, { card: "profile", icon: "id-card", label: "Records", badge: ["Up to date", "Saved", "Synced"], rows: () => [row("Next visit", "Tue 9:00"), row("Plan", "Monthly"), row("Status", "Active", "Active")] }],
  [/setting|automatic|auto|on its own|itself|sync|connect|integrat/, { card: "toggles", icon: "settings-2", label: "Automation", badge: ["Automatic", "On", "Hands-free"], rows: () => [row("Auto reminders", null, null, "bell"), row("Sync calendar", null, null, "refresh-cw"), row("Smart follow-ups", null, null, "sparkles")] }],
  [/team|everyone|together|who is next|whole team/, { card: "list", icon: "share-2", label: "Team", badge: ["Everyone sees it", "Live", "Shared"], rows: (r) => [row(r.pick(NAMES), "Next up", "Now", "id-card"), row(r.pick(NAMES), "10:30", "Soon", "id-card"), row(r.pick(NAMES), "11:00", null, "id-card")] }],
];
const conceptOf = (text: string) => CONCEPTS.find(([re]) => re.test(text.toLowerCase()))?.[1] ?? null;
const iconFor = (text: string, fallback = "sparkles") => {
  const ws = text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w));
  for (const w of [...ws].sort((a, b) => b.length - a.length)) {
    const hit = searchIcons(w, 1)[0];
    if (hit) return hit;
  }
  return fallback;
};
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// "Bookings in one diary" → "Bookings"; "Reminders on sticky notes" → "Reminders"
const PREP = new Set(["in", "on", "at", "with", "for", "to", "from", "by", "into", "across", "via"]);
const headOf = (text: string) => {
  const ws = text.replace(/[.,!?]+$/, "").split(/\s+/);
  const cut = ws.findIndex((w, i) => i > 0 && PREP.has(w.toLowerCase()));
  const head = (cut > 0 ? ws.slice(0, cut) : ws).filter((w, i) => i > 0 || !STOP.has(w.toLowerCase())).join(" ");
  return titleCase(head || text).slice(0, 26);
};
// "sends the invoice, reminds your client, and collects the money" → three things
function listParts(c: Clause, words: Word[]): { text: string; at: number }[] {
  const parts = rawParts(c, words);
  if (parts.length >= 3) {
    const len = (p: { text: string }) => p.text.split(/\s+/).length;
    const most = Math.max(...parts.slice(1).map(len));
    if (len(parts[0]) > most * 2 + 1) {
      const ws = parts[0].text.split(/\s+/);
      parts[0] = { text: ws.slice(-Math.max(1, most)).join(" "), at: parts[0].at + ws.length - Math.max(1, most) };
    }
  }
  return parts;
}
function rawParts(c: Clause, words: Word[]): { text: string; at: number }[] {
  const parts: { text: string; at: number }[] = [];
  let cur: string[] = [];
  let at = c.from;
  for (let i = c.from; i <= c.to; i++) {
    const t = words[i].text;
    const bare = low(t);
    if (!cur.length) at = i;
    if (bare === "and" || bare === "or" || bare === "then") {
      if (cur.length) {
        parts.push({ text: cur.join(" "), at });
        cur = [];
      }
      continue;
    }
    cur.push(clean(t));
    if (/[,;]$/.test(t)) {
      parts.push({ text: cur.join(" "), at });
      cur = [];
    }
  }
  if (cur.length) parts.push({ text: cur.join(" "), at });
  return parts.filter((p) => p.text.length > 1);
}

function kindOf(c: Clause, i: number, all: Clause[], brand: string, words: Word[]): Kind {
  const t = c.text.toLowerCase();
  const b = brand.toLowerCase();
  if (i === all.length - 1 && /\b(try|start|book|join|sign up|download|grab|visit|free|demo)\b/.test(t)) return "cta";
  if (c.end === "?") return "question";
  if (/\b(no more|never|without|stop|don't|no longer|instead of)\b/.test(t)) return "negation";
  if (/^(first|second|third|finally|step)\b/.test(t.trim()) && i > 0) return "step";
  if (/\d|percent|%|\btwice\b|\bhalf\b|\b(one|two|three|four|five|ten)\s+(days?|hours?|minutes?|seconds?|weeks?|clicks?)\b|\b(in|within)\s+(a\s+)?(days?|minutes?|seconds?|minute|hours?)\b/.test(t)) return "number";
  if (listParts(c, words).length >= 3) return "list";
  if (b && t.includes(b)) return "brand";
  if (conceptOf(t)) return "feature";
  return "statement";
}

// ── the art direction ─────────────────────────────────────────────────────
// Every value drawn from the whole range that reads well — not a list of looks.
const CONDENSED = new Set(["oswald", "big-shoulders-display", "bebas-neue", "anton"]);
const WIDE = new Set(["unbounded", "krona-one", "dela-gothic-one", "archivo-black", "syne"]);
const SERIF = new Set(["fraunces", "playfair-display", "instrument-serif", "dm-serif-display", "young-serif", "newsreader"]);
export type Lens = "product" | "type" | "diagram" | "object";
export const LENSES: Lens[] = ["product", "type", "diagram", "object"];

export function drawArt(R: Rng, brandColor: string, avoid: Partial<Record<keyof ArtT, unknown[]>> = {}): ArtT {
  const fresh = <T,>(key: keyof ArtT, xs: readonly T[]): T => {
    const bad = new Set(avoid[key] ?? []);
    const ok = xs.filter((x) => !bad.has(x));
    return R.pick(ok.length ? ok : xs);
  };
  const display = fresh("display", DISPLAY_FACES.map((f) => f.slug));
  const face = DISPLAY_FACES.find((f) => f.slug === display)!;
  const condensed = CONDENSED.has(display), wide = WIDE.has(display), serif = SERIF.has(display);
  const brandHue = hueOf(brandColor);
  // the brand's hue, or one far from every hue already used by this set
  const usedHues = (avoid.hue ?? []).filter((x): x is number => typeof x === "number");
  const far = (h: number) => usedHues.every((u) => Math.min(Math.abs(u - h), 360 - Math.abs(u - h)) >= 40);
  const options = [0, 25, 45, 160, 180, 200, 300, 320, -30, -50, 90, 130].map((d) => (brandHue + d + 360) % 360).filter(far);
  const hue = !usedHues.length && R.chance(0.6) ? brandHue : options.length ? R.pick(options) : (brandHue + R.int(0, 359)) % 360;
  const scheme = fresh("scheme", ["dark", "light", "mixed", "dark", "light"] as const);
  return {
    name: "",
    hue: Math.round((hue + 360) % 360),
    harmony: R.pick(["mono", "analogous", "complement", "split", "triad", "analogous"] as const),
    scheme,
    field: fresh("field", FIELDS.filter((x) => x !== "plain")),
    overlay: R.pick(OVERLAYS),
    surface: fresh("surface", SURFACES),
    radius: R.pick([0, 6, 12, 18, 24, 28, 32, 40]),
    display,
    text: R.pick(TEXT_FACES).slug,
    weight: face.fixed ?? (serif ? R.pick([500, 600]) : condensed ? R.pick([600, 700]) : wide ? R.pick([600, 700]) : R.pick([600, 700, 750, 800])),
    case: condensed ? "upper" : serif || wide ? "sentence" : R.pick(["sentence", "sentence", "sentence", "upper", "lower"] as const),
    tracking: condensed ? 0.01 : wide ? -0.03 : serif ? -0.02 : R.pick([-0.05, -0.04, -0.03, -0.02]),
    key: fresh("key", serif ? (["italic", "color", "underline"] as const) : KEYS),
    motion: R.pick(MOTIONS),
    pace: Number(R.range(0.85, 1.25).toFixed(2)),
    camera: R.pick(CAMERAS.filter((x) => x !== "still")),
    icons: R.pick(ICON_STYLES),
    energy: Number(R.range(0.25, 0.85).toFixed(2)),
  };
}

// ── composing ─────────────────────────────────────────────────────────────
type Weights<T extends string> = Partial<Record<T, number>>;
function weighted<T extends string>(R: Rng, w: Weights<T>, not: (T | null)[] = []): T {
  const entries = (Object.entries(w) as [T, number][]).filter(([k, v]) => v > 0 && !not.includes(k));
  const list = entries.length ? entries : (Object.entries(w) as [T, number][]);
  const sum = list.reduce((a, [, v]) => a + v, 0);
  let x = R.next() * sum;
  for (const [k, v] of list) if ((x -= v) <= 0) return k;
  return list[list.length - 1][0];
}

export type AutoInput = { words: Word[]; brand: { name: string; color: string; cta: string; url: string }; seed: number; lens?: Lens; avoid?: Partial<Record<keyof ArtT, unknown[]>>; screens?: number; art?: ArtT };

export function autoScript({ words, brand, seed, lens: lensIn, avoid, screens = 0, art: artIn }: AutoInput): ScriptT {
  const R = rng(seed);
  const lens: Lens = lensIn ?? R.pick(LENSES);
  const drawn = drawArt(R, brand.color, avoid);
  const art = artIn ?? drawn;
  // this video's ways in: two or three it keeps coming back to, one it saves
  const family = R.shuffle(["blur", "push-left", "push-up", "zoom-in", "zoom-out", "iris", "wipe", "drop", "whip", "flip", "push-right", "push-down", "clock"] as TransitionKind[]).slice(0, 3);
  const accentT = R.pick(["iris", "zoom-in", "whip", "flip", "wipe", "clock"] as TransitionKind[]);
  const reveals = R.shuffle(["word", "rise", "mask", "scale", "blur", "slide", "type", "line"] as Reveal[]).slice(0, 2);
  const cs = clauses(words);
  // scenes: clauses joined until each has room to be seen
  const groups: Clause[][] = [];
  const short = (c: Clause) => c.end === "." && c.to - c.from <= 5 && !c.text.toLowerCase().includes(brand.name.toLowerCase());
  const lead = (c: Clause) => c.text.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
  for (const c of cs) {
    const last = groups[groups.length - 1];
    const secs = (g: Clause[]) => words[g[g.length - 1].to].end - words[g[0].from].start;
    // "Bookings in one diary. Files in a cabinet. Notes on paper." / "No more X. No more Y."
    const nextShort = cs[cs.indexOf(c) + 1] && short(cs[cs.indexOf(c) + 1]);
    const parallel = last && short(c) && last.every(short) && last.length < 4 && (last.length > 1 || lead(last[0]) === lead(c) || (!!nextShort && c.to - c.from <= 5 && last[0].to - last[0].from <= 5));
    if (last && (parallel || secs(last) < 1.3 || (secs([...last, c]) < 2.6 && last[last.length - 1].end === ","))) last.push(c);
    else groups.push([c]);
  }
  const scenes: SceneT[] = [];
  let prevLayout: LayoutKind | null = null;
  let prevArrange: ArrangeKind | null = null;
  let prevT: TransitionKind | null = null;
  let carry: string | null = null;
  let lastList: RowT[] | null = null;
  groups.forEach((g, gi) => {
    const c: Clause = { from: g[0].from, to: g[g.length - 1].to, text: g.map((x) => x.text).join(" "), end: g[g.length - 1].end };
    const parallel = g.length >= 2 && g.every((x) => (x.end === "." || x.end === "!") && short(x));
    const kindRaw = kindOf(c, gi, groups.map((x) => x[0]), brand.name, words);
    const kind: Kind = parallel && kindRaw !== "negation" && kindRaw !== "cta" ? "list" : kindRaw;
    const t = c.text.toLowerCase();
    const items: ItemT[] = [];
    const base = (k: ItemT["kind"], at = c.from, extra: Partial<ItemT> = {}): ItemT => ({ kind: k, at, hit: null, id: null, enter: null, variant: null, title: null, sub: null, icon: null, value: null, values: null, rows: null, screen: null, size: null, tilt: null, ...extra });
    let layoutW: Weights<LayoutKind> = { center: 2, "split-left": 2, "split-right": 2, top: 2, bottom: 1, corner: 1 };
    let size: "s" | "m" | "l" | "xl" = "l";
    let kicker: string | null = null;
    const concept = conceptOf(t);
    const quiet = lens === "type" ? 0.5 : 0;
    switch (kind) {
      case "question":
      case "statement": {
        size = "xl";
        layoutW = { type: 4 + quiet * 6, center: 1, "split-left": 1, corner: 1 };
        if (concept && R.chance(lens === "object" ? 0.9 : lens === "type" ? 0.25 : 0.5)) {
          const ic = concept.icon;
          items.push(base("icon", c.from, { icon: ic, size: "m" }));
          // the icon beside the words, or the words beside it
          layoutW = { inline: 3, "split-right": 1, center: 1, corner: 1, "split-left": 1 };
        }
        if (kind === "question" && R.chance(0.5) && concept) items.push(base("badge", c.from + 1, { icon: concept.icon, title: concept.label }));
        break;
      }
      case "brand": {
        size = "l";
        const k = R.next();
        if (k < 0.45 || lens === "object") {
          items.push(base("logo", c.from, { sub: null }));
          layoutW = { bottom: 3, top: 2, visual: 1 };
        } else if (k < 0.75) {
          items.push(base("flow", c.from, { variant: R.pick(["hub", "ring", "merge"]), rows: lastList ?? thingsOf(words) }));
          layoutW = { "split-left": 2, "split-right": 2, top: 1 };
        } else {
          items.push(base("device", c.from, { variant: R.pick(["browser", "laptop", "phone"]), screen: (concept?.card as ItemT["screen"]) ?? "kpi", title: concept?.label ?? brand.name, icon: concept?.icon ?? "layout-dashboard", rows: concept?.rows(R, brand.name) ?? null, tilt: R.pick([0, -8, 8]) }));
          layoutW = { "split-left": 2, "split-right": 2, top: 1 };
          carry = R.chance(0.5) ? "hero" : null;
          if (carry) items[items.length - 1].id = carry;
          layoutW = { "split-left": 2, "split-right": 2, top: 1, caption: 1, label: 1 };
        }
        kicker = R.chance(0.4) ? "Meet" : null;
        break;
      }
      case "list": {
        size = "m";
        const parts = (parallel ? g.map((x) => ({ text: x.text.replace(/[.!]+$/, ""), at: x.from })) : listParts(c, words)).slice(0, 4);
        const rows = parts.map((p) => row(titleCase(p.text.replace(/^(and|or|then)\s+/i, "")), null, null, conceptOf(p.text)?.icon ?? iconFor(p.text)));
        lastList = parts.map((p, k) => row(headOf(p.text), null, null, rows[k].icon));
        const named = !!brand.name && t.includes(brand.name.toLowerCase());
        const v = named && R.chance(0.3) ? "fan" : weighted<string>(R, lens === "diagram" ? { flow: 4, steps: 2, chips: 1 } : lens === "product" ? { cards: 3, chips: 2, flow: 1 } : { chips: 3, flow: 2, steps: 1, icons: 2 });
        if (named) kicker = brand.name;
        const short = rows.map((x, k) => ({ ...x, title: x.title.length > 22 ? headOf(parts[k].text) : x.title }));
        if (v === "fan") items.push(base("flow", c.from, { variant: "fan", rows, hit: parts[parts.length - 1].at }));
        else if (v === "flow") items.push(base("flow", c.from, { variant: "chain", rows: short, hit: parts[parts.length - 1].at }));
        else if (v === "steps") items.push(base("steps", c.from, { rows: short, hit: parts[parts.length - 1].at }));
        else if (v === "icons") parts.forEach((p, k) => items.push(base("icon", p.at, { icon: rows[k].icon, title: headOf(p.text).slice(0, 18), size: "s" })));
        else if (v === "cards") parts.slice(0, 3).forEach((p) => {
          const cc = conceptOf(p.text);
          items.push(base("card", p.at, { variant: cc?.card ?? "list", icon: cc?.icon ?? iconFor(p.text), title: cc?.label ?? headOf(p.text), rows: (cc?.rows(R, brand.name) ?? []).slice(0, 2), value: cc?.value?.(R) ?? null, size: "s" }));
        });
        else items.push(base("chips", c.from, { rows, variant: rows.every((x) => x.title.length <= 16) && R.chance(0.5) ? "row" : null, hit: parts[parts.length - 1].at }));
        layoutW = v === "chips" && items[0]?.variant !== "row" ? { "split-left": 3, "split-right": 3 } : v === "icons" || v === "cards" ? { around: 3, top: 2, bottom: 1 } : { top: 3, bottom: 2 };
        break;
      }
      case "step": {
        size = "m";
        const cc = concept;
        kicker = /first/.test(t) ? "Step 1" : /second/.test(t) ? "Step 2" : /third/.test(t) ? "Step 3" : /finally/.test(t) ? "Then" : null;
        if (cc) items.push(base(R.chance(lens === "product" ? 0.6 : 0.3) ? "device" : "card", c.from, { variant: null, screen: cc.card as ItemT["screen"], icon: cc.icon, title: cc.label, rows: cc.rows(R, brand.name), value: cc.value?.(R) ?? null, hit: Math.min(c.to, c.from + 4) }));
        else items.push(base("icon", c.from, { icon: iconFor(c.text), size: "l" }));
        if (items[0].kind === "device") items[0].variant = R.pick(["phone", "browser", "laptop"]);
        else if (items[0].kind === "card") items[0].variant = cc?.card ?? "list";
        layoutW = { "split-left": 3, "split-right": 3, corner: 1, label: 2 };
        break;
      }
      case "number": {
        size = "m";
        const said = spokenNumber(c.text);
        const pct = /(\d+)\s?%|(\d+)\s?percent/i.exec(c.text);
        const v = said.digits ? weighted<string>(R, lens === "diagram" ? { chart: 3, stat: 2 } : { stat: 3, chart: 2 }) : "stat";
        if (pct && R.chance(0.5)) items.push(base("chart", c.from, { variant: "ring", title: headOf(c.text), values: [Number(pct[1] ?? pct[2])], value: `${pct[1] ?? pct[2]}%`, hit: c.to }));
        else if (v === "chart") items.push(base("chart", c.from, { variant: R.pick(["bars", "line", "area", "columns"]), title: headOf(c.text), value: said.value, values: Array.from({ length: R.int(6, 9) }, (_, k) => 3 + k * R.range(0.4, 1.4) + R.range(0, 2)), hit: c.to }));
        else items.push(base("stat", c.from, { value: said.value, title: headOf(c.text), icon: conceptOf(t)?.icon ?? "trending-up", hit: c.to }));
        layoutW = { "split-left": 2, "split-right": 2, top: 1, center: 1, label: 1 };
        break;
      }
      case "negation": {
        size = "l";
        const parts = g.length > 1 ? g.map((x) => x.text) : [c.text];
        const rows = parts.slice(0, 3).map((p) => row(titleCase(p.replace(/^(no more|never|without|stop)\s+/i, "").replace(/[.,!?]+$/, "")).slice(0, 30), null));
        if (R.chance(lens === "type" ? 0.3 : 0.65)) {
          items.push(base("compare", c.from, { rows: rows.map((r2) => ({ ...r2, meta: "Handled for you" })), title: "Before", sub: brand.name, hit: Math.min(c.to, c.from + 3) }));
          layoutW = { top: 3, bottom: 2 };
        } else {
          size = "xl";
          layoutW = { type: 3, center: 1 };
          items.push(base("badge", c.from, { icon: "circle-x", title: "No more" }));
        }
        break;
      }
      case "cta": {
        size = "m";
        items.push(base("button", c.from, { title: brand.cta, sub: brand.url || null, hit: c.to }));
        if (R.chance(0.5)) items.unshift(base("logo", c.from, { size: "s" }));
        layoutW = { top: 3, center: 2, bottom: 1 };
        break;
      }
      default: {
        const cc = concept!;
        size = "m";
        const dev = lens === "product" ? 0.55 : lens === "type" ? 0.15 : 0.3;
        const r = R.next();
        layoutW = { "split-left": 3, "split-right": 3, corner: 1, top: 1 };
        if (r < dev) {
          items.push(base("device", c.from, { variant: R.pick(["phone", "browser", "laptop", "tablet"]), screen: cc.card as ItemT["screen"], title: cc.label, icon: cc.icon, rows: cc.rows(R, brand.name), value: cc.value?.(R) ?? null, hit: c.to, tilt: R.pick([0, 0, -10, 10]) }));
          if (screens && R.chance(0.5)) items[0] = base("screenshot", c.from, { tilt: R.pick([0, -8, 8]) });
          layoutW = { "split-left": 3, "split-right": 3, caption: 2, label: 1, top: 1 };
        } else if (lens === "object" && r < 0.8) {
          items.push(base("icon", c.from, { icon: cc.icon, size: "l" }));
          items.push(base("badge", Math.min(c.to, c.from + 2), { icon: "check", title: R.pick(cc.badge) }));
          layoutW = { inline: 3, "split-left": 1, "split-right": 1, center: 1 };
        } else {
          items.push(base("card", c.from, { variant: cc.card, title: cc.label, icon: cc.icon, rows: cc.rows(R, brand.name), value: cc.value?.(R) ?? null, hit: c.to, tilt: R.pick([0, 0, -6, 6]) }));
          if (R.chance(0.35)) {
            // the card on one side, its icon beside the words on the other
            items.push(base("icon", c.from, { icon: cc.icon, size: "s" }));
            layoutW = { inline: 3, between: 1 };
          } else {
            if (R.chance(0.35)) items.push(base("badge", Math.min(c.to, c.from + 3), { icon: "zap", title: R.pick(cc.badge) }));
            layoutW = { "split-left": 3, "split-right": 3, label: 3, corner: 1, top: 1 };
          }
        }
        if (carry && items[0] && items[0].kind !== "badge" && R.chance(0.6)) items[0].id = carry;
      }
    }
    const layout = weighted(R, layoutW, [prevLayout]);
    const solid = items.filter((x) => x.kind !== "badge" && x.kind !== "shape" && x.kind !== "cursor").length;
    const arrange = solid > 1 ? weighted<ArrangeKind>(R, layout.startsWith("split") ? { column: 2, cascade: 2, grid: 1 } : { row: 3, scatter: 1, diagonal: 1, cascade: 1 }, [prevArrange]) : "single";
    // the text: the scene's spoken words (layout.ts shows their highlight), key words lit
    const trans: TransitionKind = gi === 0 ? "fade" : items.some((x) => x.id && scenes.some((s) => s.items.some((q) => q.id === x.id))) ? "morph" : R.chance(0.18) ? accentT : weighted<TransitionKind>(R, Object.fromEntries(family.map((x, k) => [x, 3 - k])) as Weights<TransitionKind>, [prevT]);
    const keys = c.text.split(/\s+/).map(clean).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()) && w.toLowerCase() !== brand.name.toLowerCase());
    const keyPick = kind === "brand" ? [brand.name] : keys.sort((a, b) => b.length - a.length).slice(0, 1);
    scenes.push({
      at: c.from,
      text: { from: c.from, to: c.to, size, reveal: R.chance(0.75) ? reveals[0] : reveals[1], align: null, key: keyPick },
      kicker,
      layout: layout === "type" && solid ? "center" : layout,
      arrange,
      ratio: Number(R.range(0.38, 0.5).toFixed(2)),
      dark: art.scheme === "mixed" ? (kind === "brand" || kind === "cta" ? !(scenes[scenes.length - 1]?.dark ?? false) : (scenes[scenes.length - 1]?.dark ?? R.chance(0.5))) : null,
      camera: R.chance(0.7) ? null : (R.pick(CAMERAS) as CameraKind),
      enter: trans,
      items,
    });
    prevLayout = layout;
    prevArrange = arrange;
    prevT = trans;
    if (kind !== "brand" && kind !== "feature" && kind !== "step") carry = null;
  });
  // the film ends on the brand's ask, said or not
  const end = scenes[scenes.length - 1];
  if (end && !end.items.some((x) => x.kind === "button")) {
    const b = { kind: "button" as const, at: end.at, hit: Math.max(end.at, (end.text?.to ?? end.at)), id: null, enter: null, variant: null, title: brand.cta, sub: brand.url || null, icon: null, value: null, values: null, rows: null, screen: null, size: "s" as const, tilt: null };
    const solid = end.items.filter((x) => x.kind !== "badge" && x.kind !== "shape" && x.kind !== "cursor");
    end.items = [...(solid.length ? [] : [{ ...b, kind: "logo" as const, title: null, sub: null, hit: null }]), b];
    end.layout = R.pick(["top", "center"] as const);
    end.arrange = "column";
    if (end.text) end.text.size = "m";
  }
  return { art, scenes };
}

// The number the words say ("four hours" → "4 hours"; "in seconds" → "Seconds").
const NUMS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2, half: 50 };
function spokenNumber(text: string): { value: string; digits: boolean } {
  const d = /\$?\d[\d,.]*\s?(%|x|k|percent)?(\s+(days?|hours?|hrs|minutes?|mins?|seconds?|weeks?|months?|times))?/i.exec(text);
  if (d) return { value: d[0].replace(/percent/i, "%").trim(), digits: true };
  const w = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|hours?|minutes?|seconds?|weeks?|months?|clicks?|times)\b/i.exec(text);
  if (w) return { value: `${NUMS[w[1].toLowerCase()]} ${w[2].toLowerCase()}`, digits: true };
  if (/\btwice\b/i.test(text)) return { value: "2x", digits: true };
  const p = /\b(in|within)\s+(a\s+)?(days?|minutes?|seconds?|minute|hours?)\b/i.exec(text);
  return { value: p ? titleCase(p[0].replace(/^within a /i, "1 ").replace(/^in a /i, "1 ")) : titleCase(headOf(text)), digits: false };
}

// The things a product brings together: the script's own concepts.
function thingsOf(words: Word[]): RowT[] {
  const text = words.map((w) => w.text).join(" ").toLowerCase();
  const found = CONCEPTS.filter(([re]) => re.test(text)).map(([, cc]) => row(cc.label, null, null, cc.icon));
  const uniq = found.filter((x, i) => found.findIndex((y) => y.title === x.title) === i).slice(0, 5);
  return uniq.length >= 3 ? uniq : [...uniq, row("Clients", null, null, "id-card"), row("Payments", null, null, "credit-card"), row("Reports", null, null, "chart-column")].slice(0, 4);
}
