import type { WordTiming } from "@/lib/voice-timing";
import { SFX_LIBRARY } from "../sfx";
import { KINDS, WORKSPACE, isContainer, type Size } from "./kinds";
import { accumulate, jitter, lerp, sec } from "./motion-patterns";
import type { Moment, Shot, StoryEvent, VisualStory } from "./story";
import { evaluatePose, evaluateState, looseAt, type AreaTrack, type CameraKey, type MomentMark, type ObjectTrack, type Pose, type RenderTimeline, type SfxCue, type TextCue } from "./timeline";
import { findCue, spokenWords } from "./timing";

// VisualStory → RenderTimeline. Deterministic: the same story, narration and
// voice timing always compile to the same timeline. The story decides WHAT
// happens; this decides HOW it physically moves (formations, arcs, slots,
// timing, camera, light and sound).

export type CompileInput = {
  story: VisualStory;
  narration: string;
  durationSeconds: number;
  words?: WordTiming[] | null;
  fps?: number;
  width?: number;
  height?: number;
};

const AREA_GAP = 2100;
const ANTICIPATION = 3; // frames (0.10 s) an action may lead its spoken word
const MAX_ZOOM = 2.1; // a single card can fill ~40–60% of the frame
const CAMERA_SPEED = 1300; // screen px per second the camera may travel
const WORLD_Y = 1000;
const TINTS = ["#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#10b981", "#8b5cf6", "#0ea5e9", "#14b8a6", "#f97316", "#a855f7"];
const APP_TINTS = ["#ef4444", "#3b82f6", "#6366f1", "#a855f7", "#10b981", "#f59e0b"];
const DIRS = [
  { x: -1500, y: 60, tilt: -28 },
  { x: 80, y: -1100, tilt: 18 },
  { x: -80, y: 1100, tilt: -18 },
  { x: 1500, y: -60, tilt: 28 },
];

// Lighting per area kind (base colour of the world while the story is there).
const LIGHT: Record<string, string> = {
  chaos: "#1d0b1c",
  convergence: "#170c24",
  workspace: "#0b1330",
  product_ui: "#0b1330",
  data: "#0a1a2e",
  neutral: "#11142a",
  hero: "#eef0fa",
};

type Status = { visible: boolean; container?: string; col?: number; row?: number; dock?: number; busy: number; rest: Pose; area: string };
type Container = { id: string; cols: string[][]; dock: string[]; panel?: string; total: number };

