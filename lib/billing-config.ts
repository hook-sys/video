// Pricing, set by the super admin on /admin/billing (app_settings "billing").
// Pure: used by the server (lib/billing.ts) and the forms alike.
//
// Pay per use, no subscription: the customer loads credits (bKash, Nagad or
// Rocket, checked by the team) and each video takes from them — a set price
// for the first seconds (30 credits up to 20 s), then its level's rate for
// every second after. A credit's price is set here (1 cent to start), shown
// in taka at the rate set beside it. Each level runs the Motion Director on
// its own model (empty: the model chosen on /admin/models).

export const BILLING_KEY = "billing";
export const TIER_IDS = ["standard", "pro", "ultra"] as const;
export type TierId = (typeof TIER_IDS)[number];
// on: customers can pick it · soon: shown as "coming soon" · off: hidden
export type TierStatus = "on" | "soon" | "off";
// paidOnly: only for customers who have bought credits (or were given them by the team)
export type Tier = { name: string; blurb: string; badge: string; perSecond: number; model: string; status: TierStatus; paidOnly: boolean };
export type Pack = { usd: number; credits: number };
export const WALLETS = ["bkash", "nagad", "rocket"] as const;
export type WalletId = (typeof WALLETS)[number];
export const WALLET_NAME: Record<WalletId, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };
// the number customers send to, and its kind ("Personal", "Agent", "Merchant"); no number: not offered
export type Wallet = { number: string; kind: string };
// trialScriptMax: the longest script (characters) a customer who hasn't bought
// credits may write — enough for a video their welcome credits pay for
// baseSeconds/baseCredits: the first seconds' set price · creditUsd: one credit's price ·
// bdtPerUsd: taka for a dollar (prices shown in taka) · minLoad: the fewest credits loaded at once
export type Billing = {
  tiers: Record<TierId, Tier>;
  packs: Pack[];
  signupCredits: number;
  minSeconds: number;
  trialScriptMax: number;
  baseSeconds: number;
  baseCredits: number;
  creditUsd: number;
  bdtPerUsd: number;
  minLoad: number;
  wallets: Record<WalletId, Wallet>;
  // a finished video's saved edits: this many free, then each costs editCredits
  freeEdits: number;
  editCredits: number;
};

export const DEFAULT_BILLING: Billing = {
  tiers: {
    standard: { name: "Standard", blurb: "Clean motion video, fast.", badge: "", perSecond: 1, model: "anthropic/claude-opus-5.5", status: "on", paidOnly: false },
    pro: { name: "Pro", blurb: "A smarter director: richer story, smoother motion.", badge: "Best result", perSecond: 4, model: "anthropic/claude-opus-5.5", status: "on", paidOnly: true },
    ultra: { name: "Ultra", blurb: "Our most advanced director.", badge: "", perSecond: 5, model: "", status: "soon", paidOnly: true },
  },
  packs: [
    { usd: 10, credits: 1000 },
    { usd: 25, credits: 2600 },
    { usd: 50, credits: 5500 },
    { usd: 100, credits: 11500 },
  ],
  // about one 15-second Standard video
  signupCredits: 50,
  // a video is charged at least this many seconds
  minSeconds: 15,
  // ~33 words ≈ a 16 s video ≈ 48 Standard credits
  trialScriptMax: 200,
  baseSeconds: 20,
  baseCredits: 30,
  creditUsd: 0.01,
  bdtPerUsd: 122,
  minLoad: 100,
  wallets: { bkash: { number: "", kind: "Personal" }, nagad: { number: "", kind: "Personal" }, rocket: { number: "", kind: "Personal" } },
  freeEdits: 1,
  editCredits: 15,
};

