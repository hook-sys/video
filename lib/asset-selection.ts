import { HERO_ALLOWLIST, HERO_ASSETS, HERO_IDS, type HeroId } from "@/lib/hero-assets";
import type { AssetConcept, AssetRequirement, SceneRecipe } from "@/lib/scene-recipe";

// Asset Selection: turns the Director's structured asset requirements
// (SceneRecipe.assets) into approved assets.
//
// 1. Only approved assets are candidates: a hero comes only from the hero
//    allowlist (lib/hero-assets.ts, reviewed score ≥ 90); supporting assets
//    need 80+, accents 75+ (the asset quality audit). A hero object that is
//    held back is never a candidate at all.
// 2. preferred_asset_id when it is approved for the category, else the
//    best-scoring asset of the same concept (exact).
// 3. No exact match and fallback_allowed: the best of the same concept
//    family (fallback).
// 4. Nothing suitable: unresolved — never a forced low-quality pick.

export type AssetTier = "hero" | "supporting" | "accent";
export type ApprovedAsset = {
  id: string;
  // the scene renderer's asset reference; null when it cannot draw it yet
  ref: string | null;
  concepts: AssetConcept[];
  tier: AssetTier;
  score: number;
  source: "hero3d" | "library";
};
export type AssetSelection = {
  requirement: AssetRequirement;
  status: "exact" | "fallback" | "unresolved";
  asset_id: string | null;
  ref: string | null;
  reason: string;
};

// Concepts that can stand in for each other.
const FAMILY: Record<AssetConcept, string> = {
  "payment-card": "finance",
  money: "finance",
  chart: "data",
  growth: "data",
  dashboard: "data",
  "security-lock": "security",
  "security-shield": "security",
  "ai-chip": "tech",
  document: "document",
  chat: "communication",
  email: "communication",
  goal: "outcome",
  success: "outcome",
  award: "outcome",
  idea: "insight",
  question: "insight",
  speed: "speed",
  other: "other",
};

// The premium 3D hero objects and what they show. They are candidates only
// while on the allowlist; the scene renderer does not draw them yet (ref null).
const HERO3D_CONCEPTS: Record<HeroId, AssetConcept[]> = {
  "hero:payment-card": ["payment-card"],
  "hero:chart-block": ["chart", "growth"],
  "hero:padlock": ["security-lock"],
  "hero:ai-chip": ["ai-chip"],
  "hero:document-stack": ["document"],
  "hero:chat-bubble": ["chat"],
};

// The existing assets the quality audit approved (motionbrief-asset-quality-
// audit: supporting 80+, accent 75–79). Nothing here is hero-grade (< 90).
export const LIBRARY_ASSETS: ApprovedAsset[] = [
  { id: "object:coin", concepts: ["money"], tier: "supporting", score: 84 },
  { id: "object:check", concepts: ["success"], tier: "supporting", score: 82 },
  { id: "object:shield", concepts: ["security-shield"], tier: "supporting", score: 82 },
  { id: "object:target", concepts: ["goal"], tier: "supporting", score: 82 },
  { id: "object:question", concepts: ["question"], tier: "supporting", score: 80 },
  { id: "object:bulb", concepts: ["idea"], tier: "supporting", score: 80 },
  { id: "object:lock", concepts: ["security-lock"], tier: "accent", score: 76 },
  { id: "object:bolt", concepts: ["speed"], tier: "accent", score: 76 },
  { id: "object:star", concepts: ["award"], tier: "accent", score: 76 },
  { id: "card:dashboard-mini/dark", concepts: ["dashboard", "chart"], tier: "supporting", score: 85 },
  { id: "card:sales-kpi/dark", concepts: ["growth"], tier: "supporting", score: 85 },
  { id: "card:ai-processing/dark", concepts: ["ai-chip"], tier: "supporting", score: 85 },
  { id: "card:payment/dark", concepts: ["payment-card"], tier: "supporting", score: 82 },
  { id: "card:chat/dark", concepts: ["chat"], tier: "supporting", score: 82 },
  { id: "card:email/dark", concepts: ["email"], tier: "supporting", score: 82 },
  { id: "card:invoice/dark", concepts: ["document"], tier: "supporting", score: 82 },
].map((a) => ({ ...(a as Omit<ApprovedAsset, "ref" | "source">), ref: a.id, source: "library" as const }));

