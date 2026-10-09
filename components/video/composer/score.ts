import { MIN_SCENE, isAccent } from "./layout";
import type { Staging } from "./staging";
import { stagingName } from "./staging";
import type { ComposerPlan, ScriptT } from "./types";
import { H, W } from "./frame";

// The rule score (0–10) of a video as it would play: the house rules that
// can be measured on the plan, the creative plan kept, and how unlike this
// brand's earlier videos it is. Shown in the studio beside the video.

export type Score = { total: number; notes: string[] };
type Ctx = { staging?: Staging | null; motif?: { icon: string } | null; heroScene?: number | null; recent?: { staging?: Staging | null; display?: string | null }[]; problems?: number };

export function scorePlan(plan: ComposerPlan, script: ScriptT, ctx: Ctx = {}): Score {
  const notes: string[] = [];
  let total = 10;
  const minus = (n: number, why: string) => {
    total -= n;
    notes.push(`−${n} ${why}`);
  };
  const sc = plan.scenes;
  if (ctx.problems) minus(Math.min(3, ctx.problems * 0.5), `${ctx.problems} layout problem(s)`);
  sc.forEach((s, i) => {
    const secs = (s.to - s.from) / 30;
    const things = s.items.filter((it) => !isAccent(it));
    if (!things.length && secs > 2.5 && s.layout !== "type") minus(0.5, `scene ${i + 1} is ${secs.toFixed(1)} s of words only`);
    if (things.length > 3) minus(0.5, `scene ${i + 1} is crowded`);
    const words = s.text?.words.length ?? 0;
    if (secs > 0 && words / secs > 4.5) minus(0.3, `scene ${i + 1} has more words than can be read`);
    // too short to be seen, or its picture too small to read
    if (i < sc.length - 1 && s.to - s.from < MIN_SCENE - 8) minus(0.8, `scene ${i + 1} lasts only ${secs.toFixed(1)} s`);
    const biggest = Math.max(0, ...things.map((it) => (it.box.w * it.box.h) / (W * H)));
    if (things.length && biggest < 0.05) minus(0.5, `scene ${i + 1}'s picture is small`);
  });
  for (let i = 2; i < sc.length; i++) if (sc[i].layout === sc[i - 1].layout && sc[i].layout === sc[i - 2].layout) minus(0.4, `scenes ${i - 1}–${i + 1} share a layout`);
  const flips = sc.slice(1).filter((s, i) => s.dark !== sc[i].dark).length;
  if (flips > 2) minus(1, `the background turns ${flips} times`);
  if (!ctx.staging || ctx.staging.family === "cuts") {
    const kinds = new Set(sc.slice(1).map((s) => s.enter));
    if (kinds.size > 3) minus(0.6, `${kinds.size} kinds of way in`);
  }
  if (!sc.at(-1)?.items.some((it) => it.kind === "button")) minus(2, "no call to action at the end");
  // the hero moment: one big thing
  const hero = ctx.heroScene != null ? sc[ctx.heroScene] : null;
  if (hero) {
    const area = Math.max(0, ...hero.items.filter((it) => !isAccent(it)).map((it) => (it.box.w * it.box.h) / (W * H)));
    if (area < 0.08) minus(1, "the hero moment has no big thing");
  }
  // the motif comes back
  if (ctx.motif) {
    const shown = script.scenes.filter((s) => s.items.some((it) => it.icon === ctx.motif!.icon || (it.rows ?? []).some((r) => r.icon === ctx.motif!.icon))).length;
    if (shown < 2) minus(0.5, `the motif shows in ${shown} scene(s)`);
  }
  // unlike this brand's earlier videos
  const recent = ctx.recent ?? [];
  if (ctx.staging && recent.some((r) => r.staging && stagingName(r.staging) === stagingName(ctx.staging))) minus(1, `the same camera language (${stagingName(ctx.staging)}) as an earlier video`);
  if (recent.some((r) => r.display === script.art.display)) minus(0.5, `the same headline face as an earlier video`);
  return { total: Math.max(0, Math.round(total * 10) / 10), notes };
}
