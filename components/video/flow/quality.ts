import { num, step, vec } from "./eval";
import { computeStates } from "./states";
import type { FlowPlan, FlowText } from "./types";
import { labelWorldSize, splitLines, textWidth, TYPE } from "./typography";

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
  collisionFrames: number; // frames where text, nodes or labels overlap
  collisionAt: number;
  collision: string; // what overlapped first
};

export const QUALITY_BAR = { deadFrames: 66, minLabelPx: 34, cameraAccel: 3, zoomAccel: 0.0025, collisionFrames: 6 };

type Rect = { x0: number; y0: number; x1: number; y1: number; what: string; owner?: string; round?: boolean };
const overlap = (a: Rect, b: Rect): boolean => {
  // A round node overlaps a box only if the box reaches into the circle.
  if (b.round || a.round) {
    const [c, r] = b.round ? [b, a] : [a, b];
    const R = (c.x1 - c.x0) / 2;
    const [cx, cy] = [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2];
    const dx = Math.max(r.x0 - cx, 0, cx - r.x1);
    const dy = Math.max(r.y0 - cy, 0, cy - r.y1);
    if (Math.hypot(dx, dy) > R * 0.85) return false;
  }
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return false;
  const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return w * h > 0.08 * small;
};

// Screen rectangle of a line of text at a frame (1920×1080, origin top-left).
function textRect(t: FlowText): Rect {
  const style = t.style ?? "headline";
  const lines = style === "side" ? splitLines(t.text, t.accent) : [t.text];
  const w = Math.max(...lines.map((l) => textWidth(l, t.size)));
  const h = lines.length * t.size * TYPE[style].lineHeight;
  const padX = style === "pill" ? t.size * 0.7 : 0;
  const padY = style === "pill" ? t.size * 0.36 : 0;
  const cx = style === "side" ? 960 + t.pos[0] + w / 2 : 960;
  const cy = 540 + t.pos[1];
  return { x0: cx - w / 2 - padX, x1: cx + w / 2 + padX, y0: cy - h / 2 - padY, y1: cy + h / 2 + padY, what: `text "${t.text}"` };
}

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
  for (const l of plan.lists ?? []) add(...l.at, l.end);
  for (const p of plan.panels ?? []) add(p.start, p.end);
  if (plan.brand) add(plan.brand.start, plan.brand.start + 18, plan.brand.start + 34, plan.duration);
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
  // Once the brand lockup covers the scene the camera is no longer seen.
  const seenUntil = plan.brand ? plan.brand.start : plan.duration;
  for (let f = 1; f < seenUntil - 1; f++) {
    const [a, b, c] = [cam(f - 1), cam(f), cam(f + 1)];
    for (const [ox, oy] of [[0, 0], [-960, -540], [960, -540], [-960, 540], [960, 540]]) {
      const p: [number, number] = [b.c[0] + ox / b.z, b.c[1] + oy / b.z];
      const [sa, sb, sc] = [screen(a, p), screen(b, p), screen(c, p)];
      const acc = Math.hypot(sa[0] - 2 * sb[0] + sc[0], sa[1] - 2 * sb[1] + sc[1]);
      if (acc > cameraAccel) [cameraAccel, accelAt] = [acc, f];
    }
    zoomAccel = Math.max(zoomAccel, Math.abs(Math.log(a.z) - 2 * Math.log(b.z) + Math.log(c.z)));
  }

  // Overlaps on screen, sampled every 2 frames: a line of text over a node or
  // its label, or a node's label over another node. Lines that clear the whole
  // frame (display, panel) and the brand lockup are skipped.
  let collisionFrames = 0;
  let collisionAt = -1;
  let collision = "";
  for (let f = 0; f < plan.duration; f += 2) {
    if (num(plan.dim, f, 0) > 0.5 || (plan.brand && f >= plan.brand.start - 4)) continue;
    const zoom = num(plan.camera.zoom, f, 1);
    const c = vec(plan.camera.center, f);
    const sx = (p: [number, number]): [number, number] => [960 + zoom * (p[0] - c[0]), 540 + zoom * (p[1] - c[1])];
    const rects: Rect[] = [];
    for (const st of computeStates(plan, f).values()) {
      const n = st.node;
      if (n.kind !== "orb" || st.opacity < 0.6 || st.scale < 0.6) continue;
      const [x, y] = sx(st.pos);
      const r = (n.size / 2) * st.scale * zoom;
      rects.push({ x0: x - r, x1: x + r, y0: y - r, y1: y + r, what: `node ${n.id}`, owner: n.id, round: n.variant !== "soft" && n.shape !== "tile" });
      const label = step(n.label, f, 12);
      if (label?.cur && label.k > 0.5) {
        const size = labelWorldSize(zoom * st.scale) * st.scale * zoom;
        const w = textWidth(label.cur, size) * 0.95;
        const top = y + (n.size / 2 + 26) * st.scale * zoom;
        rects.push({ x0: x - w / 2, x1: x + w / 2, y0: top, y1: top + size * 1.15, what: `label "${label.cur}"`, owner: n.id });
      }
    }
    const texts = plan.texts.filter((t) => t.style !== "display" && t.style !== "panel" && f >= (t.words?.[0] ?? t.start) && f < t.end).map(textRect);
    let hit = "";
    for (const t of texts) for (const r of rects) if (!hit && overlap(t, r)) hit = `${t.what} over ${r.what}`;
    for (const a of rects) {
      if (hit || !a.what.startsWith("label")) continue;
      for (const b of rects) if (b.owner !== a.owner && b.what.startsWith("node") && overlap(a, b)) hit = `${a.what} over ${b.what}`;
    }
    if (hit) {
      collisionFrames += 2;
      if (collisionAt < 0) [collisionAt, collision] = [f, hit];
    }
  }

  const overflow = plan.texts.flatMap((t) => {
    const lines = t.style === "side" ? splitLines(t.text, t.accent) : [t.text];
    const limit = t.style === "side" ? 1000 : t.style === "pill" ? 1500 : t.style === "panel" ? 1640 : 1800;
    return lines.filter((l) => textWidth(l, t.size) > limit).map((l) => `"${l}" at ${t.size}px`);
  });

  return { deadFrames, deadAt, minLabelPx: minLabelPx === Infinity ? 99 : Math.round(minLabelPx), cameraAccel: Math.round(cameraAccel * 100) / 100, accelAt, zoomAccel: Math.round(zoomAccel * 10000) / 10000, overflow, collisionFrames, collisionAt, collision };
}

export function qualityProblems(q: PlanQuality): string[] {
  const out: string[] = [];
  if (q.deadFrames > QUALITY_BAR.deadFrames) out.push(`${(q.deadFrames / 30).toFixed(1)} s with nothing new on screen (from ${(q.deadAt / 30).toFixed(1)} s)`);
  if (q.minLabelPx < QUALITY_BAR.minLabelPx) out.push(`a label renders at ${q.minLabelPx}px`);
  if (q.cameraAccel > QUALITY_BAR.cameraAccel) out.push(`camera jolts (${q.cameraAccel} px/frame² at frame ${q.accelAt})`);
  if (q.zoomAccel > QUALITY_BAR.zoomAccel) out.push(`zoom jolts (${q.zoomAccel})`);
  out.push(...q.overflow.map((o) => `text overflows: ${o}`));
  if (q.collisionFrames > QUALITY_BAR.collisionFrames) out.push(`overlap for ${(q.collisionFrames / 30).toFixed(1)} s: ${q.collision} (at ${(q.collisionAt / 30).toFixed(1)} s)`);
  return out;
}
