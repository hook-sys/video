import { estimateWords } from "@/lib/flow-script";
import type { SceneScript } from "@/lib/scene-script";
import { spokenCueTimes, type WordTiming } from "@/lib/voice-timing";
import { RULE_BY_ID } from "@/lib/video-rules";
import { num, vec } from "./eval";
import { planQuality, qualityProblems } from "./quality";
import { computeStates } from "./states";
import type { FlowPlan } from "./types";

// Detectors for the composition rulebook (lib/video-rules.ts), run on every
// compiled SceneScript: each violation names its rule and where it happens.
// The Director is asked to fix them, and they are logged per video.

export type Violation = { rule: string; detail: string };

const FRAME = 1920 * 1080;
const tokenCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function compositionCheck(
  script: SceneScript,
  plan: FlowPlan,
  { narration, words, durationSeconds, screenshots = 0 }: { narration: string; words?: WordTiming[] | null; durationSeconds: number; screenshots?: number },
): Violation[] {
  const out: Violation[] = [];
  const add = (rule: string, detail: string) => {
    if (rule === "quality" || !out.some((v) => v.rule === rule)) out.push({ rule, detail });
  };
  const beats = script.beats;
  const timeline = words?.length ? words : estimateWords(narration, durationSeconds);
  const times = spokenCueTimes(beats.map((b) => b.cue), timeline);
  const speechEnd = timeline[timeline.length - 1]?.end ?? durationSeconds;

  // Rhythm: a gap with nothing new (text on screen is something new).
  for (let i = 1; i < beats.length; i++) {
    const [a, b] = [times[i - 1], times[i]];
    if (a === null || b === null) continue;
    if (!["statement", "list"].includes(beats[i - 1].action) && b - a > 2.2) {
      add("idle", `${(b - a).toFixed(1)} s with nothing new after "${beats[i - 1].cue}"`);
      break;
    }
  }
  // Scene length: until the next scene, or until type takes over the frame.
  beats.forEach((b, i) => {
    if (b.action !== "scene" || times[i] === null) return;
    const j = beats.findIndex((x, k) => k > i && (x.action === "scene" || x.action === "statement" || x.action === "list"));
    const end = j === -1 ? speechEnd : (times[j] ?? speechEnd);
    if (end - times[i]! > 6.5) add("long-scene", `the scene on "${b.cue}" holds for ${(end - times[i]!).toFixed(1)} s`);
  });
  const long = beats.find((b) => b.action === "statement" && tokenCount(b.text ?? b.cue) > 8);
  if (long) add("text-wall", `the statement "${long.text ?? long.cue}" has ${tokenCount(long.text ?? long.cue)} words`);
  const cuts = beats.filter((b, i) => b.action === "scene" && i > 0 && b.transition === "cut").length;
  if (cuts > 1) add("cut-spam", `${cuts} scenes start with a hard cut`);
  const assets = beats.flatMap((b) => (b.elements ?? []).map((e) => e.asset ?? ""));
  const nonCard = assets.filter((a) => /^(text|shape|visual):/.test(a)).length;
  if (assets.length >= 4 && nonCard < 3) add("only-cards", `${nonCard} of ${assets.length} elements are text, shapes or visuals`);
  const scenes = beats.filter((b) => b.action === "scene");
  const family = (l: string | null) => (l ?? "grid").replace(/-[a-z]$/, "");
  const heroes = scenes.filter((b) => family(b.layout).startsWith("hero")).length;
  const fams = scenes.map((b) => family(b.layout));
  if (heroes > 2) add("same-layouts", `${heroes} of ${scenes.length} scenes use a hero layout`);
  else if (new Set(fams).size < fams.length) add("same-layouts", `layout families repeat: ${fams.join(", ")}`);
  const bds = scenes.map((b) => b.backdrop).filter(Boolean);
  if (new Set(bds).size < bds.length) add("repeat-backdrop", `backdrops repeat: ${bds.join(", ")}`);
  const celebrates = beats.filter((b) => b.action === "celebrate").length;
  if (celebrates > 1) add("decor-beats", `${celebrates} beats are only a celebrate accent`);
  if (screenshots > 0) {
    const used = new Set(beats.flatMap((b) => (b.elements ?? []).flatMap((e) => [e.asset, e.screen])).filter((a): a is string => !!a?.startsWith("shot:")).map((a) => a.split("/")[0]));
    if (used.size < Math.min(screenshots, 2)) add("unused-screens", `${used.size} of ${screenshots} screenshots shown`);
  }

  // On screen, sampled every 6 frames before the brand lockup: how many sharp
  // elements, how big the biggest is, and how big the client's screens are.
  const until = plan.brand ? plan.brand.start : plan.duration;
  let crowdRun = 0;
  let smallRun = 0;
  let tinyRun = 0;
  for (let f = 0; f < until; f += 6) {
    if (num(plan.dim, f, 0) > 0.5) {
      [crowdRun, smallRun, tinyRun] = [0, 0, 0];
      continue;
    }
    const zoom = num(plan.camera.zoom, f, 1);
    const c = vec(plan.camera.center, f);
    const sharp = [...computeStates(plan, f).values()].filter((st) => {
      const n = st.node;
      if (n.kind !== "el" || st.opacity < 0.9 || st.scale < 0.05 || num(n.blur, f, 0) > 1.5 || (n.erase !== undefined && f >= n.erase)) return false;
      const w = (n.w ?? 400) * st.scale * zoom;
      const h = (n.h ?? 300) * st.scale * zoom;
      const [x, y] = [960 + zoom * (st.pos[0] - c[0]), 540 + zoom * (st.pos[1] - c[1])];
      return Math.min(x + w / 2, 1920) - Math.max(x - w / 2, 0) > w * 0.6 && Math.min(y + h / 2, 1080) - Math.max(y - h / 2, 0) > h * 0.6;
    });
    const area = (st: (typeof sharp)[number]) => ((st.node.w ?? 400) * (st.node.h ?? 300) * (st.scale * zoom) ** 2) / FRAME;
    crowdRun = sharp.length > 4 ? crowdRun + 6 : 0;
    if (crowdRun >= 30) add("crowded", `${sharp.length} sharp elements on screen at ${(f / 30).toFixed(1)} s`);
    const biggest = Math.max(0, ...sharp.map(area));
    smallRun = sharp.length && biggest < 0.1 ? smallRun + 6 : 0;
    if (smallRun >= 60) add("no-hero", `no element above ${Math.round(biggest * 100)}% of the frame around ${(f / 30).toFixed(1)} s`);
    const screens = sharp.filter((st) => st.node.el?.type === "shot" || st.node.el?.type === "device");
    tinyRun = screens.some((st) => area(st) < 0.12) ? tinyRun + 6 : 0;
    if (tinyRun >= 30) add("tiny-screens", `a screenshot fills only ${Math.round(Math.min(...screens.map(area)) * 100)}% of the frame at ${(f / 30).toFixed(1)} s`);
  }

  // The technical gate, mapped onto the same rulebook.
  for (const p of qualityProblems(planQuality(plan))) {
    if (p.includes("element") && p.includes("over element")) add("stacked", p);
    else if (p.includes("overlap")) add("overlap-text", p);
    else if (p.includes("empty frame")) add("empty-frame", p);
    else if (p.includes("jolt")) add("camera-swing", p);
    else add("quality", p);
  }
  return out;
}

// A violation as a revision note for the Director.
export const violationNote = (v: Violation) => (RULE_BY_ID.has(v.rule) ? `rule "${v.rule}" broken (${v.detail}): ${RULE_BY_ID.get(v.rule)!.never}` : v.detail);
