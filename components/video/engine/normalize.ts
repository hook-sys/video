import { AREA_KINDS, MOODS, OBJECT_KINDS, SHOTS, StoryAsset, VERBS, VisualStory } from "./story";

// Raw (AI or hand-written) story → a valid VisualStory, repairing what can be
// repaired deterministically. The story's own objects and events are kept;
// only when nothing representable remains does the minimal fallback apply.

const VERB_ALIASES: Record<string, (typeof VERBS)[number]> = {
  merge: "converge",
  gather: "converge",
  collect: "converge",
  stack: "accumulate",
  pile: "accumulate",
  appear: "enter",
  show: "reveal",
  highlight: "emphasize",
  pulse: "emphasize",
  shake: "emphasize",
  organize: "arrange",
  sort: "arrange",
  align: "arrange",
  grow: "build",
  fill: "build",
  finish: "complete",
  check: "complete",
  done: "complete",
  leave: "exit",
  remove: "exit",
  morph: "transform",
  become: "transform",
  fly: "move",
  slide: "move",
  attach: "dock",
  write: "type",
};
const SHOT_ALIASES: Record<string, (typeof SHOTS)[number]> = {
  zoom_in: "push",
  push_in: "push",
  zoom_out: "pull_back",
  pullback: "pull_back",
  pan: "track",
  pan_left: "track",
  pan_right: "track",
  static: "hold",
  wide: "establish",
  close: "push",
};
const KIND_ALIASES: Record<string, (typeof OBJECT_KINDS)[number]> = {
  card: "generic_card",
  feature_card: "generic_card",
  result_card: "generic_card",
  video_card: "generic_card",
  tab: "browser_tab",
  chart: "progress_panel",
  progress_chart: "progress_panel",
  dashboard: "workspace",
  app: "workspace",
  text_input: "input_field",
  prompt: "input_field",
  chat: "message",
  email: "message",
  file: "document",
  logo: "hero_mark",
  stat: "metric",
  number: "metric",
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, d = "") => (typeof v === "string" && v.trim() ? v.trim() : d);
const oneOf = <T extends string>(list: readonly T[], v: unknown, aliases: Record<string, T> = {}, d?: T): T | undefined => {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, "_");
  return (list as readonly string[]).includes(s) ? (s as T) : (aliases[s] ?? d);
};

export function normalizeStory(raw: unknown, fallbackTitle = ""): { story: VisualStory; issues: string[]; fallback: boolean } {
  const issues: string[] = [];
  const r = obj(raw);

  const areas = arr(obj(r.world).areas).map((a, i) => {
    const o = obj(a);
    const kind = oneOf(AREA_KINDS, o.kind, {}, "neutral")!;
    if (kind !== str(o.kind)) issues.push(`area ${i}: kind "${str(o.kind)}" → ${kind}`);
    return { id: str(o.id, `area_${i + 1}`), kind, mood: oneOf(MOODS, o.mood, {}, "calm")! };
  });
  const areaIds = new Set(areas.map((a) => a.id));

  const seen = new Set<string>();
  const cast = arr(r.cast).flatMap((c, i) => {
    const o = obj(c);
    const id = str(o.id, `object_${i + 1}`);
    if (seen.has(id)) return [];
    seen.add(id);
    const kind = oneOf(OBJECT_KINDS, o.kind, KIND_ALIASES, "generic_card")!;
    if (kind !== str(o.kind)) issues.push(`${id}: kind "${str(o.kind)}" → ${kind}`);
    const content = obj(o.content);
    const home = areaIds.has(str(o.home)) ? str(o.home) : (areas[0]?.id ?? "stage");
    return [{ id, kind, group: str(o.group) || undefined, content: { title: str(content.title) || undefined, tag: str(content.tag) || undefined, meta: str(content.meta) || undefined }, home }];
  });

  let lastArea = areas[0]?.id ?? "stage";
  const moments = arr(r.moments).flatMap((m, i) => {
    const o = obj(m);
    const cue = str(o.cue);
    if (!cue) {
      issues.push(`moment ${i}: no cue, dropped`);
      return [];
    }
    const area = areaIds.has(str(o.area)) ? str(o.area) : lastArea;
    lastArea = area;
    const events = arr(o.events).flatMap((e) => {
      const ev = obj(e);
      const verb = oneOf(VERBS, ev.verb, VERB_ALIASES);
      if (!verb) {
        issues.push(`moment ${i}: unsupported verb "${str(ev.verb)}" dropped`);
        return [];
      }
      const targets = str(ev.targets);
      if (!targets) return [];
      const slot = oneOf(["todo", "in_progress", "done", "dock", "panel"] as const, ev.slot);
      const pace = oneOf(["tight", "loose"] as const, ev.pace);
      return [{ verb, targets, into: str(ev.into) || undefined, slot, state: str(ev.state) || undefined, pace }];
    });
    const cam = obj(o.camera);
    const shot = oneOf(SHOTS, cam.shot, SHOT_ALIASES);
    const intent = str(o.intent, "demonstrate");
    const text = str(obj(o.text).content);
    return [
      {
        cue,
        intent: (["establish", "accumulate", "overwhelm", "converge", "organize", "progress", "resolve", "reveal", "demonstrate"].includes(intent) ? intent : "demonstrate") as VisualStory["moments"][number]["intent"],
        area,
        events,
        camera: shot && str(cam.subject) ? { shot, subject: str(cam.subject) } : undefined,
        text: text ? { content: text, role: "support" as const } : undefined,
        asset: StoryAsset.safeParse(o.asset).success ? StoryAsset.parse(o.asset) : undefined,
      },
    ];
  });

  const closing = { text: arr(obj(r.closing).text).map((t) => str(t)).filter(Boolean).slice(0, 3) };
  const candidate = { version: 1, world: { areas }, cast, moments, closing };
  const parsed = VisualStory.safeParse(candidate);
  const representable = parsed.success && cast.length > 0 && moments.some((m) => m.events.length > 0);
  if (!representable) {
    issues.push("story not representable: minimal fallback used");
    return { story: minimalStory(fallbackTitle, closing.text), issues, fallback: true };
  }
  return { story: parsed.data, issues, fallback: false };
}

// The MINIMUM safe fallback: one mark revealed and held, with the closing
// text. Deliberately not a workspace/progress template.
export function minimalStory(title: string, closing: string[] = []): VisualStory {
  return {
    version: 1,
    world: { areas: [{ id: "stage", kind: "neutral", mood: "calm" }] },
    cast: [{ id: "mark", kind: "hero_mark", content: { title: title || " " }, home: "stage" }],
    moments: [{ cue: "", intent: "reveal", area: "stage", events: [{ verb: "reveal", targets: "mark" }], camera: { shot: "push", subject: "mark" } }],
    closing: { text: closing },
  };
}
