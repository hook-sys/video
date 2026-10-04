import { DEFAULT_CONTENT, type FilmContent } from "./content";
import { FLOWLY_VARIANTS } from "./fixtures/flowly";
import type { KWord } from "./text";
import type { Brand, CleanPlan, Scene, Word } from "./types";
import { FPS } from "./types";
import { findPhrase, norm } from "./words";

// A narration cut into the seven parts the film templates play, each part
// quoting the narration's own words, and the plan built from it on the
// voice's word timings. The Director writes the SevenPart; buildPlan checks
// it against the voice and never throws (problems are returned).

export type SevenPart = {
  brand: Brand;
  hook: { text: string; key: string; big?: string | null };
  trio: { text: string; items: { label: string; sub: string; icon: string }[] };
  reveal: { name: string; sub: string; key: string };
  pay: { eyebrow: string; title: string; key: string; pay: string; rev: string; inst: string };
  growth: { eyebrow: string; title: string; key: string; grow: string; team: string; zoom: string };
  nomore: { a: string; aKey: string; b: string; bKey: string };
  cta: { tagline: string; key: string };
  content?: FilmContent;
};

const LEAD = 8; // a scene comes in this many frames before its first word
const MIN_SCENE = 16; // rule short-shot

export type Built = { plan: CleanPlan | null; problems: string[] };

