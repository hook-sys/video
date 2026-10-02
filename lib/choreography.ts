import { z } from "zod";

// Motion choreography: an event's lifecycle as phases —
//   anticipation → action → impact → settle
// Every phase is optional: a simple entrance is action + settle, a strong
// reveal all four, a subtle ui motion action + settle. The Director may give
// phase lengths in seconds (null = the engine's own timing); they are
// normalized here into whole frames, validated and clamped, so the compiler
// schedules the same keyframes for the same input every time.

export const FPS = 30;

// Sound on the event (Phase 2): an SFX cue fires on one of its phases —
// impact is the primary trigger; a subtle whoosh on anticipation, a movement
// sound on the action, a soft one on the settle. Optional, never required.
// Kinds are the existing local SFX (components/video/sfx.tsx, public/sfx/);
// the sound plays at its own length, not the phase's.
export const CHOREO_PHASES = ["anticipation", "action", "impact", "settle"] as const;
export type ChoreoPhase = (typeof CHOREO_PHASES)[number];
export const CHOREO_SFX_KINDS = ["whoosh", "soft_pop", "click", "reveal", "success_chime", "subtle_impact"] as const;
export type ChoreoSfxKind = (typeof CHOREO_SFX_KINDS)[number];
// Loose on input (strings), validated when normalized: an unknown phase falls
// back to impact, an unknown kind is dropped.
export const ChoreoSfxCue = z.object({ phase: z.string(), kind: z.string() });

// Camera response (Phase 3): the camera answers the event on its phases —
// a subtle preparation on the anticipation, the move itself on the action,
// a very small extra push on the impact, the return on the settle. Optional;
// sizes are fixed per response and intensity (CAMERA_RESPONSE), never free.
export const CAMERA_RESPONSES = ["push", "pull", "pan", "orbit", "rise", "fall"] as const;
export type CameraResponse = (typeof CAMERA_RESPONSES)[number];
export const CAMERA_INTENSITIES = ["low", "medium", "high"] as const;
export type CameraIntensity = (typeof CAMERA_INTENSITIES)[number];
// Loose on input, validated when normalized: an unknown response means no
// camera response, an unknown intensity medium.
export const ChoreoCameraCue = z.object({ response: z.string(), intensity: z.string().nullable() });

// What the Director may write per behavior (seconds; null = default).
export const Choreography = z.object({
  anticipation: z.number().nullable(),
  action: z.number().nullable(),
  impact: z.number().nullable(),
  settle: z.number().nullable(),
  sfx: z.array(ChoreoSfxCue).nullable().optional(),
  camera: ChoreoCameraCue.nullable().optional(),
});
// The Director's strict output: every key present (a missing sfx reads as null).
export const ModelChoreography = Choreography.extend({ sfx: z.array(ChoreoSfxCue).nullable().default(null), camera: ChoreoCameraCue.nullable().default(null) });
export type Choreography = z.infer<typeof Choreography>;

// Normalized phase lengths in frames (stored on the event's beat).
// sfx: the validated cues (present only when there are some).
export const ChoreoFrames = z.object({
  anticipation: z.number().int(),
  action: z.number().int(),
  impact: z.number().int(),
  settle: z.number().int(),
  sfx: z.array(z.object({ phase: z.enum(CHOREO_PHASES), kind: z.enum(CHOREO_SFX_KINDS) })).optional(),
  // camera: the validated response (present only when there is one).
  camera: z.object({ response: z.enum(CAMERA_RESPONSES), intensity: z.enum(CAMERA_INTENSITIES) }).optional(),
});
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
  const out: ChoreoFrames = { anticipation, action, impact, settle };
  const sfx = normalizeSfx(c?.sfx);
  if (sfx.length) out.sfx = sfx;
  const camera = normalizeCamera(c?.camera);
  if (camera) out.camera = camera;
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

// At most this many cues per event, one per phase (the first wins).
export const MAX_SFX_PER_EVENT = 2;
export function normalizeSfx(cues: { phase?: unknown; kind?: unknown }[] | null | undefined): NonNullable<ChoreoFrames["sfx"]> {
  const out: NonNullable<ChoreoFrames["sfx"]> = [];
  for (const c of cues ?? []) {
    if (out.length >= MAX_SFX_PER_EVENT) break;
    const kind = CHOREO_SFX_KINDS.find((k) => k === c?.kind);
    if (!kind) continue;
    const phase = CHOREO_PHASES.find((p) => p === c?.phase) ?? "impact";
    if (out.some((x) => x.phase === phase)) continue;
    out.push({ phase, kind });
  }
  return out;
}

export function normalizeCamera(c: { response?: unknown; intensity?: unknown } | null | undefined): ChoreoFrames["camera"] | null {
  const response = CAMERA_RESPONSES.find((r) => r === c?.response);
  if (!response) return null;
  return { response, intensity: CAMERA_INTENSITIES.find((i) => i === c?.intensity) ?? "medium" };
}

// The camera's answer, as offsets from the scene's own camera at the
// event's phase boundaries (world px for the centre, a factor for the zoom).
// `toward`: the event's subject relative to the camera centre — a push and a
// pan go toward it, an orbit arcs around it. Small by design: the zoom stays
// within ±10 %, a shift within 120 px, no shake.
const INTENSITY_K: Record<CameraIntensity, number> = { low: 0.5, medium: 1, high: 1.5 };
export type CameraOffset = { center: [number, number]; zoom: number };
export function cameraOffsets(cam: NonNullable<ChoreoFrames["camera"]>, toward: [number, number]): { anticipation: CameraOffset; action: CameraOffset; impact: CameraOffset } {
  const k = INTENSITY_K[cam.intensity];
  const cap = (v: number) => Math.max(-120, Math.min(120, v));
  const dir = Math.sign(toward[0]) || 1;
  const act: CameraOffset =
    cam.response === "push" ? { center: [cap(toward[0] * 0.1 * k), cap(toward[1] * 0.1 * k)], zoom: 1 + 0.06 * k }
    : cam.response === "pull" ? { center: [0, 0], zoom: 1 - 0.06 * k }
    : cam.response === "pan" ? { center: [cap(dir * 60 * k), 0], zoom: 1 }
    : cam.response === "orbit" ? { center: [cap(dir * 45 * k), -12 * k], zoom: 1 + 0.02 * k }
    : cam.response === "rise" ? { center: [0, cap(-50 * k)], zoom: 1 }
    : { center: [0, cap(50 * k)], zoom: 1 };
  // the preparation: a small move the other way; the impact: a touch further in
  const anticipation: CameraOffset = { center: [-act.center[0] * 0.15, -act.center[1] * 0.15], zoom: 1 - (act.zoom - 1) * 0.15 };
  const impact: CameraOffset = { center: act.center, zoom: Math.min(1.1, act.zoom * (1 + 0.015 * k)) };
  return { anticipation, action: act, impact };
}
// Without a settle the camera still comes back, over this many frames.
export const CAMERA_RETURN = 12;

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

// The frame a phase's sound starts on: anticipation at the event start,
// action when the motion begins, impact when it lands, settle when the
// impact gives way. A phase of length 0 still has its moment (e.g. a landing
// without an impact pop), so every cue gets a frame.
export function sfxFrame(tl: ChoreoTimeline, phase: ChoreoPhase): number {
  return phase === "anticipation" ? tl.start : phase === "action" ? tl.actionAt : phase === "impact" ? tl.impactAt : tl.settleAt;
}
