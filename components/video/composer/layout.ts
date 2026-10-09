import { emWidth, faceOf, rng } from "./art";
import { highlightOf, shownWord } from "./highlight";
import { TRANSITION_FRAMES, baseSize } from "./sizes";
import type { ArrangeKind, ArtT, Box, Brand, ComposerPlan, ItemT, LayoutKind, PlacedItem, PlacedScene, SceneT, ScriptT, TextBlock, Word } from "./types";
import { FPS, H, W } from "./types";

// Where everything goes: a scene's layout splits the frame into a place for
// the words and a place for the things; its arrangement sets the things in
// theirs (a row, a cascade, an orbit…); each thing is scaled into its cell.
// The words are sized to fill their place. Problems (overlaps, things too
// small to read) are reported so the composer can try another layout.

const SAFE = { l: 120, r: W - 120, t: 92, b: H - 92 };
type Rect = { l: number; t: number; r: number; b: number };
const rect = (l: number, t: number, r: number, b: number): Rect => ({ l, t, r, b });
const ACCENTS = new Set(["badge", "shape", "cursor"]);
export const isAccent = (it: Pick<ItemT, "kind">) => ACCENTS.has(it.kind);
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
const LEAD = 6;
const TEXT_CAP = { xl: 176, l: 132, m: 100, s: 76 } as const;
const MIN_TEXT = 46;

export type Problem = { scene: number; what: string };

// Lines of words that fit a width at a size (greedy).
function wrap(words: string[], size: number, maxW: number, art: ArtT) {
  const f = faceOf(art.display);
  const upper = art.case === "upper" || !!f.upper;
  const space = size * 0.26;
  const widths = words.map((w) => emWidth(w, f, art.weight, upper) * size * (1 + art.tracking));
  const lines: number[][] = [];
  let cur: number[] = [];
  let cw = 0;
  widths.forEach((w, i) => {
    const add = (cur.length ? space : 0) + w;
    if (cur.length && cw + add > maxW) {
      lines.push(cur);
      cur = [i];
      cw = w;
    } else {
      cur.push(i);
      cw += add;
    }
  });
  if (cur.length) lines.push(cur);
  const lineW = lines.map((l) => l.reduce((a, i, j) => a + widths[i] + (j ? space : 0), 0));
  return { lines, width: Math.max(0, ...lineW), widest: Math.max(0, ...widths) };
}

function fitText(words: string[], region: Rect, cap: number, maxLines: number, art: ArtT, kicker: boolean) {
  const rw = region.r - region.l;
  const rh = region.b - region.t - (kicker ? 70 : 0);
  const lh = art.case === "upper" ? 1.02 : 1.08;
  for (let size = cap; size >= MIN_TEXT - 10; size -= 4) {
    const r = wrap(words, size, rw, art);
    if (r.widest <= rw && r.lines.length <= maxLines && r.lines.length * size * lh <= rh) return { size, ...r, height: r.lines.length * size * lh + (kicker ? Math.round(size * 0.26) + Math.round(size * 0.22) + 6 : 0) };
  }
  const size = MIN_TEXT - 10;
  const r = wrap(words, size, rw, art);
  return { size, ...r, height: r.lines.length * size * lh };
}

// The place for the words and the place for the things, by layout.
function regions(layout: LayoutKind, ratio: number, hasText: boolean, hasVis: boolean): { text: Rect | null; vis: Rect | null; align: "left" | "center" } {
  const { l, r, t, b } = SAFE;
  const w = r - l;
  if (!hasVis) return { text: rect(l + 60, t + 40, r - 60, b - 40), vis: null, align: layout === "split-left" || layout === "corner" ? "left" : "center" };
  if (!hasText) return { text: null, vis: rect(l, t, r, b), align: "center" };
  switch (layout) {
    case "split-left": return { text: rect(l, t + 40, l + w * ratio, b - 40), vis: rect(l + w * ratio + 70, t, r, b), align: "left" };
    case "split-right": return { text: rect(r - w * ratio, t + 40, r, b - 40), vis: rect(l, t, r - w * ratio - 70, b), align: "left" };
    case "top": return { text: rect(l + 80, t, r - 80, t + 300), vis: rect(l, t + 340, r, b), align: "center" };
    case "bottom": return { text: rect(l + 80, b - 250, r - 80, b), vis: rect(l, t, r, b - 290), align: "center" };
    case "corner": return { text: rect(l, t, l + w * 0.56, t + 360), vis: rect(l + w * 0.36, t + 330, r, b), align: "left" };
    case "visual": return { text: rect(l + 200, b - 150, r - 200, b), vis: rect(l, t, r, b - 180), align: "center" };
    case "type": return { text: rect(l + 40, t + 60, r - 40, b - 60), vis: null, align: "center" };
    case "over": return { text: rect(l + 160, t + 220, r - 160, b - 220), vis: rect(l, t, r, b), align: "center" };
    default: return { text: rect(l + 60, t, r - 60, t + 380), vis: rect(l, t + 400, r, b), align: "center" };
  }
}

