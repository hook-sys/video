import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrowserTab, FONT, INDIGO, INK, TaskCard, Workspace } from "./actors";
import { build, converge, enter, FPS, lerp, lerpVec, ramp, reveal, sec, settle, smoothPath, snap, transform, type Vec } from "../engine/motion-patterns";
import {
  BEAT,
  CAMERA,
  CONVERGE_DUR,
  convergeStart,
  DIR_OFFSET,
  sidebarPos,
  slotPos,
  stagingPos,
  TAB_ENTER,
  TAB_SIDEBAR_AT,
  TABS,
  TASK_ENTER,
  TASKS,
  WS,
} from "./plan";
import { CameraSpace, WorldBackdrop, type Cam } from "./world";

// Phase 1 reference: ONE continuous 15 s timeline for the reference script.
// Every object is mounted once for the whole video and its pose is a function
// of the frame; the camera follows one smooth path through one world.

type Pose = Vec & { rot: number; scale: number; opacity: number; lift: number };

const ENTRY_TILT: Record<string, number> = { left: -28, right: 28, top: 18, bottom: -18 };

// Shared life of a task or tab until it reaches the workspace:
// enter → accumulate in the pile → jolt ("too much") → converge on an arc.
function loosePose(frame: number, id: string, i: number, enterAt: number, from: keyof typeof DIR_OFFSET, chaos: Vec & { rot: number }, stage: Vec & { rot: number }): Pose {
  const e = enter(frame, enterAt);
  const start = { x: chaos.x + DIR_OFFSET[from].x, y: chaos.y + DIR_OFFSET[from].y };
  let pos = lerpVec(start, chaos, e);
  let rot = lerp(chaos.rot + ENTRY_TILT[from], chaos.rot, e);
  const jolt = BEAT.overwhelm + i * 2;
  rot += settle(frame, jolt, 3.5);
  pos = { x: pos.x + settle(frame, jolt + 1, 7), y: pos.y + settle(frame, jolt, 9) };
  const cs = convergeStart(id);
  const c = converge(frame, cs, CONVERGE_DUR, chaos, stage, (i % 2 ? 1 : -1) * 260);
  if (frame >= cs) {
    pos = c.pos;
    rot = lerp(chaos.rot, stage.rot, c.t);
  }
  return { ...pos, rot, scale: lerp(1, 0.92, c.t), opacity: frame < enterAt ? 0 : Math.min(1, (frame - enterAt + 1) / 4), lift: Math.sin(Math.PI * c.t) };
}

function Actor({ pose, z, children }: { pose: Pose; z: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: pose.x,
        top: pose.y,
        zIndex: z,
        opacity: pose.opacity,
        transform: `translate(-50%, -50%) rotate(${pose.rot}deg) scale(${pose.scale})`,
      }}
    >
      {children}
    </div>
  );
}

function WordReveal({ text, at, frame, size, color }: { text: string; at: number; frame: number; size: number; color: string }) {
  const t = reveal(frame, at, sec(0.55));
  return (
    <div style={{ overflow: "hidden", paddingBottom: size * 0.12 }}>
      <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 850, letterSpacing: -size * 0.035, color, lineHeight: 1.05, transform: `translateY(${(1 - t) * 105}%)`, opacity: t > 0 ? 1 : 0 }}>{text}</div>
    </div>
  );
}

