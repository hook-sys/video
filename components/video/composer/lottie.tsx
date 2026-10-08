import { Sequence } from "remotion";
import { LottieAnim, type LottieName } from "../lottie";
import type { Ctx } from "./kit";

// Our own Lottie micro-animations (components/video/lottie) for the things
// they picture: an icon that has one plays it (a bell rings, a calendar is
// checked, a chart draws) in the video's colours, from the moment it comes in.
const BY_ICON: [RegExp, LottieName][] = [
  [/^bell/, "notification-bell"],
  [/^calendar/, "calendar-check"],
  [/^(check|circle-check|badge-check|check-circle|square-check)/, "success-check"],
  [/^(message|messages|bot-message)/, "chat-pop"],
  [/^(mail|inbox|mails)/, "mail-arrive"],
  [/^(search|scan-search|text-search)/, "search-scan"],
  [/^(trending-up|chart-line|chart-spline|line-chart)/, "line-chart-draw"],
  [/^(chart-column|chart-bar|bar-chart)/, "bars-grow"],
  [/^(chart-pie|pie-chart)/, "pie-fill"],
  [/^(cloud)/, "cloud-sync"],
  [/^(refresh|rotate|repeat)/, "refresh-spin"],
  [/^(shield)/, "shield-check"],
  [/^(lock|key)/, "lock-secure"],
  [/^(clock|timer|alarm)/, "clock-tick"],
  [/^hourglass/, "hourglass-flip"],
  [/^(settings|cog|wrench)/, "gear-spin"],
  [/^(shopping-cart|shopping-bag|cart)/, "cart-add"],
  [/^(sparkles|wand|bot)/, "ai-sparkle"],
  [/^send/, "send-plane"],
  [/^(credit-card|wallet|banknote|dollar-sign|circle-dollar-sign)/, "payment-success"],
  [/^(receipt|file-text)/, "receipt-print"],
  [/^(package|box)/, "package-drop"],
  [/^truck/, "truck-drive"],
  [/^map-pin/, "map-pin-drop"],
  [/^route/, "route-draw"],
  [/^rocket/, "rocket-launch"],
  [/^phone/, "phone-ring"],
  [/^tag/, "price-tag"],
  [/^(coins|piggy-bank|hand-coins)/, "coin-stack"],
  [/^gauge/, "gauge-needle"],
  [/^(toggle)/, "toggle-on"],
  [/^(list-checks|list-todo|square-check-big)/, "checkbox-tick"],
  [/^upload/, "upload-arrow"],
  [/^download/, "download-arrow"],
  [/^star/, "star-burst"],
  [/^gift/, "gift-bounce"],
  [/^heart/, "heart-like"],
  [/^zap/, "trend-up"],
];
export const lottieFor = (icon: string | null | undefined): LottieName | null => (icon ? (BY_ICON.find(([re]) => re.test(icon))?.[1] ?? null) : null);

export function LivingIcon({ c, name, size, at }: { c: Ctx; name: LottieName; size: number; at: number }) {
  const { pal } = c;
  return (
    <Sequence from={Math.round(at)} layout="none">
      <LottieAnim name={name} colors={{ primary: pal.fill, accent: pal.fill2, soft: pal.dark ? pal.panelSoft : pal.panelLine, ink: pal.panelDark ? pal.panelInk : pal.ink }} style={{ width: size, height: size }} />
    </Sequence>
  );
}
