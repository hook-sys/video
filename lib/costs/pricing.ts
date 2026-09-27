import "server-only";

// Provider pricing lives only here. Nothing is hardcoded: set COST_PRICING_JSON
// (server env) with current provider prices. Unknown prices estimate to $0.
// Example:
// {
//   "openai": { "gpt-5-mini": { "input_per_1m_tokens": 0, "output_per_1m_tokens": 0 } },
//   "fal": { "<model-id>": { "per_unit": 0 } },            // unit = characters (voice) or images
//   "render": { "1080p": { "per_video_second": 0 }, "4k": { "per_video_second": 0 } },
//   "storage": { "per_gb_month": 0 }
// }
type Pricing = {
  openai?: Record<string, { input_per_1m_tokens?: number; output_per_1m_tokens?: number }>;
  fal?: Record<string, { per_unit?: number }>;
  render?: Record<string, { per_video_second?: number }>;
  storage?: { per_gb_month?: number };
};

function loadPricing(): Pricing {
  try {
    return JSON.parse(process.env.COST_PRICING_JSON || "{}");
  } catch {
    return {};
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

export function openaiCost(model: string, inputTokens: number, outputTokens: number) {
  const p = loadPricing().openai?.[model];
  return (
    (inputTokens / 1e6) * num(p?.input_per_1m_tokens) +
    (outputTokens / 1e6) * num(p?.output_per_1m_tokens)
  );
}

export const falCost = (model: string, units: number) =>
  units * num(loadPricing().fal?.[model]?.per_unit);

export const renderCost = (resolution: string, videoSeconds: number) =>
  videoSeconds * num(loadPricing().render?.[resolution]?.per_video_second);

// One month of storage for the given bytes.
export const storageCost = (bytes: number) =>
  (bytes / 1e9) * num(loadPricing().storage?.per_gb_month);
