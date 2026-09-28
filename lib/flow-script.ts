import { z } from "zod";
import { isIconName, resolveIcon } from "@/components/video/icons";
import LOTTIE_MANIFEST from "@/components/video/lottie/manifest.json";
import { searchIcons } from "@/lib/icons";
import { spokenCueTimes, tokenize, type WordTiming } from "@/lib/voice-timing";

// FlowScript: what the Visual Director writes for the Flow engine. Beats are
// motion patterns anchored to spoken phrases; the compiler
// (components/video/flow/compile.ts) turns them into keyframes on the voice's
// real timeline. No frames, coordinates or styling here.

export const FLOW_ACTIONS = [
  "hero_enter", // the persistent subject appears (icon + short label)
  "hero_morph", // the subject becomes something else (new icon/label)
  "actor_enter", // someone/something arrives and connects to the subject
  "add_step", // the next step joins a chain, a packet travels to it
  "confirm", // a node completes: ring fills, success badge
  "ui_showcase", // the product UI in 3D: rows, a click, callouts
  "iris_to_hub", // the UI closes through a circle into the hub
  "orbit", // satellites spiral out and circle the subject
  "converge", // everything flows back into the subject
  "celebrate", // a Lottie accent at the subject (or a node)
  "statement", // the narration's key phrase as big kinetic type, word-synced
  "list", // 3–5 short spoken items as a rolling checklist
  "title", // (older scripts) the closing line; compiled like a statement
] as const;
export const STATEMENT_LAYOUTS = ["display", "side", "pill", "panel"] as const;
export const FLOW_THEMES = ["lavender", "midnight", "mint", "teal"] as const;
export type FlowAction = (typeof FLOW_ACTIONS)[number];

const Row = z.object({ icon: z.string(), text: z.string(), value: z.string().nullable(), status: z.string().nullable() });
const FlowBeat = z.object({
  cue: z.string(),
  action: z.enum(FLOW_ACTIONS),
  id: z.string().nullable(), // new actor/step/satellite id, or the node a confirm/celebrate targets
  icon: z.string().nullable(),
  label: z.string().nullable(),
  packet_icon: z.string().nullable(),
  ui: z
    .object({
      title: z.string(),
      rows: z.array(Row),
      callouts: z.array(z.object({ text: z.string(), icon: z.string() })),
      click_row: z.number().int().nullable(),
    })
    .nullable(),
  satellites: z.array(z.object({ id: z.string(), icon: z.string(), label: z.string().nullable() })).nullable(),
  text: z.string().nullable(),
  accent: z.string().nullable(),
  lottie: z.string().nullable(),
});
// What the model returns: every field present (structured outputs are strict).
export const FlowBeatModel = FlowBeat.extend({ layout: z.enum(STATEMENT_LAYOUTS).nullable(), items: z.array(z.string()).nullable() });
export const FlowScriptModel = z.object({ theme: z.enum(FLOW_THEMES), beats: z.array(FlowBeatModel) });
// What is stored/compiled: `layout` and `items` may be missing in scripts stored earlier.
export const FlowBeatStored = FlowBeat.extend({ layout: z.enum(STATEMENT_LAYOUTS).nullable().default(null), items: z.array(z.string()).nullable().default(null) });
export type FlowBeat = z.infer<typeof FlowBeatStored>;
export const FlowScript = z.object({ theme: z.enum(FLOW_THEMES), beats: z.array(FlowBeatStored) });
export type FlowScript = z.infer<typeof FlowScript>;

export const MAX_BEATS = 14;
export const MAX_STEPS = 4;

// Evenly paced word timeline when the voice has no timestamps.
export function estimateWords(narration: string, durationSeconds: number): WordTiming[] {
  const words = narration.split(/\s+/).filter(Boolean);
  const per = (durationSeconds * 0.92) / Math.max(1, words.length);
  return words.map((text, i) => ({ text, start: 0.25 + i * per, end: 0.25 + (i + 1) * per }));
}

// Deterministic repairs that never change the story: unknown icons become the
// closest library icon, unknown Lottie names the default celebration, and
// lists are capped.
export function repairFlowScript(script: FlowScript): FlowScript {
  const icon = (name: string | null, fallback = "sparkles") => {
    if (!name) return name;
    return resolveIcon(name) ?? searchIcons(name.replace(/[-_]/g, " "), 1)[0] ?? fallback;
  };
  return {
    ...script,
    beats: script.beats.slice(0, MAX_BEATS).map((b) => ({
      ...b,
      icon: icon(b.icon),
      packet_icon: icon(b.packet_icon),
      ui: b.ui && {
        ...b.ui,
        rows: b.ui.rows.slice(0, 6).map((r) => ({ ...r, icon: icon(r.icon, "circle-dot")! })),
        callouts: b.ui.callouts.slice(0, 2).map((c) => ({ ...c, icon: icon(c.icon)! })),
      },
      satellites: b.satellites && b.satellites.slice(0, 6).map((s) => ({ ...s, icon: icon(s.icon)! })),
      items: b.items && b.items.map((x) => x.trim()).filter(Boolean).slice(0, 5),
      lottie: b.lottie === null ? null : b.lottie in LOTTIE_MANIFEST ? b.lottie : "confetti-burst",
    })),
  };
}

const words = (s: string | null) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

