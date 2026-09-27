import type { VisualPlan } from "@/lib/ai/product-brief";

// The "object field": a persistent set of objects (task cards, browser tabs,
// result cards) plus a workspace and a progress chart, laid out per scene from
// the storyboard's semantic plan. Each scene starts exactly where the previous
// planned scene left the objects, so the same objects travel through the story.

export const FIELD_OBJECTS: VisualPlan["primary_object"][] = ["task_cards", "browser_tabs", "workspace", "progress_chart"];

export type Skin = "task" | "tab" | "card";
// x/y: centre in % of frame; s: scale; rot: degrees; o: opacity.
export type Pose = { x: number; y: number; s: number; rot: number; o: number };
export type Rect = { x: number; y: number; w: number; h: number; o: number };
export type FieldItem = { id: number; skin: Skin; from: Pose; to: Pose; spawned: boolean };
export type FieldScene = {
  items: FieldItem[];
  workspace: { from: Rect; to: Rect };
  chart: { from: number; to: number }; // 0 hidden → 1 fully grown
  complete: boolean;
};

const SPAWN: Partial<Record<string, { skin: Skin; n: number }>> = {
  task_cards: { skin: "task", n: 5 },
  browser_tabs: { skin: "tab", n: 4 },
  result_card: { skin: "card", n: 3 },
  video_card: { skin: "card", n: 3 },
  feature_card: { skin: "card", n: 3 },
};

const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const jitter = (id: number, k: number, amount: number) => (hash(id * 7 + k) - 0.5) * 2 * amount;

const HIDDEN_RECT: Rect = { x: 50, y: 54, w: 60, h: 62, o: 0 };
const WORKSPACE: Rect = { x: 50, y: 56, w: 62, h: 62, o: 1 };

// Where a new object comes from: off-frame in a direction that varies per object.
function offscreen(to: Pose, id: number): Pose {
  const angle = hash(id * 3) * Math.PI * 2;
  return { x: to.x + Math.cos(angle) * 70, y: to.y + Math.sin(angle) * 60, s: to.s, rot: jitter(id, 1, 35), o: 0 };
}

// Layouts --------------------------------------------------------------

const pile = (id: number, i: number): Pose => ({ x: 50 + jitter(id, 2, 10), y: 56 + jitter(id, 3, 8) - i * 1.2, s: 1, rot: jitter(id, 4, 14), o: 1 });
const cascade = (i: number): Pose => ({ x: 34 + i * 8, y: 38 + i * 7, s: 1, rot: 0, o: 1 });
const scatter = (id: number, i: number, n: number): Pose => {
  const a = (i / Math.max(n, 1)) * Math.PI * 2 + hash(id) * 0.6;
  return { x: 50 + Math.cos(a) * (26 + jitter(id, 5, 6)), y: 56 + Math.sin(a) * (22 + jitter(id, 6, 5)), s: 0.85, rot: jitter(id, 7, 24), o: 1 };
};
const pushedBack = (p: Pose): Pose => ({ ...p, y: p.y - 6, s: p.s * 0.8, o: 0.45 });
// Items gathered loosely inside the workspace.
const gathered = (id: number, ws: Rect): Pose => ({ x: ws.x + jitter(id, 8, ws.w * 0.22), y: ws.y + jitter(id, 9, ws.h * 0.18), s: 0.5, rot: jitter(id, 10, 8), o: 1 });
// Clean columns inside the workspace (upper part when a chart shares it).
function column(i: number, n: number, ws: Rect, withChart: boolean): Pose {
  const cols = 3;
  const rows = Math.ceil(n / cols);
  const top = ws.y - ws.h / 2 + ws.h * 0.2;
  const band = ws.h * (withChart ? 0.38 : 0.62);
  return {
    x: ws.x - ws.w / 2 + ws.w * ((i % cols) + 0.5) / cols,
    y: top + (band * (Math.floor(i / cols) + 0.5)) / Math.max(rows, 1),
    s: withChart ? 0.42 : 0.5,
    rot: 0,
    o: 1,
  };
}

// Builds the field for every scene. Scenes passed without a plan (not field
// compositions) get `null` and leave the objects where they were.
export function buildField(plans: (VisualPlan | null | undefined)[]): (FieldScene | null)[] {
  let items: { id: number; skin: Skin; pose: Pose }[] = [];
  let ws: Rect = HIDDEN_RECT;
  let chart = 0;
  let nextId = 0;
  return plans.map((plan) => {
    if (!plan) return null;
    const before = new Map(items.map((it) => [it.id, it.pose]));
    const wsFrom = ws;
    const chartFrom = chart;

    // Spawn objects this scene introduces.
    const spawnedIds = new Set<number>();
    for (const obj of [plan.primary_object, ...plan.supporting_objects]) {
      const spec = SPAWN[obj];
      if (!spec || items.some((it) => it.skin === spec.skin)) continue;
      for (let k = 0; k < spec.n; k++) {
        const id = nextId++;
        spawnedIds.add(id);
        items.push({ id, skin: spec.skin, pose: pile(id, k) });
      }
    }

    const involves = (o: string) => plan.primary_object === o || plan.supporting_objects.includes(o as never);
    const action = plan.object_action;
    const withChart = involves("progress_chart");
    const inWorkspace = plan.primary_object === "workspace" || withChart || action === "merge" || action === "move_to" || action === "arrange" || action === "complete";
    ws = inWorkspace ? (action === "expand" ? { ...WORKSPACE, w: 76, h: 72 } : WORKSPACE) : HIDDEN_RECT;
    chart = withChart ? 1 : inWorkspace ? chart : 0;

    const n = items.length;
    items = items.map((it, i) => {
      const isNew = spawnedIds.has(it.id);
      let pose: Pose;
      if (inWorkspace) {
        pose = action === "merge" || action === "move_to" ? gathered(it.id, ws) : column(i, n, ws, chart > 0);
      } else if (action === "scatter") {
        pose = scatter(it.id, i, n);
      } else if (isNew) {
        const k = [...spawnedIds].indexOf(it.id);
        pose = it.skin === "tab" ? cascade(k) : pile(it.id, k);
      } else {
        pose = pushedBack(before.get(it.id) ?? it.pose); // older objects recede as new ones take focus
      }
      return { ...it, pose };
    });

    return {
      items: items.map((it) => {
        const spawned = spawnedIds.has(it.id);
        return { id: it.id, skin: it.skin, spawned, from: spawned ? offscreen(it.pose, it.id) : before.get(it.id)!, to: it.pose };
      }),
      workspace: { from: wsFrom, to: ws },
      chart: { from: chartFrom, to: chart },
      complete: action === "complete",
    };
  });
}
