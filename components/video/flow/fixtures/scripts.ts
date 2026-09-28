import type { FlowScript } from "@/lib/flow-script";

// FlowScripts in exactly the shape the Visual Director returns, used to test
// the compiler across different kinds of stories.
type Fixture = { name: string; narration: string; durationSeconds: number; script: FlowScript };
const beat = (b: Partial<FlowScript["beats"][number]> & Pick<FlowScript["beats"][number], "cue" | "action">): FlowScript["beats"][number] => ({
  id: null,
  icon: null,
  label: null,
  packet_icon: null,
  ui: null,
  satellites: null,
  text: null,
  accent: null,
  lottie: null,
  ...b,
});

export const FLOW_SCRIPT_FIXTURES: Fixture[] = [
  {
    name: "ecommerce",
    narration: "A customer places an order. The product is packed, the payment is confirmed, and the package starts its journey. From one simple order to a successful delivery, everything stays on track.",
    durationSeconds: 15,
    script: {
      theme: "lavender",
      beats: [
        beat({ cue: "A customer", action: "actor_enter", id: "customer", icon: "user-round" }),
        beat({ cue: "places an order", action: "hero_enter", icon: "shopping-bag", label: "New order" }),
        beat({ cue: "The product is packed", action: "hero_morph", icon: "package", label: "Packed" }),
        beat({ cue: "the payment is confirmed", action: "add_step", id: "paid", icon: "credit-card", label: "Paid", packet_icon: "circle-dollar-sign" }),
        beat({ cue: "and the package starts its journey", action: "add_step", id: "ship", icon: "truck", label: "Shipped", packet_icon: "package" }),
        beat({ cue: "From one simple order", action: "confirm" }),
        beat({ cue: "to a successful delivery", action: "add_step", id: "home", icon: "house", label: "Delivered", packet_icon: "truck" }),
        beat({ cue: "delivery", action: "celebrate", id: "home", lottie: "confetti-burst" }),
        beat({ cue: "everything stays", action: "converge", icon: "circle-check-big" }),
        beat({ cue: "on track", action: "title", text: "Everything stays on track.", accent: "on track." }),
      ],
    },
  },
  {
    name: "payments-hub",
    narration: "Every payment starts in one clear dashboard. Approve in a click, with smart routing built in. Then connect your bank, cards and tools, all secured in one place. One hub for every payment.",
    durationSeconds: 15,
    script: {
      theme: "lavender",
      beats: [
        beat({
          cue: "Every payment starts",
          action: "ui_showcase",
          ui: {
            title: "Payments",
            rows: [
              { icon: "store", text: "Order #1042", value: "$240.00", status: "Paid" },
              { icon: "truck", text: "Supplier invoice", value: "$1,860.00", status: "Review" },
              { icon: "users", text: "Payroll · March", value: "$12,400", status: "Scheduled" },
              { icon: "repeat", text: "Subscription renewal", value: "$49.00", status: "Paid" },
              { icon: "landmark", text: "Tax transfer", value: "$3,120.00", status: "Queued" },
            ],
            callouts: [
              { text: "Approved in one click", icon: "mouse-pointer-click" },
              { text: "Smart routing", icon: "route" },
            ],
            click_row: 1,
          },
        }),
        beat({ cue: "Then connect your bank", action: "iris_to_hub", icon: "wallet", label: "Payments hub" }),
        beat({
          cue: "cards and tools",
          action: "orbit",
          satellites: [
            { id: "bank", icon: "landmark", label: null },
            { id: "cards", icon: "credit-card", label: null },
            { id: "tools", icon: "blocks", label: null },
            { id: "cloud", icon: "cloud", label: null },
            { id: "secure", icon: "shield-check", label: null },
          ],
        }),
        beat({ cue: "all secured", action: "confirm", id: "secure" }),
        beat({ cue: "One hub", action: "title", text: "One hub for every payment.", accent: "every payment." }),
      ],
    },
  },
  {
    name: "clinic",
    narration: "Patients book a visit in seconds. The clinic confirms instantly, reminders go out automatically, and every appointment lands on the calendar. Less waiting, more care.",
    durationSeconds: 13,
    script: {
      theme: "midnight",
      beats: [
        beat({ cue: "Patients", action: "actor_enter", id: "patient", icon: "user-round" }),
        beat({ cue: "book a visit", action: "hero_enter", icon: "calendar-plus", label: "Booked", packet_icon: "smartphone" }),
        beat({ cue: "The clinic confirms instantly", action: "confirm" }),
        beat({ cue: "reminders go out", action: "add_step", id: "reminder", icon: "bell-ring", label: "Reminder", packet_icon: "mail" }),
        beat({ cue: "every appointment lands", action: "add_step", id: "calendar", icon: "calendar-check", label: "Scheduled", packet_icon: "clock" }),
        beat({ cue: "Less waiting", action: "converge", icon: "heart-pulse" }),
        beat({ cue: "more care", action: "title", text: "Less waiting, more care.", accent: "more care." }),
      ],
    },
  },
];
