import { z } from "zod";

// The brief: the product's name, the call to action and the narration (the
// customer's own script, word for word — lib/rule-brief.ts). Nothing is
// claimed that the script does not say.

const briefFields = {
  product_name: z.string(),
  product_summary: z.string(),
  supported_features: z.array(z.string()),
  supported_claims: z.array(z.string()),
  cta: z.string(),
  script: z.string(),
};

// Stored briefs (older ones carry the old engines' scenes and plans, which
// are no longer read: they parse, and are left out).
export const ProductBrief = z.object(briefFields);
export type ProductBrief = z.infer<typeof ProductBrief>;

// reportedUsd: what the provider said its calls cost (fal does); the tokens of
// calls it reported no cost for are priced from /admin/models.
// estimated: a call that failed or timed out — its input counted from its
// length, its output unknown (the provider may still bill it)
export type BriefUsage = { model: string; inputTokens: number; outputTokens: number; reportedUsd?: number; unreportedIn?: number; unreportedOut?: number; estimated?: boolean };
// (about 4 characters a token)
export const estimateInput = (u: BriefUsage, ...texts: string[]) => {
  if (u.inputTokens || u.outputTokens) return;
  u.inputTokens = Math.round(texts.reduce((a, t) => a + t.length, 0) / 4);
  u.estimated = true;
};
