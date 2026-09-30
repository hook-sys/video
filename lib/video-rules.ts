// The "never do this" rulebook for video composition, collected from every
// video tested so far. Each rule is:
//   - told to the Director (the prompt's NEVER list),
//   - blocked in code where it can be ("code"), and/or
//   - detected on every compiled video ("detect"): a violation asks the
//     Director for a revision and is logged to `video_mistakes`, so the rules
//     broken most often are stressed automatically in later prompts.
// New rules can be added here or as rows in `video_rules` (no deploy needed).

export type VideoRule = {
  id: string;
  never: string; // what the Director is told, as a "never …" line
  enforced: ("prompt" | "code" | "detect")[];
  seen: string; // where it went wrong (for people, not the model)
};

export const VIDEO_RULES: VideoRule[] = [
  // ── composition ──
  { id: "crowded", never: "never put more than 3 sharp elements on screen at once — one hero and at most 2 supporting ones (4 only at a lively pace; a row of small logos or icons counts as one group)", enforced: ["prompt", "detect"], seen: "Plateful: 6 equal cards in one scene for 6 s; Keka: one UI plus 1–2 badges" },
  { id: "no-hero", never: "never leave a scene without a hero: one element must be big (a sixth of the frame or more)", enforced: ["prompt", "detect"], seen: "Plateful, SeloraX: every card small, nowhere to look" },
  { id: "idle", never: "never let more than 2 seconds pass without something visibly changing (a move, an update, a new element, a camera push)", enforced: ["prompt", "detect"], seen: "Plateful 3.5–10 s static; early videos with dead stretches" },
  { id: "long-scene", never: "never hold one scene for more than 6 seconds — change the scene or rearrange it", enforced: ["prompt", "detect"], seen: "Plateful: one arrangement for 6.5 s" },
  { id: "decor-beats", never: "never use a celebrate / Lottie accent as a beat's only action more than once; beats must show the product doing something", enforced: ["prompt", "detect"], seen: "Plateful: 'scan the QR' and 'order from their phone' were only tiny effects" },
  { id: "tiny-screens", never: "never show a client screenshot small: a device or screenshot must fill at least a third of the frame when it appears", enforced: ["prompt", "detect"], seen: "Plateful: menu screenshot inside a small phone, unreadable" },
  { id: "unused-screens", never: "never ignore uploaded screenshots: show at least 2–3 different ones", enforced: ["prompt", "detect"], seen: "Nimbus: 5 screenshots uploaded, none shown" },
  { id: "stacked", never: "never place elements on top of each other (except a deliberate stack or fan)", enforced: ["code", "detect"], seen: "Showcase: icons stacked on the hub card" },
  { id: "overlap-text", never: "never let text cover a card, icon or label", enforced: ["code", "detect"], seen: "Early videos: captions over nodes" },
  // ── look ──
  { id: "panel-wipe", never: "never use the panel-wipe transition (a full-screen colour circle)", enforced: ["prompt", "code"], seen: "Plateful 2.5–3 s: a pink-teal circle filled the frame" },
  { id: "dark-on-dark", never: "never use the dark card style on a dark theme (it disappears into the background)", enforced: ["prompt", "code"], seen: "Plateful: dark cards on the midnight background" },
  { id: "off-brand", never: "never pick colours that fight the client's brand: use their brand colour; with none, pick the theme closest to the logo", enforced: ["prompt"], seen: "Plateful: orange brand shown in pink-teal; white brand turned grey" },
  { id: "off-industry", never: "never show commerce / delivery cards (order, cart, courier …) for a product that does not sell or ship goods", enforced: ["prompt", "code"], seen: "General cards carried e-commerce text into other industries" },
  { id: "filler-content", never: "never fill cards with generic or unrelated content (\"Order #1042\", time slots on a table card): every value must fit the product", enforced: ["prompt"], seen: "Plateful: time slots on 'Table 4'; SeloraX-style ids everywhere" },
  // ── timing ──
  { id: "text-early", never: "never show words before the voice says them", enforced: ["code"], seen: "Early videos: the scene dimmed before the first word" },
  { id: "empty-frame", never: "never leave the frame empty (camera looking at nothing, a blank gap before the logo)", enforced: ["code", "detect"], seen: "SeloraX push transition; blank before the lockup" },
  { id: "cut-ending", never: "never let the closing line be cut: the video lasts as long as the voice", enforced: ["code"], seen: "Plateful: 15 s video, 16.4 s voice — the last line never appeared" },
  // ── from the reference films (docs/style-reference.md) ──
  { id: "text-wall", never: "never put more than 8 words on screen in one statement — 2–6 words, one keyword highlighted", enforced: ["prompt", "detect"], seen: "Reference films: every caption is 2–6 words" },
  { id: "cut-spam", never: "never hard-cut between scenes more than once; flow with morph, zoom-through or a push", enforced: ["prompt", "detect"], seen: "Reference films: 6–14 hard cuts in 70–120 s, the rest continuous" },
  { id: "fake-proof", never: "never invent customer logos, testimonials, awards or real-world statistics — numbers on cards are illustrative UI values only", enforced: ["prompt"], seen: "Risk: proof beats in the reference style" },
  { id: "only-cards", never: "never build a video only from UI cards: use text: numbers, shape: forms and visual: pictures for what the voice says (voice → waveform, 4K → text:4K)", enforced: ["prompt", "detect"], seen: "MotionBrief promo: 19 beats, every element a card or a device" },
  { id: "same-layouts", never: "never use hero-* layouts for more than 2 scenes, or the same layout family twice: vary with round (hub, ring, arc) and flowing (pipeline, diagonal, split) compositions", enforced: ["prompt", "detect"], seen: "MotionBrief and Payroo videos: every scene hero-left/right" },
  { id: "busy-backdrop", never: "never let the background compete with the subject: one calm backdrop for the whole video (set on the first scene; later scenes null), never switching scene to scene", enforced: ["prompt", "code", "detect"], seen: "Owner: the subject must always stand out; background and text only enhance it" },
  { id: "no-hook", never: "never open on a logo or a generic title: open on the pain or the question in 2–5 words", enforced: ["prompt"], seen: "Reference films all open on a hook" },
  // ── from the never-list research (docs/video-never-list.md) ──
  { id: "text-on-hero", never: "never put text on top of the hero (not even a faded one): move the hero aside or set the text beside it", enforced: ["prompt"], seen: "Backup video: a caption over a ghosted icon for 5 s" },
  { id: "equal-weight", never: "never give two elements equal size or brightness: one hero, the rest smaller, softer or behind", enforced: ["prompt"], seen: "Owner: the subject must always stand out" },
  { id: "off-voice-motion", never: "never animate anything the voice is not talking about; only the subject of the sentence moves", enforced: ["prompt"], seen: "Owner: too much motion" },
  { id: "off-voice-visual", never: "never show something the voice is not saying, and never leave a spoken noun without a literal visual", enforced: ["prompt"], seen: "Owner: elements did not match the voice" },
  { id: "decor-centre", never: "never place decoration (dots, arcs, dotted paths) in the centre or behind text or the hero — only faint, at the edges, 2–3 pieces", enforced: ["prompt"], seen: "Keka: decor only in the corners" },
  { id: "off-palette", never: "never add colours outside the brand colour and neutrals; no neon glow on a light theme, no harsh black shadows", enforced: ["prompt"], seen: "Reference films: one brand colour + neutrals" },
  { id: "small-caption", never: "never leave a lone caption small in an empty frame: a caption alone on screen is large", enforced: ["prompt"], seen: "SeloraX: tiny 'inventory / couriers' words in a big empty frame" },
  { id: "effect-stack", never: "never stack text effects or highlight more than one keyword per line: one effect (highlight OR pill OR strike), one keyword", enforced: ["prompt"], seen: "Reference films: one keyword per line" },
  { id: "label-overlap", never: "never let a label touch or cover its icon or another label", enforced: ["prompt"], seen: "Backup video: 'Projects' written over the hub icon" },
  { id: "wild-entrances", never: "never spin, bounce, flip or drop elements in (explainer pace): enter with a soft rise, fade or pop", enforced: ["prompt", "code"], seen: "Owner: too much motion; Keka enters softly" },
  { id: "many-moves", never: "never move several things in different directions at once: one main movement at a time", enforced: ["prompt"], seen: "Owner: too much motion" },
  { id: "transition-zoo", never: "never use more than 3 kinds of scene transition in one video", enforced: ["prompt", "detect"], seen: "Keka: nearly all one camera move and one zoom" },
  { id: "aimless-cursor", never: "never move the cursor without purpose: it goes straight to what the voice names, clicks once per chapter, and the click visibly causes something", enforced: ["prompt"], seen: "Keka, ST8MNT: cursor → click → result" },
  { id: "fixed-length", never: "never aim for a length in seconds: the video lasts exactly as long as the voice plus a 2–3 s logo hold — never padded, never cut; chapters follow what the voice says", enforced: ["prompt", "code"], seen: "Owner: length follows the voice" },
  { id: "edge-crowding", never: "never place an element or text within 6 % of the frame edge (edge decor excepted)", enforced: ["prompt"], seen: "Placement checks" },
  { id: "hub-once", never: "never use a hub-and-spoke picture (one icon with others around it) more than once per video", enforced: ["prompt", "detect"], seen: "All four early videos opened on the same hub" },
  { id: "screen-in-circle", never: "never crop a screenshot into a circle or badge; screens stay rectangular and readable", enforced: ["prompt"], seen: "SeloraX 3.3 s: an unreadable screen inside a circle" },
  { id: "whole-screen", never: "never show a whole screen without pointing at the part the voice talks about (focus, lift or a cursor click)", enforced: ["prompt"], seen: "Reference films zoom to the exact part" },
  { id: "same-element-run", never: "never use the same element style (the same card type, the same round icon) for more than 3 scenes in a row", enforced: ["prompt"], seen: "Owner: every video looks the same" },
  { id: "random-decor", never: "never use emoji, 3D shapes or mascots unless they illustrate the exact words being spoken (a '?' on a question is fine)", enforced: ["prompt"], seen: "Keka uses '?' and a smile only on those words; Webflow-style abstract 3D does not explain a SaaS" },
  { id: "silent-event", never: "never add a sound without a visible event; a repeated event may repeat its sound (five logos = five pops) but sounds never overlap closer than 0.2 s — stagger the events", enforced: ["code"], seen: "Owner: SFX were not right" },
  { id: "weak-ending", never: "never end without the logo, a tagline and a call to action held 2–3 s", enforced: ["prompt"], seen: "Wellio, ST8MNT end on logo + CTA" },
  // ── from the 30 Sep explainer (every automatic check passed; it still looked bad) ──
  { id: "dead-click", never: "never click a card that has no button; a click always visibly changes the button", enforced: ["prompt", "code"], seen: "8091c79a: the cursor clicked an input and nothing happened" },
  { id: "loose-steps", never: "never show steps side by side without an arrow from one to the next; the step being talked about lights up", enforced: ["code"], seen: "8091c79a: steps were identical tiles in a row" },
  { id: "label-sizes", never: "never mix label sizes on one screen: every label reads at one size", enforced: ["code"], seen: "8091c79a: 70 px and 20 px labels side by side" },
  { id: "ghost-text", never: "never let a line arrive over a fading scene or leave one word waiting alone on a slow voice", enforced: ["code"], seen: "8091c79a: 'It' over a fading logo; 'Your' alone for 1 s" },
  { id: "invented-caption", never: "never write a caption the voice does not say (every word of 4+ letters is spoken)", enforced: ["prompt", "code"], seen: "8091c79a: 'Download quality'" },
  { id: "small-cta", never: "never end on a small grey call to action; it is a brand-colour button", enforced: ["code"], seen: "8091c79a: 'Try it free today' in small grey type" },
  { id: "camera-swing", never: "never swing the camera away from the action (long pans that overshoot)", enforced: ["code", "detect"], seen: "Fuzz: camera overshot 800 px after a focus" },
];

export const RULE_BY_ID = new Map(VIDEO_RULES.map((r) => [r.id, r]));

// The Director's NEVER list: built-in rules plus any active rows from
// `video_rules`; the ones broken most often lately are marked and listed first.
export function neverList(extra: { id: string; never: string }[] = [], counts: Record<string, number> = {}) {
  const all = [...VIDEO_RULES.filter((r) => r.enforced.includes("prompt") || r.enforced.includes("detect")), ...extra];
  const seen = new Set<string>();
  return all
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .map((r) => `- ${r.never}${(counts[r.id] ?? 0) >= 3 ? ` (broken in ${counts[r.id]} recent videos — take extra care)` : ""}`)
    .join("\n");
}
