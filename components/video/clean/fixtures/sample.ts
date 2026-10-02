import type { KWord } from "../text";
import type { CleanPlan, Scene, Word } from "../types";
import { FPS } from "../types";
import { findPhrase, norm } from "../words";
import { FLOWLY_VARIANTS } from "./flowly";

// A second script for the film templates: a different product, words and
// brand, with even voice timings (no recording) — it shows the templates
// are not tied to the Flowly script.

export type SevenPart = {
  brand: CleanPlan["brand"];
  hook: { text: string; key: string };
  trio: { text: string; items: { label: string; sub: string; icon: string }[] };
  reveal: { name: string; sub: string; key: string };
  pay: { eyebrow: string; title: string; key: string; pay: string; rev: string; inst: string };
  growth: { eyebrow: string; title: string; key: string; grow: string; team: string; zoom: string };
  nomore: { a: string; aKey: string; b: string; bKey: string };
  cta: { tagline: string; key: string };
};

// Even timings: 0.32 s a word, 0.45 s more after a stop.
export function evenWords(text: string): Word[] {
  let t = 0.2;
  return text.split(/\s+/).filter(Boolean).map((w) => {
    const word = { text: w, start: t, end: t + 0.28 };
    t += 0.32 + (/[.!?]$/.test(w) ? 0.45 : /,$/.test(w) ? 0.15 : 0);
    return word;
  });
}

// A seven-part script on its voice's words → a CleanPlan.
export function planFromSevenPart(s: SevenPart, words: Word[], variant = 0): CleanPlan {
  const at = (phrase: string, after = 0) => Math.round(words[findPhrase(words, phrase, after)[0]].start * FPS);
  const kw = (phrase: string, key: string[] = [], strikeNext = false): KWord[] => {
    const idx = findPhrase(words, phrase, 0);
    const out = phrase.split(/\s+/).filter((x) => norm(x)).map((t, n) => ({ t, at: Math.round(words[idx[n]].start * FPS) - 2, key: key.includes(t) }) as KWord);
    if (strikeNext) out.forEach((w, n) => w.key && out[n + 1] && (w.strike = out[n + 1].at + 2));
    return out;
  };
  const first = (text: string) => at(text.split(/\s+/).slice(0, 3).join(" "));
  const LEAD = 8;
  const end = Math.round(words[words.length - 1].end * FPS);
  const duration = end + 66;
  const c = { trio: first(s.trio.text) - LEAD, reveal: at(s.reveal.name) - LEAD - 4, pay: first(s.pay.eyebrow) - LEAD, growth: first(s.growth.eyebrow) - LEAD, nomore: first(s.nomore.a) - LEAD, cta: first(s.cta.tagline) - LEAD };
  const scenes: Scene[] = [
    { template: "hook", act: "problem", from: 0, to: c.trio, cues: {}, data: { words: kw(s.hook.text, [s.hook.key]) } },
    { template: "trio", act: "problem", from: c.trio, to: c.reveal, cues: {}, data: { items: s.trio.items.map((it) => ({ ...it, at: at(it.label, c.trio / FPS) - 2 })) } },
    { template: "reveal", act: "reveal", from: c.reveal, to: c.pay, cues: { name: at(s.reveal.name) }, data: { icons: s.trio.items.map((x) => x.icon), sub: kw(s.reveal.sub, [s.reveal.key]) } },
    { template: "pay", act: "solution", from: c.pay, to: c.growth, cues: { pay: at(s.pay.pay), rev: at(s.pay.rev), inst: at(s.pay.inst) }, data: { eyebrow: s.pay.eyebrow, title: kw(s.pay.title, [s.pay.key]) } },
    { template: "growth", act: "solution", from: c.growth, to: c.nomore, cues: { grow: at(s.growth.grow), team: at(s.growth.team), zoom: at(s.growth.zoom) }, data: { eyebrow: s.growth.eyebrow, title: kw(s.growth.title, [s.growth.key]) } },
    { template: "nomore", act: "problem", from: c.nomore, to: c.cta, cues: {}, data: { a: kw(s.nomore.a, [s.nomore.aKey], true), b: kw(s.nomore.b, [s.nomore.bKey], true) } },
    { template: "cta", act: "cta", from: c.cta, to: duration, cues: { click: end + 20 }, data: { tagline: kw(s.cta.tagline, [s.cta.key]) } },
  ];
  return { duration, variant: FLOWLY_VARIANTS[variant], brand: s.brand, words, scenes };
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
};

const SHOPNEST_TEXT = [SHOPNEST.hook.text, SHOPNEST.trio.text, `${SHOPNEST.reveal.name} ${SHOPNEST.reveal.sub}`, `${SHOPNEST.pay.eyebrow} ${SHOPNEST.pay.title}`, `${SHOPNEST.growth.eyebrow} ${SHOPNEST.growth.title}`, SHOPNEST.nomore.a, SHOPNEST.nomore.b, SHOPNEST.cta.tagline].join(" ");
export const shopnestPlan = () => planFromSevenPart(SHOPNEST, evenWords(SHOPNEST_TEXT));
