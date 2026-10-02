import type { KWord } from "../text";
import type { CleanPlan, Scene, Variant, Word } from "../types";
import { FPS } from "../types";
import { FLOWLY_WORDS } from "./flowly-words";
import { findPhrase, norm } from "../words";

// The Flowly proof: the real voice timings of project db7482bf, its seven
// sentences each on a template, in four variants that share nothing visual.
// (Hand-made scene choice; the Director takes this over.)

export const WORDS: Word[] = FLOWLY_WORDS.map(([text, start, end]) => ({ text, start, end }));
// Frame of the first word of `phrase` in the voice (at or after `after` s).
export const at = (phrase: string, after = 0) => Math.round(WORDS[findPhrase(WORDS, phrase, after)[0]].start * FPS);
// The spoken words of a phrase as kinetic words (the keyword marked).
export function kw(phrase: string, key: string[] = [], strike: Record<string, number> = {}, after = 0): KWord[] {
  const idx = findPhrase(WORDS, phrase, after);
  return phrase.split(/\s+/).filter((t) => norm(t)).map((t, n) => ({ t, at: Math.round(WORDS[idx[n]].start * FPS) - 2, key: key.includes(t), strike: strike[t] }));
}

export const END = Math.round(WORDS[WORDS.length - 1].end * FPS);
export const DURATION = END + 66;
const b = {
  sales: at("Sales"),
  flowly: at("Flowly"),
  when1: at("When a payment"),
  when2: at("When sales"),
  nomore: at("No more switching"),
  just: at("Just one"),
};
// The cuts between scenes: just before each sentence's first word (the
// next scene is in when its words begin).
const LEAD = 8;
const cut = { trio: b.sales - LEAD, reveal: b.flowly - LEAD - 4, pay: b.when1 - LEAD, growth: b.when2 - LEAD, nomore: b.nomore - LEAD, cta: b.just - LEAD };

function scenes(): Scene[] {
  return [
    { template: "hook", act: "problem", from: 0, to: cut.trio, cues: {}, data: { words: kw("Every team starts with data scattered across different tools.", ["scattered"]) } },
    {
      template: "trio",
      act: "problem",
      from: cut.trio,
      to: cut.reveal,
      cues: {},
      data: {
        items: [
          { icon: "chart-line", label: "Sales", sub: "in one place", at: at("Sales") - 2 },
          { icon: "credit-card", label: "Payments", sub: "in another", at: at("Payments") - 2 },
          { icon: "file-text", label: "Reports", sub: "somewhere else", at: at("Reports") - 2 },
        ],
      },
    },
    {
      template: "reveal",
      act: "reveal",
      from: cut.reveal,
      to: cut.pay,
      cues: { name: b.flowly },
      data: { icons: ["chart-line", "credit-card", "file-text"], sub: kw("brings everything into one live dashboard.", ["dashboard."]) },
    },
    {
      template: "pay",
      act: "solution",
      from: cut.pay,
      to: cut.growth,
      cues: { pay: at("payment arrives"), rev: at("revenue updates"), inst: at("instantly") },
      data: { eyebrow: "When a payment arrives,", title: kw("revenue updates instantly.", ["instantly."]) },
    },
    {
      template: "growth",
      act: "solution",
      from: cut.growth,
      to: cut.nomore,
      cues: { grow: at("grow"), team: at("entire team"), zoom: at("in one view") },
      data: { eyebrow: "When sales grow,", title: kw("the entire team sees the change in one view.", ["view."]) },
    },
    {
      template: "nomore",
      act: "problem",
      from: cut.nomore,
      to: cut.cta,
      cues: {},
      data: { a: kw("No more switching between tools.", ["switching"], { switching: at("between tools") }), b: kw("No more waiting for reports.", ["waiting"], { waiting: at("for reports") }, 21) },
    },
    { template: "cta", act: "cta", from: cut.cta, to: DURATION, cues: { click: END + 20 }, data: { tagline: kw("Just one live dashboard with every answer you need.", ["answer"]) } },
  ];
}

// Four variants: every choice differs between any two of them (the text
// side has only two options).
export const FLOWLY_VARIANTS: Variant[] = [
  { look: "lavender", camera: "push", transition: "blur", keyword: "gradient", side: "left", hook: "center", trio: "row", reveal: "converge", pay: "dashboard", growth: "bars", nomore: "stack", cta: "center" },
  { look: "midnight", camera: "tilt", transition: "slide", keyword: "pill", side: "right", hook: "left", trio: "orbit", reveal: "ring", pay: "cards", growth: "line", nomore: "icons", cta: "card" },
  { look: "mint", camera: "drift", transition: "zoom", keyword: "underline", side: "left", hook: "stack", trio: "scatter", reveal: "split", pay: "phone", growth: "tiles", nomore: "swap", cta: "left" },
  { look: "sunrise", camera: "zoom", transition: "wipe", keyword: "marker", side: "right", hook: "word", trio: "stack", reveal: "wipe", pay: "feed", growth: "donut", nomore: "split", cta: "minimal" },
];

export function flowlyPlan(i: number): CleanPlan {
  return {
    duration: DURATION,
    variant: FLOWLY_VARIANTS[i],
    brand: { name: "Flowly", color: ["#6a5bff", "#3b5bff", "#0fae7b", "#ff6a2b"][i], tagline: "Every answer you need", cta: "Try Flowly free", url: "flowly.app", icon: null },
    words: WORDS,
    scenes: scenes(),
  };
}
