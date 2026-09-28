import { CARD_BY_ID, CARD_TEMPLATES } from "./templates";
import { CROP_NAMES, DEVICE_FINISHES, DEVICE_MODELS, DEVICE_SPEC } from "./device-data";
import { CARD_STYLES, type CardStyle } from "./types";

// The asset catalog the Visual Director chooses from: every card template in
// every style, device mockups and screenshot crops. Names are stable ids:
//   card:<template>/<style>   device:<model>/<finish>   crop:<preset>

export const CARD_ASSETS = CARD_TEMPLATES.flatMap((t) => CARD_STYLES.map((s) => `card:${t.id}/${s}`));
export const DEVICE_ASSETS = DEVICE_MODELS.flatMap((m) => DEVICE_FINISHES.map((f) => `device:${m}/${f}`));
export const CROP_ASSETS = CROP_NAMES.map((c) => `crop:${c}`);
export const ASSET_COUNT = { cards: CARD_ASSETS.length, devices: DEVICE_ASSETS.length, crops: CROP_ASSETS.length };

export const isCardTemplate = (id: unknown): id is string => typeof id === "string" && CARD_BY_ID.has(id);
export const isCardStyle = (s: unknown): s is CardStyle => typeof s === "string" && (CARD_STYLES as readonly string[]).includes(s);

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Best card templates for a concept ("courier dispatch", "fake order alert").
export function searchCards(query: string, limit = 5): string[] {
  const q = words(query);
  if (!q.length) return [];
  return CARD_TEMPLATES.map((t) => {
    const idw = words(t.id);
    const tw = [...t.tags, ...words(t.description)];
    let score = 0;
    for (const w of q) {
      if (idw.includes(w)) score += 10;
      if (tw.includes(w)) score += 4;
      else if (tw.some((x) => x.startsWith(w) || w.startsWith(x))) score += 1;
    }
    return [t.id, score] as const;
  })
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => id);
}

// The content slots a template shows ({title}, {value} …).
export const cardSlots = (id: string) => [...new Set([...JSON.stringify(CARD_BY_ID.get(id)?.blocks ?? []).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

// Compact listing for the Director's prompt: one entry per template with the
// content slots it shows.
export function cardCatalogText() {
  const byCat = new Map<string, string[]>();
  for (const t of CARD_TEMPLATES) byCat.set(t.category, [...(byCat.get(t.category) ?? []), `${t.id} [${cardSlots(t.id).join(",")}] ${t.description}`]);
  return [...byCat].map(([c, list]) => `${c}: ${list.join("; ")}`).join("\n");
}

export const deviceCatalogText = () => DEVICE_MODELS.map((m) => `${m} (${DEVICE_SPEC[m].description})`).join("; ");
