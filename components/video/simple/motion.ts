import type { CSSProperties } from "react";

// The icons' own motion and sound (docs/video-spec.md): an icon does what it
// means once it is in — a check is drawn, a bell rings, a chart line rises —
// with a short, soft sound of its own. And the word an icon plainly stands for
// gets that icon beside it when the words are on screen alone. No React here
// beyond styles: the film plays it, the check lays it out.

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Motion = "draw" | "ring" | "rise" | "flash" | "fly" | "lock" | "spin" | "tick" | "drive" | "pulse";
// (the frames after an icon comes in before it moves: it lands first)
export const MOTION_DELAY = 8;

// what each icon does, by its name
const MOTIONS: [RegExp, Motion][] = [
  [/^(check|check-check|circle-check|circle-check-big|square-check|square-check-big|badge-check|list-checks|clipboard-check|calendar-check|file-check|shield-check|user-check)$/, "draw"],
  [/^(bell|bell-ring|bell-dot|bell-plus|bell-electric|alarm-clock)$/, "ring"],
  [/^(trending-up|chart-line|chart-spline|chart-area|chart-column|chart-column-increasing|chart-bar|chart-bar-increasing|chart-no-axes-combined|arrow-up-right|move-up-right)$/, "rise"],
  [/^(zap|flash|bolt|sparkles|sparkle|wand-sparkles|star)$/, "flash"],
  [/^(send|send-horizontal|mail|mails|mail-check|plane|plane-takeoff|rocket|paper-plane)$/, "fly"],
  [/^(lock|lock-keyhole|shield|shield-half|key|key-round|fingerprint)$/, "lock"],
  [/^(refresh-cw|refresh-ccw|rotate-cw|rotate-ccw|repeat|repeat-2|loader|loader-circle|settings|settings-2|cog|workflow|bot|cpu)$/, "spin"],
  [/^(clock|clock-3|clock-4|timer|hourglass|calendar|calendar-days|calendar-clock|history)$/, "tick"],
  [/^(truck|car|bike|ship|package|package-check|forklift)$/, "drive"],
  [/^(heart|thumbs-up|trophy|award|medal|gift|party-popper|target|crown)$/, "pulse"],
];
export const motionOf = (name: string | null | undefined): Motion | null => (name ? (MOTIONS.find(([re]) => re.test(name))?.[1] ?? null) : null);

// each motion's sound (public/sfx)
export const MOTION_SOUND: Record<Motion, { name: string; volume: number }> = {
  draw: { name: "tick", volume: 0.32 },
  ring: { name: "ding", volume: 0.22 },
  rise: { name: "rise", volume: 0.24 },
  flash: { name: "shimmer", volume: 0.2 },
  fly: { name: "whoosh", volume: 0.14 },
  lock: { name: "lock", volume: 0.3 },
  spin: { name: "digital_processing", volume: 0.16 },
  tick: { name: "tick", volume: 0.26 },
  drive: { name: "soft_pop", volume: 0.24 },
  pulse: { name: "shimmer", volume: 0.16 },
};

// The icon's motion `t` frames after it starts moving (before: still, as it came in)
export function motionStyle(m: Motion | null, t: number): CSSProperties {
  if (!m || t < 0) return m === "draw" || m === "rise" ? { clipPath: "inset(0 100% 0 0)" } : {};
  const k = (frames: number) => ease(clamp01(t / frames));
  const damp = (tau: number) => Math.exp(-t / tau);
  switch (m) {
    // drawn left to right (a check, a list of checks)
    case "draw":
      return { clipPath: `inset(0 ${((1 - k(12)) * 100).toFixed(1)}% 0 0)` };
    // drawn from the bottom left up, landing with a small lift
    case "rise":
      return { clipPath: `inset(0 ${((1 - k(14)) * 100).toFixed(1)}% 0 0)`, transform: `translateY(${((1 - k(14)) * 6).toFixed(1)}%)` };
    // swung from the top, ringing out
    case "ring":
      return { transform: `rotate(${(Math.sin(t * 0.85) * 22 * damp(12)).toFixed(2)}deg)`, transformOrigin: "50% 12%" };
    // a flash: a quick swell and a flicker
    case "flash": {
      const s = 1 + 0.28 * Math.sin(Math.PI * clamp01(t / 10));
      return { transform: `scale(${s.toFixed(3)})`, opacity: t < 12 && Math.floor(t / 3) % 2 ? 0.55 : 1 };
    }
    // off up and to the right, and back in from the left
    case "fly": {
      if (t < 8) return { transform: `translate(${(ease(t / 8) * 60).toFixed(1)}%, ${(-ease(t / 8) * 40).toFixed(1)}%)`, opacity: 1 - t / 8 };
      const b = ease(clamp01((t - 8) / 12));
      return { transform: `translate(${((1 - b) * -50).toFixed(1)}%, ${((1 - b) * 20).toFixed(1)}%)`, opacity: b };
    }
    // shut: dropped in, a small squash
    case "lock": {
      const y = t < 6 ? -14 * (1 - t / 6) : 0;
      const sq = t >= 6 && t < 12 ? 1 - 0.08 * Math.sin(Math.PI * ((t - 6) / 6)) : 1;
      return { transform: `translateY(${y.toFixed(1)}%) scale(${(2 - sq).toFixed(3)}, ${sq.toFixed(3)})` };
    }
    // one turn, easing out
    case "spin":
      return { transform: `rotate(${(k(28) * 360).toFixed(1)}deg)` };
    // a tick to and fro, settling
    case "tick":
      return { transform: `rotate(${(Math.sin(t * 1.2) * 12 * damp(10)).toFixed(2)}deg)` };
    // driven in from the left, a little overshoot
    case "drive": {
      const x = t < 14 ? -60 * (1 - ease(t / 14)) : 6 * Math.sin(Math.PI * clamp01((t - 14) / 8)) * damp(6);
      return { transform: `translateX(${x.toFixed(1)}%)` };
    }
    // two soft beats
    case "pulse":
      return { transform: `scale(${(1 + 0.16 * Math.abs(Math.sin((Math.PI * clamp01(t / 20)) * 2))).toFixed(3)})` };
  }
}

