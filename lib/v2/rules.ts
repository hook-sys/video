import { extraRules } from "@/lib/ai/house-rules";
import type { V2Checks } from "@/lib/ai/motion-director";
import { MIN_SCENE } from "@/components/video/composer/layout";
import type { RuleSet } from "@/components/video/composer/variants";

// "New version" video rules (admin → Settings, "New version: video rules"):
// a master switch and one switch per rule. A rule that is on is written into
// the Director's instructions and, where it can be, kept in code (the
// Composer, the review's checks); a rule that is off is in neither.
// Honesty (no number or claim the voice does not say, no placeholder data),
// the renderer's limits and no music are always on.

export const V2_RULES_MASTER = "v2_rules";
// the Director's own choices in the new version (admin → Settings, "New version: Director")
export const V2_DIRECTOR = [
  { key: "v2_story_shapes", label: "Story shapes", help: "Every video told in its own shape (problem-led, demo-first, before-after, feature-led, kinetic type), the one its script supports best and unlike this customer's last videos; the scenes are checked against it. Off: told the classic way." },
  { key: "v2_director_motion", label: "Director's transitions", help: "The Director chooses each scene's way in (within the video's look), how its words come in and its camera move. Off: the renderer draws them." },
  { key: "v2_visual_match", label: "Visual match", help: "Every scene's things picture what its words say (bookings → a calendar, payments → a pay card…): the Director is given the map, every video is checked against it, icons that don't fit are swapped." },
] as const;
export const v2DirectorOf = (settings: Record<string, unknown>) => ({ shapes: settings.v2_story_shapes !== false, motion: settings.v2_director_motion !== false, match: settings.v2_visual_match !== false });
export const V2_RULES = [
  { id: "story", label: "Story", help: "A hook (the problem or a question) in the first 3 s; problem → product → 2–3 steps → result → call to action.", on: true, text: "STORY: open on the viewer's pain or a question in the first 3 s. Structure: the problem → the product arrives → how it works in 2–3 steps → the result → the call to action." },
  { id: "frame", label: "Frame", help: "One hero element, no text over it, only 2–6 key words on screen.", on: true, text: "FRAME: one hero per frame — the biggest and brightest; nothing behind or over it and no text on top of it (the words beside it, or as its label). On screen only 2–6 key words the voice says, never the sentence." },
  { id: "motion", label: "Motion & look", help: "Only the spoken subject moves, soft entries, the brand colour from the logo, one font family.", on: true, text: "MOTION AND LOOK: only the subject the voice is talking about moves; one main movement at a time. Things come in softly (rise, fade, pop) — never spin, bounce, flip or drop in. Colours: the brand colour (from its logo) and neutrals. One font family for the headlines." },
  { id: "no_people", label: "No people", help: "No people, faces, hands or animals.", on: true, text: "Never people, faces, hands or animals (in icons, things or pictures)." },
  { id: "never_list", label: "Team \"never\" list", help: "The never list from the Video rules page.", on: true, text: "" },
  { id: "max_items", label: "2–3 elements per scene", help: "At most 2–3 elements in a scene (a badge aside).", on: true, text: "At most 2–3 things per scene (a badge aside): one focal point, big." },
  { id: "entries", label: "3 entry types", help: "At most 3 kinds of way into a scene in the whole video.", on: false, text: "At most 3 kinds of way into a scene in the whole video." },
  { id: "one_background", label: "One background", help: "One background; dark ↔ light changes at most once.", on: false, text: "One background for the whole video; dark ↔ light changes at most once." },
  { id: "calm_background", label: "No busy backgrounds", help: "No beams, streaks or particles.", on: false, text: "No busy backgrounds: no beams, streaks or particles." },
  { id: "layout_variety", label: "Layout variety", help: "Never the same layout twice in a row, at most twice per video.", on: true, text: "Never the same layout twice in a row, and no layout more than twice in a video (the closing ask aside)." },
  { id: "min_scene", label: "Scenes at least 3 s", help: "Every scene at least 3 s. Off: a scene follows the voice's phrase, at least 1.5 s.", on: false, text: "Every scene is at least 3 s of speech: a short sentence joins its neighbour." },
  { id: "taste", label: "Taste", help: "Font use, a premium look, never icons and cards in one scene.", on: true, text: "TASTE: condensed faces (oswald, bebas-neue, anton, big-shoulders-display) only in upper case; serif faces in sentence case; wide faces (unbounded, krona-one, dela-gothic-one) smaller. Premium: generous space, a clear hierarchy (the words, then the thing), every detail specific to THIS brand. Never icons and a card in one scene: a scene shows a card (or a phone or laptop showing one) or icons — not both." },
] as const;
export type V2RuleId = (typeof V2_RULES)[number]["id"];
export const v2RuleKey = (id: V2RuleId) => `v2_rule_${id}`;

const ALWAYS = "ALWAYS: never show a number or claim the voice does not say; UI rows specific to THIS product, never placeholder data; no music.";
const PHRASE_SCENES = "Scene length follows the voice: a scene is one spoken phrase, at least 1.5 s.";
// the shortest scene (frames, 30 fps) and the most words on screen
const PHRASE_MIN = 45;
export const V2_SHOWN = 6;

export type V2Rules = { on: Record<V2RuleId, boolean>; ruleSet: RuleSet; checks: V2Checks; text: (never: string | null | undefined) => string };

export function v2RulesOf(settings: Record<string, unknown>): V2Rules {
  const master = settings[V2_RULES_MASTER] !== false;
  const on = Object.fromEntries(V2_RULES.map((r) => [r.id, master && (typeof settings[v2RuleKey(r.id)] === "boolean" ? settings[v2RuleKey(r.id)] === true : r.on)])) as Record<V2RuleId, boolean>;
  const ruleSet: RuleSet = {
    house: { maxItems: on.max_items, entries: on.entries, oneBackground: on.one_background, calmBackground: on.calm_background, noIconCardMix: on.taste },
    layoutVariety: on.layout_variety,
    fit: { minScene: on.min_scene ? MIN_SCENE : PHRASE_MIN, shown: V2_SHOWN },
  };
  const checks: V2Checks = { rules: ruleSet, noPeople: on.no_people, minSeconds: on.min_scene ? 3 : 1.5, shown: V2_SHOWN };
  const text = (never: string | null | undefined) => {
    const lines = V2_RULES.filter((r) => on[r.id] && r.text).map((r) => `- ${r.text}`);
    if (!on.min_scene) lines.push(`- ${PHRASE_SCENES}`);
    const team = on.never_list ? extraRules(never) : "";
    return `RULES (this video keeps them)\n${lines.join("\n")}\n- ${ALWAYS}${team}`;
  };
  return { on, ruleSet, checks, text };
}
