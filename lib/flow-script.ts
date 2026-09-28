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
  "title", // a short kinetic line of text
] as const;
export type FlowAction = (typeof FLOW_ACTIONS)[number];

const Row = z.object({ icon: z.string(), text: z.string(), value: z.string().nullable(), status: z.string().nullable() });
export const FlowBeat = z.object({
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
export type FlowBeat = z.infer<typeof FlowBeat>;
export const FlowScript = z.object({ theme: z.enum(["lavender", "midnight"]), beats: z.array(FlowBeat) });
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
        need(ui, i, "needs a ui_showcase before it");
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
      case "title":
        need(b.text && words(b.text) <= 8, i, "title text of at most 8 words");
        break;
    }
    if (b.label && words(b.label) > 3) errors.push(`beat ${i}: label "${b.label}" is longer than 3 words`);
    for (const n of [b.icon, b.packet_icon]) if (n && !isIconName(n)) errors.push(`beat ${i}: unknown icon "${n}"`);
  });
  return errors;
}
