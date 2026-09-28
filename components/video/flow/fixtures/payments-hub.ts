import { smoothCamera } from "../compile";
import { Flow, TILT } from "../patterns";
import type { ThemeName } from "../types";

// Second reference (15 s): exercises the 3D UI plane, the iris transition and
// the orbit pattern in one continuous piece, like the SaaS references.
//
// "Every payment starts in one clear dashboard. Approve in a click, with smart
//  routing built in. Then connect your bank, cards and tools, all secured in
//  one place. One hub for every payment."
export function paymentsHubPlan(theme: ThemeName = "lavender") {
  const f = new Flow(theme, 450, { center: [-220, -60], zoom: 1.22 });

  // 1 · The product UI, tilted like a desk shot; the camera glides across it,
  //     then the plane swings up to face the viewer.
  const ui = f
    .ui("dashboard", [0, 0], {
      w: 1240,
      h: 720,
      title: "Payments",
      rows: [
        { icon: "store", text: "Order #1042", value: "$240.00", status: "Paid" },
        { icon: "truck", text: "Supplier invoice", value: "$1,860.00", status: "Review" },
        { icon: "users", text: "Payroll · March", value: "$12,400", status: "Scheduled" },
        { icon: "repeat", text: "Subscription renewal", value: "$49.00", status: "Paid" },
        { icon: "landmark", text: "Tax transfer", value: "$3,120.00", status: "Queued" },
      ],
      tilt: TILT.iso,
    })
    .enter(0, { dur: 20, scale: 1 });
  f.camera(0, 100, [140, 20], 1.0, "inOut");
  ui.tilt(40, 44, TILT.hero, "inOut");

  // 2 · "Approve in a click, with smart routing built in."
  ui.cursorTo(62, 1, [0.95, 0.95]).cursorTo(64, 22, [0.78, 0.3]).click(90).lift(92, 1, 150);
  ui.callout(100, [0.97, 0.3], "Approved in one click", { icon: "mouse-pointer-click", side: "right" });
  ui.callout(118, [0.07, 0.66], "Smart routing", { icon: "route", side: "left" });
  f.camera(96, 50, [230, 0], 0.9);

  // 3 · Iris: the whole dashboard closes into the hub.
  const hub = f.orb("hub", [0, 0], { size: 250, icon: "wallet", variant: "solid" });
  f.camera(146, 30, [0, 0], 1.0);
  f.iris(152, 28, [ui], hub);
  hub.pulse(182).label(190, "Payments hub").label(232, "");

  // 4 · "Then connect your bank, cards and tools, all secured in one place."
  const sats = [
    f.orb("bank", [0, 0], { size: 132, icon: "landmark" }),
    f.orb("cards", [0, 0], { size: 132, icon: "credit-card" }),
    f.orb("tools", [0, 0], { size: 132, icon: "blocks" }),
    f.orb("cloud", [0, 0], { size: 132, icon: "cloud" }),
    f.orb("secure", [0, 0], { size: 132, icon: "shield-check" }),
  ];
  f.orbitAround(hub, sats, 196, { radius: 360, speed: 0.32, stagger: 6 });
  sats.forEach((s, i) => f.connect(hub, s, 214 + i * 6, { dur: 12, success: 262 + i * 3 }));
  sats[4].confirm(250, 14);
  hub.confirm(268, 16);
  f.camera(190, 90, [0, 20], 0.92);

  // 5 · "One hub for every payment."
  f.camera(300, 44, [0, 150], 0.78, "inOut");
  f.text("One hub for every payment.", 330, 450, { pos: [0, 380], size: 88, accent: "every payment." });

  return smoothCamera(f.build());
}
