// The app's checks — everything that can be checked without a render: the
// simple engine (templates, selector, check before playing, the Director's
// test set), the AI models' plumbing, projects, credits and settings.
import http from "node:http";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { countUsage, defaultConfig, normalizeConfig, parseVoiceChoices, textClient, textCost, usageCost } from "@/lib/ai/models";
import { retimeScript } from "@/lib/voice-timing";
import { ownedPath } from "@/lib/projects";
import { v2DetailsOf } from "@/lib/v2/form";
import { v2DirectorModel, v2Role, v2VoiceName } from "@/lib/v2/models";
import { creditsFor, creditsForBdt, editCost, normalizeBilling, pickable, priceOf, walletsOffered, withCoupon } from "@/lib/billing-config";
import { SETTINGS } from "@/lib/app-settings";
import { iconFor } from "@/lib/simple/brain";
import { resolveIcon } from "@/components/video/icons";
import { livingStandIn } from "@/components/video/icons/living";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { keyIconOf } from "@/components/video/simple/kit";
import { MOTION_SOUND, WORD_ICON_NAMES, motionOf, wordIcon } from "@/components/video/simple/motion";
import { phraseMode, phrasesOf, punchesOf } from "@/components/video/simple/rhythm";
import { MOST_AT_ONCE, SOUND_FRAMES, SOUND_NAMES, soundsOf } from "@/components/video/simple/sounds";
import { askOf, beatsOf, durationOf } from "@/components/video/simple/beats";
import { isPublicHost, websiteUrlOf } from "@/lib/website-url";
import { applyEdit, editOf } from "@/components/video/simple/edit";
import { guessReadings } from "@/components/video/simple/guess";
import { differs, planOf, repeats, showsIcon, wordsAlone } from "@/components/video/simple/select";
import { galleryPlan, sampleScene } from "@/components/video/simple/gallery";
import { bestPlan, checkPlan, colourProblemsOf, heroShares, repairPlan, scoreOf } from "@/components/video/simple/check";
import { DIRECTOR_CASES, scoreCase } from "@/lib/simple/director-test";
import { fitWords } from "@/components/video/simple/fit";
import { geoFor, geoOf, sideOf, splitOf, stackOf } from "@/components/video/simple/geo";
import { emWidth, faceOf } from "@/components/video/simple/faces";
import { CONCEPTS, GROUNDS, type Scene, type SimplePlan, STYLES, STYLE_GROUNDS, TEMPLATES, VARIANTS, variantsOf } from "@/components/video/simple/types";
import { conceptSounds, turnOf } from "@/components/video/simple/concept";
import { PUNCH } from "@/components/video/simple/scenes";
import { alignScript, pausesOf } from "@/lib/voice-align";
import { numberInWords, leadsBn, trailsBn } from "@/components/video/simple/bangla";

// Every icon on screen — a scene's, a card's or a row's — is the icon of a word said in its beat, and a
// scene's comes in with that word; a scene whose hero is its icon always has one (the owner's rule)
function iconsOff(pl: SimplePlan): string[] {
  return pl.scenes.flatMap((x, k) => {
    if (x.template === "cta" || x.template === "point") return [];
    const heard = new Set((x.said ?? []).map((w) => wordIcon(w.t)).filter(Boolean));
    const hero = showsIcon(x.template, x.variant, x.concept) && !(x.tiles?.length ?? 0);
    const bad: string[] = [];
    if (hero && !x.icon) bad.push(`scene ${k + 1} ${x.template}: no picture`);
    if (hero && x.icon && !heard.has(x.icon)) bad.push(`scene ${k + 1} ${x.template}: ${x.icon} not said`);
    if (x.icon && x.iconAt !== undefined && !(x.said ?? []).some((w) => wordIcon(w.t) === x.icon && Math.abs(w.at - x.iconAt!) <= 1)) bad.push(`scene ${k + 1}: ${x.icon} not timed to its word`);
    // (a panel going on keeps the rows said in the beat before: those are checked there)
    for (const t of (x.tiles ?? []).slice(x.carry ?? 0)) if (!heard.has(t.icon)) bad.push(`scene ${k + 1} card ${t.text}: ${t.icon} not said`);
    return bad;
  });
}
import { TYPE_PAIRS } from "@/components/video/simple/types";

