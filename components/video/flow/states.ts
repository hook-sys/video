import { CURVES } from "./ease";
import { num, ramp, vec } from "./eval";
import { PARALLAX } from "@/lib/scene-recipe";
import type { FlowNode, FlowPlan, Vec } from "./types";

export type NodeState = { node: FlowNode; pos: Vec; scale: number; opacity: number };

// Node positions at a frame; orbiting nodes circle their centre node
// (blending in and out of their own keyed path). Pure, so the quality checks
// see exactly what the renderer draws.
// Position on a travel curve, if the node is travelling at this frame.
function onPath(n: FlowNode, frame: number): Vec | null {
  const p = n.paths?.find((q) => frame >= q.start && frame < q.end);
  if (!p) return null;
  const k = CURVES[p.ease ?? "inOut"]((frame - p.start) / Math.max(1, p.end - p.start));
  const u = 1 - k;
  return [u * u * p.from[0] + 2 * u * k * p.ctrl[0] + k * k * p.to[0], u * u * p.from[1] + 2 * u * k * p.ctrl[1] + k * k * p.to[1]];
}

export function computeStates(plan: FlowPlan, frame: number) {
  const states = new Map<string, NodeState>();
  const base = (n: FlowNode): NodeState => ({ node: n, pos: onPath(n, frame) ?? vec(n.pos, frame), scale: num(n.scale, frame, 1), opacity: num(n.opacity, frame, 1) });
  for (const n of plan.nodes) if (!n.orbit) states.set(n.id, base(n));
  // Depth layers (Scene Recipe): a layer nearer than the world (> 1) moves and
  // grows more with the camera, a farther one less. Relative to the
  // explainer's resting framing (centre 0,0, zoom 1.1).
  if (plan.nodes.some((n) => n.layer !== undefined && n.layer !== 2)) {
    const c = vec(plan.camera.center, frame);
    const zoom = num(plan.camera.zoom, frame, 1);
    for (const n of plan.nodes) {
      const p = n.layer === undefined ? 1 : PARALLAX[n.layer];
      const s = states.get(n.id);
      if (!s || p === 1) continue;
      const zl = (zoom / 1.1) ** (p - 1);
      const q: Vec = [s.pos[0] + (1 - p) * c[0], s.pos[1] + (1 - p) * c[1]];
      states.set(n.id, { ...s, pos: [c[0] + (q[0] - c[0]) * zl, c[1] + (q[1] - c[1]) * zl], scale: s.scale * zl });
    }
  }
  for (const n of plan.nodes) {
    if (!n.orbit) continue;
    const s = base(n);
    const o = n.orbit;
    const c = states.get(o.center)?.pos ?? [0, 0];
    const a = ((o.angle + o.speed * (frame - o.start)) * Math.PI) / 180;
    const r = num(o.radius, frame, 0);
    const w = ramp(frame, o.start, 14, "inOut") * (1 - (o.end !== undefined ? ramp(frame, o.end, 14, "inOut") : 0));
    const orbitPos: Vec = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
    states.set(n.id, { ...s, pos: [s.pos[0] + (orbitPos[0] - s.pos[0]) * w, s.pos[1] + (orbitPos[1] - s.pos[1]) * w] });
  }
  return states;
}
