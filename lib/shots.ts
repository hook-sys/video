import { z } from "zod";
import { isIconName } from "@/components/video/icons";
import { FLOW_THEMES } from "@/lib/flow-script";
import { DECORS, parseAsset, TONES, SceneScript, type SceneBeat, type SceneContent, type SceneElement } from "@/lib/scene-script";

// Shot templates: tested building blocks a video is made of. The Director
// only picks a shot per sentence and fills its words; every size, place,
// entrance, cursor move and sound is fixed here and checked by rendering
// (npm run check:story renders each shot). A ShotScript expands into a
// SceneScript, which the scene compiler turns into the video.

export const SHOT_KINDS = ["problem", "steps", "group", "reveal", "ui", "outputs", "number", "line"] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

export const SHOT_CATALOG: Record<ShotKind, string> = {
  problem: "a pain or a question (items[0] = { asset: 'text:<word>' } flips the accent word to that word when the voice says it, e.g. weeks → minutes): subject (object:, icon: or visual:) big in the centre with its label; then line (2–6 words) appears under it on line_cue; mark 'strike' crosses out the accent word (e.g. 'Takes weeks', strike 'weeks')",
  steps: "2–4 things that come one after another (steps, tools, chores): items[] each { cue, asset (icon: or visual:), label }; each appears on its own cue in a row",
  group: "3–6 things named together (apps, channels, platforms, features): items[] { asset, label } appear together on cue with a pop each",
  reveal: "the product's logo arrives big (use once, where the voice names the product the first time; never for the closing line)",
  ui: "the product doing its job: a UI card big in the centre (card = one template id; title, input, button); a cursor clicks the button on action_cue (button text becomes 'pressed'); a success card with result pops beside it on result_cue",
  outputs: "right after a ui shot: 2–3 results come out of that card one after another: items[] { cue, asset (visual: or icon:), label }",
  number: "a number or measure as the hero: subject 'text:<value with a digit>' (e.g. text:4K, text:3 min, text:98%); items[] { cue, asset: 'text:<next value>' } swap it on their cues; line = a short caption under it",
  line: "a promise or closing line as big kinetic type: line (2–6 words), accent = 1 word in brand colour, mark 'pill' puts the accent on a pill; add subject 'object:<name>' to set a 3D object beside the words (the words go left)",
};

// Cards the ui shot may use (readable as a big hero).
export const UI_CARDS = ["action-panel", "ai-prompt", "search", "upload", "checkout", "login", "cta", "invoice", "calendar-event", "task", "chat", "email", "payment", "order", "appointment", "social-post", "campaign"] as const;

const Item = z.object({ cue: z.string().nullable(), asset: z.string(), label: z.string().nullable() });
const Shot = z.object({
  shot: z.enum(SHOT_KINDS),
  cue: z.string(), // 1–6 consecutive narration words: the shot starts here
  subject: z.string().nullable(), // problem: icon:/visual: · number: text:<value>
  label: z.string().nullable(), // caption under the subject (≤3 words)
  line: z.string().nullable(), // on-screen words (problem caption, number caption, line)
  line_cue: z.string().nullable(), // problem: when the line appears
  accent: z.string().nullable(),
  mark: z.enum(["strike", "pill"]).nullable(),
  card: z.string().nullable(), // ui: a card template from UI_CARDS
  title: z.string().nullable(), // ui: card title
  input: z.string().nullable(), // ui: text in its input
  button: z.string().nullable(), // ui: button text
  action_cue: z.string().nullable(), // ui: the click
  result: z.string().nullable(), // ui: success card title (2–4 words)
  result_cue: z.string().nullable(),
  items: z.array(Item).nullable(),
});
export type Shot = z.infer<typeof Shot>;
export const ShotScriptModel = z.object({ theme: z.enum(FLOW_THEMES), shots: z.array(Shot) });
export const ShotScript = ShotScriptModel.extend({ version: z.literal(3).default(3) });
export type ShotScript = z.infer<typeof ShotScript>;

