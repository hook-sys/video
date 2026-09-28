import { num, step, vec } from "./eval";
import type { FlowPlan } from "./types";
import { labelWorldSize, splitLines, textWidth } from "./typography";

// Measurable motion-design quality for any compiled plan, so every script —
// hand-made or AI-written — is held to the same bar.
export type PlanQuality = {
  deadFrames: number; // longest stretch with nothing new happening (before the final hold)
  deadAt: number; // where it starts
  minLabelPx: number; // smallest node label on screen, in px at 1080p
  cameraAccel: number; // largest frame-to-frame change of camera speed (screen px/frame²)
  accelAt: number;
  zoomAccel: number; // same for zoom (relative)
  overflow: string[]; // lines of text wider than the frame
};

export const QUALITY_BAR = { deadFrames: 66, minLabelPx: 34, cameraAccel: 3, zoomAccel: 0.0025 };

export function planQuality(plan: FlowPlan): PlanQuality {
  const events: number[] = [0];
  const add = (...fs: (number | undefined)[]) => fs.forEach((f) => f !== undefined && f >= 0 && f <= plan.duration && events.push(f));
  for (const n of plan.nodes) {
    for (const tr of [n.pos, n.scale, n.opacity, n.ring, n.icon, n.label]) tr?.forEach(([f]) => add(f));
    add(n.check, ...(n.pulses ?? []));
    n.ui?.tilt.forEach(([f]) => add(f));
    n.ui?.callouts?.forEach((c) => add(c.start));
    n.ui?.lifts?.forEach((l) => add(l.start, l.end));
    add(...(n.ui?.cursor?.clicks ?? []));
    if (n.orbit) add(n.orbit.start, n.orbit.end);
  }
  for (const l of plan.links) {
    add(l.draw[0], l.draw[1], l.success);
    l.packets?.forEach((p) => add(p.start, p.end));
  }
  for (const t of plan.texts) add(t.start, ...(t.words ?? []));
  for (const l of plan.lotties) add(l.start);
  for (const i of plan.iris ?? []) add(i.start, i.start + i.dur);
  const sorted = [...new Set(events.map(Math.round))].sort((a, b) => a - b);
  let deadFrames = 0;
  let deadAt = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > deadFrames) {
      deadFrames = sorted[i] - sorted[i - 1];
      deadAt = sorted[i - 1];
    }
  }

  // Labels on screen: sampled every 3 frames while shown.
  let minLabelPx = Infinity;
  for (let f = 0; f < plan.duration; f += 3) {
    const zoom = num(plan.camera.zoom, f, 1);
    for (const n of plan.nodes) {
      if (n.kind !== "orb") continue;
      const label = step(n.label, f, 12);
      const scale = num(n.scale, f, 1);
      if (!label?.cur || label.k < 1 || scale < 0.5 || num(n.opacity, f, 1) < 0.9) continue;
      minLabelPx = Math.min(minLabelPx, labelWorldSize(zoom * scale) * zoom * scale);
    }
  }

  // Camera smoothness: how what is on screen moves — the centre and corners
  // of the frame at f, followed through f−1 and f+1 (second difference in
  // screen px). Zoom separately, in log space.
  let cameraAccel = 0;
  let accelAt = 0;
  let zoomAccel = 0;
  const cam = (f: number) => ({ c: vec(plan.camera.center, f), z: num(plan.camera.zoom, f, 1) });
  const screen = (k: { c: [number, number]; z: number }, p: [number, number]) => [k.z * (p[0] - k.c[0]), k.z * (p[1] - k.c[1])];
  for (let f = 1; f < plan.duration - 1; f++) {
    const [a, b, c] = [cam(f - 1), cam(f), cam(f + 1)];
    for (const [ox, oy] of [[0, 0], [-960, -540], [960, -540], [-960, 540], [960, 540]]) {
      const p: [number, number] = [b.c[0] + ox / b.z, b.c[1] + oy / b.z];
      const [sa, sb, sc] = [screen(a, p), screen(b, p), screen(c, p)];
      const acc = Math.hypot(sa[0] - 2 * sb[0] + sc[0], sa[1] - 2 * sb[1] + sc[1]);
      if (acc > cameraAccel) [cameraAccel, accelAt] = [acc, f];
    }
    zoomAccel = Math.max(zoomAccel, Math.abs(Math.log(a.z) - 2 * Math.log(b.z) + Math.log(c.z)));
  }

  const overflow = plan.texts.flatMap((t) => {
    const lines = t.style === "side" ? splitLines(t.text, t.accent) : [t.text];
    const limit = t.style === "side" ? 1000 : t.style === "pill" ? 1500 : 1800;
    return lines.filter((l) => textWidth(l, t.size) > limit).map((l) => `"${l}" at ${t.size}px`);
  });

  return { deadFrames, deadAt, minLabelPx: minLabelPx === Infinity ? 99 : Math.round(minLabelPx), cameraAccel: Math.round(cameraAccel * 100) / 100, accelAt, zoomAccel: Math.round(zoomAccel * 10000) / 10000, overflow };
}

export function qualityProblems(q: PlanQuality): string[] {
  const out: string[] = [];
  if (q.deadFrames > QUALITY_BAR.deadFrames) out.push(`${(q.deadFrames / 30).toFixed(1)} s with nothing new on screen (from ${(q.deadAt / 30).toFixed(1)} s)`);
  if (q.minLabelPx < QUALITY_BAR.minLabelPx) out.push(`a label renders at ${q.minLabelPx}px`);
  if (q.cameraAccel > QUALITY_BAR.cameraAccel) out.push(`camera jolts (${q.cameraAccel} px/frame² at frame ${q.accelAt})`);
  if (q.zoomAccel > QUALITY_BAR.zoomAccel) out.push(`zoom jolts (${q.zoomAccel})`);
  out.push(...q.overflow.map((o) => `text overflows: ${o}`));
  return out;
}
