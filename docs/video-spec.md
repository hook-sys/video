# MotionBrief video spec (the simple engine)

One page: what a good MotionBrief video is, and how the simple engine
(`components/video/simple`) makes one. Every owner request changes this page
and a template, never adds a rule layer. Taste lives in the templates you can
see on /admin/templates, not in prompt text.

Built on `docs/style-reference.md` (15 reference promos). The three closest to
what we make: **v12 Alex AI** (giant kinetic words, notifications), **v04
Madison** (white + one colour, flat UI, a cursor that clicks), **v13 Converse
Bank** (soft glass, phone UI).

## The product

A script (or the customer's own recording) in, a video out. Nothing else is
asked. The same script made twice gives two visibly different videos.

## What a good video is

1. **One idea per 2.5–5 s.** A scene is a beat of the voice: one sentence or
   half of a long one.
2. **One hero per scene, big.** Giant words, a big UI card, a phone, a big
   number. It fills half the frame or more. At most 3 supporting things.
3. **Words on screen are the voice's words.** 2–6 of them, coming in as they
   are said (never later than half a second into the scene), one lit in the accent colour. Never a sentence, never a label
   above them, never the same words twice on one screen.
4. **Every cell is short.** A row, a step, a chip: 1–3 words, one line.
5. **It never stands still.** The camera pushes in and drifts one way for
   the whole video, and keeps moving through the way out of a scene and into
   the next; things spring in and settle (a visible settle, never a bounce).
6. **Scenes flow.** A slide, a zoom through, or a mask wipe — one family per
   video, never a dip to black — over one ground for the whole video (its
   soft lights drift and never jump at a cut). Two scenes are never on top of
   each other: a zoom takes the old one out, then brings the new one in.
7. **One brand colour + neutrals.** Dark, light or brand-filled ground. The
   colour is the brand's exact colour (only made lighter or darker where it
   would not read, never another hue), on the keyword, the icons, the buttons
   and glows. Nothing is drawn behind or under the words (no underline, no
   marker), except on a brand-filled ground: there the keyword sits on a plate
   of the brand colour made as light or as dark as the words (refs 03, 06, 09),
   because a lighter or darker brand colour does not stand out from them.
10. **Centred and in proportion** (docs/reference, all 29). Every scene is
    one group centred on the frame: the words beside or above a hero are
    measured and placed with it, never pinned to one side with the other side
    empty; the last scene is centred too (or on its half). Margins are the
    frame's (140 px wide, 80 tall, 70 square). One type scale for every
    template (geo.ts `TYPE`): the words alone 190, beside a hero 120, under a
    name 72, a thing on a card 48, a small line 30, a button 56 — at most
    three of them in a scene.
11. **The product, not the words.** The hero takes the room the words leave
    (up to 1.35× its own size): on average 28% of the frame or more. Words
    alone (no hero) in at most one scene in four, never two in a row; beside
    a hero the words are its caption — at most 4, around the key one.
12. **One scene, one idea.** A thing that only repeats the words shown is
    not shown again.
13. **Sound.** The voice and a sound on what happens (a whoosh, a pop, a
    click, a chime). Never music.
8. **The story arc.** Hook → problem → reveal → features → proof → the ask.
   The last scene is always the brand and the call to action.
9. **Honest.** No number the voice does not say; no invented feature, customer
   or placeholder row.

## How the engine makes it

```
voice + word times            (as now: our voice + Whisper, or the recording)
  + product pictures          uploaded, else taken from the website by a
                              browser on the server (none if it is private)
  → beats                     code: sentences, split/merged to 2.5–5 s; the
                              last sentence (the ask) its own beat
  → the Director, two calls   1. the story: what the product does, its parts,
                              the main moment, what each beat shows
                              2. per beat, with that plan: intent, the words
                              to show, an icon, up to 3 short items, the
                              number said (if any)
  → selector, 8 drafts        code: a template + a designed variant per beat,
                              a theme, a transition family, a pace — unlike
                              this customer's last videos
  → check, each draft         code: every scene laid out and checked (fit,
                              icons, repeats, timing, colour, what the
                              template means, the hero's size); mended, at
                              most 3 rounds; the best scored draft is played
  → film                      the templates, played on the voice
```

The button's words are the ask the voice ends on, as said ("Book a free
demo today"); a script that asks nothing ends without a button.

