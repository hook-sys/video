// Background / environment choreography (Phase 4): how one world entry of
// the backdrop timeline arrives and leaves. Pure, so the renderer
// (flow-scene.tsx) and the checks use the same numbers.
//
// A scene may ask how its world arrives: crossfade (dissolve), slide (the
// current world moves away and reveals the new one), push (the new world
// pushes the current one out) or wipe (the new world is revealed from an
// edge). Without one an entry keeps the default 24-frame dissolve.
import { BG_DIRECTIONS, type BgChoreo } from "@/lib/choreography";
import { ramp } from "./eval";

// Each transition's length (frames) and what intensity sets: a crossfade,
// push and wipe run longer when subtle and quicker when strong; a slide's
// world moves a share of the frame away (subtle 1/4, medium 1/2, strong all
// of it) over 24 frames. A push moves both worlds by a whole frame, like one
// strip (no gap, no overlap), so its intensity is its speed.
export const BG_DEFAULT_FADE = 24;
const SPEED: Record<BgChoreo["intensity"], number> = { subtle: 36, medium: 24, strong: 14 };
export const BG_DISTANCE: Record<BgChoreo["intensity"], number> = { subtle: 0.25, medium: 0.5, strong: 1 };
export const bgLength = (c: BgChoreo | null | undefined) => (!c ? BG_DEFAULT_FADE : c.transition === "slide" ? 24 : SPEED[c.intensity]);
const DIR: Record<(typeof BG_DIRECTIONS)[number], [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

export type WorldEntry = { start: number; end?: number; slot?: "environment" | "atmosphere"; enter?: BgChoreo; exit?: BgChoreo };
// Where an entry sits in its slot's timeline: `out` the frame the slot's next
// entry starts (if any), `next` how that entry arrives when it takes over
// from this one, `prev` whether an entry of the slot is on screen as this
// one arrives (something for a slide to reveal it from).
export type WorldContext = { out?: number; next?: BgChoreo; prev: boolean };
export function worldContext(all: readonly WorldEntry[], i: number): WorldContext {
  const e = all[i];
  const slot = e.slot ?? "environment";
  const same = (x: WorldEntry) => (x.slot ?? "environment") === slot;
  const nx = all.slice(i + 1).find(same);
  return { out: nx?.start, next: nx && (e.end === undefined || e.end === nx.start) ? nx.enter : undefined, prev: all.slice(0, i).some((x) => same(x) && (x.end === undefined || x.end >= e.start)) };
}
// A layer's state at a frame: opacity (0..1), shift in frame shares
// (multiply by width / height), a clip inset in shares (top, right, bottom,
// left) or null, and `top`: drawn over the slot's later entries (a world
// sliding away over the one it reveals).
export type LayerState = { opacity: number; shift: [number, number]; clip: [number, number, number, number] | null; top: boolean };
const ease = (frame: number, start: number, len: number) => ramp(frame, start, len, "inOut");
// The clip that shows the share `v` (0..1) of the frame: for the arriving
// world (from) the part next to the edge it comes in from, for the leaving
// one the part toward the edge it goes to.
const reveal = ([dx, dy]: [number, number], v: number, from: boolean): [number, number, number, number] => {
  // a wipe to the left comes in from the right edge: the left inset shrinks
  const side = dx < 0 ? (from ? 3 : 1) : dx > 0 ? (from ? 1 : 3) : dy < 0 ? (from ? 0 : 2) : from ? 2 : 0;
  const c: [number, number, number, number] = [0, 0, 0, 0];
  c[side] = 1 - v;
  return c;
};

export function worldLayer(e: WorldEntry, ctx: WorldContext, frame: number): LayerState {
  const leave = e.exit ?? ctx.next; // how this entry leaves (its own exit, else the next one's arrival)
  // No choreography either way: the default dissolve, out at the entry's own
  // end (else as the slot's next entry arrives).
  if (!e.enter && !leave) {
    const leaveAt = e.end ?? ctx.out;
    const k = ease(frame, e.start, BG_DEFAULT_FADE) * (leaveAt !== undefined ? 1 - ease(frame, leaveAt, BG_DEFAULT_FADE) : 1);
    return { opacity: k, shift: [0, 0], clip: null, top: false };
  }
  // Choreographed: the entry leaves at its own end (it never lingers into a
  // scene whose world has no layer in this slot).
  const leaveAt = e.end ?? ctx.out;
  let opacity = frame < e.start ? 0 : 1;
  let shift: [number, number] = [0, 0];
  let clip: LayerState["clip"] = null;
  let top = false;
  // arriving
  const c = e.enter;
  if (!c) opacity *= ease(frame, e.start, BG_DEFAULT_FADE);
  else {
    const p = ease(frame, e.start, bgLength(c));
    const dir = DIR[c.direction];
    if (c.transition === "crossfade") opacity *= p;
    else if (c.transition === "push") shift = [-dir[0] * (1 - p), -dir[1] * (1 - p)]; // comes in behind the world it pushes
    else if (c.transition === "wipe") clip = p < 1 ? reveal(dir, p, true) : null;
    else if (!ctx.prev) {
      // a slide with nothing to reveal it from slides in
      const d = BG_DISTANCE[c.intensity];
      shift = [-dir[0] * d * (1 - p), -dir[1] * d * (1 - p)];
      opacity *= p;
    }
    // (slide: already in place under the world that slides away)
  }
  // leaving
  if (leaveAt !== undefined && frame >= leaveAt) {
    const p = ease(frame, leaveAt, bgLength(leave));
    if (!leave || leave.transition === "crossfade") opacity *= 1 - p;
    else {
      const dir = DIR[leave.direction];
      if (leave.transition === "wipe") {
        // the part the new world has not reached yet; gone once it is whole
        clip = p < 1 ? reveal(dir, 1 - p, false) : null;
        if (p >= 1) opacity = 0;
      } else if (leave.transition === "push") {
        // pushed out a whole frame, gone once off screen
        shift = [shift[0] + dir[0] * p, shift[1] + dir[1] * p];
        if (p >= 1) opacity = 0;
      } else {
        // slide: moves away over the world it reveals, fading so it never lingers
        const d = BG_DISTANCE[leave.intensity];
        shift = [shift[0] + dir[0] * d * p, shift[1] + dir[1] * d * p];
        opacity *= 1 - p;
        top = p < 1;
      }
    }
  }
  return { opacity: Math.max(0, Math.min(1, opacity)), shift, clip, top };
}
