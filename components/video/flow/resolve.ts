import { num, vec } from "./eval";
import { overlap, textRect, type Rect } from "./quality";
import { computeStates } from "./states";
import type { FlowNode, FlowPlan, FlowText, Track } from "./types";

// The resolve pass: rules the compiled plan must satisfy, enforced after it
// is built instead of only reported. Each rule finds its conflicts on the
// real (camera-smoothed) plan, changes the smallest thing that removes them
// (a fade that lands earlier, a line that ends sooner or stays longer),
// re-measures, and keeps the change only if nothing new broke.
//
//   words-clear: a line never lands on a visible element (a leaving shot's
//                icons fade before the words arrive; an arriving one waits
//                for the words to go).
//   no-gap:      no short empty frame between two shots (the last line stays
//                until the next picture is in).
//
// What it cannot remove it reports, so the search (lib/shot-search.ts) can
// pick another variant of the video.

export type ResolveReport = { fixed: string[]; left: string[] };

const until = (plan: FlowPlan) => (plan.brand ? plan.brand.start - 4 : plan.duration);
const shown = (t: FlowText) => t.words?.[0] ?? t.start;
// Lines that clear the frame (display, panel) own it: nothing to collide with.
const inFrameWith = (t: FlowText) => t.style !== "display" && t.style !== "panel";

function elementRect(plan: FlowPlan, n: FlowNode, f: number, st: { pos: [number, number]; scale: number }): Rect {
  const zoom = num(plan.camera.zoom, f, 1);
  const c = vec(plan.camera.center, f);
  const [x, y] = [960 + zoom * (st.pos[0] - c[0]), 540 + zoom * (st.pos[1] - c[1])];
  const [hw, hh] = [((n.w ?? 400) * st.scale * zoom) / 2, ((n.h ?? 300) * st.scale * zoom) / 2];
  return { x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh, what: `element ${n.id}`, owner: n.id };
}

// Element nodes clearly visible under a line at frame f.
function under(plan: FlowPlan, t: FlowText, f: number): FlowNode[] {
  const r = textRect(t);
  const out: FlowNode[] = [];
  for (const st of computeStates(plan, f).values()) {
    const n = st.node;
    if (n.kind !== "el" || st.opacity < 0.3 || st.scale < 0.05 || num(n.blur, f, 0) > 1.5 || (n.erase !== undefined && f >= n.erase)) continue;
    if (overlap(r, elementRect(plan, n, f, st))) out.push(n);
  }
  return out;
}

// Frames (every 2) where a line sits on a visible element, per element.
function conflicts(plan: FlowPlan, t: FlowText) {
  const hits = new Map<string, number[]>();
  const end = Math.min(t.end, until(plan));
  for (let f = shown(t); f < end; f += 2) for (const n of under(plan, t, f)) hits.set(n.id, [...(hits.get(n.id) ?? []), f]);
  return hits;
}

// The frame an element is gone (opacity under 0.05) at or after f, if it leaves.
function goneAt(n: FlowNode, f: number, horizon: number): number | null {
  for (let g = f; g <= horizon; g++) if (num(n.opacity, g, 1) < 0.05) return g;
  return null;
}

// Rewrite an element's exit so it is fully gone at `at` (a 6-frame fade).
function fadeBy(n: FlowNode, at: number, gone: number) {
  const tr: Track<number> = n.opacity ?? [[0, 1]];
  const from = Math.max(0, at - 6);
  const v = num(tr, from, 1);
  n.opacity = [...tr.filter(([k]) => k < from), [from, v, "inOut"], [at, 0, "in"], ...tr.filter(([k]) => k > gone)];
}

const clashFrames = (plan: FlowPlan, t: FlowText) => [...conflicts(plan, t).values()].reduce((s, x) => s + x.length, 0);

function wordsClear(plan: FlowPlan, report: ResolveReport) {
  for (const t of plan.texts) {
    if (!inFrameWith(t)) continue;
    clearText(plan, t, report);
    const left = conflicts(plan, t);
    if (left.size) report.left.push(`words-clear: "${t.text}" over ${[...left.keys()].join(", ")} at ${(([...left.values()][0][0] ?? 0) / 30).toFixed(1)} s`);
  }
}