export function compileStory(input: CompileInput): RenderTimeline {
  const fps = input.fps ?? 30;
  const W = input.width ?? 1920;
  const H = input.height ?? 1080;
  const duration = Math.round(input.durationSeconds * fps);
  const { story } = input;
  const issues: string[] = [];

  // 1. Timing: each moment's cue → absolute frame (voice-aligned or estimated).
  const { spoken, synced } = spokenWords(input.narration, input.durationSeconds, input.words);
  let from = 0;
  const cueWord: number[] = [];
  const found = story.moments.map((m) => {
    const hit = findCue(spoken, m.cue, from);
    cueWord.push(hit ? hit.index : from);
    if (!hit) {
      issues.push(`cue not found in narration: "${m.cue}" (placed proportionally)`);
      return null;
    }
    from = hit.index + 1;
    return Math.round(hit.at * fps);
  });
  const starts = fillGaps(found, duration);
  const ends = starts.map((s, i) => starts[i + 1] ?? duration);

  // 2. World: areas along one path (left → right for 16:9).
  const areas = layoutAreas(story, starts, ends, duration);
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const placeOf = (areaId: string): AreaTrack => {
    const a = areaById.get(areaId) ?? areas[0];
    if (a.kind === "convergence") return areas.find((b) => b.kind !== "convergence" && !b.colocated && b.rect.x > a.rect.x) ?? a;
    return a;
  };

  // 3. Objects: one persistent track each.
  const tracks = new Map<string, ObjectTrack>();
  const status = new Map<string, Status>();
  const containers = new Map<string, Container>();
  let appIndex = 0;
  story.cast.forEach((c, i) => {
    const kind = c.kind;
    tracks.set(c.id, {
      id: c.id,
      kind,
      group: c.group,
      content: c.content ?? {},
      z: isContainer(kind) ? 1 : 10,
      born: Number.POSITIVE_INFINITY,
      motion: [],
      state: [],
      impulses: [],
      tint: KINDS[kind].role === "app" ? APP_TINTS[appIndex++ % APP_TINTS.length] : TINTS[i % TINTS.length],
    });
    if (isContainer(kind)) containers.set(c.id, { id: c.id, cols: [[], [], []], dock: [], total: 0 });
  });
  const castIds = story.cast.map((c) => c.id);
  const homeOf = (id: string) => story.cast.find((c) => c.id === id)!.home;
  const sizeOf = (id: string, organized = false): Size => {
    const k = KINDS[tracks.get(id)!.kind];
    return organized && k.organized ? k.organized : k.loose;
  };

  // Pile formation per area: a jittered golden spiral, dense and overlapping.
  const pileCount = new Map<string, number>();
  const pileTotal = (areaId: string) =>
    Math.max(
      4,
      story.cast.filter((c) => placeOf(c.home).id === areaId && ["item", "app"].includes(KINDS[c.kind].role)).length,
    );
  const pilePose = (id: string, area: AreaTrack): Pose => {
    const k = pileCount.get(area.id) ?? 0;
    pileCount.set(area.id, k + 1);
    const n = pileTotal(area.id);
    const a = k * 2.39996 + 0.6;
    const r = Math.sqrt((k + 0.6) / n);
    return {
      x: area.rect.x + Math.cos(a) * r * 560 + jitter(id, 1) * 40,
      y: area.rect.y + Math.sin(a) * r * 330 + jitter(id, 2) * 30,
      rot: jitter(id, 3) * 11,
      scale: 1,
      opacity: 1,
    };
  };
  const centerPose = (area: AreaTrack): Pose => ({ x: area.rect.x, y: area.rect.y, rot: 0, scale: 1, opacity: 1 });
  // First free spot in an area for a standalone object (no stacking on top of
  // what is already there): centre, then below/above, then the sides.
  const SPOTS = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const freePose = (area: AreaTrack, id: string): Pose => {
    const size = sizeOf(id);
    const taken = [...status.entries()]
      .filter(([other, st]) => other !== id && st.visible && !st.container && placeOf(st.area).id === area.id && !isContainer(tracks.get(other)!.kind))
      .map(([other, st]) => ({ x: st.rest.x, y: st.rest.y, ...sizeOf(other) }));
    for (const [sx, sy] of SPOTS) {
      const c = { x: area.rect.x + sx * (size.w / 2 + 360), y: area.rect.y + sy * (size.h / 2 + 190) };
      const clear = taken.every((t) => Math.abs(t.x - c.x) > (t.w + size.w) / 2 + 40 || Math.abs(t.y - c.y) > (t.h + size.h) / 2 + 40);
      if (clear) return { ...c, rot: 0, scale: 1, opacity: 1 };
    }
    return centerPose(area);
  };

  const containerRect = (cid: string) => {
    const r = status.get(cid)?.rest ?? centerPose(placeOf(homeOf(cid)));
    const s = KINDS.workspace.loose;
    return { left: r.x - s.w / 2, top: r.y - s.h / 2, x: r.x, y: r.y };
  };
  const slotPose = (cid: string, col: number, row: number): Pose => {
    const c = containerRect(cid);
    const L = WORKSPACE.cols;
    return { x: c.left + L.x + col * (L.w + L.gap) + L.w / 2, y: c.top + L.y + 44 + row * (L.rowH + L.rowGap) + L.rowH / 2, rot: 0, scale: 1, opacity: 1 };
  };
  const dockPose = (cid: string, i: number): Pose => {
    const c = containerRect(cid);
    const S = WORKSPACE.sidebar;
    return { x: c.left + S.x + S.w / 2, y: c.top + S.y + i * S.gap + S.h / 2, rot: 0, scale: 1, opacity: 1 };
  };
  const panelPose = (cid: string): Pose => {
    const c = containerRect(cid);
    const P = WORKSPACE.panel;
    return { x: c.left + P.x + P.w / 2, y: c.top + P.y + P.h / 2, rot: 0, scale: 1, opacity: 1 };
  };

  const push = (id: string, key: ObjectTrack["motion"][number]) => {
    const t = tracks.get(id)!;
    t.motion.push(key);
    const s = status.get(id);
    if (s) {
      s.rest = key.pose;
      s.busy = key.frame + (key.pattern === "converge" ? key.dur : key.pattern === "enter" ? sec(0.7) : sec(0.45));
    }
  };
  const state = (id: string, field: ObjectTrack["state"][number]["field"], frame: number, to: number, dur = sec(0.45), spring = false) =>
    tracks.get(id)!.state.push({ frame, field, to, dur, spring });

  // Appear: first key is the start pose (hidden), the second brings it in.
  const appear = (id: string, at: number, pose: Pose, area: string, dirIndex: number) => {
    const t = tracks.get(id)!;
    const role = KINDS[t.kind].role;
    let startPose: Pose;
    if (role === "item" || role === "app") {
      // Things fly in from off-frame; what opens the video glides in from
      // close by instead, so the very first frame already shows it.
      const d = DIRS[dirIndex % DIRS.length];
      const k = at <= 0 ? 0.18 : 1;
      startPose = { x: pose.x + d.x * k, y: pose.y + d.y * k, rot: pose.rot + d.tilt * k, scale: 1, opacity: 0 };
    } else {
      startPose = { ...pose, scale: 0.86, opacity: 0 };
    }
    t.born = at;
    t.motion.push({ frame: at, pose: startPose, pattern: "hold", dur: 1 });
    status.set(id, { visible: true, busy: at, rest: startPose, area });
    push(id, { frame: at, pose, pattern: "enter", dur: sec(0.8) });
  };

  const visibleAt = (id: string) => status.get(id)?.visible ?? false;

  // Selector → ids (at the current point of compilation).
  const resolve = (sel: string): string[] => {
    const out = new Set<string>();
    for (const part of sel.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (part === "all") castIds.forEach((id) => out.add(id));
      else if (part === "all_loose") castIds.filter((id) => visibleAt(id) && !status.get(id)!.container && ["item", "app"].includes(KINDS[tracks.get(id)!.kind].role)).forEach((id) => out.add(id));
      else if (part.startsWith("group:")) story.cast.filter((c) => c.group === part.slice(6)).forEach((c) => out.add(c.id));
      else if (part.endsWith("*")) castIds.filter((id) => id.startsWith(part.slice(0, -1))).forEach((id) => out.add(id));
      else if (tracks.has(part)) out.add(part);
      else if (areaById.has(part)) continue;
      else issues.push(`unknown target "${part}" ignored`);
    }
    return [...out];
  };

  const sfx: { frame: number; kind: keyof typeof SFX_LIBRARY }[] = [];
  const text: TextCue[] = [];
  const marks: MomentMark[] = [];
  let dirCounter = 0;
  const received = new Map<string, string>(); // item → container it converged into
  const organized = new Set<string>(); // containers whose columns are live

  // 4. Events → animation keys, moment by moment.
  const actionFrames: (number | null)[] = [];
  const sfxFrames: (number | null)[] = [];
  story.moments.forEach((m, mi) => {
    const before = new Map([...tracks.values()].map((t) => [t.id, [t.motion.length, t.state.length, t.impulses.length]]));
    const sfxBefore = sfx.length;
    // Actions anticipate their spoken cue by ANTICIPATION (≤ 0.12 s); the voice
    // stays the timeline. The opening never shows an empty world: the first
    // moment starts at frame 0 when its first word is spoken near the start.
    const f = mi === 0 && starts[0] <= sec(0.6) ? 0 : Math.max(0, starts[mi] - ANTICIPATION);
    const span = Math.max(sec(0.5), ends[mi] - starts[mi]);
    const area = placeOf(m.area);
    for (const ev of m.events) compileEvent(ev, m, f, span, area);
    if (m.text) text.push({ frame: starts[mi] + 2, content: m.text.content, role: "support", line: 0 });
    if (m.intent === "resolve") for (const [cid] of containers) if (visibleAt(cid)) state(cid, "calm", f, 1, sec(1.4));
    // First visible action of this moment (a new motion, state or jolt).
    const frames = [...tracks.values()].flatMap((t) => {
      const [a, b, c] = before.get(t.id)!;
      return [...t.motion.slice(a).filter((k) => k.pattern !== "hold").map((k) => k.frame), ...t.state.slice(b).map((k) => k.frame), ...t.impulses.slice(c).map((k) => k.frame)];
    });
    actionFrames.push(frames.length ? Math.min(...frames) : null);
    sfxFrames.push(sfx.length > sfxBefore ? Math.min(...sfx.slice(sfxBefore).map((c) => c.frame)) : null);
  });

  function compileEvent(ev: StoryEvent, m: Moment, f: number, span: number, area: AreaTrack) {
    const ids = resolve(ev.targets);
    if (!ids.length) {
      issues.push(`"${ev.verb}" on "${ev.targets}" matched nothing`);
      return;
    }
    const paceK = ev.pace === "tight" ? 0.75 : ev.pace === "loose" ? 1.25 : 1;
    const into = ev.into && tracks.has(ev.into) ? ev.into : undefined;
    const intoArea = ev.into && areaById.has(ev.into) ? placeOf(ev.into) : undefined;

    switch (ev.verb) {
      case "accumulate":
      case "enter": {
        const fresh = ids.filter((id) => !visibleAt(id));
        const window = ev.verb === "accumulate" ? clamp(span * 1.1, sec(0.9), sec(1.9)) * paceK : clamp(sec(0.25) * fresh.length, sec(0.1), sec(0.8));
        fresh.forEach((id, i) => {
          const at = ev.verb === "accumulate" ? accumulate(i, fresh.length, f, f + window) : f + Math.round((window * i) / Math.max(1, fresh.length));
          const kind = tracks.get(id)!.kind;
          const home = placeOf(homeOf(id));
          const role = KINDS[kind].role;
          const where = into ?? undefined;
          if (where && containers.has(where) && role === "panel") {
            appear(id, at, panelPose(where), home.id, 0);
            attach(id, where, "panel", at);
          } else if (role === "item" || role === "app") {
            appear(id, at, pilePose(id, intoArea ?? home), home.id, dirCounter++);
          } else {
            appear(id, at, isContainer(kind) ? centerPose(intoArea ?? home) : freePose(intoArea ?? home, id), home.id, 0);
          }
          // pops: every other arrival of a pile (at most 4); the first few single entrances
          if (ev.verb === "accumulate") sfxAt(at + 6, "soft_pop", (role === "item" || role === "app") && i % 2 === 0 && i < 8);
          else sfxAt(at + 4, "soft_pop", i < 3);
        });
        ids.filter(visibleAt).filter((id) => !fresh.includes(id)).forEach((id, i) => emphasize(id, f + i * 2));
        break;
      }
      case "reveal": {
        ids.forEach((id, i) => {
          const at = f + i * 4;
          if (visibleAt(id)) return emphasize(id, at);
          const home = placeOf(homeOf(id));
          const role = KINDS[tracks.get(id)!.kind].role;
          if (into && containers.has(into) && (role === "panel" || ev.slot === "panel")) {
            appear(id, at, panelPose(into), home.id, 0);
            attach(id, into, "panel", at);
          } else appear(id, at, isContainer(tracks.get(id)!.kind) ? centerPose(intoArea ?? home) : freePose(intoArea ?? home, id), home.id, dirCounter++);
          sfxAt(at + 4, "reveal", i === 0);
        });
        break;
      }
      case "emphasize":
        ids.filter(visibleAt).forEach((id, i) => emphasize(id, f + i * 2));
        sfxAt(f + 2, "subtle_impact", true);
        break;
      case "converge": {
        const dest = into ?? undefined;
        if (dest && !visibleAt(dest)) {
          const home = placeOf(homeOf(dest));
          appear(dest, f, centerPose(home), home.id, 0);
          issues.push(`"${dest}" was not on screen for converge; revealed automatically`);
        }
        const movers = ids.filter((id) => visibleAt(id) && id !== dest);
        // nearest to the destination first
        const target = dest ? status.get(dest)!.rest : centerPose(intoArea ?? area);
        movers.sort((a, b) => Math.abs(status.get(a)!.rest.x - target.x) - Math.abs(status.get(b)!.rest.x - target.x));
        let items = 0;
        let apps = 0;
        movers.forEach((id, i) => {
          const s = status.get(id)!;
          const start = Math.max(f + i * 3, s.busy - sec(0.2));
          const role = KINDS[tracks.get(id)!.kind].role;
          let pose: Pose;
          if (dest && containers.has(dest)) {
            const c = containerRect(dest);
            if (role === "app") {
              const k = apps++;
              pose = { x: c.left - 150 + (k % 2) * 40, y: c.top + 190 + k * 150, rot: (k % 2 ? 1 : -1) * 5, scale: 0.92, opacity: 1 };
            } else {
              const k = items++;
              pose = { x: c.left + 470 + (k % 4) * 190, y: c.top + 330 + Math.floor(k / 4) * 230 + (k % 2) * 36, rot: ((k * 37) % 11) - 5, scale: 0.92, opacity: 1 };
            }
          } else if (dest) {
            // into an object that isn't a container: it takes them in (absorbed)
            pose = { x: target.x + jitter(id, 5) * 40, y: target.y + jitter(id, 6) * 20, rot: 0, scale: 0.35, opacity: 1 };
          } else {
            const a = i * 2.39996;
            pose = { x: target.x + Math.cos(a) * 320, y: target.y + Math.sin(a) * 200, rot: jitter(id, 5) * 5, scale: 0.85, opacity: 1 };
          }
          const trackNow = tracks.get(id)!;
          const fromPose = evaluatePose(trackNow, start);
          const dur = sec(1.55);
          push(id, { frame: start, pose, pattern: "converge", dur, lift: (i % 2 ? 1 : -1) * 260, from: fromPose, verb: "converge" });
          if (dest && !containers.has(dest)) {
            push(id, { frame: start + dur - 8, pose: { ...pose, scale: 0.15, opacity: 0 }, pattern: "exit", dur: 8 });
            s.visible = false;
            emphasize(dest, start + dur - 4);
          }
          if (dest) s.area = status.get(dest)!.area;
          if (dest && containers.has(dest)) received.set(id, dest);
        });
        sfxAt(f + 4, "whoosh", true);
        break;
      }
      case "arrange":
      case "dock": {
        const dest = into ?? ids.map((id) => received.get(id)).find(Boolean);
        if (!dest || !containers.has(dest)) {
          arrangeGrid(ids.filter(visibleAt), f, intoArea ?? area);
          break;
        }
        const c = containers.get(dest)!;
        const apps = ids.filter((id) => visibleAt(id) && (ev.verb === "dock" || KINDS[tracks.get(id)!.kind].dockable));
        const items = ids.filter((id) => visibleAt(id) && !apps.includes(id) && KINDS[tracks.get(id)!.kind].role === "item");
        apps.forEach((id, j) => {
          const at = Math.max(f + j * sec(0.18), status.get(id)!.busy - sec(0.3));
          const k = c.dock.length;
          c.dock.push(id);
          push(id, { frame: at, pose: dockPose(dest, k), pattern: "snap", dur: sec(0.45) });
          state(id, "morph", at, 1, sec(0.5));
          attach(id, dest, "dock", at);
          sfxAt(at + 3, "click", j === 0);
        });
        // Column distribution: most to do, some in progress, some already done.
        const n = items.length;
        const done = Math.floor(n / 4);
        const prog = Math.floor(n / 4);
        items.forEach((id, i) => {
          const col = i < n - done - prog ? 0 : i < n - done ? 1 : 2;
          const at = Math.max(f + sec(0.2) + i * sec(0.2), status.get(id)!.busy - sec(0.3));
          const row = c.cols[col].length;
          c.cols[col].push(id);
          c.total++;
          push(id, { frame: at, pose: slotPose(dest, col, Math.min(row, WORKSPACE.cols.maxRows - 1)), pattern: "snap", dur: sec(0.45) });
          state(id, "morph", at, 1, sec(0.45));
          attach(id, dest, "item", at);
          if (col === 2) state(id, "check", at + 5, 1, 8);
          sfxAt(at + 3, "click", i === 0 || i === Math.floor(n / 2));
        });
        if (n && !organized.has(dest)) state(dest, "morph", f + sec(0.1), 1, sec(0.9)); // placeholders → real columns
        if (n) organized.add(dest);
        break;
      }
      case "complete": {
        const list = ids.filter(visibleAt);
        const step = Math.min(sec(0.5), Math.max(sec(0.2), Math.floor(span / (list.length + 1))));
        list.forEach((id, i) => {
          const at = Math.max(f + sec(0.3) + i * step, status.get(id)!.busy);
          state(id, "check", at, 1, 8);
          const s = status.get(id)!;
          const cid = s.container;
          const c = cid ? containers.get(cid) : undefined;
          if (!c || !cid || s.col === undefined) return;
          if (s.col !== 2) {
            const col = s.col;
            const idx = c.cols[col].indexOf(id);
            c.cols[col].splice(idx, 1);
            c.cols[2].push(id);
            push(id, { frame: at + sec(0.3), pose: slotPose(cid, 2, Math.min(c.cols[2].length - 1, WORKSPACE.cols.maxRows - 1)), pattern: "snap", dur: sec(0.45), verb: "complete" });
            s.col = 2;
            // the ones below re-flow up
            c.cols[col].slice(idx).forEach((other, k) => {
              push(other, { frame: at + sec(0.3) + 4 + k * 3, pose: slotPose(cid, col, idx + k), pattern: "snap", dur: sec(0.45) });
              status.get(other)!.row = idx + k;
            });
          }
          sfxAt(at + 2, "click", i === 0);
        });
        if (list.length) sfxAt(f + sec(0.3) + (list.length - 1) * step + sec(0.4), "success_chime", true);
        break;
      }
      case "build": {
        ids.forEach((id, i) => {
          const home = placeOf(homeOf(id));
          if (!visibleAt(id)) {
            if (into && containers.has(into)) {
              appear(id, f, panelPose(into), home.id, 0);
              attach(id, into, "panel", f);
            } else appear(id, f, freePose(home, id), home.id, 0);
          }
          state(id, "build", f + i * 4, 1, Math.max(sec(1.2), Math.min(span, sec(2.4))));
          sfxAt(f + i * 4 + 4, "reveal", i === 0); // a subtle rise as it builds
          if (!status.get(id)!.container) state(id, "value", f + i * 4, 100, Math.max(sec(1.2), Math.min(span, sec(2.4))));
        });
        break;
      }
      case "type": {
        ids.filter(visibleAt).forEach((id) => state(id, "typed", f + 4, 1, clamp(span * 0.7, sec(0.8), sec(2))));
        sfxAt(f + 4, "typing", true);
        break;
      }
      case "move": {
        ids.filter(visibleAt).forEach((id, i) => {
          const s = status.get(id)!;
          const at = Math.max(f + i * 3, s.busy - sec(0.2));
          let pose: Pose;
          if (into) {
            const tr = status.get(into)?.rest ?? centerPose(placeOf(homeOf(into)));
            const sz = sizeOf(into);
            pose = tracks.get(id)!.kind === "cursor" ? { x: tr.x + sz.w * 0.3, y: tr.y + sz.h * 0.2, rot: 0, scale: 1, opacity: 1 } : { x: tr.x + sz.w / 2 + 80 + sizeOf(id).w / 2, y: tr.y, rot: 0, scale: 1, opacity: 1 };
          } else {
            const target = intoArea ?? area;
            pose = { ...pilePose(id, target) };
            s.area = target.id;
          }
          push(id, { frame: at, pose, pattern: "arrive", dur: sec(0.8), verb: "move" });
        });
        break;
      }
      case "transform": {
        const dest = into;
        ids.filter(visibleAt).forEach((id) => {
          const s = status.get(id)!;
          const at = Math.max(f, s.busy - sec(0.2));
          if (dest && dest !== id) {
            const home = placeOf(homeOf(dest));
            if (!visibleAt(dest)) {
              // the result grows out of the source and takes its place
              appear(dest, at + sec(0.15), { ...s.rest, rot: 0, scale: 1, opacity: 1 }, home.id, 0);
              const t = tracks.get(dest)!;
              t.motion[0].pose = { ...s.rest, opacity: 0, scale: 0.6 };
            }
            push(id, { frame: at, pose: { ...status.get(dest)!.rest, scale: 0.5, opacity: 0 }, pattern: "exit", dur: sec(0.5) });
            s.visible = false;
          } else {
            state(id, "morph", at, 1, sec(0.5));
          }
        });
        sfxAt(f + 2, "reveal", true);
        break;
      }
      case "exit": {
        ids.filter(visibleAt).forEach((id, i) => {
          const s = status.get(id)!;
          const at = Math.max(f + i * 3, s.busy - sec(0.2));
          const a = placeOf(s.area);
          const dx = s.rest.x - a.rect.x || 1;
          push(id, { frame: at, pose: { ...s.rest, x: s.rest.x + Math.sign(dx) * 1600, opacity: 0 }, pattern: "exit", dur: sec(0.55) });
          s.visible = false;
        });
        sfxAt(f + 2, "whoosh", true);
        break;
      }
    }
  }

  function attach(id: string, cid: string, as: "item" | "dock" | "panel", at: number) {
    const s = status.get(id)!;
    s.container = cid;
    tracks.get(id)!.container = cid;
    tracks.get(id)!.attachedAt ??= at;
    if (as === "item") {
      const c = containers.get(cid)!;
      const col = c.cols.findIndex((l) => l.includes(id));
      s.col = col;
      s.row = c.cols[col].indexOf(id);
    }
    if (as === "panel") {
      containers.get(cid)!.panel = id;
      state(id, "morph", at, 1, 1);
    }
  }
  function emphasize(id: string, at: number) {
    tracks.get(id)!.impulses.push({ frame: at, amp: 9 });
    state(id, "pulse", at, 1, 1, true);
  }
  function arrangeGrid(ids: string[], f: number, area: AreaTrack) {
    const n = ids.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
    ids.forEach((id, i) => {
      const sz = sizeOf(id);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rows = Math.ceil(n / cols);
      const pose = { x: area.rect.x + (col - (cols - 1) / 2) * (sz.w + 40), y: area.rect.y + (row - (rows - 1) / 2) * (sz.h + 36), rot: 0, scale: 1, opacity: 1 };
      push(id, { frame: Math.max(f + i * 4, status.get(id)!.busy - sec(0.3)), pose, pattern: "snap", dur: sec(0.45) });
      status.get(id)!.area = area.id;
    });
  }
  function sfxAt(frame: number, kind: keyof typeof SFX_LIBRARY, when: boolean) {
    if (when) sfx.push({ frame, kind });
  }

  // Objects never targeted by any event still appear in their home area when
  // the story first gets there (nothing in the cast is silently dropped).
  for (const c of story.cast) {
    if (tracks.get(c.id)!.motion.length) continue;
    const home = placeOf(c.home);
    const mi = story.moments.findIndex((m) => placeOf(m.area).id === home.id);
    const at = mi >= 0 ? starts[mi] : 0;
    appear(c.id, at, KINDS[c.kind].role === "item" || KINDS[c.kind].role === "app" ? pilePose(c.id, home) : centerPose(home), home.id, dirCounter++);
    issues.push(`"${c.id}" had no events; shown in its home area`);
  }

  // A container's progress (and its panel) = share of its items checked so far,
  // derived from when each item actually gets checked.
  for (const [cid, c] of containers) {
    const items = c.cols.flat();
    if (!items.length) continue;
    const checks = items.map((id) => tracks.get(id)!.state.find((k) => k.field === "check")?.frame).filter((f): f is number => f !== undefined).sort((a, b) => a - b);
    checks.forEach((frame, k) => {
      state(cid, "value", frame, ((k + 1) / items.length) * 100, 10);
      if (c.panel) state(c.panel, "value", frame, ((k + 1) / items.length) * 100, 10);
    });
  }

  const objects = [...tracks.values()];
  // State keys chain in time order.
  for (const t of objects) t.state.sort((a, b) => a.frame - b.frame);
  const byBirth = [...objects].sort((a, b) => a.born - b.born);
  byBirth.forEach((t, i) => (t.z = isContainer(t.kind) ? 1 : KINDS[t.kind].role === "panel" ? 5 : 10 + i));

  // An area lights up when something first happens there.
  for (const a of areas) {
    const born = objects.filter((o) => placeOf(homeOf(o.id)).id === a.id).map((o) => o.born);
    a.lit = Math.min(a.enter, ...born);
  }

  // 5. Camera: shots frame their subject at the moment's key times; one spline.
  story.moments.forEach((m, mi) =>
    marks.push({ frame: starts[mi], end: ends[mi], cue: m.cue, intent: m.intent, area: placeOf(m.area).id, subject: m.camera?.subject ?? "", shot: m.camera?.shot ?? "", action: actionFrames[mi], sfx: sfxFrames[mi], matched: found[mi] !== null }),
  );
  const camera = planCamera();

  function subjectBox(sel: string, frame: number) {
    const ids = sel.split(",").flatMap((p) => {
      const part = p.trim();
      if (part === "all") return objects.filter((o) => o.born <= frame).map((o) => o.id);
      if (part === "all_loose") return objects.filter((o) => looseAt(o, frame)).map((o) => o.id);
      if (part.startsWith("group:")) return story.cast.filter((c) => c.group === part.slice(6)).map((c) => c.id);
      if (part.endsWith("*")) return castIds.filter((id) => id.startsWith(part.slice(0, -1)));
      return tracks.has(part) ? [part] : [];
    });
    let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
    for (const id of ids) {
      const t = tracks.get(id)!;
      // Frame where things are heading: an object still flying in counts at
      // its landing spot (the camera leads the action instead of chasing it).
      const entering = [...t.motion].reverse().find((k) => k.frame <= frame);
      const landing = entering?.pattern === "enter" && frame - entering.frame < sec(0.6);
      const p = landing ? { ...entering.pose, lift: 0 } : evaluatePose(t, frame);
      if (t.born > frame || p.opacity < 0.5) continue;
      const k = KINDS[t.kind];
      const m = evaluateState(t, frame).morph;
      const w = lerp(k.loose.w, (k.organized ?? k.loose).w, m) * p.scale;
      const h = lerp(k.loose.h, (k.organized ?? k.loose).h, m) * p.scale;
      const b = { x0: p.x - w / 2, y0: p.y - h / 2, x1: p.x + w / 2, y1: p.y + h / 2 };
      box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b;
    }
    return box;
  }

  function planCamera(): CameraKey[] {
    const keys: CameraKey[] = [];
    const fit = (box: { x0: number; y0: number; x1: number; y1: number }, margin: number) =>
      clamp(Math.min((W * 0.82) / (box.x1 - box.x0), (H * 0.8) / (box.y1 - box.y0)) * margin, 0.55, MAX_ZOOM);
    const frameBox = (t: number, sel: string, margin: number, shot: Shot, subject: string, shiftX = 0) => {
      const box = subjectBox(sel, Math.min(duration - 1, Math.round(t * fps)));
      if (!box) return;
      const z = fit(box, margin);
      keys.push({ t, x: (box.x0 + box.x1) / 2 - shiftX / z, y: (box.y0 + box.y1) / 2, z, shot, subject });
    };
    // Opening: close on the first thing that appears.
    const first = [...objects].sort((a, b) => a.born - b.born)[0];
    if (first) {
      const p = evaluatePose(first, first.born + sec(0.7));
      const w = KINDS[first.kind].loose.w;
      keys.push({ t: 0, x: p.x, y: p.y, z: clamp((0.45 * W) / w, 0.6, MAX_ZOOM), shot: "open", subject: first.id });
    }
    const closing = story.closing?.text?.length ? W * 0.17 : 0;
    story.moments.forEach((m, mi) => {
      const shot = m.camera?.shot ?? defaultShot(m);
      const subject = m.camera?.subject ?? defaultSubject(m);
      const s = starts[mi] / fps;
      const e = Math.max(s + 0.4, ends[mi] / fps);
      const span = e - s;
      const last = mi === story.moments.length - 1;
      switch (shot) {
        case "establish":
          frameBox(s + span * 0.85, subject, 0.95, shot, subject);
          break;
        case "follow":
          frameBox(s + span * 0.4, subject, 1, shot, subject);
          frameBox(s + span * 0.95, subject, 1, shot, subject);
          break;
        case "push":
          frameBox(s + span * 0.35, subject, 0.98, shot, subject);
          frameBox(s + span * 0.95, subject, 1.14, shot, subject);
          break;
        case "track":
          for (const k of [0.3, 0.65, 1]) frameBox(s + span * k, subject, 1, shot, subject);
          break;
        case "reveal":
          frameBox(s + span * 0.9, subject, 1, shot, subject);
          break;
        case "hold":
          frameBox(s + span * 0.9, subject, 1.03, shot, subject);
          break;
        case "pull_back":
          frameBox(s + Math.min(span, 1.4), subject, last ? 0.62 : 0.8, shot, subject, last ? closing : 0);
          break;
      }
    });
    // Tracking shots never go too wide: a subject in flight stays readable.
    for (const k of keys) if (k.shot === "track") k.z = Math.max(k.z, 0.72);
    const endT = duration / fps;
    const lastKey = keys[keys.length - 1];
    if (lastKey) keys.push({ ...lastKey, t: endT, z: lastKey.z * 0.97, shot: "settle" });
    keys.sort((a, b) => a.t - b.t);
    const merged: CameraKey[] = [];
    for (const k of keys) {
      if (merged.length && k.t - merged[merged.length - 1].t < 0.3) merged[merged.length - 1] = { ...k, t: merged[merged.length - 1].t === 0 ? 0 : k.t };
      else merged.push(k);
    }
    // Speed limit: a long move takes the time it needs (the camera arrives a
    // little after the action rather than whipping across the world).
    const out: CameraKey[] = [];
    for (const k of merged) {
      const prev = out[out.length - 1];
      if (!prev) {
        out.push(k);
        continue;
      }
      const z = (prev.z + k.z) / 2;
      const travel = Math.hypot(k.x - prev.x, k.y - prev.y) * z + Math.abs(Math.log(k.z / prev.z)) * W;
      const t = Math.max(k.t, prev.t + Math.max(0.3, travel / CAMERA_SPEED));
      if (t <= endT) out.push({ ...k, t });
    }
    if (out[out.length - 1].t < endT) out.push({ ...out[out.length - 1], t: endT, shot: "settle" });
    return out;
  }

  // 6. Lighting over time from the areas the story passes through.
  const lighting: RenderTimeline["lighting"] = [];
  const ordered = [...areas].sort((a, b) => a.enter - b.enter);
  ordered.forEach((a, i) => {
    const color = LIGHT[a.kind] ?? LIGHT.neutral;
    if (i === 0) lighting.push({ frame: 0, color });
    else if (a.kind === "hero") {
      lighting.push({ frame: a.enter, color: lighting[lighting.length - 1].color });
      lighting.push({ frame: a.enter + sec(1.2), color });
    } else lighting.push({ frame: a.enter, color });
  });

  // 7. Closing text over the resolve.
  const resolveIndex = Math.max(0, story.moments.map((m) => m.intent).lastIndexOf("resolve"));
  const resolveFrame = story.moments.length ? starts[resolveIndex === -1 ? story.moments.length - 1 : resolveIndex] : 0;
  // Each closing line appears as it is spoken (when the narration says it),
  // otherwise staggered after the resolve.
  let lineFrom = story.moments.length ? cueWord[resolveIndex] : 0;
  let lastLine = resolveFrame;
  (story.closing?.text ?? []).slice(0, 3).forEach((line, i) => {
    const hit = findCue(spoken, line, lineFrom);
    if (hit) lineFrom = hit.index + 1;
    const frame = hit ? Math.max(0, Math.round(hit.at * fps) - 3) : i === 0 ? resolveFrame + sec(0.4) : lastLine + sec(0.9);
    lastLine = Math.max(frame, lastLine + (i ? 6 : 0));
    text.push({ frame: lastLine, content: line, role: "closing", line: i });
  });
  const finalArea = ordered[ordered.length - 1];

  return {
    fps,
    width: W,
    height: H,
    durationInFrames: duration,
    areas,
    lighting,
    objects,
    camera,
    text,
    textTone: finalArea?.kind === "hero" ? "dark" : "light",
    sfx: planEventSfx(sfx, duration),
    moments: marks,
    timing: synced ? "voice" : "estimated",
    issues: synced ? issues : [...issues, "no voice word timing: cue times estimated from the narration"],
  };
}

