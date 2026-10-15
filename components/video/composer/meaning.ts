import { CONCEPT_ICONS, searchIcons } from "@/lib/icons";
import type { ItemT, ScriptT, Word } from "./types";

// What the voice is talking about, scene by scene, and what pictures it:
// each meaning names the cards, devices, icons and kinds of thing that show
// it. Used three ways — told to the Director (the map), checked on every
// video (a scene whose words talk about bookings but shows an invoice), and
// mended where it is safe (an icon that does not show its own word or the
// scene's meaning is swapped for one that does). English and Bengali words.

export type Meaning = { id: string; en: RegExp; bn?: string[]; cards: string[]; icons: string[]; kinds?: ItemT["kind"][]; device?: "phone" | "browser" | "laptop" };

export const MEANINGS: Meaning[] = [
  { id: "payment", en: /\b(pay|paid|payments?|paying|money|cash|collect(s|ed)?|checkout|charge[ds]?|price|pricing|cost|refund)\b/, bn: ["টাকা", "পেমেন্ট", "পরিশোধ", "দাম", "খরচ", "বিকাশ", "নগদ"], cards: ["pay", "invoice"], icons: ["credit-card", "banknote", "wallet", "circle-dollar-sign", "taka", "hand-coins"], kinds: ["stat"] },
  { id: "invoice", en: /\b(invoices?|bills?|billing|receipts?|quote|quotes)\b/, bn: ["ইনভয়েস", "বিল", "রসিদ"], cards: ["invoice", "pay"], icons: ["receipt", "file-text", "file-check"] },
  { id: "reminder", en: /\b(remind(er|ers|s)?|notif(y|ies|ication|ications)|alerts?|nudges?|follow.?ups?|pings?)\b/, bn: ["রিমাইন্ডার", "নোটিফিকেশন", "মনে করিয়ে", "সতর্ক"], cards: ["notify"], icons: ["bell-ring", "bell", "alarm-clock"] },
  { id: "booking", en: /\b(book(s|ed|ing|ings)?|appointments?|slots?|schedul(e|es|ed|ing)|calendars?|diary|reserv(e|ation|ations))\b/, bn: ["বুকিং", "অ্যাপয়েন্টমেন্ট", "সময়সূচি", "ক্যালেন্ডার", "সিরিয়াল"], cards: ["calendar"], icons: ["calendar-check", "calendar", "clock"] },
  { id: "meeting", en: /\b(meetings?|calls?|zoom|video call|standups?|sync-up)\b/, bn: ["মিটিং", "কল"], cards: ["timeline", "chat", "calendar"], icons: ["video", "phone", "calendar-clock"] },
  { id: "document", en: /\b(documents?|docs?|notes?|summar(y|ies|ize)|writes?|written|contracts?|pdfs?|proposals?)\b/, bn: ["ডকুমেন্ট", "নোট", "সারাংশ", "চুক্তি"], cards: ["doc"], icons: ["file-text", "notebook-pen", "file-pen"] },
  { id: "task", en: /\b(tasks?|to-?dos?|checklists?|assign(s|ed)?|deadlines?|due)\b/, bn: ["কাজ", "টাস্ক", "চেকলিস্ট", "ডেডলাইন"], cards: ["checklist", "kanban"], icons: ["list-checks", "square-check", "circle-check"] },
  { id: "project", en: /\b(projects?|boards?|kanban|pipelines?|stages?|sprints?|roadmaps?)\b/, bn: ["প্রজেক্ট", "পাইপলাইন"], cards: ["kanban", "timeline"], icons: ["kanban", "workflow", "folder-kanban"] },
  { id: "chat", en: /\b(chats?|messages?|messaging|repl(y|ies)|inbox|whatsapp|sms|texts?|conversations?|dms?)\b/, bn: ["চ্যাট", "মেসেজ", "বার্তা", "উত্তর", "হোয়াটসঅ্যাপ"], cards: ["chat", "notify"], icons: ["message-circle", "messages-square", "send"] },
  { id: "email", en: /\b(e-?mails?|newsletters?|mail)\b/, bn: ["ইমেইল", "মেইল"], cards: ["chat", "list", "notify"], icons: ["mail", "mails", "inbox"] },
  { id: "search", en: /\b(search(es|ing)?|find(s|ing)?|look(ing)? up|discover)\b/, bn: ["খুঁজ", "সার্চ"], cards: ["search"], icons: ["search", "scan-search"] },
  { id: "analytics", en: /\b(dashboards?|analytics|metrics|reports?|reporting|insights?|kpis?|data|numbers|stats|statistics|at a glance)\b/, bn: ["ড্যাশবোর্ড", "রিপোর্ট", "হিসাব", "পরিসংখ্যান", "ডেটা"], cards: ["kpi", "table"], icons: ["layout-dashboard", "chart-column", "chart-pie", "chart-line"], kinds: ["chart", "stat"] },
  { id: "growth", en: /\b(grow(s|th|ing)?|increase[ds]?|boost(s|ed)?|more (sales|customers|orders|leads)|revenue|profits?|scale|doubles?)\b/, bn: ["বাড়", "বৃদ্ধি", "লাভ", "বিক্রি বাড়"], cards: ["kpi"], icons: ["trending-up", "chart-line", "rocket", "arrow-up-right"], kinds: ["chart", "stat"] },
  { id: "orders", en: /\b(orders?|stock|inventory|products?|catalog(ue)?|warehouse|items|sku)\b/, bn: ["অর্ডার", "স্টক", "পণ্য", "প্রোডাক্ট", "মাল"], cards: ["table", "list"], icons: ["package", "boxes", "shopping-bag", "clipboard-list"] },
  { id: "shop", en: /\b(shops?|stores?|e-?commerce|carts?|sell(s|ing)?|sales)\b/, bn: ["দোকান", "শপ", "বিক্রি", "অনলাইন স্টোর"], cards: ["table", "pay", "kpi"], icons: ["store", "shopping-cart", "shopping-bag"] },
  { id: "customer", en: /\b(customers?|clients?|members?|profiles?|records?|contacts?|crm|leads?)\b/, bn: ["গ্রাহক", "কাস্টমার", "ক্লায়েন্ট", "সদস্য"], cards: ["profile", "list", "table"], icons: ["contact", "id-card", "user", "user-plus"], kinds: ["avatars"] },
  { id: "team", en: /\b(teams?|everyone|together|collaborat\w*|colleagues?|staff|employees?|co-?workers?)\b/, bn: ["টিম", "দল", "সবাই", "একসাথে", "কর্মী"], cards: ["list", "chat", "kanban"], icons: ["users", "users-round", "share-2"], kinds: ["avatars"] },
  { id: "automation", en: /\b(automat\w*|auto|on its own|by itself|syncs?|synced|integrat\w*|connects?|settings?|toggles?|workflows?)\b/, bn: ["স্বয়ংক্রিয়", "অটো", "নিজে নিজে", "সংযুক্ত", "সেটিং"], cards: ["toggles", "timeline"], icons: ["cog", "settings-2", "refresh-cw", "plug", "workflow"], kinds: ["flow"] },
  { id: "ai", en: /\b(ai|a\.i\.|artificial|smart|intelligen\w*|generates?|generat(ed|ing)|gpt|assistants?|agents?|copilot)\b/, bn: ["এআই", "কৃত্রিম", "স্মার্ট"], cards: ["chat", "doc", "search", "form"], icons: ["sparkles", "bot", "brain", "wand-sparkles"] },
  { id: "security", en: /\b(secur\w*|safe(ly|ty)?|privacy|private|protect\w*|encrypt\w*|passwords?|log ?ins?|compliance)\b/, bn: ["নিরাপদ", "নিরাপত্তা", "সুরক্ষা", "পাসওয়ার্ড"], cards: ["form", "toggles"], icons: ["shield-check", "lock", "key-round", "fingerprint-pattern"] },
  { id: "speed", en: /\b(fast(er)?|quick(ly)?|instant(ly)?|seconds?|minutes?|save[sd]? time|speed|in no time|hours? saved)\b/, bn: ["দ্রুত", "সেকেন্ড", "মিনিট", "সময় বাঁচ", "তাড়াতাড়ি"], cards: ["kpi"], icons: ["zap", "timer", "gauge", "clock"], kinds: ["stat"] },
  { id: "signup", en: /\b(sign ?ups?|register|forms?|onboard\w*|apply|applications?)\b/, bn: ["সাইন আপ", "রেজিস্টার", "ফর্ম", "আবেদন"], cards: ["form"], icons: ["clipboard-list", "user-plus", "text-cursor-input"] },
  { id: "mobile", en: /\b(apps?|mobile|phones?|on the go|anywhere)\b/, bn: ["অ্যাপ", "মোবাইল", "ফোন"], cards: [], icons: ["smartphone", "app-window"], device: "phone" },
  { id: "website", en: /\b(websites?|sites?|landing pages?|web|pages?|online)\b/, bn: ["ওয়েবসাইট", "সাইট", "অনলাইন"], cards: [], icons: ["globe", "app-window", "panels-top-left"], device: "browser" },
  { id: "delivery", en: /\b(deliver(y|ies|ed|s)?|shipping|ships?|couriers?|track(ing)?|parcels?|dispatch)\b/, bn: ["ডেলিভারি", "কুরিয়ার", "পার্সেল", "ট্র্যাক"], cards: ["timeline", "table"], icons: ["truck", "package-check", "map-pin", "route"] },
  { id: "marketing", en: /\b(campaigns?|ads?|advert\w*|marketing|audiences?|social|posts?|followers?|reach)\b/, bn: ["বিজ্ঞাপন", "মার্কেটিং", "ক্যাম্পেইন", "পোস্ট", "ফেসবুক"], cards: ["kpi", "list"], icons: ["megaphone", "target", "share-2", "heart"] },
  { id: "learning", en: /\b(courses?|learn\w*|lessons?|students?|classes?|teach\w*|training|quiz)\b/, bn: ["কোর্স", "শিখ", "ক্লাস", "ছাত্র", "শিক্ষার্থী"], cards: ["list", "checklist"], icons: ["graduation-cap", "book-open", "school"] },
  { id: "health", en: /\b(patients?|clinics?|doctors?|health|medical|prescriptions?|hospital)\b/, bn: ["রোগী", "ডাক্তার", "ক্লিনিক", "স্বাস্থ্য", "হাসপাতাল"], cards: ["calendar", "profile"], icons: ["stethoscope", "heart-pulse", "hospital"] },
  { id: "food", en: /\b(menus?|restaurants?|food|meals?|dishes|kitchen|tables?|cafe)\b/, bn: ["মেনু", "রেস্টুরেন্ট", "খাবার"], cards: ["list", "table"], icons: ["utensils", "chef-hat", "coffee"] },
  { id: "property", en: /\b(propert(y|ies)|houses?|homes?|rent(al|s)?|listings?|tenants?|apartments?)\b/, bn: ["বাড়ি", "ফ্ল্যাট", "ভাড়া", "প্রপার্টি"], cards: ["list", "profile"], icons: ["house", "key-round", "building"] },
  { id: "hiring", en: /\b(hir(e|es|ing)|candidates?|recruit\w*|jobs?|interviews?|payroll|hr)\b/, bn: ["নিয়োগ", "চাকরি", "প্রার্থী", "বেতন"], cards: ["kanban", "table", "profile"], icons: ["briefcase", "user-search", "badge-check"] },
  { id: "support", en: /\b(support|help(desk)?|tickets?|questions?|answers?)\b/, bn: ["সাপোর্ট", "সাহায্য", "প্রশ্ন", "উত্তর"], cards: ["chat", "list"], icons: ["headset", "life-buoy", "message-circle"] },
  { id: "files", en: /\b(files?|folders?|uploads?|storage|backups?|cloud|share files)\b/, bn: ["ফাইল", "ফোল্ডার", "আপলোড", "ক্লাউড"], cards: ["list", "table"], icons: ["folder", "cloud", "upload", "file"] },
  { id: "compare", en: /\b(instead of|versus|vs\.?|compared|old way|switch(ing)? from|no more|without)\b/, bn: ["বদলে", "আর না", "ছাড়া", "তুলনা"], cards: [], icons: ["arrow-left-right", "circle-x", "circle-check"], kinds: ["compare"] },
];