// The registry: the library plus the hero objects (with their review state).
export type Registry = { assets: ApprovedAsset[]; allowlist: readonly string[] };
export function defaultRegistry(): Registry {
  const heroes: ApprovedAsset[] = HERO_IDS.map((id) => ({ id, ref: null, concepts: HERO3D_CONCEPTS[id], tier: "hero", score: HERO_ASSETS[id]?.score ?? 0, source: "hero3d" }));
  return { assets: [...heroes, ...LIBRARY_ASSETS], allowlist: HERO_ALLOWLIST };
}

const MIN: Record<AssetTier, number> = { hero: 90, supporting: 80, accent: 75 };
const RANK: Record<AssetTier, number> = { accent: 0, supporting: 1, hero: 2 };
// May this asset fill a requirement of this category?
function eligible(a: ApprovedAsset, category: AssetRequirement["category"], allowlist: readonly string[]): boolean {
  // A hero object counts only while it is on the allowlist (and 90+).
  if (a.tier === "hero" && !(allowlist.includes(a.id) && a.score >= MIN.hero)) return false;
  if (a.score < MIN[a.tier]) return false;
  return RANK[a.tier] >= RANK[category];
}
const best = (list: ApprovedAsset[]) => [...list].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0] ?? null;

export function selectAsset(req: AssetRequirement, registry: Registry = defaultRegistry()): AssetSelection {
  const pool = registry.assets.filter((a) => eligible(a, req.category, registry.allowlist));
  const pick = (a: ApprovedAsset, status: AssetSelection["status"], reason: string): AssetSelection => ({ requirement: req, status, asset_id: a.id, ref: a.ref, reason });
  let why = "";
  if (req.preferred_asset_id) {
    const p = pool.find((a) => a.id === req.preferred_asset_id || a.ref === req.preferred_asset_id);
    if (p) return pick(p, "exact", "preferred asset");
    why = `preferred ${req.preferred_asset_id} is not approved for ${req.category}; `;
  }
  const exact = best(pool.filter((a) => a.concepts.includes(req.concept)));
  if (exact && req.concept !== "other") return pick(exact, "exact", `${why}concept ${req.concept}`);
  if (req.fallback_allowed && req.concept !== "other") {
    const family = FAMILY[req.concept];
    const near = best(pool.filter((a) => a.concepts.some((c) => FAMILY[c] === family)));
    if (near) return pick(near, "fallback", `${why}no approved ${req.concept} ${req.category}; same family (${family})`);
  }
  const none = req.category === "hero" && !registry.allowlist.length ? "the hero allowlist is empty" : `no approved ${req.category} asset for ${req.concept}${req.fallback_allowed ? " or its family" : " (fallback not allowed)"}`;
  return { requirement: req, status: "unresolved", asset_id: null, ref: null, reason: `${why}${none}` };
}

// Applies a recipe's requirements: a resolved, drawable asset replaces the
// asset of the element it is for (a hero only by a hero requirement). An
// unresolved requirement leaves the Director's own asset as it was.
export function applyAssetSelection(recipe: SceneRecipe, registry: Registry = defaultRegistry()): { recipe: SceneRecipe; selections: AssetSelection[] } {
  if (!recipe.assets?.length) return { recipe, selections: [] };
  const selections = recipe.assets.map((req) => selectAsset(req, registry));
  let hero = recipe.hero;
  const supporting = recipe.supporting.map((s) => ({ ...s }));
  for (const sel of selections) {
    if (!sel.ref) continue;
    const slot = sel.requirement.slot ?? (sel.requirement.role === "primary" ? "hero" : null);
    if (slot === "hero") {
      if (sel.requirement.category === "hero") hero = { ...hero, asset: sel.ref };
    } else if (slot) {
      const s = supporting.find((x) => x.id === slot);
      if (s) s.asset = sel.ref;
    }
  }
  return { recipe: { ...recipe, hero, supporting }, selections };
}
