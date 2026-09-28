import { estimateWords, type FlowAction, type FlowBeat, type FlowScript } from "@/lib/flow-script";
import { sameWord, spokenCueTimes, tokenize, type WordTiming } from "@/lib/voice-timing";
import { num, vec } from "./eval";
import { Flow, type FlowNodeHandle, TILT } from "./patterns";
import type { FlowPlan, FlowText, ThemeName, Vec } from "./types";
import { fitSize } from "./typography";

// FlowScript (the Director's beats) → FlowPlan (keyframes), deterministically.
// Beats start on the voice's real word timestamps (slightly ahead, so motion
// leads the word); layout, camera framing and sound effects are decided here,
// never by the model.

const FPS = 30;
const LEAD = 3; // frames of anticipation before the spoken word
const MIN_GAP = 10;
const STEP_GAP = 560;
const HERO = 300;
const NODE = 220;

type Extent = { pos: Vec; w: number; h: number };

export function beatFrames(script: FlowScript, narration: string, words: WordTiming[] | null | undefined, durationSeconds: number) {
  const total = Math.round(durationSeconds * FPS);
  const timeline = words?.length ? words : estimateWords(narration, durationSeconds);
  const times = spokenCueTimes(script.beats.map((b) => b.cue), timeline);
  let last = -MIN_GAP;
  return times.map((t, i) => {
    const want = t === null ? last + MIN_GAP : Math.round(t * FPS) - LEAD;
    const f = Math.min(total - 24 - (script.beats.length - 1 - i) * 4, Math.max(i === 0 ? 0 : last + MIN_GAP, want, 0));
    last = f;
    return f;
  });
}

// Each pattern needs time to read. A beat never starts before the previous one
// has had its minimum; a small accent (confirm/celebrate) that would land too
// long after its words is dropped rather than shown late.
const MIN_FRAMES: Record<FlowAction, number> = {
  ui_showcase: 72,
  orbit: 40,
  statement: 36,
  title: 36,
  iris_to_hub: 36,
  converge: 30,
  hero_enter: 22,
  add_step: 22,
  hero_morph: 18,
  actor_enter: 16,
  confirm: 16,
  celebrate: 12,
};
const MINOR = new Set<FlowAction>(["confirm", "celebrate"]);
const MAX_LAG = 24;

export function scheduleBeats(script: FlowScript, narration: string, words: WordTiming[] | null | undefined, durationSeconds: number) {
  const total = Math.round(durationSeconds * FPS);
  const cues = beatFrames(script, narration, words, durationSeconds);
  const beats: FlowBeat[] = [];
  const starts: number[] = [];
  script.beats.forEach((b, i) => {
    const prev = beats[beats.length - 1];
    const earliest = prev ? starts[starts.length - 1] + MIN_FRAMES[prev.action] : 0;
    const t = Math.min(total - 30, Math.max(cues[i], earliest));
    if (MINOR.has(b.action) && t - cues[i] > MAX_LAG) return;
    beats.push(b);
    starts.push(t);
  });
  return { beats, starts, cues };
}

// Frame each word of `text` is spoken, matched in order in the voice's word
// stream from `fromSec`; words not spoken verbatim cascade 4 frames apart.
export function wordFrames(text: string, fromSec: number, timeline: WordTiming[]) {
  const stream = timeline.flatMap((w) => tokenize(w.text).map((t) => ({ t, start: w.start })));
  let j = Math.max(0, stream.findIndex((s) => s.start >= fromSec - 0.35));
  const out: number[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const tok = tokenize(w)[0];
    let hit = -1;
    if (tok) for (let k = j; k < Math.min(stream.length, j + 30); k++) if (sameWord(stream[k].t, tok)) { hit = k; break; }
    const prev = out[out.length - 1];
    if (hit >= 0) {
      out.push(Math.max(prev === undefined ? 0 : prev + 2, Math.round(stream[hit].start * FPS) - 2));
      j = hit + 1;
    } else out.push(prev === undefined ? Math.round(fromSec * FPS) : prev + 4);
  }
  return out;
}

