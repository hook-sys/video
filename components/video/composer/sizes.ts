import type { PlacedItem, TransitionKind } from "./types";

// Sizes and durations the layout needs on the server (no React here): each
// thing's natural size, and how long each way into a scene takes.

export const CARD_W = 640;
export function cardHeight(variant: string, rows: number): number {
  const n = Math.max(1, rows);
  switch (variant) {
    case "notify": return 120 + Math.min(3, n) * 112;
    case "kpi": return 120 + Math.ceil(Math.min(4, n) / 2) * 150;
    case "calendar": return 470;
    case "kanban": return 440;
    case "pay": return 470;
    case "profile": return 420;
    case "doc": return 480;
    case "chat": return 130 + Math.min(5, n) * 92;
    case "form": return 150 + Math.min(4, n) * 96 + 90;
    case "invoice": return 230 + Math.min(4, n) * 62 + 80;
    case "search": return 170 + Math.min(4, n) * 82;
    default: return 120 + Math.min(6, n) * 84;
  }
}

export function baseSize(it: Pick<PlacedItem, "kind" | "variant" | "rows" | "title" | "sub" | "value" | "screen">): [number, number] {
  const n = Math.max(1, it.rows?.length ?? 0);
  switch (it.kind) {
    case "icon": return it.title ? [320, 340] : [240, 240];
    case "chips": return it.variant === "row" ? [Math.min(4, n) * 330, 110] : [600, n * 96 + (n - 1) * 16];
    case "stat": return [640, it.sub ? 360 : 300];
    case "chart": return it.variant === "ring" || it.variant === "donut" ? [560, 560] : [720, 480];
    case "card": return [CARD_W, cardHeight(it.variant ?? "list", it.rows?.length ?? 3)];
    case "device":
      if (it.variant === "browser") return [1120, 720];
      if (it.variant === "laptop") return [1240, 780];
      if (it.variant === "tablet") return [900, 660];
      if (it.variant === "watch") return [300, 380];
      return [420, 860];
    case "screenshot": return [1120, 720];
    case "logo": return [1000, it.sub ? 400 : 300];
    case "button": return [760, it.sub ? 250 : 190];
    case "compare": return [1080, 120 + Math.min(4, n) * 86 + 40];
    case "flow":
      if (it.variant === "hub" || it.variant === "ring") return [920, 720];
      if (it.variant === "fan" || it.variant === "merge") return [1100, Math.max(420, Math.min(5, n) * 150)];
      return [Math.min(5, n) * 250 + (Math.min(5, n) - 1) * 80, 330];
    case "steps": return [Math.min(4, n) * 330, 330];
    case "avatars": return [600, 150];
    case "badge": return [Math.max(260, 120 + ((it.title ?? it.value ?? "").length * 17)), 96];
    case "quote": return [820, 400];
    case "cursor": return [90, 90];
    default: return [420, 420];
  }
}

// frames a scene takes to come in, by its way in
export const TRANSITION_FRAMES: Record<TransitionKind, number> = { blur: 16, fade: 14, "push-left": 22, "push-right": 22, "push-up": 22, "push-down": 22, "zoom-in": 20, "zoom-out": 20, whip: 14, iris: 26, wipe: 22, flip: 30, morph: 20, drop: 20, clock: 36 };
