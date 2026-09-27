import "server-only";
import { ProductBrief } from "@/lib/ai/product-brief";
import type { AssetManifest } from "@/lib/asset-manifest";
import { FORMATS } from "@/lib/projects";
import { RESOLUTIONS } from "@/components/video/types";

export type ValidationInput = {
  brief: unknown;
  assetsManifest: unknown;
  format: string;
  durationSeconds: number;
  resolution: string;
  // Website text, screenshot evidence and the customer's script: the only accepted sources for claims.
  sourceText: string;
  // Missing voice/assets reported by the render input builder.
  missing: string[];
};

const ANIMALS =
  /\b(animals?|creatures?|mascots?|pets?|dogs?|puppy|cats?|kitten|birds?|owls?|eagles?|parrots?|fox(es)?|wolf|wolves|bears?|lions?|tigers?|horses?|fish|sharks?|dolphins?|whales?|rabbits?|bunny|mouse|mice|monkeys?|apes?|elephants?|giraffes?|pandas?|penguins?|insects?|bees?|butterfl(y|ies)|snakes?|dragons?|unicorns?)\b/i;
const STOCK = /\b(stock[- ]photo|stock photography|photorealistic people|headshot)\b/i;

// Marketing claims that must appear verbatim in the source to be allowed.
const CLAIM_PHRASES = [
  /guarantee[ds]?/i, /money[- ]back/i, /risk[- ]free/i, /#\s?1\b/i, /\bnumber one\b/i,
  /\bbest[- ]in[- ]class\b/i, /\baward[- ]winning\b/i, /\btrusted by\b/i, /\brated\b/i,
  /\b(fastest|cheapest|leading|world'?s best)\b/i, /\btestimonials?\b/i, /\bcustomers (say|love)\b/i,
  /\bfree\b/i,
];
// Prices, percentages, multipliers and other figures.
const FIGURES = /[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?(%|x\b|k\b|m\b|\+)|\b\d[\d,.]{1,}\b/gi;

const STOPWORDS = new Set(
  "with your that this from have will more into their them they what when which while about "
    .concat("make makes made using used easy easily help helps better every just also")
    .split(" "),
);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const digits = (s: string) => s.replace(/[^\d.]/g, "").replace(/\.$/, "");
// Ignore negated guardrail phrases such as "no animals, no people".
const stripNegations = (s: string) => s.replace(/\bno\s+[^,.;]+/gi, " ");

/** Deterministic pre-render checks. Returns concise problems; empty means OK to render. */
export function validateForRender(input: ValidationInput): string[] {
  const problems = [...input.missing];
  const source = norm(input.sourceText);
  const sourceDigits = new Set((source.match(FIGURES) ?? []).map(digits).filter(Boolean));

  if (!(FORMATS as readonly string[]).includes(input.format)) problems.push("Invalid video format.");
  if (!(input.resolution in RESOLUTIONS)) problems.push("Resolution must be 1080p or 4K.");

  const parsed = ProductBrief.safeParse(input.brief);
  if (!parsed.success) return [...problems, "Product brief is invalid."];
  const brief = parsed.data;
  if (!brief.scenes.length) problems.push("Storyboard has no scenes.");

  const total = brief.scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
  if (Math.abs(total - input.durationSeconds) > 0.5) {
    problems.push(`Scene durations (${total}s) must equal ${input.durationSeconds}s.`);
  }

  // Claims: every shown or spoken text must be traceable to the source.
  const texts = [
    brief.product_summary,
    brief.cta,
    brief.script,
    ...brief.supported_features,
    ...brief.supported_claims,
    ...brief.scenes.flatMap((s) => [s.narration, ...s.on_screen_text]),
  ];
  const unsupported = new Set<string>();
  for (const text of texts) {
    for (const figure of text.match(FIGURES) ?? []) {
      if (!sourceDigits.has(digits(figure))) unsupported.add(figure.trim());
    }
    for (const phrase of CLAIM_PHRASES) {
      const m = text.match(phrase);
      if (m && !source.includes(m[0].toLowerCase())) unsupported.add(m[0]);
    }
  }
  if (unsupported.size) {
    problems.push(`Unsupported claims: ${[...unsupported].slice(0, 5).join(", ")}.`);
  }

  // Features/claims must be mostly made of words found in the source.
  const ungrounded = [...brief.supported_features, ...brief.supported_claims].filter((item) => {
    const words = norm(item).match(/[a-z]{4,}/g)?.filter((w) => !STOPWORDS.has(w)) ?? [];
    if (!words.length) return false;
    return words.filter((w) => source.includes(w)).length / words.length < 0.6;
  });
  if (ungrounded.length) {
    problems.push(`Features/claims not found on the website or screenshots: ${ungrounded.slice(0, 3).join("; ")}.`);
  }

  // Visuals: no animal or stock-photo imagery in prompts, scene directions or asset metadata.
  const visualTexts = [
    ...brief.scenes.flatMap((s) => [s.purpose, s.animation]),
    ...((input.assetsManifest as AssetManifest | null)?.assets ?? [])
      .filter((a) => a.source === "generated")
      .flatMap((a) => Object.values(a).filter((v): v is string => typeof v === "string")),
  ].map(stripNegations);
  if (visualTexts.some((t) => ANIMALS.test(t))) problems.push("Visuals must not include animals.");
  if (visualTexts.some((t) => STOCK.test(t))) problems.push("Visuals must not use stock-photo imagery.");

  return problems;
}
