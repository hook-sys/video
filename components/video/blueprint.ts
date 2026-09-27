import type { Blueprint, BlueprintObject } from "@/lib/ai/product-brief";

// Generic interpreter for the storyboard's visual blueprint. It keeps a world
// of objects by id across scenes and resolves, per scene, where each object
// starts and ends, how big it is and where the camera looks. It has no scene
// templates: layout comes only from the blueprint's positions, actions and
// relationships.

// x/y: centre in % of frame; w: width as a fraction of min(width, height);
// rot in degrees; o: opacity.
export type Pose = { x: number; y: number; w: number; rot: number; o: number };
export type Track = { obj: BlueprintObject; from: Pose; to: Pose; isNew: boolean; exiting: boolean; containerId?: string; fromType?: BlueprintObject["type"] };
export type CameraPose = { x: number; y: number; scale: number; rot: number };
export type ResolvedScene = { tracks: Track[]; connections: [string, string][]; camera: { from: CameraPose; to: CameraPose } };

const ANCHOR: Record<string, [number, number]> = {
  center: [50, 52],
  left: [25, 52],
  right: [75, 52],
  top: [50, 25],
  bottom: [50, 79],
  top_left: [25, 27],
  top_right: [75, 27],
  bottom_left: [25, 77],
  bottom_right: [75, 77],
  offscreen_left: [-22, 52],
  offscreen_right: [122, 52],
  offscreen_top: [50, -24],
  offscreen_bottom: [50, 124],
};

// Natural width of each object type (fraction of the frame's short side).
const WIDTH: Record<BlueprintObject["type"], number> = {
  task_card: 0.26,
  browser_tab: 0.3,
  workspace: 1.0,
  input_field: 0.62,
  button: 0.22,
  progress_chart: 0.5,
  video_card: 0.32,
  processing_core: 0.24,
  result_card: 0.3,
  feature_card: 0.36,
  icon: 0.11,
  cursor: 0.05,
  text: 0.9,
  hero_visual: 0.7,
};
const SCALE = { small: 0.72, medium: 1, large: 1.3 } as const;
export const CONTAINER_ASPECT = 0.6; // workspace height / width

const hash = (s: string, k: number) => {
  let h = k * 131;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100003;
  const x = Math.sin(h) * 43758.5453;
  return x - Math.floor(x);
};
const jitter = (id: string, k: number, amount: number) => (hash(id, k) - 0.5) * 2 * amount;
const SHOT = { wide: 1, medium: 1.18, close: 1.38 } as const;

// Which side is nearest off-frame for an exit.
function exitPoint(p: Pose): [number, number] {
  const d = [p.x, 100 - p.x, p.y, 100 - p.y];
  const i = d.indexOf(Math.min(...d));
  return [[-22, p.y], [122, p.y], [p.x, -24], [p.x, 124]][i] as [number, number];
}

