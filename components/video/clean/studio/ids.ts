// The studio's names without the drawings (safe for server code): parts,
// looks and every block id. check:clean keeps these in step with BLOCKS/LOOKS.
export const ROLES = ["hook", "trio", "reveal", "pay", "growth", "nomore", "cta", "end"] as const;
export type Role = (typeof ROLES)[number];
export const LOOK_IDS = ["glow", "dusk", "fly", "connect", "ember", "paper", "pastel", "warm", "violet", "azure", "night", "line", "crimson"] as const;
export type LookId = (typeof LOOK_IDS)[number];
export const LOOK_NAMES: Record<LookId, string> = { glow: "Glow", dusk: "Dusk", fly: "Fly-through", connect: "Connect", ember: "Ember", paper: "Paper", pastel: "Pastel", warm: "Warm", violet: "Violet", azure: "Azure", night: "Night", line: "Line", crimson: "Crimson" };

export const BLOCK_IDS: Record<Role, string[]> = {
  hook: ["hook.comet", "hook.typed", "hook.depth", "hook.tags", "hook.fan", "hook.slot", "hook.bigtype", "hook.glassgrid", "hook.alerts", "hook.bill", "hook.tunnel"],
  trio: ["trio.slabs", "trio.carousel", "trio.windows", "trio.cards", "trio.split", "trio.bubbles", "trio.juggle", "trio.circuit", "trio.storefront"],
  reveal: ["reveal.streak", "reveal.pill", "reveal.rising", "reveal.profile", "reveal.converge", "reveal.script", "reveal.assemble", "reveal.link", "reveal.appicon", "reveal.searchwin", "reveal.diagram", "reveal.diamond"],
  pay: ["pay.board", "pay.receipt", "pay.flight", "pay.wall", "pay.notify", "pay.command", "pay.rank", "pay.query", "pay.route", "pay.live"],
  growth: ["growth.bars", "growth.dashboard", "growth.chart", "growth.live", "growth.ring", "growth.monitor", "growth.analytics", "growth.donut", "growth.city", "growth.bignum"],
  nomore: ["nomore.swap", "nomore.ring", "nomore.veil", "nomore.board", "nomore.cross", "nomore.pills", "nomore.clear", "nomore.lock", "nomore.reconcile", "nomore.stopwatch", "nomore.flood"],
  cta: ["cta.notch", "cta.frame", "cta.overview", "cta.stack", "cta.button", "cta.store", "cta.rings", "cta.checkout", "cta.atom"],
  end: ["end.glow", "end.mark", "end.button", "end.split", "end.spotlight", "end.pen", "end.outline", "end.wipe", "end.urlbar", "end.glossy"],
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
  night: ["fintech", "sales"],
  line: ["fintech", "commerce"],
  crimson: ["fintech", "commerce"],
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
  "hook.tunnel": ["sales", "fintech"],
  "trio.circuit": ["fintech"],
  "trio.storefront": ["commerce"],
  "reveal.searchwin": ["sales"],
  "reveal.diagram": ["fintech"],
  "reveal.diamond": ["fintech"],
  "pay.query": ["sales"],
  "pay.route": ["fintech", "commerce"],
  "pay.live": ["commerce", "fintech"],
  "growth.donut": ["sales", "fintech"],
  "growth.city": ["fintech", "commerce"],
  "growth.bignum": ["fintech"],
  "nomore.reconcile": ["fintech"],
  "nomore.stopwatch": ["fintech"],
  "nomore.flood": ["security"],
  "cta.checkout": ["commerce", "fintech"],
  "cta.atom": ["fintech"],
  "end.wipe": ["sales"],
  "end.urlbar": ["fintech"],
  "end.glossy": ["fintech"],
};

// Blocks whose main object can take part in a hand-off: "a" — it stands
// ready when the part opens, "z" — when it closes (blocks' `obj`).
export const HANDS: Record<string, "a" | "z" | "az"> = {
  "hook.fan": "a", "hook.slot": "az", "hook.bigtype": "z", "hook.alerts": "az", "hook.bill": "az",
  "trio.split": "az", "trio.bubbles": "az", "trio.juggle": "az",
  "reveal.profile": "az", "reveal.link": "z", "reveal.appicon": "az",
  "pay.receipt": "az", "pay.notify": "z", "pay.command": "az", "pay.rank": "az",
  "growth.live": "az", "growth.chart": "az", "growth.monitor": "az", "growth.analytics": "az",
  "nomore.clear": "az", "nomore.lock": "az",
  "cta.stack": "az", "cta.button": "az", "cta.store": "az", "cta.rings": "az",
  "end.spotlight": "a", "end.pen": "a", "end.outline": "a",
 "reveal.searchwin": "az", "reveal.diagram": "a", "reveal.diamond": "a", "pay.query": "z", "pay.live": "az", "growth.donut": "a", "nomore.reconcile": "az", "nomore.stopwatch": "az", "nomore.flood": "z", "cta.checkout": "az", "cta.atom": "az", "end.wipe": "a", "end.urlbar": "a", "end.glossy": "a",
};

// Blocks that picture one literal thing (a shop front, a receipt, a coin…):
// offered only when the script talks about it, so the picture matches the words.
export const LITERAL: Record<string, RegExp> = {
  "trio.storefront": /\b(shops?|stores?|retail|e-?commerce|boutiques?|carts?|merchants?|sellers?|storefronts?)\b/i,
  "pay.receipt": /\b(receipts?|invoices?|expenses?|payments?|bills?|billing|paid|pay)\b/i,
  "pay.route": /\b(payments?|money|revenue|invoices?|prices?|costs?|cash|pay|paid|sales)\b|\$/i,
  "cta.checkout": /\b(checkout|carts?|orders?|buy|purchases?|payments?|pay)\b/i,
  "cta.store": /\b(apps?|mobile|phones?|download|ios|android|iphone)\b/i,
  "hook.bill": /\b(hours?|time|minutes?|weeks?|days?)\b/i,
};
// The literal blocks whose thing this script never mentions.
export const literalMisfits = (text: string) => new Set(Object.entries(LITERAL).filter(([, re]) => !re.test(text)).map(([id]) => id));
