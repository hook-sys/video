import type { Ease, FlowBrand, FlowElement, FlowLink, FlowNode, FlowPlan, FlowText, FlowUi, ThemeName, Track, UiRow, Vec, Vec3 } from "./types";

// Plane tilts (rotateX, rotateY, rotateZ): an isometric desk view, a hero
// three-quarter view, and face-on.
export const TILT: Record<"iso" | "hero" | "flat", Vec3> = { iso: [46, 0, -22], hero: [16, -22, 3], flat: [0, 0, 0] };

// Motion patterns: small, reusable moves that write keyframes onto persistent
// nodes. Because every pattern animates the SAME node objects, continuity is
// built in: a node enters once and then moves, morphs and connects until it
// leaves. The Visual Director will compose these; fixtures use them by hand.

// Every key goes through put(): a key never lands before the track's last key,
// so tracks stay in time order whatever order patterns are applied in.
export function put<T>(track: Track<T>, t: number, value: T, ease?: Ease) {
  const last = track[track.length - 1];
  const at = last ? Math.max(t, last[0]) : t;
  if (last && last[0] === at && ease === undefined) last[1] = value;
  else track.push(ease ? [at, value, ease] : [at, value]);
}
export function animate<T>(track: Track<T>, t: number, dur: number, value: T, ease: Ease = "inOut") {
  const last = track[track.length - 1];
  // Never start before the track's last key (keeps keys in time order).
  t = Math.max(t, last[0]);
  if (last[0] < t) track.push([t, last[1]]);
  track.push([t + dur, value, ease]);
}
// Set a value at t (replacing a key at the same frame).
const set = <T,>(track: Track<T>, t: number, value: T) => put(track, t, value);

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
      put(this.pos, t + dur + 4, to, "out");
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
    put((this.spec.icon ??= []), t, icon);
    if (label !== undefined) this.label(t + 4, label);
    const s = this.scaleTrack();
    const base = s[s.length - 1][1];
    animate(s, t, 6, base * 0.88, "in");
    put(s, t + 18, base, "back");
    return this;
  }
  label(t: number, text: string) {
    put((this.spec.label ??= []), t, text);
    return this;
  }
  pulse(t: number) {
    (this.spec.pulses ??= []).push(t);
    return this;
  }
  // ── UI plane ──
  private get ui(): FlowUi {
    if (!this.spec.ui) throw new Error(`${this.id} is not a UI plane`);
    return this.spec.ui;
  }
  tilt(t: number, dur: number, to: Vec3, ease: Ease = "inOut") {
    animate(this.ui.tilt, t, dur, to, ease);
    return this;
  }
  // A labelled callout rises from a point on the plane ([u, v] in 0..1).
  callout(t: number, at: Vec, text: string, { icon, side = "right" }: { icon?: string; side?: "left" | "right" } = {}) {
    (this.ui.callouts ??= []).push({ at, text, icon, side, start: t });
    return this;
  }
  // A row lifts off the plane toward the camera (and settles back at `end`).
  lift(t: number, row: number, end?: number) {
    (this.ui.lifts ??= []).push({ row, start: t, end });
    return this;
  }
  cursorTo(t: number, dur: number, at: Vec) {
    const c = (this.ui.cursor ??= { path: [[t, at]], clicks: [] });
    if (c.path.length === 1 && c.path[0][0] === t) return this;
    animate(c.path, t, dur, at, "inOut");
    return this;
  }
  click(t: number) {
    (this.ui.cursor ??= { path: [[t, [0.5, 0.5]]], clicks: [] }).clicks.push(t);
    return this;
  }
  // Focus pull in: fades up from a blur while settling from slightly large.
  focusIn(t: number, dur = 22) {
    set(this.scaleTrack(), t, 1.1);
    put(this.scaleTrack(), t + dur, 1, "out");
    const o = this.opacityTrack();
    // A node that has not been shown yet stays invisible until t.
    if (o.length === 1 && o[0][0] === 0) o[0][1] = 0;
    set(o, t, 0);
    put(o, t + Math.round(dur * 0.8), 1, "out");
    return this;
  }
  // Focus pull out: grows a little while it blurs away.
  focusOut(t: number, dur = 12) {
    animate(this.scaleTrack(), t, dur, 1.08, "in");
    animate(this.opacityTrack(), t, dur, 0, "in");
    return this;
  }
  // Appear in place (no pop): used when an iris closes onto this node.
  appear(t: number, dur = 6) {
    set(this.scaleTrack(), t, 1);
    const o = this.opacityTrack();
    set(o, t, 0);
    put(o, t + dur, 1, "out");
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
  ui(id: string, at: Vec, { w = 1100, h = 680, title, rows, src, tilt = TILT.iso }: { w?: number; h?: number; title: string; rows?: UiRow[]; src?: string; tilt?: Vec3 }) {
    const h2 = new FlowNodeHandle({ id, kind: "ui", size: Math.min(w, h), pos: [[0, at]], ui: { w, h, title, rows, src, tilt: [[0, tilt]] } });
    this.nodes.push(h2);
    return h2;
  }
  // A product element (card, device, screenshot, icon tile, logo): hidden until
  // an enter pattern shows it.
  el(id: string, at: Vec, { el, w, h, z = 0 }: { el: FlowElement; w: number; h: number; z?: number }) {
    const h2 = new FlowNodeHandle({ id, kind: "el", size: Math.min(w, h), pos: [[0, at]], el, w, h, z, scale: [[0, 0]], opacity: [[0, 0]] });
    this.nodes.push(h2);
    return h2;
  }
  // Satellites spiral in and circle a hub on a dashed orbit.
  orbitAround(hub: FlowNodeHandle, satellites: FlowNodeHandle[], t: number, { radius = 330, speed = 0.35, until, stagger = 5 }: { radius?: number; speed?: number; until?: number; stagger?: number } = {}) {
    satellites.forEach((s, i) => {
      const start = t + i * stagger;
      s.spec.orbit = { center: hub.id, radius: [[start, 0], [start + 26, radius, "out"]], angle: -90 + (360 / satellites.length) * i - 40, speed, start, end: until };
      s.enter(start, { dur: 18 });
    });
    (this.plan.rings ??= []).push({ center: hub.id, radius, start: t + 6, end: until });
    return this;
  }
  // The world recedes (0..1) behind a display line.
  dimTo(t: number, dur: number, value: number) {
    animate((this.plan.dim ??= [[0, 0]]), t, dur, value, "inOut");
    return this;
  }
  endRings(t: number) {
    for (const r of this.plan.rings ?? []) if (r.end === undefined || r.end > t) r.end = t;
    return this;
  }
  // The members are framed by a circle that closes onto `into`, which takes over.
  iris(t: number, dur: number, members: FlowNodeHandle[], into: FlowNodeHandle) {
    (this.plan.iris ??= []).push({ start: t, dur, members: members.map((m) => m.id), into: into.id });
    into.appear(t + dur - 4);
    members.forEach((m) => m.fade(t + dur, 1, 0));
    return this;
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
  // A colour panel grows from a world point to fill the frame, then sweeps off.
  panel(start: number, end: number, from: Vec) {
    (this.plan.panels ??= []).push({ start, end, from });
    return this;
  }
  list(items: string[], at: number[], end: number) {
    (this.plan.lists ??= []).push({ items, at, end });
    return this;
  }
  brand(brand: FlowBrand) {
    this.plan.brand = brand;
    return this;
  }
  sfx(frame: number, kind: NonNullable<FlowPlan["sfx"]>[number]["kind"]) {
    (this.plan.sfx ??= []).push({ frame: Math.max(0, Math.round(frame)), kind });
    return this;
  }
  text(text: string, start: number, end: number, { pos = [0, 0] as Vec, size = 72, weight, accent, style, words, mark, markAt }: { pos?: Vec; size?: number; weight?: number; accent?: string; style?: FlowText["style"]; words?: number[]; mark?: FlowText["mark"]; markAt?: number } = {}) {
    this.plan.texts.push({ text, start, end, pos, size, weight, accent, style, words, mark, markAt });
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
