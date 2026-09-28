import { isIconName } from "@/components/video/icons";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import { THEMES } from "./themes";
import type { FlowPlan, Track } from "./types";

// Structural checks for a FlowPlan (hand-built or AI-written): every error is
// something the renderer would draw wrongly or not at all.
export function validateFlowPlan(plan: FlowPlan): string[] {
  const errors: string[] = [];
  if (!(plan.theme in THEMES)) errors.push(`unknown theme "${plan.theme}"`);
  if (!(plan.duration > 0)) errors.push("duration must be positive");
  const sorted = (name: string, track: Track<unknown> | undefined) => {
    if (!track) return;
    if (!track.length) errors.push(`${name}: empty track`);
    for (let i = 1; i < track.length; i++) if (track[i][0] < track[i - 1][0]) errors.push(`${name}: keys out of order at frame ${track[i][0]}`);
  };
  sorted("camera.center", plan.camera.center);
  sorted("camera.zoom", plan.camera.zoom);
  const ids = new Set<string>();
  for (const n of plan.nodes) {
    if (ids.has(n.id)) errors.push(`duplicate node "${n.id}"`);
    ids.add(n.id);
    for (const [k, t] of Object.entries({ pos: n.pos, scale: n.scale, opacity: n.opacity, ring: n.ring, icon: n.icon, label: n.label })) sorted(`${n.id}.${k}`, t as Track<unknown> | undefined);
    for (const [, name] of n.icon ?? []) if (!isIconName(name)) errors.push(`${n.id}: unknown icon "${name}"`);
    if (n.kind === "ui" && !n.ui) errors.push(`${n.id}: UI node without ui spec`);
    if (n.ui) {
      sorted(`${n.id}.tilt`, n.ui.tilt);
      for (const r of n.ui.rows ?? []) if (!isIconName(r.icon)) errors.push(`${n.id}: unknown row icon "${r.icon}"`);
      for (const c of n.ui.callouts ?? []) if (c.icon && !isIconName(c.icon)) errors.push(`${n.id}: unknown callout icon "${c.icon}"`);
      for (const l of n.ui.lifts ?? []) if (!n.ui.rows?.[l.row]) errors.push(`${n.id}: lift of missing row ${l.row}`);
      if (n.ui.cursor) sorted(`${n.id}.cursor`, n.ui.cursor.path);
    }
  }
  for (const n of plan.nodes) {
    if (!n.orbit) continue;
    const c = plan.nodes.find((x) => x.id === n.orbit!.center);
    if (!c) errors.push(`${n.id}: orbit centre "${n.orbit.center}" missing`);
    else if (c.orbit) errors.push(`${n.id}: orbit centre "${c.id}" is itself orbiting`);
    sorted(`${n.id}.orbit.radius`, n.orbit.radius);
  }
  for (const r of plan.rings ?? []) if (!ids.has(r.center)) errors.push(`ring: missing centre "${r.center}"`);
  for (const ir of plan.iris ?? []) {
    if (!ids.has(ir.into)) errors.push(`iris: missing target "${ir.into}"`);
    for (const m of ir.members) if (!ids.has(m)) errors.push(`iris: missing member "${m}"`);
    if (ir.members.includes(ir.into)) errors.push("iris: target cannot be one of its members");
  }
  for (const l of plan.links) {
    if (!ids.has(l.from) || !ids.has(l.to)) errors.push(`link ${l.id}: missing node`);
    if (l.draw[1] < l.draw[0]) errors.push(`link ${l.id}: draw ends before it starts`);
    for (const p of l.packets ?? []) {
      if (!isIconName(p.icon)) errors.push(`link ${l.id}: unknown packet icon "${p.icon}"`);
      if (p.end <= p.start) errors.push(`link ${l.id}: packet ends before it starts`);
    }
  }
  for (const t of plan.texts) if (t.end <= t.start) errors.push(`text "${t.text}": ends before it starts`);
  for (const l of plan.lotties) {
    if (!(l.name in LOTTIE_MANIFEST)) errors.push(`unknown lottie "${l.name}"`);
    if (l.node && !ids.has(l.node)) errors.push(`lottie ${l.name}: missing node "${l.node}"`);
  }
  return errors;
}
