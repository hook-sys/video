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
