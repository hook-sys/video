import { accumulate, sec, type Vec } from "./motion-patterns";

// Hard-coded visual plan for the reference script (Phase 1: renderer proof).
// "Too many tasks. Too many tabs. Too much to manage. Bring everything together
// in one simple workspace. Organize your work, track your progress, and get
// more done. Less chaos. More clarity."
//
// Everything lives in one world (pixel coordinates). Chaos sits on the left,
// the workspace on the right; the camera travels between them.

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = sec(15);

// Story beats (frames).
export const BEAT = {
  tasksFrom: -sec(0.25), // first card is already arriving at frame 0
  tasksTo: sec(1.9),
  tabsFrom: sec(1.3),
  tabsTo: sec(2.6),
  overwhelm: sec(2.7), // "Too much to manage": badges pop, the pile jolts
  workspaceIn: sec(3.3),
  converge: sec(3.8), // "Bring everything together"
  organize: sec(6.0), // "Organize your work"
  progress: sec(9.0), // "track your progress, and get more done"
  clarity: sec(12.0),
  less: sec(12.5), // "Less chaos."
  more: sec(13.4), // "More clarity."
};

// The workspace (app window) in world space.
export const WS = { x: 3000, y: 1000, w: 1600, h: 960 };
export const WS_LEFT = WS.x - WS.w / 2;
export const WS_TOP = WS.y - WS.h / 2;
export const LAYOUT = {
  header: 110,
  sidebar: { x: 28, y: 170, w: 214, h: 52, gap: 64 },
  cols: { x: 282, y: 214, w: 272, gap: 24, rowH: 88, rowGap: 14 },
  chart: { x: 1176, y: 140, w: 396, h: 792 },
};
export const COLUMNS = ["To do", "In progress", "Done"];

export const slotPos = (col: number, row: number): Vec => ({
  x: WS_LEFT + LAYOUT.cols.x + col * (LAYOUT.cols.w + LAYOUT.cols.gap) + LAYOUT.cols.w / 2,
  y: WS_TOP + LAYOUT.cols.y + 44 + row * (LAYOUT.cols.rowH + LAYOUT.cols.rowGap) + LAYOUT.cols.rowH / 2,
});
export const sidebarPos = (i: number): Vec => ({
  x: WS_LEFT + LAYOUT.sidebar.x + LAYOUT.sidebar.w / 2,
  y: WS_TOP + LAYOUT.sidebar.y + i * LAYOUT.sidebar.gap + LAYOUT.sidebar.h / 2,
});

export type Dir = "left" | "right" | "top" | "bottom";
export const DIR_OFFSET: Record<Dir, Vec> = { left: { x: -1500, y: 60 }, right: { x: 1500, y: -60 }, top: { x: 80, y: -1100 }, bottom: { x: -80, y: 1100 } };

export type Task = {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  due: string;
  from: Dir;
  chaos: Vec & { rot: number };
  // Column/row over time: organize slot, then later moves during progress.
  slots: { at: number; col: number; row: number }[];
  doneAt?: number; // checkbox completes
};

// Tasks enter in this order; `chaos` is where each lands in the pile.
const TASKS_BASE: Omit<Task, "slots" | "doneAt">[] = [
  { id: "task_1", title: "Finalize Q3 report", tag: "Finance", tagColor: "#f59e0b", due: "Today", from: "left", chaos: { x: 640, y: 900, rot: -7 } },
  { id: "task_2", title: "Reply to client email", tag: "Sales", tagColor: "#ef4444", due: "Overdue", from: "top", chaos: { x: 1010, y: 760, rot: 6 } },
  { id: "task_3", title: "Update roadmap", tag: "Product", tagColor: "#6366f1", due: "Tomorrow", from: "bottom", chaos: { x: 860, y: 1180, rot: 4 } },
  { id: "task_4", title: "Prepare pitch deck", tag: "Marketing", tagColor: "#ec4899", due: "Fri", from: "right", chaos: { x: 1300, y: 1040, rot: -9 } },
  { id: "task_5", title: "Fix login bug", tag: "Eng", tagColor: "#10b981", due: "Today", from: "left", chaos: { x: 420, y: 1160, rot: 10 } },
  { id: "task_6", title: "Design review", tag: "Design", tagColor: "#8b5cf6", due: "Today", from: "top", chaos: { x: 1240, y: 700, rot: -4 } },
  { id: "task_7", title: "Plan next sprint", tag: "Eng", tagColor: "#10b981", due: "Mon", from: "bottom", chaos: { x: 560, y: 660, rot: 8 } },
  { id: "task_8", title: "Onboard new hire", tag: "People", tagColor: "#0ea5e9", due: "Wed", from: "right", chaos: { x: 1000, y: 1330, rot: -12 } },
];

