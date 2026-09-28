import { num, ramp, vec } from "./eval";
import type { FlowNode, FlowPlan, Vec } from "./types";

export type NodeState = { node: FlowNode; pos: Vec; scale: number; opacity: number };

// Node positions at a frame; orbiting nodes circle their centre node
// (blending in and out of their own keyed path). Pure, so the quality checks
// see exactly what the renderer draws.
export function computeStates(plan: FlowPlan, frame: number) {
  const states = new Map<string, NodeState>();
  const base = (n: FlowNode): NodeState => ({ node: n, pos: vec(n.pos, frame), scale: num(n.scale, frame, 1), opacity: num(n.opacity, frame, 1) });
  for (const n of plan.nodes) if (!n.orbit) states.set(n.id, base(n));
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