function defaultShot(m: Moment): Shot {
  const v = m.events[0]?.verb;
  if (m.intent === "resolve") return "pull_back";
  if (v === "accumulate" || v === "enter") return "follow";
  if (v === "converge" || v === "move") return "track";
  if (v === "arrange" || v === "dock" || v === "complete" || v === "build") return "push";
  return "hold";
}
function defaultSubject(m: Moment) {
  return m.events[0]?.into ?? m.events[0]?.targets ?? "all";
}

// Moments whose cue wasn't found are spread between their found neighbours.
function fillGaps(found: (number | null)[], duration: number) {
  const out = [...found];
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== null) continue;
    const prevI = [...Array(i).keys()].reverse().find((j) => out[j] !== null);
    const nextI = out.findIndex((v, j) => j > i && v !== null);
    const a = prevI === undefined ? 0 : (out[prevI] as number);
    const b = nextI === -1 ? duration - sec(1) : (out[nextI] as number);
    const from = prevI === undefined ? -1 : prevI;
    const to = nextI === -1 ? out.length : nextI;
    for (let j = from + 1; j < to; j++) out[j] = Math.round(a + ((b - a) * (j - from)) / (to - from));
  }
  const res = out as number[];
  for (let i = 1; i < res.length; i++) res[i] = Math.max(res[i], res[i - 1] + 6);
  return res;
}