const SIZE_MAX = { s: 1.15, m: 1.7, l: 2.1 } as const;
function fit(it: ItemT, cell: Rect, k = 1): { box: Box; scale: number } {
  const [bw, bh] = baseSize(it as PlacedItem);
  const cw = cell.r - cell.l, ch = cell.b - cell.t;
  // a call to action, a logo or a number reads best at a set size, never blown up
  const kindMax = it.kind === "button" ? 1.2 : it.kind === "logo" ? 1.3 : it.kind === "badge" ? 1.2 : it.kind === "stat" ? 1.5 : 9;
  const s = Math.min(cw / bw, ch / bh, SIZE_MAX[it.size ?? "m"], kindMax) * k;
  return { box: { x: (cell.l + cell.r) / 2, y: (cell.t + cell.b) / 2, w: bw * s, h: bh * s }, scale: s };
}

function arrange(items: ItemT[], kind: ArrangeKind, vis: Rect, seed: number): { box: Box; scale: number; z: number }[] {
  const n = items.length;
  const R = rng(seed);
  const gap = 44;
  const vw = vis.r - vis.l, vh = vis.b - vis.t;
  if (n === 1 || kind === "single") {
    if (n === 1) return [{ ...fit(items[0], vis), z: 1 }];
    kind = vw / vh > 1.3 ? "row" : "column";
  }
  if (kind === "row") {
    const cw = (vw - gap * (n - 1)) / n;
    return items.map((it, i) => ({ ...fit(it, rect(vis.l + i * (cw + gap), vis.t, vis.l + i * (cw + gap) + cw, vis.b)), z: 1 }));
  }
  if (kind === "column") {
    const ch = (vh - gap * (n - 1)) / n;
    return items.map((it, i) => ({ ...fit(it, rect(vis.l, vis.t + i * (ch + gap), vis.r, vis.t + i * (ch + gap) + ch)), z: 1 }));
  }
  if (kind === "grid") {
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const cw = (vw - gap * (cols - 1)) / cols, ch = (vh - gap * (rows - 1)) / rows;
    return items.map((it, i) => {
      const cx = i % cols, cy = Math.floor(i / cols);
      return { ...fit(it, rect(vis.l + cx * (cw + gap), vis.t + cy * (ch + gap), vis.l + cx * (cw + gap) + cw, vis.t + cy * (ch + gap) + ch)), z: 1 };
    });
  }
  if (kind === "cascade") {
    const sw = vw * 0.74, sh = vh * 0.74;
    const dx = n > 1 ? (vw - sw) / (n - 1) : 0, dy = n > 1 ? (vh - sh) / (n - 1) : 0;
    return items.map((it, i) => ({ ...fit(it, rect(vis.l + i * dx, vis.t + i * dy, vis.l + i * dx + sw, vis.t + i * dy + sh)), z: 1 + i }));
  }
  if (kind === "orbit") {
    const cx = (vis.l + vis.r) / 2, cy = (vis.t + vis.b) / 2;
    const main = fit(items[0], rect(cx - vw * 0.27, cy - vh * 0.34, cx + vw * 0.27, cy + vh * 0.34));
    const rest = items.slice(1).map((it, i) => {
      const a = -Math.PI * 0.85 + (i / Math.max(1, n - 2)) * Math.PI * 1.7 + R.range(-0.15, 0.15);
      const px = cx + Math.cos(a) * vw * 0.36, py = cy + Math.sin(a) * vh * 0.36;
      return { ...fit(it, rect(px - vw * 0.15, py - vh * 0.17, px + vw * 0.15, py + vh * 0.17)), z: 2 };
    });
    return [{ ...main, z: 1 }, ...rest];
  }
  if (kind === "diagonal") {
    const cw = vw / n, ch = Math.min(vh, (vh / n) * 1.9);
    return items.map((it, i) => {
      const top = n > 1 ? vis.t + ((vh - ch) * i) / (n - 1) : vis.t;
      return { ...fit(it, rect(vis.l + i * cw + 10, top, vis.l + (i + 1) * cw - 10, top + ch)), z: 1 };
    });
  }
  // scatter: a loose grid, each thing nudged off its cell centre
  const cols = n <= 3 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const cw = vw / cols, ch = vh / rows;
  return items.map((it, i) => {
    const cx = i % cols, cy = Math.floor(i / cols);
    const k = R.range(0.78, 0.95);
    const f = fit(it, rect(vis.l + cx * cw + 16, vis.t + cy * ch + 16, vis.l + (cx + 1) * cw - 16, vis.t + (cy + 1) * ch - 16), k);
    const slackX = (cw - f.box.w) / 2 - 16, slackY = (ch - f.box.h) / 2 - 16;
    return { box: { ...f.box, x: f.box.x + R.range(-1, 1) * Math.max(0, slackX), y: f.box.y + R.range(-1, 1) * Math.max(0, slackY) }, scale: f.scale, z: 1 };
  });
}

