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
  { id: "story", label: "Hook", help: "A hook (the viewer's pain or a question) in the first 3 s. The rest of the order comes from the story shape.", on: true, text: "STORY: open on the viewer's pain or a question in the first 3 s. After it, the video follows its story shape (the shape decides the order — no fixed problem → product → steps order)." },
  { id: "frame", label: "Frame", help: "One hero element, no text over it, only 2–6 key words on screen.", on: true, text: "FRAME: one hero per frame — the biggest and brightest; no text on top of it (the words beside it, or as its label). On screen only 2–6 key words the voice says, never the sentence." },
  { id: "motion", label: "Motion & colour", help: "UI springs in, things that come in together stagger 50–100 ms, the camera always moves slowly; only spin and excessive bounce are banned. The brand colour and one harmonious accent; glow on dark backgrounds, soft shadows and glass on light ones; animated mesh, gradient, grain or grid backgrounds, calm behind the words.", on: true, text: "MOTION: the product's UI springs in; things that come in together stagger 50–100 ms apart; the camera always drifts, pushes or moves in parallax — slowly. Never spin, never an excessive bounce. Only the subject the voice is talking about moves; one main movement at a time (the camera aside). COLOUR: the brand colour (from its logo) and one harmonious accent; glow is fine on a dark background, soft shadows and glass on a light one. One font family for the headlines. BACKGROUND: an animated mesh, gradient, grain or grid is fine — calm behind the words." },
  { id: "no_people", label: "No people", help: "No people, faces, hands or animals.", on: true, text: "Never people, faces, hands or animals (in icons, things or pictures)." },
  { id: "never_list", label: "Team \"never\" list", help: "The never list from the Video rules page (the new version's own changes to it applied).", on: true, text: "" },
  { id: "max_items", label: "Hero + up to 4", help: "One hero and up to 3–4 things beside it; a staggered list or a row counts as one group (a badge aside).", on: true, text: "One hero and up to 3–4 supporting things per scene (a staggered list or a row of icons counts as one group; a badge aside)." },
  { id: "entries", label: "3 entry types", help: "At most 3 kinds of way into a scene in the whole video.", on: false, text: "At most 3 kinds of way into a scene in the whole video." },
  { id: "one_background", label: "One background", help: "One background; dark ↔ light changes at most once.", on: false, text: "One background for the whole video; dark ↔ light changes at most once." },
  { id: "calm_background", label: "No busy backgrounds", help: "No beams, streaks or particles.", on: false, text: "No busy backgrounds: no beams, streaks or particles." },
  { id: "layout_variety", label: "Layout variety", help: "Never the same layout twice in a row, at most twice per video. A kinetic-type video may set words-only scenes one after another.", on: true, text: "Never the same layout twice in a row, and no layout more than twice in a video (the closing ask aside). A kinetic-type story may set words-only scenes (layout type) one after another." },
  { id: "min_scene", label: "Scenes at least 3 s", help: "Every scene at least 3 s. Off: a scene follows the voice's phrase, at least 1.5 s.", on: false, text: "Every scene is at least 3 s of speech: a short sentence joins its neighbour." },
  { id: "taste", label: "Taste", help: "Font use and a premium look.", on: true, text: "TASTE: condensed faces (oswald, bebas-neue, anton, big-shoulders-display) only in upper case; serif faces in sentence case; wide faces (unbounded, krona-one, dela-gothic-one) smaller. Premium: generous space, a clear hierarchy (the words, then the thing), every detail specific to THIS brand. Abstract glass or geometric 3D shapes are fine (never an emoji or a mascot)." },
  { id: "flow", label: "Continuous transitions", help: "An icon morphing into the next scene's hero icon, a zoom through an icon into the next scene, a scene shrinking into the next scene's icon — on 30 / 40 / 50 %+ of scene changes (calm / medium / lively energy). The rest slide, mask-wipe or fade; never a plain cut.", on: true, text: "" },
  { id: "camera", label: "Camera per scene", help: "Every scene its own slow camera move (drift, push, pull, rise, orbit…), never still, never the same twice in a row.", on: true, text: "CAMERA: every scene its own slow move — set camera on every scene (never still, never the same twice in a row)." },
  { id: "depth", label: "Depth", help: "Glass and softly lifted cards, soft shadows; background, things and words on 2–3 layers moving in parallax.", on: true, text: "DEPTH: cards are glass or softly lifted, with soft shadows; the background, the things and the words sit on 2–3 layers that move in parallax." },
  { id: "keyword", label: "Keyword highlight", help: "Every scene's key word lit in the brand colour or on a pill.", on: true, text: "KEYWORD: 1–2 key words per scene (key), lit in the brand colour or on a pill." },
  { id: "cursor", label: "Big cursor", help: "A big cursor goes to the thing the voice names and clicks it once per chapter (about three scenes); every click changes something on screen.", on: true, text: "CURSOR: a big cursor clicks once a chapter (about three scenes) on the scene's main thing, and its moment (hit) happens on the click — give clickable things (a button, a card, a list) a hit. Never place cursor items yourself." },
] as const;
export type V2RuleId = (typeof V2_RULES)[number]["id"];
export const v2RuleKey = (id: V2RuleId) => `v2_rule_${id}`;

const ALWAYS = "ALWAYS: never show a number or claim the voice does not say; UI rows specific to THIS product, never placeholder data; no music (sound effects only on what is seen: a whoosh, a pop, a click); the video lasts as long as the voice plus a 2–3 s logo ending.";
const PHRASE_SCENES = "Scene length follows the voice: a scene is one spoken phrase, at least 1.5 s.";
// the shortest scene (frames, 30 fps) and the most words on screen
const PHRASE_MIN = 45;
export const V2_SHOWN = 6;

// flow: which parts of the premium motion are on (composer/flow.ts)
export type V2Flow = { continuous: boolean; camera: boolean; depth: boolean; keyword: boolean; cursor: boolean };
export type V2Rules = { on: Record<V2RuleId, boolean>; ruleSet: RuleSet; checks: V2Checks; flow: V2Flow; text: (never: string | null | undefined) => string };

export function v2RulesOf(settings: Record<string, unknown>): V2Rules {
  const master = settings[V2_RULES_MASTER] !== false;
  const on = Object.fromEntries(V2_RULES.map((r) => [r.id, master && (typeof settings[v2RuleKey(r.id)] === "boolean" ? settings[v2RuleKey(r.id)] === true : r.on)])) as Record<V2RuleId, boolean>;
  const ruleSet: RuleSet = {
    // (one hero and up to 4 beside it; icons and a card may share a scene)
    house: { maxItems: on.max_items, maxCount: 5, entries: on.entries, oneBackground: on.one_background, calmBackground: on.calm_background, noIconCardMix: false },
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
  const flow: V2Flow = { continuous: on.flow, camera: on.camera, depth: on.depth, keyword: on.keyword, cursor: on.cursor };
  return { on, ruleSet, checks, flow, text };
}
