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

// Numbers the source spells out ("thirty percent", "fourteen days", "two
// and a half"): their figures are as supported as written digits.
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export function spelledNumbers(text: string): string[] {
  const out: string[] = [];
  const words = text.toLowerCase().replace(/-/g, " ").split(/[^a-z]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    let n: number | null = null;
    let j = i;
    if (words[j] in TENS) {
      n = TENS[words[j]];
      if (words[j + 1] in UNITS && UNITS[words[j + 1]] < 10) n += UNITS[words[++j]];
    } else if (words[j] in UNITS) n = UNITS[words[j]];
    else if (words[j] === "twice" || words[j] === "double") n = 2;
    else if (words[j] === "triple") n = 3;
    else if (words[j] === "half") out.push("50", "0.5");
    if (n === null) continue;
    if (words[j + 1] === "hundred") n *= 100;
    else if (words[j + 1] === "thousand") n *= 1000;
    else if (words[j + 1] === "million") n *= 1_000_000;
    out.push(String(n));
    if (words[j + 1] === "and" && words[j + 2] === "a" && words[j + 3] === "half") out.push(`${n}.5`);
  }
  return out;
}

/** Deterministic pre-render checks. Returns concise problems; empty means OK to render. */
export function validateForRender(input: ValidationInput): string[] {
  const problems = [...input.missing];
  const source = norm(input.sourceText);
  const sourceDigits = new Set([...(source.match(FIGURES) ?? []).map(digits), ...spelledNumbers(source)].filter(Boolean));

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
