import type { Direction, ShotScript } from "@/lib/shots";

// Phase 6.5 fixture: four creative directions for the MotionBrief test-4
// narration (the last real video in real-shots.ts). A is the shots that
// video was made with; B–D are other stories for the same words.
const n = { subject: null, label: null, line: null, line_cue: null, accent: null, mark: null, card: null, title: null, input: null, button: null, action_cue: null, result: null, result_cue: null, items: null, camera: null, objects: null };
const it = (asset: string, label: string | null = null, cue: string | null = null) => ({ cue, asset, label });
const creative = { message: "Every launch gets its video in minutes", audience: "SaaS product teams", tone: "calm and confident", pace: "balanced" as const };
const script = (variant: string, direction: Direction, shots: object[]): ShotScript => ({ version: 3, theme: "lavender", creative, concepts: null, variant, direction, shots: shots.map((s) => ({ ...n, ...s })) as ShotScript["shots"] });

export const DIRECTION_A: Direction = {
  concept: "an unheard launch finally gets announced",
  hero: "a notification bell",
  metaphor: "a bell nobody hears until it rings",
  story: "problem, product reveal, how it works, proof, sharing",
  shot_approach: "a problem shot, the product UI, numbers for the result",
  assets: "3D objects for feelings, plain icons for steps",
  opening: "a silent bell over the line nobody sees them",
  ending: "a rocket beside the promise",
  motion: "calm entrances, one change at a time",
  camera: "steady default moves",
};
export const DIRECTION_B: Direction = {
  concept: "release notes run through one pipeline and come out as finished films",
  hero: "the release notes document",
  metaphor: "a production line turning paper into film",
  story: "input, machine, output, delivery",
  shot_approach: "a document, the upload card, outputs lifting out, channels in a row",
  assets: "documents and filmstrips, a clock for time",
  opening: "a document of features nobody reads",
  ending: "the plain promise in big type",
  motion: "things travel along the line from left to right",
  camera: "follow and track the flow sideways",
};
export const DIRECTION_C: Direction = {
  concept: "raw numbers turn into a decision to launch",
  hero: "the big numbers",
  metaphor: "a scoreboard counting toward a win",
  story: "question, measures, insight, decision",
  shot_approach: "number after number, a download card, a trophy",
  assets: "big type numbers with measure pictures, a question mark and a trophy",
  opening: "a question mark over the shipped features",
  ending: "a trophy for every launch",
  motion: "numbers count and swap in place",
  camera: "hold still so each number reads",
};
export const DIRECTION_D: Direction = {
  concept: "separate launch pieces connect into one shared story",
  hero: "the network of channels",
  metaphor: "dots joining into one constellation",
  story: "scattered parts, the link, the joined picture",
  shot_approach: "a group of pieces, steps with arrows, connected channels",
  assets: "icons for every piece, lines between them, a star",
  opening: "loose pieces of a launch side by side",
  ending: "a star over the joined picture",
  motion: "lines draw between pieces that connect",
  camera: "pull back to reveal the whole picture",
};

export const CREATIVE_A = (shots: ShotScript): ShotScript => ({ ...shots, variant: "A", direction: DIRECTION_A });

export const CREATIVE_B = script("B", DIRECTION_B, [
  { shot: "problem", cue: "Your team ships new features", subject: "icon:file-text", label: "Release notes", line: "nobody sees them", line_cue: "nobody sees them.", accent: "nobody", camera: "establish" },
  { shot: "problem", cue: "Making a launch video takes days.", subject: "visual:clock", label: "Days", camera: "push" },
  { shot: "reveal", cue: "MotionBrief changes that.", camera: "reveal" },
  { shot: "ui", cue: "Paste your release notes,", card: "action-panel", title: "Release notes", input: "Paste your notes", button: "Generate", action_cue: "press Generate.", camera: "follow" },
  { shot: "outputs", cue: "four finished videos.", items: [it("visual:filmstrip", "Videos"), it("visual:play", "Preview", "Pick your favorite,")], camera: "track" },
  { shot: "number", cue: "download all four in 1080p.", subject: "text:1080p", camera: "hold" },
  { shot: "steps", cue: "Share them on your website,", items: [it("icon:globe", "Website", "website,"), it("icon:mail", "Email", "email"), it("icon:share-2", "LinkedIn", "LinkedIn.")], camera: "follow" },
  { shot: "line", cue: "Every launch deserves a video.", line: "Every launch deserves a video", accent: "video", camera: "hold" },
  { shot: "line", cue: "Start free with MotionBrief.", line: "Start free with MotionBrief", accent: "MotionBrief", camera: "hold" },
]);

