import { readdirSync, readFileSync } from "node:fs";
// Checks for the clean explainer's rulebook (components/video/clean/rules.ts)
// on the Flowly proof plans (four variants) and the four reference films'
// timings. Rules kept only by review are listed, not checked.
import { BOOKWELL, FLOWLY } from "@/components/video/composer/fixtures";
import { FPS, STILL_BACKGROUND } from "@/components/video/composer/types";
import http from "node:http";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, defaultConfig, normalizeConfig, parseVoiceChoices, textClient, textCost, usageCost } from "@/lib/ai/models";
import { ruleBrief } from "@/lib/rule-brief";
import { RECAP, stageOf, staged, stagingName } from "@/components/video/composer/staging";
import { ruleCreative, ruleProfile, sentencesOf } from "@/lib/studio";
import { scorePlan } from "@/components/video/composer/score";
import { houseRules, varyLayouts } from "@/components/video/composer/rules";
import { highlightOf, SHOWN } from "@/components/video/composer/highlight";
import { COMPOSED, MIN_SCENE, layoutFits, paced } from "@/components/video/composer/layout";
import { retimeScript } from "@/lib/voice-timing";
import { directionFor, lockedVoiceScript, voiceChoiceOf, withVoiceChoice } from "@/lib/projects";
import { composeVariants, fitScript, scriptFromIdeas, type Ideas } from "@/components/video/composer/variants";
import { placeAll } from "@/components/video/composer/layout";
import { Script as ComposerScript } from "@/components/video/composer/types";
import { clauses } from "@/components/video/composer/auto";
import { detailsFrom, parseDetails } from "@/lib/project-details";
import { MotionModel, answerOf, directMotion, ideaProblems, mendAnswer, reviewMotion, reviewNotes, rulePlan, scenesOf } from "@/lib/ai/motion-director";
import { livingStandIn } from "@/components/video/icons/living";
import { pieceToWord, scriptWords } from "@/components/video/composer/words";