// Organized columns, then progress: task_5, task_6, task_1, task_2 get done
// and move to "Done"; the remaining to-dos re-flow up.
const P = BEAT.progress;
const doneMoves: Record<string, number> = { task_5: P + sec(0.3), task_6: P + sec(0.8), task_1: P + sec(1.3), task_2: P + sec(1.8) };
const MOVE = sec(0.3); // check first, then move
const ORGANIZE: Record<string, [number, number]> = {
  task_1: [0, 0], task_2: [0, 1], task_3: [0, 2], task_4: [0, 3],
  task_5: [1, 0], task_6: [1, 1],
  task_7: [2, 0], task_8: [2, 1],
};

export const TASKS: Task[] = TASKS_BASE.map((t, i) => {
  const [col, row] = ORGANIZE[t.id];
  const slots = [{ at: BEAT.organize + sec(0.2) + i * sec(0.2), col, row }];
  const done = doneMoves[t.id];
  if (done) {
    const doneRow = 2 + Object.keys(doneMoves).indexOf(t.id);
    slots.push({ at: done + MOVE, col: 2, row: doneRow });
  }
  // To-dos re-flow up when the ones above them leave.
  if (t.id === "task_3") slots.push({ at: doneMoves.task_1 + MOVE + 4, col: 0, row: 1 }, { at: doneMoves.task_2 + MOVE + 4, col: 0, row: 0 });
  if (t.id === "task_4") slots.push({ at: doneMoves.task_1 + MOVE + 7, col: 0, row: 2 }, { at: doneMoves.task_2 + MOVE + 7, col: 0, row: 1 });
  const alreadyDone = col === 2 ? slots[0].at + sec(0.15) : undefined;
  return { ...t, slots, doneAt: done ?? alreadyDone };
});
export const TASK_ENTER = (i: number) => accumulate(i, TASKS.length, BEAT.tasksFrom, BEAT.tasksTo);

export type Tab = { id: string; title: string; host: string; favicon: string; badge: number; from: Dir; chaos: Vec & { rot: number } };
export const TABS: Tab[] = [
  { id: "tab_1", title: "Inbox (24)", host: "mail", favicon: "#ef4444", badge: 24, from: "right", chaos: { x: 1180, y: 880, rot: 5 } },
  { id: "tab_2", title: "Calendar", host: "calendar", favicon: "#3b82f6", badge: 6, from: "top", chaos: { x: 760, y: 1010, rot: -6 } },
  { id: "tab_3", title: "Roadmap doc", host: "docs", favicon: "#6366f1", badge: 3, from: "right", chaos: { x: 1420, y: 760, rot: 9 } },
  { id: "tab_4", title: "Team chat", host: "chat", favicon: "#a855f7", badge: 58, from: "bottom", chaos: { x: 520, y: 800, rot: -10 } },
  { id: "tab_5", title: "Analytics", host: "analytics", favicon: "#10b981", badge: 9, from: "top", chaos: { x: 1080, y: 1230, rot: 7 } },
];
export const TAB_ENTER = (i: number) => accumulate(i, TABS.length, BEAT.tabsFrom, BEAT.tabsTo, 1.4);
export const TAB_SIDEBAR_AT = (i: number) => BEAT.organize + i * sec(0.18);

// Convergence: every object (tasks and tabs interleaved) sweeps toward the
// workspace with a stagger; staging = where it hovers loosely on arrival.
export const CONVERGE_ORDER = ["task_7", "tab_4", "task_1", "task_5", "tab_2", "task_3", "task_2", "tab_1", "task_6", "tab_5", "task_4", "tab_3", "task_8"];
export const convergeStart = (id: string) => BEAT.converge + CONVERGE_ORDER.indexOf(id) * 3;
export const CONVERGE_DUR = sec(1.55);
export function stagingPos(id: string, i: number, kind: "task" | "tab"): Vec & { rot: number } {
  if (kind === "tab") return { x: WS_LEFT - 150 + (i % 2) * 40, y: WS_TOP + 190 + i * 150, rot: (i % 2 ? 1 : -1) * 5 };
  return { x: WS_LEFT + 470 + (i % 4) * 190, y: WS_TOP + 330 + Math.floor(i / 4) * 230 + (i % 2) * 36, rot: ((i * 37) % 11) - 5 };
}

// One continuous camera path: [seconds, centre x, centre y, zoom].
export const CAMERA: [number, number, number, number][] = [
  [0.0, 600, 890, 1.6], // close on the first task
  [0.9, 720, 920, 1.3], // widening as tasks pile up
  [1.9, 860, 980, 1.04],
  [2.8, 930, 1000, 0.9], // "too much to manage": the full mess
  [3.6, 1060, 1000, 0.88],
  [4.6, 1880, 990, 0.74], // following the sweep toward the workspace
  [5.6, 2760, 1000, 0.8],
  [6.4, 2930, 1000, 1.0], // push into the workspace
  [8.2, 2920, 1000, 1.1], // follow the organizing
  [9.2, 3020, 1000, 1.04],
  [10.6, 3270, 990, 1.28], // push toward the progress being built
  [11.7, 3160, 1000, 1.06],
  [13.1, 2640, 1020, 0.62], // pull back to the clean result
  [15.0, 2600, 1020, 0.6],
];
