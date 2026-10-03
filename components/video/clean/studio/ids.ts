// The studio's names without the drawings (safe for server code): parts,
// looks and every block id. check:clean keeps these in step with BLOCKS/LOOKS.
export const ROLES = ["hook", "trio", "reveal", "pay", "growth", "nomore", "cta", "end"] as const;
export type Role = (typeof ROLES)[number];
export const LOOK_IDS = ["glow", "dusk", "fly", "connect", "ember", "paper", "pastel", "warm", "violet", "azure"] as const;
export type LookId = (typeof LOOK_IDS)[number];
export const LOOK_NAMES: Record<LookId, string> = { glow: "Glow", dusk: "Dusk", fly: "Fly-through", connect: "Connect", ember: "Ember", paper: "Paper", pastel: "Pastel", warm: "Warm", violet: "Violet", azure: "Azure" };

export const BLOCK_IDS: Record<Role, string[]> = {
  hook: ["hook.comet", "hook.typed", "hook.depth", "hook.tags", "hook.fan", "hook.slot", "hook.bigtype", "hook.glassgrid", "hook.alerts", "hook.bill"],
  trio: ["trio.slabs", "trio.carousel", "trio.windows", "trio.cards", "trio.split", "trio.bubbles", "trio.juggle"],
  reveal: ["reveal.streak", "reveal.pill", "reveal.rising", "reveal.profile", "reveal.converge", "reveal.script", "reveal.assemble", "reveal.link", "reveal.appicon"],
  pay: ["pay.board", "pay.receipt", "pay.flight", "pay.wall", "pay.notify", "pay.command", "pay.rank"],
  growth: ["growth.bars", "growth.dashboard", "growth.chart", "growth.live", "growth.ring", "growth.monitor", "growth.analytics"],
  nomore: ["nomore.swap", "nomore.ring", "nomore.veil", "nomore.board", "nomore.cross", "nomore.pills", "nomore.clear", "nomore.lock"],
  cta: ["cta.notch", "cta.frame", "cta.overview", "cta.stack", "cta.button", "cta.store", "cta.rings"],
  end: ["end.glow", "end.mark", "end.button", "end.split", "end.spotlight", "end.pen", "end.outline"],
};

// Categories (from the references each came from), so a script can later be
// matched to the looks and blocks that suit it. Anything untagged suits all.
export const CATEGORIES = ["fintech", "security", "marketing", "sales", "commerce"] as const;
export type Category = (typeof CATEGORIES)[number];
export const LOOK_TAGS: Partial<Record<LookId, Category[]>> = {
  pastel: ["fintech"],
  warm: ["security"],
  violet: ["marketing", "commerce"],
  azure: ["sales", "marketing"],
};
export const BLOCK_TAGS: Record<string, Category[]> = {
  "hook.slot": ["security"],
  "hook.bigtype": ["sales"],
  "hook.glassgrid": ["fintech"],
  "hook.alerts": ["sales"],
  "hook.bill": ["marketing", "commerce"],
  "trio.bubbles": ["sales"],
  "trio.juggle": ["marketing"],
  "reveal.script": ["sales"],
  "reveal.assemble": ["marketing"],
  "reveal.link": ["sales"],
  "reveal.appicon": ["fintech"],
  "pay.command": ["sales"],
  "pay.rank": ["marketing", "commerce"],
  "growth.monitor": ["sales"],
  "growth.analytics": ["sales", "marketing"],
  "nomore.pills": ["security"],
  "nomore.clear": ["sales"],
  "nomore.lock": ["security", "fintech"],
  "cta.store": ["fintech"],
  "cta.rings": ["security"],
  "end.pen": ["sales"],
  "end.outline": ["fintech"],
};
