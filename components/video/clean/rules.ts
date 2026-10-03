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
  {
    id: "short-shot",
    problem: "A shot collapsed to 3 frames when the cuts were computed from the voice's words (film Dusk).",
    rule: "Never make a shot shorter than 16 frames (its way in plus its way out).",
    fix: "The films' cuts sit a few frames before the sentence's word; check:clean measures every shot of every film on two scripts.",
    kept: ["check"],
  },
  {
    id: "bg-flip",
    problem: "A dark ↔ light background change showed a flat grey frame (slow colour blend), then a flash (3-frame flip) (film Dusk).",
    rule: "Never blend or flip a dark background into a light one: the light comes in as a soft band rising across the frame.",
    fix: "DuskBg draws both fields and reveals the light one through a moving gradient mask, linear over 24 frames around the cut.",
    kept: ["code", "review"],
  },
  {
    id: "frame-jump",
    problem: "Whole scenes vanished in 3–6 frames and cards popped from nothing (films Glow and Dusk: frame jumps of 62 and 194).",
    rule: "Never pop a card or icon in from nothing or drop a scene at once: things ease in from slightly smaller, shots blur away over 12+ frames; on the render a frame-to-frame change stays at or under 25.",
    fix: "appear()/grow() ease-ins (no overshoot), Shot in 16 / out 12 frames (longer for big bright panels); scripts/clean-check/frame-jumps.py measures a render.",
    kept: ["code", "review"],
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
];
