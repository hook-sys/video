import { buildPlan, type SevenPart } from "../plan";
import type { CleanPlan, Word } from "../types";

// A second script for the film templates: a different product, words and
// brand, with even voice timings (no recording) — it shows the templates
// are not tied to the Flowly script.

// Even timings: 0.32 s a word, 0.45 s more after a stop.
export function evenWords(text: string): Word[] {
  let t = 0.2;
  return text.split(/\s+/).filter(Boolean).map((w) => {
    const word = { text: w, start: t, end: t + 0.28 };
    t += 0.32 + (/[.!?]$/.test(w) ? 0.45 : /,$/.test(w) ? 0.15 : 0);
    return word;
  });
}

export const SHOPNEST: SevenPart = {
  brand: { name: "Shopnest", color: "#e8590c", tagline: "Your whole store, one screen", cta: "Start free", url: "shopnest.io", icon: null },
  hook: { text: "Most shops still track orders in messy spreadsheets.", key: "messy" },
  trio: {
    text: "Orders in one sheet. Stock in another. Invoices on paper.",
    items: [
      { label: "Orders", sub: "in one sheet", icon: "package" },
      { label: "Stock", sub: "in another", icon: "boxes" },
      { label: "Invoices", sub: "on paper", icon: "receipt" },
    ],
  },
  reveal: { name: "Shopnest", sub: "puts your whole store on one screen.", key: "screen." },
  pay: { eyebrow: "When an order comes in,", title: "stock updates on its own.", key: "own.", pay: "order comes", rev: "stock updates", inst: "own." },
  growth: { eyebrow: "When sales pick up,", title: "your whole team sees it at a glance.", key: "glance.", grow: "pick up", team: "whole team", zoom: "at a glance" },
  nomore: { a: "No more copying numbers by hand.", aKey: "copying", b: "No more lost invoices.", bKey: "lost" },
  cta: { tagline: "Just one simple screen for your entire store.", key: "simple" },
  content: {
    metric: { label: "Items in stock", from: 1284, to: 1281, unit: "" },
    event: { label: "New order", detail: "3 items", source: "Order #2041", done: "Stock updated" },
    rows: [
      { name: "Order #2040", value: "$86" },
      { name: "Order #2039", value: "$142" },
      { name: "Order #2038", value: "$38" },
    ],
    side: [
      { label: "Orders today", value: "47" },
      { label: "Low stock", value: "3 items" },
    ],
    growth: { label: "Sales this week", from: 8420, to: 11960, unit: "$" },
    people: [
      { name: "Nadia Rahman", role: "Store owner" },
      { name: "Tom Okafor", role: "Warehouse" },
      { name: "Lea Martin", role: "Customer care" },
      { name: "Ivan Petrov", role: "Accounts" },
    ],
  },
};

const SHOPNEST_TEXT = [SHOPNEST.hook.text, SHOPNEST.trio.text, `${SHOPNEST.reveal.name} ${SHOPNEST.reveal.sub}`, `${SHOPNEST.pay.eyebrow} ${SHOPNEST.pay.title}`, `${SHOPNEST.growth.eyebrow} ${SHOPNEST.growth.title}`, SHOPNEST.nomore.a, SHOPNEST.nomore.b, SHOPNEST.cta.tagline].join(" ");
export function shopnestPlan(): CleanPlan {
  const { plan, problems } = buildPlan(SHOPNEST, evenWords(SHOPNEST_TEXT));
  if (!plan) throw new Error(`Shopnest fixture: ${problems.join("; ")}`);
  return plan;
}

// A third script (a clinic's booking app): the one used in the first real
// test of the studio on Preview; long words and a different trade.
export const BOOKWELL: SevenPart = {
  brand: { name: "Bookwell", color: "#2f6fed", tagline: "Your whole clinic in one simple app", cta: "Book a free demo", url: "bookwell.app", icon: null },
  hook: { text: "Most clinics still run their day on phone calls and paper notes.", key: "paper" },
  trio: {
    text: "Bookings in one diary. Patient files in a cabinet. Reminders on sticky notes.",
    items: [
      { label: "Bookings", sub: "in one diary", icon: "calendar" },
      { label: "Patient files", sub: "in a cabinet", icon: "folder" },
      { label: "Reminders", sub: "on sticky notes", icon: "sticky-note" },
    ],
  },
  reveal: { name: "Bookwell", sub: "puts your whole clinic in one simple app.", key: "app." },
  pay: { eyebrow: "When a patient books online,", title: "the slot fills itself.", key: "itself.", pay: "books online", rev: "slot fills", inst: "itself." },
  growth: { eyebrow: "When the day gets busy,", title: "your whole team sees who is next.", key: "next.", grow: "gets busy", team: "whole team", zoom: "who is next" },
  nomore: { a: "No more double bookings.", aKey: "double", b: "No more missed appointments.", bKey: "missed" },
  cta: { tagline: "Just one calm screen for your entire clinic.", key: "calm" },
  content: {
    metric: { label: "Open slots today", from: 14, to: 13, unit: "" },
    event: { label: "New booking", detail: "10:30 · Check-up", source: "Amira Khan", done: "Slot filled" },
    rows: [
      { name: "Daniel Okoye", value: "09:00" },
      { name: "Priya Shah", value: "09:30" },
      { name: "Marco Rossi", value: "10:00" },
    ],
    side: [
      { label: "Patients today", value: "38" },
      { label: "No-shows", value: "0" },
    ],
    growth: { label: "Visits this week", from: 164, to: 212, unit: "" },
    people: [
      { name: "Sara Haddad", role: "Front desk" },
      { name: "Leo Brandt", role: "Doctor" },
      { name: "Mina Cho", role: "Nurse" },
      { name: "Omar Aziz", role: "Practice manager" },
    ],
  },
};
const BOOKWELL_TEXT = [BOOKWELL.hook.text, BOOKWELL.trio.text, `${BOOKWELL.reveal.name} ${BOOKWELL.reveal.sub}`, `${BOOKWELL.pay.eyebrow} ${BOOKWELL.pay.title}`, `${BOOKWELL.growth.eyebrow} ${BOOKWELL.growth.title}`, BOOKWELL.nomore.a, BOOKWELL.nomore.b, BOOKWELL.cta.tagline].join(" ");
export function bookwellPlan(): CleanPlan {
  const { plan, problems } = buildPlan(BOOKWELL, evenWords(BOOKWELL_TEXT));
  if (!plan) throw new Error(`Bookwell fixture: ${problems.join("; ")}`);
  return plan;
}
