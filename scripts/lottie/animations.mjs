// Our own micro-animations (200×200, 30 fps). Each entry: category, whether
// it loops, a one-line description for the Visual Director, and a builder.
// Colours are palette roles, so every animation follows the video's theme.

import { animation, bez, colorKf, ellipse, fill, group, icon, kf, layer, rect, stack, stroke, svgToBeziers, trim } from "./lib.mjs";

// ── helpers ─────────────────────────────────────────────────────────────────
const C = [100, 100];
const shape = (d) => svgToBeziers(d).map(bez);
// Keyframes that hold the first value until the first time.
const at = (frames) => kf(frames[0][0] > 0 ? [[0, frames[0][1], "hold"], ...frames] : frames);
const pop = (t, d = 12, to = 100, ease = "back") => at([[t, [0, 0], ease], [t + d, [to, to]]]);
const fadeIn = (t, d = 8) => at([[t, 0, "out"], [t + d, 100]]);
const draw = (t, d = 14, ease = "out") => at([[t, 0, ease], [t + d, 100]]);
// Deterministic pseudo-random (so every build is identical).
const rand = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const radial = (n, r0, r1, center = C, rot = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return `M${center[0] + Math.cos(a) * r0} ${center[1] + Math.sin(a) * r0}L${center[0] + Math.cos(a) * r1} ${center[1] + Math.sin(a) * r1}`;
  }).join("");
const burst = (t, color = "gold", n = 8, r0 = 62, r1 = 84, center = C) =>
  layer([group([...shape(radial(n, r0, r1, center, -Math.PI / 2)), trim(at([[t + 4, 0, "out"], [t + 16, 100]]), at([[t + 8, 0, "out"], [t + 20, 100]])), stroke(color, 6)])]);
const checkBadge = (t, pos = [140, 132], size = 44, color = "success") => [
  layer([group([ellipse(size), fill(color)], { p: pos, s: pop(t) })]),
  layer([group([...shape(`M${pos[0] - size * 0.2} ${pos[1] + 1}L${pos[0] - size * 0.04} ${pos[1] + size * 0.16}L${pos[0] + size * 0.22} ${pos[1] - size * 0.14}`), trim(draw(t + 6, 10)), stroke("white", size * 0.12)])]),
];
const loopScale = (frames) => kf(frames);
const star4 = (r) => `M0 ${-r}C${r * 0.1} ${-r * 0.2} ${r * 0.2} ${-r * 0.1} ${r} 0C${r * 0.2} ${r * 0.1} ${r * 0.1} ${r * 0.2} 0 ${r}C${-r * 0.1} ${r * 0.2} ${-r * 0.2} ${r * 0.1} ${-r} 0C${-r * 0.2} ${-r * 0.1} ${-r * 0.1} ${-r * 0.2} 0 ${-r}Z`;