type Check = { section: string; name: string; ok: boolean; detail: string };

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  let section = "";
  const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });
  section = "AI models (/admin/models)";
  {
    // Nothing saved: the environment's models, every job on.
    const d = normalizeConfig(null);
    add("nothing saved keeps today's models", JSON.stringify(d) === JSON.stringify(defaultConfig()) && d.text.provider === "openai" && Object.values(d.tasks).every((t) => t.on) && d.voice.on, `${d.text.provider} ${d.text.model}`);
    add("the brief can't be turned off", normalizeConfig({ tasks: { brief: { on: false }, composer: { on: false } } }).tasks.brief.on && !normalizeConfig({ tasks: { composer: { on: false } } }).tasks.composer.on, "brief stays on");
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
    const plans = [{ ...FLOWLY, duration: Math.round((FLOWLY.words[FLOWLY.words.length - 1].end + 1.2) * FPS) }];
    const scripts = [
      { name: "Flowly", words: plans[0].words, brand: plans[0].brand },
      { name: "Bookwell", words: BOOKWELL.words, brand: BOOKWELL.brand },
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
    // one video; the review sees our layout check and repetition
    const one = composeVariants({ words, brand: plans[0].brand, duration: plans[0].duration, seed: 9, count: 1 });
    add("Composer: one video per project", one.plans.length === 1 && one.videos.length === 1, `${one.plans[0].scenes.length} scenes`);
    const same = { ...ideas, scenes: [0, 10, 20, 30].map((at) => ({ at, text: { from: at, to: at + 5, size: "m", key: [] }, kicker: null, options: [{ layout: "top", arrange: null, items: [{ kind: "icon", at, icon: "bell" }] }] })) };
    const notes = reviewNotes(same, words, { name: "Flowly", color: "#6a5bff", cta: "Try", url: "" });
    add("review notes: repeated layouts and things are named", notes.some((n) => n.includes("top layout")) && notes.some((n) => n.includes("all show icon")), notes.slice(0, 2).join("; "));
    // the Download button renders in the browser (web-renderer), which can't paint
    // CSS radial gradients or backdrop blur — the Composer draws those as SVG
    const dir = "components/video/composer";
    const css = readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && n !== "radial.tsx").flatMap((n) => (readFileSync(`${dir}/${n}`, "utf8").match(/radial-gradient\(|conic-gradient\(|backdropFilter/g) ?? []).map((m) => `${n}: ${m}`));
    add("download-safe drawing (no CSS radial gradients / backdrop blur)", css.length === 0, css.slice(0, 3).join(" · ") || "SVG gradients");
  }

  section = "rule brief and staging";
  {
    add("the jobs are the two directors' (the script & brief, the Motion Director)", Object.keys(normalizeConfig(null).tasks).join(",") === "brief,composer" && normalizeConfig({ tasks: { composer: { on: false } } }).tasks.composer.on === false, Object.keys(normalizeConfig(null).tasks).join(", "));
    const script = "Most clinics still run their day on phone calls. Bookwell puts your whole clinic in one simple app! Try it free?";
    const b = ruleBrief({ script, productName: "Bookwell", cta: "Book a demo" });
    add("rule brief: the script word for word, nothing claimed", b.script === script && b.product_name === "Bookwell" && b.cta === "Book a demo" && !b.supported_claims.length && !b.supported_features.length, b.product_name);
    // staging: never fixed — across seeds, every family and many ways
    const bw = BOOKWELL;
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
    if (STILL_BACKGROUND) add("still background: every video staged as cuts (no camera travel)", recap === bare && !recap.journey && !recap.link, `journey ${recap.journey ?? "none"}`);
    else add("staged recap adds its seconds; cuts change nothing", recap.duration === bare.duration + RECAP && staged(bare, { family: "cuts", journey: null, link: null, links: null, guide: null, recap: true }) === bare, `+${recap.duration - bare.duration} frames`);
  }

  section = "Motion Director (one director for the whole video)";
  {
    const bw = BOOKWELL;
    const script = bw.words.map((w) => w.text).join(" ");
    const dur = Math.round((bw.words[bw.words.length - 1].end + 1.2) * FPS);
    const n = bw.words.length;
    // the profile and the plan by rule (no model, or a failed call)
    const rp = ruleProfile({ name: "Bookwell", script });
    add("rule profile: kind of business and mood from the words", rp.category === "clinic & health" && rp.mood === "calm" && rp.source === "rule", `${rp.category} · ${rp.mood} · ${rp.look.scheme}/${rp.look.face}`);
    const rc = ruleCreative(rp, bw.words, "Bookwell", 7, []);
    add("plan by rule: turn on the brand's name, hero after it", rc.source === "rule" && bw.words[rc.turn].text.toLowerCase().includes("bookwell") && rc.hero >= rc.turn && rc.beats[0].beat === "hook" && rc.beats.at(-1)!.beat === "cta", `turn "${bw.words[rc.turn].text}" · hero word ${rc.hero} · ${rc.language} · idea "${rc.idea}"`);
    // ONE answer: the brand, the concept, the staging, the art and the scenes
    const ruleVideo = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 5, count: 1 }).videos[0].script;
    const sceneIdeas = scenesOf(ruleVideo);
    const art = { ...(sceneIdeas.arts[0] as Record<string, unknown>) };
    delete art.scheme;
    const turnAt = rc.turn;
    const answer = (staging: Record<string, unknown>, scenes: unknown[] = sceneIdeas.scenes) => ({
      brand: { category: "clinic & health", personality: ["calm", "caring", "precise"], mood: "calm", audience: "clinic owners", promise: "Your whole clinic in one app", features: ["online booking"], before: ["phone calls"], keywords: ["clinic", "rocket"], numbers: ["99%"], look: { face: "humanist", energy: 2 } },
      concept: { idea: "a calendar that fills itself", motif: { icon: "calendar-check", label: "Booked" }, turn: turnAt, hero: 9999, beats: [{ at: 0, beat: "hook" }] },
      staging: { language: "carry", journey: null, guide: null, recap: true, scheme: "mixed", ...staging },
      arts: [art],
      scenes,
    });
    const sent: { instructions: string; input: string }[] = [];
    // (the Story Analyst is asked first: it gets its own breakdown back)
    const analysis = { audience: "clinic owners", pain: "missed calls", promise: "a full calendar", proof: "online booking", arc: "from phone calls to a calendar that fills itself", look: "calm and clinical", scenes: [{ from: 0, to: 8, beat: "hook", message: "the clinic's day", show: "a busy front desk", words: "Bookwell", why: "the pain first" }] };
    const client = (out: unknown) => ({ responses: { parse: async (r: { instructions: string; input: string; text?: { format?: { name?: string } } }) => (sent.push(r), { id: "m", usage: { input_tokens: 1000, output_tokens: 2000 }, output_parsed: r.text?.format?.name === "story_analysis" ? analysis : out }) } });
    const input = { name: "Bookwell", color: "#4f46e5", cta: "Book a demo", words: bw.words, earlier: [{ idea: "old idea", language: "line" as const }], never: "- never use red", seed: 7 };
    let billed = 0;
    const md = await directMotion(input, (u) => (billed = u.inputTokens + u.outputTokens), client(answer({})) as never);
    const pl = md.plan;
    add("Story Analyst first, then one Director call writes the brand, the concept, the staging, the art and every scene", sent.length === 2 && sent[0].instructions.includes("story analyst") && sent[1].input.includes("STORY ANALYST'S BREAKDOWN") && md.analysis?.pain === "missed calls" && billed === 6000 && pl.source === "ai" && !!pl.ideas && pl.ideas.scenes.length === sceneIdeas.scenes.length && pl.creative.idea === "a calendar that fills itself" && pl.creative.language === "carry", `analyst + 1 call · ${pl.ideas?.scenes.length} scenes · ${pl.creative.language}`);
    add("Motion Director: gets the rulebook, the team's never list and this brand's earlier videos", sent[1].instructions.includes("HOUSE RULES") && sent[1].instructions.includes("never use red") && sent[1].instructions.includes("STAGING") && sent[1].input.includes("old idea") && sent[1].input.includes("EARLIER"), "rules · never list · earlier ideas");
    add("Motion Director: unsaid words and numbers dropped, a bad hero mended", pl.profile.keywords.includes("clinic") && !pl.profile.keywords.includes("rocket") && !pl.profile.numbers.length && pl.profile.look.energy <= 0.85 && pl.creative.hero < n && pl.creative.journey === "right", `${pl.profile.keywords.join(", ")} · hero word ${pl.creative.hero}`);
    add("Motion Director: dark or light is decided once (the staging), everywhere the same", pl.creative.scheme === "mixed" && pl.profile.look.scheme === "mixed" && (pl.ideas!.arts[0] as { scheme?: string }).scheme === "mixed", "staging · brand look · art: mixed");
    const built = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 11, ideas: pl.ideas, count: 1, creative: pl.creative });
    const bsc = built.plans[0].scenes;
    add("its video is built as it decided, on one background (never turning dark ↔ light)", built.videos[0].source === "director" && built.videos[0].staging?.language === "carry" && bsc.every((x) => x.dark === bsc[0].dark), `${built.videos[0].staging?.language} · ${bsc.map((x) => (x.dark ? "D" : "L")).join("")}`);
    const down = await directMotion(input, undefined, { responses: { parse: async () => { throw new Error("down"); } } } as never);
    add("Motion Director: a failed call → the plan by rule (the Composer pictures the scenes)", down.plan.source === "rule" && !down.plan.ideas && down.problems[0].includes("down"), down.problems[0]);
    // its review on the voice's times: kept when not worse; the brand stays
    sent.length = 0;
    const better = await reviewMotion(pl, input, undefined, client({ ...answer({ language: "line", journey: "snake" }), brand: { ...answer({}).brand, mood: "energetic" } }) as never);
    add("review: sees our checks, its improved plan is kept, the brand stays", sent.length >= 1 && sent.length <= 2 && sent[0].input.includes("YOUR PLAN") && sent[0].input.includes("Problems found") && better.plan.creative.language === "line" && better.plan.creative.journey === "snake" && better.plan.profile.mood === pl.profile.mood, `${better.plan.creative.language}/${better.plan.creative.journey} · mood ${better.plan.profile.mood}`);
    const empty = await reviewMotion(pl, input, undefined, client(answer({}, [])) as never);
    add("review: an answer without scenes changes nothing", empty.plan === pl && empty.problems[0].includes("no scenes"), empty.problems[0]);
    // the customer's answers (the form) are facts: they win over what was read from the script
    const customer = { audience: "small clinic owners", features: ["Online booking", "SMS reminders", "Live schedule"], before: ["Paper", "Phone calls"], mood: "premium" as const, use: "ad" as const };
    sent.length = 0;
    const told = await directMotion({ ...input, category: "clinic & health", customer }, undefined, client(answer({})) as never);
    const byRule = rulePlan({ ...input, category: "clinic & health", customer });
    add("the customer's answers reach the director and win over its reading", sent[0].input.includes("THE CUSTOMER'S ANSWERS") && sent[0].input.includes("SMS reminders") && sent[0].input.includes("an ad") && told.plan.profile.mood === "premium" && told.plan.profile.features[1] === "SMS reminders" && told.plan.profile.before.includes("Paper") && byRule.profile.mood === "premium" && byRule.profile.audience === "small clinic owners", `${told.plan.profile.mood} · ${told.plan.profile.features.join(", ")}`);
    const form = (pairs: [string, string][]) => {
      const f = new FormData();
      pairs.forEach(([k, v]) => f.append(k, v));
      return f;
    };
    const full = detailsFrom(form([["category", "online shop"], ["use", "social"], ["mood", "energetic"], ["feature", "Orders"], ["feature", "Stock"], ["feature", "Couriers"], ["before", "Spreadsheets"]]));
    const missing = detailsFrom(form([["category", "online shop"], ["use", "social"], ["mood", "energetic"], ["feature", "Orders"], ["feature", "Stock"], ["before", "Spreadsheets"]]));
    add("form: every answer is required", !!full.details && full.details.features.length === 3 && !missing.details && !!missing.error && parseDetails(full.details)?.use === "social" && parseDetails({ category: "nope" }) === null, missing.error ?? "");
    const back = answerOf(pl, ruleVideo);
    add("a stored video goes back to the director in its own format", (back.staging as { scheme: string }).scheme === "mixed" && !("scheme" in (back.arts as Record<string, unknown>[])[0]) && (back.scenes as unknown[]).length === ruleVideo.scenes.length, "brand · concept · staging · art · scenes");
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
    const crowded = { art: { ...ruleVideo.art, scheme: "mixed" as const, field: "beams" as const, overlay: "particles" as const }, scenes: ruleVideo.scenes.map((sc, i) => ({ ...sc, enter: (["fade", "blur", "whip", "iris", "drop", "clock"] as const)[i % 6], items: [...sc.items, ...sc.items, ...sc.items, ...sc.items].slice(0, 5) })) };
    const ruled = houseRules(crowded, 2);
    const kinds = new Set(ruled.scenes.slice(1).map((x) => x.enter));
    const flips = ruled.scenes.slice(1).filter((x, i) => x.dark !== ruled.scenes[i].dark).length;
    add("house rules: ≤3 things, ≤3 ways in, one dark → light turn, calm background", ruled.scenes.every((x) => x.items.filter((it) => !["badge", "shape", "cursor"].includes(it.kind)).length <= 3) && kinds.size <= 3 && flips === 1 && ruled.art.field !== "beams" && ruled.art.overlay !== "particles", `${kinds.size} ways in · ${flips} turn · ${ruled.art.field}/${ruled.art.overlay}`);
    // the code's score (shown in the studio)
    const set = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 31, count: 1, creative: rc });
    const sc0 = scorePlan(set.plans[0], set.videos[0].script, { staging: set.videos[0].staging, motif: rc.motif, heroScene: set.videos[0].staging?.hero });
    const noCta = scorePlan({ ...set.plans[0], scenes: set.plans[0].scenes.map((sc, i, xs) => (i === xs.length - 1 ? { ...sc, items: sc.items.filter((it) => it.kind !== "button") } : sc)) }, set.videos[0].script);
    add("rule score: 0–10; a video without its call to action loses 2", sc0.total > 0 && sc0.total <= 10 && noCta.notes.some((x) => x.includes("call to action")), `${sc0.total} · ${noCta.notes.slice(0, 1).join("; ")}`);
  }

  section = "composer highlights and compositions";
  {
    const bw = BOOKWELL;
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

  section = "seen, whole and mended (pacing, words, Bengali, the Director's answer)";
  {
    const bw = BOOKWELL;
    const dur = Math.round((bw.words[bw.words.length - 1].end + 1.2) * FPS);
    const frameOf = (i: number) => Math.round((bw.words[Math.max(0, Math.min(bw.words.length - 1, i))]?.start ?? 0) * FPS);
    // a scene on every word: paced into scenes long enough to be seen
    const tiny = bw.words.map((_, i) => ({ at: i, text: { from: i, to: i, size: "m" as const, key: [], reveal: "word" as const }, layout: "center" as const, items: i === bw.words.length - 1 ? [{ kind: "button" as const, at: i, title: "Book" }] : [] }));
    const p = paced(tiny as never, frameOf, dur);
    const lens = p.map((x, i) => (i < p.length - 1 ? frameOf(p[i + 1].at) : dur) - frameOf(x.at));
    add("every scene held long enough to be seen (short ones joined; the ask kept)", lens.every((l) => l >= MIN_SCENE) && p.at(-1)!.items.some((it) => it.kind === "button") && p[0].at === 0, `${tiny.length} → ${p.length} scenes · shortest ${(Math.min(...lens) / FPS).toFixed(1)} s`);
    let built = 0, short = 0;
    for (const seed of [2, 9, 23]) {
      const plan = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed, count: 1 }).plans[0];
      plan.scenes.slice(0, -1).forEach((sc) => (built++, sc.to - sc.from < MIN_SCENE - 8 && short++));
      if (plan.scenes.some((sc) => sc.dark !== plan.scenes[0].dark)) short += 100;
    }
    add("built videos: no scene too short, one background each", short === 0, `${built} scenes · ${short} too short`);
    // the Bengali দাঁড়ি ends a sentence
    const bn = "আপনার স্টোরে প্রতিদিন একই কাজ। চলুন দেখি কীভাবে সব অটোমেটিক হয়। ফ্রিতে শুরু করুন।".split(" ").map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.4 }));
    add("the Bengali দাঁড়ি (।) ends a sentence", sentencesOf(bn).length === 3, `${sentencesOf(bn).length} sentences`);
    // a whole short sentence is shown as it is; a long one never cut mid-phrase
    const ws = "Install in two minutes and get your evenings back.".split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25 }));
    const [a, b] = highlightOf(ws, 0, ws.length - 1, new Set());
    add("a short sentence is shown whole (never \"… and get\")", a === 0 && b === ws.length - 1, ws.slice(a, b + 1).map((w) => w.text).join(" "));
    // the Director's slips are mended, never the whole plan lost
    const raw = JSON.parse(JSON.stringify(answerOf(rulePlan({ name: "Bookwell", words: bw.words, seed: 3 }), composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 3, count: 1 }).videos[0].script)));
    raw.staging.language = "whip";
    raw.staging.scheme = "mixed";
    raw.scenes[1].options[0].items.push({ kind: "hologram", at: 3 }, { kind: "icon", at: 3, size: "xl", icon: "star" });
    raw.scenes[0].text.size = "huge";
    const mended = MotionModel.safeParse(mendAnswer(raw));
    const items1 = mended.success ? mended.data.scenes[1].options[0].items : [];
    add("a slip in the Director's answer is mended (size, kind, whip, mixed)", mended.success && !items1.some((it) => (it.kind as string) === "hologram") && items1.some((it) => it.kind === "icon" && it.size === "l") && mended.data.staging.language === "line" && mended.data.staging.scheme === "dark" && mended.data.scenes[0].text?.size === "m", mended.success ? "parsed" : mended.error.issues[0]?.message ?? "failed");
  }

  section = "composer frames (16:9, 9:16, 1:1)";
  {
    const bw = BOOKWELL;
    const dur = Math.round((bw.words[bw.words.length - 1].end + 1.2) * FPS);
    for (const [name, size] of [["9:16", [1080, 1920]], ["1:1", [1080, 1080]]] as const) {
      let problems = 0, outside = 0, scenes = 0;
      for (const seed of [3, 17, 29]) {
        const set = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed, count: 2, size: [size[0], size[1]] });
        problems += set.problems.length;
        for (const plan of set.plans) {
          if (plan.w !== size[0] || plan.h !== size[1]) outside += 100;
          for (const sc of plan.scenes) {
            scenes++;
            const boxes = [...sc.items.filter((it) => !["shape", "cursor"].includes(it.kind)).map((it) => it.box), ...(sc.text ? [sc.text.box] : [])];
            if (boxes.some((b) => b.x - b.w / 2 < -2 || b.x + b.w / 2 > size[0] + 2 || b.y - b.h / 2 < -2 || b.y + b.h / 2 > size[1] + 2)) outside++;
          }
        }
      }
      add(`${name}: every scene inside its frame, laid out cleanly`, outside === 0 && problems <= 2, `${scenes} scenes · ${outside} outside · ${problems} layout problems`);
    }
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

  section = "covered elsewhere";
  add("asset-type-swap, support-placement", true, "checked by npm run check:assets and check:recipe");
  return checks;
}