export function buildPlan(s: SevenPart, words: Word[], variant = 0): Built {
  const problems: string[] = [];
  if (!words.length) return { plan: null, problems: ["the voice has no words"] };
  const frame = (i: number) => Math.round(words[i].start * FPS);
  // The first word of a phrase spoken at or after `after` frames (null when not spoken).
  const find = (phrase: string, after: number): number[] | null => {
    if (!phrase || !phrase.split(/\s+/).some((t) => norm(t))) return null;
    try {
      return findPhrase(words, phrase, Math.max(0, after / FPS - 0.02));
    } catch {
      return null;
    }
  };
  const need = (phrase: string, after: number, what: string): number[] | null => {
    const hit = find(phrase, after);
    if (!hit) problems.push(`${what}: "${phrase}" is not in the narration (after ${(after / FPS).toFixed(1)} s)`);
    return hit;
  };
  const kw = (phrase: string, idx: number[] | null, key: string[], strikeNext = false): KWord[] => {
    if (!idx) return [];
    const out = phrase.split(/\s+/).filter((t) => norm(t)).map((t, n) => ({ t, at: frame(idx[n]) - 2, key: key.some((k) => norm(k) === norm(t)) }) as KWord);
    for (const k of key) if (k && !out.some((w) => norm(w.t) === norm(k))) problems.push(`keyword "${k}" is not in "${phrase}"`);
    if (strikeNext) out.forEach((w, n) => w.key && out[n + 1] && (w.strike = out[n + 1].at + 2));
    return out;
  };

  // the parts in order, each searched after the previous one began
  const hookI = need(s.hook.text, 0, "hook");
  const hookF = hookI ? frame(hookI[0]) : 0;
  const trioI = need(s.trio.text, hookF + 1, "trio");
  const trioF = trioI ? frame(trioI[0]) : hookF;
  const revealSubI = need(s.reveal.sub, trioF + 1, "reveal");
  const nameI = find(s.reveal.name, trioF + 1);
  const revealF = Math.min(nameI ? frame(nameI[0]) : Infinity, revealSubI ? frame(revealSubI[0]) : Infinity);
  const revealStart = Number.isFinite(revealF) ? revealF : trioF;
  const payEyeI = s.pay.eyebrow ? find(s.pay.eyebrow, revealStart + 1) : null;
  const payTitleI = need(s.pay.title, revealStart + 1, "pay");
  const payF = payEyeI ? frame(payEyeI[0]) : payTitleI ? frame(payTitleI[0]) : revealStart;
  const growEyeI = s.growth.eyebrow ? find(s.growth.eyebrow, payF + 1) : null;
  const growTitleI = need(s.growth.title, payF + 1, "growth");
  const growF = growEyeI ? frame(growEyeI[0]) : growTitleI ? frame(growTitleI[0]) : payF;
  const aI = need(s.nomore.a, growF + 1, "nomore a");
  const noF = aI ? frame(aI[0]) : growF;
  const bI = need(s.nomore.b, noF + 1, "nomore b");
  const ctaI = need(s.cta.tagline, (bI ? frame(bI[0]) : noF) + 1, "cta");
  const ctaF = ctaI ? frame(ctaI[0]) : noF;
  if (s.trio.items.length !== 3) problems.push(`trio has ${s.trio.items.length} items, needs 3`);
  if (s.pay.eyebrow && !payEyeI) problems.push(`pay eyebrow: "${s.pay.eyebrow}" is not in the narration`);
  if (s.growth.eyebrow && !growEyeI) problems.push(`growth eyebrow: "${s.growth.eyebrow}" is not in the narration`);
  if (problems.length) return { plan: null, problems };

  const end = Math.round(words[words.length - 1].end * FPS);
  const duration = end + 66;
  const c = { trio: trioF - LEAD, reveal: revealStart - LEAD - 4, pay: payF - LEAD, growth: growF - LEAD, nomore: noF - LEAD, cta: ctaF - LEAD };
  const order = [0, c.trio, c.reveal, c.pay, c.growth, c.nomore, c.cta, duration];
  order.slice(1).forEach((v, k) => v - order[k] < MIN_SCENE && problems.push(`part ${k + 1} lasts ${v - order[k]} frames (needs ${MIN_SCENE})`));
  if (problems.length) return { plan: null, problems };

  // a moment: the phrase's first word, else a fallback frame
  const cue = (phrase: string, after: number, fallback: number) => {
    const hit = find(phrase, after);
    return hit ? frame(hit[0]) : fallback;
  };
  const trioLen = c.reveal - c.trio;
  const scenes: Scene[] = [
    { template: "hook", act: "problem", from: 0, to: c.trio, cues: {}, data: { words: kw(s.hook.text, hookI, [s.hook.key]), big: s.hook.big ?? null } },
    {
      template: "trio",
      act: "problem",
      from: c.trio,
      to: c.reveal,
      cues: {},
      data: { items: s.trio.items.map((it, i) => ({ ...it, at: cue(it.label, trioF, c.trio + LEAD + Math.round((trioLen * i) / 3)) - 2 })) },
    },
    { template: "reveal", act: "reveal", from: c.reveal, to: c.pay, cues: { name: revealStart }, data: { icons: s.trio.items.map((x) => x.icon), sub: kw(s.reveal.sub, revealSubI, [s.reveal.key]) } },
    {
      template: "pay",
      act: "solution",
      from: c.pay,
      to: c.growth,
      cues: { pay: cue(s.pay.pay, payF, payF + 10), rev: cue(s.pay.rev, payF, payTitleI ? frame(payTitleI[0]) : payF + 20), inst: cue(s.pay.inst, payF, payTitleI ? frame(payTitleI[payTitleI.length - 1]) : payF + 40) },
      data: { eyebrow: s.pay.eyebrow, title: kw(s.pay.title, payTitleI, [s.pay.key]) },
    },
    {
      template: "growth",
      act: "solution",
      from: c.growth,
      to: c.nomore,
      cues: { grow: cue(s.growth.grow, growF, growF + 10), team: cue(s.growth.team, growF, growTitleI ? frame(growTitleI[Math.min(1, growTitleI.length - 1)]) : growF + 30), zoom: cue(s.growth.zoom, growF, growTitleI ? frame(growTitleI[growTitleI.length - 1]) : growF + 60) },
      data: { eyebrow: s.growth.eyebrow, title: kw(s.growth.title, growTitleI, [s.growth.key]) },
    },
    { template: "nomore", act: "problem", from: c.nomore, to: c.cta, cues: {}, data: { a: kw(s.nomore.a, aI, [s.nomore.aKey], true), b: kw(s.nomore.b, bI, [s.nomore.bKey], true) } },
    { template: "cta", act: "cta", from: c.cta, to: duration, cues: { click: end + 20 }, data: { tagline: kw(s.cta.tagline, ctaI, [s.cta.key]) } },
  ];
  if (problems.length) return { plan: null, problems };
  return { plan: { duration, variant: FLOWLY_VARIANTS[variant % FLOWLY_VARIANTS.length], brand: s.brand, words, scenes, content: s.content ?? DEFAULT_CONTENT }, problems };
}

