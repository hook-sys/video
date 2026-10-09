import { readdirSync, readFileSync } from "node:fs";
// Checks for the clean explainer's rulebook (components/video/clean/rules.ts)
// on the Flowly proof plans (four variants) and the four reference films'
// timings. Rules kept only by review are listed, not checked.
import { cameraOf, captionGroups, IN, LEAD_IN, OUTF } from "@/components/video/clean/clean-video";
import { FLOWLY_VARIANTS, flowlyPlan, WORDS } from "@/components/video/clean/fixtures/flowly";
import { BOOKWELL, bookwellPlan, shopnestPlan } from "@/components/video/clean/fixtures/sample";
import { buildStory, storyOf, type Story } from "@/components/video/clean/plan";
import { fallbackStories, generateStories, partsFor, type StoriesOut } from "@/lib/ai/story-director";
import { LITERAL, literalMisfits } from "@/components/video/clean/studio/ids";
import { estimateWords } from "@/lib/flow-script";
import { partCuts, storyParts } from "@/components/video/clean/studio/cuts";
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
import { BLOCKS } from "@/components/video/clean/studio/blocks";
import { BLOCK_IDS, BLOCK_TAGS, HANDS, LOOK_IDS as STUDIO_LOOK_IDS, LOOK_TAGS, ROLES } from "@/components/video/clean/studio/ids";
import { LOOKS } from "@/components/video/clean/studio/looks";
import { handoffs, type StudioRecipe, studioVariants, toRecipe, tooClose } from "@/lib/studio-variants";
import { ProductBrief } from "@/lib/ai/product-brief";
import http from "node:http";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, defaultConfig, effectiveConfig, normalizeConfig, parseVoiceChoices, textClient, textCost, usageCost } from "@/lib/ai/models";
import { ruleBrief } from "@/lib/rule-brief";
import { RECAP, stageOf, staged, stagingName } from "@/components/video/composer/staging";
import { ruleCreative, ruleProfile } from "@/lib/studio";
import { analyzeBrand } from "@/lib/ai/brand-analyst";
import { directCreative } from "@/lib/ai/creative-director";
import { judge, playOf } from "@/lib/ai/judge";
import { scorePlan } from "@/components/video/composer/score";
import { houseRules, varyLayouts } from "@/components/video/composer/rules";
import { highlightOf, SHOWN } from "@/components/video/composer/highlight";
import { COMPOSED, layoutFits } from "@/components/video/composer/layout";
import { retimeScript } from "@/lib/voice-timing";
import { directionFor, lockedVoiceScript, voiceChoiceOf, withVoiceChoice } from "@/lib/projects";
import { composeVariants, fitScript, scriptFromIdeas, type Ideas } from "@/components/video/composer/variants";
import { placeAll } from "@/components/video/composer/layout";
import { Script as ComposerScript } from "@/components/video/composer/types";
import { clauses } from "@/components/video/composer/auto";
import { generateComposerIdeas, ideaProblems, ideasOf, reviewNotes, reviseComposerPlan } from "@/lib/ai/composer-director";
import { livingStandIn } from "@/components/video/icons/living";
import { spelledNumbers } from "@/lib/render-validation";
import { pieceToWord, scriptWords } from "@/components/video/composer/words";

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

  section = "studio variation engine";
  add("the id list matches the drawn blocks and looks", JSON.stringify(ROLES.flatMap((r) => BLOCK_IDS[r])) === JSON.stringify(BLOCKS.map((b) => b.id)) && JSON.stringify([...STUDIO_LOOK_IDS]) === JSON.stringify(Object.keys(LOOKS)), `${BLOCKS.length} blocks, ${Object.keys(LOOKS).length} looks`);
  const allIds = new Set(ROLES.flatMap((r) => BLOCK_IDS[r]));
  add("every category tag names a real block or look", Object.keys(BLOCK_TAGS).every((id) => allIds.has(id)) && Object.keys(LOOK_TAGS).every((l) => (STUDIO_LOOK_IDS as readonly string[]).includes(l)), `${Object.keys(BLOCK_TAGS).length} blocks, ${Object.keys(LOOK_TAGS).length} looks tagged`);
  const ctx = { f: 0, from: 0, to: 100, role: "hook", look: LOOKS.glow, pal: LOOKS.glow.pal.dark, b: beatsFromPlan(shopnestPlan()), T: beatsFromPlan(shopnestPlan()).t, L: beatsFromPlan(shopnestPlan()).line, C: beatsFromPlan(shopnestPlan()).content } as Parameters<NonNullable<(typeof BLOCKS)[number]["obj"]>>[0];
  const handsOk = BLOCKS.every((b) => {
    const o = b.obj?.(ctx) ?? {};
    const want = (o.a ? "a" : "") + (o.z ? "z" : "");
    return (HANDS[b.id] ?? "") === want;
  });
  add("the hand-off list matches the blocks' objects", handsOk, `${Object.keys(HANDS).length} blocks hand off`);
  const valid = (v: StudioRecipe) => STUDIO_LOOK_IDS.includes(v.look) && ROLES.every((r) => BLOCK_IDS[r].includes(v.blocks[r]));
  const sets: StudioRecipe[][] = [];
  for (let g = 0; g < 6; g++) sets.push(studioVariants(4321, sets));
  const s1 = sets[0];
  add("a set: four different looks", new Set(s1.map((v) => v.look)).size === 4, s1.map((v) => v.look).join(", "));
  add("a set: every part a different block in each video", ROLES.every((r) => new Set(s1.map((v) => v.blocks[r])).size === 4), ROLES.map((r) => s1.map((v) => v.blocks[r].split(".")[1]).join("/")).slice(0, 3).join(" · "));
  add("every recipe names real blocks and looks", sets.flat().every(valid), `${sets.flat().length} recipes`);
  const closeCount = sets.reduce((n, set, g) => n + set.filter((v) => sets.slice(0, g).flat().some((p) => tooClose(v, p))).length, 0);
  add("six regenerations: no video close to an earlier one", closeCount === 0, `${closeCount} close of ${sets.flat().length}`);
  add("a regeneration is not a reshuffle of the last set", sets.slice(1).every((set, g) => set.every((v) => !sets[g].some((p) => p.look === v.look && ROLES.every((r) => p.blocks[r] === v.blocks[r])))), "no recipe repeats");
  add("a set hands off at several cuts", s1.every((v) => handoffs(v) >= 2), s1.map((v) => `${v.look} ${handoffs(v)}`).join(", "));
  add("the same seed and history → the same four", JSON.stringify(studioVariants(4321, [])) === JSON.stringify(s1), "deterministic");
  const legacy = toRecipe({ film: "dusk", tint: "brand", hue: 40 });
  add("an older film video maps to its look and blocks", valid(legacy) && legacy.look === "dusk" && legacy.hue === 40 && legacy.blocks.hook === "hook.typed", JSON.stringify(legacy.blocks).slice(0, 80));
  const parsed = ProductBrief.shape.clean.safeParse({ script: {}, source: "ai", variants: [{ film: "glow", tint: "native", hue: 0 }, s1[0]], history: [[{ film: "fly", tint: "brand", hue: 12 }], s1], at: "now" });
  add("stored briefs with old and new videos both parse", parsed.success && !!parsed.data && parsed.data.variants.length === 2 && parsed.data.history.length === 2, parsed.success ? "ok" : String(parsed.error).slice(0, 120));

  section = "story shapes";
  for (const [name, plan] of [["Shopnest", shopnestPlan()], ["Bookwell", bookwellPlan()]] as const) {
    // the seven parts in the fixed order play exactly as before
    const whole = beatsFromPlan(plan);
    const parts = storyParts(plan);
    const fixed = partCuts(whole.t);
    const same = parts.length === fixed.length && parts.every((p, i) => p.role === fixed[i].role && p.from === fixed[i].from) && parts.every((p) => JSON.stringify(p.b.t) === JSON.stringify(whole.t) && JSON.stringify(p.b.line) === JSON.stringify(whole.line));
    add(`${name}: the fixed seven-part story plays as before`, same, parts.map((p) => `${p.role}@${p.from}`).join(" "));
  }

  {
    const bw = bookwellPlan();
    const st = buildStory(storyOf(BOOKWELL), bw.words);
    add("the seven parts as a story build the same plan", !!st.plan && JSON.stringify(st.plan.scenes) === JSON.stringify(bw.scenes) && st.plan.duration === bw.duration, st.plan ? `${st.plan.scenes.length} scenes` : st.problems[0]);
    // another shape of the same narration: opens on a result, a feature told twice
    const other: Story = { brand: BOOKWELL.brand, content: BOOKWELL.content, parts: [
      { role: "growth", eyebrow: "", title: BOOKWELL.hook.text, key: "paper", grow: "Most", team: "clinics", zoom: "notes." },
      { role: "trio", ...BOOKWELL.trio }, { role: "reveal", ...BOOKWELL.reveal }, { role: "pay", ...BOOKWELL.pay }, { role: "pay", eyebrow: BOOKWELL.growth.eyebrow, title: BOOKWELL.growth.title, key: BOOKWELL.growth.key, pay: "busy", rev: "team", inst: "next." },
      { role: "nomore", ...BOOKWELL.nomore }, { role: "cta", ...BOOKWELL.cta },
    ] };
    const op = buildStory(other, bw.words);
    const parts = op.plan ? storyParts(op.plan) : [];
    const ordered = parts.every((p, i) => !i || p.from >= parts[i - 1].from + 16);
    add("a story opening on a result, a part told twice, plays in order", !!op.plan && parts[0].role === "growth" && parts.filter((p) => p.role === "pay").length === 2 && ordered && parts.at(-1)?.role === "end", parts.map((p) => `${p.role}@${p.from}`).join(" "));
    const bad = buildStory({ ...other, parts: [other.parts[1], other.parts[0]] }, bw.words);
    add("a story out of the narration's order is refused, never thrown", !bad.plan && bad.problems.length > 0, bad.problems[0] ?? "");
    // length fit and the sentence fallback, 15 s and 60 s
    const short = "Still chasing late payments? Paylo sends the invoice, reminds your client, and collects the money. Automatically. Get paid in days, not months.";
    const long = "Every week, your team spends hours in meetings. Then someone has to write it all down. Notes get lost, action items get forgotten, and nobody remembers who promised what. Notely fixes that. Here is how it works. First, connect your calendar in one click. Notely joins your calls on Zoom, Google Meet or Teams. Second, just talk. Notely listens and writes a clean summary while you focus on the conversation. Third, every decision and task is pulled out automatically, with an owner and a due date. After the call, the summary lands in Slack and your inbox within a minute. Search any meeting from last month in seconds. Your team stops taking notes and starts getting work done. Teams using Notely save four hours a week, per person. Notely. Every meeting, remembered.";
    for (const [name, text] of [["Paylo 15 s", short], ["Notely 60 s", long]] as const) {
      const words = estimateWords(text, text.split(/\s+/).length / 2.6 / 0.92);
      const [lo, hi] = partsFor(words[words.length - 1].end);
      const fb = fallbackStories(words, { name: name.split(" ")[0], color: "#000", tagline: "", cta: "", url: "", icon: null });
      const built = fb.map((x) => buildStory(x, words));
      add(`${name}: the fallback plays, ${lo}–${hi} parts, two shapes`, fb.length === 2 && built.every((b) => !!b.plan) && fb.every((x) => x.parts.length >= Math.min(lo, 3) && x.parts.length <= hi) && fb[0].shape !== fb[1].shape, fb.map((x) => `${x.parts.length}: ${x.shape}`).join(" | "));
    }
    // the Story Director: shapes kept only when they play and differ
    const P = (kind: string, f: Partial<Record<string, unknown>>) => ({ kind, text: "", key: "", big: "", items: [], name: "", sub: "", eyebrow: "", title: "", pay: "", rev: "", inst: "", grow: "", team: "", zoom: "", a: "", aKey: "", b: "", bKey: "", ...f });
    const B = BOOKWELL;
    const A1 = [P("hook", { text: B.hook.text, key: "paper", big: "notes." }), P("trio", { text: B.trio.text, items: B.trio.items }), P("reveal", { name: "Bookwell", sub: B.reveal.sub, key: "app." }), P("pay", { ...B.pay }), P("growth", { ...B.growth }), P("nomore", { ...B.nomore }), P("cta", { text: B.cta.tagline, key: B.cta.key })];
    const answer = { tagline: "Your clinic in one app", stories: [{ parts: A1 }, { parts: A1 }, { parts: [P("growth", { title: B.hook.text, key: "paper", grow: "Most", team: "clinics", zoom: "notes." }), ...A1.slice(1)] }], content: { ...DEFAULT_CONTENT } } as unknown as StoriesOut;
    const client = { responses: { parse: async () => ({ id: "s1", usage: { input_tokens: 1, output_tokens: 1 }, output_parsed: answer }) } } as never;
    const res = await generateStories({ brand: B.brand, words: bw.words }, undefined, client);
    add("Story Director: repeated shapes dropped, the rest kept", res.source === "ai" && res.stories.length === 2 && res.stories[0].story.shape !== res.stories[1].story.shape && res.problems.some((p) => p.includes("repeats")), res.stories.map((x) => x.story.shape?.split("-")[0]).join(", ") + ` · ${res.problems[0] ?? ""}`);
    // the four videos spread the shapes, the openings seen least first
    const shapes = ["hook-trio-reveal-cta", "growth-trio-reveal-cta", "trio-reveal-cta"];
    const fresh = studioVariants(11, [], 4, { shapes });
    const seen = studioVariants(11, [], 4, { shapes, recent: fresh.slice(0, 2) });
    add("the shapes spread over the set; seen openings go last", new Set(fresh.slice(0, 3).map((v) => v.shape)).size === 3 && seen[0].shape?.split("-")[0] === "trio", `${fresh.map((v) => v.shape?.split("-")[0]).join(",")} → after two seen: ${seen.map((v) => v.shape?.split("-")[0]).join(",")}`);
    const clinic = literalMisfits("Most clinics still run their day on phone calls. Bookwell puts your whole clinic in one simple app.");
    const shop = literalMisfits("Your shop's orders and stock in one place.");
    const set = studioVariants(5, [], 4, { exclude: clinic });
    add("literal pictures only when the script names them", Object.keys(LITERAL).every((id) => BLOCKS.some((b) => b.id === id)) && clinic.has("trio.storefront") && !shop.has("trio.storefront") && set.every((v) => !clinic.has(v.blocks.trio) && !clinic.has(v.blocks.pay) && !clinic.has(v.blocks.cta)), [...clinic].join(", "));
  }

  section = "AI models (/admin/models)";
  {
    // Nothing saved: the environment's models, every job on.
    const d = normalizeConfig(null);
    add("nothing saved keeps today's models", JSON.stringify(d) === JSON.stringify(defaultConfig()) && d.text.provider === "openai" && Object.values(d.tasks).every((t) => t.on) && d.voice.on && d.image.on, `${d.text.provider} ${d.text.model}`);
    add("the brief can't be turned off", normalizeConfig({ tasks: { brief: { on: false }, shot: { on: false } } }).tasks.brief.on && !normalizeConfig({ tasks: { shot: { on: false } } }).tasks.shot.on, "brief stays on");
    const cfg = normalizeConfig({ prices: { "google/gemini-2.5-flash": { in: 0.3, out: 2.5 } } });
    add("a model's own price is used for its cost", Math.abs(textCost(cfg, "google/gemini-2.5-flash", 1e6, 1e6, () => -1) - 2.8) < 1e-9 && textCost(cfg, "other", 1, 1, () => -1) === -1, "0.30 in + 2.50 out per 1M");
    {
      // fal reports each call's cost; a call without one (the OpenAI backup) is priced
      const u = { model: "google/gemini-2.5-flash", inputTokens: 0, outputTokens: 0 };
      countUsage(u, { input_tokens: 100, output_tokens: 50, cost: 0.001 });
      countUsage(u, { input_tokens: 1e6, output_tokens: 0 });
      countUsage(u, { input_tokens: 10, output_tokens: 5, cost: 0.002 });
      const total = usageCost(cfg, u, () => -100);
      const old = usageCost(cfg, { model: "x", inputTokens: 5, outputTokens: 5 }, () => 7);
      add("a video's AI cost: fal's reported cost plus the rest priced", Math.abs(total - (0.003 + 0.3)) < 1e-9 && u.inputTokens === 1e6 + 110 && old === 7, `$${total.toFixed(4)} · no report → env pricing`);
    }
    {
      // A voice without word times: the script's words on what Whisper heard
      const script = "Bookwell puts your whole clinic in one app.";
      const heard = [
        { text: "Book", start: 0.2, end: 0.4 }, { text: "well", start: 0.4, end: 0.7 }, { text: "puts", start: 0.8, end: 1.0 },
        { text: "your", start: 1.0, end: 1.2 }, { text: "whole", start: 1.2, end: 1.5 }, { text: "clinic", start: 1.6, end: 2.1 },
        { text: "in", start: 2.2, end: 2.3 }, { text: "one", start: 2.3, end: 2.5 }, { text: "app.", start: 2.6, end: 3.0 },
      ];
      const w = retimeScript(script, heard);
      const ok = !!w && w.length === 8 && w[0].text === "Bookwell" && Math.abs(w[0].start - 0.2) < 1e-9 && Math.abs(w[0].end - 0.7) < 0.05 && Math.abs(w[7].end - 3.0) < 1e-9 && w.every((x, i) => x.end >= x.start && (i === 0 || x.start >= w[i - 1].end - 1e-9));
      add("Whisper's times carry the script's own words", ok && retimeScript(script, []) === null, w ? w.map((x) => `${x.text}@${x.start.toFixed(2)}`).slice(0, 4).join(" ") : "none");
    }
    {
      // The customer's voice pick rides after the script; it never reaches the narration
      const d = withVoiceChoice(directionFor("Hello there. Book now.", "Auto"), "Kore");
      const picks = parseVoiceChoices("Kore, female, Warm and clear\nPuck, male\nKore, male, duplicate\n\n");
      add("a picked voice is stored after the script, not spoken", voiceChoiceOf(d) === "Kore" && lockedVoiceScript(d) === "Hello there. Book now." && voiceChoiceOf(directionFor("Hi.", "Auto")) === null && withVoiceChoice("no suffix", "Kore") === "no suffix", d.split("\n").slice(-1)[0]);
      add("the admin's voice list reads one voice per line", picks.length === 2 && picks[0].gender === "female" && picks[0].label === "Warm and clear" && picks[1].gender === "male", picks.map((p) => `${p.name}/${p.gender}`).join(", "));
    }
    // fal's OpenAI-compatible chat endpoint, here a local stand-in.
    const seen: { auth?: string; body: { messages: { role: string; content: unknown }[]; response_format?: { type: string } } }[] = [];
    let strict = true;
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (d) => (raw += d));
      req.on("end", () => {
        const body = JSON.parse(raw);
        seen.push({ auth: req.headers.authorization, body });
        if (!strict && body.response_format?.type === "json_schema") return res.writeHead(400, { "content-type": "application/json" }).end('{"error":{"message":"json_schema unsupported"}}');
        const content = body.response_format?.type === "json_object" ? '```json\n{"tagline":"Ship faster","words":["ship"]}\n```' : '{"tagline":"Plan less","words":["plan","less"]}';
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `c${seen.length}`, object: "chat.completion", created: 1, model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }], usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150, cost: 0.0004 } }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const saved = { url: process.env.FAL_LLM_BASE_URL, key: process.env.FAL_KEY };
    process.env.FAL_LLM_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    process.env.FAL_KEY = "check-key";
    try {
      const P = z.object({ tagline: z.string(), words: z.array(z.string()) });
      const fmt = { format: zodTextFormat(P, "probe") };
      const ai = textClient("fal", "google/gemini-2.5-flash", false);
      const r1 = await ai.client.responses.parse({ model: ai.model, instructions: "SYS", input: "hello", text: fmt });
      add("fal: structured answer parsed, tokens and cost counted", r1.output_parsed?.tagline === "Plan less" && (r1.usage as { cost?: number } | null)?.cost === 0.0004 && r1.usage?.input_tokens === 120 && r1.usage?.output_tokens === 30 && seen[0].auth === "Key check-key" && seen[0].body.response_format?.type === "json_schema", `${seen[0].auth} · ${seen[0].body.response_format?.type}`);
      await ai.client.responses.parse({ model: ai.model, instructions: "SYS", previous_response_id: r1.id, input: "fix it", text: fmt });
      const roles = seen[1].body.messages.map((m) => m.role).join(",");
      add("fal: a revision carries the conversation", roles === "system,user,assistant,user", roles);
      await ai.client.responses.parse({ model: ai.model, input: [{ role: "user", content: [{ type: "input_text", text: "see" }, { type: "input_image", image_url: "https://x/y.png", detail: "auto" }] }], text: fmt });
      add("fal: screenshots go as image parts", JSON.stringify(seen[2].body.messages[0].content).includes('"image_url":{"url":"https://x/y.png"}'), "image_url part");
      strict = false;
      const r4 = await ai.client.responses.parse({ model: ai.model, instructions: "SYS", input: "x", text: fmt });
      const routed = textClient("openai", "gpt-5-mini", true, {}, false);
      add("OpenAI direct off: an OpenAI job runs through fal, with no OpenAI backup", routed.provider === "fal" && routed.model === "openai/gpt-5-mini" && !normalizeConfig(null).text.openaiDirect && !normalizeConfig(null).text.backup, `${routed.provider} ${routed.model}`);
      add("fal: a model without strict schemas falls back to JSON mode", r4.output_parsed?.tagline === "Ship faster" && seen.at(-1)?.body.response_format?.type === "json_object", "json_object, fences stripped");
    } catch (e) {
      add("fal: text calls", false, e instanceof Error ? e.message : String(e));
    } finally {
      server.close();
      process.env.FAL_LLM_BASE_URL = saved.url;
      process.env.FAL_KEY = saved.key;
      if (saved.url === undefined) delete process.env.FAL_LLM_BASE_URL;
      if (saved.key === undefined) delete process.env.FAL_KEY;
    }
  }

  section = "composer";
  {
    const scripts = [
      { name: "Flowly", words: plans[0].words, brand: plans[0].brand },
      { name: "Bookwell", words: bookwellPlan().words, brand: bookwellPlan().brand },
    ];
    for (const sc of scripts) {
      const duration = Math.round((sc.words[sc.words.length - 1].end + 1.2) * FPS);
      const set = composeVariants({ words: sc.words, brand: sc.brand, duration, seed: 4242 });
      const narration = sc.words.map((w) => w.text).join(" ");
      add(`${sc.name}: four videos, every scene laid out cleanly`, set.plans.length === 4 && !set.problems.length, set.problems.slice(0, 3).join("; ") || `${set.plans.map((p) => p.scenes.length).join("/")} scenes`);
      const faces = new Set(set.plans.map((p) => p.art.display)), fields = new Set(set.plans.map((p) => p.art.field));
      add(`${sc.name}: no two videos share a face or a field`, faces.size === 4 && fields.size === 4, `${[...faces].join(", ")} · ${[...fields].join(", ")}`);
      const layouts = set.plans.map((p) => p.scenes.map((s) => `${s.layout}:${s.items.map((i) => i.kind).join("+")}`).join("|"));
      add(`${sc.name}: no two videos are built alike`, new Set(layouts).size === 4, `${new Set(layouts).size} different scene sequences`);
      const gaps = set.plans.flatMap((p) => p.scenes.slice(1).filter((s, k) => s.from !== p.scenes[k].to || s.to - s.from < 30));
      add(`${sc.name}: scenes follow on, none shorter than a second`, !gaps.length && set.plans.every((p) => p.scenes[0].from === 0 && p.scenes.at(-1)!.to === duration), `${gaps.length} gaps`);
      const late = set.plans.flatMap((p) => p.scenes.filter((s) => Math.min(s.text?.words[0]?.at ?? Infinity, ...s.items.filter((i) => !["badge", "shape", "cursor"].includes(i.kind)).map((i) => i.at)) > s.from + 3));
      add(`${sc.name}: something is on screen from each scene's first frames`, !late.length, `${late.length} late scenes`);
      const icons = set.plans.flatMap((p) => p.scenes.flatMap((s) => s.items.flatMap((i) => [i.icon, ...(i.rows ?? []).map((r) => r.icon)]))).filter((x): x is string => !!x);
      add(`${sc.name}: no people or animals`, icons.every((i) => !livingStandIn(i)), `${icons.length} icons`);
      const stats = set.plans.flatMap((p) => p.scenes.flatMap((s) => s.items.filter((i) => i.kind === "stat").map((i) => i.value ?? "")));
      const unsaid = stats.filter((v) => /\d/.test(v) && !narration.includes(v.match(/\d+/)![0]) && !/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(narration));
      add(`${sc.name}: a big number is one the voice says`, !unsaid.length, unsaid.join(", ") || `${stats.length} numbers`);
      add(`${sc.name}: every video ends on the brand's ask`, set.plans.every((p) => p.scenes.at(-1)!.items.some((i) => i.kind === "button")), "button in the last scene");
      add(`${sc.name}: what is stored passes the stored schema`, set.videos.every((v) => ComposerScript.safeParse(v.script).success), "4 scripts");
      const again = composeVariants({ words: sc.words, brand: sc.brand, duration, seed: 4242, avoid: { display: [...faces] } });
      add(`${sc.name}: the faces a customer has seen are not used again`, again.plans.every((p) => !faces.has(p.art.display)), again.plans.map((p) => p.art.display).join(", "));
    }
    const cs = clauses(plans[0].words);
    add("lists stay whole, long sentences split", cs.length >= 6 && cs.every((c) => c.to - c.from < 16), cs.map((c) => c.to - c.from + 1).join(","));
    // the Director's ideas (a model's answer, mended): out-of-range words and
    // unknown parts never break a video
    const words = plans[0].words;
    const ideas: Ideas = {
      arts: [{ name: "Night glass", hue: 250, harmony: "analogous", scheme: "dark", field: "aurora", overlay: "grain", surface: "glass", radius: 28, display: "no-such-font", text: "inter", weight: 800, case: "sentence", tracking: -0.04, key: "pill", motion: "snappy", pace: 1.1, camera: "push", icons: "tile", energy: 0.6 }],
      scenes: [
        { at: 0, text: { from: 0, to: 9, size: "l", key: ["scattered"] }, kicker: null, options: [{ layout: "split-left", arrange: null, items: [{ kind: "chips", at: 2, rows: [{ title: "Sales", icon: "trending-up" }, { title: "Payments", icon: "credit-card" }, { title: "Reports", icon: "user" }] }] }] },
        { at: 10, text: { from: 10, to: 400, size: "xl", key: [] }, kicker: "Flowly", options: [{ layout: "nonsense", items: [{ kind: "dragon", at: 10 }, { kind: "device", variant: "phone", screen: "kpi", at: 12, rows: [{ title: "Revenue", meta: "$48k", tag: "+12%" }] }] }] },
        { at: 30, text: { from: 30, to: 45, size: "m", key: [] }, kicker: null, options: [{ layout: "top", items: [] }] },
      ],
    };
    const script = scriptFromIdeas(ideas, 0, 7, words, plans[0].brand);
    const placed = placeAll(fitScript(script), words, plans[0].duration, plans[0].brand, 7, 0, "director");
    const chips = placed.plan.scenes[0].items.find((i) => i.kind === "chips");
    add("Director ideas: mended and laid out", placed.plan.scenes.length === 3 && placed.plan.art.display !== "no-such-font" && placed.plan.art.surface === "glass" && placed.plan.scenes[1].items.every((i) => i.kind !== ("dragon" as string)) && !!chips && chips.rows!.every((r) => !r.icon || !livingStandIn(r.icon) || r.icon === "id-card"), `${placed.plan.art.display}, ${placed.problems.length} problems`);
    add("Director ideas: the last scene ends on the brand's ask", placed.plan.scenes[2].items.some((i) => i.kind === "button"), placed.plan.scenes[2].items.map((i) => i.kind).join("+"));
    add("Director answer checked: order and start", ideaProblems({ arts: [], scenes: [{ at: 3, text: null, kicker: null, options: [] }, { at: 2, text: null, kicker: null, options: [] }] } as never, 50).length >= 4, "4 problems found");
    // a model call, with a stand-in client: the answer is mended into order
    const fake = { responses: { parse: async () => ({ id: "r1", usage: { input_tokens: 900, output_tokens: 1400 }, output_parsed: { arts: [ideas.arts[0], ideas.arts[0]], scenes: [{ ...ideas.scenes[1], at: 12 }, { ...ideas.scenes[0], at: 3 }] } }) } };
    let billed = 0;
    const res = await generateComposerIdeas({ words, brand: { name: "Flowly", color: "#6a5bff", cta: "Try Flowly", url: "flowly.app" } }, (u) => (billed = u.inputTokens + u.outputTokens), fake as never, 30_000);
    add("Composer Director: answer used, in order from word 0, tokens counted", !!res.ideas && res.ideas.scenes[0].at === 0 && res.ideas.scenes.length === 2 && billed === 4600, `${res.ideas?.scenes.map((x) => x.at).join(",")} · ${billed} tokens (two calls)`);
    const none = await generateComposerIdeas({ words, brand: { name: "Flowly", color: "#6a5bff", cta: "Try", url: "" } }, undefined, { responses: { parse: async () => { throw new Error("down"); } } } as never, 10_000);
    add("Composer Director: a failed call gives nothing (the Composer composes)", !none.ideas && none.problems.some((p) => p.includes("down")), none.problems[0] ?? "");
    // one video; the review sees our layout check and repetition
    const one = composeVariants({ words, brand: plans[0].brand, duration: plans[0].duration, seed: 9, count: 1 });
    add("Composer: one video per project", one.plans.length === 1 && one.videos.length === 1, `${one.plans[0].scenes.length} scenes`);
    const same = { ...ideas, scenes: [0, 10, 20, 30].map((at) => ({ at, text: { from: at, to: at + 5, size: "m", key: [] }, kicker: null, options: [{ layout: "top", arrange: null, items: [{ kind: "icon", at, icon: "bell" }] }] })) };
    const notes = reviewNotes(same, words, { name: "Flowly", color: "#6a5bff", cta: "Try", url: "" });
    add("review notes: repeated layouts and things are named", notes.some((n) => n.includes("top layout")) && notes.some((n) => n.includes("all show icon")), notes.slice(0, 2).join("; "));
    // "Change it": the stored plan goes to the model with the direction; a bad answer changes nothing
    const plan0 = ideasOf(one.videos[0].script);
    let sent = "";
    const reviser = { responses: { parse: async (req: { input: string }) => { sent = req.input; return { id: "r", usage: { input_tokens: 5000, output_tokens: 3000 }, output_parsed: { arts: [{ ...ideas.arts[0], scheme: "dark" }], scenes: plan0.scenes } }; } } };
    const changed = await reviseComposerPlan({ words, brand: { name: "Flowly", color: "#6a5bff", cta: "Try", url: "" }, plan: plan0, direction: "Make it darker. ".repeat(600) }, undefined, reviser as never);
    const kept = (sent.split("<<<")[1] ?? "").split(/\s+/).filter(Boolean).length;
    add("Change it: direction capped at 1000 words, plan revised", !!changed.ideas && (changed.ideas.arts[0] as { scheme?: string }).scheme === "dark" && kept <= 1001 && sent.includes("THE CURRENT PLAN"), `${kept} words sent`);
    const failed = await reviseComposerPlan({ words, brand: { name: "Flowly", color: "#6a5bff", cta: "Try", url: "" }, plan: plan0, direction: "blue" }, undefined, { responses: { parse: async () => ({ id: "r", usage: null, output_parsed: null }) } } as never);
    add("Change it: no answer → nothing changes", !failed.ideas, failed.problems[0] ?? "");
    // the Download button renders in the browser (web-renderer), which can't paint
    // CSS radial gradients or backdrop blur — the Composer draws those as SVG
    const dir = "components/video/composer";
    const css = readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && n !== "radial.tsx").flatMap((n) => (readFileSync(`${dir}/${n}`, "utf8").match(/radial-gradient\(|conic-gradient\(|backdropFilter/g) ?? []).map((m) => `${n}: ${m}`));
    add("download-safe drawing (no CSS radial gradients / backdrop blur)", css.length === 0, css.slice(0, 3).join(" · ") || "SVG gradients");
    add("engine switch defaults off", normalizeConfig(null).engine.composer === "off" && normalizeConfig({ engine: { composer: "admins" } }).engine.composer === "admins" && normalizeConfig({ engine: { composer: "x" } }).engine.composer === "off", "off · admins · bad → off");
  }

  section = "AI only for the voice";
  {
    const on = effectiveConfig(normalizeConfig({ engine: { voiceOnly: true, composer: "off" }, tasks: { composer: { on: true } }, image: { on: true }, voice: { on: false } }));
    const offJobs = Object.entries(on.tasks).filter(([, t]) => t.on).map(([k]) => k);
    add("every AI job but the voice is off (the brief too)", !offJobs.length && !on.image.on && on.voice.on, offJobs.join(", ") || `${Object.keys(on.tasks).length} text jobs off · images off · voice on`);
    add("the Composer composes every video, by rule", on.engine.composer === "all" && !on.tasks.composer.on, "engine: all · Composer Director off");
    add("off by default; the saved settings are kept", !normalizeConfig(null).engine.voiceOnly && effectiveConfig(normalizeConfig({ tasks: { composer: { on: true } } })).tasks.composer.on, "voiceOnly false → as saved");
    const script = "Most clinics still run their day on phone calls. Bookwell puts your whole clinic in one simple app! Try it free?";
    const b = ruleBrief({ script, productName: "Bookwell", cta: "Book a demo" });
    add("rule brief: the script word for word, a scene per sentence", b.script === script && b.scenes.length === 3 && b.scenes.map((x) => x.narration).join(" ") === script && b.product_name === "Bookwell" && !b.supported_claims.length, `${b.scenes.length} scenes · ${b.scenes.map((x) => x.duration_seconds).join("/")} s`);
    // staging: never fixed — across seeds, every family and many ways
    const bw = bookwellPlan();
    const dur = Math.round((bw.words[bw.words.length - 1].end + 1.2) * FPS);
    const base = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 11, count: 1 }).plans[0];
    const st = Array.from({ length: 60 }, (_, k) => stageOf({ ...base, journey: null, link: null, links: null }, 1000 + k * 7919));
    const fams = new Set(st.map((x) => x.family)), names = new Set(st.map(stagingName)), hops = new Set(st.flatMap((x) => x.links ?? []).filter(Boolean));
    add("staging: every family and many ways over 60 videos", fams.size === 6 && names.size >= 11 && hops.size >= 5, `${fams.size} families · ${names.size} stagings · ways in: ${[...hops].join(", ")}`);
    const fits = st.every((x) => !x.links || (x.links.length === base.scenes.length && x.links.every((l, i) => l !== "carry" || (base.scenes[i - 1].items.some((it) => !["badge", "shape", "cursor"].includes(it.kind))))));
    add("staging: a way per move, only where its two scenes allow it", fits, "carry only from a scene with a thing");
    const again = Array.from({ length: 40 }, (_, k) => stageOf(base, 5000 + k * 104729, [st[0], st[0], st[0]])).filter((x) => stagingName(x) === stagingName(st[0])).length;
    add("staging: what the customer had lately is rarer", again <= 6, `${again}/40 the same as the last three`);
    const bare = { ...base, recap: false };
    const recap = staged(bare, { family: "path", journey: "snake", link: "line", links: null, guide: null, recap: true });
    add("staged recap adds its seconds; cuts change nothing", recap.duration === bare.duration + RECAP && staged(bare, { family: "cuts", journey: null, link: null, links: null, guide: null, recap: true }) === bare, `+${recap.duration - bare.duration} frames`);
  }

  section = "studio directors (Brand Analyst → Creative Director → Composer → Judge)";
  {
    const bw = bookwellPlan();
    const script = bw.words.map((w) => w.text).join(" ");
    const dur = Math.round((bw.words[bw.words.length - 1].end + 1.2) * FPS);
    // the profile by rule
    const rp = ruleProfile({ name: "Bookwell", script });
    add("rule profile: kind of business and mood from the words", rp.category === "clinic & health" && rp.mood === "calm" && rp.source === "rule", `${rp.category} · ${rp.mood} · ${rp.look.scheme}/${rp.look.face}`);
    // the Brand Analyst: what the script does not say is dropped; a failed call → by rule
    const fakeProfile = { category: "clinic & health", personality: ["calm", "caring", "precise"], mood: "calm", audience: "clinic owners", promise: "Your whole clinic in one app", features: ["online booking"], before: ["phone calls"], keywords: ["clinic", "rocket"], numbers: ["99%"], look: { scheme: "light", face: "humanist", energy: 2 } };
    const asked: string[] = [];
    const ok = await analyzeBrand({ name: "Bookwell", color: "#4f46e5", script }, undefined, { responses: { parse: async (r: { input: string }) => (asked.push(r.input), { id: "a", usage: null, output_parsed: fakeProfile }) } } as never);
    add("Brand Analyst: profile kept, unsaid words and numbers dropped", ok.profile.source === "ai" && ok.profile.keywords.includes("clinic") && !ok.profile.keywords.includes("rocket") && !ok.profile.numbers.length && ok.profile.look.energy <= 0.85 && asked[0].includes("SCRIPT"), `${ok.profile.keywords.join(", ")} · energy ${ok.profile.look.energy}`);
    const down = await analyzeBrand({ name: "Bookwell", color: "#4f46e5", script }, undefined, { responses: { parse: async () => { throw new Error("down"); } } } as never);
    add("Brand Analyst: a failed call → the profile by rule", down.profile.source === "rule" && down.problems[0].includes("down"), down.problems[0]);
    // the Creative Director: one language; a hero out of range → by rule
    const fakePlan = { idea: "a calendar that fills itself", motif: { icon: "calendar-check", label: "Booked" }, hero: 9999, turn: 12, beats: [{ at: 0, beat: "hook" }], language: "depth", journey: "snake", guide: null, recap: true, scheme: "mixed" };
    const cp = await directCreative({ profile: rp, words: bw.words, brandName: "Bookwell", seed: 7, earlier: [{ idea: "old idea", language: "line" }] }, undefined, { responses: { parse: async (r: { input: string }) => (asked.push(r.input), { id: "c", usage: null, output_parsed: fakePlan }) } } as never);
    add("Creative Director: plan kept, bad hero mended, earlier ideas sent", cp.plan.source === "ai" && cp.plan.language === "depth" && cp.plan.journey === null && cp.plan.hero < bw.words.length && asked[1].includes("old idea") && asked[1].includes("EARLIER"), `${cp.plan.language} · hero word ${cp.plan.hero} · turn ${cp.plan.turn}`);
    const rc = ruleCreative(rp, bw.words, "Bookwell", 7, []);
    add("Creative Director by rule: turn on the brand's name, hero after it", rc.source === "rule" && bw.words[rc.turn].text.toLowerCase().includes("bookwell") && rc.hero >= rc.turn && rc.beats[0].beat === "hook" && rc.beats.at(-1)!.beat === "cta", `turn "${bw.words[rc.turn].text}" · hero word ${rc.hero} · ${rc.language} · idea "${rc.idea}"`);
    // one camera language per video, its signature at the hero
    const langs = new Set<string>();
    let single = true;
    for (const language of ["line", "depth", "flip", "timeline", "words"] as const) {
      const set = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 21, count: 2, creative: { ...rc, language } });
      for (const v of set.videos) {
        langs.add(v.staging?.language ?? "?");
        const hops = (v.staging?.links ?? []).slice(1);
        const others = hops.filter((_, i) => i + 1 !== v.staging?.hero);
        const plainOk = language === "words" ? others.every((l) => l === "word" || l === "line") : new Set(others).size <= 1;
        if (v.staging?.language !== language || !plainOk) single = false;
      }
    }
    add("one camera language per video; the hero's move its own", single && langs.size === 5, [...langs].join(", "));
    // the house rules kept by construction
    const sample = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 5, count: 1 }).videos[0].script;
    const crowded = { art: { ...sample.art, scheme: "mixed" as const, field: "beams" as const, overlay: "particles" as const }, scenes: sample.scenes.map((sc, i) => ({ ...sc, enter: (["fade", "blur", "whip", "iris", "drop", "clock"] as const)[i % 6], items: [...sc.items, ...sc.items, ...sc.items, ...sc.items].slice(0, 5) })) };
    const ruled = houseRules(crowded, 2);
    const kinds = new Set(ruled.scenes.slice(1).map((x) => x.enter));
    const flips = ruled.scenes.slice(1).filter((x, i) => x.dark !== ruled.scenes[i].dark).length;
    add("house rules: ≤3 things, ≤3 ways in, one dark → light turn, calm background", ruled.scenes.every((x) => x.items.filter((it) => !["badge", "shape", "cursor"].includes(it.kind)).length <= 3) && kinds.size <= 3 && flips === 1 && ruled.art.field !== "beams" && ruled.art.overlay !== "particles", `${kinds.size} ways in · ${flips} turn · ${ruled.art.field}/${ruled.art.overlay}`);
    // the Composer Director works inside the plan, with the house rules
    let sentInstr = "", sentReq = "";
    const comp = { responses: { parse: async (r: { instructions: string; input: string }) => ((sentInstr = r.instructions), (sentReq = r.input), { id: "x", usage: null, output_parsed: null }) } };
    await generateComposerIdeas({ words: bw.words, brand: bw.brand, profile: rp, creative: rc, never: "- never use red" }, undefined, comp as never, 10_000);
    add("Composer Director gets the profile, the plan and the rulebook", sentInstr.includes("HOUSE RULES") && sentInstr.includes("never use red") && sentReq.includes("CREATIVE PLAN") && sentReq.includes(rc.idea) && sentReq.includes("BRAND PROFILE"), "profile · plan · house rules · team's never list");
    // the Judge: scores, picks; a bad answer → the rule score
    const set = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 31, count: 2, creative: rc });
    const cands = set.videos.map((v, i) => ({ plan: set.plans[i], staging: v.staging, score: scorePlan(set.plans[i], v.script, { staging: v.staging, motif: rc.motif, heroScene: v.staging?.hero }) }));
    const picked = await judge({ candidates: cands, profile: rp, creative: rc }, undefined, { responses: { parse: async () => ({ id: "j", usage: null, output_parsed: { best: 1, scores: [{ candidate: 0, story: 7, clarity: 7, brand: 7, rules: 7, total: 7, note: "flat" }, { candidate: 1, story: 9, clarity: 8, brand: 9, rules: 9, total: 8.6, note: "strong" }] } }) } } as never);
    const bad = await judge({ candidates: cands }, undefined, { responses: { parse: async () => ({ id: "j", usage: null, output_parsed: { best: 9, scores: [] } }) } } as never);
    add("Judge: picks the best; a bad answer → the rule score", picked.best === 1 && picked.source === "ai" && bad.source === "rule" && cands.every((c) => c.score.total > 0 && c.score.total <= 10), `rule scores ${cands.map((c) => c.score.total).join(" / ")}`);
    const noCta = scorePlan({ ...set.plans[0], scenes: set.plans[0].scenes.map((sc, i, xs) => (i === xs.length - 1 ? { ...sc, items: sc.items.filter((it) => it.kind !== "button") } : sc)) }, set.videos[0].script);
    add("rule score: a video without its call to action loses 2", noCta.notes.some((n) => n.includes("call to action")), noCta.notes.slice(0, 2).join("; "));
    add("Judge's view of a candidate reads as it plays", playOf(set.plans[0], set.videos[0].staging).split("\n").length === set.plans[0].scenes.length + 1, playOf(set.plans[0], set.videos[0].staging).split("\n")[0]);
  }

  section = "composer highlights and compositions";
  {
    const bw = bookwellPlan();
    const dur = Math.round((bw.words[bw.words.length - 1].end + 1.2) * FPS);
    const w = (t: string) => t.split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25 }));
    const line = w("Every booking, reminder and payment now lands in one calm place for the whole team.");
    const [a, b] = highlightOf(line, 0, line.length - 1, new Set(["place"]));
    const hl = line.slice(a, b + 1).map((x) => x.text).join(" ");
    add("a long line shows its highlight (≤6 words, the key word, no little word at its ends)", b - a + 1 <= SHOWN && b - a + 1 >= 2 && hl.includes("place") && !/^(and|the|in|for|now)\b/i.test(hl), hl);
    const num = w("Clinics that switched saved four hours every single week on calls.");
    const [na, nb] = highlightOf(num, 0, num.length - 1, new Set());
    add("a spoken number is in the highlight", num.slice(na, nb + 1).some((x) => x.text === "four"), num.slice(na, nb + 1).map((x) => x.text).join(" "));
    // every scene of every video shows at most six words; compositions vary
    let most = 0, repeats = 0, over = 0, composed = 0, problems = 0;
    for (const seed of [3, 11, 19, 27, 35, 43]) {
      const set = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed, count: 2 });
      problems += set.problems.length;
      for (const [k, plan] of set.plans.entries()) {
        plan.scenes.forEach((sc) => (most = Math.max(most, sc.text?.words.length ?? 0)));
        const sc = set.videos[k].script.scenes;
        const withThings = sc.map((x, i) => ({ x, i })).filter(({ x, i }) => i < sc.length - 1 && x.items.some((it) => !["badge", "shape", "cursor"].includes(it.kind)));
        for (let i = 1; i < sc.length - 1; i++) if (withThings.some((t) => t.i === i) && sc[i].layout === sc[i - 1].layout) repeats++;
        const count = new Map<string, number>();
        withThings.forEach(({ x }) => count.set(x.layout, (count.get(x.layout) ?? 0) + 1));
        over += [...count.values()].filter((n) => n > 2).length;
        composed += plan.scenes.filter((x) => COMPOSED.has(x.layout)).length;
      }
    }
    add("on screen: never more than 6 words in a scene", most <= SHOWN, `most ${most}`);
    add("compositions: never twice in a row, none more than twice a video", repeats === 0 && over === 0, `${repeats} repeats · ${over} over-used`);
    add("words, cards and icons composed together in the videos", composed >= 6, `${composed} composed scenes in 12 videos · ${problems} layout problems`);
    // each composed layout lays out cleanly where it fits
    const base = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 7, count: 1 }).videos[0].script;
    const it = (kind: string, extra: Record<string, unknown> = {}) => ({ kind, at: 0, hit: null, id: null, enter: null, variant: null, title: null, sub: null, icon: "calendar", value: null, values: null, rows: [{ title: "Check-up", meta: "9:00", tag: null, icon: null }, { title: "Review", meta: "11:30", tag: null, icon: null }], screen: null, size: "m", tilt: null, ...extra }) as never;
    const cases: [string, unknown[]][] = [["inline", [it("icon"), it("card", { variant: "calendar" })]], ["label", [it("card", { variant: "list" }), it("badge", { title: "Booked" })]], ["caption", [it("device", { variant: "browser", screen: "calendar" })]], ["around", [it("icon"), it("stat", { value: "4 hours", title: "Saved" }), it("icon", { icon: "bell" })]], ["between", [it("card", { variant: "notify" }), it("icon", { icon: "bell-ring" })]]];
    const bad: string[] = [];
    for (const [layout, items] of cases) {
      const sc = { ...base.scenes[1], layout, arrange: null, text: { ...base.scenes[1].text!, size: "l" as const }, items } as never;
      const { plan, problems: pr } = placeAll({ art: base.art, scenes: [base.scenes[0], sc, ...base.scenes.slice(2)] }, bw.words, dur, bw.brand, 7);
      if (plan.scenes[1].layout !== layout || pr.some((x) => x.scene === 1)) bad.push(`${layout}${plan.scenes[1].layout !== layout ? `→${plan.scenes[1].layout}` : ""}: ${pr.filter((x) => x.scene === 1).map((x) => x.what).join(", ")}`);
    }
    add("inline, label, caption, around, between lay out cleanly", !bad.length, bad.join(" | ") || "all five");
    add("a composed layout is only used where it fits", !layoutFits("inline", [it("card")], true) && !layoutFits("between", [it("icon")], true) && layoutFits("around", [it("icon"), it("icon")], true), "inline needs an icon · between needs two things");
    const same = { ...base, scenes: base.scenes.map((x) => ({ ...x, layout: "split-left" as const, items: x.items.length ? x.items : [it("icon")] })) };
    const varied = varyLayouts(same, 5).scenes;
    add("the same layout everywhere is varied", varied.slice(0, -1).every((x, i) => i === 0 || x.layout !== varied[i - 1].layout), varied.map((x) => x.layout).join(" "));
  }

  section = "composer words";
  {
    // a voice that times pieces of words and the stops on their own
    const pieces = [["Your", 0, 0.14], ["s", 0.16, 0.24], ["upport", 0.24, 0.51], ["i", 0.56, 0.64], ["nbox", 0.64, 0.96], ["is", 1.04, 1.2], ["full", 1.28, 1.6], [".", 1.6, 1.8], ["No", 2, 2.1], ["more", 2.2, 2.4], ["ang", 2.5, 2.6], ["ry", 2.6, 2.7], ["users.", 2.8, 3.2]].map(([text, start, end]) => ({ text: String(text), start: Number(start), end: Number(end) }));
    const shown = scriptWords("Your support inbox is full. No more angry users.", pieces);
    add("pieces of words become the script's words", shown.map((w) => w.text).join(" ") === "Your support inbox is full. No more angry users." && shown[1].start >= 0.15 && shown[1].start <= 0.25, shown.map((w) => `${w.text}@${w.start.toFixed(2)}`).join(" "));
    const to = pieceToWord(pieces, shown);
    add("older videos on pieces move onto the words", to(0) === 0 && to(1) === 1 && to(3) === 2 && to(8) === 5 && to(11) === 7 && to(12) === 8, [0, 1, 3, 8, 11, 12].map(to).join(","));
  }

  section = "claims";
  {
    const said = spelledNumbers("Shops cut waste by thirty percent in three months. Try it free for fourteen days, twice as fast, two and a half hours, twenty-five teams.");
    add("a number the script spells out is a supported figure", ["30", "3", "14", "2", "2.5", "25"].every((n) => said.includes(n)) && !said.includes("40"), said.join(", "));
  }

  section = "covered elsewhere";
  add("asset-type-swap, support-placement", true, "checked by npm run check:assets and check:recipe");
  return checks;
}
