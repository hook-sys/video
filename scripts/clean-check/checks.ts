import { readdirSync, readFileSync } from "node:fs";
// Checks for the clean explainer's rulebook (components/video/clean/rules.ts)
// on the Flowly proof plans (four variants) and the four reference films'
// timings. Rules kept only by review are listed, not checked.
import { BOOKWELL, FLOWLY } from "@/components/video/composer/fixtures";
import { FPS, STILL_BACKGROUND } from "@/components/video/composer/types";
import http from "node:http";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, defaultConfig, normalizeConfig, parseVoiceChoices, textAi, textClient, textCost, usageCost } from "@/lib/ai/models";
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
import { MotionModel, iconFor, answerOf, directMotion, ideaProblems, mendAnswer, reviewMotion, reviewNotes, rulePlan, scenesOf } from "@/lib/ai/motion-director";
import { livingStandIn } from "@/components/video/icons/living";
import { pieceToWord, scriptWords } from "@/components/video/composer/words";
import { sfxOf } from "@/components/video/composer/sfx";
import { tidied } from "@/components/video/composer/tidy";
import { inspect, inspected } from "@/components/video/composer/inspect";
import { type ProbeSample, checkFrames, framesToCheck } from "@/components/video/composer/frame-check";
import type { ComposerPlan } from "@/components/video/composer/types";
import { creditsFor, normalizeBilling, pickable, withCoupon } from "@/lib/billing-config";
import { resolveIcon } from "@/components/video/icons";
import { SETTINGS } from "@/lib/app-settings";
import { engineOf } from "@/lib/new-version";
import { ownedPath } from "@/lib/projects";
import { v2DetailsOf } from "@/lib/v2/form";
import { v2DirectorModel, v2Role, v2VoiceName } from "@/lib/v2/models";
import { V2_DIRECTOR, V2_RULES, V2_RULES_MASTER, V2_SHOWN, v2DirectorOf, v2RuleKey, v2RulesOf } from "@/lib/v2/rules";
import { drawLook, hueColour, lookOf, lookText, varietyOf } from "@/lib/v2/variety";
import { ENERGY, flowMoves } from "@/components/video/composer/flow";
import { morphPath } from "@/components/video/composer/morph";
import { PIECES, pieceOf, withPieces } from "@/components/video/composer/pieces";
import { cameraOf, moverOf } from "@/components/video/composer/motion";
import { v2NeverList } from "@/lib/v2/never";
import { VIDEO_RULES, neverList } from "@/lib/video-rules";
import { temperatureFor } from "@/lib/ai/models";
import { groundIsDark } from "@/components/video/composer/style";
import { RECIPES } from "@/components/video/composer/recipes";
import { copywrite } from "@/lib/v2/copywriter";
import { withVariety } from "@/components/video/composer/variants";
import { setFrame } from "@/components/video/composer/frame";
import { cam2d, containCam, mapPoint } from "@/components/video/composer/fake2d";
import { withHeroes } from "@/components/video/composer/heroes/pick";
import { countSpoken, cutWords, logoReachNote, numberSlot, resolveHero, textSlot } from "@/components/video/composer/heroes/slots";

