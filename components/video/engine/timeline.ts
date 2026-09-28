import { Easing } from "remotion";
import { build, converge, enter, lerp, ramp, settle, smoothPath, snap, type Vec } from "./motion-patterns";
import type { AreaKind, ObjectKind, Verb } from "./story";

// RenderTimeline: what the compiler produces and the renderer plays. Plain,
// JSON-serializable data; every value at any frame comes from `evaluate*`, so
// rendering (and the frame checks) are deterministic.

export type Pose = { x: number; y: number; rot: number; scale: number; opacity: number };
export type Pattern = "enter" | "snap" | "arrive" | "converge" | "exit" | "hold";

// A motion key: from `frame`, move toward `pose` using `pattern`.
export type MotionKey = { frame: number; pose: Pose; pattern: Pattern; dur: number; lift?: number; from?: Pose; verb?: Verb };
// A state key: from `frame`, field eases to `to` over `dur` frames.
export type StateKey = { frame: number; field: StateField; to: number; dur: number; spring?: boolean };
export type StateField = "morph" | "check" | "pulse" | "build" | "value" | "typed" | "calm";

export type ObjectTrack = {
  id: string;
  kind: ObjectKind;
  group?: string;
  content: { title?: string; tag?: string; meta?: string };
  z: number;
  born: number; // first frame it exists
  motion: MotionKey[];
  state: StateKey[];
  impulses: { frame: number; amp: number }[]; // "settle" jolts
  container?: string; // id of the container it ends up in
  attachedAt?: number; // frame it joined that container (loose before this)
  tint: string;
};

export type AreaTrack = {
  id: string;
  kind: AreaKind;
  mood: string;
  rect: { x: number; y: number; w: number; h: number }; // centre + size, world px
  enter: number; // frame the story arrives
  lit: number; // frame the area starts to light up (something happens there)
  leave: number; // frame the story moves on (or end)
  from?: Vec; // convergence corridor start
  to?: Vec; // convergence corridor end
  colocated?: boolean; // lighting state on another area's place
};

export type CameraKey = { t: number; x: number; y: number; z: number; shot?: string; subject?: string };
export type TextCue = { frame: number; content: string; role: "closing" | "support"; line: number };
export type SfxCue = { frame: number; kind: string; src: string };
// A compiled moment: when its cue is spoken, and when its first visible action
// and sound start (for timing checks).
export type MomentMark = { frame: number; end: number; cue: string; intent: string; area: string; subject: string; shot: string; action: number | null; sfx: number | null; matched: boolean };

export type RenderTimeline = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  areas: AreaTrack[];
  lighting: { frame: number; color: string }[];
  objects: ObjectTrack[];
  camera: CameraKey[];
  text: TextCue[];
  textTone: "dark" | "light";
  sfx: SfxCue[];
  moments: MomentMark[];
  issues: string[];
};

const HIDDEN: Pose = { x: 0, y: 0, rot: 0, scale: 1, opacity: 0 };

function progress(key: MotionKey, frame: number) {
  switch (key.pattern) {
    case "enter":
      return enter(frame, key.frame);
    case "snap":
      return snap(frame, key.frame);
    case "arrive":
      return build(frame, key.frame);
    case "exit":
      return ramp(frame, key.frame, key.dur, Easing.in(Easing.cubic));
    case "converge":
      return ramp(frame, key.frame, key.dur, Easing.bezier(0.55, 0, 0.2, 1));
    default:
      return ramp(frame, key.frame, key.dur);
  }
}

const mixPose = (a: Pose, b: Pose, t: number, opacityT = t): Pose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  rot: lerp(a.rot, b.rot, t),
  scale: lerp(a.scale, b.scale, t),
  opacity: lerp(a.opacity, b.opacity, Math.min(1, Math.max(0, opacityT))),
});

// Pose at a frame: keys chain (each springs from wherever the previous left
// the object), converge keys travel an arc from where the object was.
export function evaluatePose(track: ObjectTrack, frame: number): Pose & { lift: number } {
  if (!track.motion.length || frame < track.born) return { ...HIDDEN, lift: 0 };
  let pose: Pose = track.motion[0].pose;
  let lift = 0;
  for (const key of track.motion.slice(1)) {
    if (frame < key.frame) break;
    const t = progress(key, frame);
    if (key.pattern === "converge" && key.from) {
      const c = converge(frame, key.frame, key.dur, key.from, key.pose, key.lift ?? 0);
      pose = { ...mixPose(key.from, key.pose, c.t), x: c.pos.x, y: c.pos.y };
      lift = Math.max(lift, Math.sin(Math.PI * c.t));
    } else {
      const entering = key.pattern === "enter" && pose.opacity === 0;
      pose = mixPose(pose, key.pose, t, entering ? (frame - key.frame + 1) / 4 : key.pattern === "exit" ? t : Math.min(1, t * 1.4));
      if (key.verb === "move" || key.verb === "complete") lift = Math.max(lift, Math.sin(Math.PI * Math.min(1, t)) * 0.6);
    }
  }
  let dx = 0;
  let dy = 0;
  let drot = 0;
  for (const imp of track.impulses) {
    drot += settle(frame, imp.frame, imp.amp * 0.4);
    dx += settle(frame, imp.frame + 1, imp.amp * 0.8);
    dy += settle(frame, imp.frame, imp.amp);
  }
  return { ...pose, x: pose.x + dx, y: pose.y + dy, rot: pose.rot + drot, scale: pose.scale + lift * 0.04, lift };
}

export type ObjectState = Record<StateField, number>;
const ZERO: ObjectState = { morph: 0, check: 0, pulse: 0, build: 0, value: 0, typed: 0, calm: 0 };

export function evaluateState(track: ObjectTrack, frame: number): ObjectState {
  const s = { ...ZERO };
  for (const k of track.state) {
    if (frame < k.frame) continue;
    const t = k.spring ? snap(frame, k.frame) : ramp(frame, k.frame, k.dur);
    s[k.field] = lerp(s[k.field], k.to, t);
  }
  return s;
}

export function evaluateCamera(keys: CameraKey[], frame: number, fps: number) {
  const [x, y, z] = smoothPath(keys.map((k) => ({ t: k.t, v: [k.x, k.y, k.z] })), frame / fps);
  return { x, y, z };
}

// "Loose" at a frame: a free item/app that has appeared and isn't in a container yet.
export const looseAt = (t: ObjectTrack, frame: number) =>
  t.born <= frame && (t.attachedAt === undefined || t.attachedAt > frame) && !["workspace", "progress_panel", "metric", "input_field", "cursor", "hero_mark"].includes(t.kind);

export const worldToScreen = (p: Vec, cam: { x: number; y: number; z: number }, width: number, height: number): Vec => ({
  x: width / 2 + (p.x - cam.x) * cam.z,
  y: height / 2 + (p.y - cam.y) * cam.z,
});
