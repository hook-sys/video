import { tokenize, type WordTiming } from "@/lib/voice-timing";
import { same } from "../sync";
import { KINDS } from "./kinds";
import { lerp } from "./motion-patterns";
import { evaluateCamera, evaluatePose, evaluateState, looseAt, worldToScreen, type ObjectTrack, type RenderTimeline } from "./timeline";

// Deterministic visual checks on a compiled timeline — the same evaluation the
// renderer uses, so they describe exactly what will be on screen.

export type Check = { frame: number; name: string; ok: boolean; level: "error" | "warn"; detail: string };
type Box = { x0: number; y0: number; x1: number; y1: number };

function screenBox(t: ObjectTrack, frame: number, tl: RenderTimeline): (Box & { opacity: number }) | null {
  const p = evaluatePose(t, frame);
  if (p.opacity < 0.05) return null;
  const k = KINDS[t.kind];
  const m = evaluateState(t, frame).morph;
  const w = lerp(k.loose.w, (k.organized ?? k.loose).w, m) * p.scale;
  const h = lerp(k.loose.h, (k.organized ?? k.loose).h, m) * p.scale;
  const cam = evaluateCamera(tl.camera, frame, tl.fps);
  const a = worldToScreen({ x: p.x - w / 2, y: p.y - h / 2 }, cam, tl.width, tl.height);
  const b = worldToScreen({ x: p.x + w / 2, y: p.y + h / 2 }, cam, tl.width, tl.height);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, opacity: p.opacity };
}

const union = (boxes: Box[]) => boxes.reduce<Box | null>((u, b) => (u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b), null);
const visibleFraction = (b: Box, W: number, H: number) => {
  const iw = Math.max(0, Math.min(b.x1, W) - Math.max(b.x0, 0));
  const ih = Math.max(0, Math.min(b.y1, H) - Math.max(b.y0, 0));
  return (iw * ih) / Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
};

function subjectIds(sel: string, tl: RenderTimeline, frame: number) {
  return sel.split(",").flatMap((p) => {
    const part = p.trim();
    if (part === "all") return tl.objects.filter((o) => o.born <= frame).map((o) => o.id);
    if (part === "all_loose") return tl.objects.filter((o) => looseAt(o, frame)).map((o) => o.id);
    if (part.startsWith("group:")) return tl.objects.filter((o) => o.group === part.slice(6)).map((o) => o.id);
    if (part.endsWith("*")) return tl.objects.filter((o) => o.id.startsWith(part.slice(0, -1))).map((o) => o.id);
    return tl.objects.some((o) => o.id === part) ? [part] : [];
  });
}

export function checkTimeline(tl: RenderTimeline): { passed: boolean; checks: Check[] } {
  const W = tl.width;
  const H = tl.height;
  const checks: Check[] = [];
  const add = (frame: number, name: string, ok: boolean, detail: string, level: Check["level"] = "warn") => checks.push({ frame, name, ok, level, detail });

  // Per moment, once its motion has settled: is the subject big and in frame?
  for (const m of tl.moments) {
    const frame = Math.min(tl.durationInFrames - 1, Math.round(m.frame + (m.end - m.frame) * 0.9));
    const ids = subjectIds(m.subject, tl, frame);
    const boxes = ids.map((id) => screenBox(tl.objects.find((o) => o.id === id)!, frame, tl)).filter((b): b is Box & { opacity: number } => !!b);
    const box = union(boxes);
    if (!box) {
      add(frame, `subject visible · "${m.cue}"`, false, `nothing of "${m.subject}" on screen`, "error");
      continue;
    }
    const cover = Math.max((box.x1 - box.x0) / W, (box.y1 - box.y0) / H);
    add(frame, `subject large · "${m.cue}"`, cover >= 0.4, `subject spans ${(cover * 100).toFixed(0)}% of the frame (target ≥ 40%)`);
    const inside = visibleFraction(box, W, H);
    add(frame, `subject in frame · "${m.cue}"`, inside >= 0.8, `${(inside * 100).toFixed(0)}% of the subject is inside the frame`, inside < 0.6 ? "error" : "warn");
  }

  // Continuity: nothing disappears unless the story removed it.
  for (const t of tl.objects) {
    const removedAt = t.motion.find((k) => k.pattern === "exit")?.frame ?? Number.POSITIVE_INFINITY;
    let wasVisible = false;
    for (let f = Math.max(0, t.born); f < tl.durationInFrames; f += 3) {
      const o = evaluatePose(t, f).opacity;
      if (o > 0.6) wasVisible = true;
      if (wasVisible && o < 0.05 && f < removedAt) {
        add(f, `persistence · ${t.id}`, false, `${t.id} vanished without an exit or transform`, "error");
        break;
      }
    }
  }
  const vanished = checks.filter((c) => c.name.startsWith("persistence")).length;
  add(0, "persistence · all objects", vanished === 0, vanished ? `${vanished} object(s) vanished` : `${tl.objects.length} objects persist until the story removes them`, "error");

  // Never an empty frame (after the first object arrives).
  const firstBorn = Math.min(...tl.objects.map((o) => o.born));
  let empty = 0;
  for (let f = Math.max(0, firstBorn + 4); f < tl.durationInFrames; f += 5) {
    const any = tl.objects.some((o) => {
      const b = screenBox(o, f, tl);
      return b && b.opacity > 0.3 && visibleFraction(b, W, H) > 0.2;
    });
    if (!any) empty++;
  }
  add(0, "no empty frames", empty === 0, empty ? `${empty} sampled frame(s) show no object` : "every sampled frame shows at least one object");

  // One continuous camera: no jumps between consecutive frames.
  let maxJump = 0;
  let prev = evaluateCamera(tl.camera, 0, tl.fps);
  for (let f = 1; f < tl.durationInFrames; f++) {
    const c = evaluateCamera(tl.camera, f, tl.fps);
    maxJump = Math.max(maxJump, Math.hypot((c.x - prev.x) * c.z, (c.y - prev.y) * c.z), Math.abs(Math.log(c.z / prev.z)) * W);
    prev = c;
  }
  add(0, "continuous camera", maxJump < 90, `largest per-frame camera move ${maxJump.toFixed(0)} px (limit 90)`, "error");
  const zooms = Array.from({ length: Math.ceil(tl.durationInFrames / 3) }, (_, i) => evaluateCamera(tl.camera, i * 3, tl.fps).z);
  const zMin = Math.min(...zooms);
  const zMax = Math.max(...zooms);
  add(0, "camera zoom range", zMin >= 0.5 && zMax <= 2.2, `zoom ${zMin.toFixed(2)}–${zMax.toFixed(2)} (limits 0.50–2.20)`, "error");

  return { passed: checks.every((c) => c.ok || c.level === "warn"), checks };
}

