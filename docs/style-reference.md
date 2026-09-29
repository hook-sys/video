# MotionBrief style reference

What the owner wants MotionBrief videos to look like, taken from 15 reference
promos (uploaded 29 Sep 2026; frames sampled every 3 s, motion measured at 5 fps).
This is the brief for the Director prompt, the negative list and the engine
backlog. Nothing here is wired into the pipeline yet.

## 1. The references

| # | Brand | Look | Length | Hard cuts | Avg shot | On-screen motion | Longest still |
|---|---|---|---|---|---|---|---|
| v00 | GemLog (jewellery ERP) | dark purple-teal gradient, real UI, sticky notes, strike-through text | 97 s | 42 | 2.3 s | 75 % | 1.0 s |
| v01 | abstract (silver) | monochrome light/particles, no UI | 91 s | 9 | 9.1 s | 63 % | 3.6 s |
| v01w | UrVote (voting) | warm white + orange brand, dark UI tilted 3D, cursor | 84 s | 13 | 6.0 s | 81 % | 0.6 s |
| v02 | abstract 3D shapes | candy colours, glossy 3D primitives | 96 s | 41 | 2.3 s | 83 % | 1.2 s |
| v03 | Sber (bank app, 9:16) | frosted glass cards over green, one-word captions | 13 s | 6 | 1.9 s | 98 % | 0.2 s |
| v04 | Madison (marketing AI) | white + one violet, flat UI, cursor walkthrough | 113 s | 11 | 9.5 s | 59 % | 2.8 s |
| v05 | Zeda.io (feedback) | lavender glass, integration icons orbit, UI panels | 70 s | 6 | 10.0 s | 89 % | 0.2 s |
| v06 | Lumin (analytics AI) | deep teal, line-icon story → glass UI, chat prompts | 97 s | 11 | 8.1 s | 67 % | 1.4 s |
| v08 | ClickCast (video SaaS) | pink-violet gradient, split text + UI | 80 s | 7 | 10.1 s | 31 % | 0.4 s |
| v10 | CareSync (health white-label) | white/desert photo bg, big numbers, flow of UI forms | 133 s | 26 | 4.9 s | 52 % | 5.2 s |
| v11 | NIVO (ad-tech AI) | electric blue glass, 3D isometric blocks, prompt bars | 104 s | 30 | 3.4 s | 78 % | 1.8 s |
| v12 | Alex AI (sales copilot) | light blue glass, giant kinetic words, notifications | 58 s | 20 | 2.8 s | 77 % | 1.2 s |
| v13 | Converse Bank (app) | soft blue-pink glass, phone UI, dark-mode switch | 44 s | 10 | 4.0 s | 82 % | 1.8 s |
| v14 | MSPortal.ai | mint glass swoosh, curved UI screens, AI badge | 72 s | 7 | 9.1 s | 82 % | 1.2 s |
| v15 | Amoeboids | royal-blue 3D world, glowing orbs, app icon ring | 118 s | 14 | 7.9 s | 74 % | 7.4 s |

Hard cuts are counted when most of the frame changes at once. A long average shot
with high motion means continuous transitions (camera move, morph, zoom-through)
rather than cuts.

## 2. What they all do (the rules to copy)

**Motion never stops.** Something moves 75–90 % of the time; a frame is never
fully still for more than ~1.5 s (median of the refs: 1.2 s).

**Continuous, not choppy.** Most refs cut hard only 6–14 times in 70–120 s.
Scenes flow into each other with a camera push, a zoom through a UI element, a
morph of one shape into the next, or a card that lifts out of a screen and
becomes the next scene. Energetic ones (v00, v02, v12) cut every 2–3 s, but
every cut lands on a beat of the voice.

**One idea per moment.** One message every 2–4 s. One hero on screen (a UI
screen, a big number, a phrase), at most 3 supporting elements.

**Real product, big and readable.** The product UI is the star: real screens,
crisp, filling 50–80 % of the frame, often tilted 10–25° in 3D and then
flattened, with a cursor that clicks, types and drags. The camera zooms into
the exact part being talked about (a button, a chart, a field) so it reads.

**Kinetic type, short.** 2–6 words, one line, large, clean sans, centred with
lots of space. One keyword is highlighted (brand colour, gradient, or a pill
behind it). Words appear word by word, swap in place (“Moving faster” →
“Adapting in real time”), or get struck through (“No more ~~chasing
information~~”).

**Numbers as heroes.** Big counters and deltas: “−1h”, “12 → 11”,
“$92,829+”, “5X”, “100 % auditable”, “395 leads”. They count up or tick.

**One brand colour + neutrals.** Background is a soft gradient mesh with
blurred blobs (light: white/lavender/mint; dark: navy/purple/teal). The brand
colour is used only for accents: highlights, buttons, the keyword, glows.

**Glass and depth.** Frosted cards with thin light borders and soft, large
shadows; background layers blurred (depth of field); parallax between layers.

**Story arc (same in almost every ref).**

