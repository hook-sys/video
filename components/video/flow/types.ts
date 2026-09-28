// Flow scene format: one continuous motion-graphics piece built from
// persistent nodes that move, transform and connect under one camera.
// Plain data (frames at 30 fps, world pixels with origin at the frame centre),
// written by pattern builders (patterns.ts) and later by the Visual Director.

export type Ease = "linear" | "out" | "in" | "inOut" | "back" | "snap";
export type Vec = [number, number];
// [frame, value, ease into this key]
export type Key<T> = [number, T, Ease?];
export type Track<T> = Key<T>[];

export type ThemeName = "lavender" | "midnight";

export type FlowNode = {
  id: string;
  kind: "orb" | "pill";
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
};