// (things that never mean anything on their own: they cannot mismatch)
const NEUTRAL = new Set<ItemT["kind"]>(["logo", "button", "cursor", "shape", "screenshot", "badge", "quote", "compare", "steps", "flow"]);
// (generic cards that show anything as rows)
const GENERIC_CARDS = new Set(["list"]);
// (icons that say "good", "new", "done" anywhere: never wrong)
const GENERIC_ICONS = new Set(["sparkles", "star", "zap", "circle-check", "check", "rocket", "wand-sparkles", "heart", "thumbs-up", "badge-check", "arrow-right", "party-popper", "trophy", "crown", "flame"]);
const NUMBER = /\d|%|percent|\b(twice|half|double|triple|once|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b|[০-৯]|দ্বিগুণ|অর্ধেক|এক |দুই|তিন|চার|পাঁচ|দশ|শত|হাজার/i;

export function meaningsOf(text: string): Meaning[] {
  const t = text.toLowerCase();
  return MEANINGS.filter((m) => m.en.test(t) || m.bn?.some((w) => text.includes(w)));
}

// The words the voice says in each scene (from its first word to the next scene's).
export function sceneTexts(script: ScriptT, words: Word[]): string[] {
  return script.scenes.map((s, i) => words.slice(s.at, script.scenes[i + 1]?.at ?? words.length).map((w) => w.text).join(" "));
}

const iconsFor = (text: string) => (/[a-z]/i.test(text) ? searchIcons(text, 6) : []);

// Does a thing picture what the scene's words mean?
export function fits(it: ItemT, ms: Meaning[], text: string): boolean {
  if (!ms.length || NEUTRAL.has(it.kind)) return true;
  const kinds = new Set(ms.flatMap((m) => m.kinds ?? []));
  const cards = new Set(ms.flatMap((m) => m.cards));
  const icons = new Set(ms.flatMap((m) => m.icons));
  switch (it.kind) {
    case "card":
      return !it.variant || GENERIC_CARDS.has(it.variant) || cards.has(it.variant);
    case "device":
      return !it.screen || GENERIC_CARDS.has(it.screen) || cards.has(it.screen) || ms.some((m) => m.device && m.device === it.variant) || !cards.size;
    case "stat":
    case "chart":
      return NUMBER.test(text) || kinds.has(it.kind) || kinds.has("stat") || kinds.has("chart");
    case "avatars":
      return kinds.has("avatars");
    case "icon":
    case "chips":
      return !it.icon || iconOk(it.icon, it.title, icons, text);
    default:
      return true;
  }
}
// an icon fits when it shows a meaning of the scene, or its own word — when that word is spoken there
function iconOk(icon: string, title: string | null | undefined, icons: Set<string>, text: string): boolean {
  if (icons.has(icon) || GENERIC_ICONS.has(icon)) return true;
  // (its own word's icon, whether or not the word is spoken)
  if (title && iconsFor(title).slice(0, 3).includes(icon)) return true;
  if (title && /[a-z]/i.test(title)) {
    const spoken = title.toLowerCase().split(/[^a-z]+/).some((w) => w.length > 2 && text.toLowerCase().includes(w));
    if (spoken && iconsFor(title).includes(icon)) return true;
  }
  return false;
}

const label = (it: ItemT) => (it.kind === "card" ? `${/^[aeiou]/.test(it.variant ?? "") ? "an" : "a"} ${it.variant ?? ""} card` : it.kind === "device" ? `a ${it.variant ?? "device"}${it.screen ? ` showing ${it.screen}` : ""}` : it.kind === "icon" ? `the icon ${it.icon}${it.title ? ` ("${it.title}")` : ""}` : `a ${it.kind}`);

// A word's own icon, when we are sure of it (a known business concept: "invoice" → receipt).
const sureIcon = (title: string | null | undefined) => {
  if (!title) return null;
  const ws = title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  for (const w of ws) {
    const hit = CONCEPT_ICONS[w] ?? CONCEPT_ICONS[w.replace(/s$/, "")];
    if (hit) return hit;
  }
  return null;
};

// Every scene checked against its words. An icon that shows neither its own
// word nor what the scene means is swapped (for its word's icon when we are
// sure of it, else the scene's meaning's). A scene where nothing pictures
// what the voice says is reported (the Director's review fixes it: changing
// a card's kind here would leave its rows about something else).
export function matched(script: ScriptT, words: Word[]): { script: ScriptT; mended: string[]; problems: string[] } {
  const texts = sceneTexts(script, words);
  const mended: string[] = [];
  const problems: string[] = [];
  const scenes = script.scenes.map((s, i) => {
    const text = texts[i];
    const ms = meaningsOf(text);
    if (!ms.length) return s;
    const items = s.items.map((it) => {
      if ((it.kind !== "icon" && it.kind !== "chips") || !it.icon || fits(it, ms, text)) return it;
      const next = sureIcon(it.title) ?? ms[0].icons[0];
      if (next === it.icon) return it;
      mended.push(`scene ${i + 1}: icon ${it.icon} → ${next} (${it.title ?? ms[0].id})`);
      return { ...it, icon: next };
    });
    const things = items.filter((it) => !NEUTRAL.has(it.kind));
    if (things.length && !things.some((it) => fits(it, ms, text))) {
      const want = ms[0].cards.length ? `a ${ms[0].cards.join(" or ")} card` : ms[0].device ? `a ${ms[0].device}` : `its ${ms[0].id}`;
      problems.push(`scene ${i + 1}: its words are about ${ms.map((m) => m.id).slice(0, 2).join(" and ")}, but nothing in it shows that (${things.map(label).join(", ")}) — show ${want}`);
    }
    return items.some((x, k) => x !== s.items[k]) ? { ...s, items } : s;
  });
  return { script: { ...script, scenes }, mended, problems: [...new Set(problems)] };
}

// The map for the Director: what pictures each meaning (one line each).
export const MEANING_MAP = MEANINGS.map((m) => `${m.id} → ${[m.cards.length ? `${m.cards.join("/")} card` : "", m.device ? `${m.device} device` : "", m.kinds?.length ? m.kinds.join("/") : "", `icons ${m.icons.slice(0, 3).join(", ")}`].filter(Boolean).join("; ")}`).join("\n");