export const CREATIVE_C = script("C", DIRECTION_C, [
  { shot: "problem", cue: "Your team ships new features", subject: "object:question", label: "Seen?", camera: "establish" },
  { shot: "line", cue: "Making a launch video takes days.", line: "A video takes days", accent: "days", mark: "strike", camera: "hold" },
  { shot: "reveal", cue: "MotionBrief changes that.", camera: "reveal" },
  { shot: "number", cue: "In about two minutes", subject: "text:2 min", line: "two minutes", camera: "hold" },
  { shot: "number", cue: "you get four finished videos.", subject: "text:4", camera: "hold" },
  { shot: "ui", cue: "Pick your favorite,", card: "cta", title: "Your videos", button: "Download", action_cue: "download all four", camera: "close" },
  { shot: "group", cue: "Share them on your website,", items: [it("icon:globe", "Website"), it("icon:mail", "Email"), it("icon:share-2", "LinkedIn")], camera: "pull_back" },
  { shot: "line", cue: "Every launch deserves a video.", subject: "object:trophy", line: "Every launch deserves a video", accent: "launch", camera: "hold" },
  { shot: "line", cue: "Start free with MotionBrief.", line: "Start free with MotionBrief", accent: "free", camera: "hold" },
]);

export const CREATIVE_D = script("D", DIRECTION_D, [
  { shot: "group", cue: "Your team ships new features", items: [it("icon:rocket", "Features"), it("icon:bell", "News"), it("icon:calendar", "Weekly")], camera: "establish" },
  { shot: "problem", cue: "but nobody sees them.", subject: "object:exclaim", label: "Unseen", camera: "push" },
  { shot: "line", cue: "Making a launch video takes days.", line: "Takes days", accent: "days", mark: "strike", camera: "hold" },
  { shot: "reveal", cue: "MotionBrief changes that.", camera: "reveal" },
  { shot: "steps", cue: "Paste your release notes,", items: [it("icon:file-text", "Notes", "Paste your release notes,"), it("icon:mic", "Voice", "choose a voice,"), it("icon:sparkles", "Generate", "press Generate.")], camera: "follow" },
  { shot: "number", cue: "you get four finished videos.", subject: "text:4", camera: "hold" },
  {
    shot: "group",
    cue: "Share them on your website,",
    items: [it("icon:globe", "Website"), it("icon:mail", "Email"), it("icon:share-2", "LinkedIn")],
    camera: "pull_back",
    objects: [
      { id: "site", role: "hero", asset: "icon:globe", enters: true, persistent: false, exits: false, transforms_from: null, transforms_to: null, behavior: { type: "connect", target: "mail", cue: "in email" } },
      { id: "mail", role: "support", asset: "icon:mail", enters: true, persistent: false, exits: false, transforms_from: null, transforms_to: null, behavior: { type: "connect", target: "social", cue: "on LinkedIn." } },
      { id: "social", role: "support", asset: "icon:share-2", enters: true, persistent: false, exits: false, transforms_from: null, transforms_to: null, behavior: null },
    ],
  },
  { shot: "line", cue: "Every launch deserves a video.", subject: "object:star", line: "Every launch deserves a video", accent: "deserves", camera: "pull_back" },
  { shot: "line", cue: "Start free with MotionBrief.", line: "Start free with MotionBrief", accent: "MotionBrief", camera: "hold" },
]);