function layoutAreas(story: VisualStory, starts: number[], ends: number[], duration: number): AreaTrack[] {
  const firstUse = (id: string) => {
    const i = story.moments.findIndex((m) => m.area === id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  const list = [...story.world.areas].sort((a, b) => firstUse(a.id) - firstUse(b.id));
  const hasHome = (id: string) => story.cast.some((c) => c.home === id);
  const out: AreaTrack[] = [];
  let x = 900;
  let lastPlaced: AreaTrack | null = null;
  for (const a of list) {
    const i = firstUse(a.id);
    const enter = i === Number.POSITIVE_INFINITY ? duration : starts[i];
    const lastI = story.moments.map((m) => m.area).lastIndexOf(a.id);
    const leave = lastI === -1 ? duration : ends[lastI];
    if (a.kind === "convergence") {
      out.push({ id: a.id, kind: a.kind, mood: a.mood, rect: { x: 0, y: WORLD_Y, w: 0, h: 0 }, enter, lit: enter, leave });
      continue;
    }
    // An area with nothing of its own is a lighting state on the previous place
    // (e.g. the clarity/hero resolve happening where the result is).
    if (lastPlaced && !hasHome(a.id)) {
      out.push({ id: a.id, kind: a.kind, mood: a.mood, rect: { ...lastPlaced.rect }, enter, lit: enter, leave, colocated: true });
      continue;
    }
    if (lastPlaced) x += AREA_GAP;
    const track: AreaTrack = { id: a.id, kind: a.kind, mood: a.mood, rect: { x, y: WORLD_Y, w: 2000, h: 1300 }, enter, lit: enter, leave };
    out.push(track);
    lastPlaced = track;
  }
  // Corridors run between their neighbouring places.
  for (const c of out.filter((a) => a.kind === "convergence")) {
    const placed = out.filter((a) => a.kind !== "convergence" && !a.colocated);
    const before = [...placed].reverse().find((p) => p.enter <= c.enter) ?? placed[0];
    const after = placed.find((p) => p.enter > c.enter || p.rect.x > (before?.rect.x ?? 0)) ?? before;
    c.from = { x: before.rect.x, y: before.rect.y };
    c.to = { x: after.rect.x, y: after.rect.y };
    c.rect = { x: (before.rect.x + after.rect.x) / 2, y: WORLD_Y, w: Math.abs(after.rect.x - before.rect.x), h: 1300 };
  }
  return out;
}

// Event-derived SFX: spaced, capped and mapped to the library files.
function planEventSfx(cues: { frame: number; kind: keyof typeof SFX_LIBRARY }[], duration: number): SfxCue[] {
  const out: SfxCue[] = [];
  const priority: Record<string, number> = { whoosh: 3, success_chime: 3, subtle_impact: 2, reveal: 2, click: 1, typing: 2, soft_pop: 0, digital_processing: 0 };
  for (let c of [...cues].sort((a, b) => a.frame - b.frame || priority[b.kind] - priority[a.kind])) {
    const src = SFX_LIBRARY[c.kind];
    if (!src || c.frame > duration - 8) continue;
    c = { ...c, frame: Math.max(0, c.frame) }; // pre-roll actions sound at the first frame
    const prev = out[out.length - 1];
    if (prev && c.frame - prev.frame < 7) {
      if ((priority[c.kind] ?? 0) > (priority[prev.kind] ?? 0)) out[out.length - 1] = { frame: c.frame, kind: c.kind, src };
      continue;
    }
    out.push({ frame: c.frame, kind: c.kind, src });
    if (out.length >= 16) break;
  }
  return out;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
