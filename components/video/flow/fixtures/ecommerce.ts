import { smoothCamera } from "../compile";
import { Flow } from "../patterns";
import type { ThemeName } from "../types";

// Hand-directed reference for the e-commerce script (15 s, 30 fps), built only
// from motion patterns — the quality bar the Visual Director must reach.
//
// "A customer places an order. The product is packed, the payment is
//  confirmed, and the package starts its journey. From one simple order to a
//  successful delivery, everything stays on track."
//
// One hero (the order) persists and transforms: bag → box → chain of steps →
// everything converges back into it for the resolve.
export function ecommercePlan(theme: ThemeName = "lavender") {
  const f = new Flow(theme, 450, { center: [-80, 0], zoom: 1.15 });

  // 1 · "A customer places an order." (0–70)
  const customer = f.orb("customer", [-620, 50], { size: 190, icon: "user-round" }).enter(4, { from: [-100, 0] });
  const hero = f.orb("order", [60, 0], { size: 320, icon: "shopping-bag", variant: "solid" }).enter(12);
  f.connect(customer, hero, 22, { dur: 16, bend: -80, packet: "mouse-pointer-click", packetDur: 20 });
  hero.pulse(46).label(48, "New order");
  f.camera(0, 70, [-120, 20], 1.02, "out");

  // 2 · "The product is packed," (70–130)
  customer.exit(70, { to: [-760, 50] });
  hero.morph(84, "package", "Packed");
  f.camera(70, 60, [50, 10], 1.1);

  // 3 · "the payment is confirmed," (130–195)
  hero.move(128, 26, [-500, 0]).resize(128, 26, 0.75).label(128, "Order");
  const paid = f.orb("paid", [20, 0], { size: 230, icon: "credit-card" }).enter(140);
  f.connect(hero, paid, 146, { dur: 14, packet: "circle-dollar-sign", packetDur: 18, success: 300 });
  paid.confirm(166, 18).label(186, "Paid");
  f.camera(126, 40, [-230, 0], 1.0);

  // 4 · "and the package starts its journey." (195–265)
  const ship = f.orb("ship", [540, -14], { size: 230, icon: "truck" }).enter(198);
  f.connect(paid, ship, 204, { dur: 14, packet: "package", packetDur: 18, success: 306 });
  ship.label(224, "Shipped");
  const home = f.orb("home", [1060, 14], { size: 230, icon: "house" }).enter(232);
  f.connect(ship, home, 236, { dur: 18, dashed: true, bend: 50, packet: "truck", packetDur: 26, success: 312 });
  f.camera(196, 70, [580, 0], 0.95);

  // 5 · "From one simple order to a successful delivery," (265–345)
  home.confirm(262, 12).label(276, "Delivered");
  f.lottie("confetti-burst", 272, 560, { node: home });
  f.camera(268, 44, [280, 0], 0.78, "inOut");
  hero.confirm(294, 16);
  ship.confirm(304, 16);

  // 6 · "everything stays on track." (345–450)
  f.converge([paid, ship, home], hero, 348, [280, -60]);
  hero.resize(348, 26, 1.1).label(348, "").morph(372, "circle-check-big");
  f.camera(346, 40, [280, 40], 1.0);
  f.text("Everything stays on track.", 386, 450, { pos: [0, 300], size: 96, accent: "on track." });

  return smoothCamera(f.build());
}
