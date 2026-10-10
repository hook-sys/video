import { isAccent } from "./layout";
import type { Box, ComposerPlan, PlacedItem, PlacedScene, TransitionKind } from "./types";

// The Frame Inspector (the QA director): code, not a model — it looks at the
// video as it will play, every few frames, scene changes included, and finds
// what a viewer would see wrong: two things touching, the words covered,
// something off the frame, a thing gone before it can be seen, an empty
// screen, a thing flying across the words, two scenes sitting on each other
// while they change. What it can mend it mends (the plan comes back fixed);
// what it cannot is reported, for the Motion Director's review and the score.

export type Finding = { scene: number; frame: number; what: string };
const STEP = 3;
// a thing is on screen at least this long (frames), the words all shown at
// least READ_MIN — no longer, so neither comes in long before it is said
export const SEEN_MIN = 45;
export const READ_MIN = 30;
// (a badge is a word on a chip: read, like the words)
const seenMin = (it: PlacedItem) => (it.kind === "badge" ? READ_MIN + 6 : SEEN_MIN);
// gaps (px) between the words and a thing, and between two things
const TEXT_GAP = 24, THING_GAP = 8, EDGE = 8;
// the ways in that move the old scene out with the new one (never on top of it)
const TOGETHER = /^(push|whip)/;

const touches = (a: Box, b: Box, pad: number) => Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2) > -pad && Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2) > -pad;
const grow = (b: Box, pad: number): Box => ({ ...b, w: b.w + pad * 2, h: b.h + pad * 2 });
// does the straight path from a's centre to b's centre cross the box?
function crosses(a: Box, b: Box, box: Box) {
  for (let k = 0.15; k <= 0.85; k += 0.05) {
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
    if (Math.abs(x - box.x) < box.w / 2 && Math.abs(y - box.y) < box.h / 2) return true;
  }
  return false;
}
const solid = (s: PlacedScene) => s.items.filter((it) => !isAccent(it) || it.kind === "badge");
// (words laid on a plate over the picture may cover it)
const plated = (s: PlacedScene) => s.layout === "over" || s.layout === "caption";
const lastWord = (s: PlacedScene) => Math.max(...(s.text?.words.map((w) => w.at) ?? [s.from]));

// Everything wrong with the plan as it plays.
export function inspect(plan: ComposerPlan): Finding[] {
  const W = plan.w ?? 1920, H = plan.h ?? 1080;
  const found: Finding[] = [];
  const journey = !!plan.journey;
  plan.scenes.forEach((s, i) => {
    const things = solid(s);
    const tb = s.text?.box ?? null;
    // held: what is on screen once all of it has come in
    const held = Math.max(s.from, ...things.map((it) => it.at), s.text ? lastWord(s) : s.from);
    if (tb && !plated(s)) for (const it of things) if (touches(tb, it.box, it.kind === "badge" ? 6 : TEXT_GAP)) found.push({ scene: i, frame: held, what: `${it.kind}${it.title ? ` "${it.title}"` : ""} touches the words` });
    const tidy = s.arrange !== "cascade" && s.arrange !== "orbit";
    for (let a = 0; a < things.length; a++) for (let b = a + 1; b < things.length; b++) if (tidy && things[a].kind !== "badge" && things[b].kind !== "badge" && touches(things[a].box, things[b].box, THING_GAP)) found.push({ scene: i, frame: held, what: `${things[a].kind} and ${things[b].kind} touch` });
    for (const bx of [...things.map((it) => it.box), ...(tb ? [tb] : [])]) if (bx.x - bx.w / 2 < -EDGE || bx.x + bx.w / 2 > W + EDGE || bx.y - bx.h / 2 < -EDGE || bx.y + bx.h / 2 > H + EDGE) found.push({ scene: i, frame: held, what: "something is off the frame" });
    // long enough on screen
    const last = i === plan.scenes.length - 1;
    for (const it of things) if (!last && s.to - Math.max(s.from, it.at) < seenMin(it)) found.push({ scene: i, frame: it.at, what: `${it.kind} is on screen only ${((s.to - it.at) / 30).toFixed(1)} s` });
    if (s.text && !last && s.to - lastWord(s) < READ_MIN) found.push({ scene: i, frame: lastWord(s), what: `the words finish ${((s.to - lastWord(s)) / 30).toFixed(1)} s before the scene goes` });
    // never an empty screen at the start of a scene
    const first = Math.min(...things.map((it) => it.at), s.text?.words[0]?.at ?? Infinity);
    if (first > s.from + 15) found.push({ scene: i, frame: s.from, what: `the screen is empty for ${((first - s.from) / 30).toFixed(1)} s` });
    // a thing carried in from the scene before never flies across the words
    const prev = plan.scenes[i - 1];
    for (const it of s.items) if (it.from) for (const words of [tb, prev?.text?.box].filter((x): x is Box => !!x)) if (crosses(it.from, it.box, grow(words, 10))) found.push({ scene: i, frame: s.from, what: `${it.kind} flies across the words` });
    // on a journey, a carry lifts the scene's main thing off and flies it to
    // the next scene — over the words of the scene it leaves
    if (i > 0 && journey && (plan.links?.[i] ?? plan.link) === "carry" && prev?.text) found.push({ scene: i, frame: s.from, what: "a thing flies over the words while the camera travels" });
    // two scenes on top of each other while they change (a cut fades one
    // into the other: their words and things must not meet)
    if (i > 0 && !journey && !TOGETHER.test(s.enter)) {
      const before = [...solid(prev).map((it) => it.box), ...(prev.text ? [prev.text.box] : [])];
      const now = [...things.map((it) => it.box), ...(tb ? [tb] : [])];
      for (let f = s.from - 2; f <= s.from + 12; f += STEP)
        if (before.some((a) => now.some((b) => touches(a, b, 0)))) {
          found.push({ scene: i, frame: f, what: "the scene before is still on top of it while it comes in" });
          break;
        }
    }
  });
  return found;
}

