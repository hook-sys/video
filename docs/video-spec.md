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

**Brand kits** (`/brand`, `lib/brand-kits.ts`, table `brand_kits`): a customer
keeps up to 10 brands (name, colour, icon, website, phone, tagline), one the
default. The new-video form starts on the default kit; a kit's icon is copied
into the video's folder, so it is never uploaded again. A brand typed on the
form can be kept as a kit with one tick. Kits are read by their owner and
written by the server only.

**Credits and payments** (`lib/billing-config.ts`, `lib/manual-payment.ts`,
`/billing`, `/admin/billing`): pay per use, no subscription. A video costs a set
price for its first seconds (30 credits up to 20 s), then 1 credit a second; a
credit is 1 cent, shown in taka at the rate the admin sets. Customers load
credits by bKash, Nagad or Rocket: they send to the number on /billing and
submit the amount, their number and the transaction ID; the team checks it and
approves (the credits added once) or rejects it. All of it is set on
/admin/billing.

**Terms, Privacy, Refunds and keep-alive**: `/terms`, `/privacy` and `/refund`
are open to everyone, linked from every footer and the sign-up form. The support
email and phone they show are set on /admin/settings. Vercel's daily cron
(`vercel.json`) calls `/api/keep-alive`, a small database read, so the free
Supabase project is never paused for inactivity. It runs on production only;
with `CRON_SECRET` set, only Vercel may call it.

**AI providers** (`lib/ai/keys.ts`, `/admin/models`): Google (Gemini), OpenAI,
Anthropic (Claude) and fal. Each key comes from the environment or is saved by
a super admin (encrypted, only its last four shown). Each role (Director,
voice…) picks its provider and model; the voice can be fal, Gemini TTS or
OpenAI speech.

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

Per video the selector draws: the look (soft / neon / editorial / bold / depth),
then a ground it stands on (dark / light / brand / glass), the template and variant
of every beat (never the same template twice in a row), the mirror, the type pair
(editorial mostly the serif, bold mostly a heavy face), the transition family
(slide / zoom / wipe / blur / leak / push / tilt) and the pace (calm / lively); each
intent has several templates it can be played with, drawn by weight. These make a
fingerprint; a new video must differ from the customer's last five in at least 3
of: ground, type, transitions, pace, template order, look.

**Looks** (`theme.ts` lookOf, `types.ts` STYLES): one family for every card, icon
tile, keyword and the ground's pattern, laid over the ground's colours. Soft: the
first look (frosted, rounded). Neon: a near-black ground of the brand's hue, cards
edged and glowing in the accent, the keyword glowing, a floor grid running to a
horizon. Editorial: warm paper, near-black ink, square corners, cards edged in a
fine ink line with no shadow, a page's rules and margin. Bold: thick ink outlines,
a hard shadow set off to the lower right, halftone dots fading to the middle.
Depth: rounder corners, deep layered shadows, the camera turning slowly in 3D,
big soft blobs of colour drifting. Corners follow the look (`rad`), a pill stays a
pill. The customer can change the look in the editor.

**Transitions**: leak — a dissolve under a sweep of warm light; push — the next
comes up from below, both streaked by motion blur; tilt — the scene turns away in
depth as the next turns in. None dips to the bare ground for long.

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
as made kept too, to go back to). No AI; the MP4 is made again. The first
saved edit of a video is free, each one after costs credits (15 to start; both
set on /admin/billing); going back to the video as made counts as an edit. The
editor says what saving costs and asks first; the charge is taken before the
save and given back if the save doesn't land (`projects.edit_count`, ledger
kind `edit`). The team's own videos are never charged.

The editor (app/projects/[id]/editor.tsx) opens over the page from "Edit
video": the video in the middle, its scenes on a timeline below (as long as
they are, a playhead), and beside it the scene picked (its layout, text,
items, icon, picture) or the whole video's style. Every layout, background and
lettering is offered as a still of this scene drawn with it; a layout that
holds fewer words keeps the run around the lit word, never starting or ending
on a little word. Undo and redo, Space to play, ← → between scenes.

