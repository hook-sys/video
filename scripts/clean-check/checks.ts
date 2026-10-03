// Checks for the clean explainer's rulebook (components/video/clean/rules.ts)
// on the Flowly proof plans (four variants) and the four reference films'
// timings. Rules kept only by review are listed, not checked.
import { cameraOf, captionGroups, IN, LEAD_IN, OUTF } from "@/components/video/clean/clean-video";
import { FLOWLY_VARIANTS, flowlyPlan, WORDS } from "@/components/video/clean/fixtures/flowly";
import { shopnestPlan } from "@/components/video/clean/fixtures/sample";
import { beatsFromPlan } from "@/components/video/clean/refs/beats";
import { FILM_TEMPLATES } from "@/components/video/clean/refs/catalog";
import { FILM_IDS } from "@/components/video/clean/refs";
import { connectCuts } from "@/components/video/clean/refs/connect";
import { duskCuts } from "@/components/video/clean/refs/dusk";
import { flyCuts } from "@/components/video/clean/refs/fly";
import { glowCuts } from "@/components/video/clean/refs/glow";
import { CLEAN_RULES } from "@/components/video/clean/rules";
import type { KWord } from "@/components/video/clean/text";
import { FPS } from "@/components/video/clean/types";
import { findPhrase } from "@/components/video/clean/words";
import { type CleanScriptOut, generateCleanScript } from "@/lib/ai/clean-director";
import { cleanVariants, FILM_HUE, hueOf } from "@/lib/clean-variants";
import { buildPlan } from "@/components/video/clean/plan";
import { DEFAULT_CONTENT } from "@/components/video/clean/content";

