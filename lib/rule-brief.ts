import { ProductBrief } from "@/lib/ai/product-brief";

// A brief written by rule, not by AI (with "AI only for the voice" on
// /admin/models): the customer's own script is the narration, word for word.
// Nothing is claimed that the script does not say, and nothing is invented
// about the product.
export function ruleBrief(input: { script: string; productName?: string | null; summary?: string | null; cta?: string | null }) {
  return ProductBrief.parse({
    product_name: input.productName?.trim() || "Your product",
    product_summary: input.summary?.trim() ?? "",
    supported_features: [],
    supported_claims: [],
    cta: input.cta?.trim() || "Get started",
    script: input.script.trim(),
  });
}