const overlap = (a: Box, b: Box) => {
  const w = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const h = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.w * a.h, b.w * b.h) : 0;
};

export type SceneInput = { scene: SceneT; index: number; from: number; to: number; words: Word[]; wordFrom: number; wordTo: number; art: ArtT; seed: number; prev: PlacedScene | null; screens: number };

// The layouts that compose the words with the things (not side by side):
// inline — an icon beside the words (and the other things beside them);
// label — the words as the label of a card, a phone, a chart;
// caption — one thing filling the frame, the words a caption on a plate;
// around — the words in the middle, the things around them;
// between — the words between two things.
export const COMPOSED: ReadonlySet<LayoutKind> = new Set<LayoutKind>(["inline", "label", "caption", "around", "between"]);
// what a label or a caption can sit on
const FRAMED = new Set(["card", "device", "chart", "screenshot", "compare", "stat", "flow", "steps", "quote", "chips"]);
const FILLS = new Set(["card", "device", "chart", "screenshot", "compare", "flow"]);

// Whether a layout can be made from a scene's things (and words).
export function layoutFits(layout: LayoutKind, items: ItemT[], hasText: boolean): boolean {
  const vis = items.filter((it) => !isAccent(it));
  switch (layout) {
    case "type": return !vis.length;
    case "inline": return hasText && vis.some((it) => it.kind === "icon") && vis.length <= 3;
    case "label": return hasText && vis.some((it) => FRAMED.has(it.kind)) && vis.length <= 3;
    case "caption": return hasText && vis.length >= 1 && vis.length <= 2 && FILLS.has(vis[0].kind);
    case "around": return hasText && vis.length >= 2 && vis.length <= 4 && vis.every((it) => baseSize(it as PlacedItem)[0] <= 760);
    case "between": return hasText && vis.length === 2 && vis.every((it) => baseSize(it as PlacedItem)[0] <= 1120);
    default: return vis.length > 0;
  }
}

type Align = "left" | "center" | "right";
type Anchor = "top" | "middle" | "bottom";
type TextIn = (region: Rect, cap: number, maxLines: number, align: Align, anchor: Anchor) => TextBlock;
type Spot = { box: Box; scale: number; z: number };

// Left-aligned words moved to start at `left` (the film measures the face
// again inside `area`, so the area moves with them).
const startAt = (tb: TextBlock, left: number, y: number, room: number): TextBlock => ({ ...tb, box: { ...tb.box, x: left + tb.box.w / 2, y }, area: { x: left + room / 2, y, w: room, h: tb.area?.h ?? tb.box.h } });

