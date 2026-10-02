import type { FilmId } from "./index";

// The film templates: one entry per reference film the user approved, with
// what it looks like and what each of its shots shows, so the Director (and
// people) can pick one. Every template plays a seven-part plan: hook, three
// things, reveal, an event that updates a number, growth seen by the team,
// two "no more" lines, the call to action and an end card.

export type FilmShot = { part: "hook" | "trio" | "reveal" | "pay" | "growth" | "nomore" | "cta" | "end"; shows: string };
export type FilmTemplate = {
  id: FilmId;
  name: string;
  reference: string; // the film it was made from
  look: string;
  camera: string;
  dark: boolean; // mostly dark background
  shots: FilmShot[];
};

export const FILM_TEMPLATES: FilmTemplate[] = [
  {
    id: "glow",
    name: "Glow",
    reference: "Fostr AI explainer (deep green)",
    look: "deep green field under two great glowing arcs that change shape shot to shot; comet lines with bright heads; frosted glass pills; flat tokens in place of 3D coins",
    camera: "slow push and drift per shot, a hand-held float; zoom-through between shots",
    dark: true,
    shots: [
      { part: "hook", shows: "comet lines cross the opening words; the big word with flat tokens orbiting, scattering on the keyword" },
      { part: "trio", shows: "the three things as tilted glass slabs beside a glass notch with a '?'" },
      { part: "reveal", shows: "a light streak flies in and becomes the logo; a glass label over cards linked by circuit lines" },
      { part: "pay", shows: "the app tilted in perspective: a new row slides in, the number counts up and glows" },
      { part: "growth", shows: "a big bar card the camera pushes into; a glass toggle that brings the team (initials) in" },
      { part: "nomore", shows: "the keyword in a glowing pill; the second line swaps in" },
      { part: "cta", shows: "the mark settles in a glass notch; a flat glowing check and a glass pill" },
      { part: "end", shows: "logo, tagline, call-to-action pill, address" },
    ],
  },
  {
    id: "dusk",
    name: "Dusk",
    reference: "iBanPay payment assistant (plum → white)",
    look: "near-black plum lit purple from below, turning white with a lavender glow for the solution (a band of light rises; no grey blend)",
    camera: "deep perspective sweeps over the app; gentle pushes",
    dark: true,
    shots: [
      { part: "hook", shows: "the line typed with a caret between blurred UI sheets" },
      { part: "trio", shows: "a word carousel: each thing in a glowing pill slides in, the last one blurs away" },
      { part: "reveal", shows: "logo with a glowing tagline pill; a big pill button pressed; the app sweeping in, tilted" },
      { part: "pay", shows: "a receipt scanned in corner brackets; key fields boxed as the number updates" },
      { part: "growth", shows: "white: a sparkle and the words; the tilted dashboard rises; team rows tick one by one" },
      { part: "nomore", shows: "dark again: the line in a glowing pill (word struck); a ring fills to a check" },
      { part: "cta", shows: "white: the line resolves out of blur; curved lines frame the last words" },
      { part: "end", shows: "mark draws, name, address in a dark pill" },
    ],
  },
  {
    id: "fly",
    name: "Fly",
    reference: "burnwe SaaS dashboard film (camera flight)",
    look: "cool white with soft blue light; one large product canvas; blue-over-black two-tone headlines; dark corner badge",
    camera: "one continuous flight over the product: numbers → chart → team → pulled back and tilted",
    dark: false,
    shots: [
      { part: "hook", shows: "tool windows scattered at different depths under the headline" },
      { part: "trio", shows: "three tool windows; a black dot cursor hops between them" },
      { part: "reveal", shows: "the logo, the headline, the product canvas rising underneath" },
      { part: "pay", shows: "the camera on the numbers and the payments: a row slides in, the number counts" },
      { part: "growth", shows: "the camera glides to the chart as it rises, then to the team table ticking" },
      { part: "nomore", shows: "pulled back, tilted; headlines under a white veil" },
      { part: "cta", shows: "the last headline over the tilted product" },
      { part: "end", shows: "logo, tagline, dark button, address" },
    ],
  },
  {
    id: "connect",
    name: "Connect",
    reference: "burnwe creator platform (soft lavender)",
    look: "soft lavender white with moving light streaks; indigo-headed cards; tag pills at depths (far ones blurred); dark corner badge",
    camera: "gentle pushes; cards zoom when their word is said",
    dark: false,
    shots: [
      { part: "hook", shows: "the line among tag pills at different depths" },
      { part: "trio", shows: "three indigo-headed cards, each zooming on its word" },
      { part: "reveal", shows: "the product's card: indigo header, the mark, the three things ticked" },
      { part: "pay", shows: "a wall of person cards (initials); a button changes state and every card ticks" },
      { part: "growth", shows: "a LIVE card: the chart rises, the team's initials join" },
      { part: "nomore", shows: "the app tilted under the headline; its rows tick to Live" },
      { part: "cta", shows: "two-tone headline over the tilted app" },
      { part: "end", shows: "logo, tagline, button, address" },
    ],
  },
];