export function compileFlowScript(script: FlowScript, { narration, words, durationSeconds, theme }: { narration: string; words?: WordTiming[] | null; durationSeconds: number; theme?: ThemeName }): FlowPlan {
  const total = Math.round(durationSeconds * FPS);
  const { beats, starts } = scheduleBeats(script, narration, words, durationSeconds);
  const timeline = words?.length ? words : estimateWords(narration, durationSeconds);
  const f = new Flow(theme ?? script.theme, total, { center: [0, 0], zoom: 1.08 });
  const nodes = new Map<string, FlowNodeHandle>();
  const shown = new Map<string, Extent>(); // what the camera should frame
  let hero: FlowNodeHandle | null = null;
  const heroPos: Vec = [0, 0];
  const steps: FlowNodeHandle[] = [];
  const actors: FlowNodeHandle[] = [];
  let sats: FlowNodeHandle[] = [];
  let ui: FlowNodeHandle | null = null;
  let hiddenForUi: string[] = [];
  // Text on screen and the room it needs (the camera frames around it).
  const lines: { start: number; end: number; style: NonNullable<FlowText["style"]> }[] = [];
  const reserveAt = (t: number) => {
    const on = lines.filter((l) => t >= l.start - 2 && t < l.end);
    return {
      bottom: on.some((l) => l.style === "caption") ? 250 : on.some((l) => l.style === "pill") ? 170 : 0,
      left: on.some((l) => l.style === "side") ? 880 : 0,
    };
  };
  let orbitR = 0;

  const show = (n: FlowNodeHandle, pos: Vec, w: number, h = w) => shown.set(n.id, { pos, w, h });
  const hide = (n: FlowNodeHandle) => shown.delete(n.id);
  const target = (id: string | null) => (id && nodes.get(id)) || hero || steps[steps.length - 1] || actors[0] || null;

  // Satellites fold back into the subject (before the stage is used for
  // something else); their orbit and dashed ring end.
  const clearOrbit = (t: number) => {
    if (!sats.length) return;
    for (const s of sats) {
      if (s.spec.orbit) s.spec.orbit.end = t;
      s.resize(t, 12, 0.2, "in").fade(t + 6, 6, 0);
    }
    f.endRings(t);
    shown.delete("orbit");
    sats = [];
  };

  // Frame everything on stage (leaving room for text), within zoom limits,
  // then keep drifting in slowly until the next beat so no moment is static.
  const frame = (t: number, dur: number, span: number) => {
    const boxes = [...shown.values()];
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((b) => b.pos[0] - b.w / 2));
    const maxX = Math.max(...boxes.map((b) => b.pos[0] + b.w / 2));
    const minY = Math.min(...boxes.map((b) => b.pos[1] - b.h / 2)) - 20;
    const maxY = Math.max(...boxes.map((b) => b.pos[1] + b.h / 2)) + 80; // captions
    // Moves finish before the video ends (never cut off mid-move).
    dur = Math.max(8, Math.min(dur, total - 8 - t));
    span = Math.min(span, total - t);
    const r = reserveAt(t + dur);
    const zoom = Math.max(0.6, Math.min(1.12, (1920 - 360 - r.left) / (maxX - minX), (1080 - 260 - r.bottom) / (maxY - minY)));
    const center: Vec = [(minX + maxX) / 2 - r.left / 2 / zoom, (minY + maxY) / 2 + r.bottom / 2 / zoom];
    f.camera(t, dur, center, zoom);
    if (span - dur > 18) f.camera(t + dur, span - dur, center, zoom * (1 + 0.00055 * (span - dur)), "linear");
  };

  beats.forEach((b: FlowBeat, i) => {
    let t = starts[i];
    let span = (starts[i + 1] ?? total) - t;
    const camDur = Math.max(16, Math.min(44, Math.round(span * 0.8)));

    // Leaving the UI (unless this beat closes it through the iris, or is a
    // pill line that floats over it).
    const overUi = b.action === "statement" && b.layout === "pill";
    if (ui && b.action !== "iris_to_hub" && !overUi) {
      ui.tilt(t, 14, TILT.iso, "in").exit(t, { dur: 12 });
      hide(ui);
      for (const id of hiddenForUi) {
        const n = nodes.get(id);
        if (!n) continue;
        n.fade(t + 10, 12, 1);
        show(n, n.spec.pos[n.spec.pos.length - 1][1], n.spec.size);
      }
      hiddenForUi = [];
      ui = null;
      // The interface clears the stage before this beat's objects arrive.
      t += 10;
      span -= 10;
    }
    // Actors hand over to the story once it moves on.
    if (actors.length && ["add_step", "orbit", "ui_showcase"].includes(b.action)) {
      for (const a of actors.splice(0)) {
        const p = a.spec.pos[a.spec.pos.length - 1][1];
        a.exit(t, { to: [p[0] - 160, p[1]] });
        hide(a);
      }
    }

    switch (b.action) {
      case "actor_enter": {
        // Where the subject will stand is known ([0, 0]), so actors take their
        // final place beside it even before it enters.
        const pos: Vec = [heroPos[0] - 620, 40 - actors.length * 200];
        const a = f.orb(b.id!, pos, { size: 190, icon: b.icon!, label: b.label ?? undefined }).enter(t, { from: [-100, 0] });
        nodes.set(a.id, a);
        actors.push(a);
        show(a, pos, 190);
        f.sfx(t, "soft_pop");
        if (hero) {
          f.connect(a, hero, t + 8, { dur: 16, bend: -70, packet: b.packet_icon ?? "mouse-pointer-click", packetDur: 20 });
          hero.pulse(t + 34);
          f.sfx(t + 14, "whoosh");
        }
        break;
      }
      case "hero_enter": {
        hero = f.orb("hero", heroPos, { size: HERO, icon: b.icon!, variant: "solid" }).enter(t + 2);
        nodes.set("hero", hero);
        show(hero, heroPos, HERO);
        if (b.label) hero.label(t + 16, b.label);
        f.sfx(t + 2, "soft_pop");
        actors.forEach((a, k) => {
          f.connect(a, hero!, t + 10 + k * 4, { dur: 16, bend: -70, packet: b.packet_icon ?? "mouse-pointer-click", packetDur: 20 });
          f.sfx(t + 16, "whoosh");
        });
        break;
      }
      case "hero_morph": {
        hero!.morph(t + 2, b.icon!, b.label ?? undefined);
        f.sfx(t + 2, "reveal");
        break;
      }
      case "add_step": {
        clearOrbit(t);
        const prev = steps[steps.length - 1] ?? hero!;
        if (!steps.length) hero!.resize(t, 18, 0.78);
        const pp = prev === hero ? heroPos : prev.spec.pos[prev.spec.pos.length - 1][1];
        const pos: Vec = [pp[0] + STEP_GAP, (steps.length % 2 ? 1 : -1) * 14];
        const s = f.orb(b.id!, pos, { size: NODE, icon: b.icon! }).enter(t + 2, { from: [90, 0] });
        nodes.set(s.id, s);
        steps.push(s);
        show(s, pos, NODE);
        f.connect(prev, s, t + 6, { dur: 14, packet: b.packet_icon ?? b.icon!, packetDur: 18 });
        if (b.label) s.label(t + 20, b.label);
        f.sfx(t + 2, "soft_pop").sfx(t + 12, "whoosh");
        break;
      }
      case "confirm": {
        const n = target(b.id);
        if (!n) break;
        n.confirm(t + 2, 18);
        if (b.label) n.label(t + 20, b.label);
        f.sfx(t + 20, "success_chime");
        break;
      }
      case "celebrate": {
        const n = target(b.id);
        f.lottie(b.lottie ?? "confetti-burst", t + 2, 560, { node: n ?? undefined, pos: n ? undefined : heroPos });
        f.sfx(t + 4, "success_chime");
        break;
      }
      case "ui_showcase": {
        const u = b.ui!;
        const at: Vec = hero ? heroPos : [0, 0];
        clearOrbit(t);
        hiddenForUi = [...shown.keys()];
        for (const id of hiddenForUi) {
          nodes.get(id)?.fade(t, 12, 0);
          shown.delete(id);
        }
        ui = f.ui(`ui-${i}`, at, { w: 1240, h: 720, title: u.title, rows: u.rows.map((r) => ({ icon: r.icon, text: r.text, value: r.value ?? undefined, status: r.status ?? undefined })), tilt: TILT.iso }).enter(t, { dur: 20 });
        nodes.set(ui.id, ui);
        f.sfx(t, "whoosh");
        const tiltAt = t + Math.round(span * 0.25);
        ui.tilt(tiltAt, 40, TILT.hero);
        f.camera(t, Math.round(span * 0.5), [at[0] + 120, at[1] + 20], 1.02);
        const rowV = (k: number) => (64 + 22 + k * 88 + 38) / 720;
        if (u.click_row !== null) {
          const c = t + Math.round(span * 0.45);
          ui.cursorTo(c - 24, 1, [0.95, 0.95]).cursorTo(c - 22, 20, [0.78, rowV(u.click_row)]).click(c).lift(c + 2, u.click_row);
          f.sfx(c, "click");
        }
        u.callouts.forEach((co, k) => {
          const ct = t + Math.round(span * (0.55 + k * 0.15));
          ui!.callout(ct, k === 0 ? [0.97, rowV(u.click_row ?? 1)] : [0.07, rowV(Math.min(u.rows.length - 1, 3))], co.text, { icon: co.icon, side: k === 0 ? "right" : "left" });
          f.sfx(ct, "soft_pop");
        });
        f.camera(t + Math.round(span * 0.5), Math.round(span * 0.4), [at[0] + 200, at[1]], 0.9);
        return; // camera handled above
      }
      case "iris_to_hub": {
        if (!ui) {
          // No UI on stage (should not pass validation): treat as the subject's entrance.
          if (!hero) {
            hero = f.orb("hero", heroPos, { size: HERO, icon: b.icon!, variant: "solid" }).enter(t + 2);
            nodes.set("hero", hero);
          } else hero.morph(t + 2, b.icon!);
          if (b.label) hero.label(t + 16, b.label);
          show(hero, heroPos, HERO);
          break;
        }
        const members = [ui];
        hiddenForUi = hiddenForUi.filter((id) => id !== "hero");
        if (!hero) {
          hero = f.orb("hero", heroPos, { size: HERO, icon: b.icon!, variant: "solid" });
          nodes.set("hero", hero);
        } else {
          hero.morph(t + 20, b.icon!);
        }
        f.camera(t, 20, heroPos, 1.0);
        f.iris(t + 4, 26, members, hero);
        if (b.label) hero.label(t + 34, b.label);
        hide(ui!);
        ui = null;
        show(hero, heroPos, HERO);
        for (const id of hiddenForUi) nodes.get(id)?.fade(t + 30, 14, 1);
        hiddenForUi = [];
        f.sfx(t + 4, "whoosh").sfx(t + 30, "reveal");
        break;
      }
      case "orbit": {
        clearOrbit(t);
        let at = t;
        if (steps.length) {
          f.converge(steps, hero!, t, heroPos, 20);
          steps.forEach(hide);
          steps.splice(0);
          hero!.resize(t, 20, 1);
          at = t + 22;
          f.sfx(t, "whoosh");
        }
        hero!.label(at, "");
        const made = b.satellites!.map((s) => {
          const n = f.orb(s.id, heroPos, { size: 132, icon: s.icon, label: s.label ?? undefined });
          nodes.set(n.id, n);
          return n;
        });
        orbitR = 360;
        f.orbitAround(hero!, made, at, { radius: orbitR, speed: 0.32, stagger: 5 });
        made.forEach((n, k) => f.connect(hero!, n, at + 18 + k * 5, { dur: 12 }));
        sats = made;
        shown.set("orbit", { pos: heroPos, w: orbitR * 2 + 150, h: orbitR * 2 + 150 });
        f.sfx(at + 2, "soft_pop").sfx(at + 16, "reveal");
        break;
      }
      case "converge": {
        const all = [...steps, ...actors.splice(0)];
        if (all.length) f.converge(all, hero!, t, heroPos, 22);
        all.forEach(hide);
        steps.splice(0);
        clearOrbit(t);
        hero!.label(t, "").pulse(t + 22);
        if (b.icon) hero!.morph(t + 18, b.icon).resize(t + 38, 14, 1.08);
        else hero!.resize(t + 18, 16, 1.08);
        f.sfx(t, "whoosh").sfx(t + 22, "subtle_impact");
        break;
      }
      case "statement":
      case "title": {
        const text = b.text!;
        const last = !beats.slice(i + 1).some((x) => x.action !== "confirm" && x.action !== "celebrate");
        // Side text needs a compact stage (one subject, not a wide chain or orbit).
        const boxes = [...shown.values()];
        const stageW = boxes.length ? Math.max(...boxes.map((x) => x.pos[0] + x.w / 2)) - Math.min(...boxes.map((x) => x.pos[0] - x.w / 2)) : 0;
        const compact = !!hero && stageW <= 760;
        let style: NonNullable<FlowText["style"]> =
          b.layout === "pill" ? "pill" : b.layout === "side" && hero ? "side" : b.layout === "display" ? "display" : last || b.action === "title" ? (hero ? "caption" : "display") : hero ? "side" : "display";
        if (style === "side" && !compact) style = "caption";
        const cueSec = (starts[i] + 3) / FPS;
        const wf = wordFrames(text, cueSec - 0.2, timeline);
        const start = Math.min(t + 2, wf[0]);
        const nextLine = beats.findIndex((x, k) => k > i && (x.action === "statement" || x.action === "title"));
        const nextStart = starts[i + 1] ?? total;
        const hardEnd = nextLine === -1 ? total + 30 : starts[nextLine] - 4;
        const wordsEnd = wf[wf.length - 1] + 36;
        const end = last ? total + 30 : Math.min(hardEnd, style === "display" ? Math.max(wordsEnd, nextStart - 2) : Math.max(wordsEnd, nextStart + 20));
        lines.push({ start, end, style });
        const pos: Vec = style === "side" ? [-860, 0] : style === "caption" ? [0, 330] : style === "pill" ? [0, 360] : [0, 0];
        f.text(text, start, end, { style, pos, size: fitSize(text, style, b.accent ?? undefined), accent: b.accent ?? undefined, words: wf });
        if (style === "display") {
          f.dimTo(start - 4, 12, 1).dimTo(Math.min(end, total) - 6, 14, 0);
          f.sfx(wf[0], "subtle_impact");
        } else if (style === "pill") f.sfx(start, "soft_pop");
        break;
      }
    }
    if (!(ui && overUi)) frame(t, camDur, span);
  });

  // Long stretches without a new beat get a soft ripple on the subject, so
  // the frame never sits still (unless a line of text is carrying it).
  const subject = nodes.get("hero");
  for (let i = 0; i < starts.length; i++) {
    const a = starts[i];
    const b = starts[i + 1] ?? total - 12;
    if (b - a > 54 && subject && !lines.some((l) => l.start <= a + (b - a) / 2 && l.end > a + (b - a) / 2 && l.style === "display")) subject.pulse(Math.round(a + (b - a) / 2));
  }

  return smoothCamera(f.build());
}