// A composed layout: where the words and each thing go.
function composeScene(layout: LayoutKind, things: ItemT[], textIn: TextIn, cap: number, seed: number): { tb: TextBlock; spots: Spot[]; order: ItemT[]; arrange: ArrangeKind } {
  const R = rng(seed + 17);
  // (a small icon beside the words or around them would be lost: at least medium)
  const vis = things.map((it) => (it.kind === "icon" && it.size === "s" ? { ...it, size: "m" as const } : it));
  const flip = R.chance(0.5);
  const { l, r, t, b } = SAFE;
  const w = r - l;
  if (layout === "inline") {
    const icon = vis.find((it) => it.kind === "icon")!;
    const glyph = { ...icon, title: null };
    const others = vis.filter((it) => it !== icon);
    // the words and their icon on one line, the other things beside them
    const zone = others.length ? (flip ? rect(r - w * 0.5, t + 40, r, b - 40) : rect(l, t + 40, l + w * 0.5, b - 40)) : rect(l + 60, t + 60, r - 60, b - 60);
    const side0 = Math.round(Math.min(280, Math.max(170, cap * 1.6)));
    const room = zone.r - zone.l - side0 - 44;
    const tb0 = textIn(rect(zone.l + side0 + 44, zone.t, zone.r, zone.b), Math.min(cap, others.length ? 110 : 150), others.length ? 3 : 2, "left", "middle");
    const side = Math.round(Math.min(300, Math.max(180, tb0.box.h * 0.85, tb0.size * 1.7)));
    const x0 = others.length ? zone.l : (zone.l + zone.r) / 2 - (side + 44 + tb0.box.w) / 2;
    const cy = (zone.t + zone.b) / 2;
    const tb = startAt(tb0, x0 + side + 44, cy, room);
    const spots: Spot[] = [{ box: { x: x0 + side / 2, y: cy, w: side, h: side }, scale: side / baseSize(glyph as PlacedItem)[0], z: 1 }];
    if (others.length) spots.push(...arrange(others, others.length > 1 ? "column" : "single", flip ? rect(l, t, r - w * 0.5 - 70, b) : rect(l + w * 0.5 + 70, t, r, b), seed));
    return { tb, spots, order: [glyph, ...others], arrange: others.length > 1 ? "column" : "single" };
  }
  if (layout === "label") {
    const main = vis.find((it) => FRAMED.has(it.kind))!;
    const others = vis.filter((it) => it !== main).slice(0, 2);
    const zone = others.length ? (flip ? rect(l + 460, t, r, b) : rect(l, t, r - 460, b)) : rect(l + w * 0.1, t, r - w * 0.1, b);
    const tb0 = textIn(rect(zone.l, t, zone.r, t + 300), Math.min(cap, 104), 2, "left", "top");
    const gap = 30;
    const f = fit(main, rect(zone.l, t + tb0.box.h + gap, zone.r, b));
    // the label and its thing as one, in the middle of the frame
    const total = tb0.box.h + gap + f.box.h;
    const top = Math.max(t, H / 2 - total / 2);
    const box = { ...f.box, y: top + tb0.box.h + gap + f.box.h / 2 };
    const left = Math.max(l, box.x - box.w / 2);
    const tb = startAt(tb0, left, top + tb0.box.h / 2, Math.min(zone.r, r) - left);
    const spots: Spot[] = [{ box, scale: f.scale, z: 1 }];
    if (others.length) spots.push(...arrange(others, others.length > 1 ? "column" : "single", flip ? rect(l, t + 120, l + 400, b - 120) : rect(r - 400, t + 120, r, b - 120), seed).map((sp) => ({ ...sp, z: 2 })));
    return { tb, spots, order: [main, ...others], arrange: "single" };
  }
  if (layout === "caption") {
    const kind: ArrangeKind = vis.length > 1 ? "row" : "single";
    const spots = arrange(vis, kind, rect(l, t, r, b), seed).map((sp) => ({ ...sp, z: 0 }));
    const tb = textIn(flip ? rect(r - 860, b - 280, r - 20, b - 20) : rect(l + 20, b - 280, l + 860, b - 20), Math.min(cap, 68), 2, flip ? "right" : "left", "bottom");
    return { tb, spots, order: vis, arrange: kind };
  }
  if (layout === "around") {
    const tb = textIn(rect(W / 2 - 440, H / 2 - 190, W / 2 + 440, H / 2 + 190), Math.min(cap, 132), 2, "center", "middle");
    const n = vis.length;
    const P: [number, number][] = n === 2 ? [[-640, 0], [640, 0]] : n === 3 ? [[-640, -190], [640, -190], [0, 320]] : [[-640, -215], [640, -215], [-640, 235], [640, 235]];
    const cw = 360, ch = n === 2 ? 440 : 300;
    const spots = vis.map((it, i) => {
      const [dx, dy] = P[i];
      const cell = n === 3 && i === 2 ? rect(W / 2 - 300, H / 2 + dy - 120, W / 2 + 300, H / 2 + dy + 120) : rect(W / 2 + dx - cw / 2, H / 2 + dy - ch / 2, W / 2 + dx + cw / 2, H / 2 + dy + ch / 2);
      return { ...fit(it, cell), z: 1 };
    });
    return { tb, spots, order: vis, arrange: "scatter" };
  }
  // between: the words between two things
  const tb = textIn(rect(l + w * 0.3 + 40, t, r - w * 0.3 - 40, b), Math.min(cap, 120), 4, "center", "middle");
  const cells = [rect(l, t + 80, l + w * 0.3, b - 80), rect(r - w * 0.3, t + 80, r, b - 80)];
  return { tb, spots: vis.slice(0, 2).map((it, i) => ({ ...fit(it, cells[i]), z: 1 })), order: vis.slice(0, 2), arrange: "row" };
}

