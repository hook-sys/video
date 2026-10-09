import "server-only";

// All provider rates live only in this file.
//
// Every default below is 0 on purpose: real prices must be taken from each
// provider's current pricing page and entered here (or overridden per
// environment via COST_PRICING_JSON). A 0 rate still records the operation and
// quantity; it just estimates $0. Rates are keyed by the models configured in
// OPENAI_MODEL and FAL_VOICE_MODEL.
type Pricing = {
  openai?: Record<string, { input_per_1m_tokens?: number; output_per_1m_tokens?: number }>;
  // per_unit = USD per character (voice models) or per generated image (image models).
  fal?: Record<string, { per_unit?: number }>;
  render?: Record<string, { per_video_second?: number }>;
  storage?: { per_gb_month?: number };
};

function defaultRates(): Pricing {
  const openaiModel = process.env.OPENAI_MODEL || "gpt-5-mini";
  const voiceModel = process.env.FAL_VOICE_MODEL;
  return {
    openai: {
      // External source: OpenAI API pricing page (USD per 1M tokens). Unknown → 0.
      [openaiModel]: { input_per_1m_tokens: 0, output_per_1m_tokens: 0 },
    },
    fal: {
      // External source: fal.ai model page (USD per character). Unknown → 0.
      ...(voiceModel && { [voiceModel]: { per_unit: 0 } }),
    },
    // Assumption to configure: our own compute cost per rendered video second
    // (self-hosted server or Remotion Lambda), measured from benchmark render_ms. Unknown → 0.
    render: { "1080p": { per_video_second: 0 }, "4k": { per_video_second: 0 } },
    // External source: Supabase Storage pricing (USD per GB-month). Unknown → 0.
    storage: { per_gb_month: 0 },
  };
}

// Optional per-environment overrides, merged per model over the defaults, e.g.
// COST_PRICING_JSON='{"openai":{"gpt-5-mini":{"input_per_1m_tokens":0.25}}}'
function loadPricing(): Pricing {
  let overrides: Pricing = {};
  try {
    overrides = JSON.parse(process.env.COST_PRICING_JSON || "{}");
  } catch {}
  const base = defaultRates();
  const merge = <T extends object>(a?: Record<string, T>, b?: Record<string, T>) => {
    const out: Record<string, T> = { ...a };
    for (const [k, v] of Object.entries(b ?? {})) out[k] = { ...out[k], ...v };
    return out;
  };
  return {
    openai: merge(base.openai, overrides.openai),
    fal: merge(base.fal, overrides.fal),
    render: merge(base.render, overrides.render),
    storage: { ...base.storage, ...overrides.storage },
  };
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
