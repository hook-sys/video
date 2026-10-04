import { DEFAULT_CONTENT, type FilmContent } from "../content";
import type { KWord } from "../text";
import type { Brand, CleanPlan, Scene } from "../types";
import { FPS } from "../types";
import { findPhrase, norm } from "../words";

// What the four film templates (Glow, Dusk, Fly, Connect) need from a plan:
// the voice's moments by role, the spoken lines split the way the films show
// them, the three things of the problem and the brand. Built from any
// seven-part CleanPlan (hook, trio, reveal, pay, growth, nomore, cta), so the
// films are templates, not one script.

export type Moments = {
  every: number; data: number; scattered: number; tools: number;
  sales: number; payments: number; reports: number;
  flowly: number; brings: number; everything: number; into: number; live: number; dashboard: number;
  when1: number; payment: number; revenue: number; updates: number; instantly: number;
  when2: number; grow: number; entire: number; team: number; change: number; view: number;
  no1: number; switching: number; between: number; no2: number; waiting: number; reports2: number;
  just: number; live2: number; every2: number; answer: number; need: number;
  end: number; duration: number;
};

export type Lines = {
  hook: KWord[]; hookA: KWord[]; hookBig: KWord; hookB: KWord[]; hookTail: KWord[];
  trio: KWord[];
  reveal: KWord[]; revealA: KWord[]; revealB: KWord[];
  payA: KWord[]; payB: KWord[];
  growA: KWord[]; growB: KWord[]; growB1: KWord[]; growB2: KWord[];
  noA: KWord[]; noA1: KWord[]; noA2: KWord[]; noB: KWord[]; noB1: KWord[]; noB2: KWord[];
  cta: KWord[]; ctaA: KWord[]; ctaB: KWord[];
};

export type Thing = { label: string; sub: string; icon: string; at: number };
// `label`: the product in a few words for a pill ("One live dashboard"):
// the last three words of the reveal line.
export type Beats = { t: Moments; line: Lines; trio: Thing[]; brand: Brand; label: string; content: FilmContent };

// The spoken frame of a word (KWord.at is 2 frames before it).
const said = (w: KWord) => w.at + 2;
const SMALL = new Set(["a", "an", "the", "in", "on", "of", "to", "for", "with", "and", "or", "your", "our", "my", "their", "its", "at", "by", "from", "is", "are", "still"]);
const plain = (ws: KWord[]) => ws.map((w) => ({ ...w, key: false, strike: undefined }));
// The same words with one keyword (index; negative from the end).
export const keyAt = (ws: KWord[], i: number) => ws.map((w, k) => ({ ...w, key: k === (i < 0 ? ws.length + i : i) }));
// The keyword struck through when the next word is said.
export const strikeKey = (ws: KWord[]) => ws.map((w, k) => (w.key && ws[k + 1] ? { ...w, key: false, strike: ws[k + 1].at + 2 } : w));

function words(sc: Scene | undefined, k: string): KWord[] {
  const v = sc?.data[k];
  return Array.isArray(v) ? (v as KWord[]) : [];
}

// A phrase of the voice (spoken after `after` frames) as kinetic words.
function timed(plan: CleanPlan, phrase: string, after: number): KWord[] {
  if (!phrase.trim()) return [];
  const idx = findPhrase(plan.words, phrase, Math.max(0, after / FPS - 0.5));
  return phrase.split(/\s+/).filter((t) => norm(t)).map((t, n) => ({ t, at: Math.round(plan.words[idx[n]].start * FPS) - 2 }));
}

// The voice's words between two frames (stops joined to the word before).
function span(plan: CleanPlan, from: number, to: number): KWord[] {
  const out: KWord[] = [];
  for (const w of plan.words) {
    const fr = Math.round(w.start * FPS);
    if (fr < from || fr >= to) continue;
    if (!norm(w.text)) {
      if (out.length) out[out.length - 1] = { ...out[out.length - 1], t: out[out.length - 1].t + w.text.trim() };
      continue;
    }
    out.push({ t: w.text, at: fr - 2 });
  }
  return out;
}