The AI never chooses layout, colour or style. A template's slots have fixed
places and sizes; its words are fitted to them, so nothing can overlap or be
cut off. There is no layout solver and no repair pass.

## The check before playing (`check.ts`, no AI)

Every scene is laid out once at its last frame, without a browser, and
checked: words that do not fit their place, a line cut short, an icon the
library has not got, the same thing twice on one screen, a scene that ends
before it has settled and been held, colours that do not read. Each is
mended the way written for it — the icon replaced, the thing said twice
dropped, shorter things, fewer words around the key one, another variant,
another template the beat can be played as, another ground — and the plan
checked again (at most 3 rounds). What was mended and what was left shows on
the video's admin page. Every template variant passes it on every frame and
ground (`npm run check:clean`).

## The Director's test set (`lib/simple/director-test.ts`)

10 real scripts (60 beats) with what a good reading of each beat is. On
/admin/models → Director test, a model, its reasoning and temperature are run
over them and scored (per beat: intent 30, words shown 25, key 15, things
named 20, number 10). A model or a prompt change is kept only when it scores
higher.

## Templates (12 × 3, every frame)

| Template | Played for | A | B | C |
|---|---|---|---|---|
| statement | hook, any | giant words | words + a big icon | lines sliding in from alternate sides |
| kinetic | hook, problem | one word at a time, then the line | typed into a prompt bar | the key word grows in as it is said |
| trouble | problem | tiles struck out | alert cards piling up | the pains struck through |
| compare | problem → solution | the mess, then one tidy card | a slider wipes before into after | a switch turns every cross to a tick |
| reveal | solution | the mark lands with a ring | things fly into the mark | things orbit the mark |
| feature | feature | a card, the cursor ticks a row | a phone, notifications | a search typed, results come up |
| messages | feature | a chat, bubbles with typing dots | an inbox read row by row | toasts on a quiet screen |
| bento | solution, feature | one big tile and the rest | pills around the words | cards fanning out |
| stat | proof (a number said) | the number, giant, counting up | bars growing to it | a card: number, arrow, line |
| chart | proof, feature | a line drawing up | a ring filling | the things as bars |
| steps | steps | numbered nodes joined by a line | a checklist ticking | cards cascading |
| cta | the ask (last) | logo, words, button pressed | big words, button, small logo | the brand on a half of its colour |

Every split template also mirrors (hero left or right). On a 9:16 or 1:1
frame the words go above the hero and rows of things become columns;
every hero is designed once and scaled into its place (`geo.ts`).

## Variation (what the viewer sees change)

Per video the selector draws: the template and variant of every beat (never the
same template twice in a row), the mirror, the ground (dark / light / brand),
the type pair, the transition family (slide / zoom / wipe) and the pace (calm /
lively); each intent has several templates it can be played with, drawn by
weight. These make a fingerprint; a new video must differ from the
customer's last five in at least 3 of: ground, type, transitions, pace,
template order.

## Phase plan

- Phase 0: this spec.
- Phase 1: the engine, the template gallery, side-by-side tests.
- Phase 2 (done): 12 templates × 3 variants, 9:16 and 1:1, word effects.
- Phase 3 (done): the check before playing and the Director's test set.
- Phase 4 (done): the only engine. The old versions (v1 and the Composer) and
  every engine switch are removed; they are kept on the branch
  `archive/old-engines` and come back to the live site only when the owner
  asks. A video made with them shows its MP4 if one was made.

## The customer's edits (components/video/simple/edit.ts)

A finished video can be edited by its owner on its page, guided: the look of
the whole video (background, lettering, the way between scenes, movement)
and, scene by scene, how it is shown (only the templates and designs that fit
it, each laid out and checked first), which of the beat's own words are on
screen and the one lit (never typed words), its things (up to 3, 1–3 words),
its icon and its picture of the product. Timing, the voice and the brand never
change. The browser previews an edit at once; the server applies the same
edit to the plan as stored, checks it like a drawn plan and keeps it (the plan
as made kept too, to go back to). No AI, no credits; the MP4 is made again.

The editor (app/projects/[id]/editor.tsx) opens over the page from "Edit
video": the video in the middle, its scenes on a timeline below (as long as
they are, a playhead), and beside it the scene picked (its layout, text,
items, icon, picture) or the whole video's style. Every layout, background and
lettering is offered as a still of this scene drawn with it; a layout that
holds fewer words keeps the run around the lit word, never starting or ending
on a little word. Undo and redo, Space to play, ← → between scenes.