// One continuous camera: sample the keyed path every frame and smooth it
// (Gaussian, zoom in log space) so moves ease into each other with no
// velocity jumps, whatever beats overlap.
const SMOOTH_SIGMA = 10;
const MAX_PAN_ACCEL = 0.9; // screen px / frame²
const MAX_ZOOM_ACCEL = 0.0007; // log zoom / frame²
export function smoothCamera(plan: FlowPlan): FlowPlan {
  // Work on a path that runs 2 s past the end (holding its last key), so the
  // smoothing never brakes artificially on the final frames; then cut.
  const n = plan.duration + 60;
  const raw = Array.from({ length: n }, (_, i) => {
    const [x, y] = vec(plan.camera.center, i);
    return [x, y, Math.log(num(plan.camera.zoom, i, 1))];
  });
  const r = Math.ceil(SMOOTH_SIGMA * 3);
  const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * SMOOTH_SIGMA ** 2)));
  const smooth = raw.map((_, i) => {
    const acc = [0, 0, 0];
    let sum = 0;
    for (let k = -r; k <= r; k++) {
      const s = raw[Math.min(n - 1, Math.max(0, i + k))];
      const wk = w[k + r];
      acc[0] += s[0] * wk;
      acc[1] += s[1] * wk;
      acc[2] += s[2] * wk;
      sum += wk;
    }
    return acc.map((v) => v / sum);
  });
  // Then follow that path with a critically damped spring whose acceleration
  // is capped (screen px/frame², zoom in log units): where beats pile camera
  // moves on top of each other the camera eases through instead of jolting.
  const followed: number[][] = [];
  let [x, y, lz] = smooth[0];
  let [vx, vy, vz] = [0, 0, 0];
  const w0 = 0.35;
  const cap = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  for (let i = 0; i < n; i++) {
    const [gx, gy, gz] = smooth[i];
    const z = Math.exp(lz);
    const aPos = MAX_PAN_ACCEL / z;
    const ax = cap(w0 * w0 * (gx - x) - 2 * w0 * vx, aPos);
    const ay = cap(w0 * w0 * (gy - y) - 2 * w0 * vy, aPos);
    const az = cap(w0 * w0 * (gz - lz) - 2 * w0 * vz, MAX_ZOOM_ACCEL);
    vx += ax;
    vy += ay;
    vz += az;
    x += vx;
    y += vy;
    lz += vz;
    followed.push([x, y, lz]);
  }
  // A light final pass softens the spring's switch between capped and free.
  const g = (arr: number[][], sigma: number) => {
    const rr = Math.ceil(sigma * 3);
    const ww = Array.from({ length: 2 * rr + 1 }, (_, k) => Math.exp(-((k - rr) ** 2) / (2 * sigma ** 2)));
    return arr.map((_, i) => {
      const acc = [0, 0, 0];
      let sum = 0;
      for (let k = -rr; k <= rr; k++) {
        const s = arr[Math.min(arr.length - 1, Math.max(0, i + k))];
        acc[0] += s[0] * ww[k + rr];
        acc[1] += s[1] * ww[k + rr];
        acc[2] += s[2] * ww[k + rr];
        sum += ww[k + rr];
      }
      return acc.map((v) => v / sum);
    });
  };
  const r1 = (v: number) => Math.round(v * 10) / 10;
  smooth.splice(0, n, ...g(followed, 3));
  const kept = smooth.slice(0, plan.duration);
  return {
    ...plan,
    camera: {
      center: kept.map((s, i) => [i, [r1(s[0]), r1(s[1])], "linear"]),
      zoom: kept.map((s, i) => [i, Math.round(Math.exp(s[2]) * 10000) / 10000, "linear"]),
    },
  };
}
