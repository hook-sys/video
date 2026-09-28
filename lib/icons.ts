import CATALOG from "@/components/video/icons/catalog.json";

// Icon lookup for the Visual Director (server side): categories and keyword
// search over the motion-graphics icon library. Geometry is not loaded here.

export const ICON_CATEGORIES = CATALOG.categories as Record<string, string[]>;
const KEYWORDS = CATALOG.keywords as Record<string, string[]>;
export const ICON_COUNT = Object.keys(KEYWORDS).length;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Business concepts a Director (or a client) names, mapped to the icon that
// shows them best. Checked before the keyword search.
export const CONCEPT_ICONS: Record<string, string> = {
  laptop: "laptop", desktop: "monitor", computer: "monitor", mobile: "smartphone", "mobile-phone": "smartphone", tablet: "tablet", browser: "app-window", dashboard: "layout-dashboard",
  website: "globe", "app-screen": "smartphone", app: "app-window", login: "log-in", "sign-in": "log-in", "search-bar": "search", form: "clipboard-list", button: "mouse-pointer-click",
  dropdown: "chevron-down", notification: "bell-ring", "chat-window": "messages-square", email: "mail", calendar: "calendar", document: "file-text", pdf: "file-text", folder: "folder",
  file: "file", database: "database", cloud: "cloud", server: "server", api: "webhook", "code-window": "code", code: "code", spreadsheet: "sheet", "shopping-cart": "shopping-cart",
  cart: "shopping-cart", "product-box": "box", package: "package", parcel: "package", order: "shopping-bag", checkout: "credit-card", payment: "credit-card", "credit-card": "credit-card",
  "mobile-payment": "smartphone-nfc", invoice: "file-text", receipt: "receipt", coupon: "ticket-percent", "discount-tag": "tag", discount: "badge-percent", customer: "user", client: "user",
  store: "store", shop: "store", "online-store": "store", product: "package", warehouse: "warehouse", inventory: "boxes", stock: "boxes", barcode: "barcode", "qr-code": "qr-code",
  "delivery-truck": "truck", truck: "truck", courier: "truck", delivery: "truck", "location-pin": "map-pin", location: "map-pin", map: "map", "delivery-route": "route", route: "route",
  "delivered-package": "package-check", delivered: "package-check", "return-package": "package-x", return: "package-x", megaphone: "megaphone", "ad-creative": "image", ad: "megaphone",
  "social-media-post": "image", "social-media": "share-2", "video-ad": "clapperboard", campaign: "megaphone", audience: "users", target: "target", funnel: "funnel", lead: "user-plus",
  conversion: "mouse-pointer-click", sales: "trending-up", roas: "circle-dollar-sign", analytics: "chart-column", "growth-chart": "trending-up", growth: "trending-up",
  revenue: "circle-dollar-sign", engagement: "heart", like: "heart", comment: "message-circle", share: "share-2", follow: "user-plus", "email-campaign": "mails",
  "landing-page": "panels-top-left", "ai-brain": "brain", brain: "brain", ai: "sparkles", "ai-sparkle": "sparkles", sparkle: "sparkles", robot: "bot", "neural-network": "network",
  prompt: "square-terminal", "magic-wand": "wand-sparkles", "automation-gear": "cog", automation: "cog", workflow: "workflow", "ai-agent": "bot", agent: "bot", chatbot: "bot-message-square",
  "text-generation": "type", "image-generation": "image", "video-generation": "clapperboard", "voice-waveform": "audio-waveform", voice: "audio-waveform", microphone: "mic",
  processing: "loader", prediction: "chart-spline", recommendation: "thumbs-up", "smart-search": "search", "auto-fill": "text-cursor-input", "auto-sync": "refresh-cw", sync: "refresh-cw",
  "api-connection": "plug", integration: "plug", money: "banknote", cash: "banknote", dollar: "dollar-sign", taka: "taka", bdt: "taka", wallet: "wallet", bank: "landmark",
  "payment-success": "circle-check", success: "circle-check", "payment-failed": "circle-x", failed: "circle-x", error: "circle-x", profit: "trending-up", loss: "trending-down",
  expense: "receipt", calculator: "calculator", accounting: "book-open", tax: "receipt", investment: "chart-line", funding: "hand-coins", "business-graph": "chart-column",
  "bar-chart": "chart-column", "line-chart": "chart-line", "pie-chart": "chart-pie", message: "message-circle", chat: "message-circle", phone: "phone", "video-call": "video",
  team: "users", user: "user", "support-agent": "headset", support: "headset", bell: "bell", mention: "at-sign", send: "send", inbox: "inbox", contact: "contact", community: "users-round",
};

// Best icons for a concept ("payment confirmed", "delivery truck"): a known
// business concept first, then exact name, name words and Lucide keywords.
// Deterministic ordering.
export function searchIcons(query: string, limit = 5): string[] {
  const q = words(query);
  if (!q.length) return [];
  const concept = CONCEPT_ICONS[q.join("-")] ?? (q.length > 1 ? undefined : CONCEPT_ICONS[q[0].replace(/s$/, "")]);
  if (concept) return [concept, ...searchKeywords(q, limit).filter((n) => n !== concept)].slice(0, limit);
  return searchKeywords(q, limit);
}

function searchKeywords(q: string[], limit: number): string[] {
  const scored: [string, number][] = [];
  for (const [name, tags] of Object.entries(KEYWORDS)) {
    const nameWords = words(name);
    const tagWords = tags.flatMap(words);
    let score = name === q.join("-") ? 100 : 0;
    for (const w of q) {
      if (nameWords.includes(w)) score += 10;
      // Prefixes only between real words ("chart" ~ "charts"), never one-letter
      // name parts ("usb-c-port" must not match every word starting with c).
      else if (w.length >= 3 && nameWords.some((n) => n.length >= 3 && (n.startsWith(w) || w.startsWith(n)))) score += 5;
      if (tagWords.includes(w)) score += 3;
    }
    // The plain icon ("shield") beats a variant ("shield-user") for the same words.
    if (score && nameWords.every((n) => q.includes(n))) score += 8;
    if (score) scored.push([name, score - nameWords.length * 0.1]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([n]) => n);
}
