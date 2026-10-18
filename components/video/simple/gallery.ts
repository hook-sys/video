import { type Brand, type Item, type Scene, type SimplePlan, TEMPLATES, type TemplateId, type Theme, VARIANTS } from "./types";

// Every template in every variant, on sample words, on any frame — the template gallery
// (/admin/templates) and the engine's checks. Each sample is 3 s.

const SAMPLE: Record<TemplateId, { words: string; key: number; icon: string; items: Item[]; number?: string }> = {
  statement: { words: "Still tracking orders on spreadsheets?", key: 4, icon: "sheet", items: [] },
  trouble: { words: "Missed deadlines. Lost stock.", key: 1, icon: "triangle-alert", items: [{ text: "Missed deadlines", icon: "calendar-x" }, { text: "Lost stock", icon: "package-x" }, { text: "Endless calls", icon: "phone-call" }] },
  reveal: { words: "Orin ERP brings it together", key: 1, icon: "factory", items: [{ text: "Orders", icon: "clipboard-list" }, { text: "Stock", icon: "boxes" }, { text: "Production", icon: "factory" }] },
  feature: { words: "See every order live", key: 3, icon: "radio", items: [{ text: "Fabric stage", icon: "layers" }, { text: "Dyeing line", icon: "droplets" }, { text: "Final shipment", icon: "truck" }] },
  stat: { words: "Ship orders 3x faster", key: 3, icon: "rocket", items: [], number: "3x" },
  steps: { words: "Up and running in a day", key: 3, icon: "rocket", items: [{ text: "Import orders", icon: "upload" }, { text: "Invite team", icon: "users" }, { text: "Go live", icon: "circle-check" }] },
  cta: { words: "Run your factory, not paperwork.", key: 2, icon: "arrow-right", items: [] },
  kinetic: { words: "Still chasing orders by phone?", key: 2, icon: "sparkles", items: [] },
  compare: { words: "Everything in one place", key: 3, icon: "layers", items: [{ text: "Orders", icon: "clipboard-list" }, { text: "Stock", icon: "boxes" }, { text: "Production", icon: "factory" }] },
  chart: { words: "Output up 40% in a month", key: 2, icon: "trending-up", items: [{ text: "Cutting", icon: "scissors" }, { text: "Sewing", icon: "shirt" }, { text: "Shipping", icon: "truck" }], number: "40%" },
  messages: { words: "Your team stays in sync", key: 3, icon: "message-circle", items: [{ text: "Order shipped", icon: "truck" }, { text: "Stock updated", icon: "boxes" }, { text: "Line 4 ready", icon: "circle-check" }] },
  bento: { words: "One app for the floor", key: 1, icon: "layout-grid", items: [{ text: "Live orders", icon: "radio" }, { text: "Stock levels", icon: "boxes" }, { text: "Shift reports", icon: "file-text" }] },
  screen: { words: "Every order on one screen", key: 3, icon: "monitor", items: [] },
};

export const GALLERY_BRAND: Brand = { name: "Orin ERP", color: "#1FA77A", cta: "Start today", icon: null };

// One scene of a template's sample, from frame `from` for `len` frames
export function sampleScene(template: TemplateId, variant: number, from: number, len = 90, left = true): Scene {
  const x = SAMPLE[template];
  const words = x.words.split(" ");
  return { from, to: from + len, template, variant, left, words: words.map((t, i) => ({ t, at: from + 4 + i * 6, key: i === x.key })), icon: x.icon, items: x.items, number: x.number ?? null };
}

export function galleryPlan(theme: Theme, only?: TemplateId, size: [number, number] = [1920, 1080]): SimplePlan {
  const list = (only ? [only] : TEMPLATES).flatMap((t) => Array.from({ length: VARIANTS }, (_, v) => [t, v] as const));
  const scenes = list.map(([t, v], i) => sampleScene(t, v, i * 90, 90, i % 4 < 2));
  return { engine: "simple", v: 1, duration: scenes.length * 90, w: size[0], h: size[1], seed: 1, brand: GALLERY_BRAND, theme, scenes, print: "gallery", sfx: false };
}