type Check = { section: string; name: string; ok: boolean; detail: string };

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  let section = "";
  const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });
  const plans = FLOWLY_VARIANTS.map((_, i) => flowlyPlan(i));

  section = "rulebook";
  const ids = CLEAN_RULES.map((r) => r.id);
  add("rules have unique ids", ids.length >= 15 && new Set(ids).size === ids.length, `${ids.length} rules`);
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

  section = "film templates";
  add("every film has a catalog entry", FILM_IDS.every((id) => FILM_TEMPLATES.some((t) => t.id === id)) && FILM_TEMPLATES.length === FILM_IDS.length, FILM_IDS.join(", "));
  for (const [name, plan] of [["Flowly", plans[0]], ["Shopnest", shopnestPlan()]] as const) {
    const b = beatsFromPlan(plan);
    const T = b.t;
    const order = [T.every, T.sales, T.flowly, T.when1, T.when2, T.no1, T.no2, T.just, T.end, T.duration];
    add(`${name}: sentence moments in order`, order.every((v, k) => !k || v > order[k - 1]), order.join(" < "));
    const empty = Object.entries(b.line).filter(([, v]) => (Array.isArray(v) ? !v.length : !v?.t)).map(([k]) => k);
    add(`${name}: every line the films show has words`, !empty.length, empty.join(", ") || `${Object.keys(b.line).length} lines`);
    const bad = Object.entries(T).filter(([, v]) => !Number.isFinite(v) || v < 0 || v > plan.duration).map(([k]) => k);
    add(`${name}: every moment inside the video`, !bad.length, bad.join(", ") || `${Object.keys(T).length} moments`);
    add(`${name}: three things`, b.trio.length === 3 && b.trio.every((x) => x.label && x.at > 0), b.trio.map((x) => x.label).join(", "));
    for (const [film, cutsOf] of [["glow", glowCuts], ["dusk", duskCuts], ["fly", flyCuts], ["connect", connectCuts]] as const) {
      const cuts = Object.entries(cutsOf(T) as Record<string, number>);
      const short = cuts.slice(1).filter(([, v], k) => v - cuts[k][1] < 16).map(([k, v], i) => `${cuts[i][0]}→${k} ${v - cuts[i][1]}f`);
      add(`${name}: ${film} shots all ≥ 16 frames (short-shot)`, !short.length, short.join(", ") || `${cuts.length - 1} shots, shortest ${Math.min(...cuts.slice(1).map(([, v], k) => v - cuts[k][1]))} frames`);
    }
    add(`${name}: big word is not a small word`, !/^(a|an|the|in|on|of|to|for|with|and|or|your|at|by)$/i.test(b.line.hookBig.t), `"${b.line.hookBig.t}"`);
  }

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

  section = "clean director";
  const flowly = plans[0];
  const FLOWLY_OUT: CleanScriptOut = {
    tagline: "Every answer you need",
    hook: { text: "Every team starts with data scattered across different tools.", key: "scattered", big: "data" },
    trio: {
      text: "Sales in one place. Payments in another. Reports somewhere else.",
      items: [
        { label: "Sales", sub: "in one place", icon: "chart-line" },
        { label: "Payments", sub: "in another", icon: "credit-card" },
        { label: "Reports", sub: "somewhere else", icon: "not-an-icon" },
      ],
    },
    reveal: { name: "Flowly", sub: "brings everything into one live dashboard.", key: "dashboard." },
    pay: { eyebrow: "When a payment arrives,", title: "revenue updates instantly.", key: "instantly.", pay: "payment arrives", rev: "revenue updates", inst: "instantly" },
    growth: { eyebrow: "When sales grow,", title: "the entire team sees the change in one view.", key: "view.", grow: "grow", team: "entire team", zoom: "in one view" },
    nomore: { a: "No more switching between tools.", aKey: "switching", b: "No more waiting for reports.", bKey: "waiting" },
    cta: { tagline: "Just one live dashboard with every answer you need.", key: "answer" },
    content: { ...DEFAULT_CONTENT, rows: DEFAULT_CONTENT.rows.slice(0, 2), growth: { label: "Sales", from: 900, to: 800, unit: "$" } },
  };
  const mock = (answers: (CleanScriptOut | Error)[]) => {
    const calls: string[] = [];
    return {
      calls,
      client: {
        responses: {
          parse: async (req: { input: string }) => {
            calls.push(req.input);
            const a = answers[Math.min(calls.length - 1, answers.length - 1)];
            if (a instanceof Error) throw a;
            return { id: `r${calls.length}`, usage: { input_tokens: 10, output_tokens: 20 }, output_parsed: a };
          },
        },
      } as never,
    };
  };
  const input = { brand: flowly.brand, words: flowly.words, product: "a live dashboard for small teams" };
  const ok = mock([FLOWLY_OUT]);
  const r1 = await generateCleanScript(input, undefined, ok.client);
  const same = r1.plan ? Object.entries(beatsFromPlan(flowly).t).filter(([k, v]) => (beatsFromPlan(r1.plan!).t as Record<string, number>)[k] !== v).map(([k]) => k) : ["no plan"];
  add("a good answer → the plan, on the voice", r1.source === "ai" && r1.attempts === 1 && !same.length, `${r1.source}, ${r1.attempts} call; moments differing from the hand-made Flowly plan: ${same.join(", ") || "none"}`);
  add("unknown icon → a safe icon; short lists filled; growth grows", r1.script?.trio.items[2].icon === "sparkles" && r1.script.content?.rows.length === 3 && r1.script.content.growth.to > r1.script.content.growth.from, `${r1.script?.trio.items[2].icon}, ${r1.script?.content?.rows.length} rows, growth ${r1.script?.content?.growth.from}→${r1.script?.content?.growth.to}`);
  const bad = { ...FLOWLY_OUT, pay: { ...FLOWLY_OUT.pay, title: "revenue changes at once." } };
  const rev = mock([bad, FLOWLY_OUT]);
  const r2 = await generateCleanScript(input, undefined, rev.client);
  add("a misquote → one revision with the problem", r2.source === "revised" && r2.attempts === 2 && rev.calls[1]?.includes("revenue changes at once."), `${r2.source}, ${r2.attempts} calls; problem sent: ${rev.calls[1]?.split("\n")[1]?.slice(0, 80)}`);
  const fail = mock([new Error("timeout")]);
  const r3 = await generateCleanScript(input, undefined, fail.client);
  add("a failed call → the sentence fallback, still a plan", r3.source === "fallback" && !!r3.plan && r3.problems.some((p) => p.includes("timeout")), `${r3.source}; ${r3.problems[0]}`);
  const sn = shopnestPlan();
  const r4 = await generateCleanScript({ brand: sn.brand, words: sn.words }, undefined, mock([bad, bad]).client);
  add("wrong twice → fallback on another script", r4.source === "fallback" && !!r4.plan, `${r4.source}, ${r4.problems.length} problems noted`);
  const short = await generateCleanScript({ brand: sn.brand, words: sn.words.slice(0, 12) }, undefined, mock([new Error("x")]).client);
  add("too short a narration → no plan, never a throw", short.source === "none" && !short.plan, short.problems.slice(-1)[0] ?? "");
  const nope = buildPlan({ ...FLOWLY_OUT, brand: flowly.brand, content: DEFAULT_CONTENT, hook: { text: "Words nobody said here.", key: "nobody", big: null } } as never, flowly.words);
  add("buildPlan reports a misquote instead of throwing", !nope.plan && nope.problems.some((p) => p.startsWith("hook")), nope.problems[0] ?? "");

  const stored = JSON.parse(JSON.stringify(r1.script));
  const again = buildPlan({ ...stored, brand: { ...stored.brand, name: "Renamed", icon: "https://example.com/i.png" } }, flowly.words);
  add("the stored script (JSON) rebuilds the plan with the customer's brand", !!again.plan && again.plan.brand.name === "Renamed" && again.plan.duration === flowly.duration, again.problems[0] ?? `duration ${again.plan?.duration}`);

  section = "variation engine";
  const g1 = cleanVariants(1234, [], "#6a5bff");
  add("four different templates", new Set(g1.map((v) => v.film)).size === 4, g1.map((v) => `${v.film}/${v.tint}`).join(", "));
  const g2 = cleanVariants(1234, [g1], "#6a5bff");
  const g3 = cleanVariants(1234, [g1, g2], "#6a5bff");
  const g4 = cleanVariants(1234, [g1, g2, g3], "#6a5bff");
  const all = [g1, g2, g3, g4].flat().map((v) => `${v.film}:${v.tint}`);
  add("four regenerations: no template repeats a colour", new Set(all).size === 16, `${new Set(all).size}/16 distinct; g2 ${g2.map((v) => `${v.film}/${v.tint}`).join(", ")}`);
  add("a regeneration changes the order or every colour", g2.every((v, i) => v.film !== g1[i].film || v.tint !== g1[i].tint), g2.map((v) => v.film).join(", "));
  const bh = hueOf("#6a5bff")!;
  const branded = g1.concat(g2, g3, g4).filter((v) => v.tint === "brand");
  add("a brand tint turns the film to the brand's hue", branded.every((v) => Math.abs(((FILM_HUE[v.film] + v.hue - bh) % 360 + 540) % 360 - 180) <= 1), branded.map((v) => `${v.film} ${v.hue}°`).join(", "));
  add("the same seed → the same four", JSON.stringify(cleanVariants(1234, [], "#6a5bff")) === JSON.stringify(g1), "deterministic");

  section = "covered elsewhere";
  add("asset-type-swap, support-placement", true, "checked by npm run check:assets and check:recipe");
  return checks;
}
