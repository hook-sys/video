// The studio's names without the drawings (safe for server code): parts,
// looks and every block id. check:clean keeps these in step with BLOCKS/LOOKS.
export const ROLES = ["hook", "trio", "reveal", "pay", "growth", "nomore", "cta", "end"] as const;
export type Role = (typeof ROLES)[number];
export const LOOK_IDS = ["glow", "dusk", "fly", "connect", "ember", "paper"] as const;
export type LookId = (typeof LOOK_IDS)[number];
export const LOOK_NAMES: Record<LookId, string> = { glow: "Glow", dusk: "Dusk", fly: "Fly-through", connect: "Connect", ember: "Ember", paper: "Paper" };

export const BLOCK_IDS: Record<Role, string[]> = {
  hook: ["hook.comet", "hook.typed", "hook.depth", "hook.tags", "hook.fan"],
  trio: ["trio.slabs", "trio.carousel", "trio.windows", "trio.cards", "trio.split"],
  reveal: ["reveal.streak", "reveal.pill", "reveal.rising", "reveal.profile", "reveal.converge"],
  pay: ["pay.board", "pay.receipt", "pay.flight", "pay.wall", "pay.notify"],
  growth: ["growth.bars", "growth.dashboard", "growth.chart", "growth.live", "growth.ring"],
  nomore: ["nomore.swap", "nomore.ring", "nomore.veil", "nomore.board", "nomore.cross"],
  cta: ["cta.notch", "cta.frame", "cta.overview", "cta.stack", "cta.button"],
  end: ["end.glow", "end.mark", "end.button", "end.split", "end.spotlight"],
};