function clearText(plan: FlowPlan, t: FlowText, report: ResolveReport) {
  {
    const hits = conflicts(plan, t);
    for (const [id, frames] of hits) {
      const n = plan.nodes.find((x) => x.id === id)!;
      const before = clashFrames(plan, t);
      const [first, last] = [frames[0], frames[frames.length - 1]];
      const gone = goneAt(n, last, last + 45);
      const wasThere = num(n.opacity, shown(t) - 2, 1) >= 0.3;
      // (Only a shot that is leaving anyway, around when the words land:
      // never the subject the words stand beside.)
      if (wasThere && gone !== null && gone <= shown(t) + 30) {
        // A leaving element: gone just before the words land — and with it
        // everything leaving in the same exit (a row goes together).
        const group = plan.nodes.filter((m) => m.kind === "el" && (m === n || (num(m.opacity, shown(t) - 2, 1) >= 0.3 && Math.abs((goneAt(m, shown(t) - 2, gone + 6) ?? -99) - gone) <= 2)));
        const saved = group.map((m) => m.opacity);
        for (const m of group) fadeBy(m, shown(t) - 1, goneAt(m, shown(t) - 2, gone + 6) ?? gone);
        if (clashFrames(plan, t) < before) report.fixed.push(`words-clear: ${group.map((m) => m.id).join(", ")} fade before "${t.text}"`);
        else group.forEach((m, k) => (m.opacity = saved[k]));
      } else if (!wasThere && first > shown(t) + 12) {
        // An arriving element: the line has gone before it lands.
        const lastWord = t.words?.[t.words.length - 1] ?? t.start;
        const end = first - 4;
        if (end >= lastWord + 12) {
          const saved = t.end;
          t.end = end;
          if (clashFrames(plan, t) < before) report.fixed.push(`words-clear: "${t.text}" ends before ${id} arrives`);
          else t.end = saved;
        }
      }
    }
  }
}

// Something readable in frame: a line (through most of its exit) or an element.
function seenAt(plan: FlowPlan, f: number) {
  if (plan.texts.some((t) => f >= shown(t) && f < t.end + 8)) return true;
  if ((plan.lists ?? []).some((l) => f >= l.at[0] && f < l.end + 8) || (plan.panels ?? []).some((p) => f >= p.start && f < p.end)) return true;
  const zoom = num(plan.camera.zoom, f, 1);
  const c = vec(plan.camera.center, f);
  for (const st of computeStates(plan, f).values()) {
    const n = st.node;
    if (st.opacity < 0.3 || st.scale < 0.05 || (n.erase !== undefined && f >= n.erase + 8)) continue;
    if (n.kind === "ui") return true;
    const w = (n.kind === "el" ? (n.w ?? 400) : n.size) * st.scale * zoom;
    const h = (n.kind === "el" ? (n.h ?? 300) : n.size) * st.scale * zoom;
    const [x, y] = [960 + zoom * (st.pos[0] - c[0]), 540 + zoom * (st.pos[1] - c[1])];
    if (Math.min(x + w / 2, 1920) - Math.max(x - w / 2, 0) > Math.min(w, 1920) * 0.6 && Math.min(y + h / 2, 1080) - Math.max(y - h / 2, 0) > Math.min(h, 1080) * 0.6) return true;
  }
  return false;
}

function gaps(plan: FlowPlan) {
  const out: [number, number][] = [];
  let start = -1;
  for (let f = 0; f < until(plan); f++) {
    if (!seenAt(plan, f)) {
      if (start < 0) start = f;
    } else if (start >= 0) {
      out.push([start, f]);
      start = -1;
    }
  }
  return out;
}

function noGap(plan: FlowPlan, report: ResolveReport) {
  for (const [a, b] of gaps(plan)) {
    const len = b - a;
    if (a === 0 || len > 45 || len < 3) continue; // the opening, a real pause, or a blink
    // The line that just went: it stays until the picture is in (if that puts
    // it on nothing and no other line).
    const t = plan.texts.find((x) => x.end + 8 <= a && x.end + 8 >= a - 12);
    if (t) {
      const saved = t.end;
      t.end = b - 6;
      const clean = clashFrames(plan, t) === 0 && !plan.texts.some((o) => o !== t && o.start < t.end + 8 && o.end > saved);
      if (clean && !gaps(plan).some(([x, y]) => x < b && y > a && y - x >= 3)) {
        report.fixed.push(`no-gap: "${t.text}" holds ${(len / 30).toFixed(1)} s longer`);
        continue;
      }
      t.end = saved;
    }
    // The next line: it arrives a little before its first word (the whole
    // line settles in at once), filling the gap.
    const next = plan.texts.find((x) => shown(x) >= b - 2 && shown(x) <= b + 12);
    if (next && len + 2 <= 12) {
      const saved = { start: next.start, words: next.words, markAt: next.markAt };
      const d = len + 2;
      next.start -= d;
      next.words = next.words?.map((w) => w - d);
      const opacities = plan.nodes.map((n) => n.opacity);
      const trial: ResolveReport = { fixed: [], left: [] };
      if (inFrameWith(next)) clearText(plan, next, trial);
      const clean = clashFrames(plan, next) === 0 && !plan.texts.some((o) => o !== next && o.end + 8 > next.start && o.start < next.start);
      if (clean && !gaps(plan).some(([x, y]) => x < b && y > a && y - x >= 3)) {
        report.fixed.push(`no-gap: "${next.text}" arrives ${(d / 30).toFixed(1)} s sooner`, ...trial.fixed);
        continue;
      }
      Object.assign(next, saved);
      plan.nodes.forEach((n, i) => (n.opacity = opacities[i]));
    }
    report.left.push(`no-gap: ${(len / 30).toFixed(1)} s empty at ${(a / 30).toFixed(1)} s`);
  }
}

export function resolvePlan(plan: FlowPlan): ResolveReport {
  const report: ResolveReport = { fixed: [], left: [] };
  wordsClear(plan, report);
  noGap(plan, report);
  plan.resolved = report;
  return report;
}
