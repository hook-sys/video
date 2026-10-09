// The house rules for the Composer's Directors: the owner's rulebook
// (docs/video-never-list.md, docs/video-do-list.md, docs/style-reference.md —
// made from the reference promos he picked and from our own failures),
// written in the Composer's own words. Before this they reached only the old
// Scene Director. What can be kept by construction is also kept in code
// (components/video/composer/rules.ts); the Judge checks the rest.

export const HOUSE_RULES = `HOUSE RULES (the owner's rulebook — every video keeps them)
STORY
- Open on the viewer's pain or a question in the first 3 s.
- Structure: hook/problem → the product arrives → how it works in 2–3 steps → the result → the call to action.
- Each feature: a short line → the product's UI → its moment (hit: a click, a check, a number) → the result.
- Hold the key visual 1.5–2.5 s so it sinks in; one message per scene.
- Every noun the voice says gets a literal visual; never show what the voice is not saying; never write a caption the voice does not say.
FRAME
- One hero per frame — the biggest and brightest; at most 2 supporting things, smaller or softer. Never two things of equal weight.
- Nothing behind or over the hero; text never on top of the hero (beside it, as its label above it, or — when the hero fills the frame — a small caption on a plate in a corner).
- On screen only the highlight: 2–6 of the words the voice says (the key phrase, the number, the thing named), never the whole sentence.
- Vary the compositions: the words, a card and an icon composed together (an icon beside the words, the words as a card's label, small things around the words) — not always words on one side and a card on the other; never the same composition twice in a row.
- Never a lone small caption or a lone icon in an empty frame: a caption alone is large; an icon alone is big and named.
- One effect per line of text and at most one lit keyword per line.
- Show the part of a screen the voice talks about (a card, its row, its button), not a whole screen to read.
- Steps side by side read in order (left to right); the one being talked about is the one that moves.
- A hub with spokes at most once per video.
MOTION AND LOOK
- Only the subject of the sentence moves; one main movement at a time; the hero holds still while it is read.
- Things come in with a soft rise, fade or pop — never spin, bounce, flip or drop in.
- At most 3 kinds of way into a scene in the whole video; flow between scenes (a thing that grows into the next scene, a card that travels), almost never a hard cut.
- One calm background for the whole video; one colour change at most (at the product reveal). No busy backgrounds (beams, streaks, particles).
- Colours: the brand colour and neutrals; no rainbow of accent cards.
- One typeface for headlines, three sizes at most.
NEVER
- People, faces, hands or animals (in icons, things or pictures); emoji, mascots or 3D shapes that do not picture the words.
- A number or claim the narration does not make.
- Music.`;

// The team's never list (lib/video-rules.ts: the built-in rules plus the
// ones added on /admin, the most broken first), as extra lines.
export const extraRules = (never: string | null | undefined) => (never?.trim() ? `\nTHE TEAM'S NEVER LIST (most broken first):\n${never.trim().split("\n").slice(0, 30).join("\n")}` : "");