const num = (v: unknown, d: number, min = 0, max = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const text = (v: unknown, d: string, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : d);

export function normalizeBilling(raw: unknown): Billing {
  const r = (raw && typeof raw === "object" ? raw : {}) as Omit<Partial<Billing>, "tiers"> & { tiers?: Record<string, Partial<Record<keyof Tier, unknown>>> };
  const tiers = Object.fromEntries(
    TIER_IDS.map((id) => {
      const d = DEFAULT_BILLING.tiers[id];
      const t: Partial<Record<keyof Tier, unknown>> = r.tiers?.[id] ?? {};
      const status = (["on", "soon", "off"] as const).find((s) => s === t.status) ?? d.status;
      return [id, { name: text(t.name, d.name, 30) || d.name, blurb: text(t.blurb, d.blurb), badge: text(t.badge, d.badge, 24), perSecond: num(t.perSecond, d.perSecond, 0, 1000), model: text(t.model, d.model, 200), status, paidOnly: typeof t.paidOnly === "boolean" ? t.paidOnly : d.paidOnly }];
    }),
  ) as Billing["tiers"];
  // standard is always offered, to everyone (a customer must be able to make a video)
  if (tiers.standard.status !== "on") tiers.standard.status = "on";
  tiers.standard.paidOnly = false;
  const packs = (Array.isArray(r.packs) ? r.packs : DEFAULT_BILLING.packs)
    .map((p) => ({ usd: Math.round(num(p?.usd, 0, 0, 10000) * 100) / 100, credits: Math.round(num(p?.credits, 0, 0, 10_000_000)) }))
    .filter((p) => p.usd >= 1 && p.credits > 0)
    .sort((a, b) => a.usd - b.usd)
    .slice(0, 8);
  const w = (r.wallets ?? {}) as Partial<Record<WalletId, Partial<Wallet>>>;
  const wallets = Object.fromEntries(
    WALLETS.map((id) => [id, { number: text(w[id]?.number, "", 20).replace(/[^0-9+]/g, ""), kind: text(w[id]?.kind, "Personal", 20) || "Personal" }]),
  ) as Billing["wallets"];
  return {
    baseSeconds: Math.round(num(r.baseSeconds, DEFAULT_BILLING.baseSeconds, 0, 600)),
    baseCredits: Math.round(num(r.baseCredits, DEFAULT_BILLING.baseCredits, 0, 1_000_000)),
    creditUsd: num(r.creditUsd, DEFAULT_BILLING.creditUsd, 0.0001, 100),
    bdtPerUsd: num(r.bdtPerUsd, DEFAULT_BILLING.bdtPerUsd, 1, 10_000),
    minLoad: Math.round(num(r.minLoad, DEFAULT_BILLING.minLoad, 1, 1_000_000)),
    wallets,
    freeEdits: Math.round(num(r.freeEdits, DEFAULT_BILLING.freeEdits, 0, 100)),
    editCredits: Math.round(num(r.editCredits, DEFAULT_BILLING.editCredits, 0, 100_000)),
    tiers, packs: packs.length ? packs : DEFAULT_BILLING.packs, signupCredits: Math.round(num(r.signupCredits, DEFAULT_BILLING.signupCredits, 0, 100000)), minSeconds: Math.round(num(r.minSeconds, DEFAULT_BILLING.minSeconds, 0, 120)), trialScriptMax: Math.round(num(r.trialScriptMax, DEFAULT_BILLING.trialScriptMax, 50, 1000)) };
}

// The credits a video of this length costs at this level: the set price for the
// first seconds, then the level's rate for each second after (a part second counts as one).
export const creditsFor = (b: Billing, tier: TierId, seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return b.baseCredits + Math.ceil(Math.max(0, s - b.baseSeconds) * b.tiers[tier].perSecond);
};
// What credits cost, in dollars and in taka (rounded up to the taka)
export const priceOf = (b: Billing, credits: number) => ({ usd: Math.round(credits * b.creditUsd * 100) / 100, bdt: Math.ceil(credits * b.creditUsd * b.bdtPerUsd - 1e-9) });
// The credits an amount of taka buys (rounded down)
export const creditsForBdt = (b: Billing, bdt: number) => Math.floor(bdt / (b.creditUsd * b.bdtPerUsd) + 1e-9);
// What saving the next edit of a video costs (`used`: edits already saved)
export const editCost = (b: Billing, used: number) => (used < b.freeEdits ? 0 : b.editCredits);
export const walletsOffered =(b: Billing) => WALLETS.filter((id) => b.wallets[id].number.length >= 6);

export const offered = (b: Billing) => TIER_IDS.filter((id) => b.tiers[id].status !== "off");
// a level this customer may choose (`paid`: has bought credits, or the team gave them some)
export const pickable = (b: Billing, id: unknown, paid = true): TierId | null => (TIER_IDS.find((t) => t === id && b.tiers[t].status === "on" && (paid || !b.tiers[t].paidOnly)) ?? null);

// A coupon applied to a pack: what is paid, and the credits it gives.
export type CouponKind = "discount" | "bonus" | "credits";
export function withCoupon(pack: Pack, coupon: { kind: CouponKind; value: number } | null) {
  if (!coupon || coupon.kind === "credits") return { usd: pack.usd, credits: pack.credits, bonus: 0 };
  if (coupon.kind === "discount") return { usd: Math.max(0, Math.round(pack.usd * (100 - Math.min(100, coupon.value))) / 100), credits: pack.credits, bonus: 0 };
  return { usd: pack.usd, credits: pack.credits, bonus: Math.round((pack.credits * coupon.value) / 100) };
}

export const usdOf = (credits: number) => `$${(credits / 100).toFixed(2)}`;
