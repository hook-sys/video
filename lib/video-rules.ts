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
  { id: "crowded", never: "never put more than 4 sharp elements on screen at once — one hero and at most 3 supporting ones", enforced: ["prompt", "detect"], seen: "Plateful: 6 equal cards in one scene for 6 s" },
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
  { id: "no-hook", never: "never open on a logo or a generic title: open on the pain or the question in 2–5 words", enforced: ["prompt"], seen: "Reference films all open on a hook" },
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
