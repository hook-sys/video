// Pricing, set by the super admin on /admin/billing (app_settings "billing").
// Pure: used by the server (lib/billing.ts) and the forms alike.
//
// A video costs credits per second of its length, at its quality level's
// rate (1 credit = $0.01). Each level runs the Motion Director on its own
// model (empty: the model chosen on /admin/models).

export const BILLING_KEY = "billing";
export const TIER_IDS = ["standard", "pro", "ultra"] as const;
export type TierId = (typeof TIER_IDS)[number];
// on: customers can pick it · soon: shown as "coming soon" · off: hidden
export type TierStatus = "on" | "soon" | "off";
// paidOnly: only for customers who have bought credits (or were given them by the team)
export type Tier = { name: string; blurb: string; badge: string; perSecond: number; model: string; status: TierStatus; paidOnly: boolean };
export type Pack = { usd: number; credits: number };
export type Billing = { tiers: Record<TierId, Tier>; packs: Pack[]; signupCredits: number; minSeconds: number };

export const DEFAULT_BILLING: Billing = {
  tiers: {
    standard: { name: "Standard", blurb: "Clean motion video, fast.", badge: "", perSecond: 3, model: "", status: "on", paidOnly: false },
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
  return { tiers, packs: packs.length ? packs : DEFAULT_BILLING.packs, signupCredits: Math.round(num(r.signupCredits, DEFAULT_BILLING.signupCredits, 0, 100000)), minSeconds: Math.round(num(r.minSeconds, DEFAULT_BILLING.minSeconds, 0, 120)) };
}

// The credits a video of this length costs at this level.
export const creditsFor = (b: Billing, tier: TierId, seconds: number) => Math.ceil(Math.max(b.minSeconds, Math.ceil(seconds)) * b.tiers[tier].perSecond);

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