// One scene, laid out (and what is wrong with it).
export function placeScene(p: SceneInput): { placed: PlacedScene; problems: string[] } {
  const { scene: s, art, from, to, words } = p;
  const problems: string[] = [];
  const frame = (i: number) => Math.round((words[Math.max(0, Math.min(words.length - 1, i))]?.start ?? 0) * FPS);
  const items = s.items.filter((it) => it.kind !== "screenshot" || p.screens > 0);
  const vis = items.filter((it) => !isAccent(it));
  const acc = items.filter(isAccent);
  // the words: the scene's highlight (highlight.ts), in order
  let tfrom = s.text ? Math.max(p.wordFrom, Math.min(s.text.from, s.text.to)) : 0;
  let tto = s.text ? Math.min(p.wordTo, Math.max(s.text.from, s.text.to)) : -1;
  const keys = new Set((s.text?.key ?? []).map(norm).filter(Boolean));
  if (s.text && tto >= tfrom) [tfrom, tto] = highlightOf(words, tfrom, tto, keys);
  // (a stop the voice's timing gives as a word of its own is not shown)
  const ws = s.text ? words.slice(tfrom, tto + 1).filter((w) => /[\p{L}\p{N}]/u.test(w.text)) : [];
  const hasText = ws.length > 0;
  const shown = ws.map((w, i) => shownWord(w.text, i === 0, i === ws.length - 1));
  let layout = s.layout;
  if (layout === "type" && vis.length) layout = "center";
  if (COMPOSED.has(layout) && !layoutFits(layout, items, hasText)) layout = vis.length ? "center" : "type";
  // the words in a place: sized to fill it, each coming in as it is said —
  // and a highlight said late in the scene comes in with the scene
  const textIn: TextIn = (region, cap, maxLines, align, anchor) => {
    const fitR = fitText(shown, region, cap, maxLines, art, !!s.kicker);
    if (fitR.size < MIN_TEXT) problems.push(`the words are too small (${fitR.size}px)`);
    const bw = Math.min(region.r - region.l, fitR.width + 8), bh = fitR.height;
    const cy = anchor === "top" ? region.t + bh / 2 : anchor === "bottom" ? region.b - bh / 2 : (region.t + region.b) / 2;
    const cx = align === "left" ? region.l + bw / 2 : align === "right" ? region.r - bw / 2 : (region.l + region.r) / 2;
    const said = ws.map((w) => Math.max(from, Math.round(w.start * FPS) - 2));
    const late = Math.max(0, (said[0] ?? from) - (from + 12));
    return {
      words: ws.map((w, i) => ({ t: shown[i], at: Math.max(from, said[i] - late), key: keys.has(norm(w.text)) })),
      box: { x: cx, y: cy, w: bw, h: bh },
      size: fitR.size,
      lines: fitR.lines,
      align,
      reveal: s.text!.reveal,
      kicker: s.kicker?.trim() || null,
      area: { x: (region.l + region.r) / 2, y: (region.t + region.b) / 2, w: region.r - region.l, h: region.b - region.t },
      anchor,
    };
  };
  const timeOf = (it: ItemT) => {
    const at = Math.min(to - 16, Math.max(from, frame(it.at) - 4));
    const hit = it.hit != null ? Math.min(to - 6, Math.max(at + 8, frame(it.hit) - 2)) : null;
    return { at, hit };
  };
  let tb: TextBlock | null = null;
  let placed: PlacedItem[];
  let kind: ArrangeKind;
  if (COMPOSED.has(layout)) {
    const c = composeScene(layout, vis, textIn, TEXT_CAP[s.text!.size], p.seed);
    tb = c.tb;
    kind = c.arrange;
    placed = c.order.map((it, i) => ({ ...it, ...timeOf(it), box: c.spots[i].box, scale: c.spots[i].scale, z: c.spots[i].z }));
  } else {
    const ratio = s.ratio ?? 0.44;
    const reg = regions(layout, ratio, hasText, vis.length > 0);
    if (hasText && reg.text) {
      const cap = Math.min(TEXT_CAP[s.text!.size], layout === "visual" ? 72 : layout.startsWith("split") || layout === "corner" ? 120 : 999);
      const anchor: Anchor = layout === "top" || layout === "corner" ? "top" : layout === "bottom" || layout === "visual" ? "bottom" : "middle";
      tb = textIn(reg.text, cap, layout === "visual" ? 2 : s.text!.size === "xl" ? 3 : 4, s.text!.align ?? reg.align, anchor);
      const { y: cy, h: bh } = tb.box;
      // give the things the room the words did not take
      if (reg.vis && (layout === "top" || layout === "center")) reg.vis.t = Math.max(reg.vis.t - 120, cy + bh / 2 + 56);
      if (reg.vis && layout === "bottom") reg.vis.b = Math.min(reg.vis.b + 100, cy - bh / 2 - 56);
      if (reg.vis && layout === "corner") reg.vis.t = Math.max(reg.vis.t - 60, cy + bh / 2 + 40);
    }
    const visRect = reg.vis ?? rect(SAFE.l, SAFE.t, SAFE.r, SAFE.b);
    kind = s.arrange ?? (vis.length > 1 ? "row" : "single");
    const spots = vis.length ? arrange(vis, kind, visRect, p.seed) : [];
    placed = vis.map((it, i) => ({ ...it, ...timeOf(it), box: spots[i].box, scale: spots[i].scale, z: spots[i].z }));
  }
  if (layout === "over") placed.forEach((it) => (it.z = 0));
  // (words on a plate over the picture: they may cover it)
  const plated = layout === "over" || layout === "caption";
  // accents: a badge sits on a thing's corner, a shape behind, the cursor on its target
  acc.forEach((it, i) => {
    const t = timeOf(it);
    const host = placed.find((q) => q.id && q.id === it.title) ?? placed[i % Math.max(1, placed.length)] ?? null;
    const [bw, bh] = baseSize(it as PlacedItem);
    if (it.kind === "badge") {
      // on a corner of its thing (or beside the words), never over the words
      const sc = 1.1;
      const bwS = bw * sc, bhS = bh * sc;
      const hb = host?.box ?? null;
      const spots: Box[] = [];
      const R = rng(p.seed + i * 31);
      if (hb) for (const [sx, sy] of R.shuffle([[1, -1], [-1, 1], [1, 1], [-1, -1]] as const)) spots.push({ x: hb.x + sx * (hb.w / 2 - bwS * 0.15), y: hb.y + sy * (hb.h / 2 - bhS * 0.1), w: bwS, h: bhS });
      if (tb) for (const sy of [-1, 1]) spots.push({ x: tb.box.x, y: tb.box.y + sy * (tb.box.h / 2 + bhS * 0.9), w: bwS, h: bhS });
      spots.push({ x: W * 0.75, y: H * 0.2, w: bwS, h: bhS }, { x: W * 0.25, y: H * 0.8, w: bwS, h: bhS });
      const inside = (b: Box) => ({ ...b, x: Math.max(SAFE.l + b.w / 2, Math.min(SAFE.r - b.w / 2, b.x)), y: Math.max(SAFE.t + b.h / 2, Math.min(SAFE.b - b.h / 2, b.y)) });
      const ok = spots.map(inside).find((b) => (!tb || overlap(b, tb.box) < 0.02) && !placed.some((q) => q.kind === "badge" && overlap(q.box, b) > 0.02)) ?? inside(spots[spots.length - 1]);
      placed.push({ ...it, ...t, box: ok, scale: sc, z: 5 });
    } else if (it.kind === "cursor") {
      const hb = host?.box ?? { x: W * 0.6, y: H * 0.6, w: 0, h: 0 };
      placed.push({ ...it, ...t, box: { x: hb.x + hb.w * 0.22, y: hb.y + hb.h * 0.25, w: bw, h: bh }, scale: 1, z: 9 });
    } else {
      const hb = host?.box ?? { x: W / 2, y: H / 2, w: 800, h: 500 };
      const sc = Math.max(hb.w, hb.h) / bw * (it.variant === "orb" ? 0.45 : 1.25);
      placed.push({ ...it, ...t, box: { x: hb.x + (i % 2 ? -1 : 1) * hb.w * 0.42, y: hb.y - hb.h * 0.36, w: bw * sc, h: bh * sc }, scale: sc, z: -1 });
    }
  });
  // a thing named again from the last scene travels from where it was
  for (const it of placed) {
    const before = it.id ? p.prev?.items.find((q) => q.id === it.id) : null;
    if (before) {
      it.from = before.box;
      it.at = from;
    }
  }
  // checks
  for (const it of placed) {
    if (isAccent(it)) continue;
    if (it.scale < 0.42) problems.push(`${it.kind} is too small to read (scale ${it.scale.toFixed(2)})`);
    if (tb && !plated && overlap(tb.box, it.box) > 0.04) problems.push(`${it.kind} covers the words`);
  }
  const solid = placed.filter((q) => !isAccent(q));
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) if (kind !== "cascade" && kind !== "orbit" && overlap(solid[a].box, solid[b].box) > 0.06) problems.push(`${solid[a].kind} and ${solid[b].kind} overlap`);
  if (!tb && !placed.length) problems.push("the scene is empty");
  // something is on screen from the scene's first frames (never an empty field)
  const firstAt = Math.min(tb?.words[0]?.at ?? Infinity, ...placed.filter((q) => !isAccent(q)).map((q) => q.at));
  // (the film's first scene is already arriving on its first frame)
  const start = from === 0 ? -8 : from;
  if (firstAt > from + 3 || from === 0) {
    const lead = placed.filter((q) => !isAccent(q)).sort((x, y) => x.at - y.at)[0];
    if (lead) lead.at = Math.min(lead.at, start);
    else if (tb) tb.words[0].at = Math.min(tb.words[0].at, start);
  }
  const camera = s.camera ?? art.camera;
  return {
    placed: { from, to, dark: false, camera, enter: s.enter, layout, arrange: kind, text: tb, items: placed, seed: p.seed },
    problems,
  };
}

