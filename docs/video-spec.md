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
5. **It never stands still.** The camera drifts or pushes in every scene;
   things spring in and settle (a visible settle, never a bounce).
6. **Scenes flow.** A slide, a zoom through, or a mask wipe — one family per
   video, never a dip to black.
7. **One brand colour + neutrals.** Dark, light or brand-filled ground. The
   colour is the brand's exact colour (only made lighter or darker where it
   would not read, never another hue), on the keyword, the icons, the buttons
   and glows. Nothing is drawn behind or under the words (no underline, no
   marker, no block).
8. **The story arc.** Hook → problem → reveal → features → proof → the ask.
   The last scene is always the brand and the call to action.
9. **Honest.** No number the voice does not say; no invented feature, customer
   or placeholder row.

## How the engine makes it

```
voice + word times            (as now: our voice + Whisper, or the recording)
  → beats                     code: sentences, split/merged to 2.5–5 s
  → one AI call               per beat: intent, the words to show, an icon,
                              up to 3 short items, the number said (if any)
  → selector                  code: a template + a designed variant per beat,
                              a theme, a transition family, a pace — unlike
                              this customer's last videos
  → check                     code: every scene laid out once and checked;
                              what goes wrong mended, at most 3 rounds
  → film                      the templates, played on the voice
```

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

- Phase 0: this spec; the old version (v1) gets no new features.
- Phase 1: the engine behind the admin switch "Simple engine" (New version
  only, super admin), the template gallery, side-by-side tests.
- Phase 2 (done): 12 templates × 3 variants, 9:16 and 1:1, word effects
  (one word at a time, typing, strike, the key word growing in).
- Phase 3 (now): the check before playing and the Director's test set.
- Phase 4: when it wins, the old Composer is removed.
