import type { SceneBeat, SceneContent, SceneElement, SceneScript } from "@/lib/scene-script";
import type { WordTiming } from "@/lib/voice-timing";
import type { CompileBrand } from "../compile";

// SceneScripts (Director v2) in exactly the shape the Director returns, used to
// test the scene compiler.

type Fixture = { name: string; narration: string; durationSeconds: number; script: SceneScript; words?: WordTiming[]; brand?: CompileBrand; screenshots?: string[] };

const C = (c: Partial<SceneContent>): SceneContent => ({ title: null, subtitle: null, value: null, label: null, status: null, name: null, amount: null, delta: null, note: null, action: null, items: null, ...c });
const E = (id: string, asset: string | null, content?: Partial<SceneContent>, extra: Partial<SceneElement> = {}): SceneElement => ({ id, asset, content: content ? C(content) : null, screen: null, label: null, ...extra });
const B = (b: Partial<SceneBeat> & Pick<SceneBeat, "cue" | "action">): SceneBeat => ({
  elements: null,
  targets: null,
  to: null,
  layout: null,
  camera: null,
  transition: null,
  style: null,
  content: null,
  text: null,
  accent: null,
  text_layout: null,
  items: null,
  lottie: null,
  ...b,
});

export const SCENE_FIXTURES: Fixture[] = [
  {
    // The customer's own direction (Preview, 28 Sep): separate operations
    // scattered → an order travels and triggers inventory and courier →
    // everything assembles into one platform → automation erases busywork →
    // pull back to the connected system.
    name: "selorax",
    narration:
      "Run your entire e-commerce business from one connected platform. Manage orders, inventory, payments, couriers, and customers in one place. Let automation handle the busywork, reduce mistakes, and give you more time to grow your business with SeloraX.",
    durationSeconds: 15,
    brand: { name: "SeloraX", cta: "Start Your Free Trial" },
    script: {
      version: 2,
      theme: "teal",
      beats: [
        B({
          cue: "Run your entire e-commerce business",
          action: "scene",
          layout: "scatter-c",
          camera: "drift",
          transition: "cut",
          elements: [
            E("order", "card:order/glass", { title: "Order #1042", status: "New", amount: "৳4,800", label: "3 products" }),
            E("stock", "card:inventory/solid", { title: "Inventory", status: "Manual" }),
            E("msg", "card:message/glass", { name: "Customer", note: "Is my order shipped?" }),
            E("courier", "card:courier/solid", { title: "Courier request", status: "Waiting" }),
            E("books", "card:transactions/glass", { title: "Accounts" }),
          ],
        }),
        B({ cue: "from one connected platform.", action: "trigger", targets: ["order"], to: "stock", content: C({ status: "Updated" }) }),
        B({ cue: "Manage orders, inventory,", action: "connect", targets: ["stock"], to: "courier" }),
        B({ cue: "payments, couriers,", action: "update", targets: ["courier"], content: C({ title: "Courier", status: "Dispatched" }) }),
        B({
          cue: "and customers in one place.",
          action: "scene",
          layout: "mosaic",
          camera: "push-in",
          transition: "morph",
          elements: [E("stock", null), E("courier", null), E("msg", null), E("dash", "card:dashboard-mini/solid", { title: "SeloraX", value: "৳2.4M", label: "Revenue", delta: "+21%" })],
        }),
        B({ cue: "Let automation handle the busywork,", action: "scene", layout: "hero-left", camera: "pan-right", transition: "push-left", elements: [E("auto", "card:ai-automation/accent", { title: "Handled by AI" }), E("t1", "card:task/glass", { title: "Confirm orders" }), E("t2", "card:task/glass", { title: "Update stock" })] }),
        B({ cue: "reduce mistakes,", action: "erase", targets: ["t1", "t2"], style: "wipe" }),
        B({ cue: "and give you more time", action: "place", elements: [E("time", "card:timer/solid", { title: "Time saved", value: "12 hrs" })] }),
        B({ cue: "to grow your business with SeloraX.", action: "statement", text: "grow your business with SeloraX.", accent: "grow your business", text_layout: "display" }),
      ],
    },
  },
];