export function ReferenceDemo() {
  const frame = useCurrentFrame();
  const [cx, cy, cz] = smoothPath(CAMERA.map(([t, ...v]) => ({ t, v })), frame / FPS);
  const cam: Cam = { x: cx, y: cy, z: cz };
  const calm = ramp(frame, BEAT.clarity, sec(1.4));

  // Tasks: loose card → converge → snap into the board (morphing into rows) →
  // checked and moved to Done as progress is made.
  const tasks = TASKS.map((t, i) => {
    const stage = stagingPos(t.id, i, "task");
    let pose = loosePose(frame, t.id, i, TASK_ENTER(i), t.from, t.chaos, stage);
    const [first, ...later] = t.slots;
    const p = snap(frame, first.at);
    let pos = lerpVec(pose, slotPos(first.col, first.row), p);
    let lift = pose.lift;
    for (const s of later) {
      const k = snap(frame, s.at);
      pos = lerpVec(pos, slotPos(s.col, s.row), k);
      lift = Math.max(lift, Math.sin(Math.PI * Math.min(1, k)) * 0.6);
    }
    pose = { ...pose, ...pos, rot: lerp(pose.rot, 0, p), scale: lerp(pose.scale, 1, p) + lift * 0.04, lift };
    const check = t.doneAt === undefined ? 0 : ramp(frame, t.doneAt, 8);
    return { t, i, pose, m: transform(frame, first.at, sec(0.45)), check, enterAt: TASK_ENTER(i) };
  });

  // Tabs: window → converge → morph into the workspace sidebar.
  const tabs = TABS.map((t, j) => {
    const stage = stagingPos(t.id, j, "tab");
    const base = loosePose(frame, t.id, j + 3, TAB_ENTER(j), t.from, t.chaos, stage);
    const at = TAB_SIDEBAR_AT(j);
    const p = snap(frame, at);
    const pose: Pose = { ...base, ...lerpVec(base, sidebarPos(j), p), rot: lerp(base.rot, 0, p), scale: lerp(base.scale, 1, p), opacity: base.opacity * lerp(1, 0.75, calm) };
    return { t, j, pose, m: transform(frame, at, sec(0.5)), badgePop: snap(frame, BEAT.overwhelm + j * 3), enterAt: TAB_ENTER(j) };
  });

  // The progress readouts are driven by the tasks' real state.
  const pct = tasks.reduce((n, x) => n + x.check, 0) * (100 / TASKS.length);
  const bars = [0.34, 0.46, 0.4, 0.63, 0.8, 1].map((h, i) => h * build(frame, BEAT.progress + sec(0.25) + i * sec(0.3)));
  const appear = Math.min(1, enter(frame, BEAT.workspaceIn));

  // Stacking: later arrivals on top while loose.
  const order = [...tasks.map((x) => ({ key: x.t.id, at: x.enterAt })), ...tabs.map((x) => ({ key: x.t.id, at: x.enterAt }))].sort((a, b) => a.at - b.at).map((x) => x.key);
  const z = (id: string) => 10 + order.indexOf(id);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <WorldBackdrop frame={frame} cam={cam} />
      <CameraSpace cam={cam}>
        <div style={{ position: "absolute", left: WS.x, top: WS.y, zIndex: 1, transform: "translate(-50%, -50%)" }}>
          <Workspace appear={appear} clean={ramp(frame, BEAT.organize + sec(0.1), sec(0.9))} bars={bars} pct={pct} chartIn={ramp(frame, BEAT.progress, sec(0.6))} calm={calm} />
        </div>
        {tabs.map(({ t, pose, m, badgePop }) => (
          <Actor key={t.id} pose={pose} z={z(t.id)}>
            <BrowserTab title={t.title} host={t.host} favicon={t.favicon} badge={t.badge} m={m} badgePop={badgePop} lift={pose.lift} />
          </Actor>
        ))}
        {tasks.map(({ t, pose, m, check }) => (
          <Actor key={t.id} pose={pose} z={z(t.id)}>
            <TaskCard title={t.title} tag={t.tag} tagColor={t.tagColor} due={t.due} m={m} check={check} lift={pose.lift} />
          </Actor>
        ))}
      </CameraSpace>

      {/* lens vignette for depth in the dark chaos; lifts as the clean workspace takes over */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)", opacity: 1 - ramp(frame, BEAT.converge + sec(0.8), sec(1.6)) }} />

      {/* Text supports the final picture; it is not the picture. */}
      <AbsoluteFill style={{ left: 130, top: 330, width: 640, height: "auto" }}>
        <WordReveal text="Less chaos." at={BEAT.less} frame={frame} size={104} color={INK} />
        <WordReveal text="More clarity." at={BEAT.more} frame={frame} size={104} color={INDIGO} />
        <div style={{ marginTop: 26, height: 8, width: 220 * reveal(frame, BEAT.more + sec(0.35), sec(0.6)), borderRadius: 4, background: "linear-gradient(90deg, #5b6cff, #22c55e)" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
