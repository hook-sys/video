import type { CSSProperties } from "react";
import { stemsBn } from "./bangla";

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
// stand-in): the picture is the word said (the owner's rule). No faces, bodies
// or animals; a word about people is the outline of a person or people (icons/living.ts).
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
  // people (the outline of a person or people)
  audience: "users", audiences: "users", customer: "user-round", customers: "users", client: "user-round", clients: "users", user: "user-round", users: "users", people: "users",
  team: "users", teams: "users", visitor: "users", visitors: "users", follower: "users", followers: "users", community: "users-round", lead: "user-plus", leads: "user-plus", age: "user-round", gender: "venus-and-mars",
  day: "sun", days: "calendar-days", daily: "sun", night: "moon", week: "calendar-days", weekly: "calendar-days", month: "calendar", monthly: "calendar", year: "calendar", yearly: "calendar",
  views: "eye", view: "eye", impressions: "eye", reach: "radio-tower", share: "share-2", shares: "share-2", comment: "message-square", comments: "message-square", likes: "heart",
  loss: "trending-down", losses: "trending-down", drop: "trending-down", problem: "triangle-alert", problems: "triangle-alert", risk: "triangle-alert", question: "circle-help", questions: "circle-help",
  trust: "shield-check", quality: "badge-check", competitor: "swords", competitors: "swords", service: "concierge-bell", services: "concierge-bell", office: "building-2", company: "building-2", companies: "building-2",
  meeting: "presentation", meetings: "presentation", training: "graduation-cap", job: "briefcase", jobs: "briefcase", business: "briefcase", bank: "landmark", loan: "landmark", invest: "coins", investment: "coins", coins: "coins",
  design: "palette", creative: "palette", creatives: "palette", copy: "pen-line", copywriting: "pen-line", write: "pen-line", writing: "pen-line", content: "image", post: "image", posts: "image", photo: "camera", photos: "camera", video: "play", videos: "play",
  product: "package", products: "package", software: "app-window", platform: "app-window", factory: "factory", factories: "factory", manufacturer: "factory", manufacturers: "factory", manufacturing: "factory",
  script: "file-text", scripts: "file-text", story: "book-open", stories: "book-open", storytelling: "book-open", timing: "clock", animation: "film", animations: "film", scene: "clapperboard", scenes: "clapperboard", transitions: "arrow-right-left",
  install: "download", download: "download", today: "calendar-check", tomorrow: "calendar", saturday: "calendar-days", sunday: "calendar-days", weekend: "calendar-days", shift: "calendar-clock", shifts: "calendar-clock",
  clinic: "hospital", clinics: "hospital", hospital: "hospital", doctor: "stethoscope", patients: "users", patient: "user-round", direction: "compass", forward: "arrow-right", improve: "trending-up", difference: "arrow-right-left",
  numbers: "calculator", accounting: "calculator", tax: "calculator", taxes: "calculator", visual: "eye", visuals: "eye",
  call: "phone-call", calls: "phone-call", whatsapp: "message-circle", offer: "tag", offers: "tag", discount: "tag", free: "gift", gift: "gift", conversion: "repeat", conversions: "repeat", funnel: "filter", campaign: "megaphone", campaigns: "megaphone", ad: "megaphone", ads: "megaphone", marketing: "megaphone",
};
// Bangla: the word as written or its stem ("ডেলিভারির" → ডেলিভারি; bangla.ts); the same rule —
// only an icon beyond doubt, never a person
const BN_ICONS: Record<string, string> = {
  ইনভয়েস: "receipt", রসিদ: "receipt", বিল: "receipt", পেমেন্ট: "credit-card", কার্ড: "credit-card", কার্ট: "shopping-cart", চেকআউট: "shopping-cart",
  টাকা: "banknote", ক্যাশ: "banknote", খরচ: "piggy-bank", সঞ্চয়: "piggy-bank", সাশ্রয়: "piggy-bank", বাজেট: "wallet", দাম: "tag", মূল্য: "tag", অফার: "tag", ছাড়: "tag", ডিসকাউন্ট: "tag", ফ্রি: "gift", উপহার: "gift",
  দ্রুত: "zap", তাড়াতাড়ি: "zap", মুহূর্তে: "zap", নিরাপদ: "shield-check", নিরাপত্তা: "shield-check", সুরক্ষিত: "shield-check", পাসওয়ার্ড: "key-round",
  বিক্রি: "trending-up", সেলস: "trending-up", প্রফিট: "trending-up", লাভ: "trending-up", আয়: "trending-up", বৃদ্ধি: "trending-up", গ্রোথ: "trending-up",
  রিপোর্ট: "chart-column", অ্যানালাইসিস: "chart-column", বিশ্লেষণ: "chart-column", ডেটা: "database", ডাটা: "database", ড্যাশবোর্ড: "layout-dashboard",
  সময়: "clock", ঘণ্টা: "clock", মিনিট: "timer", সেকেন্ড: "timer", ডেডলাইন: "alarm-clock", শিডিউল: "calendar", ক্যালেন্ডার: "calendar", বুকিং: "calendar-check", অ্যাপয়েন্টমেন্ট: "calendar-check",
  ইমেইল: "mail", মেইল: "mail", ইনবক্স: "inbox", মেসেজ: "message-circle", চ্যাট: "message-circle", নোটিফিকেশন: "bell", রিমাইন্ডার: "bell",
  অর্ডার: "package", পার্সেল: "package", প্রোডাক্ট: "package", পণ্য: "package", স্টক: "boxes", ইনভেন্টরি: "boxes", গুদাম: "warehouse", ডেলিভারি: "truck", শিপিং: "truck",
  ভুল: "circle-x", সফল: "circle-check", সম্পন্ন: "circle-check", ভেরিফাইড: "badge-check", কাজ: "list-checks", টাস্ক: "list-checks", চেকলিস্ট: "list-checks",
  অটোমেশন: "workflow", অটোমেটিক: "workflow", স্বয়ংক্রিয়: "workflow", এআই: "sparkles", স্মার্ট: "sparkles",
  সার্চ: "search", খুঁজুন: "search", ক্লাউড: "cloud", আপডেট: "refresh-cw", মোবাইল: "smartphone", ফোন: "smartphone", অ্যাপ: "smartphone", ওয়েবসাইট: "globe", অনলাইন: "globe",
  ফাইল: "file-text", ডকুমেন্ট: "file-text", কাগজপত্র: "file-text", চুক্তি: "file-signature", লক্ষ্য: "target", টার্গেট: "target", টার্গেটিং: "target", ক্যাম্পেইন: "megaphone", বিজ্ঞাপন: "megaphone", অ্যাড: "megaphone",
  লঞ্চ: "rocket", ভিডিও: "play", ছবি: "image", কনটেন্ট: "image", রেটিং: "star", রিভিউ: "star", পুরস্কার: "trophy", আইডিয়া: "lightbulb", শিক্ষা: "graduation-cap", কোর্স: "graduation-cap",
  // people: the outline of a person or people (the owner's rule: the picture is the word said)
  বয়স: "user-round", জেন্ডার: "venus-and-mars", লিঙ্গ: "venus-and-mars", মানুষ: "users", লোক: "users", লোকজন: "users", টিম: "users", কর্মী: "users", ফলোয়ার: "users", কমিউনিটি: "users-round", লিড: "user-plus", ইউজার: "user-round",
  // ("দিন" alone is also "give" — "তথ্য দিন": only the day's own forms are the sun)
  দিনের: "sun", দিনে: "sun", প্রতিদিন: "sun", সারাদিন: "sun", রাত: "moon", সপ্তাহ: "calendar-days", মাস: "calendar", বছর: "calendar", সকাল: "sun", বিকাল: "sun", সন্ধ্যা: "moon",
  ভিউ: "eye", ইমপ্রেশন: "eye", দেখা: "eye", রিচ: "radio-tower", শেয়ার: "share-2", কমেন্ট: "message-square", লাইক: "heart", পোস্ট: "image",
  লস: "trending-down", ক্ষতি: "trending-down", কমে: "trending-down", সমস্যা: "triangle-alert", ঝুঁকি: "triangle-alert", প্রশ্ন: "circle-help", সমাধান: "lightbulb",
  বিশ্বাস: "shield-check", ট্রাস্ট: "shield-check", কোয়ালিটি: "badge-check", প্রতিযোগী: "swords", কম্পিটিটর: "swords", সেবা: "concierge-bell", সার্ভিস: "concierge-bell", অফিস: "building-2", কোম্পানি: "building-2", প্রতিষ্ঠান: "building-2",
  মিটিং: "presentation", ট্রেনিং: "graduation-cap", চাকরি: "briefcase", ব্যাংক: "landmark", লোন: "landmark", বিনিয়োগ: "coins", ইনভেস্ট: "coins", বিকাশ: "wallet",
  ডিজাইন: "palette", ক্রিয়েটিভ: "palette", কপিরাইটিং: "pen-line", লেখা: "pen-line", ক্যামেরা: "camera", ফটো: "camera", কল: "phone-call", হোয়াটসঅ্যাপ: "message-circle", অ্যাক্টিভ: "activity", আগ্রহ: "heart", আগ্রহী: "heart", পছন্দ: "heart",
  অডিয়েন্স: "users", কাস্টমার: "user-round", গ্রাহক: "user-round", ক্রেতা: "user-round", ভিজিটর: "users", ক্লিক: "mouse-pointer-click", পেজ: "file", ল্যান্ডিং: "file",
  পারচেজ: "shopping-bag", কেনাকাটা: "shopping-bag", ইকমার্স: "shopping-bag", রিটার্ন: "undo-2", ক্যানসেল: "circle-x", বাতিল: "circle-x", কনভার্শন: "repeat", ফানেল: "filter",
  স্কেল: "trending-up", শতাংশ: "percent", সিদ্ধান্ত: "signpost", ডিসিশন: "signpost", অনুমান: "circle-help", মার্কেটিং: "megaphone", কপি: "file-text", বিজনেস: "briefcase", ব্যবসা: "briefcase", ব্যবসায়: "briefcase",
  লোকেশন: "map-pin", এলাকা: "map-pin", ঠিকানা: "map-pin", দোকান: "store", শপ: "store", রেস্টুরেন্ট: "utensils", খাবার: "utensils", স্বাস্থ্য: "heart-pulse", ঘর: "house", বাড়ি: "house",
};
// the word as written ("Invoices," "AI-powered") made a key: lower case, letters only
const keyOf = (word: string) => word.toLowerCase().replace(/[’']s$/, "").replace(/[^a-z]+/g, "");
export const wordIcon = (word: string): string | null => WORD_ICONS[keyOf(word)] ?? (stemsBn(word).map((s) => BN_ICONS[s]).find(Boolean) ?? null);
export const WORD_ICON_NAMES = [...new Set([...Object.values(WORD_ICONS), ...Object.values(BN_ICONS)])];
