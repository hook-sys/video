import type { KWord } from "../text";
import type { CleanPlan, Scene, Variant, Word } from "../types";
import { FPS } from "../types";
import { FLOWLY_WORDS } from "./flowly-words";

// The Flowly proof: the real voice timings of project db7482bf, its seven
// sentences each on a template, in four variants that share nothing visual.
// (Hand-made scene choice; the Director takes this over.)

const WORDS: Word[] = FLOWLY_WORDS.map(([text, start, end]) => ({ text, start, end }));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Index of the first word of `phrase` in the voice (at or after `after` s).
function find(phrase: string, after = 0): number {
  const want = phrase.split(/\s+/).map(norm).filter(Boolean);
  const toks = WORDS.map((w, i) => ({ t: norm(w.text), i })).filter((x) => x.t);
  for (let k = 0; k <= toks.length - want.length; k++) {
    if (WORDS[toks[k].i].start < after) continue;
    if (want.every((w, j) => toks[k + j].t === w)) return toks[k].i;
  }
  throw new Error(`phrase not in the voice: ${phrase}`);
}
const at = (phrase: string, after = 0) => Math.round(WORDS[find(phrase, after)].start * FPS);
// The spoken words of a phrase as kinetic words (the keyword marked).
function kw(phrase: string, key: string[] = [], strike: Record<string, number> = {}, after = 0): KWord[] {
  let i = find(phrase, after);
  return phrase.split(/\s+/).map((t) => {
    while (i < WORDS.length && !norm(WORDS[i].text)) i++;
    const w = WORDS[i++];
    return { t, at: Math.round(w.start * FPS) - 2, key: key.includes(t), strike: strike[t] };
  });
}

const END = Math.round(WORDS[WORDS.length - 1].end * FPS);
const DURATION = END + 66;
const b = {
  sales: at("Sales"),
  flowly: at("Flowly"),
  when1: at("When a payment"),
  when2: at("When sales"),
  nomore: at("No more switching"),
  just: at("Just one"),
};
const OV = 6; // scenes overlap a little at their cuts

function scenes(): Scene[] {
  return [
    { template: "hook", act: "problem", from: 0, to: b.sales + OV, cues: {}, data: { words: kw("Every team starts with data scattered across different tools.", ["scattered"]) } },
    {
      template: "trio",
      act: "problem",
      from: b.sales - OV,
      to: b.flowly + OV,
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
      from: b.flowly - OV - 6,
      to: b.when1 + OV,
      cues: { name: b.flowly },
      data: { icons: ["chart-line", "credit-card", "file-text"], sub: kw("brings everything into one live dashboard.", ["dashboard."]) },
    },
    {
      template: "pay",
      act: "solution",
      from: b.when1 - OV,
      to: b.when2 + OV,
      cues: { pay: at("payment arrives") , rev: at("revenue updates"), inst: at("instantly") },
      data: { eyebrow: "When a payment arrives,", title: kw("revenue updates instantly.", ["instantly."]) },
    },
    {
      template: "growth",
      act: "solution",
      from: b.when2 - OV,
      to: b.nomore + OV,
      cues: { grow: at("grow"), team: at("entire team"), zoom: at("in one view") },
      data: { eyebrow: "When sales grow,", title: kw("the entire team sees the change in one view.", ["view."]) },
    },
    {
      template: "nomore",
      act: "problem",
      from: b.nomore - OV,
      to: b.just + OV,
      cues: {},
      data: { a: kw("No more switching between tools.", ["switching"], { switching: at("between tools") }), b: kw("No more waiting for reports.", ["waiting"], { waiting: at("for reports") }, 21) },
    },
    { template: "cta", act: "cta", from: b.just - OV, to: DURATION, cues: { click: END + 20 }, data: { tagline: kw("Just one live dashboard with every answer you need.", ["answer"]) } },
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
