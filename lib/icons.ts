import CATALOG from "@/components/video/icons/catalog.json";

// Icon lookup for the Visual Director (server side): categories and keyword
// search over the motion-graphics icon library. Geometry is not loaded here.

export const ICON_CATEGORIES = CATALOG.categories as Record<string, string[]>;
const KEYWORDS = CATALOG.keywords as Record<string, string[]>;
export const ICON_COUNT = Object.keys(KEYWORDS).length;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Best icons for a concept ("payment confirmed", "delivery truck"): exact name
// first, then name words, then Lucide keywords. Deterministic ordering.
export function searchIcons(query: string, limit = 5): string[] {
  const q = words(query);
  if (!q.length) return [];
  const scored: [string, number][] = [];
  for (const [name, tags] of Object.entries(KEYWORDS)) {
    const nameWords = words(name);
    const tagWords = tags.flatMap(words);
    let score = name === q.join("-") ? 100 : 0;
    for (const w of q) {
      if (nameWords.includes(w)) score += 10;
      else if (nameWords.some((n) => n.startsWith(w) || w.startsWith(n))) score += 5;
      if (tagWords.includes(w)) score += 3;
    }
    // The plain icon ("shield") beats a variant ("shield-user") for the same words.
    if (score && nameWords.every((n) => q.includes(n))) score += 8;
    if (score) scored.push([name, score - nameWords.length * 0.1]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([n]) => n);
}