// Blocking problems (the renderer would show something wrong or out of sync).
export function flowScriptBlockers(script: FlowScript, narration: string, voiceWords?: WordTiming[] | null, durationSeconds = 15): string[] {
  const errors: string[] = [];
  const beats = script.beats;
  if (beats.length < 3) errors.push(`only ${beats.length} beats; direct at least 3`);
  if (beats.length > MAX_BEATS) errors.push(`${beats.length} beats; at most ${MAX_BEATS}`);
  const timeline = voiceWords?.length ? voiceWords : estimateWords(narration, durationSeconds);
  const times = spokenCueTimes(beats.map((b) => b.cue), timeline);
  times.forEach((t, i) => {
    if (t === null) errors.push(`beat ${i} cue "${beats[i].cue}" is not spoken in order (copy words exactly from the narration)`);
  });
  if (!tokenize(narration).length) errors.push("empty narration");

  // Pacing: the picture keeps moving with the voice from start to finish.
  if (!beats.some((b) => b.action === "statement" || b.action === "title")) errors.push("no statement: put the narration's key phrase on screen with at least one statement");
  const spoken = times.map((t) => t ?? -1);
  const speechEnd = timeline[timeline.length - 1]?.end ?? durationSeconds;
  for (let i = 1; i < beats.length; i++) {
    if (spoken[i] < 0 || spoken[i - 1] < 0) continue;
    const gap = spoken[i] - spoken[i - 1];
    // A UI showcase animates internally (tilt, click, callouts); a statement holds the frame.
    // A UI showcase and a list keep moving internally (tilt, click, items).
    const held = ["ui_showcase", "list"].includes(beats[i - 1].action) ? 7 : beats[i - 1].action === "statement" ? 4 : 3;
    if (gap > held) errors.push(`${gap.toFixed(1)} s between beat ${i - 1} and beat ${i} with nothing new on screen; add a beat in between (max ${held} s)`);
    if (beats[i - 1].action === "ui_showcase" && gap < 1.6) errors.push(`beat ${i - 1} (ui_showcase) gets only ${gap.toFixed(1)} s; the interface needs at least 1.6 s — cue the next beat later`);
  }
  const lastI = beats.length - 1;
  if (lastI >= 0 && spoken[lastI] >= 0 && !["statement", "title", "converge", "list"].includes(beats[lastI].action) && speechEnd - spoken[lastI] > 3)
    errors.push(`the last ${(speechEnd - spoken[lastI]).toFixed(1)} s have no beat; direct the ending (a statement or converge near the end)`);
  const first = beats[0]?.action;
  if (first && !["hero_enter", "actor_enter", "ui_showcase", "title"].includes(first)) errors.push(`the first beat must establish the scene (hero_enter, actor_enter or ui_showcase), not ${first}`);

  let hero = false;
  let ui = false;
  let steps = 0;
  const ids = new Set<string>(["hero"]);
  const need = (cond: unknown, i: number, what: string) => {
    if (!cond) errors.push(`beat ${i} (${beats[i].action}): ${what}`);
  };
  beats.forEach((b, i) => {
    // The UI stays on stage only until the next beat, which either closes it
    // through the iris or replaces it.
    const uiOpen = ui;
    const floats = b.action === "statement" && b.layout === "pill";
    if (b.action !== "iris_to_hub" && !floats) ui = false;
    const fresh = (id: string | null) => {
      need(id, i, "needs a new id");
      if (id && ids.has(id)) errors.push(`beat ${i}: id "${id}" is already used`);
      if (id) ids.add(id);
    };
    switch (b.action) {
      case "hero_enter":
        need(!hero, i, "the subject already entered; use hero_morph");
        need(b.icon, i, "needs an icon");
        hero = true;
        break;
      case "hero_morph":
        need(hero, i, "the subject must enter first");
        need(b.icon, i, "needs the new icon");
        break;
      case "actor_enter":
        fresh(b.id);
        need(b.icon, i, "needs an icon");
        break;
      case "add_step":
        need(hero, i, "the subject must enter before steps are added");
        fresh(b.id);
        need(b.icon, i, "needs an icon");
        steps++;
        need(steps <= MAX_STEPS, i, `at most ${MAX_STEPS} steps`);
        break;
      case "confirm":
      case "celebrate":
        need(hero || ids.size > 1, i, "nothing to target yet");
        if (b.id) need(ids.has(b.id), i, `unknown target "${b.id}"`);
        break;
      case "ui_showcase":
        need(b.ui, i, "needs ui");
        if (b.ui) {
          need(b.ui.rows.length >= 2 && b.ui.rows.length <= 6, i, "ui needs 2–6 rows");
          if (b.ui.click_row !== null) need(b.ui.click_row >= 0 && b.ui.click_row < b.ui.rows.length, i, "click_row must be a row index");
        }
        ui = true;
        break;
      case "iris_to_hub":
        need(uiOpen, i, "must directly follow a ui_showcase");
        need(b.icon, i, "needs the hub icon");
        hero = true;
        ui = false;
        break;
      case "orbit":
        need(hero, i, "the subject must enter first");
        need(b.satellites && b.satellites.length >= 2 && b.satellites.length <= 6, i, "needs 2–6 satellites");
        for (const s of b.satellites ?? []) fresh(s.id);
        break;
      case "converge":
        need(hero, i, "the subject must enter first");
        break;
      case "statement":
      case "title":
        need(b.text && words(b.text) <= 10, i, "text of at most 10 words");
        break;
      case "list":
        need(b.items && b.items.length >= 3 && b.items.length <= 5, i, "needs 3–5 items");
        for (const x of b.items ?? []) if (words(x) > 4) errors.push(`beat ${i}: list item "${x}" is longer than 4 words`);
        break;
    }
    if (b.label && words(b.label) > 3) errors.push(`beat ${i}: label "${b.label}" is longer than 3 words`);
    for (const n of [b.icon, b.packet_icon]) if (n && !isIconName(n)) errors.push(`beat ${i}: unknown icon "${n}"`);
  });
  return errors;
}
