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
7. **One brand colour + neutrals.** Dark, light or brand-filled ground; the
   colour only on the keyword, buttons and glows.
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
  → film                      the templates, played on the voice
```

The AI never chooses layout, colour or style. A template's slots have fixed
places and sizes; its words are fitted to them, so nothing can overlap or be
cut off. There is no layout solver and no repair pass.

## Templates (phase 1: 7 × 2)

| Template | Intent | Variant A | Variant B |
|---|---|---|---|
| statement | hook, any | giant words across the frame | words stacked left, big icon right |
| trouble | problem | 3 icon tiles struck out | 3 alert cards piling up |
| reveal | solution | the brand mark lands with a ring | 3 chips fly into the mark |
| feature | feature | big UI card + cursor ticks a row | phone with notifications |
| stat | proof (a number said) | giant number counting up | bars growing to the number |
| steps | steps | 3 numbered steps drawn in a row | a checklist ticking down |
| cta | the ask (last) | logo + button pressed | big words + button, logo small |

Every split template also mirrors (hero left or right).

## Variation (what the viewer sees change)

Per video the selector draws: the template and variant of every beat (never the
same template twice in a row), the mirror, the ground (dark / light / brand),
the type pair, the transition family (slide / zoom / wipe) and the pace (calm /
lively). These make a fingerprint; a new video must differ from the
customer's last five in at least 3 of: ground, type, transitions, pace,
template order.

## Phase plan

- Phase 0: this spec; the old version (v1) gets no new features.
- Phase 1: the engine behind the admin switch "Simple engine" (New version
  only, super admin), the template gallery, side-by-side tests.
- Phase 2: 12 templates × 3 variants, 9:16, word effects (swap, strike).
- Phase 3: when it wins, the old Composer is removed.