// The plan with what can be mended mended, and what could not.
export function inspected(plan: ComposerPlan): { plan: ComposerPlan; fixed: string[]; left: Finding[] } {
  const W = plan.w ?? 1920, H = plan.h ?? 1080;
  const fixed: string[] = [];
  const scenes = plan.scenes.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it })), text: s.text ? { ...s.text, words: s.text.words.map((w) => ({ ...w })) } : null }));
  const out = { ...plan, scenes };
  for (const f of inspect(out)) {
    const s = scenes[f.scene];
    const prev = scenes[f.scene - 1];
    if (f.what.includes("touches the words") && s.text) {
      // a badge (a small extra) on the words is left out; a main thing stays
      // where the layout put it (reported)
      const tb = s.text.box;
      const before = s.items.length;
      s.items = s.items.filter((it) => !(it.kind === "badge" && touches(tb, it.box, 6)));
      if (s.items.length < before) fixed.push(`scene ${f.scene + 1}: a badge on the words left out`);
    } else if (f.what.includes("off the frame")) {
      // moved inside (and made smaller if it is bigger than the frame)
      const inside = (b: Box) => {
        const k = Math.min(1, (W - EDGE * 2) / b.w, (H - EDGE * 2) / b.h);
        const w = b.w * k, h = b.h * k;
        return { x: Math.max(w / 2 + EDGE, Math.min(W - w / 2 - EDGE, b.x)), y: Math.max(h / 2 + EDGE, Math.min(H - h / 2 - EDGE, b.y)), w, h, k };
      };
      for (const it of s.items) {
        const m = inside(it.box);
        if (m.x !== it.box.x || m.y !== it.box.y || m.k !== 1) {
          it.box = { x: m.x, y: m.y, w: m.w, h: m.h };
          it.scale *= m.k;
        }
      }
      if (s.text) {
        const m = inside(s.text.box);
        s.text.box = { x: m.x, y: m.y, w: m.w, h: m.h };
      }
      fixed.push(`scene ${f.scene + 1}: brought inside the frame`);
    } else if (/is on screen only/.test(f.what)) {
      // earlier, so it is seen (the scene's own start at the earliest)
      for (const it of solid(s)) if (s.to - Math.max(s.from, it.at) < seenMin(it)) it.at = Math.max(s.from, s.to - seenMin(it) - 3);
      fixed.push(`scene ${f.scene + 1}: things come in earlier`);
    } else if (f.what.startsWith("the words finish") && s.text) {
      // the words said closer together, all on screen in time
      const ws = s.text.words;
      const a = ws[0].at, b = Math.max(a, s.to - READ_MIN - 6);
      const z = Math.max(...ws.map((w) => w.at));
      if (z > b) ws.forEach((w) => (w.at = Math.round(a + ((w.at - a) * (b - a)) / Math.max(1, z - a))));
      fixed.push(`scene ${f.scene + 1}: the words come in sooner`);
    } else if (f.what.startsWith("the screen is empty")) {
      const lead = [...solid(s)].sort((x, y) => x.at - y.at)[0];
      if (lead) lead.at = s.from;
      else if (s.text?.words[0]) s.text.words[0].at = s.from;
      fixed.push(`scene ${f.scene + 1}: something on screen from the start`);
    } else if (f.what.includes("flies across the words")) {
      // it comes in where it is instead of flying there
      for (const it of s.items) if (it.from) {
        it.from = null;
        it.at = Math.max(it.at, s.from + 6);
      }
      if (s.enter === "morph") s.enter = "blur";
      fixed.push(`scene ${f.scene + 1}: no flight across the words`);
    } else if (f.what.startsWith("a thing flies over the words while")) {
      // the camera travels along its line instead (nothing flies)
      const n = scenes.length;
      out.links = (out.links ?? Array(n).fill(null)).map((l, k) => (k === f.scene ? "line" : (l ?? (k ? out.link : null)) ?? null));
      fixed.push(`scene ${f.scene + 1}: the camera travels without carrying a thing over the words`);
    } else if (f.what.startsWith("the scene before is still on top") && prev) {
      // the old scene moves out with the new one instead of fading under it
      s.enter = "push-left" as TransitionKind;
      fixed.push(`scene ${f.scene + 1}: the scene before moves out as it comes in`);
    }
  }
  return { plan: out, fixed: [...new Set(fixed)], left: inspect(out) };
}

// A thing's box as a short label (for a finding's report).
export const describe = (it: PlacedItem) => `${it.kind}${it.title ? ` "${it.title}"` : ""}`;
