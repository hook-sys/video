// Flow scene format: one continuous motion-graphics piece built from
// persistent nodes that move, transform and connect under one camera.
// Plain data (frames at 30 fps, world pixels with origin at the frame centre),
// written by pattern builders (patterns.ts) and later by the Visual Director.

export type Ease = "linear" | "out" | "in" | "inOut" | "back" | "snap";
export type Vec = [number, number];
export type Vec3 = [number, number, number];
// [frame, value, ease into this key]
export type Key<T> = [number, T, Ease?];
export type Track<T> = Key<T>[];

export type ThemeName = "lavender" | "midnight";

// A product UI shown as a plane in 3D: a screenshot (src) or a procedural mock
// (title + rows). Points on the plane are [u, v] in 0..1.
export type UiRow = { icon: string; text: string; value?: string; status?: string };
export type FlowUi = {
  w: number;
  h: number;
  title: string;
  rows?: UiRow[];
  src?: string;
  tilt: Track<Vec3>; // rotateX, rotateY, rotateZ in degrees
  callouts?: { at: Vec; text: string; icon?: string; side: "left" | "right"; start: number }[];
  lifts?: { row: number; start: number; end?: number }[]; // a row rises off the plane
  cursor?: { path: Track<Vec>; clicks: number[] };
};

// Circular motion around another node between start and end (blends in/out).
export type FlowOrbit = { center: string; radius: Track<number>; angle: number; speed: number; start: number; end?: number };

export type FlowNode = {
  id: string;
  kind: "orb" | "pill" | "ui";
  variant?: "solid" | "soft";
  size: number; // orb diameter / pill height
  icon?: Track<string>; // icon swaps morph (old out, new draws on)
  label?: Track<string>; // orb caption or pill text; "" hides it
  pos: Track<Vec>;
  scale?: Track<number>;
  opacity?: Track<number>;
  ring?: Track<number>; // 0..1 progress ring around an orb
  check?: number; // frame a success badge pops
  pulses?: number[]; // frames a ripple fires
  ui?: FlowUi;
  orbit?: FlowOrbit;
};

export type FlowLink = {
  id: string;
  from: string;
  to: string;
  draw: [number, number]; // frames the line draws from → to
  style?: "solid" | "dashed";
  bend?: number; // perpendicular arc height (px), 0 = straight
  packets?: { icon: string; start: number; end: number }[];
  success?: number; // frame the line turns success colour
  fade?: [number, number]; // frames it fades out
};

export type FlowText = {
  text: string;
  start: number;
  end: number;
  pos: Vec; // screen pixels from the frame centre
  size: number;
  weight?: number;
  accent?: string; // words shown in the accent gradient
};

export type FlowLottie = { name: string; start: number; node?: string; pos?: Vec; size: number };

export type FlowPlan = {
  theme: ThemeName;
  duration: number; // frames
  camera: { center: Track<Vec>; zoom: Track<number> };
  nodes: FlowNode[];
  links: FlowLink[];
  texts: FlowText[];
  lotties: FlowLottie[];
  rings?: { center: string; radius: number; start: number; end?: number }[]; // dashed orbit paths
  // Iris: the member nodes are framed by a circle that closes onto `into`.
  iris?: { start: number; dur: number; members: string[]; into: string }[];
  // Sound effects tied to motion (kinds from components/video/sfx.tsx).
  sfx?: { frame: number; kind: "whoosh" | "soft_pop" | "click" | "reveal" | "success_chime" | "subtle_impact" | "digital_processing" | "typing" }[];
};
