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
import { countUsage, defaultConfig, normalizeConfig, parseVoiceChoices, textClient, textCost, usageCost } from "@/lib/ai/models";
import { retimeScript } from "@/lib/voice-timing";
import { directionFor, lockedVoiceScript, voiceChoiceOf, withVoiceChoice } from "@/lib/projects";

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

  section = "covered elsewhere";
  add("asset-type-swap, support-placement", true, "checked by npm run check:assets and check:recipe");
  return checks;
}
