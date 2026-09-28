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