// ── the icon a word plainly stands for ────────────────────────────────────
// Only words whose icon is beyond doubt; any other word gets none (never a
// stand-in). No people, faces or animals (icons/living.ts).
const WORD_ICONS: Record<string, string> = {
  invoice: "receipt", invoices: "receipt", receipt: "receipt", receipts: "receipt", billing: "receipt", bill: "receipt", bills: "receipt",
  payment: "credit-card", payments: "credit-card", pay: "credit-card", paid: "credit-card", card: "credit-card", checkout: "shopping-cart", cart: "shopping-cart",
  money: "banknote", cash: "banknote", cost: "piggy-bank", costs: "piggy-bank", save: "piggy-bank", savings: "piggy-bank", budget: "wallet", wallet: "wallet", price: "tag", pricing: "tag",
  fast: "zap", faster: "zap", fastest: "zap", instant: "zap", instantly: "zap", quick: "zap", quickly: "zap", speed: "zap",
  secure: "shield-check", security: "shield-check", safe: "shield-check", safely: "shield-check", protected: "shield-check", privacy: "lock", private: "lock", password: "key-round", passwords: "key-round",
  growth: "trending-up", grow: "trending-up", growing: "trending-up", revenue: "trending-up", profit: "trending-up", profits: "trending-up", sales: "trending-up",
  report: "chart-column", reports: "chart-column", analytics: "chart-column", insights: "chart-line", metrics: "chart-line", dashboard: "layout-dashboard", dashboards: "layout-dashboard",
  time: "clock", hours: "clock", minutes: "timer", seconds: "timer", deadline: "alarm-clock", deadlines: "alarm-clock", late: "alarm-clock",
  schedule: "calendar", scheduling: "calendar", calendar: "calendar", booking: "calendar-check", bookings: "calendar-check", appointment: "calendar-check", appointments: "calendar-check",
  email: "mail", emails: "mail", inbox: "inbox", message: "message-circle", messages: "message-circle", chat: "message-circle", chats: "message-circle",
  notification: "bell", notifications: "bell", alert: "bell", alerts: "bell", reminder: "bell", reminders: "bell",
  order: "package", orders: "package", parcel: "package", stock: "boxes", inventory: "boxes", warehouse: "warehouse",
  delivery: "truck", deliveries: "truck", shipping: "truck", shipment: "truck", shipments: "truck",
  error: "circle-x", errors: "circle-x", mistake: "circle-x", mistakes: "circle-x", wrong: "circle-x",
  done: "circle-check", approved: "circle-check", approve: "circle-check", complete: "circle-check", completed: "circle-check", verified: "badge-check",
  task: "list-checks", tasks: "list-checks", todo: "list-checks", checklist: "list-checks",
  automate: "workflow", automated: "workflow", automation: "workflow", automatically: "workflow", workflow: "workflow", workflows: "workflow",
  ai: "sparkles", smart: "sparkles", magic: "wand-sparkles",
  search: "search", find: "search", data: "database", database: "database", cloud: "cloud", sync: "refresh-cw", synced: "refresh-cw", update: "refresh-cw", updates: "refresh-cw",
  mobile: "smartphone", phone: "smartphone", app: "smartphone", apps: "smartphone", website: "globe", web: "globe", online: "globe", global: "globe", worldwide: "globe",
  file: "file-text", files: "file-text", document: "file-text", documents: "file-text", paperwork: "file-text", contract: "file-signature", contracts: "file-signature", sign: "file-signature",
  spreadsheet: "sheet", spreadsheets: "sheet", excel: "sheet",
  project: "folder-kanban", projects: "folder-kanban", goal: "target", goals: "target", target: "target", targets: "target",
  launch: "rocket", launches: "rocket", integration: "plug", integrations: "plug", connect: "plug", connected: "plug",
  settings: "settings", support: "life-buoy", help: "life-buoy", lock: "lock", key: "key-round",
  rated: "star", rating: "star", reviews: "star", favorite: "heart", love: "heart", award: "trophy", winning: "trophy", win: "trophy",
  idea: "lightbulb", ideas: "lightbulb", learn: "graduation-cap", learning: "graduation-cap", course: "graduation-cap", courses: "graduation-cap",
  location: "map-pin", map: "map", store: "store", shop: "store", restaurant: "utensils", food: "utensils",
};
// the word as written ("Invoices," "AI-powered") made a key: lower case, letters only
const keyOf = (word: string) => word.toLowerCase().replace(/[’']s$/, "").replace(/[^a-z]+/g, "");
export const wordIcon = (word: string): string | null => WORD_ICONS[keyOf(word)] ?? null;
export const WORD_ICON_NAMES = [...new Set(Object.values(WORD_ICONS))];
