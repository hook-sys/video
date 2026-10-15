# Reference playbook 2 — 17 more promos (uploaded Oct 11, 2026)

The owner's second set (after `playbook.md`, refs 01–12, and
`docs/style-reference.md`). `ref-13.jpg` … `ref-29.jpg` are contact sheets
(12 frames, evenly spaced); `metrics-2.json` the measured numbers (5 fps,
96×54 grey frames). Data to learn from, not templates to copy.

## The numbers

| ref | brand / subject | sec | cuts | avg shot | motion | still share | dark share | look |
|---|---|---|---|---|---|---|---|---|
| 13 | Stripe (payments update) | 64 | 14 | 4.2 s | 8.3 | 0.14 | 0.72 | aubergine + pink→violet gradients, giant gradient words, pill-word swap |
| 14 | Linear (AI agent) | 55 | 0 | 55 s | 1.7 | 0.47 | 1.0 | near-black, the real UI in perspective, one slow take, dim light |
| 15 | Soteria (AI portfolio) | 67 | 32 | 2.0 s | 12.5 | 0.09 | 0.63 | black → electric blue/violet, particle sphere, scattered-letter type |
| 16 | Notion AI | 57 | 15 | 3.5 s | 4.7 | 0.70 | 0.0 | flat solid blue / yellow / red blocks, white UI, phone, big black type |
| 17 | Figma Sites / Draw / Buzz | 81 | 93 | 0.9 s | 21.0 | 0.11 | 0.21 | collage of colours, frame boxes, selection handles, giant letters, rapid cuts |
| 18 | Framer (AI sites) | 37 | 16 | 2.2 s | 9.1 | 0.28 | 0.92 | black, real photos in rounded masks, wall of sites, blue Publish button |
| 19 | Framer for founders | 30 | 25 | 1.2 s | 16.2 | 0.32 | 0.76 | black + one brand's product photos, cursor, CMS table, collage end |
| 20 | Vercel (deploy walkthrough) | 41 | 3 | 10.3 s | 3.5 | 0.60 | 0.05 | white UI in a frame, black sidebar step list, cursor + tooltip, confetti |
| 21 | Vercel by an agency (M2) | 75 | 0 | 75 s | 3.2 | 0.05 | 1.0 | black, 3D laptop orbiting, condensed red→violet caps, huge ghost words |
| 22 | Raycast (settings) | 39 | 7 | 4.8 s | 5.1 | 0.47 | 1.0 | black chrome, macro close-ups of glass UI, emoji tiles, mono labels |
| 23 | Raycast (launch) | 51 | 15 | 3.2 s | 11.0 | 0.11 | 0.79 | black + red glow horizon, app icons on a ring, white flash card |
| 24 | Dia (browser) | 18 | 9 | 1.8 s | 11.2 | 0.43 | 0.42 | filmic: real desk/room footage, soft UI, big serif-ish white words |
| 25 | Superhuman Mail | 38 | 6 | 5.4 s | 5.6 | 0.26 | 0.31 | dark teal→plum, white phone UI, spoken-prompt captions, glitch logo |
| 26 | Webflow Source | 92 | 53 | 1.7 s | 13.7 | 0.11 | 0.65 | black + kinetic one-word type, pixel logo, editorial serif sites |
| 27 | Miro (site walkthrough) | 110 | 4 | 22 s | 4.2 | 0.52 | 0.0 | screen recording of the website, yellow accents, scroll |
| 28 | Topview Motion Studio | 32 | 32 | 1.0 s | 16.0 | 0.14 | 0.06 | pastel gradients, emoji 3D, illustration, collage type, cartoon scenes |
| 29 | Airtable Omni | 58 | 22 | 2.5 s | 9.0 | 0.40 | 0.12 | coloured full-bleed plates (teal/red/salmon/green), UI on plate, subtitles |

## The families (the new set widens what "premium" means)

1. **Dark cinematic product** (14, 21, 22, 23, 25): near-black, the real UI
   lit like an object (perspective, macro close-up, orbiting laptop), one
   accent glow (red, violet, teal), few words. Calm or one long take.
2. **Bold colour plates** (16, 29, 13): flat full-bleed colour behind white
   UI, the plate colour changes per section; big plain black or white type.
3. **Kinetic type-led** (13, 15, 26, 24): one word or phrase fills the frame
   (gradient fill, a pill that swaps a word, scattered letters assembling,
   one word per cut); UI only between words.