export function resolveBlueprints(blueprints: (Blueprint | null)[], aspect: number): (ResolvedScene | null)[] {
  let world = new Map<string, { pose: Pose; type: BlueprintObject["type"] }>();
  let lastCamera: CameraPose = { x: 0, y: 0, scale: 1, rot: 0 };
  let lastTransition: Blueprint["transition"] | null = null;
  // % of frame width/height covered by one unit of `w`.
  const pctW = (w: number) => (w * 100) / Math.max(aspect, 1);
  const pctH = (w: number) => (w * 100) / Math.max(1 / aspect, 1);

  return blueprints.map((bp) => {
    if (!bp) {
      lastTransition = null;
      return null;
    }
    const ids = new Set(bp.objects.map((o) => o.id));
    // Containment: "A contains B", "B moves_to A", "B groups_with A".
    const containerOf = new Map<string, string>();
    for (const r of bp.relationships) {
      if (!ids.has(r.from) || !ids.has(r.to)) continue;
      if (r.relation === "contains") containerOf.set(r.to, r.from);
      if (r.relation === "moves_to") containerOf.set(r.from, r.to);
    }
    const transformsFrom = new Map(bp.relationships.filter((r) => r.relation === "transforms_into").map((r) => [r.to, r.from]));

    const width = (o: BlueprintObject) => WIDTH[o.type] * SCALE[o.scale] * (o.action === "expand" ? 1.2 : o.action === "collapse" ? 0.6 : 1);

    // End poses: containers and free objects first, then contained children.
    const ends = new Map<string, Pose>();
    const place = (o: BlueprintObject, [x, y]: [number, number], w: number) => ends.set(o.id, { x, y, w, rot: 0, o: 1 });
    const free = bp.objects.filter((o) => !containerOf.has(o.id) || o.end !== "inside");
    // Objects sharing an anchor spread according to their action.
    const byAnchor = new Map<string, BlueprintObject[]>();
    for (const o of free) {
      const key = o.end === "previous" && world.has(o.id) ? `prev:${o.id}` : o.end === "previous" || o.end === "inside" ? "center" : o.end;
      (byAnchor.get(key) ?? byAnchor.set(key, []).get(key)!).push(o);
    }
    for (const [key, group] of byAnchor) {
      if (key.startsWith("prev:")) {
        const o = group[0];
        ends.set(o.id, { ...world.get(o.id)!.pose, w: width(o) });
        continue;
      }
      const [ax, ay] = ANCHOR[key] ?? ANCHOR.center;
      group.forEach((o, i) => {
        const n = group.length;
        const w = width(o);
        if (n === 1) return place(o, [ax, ay], w);
        if (o.action === "scatter") {
          const a = (i / n) * Math.PI * 2 + hash(o.id, 1);
          const r = 16 + jitter(o.id, 2, 5);
          return ends.set(o.id, { x: ax + Math.cos(a) * r * 1.3, y: ay + Math.sin(a) * r, w, rot: jitter(o.id, 3, 22), o: 1 });
        }
        if (o.action === "stack") return ends.set(o.id, { x: ax + jitter(o.id, 4, 6), y: ay + jitter(o.id, 5, 5) - i * 1.5, w, rot: jitter(o.id, 6, 12), o: 1 });
        // arrange / default: a tidy row (wrapping into two rows when crowded)
        const cols = n > 4 ? Math.ceil(n / 2) : n;
        const gap = Math.min(pctW(w) + 3, 90 / cols);
        return place(o, [ax + ((i % cols) - (cols - 1) / 2) * gap, ay + (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * (pctH(w) * 0.55 + 4)], w);
      });
    }
    // Children inside their container.
    const children = new Map<string, BlueprintObject[]>();
    for (const o of bp.objects) {
      const c = containerOf.get(o.id);
      if (c && o.end === "inside") (children.get(c) ?? children.set(c, []).get(c)!).push(o);
    }
    for (const [cid, kids] of children) {
      const c = ends.get(cid) ?? { x: 50, y: 52, w: 1, rot: 0, o: 1 };
      const cw = pctW(c.w) * 0.84;
      const ch = pctH(c.w) * CONTAINER_ASPECT * 0.7;
      const top = c.y - ch / 2 + 2;
      const n = kids.length;
      const cols = Math.min(n, 4);
      const rows = Math.ceil(n / cols);
      kids.forEach((o, i) => {
        const w = width(o) * 0.5;
        if (o.action === "arrange" || o.action === "complete" || o.action === "generate") {
          ends.set(o.id, { x: c.x - cw / 2 + (cw * ((i % cols) + 0.5)) / cols, y: top + (ch * (Math.floor(i / cols) + 0.5)) / rows, w, rot: 0, o: 1 });
        } else {
          ends.set(o.id, { x: c.x + jitter(o.id, 7, cw * 0.25), y: c.y + jitter(o.id, 8, ch * 0.2), w, rot: jitter(o.id, 9, 8), o: 1 });
        }
      });
    }
    // "follow": sit next to what it follows.
    for (const r of bp.relationships) {
      if (r.relation !== "follows") continue;
      const t = ends.get(r.to);
      const o = bp.objects.find((x) => x.id === r.from);
      if (t && o) ends.set(o.id, { ...t, x: t.x + pctW(t.w) * 0.3, y: t.y + 4, w: width(o) });
    }

    const tracks: Track[] = bp.objects.map((o) => {
      const prev = world.get(o.id);
      let to = ends.get(o.id) ?? { x: 50, y: 52, w: width(o), rot: 0, o: 1 };
      if (o.action === "exit") {
        const [ex, ey] = exitPoint(to);
        to = { ...to, x: ex, y: ey, o: 0 };
      }
      let from: Pose;
      const source = transformsFrom.get(o.id);
      if (prev && (o.start === "previous" || o.start === "inside")) from = prev.pose;
      else if (source && (world.get(source) || ends.get(source))) from = { ...(world.get(source)?.pose ?? ends.get(source)!), o: 0 };
      else if (o.start.startsWith("offscreen")) from = { ...to, x: ANCHOR[o.start][0], y: ANCHOR[o.start][1], rot: jitter(o.id, 10, 25), o: 0 };
      else if (o.start === "previous" || o.start === "inside") from = { ...to, w: to.w * 0.8, o: 0 };
      else from = { ...to, x: ANCHOR[o.start]?.[0] ?? to.x, y: ANCHOR[o.start]?.[1] ?? to.y, o: prev ? prev.pose.o : 0 };
      return { obj: o, from, to, isNew: !prev, exiting: o.action === "exit", containerId: containerOf.get(o.id), fromType: prev && prev.type !== o.type ? prev.type : undefined };
    });

    // Objects from earlier scenes the blueprint no longer lists leave.
    for (const [id, prev] of world) {
      if (ids.has(id)) continue;
      const [ex, ey] = exitPoint(prev.pose);
      const obj: BlueprintObject = { id, type: prev.type, role: "context", start: "previous", end: "previous", action: "exit", cue: "", scale: "medium", depth: "mid", emphasis: false, label: "" };
      tracks.push({ obj, from: prev.pose, to: { ...prev.pose, x: (prev.pose.x + ex) / 2, y: (prev.pose.y + ey) / 2, o: 0 }, isNew: false, exiting: true });
    }

    // Camera: frame the focus object (or everything) with the requested shots.
    const visible = tracks.filter((t) => !t.exiting);
    const focusTrack = visible.find((t) => t.obj.id === bp.camera.focus);
    const centre = (key: "from" | "to") => {
      const list = focusTrack ? [focusTrack] : visible;
      if (!list.length) return [50, 52];
      return [list.reduce((n, t) => n + t[key].x, 0) / list.length, list.reduce((n, t) => n + t[key].y, 0) / list.length];
    };
    const m = bp.camera.movement;
    let s0: number = SHOT[bp.camera.start];
    let s1: number = SHOT[bp.camera.end];
    if (m === "push_in" && s1 <= s0) s1 = s0 + 0.18;
    if (m === "pull_out" && s1 >= s0) s0 = s1 + 0.2;
    if (m === "static") s1 = s0;
    const [fx, fy] = m === "track" ? centre("from") : centre("to");
    const [tx, ty] = centre("to");
    const aim = (x: number, y: number, s: number, dx = 0, rot = 0): CameraPose => ({ x: -(x - 50) * s * 0.45 + dx, y: -(y - 52) * s * 0.45, scale: s, rot });
    let from = aim(fx, fy, s0, m === "pan_left" ? 4 : m === "pan_right" ? -4 : 0, m === "orbit" ? -1.5 : 0);
    const to = aim(tx, ty, s1, m === "pan_left" ? -4 : m === "pan_right" ? 4 : 0, m === "orbit" ? 1.5 : 0);
    // A continuing scene picks the camera up where the previous one left it.
    if (lastTransition === "continue") from = lastCamera;

    const connections = bp.relationships.filter((r) => r.relation === "connects_to" && ids.has(r.from) && ids.has(r.to)).map((r) => [r.from, r.to] as [string, string]);

    // Update the world for the next scene.
    const next = new Map<string, { pose: Pose; type: BlueprintObject["type"] }>();
    for (const t of tracks) if (!t.exiting) next.set(t.obj.id, { pose: t.to, type: t.obj.type });
    world = next;
    lastCamera = to;
    lastTransition = bp.transition;
    return { tracks, connections, camera: { from, to } };
  });
}