// How much of the frame the scene's things take (accents aside).
const fillOf = (p: PlacedScene) => p.items.filter((q) => !isAccent(q)).reduce((a, q) => a + q.box.w * q.box.h, 0) / ((SAFE.r - SAFE.l) * (SAFE.b - SAFE.t));

// The layouts tried, in order, when a scene's own has problems.
const RETRY: LayoutKind[] = ["top", "split-left", "split-right", "bottom", "center", "visual"];

// A script on the voice's words → the film's plan (never throws).
export function placeAll(script: ScriptT, words: Word[], duration: number, brand: Brand, seed: number, screens = 0, source: ComposerPlan["source"] = "director"): { plan: ComposerPlan; problems: Problem[] } {
  const problems: Problem[] = [];
  const nW = words.length;
  const frame = (i: number) => Math.round((words[Math.max(0, Math.min(nW - 1, i))]?.start ?? 0) * FPS);
  // scenes in spoken order, at least ~1.1 s apart
  const scenes = [...script.scenes].map((s) => ({ ...s, at: Math.max(0, Math.min(nW - 1, s.at)) })).sort((a, b) => a.at - b.at);
  const kept: SceneT[] = [];
  for (const s of scenes) {
    if (kept.length && frame(s.at) - frame(kept[kept.length - 1].at) < 34) {
      // too short to be seen: its things join the scene before
      const last = kept[kept.length - 1];
      last.items = [...last.items, ...s.items].slice(0, 6);
      continue;
    }
    kept.push({ ...s, items: [...s.items] });
  }
  if (kept.length) kept[0].at = 0;
  const placed: PlacedScene[] = [];
  const mixed = script.art.scheme === "mixed";
  kept.forEach((s, i) => {
    const from = i === 0 ? 0 : Math.max(placed[i - 1].from + 30, frame(s.at) - LEAD);
    const to = i < kept.length - 1 ? Math.max(from + 30, frame(kept[i + 1].at) - LEAD) : duration;
    const wordTo = i < kept.length - 1 ? kept[i + 1].at - 1 : nW - 1;
    const sceneSeed = (seed + i * 7919) >>> 0;
    const input: SceneInput = { scene: s, index: i, from, to, words, wordFrom: s.at, wordTo, art: script.art, seed: sceneSeed, prev: placed[i - 1] ?? null, screens };
    let best = placeScene(input);
    if (best.problems.length) {
      for (const layout of [s.layout, ...RETRY.filter((l) => l !== s.layout)]) {
        for (const arrangeK of [s.arrange ?? null, "row", "column", "grid", "single"] as (ArrangeKind | null)[]) {
          const tryIt = placeScene({ ...input, scene: { ...s, layout, arrange: arrangeK } });
          if (tryIt.problems.length < best.problems.length) best = tryIt;
          if (!best.problems.length) break;
        }
        if (!best.problems.length) break;
      }
      // still crowded: drop the smallest things until it reads
      let drop = { ...s, items: [...s.items] };
      while (best.problems.length && drop.items.filter((x) => !isAccent(x)).length > 1) {
        const solid = drop.items.filter((x) => !isAccent(x));
        drop = { ...drop, items: drop.items.filter((x) => x !== solid[solid.length - 1]) };
        const tryIt = placeScene({ ...input, scene: drop });
        if (tryIt.problems.length <= best.problems.length) best = tryIt;
      }
    }
    // the things should own the frame: when they fill little of it (a wide
    // row squeezed into a narrow side, small icons in a big field), another
    // layout that fills it far better — with words no smaller — is taken
    // (a composed layout is meant as it is)
    if (!best.problems.length && !COMPOSED.has(best.placed.layout) && best.placed.items.some((q) => !isAccent(q))) {
      const own = fillOf(best.placed);
      if (own < 0.26) {
        let pick = best, score = own;
        for (const layout of ["top", "bottom", "split-left", "split-right", "center"] as LayoutKind[]) {
          for (const arrangeK of [s.arrange ?? null, "row", "grid", "column"] as (ArrangeKind | null)[]) {
            const t = placeScene({ ...input, scene: { ...s, layout, arrange: arrangeK } });
            if (t.problems.length) continue;
            const fill = fillOf(t.placed);
            const words = (t.placed.text?.size ?? 0) >= (best.placed.text?.size ?? 0) * 0.8;
            if (words && fill > score * 1.25) {
              pick = t;
              score = fill;
            }
          }
        }
        best = pick;
      }
    }
    best.placed.dark = mixed ? (s.dark ?? i % 2 === 0) : (s.dark ?? script.art.scheme === "dark");
    // the ask's button shows the customer's own address, or none (never one made up)
    for (const q of best.placed.items) if (q.kind === "button") q.sub = brand.url?.trim() || null;
    // a whip is too sudden for bright things on a dark field: a push instead
    if (best.placed.dark && best.placed.enter === "whip") best.placed.enter = "push-left";
    // the very first scene has no way in; a match cut needs a thing to carry
    if (i === 0) best.placed.enter = "fade";
    if (best.placed.enter === "morph" && !best.placed.items.some((q) => q.from)) best.placed.enter = "blur";
    // a way in never longer than the scene before can give
    if (i > 0 && TRANSITION_FRAMES[best.placed.enter] > placed[i - 1].to - placed[i - 1].from - 10) best.placed.enter = "fade";
    best.problems.forEach((what) => problems.push({ scene: i, what }));
    placed.push(best.placed);
  });
  return { plan: { v: 1, duration, words, brand, art: script.art, scenes: placed, seed, source }, problems };
}