4. **Fast collage / maker** (17, 19, 28): 1 s shots, frame boxes and
   selection handles, giant letters, photos and illustrations mixed.
5. **Walkthrough / screen-real** (20, 27, 18): the product's own screens,
   cursor and tooltip, step list in a sidebar, success confetti.
6. **Filmic** (24): live footage of a room or a desk under the words.

Our current output sits in none of these exactly: it is a light, glassy
"soft SaaS" look (refs 10–12 of the first set). That is why every video
reads the same — one family.

## Techniques seen here that we cannot do yet

| technique | refs | what it would be in the Composer |
|---|---|---|
| full-bleed colour plates that change per section | 16, 29 | **built**: grounds plate/bright + "shift" |
| word in a pill that swaps (Create [custom] rules) | 13 | text effect "swap pill" |
| giant gradient-filled word filling the frame | 13, 21 | text size "giant" + gradient fill |
| ghost word huge behind the scene | 21 | **built**: style part "ghost" |
| scattered letters assembling into a word | 15 | **built**: reveal "assemble" |
| one word per beat, black frame | 26, 24 | **built**: reveal "beat" (giant type, words-only scenes) |
| UI in 3D perspective, slow drift | 14, 21 | device / card "perspective" with tilt-x + camera drift |
| macro close-up into one control | 22, 14 | **built**: camera "macro" (into the main thing) |
| orbiting 3D laptop | 21 | device "laptop-3d" orbit (pre-rendered angles) |
| particle sphere / energy orb | 15, 23 | **built**: backdrop "orb" |
| app icons on a ring | 23 | flow "ring" exists — needs real app logos |
| frame boxes and selection handles | 17 | **built**: style part "frame" |
| photos in rounded / circular masks | 18, 19 | real photos (we have none: needs a photo source) |
| step list in a sidebar following the story | 20 | layout "sidebar steps" |
| confetti success | 20 | **built**: style part "confetti" (hero moment) |
| glitch reveal of the logo | 25 | **built**: enter "glitch" (logos in hard/rapid styles) |
| spoken prompt as a caption under the phone | 25, 29 | caption plate "quote" under the device |
| live footage | 24 | needs stock video — out of scope for now |

## What this means for the work

- The variety has to come from **style families**, each changing the field,
  the type, the surfaces, the motion and the cut rhythm together — not from
  more options inside the one soft-glass family.
- First families to build (no photos or footage needed): **Dark Cinematic**,
  **Bold Plates**, **Kinetic Type**. Then **Collage** and **Walkthrough**.
- House rules become per family (Bold Plates and Collage cut fast; Dark
  Cinematic holds long; Kinetic Type has no cards for whole scenes).

## Built: styles, not looks (Oct 2026)

A video is no longer one of a few finished looks. Its style is a set of
independent parts (`components/video/composer/style.ts`): ground, backdrop,
texture, colour turning, cards, UI colour, icons, accent, type size, cuts,
rhythm, UI angle, ghost word — each chosen on its own and kept compatible by
rules, so thousands of looks come out of them (300 picks in a row gave 299
different styles).

Every reference is a recipe (`components/video/composer/recipes.ts`): its
style in those parts, and the faces and highlights it suits. A video starts
from the Director's own style or from a recipe changed in 2–4 parts, and is
always far from this customer's last three videos (another ground, most
parts different).

Admin → Settings has a switch for everything: looks on/off, the Director
choosing, mixing, no repeats, every option of every part, every reference.

**Adding references:** `npm run refs:ingest -- <videos, folders or direct
links>` (scripts/references/ingest.mjs) makes each one's contact sheet
(`ref-NN.jpg`), measures it (cuts, average shot, motion, still share, dark
share, light, saturation, main hue and how far it turns → `metrics-3.json`),
writes a row in `playbook-3.md` and a draft recipe in `recipes.ts` (its
ground, colour turning, rhythm and cuts from the numbers). Each draft is then
finished from its sheet: cards, panel, icons, accent, backdrop, type size,
ghost/frame/confetti and the note. Parts we cannot draw yet are listed in
"Techniques seen here that we cannot do yet" until they are built.

Also built: wide-spaced words closing up (reveal "track", refs 09 and 21).
Each technique has an admin switch (Settings → "Techniques", and the style
parts under "Looks: parts").
