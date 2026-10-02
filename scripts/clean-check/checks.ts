// Checks for the clean explainer's rulebook (components/video/clean/rules.ts)
// on the Flowly proof plans (four variants) and the four reference films'
// timings. Rules kept only by review are listed, not checked.
import { cameraOf, captionGroups, IN, LEAD_IN, OUTF } from "@/components/video/clean/clean-video";
import { FLOWLY_VARIANTS, flowlyPlan, WORDS } from "@/components/video/clean/fixtures/flowly";
import { T } from "@/components/video/clean/refs/timing";
import { CLEAN_RULES } from "@/components/video/clean/rules";
import type { KWord } from "@/components/video/clean/text";
import { FPS } from "@/components/video/clean/types";
import { findPhrase } from "@/components/video/clean/words";

type Check = { section: string; name: string; ok: boolean; detail: string };

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  let section = "";
  const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });
  const plans = FLOWLY_VARIANTS.map((_, i) => flowlyPlan(i));

  section = "rulebook";
  const ids = CLEAN_RULES.map((r) => r.id);
  add("12 rules, unique ids", ids.length >= 12 && new Set(ids).size === ids.length, `${ids.length} rules`);
  add("every rule has problem, rule and fix", CLEAN_RULES.every((r) => r.problem && r.rule && r.fix && r.kept.length), CLEAN_RULES.filter((r) => r.kept.includes("review")).map((r) => r.id).join(", ") + " kept by review");

  section = "camera-crop";
  const parse = (t: string) => {
    const scale = [...t.matchAll(/scale\(([-\d.]+)\)/g)].reduce((a, m) => a * Number(m[1]), 1);
    const tx = Number(/translate\(([-\d.]+)px/.exec(t)?.[1] ?? 0);
    return { scale, tx };
  };
  for (const [i, plan] of plans.entries()) {
    let lo = 9, hi = 0, tx = 0;
    plan.scenes.forEach((sc, k) => {
      for (let f = sc.from; f < sc.to; f++) {
        const c = parse(cameraOf(sc, plan.variant, f, k).cam);
        lo = Math.min(lo, c.scale);
        hi = Math.max(hi, c.scale);
        tx = Math.max(tx, Math.abs(c.tx));
      }
    });
    add(`variant ${i + 1} (${plan.variant.camera})`, lo >= 0.88 && hi <= 1.13 && tx <= 90, `scale ${lo.toFixed(3)}–${hi.toFixed(3)}, pan ≤ ${tx.toFixed(0)}px`);
  }

  section = "half-scenes";
  add("out before in", OUTF <= IN && LEAD_IN <= 2, `out ${OUTF} frames, in ${IN} frames from ${LEAD_IN} before the cut`);
  for (const [i, plan] of plans.entries()) {
    const gaps = plan.scenes.slice(1).filter((sc, k) => sc.from !== plan.scenes[k].to).length;
    const short = plan.scenes.filter((sc) => sc.to - sc.from < IN + OUTF).length;
    add(`variant ${i + 1} scenes contiguous, none too short`, !gaps && !short && plan.scenes[plan.scenes.length - 1].to === plan.duration, `${plan.scenes.length} scenes, ${gaps} gaps/overlaps, ${short} shorter than ${IN + OUTF} frames`);
  }

  section = "caption-across-stop";
  const groups = captionGroups(WORDS);
  const across = groups.filter((g) => g.words.slice(0, -1).some((w) => /[.,!?]$/.test(w)));
  add("no caption runs across a stop", !across.length, across.map((g) => g.words.join(" ")).join(" | ") || `${groups.length} captions`);
  add("captions are 1–4 words", groups.every((g) => g.words.length >= 1 && g.words.length <= 4), `longest ${Math.max(...groups.map((g) => g.words.length))}`);

  section = "early-element";
  for (const [i, plan] of plans.entries()) {
    const bad: string[] = [];
    for (const sc of plan.scenes) {
      for (const [k, v] of Object.entries(sc.cues)) if (v < sc.from - LEAD_IN || v > sc.to + 30) bad.push(`${sc.template}.${k}`);
      for (const list of Object.values(sc.data)) {
        if (!Array.isArray(list)) continue;
        for (const w of list as KWord[]) {
          if (typeof w?.t !== "string" || typeof w.at !== "number") continue;
          const spoken = WORDS.find((x) => Math.round(x.start * FPS) - 2 === w.at);
          if (!spoken) bad.push(`${sc.template}:"${w.t}"`);
        }
      }
    }
    add(`variant ${i + 1} words and cues on the voice`, !bad.length, bad.join(", ") || "all words on their spoken frame, cues inside their scenes");
  }
  const order = [T.every, T.sales, T.flowly, T.when1, T.when2, T.no1, T.no2, T.just, T.end, T.duration];
  add("reference films: sentence moments in order", order.every((v, k) => !k || v > order[k - 1]), order.join(" < "));

  section = "split-voice-words";
  const split = [
    { text: "Every", start: 0, end: 0.3 },
    { text: "sa", start: 0.4, end: 0.6 },
    { text: "les", start: 0.6, end: 0.9 },
    { text: ".", start: 0.9, end: 0.9 },
    { text: "grow", start: 1, end: 1.3 },
  ];
  let found = "";
  try {
    found = findPhrase(split, "sales grow").join(",");
  } catch (e) {
    found = String(e);
  }
  add("a word split in two is found", found === "1,4", `"sales grow" → tokens ${found}`);
  let missing = false;
  try {
    findPhrase(split, "sales shrink");
  } catch {
    missing = true;
  }
  add("an unspoken phrase still fails", missing, "throws");
  add("Flowly voice phrases still found", findPhrase(WORDS, "No more waiting for reports.").length === 5, "No more waiting for reports.");

  section = "covered elsewhere";
  add("asset-type-swap, support-placement", true, "checked by npm run check:assets and check:recipe");
  return checks;
}