// ── expansion ──
const EMPTY_CONTENT: SceneContent = { title: null, subtitle: null, value: null, label: null, status: null, name: null, amount: null, delta: null, note: null, action: null, date: null, items: null };
const content = (c: Partial<SceneContent>): SceneContent => ({ ...EMPTY_CONTENT, ...c });
const beat = (b: Partial<SceneBeat> & Pick<SceneBeat, "cue" | "action">): SceneBeat => ({
  elements: null, targets: null, to: null, layout: null, camera: null, transition: null, backdrop: null, style: null, content: null, text: null, accent: null, text_layout: null, items: null, lottie: null, ...b,
});
const el = (id: string, asset: string, label: string | null = null, c: SceneContent | null = null): SceneElement => ({ id, asset, label, screen: null, content: c });
// A second moment inside a shot lands on the cue's last word (a beat on the
// very same cue would be dropped as a duplicate).
const lastWord = (cue: string) => {
  const w = cue.trim().split(/\s+/);
  return w.length > 1 ? w[w.length - 1] : null;
};
const words = (s: string | null | undefined, max: number) => (s ?? "").trim().split(/\s+/).filter(Boolean).slice(0, max).join(" ") || null;

// A picture for an item: icons and visuals as asked; anything else (a brand
// we have no logo for, a made-up icon) becomes a labelled pill, never a
// random stand-in icon.
function picture(asset: string | null | undefined, label: string | null): { asset: string; label: string | null } {
  const ref = parseAsset(asset);
  if (ref?.kind === "visual" || ref?.kind === "shape" || ref?.kind === "object") return { asset: asset!, label };
  if (ref?.kind === "icon" || (asset?.startsWith("icon:") && isIconName(asset.slice(5)))) return { asset: asset!, label };
  const name = label ?? asset?.split(":").pop() ?? "";
  return { asset: "shape:pill", label: words(name, 2) };
}
// A big text object only for a real number or measure ("4K", "3 min", "98%").
const numberText = (asset: string | null | undefined) => {
  const t = asset?.startsWith("text:") ? asset.slice(5).trim() : "";
  return /\d/.test(t) && t.length <= 10 ? t : null;
};

export type ExpandNotes = string[];

