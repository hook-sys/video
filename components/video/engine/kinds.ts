import type { ObjectKind, SlotRole } from "./story";

// Object library metadata: size per state, how each kind behaves in a
// container, and which state names it understands. The renderer's components
// (objects.tsx) draw these sizes; the compiler lays out with them.

export type Size = { w: number; h: number };
export type KindSpec = {
  loose: Size; // free-floating size
  organized?: Size; // size once arranged/docked in a container (morph target)
  role: "item" | "app" | "container" | "panel" | "pointer" | "field" | "mark";
  states: string[];
  dockable?: boolean; // goes to a container's dock rather than its columns
};

export const KINDS: Record<ObjectKind, KindSpec> = {
  task_card: { loose: { w: 400, h: 156 }, organized: { w: 272, h: 88 }, role: "item", states: ["loose", "moving", "organized", "completed"] },
  generic_card: { loose: { w: 400, h: 156 }, organized: { w: 272, h: 88 }, role: "item", states: ["loose", "moving", "organized", "completed"] },
  message: { loose: { w: 440, h: 132 }, organized: { w: 272, h: 88 }, role: "item", states: ["loose", "moving", "organized", "completed"] },
  document: { loose: { w: 300, h: 380 }, organized: { w: 272, h: 88 }, role: "item", states: ["loose", "moving", "organized", "completed"] },
  browser_tab: { loose: { w: 440, h: 290 }, organized: { w: 214, h: 52 }, role: "app", states: ["floating", "moving", "docked"], dockable: true },
  workspace: { loose: { w: 1600, h: 960 }, role: "container", states: ["empty", "receiving", "organized", "productive"] },
  progress_panel: { loose: { w: 520, h: 640 }, organized: { w: 396, h: 792 }, role: "panel", states: ["empty", "building", "complete"] },
  metric: { loose: { w: 440, h: 230 }, organized: { w: 396, h: 230 }, role: "panel", states: ["hidden", "counting", "settled"] },
  input_field: { loose: { w: 980, h: 120 }, role: "field", states: ["idle", "typing", "submitted"] },
  cursor: { loose: { w: 56, h: 56 }, role: "pointer", states: ["idle", "moving", "pressed"] },
  hero_mark: { loose: { w: 760, h: 240 }, role: "mark", states: ["hidden", "revealed"] },
};

// Workspace slot geometry (offsets from its top-left), from the reference.
export const WORKSPACE = {
  header: 110,
  sidebar: { x: 28, y: 170, w: 214, h: 52, gap: 64 },
  cols: { x: 282, y: 214, w: 272, gap: 24, rowH: 88, rowGap: 14, maxRows: 7 },
  panel: { x: 1176, y: 140, w: 396, h: 792 },
  columns: ["todo", "in_progress", "done"] as SlotRole[],
};

export const isContainer = (k: ObjectKind) => KINDS[k].role === "container";