type Check = { section: string; name: string; ok: boolean; detail: string };

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  let section = "";
  const add = (name: string, ok: boolean, detail: string) => checks.push({ section, name, ok, detail });
  section = "AI models (/admin/models)";
  {
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
      const picks = parseVoiceChoices("Kore, female, Warm and clear\nPuck, male\nKore, male, duplicate\n\n");
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

  section = "Projects, models, credits and settings";
  {
    const d = v2DetailsOf({ engine: "v2", voice: { source: "upload", name: null, path: "u/p/voice/upload.mp3" } });
    add("a v2 video's details read back", d?.voice.source === "upload" && d.voice.path === "u/p/voice/upload.mp3" && v2DetailsOf({ category: "finance" }) === null && v2DetailsOf({ engine: "v2" })?.voice.source === "script", JSON.stringify(d));
    const missing = await v2Role("director", {}, normalizeConfig({ text: { model: "google/gemini-2.5-flash" } })).then(() => "no error", (e: Error) => e.message);
    add("no Director model set: a clear error, no fallback (not even the old main model)", /No Director model is set\./.test(missing), missing);
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
    const picked = await v2Role("director", {}, normalizeConfig({ v2: { roles: { director: { model: "anthropic/claude-opus-5.5", reasoning: "medium" } } } })).catch(() => null);
    process.env.FAL_KEY = key;
    add("the Director runs its own model through fal's OpenRouter router, with its reasoning", picked?.provider === "fal" && picked.model === "anthropic/claude-opus-5.5" && picked.reasoning === "medium", `${picked?.provider} ${picked?.model} ${picked?.reasoning}`);
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
    // credits: a set price for the first 20 s (30), then each level's rate a second; taka; coupons on a pack; pricing mended
    const bill = normalizeBilling(null);
    const fair =
      creditsFor(bill, "standard", 20) === 30 && creditsFor(bill, "standard", 4) === 30 && creditsFor(bill, "standard", 20.2) === 31 && creditsFor(bill, "standard", 30) === 40 && creditsFor(bill, "pro", 30) === 70 &&
      priceOf(bill, 100).usd === 1 && priceOf(bill, 100).bdt === 122 && creditsForBdt(bill, 500) === 409 && editCost(bill, 0) === 0 && editCost(bill, 1) === 15 && editCost(bill, 4) === 15 && editCost(normalizeBilling({ freeEdits: 0, editCredits: 20 }), 0) === 20 && walletsOffered(bill).length === 0 && walletsOffered(normalizeBilling({ wallets: { bkash: { number: "01712-345678" } } })).join() === "bkash";
    const pack = bill.packs[0];
    const deals = [withCoupon(pack, { kind: "discount", value: 10 }), withCoupon(pack, { kind: "bonus", value: 100 }), withCoupon(pack, { kind: "discount", value: 100 })];
    const mendedBill = normalizeBilling({ tiers: { standard: { status: "off", perSecond: -3 }, ultra: { status: "nope" } }, packs: [{ usd: 0, credits: 5 }], signupCredits: "x" });
    add("credits: per second by level, Pro for paying customers only, coupons (% off, % more, free), pricing mended", fair && deals[0].usd === 9 && deals[1].bonus === pack.credits && deals[2].usd === 0 && mendedBill.tiers.standard.status === "on" && mendedBill.tiers.standard.perSecond === 0 && mendedBill.tiers.ultra.status === "soon" && mendedBill.packs.length === 4 && mendedBill.signupCredits === 50 && pickable(bill, "ultra") === null && pickable(bill, "pro") === "pro" && pickable(bill, "pro", false) === null && pickable(bill, "standard", false) === "standard", `30 s: ${creditsFor(bill, "standard", 30)} / ${creditsFor(bill, "pro", 30)} · $${deals[0].usd} · +${deals[1].bonus}`);
    // an icon name the library lacks becomes the nearest real one
    const icons = [iconFor("notebook-pen-paper-xyz", "Paper diary"), iconFor(null, "Ringing phone"), iconFor("calendar", "x")];
    add("icons: a name the library lacks becomes a real icon", icons.every((x) => !!x && !!resolveIcon(x)) && icons[2] === "calendar", icons.join(" · "));
    // settings: no engine switches; every key one the database takes (a bad key breaks every save)
    const engine = SETTINGS.filter((x) => /^feature_(new_version|simple_engine|frame_check|creative_director|video_rules)|^look_|^tech_|^v2_|^form_/.test(x.key));
    add("settings: no engine switches, every key valid for the database", !engine.length && SETTINGS.every((x) => /^[a-z0-9_]{2,60}$/.test(x.key)), `${SETTINGS.length} settings${engine.length ? ` · ${engine.map((x) => x.key).join(", ")}` : ""}`);
  }

  section = "Simple engine (docs/video-spec.md)";
  {
    // a real script on its voice's times (Orin ERP, Oct 17)
    const said = "Still tracking orders on spreadsheets? Missed deadlines. Lost stock. Endless calls. Orin ERP brings orders, stock and production into one place. See every order live, from fabric to final shipment. Orin ERP. Run your factory, not your paperwork.".split(" ");
    let t = 0;
    const sw = said.map((text) => {
      const w = { text, start: t, end: t + 0.3 };
      t += /[.?!]$/.test(text) ? 0.75 : 0.36;
      return w;
    });
    const beats = beatsOf(sw);
    const spans = beats.map((b) => sw[b.last].end - sw[b.first].start);
    add("the voice in beats: whole sentences, each 2–6.5 s, every word in one", beats.length >= 4 && spans.every((x) => x >= 2 && x <= 6.5) && beats.every((b, i) => b.first === (i ? beats[i - 1].last + 1 : 0)) && beats.at(-1)!.last === sw.length - 1, spans.map((x) => x.toFixed(1)).join(" · "));
    const readings = guessReadings(sw, beats, "Orin ERP");
    const brand = { name: "Orin ERP", color: "#1FA77A", cta: "Start today", icon: null };
    const prints: string[] = [];
    const plans = [11, 12, 13, 14].map((sd) => {
      const p = planOf({ words: sw, beats, readings, brand, seed: sd, duration: durationOf(sw), recent: prints });
      prints.push(p.print);
      return p;
    });
    add("a template per beat, never the same twice in a row, the brand and the ask last", plans.every((p) => p.scenes.length === beats.length && p.scenes.at(-1)!.template === "cta" && p.scenes.every((x, i) => !i || x.template !== p.scenes[i - 1].template || x.template === "statement" || (x.template === "concept" && x.concept !== p.scenes[i - 1].concept))), plans.map((p) => p.scenes.map((x) => `${x.template}${x.variant}`).join(",")).join(" · "));
    add("the same script four times: four videos unlike each other in at least 3 of ground, type, transitions, pace and template order", plans.every((p, i) => plans.slice(0, i).every((q) => differs(p.print, q.print) >= 3)), prints.join(" · "));
    const g = galleryPlan({ ground: "dark", type: 0, way: "slide", pace: "calm" });
    add("every template has its variants in the gallery", TEMPLATES.every((x) => g.scenes.filter((s) => s.template === x).length === variantsOf(x)), `${g.scenes.length} scenes`);
    // every frame: the places inside it, the words' place and the hero's apart
    const inside = (b: { left: number; top: number; width: number; height: number }, W: number, H: number) => b.left >= 0 && b.top >= 0 && b.left + b.width <= W && b.top + b.height <= H;
    const apart = (a: { left: number; top: number; width: number; height: number }, b: typeof a) => a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top;
    const frames = ([[1920, 1080], [1080, 1920], [1080, 1080]] as const).map(([W, H]) => {
      const g = geoOf(W, H);
      const sp = [splitOf(g, true), splitOf(g, false)], st = stackOf(g);
      return { shape: g.shape, ok: sp.every((x) => inside(x.words, W, H) && inside(x.hero, W, H) && apart(x.words, x.hero)) && inside(st.words, W, H) && inside(st.body, W, H) && apart(st.words, st.body) };
    });
    const tallPlan = planOf({ words: sw, beats, readings, brand, seed: 21, duration: durationOf(sw), size: [1080, 1920] });
    add("every frame (16:9, 9:16, 1:1): the words' place and the hero's inside it and apart; a 9:16 plan keeps its frame", frames.every((x) => x.ok) && tallPlan.w === 1080 && tallPlan.h === 1920, frames.map((x) => `${x.shape} ${x.ok ? "ok" : "bad"}`).join(" · "));
    // the words and a hero as one group: centred on the frame, inside its margins, apart
    const grouped = ([[1920, 1080], [1080, 1920], [1080, 1080]] as [number, number][]).flatMap(([W, H]) => {
      const g = geoOf(W, H);
      return [true, false].flatMap((left) => [180, 420, 640].flatMap((width) => [[860, 760], [480, 940], [640, 640]].map(([dw, dh]) => {
        const words = { size: 100, lines: 2, width };
        const { words: wb, hero } = sideOf(g, left, 860, words, dw, dh);
        const s = Number(/scale\(([\d.]+)\)/.exec(String(hero.transform))![1]);
        const h = { left: Number(hero.left), top: Number(hero.top), right: Number(hero.left) + dw * s, bottom: Number(hero.top) + dh * s };
        // (the words as wide as they come out, not their place)
        const w = g.shape === "wide" ? { left: wb.left, right: wb.left + Math.min(wb.width, width), top: (H - 216) / 2, bottom: (H + 216) / 2 } : { left: (W - width) / 2, right: (W + width) / 2, top: wb.top, bottom: wb.top + wb.height };
        const [l, r] = [Math.min(w.left, h.left), Math.max(w.right, h.right)];
        const apart = g.shape === "wide" ? w.right <= h.left || h.right <= w.left : w.bottom <= h.top;
        return { ok: apart && l >= g.pad - 1 && r <= W - g.pad + 1 && Math.abs(l - (W - r)) <= 2, at: `${W}x${H} ${left ? "L" : "R"} ${width} ${dw}x${dh}` };
      })));
    });
    const loose = grouped.filter((x) => !x.ok);
    add("the words and a hero as one group: centred on every frame, inside its margins, never touching", !loose.length, loose.slice(0, 3).map((x) => x.at).join(" · ") || `${grouped.length} layouts`);
    // the words fit their place: at most the lines allowed, every line inside it
    const face = faceOf("plus-jakarta-sans");
    const fitted = fitWords("Your invoices finally pay themselves automatically".split(" "), face, { width: 680, lines: 3, max: 120, min: 60 });
    const wide = Math.max(...fitted.lines.map((l) => l.reduce((a, i, k) => a + emWidth("Your invoices finally pay themselves automatically".split(" ")[i], face, 700) * fitted.size + (k ? emWidth(" ", face, 700) * 1.15 * fitted.size : 0), 0)));
    add("words fitted to their place: within its lines and its width, the lines even", fitted.lines.length <= 3 && wide <= 680 && fitted.size >= 60, `${fitted.size}px · ${fitted.lines.map((l) => l.length).join("/")} words a line`);
    // the check before playing (check.ts): every template, variant, frame and ground clean as designed
    // the looks: every look on every ground it stands on reads for very different brand colours, and its scenes lay out
    const lookLeft = ["#7C3AED", "#F59E0B", "#10B981", "#111827", "#EF4444", "#0EA5E9", "#FACC15", "#FFFFFF"].flatMap((color) =>
      STYLES.flatMap((style) => STYLE_GROUNDS[style].flatMap((ground) => colourProblemsOf({ ...galleryPlan({ ground, type: 0, way: "slide", pace: "calm", style }), brand: { name: "Brand", color, cta: "" } }).map((x) => `${color} ${style}/${ground}: ${x.detail}`))),
    );
    const lookScenes = STYLES.flatMap((style) => checkPlan(galleryPlan({ ground: STYLE_GROUNDS[style][0], type: 1, way: "tilt", pace: "calm", style })).map((x) => `${style} ${x.kind}`));
    add("looks: soft, neon, editorial, bold and depth read on their grounds for any brand colour; their scenes lay out", !lookLeft.length && !lookScenes.length, lookLeft[0] ?? lookScenes[0] ?? `${STYLES.length} looks`);
    const galleryLeft = ([[1920, 1080], [1080, 1920], [1080, 1080]] as [number, number][]).flatMap((size) => GROUNDS.flatMap((ground) => checkPlan(galleryPlan({ ground, type: 1, way: "slide", pace: "calm" }, undefined, size)).map((x) => `${size.join("x")} ${ground} ${x.kind}`)));
    add("check before playing: every template variant clean on every frame and ground", galleryLeft.length === 0, galleryLeft.slice(0, 3).join(" · ") || `${galleryPlan({ ground: "dark", type: 1, way: "slide", pace: "calm" }).scenes.length} variants × 3 frames × ${GROUNDS.length} grounds`);
    // …and what goes wrong is found and mended
    const bad = sampleScene("feature", 0, 0, 120);
    bad.items = [{ text: "Extraordinarily complicated reconciliation", icon: "layers" }, { text: "Stock", icon: "no-such-icon" }, { text: "Stock", icon: "boxes" }];
    const long = sampleScene("statement", 1, 120, 100);
    long.words = "Internationalization professionalization extraordinarily comprehensively incomprehensibilities".split(" ").map((t, i) => ({ t, at: 124 + i * 6, key: i === 1 }));
    const broken = { ...galleryPlan({ ground: "dark", type: 0, way: "slide", pace: "calm" }), scenes: [bad, long, sampleScene("cta", 0, 220, 90)], duration: 310 };
    const kinds = new Set(checkPlan(broken).map((x) => x.kind));
    const mended = repairPlan(broken, [{ intent: "feature", show: [0, 3], key: 3, icon: "radio", items: bad.items, number: null }, { intent: "hook", show: [0, 4], key: 1, icon: "sheet", items: [], number: null }, { intent: "cta", show: [0, 3], key: 1, icon: "rocket", items: [], number: null }]);
    add("check before playing: a line too long, a missing icon, a thing twice and words too long are found and mended", ["cut", "icon", "twice", "words"].every((k) => kinds.has(k as never)) && !mended.report.left.length && mended.report.fixed.length === 2 && mended.plan.scenes.at(-1)!.template === "cta" && !!mended.plan.check, mended.report.fixed.map((x) => x.split(" → ")[1]).join(" · "));
    // the Director's test set (lib/simple/director-test.ts): every good reading inside its beat; right scores high, wrong scores low
    const setOk = DIRECTOR_CASES.every((c) => { const b = beatsOf(c.words); return b.length === c.beats.length && c.beats.every((g, i) => g.show[0] >= b[i].first && g.show[1] <= b[i].last && g.key.every((k) => k >= g.show[0] && k <= g.show[1])); });
    const right = DIRECTOR_CASES.map((c) => scoreCase(c, c.beats.map((g) => ({ intent: g.intent[0], show: [g.key[0], Math.min(g.show[1], g.key[0] + 2)] as [number, number], key: g.key[0], icon: null, items: g.items.map((t) => ({ text: t, icon: null })), number: g.number }))));
    const wrong = DIRECTOR_CASES.map((c) => scoreCase(c, beatsOf(c.words).map((b) => ({ intent: "feature" as const, show: [b.first, b.last] as [number, number], key: null, icon: null, items: [], number: null }))));
    const avg = (xs: number[]) => Math.round(xs.reduce((a, x) => a + x, 0) / xs.length);
    add("the Director's test set: 10 scripts, every good reading inside its beat; a right reading scores high, a careless one low", DIRECTOR_CASES.length === 10 && setOk && avg(right) >= 95 && avg(wrong) <= 50, `${DIRECTOR_CASES.reduce((a, c) => a + c.beats.length, 0)} beats · right ${avg(right)} · careless ${avg(wrong)}`);
    // a template that means what the words do not say is found and mended (a chart with no number said)
    const noNumber = { ...sampleScene("chart", 0, 0, 120), number: null };
    const meant = { ...galleryPlan({ ground: "dark", type: 0, way: "slide", pace: "calm" }), scenes: [noNumber, sampleScene("cta", 0, 120, 90)], duration: 210 };
    const meantFixed = repairPlan(meant, [{ intent: "feature", show: [0, 4], key: 2, icon: "trending-up", items: noNumber.items, number: null }, { intent: "cta", show: [0, 3], key: 1, icon: "rocket", items: [], number: null }]).plan;
    add("what a template means is checked: a chart or a number only when the voice says one, a typed prompt only for a question", checkPlan(meant).some((x) => x.kind === "meaning") && !["chart", "stat"].includes(meantFixed.scenes[0].template) && !checkPlan(meantFixed).length, `chart with no number → ${meantFixed.scenes[0].template}`);
    // the last scene is the last sentence (the ask) on its own; the button says the ask as said, or there is none
    const ends = (t: string) => /[.?!…]["'”’)]*$/.test(t);
    const lastOk = DIRECTOR_CASES.every((c) => {
      const b = beatsOf(c.words).at(-1)!;
      const inside = c.words.slice(b.first, b.last).filter((w) => ends(w.text)).length;
      return ends(c.words[b.first - 1]?.text ?? ".") && (inside === 0 || (inside === 1 && c.words.slice(b.first, b.last + 1).findIndex((w) => ends(w.text)) <= 1));
    });
    const asked = Object.fromEntries(DIRECTOR_CASES.map((c) => [c.id, askOf(c.words, beatsOf(c.words).at(-1)!)]));
    add("the last scene is the ask on its own, never the sentence before it; the button says the ask as said, or there is none", lastOk && asked.b8d1 === "Book a free demo today" && asked["31ec"] === "Try it today" && asked.e762 === null, `${asked.b8d1} · ${asked["31ec"]} · ${asked.e762 ?? "no button"}`);
    // the product, not the words: the 10 test scripts (their right readings) drawn 4 ways each, mended as the pipeline does
    const drawn = DIRECTOR_CASES.flatMap((c) => {
      const beats = beatsOf(c.words);
      const readings = c.beats.map((gb) => ({ intent: gb.intent[0], show: [gb.show[0], gb.show[1]] as [number, number], key: gb.key[0], icon: null, items: gb.items.map((t) => ({ text: t, icon: null })), number: gb.number }));
      return [11, 222, 3333, 44444].map((seed) => repairPlan(planOf({ words: c.words, beats, readings, brand: { name: c.brand, color: "#6a5bff", cta: "Get started" }, seed, duration: durationOf(c.words) }), readings).plan);
    });
    const body = drawn.flatMap((p) => p.scenes.slice(0, -1).map((sc, i) => ({ sc, alone: wordsAlone(sc.template, sc.variant), before: i ? wordsAlone(p.scenes[i - 1].template, p.scenes[i - 1].variant) : false })));
    const iconLeft = drawn.flatMap(iconsOff);
    add("the picture is the word said: every icon on screen is a word said in its beat, and comes in with it; none said, none shown", !iconLeft.length, iconLeft.slice(0, 3).join(" · ") || `${drawn.reduce((n, p) => n + p.scenes.length, 0)} scenes`);
    const aloneShare = body.filter((x) => x.alone).length / body.length;
    const heroes = drawn.flatMap((p) => heroShares(p)).filter((x): x is number => x != null);
    const heroMean = heroes.reduce((a, x) => a + x, 0) / heroes.length;
    add("the product, not the words: words alone in at most a quarter of scenes and never twice in a row; a hero takes on average over a quarter of the frame (it was a fifth)", aloneShare <= 0.25 && !body.some((x) => x.alone && x.before) && heroMean >= 0.26, `${drawn.length} videos · words alone ${Math.round(aloneShare * 100)}% · hero ${Math.round(heroMean * 100)}%`);
    // the story plan is followed: a beat is shown as the plan says (when it can be), the main moment always shows something
    const planRuns = DIRECTOR_CASES.flatMap((c) => {
      const beats = beatsOf(c.words);
      const readings = c.beats.map((gb, i) => ({ intent: gb.intent[0], show: [gb.show[0], gb.show[1]] as [number, number], key: gb.key[0], icon: null, items: gb.items.map((t) => ({ text: t, icon: null })), number: gb.number, shows: (gb.items.length >= 2 ? "steps" : "words") as "steps" | "words", hero: i === 1 }));
      return [11, 222, 3333].map((seed) => ({ readings, plan: planOf({ words: c.words, beats, readings, brand: { name: c.brand, color: "#6a5bff", cta: "" }, seed, duration: durationOf(c.words) }) }));
    });
    // (counted where it can be: a beat that still has two things to show as steps)
    const asSteps = planRuns.flatMap(({ readings, plan }) => plan.scenes.slice(0, -1).filter((sc, i) => readings[i].shows === "steps" && sc.items.length >= 2));
    const stepShare = asSteps.filter((sc) => sc.template === "steps").length / Math.max(1, asSteps.length);
    const heroAlone = planRuns.filter(({ plan }) => wordsAlone(plan.scenes[1].template, plan.scenes[1].variant)).length;
    add("the story plan is followed: a beat is shown as planned when it can be, and the main moment always shows something", stepShare >= 0.35 && heroAlone === 0, `planned as steps → steps ${Math.round(stepShare * 100)}% · main moment as words alone ${heroAlone}`);
    // several drafts, the best kept: never worse than one, and nothing left unmended
    const bests = DIRECTOR_CASES.map((c) => {
      const beats = beatsOf(c.words);
      const readings = c.beats.map((gb) => ({ intent: gb.intent[0], show: [gb.show[0], gb.show[1]] as [number, number], key: gb.key[0], icon: null, items: gb.items.map((t) => ({ text: t, icon: null })), number: gb.number }));
      const args = { words: c.words, beats, readings, brand: { name: c.brand, color: "#6a5bff", cta: "" }, seed: 11, duration: durationOf(c.words) };
      const best = bestPlan(args).plan;
      return { best, worseThanOne: scoreOf(best) < scoreOf(repairPlan(planOf(args), readings).plan) };
    });
    add("several drafts, each mended and scored by code, the best kept: never worse than one draft, nothing left unmended", bests.every((x) => !x.worseThanOne && !checkPlan(x.best).length), `${bests.length} scripts × 8 drafts`);
    // the product's own pictures: offered in beats about the product, each shown once; a website address made safe
    const pictured = DIRECTOR_CASES.flatMap((c) => {
      const beats = beatsOf(c.words);
      const readings = c.beats.map((gb) => ({ intent: gb.intent[0], show: [gb.show[0], gb.show[1]] as [number, number], key: gb.key[0], icon: null, items: gb.items.map((t) => ({ text: t, icon: null })), number: gb.number }));
      return [11, 222].map((seed) => bestPlan({ words: c.words, beats, readings, brand: { name: c.brand, color: "#6a5bff", cta: "", screens: ["screen-1.jpg", "screen-2.jpg"] }, seed, duration: durationOf(c.words) }).plan);
    });
    const screenScenes = pictured.flatMap((p) => p.scenes.filter((sc) => sc.template === "screen"));
    const onceEach = pictured.every((p) => { const used = p.scenes.filter((sc) => sc.template === "screen").map((sc) => sc.screen); return new Set(used).size === used.length && used.every((x) => x != null && x < 2); });
    const urls = [websiteUrlOf("acme.com"), websiteUrlOf("https://acme.com/pricing"), websiteUrlOf("ftp://acme.com"), websiteUrlOf("not a site")];
    const privateHosts = await Promise.all(["127.0.0.1", "localhost", "10.1.2.3", "192.168.0.10", "169.254.169.254", "[::1]"].map(isPublicHost));
    add("the product's own pictures: shown in beats about the product, each once; a website link made a safe public address (no private networks)", screenScenes.length >= pictured.length / 2 && onceEach && urls[0] === "https://acme.com/" && urls[1] === "https://acme.com/pricing" && !urls[2] && !urls[3] && privateHosts.every((x) => !x), `${screenScenes.length} screen scenes in ${pictured.length} videos · private addresses refused`);
    // the editor (edit.ts): a video as it is round-trips; a look and a scene changed as asked; nothing outside the rules goes in
    {
      const c = DIRECTOR_CASES[1];
      const beats = beatsOf(c.words);
      const readings = c.beats.map((gb) => ({ intent: gb.intent[0], show: [gb.show[0], gb.show[1]] as [number, number], key: gb.key[0], icon: null, items: gb.items.map((t) => ({ text: t, icon: null })), number: gb.number }));
      const video = bestPlan({ words: c.words, beats, readings, brand: { name: c.brand, color: "#6a5bff", cta: "Book a free demo today" }, seed: 7, duration: durationOf(c.words) }).plan;
      const as = editOf(video);
      const same = applyEdit(video, as);
      const round = !!same.plan && JSON.stringify(same.plan.scenes) === JSON.stringify(video.scenes);
      const relook = applyEdit(video, { ...as, theme: { ...as.theme, ground: "light", pace: "lively" } });
      const words = applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 0 ? { ...x, template: "statement" as const, variant: 0, show: [0, 1] as [number, number], key: 1 } : x)) });
      const wordsOk = !!words.plan && words.plan.scenes[0].words.map((w) => w.t).join(" ") === `${c.words[0].text} ${c.words[1].text}` && words.plan.scenes[0].words[1].key;
      const refused = [
        applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 0 ? { ...x, show: [0, 999] as [number, number] } : x)) }),
        applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 0 ? { ...x, template: "cta" as const } : x)) }),
        applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 1 ? { ...x, items: [1, 2, 3, 4].map((k) => ({ text: `Thing ${k}`, icon: null })) } : x)) }),
        applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 1 ? { ...x, items: [{ text: "a thing far too many words long", icon: null }] } : x)) }),
        applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 1 ? { ...x, template: "screen" as const, screen: 0 } : x)) }),
        applyEdit(video, { ...as, theme: { ...as.theme, ground: "neon" as never } }),
        applyEdit(video, { ...as, scenes: as.scenes.slice(1) }),
        // (a background of its own for a third scene)
        applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i < 3 ? { ...x, ground: as.theme.ground === "light" ? ("brand" as const) : ("light" as const) } : x)) }),
      ].filter((r) => r.error).length;
      // a scene on a background of its own: kept, drawn on it, put back as the video's when it is the same
      const otherGround = as.theme.ground === "light" ? ("dark" as const) : ("light" as const);
      const own = applyEdit(video, { ...as, scenes: as.scenes.map((x, i) => (i === 1 ? { ...x, ground: otherGround } : x)) });
      const ownOk = !!own.plan && own.plan.scenes[1].ground === otherGround && !own.plan.scenes[0].ground && own.plan.print !== video.print && editOf(own.plan).scenes[1].ground === otherGround;
      const backAgain = own.plan ? applyEdit(own.plan, { ...editOf(own.plan), theme: { ...as.theme, ground: otherGround } }) : null;
      const sameAsVideo = !!backAgain?.plan && !backAgain.plan.scenes[1].ground;
      add("the editor: a video round-trips as it is; a look, the words on screen and a scene's own background change as asked; words outside the beat, a moved ending, too many or too long things, a picture there is not, an unknown look, missing scenes and a third scene on its own background are refused", round && !!relook.plan && relook.plan.theme.ground === "light" && wordsOk && ownOk && sameAsVideo && refused === 8, `round trip ${round ? "same" : "differs"} · own background ${ownOk && sameAsVideo ? "kept" : "wrong"} · ${refused}/8 refused`);
    }
    // one scene, one idea: beside a hero at most 4 words; no thing that only repeats them
    // (words alone show no things)
    const crowded = body.filter(({ sc, alone }) => !alone && (sc.words.length > 4 || sc.items.some((it) => repeats(it.text, sc.words.map((w) => w.t).join(" ")))));
    add("one scene, one idea: beside a hero at most 4 words, and no thing that only repeats them", !crowded.length && repeats("Precise Timing", "Precise animation timing") && !repeats("Story Transitions", "Precise animation timing"), crowded.slice(0, 2).map((x) => `${x.sc.template}: ${x.sc.words.map((w) => w.t).join(" ")}`).join(" · ") || `${body.length} scenes`);
    // the rhythm: something new on screen every ~3 s at most on average (the promos: 1–4 s; we held 4–13 s) —
    // a scene, a phrase of words alone, a close-up on a hero and back
    const changes = drawn.map((p) => p.scenes.reduce((n, sc) => n + 1 + (phraseMode(sc) ? phrasesOf(sc).length - 1 : 0) + 2 * punchesOf(sc).length, 0));
    const gaps = drawn.map((p, k) => p.duration / 30 / changes[k]);
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    add("the rhythm: something new on screen every 3 s or sooner on average (a scene, a phrase of the words alone, a close-up on the hero and back)", meanGap <= 3, `${drawn.length} videos · a change every ${meanGap.toFixed(1)} s on average (slowest ${Math.max(...gaps).toFixed(1)} s)`);
    // what the motion kit learnt on real edits (docs/video-spec.md): the lit word on screen at least 1 s
    // before its scene ends; no backdrop blur (it blinks while things move); no colour switched at a halfway
    // point of a motion (it snaps — colours fade across, kit.tsx blend); a close-up at least 15 % closer
    const litAt = (sc: Scene) => (phraseMode(sc) ? phrasesOf(sc).flatMap((x) => x.words) : sc.words).find((w) => w.key)?.at;
    const short = drawn.flatMap((p) => p.scenes.filter((sc) => { const k = litAt(sc); return k != null && sc.to - k < 30; }).map((sc) => `${sc.template}: ${sc.words.map((w) => w.t).join(" ")}`));
    const engine = readdirSync("components/video/simple").filter((f) => /\.tsx?$/.test(f)).map((f) => [f, readFileSync(`components/video/simple/${f}`, "utf8")] as const);
    const blurred = engine.filter(([, src]) => /backdrop-?filter/i.test(src)).map(([f]) => f);
    const snaps = engine.flatMap(([f, src]) => [...src.matchAll(/\w+ [<>]=? 0\.\d+ \? [^:]*look\.\w+[^:]* : [^,;)}]*look\.\w+/g)].map(() => f));
    add("what the motion kit learnt: the lit word on screen at least 1 s; no backdrop blur; colours fade across, never snap; a close-up at least 15 % closer", !short.length && !blurred.length && !snaps.length && PUNCH >= 1.15, [...short.slice(0, 2), ...blurred, ...snaps].join(" · ") || `${drawn.reduce((n, p) => n + p.scenes.length, 0)} scenes · close-up ×${PUNCH}`);
    // icons that move, with their own sound: a word gets an icon only when it plainly stands for one; every
    // icon named is one there is (and never a person or an animal); every sound is a file; never a crowd of sounds
    const badIcons = WORD_ICON_NAMES.filter((n) => !resolveIcon(n) || livingStandIn(n));
    const sounds = [...SOUND_NAMES, ...Object.values(MOTION_SOUND).map((x) => x.name)].filter((n) => !existsSync(`public/sfx/${n}.mp3`));
    const heard = drawn.map((p) => soundsOf(p));
    const crowd = Math.max(...heard.map((list) => Math.max(0, ...list.map((e) => list.filter((x) => x.at >= e.at && x.at < e.at + 30).length))));
    const unknown = heard.flat().filter((e) => !SOUND_NAMES.includes(e.name) || !SOUND_FRAMES[e.name]).length;
    // (sounding together: the player has 5 audio tags, one is the voice)
    const together = Math.max(...heard.map((list) => Math.max(0, ...list.map((e) => list.filter((x) => x.at <= e.at && x.at + SOUND_FRAMES[x.name] > e.at).length))));
    const keyed = body.filter((x) => x.alone && keyIconOf(x.sc)).length;
    const moving = heard.flat().filter((e) => ["tick", "ding", "rise", "shimmer", "lock", "digital_processing", "typing"].includes(e.name)).length;
    const plain = wordIcon("Invoices,") === "receipt" && wordIcon("fast") === "zap" && wordIcon("the") === null && wordIcon("team") === "users" && wordIcon("বয়সের") === "user-round" && wordIcon("দিনের") === "sun" && wordIcon("দিন") === null && wordIcon("মানে") === null && motionOf("circle-check") === "draw" && motionOf("bell") === "ring" && motionOf("house") === null;
    add("icons that move, with their own sound: a word gets an icon only when it plainly stands for one (none for the rest; people only as an outline, never a face or an animal); every icon and sound is there; never more than 3 sounds in a second, nor more than 3 sounding at once", !badIcons.length && !sounds.length && !unknown && crowd <= 3 && together <= MOST_AT_ONCE && plain, `${badIcons.length ? `no icon ${badIcons.join(", ")} · ` : ""}${sounds.length ? `no sound ${sounds.join(", ")} · ` : ""}${keyed}/${body.filter((x) => x.alone).length} words-alone scenes with an icon · ${moving} icon/typing sounds in ${drawn.length} videos · at most ${crowd} sounds a second, ${together} at once`);
  }

  {
    // the ideas (concept.tsx): every idea, resolving or not, in every variant, clean on every frame; its turn
    // inside the scene; its sounds there; and found by its words in a script
    const left: string[] = [];
    let turns = 0, heard = 0;
    for (const size of [[1920, 1080], [1080, 1920], [1080, 1080]] as [number, number][]) {
      const base = galleryPlan({ ground: "light", type: 2, way: "zoom", pace: "lively" }, undefined, size);
      const cases = CONCEPTS.flatMap((concept) => [true, false].flatMap((resolves) => Array.from({ length: VARIANTS }, (_, v) => ({ concept, resolves, v }))));
      const scenes: Scene[] = cases.map(({ concept, resolves, v }, k) => {
        const words = concept === "truth" ? "Busy is just stuck" : "Ideas stuck in your head";
        const s = sampleScene("concept", v, k * 150, 150, k % 2 === 0);
        const ws = words.split(" ");
        return { ...s, concept, resolves, ...(concept === "agenda" ? { agenda: ["সঠিক কাস্টমার চিনুন", "ভালো কনটেন্ট", "নিয়মিত পোস্ট", "বিজ্ঞাপনের বাজেট"] } : {}), items: concept === "truth" ? [{ text: "Busy", icon: null }, { text: "Stuck", icon: null }] : concept === "versus" ? [{ text: "কম খরচ", icon: null }, { text: "বেশি বিক্রি", icon: null }] : concept === "few" ? [{ text: "৫,০০০ ভিজিটর", icon: null }, { text: "৫ জন", icon: null }] : concept === "split" ? [{ text: "সফল", icon: "circle-check" }, { text: "ক্যানসেল", icon: "circle-x" }, { text: "রিটার্ন", icon: "undo-2" }] : s.items, words: ws.map((t, i) => ({ t, at: k * 150 + 4 + i * 9, key: i === ws.length - 1 })), said: ws.map((t, i) => ({ t, at: k * 150 + 4 + i * 9 })) };
      });
      const plan = { ...base, scenes, duration: scenes.length * 150 };
      left.push(...checkPlan(plan).map((x) => `${size.join("x")} ${x.scene != null ? `${scenes[x.scene].concept}${"ABC"[scenes[x.scene].variant]}` : ""} ${x.detail}`));
      for (const s of scenes) {
        const t = turnOf(s);
        if (t >= s.from + 24 && t <= s.to - 40) turns++;
        if (conceptSounds(s).every((e) => e.at >= s.from && e.at < s.to && SOUND_NAMES.includes(e.name))) heard++;
      }
    }
    const script = "Your best ideas always get stuck inside your own head. Your orders are scattered across five different apps. Every week you wait for approvals that never come. Being busy is really just being stuck. Launch your new online shop today with us. Editing one short video takes hours of your day. Paying agencies is far too expensive for a small team. No designers, no editors and no big budget needed. Hit every single goal you set this quarter. Start now.";
    let t = 0.3;
    const words = script.split(" ").map((w) => { const start = t; t += 0.36 + (/[.?!]$/.test(w) ? 0.45 : 0); return { text: w, start, end: start + 0.32 }; });
    const found = guessReadings(words, beatsOf(words), "Shop").map((r) => r.concept ?? "-").join(" ");
    const all = CONCEPTS.length * 2 * VARIANTS * 3;
    add("the ideas: every one, resolving or not, in every variant, clean on every frame; its turn inside the scene and its sounds there; found by its words", !left.length && turns === all && heard === all && found === "trapped chaos waiting truth launch hours cost barriers progress -", left.slice(0, 3).join(" · ") || `${all} scenes · ${found}`);
  }

  {
    // Bangla (docs/video-spec.md, Bangla) — the videos are Bangla only
    // 1. the voice timed by its pauses, no AI: a voice made of the script's phrases (each as long as its
    //    letters, a pause after it, and a few pauses inside phrases), every phrase found where it starts
    const script = "আপনার অনলাইন ব্যবসায় সবচেয়ে বড় সমস্যা কী? অর্ডার আসে, কিন্তু ডেলিভারি হয় না। প্রথমে গ্রাহকের তথ্য সংগ্রহ করুন, তারপর বিজ্ঞাপন সাজান। মাত্র তিন দিনে ফলাফল দেখুন। আজই অর্ডার করুন।";
    const rate = 8000, pace = 0.085;
    const tokens = script.split(" ");
    const phraseStarts: number[] = [];
    const pcm: number[] = [];
    const tone = (sec: number) => { for (let k = 0; k < Math.round(sec * rate); k++) pcm.push(Math.round(Math.sin(k * 0.3) * 9000 * (0.6 + 0.4 * Math.sin(k / 400)))); };
    const hush = (sec: number) => { for (let k = 0; k < Math.round(sec * rate); k++) pcm.push(Math.round((Math.random() - 0.5) * 60)); };
    hush(0.3);
    let startNext = true;
    tokens.forEach((w, i) => {
      if (startNext) phraseStarts.push(pcm.length / rate);
      startNext = false;
      tone(w.replace(/[^\p{L}\p{M}]/gu, "").length * pace);
      if (/[,।?]$/.test(w)) { hush(/[।?]$/.test(w) ? 0.55 : 0.32); startNext = true; }
      else if (i % 4 === 2) hush(0.25);
      else hush(0.04);
    });
    const { pauses, duration } = pausesOf(Int16Array.from(pcm), rate);
    const timed = alignScript(script, pauses, duration) ?? [];
    const firsts = timed.filter((_, i) => i === 0 || /[,।?]$/.test(tokens[i - 1]));
    const off = firsts.map((w, i) => Math.abs(w.start - (phraseStarts[i] ?? 99)));
    add("Bangla: the voice timed by its pauses, no AI — every phrase where it starts, every word in order", timed.length === tokens.length && off.length === phraseStarts.length && Math.max(...off) < 0.12 && timed.every((w, i) => !i || w.start >= timed[i - 1].start), `${phraseStarts.length} phrases · off by ${(Math.max(...off) * 1000).toFixed(0)} ms at most`);

    // 2. Bangla type: every face of every pair measured (scripts/bangla), a word as wide as the browser drew it
    const measured: [string, string, number][] = [["anek-bangla", "অ্যানালাইসিস", 5.81], ["hind-siliguri", "অ্যানালাইসিস", 5.31], ["noto-sans-bengali", "অ্যানালাইসিস", 5.62]];
    const unmeasured = [...new Set(TYPE_PAIRS.flat())].filter((slug) => emWidth("অআ", faceOf(slug)) === emWidth("অআ", faceOf("inter")));
    const far = measured.filter(([slug, w, em]) => Math.abs(emWidth(w, faceOf(slug)) - em) / em > 0.03);
    add("Bangla type: every face measured; a word as wide as the browser draws it (within 3%)", !unmeasured.length && !far.length, [...unmeasured, ...far.map(([s]) => s)].join(", ") || `${new Set(TYPE_PAIRS.flat()).size} faces`);

    // 3. numbers said in words as their digits, with their units — never "নয়" (not) or "একটি" (a)
    const nums: [string, string | null][] = [["পাঁচ হাজার ভিজিটর", "৫,০০০"], ["মাত্র পাঁচজন", "৫ জন"], ["পঞ্চাশ শতাংশ ছাড়", "৫০%"], ["মাত্র একশো বিশ টাকা", "৳১২০"], ["এক লাখ পঁচিশ হাজার টাকা", "৳১,২৫,০০০"], ["ক্যাম্পেইন সফল নয়", null], ["একটি ভালো পণ্য", null], ["পঁচিশ, পঞ্চাশ অথবা একশো শতাংশ", "১০০%"]];
    const wrongNums = nums.filter(([t, want]) => numberInWords(t.split(" ")) !== want);
    add("Bangla numbers said in words: as digits with their unit; a word that is also a number only with a unit", !wrongNums.length, wrongNums.map(([t]) => t).join(" · ") || `${nums.length} cases`);

    // 4. read by rule (no AI): sentences end at ।, a caption never ends on এবং/এই nor starts on থেকে/জন্য,
    //    a list said is its things, a number said is its digits, the ask is its button; 5. clean on every frame
    let t = 0.3;
    const words = script.split(" ").map((w) => { const start = t; t += 0.42 + (/[।?]$/.test(w) ? 0.5 : /,$/.test(w) ? 0.2 : 0); return { text: w, start, end: start + 0.36 }; });
    const beats = beatsOf(words);
    const readings = guessReadings(words, beats, "দোকান");
    const badRuns = readings.filter((r) => leadsBn(words[r.show[1]].text) || trailsBn(words[r.show[0]].text));
    const ask = askOf(words, beats[beats.length - 1]);
    const left: string[] = [];
    for (const size of [[1080, 1920], [1920, 1080], [1080, 1080]] as [number, number][]) {
      const { plan } = bestPlan({ words, beats, readings, brand: { name: "দোকান", color: "#7C3AED", cta: ask ?? "", icon: null }, seed: 7, duration: durationOf(words), size, drafts: 4 });
      left.push(...checkPlan(plan).map((x) => `${size.join("x")} ${x.scene != null ? plan.scenes[x.scene].template : ""} ${x.detail}`));
    }
    const sentences = beats.length >= 4;
    add("Bangla read by rule (no AI): sentences at ।, captions never end on এবং/এই nor start on থেকে/জন্য, the number said as digits, the ask a button", sentences && !badRuns.length && readings.some((r) => r.number === "৩ দিনে") && ask === "আজই অর্ডার করুন", `${beats.length} beats · ask "${ask}" · ${readings.map((r) => r.intent).join(",")}`);
    add("Bangla plans clean on every frame (9:16, 16:9, 1:1): words fit their places in Bangla type", !left.length, left.slice(0, 3).join(" · ") || "3 frames");

    // 6. an explainer told as points: each opening its own scene with its number, the agenda where the
    //    count is said, the bar over the rest and the scenes laid out below it; the conclusion and the ask
    //    outside the last point; 7. the recipes found by their words: versus, funnel, X নয় Y, shares as stops
    const ex = "আপনার ব্যবসায় কম বিজ্ঞাপন খরচে বেশি সেলস পেতে এই তিনটি বিষয় জানুন। প্রথমত, সঠিক কাস্টমার চিনুন। তারা কোন এলাকায় থাকেন, কখন অর্ডার করেন, তা জানতে হবে। কতগুলো অর্ডার ক্যানসেল বা রিটার্ন হচ্ছে, তা দেখুন। দ্বিতীয়ত, ওয়েবসাইট কনভার্শন দেখুন। ওয়েবসাইটে পাঁচ হাজার ভিজিটর আসছে, কিন্তু পারচেজ করছে মাত্র পাঁচজন। তারা কোন পেজ থেকে চলে যাচ্ছেন, তা খুঁজুন। কতগুলো অর্ডার সফলভাবে ডেলিভারড হচ্ছে, আর কতগুলো ক্যানসেল হচ্ছে, দেখুন। কতজন প্রোডাক্ট দেখছেন, কতজন কার্টে যোগ করছেন, আর কতজন চেকআউট পর্যন্ত যাচ্ছেন, তা দেখুন। তৃতীয়ত, ভিডিও অ্যানালাইসিস করুন। কত শতাংশ অডিয়েন্স কতদূর দেখছেন, তা দেখুন। যারা পঁচিশ, পঞ্চাশ, পঁচাত্তর অথবা একশো শতাংশ ভিডিও দেখছেন, তাদের আলাদা কনটেন্ট দিন। মনে রাখবেন, অনুমান নয়, ডেটা দেখে সিদ্ধান্ত নিন। কারণ ডেটাই আসল শিক্ষক। আজই শুরু করুন।";
    let t2 = 0.3;
    const xw = ex.split(" ").map((w) => { const start = t2; t2 += 0.42 + (/[।?]$/.test(w) ? 0.5 : /,$/.test(w) ? 0.2 : 0); return { text: w, start, end: start + 0.36 }; });
    const xb = beatsOf(xw);
    const xr = guessReadings(xw, xb, "দোকান");
    const pointLeft: string[] = [];
    let opened = "", agendaOk = false, below = true, closeOut = true;
    for (const size of [[1080, 1920], [1920, 1080], [1080, 1080]] as [number, number][]) {
      const { plan } = bestPlan({ words: xw, beats: xb, readings: xr, brand: { name: "দোকান", color: "#7C3AED", cta: "আজই শুরু করুন", icon: null }, seed: 5, duration: durationOf(xw), size, drafts: 3 });
      pointLeft.push(...checkPlan(plan).map((x) => `${size.join("x")} ${x.scene != null ? plan.scenes[x.scene].template : ""} ${x.detail}`));
      opened = plan.scenes.filter((x) => x.template === "point").map((x) => `${x.point!.n}:${x.words.map((w) => w.t).join(" ")}`).join(" | ");
      agendaOk = plan.scenes.some((x) => x.template === "concept" && x.concept === "agenda" && x.agenda?.length === 3);
      // (no bar at the top — the owner's choice: every scene has the whole frame)
      below &&= plan.scenes.every((x) => geoFor(size[0], size[1], x).top === 0);
      closeOut &&= plan.scenes.slice(-3).every((x) => !x.point);
    }
    add("Points: each opens on its own scene, numbered, its title as said; the agenda where the count is said; no bar at the top; the conclusion and the ask outside the last", !pointLeft.length && opened === "1:সঠিক কাস্টমার চিনুন | 2:ওয়েবসাইট কনভার্শন দেখুন | 3:ভিডিও অ্যানালাইসিস করুন" && agendaOk && below && closeOut, pointLeft.slice(0, 3).join(" · ") || opened);
    // 8. the words beside their pictures: a beat whose things are its own words shows a card for each, in as said
    const tall = bestPlan({ words: xw, beats: xb, readings: xr, brand: { name: "দোকান", color: "#7C3AED", cta: "আজই শুরু করুন", icon: null }, seed: 5, duration: durationOf(xw), size: [1080, 1920], drafts: 3 }).plan;
    // the panel (the hand-made look): a beat's things as rows, each in as it is said; a beat naming more right after
    // goes on in the same panel with the rows it had — never past five, never across a point
    const panels = tall.scenes.filter((x) => x.template === "panel");
    const inOrder = panels.every((x) => x.tiles!.every((t, k, a) => (k < (x.carry ?? 0) || (t.at >= x.from - 6 && t.at < x.to)) && (!k || t.at >= a[k - 1].at)) && x.tiles!.length <= 5);
    const chains = tall.scenes.every((x, k) => !x.cont || (k > 0 && tall.scenes[k - 1].template === "panel" && (tall.scenes[k - 1].point?.n ?? 0) === (x.point?.n ?? 0) && (x.carry ?? 0) === tall.scenes[k - 1].tiles!.length));
    // the picture is the word said (the owner's rule), in Bangla too
    const iconLeftBn = iconsOff(tall);
    add("the picture is the word said (Bangla): every icon on screen is a word said in its beat, and comes in with it; none said, none shown", !iconLeftBn.length, iconLeftBn.slice(0, 3).join(" · ") || `${tall.scenes.length} scenes`);
    add("Bangla: a beat's things as a panel's rows, each in as it is said; going on in the same panel without a cut inside a point", panels.length >= 1 && inOrder && chains, panels.map((x) => `${x.cont ? "+" : ""}${x.tiles!.map((t) => t.text).join("|")}`).join(" · ") || "none");
    // 9. cards, not screenshots (the owner's choice): a Bangla video has no product screen, phone or message
    //    screen; cards are dealt as their words are said; panel and cards never the same look twice running
    const shots = tall.scenes.filter((x) => x.template === "screen" || x.template === "messages" || (x.template === "feature" && x.variant === 1));
    const decks = tall.scenes.filter((x) => x.template === "deck");
    const dealtInOrder = decks.every((x) => x.tiles!.every((t, k, a) => t.at >= x.from - 6 && t.at < x.to && (!k || t.at >= a[k - 1].at)));
    const looks = tall.scenes.filter((x) => (x.template === "panel" && !x.cont) || x.template === "deck").map((x) => x.template);
    const twice = looks.some((t, k) => k > 0 && t === "deck" && looks[k - 1] === "deck");
    add("Bangla: cards, not screenshots — no product screen or phone; cards dealt as said; never two decks running", !shots.length && dealtInOrder && !twice, `${shots.length} screens · ${decks.length} decks · ${looks.join(",") || "none"}`);
    const found = xr.map((r) => r.concept ? `${r.concept}[${r.items.map((x) => x.text).join("|")}]` : "").filter(Boolean).join(" ");
    const want = ["versus[কম বিজ্ঞাপন খরচ|বেশি সেলস]", "funnel[প্রোডাক্ট|কার্ট|চেকআউট]", "progress[২৫%|৫০%|৭৫%]", "truth[অনুমান|ডেটা]", "few[৫,০০০ ভিজিটর|৫ জন]", "exit[", "split[সফল|ক্যানসেল]", "retention["];
    add("Bangla recipes found by their words: less for more (versus), stages narrowing (funnel), shares as a bar's stops, \"X নয়, Y\" (truth), many against few, leaving a page, good against bad, a video watched less", want.every((w) => found.includes(w)), found);
  }

  return checks;
}