// ── catalogue ───────────────────────────────────────────────────────────────
export const ANIMATIONS = {
  // Status & feedback
  "success-check": {
    category: "status", loop: false, description: "Circle draws, fills, and a check mark draws on: success, done, confirmed.",
    build: () => animation({ name: "success-check", frames: 50, layers: [
      layer([ellipse(120, C), trim(draw(0, 16)), stroke("primary", 8)]),
      layer([group([ellipse(120), fill("primary")], { p: C, s: pop(12) })]),
      layer([...shape("M70 102L92 122L132 80"), trim(draw(20, 14)), stroke("white", 12)]),
    ] }),
  },
  "error-x": {
    category: "status", loop: false, description: "Red disc pops, an X draws and shakes: error, failed, rejected.",
    build: () => animation({ name: "error-x", frames: 50, layers: [
      layer(stack(group([ellipse(120), fill("danger")], { p: C, s: pop(0) }), group([...shape("M78 78L122 122M122 78L78 122"), trim(draw(10, 12)), stroke("white", 12)])),
        { r: at([[24, 0], [28, -10], [32, 8], [36, -5], [40, 0]]) }),
    ] }),
  },
  "warning-pulse": {
    category: "status", loop: true, description: "Warning triangle with a pulsing ring: attention, risk, alert.",
    build: () => animation({ name: "warning-pulse", frames: 60, layers: [
      layer([group([ellipse(110), stroke("warning", 6)], { p: C, s: kf([[0, [90, 90], "out"], [40, [170, 170]]]), o: kf([[0, 80, "out"], [40, 0]]) })]),
      layer([icon("triangle-alert", { size: 96, color: "warning", width: 2.2, s: loopScale([[0, [100, 100]], [15, [108, 108]], [30, [100, 100]], [45, [108, 108]], [59, [100, 100]]]) })]),
    ] }),
  },
  "info-pop": {
    category: "status", loop: false, description: "Soft disc pops and an info mark draws: tip, note, information.",
    build: () => animation({ name: "info-pop", frames: 40, layers: [
      layer([group([ellipse(130), fill("soft")], { p: C, s: pop(0) })]),
      layer([icon("info", { size: 96, color: "primary", width: 2.2, draw: draw(8, 18) })]),
    ] }),
  },
  "loading-spinner": {
    category: "status", loop: true, description: "Arc spinning around a soft track: loading, processing, working.",
    build: () => animation({ name: "loading-spinner", frames: 30, layers: [
      layer([ellipse(110, C), stroke("soft", 10)]),
      layer([ellipse(110, C), trim(28), stroke("primary", 10)], { r: kf([[0, 0, "linear"], [30, 360]]) }),
    ] }),
  },
  "dots-loader": {
    category: "status", loop: true, description: "Three dots bouncing in sequence: waiting, thinking, loading.",
    build: () => animation({ name: "dots-loader", frames: 30, layers: [64, 100, 136].map((x, i) =>
      layer([ellipse(22, [x, 100]), fill(i === 1 ? "accent" : "primary")], { p: at([[i * 4, [100, 100], "out"], [i * 4 + 7, [100, 80], "in"], [i * 4 + 14, [100, 100]]]) })) }),
  },
  "bars-loader": {
    category: "status", loop: true, description: "Four bars pulsing up and down: audio, activity, processing.",
    build: () => animation({ name: "bars-loader", frames: 30, layers: [58, 86, 114, 142].map((x, i) =>
      layer([group([rect([16, 70], 8), fill(i % 2 ? "accent" : "primary")], { p: [x, 100], s: at([[i * 3, [100, 40], "inOut"], [i * 3 + 8, [100, 100], "inOut"], [i * 3 + 16, [100, 40]]]) })])) }),
  },
  "progress-ring": {
    category: "status", loop: false, description: "Ring fills all the way round: progress, completion, 100%.",
    build: () => animation({ name: "progress-ring", frames: 60, layers: [
      layer([ellipse(130, C), stroke("soft", 12)]),
      layer([ellipse(130, C), trim(at([[4, 0, "inOut"], [50, 100]])), stroke("primary", 12)]),
    ] }),
  },
  "pulse-ring": {
    category: "status", loop: true, description: "Rings ripple out from a dot: live, broadcasting, active.",
    build: () => animation({ name: "pulse-ring", frames: 60, layers: [
      ...[0, 10, 20].map((t) => layer([group([ellipse(60), stroke("primary", 4)], { p: C, s: at([[t, [100, 100], "out"], [t + 40, [300, 300]]]), o: at([[t, 100, "out"], [t + 40, 0]]) })])),
      layer([ellipse(30, C), fill("primary")]),
    ] }),
  },
  "radar-ping": {
    category: "status", loop: true, description: "Dot with an expanding ping: location found, signal, online.",
    build: () => animation({ name: "radar-ping", frames: 45, layers: [
      layer([group([ellipse(24), fill("accent")], { p: C, s: kf([[0, [100, 100], "out"], [40, [500, 500]]]), o: kf([[0, 60, "out"], [40, 0]]) })]),
      layer([ellipse(24, C), fill("accent")]),
    ] }),
  },
  "badge-pop": {
    category: "status", loop: false, description: "Verified badge pops with a spark burst: verified, approved, quality.",
    build: () => animation({ name: "badge-pop", frames: 45, layers: [
      burst(8, "primary"),
      layer([icon("badge-check", { size: 110, color: "primary", width: 2.2, s: pop(0, 14) })]),
    ] }),
  },
  "star-burst": {
    category: "status", loop: false, description: "Gold star pops with rays: rating, favourite, top pick.",
    build: () => animation({ name: "star-burst", frames: 45, layers: [
      burst(8, "gold", 10, 64, 86),
      layer([icon("star", { size: 104, color: "gold", fillColor: "gold", width: 2, s: pop(0, 14) })]),
    ] }),
  },

  // Celebration
  "confetti-burst": {
    category: "celebration", loop: false, description: "Confetti bursts out and falls: celebration, launch, win.",
    build: () => animation({ name: "confetti-burst", frames: 60, layers: Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2 + rand(i) * 0.3;
      const d = 55 + rand(i + 7) * 35;
      const [x, y] = [100 + Math.cos(a) * d, 100 + Math.sin(a) * d - 20];
      const color = ["primary", "accent", "gold", "danger", "success"][i % 5];
      const piece = i % 2 ? rect([8, 14], 2) : ellipse(10);
      return layer([group([piece, fill(color)], {
        p: kf([[0, C, "out"], [22, [x, y], "in"], [60, [x + (rand(i + 3) - 0.5) * 20, y + 60]]]),
        r: kf([[0, 0, "linear"], [60, (rand(i + 11) - 0.5) * 720]]),
        o: kf([[0, 100, "hold"], [42, 100, "linear"], [60, 0]]),
      })]);
    }) }),
  },
  "sparkle-twinkle": {
    category: "celebration", loop: true, description: "Three sparkles twinkle in turn: magic, AI, new, premium.",
    build: () => animation({ name: "sparkle-twinkle", frames: 60, layers: [[[78, 88], 34, "primary", 0], [[134, 66], 20, "accent", 14], [[128, 134], 24, "gold", 28]].map(([p, r, color, t]) =>
      layer([group([...shape(star4(r)), fill(color)], { p, s: at([[t, [0, 0], "out"], [t + 14, [100, 100], "in"], [t + 28, [0, 0]]]), r: at([[t, 0, "linear"], [t + 28, 90]]) })])) }),
  },
  fireworks: {
    category: "celebration", loop: false, description: "Two firework bursts: celebration, milestone, success.",
    build: () => animation({ name: "fireworks", frames: 60, layers: [[[72, 80], 0, "primary"], [[134, 118], 14, "gold"]].map(([c, t, color]) =>
      layer([group([...shape(radial(10, 10, 44, c)), trim(at([[t, 0, "out"], [t + 14, 100]]), at([[t + 8, 0, "out"], [t + 26, 100]])), stroke(color, 5)])])) }),
  },
  "heart-like": {
    category: "celebration", loop: false, description: "Heart fills and pops with a ring: like, love, favourite.",
    build: () => animation({ name: "heart-like", frames: 45, layers: [
      layer([group([ellipse(80), stroke("danger", 6)], { p: C, s: at([[6, [0, 0], "out"], [24, [180, 180]]]), o: at([[6, 100, "out"], [24, 0]]) })]),
      burst(10, "danger", 6, 70, 86),
      layer([icon("heart", { size: 104, color: "danger", fillColor: "danger", width: 2, s: at([[0, [0, 0], "back"], [12, [118, 118], "inOut"], [20, [100, 100]]]) })]),
    ] }),
  },

  // UI interaction
  "cursor-click": {
    category: "ui", loop: false, description: "Cursor glides in and clicks with a ripple: click, select, try it.",
    build: () => animation({ name: "cursor-click", frames: 50, layers: [
      layer([group([ellipse(30), stroke("primary", 4)], { p: [77, 77], s: at([[24, [0, 0], "out"], [42, [140, 140]]]), o: at([[24, 100, "out"], [42, 0]]) })]),
      layer([icon("mouse-pointer", { size: 70, color: "ink", fillColor: "white", width: 1.8, pos: kf([[0, [160, 160], "out"], [20, [100, 100]]]), s: at([[22, [100, 100], "inOut"], [26, [85, 85], "out"], [32, [100, 100]]]) })]),
    ] }),
  },
  "button-press": {
    category: "ui", loop: false, description: "Button presses and its label becomes a check: submit, buy, confirm.",
    build: () => animation({ name: "button-press", frames: 45, layers: [
      layer([group([rect([140, 56], 28), fill("primary")], { p: C, s: at([[10, [100, 100], "inOut"], [15, [92, 92], "out"], [24, [100, 100]]]) })]),
      layer([group([rect([64, 10], 5), fill("white", 90)], { p: C, o: at([[18, 100, "out"], [24, 0]]) })]),
      layer([...shape("M88 100L97 109L114 91"), trim(draw(24, 12)), stroke("white", 7)]),
    ] }),
  },
  "toggle-on": {
    category: "ui", loop: false, description: "Switch slides on and turns colour: enable, activate, turn on.",
    build: () => animation({ name: "toggle-on", frames: 36, layers: [
      layer([rect([104, 58], 29, C), fill(colorKf([[8, "soft", "inOut"], [20, "primary"]]))]),
      layer([group([ellipse(46), fill("white")], { p: at([[6, [74, 100], "back"], [20, [126, 100]]]) })]),
    ] }),
  },
  "checkbox-tick": {
    category: "ui", loop: false, description: "Checkbox fills and ticks: task done, selected, agreed.",
    build: () => animation({ name: "checkbox-tick", frames: 36, layers: [
      layer([rect([84, 84], 20, C), stroke("soft", 6)]),
      layer([group([rect([84, 84], 20), fill("primary")], { p: C, s: at([[4, [60, 60], "back"], [16, [100, 100]]]), o: at([[4, 0, "out"], [8, 100]]) })]),
      layer([...shape("M80 100L94 114L122 86"), trim(draw(12, 14)), stroke("white", 10)]),
    ] }),
  },
  "typing-dots": {
    category: "ui", loop: true, description: "Chat bubble with typing dots: replying, AI answering, chat.",
    build: () => animation({ name: "typing-dots", frames: 36, layers: [
      layer([rect([124, 72], 36, C), fill("soft")]),
      ...[76, 100, 124].map((x, i) => layer([ellipse(14, [x, 100]), fill("primary")], { p: at([[i * 5, [100, 100], "out"], [i * 5 + 8, [100, 86], "in"], [i * 5 + 16, [100, 100]]]) })),
    ] }),
  },
  "notification-bell": {
    category: "ui", loop: false, description: "Bell rings and a badge dot pops: notification, reminder, alert.",
    build: () => animation({ name: "notification-bell", frames: 45, layers: [
      layer([icon("bell", { size: 104, color: "ink", width: 2, r: at([[0, 0], [6, 14], [12, -12], [18, 9], [24, -6], [30, 0]]) })]),
      layer([group([ellipse(26), fill("danger")], { p: [132, 66], s: pop(24, 10) })]),
    ] }),
  },
  "search-scan": {
    category: "ui", loop: true, description: "Magnifier sweeps over content: search, discover, find.",
    build: () => animation({ name: "search-scan", frames: 60, layers: [
      ...[62, 84, 106, 128].map((y, i) => layer([rect([i === 3 ? 70 : 110, 10], 5, [i === 3 ? 80 : 100, y]), fill("soft")])),
      layer([icon("search", { size: 78, color: "primary", width: 2.4, pos: kf([[0, [72, 82]], [20, [128, 92]], [40, [96, 124]], [60, [72, 82]]]) })]),
    ] }),
  },
  "upload-arrow": {
    category: "ui", loop: true, description: "Arrow rises out of a tray: upload, publish, send data.",
    build: () => animation({ name: "upload-arrow", frames: 40, layers: [
      layer([...shape("M58 118V144H142V118"), stroke("ink", 8)]),
      layer([...shape("M100 124V62M76 86L100 62L124 86"), stroke("primary", 8)], { p: kf([[0, [100, 116], "out"], [26, [100, 96], "in"], [40, [100, 90]]]), o: kf([[0, 0, "out"], [8, 100, "hold"], [28, 100, "in"], [40, 0]]) }),
    ] }),
  },
  "download-arrow": {
    category: "ui", loop: true, description: "Arrow drops into a tray: download, receive, import.",
    build: () => animation({ name: "download-arrow", frames: 40, layers: [
      layer([...shape("M58 118V144H142V118"), stroke("ink", 8)]),
      layer([...shape("M100 60V122M76 98L100 122L124 98"), stroke("primary", 8)], { p: kf([[0, [100, 84], "out"], [26, [100, 104], "in"], [40, [100, 110]]]), o: kf([[0, 0, "out"], [8, 100, "hold"], [28, 100, "in"], [40, 0]]) }),
    ] }),
  },
  "refresh-spin": {
    category: "ui", loop: true, description: "Refresh arrows spin: sync, update, retry, automation.",
    build: () => animation({ name: "refresh-spin", frames: 40, layers: [
      layer([icon("refresh-cw", { size: 104, color: "primary", width: 2.2, r: kf([[0, 0, "inOut"], [40, 360]]) })]),
    ] }),
  },

  // Commerce, payments, delivery
  "cart-add": {
    category: "commerce", loop: false, description: "A box drops into a cart that bounces, badge pops: add to cart, order.",
    build: () => animation({ name: "cart-add", frames: 50, layers: [
      layer([group([rect([28, 28], 4), fill("primary")], { p: kf([[0, [112, 20], "in"], [20, [106, 96]]]), o: kf([[0, 100, "hold"], [20, 100, "linear"], [23, 0]]) })]),
      layer([icon("shopping-cart", { size: 104, color: "ink", width: 2, pos: [100, 112], s: at([[20, [100, 100], "out"], [25, [110, 90], "back"], [34, [100, 100]]]) })]),
      layer([group([ellipse(26), fill("accent")], { p: [146, 70], s: pop(30, 10) })]),
    ] }),
  },
  "card-swipe": {
    category: "payments", loop: false, description: "Card slides in and gets a success tick: card payment accepted.",
    build: () => animation({ name: "card-swipe", frames: 50, layers: [
      layer(stack(group([rect([128, 82], 12), fill("primary")]), group([rect([128, 14], 0, [0, -16]), fill("ink", 70)]), group([rect([34, 10], 5, [-34, 20]), fill("white", 80)])),
        { p: kf([[0, [-40, 100], "out"], [18, [100, 100]]]), a: [0, 0], r: kf([[0, -12, "out"], [18, 0]]) }),
      ...checkBadge(22, [146, 134], 46),
    ] }),
  },
  "coin-stack": {
    category: "payments", loop: false, description: "Three coins drop and stack: savings, revenue, earnings, rewards.",
    build: () => animation({ name: "coin-stack", frames: 50, layers: [[146, 128, 110].map((y, i) => layer(stack(group([ellipse([78, 26]), fill("gold")]), group([ellipse([78, 26]), stroke("#D97706", 4)])), {
      p: at([[i * 9, [100, -30], "in"], [i * 9 + 14, [100, y], "out"], [i * 9 + 18, [100, y - 5], "in"], [i * 9 + 22, [100, y]]]), a: [0, 0],
    }))].flat() }),
  },
  "payment-success": {
    category: "payments", loop: false, description: "Card icon with a success badge: payment confirmed, paid.",
    build: () => animation({ name: "payment-success", frames: 45, layers: [
      layer([icon("credit-card", { size: 116, color: "ink", width: 2, s: pop(0, 12) })]),
      ...checkBadge(14, [142, 134], 48),
    ] }),
  },
  "package-drop": {
    category: "delivery", loop: false, description: "Parcel drops in and squashes on landing: shipped, packed, order ready.",
    build: () => animation({ name: "package-drop", frames: 45, layers: [
      layer([group([ellipse([92, 14]), fill("ink", 15)], { p: [100, 156], s: at([[0, [30, 30], "in"], [16, [100, 100]]]) })]),
      layer([icon("package", { size: 104, color: "primary", width: 2, pos: kf([[0, [100, -60], "in"], [16, [100, 102]]]), s: at([[16, [100, 100], "out"], [20, [116, 86], "inOut"], [26, [96, 104], "inOut"], [32, [100, 100]]]) })]),
    ] }),
  },
  "gift-bounce": {
    category: "commerce", loop: false, description: "Gift shakes, then pops with sparkles: reward, offer, surprise.",
    build: () => animation({ name: "gift-bounce", frames: 50, layers: [
      burst(24, "gold", 8, 64, 84),
      layer([icon("gift", { size: 104, color: "primary", width: 2, r: at([[0, 0], [4, -8], [8, 8], [12, -6], [16, 6], [20, 0]]), s: at([[22, [100, 100], "out"], [28, [124, 124], "inOut"], [36, [100, 100]]]) })]),
    ] }),
  },
  "truck-drive": {
    category: "delivery", loop: true, description: "Delivery truck bobbing with speed lines: shipping, on the way.",
    build: () => animation({ name: "truck-drive", frames: 40, layers: [
      layer([...shape("M22 86H56M12 104H48M26 122H58"), trim(at([[0, 0, "linear"], [20, 100]]), at([[10, 0, "linear"], [30, 100]])), stroke("soft", 6)]),
      layer([icon("truck", { size: 112, color: "ink", width: 2, pos: kf([[0, [112, 102], "inOut"], [10, [112, 98], "inOut"], [20, [112, 102], "inOut"], [30, [112, 98], "inOut"], [40, [112, 102]]]) })]),
    ] }),
  },
  "map-pin-drop": {
    category: "delivery", loop: false, description: "Pin drops onto the map with a ripple: location, destination, store.",
    build: () => animation({ name: "map-pin-drop", frames: 45, layers: [
      layer([group([ellipse([40, 12]), stroke("primary", 4)], { p: [100, 150], s: at([[16, [0, 0], "out"], [38, [300, 300]]]), o: at([[16, 100, "out"], [38, 0]]) })]),
      layer([group([ellipse([34, 10]), fill("ink", 18)], { p: [100, 150], s: at([[0, [20, 20], "in"], [16, [100, 100]]]) })]),
      layer([icon("map-pin", { size: 100, color: "primary", fillColor: "soft", width: 2, pos: at([[0, [100, -40], "in"], [16, [100, 104], "out"], [21, [100, 96], "in"], [26, [100, 104]]]) })]),
    ] }),
  },
  "route-draw": {
    category: "delivery", loop: false, description: "A dashed route draws from start to a destination pin: journey, tracking.",
    build: () => animation({ name: "route-draw", frames: 50, layers: [
      layer([...shape("M40 150C74 150 60 96 100 96C140 96 128 58 160 58"), trim(draw(0, 32, "inOut")), stroke("primary", 6, 100, [10, 10])]),
      layer([ellipse(16, [40, 150]), fill("primary")]),
      layer([icon("map-pin", { size: 48, color: "accent", fillColor: "accent", width: 2, pos: [160, 42], s: pop(30, 12) })]),
    ] }),
  },
  "delivery-done": {
    category: "delivery", loop: false, description: "Parcel slides to the door, check badge pops: delivered.",
    build: () => animation({ name: "delivery-done", frames: 50, layers: [
      layer([icon("house", { size: 110, color: "ink", width: 2 })]),
      layer([icon("package", { size: 40, color: "primary", width: 2.4, pos: kf([[0, [190, 128], "out"], [20, [100, 126]]]), o: kf([[0, 100, "hold"], [20, 100, "linear"], [24, 0]]) })]),
      ...checkBadge(24, [146, 64], 44),
    ] }),
  },
  "receipt-print": {
    category: "payments", loop: false, description: "Receipt slides up and gets a tick: invoice, order summary, billing.",
    build: () => animation({ name: "receipt-print", frames: 45, layers: [
      layer([icon("receipt-text", { size: 108, color: "ink", width: 2, pos: kf([[0, [100, 140], "out"], [20, [100, 100]]]), o: fadeIn(0, 10) })]),
      ...checkBadge(22, [144, 136], 42),
    ] }),
  },
  "price-tag": {
    category: "commerce", loop: false, description: "Price tag swings on its hook: pricing, discount, sale.",
    build: () => animation({ name: "price-tag", frames: 45, layers: [
      layer([icon("tag", { size: 108, color: "primary", width: 2, r: at([[0, 0], [6, -18], [14, 12], [22, -7], [30, 4], [38, 0]]) })]),
    ] }),
  },

  // Data
  "bars-grow": {
    category: "data", loop: false, description: "Bars grow from a baseline one after another: growth, results, metrics.",
    build: () => animation({ name: "bars-grow", frames: 45, layers: [
      layer([...shape("M36 152H164"), stroke("soft", 4)]),
      ...[[56, 50], [86, 82], [116, 66], [146, 110]].map(([x, h], i) =>
        layer([group([rect([22, h], 6, [0, -h / 2]), fill(i === 3 ? "accent" : "primary")], { p: [x, 150], s: at([[i * 5, [100, 0], "back"], [i * 5 + 16, [100, 100]]]) })])),
    ] }),
  },
  "line-chart-draw": {
    category: "data", loop: false, description: "A rising line chart draws and marks its peak: trend, performance.",
    build: () => animation({ name: "line-chart-draw", frames: 50, layers: [
      layer([...shape("M40 40V160H170"), stroke("soft", 4)]),
      layer([...shape("M50 140L80 110L105 122L135 80L160 60"), trim(draw(4, 32, "inOut")), stroke("primary", 7)]),
      layer([group([ellipse(18), fill("accent")], { p: [160, 60], s: pop(34, 10) })]),
    ] }),
  },
  "pie-fill": {
    category: "data", loop: false, description: "Donut chart fills in three segments: share, breakdown, allocation.",
    build: () => animation({ name: "pie-fill", frames: 50, layers: [
      layer([ellipse(116, C), stroke("soft", 30)]),
      ...[[0, 45, "primary", 0], [45, 75, "accent", 12], [75, 100, "gold", 22]].map(([a, b, color, t]) =>
        layer([ellipse(116, C), trim(at([[t, a, "inOut"], [t + 16, b]]), a), stroke(color, 30)])),
    ] }),
  },
  "trend-up": {
    category: "data", loop: false, description: "Trending-up arrow draws and lifts: growth, increase, ROI.",
    build: () => animation({ name: "trend-up", frames: 45, layers: [
      layer([icon("trending-up", { size: 116, color: "success", width: 2.4, draw: draw(0, 26, "inOut"), pos: at([[0, [94, 106], "out"], [30, [100, 100]]]) })]),
    ] }),
  },
  "gauge-needle": {
    category: "data", loop: false, description: "Gauge fills and the needle swings high: score, speed, performance.",
    build: () => animation({ name: "gauge-needle", frames: 50, layers: [
      layer([...shape("M40 132A60 60 0 0 1 160 132"), stroke("soft", 14)]),
      layer([...shape("M40 132A60 60 0 0 1 160 132"), trim(at([[4, 0, "out"], [34, 80]])), stroke("primary", 14)]),
      layer([...shape("M100 132V84"), stroke("ink", 6)], { a: [100, 132], p: [100, 132], r: at([[4, -90, "back"], [34, 50]]) }),
      layer([ellipse(18, [100, 132]), fill("ink")]),
    ] }),
  },

  // Security & tech
  "shield-check": {
    category: "security", loop: false, description: "Shield draws, a check appears, it pulses: secure, protected, safe.",
    build: () => animation({ name: "shield-check", frames: 50, layers: [
      layer([icon("shield", { size: 116, color: "primary", fillColor: "soft", width: 2, draw: draw(0, 24, "inOut"), s: at([[36, [100, 100], "out"], [41, [108, 108], "inOut"], [48, [100, 100]]]) })]),
      layer([...shape("M82 100L96 114L120 88"), trim(draw(22, 14)), stroke("primary", 8)]),
    ] }),
  },
  "lock-secure": {
    category: "security", loop: false, description: "Padlock drops in with a green pulse: locked, encrypted, private.",
    build: () => animation({ name: "lock-secure", frames: 45, layers: [
      layer([group([ellipse(90), stroke("success", 5)], { p: C, s: at([[14, [80, 80], "out"], [38, [180, 180]]]), o: at([[14, 100, "out"], [38, 0]]) })]),
      layer([icon("lock", { size: 104, color: "ink", width: 2, pos: kf([[0, [100, 70], "out"], [14, [100, 100]]]), o: fadeIn(0, 8) })]),
    ] }),
  },
  "fingerprint-scan": {
    category: "security", loop: true, description: "Fingerprint with a scanning line: biometric, identity, sign in.",
    build: () => animation({ name: "fingerprint-scan", frames: 60, layers: [
      layer([icon("fingerprint-pattern", { size: 116, color: "primary", width: 1.8 })]),
      layer([rect([130, 4], 2, C), fill("accent")], { p: kf([[0, [100, 50]], [30, [100, 150]], [60, [100, 50]]]) }),
    ] }),
  },
  "gear-spin": {
    category: "tech", loop: true, description: "Two gears turning together: settings, automation, integration.",
    build: () => animation({ name: "gear-spin", frames: 60, layers: [
      layer([icon("settings", { size: 104, color: "primary", width: 2, pos: [88, 108], r: kf([[0, 0, "linear"], [60, 180]]) })]),
      layer([icon("cog", { size: 58, color: "accent", width: 2.4, pos: [152, 58], r: kf([[0, 0, "linear"], [60, -270]]) })]),
    ] }),
  },
  "cloud-sync": {
    category: "tech", loop: true, description: "Cloud with spinning sync arrows: cloud backup, syncing, SaaS.",
    build: () => animation({ name: "cloud-sync", frames: 60, layers: [
      layer([icon("cloud", { size: 136, color: "primary", fillColor: "soft", width: 1.8 })]),
      layer([icon("refresh-cw", { size: 42, color: "accent", width: 2.6, pos: [100, 110], r: kf([[0, 0, "linear"], [60, 360]]) })]),
    ] }),
  },
  "rocket-launch": {
    category: "tech", loop: false, description: "Rocket shakes and launches with a trail: launch, go live, boost.",
    build: () => animation({ name: "rocket-launch", frames: 50, layers: [
      layer([...shape("M60 160L100 100"), trim(at([[16, 0, "out"], [30, 100]]), at([[26, 0, "out"], [44, 100]])), stroke("gold", 8)]),
      layer([icon("rocket", { size: 88, color: "primary", width: 2, pos: at([[0, [96, 108]], [3, [100, 104]], [6, [96, 108]], [9, [100, 104]], [12, [98, 106], "in"], [36, [200, -10]]]) })]),
    ] }),
  },
  "ai-sparkle": {
    category: "tech", loop: true, description: "Wand with twinkling sparkles: AI, magic, auto-generate.",
    build: () => animation({ name: "ai-sparkle", frames: 60, layers: [
      layer([icon("wand-sparkles", { size: 108, color: "primary", width: 2 })]),
      ...[[[146, 60], 14, "gold", 0], [[58, 142], 10, "accent", 20], [[150, 132], 9, "gold", 36]].map(([p, r, color, t]) =>
        layer([group([...shape(star4(r)), fill(color)], { p, s: at([[t, [0, 0], "out"], [t + 12, [100, 100], "in"], [t + 24, [0, 0]]]) })])),
    ] }),
  },

  // Communication & time
  "send-plane": {
    category: "communication", loop: false, description: "Paper plane pulls back and shoots off with a trail: send, share, deliver.",
    build: () => animation({ name: "send-plane", frames: 45, layers: [
      layer([...shape("M60 140L150 50"), trim(at([[12, 0, "out"], [26, 100]]), at([[20, 0, "out"], [38, 100]])), stroke("soft", 6, 100, [8, 10])]),
      layer([icon("send", { size: 80, color: "primary", width: 2, pos: at([[0, [72, 128], "out"], [10, [62, 138], "in"], [30, [200, 0]]]), o: at([[26, 100, "linear"], [32, 0]]) })]),
    ] }),
  },
  "mail-arrive": {
    category: "communication", loop: false, description: "Envelope slides in and a badge dot pops: new email, message received.",
    build: () => animation({ name: "mail-arrive", frames: 45, layers: [
      layer([icon("mail", { size: 112, color: "ink", width: 2, pos: kf([[0, [260, 100], "out"], [18, [100, 100]]]) })]),
      layer([group([ellipse(26), fill("danger")], { p: [146, 66], s: pop(20, 10) })]),
    ] }),
  },
  "chat-pop": {
    category: "communication", loop: false, description: "Two chat bubbles pop in turn: conversation, support, messaging.",
    build: () => animation({ name: "chat-pop", frames: 45, layers: [
      layer(stack(group([rect([112, 46], 23), fill("soft")]), group([rect([62, 8], 4), fill("primary", 60)])), { p: [82, 76], a: [0, 0], s: pop(0, 12) }),
      layer(stack(group([rect([112, 46], 23), fill("primary")]), group([rect([62, 8], 4), fill("white", 85)])), { p: [118, 128], a: [0, 0], s: pop(14, 12) }),
    ] }),
  },
  "phone-ring": {
    category: "communication", loop: true, description: "Phone vibrates with call waves: call, support line, contact.",
    build: () => animation({ name: "phone-ring", frames: 40, layers: [
      layer([icon("phone", { size: 100, color: "primary", width: 2, r: kf([[0, 0], [3, -10], [6, 10], [9, -10], [12, 10], [15, 0, "hold"], [40, 0]]) })]),
      layer([...shape("M134 60A30 30 0 0 1 150 84M140 44A48 48 0 0 1 166 84"), trim(at([[2, 0, "out"], [14, 100]])), stroke("accent", 5)], { o: kf([[0, 100, "hold"], [18, 100, "linear"], [26, 0]]) }),
    ] }),
  },
  "clock-tick": {
    category: "time", loop: true, description: "Clock hands sweep round: time saved, scheduling, speed.",
    build: () => animation({ name: "clock-tick", frames: 60, layers: [
      layer([ellipse(130, C), stroke("ink", 8)]),
      layer([...shape("M100 100V56"), stroke("primary", 7)], { r: kf([[0, 0, "linear"], [60, 360]]) }),
      layer([...shape("M100 100H128"), stroke("ink", 7)], { r: kf([[0, 0, "linear"], [60, 30]]) }),
      layer([ellipse(14, C), fill("ink")]),
    ] }),
  },
  "hourglass-flip": {
    category: "time", loop: true, description: "Hourglass waits, then flips: waiting, time running, deadline.",
    build: () => animation({ name: "hourglass-flip", frames: 60, layers: [
      layer([icon("hourglass", { size: 104, color: "primary", width: 2, r: kf([[0, 0, "hold"], [34, 0, "back"], [50, 180]]) })]),
    ] }),
  },
  "calendar-check": {
    category: "time", loop: false, description: "Calendar with a check drawing on: booked, scheduled, confirmed date.",
    build: () => animation({ name: "calendar-check", frames: 45, layers: [
      layer([icon("calendar", { size: 116, color: "ink", width: 2, s: pop(0, 12) })]),
      layer([...shape("M82 118L96 132L122 104"), trim(draw(14, 14)), stroke("success", 8)]),
    ] }),
  },
  "users-join": {
    category: "people", loop: false, description: "People pop in one after another: team, community, sign-ups.",
    build: () => animation({ name: "users-join", frames: 45, layers: [[[58, 110], 0, "accent"], [[142, 110], 6, "accent"], [[100, 96], 12, "primary"]].map(([p, t, color]) =>
      layer([icon("user-round", { size: t === 12 ? 92 : 70, color, width: 2.2, fillColor: "white", pos: p, s: pop(t, 12) })])) }),
  },
};