const pick = (ws: KWord[], i: number, fallback: number) => (ws.length ? said(ws[Math.max(0, Math.min(ws.length - 1, i < 0 ? ws.length + i : i))]) : fallback);
const halves = (ws: KWord[], n = Math.floor(ws.length / 2)) => [ws.slice(0, n), ws.slice(n)] as const;
const keyIndex = (ws: KWord[], fallback: number) => {
  const i = ws.findIndex((w) => w.key);
  return i >= 0 ? i : fallback < 0 ? ws.length + fallback : fallback;
};

// The moments each part's words fall on. `only`: one part of a plan whose
// parts come in any order, may be left out or come twice (a story shape):
// its own moments are read from it, and every other part's are its end, as
// if the next part followed it (what its blocks expect).
export function beatsFromPlan(plan: CleanPlan, only?: Scene): Beats {
  const by = (t: Scene["template"]) => (only ? (only.template === t ? only : undefined) : plan.scenes.find((s) => s.template === t));
  const hookS = by("hook"), trioS = by("trio"), revealS = by("reveal"), payS = by("pay"), growS = by("growth"), noS = by("nomore"), ctaS = by("cta");
  const end = plan.words.length ? Math.round(plan.words[plan.words.length - 1].end * FPS) : plan.duration - 66;
  const rest = only ? only.to : 0;

  // hook: "<A> <big> <key…>" — the big word is the one before the keyword
  // ("data scattered"), or the one after it when that is a small word
  // ("in messy spreadsheets" → "spreadsheets"); a plan may name it (data.big).
  const hook = words(hookS, "words");
  const hk = Math.max(1, keyIndex(hook, Math.floor(hook.length / 2)));
  const named = typeof hookS?.data.big === "string" ? hook.findIndex((w) => norm(w.t) === norm(String(hookS.data.big))) : -1;
  const bi = named >= 0 ? named : SMALL.has(norm(hook[hk - 1]?.t ?? "")) && hk + 1 < hook.length ? hk + 1 : hk - 1;
  const hookA = plain(hook.slice(0, Math.min(bi, hk)));
  const hookBig = hook[bi] ? { ...hook[bi], key: false, t: hook[bi].t.replace(/[.,!?]+$/, "") } : { t: "", at: rest - 2, key: false };
  const hookB = hook.slice(Math.min(bi, hk)).filter((_, n) => n + Math.min(bi, hk) !== bi);

  const items = (trioS?.data.items ?? []) as { icon: string; label: string; sub: string; at: number }[];
  const trio = items.map((it) => ({ label: it.label, sub: it.sub, icon: it.icon, at: it.at + 2 }));

  const reveal = words(revealS, "sub");
  const [revealA, revealB] = halves(reveal, Math.min(2, Math.max(1, reveal.length - 1)));

  const payA = timed(plan, String(payS?.data.eyebrow ?? ""), payS?.from ?? 0);
  const payB = words(payS, "title");
  const growA = timed(plan, String(growS?.data.eyebrow ?? ""), growS?.from ?? 0);
  const growB = words(growS, "title");
  const [growB1, growB2] = halves(growB);

  const unstrike = (ws: KWord[]) => ws.map((w) => ({ ...w, strike: undefined }));
  const noA = unstrike(words(noS, "a")), noB = unstrike(words(noS, "b"));
  const ka = keyIndex(noA, 2) + 1, kb = keyIndex(noB, 2) + 1;
  const cta = words(ctaS, "tagline");
  const [ctaA, ctaB] = halves(cta);

  const pc = payS?.cues ?? {}, gc = growS?.cues ?? {};
  const t: Moments = {
    every: hookS?.from ?? 0,
    data: said(hookBig),
    scattered: pick(hook, hk, 0),
    tools: pick(hook, -2, 0),
    sales: trio[0]?.at ?? trioS?.from ?? 0,
    payments: trio[1]?.at ?? trioS?.from ?? 0,
    reports: trio[2]?.at ?? trioS?.from ?? 0,
    flowly: revealS?.cues.name ?? revealS?.from ?? 0,
    brings: pick(reveal, 0, revealS?.from ?? 0),
    everything: pick(reveal, 1, revealS?.from ?? 0),
    into: pick(reveal, 2, revealS?.from ?? 0),
    live: pick(reveal, -2, revealS?.from ?? 0),
    dashboard: pick(reveal, -1, revealS?.from ?? 0),
    when1: pick(payA, 0, payS?.from ?? 0),
    payment: pc.pay ?? pick(payA, -1, 0),
    revenue: pc.rev ?? pick(payB, 0, 0),
    updates: pick(payB, 1, pc.rev ?? 0),
    instantly: pc.inst ?? pick(payB, -1, 0),
    when2: pick(growA, 0, growS?.from ?? 0),
    grow: gc.grow ?? pick(growA, -1, 0),
    entire: gc.team ?? pick(growB, 1, 0),
    team: pick(growB, 2, gc.team ?? 0),
    change: pick(growB2, 1, pick(growB, -1, 0)),
    view: pick(growB, -1, 0),
    no1: pick(noA, 0, noS?.from ?? 0),
    switching: pick(noA, ka - 1, 0),
    between: pick(noA, ka, 0),
    no2: pick(noB, 0, 0),
    waiting: pick(noB, kb - 1, 0),
    reports2: pick(noB, kb, 0),
    just: pick(cta, 0, ctaS?.from ?? 0),
    live2: pick(ctaA, -2, 0),
    every2: pick(ctaB, Math.max(0, keyIndex(ctaB, -2) - 1), 0),
    answer: pick(ctaB, keyIndex(ctaB, -2), 0),
    need: pick(cta, -1, 0),
    end,
    duration: plan.duration,
  };
  // the parts this plan (or this one part) has not: their moments are its end
  if (only) {
    const ROLE_MOMENTS: [Scene | undefined, (keyof Moments)[]][] = [
      [hookS, ["every", "data", "scattered", "tools"]],
      [trioS, ["sales", "payments", "reports"]],
      [revealS, ["flowly", "brings", "everything", "into", "live", "dashboard"]],
      [payS, ["when1", "payment", "revenue", "updates", "instantly"]],
      [growS, ["when2", "grow", "entire", "team", "change", "view"]],
      [noS, ["no1", "switching", "between", "no2", "waiting", "reports2"]],
      [ctaS, ["just", "live2", "every2", "answer", "need"]],
    ];
    for (const [sc, keys] of ROLE_MOMENTS) if (!sc) for (const k of keys) t[k] = rest;
  }

  const line: Lines = {
    hook,
    hookA,
    hookBig,
    hookB,
    hookTail: plain(hook.slice(Math.min(bi, hk))),
    trio: keyAt(span(plan, trioS?.from ?? 0, trioS?.to ?? 0), -1).map((w) => ({ ...w, key: trio.some((x) => norm(x.label) === norm(w.t)) })),
    reveal,
    revealA: plain(revealA),
    revealB: plain(revealB),
    payA,
    payB,
    growA: keyAt(growA, -1),
    growB,
    growB1,
    growB2,
    noA,
    noA1: plain(noA.slice(0, ka)),
    noA2: plain(noA.slice(ka)),
    noB,
    noB1: plain(noB.slice(0, kb)),
    noB2: plain(noB.slice(kb)),
    cta,
    ctaA: keyAt(ctaA, -2),
    ctaB: keyAt(ctaB, keyIndex(ctaB, -2)),
  };
  const tail = reveal.slice(-3).map((w) => w.t.replace(/[.,!?]+$/, "")).join(" ");
  const label = tail ? tail[0].toUpperCase() + tail.slice(1) : plan.brand.name;
  return { t, line, trio, brand: plan.brand, label, content: plan.content ?? DEFAULT_CONTENT };
}

// Words with no keyword or strike.
export const plainW = (ws: KWord[]) => ws.map((w) => ({ ...w, key: false, strike: undefined }));