// A story shape: the narration cut into any sequence of the seven kinds of
// part — a story may open on the product, a result or a contrast, leave parts
// out (15 s) or tell a kind twice (60 s: several features). Every part quotes
// the narration's words, in the order spoken.
export type StoryPart =
  | ({ role: "hook" } & SevenPart["hook"])
  | ({ role: "trio" } & SevenPart["trio"])
  | ({ role: "reveal" } & SevenPart["reveal"])
  | ({ role: "pay" } & SevenPart["pay"])
  | ({ role: "growth" } & SevenPart["growth"])
  | ({ role: "nomore" } & SevenPart["nomore"])
  | ({ role: "cta" } & SevenPart["cta"]);
export type Story = { brand: Brand; parts: StoryPart[]; content?: FilmContent; shape?: string };

const ACT: Record<StoryPart["role"], Scene["act"]> = { hook: "problem", trio: "problem", reveal: "reveal", pay: "solution", growth: "solution", nomore: "problem", cta: "cta" };
// The seven parts in the fixed order, as a story.
export const storyOf = (s: SevenPart): Story => ({
  brand: s.brand,
  content: s.content,
  shape: "classic",
  parts: [
    { role: "hook", ...s.hook },
    { role: "trio", ...s.trio },
    { role: "reveal", ...s.reveal },
    { role: "pay", ...s.pay },
    { role: "growth", ...s.growth },
    { role: "nomore", ...s.nomore },
    { role: "cta", ...s.cta },
  ],
});
// A story's shape in words ("reveal-pay-pay-cta").
export const shapeOf = (s: Story) => s.parts.map((p) => p.role).join("-");

