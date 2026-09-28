import type { Ease, FlowLink, FlowNode, FlowPlan, ThemeName, Track, Vec } from "./types";

// Motion patterns: small, reusable moves that write keyframes onto persistent
// nodes. Because every pattern animates the SAME node objects, continuity is
// built in: a node enters once and then moves, morphs and connects until it
// leaves. The Visual Director will compose these; fixtures use them by hand.

function animate<T>(track: Track<T>, t: number, dur: number, value: T, ease: Ease = "inOut") {
  const last = track[track.length - 1];
  if (last[0] < t) track.push([t, last[1]]);
  track.push([t + dur, value, ease]);
}
// Set a value at t (replacing a key at the same frame).
const set = <T,>(track: Track<T>, t: number, value: T) => {
  const last = track[track.length - 1];
  if (last[0] === t) last[1] = value;
  else track.push([t, value]);
};

export class FlowNodeHandle {
  constructor(readonly spec: FlowNode) {}
  get id() {
    return this.spec.id;
  }
  private get pos() {
    return this.spec.pos;
  }
  private scaleTrack() {
    return (this.spec.scale ??= [[0, 0]]);
  }
  private opacityTrack() {
    return (this.spec.opacity ??= [[0, 1]]);
  }
  // Pop in (optionally sliding from an offset).
  enter(t: number, { dur = 16, from, scale = 1 }: { dur?: number; from?: Vec; scale?: number } = {}) {
    animate(this.scaleTrack(), t, dur, scale, "back");
    if (from) {
      const to = this.pos[this.pos.length - 1][1];
      set(this.pos, t, [to[0] + from[0], to[1] + from[1]]);
      this.pos.push([t + dur + 4, to, "out"]);
    }
    return this;
  }
  exit(t: number, { dur = 14, to }: { dur?: number; to?: Vec } = {}) {
    animate(this.scaleTrack(), t, dur, 0, "in");
    animate(this.opacityTrack(), t, dur, 0, "in");
    if (to) animate(this.pos, t, dur, to, "in");
    return this;
  }
  move(t: number, dur: number, to: Vec, ease: Ease = "inOut") {
    animate(this.pos, t, dur, to, ease);
    return this;
  }
  resize(t: number, dur: number, scale: number, ease: Ease = "inOut") {
    animate(this.scaleTrack(), t, dur, scale, ease);
    return this;
  }
  fade(t: number, dur: number, opacity: number) {
    animate(this.opacityTrack(), t, dur, opacity, "inOut");
    return this;
  }
  // Morph: the icon draws into a new one with a squash-and-settle.
  morph(t: number, icon: string, label?: string) {
    (this.spec.icon ??= []).push([t, icon]);
    if (label !== undefined) this.label(t + 4, label);
    const s = this.scaleTrack();
    const base = s[s.length - 1][1];
    animate(s, t, 6, base * 0.88, "in");
    s.push([t + 18, base, "back"]);
    return this;
  }
  label(t: number, text: string) {
    (this.spec.label ??= []).push([t, text]);
    return this;
  }
  pulse(t: number) {
    (this.spec.pulses ??= []).push(t);
    return this;
  }
  // Ring fills, success badge pops, ripple.
  confirm(t: number, dur = 20) {
    const r = (this.spec.ring ??= [[0, 0]]);
    animate(r, t, dur, 1, "inOut");
    this.spec.check = t + dur;
    return this.pulse(t + dur);
  }
}

export class Flow {
  private nodes: FlowNodeHandle[] = [];
  private links: FlowLink[] = [];
  private plan: FlowPlan;
  constructor(theme: ThemeName, duration: number, camera: { center: Vec; zoom: number }) {
    this.plan = { theme, duration, camera: { center: [[0, camera.center]], zoom: [[0, camera.zoom]] }, nodes: [], links: [], texts: [], lotties: [] };
  }
  orb(id: string, at: Vec, { size = 160, icon, label, variant = "soft" }: { size?: number; icon: string; label?: string; variant?: "solid" | "soft" }) {
    const h = new FlowNodeHandle({ id, kind: "orb", variant, size, pos: [[0, at]], icon: [[0, icon]], label: label ? [[0, label]] : undefined });
    this.nodes.push(h);
    return h;
  }
  pill(id: string, at: Vec, { size = 72, text, icon, variant = "soft" }: { size?: number; text: string; icon?: string; variant?: "solid" | "soft" }) {
    const h = new FlowNodeHandle({ id, kind: "pill", variant, size, pos: [[0, at]], label: [[0, text]], icon: icon ? [[0, icon]] : undefined });
    this.nodes.push(h);
    return h;
  }
  // Camera: frame a world point at a zoom.
  camera(t: number, dur: number, center: Vec, zoom: number, ease: Ease = "inOut") {
    animate(this.plan.camera.center, t, dur, center, ease);
    animate(this.plan.camera.zoom, t, dur, zoom, ease);
    return this;
  }
  // A line draws from a to b; an optional packet travels along it.
  connect(a: FlowNodeHandle, b: FlowNodeHandle, t: number, { dur = 16, dashed = false, bend = 0, packet, packetDur = 22, success }: { dur?: number; dashed?: boolean; bend?: number; packet?: string; packetDur?: number; success?: number } = {}) {
    const link: FlowLink = { id: `${a.id}->${b.id}`, from: a.id, to: b.id, draw: [t, t + dur], style: dashed ? "dashed" : "solid", bend, success };
    if (packet) link.packets = [{ icon: packet, start: t + Math.round(dur * 0.5), end: t + Math.round(dur * 0.5) + packetDur }];
    this.links.push(link);
    return link;
  }
  // Several nodes fly into one, which pulses as it absorbs them.
  converge(nodes: FlowNodeHandle[], into: FlowNodeHandle, t: number, at: Vec, dur = 22) {
    nodes.forEach((n, i) => n.move(t + i * 2, dur, at, "in").resize(t + i * 2, dur, 0.2, "in").fade(t + i * 2 + dur - 6, 6, 0));
    this.links.forEach((l) => (l.fade = [t, t + 12]));
    into.move(t, dur, at, "inOut").pulse(t + dur);
    return this;
  }
  text(text: string, start: number, end: number, { pos = [0, 0] as Vec, size = 72, weight, accent }: { pos?: Vec; size?: number; weight?: number; accent?: string } = {}) {
    this.plan.texts.push({ text, start, end, pos, size, weight, accent });
    return this;
  }
  lottie(name: string, start: number, size: number, where: { node?: FlowNodeHandle; pos?: Vec }) {
    this.plan.lotties.push({ name, start, size, node: where.node?.id, pos: where.pos });
    return this;
  }
  build(): FlowPlan {
    return { ...this.plan, nodes: this.nodes.map((n) => n.spec), links: this.links };
  }
}