type Check = { section: string; name: string; ok: boolean; detail: string };

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  let section = "";
  const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });
  section = "AI models (/admin/models)";
  {
    // Nothing saved: no text model (only a super admin chooses one), every job on.
    const d = normalizeConfig(null);
    add("nothing saved: no text model, every job on", JSON.stringify(d) === JSON.stringify(defaultConfig()) && d.text.model === "" && Object.values(d.tasks).every((t) => t.on) && d.voice.on, `${d.text.provider} "${d.text.model}"`);
    const why = await textAi("brief").then(() => "no error", (e: unknown) => (e instanceof Error ? e.message : String(e)));
    add("no model chosen: a text job stops with a clear error", /No AI model is set for "Script & brief"\. A super admin must choose one on \/admin\/models\./.test(why), why);
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
    const client = (out: unknown) => ({ responses: { parse: async (r: { instructions: string; input: string }) => (sent.push(r), { id: "m", usage: { input_tokens: 1000, output_tokens: 2000 }, output_parsed: out }) } });
    const input = { name: "Bookwell", color: "#4f46e5", cta: "Book a demo", words: bw.words, earlier: [{ idea: "old idea", language: "line" as const }], never: "- never use red", seed: 7 };
    let billed = 0;
    const md = await directMotion(input, (u) => (billed = u.inputTokens + u.outputTokens), client(answer({})) as never);
    const pl = md.plan;
    add("Motion Director: one call writes the brand, the concept, the staging, the art and every scene", sent.length === 1 && billed === 3000 && pl.source === "ai" && !!pl.ideas && pl.ideas.scenes.length === sceneIdeas.scenes.length && pl.creative.idea === "a calendar that fills itself" && pl.creative.language === "carry", `1 call · ${pl.ideas?.scenes.length} scenes · ${pl.creative.language}`);
    add("Motion Director: gets the rulebook, the team's never list and this brand's earlier videos", sent[0].instructions.includes("HOUSE RULES") && sent[0].instructions.includes("never use red") && sent[0].instructions.includes("STAGING") && sent[0].input.includes("old idea") && sent[0].input.includes("EARLIER"), "rules · never list · earlier ideas");
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
    // (no features asked any more; the other answers are all required)
    const full = detailsFrom(form([["category", "online shop"], ["use", "social"], ["mood", "energetic"], ["before", "Spreadsheets"]]));
    const missing = detailsFrom(form([["category", "online shop"], ["use", "social"], ["mood", "energetic"]]));
    add("form: every answer is required (no features asked)", !!full.details && full.details.features.length === 0 && !missing.details && !!missing.error && parseDetails(full.details)?.use === "social" && parseDetails({ category: "nope" }) === null, missing.error ?? "");
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
    const hook = ws.slice(a, b + 1).map((w) => w.text);
    add("only the hook on screen (a few words, never the sentence)", hook.length <= SHOWN && hook.length >= 2 && !/^(and|get|the|in|a)$/i.test(hook.at(-1)!), hook.join(" "));
    // a sound on each moment, never two at once; none when turned off
    const film = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 4, count: 1 }).plans[0];
    const fx = sfxOf(film);
    add("sound effects: on each moment, never two at once, a chime at the end, none when off", fx.length >= film.scenes.length && fx.every((e, i) => !i || e.at - fx[i - 1].at >= 9) && fx.at(-1)!.name === "success_chime" && sfxOf({ ...film, sfx: false }).length === 0, `${fx.length} sounds · ${[...new Set(fx.map((e) => e.name))].join(", ")}`);
    // the Frame Inspector: wrongs put in on purpose are found and mended
    const base2 = composeVariants({ words: bw.words, brand: bw.brand, duration: dur, seed: 6, count: 1 }).plans[0];
    const broken = { ...base2, journey: null, scenes: base2.scenes.map((sc) => ({ ...sc, items: sc.items.map((it) => ({ ...it })) })) };
    const s1 = broken.scenes[1];
    const main = s1.items.find((it) => !["badge", "shape", "cursor"].includes(it.kind))!;
    main.at = s1.to - 10;
    if (s1.text) {
      main.from = { x: s1.text.box.x - 600, y: s1.text.box.y, w: 100, h: 100 };
      main.box = { ...main.box, x: s1.text.box.x + 600, y: s1.text.box.y };
    }
    const off = broken.scenes[2].items[0];
    if (off) off.box = { ...off.box, x: -400 };
    const qa = inspected(broken);
    const leftWhat = qa.left.map((f) => f.what).join(" | ");
    add("Frame Inspector: finds what a viewer would see wrong and mends it", inspect(broken).length >= 3 && qa.fixed.length >= 2 && !/on screen only|flies across|off the frame/.test(leftWhat), `${inspect(broken).length} found · ${qa.fixed.length} mended · left: ${qa.left.length}`);
    // the frame check: what the probe saw on each frame, read for what a viewer would see wrong
    const fcPlan = { w: 1920, h: 1080, duration: 300, scenes: [{ from: 0, to: 150, layout: "split-left", arrange: "column" }, { from: 150, to: 300, layout: "center", arrange: "single" }] } as unknown as ComposerPlan;
    const sample = (f: number, wrong: boolean): ProbeSample => {
      const sc = f < 150 ? 0 : 1;
      const w: ProbeSample["w"] = [[`${sc}:w0`, 200, 400, 500, 120, 1]];
      const t: ProbeSample["t"] = [[`${sc}:card:A:1300:540`, 1100, 300, 500, 400, 1, "card", "A", 0]];
      if (wrong && f >= 30 && f < 48) t.push(["0:icon:Fly:900:460", 300, 380, 200, 200, 1, "icon", "Fly", 1]);
      if (wrong && f >= 60 && f < 70) t.push(["0:stat:Late:1500:900", 1400, 850, 200, 150, 1, "stat", "Late", 0]);
      if (wrong && sc === 1) t.push(["1:device:Cut:1900:500", 1700, 300, 500, 400, 1, "device", "Cut", 0]);
      return wrong && f >= 90 && f < 135 ? { f, w: [], t: [] } : { f, w, t };
    };
    const fcFrames = framesToCheck(300);
    const fcClean = checkFrames(fcPlan, fcFrames.map((f) => sample(f, false)));
    const fcWrong = checkFrames(fcPlan, fcFrames.map((f) => sample(f, true)));
    const fcWhat = fcWrong.findings.map((x) => x.what).join(" | ");
    add("frame check: a clean video passes; covered words, a cut-off thing, an empty screen, a thing gone too soon are found", fcClean.ok && /flies over the words/.test(fcWhat) && /cut off by the edge/.test(fcWhat) && /screen is empty/.test(fcWhat) && /"Late" is on screen only/.test(fcWhat), fcClean.ok ? `${fcWrong.findings.length} found: ${fcWhat.slice(0, 160)}` : fcClean.findings.map((x) => x.what).join(" | "));
    // credits: per second at each level's rate, a shortest charge; coupons on a pack; pricing mended
    const bill = normalizeBilling(null);
    const fair = creditsFor(bill, "standard", 30) === 90 && creditsFor(bill, "pro", 30) === 120 && creditsFor(bill, "standard", 4) === 45 && creditsFor(bill, "standard", 30.2) === 93;
    const pack = bill.packs[0];
    const deals = [withCoupon(pack, { kind: "discount", value: 10 }), withCoupon(pack, { kind: "bonus", value: 100 }), withCoupon(pack, { kind: "discount", value: 100 })];
    const mendedBill = normalizeBilling({ tiers: { standard: { status: "off", perSecond: -3 }, ultra: { status: "nope" } }, packs: [{ usd: 0, credits: 5 }], signupCredits: "x" });
    add("credits: per second by level, Pro for paying customers only, coupons (% off, % more, free), pricing mended", fair && deals[0].usd === 9 && deals[1].bonus === pack.credits && deals[2].usd === 0 && mendedBill.tiers.standard.status === "on" && mendedBill.tiers.standard.perSecond === 0 && mendedBill.tiers.ultra.status === "soon" && mendedBill.packs.length === 4 && mendedBill.signupCredits === 50 && pickable(bill, "ultra") === null && pickable(bill, "pro") === "pro" && pickable(bill, "pro", false) === null && pickable(bill, "standard", false) === "standard", `30 s: ${creditsFor(bill, "standard", 30)} / ${creditsFor(bill, "pro", 30)} · $${deals[0].usd} · +${deals[1].bonus}`);
    // an icon name the library lacks becomes the nearest real one
    const icons = [iconFor("notebook-pen-paper-xyz", "Paper diary"), iconFor(null, "Ringing phone"), iconFor("calendar", "x")];
    add("icons: a name the library lacks becomes a real icon", icons.every((x) => !!x && !!resolveIcon(x)) && icons[2] === "calendar", icons.join(" · "));
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

  section = "New version (admin → Settings)";
  {
    const nv = SETTINGS.find((x) => x.key === "feature_new_version");
    add("the switch is off unless a super admin turns it on", !!nv && nv.fallback === false && nv.superAdmin === true && nv.type === "bool", nv ? `fallback ${nv.fallback} · super admin only ${nv.superAdmin}` : "missing");
    const old = SETTINGS.filter((x) => x.oldOnly).map((x) => x.key);
    const shouldHide = ["feature_creative_director", "feature_video_rules", "feature_story_shapes", "feature_director_motion", "feature_visual_match", "form_ending", "form_screenshots", "form_direction"];
    add("new version on: the old version's settings are hidden (the switch, looks and techniques stay)", shouldHide.every((k) => old.includes(k)) && !old.includes("feature_new_version") && !old.some((k) => k.startsWith("tech_") || k.startsWith("look_")), `${old.length} hidden: ${old.join(", ")}`);
    const engines = [engineOf({ engine: "v2" }), engineOf({ engine: "v2", voice: {} }), engineOf(null), engineOf({}), engineOf({ engine: "v1" }), engineOf("v2"), engineOf({ category: "finance" })];
    add("each video keeps its version (only engine v2 is v2)", engines.join(",") === "v2,v2,v1,v1,v1,v1,v1", engines.join(","));
    const d = v2DetailsOf({ engine: "v2", voice: { source: "upload", name: null, path: "u/p/voice/upload.mp3" } });
    add("a v2 video's details read back", d?.voice.source === "upload" && d.voice.path === "u/p/voice/upload.mp3" && v2DetailsOf({ category: "finance" }) === null && v2DetailsOf({ engine: "v2" })?.voice.source === "script", JSON.stringify(d));
    const cfg = normalizeConfig({ v2: { text: " google/gemini-2.5-flash ", whisper: "fal-ai/whisper", roles: { review: { model: "openai/gpt-5", reasoning: "high" }, copywriter: { model: "x/y", reasoning: "loud" }, reviewer: { model: "v/v", on: true } } } });
    const d0 = defaultConfig().v2;
    add("its roles' models are only what the admin saved (none by default; the vision reviewer stays off)", Object.values(d0.roles).every((r) => r.model === "" && r.reasoning === "default") && d0.whisper === "" && !d0.roles.reviewer.on && cfg.v2.roles.director.model === "google/gemini-2.5-flash" && cfg.v2.roles.review.reasoning === "high" && cfg.v2.roles.copywriter.reasoning === "default" && !cfg.v2.roles.reviewer.on && cfg.v2.whisper === "fal-ai/whisper", JSON.stringify(cfg.v2.roles));
    const missing = await v2Role("director", {}, normalizeConfig({ text: { model: "google/gemini-2.5-flash" } })).then(() => "no error", (e: Error) => e.message);
    add("no Director model set: a clear error, no fallback (not even the old main model)", /No Director model is set for the new version/.test(missing), missing);
    const empty = ["", "  ", null, undefined].map((m) => {
      try {
        return v2DirectorModel(m);
      } catch (e) {
        return (e as Error).message;
      }
    });
    add("an empty Director model is an error, never OPENAI_MODEL / gpt-5-mini", empty.every((m) => /Director has no model/.test(m)) && v2DirectorModel(" google/gemini-2.5-flash ") === "google/gemini-2.5-flash", empty[0]);
    const key = process.env.FAL_KEY;
    process.env.FAL_KEY = "test";
    const picked = await v2Role("review", {}, normalizeConfig({ v2: { roles: { review: { model: "anthropic/claude-opus-5.5", reasoning: "medium" } } } })).catch(() => null);
    const noCopy = await v2Role("copywriter", {}, normalizeConfig({ v2: { roles: { director: { model: "a/b" } } } })).then(() => "no error", (e: Error) => e.message);
    process.env.FAL_KEY = key;
    add("each role runs its own model through fal's OpenRouter router, with its reasoning; a role without one is an error", picked?.provider === "fal" && picked.model === "anthropic/claude-opus-5.5" && picked.reasoning === "medium" && /No Copywriter model is set/.test(noCopy), `${picked?.provider} ${picked?.model} ${picked?.reasoning} · ${noCopy}`);
    const voice = { ...defaultConfig().voice, model: "fal-ai/elevenlabs/tts/turbo-v2.5", female: "", male: "Brian", choices: parseVoiceChoices("Sarah, female, Warm") };
    const noFemale = (() => {
      try {
        return v2VoiceName({ ...voice, choices: [] }, "female");
      } catch (e) {
        return (e as Error).message;
      }
    })();
    add("the voice is the customer's pick, else the admin's name for that gender", v2VoiceName(voice, "male", "Aria") === "Aria" && v2VoiceName(voice, "male") === "Brian" && v2VoiceName(voice, "female") === "Sarah" && /No female voice name is set/.test(noFemale), noFemale);
    const u = "11111111-1111-1111-1111-111111111111", p = "22222222-2222-2222-2222-222222222222";
    const owned = [ownedPath(`${u}/${p}/voice/narration.mp3`, u, p), ownedPath(`99999999-9999-9999-9999-999999999999/${p}/x.png`, u, p), ownedPath(`${u}/33333333-3333-3333-3333-333333333333/x.png`, u, p), ownedPath(`${u}/${p}/../other/x.png`, u, p), ownedPath(null, u, p), ownedPath(`${u}/${p}/x.png`, undefined, p)];
    add("only this project's own files are signed", owned.join(",") === "true,false,false,false,false,false", owned.join(","));
    // an injected client (the new version's) is priced as its own model, never gpt-5-mini
    const failing = { responses: { parse: async () => { throw new Error("down"); } } } as unknown as Parameters<typeof directMotion>[2];
    const used: string[] = [];
    const r = await directMotion({ name: "Flowly", color: "#6a5bff", cta: "Start", words: FLOWLY.words.slice(0, 20), seed: 1, clientModel: "google/gemini-2.5-flash" }, (x) => used.push(x.model), failing, 5_000);
    add("a failed Director is reported as such (the new version then fails and refunds)", r.plan.source === "rule" && used[0] === "google/gemini-2.5-flash" && r.problems.some((x) => /model call failed/.test(x)), `${r.plan.source} · ${used.join(",")} · ${r.problems[0]}`);
  }

  section = "New version: video rules, roles, variety";
  {
    type ComposerScriptT = import("@/components/video/composer/types").ScriptT;
    const BOOKWELL_ART = composeVariants({ words: BOOKWELL.words, brand: BOOKWELL.brand, duration: 900, seed: 3, count: 1 }).videos[0].script.art;
    const def = v2RulesOf({});
    const want = { story: true, frame: true, motion: true, no_people: true, never_list: true, max_items: true, entries: false, one_background: false, calm_background: false, layout_variety: true, min_scene: false, taste: true, flow: true, camera: true, depth: true, keyword: true, ui_pieces: true, cursor: true };
    add("the rules start as agreed (14 on, 4 off)", JSON.stringify(def.on) === JSON.stringify(want), JSON.stringify(def.on));
    const off = v2RulesOf({ [V2_RULES_MASTER]: false, [v2RuleKey("story")]: true });
    add("the master switch off turns every rule off", Object.values(off.on).every((x) => !x) && !off.ruleSet.house.maxItems && !off.ruleSet.layoutVariety && !off.checks.noPeople, JSON.stringify(off.on));
    const one = v2RulesOf({ [v2RuleKey("taste")]: false, [v2RuleKey("entries")]: true });
    add("each switch on its own", !one.on.taste && one.on.entries && one.on.story && !one.ruleSet.house.noIconCardMix && one.ruleSet.house.entries, JSON.stringify(one.on));
    const t = def.text("Never show a stock photo");
    const offText = off.text("Never show a stock photo");
    add("on: in the Director's instructions; off: not; honesty always", t.includes("STORY:") && t.includes("TASTE:") && !t.includes("3 kinds of way") && !t.includes("No busy backgrounds") && t.includes("stock photo") && t.includes("no music") && !offText.includes("STORY:") && !offText.includes("stock photo") && offText.includes("never placeholder data"), `${t.split("\n").length} lines on · ${offText.split("\n").length} off`);
    add("scene length: off follows the voice (1.5 s), on keeps 3 s", def.ruleSet.fit.minScene === 45 && def.checks.minSeconds === 1.5 && t.includes("1.5 s") && v2RulesOf({ [v2RuleKey("min_scene")]: true }).ruleSet.fit.minScene === 84 && def.ruleSet.fit.shown === V2_SHOWN, `${def.ruleSet.fit.minScene} / ${v2RulesOf({ [v2RuleKey("min_scene")]: true }).ruleSet.fit.minScene} frames`);
    add("every rule has its switch in admin → Settings (shown only with the new version)", V2_RULES.every((r) => SETTINGS.some((x) => x.key === v2RuleKey(r.id) && x.newOnly && x.fallback === r.on)) && SETTINGS.some((x) => x.key === V2_RULES_MASTER && x.newOnly), `${V2_RULES.length} + master`);
    // kept in code: one hero and up to 4 beside it; icons and a card may share a scene
    const busy: ComposerScriptT = { art: BOOKWELL_ART, scenes: [{ at: 0, text: null, kicker: null, layout: "center", arrange: null, ratio: null, dark: null, camera: null, enter: "fade", items: [{ kind: "card", at: 0, hit: null, variant: "list" }, { kind: "icon", at: 0, hit: null, icon: "calendar" }, { kind: "icon", at: 0, hit: null, icon: "bell" }, { kind: "icon", at: 0, hit: null, icon: "star" }, { kind: "chips", at: 0, hit: null }] }] } as unknown as ComposerScriptT;
    const kinds = (sc: ComposerScriptT) => sc.scenes[0].items.map((it) => it.kind).join(",");
    const free = houseRules(busy, null, { maxItems: false, entries: false, oneBackground: false, calmBackground: false, noIconCardMix: false });
    const kept = houseRules(busy, null, def.ruleSet.house);
    const six = { ...busy, scenes: [{ ...busy.scenes[0], items: [...busy.scenes[0].items, { kind: "stat", at: 0, hit: null, value: "3x" }] }] } as unknown as ComposerScriptT;
    add("rules off are not kept in code; on are (one hero + up to 4, icons beside a card allowed)", kinds(free) === "card,icon,icon,icon,chips" && kinds(kept) === "card,icon,icon,icon,chips" && kinds(houseRules(six, null, def.ruleSet.house)) === "card,icon,icon,icon,chips", `${kinds(free)} → ${kinds(kept)} · 6 things → ${kinds(houseRules(six, null, def.ruleSet.house))}`);
    // the look: a fresh one, unlike the last five; kept in code
    const recent = [1, 2, 3, 4, 5].map((s) => drawLook(s * 7919, []));
    const look = drawLook(424242, recent);
    add("a fresh look, unlike the last five (fonts, palette, camera)", !recent.some((r) => r.display === look.display) && !recent.some((r) => r.harmony === look.harmony && r.scheme === look.scheme) && look.transitions.length === 3 && look.layouts.length >= 4 && lookOf(JSON.parse(JSON.stringify(look)))?.seed === 424242 && lookOf({ seed: 1 }) === null, `${look.display}/${look.text} ${look.harmony}-${look.scheme} ${look.camera} · ${look.transitions.join(",")} · ${look.layouts.join(",")}`);
    const styled = withVariety({ art: { ...BOOKWELL_ART, style: null }, scenes: [{ ...busy.scenes[0], enter: "flip" }] } as unknown as ComposerScriptT, look);
    add("the look is kept in code (faces, palette, camera, ways in) and told to the Director", styled.art.display === look.display && styled.art.text === look.text && styled.art.harmony === look.harmony && styled.art.camera === look.camera && look.transitions.includes(styled.scenes[0].enter) && lookText(look).includes(look.display), `${styled.art.display} ${styled.scenes[0].enter}`);
    // laid out with the video's own fit: up to 6 words on screen
    const fw = "Every invoice gets paid on time now".split(" ").map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.4 }));
    const one6: ComposerScriptT = { art: BOOKWELL_ART, scenes: [{ at: 0, text: { from: 0, to: 5, size: "l", reveal: "rise", align: null, key: null }, kicker: null, layout: "type", arrange: null, ratio: null, dark: null, camera: null, enter: "fade", items: [] }] } as unknown as ComposerScriptT;
    const shownOf = (fit?: { shown?: number }) => placeAll(one6, fw, 120, BOOKWELL.brand, 7, 0, "director", [1920, 1080], fit).plan.scenes[0].text?.words.length ?? 0;
    add("a new-version video shows up to 6 words (the old version 4)", shownOf() <= 4 && shownOf({ shown: 6 }) === 6, `${shownOf()} → ${shownOf({ shown: 6 })}`);
    // the Copywriter: words of the scene only, 2–6 of them
    const cw = "Your support inbox is full every single day. Flowly answers every ticket for you".split(" ").map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
    const plan = { arts: [], scenes: [{ at: 0, text: { from: 0, to: 7 }, options: [{ items: [] }] }, { at: 8, text: { from: 8, to: 14 }, options: [{ items: [] }] }] };
    const fake = (scenes: unknown) => ({ client: { responses: { parse: async () => ({ output_parsed: { scenes }, usage: { input_tokens: 10, output_tokens: 5 } }) } }, model: "x/copy", provider: "fal", quick: false, reasoning: "default" }) as unknown as Parameters<typeof copywrite>[2];
    const good = await copywrite(plan as never, cw, fake([{ scene: 1, from: 1, to: 3, key: ["inbox"] }, { scene: 2, from: 3, to: 5, key: [] }]), () => {});
    add("the Copywriter keeps 2–6 of the scene's own words (else the Director's stay, said)", good.ideas.scenes[0].text?.from === 1 && good.ideas.scenes[0].text?.to === 3 && good.ideas.scenes[1].text?.from === 8 && good.problems.length === 1, `${JSON.stringify(good.ideas.scenes.map((x) => x.text))} · ${good.problems[0]}`);
    const broken = { ...fake([]), client: { responses: { parse: async () => { throw new Error("down"); } } } } as unknown as Parameters<typeof copywrite>[2];
    const failed = await copywrite(plan as never, cw, broken, () => {}).then(() => "no error", (e: Error) => e.message);
    add("a Copywriter that fails fails the video (no fallback)", /Copywriter \(x\/copy\) failed/.test(failed), failed);
    // the Director (new version): its rules only — none of the old version's
    const seen: { instructions?: string; reasoning?: unknown; input?: string; temperature?: unknown }[] = [];
    const spy = { responses: { parse: async (body: { instructions?: string; reasoning?: unknown }) => { seen.push(body); throw new Error("stop"); } } } as unknown as Parameters<typeof directMotion>[2];
    await directMotion({ name: "Flowly", color: "#6a5bff", cta: "Start", words: FLOWLY.words.slice(0, 30), seed: 1, clientModel: "x/director", reasoning: "high", rules: false, ruleText: def.text(null), checks: def.checks, prompt: "classic", recent: [] }, () => {}, spy, 20_000);
    await directMotion({ name: "Flowly", color: "#6a5bff", cta: "Start", words: FLOWLY.words.slice(0, 30), seed: 1, clientModel: "x/old" }, () => {}, spy, 20_000);
    const [v2i, v1i] = [seen[0]?.instructions ?? "", seen[1]?.instructions ?? ""];
    add("the new version's Director gets its rules, not the old version's (the old version unchanged)", v2i.includes("RULES (this video keeps them)") && !v2i.includes("HOUSE RULES") && !v2i.includes("Mix icons and cards") && v2i.includes("2 to 6 words") && !v2i.includes("ONE background for the whole video, never changing") && v1i.includes("HOUSE RULES") && v1i.includes("Mix icons and cards"), `${v2i.length} / ${v1i.length} chars`);
    add("each role's reasoning reaches its model", JSON.stringify(seen[0]?.reasoning) === JSON.stringify({ effort: "high" }), JSON.stringify(seen[0]?.reasoning));
    add("the new version's Director prompt is slimmer (its style is built in code) and asks for a compact answer; the old version's is unchanged", !v2i.includes("The reference promos we learn from") && v2i.includes("ANSWER COMPACTLY") && v1i.includes("The reference promos we learn from") && !v1i.includes("ANSWER COMPACTLY"), `${v2i.length} / ${v1i.length} chars`);
    const priced: { inputTokens: number; estimated?: boolean }[] = [];
    const timedOut = { responses: { parse: async () => { throw new Error("Request timed out."); } } } as unknown as Parameters<typeof directMotion>[2];
    await directMotion({ name: "Flowly", color: "#6a5bff", cta: "Start", words: FLOWLY.words.slice(0, 30), seed: 1, clientModel: "x/director", rules: false, ruleText: def.text(null), checks: def.checks }, (u) => priced.push(u), timedOut, 20_000);
    await directMotion({ name: "Flowly", color: "#6a5bff", cta: "Start", words: FLOWLY.words.slice(0, 30), seed: 1, clientModel: "x/old" }, (u) => priced.push(u), timedOut, 20_000);
    add("a timed-out new-version call is still priced (input from its length, marked estimated); the old version's not", priced[0]?.estimated === true && priced[0].inputTokens > 2000 && !priced[1]?.estimated && priced[1]?.inputTokens === 0, `${priced[0]?.inputTokens} est / ${priced[1]?.inputTokens}`);
    add("RECENT always reaches the new version's Director (the old classic prompt: not)", String(seen[0]?.input ?? "").includes("RECENT") && !String(seen[1]?.input ?? "").includes("RECENT"), `${String(seen[0]?.input ?? "").includes("RECENT")} / ${String(seen[1]?.input ?? "").includes("RECENT")}`);
    await directMotion({ name: "Flowly", color: "#6a5bff", cta: "Start", words: FLOWLY.words.slice(0, 30), seed: 1, clientModel: "google/gemini-2.5-flash", reasoning: "default", temperature: 0.9, rules: false, ruleText: def.text(null), checks: def.checks }, () => {}, spy, 20_000);
    add("the Director's temperature (0.9) is sent where the model takes one", seen[2]?.temperature === 0.9 && temperatureFor("openai/gpt-5", "default", 0.9).temperature === undefined && temperatureFor("google/gemini-2.5-flash", "high", 0.9).temperature === undefined && defaultConfig().v2.roles.director.temperature === 0.9 && defaultConfig().v2.roles.copywriter.temperature === null, `sent ${seen[2]?.temperature}`);
    // the look is one of the 35 recipes, and the code's recipe wins over the Director's style
    const recipeIds = RECIPES.map((r) => r.id);
    const lk = drawLook(99, []);
    const asked = { ground: "black", backdrop: "glow", card: "glow", panel: "dark", icon: "glow", accent: "electric", size: "giant", cuts: "hard", rhythm: "rapid" };
    const forcedSet = composeVariants({ words: BOOKWELL.words, brand: BOOKWELL.brand, duration: 900, seed: lk.seed, count: 1, ideas: { arts: [{ style: asked }], scenes: [] }, variety: lk, rules: def.ruleSet });
    const art = forcedSet.videos[0].script.art;
    const recipe = RECIPES.find((r) => r.id === lk.recipe)!;
    add("the look is built on one of the 35 recipes; the code's recipe beats the Director's style", RECIPES.length === 35 && recipeIds.includes(lk.recipe) && art.style?.ground === recipe.style.ground && (lk.scheme === "dark") === groundIsDark(recipe.style.ground!) && art.display === lk.display, `${lk.recipe} (${recipe.from}): ground ${art.style?.ground} · asked ${asked.ground}`);
    add("only the recipes the team allows", drawLook(5, [], { recipes: ["ref-02"] }).recipe === "ref-02", drawLook(5, [], { recipes: ["ref-02"] }).recipe);
    const dirOn = v2DirectorOf({});
    add("story shapes, Director's transitions, visual match: new-version switches, on by default", dirOn.shapes && dirOn.motion && dirOn.match && !v2DirectorOf({ v2_visual_match: false }).match && V2_DIRECTOR.every((d) => SETTINGS.some((x) => x.key === d.key && x.newOnly && x.fallback === true)), JSON.stringify(dirOn));
    add("a logo without colour: a colour from the look's random hue (not #6a5bff)", /^#[0-9A-F]{6}$/.test(hueColour(lk.hue)) && hueColour(0) !== hueColour(180) && hueColour(lk.hue) !== "#6A5BFF" && drawLook(1, []).hue !== drawLook(2, []).hue, `${lk.hue}° → ${hueColour(lk.hue)}`);
    // ── the premium motion (composer/flow.ts): new version only ──
    {
      const fw = Array.from({ length: 48 }, (_, i) => ({ text: `w${i}`, start: i * 0.45, end: i * 0.45 + 0.4 }));
      const icon = (at: number, name: string, id?: string) => ({ kind: "icon", at, icon: name, title: name, size: "l", ...(id ? { id } : {}) });
      const ideas: Ideas = { arts: [], scenes: [
        { at: 0, text: { from: 1, to: 3 }, options: [{ layout: "center", items: [icon(0, "eye-off", "a")] }] },
        { at: 8, text: { from: 9, to: 11 }, enter: "morph", camera: "orbit", options: [{ layout: "center", items: [icon(8, "lightbulb", "a")] }] },
        { at: 16, text: { from: 17, to: 19 }, enter: "zoom-in", options: [{ layout: "split-left", items: [{ kind: "card", variant: "list", at: 16, hit: 21, title: "Brief", rows: [{ title: "Scenes" }, { title: "Timing" }, { title: "Motion" }] }] }] },
        { at: 24, text: { from: 25, to: 27 }, options: [{ layout: "center", items: [icon(24, "timer")] }] },
        { at: 32, text: { from: 33, to: 35 }, enter: "push-left", options: [{ layout: "center", items: [icon(32, "shuffle")] }] },
        { at: 40, text: { from: 41, to: 43 }, options: [{ layout: "top", items: [{ kind: "logo", at: 40 }, { kind: "button", at: 41, hit: 46, title: "Try it" }] }] },
      ] } as unknown as Ideas;
      const brand = { ...BOOKWELL.brand };
      const rules = v2RulesOf({});
      const composeWith = (energy: "calm" | "medium" | "lively", flow = rules.flow) => {
        const look = { ...drawLook(77, []), energy };
        const set = composeVariants({ words: fw, brand, duration: 48 * 14, seed: look.seed, ideas, count: 1, rules: rules.ruleSet, variety: varietyOf(look, flow), creative: { language: "cuts", hero: 16 } });
        const v = set.videos[0];
        const placed = placeAll(v.script, fw, 48 * 14, brand, v.seed, 0, v.source, [1920, 1080], v.fit ?? {}).plan;
        return { v, plan: inspected(staged(placed, v.staging)).plan };
      };
      const runs = (["calm", "medium", "lively"] as const).map((e) => ({ e, ...composeWith(e) }));
      const share = (p: ComposerPlan) => (p.links ?? []).slice(1).filter((l) => l === "morph" || l === "dive" || l === "reveal").length / Math.max(1, p.scenes.length - 1);
      const r = runs.map((x) => `${x.e} ${(p => (p.links ?? []).slice(1).join(","))(x.plan)}`).join(" · ");
      add("each energy's continuous ways: calm ~30 %, medium ~40 %, lively at least half; never a cut", runs.every((x) => x.plan.flow?.energy === x.e && !(x.plan.links ?? []).includes("cut")) && share(runs[0].plan) >= 0.3 && share(runs[0].plan) <= 0.41 && share(runs[1].plan) >= 0.4 && share(runs[1].plan) <= 0.41 && share(runs[2].plan) >= 0.5, r);
      const pm = runs[1].plan;
      // the Director's continuous ways are suggestions: one plan, three seeds → three placements, the energy's share kept
      const seeded = [77, 4242, 90001, 31337, 55555, 8080].map((sd) => {
        const look = { ...drawLook(sd, []), energy: "medium" as const };
        const set = composeVariants({ words: fw, brand, duration: 48 * 14, seed: look.seed, ideas, count: 1, rules: rules.ruleSet, variety: varietyOf(look, rules.flow), creative: { language: "cuts", hero: 16 } });
        const v = set.videos[0];
        return inspected(staged(placeAll(v.script, fw, 48 * 14, brand, v.seed, 0, v.source, [1920, 1080], v.fit ?? {}).plan, v.staging)).plan;
      });
      const placesOf = (p: ComposerPlan) => (p.links ?? []).map((l, i) => (l === "morph" || l === "dive" || l === "reveal" ? `${i}${l[0]}` : "")).filter(Boolean).join(",");
      add("continuous ways vary per video from one Director plan (its picks are suggestions; the energy's share kept) — 6 seeds of a 6-scene video, 3+ placements", new Set(seeded.map(placesOf)).size >= 3 && seeded.every((p) => share(p) >= 0.4 && share(p) <= 0.41), seeded.map(placesOf).join(" · "));
      const morphs = [...runs.map((x) => x.plan), ...seeded].flatMap((p) => (p.links ?? []).map((l, i) => ({ p, l, i })).filter((x) => x.l === "morph"));
      add("a morph is always the last scene's icon becoming this scene's hero icon (the shared element)", morphs.every(({ p, i }) => { const pr = p.flow?.pairs[i]; const a = pr && p.scenes[i - 1].items[pr[0]], b = pr && p.scenes[i].items[pr[1]]; return !!a && !!b && a.kind === "icon" && b.kind === "icon" && p.scenes[i].items.filter((q) => q.kind !== "badge" && q.kind !== "shape" && q.kind !== "cursor").every((q) => q.box.w * q.box.h <= b.box.w * b.box.h); }), `${morphs.length} morph(s)`);
      add("never the same layout twice in a row — a scene that must change its layout to fit included (the closing ask aside)", runs.every((x) => x.plan.scenes.every((sc, i) => i === 0 || i === x.plan.scenes.length - 1 || sc.layout !== x.plan.scenes[i - 1].layout)), runs.map((x) => x.plan.scenes.map((sc) => sc.layout).join(",")).join(" · "));
      const cams = runs.map((x) => x.v.script.scenes.map((sc) => sc.camera));
      add("every scene its own camera move (never still, never twice in a row; the Director's kept where the energy has it)", cams.every((cs) => cs.every((c, i) => c && c !== "still" && c !== cs[i - 1])) && cams[1][1] === "orbit" && cams[0][1] !== "orbit", cams.map((c) => c.join(",")).join(" · "));
      add("the energy sets the springs (50–100 ms stagger, a settle, never an excessive bounce) and the keyword is lit in the brand colour or on a pill", runs.every((x) => ["color", "pill"].includes(x.v.script.art.key) && x.v.script.art.motion === ENERGY[x.e].motion) && (["calm", "medium", "lively"] as const).every((e) => { const m = moverOf({ motion: "snappy", pace: 1 }, ENERGY[e]); const z = m.cfg.damping / (2 * Math.sqrt(m.cfg.stiffness * m.cfg.mass)); return m.stagger >= 1.5 && m.stagger <= 3 && z >= 0.5 && z < 1; }), runs.map((x) => `${x.e}: ${x.v.script.art.motion} ${x.v.script.art.key}`).join(" · "));
      const cursors = pm.scenes.flatMap((sc) => sc.items.filter((it) => it.kind === "cursor").map((it) => ({ it, target: sc.items.find((q) => q.kind !== "cursor" && q.hit === it.hit) })));
      const off = composeWith("medium", { ...rules.flow, cursor: false }).plan;
      add("the big cursor: once a chapter, it clicks the scene's main thing and the click is that thing's moment; off with its rule", cursors.length >= 1 && cursors.length <= Math.ceil((pm.scenes.length - 2) / 3) + 1 && cursors.every((c) => !!c.target && c.it.from && c.it.hit != null) && !off.scenes.some((sc) => sc.items.some((it) => it.kind === "cursor")), `${cursors.length} click(s) · off: ${off.scenes.flatMap((sc) => sc.items).filter((it) => it.kind === "cursor").length}`);
      // no eyebrow labels, never the same words twice on one screen, tables only with short cells under fitting names
      const sc1 = pm.scenes.find((sc) => sc.text) ?? pm.scenes[0];
      const said = sc1.text ? sc1.text.words.map((w) => w.t).join(" ") : "Book online";
      const thing = pm.scenes.flatMap((sc) => sc.items).find((it) => it.kind !== "cursor")!;
      const R3 = (t: string, meta: string | null, tag: string | null) => ({ title: t, meta, tag, icon: null });
      const card = (title: string, rows: ReturnType<typeof R3>[]) => ({ ...thing, kind: "card" as const, variant: "table", title, rows, cols: null });
      const messy = tidied({ ...pm, scenes: [{ ...sc1, text: sc1.text ? { ...sc1.text, kicker: "Step 1" } : null, items: [card("Invoices", [R3("Acme Co", "$2,400", "Paid"), R3("Northwind", "$1,150", "Due")]), card("Orders", [R3("Order #4092 Silk Weave", "Fabric stage verified", "Active"), R3("Order #4093 Heavy Denim", "Production line in progress", "Running")]), card("Visits", [R3("Ann Lee", "In 3 days", "Booked"), R3("Bo Chen", "Tomorrow", "New")]), { ...thing, kind: "icon" as const, title: said, rows: null }, { ...thing, kind: "icon" as const, title: "Invoices", rows: null }] }] });
      const [money, long, dated, echo, twin] = messy.scenes[0].items;
      const noKicker = runs.every((x) => x.plan.scenes.every((sc) => !sc.text?.kicker)) && !messy.scenes[0].text?.kicker;
      add("no eyebrow labels, never the same words twice on one screen, a table only with 1–3-word cells under names that say what they hold (else a list)", noKicker && echo.title === "" && twin.title === "" && money.cols?.head.join(",") === "NAME,AMOUNT,STATUS" && dated.cols?.head[1] === "DATE" && long.variant === "list" && !long.cols, `${money.cols?.head.join("/")} · ${dated.cols?.head.join("/")} · long rows → ${long.variant}`);
      const mv = flowMoves(pm);
      const sx = sfxOf({ ...pm, sfx: true });
      const way = (i: number) => (pm.links ?? [])[i];
      add("sounds on what is seen: a whoosh as a way moves (none for a fade; a stronger sound at the same moment wins), a click on every cursor click", pm.scenes.every((_, i) => !i || way(i) === "fade" || way(i) === "cut" || sx.some((e) => (e.name === "whoosh" || e.rank > 2) && Math.abs(e.at - (mv[i].start + 2)) <= 9)) && cursors.every((c) => sx.some((e) => e.name === "click" && Math.abs(e.at - (c.it.hit ?? 0)) <= 9)) && !sx.some((e) => /music/.test(e.name)), `${sx.filter((e) => e.name === "whoosh").length} whoosh · ${sx.filter((e) => e.name === "click").length} click`);
      const dP = morphPath("eye-off", "lightbulb", 0), mP = morphPath("eye-off", "lightbulb", 0.5);
      add("an icon morphs into another (its strokes resampled, flubber-style)", !!dP && !!mP && dP !== mP && !/NaN/.test(mP) && morphPath("bell", "calendar", 1) !== morphPath("bell", "calendar", 0), `${mP?.length ?? 0} chars mid-morph`);
      // the old version: none of it
      const old = composeVariants({ words: fw, brand, duration: 48 * 14, seed: 77, ideas, count: 1 });
      const oldPlan = inspected(staged(placeAll(old.videos[0].script, fw, 48 * 14, brand, old.videos[0].seed).plan, old.videos[0].staging)).plan;
      add("the old version is untouched: no flow, no cursor pass, its own springs and camera", !oldPlan.flow && !old.videos[0].staging?.flow && JSON.stringify(moverOf({ motion: "soft", pace: 1 })) === JSON.stringify(moverOf({ motion: "soft", pace: 1 }, null)) && cameraOf("drift", 0.4, 30, 0.5) === cameraOf("drift", 0.4, 30, 0.5, 1), stagingName(old.videos[0].staging));
      // the never list: the new version's own changes; the old version's untouched
      const v2 = v2NeverList([]);
      const v1 = neverList();
      const v2o = v2NeverList([{ id: "crowded", never: "never crowd (db)", active: true }, { id: "idle", never: "x", active: false }, { id: "team", never: "never team rule", active: true }]);
      add("the new version's never list: 4 rules left out, 7 changed; a row with a built-in id overrides it for the new version only", v2.includes("panel-wipe") && !/small: a device or screenshot/.test(v2) && !/uploaded screenshots/.test(v2) && !/one calm backdrop/.test(v2) && !/more than 3 kinds of scene transition/.test(v2) && v2.includes("one hero and 3–4 supporting") && v2.includes("springs in") && /uploaded screenshots/.test(v1) && v1 === neverList() && v2o.includes("never crowd (db)") && !v2o.includes("2 seconds pass") && v2o.includes("never team rule") && neverList([{ id: "crowded", never: "never crowd (db)" }]).includes("one hero and at most 2 supporting"), `${v2.split("\n").length} lines (old ${v1.split("\n").length}; built-in ${VIDEO_RULES.length})`);
      add("the Director is told the energy, a camera per scene and the continuous ways (off: the look's own)", lookText({ ...drawLook(77, []), energy: "lively" }, rules.flow).includes("at least half") && lookText({ ...drawLook(77, []), energy: "lively" }, rules.flow).includes("CAMERA per scene") && !lookText(drawLook(77, [])).includes("WAYS BETWEEN"), "lively");
      // the UI piece library: filled from the scene's words; never a number the voice does not say
      const pw = "Track every invoice and payment in one dashboard. Search any client instantly. Get paid 3x faster".split(" ").map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
      const ps: ComposerScriptT = { art: BOOKWELL_ART, scenes: [
        { at: 0, text: null, kicker: null, layout: "center", arrange: null, ratio: null, dark: null, camera: null, enter: "fade", items: [{ kind: "card", variant: "kpi", at: 0, hit: null, rows: [{ title: "Revenue", meta: "$48,210", tag: "+12%" }] }, { kind: "card", variant: "list", at: 0, hit: null, rows: [{ title: "New request" }, { title: "Weekly report" }] }] },
        { at: 8, text: { from: 8, to: 11, size: "l", reveal: "rise", align: null, key: null }, kicker: null, layout: "center", arrange: null, ratio: null, dark: null, camera: null, enter: "fade", items: [{ kind: "card", variant: "search", at: 8, hit: null }] },
        { at: 12, text: null, kicker: null, layout: "center", arrange: null, ratio: null, dark: null, camera: null, enter: "fade", items: [{ kind: "stat", at: 12, hit: null, value: "10x" }, { kind: "chart", variant: "bars", at: 12, hit: null, value: "94%" }] },
      ] } as unknown as ComposerScriptT;
      const pp = withPieces(ps, pw);
      const [s1, s2, s3] = pp.scenes.map((x) => x.items);
      const pieceLine = pp.scenes.map((x) => x.items.map((it) => `${it.kind}:${it.variant ?? ""}${it.value ? `=${it.value}` : ""}[${(it.rows ?? []).map((r) => r.title).join("/")}]`).join(" ")).join(" · ");
      add("UI pieces: the script's own words (the things it names), never a number the voice does not say (an unsaid dashboard becomes a list, a counter its spoken number)", PIECES.length === 7 && pieceOf({ kind: "card", variant: "kpi" }) === "dashboard" && s1[0].variant === "list" && !JSON.stringify(s1).includes("48,210") && (s1[1].rows ?? []).map((r) => r.title).join("/") === "Invoice/Payment/Dashboard" && s2[0].value === "Search any client" && s3[0].value === "3x" && s3[1].variant === "area" && s3[1].value == null, pieceLine);
      add("UI pieces on with their rule (new version only)", rules.flow.pieces && !v2RulesOf({ [v2RuleKey("ui_pieces")]: false }).flow.pieces && rules.text("").includes("UI PIECES"), String(rules.flow.pieces));
    }
  }

  section = "v2 hero scenes";
  {
    add("text over the limit is cut on a whole word, else dropped", cutWords("Results grow faster today", 16) === "Results grow" && cutWords("Supercalifragilistic", 8) === null && cutWords("3x", 6) === "3x", `${cutWords("Results grow faster today", 16)}`);
    const twice = numberSlot({ value: "2", word: 0 }, [{ text: "twice", start: 0, end: 0.2 }]);
    const three = numberSlot({ value: "3x", word: 0 }, [{ text: "3x", start: 0, end: 0.2 }]);
    const bn = numberSlot({ value: "৩০", word: 1, unit: "pcs" }, [{ text: "lot", start: 0, end: 0.2 }, { text: "৩০", start: 0.3, end: 0.5 }]);
    const missingWord = numberSlot({ value: "3x" }, [{ text: "3x", start: 0, end: 0.2 }]);
    add("a counter only when that spoken word contains the number (Bengali digits kept, 'twice' is not 2)", !twice && three?.value === "3x" && bn?.value === "৩০" && bn?.unit === "pcs" && !missingWord && countSpoken("৩০", 1) === "৩০" && countSpoken("3x", 0) === "0x", `${three?.value} · ${countSpoken("৩০", 0.5)}`);
    const voice = [{ text: "Results", start: 0, end: 0.2 }, { text: "grow", start: 0.3, end: 0.5 }, { text: "faster", start: 0.6, end: 0.8 }];
    const cut = textSlot({ text: "ignored", words: [0, 2] }, voice, 12);
    add("a text slot with word indexes is taken from those words, then cut", cut?.text === "Results grow" && cut.from === 0, cut?.text ?? "");
    setFrame(1920, 1080);
    const box = { x: 140, y: 90, w: 1640, h: 900 };
    const kinds = ["drift", "push", "pull", "tilt", "orbit", "rise", "float", "macro"];
    const cropped = kinds.flatMap((kind) => [0, 0.35, 0.7, 1].flatMap((p) => {
      const cam = containCam(cam2d(kind, p, 48, 0.9), box, 24);
      return [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].filter(([x, y]) => {
        const [nx, ny] = mapPoint(x, y, cam);
        return nx < 24 || ny < 24 || nx > 1896 || ny > 1056;
      }).map(() => kind);
    }));
    add("the 2D camera keeps a text box inside the frame", cropped.length === 0, cropped.slice(0, 4).join(", ") || "contained");
    const hw = ["Results", "grow", "3x", "faster", "hello", "boost", "৩০", "increase", "10", "Try", "Bookwell"].map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.3 }));
    const sc = (at: number, from: number, to: number) => ({ at, text: { from, to, size: "l" as const, reveal: "rise" as const, align: null, key: null }, kicker: null, layout: "center" as const, arrange: null, ratio: null, dark: null, camera: "drift" as const, enter: "wipe" as const, items: [] });
    const host = composeVariants({ words: BOOKWELL.words, brand: BOOKWELL.brand, duration: 400, seed: 4, count: 1 }).videos[0].script;
    const brand = { ...BOOKWELL.brand, icon: null as string | null, tagline: "Your whole clinic in one simple app", cta: "Book a free demo" };
    const made = withHeroes({ ...host, scenes: [sc(0, 0, 3), sc(4, 4, 4), sc(5, 5, 6), sc(7, 7, 8), sc(9, 9, 10)] }, hw, brand, 11);
    const ids = made.script.scenes.map((s) => s.hero?.id ?? "-");
    const chart = made.script.scenes[0].hero;
    const bnChart = made.script.scenes[2].hero;
    const noLogo = resolveHero(made.script.scenes.at(-1)?.hero, hw, brand);
    const withLogo = resolveHero(made.script.scenes.at(-1)?.hero, hw, { ...brand, icon: "https://cdn.example/logo.png" });
    const dropped = resolveHero(chart, hw.map((w) => (w.text === "3x" ? { ...w, text: "three" } : w)), { ...brand, icon: "x" });
    const valueOf = (slots: { value?: unknown } | undefined) => (slots?.value as { value?: string } | undefined)?.value ?? "";
    add("heroes: growth where the voice grows or counts, never twice in a row, at most twice, logo on the last scene", ids.join(",") === "growth_chart,-,growth_chart,-,logo_end" && valueOf(chart?.slots) === "3x" && valueOf(bnChart?.slots) === "৩০" && made.script.scenes[3].hero == null, ids.join(","));
    const logoLine = withLogo != null && noLogo == null && withLogo.slots.brandName === "Bookwell" && withLogo.exit === "none";
    add("logo_end uses the uploaded logo and the real brand name; without a logo the scene stays kinetic", logoLine && logoReachNote(false, made.script.scenes) != null && logoReachNote(true, made.script.scenes) == null, withLogo?.slots.brandName ?? "none");
    add("a growth counter is dropped when the spoken word no longer contains it; the label remains", dropped?.id === "growth_chart" && !dropped.slots.value && !!dropped.slots.metricLabel && dropped.exit === "zoom-in", dropped?.slots.value ? "kept" : "dropped");
    const plain = composeVariants({ words: hw, brand: BOOKWELL.brand, duration: 200, seed: 4, count: 1 }).plans[0];
    add("v1 output has no hero field", plain.scenes.every((s) => !s.hero) && !plain.flow, plain.scenes.map((s) => s.hero?.id ?? "-").join(","));
  }

  section = "covered elsewhere";
  add("asset-type-swap, support-placement", true, "checked by npm run check:assets and check:recipe");
  return checks;
}