export function buildStory(s: Story, words: Word[], variant = 0): Built {
  const problems: string[] = [];
  if (!words.length) return { plan: null, problems: ["the voice has no words"] };
  if (s.parts.length < 2) return { plan: null, problems: [`the story has ${s.parts.length} part(s); it needs at least 2`] };
  const frame = (i: number) => Math.round(words[i].start * FPS);
  const find = (phrase: string, after: number): number[] | null => {
    if (!phrase || !phrase.split(/\s+/).some((t) => norm(t))) return null;
    try {
      return findPhrase(words, phrase, Math.max(0, after / FPS - 0.02));
    } catch {
      return null;
    }
  };
  const need = (phrase: string, after: number, what: string): number[] | null => {
    const hit = find(phrase, after);
    if (!hit) problems.push(`${what}: "${phrase}" is not in the narration (after ${(after / FPS).toFixed(1)} s)`);
    return hit;
  };
  const kw = (phrase: string, idx: number[] | null, key: string[], strikeNext = false): KWord[] => {
    if (!idx) return [];
    const out = phrase.split(/\s+/).filter((t) => norm(t)).map((t, n) => ({ t, at: frame(idx[n]) - 2, key: key.some((k) => norm(k) === norm(t)) }) as KWord);
    for (const k of key) if (k && !out.some((w) => norm(w.t) === norm(k))) problems.push(`keyword "${k}" is not in "${phrase}"`);
    if (strikeNext) out.forEach((w, n) => w.key && out[n + 1] && (w.strike = out[n + 1].at + 2));
    return out;
  };
  const cue = (phrase: string, after: number, fallback: number) => {
    const hit = find(phrase, after);
    return hit ? frame(hit[0]) : fallback;
  };

  // each part: where its words begin, and what its scene draws (cues need its end, so later)
  type Found = { start: number; lead: number; make: (from: number, to: number) => Pick<Scene, "cues" | "data"> };
  const found: Found[] = [];
  let after = 0;
  const firstTrio = s.parts.find((p) => p.role === "trio") as Extract<StoryPart, { role: "trio" }> | undefined;
  s.parts.forEach((p, n) => {
    const what = `part ${n + 1} (${p.role})`;
    const from0 = n ? after + 1 : 0;
    let f: Found | null = null;
    if (p.role === "hook") {
      const i = need(p.text, from0, what);
      if (i) f = { start: frame(i[0]), lead: LEAD, make: () => ({ cues: {}, data: { words: kw(p.text, i, [p.key]), big: p.big ?? null } }) };
    } else if (p.role === "trio") {
      const i = need(p.text, from0, what);
      if (p.items.length !== 3) problems.push(`${what}: ${p.items.length} items, needs 3`);
      if (i) {
        const st = frame(i[0]);
        f = { start: st, lead: LEAD, make: (from, to) => ({ cues: {}, data: { items: p.items.map((it, k) => ({ ...it, at: cue(it.label, st, from + LEAD + Math.round(((to - from) * k) / 3)) - 2 })) } }) };
      }
    } else if (p.role === "reveal") {
      const subI = need(p.sub, from0, what);
      const nameI = find(p.name, from0);
      const st = Math.min(nameI ? frame(nameI[0]) : Infinity, subI ? frame(subI[0]) : Infinity);
      if (Number.isFinite(st)) f = { start: st, lead: LEAD + 4, make: () => ({ cues: { name: st }, data: { icons: (firstTrio?.items ?? []).map((x) => x.icon), sub: kw(p.sub, subI, [p.key]) } }) };
    } else if (p.role === "pay" || p.role === "growth") {
      const eyeI = p.eyebrow ? find(p.eyebrow, from0) : null;
      if (p.eyebrow && !eyeI) problems.push(`${what} eyebrow: "${p.eyebrow}" is not in the narration`);
      const titleI = need(p.title, from0, what);
      if (titleI) {
        const st = eyeI ? frame(eyeI[0]) : frame(titleI[0]);
        const last = frame(titleI[titleI.length - 1]);
        f = p.role === "pay"
          ? { start: st, lead: LEAD, make: () => ({ cues: { pay: cue(p.pay, st, st + 10), rev: cue(p.rev, st, frame(titleI[0])), inst: cue(p.inst, st, last) }, data: { eyebrow: p.eyebrow, title: kw(p.title, titleI, [p.key]) } }) }
          : { start: st, lead: LEAD, make: () => ({ cues: { grow: cue(p.grow, st, st + 10), team: cue(p.team, st, frame(titleI[Math.min(1, titleI.length - 1)])), zoom: cue(p.zoom, st, last) }, data: { eyebrow: p.eyebrow, title: kw(p.title, titleI, [p.key]) } }) };
      }
    } else if (p.role === "nomore") {
      const aI = need(p.a, from0, `${what} a`);
      const bI = aI ? need(p.b, frame(aI[0]) + 1, `${what} b`) : null;
      if (aI && bI) f = { start: frame(aI[0]), lead: LEAD, make: () => ({ cues: {}, data: { a: kw(p.a, aI, [p.aKey], true), b: kw(p.b, bI, [p.bKey], true) } }) };
      if (aI && bI) after = frame(bI[0]);
    } else {
      const i = need(p.tagline, from0, what);
      if (i) f = { start: frame(i[0]), lead: LEAD, make: () => ({ cues: { click: Math.round(words[words.length - 1].end * FPS) + 20 }, data: { tagline: kw(p.tagline, i, [p.key]) } }) };
    }
    if (f) {
      found.push(f);
      if (p.role !== "nomore") after = f.start;
    }
  });
  if (problems.length) return { plan: null, problems };

  const end = Math.round(words[words.length - 1].end * FPS);
  const duration = end + 66;
  const cuts = found.map((f, n) => (n ? f.start - f.lead : 0));
  [...cuts, duration].slice(1).forEach((v, k) => v - cuts[k] < MIN_SCENE && problems.push(`part ${k + 1} lasts ${v - cuts[k]} frames (needs ${MIN_SCENE})`));
  if (problems.length) return { plan: null, problems };
  const scenes: Scene[] = found.map((f, n) => {
    const from = cuts[n];
    const to = cuts[n + 1] ?? duration;
    const role = s.parts[n].role;
    return { template: role, act: ACT[role], from, to, ...f.make(from, to) };
  });
  // keywords of the scene data are checked when made
  if (problems.length) return { plan: null, problems };
  return { plan: { duration, variant: FLOWLY_VARIANTS[variant % FLOWLY_VARIANTS.length], brand: s.brand, words, scenes, content: s.content ?? DEFAULT_CONTENT }, problems };
}