| Part | Share of time | What happens |
|---|---|---|
| Hook | 0–8 % | a question or a pain in 2–5 words (“Your day in the jewelry store”, “You’re loosing…”) |
| Problem | 8–25 % | the messy “before”: scattered tools, spreadsheets, notifications piling up, a lost hour |
| Reveal | ~25 % | logo / product name lands, often with a transition from the mess |
| Features | 25–80 % | 3–5 features, each: short phrase → UI doing it → result |
| Proof | 80–90 % | numbers, integrations orbiting the logo, customer logos |
| Outro | last 6–10 % | logo animation + tagline + URL or CTA button (often clicked by the cursor), held 2–3 s |

**Recurring devices** (in 5+ refs each): cursor clicks; integration logos
orbiting or connected by lines to the product; notification or chat cards
popping in; a prompt/search bar being typed; a dashboard assembling from
cards; a line or path tracing between icons; a stacked set of cards fanning out.

## 3. Style families (a “look” the user could pick)

1. **Light glass product** (v04, v05, v08, v10, v12, v13, v14) — white/pastel
   mesh, frosted UI, one brand accent. Default for most SaaS.
2. **Dark gradient story** (v00, v06, v11, v15) — deep navy/purple/teal, glows,
   line icons for the problem, glass UI for the solution. Good for AI/data/dev tools.
3. **Warm brand glass** (v01w) — white with the brand colour everywhere as
   warm blur, dark UI tilted in 3D. Good when the brand colour is strong.
4. **Vertical app ad** (v03) — 9:16, stacked glass cards, one bold word per
   beat at the bottom. For social.
5. **Abstract 3D** (v01, v02) — shapes and light, no UI. Only for intros,
   transitions or brand moments, never the whole video.

## 4. Director direction (positive prompt, ready to use)

```
Direct a premium SaaS launch film in the style of top motion-design studios.
- Structure: hook (2–5 words, a pain or question) → the messy "before" → product
  reveal → 3–5 features (phrase → UI doing it → result) → proof (numbers,
  integrations) → logo + tagline + CTA held 2–3 s.
- The product UI is the hero: real screenshots, large (half the frame or more),
  crisp and readable, tilted slightly in 3D then settling flat; zoom into the exact
  part being described; a cursor clicks, types or drags on it.
- Keep something moving at all times; never hold a still frame over 1.5 s.
- One idea on screen at a time: one hero plus at most 3 supporting elements.
- Flow between scenes with continuous transitions (camera push, zoom through an
  element, a card lifting out of the screen into the next scene, a morph);
  use hard cuts only on a strong beat of the voice.
- Kinetic type: 2–6 words, one line, large clean sans, centred, one keyword
  highlighted in the brand colour; reveal word by word; use word swaps and
  strike-throughs for before/after.
- Turn claims into big numbers that count up or tick (−1h, 12 → 11, 5X, 100 %).
- Palette: one brand colour for accents only, soft gradient-mesh background,
  frosted-glass cards with thin light borders and soft wide shadows, blurred
  background layers for depth.
- Show integrations as logos orbiting or connected to the product.
- Every value on a card must fit the product and the narration.
```

## 5. Negative prompt (never do)

```
cluttered frame; more than 4 sharp elements at once; tiny or unreadable UI;
blurry, stretched or low-resolution screenshots; lorem ipsum or generic filler
data (Order #1042, John Doe, 12,480 records); invented features or fake
customer logos; misspelled words; walls of text (more than 8 words on screen);
more than one typeface family; rainbow or clashing colours; colours that fight
the brand; neon glow on a light theme; harsh black drop shadows; clip-art or
cartoon icons mixed with UI; emoji decoration; random 3D shapes unrelated to the
product; static frame longer than 1.5 s; dead air before the logo; linear
(un-eased) motion; jittery, shaky or spinning elements; camera swinging past the
action; flashy transitions (star wipe, full-screen colour wipe, page curl,
spin); hard cuts on every beat; text over a busy UI; elements overlapping text;
logo too small or on screen too briefly; ending cut before the voice ends; no
call to action; watermarks.
```

## 6. Sound (the downloads are silent, so this is from the edit rhythm)

Transitions land on a whoosh; cursor clicks on a click; cards and badges on a
soft pop; numbers on a tick; the logo on a riser + impact; a success chime on
the final CTA. Our 8 SFX cover this: whoosh, click, soft_pop, typing,
digital_processing, reveal, subtle_impact, success_chime.

## 7. Engine gaps (what we need to build to match)

Already have: glass cards, gradient-mesh backdrops, kinetic statement type,
count-up values, orbit, merge, trace/flow lines, zoom-through, push/dissolve,
a UI plane with tilt and a cursor (older compile path).

Missing or partial:
1. **Cursor actions in SceneScript v2**: click / type / drag on a named element
   (the UI plane has a cursor, the v2 vocabulary does not).
2. **Zoom to detail**: push the camera into a crop of a screenshot (a button,
   a chart) and back out.
3. **Card lift-out**: a region of a screenshot rises out of the screen as its
   own card and becomes the next scene.
4. **Word effects**: highlight pill behind a keyword, in-place word swap,
   strike-through.
5. **3D tilt → flat settle** as a standard entrance for hero screens.
6. **Depth of field**: blur background layers while the hero is sharp.
7. **Integration orbit around the brand logo** as a proof beat.
8. **Morph transition** between two shapes/cards (listed, but basic).
9. **Style families** as a project option (light glass, dark gradient, warm
   brand, vertical app ad).