// Timing: voice word → moment cue → first visible action → sound. Uses the
// voice word timestamps when given (otherwise only internal consistency).
export function checkTiming(tl: RenderTimeline, words?: WordTiming[] | null): { passed: boolean; checks: Check[]; rows: TimingRow[] } {
  const checks: Check[] = [];
  const rows: TimingRow[] = [];
  const fps = tl.fps;
  const add = (frame: number, name: string, ok: boolean, detail: string, level: Check["level"] = "warn") => checks.push({ frame, name, ok, level, detail });
  const stream = (words ?? []).flatMap((w) => tokenize(w.text).map((t) => ({ t, start: w.start })));
  tl.moments.forEach((m, i) => {
    const first = tokenize(m.cue)[0] ?? "";
    add(m.frame, `cue matched · "${m.cue}"`, m.matched, m.matched ? "cue words found in the narration" : "cue not found; placed proportionally", "error");
    if (i > 0) add(m.frame, `cue order · "${m.cue}"`, m.frame > tl.moments[i - 1].frame, "moments are in spoken order", "error");
    // the spoken word this cue landed on
    const word = stream.find((w) => same(w.t, first) && Math.abs(Math.round(w.start * fps) - m.frame) <= 1);
    if (words?.length) add(m.frame, `cue on word · "${m.cue}"`, !!word, word ? `"${first}" spoken at ${word.start.toFixed(3)}s → frame ${m.frame}` : `no spoken "${first}" within 1 frame of frame ${m.frame}`, "error");
    const lead = m.action === null ? null : (m.action - m.frame) / fps;
    if (lead !== null) add(m.frame, `action on cue · "${m.cue}"`, lead >= -0.5 && lead <= 0.45, `first action ${lead >= 0 ? "+" : ""}${lead.toFixed(2)}s from the word (allowed −0.50…+0.45)`, Math.abs(lead) > 1 ? "error" : "warn");
    const near = m.action === null ? null : tl.sfx.reduce<number | null>((best, c) => (best === null || Math.abs(c.frame - m.action!) < Math.abs(best - m.action!) ? c.frame : best), null);
    const sfxGap = m.sfx !== null && near !== null && m.action !== null ? (near - m.action) / fps : null;
    if (m.sfx !== null) add(m.frame, `sound on action · "${m.cue}"`, sfxGap !== null && Math.abs(sfxGap) <= 0.5, sfxGap === null ? "its sound was dropped (spacing/cap)" : `nearest sound ${sfxGap >= 0 ? "+" : ""}${sfxGap.toFixed(2)}s from the action`);
    rows.push({ cue: m.cue, word: word?.start ?? null, frame: m.frame, action: m.action, sfx: near });
  });
  // Closing text appears on its spoken words (when the voice says them).
  if (stream.length)
    for (const t of tl.text.filter((x) => x.role === "closing")) {
      const first = tokenize(t.content)[0] ?? "";
      const spokenAt = stream.filter((w) => same(w.t, first)).map((w) => w.start).sort((a, b) => Math.abs(a * fps - t.frame) - Math.abs(b * fps - t.frame))[0];
      if (spokenAt === undefined) continue;
      const gap = t.frame / fps - spokenAt;
      add(t.frame, `text on word · "${t.content}"`, Math.abs(gap) <= 0.25, `shown ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}s from "${first}" (spoken ${spokenAt.toFixed(2)}s)`);
    }
  return { passed: checks.every((c) => c.ok || c.level === "warn"), checks, rows };
}
export type TimingRow = { cue: string; word: number | null; frame: number; action: number | null; sfx: number | null };