// A caption must say what the voice says: every word of 4+ letters is
// spoken (no invented "Download quality").
const spoken = (line: string | null, narration?: string) => {
  if (!line || !narration) return line;
  const said = new Set(narration.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const w = (line.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((x) => x.length >= 4);
  return w.every((x) => said.has(x)) ? line : null;
};
// Cards whose last block is a button (a click needs one to press).
const BUTTON_CARDS = ["action-panel", "login", "checkout", "cta"];

// A variant of the same shots: the look, how shots hand over and how
// subjects enter, drawn from a seed. Without one the default look is kept.
export type ShotVariant = { seed: number };
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function expandShots(script: ShotScript, notes: ExpandNotes = [], narration?: string, variant?: ShotVariant): SceneScript {
  // (the seed is mixed first: neighbouring seeds give unrelated videos)
  const pick = variant ? rng(Math.imul(variant.seed ^ 0x9e3779b9, 0x85ebca6b)) : null;
  const choose = <T,>(fallback: T, options: readonly T[]) => (pick ? options[Math.floor(pick() * options.length)] : fallback);
  const look = variant ? { decor: choose("dots", DECORS), tone: choose("tint", TONES), seed: variant.seed } : null;
  const push = choose("push-left" as const, ["push-left", "push-left", "push-up"] as const);
  // Which side a subject with words beside it stands on (the words take the other).
  const beside = choose("stage-right", ["stage-right", "stage-left"]);
  // A number with its picture: the number first (left) or the picture first.
  const duo = choose("stage-duo", ["stage-duo", "stage-duo-flip"]);
  // How each kind of subject arrives (all calm entrances).
  const enter = {
    problem: choose("rise", ["rise", "scale-up", "pop"]),
    ui: choose("rise", ["rise", "scale-up"]),
    number: choose("pop", ["pop", "scale-up"]),
    object: choose("pop", ["pop", "rise"]),
    reveal: choose("scale-up", ["scale-up", "pop"]),
  };
  const beats: SceneBeat[] = [];
  let scenes = 0;
  let revealed = false;
  let lastUi: string | null = null;
  let n = 0;
  const id = (k: string) => `${k}${++n}`;
  // Calm transitions: a push between most shots, a dissolve into type-free
  // pictures; the first shot cuts in.
  // (A shot in the same layout as the last never dissolves: its subject would
  // fade in on top of the old one, "90%" over "4K" — it pushes the old away.
  // After a full-frame line nothing is left to push, so it dissolves.)
  let lastLayout: string | null = null;
  const scene = (cue: string, elements: SceneElement[], layout: string, style: string | null = null, transition?: "dissolve") => {
    const prev = beats[beats.length - 1];
    const dissolve = (layout !== lastLayout || prev?.text_layout === "display") && (transition ?? (prev?.action === "statement" ? "dissolve" : null));
    beats.push(beat({ cue, action: "scene", elements, layout, style, camera: "static", transition: scenes === 0 ? "cut" : dissolve ? "dissolve" : push, backdrop: scenes === 0 ? "mesh" : null }));
    lastLayout = layout;
    scenes++;
  };
  // swap: a word the accent flips to when the voice says it ("weeks" → "minutes").
  const swapOf = (s: Shot) => {
    const w = s.items?.[0]?.asset?.startsWith("text:") ? words(s.items[0].asset.slice(5), 2) : null;
    return w ? [w] : null;
  };
  const caption = (cue: string, text: string, accent: string | null, mark: "strike" | "pill" | null, swap: string[] | null = null) =>
    beats.push(beat({ cue, action: "statement", text, accent: accent && text.toLowerCase().includes(accent.toLowerCase()) ? accent : null, style: mark, text_layout: "side", items: swap }));

  for (const s of script.shots) {
    const items = (s.items ?? []).filter((i) => i.asset);
    switch (s.shot) {
      case "problem": {
        const p = picture(s.subject ?? "visual:clock", words(s.label, 3));
        const line0 = spoken(words(s.line, 6), narration);
        // With words, the subject goes right and the words sit big on the left.
        scene(s.cue, [el(id("subject"), p.asset, p.label)], line0 ? beside : "stage", enter.problem);
        const line = spoken(words(s.line, 6), narration);
        const at = s.line_cue ?? lastWord(s.cue);
        if (line && at) caption(at, line, s.accent, s.mark === "strike" ? "strike" : null, swapOf(s));
        lastUi = null;
        break;
      }
      case "steps":
      case "outputs": {
        if (s.shot === "outputs" && lastUi && items.length) {
          // The first result(s) lift out on the cue; any with a later cue of
          // their own join the row then.
          // Two results beside the card at most (a third would shrink them all);
          // a later one's words make the card pulse instead, so something
          // still happens on them.
          const outs = items.slice(0, 2).map((i, k) => ({ ...picture(i.asset, words(i.label, 2)), cue: k > 0 ? i.cue : null }));
          beats.push(beat({ cue: s.cue, action: "lift", targets: [lastUi], layout: "stage-duo", style: "rise", elements: outs.filter((o) => !o.cue).map((o) => el(id("out"), o.asset, o.label)) }));
          for (const o of outs.filter((x) => x.cue)) beats.push(beat({ cue: o.cue!, action: "place", layout: "stage-duo", style: "rise", elements: [el(id("out"), o.asset, o.label)] }));
          const extra = items[2]?.cue;
          if (extra) beats.push(beat({ cue: extra, action: "highlight", targets: [lastUi] }));
          lastUi = null;
          break;
        }
        const list = items.slice(0, 4);
        if (!list.length) break;
        // Every step is on screen from the start (faint), so one icon never
        // stands alone in the frame; each lights up on its words with an
        // arrow from the one before (Keka).
        const els = list.map((i) => {
          const p = picture(i.asset, words(i.label, 2));
          return el(id("step"), p.asset, p.label);
        });
        scene(list[0].cue ?? s.cue, els, "stage-row", "steps");
        list.slice(1).forEach((i, k) => {
          if (i.cue) beats.push(beat({ cue: i.cue, action: "activate", targets: [els[k + 1].id], to: els[k].id }));
        });
        lastUi = null;
        break;
      }
      case "group": {
        const list = items.slice(0, 6).map((i) => picture(i.asset, words(i.label, 2)));
        if (!list.length) break;
        // All arrive with the scene, 0.2 s apart, a pop each.
        scene(s.cue, list.map((p) => el(id("g"), p.asset, p.label)), "stage-row", "pop", "dissolve");
        lastUi = null;
        break;
      }
      case "reveal": {
        if (revealed) {
          notes.push("reveal used twice: the second became a line");
          if (s.line) caption(s.cue, words(s.line, 6)!, s.accent, null);
          break;
        }
        revealed = true;
        scene(s.cue, [el(id("logo"), "logo")], "stage", enter.reveal);
        lastUi = null;
        break;
      }
      case "ui": {
        // A click needs a button: cards without one become the action panel.
        const asked = (UI_CARDS as readonly string[]).includes(s.card ?? "") ? s.card! : "action-panel";
        const tpl = s.action_cue && !BUTTON_CARDS.includes(asked) ? "action-panel" : asked;
        const ui = id("ui");
        const button = words(s.button, 3) ?? "Continue";
        scene(s.cue, [el(ui, `card:${tpl}/glass`, null, content({ title: words(s.title, 4), note: words(s.input, 8), label: null, action: button }))], "stage", enter.ui);
        if (s.action_cue) beats.push(beat({ cue: s.action_cue, action: "click", targets: [ui], content: content({ title: words(s.title, 4), note: words(s.input, 8), action: pressed(button) }) }));
        const result = words(s.result, 4);
        // The success card only when no outputs follow (card + result + 2
        // outputs would crowd the frame).
        const outputsNext = script.shots[script.shots.indexOf(s) + 1]?.shot === "outputs";
        if (result && s.result_cue && !outputsNext) beats.push(beat({ cue: s.result_cue, action: "place", layout: "stage-duo", style: "pop", elements: [el(id("done"), "card:success-toast/solid", null, content({ title: result, subtitle: null }))] }));
        lastUi = ui;
        break;
      }
      case "number": {
        const first = numberText(s.subject);
        if (!first) {
          // Not a number ("HERO", "minutes"): shown as a line instead.
          notes.push(`number shot without a number (${s.subject ?? "none"}): shown as a line`);
          const line = words(s.line, 6) ?? words(s.subject?.replace(/^text:/, ""), 4);
          if (line) beats.push(beat({ cue: s.cue, action: "statement", text: line, accent: s.accent, text_layout: "display" }));
          break;
        }
        const num = id("num");
        // A number never stands alone: the picture of what it measures sits beside it.
        const about = `${s.cue} ${s.line ?? ""}`.toLowerCase();
        const companion = /download|export|save/.test(about) ? "visual:download" : /minute|hour|second|time|fast|day/.test(about) ? "visual:clock" : /%|grow|more|sales|revenue|x\b/.test(about) ? "visual:bars" : /\d+(p|k)\b|video|hd/.test(about) ? "visual:play" : null;
        scene(s.cue, companion ? [el(num, `text:${first}`), el(id("pic"), companion)] : [el(num, `text:${first}`)], companion ? duo : "stage", enter.number);
        const line = spoken(words(s.line, 5), narration);
        const at = s.line_cue ?? lastWord(s.cue);
        if (line && at) caption(at, line, null, null);
        for (const i of items.slice(0, 3)) {
          const next = numberText(i.asset);
          if (next && i.cue) beats.push(beat({ cue: i.cue, action: "update", targets: [num], content: content({ value: next }) }));
        }
        lastUi = null;
        break;
      }
      case "line": {
        const line = words(s.line, 6);
        // A line with a 3D object: the words big on the left, the object on the right.
        if (line && parseAsset(s.subject)?.kind === "object") {
          scene(s.cue, [el(id("obj"), s.subject!)], beside, enter.object);
          beats.push(beat({ cue: s.cue, action: "statement", text: line, accent: s.accent, style: s.mark === "pill" ? "pill" : null, text_layout: "side", items: swapOf(s) }));
          lastUi = null;
          break;
        }
        // Two lines in a row saying the same words: only the second is shown.
        const next = script.shots[script.shots.indexOf(s) + 1];
        const shared = next?.shot === "line" && line && next.line ? line.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && next.line!.toLowerCase().includes(w)).length : 0;
        if (shared >= 2) {
          notes.push(`line "${line}" repeats the next line: dropped`);
          break;
        }
        if (line) beats.push(beat({ cue: s.cue, action: "statement", text: line, accent: s.accent, style: s.mark === "pill" ? "pill" : null, text_layout: "display", items: swapOf(s) }));
        break;
      }
    }
  }
  return SceneScript.parse({ version: 2, theme: script.theme, pace: "calm", style: "explainer", beats, look });
}

// "Generate" → "Generating…"; other buttons show a tick.
const pressed = (b: string) => (/^[A-Za-z]+e$/.test(b) ? `${b.slice(0, -1)}ing…` : /^[A-Za-z]+$/.test(b) ? `${b}ing…` : `✓ ${b}`);

export const shotCatalogText = () =>
  SHOT_KINDS.map((k) => `- ${k}: ${SHOT_CATALOG[k]}`).join("\n") + `\n\nui cards: ${UI_CARDS.join(", ")}`;
