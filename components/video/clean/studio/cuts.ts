import type { CleanPlan, Scene } from "../types";
import { type Beats, beatsFromPlan, type Moments } from "../refs/beats";
import { type Role, ROLES } from "./looks";

// Where a part begins (frames): just before its first word.
const cutAt = (role: Role, T: Moments) =>
  ({ hook: T.every, trio: T.sales - 6, reveal: T.flowly - 10, pay: T.when1 - 6, growth: T.when2 - 6, nomore: T.no1 - 6, cta: T.just - 6, end: T.end + 6 })[role];

// The seven parts in their fixed order (the reference films' timing).
export function partCuts(T: Moments): { role: Role; from: number }[] {
  return ROLES.map((role) => ({ role, from: role === "hook" ? 0 : cutAt(role, T) }));
}

// A story shape: the plan's parts in the order spoken — any of the seven, left
// out or more than once — each with the moments of its own words, then the end
// card. A part is at least MIN frames.
export type StoryPart = { role: Role; from: number; b: Beats; scene?: Scene };
const MIN = 16;
type Part = Scene["template"];
const MOMENTS: Record<Part, (keyof Moments)[]> = {
  hook: ["every", "data", "scattered", "tools"],
  trio: ["sales", "payments", "reports"],
  reveal: ["flowly", "brings", "everything", "into", "live", "dashboard"],
  pay: ["when1", "payment", "revenue", "updates", "instantly"],
  growth: ["when2", "grow", "entire", "team", "change", "view"],
  nomore: ["no1", "switching", "between", "no2", "waiting", "reports2"],
  cta: ["just", "live2", "every2", "answer", "need"],
};
const LINES: Record<Part, (keyof Beats["line"])[]> = {
  hook: ["hook", "hookA", "hookBig", "hookB", "hookTail"],
  trio: ["trio"],
  reveal: ["reveal", "revealA", "revealB"],
  pay: ["payA", "payB"],
  growth: ["growA", "growB", "growB1", "growB2"],
  nomore: ["noA", "noA1", "noA2", "noB", "noB1", "noB2"],
  cta: ["cta", "ctaA", "ctaB"],
};
// One part's beats: its own moments and words; another part, its next time
// after this one (else its last time before); a part not in the story, this part's end.
// (With each part once, in the fixed order, this is the whole plan's beats.)
function partBeats(plan: CleanPlan, scenes: Scene[], i: number, whole: Beats): Beats {
  const scene = scenes[i];
  const own = beatsFromPlan(plan, scene);
  const t = { ...own.t };
  for (const role of Object.keys(MOMENTS) as Part[]) {
    if (role === scene.template) continue;
    // spoken later: its next time; else its last time before; else none
    const other = scenes.slice(i + 1).find((s) => s.template === role) ?? scenes.slice(0, i).findLast((s) => s.template === role);
    if (other) {
      const ot = beatsFromPlan(plan, other).t;
      for (const k of MOMENTS[role]) t[k] = ot[k];
    }
  }
  const line = { ...whole.line } as Beats["line"];
  for (const k of LINES[scene.template]) (line as Record<string, unknown>)[k] = own.line[k];
  return { ...whole, t, line, trio: scene.template === "trio" ? own.trio : whole.trio, label: scene.template === "reveal" ? own.label : whole.label };
}
// A part's own moments and words, `d` frames earlier.
function earlier(b: Beats, role: Part, d: number): Beats {
  const t = { ...b.t };
  for (const k of MOMENTS[role]) t[k] -= d;
  const line = { ...b.line } as Record<string, unknown>;
  for (const k of LINES[role]) {
    const v = line[k];
    line[k] = Array.isArray(v) ? v.map((w) => ({ ...w, at: w.at - d, ...(w.strike !== undefined ? { strike: w.strike - d } : {}) })) : v && typeof v === "object" ? { ...(v as { at: number }), at: (v as { at: number }).at - d } : v;
  }
  return { ...b, t, line: line as Beats["line"], trio: role === "trio" ? b.trio.map((x) => ({ ...x, at: x.at - d })) : b.trio };
}
// A story that opens on anything but the hook: its first part's things come
// in this much earlier, so the opening frames are not the background alone
// (the hook blocks show from the first frame; the others rise on their words).
const OPEN_LEAD = 12;

export function storyParts(plan: CleanPlan): StoryPart[] {
  const whole = beatsFromPlan(plan);
  const scenes = [...plan.scenes].sort((a, z) => a.from - z.from);
  const out: StoryPart[] = scenes.map((scene, i) => {
    const own = partBeats(plan, scenes, i, whole);
    // a feature with no lead-in words ("When …,") would show its first stage
    // (a spark, an empty card) alone: its things come in as the part begins
    const bare = (scene.template === "pay" && !own.line.payA.length) || (scene.template === "growth" && !own.line.growA.length);
    const b = (i === 0 && scene.template !== "hook") || bare ? earlier(own, scene.template, OPEN_LEAD) : own;
    return { role: scene.template, from: i === 0 ? 0 : cutAt(scene.template, b.t), b, scene };
  });
  for (let i = 1; i < out.length; i++) out[i].from = Math.max(out[i].from, out[i - 1].from + MIN);
  out.push({ role: "end", from: Math.max(whole.t.end + 6, (out.at(-1)?.from ?? 0) + MIN), b: whole });
  return out;
}
