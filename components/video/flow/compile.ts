import { estimateWords, type FlowBeat, type FlowScript } from "@/lib/flow-script";
import { spokenCueTimes, type WordTiming } from "@/lib/voice-timing";
import { Flow, type FlowNodeHandle, TILT } from "./patterns";
import type { FlowPlan, ThemeName, Vec } from "./types";

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

export function compileFlowScript(script: FlowScript, { narration, words, durationSeconds, theme }: { narration: string; words?: WordTiming[] | null; durationSeconds: number; theme?: ThemeName }): FlowPlan {
  const total = Math.round(durationSeconds * FPS);
  const starts = beatFrames(script, narration, words, durationSeconds);
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
  let title: { start: number } | null = null;
  let orbitR = 0;

  const show = (n: FlowNodeHandle, pos: Vec, w: number, h = w) => shown.set(n.id, { pos, w, h });
  const hide = (n: FlowNodeHandle) => shown.delete(n.id);
  const target = (id: string | null) => (id && nodes.get(id)) || hero || steps[steps.length - 1] || actors[0] || null;

  // Frame everything on stage (leaving room for a title), within zoom limits.
  const frame = (t: number, dur: number) => {
    const boxes = [...shown.values()];
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((b) => b.pos[0] - b.w / 2));
    const maxX = Math.max(...boxes.map((b) => b.pos[0] + b.w / 2));
    const minY = Math.min(...boxes.map((b) => b.pos[1] - b.h / 2)) - 20;
    const maxY = Math.max(...boxes.map((b) => b.pos[1] + b.h / 2)) + 70; // captions
    const reserve = title ? 250 : 0;
    const zoom = Math.max(0.6, Math.min(1.12, (1920 - 360) / (maxX - minX), (1080 - 260 - reserve) / (maxY - minY)));
    const center: Vec = [(minX + maxX) / 2, (minY + maxY) / 2 + reserve / 2 / zoom];
    f.camera(t, dur, center, zoom);
  };

  const beats = script.beats;
  beats.forEach((b: FlowBeat, i) => {
    const t = starts[i];
    const span = (starts[i + 1] ?? total) - t;
    const camDur = Math.max(16, Math.min(44, Math.round(span * 0.8)));

    // Leaving the UI (unless this beat closes it through the iris).
    if (ui && b.action !== "iris_to_hub") {
      ui.tilt(t, 16, TILT.iso, "in").exit(t + 2, { dur: 16 });
      hide(ui);
      for (const id of hiddenForUi) {
        const n = nodes.get(id)!;
        n.fade(t + 6, 14, 1);
        show(n, n.spec.pos[n.spec.pos.length - 1][1], n.spec.size);
      }
      hiddenForUi = [];
      ui = null;
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
        const members = [ui!];
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
        for (const s of sats) {
          if (s.spec.orbit) s.spec.orbit.end = t;
          s.resize(t + 4, 18, 0.2, "in").fade(t + 16, 6, 0);
        }
        if (sats.length) {
          f.endRings(t);
          shown.delete("orbit");
          sats = [];
        }
        hero!.label(t, "").pulse(t + 22);
        if (b.icon) hero!.morph(t + 18, b.icon).resize(t + 38, 14, 1.08);
        else hero!.resize(t + 18, 16, 1.08);
        f.sfx(t, "whoosh").sfx(t + 22, "subtle_impact");
        break;
      }
      case "title": {
        title = { start: t };
        const next = beats.findIndex((x, k) => k > i && x.action === "title");
        // A closing line needs ~1.5 s on screen to finish revealing and read.
        const at = next === -1 ? Math.max(Math.min(t + 2, total - 48), (starts[i - 1] ?? 0) + 8) : t + 2;
        f.text(b.text!, at, next === -1 ? total + 30 : starts[next] - 4, { pos: [0, 330], size: 88, accent: b.accent ?? undefined });
        break;
      }
    }
    frame(t, camDur);
  });
  return f.build();
}
