import { z } from "zod";

// Motion choreography: an event's lifecycle as phases —
//   anticipation → action → impact → settle
// Every phase is optional: a simple entrance is action + settle, a strong
// reveal all four, a subtle ui motion action + settle. The Director may give
// phase lengths in seconds (null = the engine's own timing); they are
// normalized here into whole frames, validated and clamped, so the compiler
// schedules the same keyframes for the same input every time.

export const FPS = 30;

// What the Director may write per behavior (seconds; null = default).
export const Choreography = z.object({
  anticipation: z.number().nullable(),
  action: z.number().nullable(),
  impact: z.number().nullable(),
  settle: z.number().nullable(),
});
export type Choreography = z.infer<typeof Choreography>;

// Normalized phase lengths in frames (stored on the event's beat).
export const ChoreoFrames = z.object({ anticipation: z.number().int(), action: z.number().int(), impact: z.number().int(), settle: z.number().int() });
export type ChoreoFrames = z.infer<typeof ChoreoFrames>;

// Bounds per phase (frames). A phase is either 0 (absent) or within its
// bounds; the action always runs. Shorter than the minimum reads as a glitch,
// longer than the maximum as a stall.
export const PHASE_BOUNDS = {
  anticipation: [4, 18],
  action: [6, 60],
  impact: [3, 12],
  settle: [4, 30],
} as const;
// The whole event never runs longer than this (the action keeps its minimum).
export const MAX_TOTAL = 96;

const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

// Seconds (or null) → frames, with safe defaults:
// - missing / negative / not a number → the default (action: the event's own
//   length; anticipation and impact: none; settle: 10 frames after an impact,
//   else none);
// - a present optional phase shorter than its minimum is raised to it, a
//   longer one cut to its maximum; 0 means absent;
// - a total over MAX_TOTAL is scaled down (whole frames, action first kept).
export function normalizeChoreography(c: Partial<Choreography> | null | undefined, actionDefault: number): ChoreoFrames {
  const frames = (v: number | null | undefined) => (valid(v) ? Math.round(v * FPS) : null);
  const opt = (v: number | null, bounds: readonly [number, number]) => (v === null || v === 0 ? 0 : clamp(v, bounds));
  const action = clamp(frames(c?.action) ?? actionDefault, PHASE_BOUNDS.action);
  const anticipation = opt(frames(c?.anticipation), PHASE_BOUNDS.anticipation);
  const impact = opt(frames(c?.impact), PHASE_BOUNDS.impact);
  const settleIn = frames(c?.settle);
  const settle = settleIn === null ? (impact ? 10 : 0) : opt(settleIn, PHASE_BOUNDS.settle);
  const out = { anticipation, action, impact, settle };
  const total = anticipation + action + impact + settle;
  if (total <= MAX_TOTAL) return out;
  // Too long: shrink the optional phases first, then the action, never below
  // their minimums (or to 0 when a phase cannot fit at its minimum).
  let over = total - MAX_TOTAL;
  for (const k of ["settle", "anticipation", "impact", "action"] as const) {
    if (!over || !out[k]) continue;
    const min = PHASE_BOUNDS[k][0];
    const cut = Math.min(over, out[k] - min);
    out[k] -= cut;
    over -= cut;
  }
  for (const k of ["settle", "anticipation", "impact"] as const) {
    if (!over || !out[k]) continue;
    over = Math.max(0, over - out[k]);
    out[k] = 0;
  }
  return out;
}

// The event on the timeline, from its start frame.
export type ChoreoTimeline = ChoreoFrames & {
  start: number;
  actionAt: number; // anticipation ends, the action begins
  impactAt: number; // the action lands
  settleAt: number; // the impact gives way
  end: number;
  total: number;
};
export function choreoTimeline(c: ChoreoFrames, start: number): ChoreoTimeline {
  const actionAt = start + c.anticipation;
  const impactAt = actionAt + c.action;
  const settleAt = impactAt + c.impact;
  const end = settleAt + c.settle;
  return { ...c, start, actionAt, impactAt, settleAt, end, total: end - start };
}