Anything in the video can be clicked: the templates mark their parts
(data-part: text, icon, item, item-icon, picture, brand; each scene
data-scene), so a click picks that scene and brings up the choices for what was
clicked (the words, the icon, that thing's line, the picture, or — on the
ground — the scene's background).

A scene may stand on a background of its own (Scene.ground): at most two
scenes, only a ground whose colours read; it comes in with the scene, the
video's own ground stays under the rest.


## Icons that move, with their own sound (components/video/simple/motion.ts)

**The picture is the word said (the owner's rule).** Every icon on screen — a
scene's hero, a card's, a panel row's — is the icon of a word the voice says in
that beat (`wordIcon`: English and Bangla word lists, Bangla by its stems), and
a scene's comes in with that word (`Scene.iconAt`, the lit word's first, then
the words on screen, then the rest of the beat). A beat with no such word has no
picture of its own: it is never shown by a template whose hero is its icon
(`showsIcon`) — another way with a hero of its own is chosen (the brand's mark
when the beat names the brand), else the words move. Never a stand-in icon.
Ambiguous words map only in their clear forms ("দিনের" is the sun; "দিন" alone
is also "give"). A word about people is the plain outline of a person or people
(user, users — the owner's exception of 13 Nov 2026); never a face, a body or an
animal. Checked on every test script, English and Bangla.

Every icon on a tile (kit.tsx Glyph) does what it means once it has come in:
a check is drawn, a bell rings, a chart line rises, a bolt flashes, a letter
flies off and back, a lock shuts, a cog turns, a clock ticks, a truck drives
in, a trophy beats twice; other icons stay still. The first icon that moves in
a scene is heard (its sound in place of the scene's pop): tick, ding, rise,
shimmer, lock, digital processing — made by scripts/generate-sfx.mjs, soft,
under the voice. Letters typed are heard typing. Never more than 3 sounds in
a second, never two within 0.3 s (sounds.ts).

When the words are on screen alone, a lit word that plainly stands for an
icon ("invoices", "fast", "secure", "reminders" — a fixed list, never people)
gets that icon beside it, just before it is said. Only where it fits:
check.ts settleWordIcons leaves it out of a scene it would crowd (Scene.wordIcon
false), and the film, its sounds and the editor follow.

## Rhythm (components/video/simple/rhythm.ts)

The promos change what is on screen every 1.5–3 s; our scenes held one
picture for 4–13 s (measured: motion 2.2–2.6, 40–50 % of frames still, against
4.7–21 and 10–70 % in the references). The voice is cut into phrases — at its
punctuation and pauses, at most 5 words, never ending on a little word — and
the picture changes on each:

- words on screen alone (Big words A/C, Moving words C) whose beat says more
  than its words show the whole line phrase by phrase, big, each in with a
  small punch and cut out just before the next (the lit word lit wherever it is);
- a scene with a hero (Side, Band) cuts to a close-up of its hero on a new
  phrase — the hero brought to the middle, as close as keeps it in frame, the
  words faded meanwhile — held up to 1.3 s, then back; always wide at its end.

The check: something new on screen every 3 s or sooner on average (the test
videos: 1.8 s). Measured on the same script rendered: motion 2.2–2.6 → 3.5–4.9,
still frames 40–50 % → 32–37 %.

## No empty frame; a strong end

Nothing on screen is a dead moment. The first words of a scene come in by
4 frames into it (the video's first at once), a little before they are said
— titles lead the voice; a phrase's first word comes in as the one before
goes; the zoom between scenes goes through, the scene going out staying until
what comes in is there. Measured on the same script rendered: frames with only
the ground 1.5–1.7 s → 0–0.3 s of 25 s.

The end is the brand, big: its mark 230 px (300 on a tall frame, the name
under it), the name up to 150 px, the words under it larger, a soft light of
the brand colour opening behind it.

## The ideas: a beat shown as what it means

An icon beside the words says what a beat is about; it does not show it. A
beat whose words plainly picture one idea is shown as that idea
(components/video/simple/concept.tsx, the template "The idea"):

- **trapped** — an idea bouncing off the walls of its box, each wall giving as
  it is hit; it resolves by the walls flying apart and the idea coming to the middle;
- **chaos** — nine things dropping into a pile, shaking (the scene's own first);
  it resolves by the pile snapping into a 3 × 3 grid, its middle lit;
- **waiting** — a clock ticking over a bar stuck at a seventh (never a number
  on it); it resolves by the bar filling and the clock turning into a check;
- **truth** — "X is just Y": X big; as Y is said, X splits apart (A), is struck
  out and dropped (B) or turns over (C), Y stands in its place on a plate, and
  X comes back small and struck above it. Always alone on the frame — the two
  words are the picture;
- **launch** — a line drawn up across the frame, a rocket at its head lighting
  its stops (the scene's things, named) and arriving with a burst;
- **cost** — a bill whose lines (the scene's things, else bare lines) come in
  one by one, its total bar growing red under a rising arrow; a price is never
  made up — the number said, when there is one, counts up beside it. It
  resolves by every line but the first folding away, the bar shrinking to a
  third in the accent, the arrow turning down and a check;
- **hours** — a timeline crowded with clips and cut marks, a clock racing; it
  resolves by a light sweeping across and leaving one clean clip on each track,
  the clock easing to a stop, a check;
- **barriers** — what stands in the way ("no designers, no editors"), one card
  each, each crossed with a red ✕ as it is said; it resolves by the cards
  fading back and a big check coming up over them. Needs two things at least;
- **progress** — a bar filling to its goal (to the share said — "90%" — else
  all the way), its stops lighting as it passes, a flag (or a target, short of
  100 %) lighting at the end; short of its goal it stalls a little past a third.
  Shares said one after another ("২৫, ৫০, ৭৫ … একশো শতাংশ") are its stops;
- **versus** — less of one thing for more of another ("কম অ্যাডভার্টাইজিং কস্টে
  বেশি সেলস"): two meters side by side, the first (red, "কম …") falling to a
  quarter as the scene opens, the second ("বেশি …") filling as it is said.
  Its things are the two as said, the case ending off the last word;
- **funnel** — stages narrowing ("কতজন প্রোডাক্ট দেখছেন, কতজন কার্টে…, কতজন
  চেকআউট…"): one bar each, each narrower, coming in as it is said, the one
  before dimming; the last lit. Three to five stages;
- **split** — what went right against what went wrong ("সফলভাবে ডেলিভারড …
  ক্যানসেল বা রিটার্ন"; the good said in the beat or just before): a card each,
  the good stamped with a check, each bad with a red ✕ as it is said (shaking);
- **few** — many against few: two numbers said, the first ten times the second
  or more ("পাঁচ হাজার ভিজিটর … মাত্র পাঁচজন"): a field of dots under the
  many; as the few is said most fade and a few (in proportion, at least one)
  grow and glow, the few's number taking the lead;
- **exit** — people leaving a page ("কোন পেজ থেকে চলে যাচ্ছেন"): a page, dots
  coming in from one side and most drifting out the other, red as they go, the
  spot they leave from lit at the turn;
- **retention** — a video watched less and less ("কতদূর দেখছেন", "দেখা বন্ধ
  করছেন"): a curve drawn as a play bar fills under it, its drop marked at the
  turn (no numbers on its axes — none are said);
- **agenda** — the points a script promises ("এই চারটি বিষয়"), numbered, one
  after another (see Points). Never chosen by the Director: the engine puts it
  on the beat whose count matches the points it finds.

Each has a turn — its lit word said (the truth: its second word said), never in
the scene's first 0.8 s or last 1.3 s (a take-off at no less than 60 % of it).
A beat about what goes wrong (a hook, a problem) never resolves: the box stays
shut and closes in, the pile keeps shaking, the bar stays stuck, the rocket
stalls. Variants: beside the words (A), under them (B), or the idea alone (C;
never the opening scene, whose words are read). Two different ideas may follow
each other; each has its own sounds (walls hit, the pile locking, the clock's
ticks and a ding, the cut, the take-off).

The Director names a beat's idea (or none — most beats); the rule guess finds
one by its words ("stuck", "scattered", "waiting", "X is just Y", "launch",
"hours", "expensive", "no X, no Y", "goal"; in Bangla also "X নয়, Y" for the
truth, "কম X … বেশি Y", three "কতজন", shares listed, two numbers far apart,
"চলে যাচ্ছেন", "কতদূর দেখছেন", a good word against "ক্যানসেল/রিটার্ন").
A beat with an idea is shown as it most of the time, and of the drafts the one
that shows more of its ideas scores higher.

## The glass look and the motion kit's lessons

From the motion kit (a house style made on real Bangla promo edits) the
engine took what an automatic engine can use:

- **Glass**, a fourth ground: near white, lit by two large soft fields — the
  brand colour top left and its warm neighbour (the brand colour turned 38°
  round the wheel: the one second colour, only in the light) bottom right —
  and a haze of it along the bottom, all drifting slowly. Words in a deep ink
  of the brand's hue; the keyword in a gradient of the two; cards frosted white
  with a hairline of the brand colour round them; solid icon tiles, the mark and
  buttons glossy (a soft gradient and a light along their top edge). No
  backdrop blur anywhere: it blinks while what is under it moves.
- **Words from a blur** on glass: each sharpens from a 14 px blur as it is said,
  and the lit word is crossed once by a light.
- **Blur** between scenes, a fifth way: the scene going out blurs and fades as
  the next comes in from a blur, the two together for a moment.
- **No snapping colours.** A colour that changes as something happens (a toggle
  turning on, a word struck, a step ticked, a stop lit) fades across
  (kit.tsx blend), never switches at a halfway point — a switch reads as a blink.
- **A close-up is at least 15 % closer**, or none: less reads as a jolt.
- **The lit word on screen at least 1 s** before its scene ends: said later, it
  (and the words after it) comes in that much sooner (select.ts litInTime).
- **A glitch scan** for renders: `node scripts/qa-glitch.mjs video.mp4 [plan.json]`
  finds one-frame blinks (always a bug) and jumps away from the cuts between scenes.

SFX levels follow the kit's: under the voice by 14–20 dB (soft pops and whooshes
0.14–0.3, a click 0.45). Bangla type (Anek Bangla, Hind Siliguri — both in the
font library) waits for Bangla voices; the kit's talking-head edits and its robot
need footage and a character, which this engine does not make.

## Bangla

The videos are Bangla only: short ads (15–40 s) and explainers (40–90 s), most
of them 9:16 for reels. Everything a viewer reads is the script's own Bangla.

- **Timing without AI** (lib/voice-align.ts, lib/voice-pcm.ts). Whisper hears
  Bangla badly — it writes it in Devanagari, loses its place for whole
  sentences (measured on a real 112 s voice: 2–5 s off). The script is known
  (written for our voice, or written by the customer with their recording —
  the form asks for it), so the voice is timed by its pauses: the audio is read
  with the ffmpeg Remotion ships, its silences found, and the script's phrases
  (cut at । ? ! , ;) fitted to the runs of speech between them by their length
  in letters (dynamic programming over where each run ends); inside a run each
  word takes its share by letters. Measured on the same voice: every sentence
  and comma found, within 0.3 s of where it is heard. Whisper (told the language
  is Bangla) is only the fallback when the audio cannot be read.
- **Bangla type** (faces.ts, bn-widths.json, scripts/bangla). Five pairs of
  Bangla faces from the library (Noto Sans Bengali, Anek Bangla, Atma, Baloo
  Da 2, Noto Serif Bengali for headlines; Hind Siliguri, Noto Sans Bengali for
  text), each loading its Bangla file for the Bangla range and its Latin file
  for English words and digits inside a line. A Bangla line is laid out before
  the browser can measure it from a table measured in Chromium: each
  character's width and the corrections for conjuncts (ক্ত, স্থ…) and vowel signs
  that join their letter (রু, দ্রু…) — a line within about 1 %, a word within a
  few (an error is nearly always on the wide side: smaller type, never an
  overflow). Text is normalized to NFC (য় ড় ঢ় as a letter and a nukta, however typed).
- **Bangla rules** (bangla.ts). A sentence ends at । too; a caption never ends
  on a word that leads the next (এবং, ও, আর, এই, আপনার…) nor starts on one that
  follows the one before (থেকে, জন্য, দিয়ে, পর্যন্ত…) or a conjunction; a long
  sentence is never cut inside a list; a number said in words is shown as its
  digits with its unit ("পাঁচ হাজার" → ৫,০০০, "পঞ্চাশ শতাংশ" → ৫০%,
  "একশো বিশ টাকা" → ৳১২০) — and "নয়" (not) or "একটি" (a) alone are no number;
  numbers count up in Bangla digits; the ask a video ends on is found by its
  last word ("আজই অর্ডার করুন"); a word's icon is found by its stem
  ("ডেলিভারির" → ডেলিভারি → truck).
- **Without AI** (guess.ts readBangla). The Director's AI reads the beats when it
  is set; when it is not, or fails, the beats are read by rule — what each is
  for (hook, problem, solution, steps, proof, the ask), the words to show, the
  lit word, the icon, a list said as its things, the number said, the idea its
  words picture — and the video is made all the same, noted on it.

## Points (an explainer told as numbered points)

An explainer is mostly told as points: "প্রথমত, …", "দ্বিতীয়ত, …" (or "১.",
"২)"). The engine finds them (beats.ts pointsOf, two at least) and shows the
structure, so the viewer always knows where they are:

- **The opening** of each point is a scene of its own (template "Point",
  points.tsx): the ordinal as said, small; the number big in Bangla digits
  (০১, ০২ — in the key colour, in a glossy tile, or as an outline); the title
  under it — the opening's words after the ordinal, as said (at most five or six).
  Its beat is never joined to another, and a hit sounds as the number lands.
  A customer cannot turn another scene into one, nor one into another scene.
- **No bar** (the owner's choice): nothing sits at the top of the frame; the
  scenes have the whole of it (geo.ts BAR = false keeps the bar's code, off).
- *(off)* **The bar**: while a point lasts, its number in a pill and its title stay at
  the top, with a mark for each point (the one we are in longer, those done
  lit); it slides in after the opening and out at the point's end. The scenes
  inside a point are laid out below it (geo.ts geoFor: the frame less the bar's
  band — 300 px on 9:16, 170 on 1:1, 140 on 16:9), so nothing ever runs under it.
- **The last point** ends where the script turns to its conclusion
  ("কারণ…", "মনে রাখবেন…", "সবশেষে…", "তাই…") or before the ask.
- **The agenda**: the beat that promises the points ("এই চারটি বিষয়") shows them
  ahead — numbered rows lighting one after another — when the count said is the
  count found.

## Cards, not words and an icon

A scene is the words with something to look at, never words and one icon
when the beat names more. A beat's things are what it names that a picture
stands for, in the order said (guess.ts thingsOf: nouns with an icon, each
word and each icon once, the case ending off — "অডিয়েন্সের" → "অডিয়েন্স";
never a verb's form, a light verb or an ask — "দিন" is give, not day): two
to four of them (an imperative — "খুঁজুন" — is never one). A beat with one
thing is the words with its icon, or a card it is clicked on — never a phone or a
search with one line in it. Shown as cards (feature, tiles, messages…) when they are
not the caption's own words; when they are, the scene is the words beside
their pictures (statement B with tiles, scenes.tsx Tiles): a glass card for
each thing — its icon moving, its word under it — coming in as its word is
said (a pop each), lit while it is the last said, floating after. 2 or 3 in a
row, 4 two by two. A thing said too late to be read (in the scene's last
1.5 s) gets no card. The Bangla icon words cover marketing and shop
explainers (audience, age, area, visitors, purchase, return, conversion…).

One picture is not shown twice close together: the words beside an icon seen
in the last four scenes are told another way, or with another icon the beat's
own words stand for.


## Living icons (components/video/simple/living.tsx)

Animated Lottie icons from Google's Noto Emoji animations (CC BY 4.0,
public/lottie/LICENSE.md): 37 objects — rocket, megaphone, charts, package,
cart, bulb, bell, alarm, hourglass, check, cross, warning, fire, target,
trophy, gift, lock, laptop, gear, money, star, zap, truck, chat, clapper,
camera, gem, battery, party, tv… Objects only: no face, person or animal
(the coin, with a face on it, is left out). They are colour emoji, so they
are used only where one big picture stands alone (a beat's single icon,
statement B without cards); the cards keep the look's own icons. Each plays
from its scene's start and holds its last frame; an icon with no living
one keeps the look's glossy icon. The checks lay one out as a box of its size.

## The panel: the hand-made look (components/video/simple/panel.tsx)

The owner's reference is the hand-made reel: a frosted panel of rows, each a
glossy tile in its own colour (violet, blue, orange, green, pink in turn), the
thing as said, and a small picture of what it means — bars for an age or data,
a map and a dropping pin for a place, a clock sweeping for a time, a line
rising for orders and interest (falling for returns), rings spreading from a campaign to the people it reaches (never a sound wave — it reads as a voice recording), a small table filling for data,
a page and a cursor for a site, a play bar for a video, ticks for what is done,
else a meter filling. Each row comes in as its word is said (a pop), the last
said lit. The words said run under the panel, small, sharpening from a blur;
the panel and they are centred together.

A Bangla beat naming two or more things is a panel. A beat naming more right
after one goes on in the same panel (Scene.carry, cont): its rows stay, the new
ones come in under them, the camera keeps moving, and there is no way out or
in between them — one scene to the eye — up to five rows and never across a
point. The panel is laid out for the most rows it will have (Scene.rows), so
it never moves as rows come.


## Cards, moving (components/video/simple/deck.tsx)

The owner's choice for Bangla videos: no product screenshots, phones or
message screens — cards that move. A product screen, a phone of messages or
a phone of notifications becomes cards (or one card clicked, or the words
with their icon).

- **The deck**: the things a beat names, dealt from a stack — each flies to its
  place turning over (its back the colour of its tile), lands with a light
  sweeping across it and floats; its glossy icon tile, its word under it. Two
  side by side, three two-and-one, four two by two. A beat that would be a
  panel is cards now and then (never the same look twice running; a panel
  that goes on stays a panel).
- **cycle** (concept.tsx): things that feed each other round ("ডেটা আপনাকে
  শেখায়", "বারবার") — glossy tiles round a ring as each is said, the arrows
  between them drawn, then a light going round.
- **report**: a report said with its things ("রিপোর্ট", "হিসাব") — a report
  card titled with the word as said, its rows the things, their bars filling
  as each is said (no number that was not said).
