// The clean explainer's rulebook: every problem seen in a rendered video, the
// rule that now prevents it and how it was solved. A rule is kept by code
// (the engine cannot do it any more), checked (`npm run check:clean` fails
// when it is broken) and/or reviewed (looked for on every proof render).
// New rules are added only after the problem and the fix have been agreed.

export type CleanRule = {
  id: string;
  problem: string; // what went wrong, where it was seen
  rule: string; // the rule, as a "never …" / "always …" line
  fix: string; // how it was solved
  kept: ("code" | "check" | "review")[];
};

export const CLEAN_RULES: CleanRule[] = [
  {
    id: "camera-crop",
    problem: "Camera zoom cut text and cards at the frame's edge (Flowly proof, push/zoom cameras).",
    rule: "Never let the camera push content out of frame: zoom stays small (0.88–1.13 in total, pan ≤ 90 px), centred on the frame.",
    fix: "Camera moves cut to 0.9–1.06 (plus a 3.5% punch-in and a 6% push on a zoom cue), transform origin at the centre.",
    kept: ["code", "check"],
  },
  {
    id: "half-scenes",
    problem: "Two scenes were half-visible at once during cross-fades.",
    rule: "Always one scene at a time: the old one goes in its last 6 frames, the new one comes in over 10 frames from 2 frames before its cut.",
    fix: "Sequential transitions (OUTF 6 / IN 10 / LEAD_IN 2); scenes are contiguous, no overlap.",
    kept: ["code", "check"],
  },
  {
    id: "caption-across-stop",
    problem: "A caption joined the end of one sentence with the start of the next.",
    rule: "Never run a caption across a full stop: captions are 2–4 words and break at every stop.",
    fix: "captionGroups ends a group on a stop token or a word ending in . , ! ?",
    kept: ["code", "check"],
  },
  {
    id: "overlay-hides-key",
    problem: "A payment notification covered the balance it was talking about.",
    rule: "Never let an overlay (toast, badge, cursor) hide the key number or word of the moment.",
    fix: "Toasts placed beside the value with an arrow to it; the key value is highlighted, not covered.",
    kept: ["review"],
  },
  {
    id: "effect-text-legible",
    problem: "Scattered-letter text effect made letters overlap and become unreadable.",
    rule: "Never let a text effect make words unreadable: letters never overlap, the word ends sharp and level.",
    fix: "Words move as whole words (blur → sharp, small rise); no per-letter scatter.",
    kept: ["code", "review"],
  },
  {
    id: "cursor-miss",
    problem: "The cursor clicked below the button.",
    rule: "Always land the cursor's tip inside the target it clicks.",
    fix: "Cursor paths end on the target's measured centre; the press ring is drawn at the tip.",
    kept: ["review"],
  },
  {
    id: "early-element",
    problem: "A ring/element appeared before the voice said its word.",
    rule: "Never show a word or its visual before it is spoken (2 frames of lead at most).",
    fix: "Every word and cue is placed from the voice's word timings (kw/at); cues lie inside their scene.",
    kept: ["code", "check"],
  },
  {
    id: "text-over-elements",
    problem: "A long line of text ran over icons.",
    rule: "Never let text run over cards or icons: text sits in its own bounded column or band.",
    fix: "Text blocks get a max width and their own area; elements are placed outside it.",
    kept: ["review"],
  },
  {
    id: "small-subject",
    problem: "The main visual (cards) was too small to read.",
    rule: "Always make the subject big: the hero card or visual fills a large part of the frame.",
    fix: "Cards and tiles enlarged; the camera pushes in on the moment.",
    kept: ["review"],
  },
  {
    id: "asset-type-swap",
    problem: "An icon/visual slot was filled with a text card.",
    rule: "Never replace an icon or visual with a text card: the asset type must match the slot.",
    fix: "Asset selection guard (TEXT_FREE kinds cannot become card:*); a missing asset is reported as fallback.",
    kept: ["code", "check"],
  },
  {
    id: "support-placement",
    problem: "A supporting object went out of frame or sat over the hero.",
    rule: "Never place a supporting object outside the frame or over the hero.",
    fix: "Placement check: support stays inside the safe area and clear of the hero (fillsFrame / slot checks).",
    kept: ["code", "check"],
  },
  {
    id: "split-voice-words",
    problem: "The voice transcript split a word into pieces (\"sa\" \"les\"), so the word could not be found.",
    rule: "Always match script words to the voice even when a word is split into pieces or punctuation is its own token.",
    fix: "findPhrase joins up to three consecutive voice tokens to match one script word.",
    kept: ["code", "check"],
  },
];

export const CLEAN_RULE_BY_ID = Object.fromEntries(CLEAN_RULES.map((r) => [r.id, r]));

// Problems seen but not solved yet, and rules proposed but not yet agreed.
// Each moves into CLEAN_RULES once it is fixed and the user approves.
export type OpenItem = { id: string; seen: string; problem: string; plan: string; status: "open" | "proposed" };
export const CLEAN_OPEN: OpenItem[] = [
  {
    id: "too-brief",
    seen: "Films 1 (Glow) and 2 (Dusk), user review 2026-10-03",
    problem: "Icons and cards are on screen too briefly: one comes and goes before it can be seen (e.g. the trio slabs, the tokens, the circuit cards, the receipt, the team rows).",
    plan: "Give every card/icon a minimum time fully visible (about 1 s) before its shot leaves; measure it per element on the render; where the sentence is too short, show fewer things or keep them into the next shot instead of cutting them.",
    status: "open",
  },
  {
    id: "short-shot",
    seen: "Film 2 (Dusk): a shot of 3 frames when cuts were computed from the words",
    problem: "A shot can collapse to a few frames.",
    plan: "Rule: no shot shorter than 16 frames (IN + OUT); check:clean checks it.",
    status: "proposed",
  },
  {
    id: "bg-flip",
    seen: "Film 2 (Dusk): a grey frame (slow blend) and then a flash (3-frame flip) between dark and light",
    problem: "Dark ↔ light background changes show a grey frame or flash.",
    plan: "Rule: a dark ↔ light change is a band of light that rises across the frame (done in Dusk).",
    status: "proposed",
  },
  {
    id: "frame-jump",
    seen: "Films 1–2: whole scenes vanished in 3–6 frames, cards popped from nothing (jumps of 62 and 194)",
    problem: "Cards and icons pop in, scenes vanish at once.",
    plan: "Rule: things ease in (no pop from nothing), shots blur away over 12+ frames; a render's frame-to-frame jump stays at or under 25.",
    status: "proposed",
  },
];
