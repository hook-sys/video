import type { FlowScript } from "@/lib/flow-script";
import type { WordTiming } from "@/lib/voice-timing";

// FlowScripts in exactly the shape the Visual Director returns, used to test
// the compiler across different kinds of stories.
type Fixture = { name: string; narration: string; durationSeconds: number; script: FlowScript; words?: WordTiming[] };
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
  {
    // Regression: the first real Director run (Preview), verbatim, with its
    // real ElevenLabs word timestamps. It orbits, then opens the UI — the
    // compiler crashed on that order.
    name: "video-editor",
    narration: "Creating a great video takes more than just recording. You need to cut the right moments, arrange your clips, add the perfect effects, and bring everything together. Turn raw footage into a polished video, faster.",
    durationSeconds: 15,
    words: [
      ["Creating", 0, 0.4], ["a", 0.44, 0.48], ["great", 0.533, 0.8], ["video", 0.867, 1.2], ["takes", 1.253, 1.52], ["more", 1.552, 1.68], ["than", 1.712, 1.84], ["just", 1.888, 2.08], ["recording.", 2.136, 3.2],
      ["You", 3.24, 3.36], ["need", 3.392, 3.52], ["to", 3.6, 3.76], ["cut", 3.8, 3.92], ["the", 3.94, 4], ["right", 4.053, 4.32], ["moments", 4.39, 4.88], [",", 4.88, 5.2], ["arrange", 5.25, 5.6], ["your", 5.632, 5.76], ["clips,", 5.84, 6.72],
      ["add", 6.78, 6.96], ["the", 7, 7.12], ["perfect", 7.17, 7.52], ["effects,", 7.6, 8.48], ["and", 8.5, 8.56], ["bring", 8.6, 8.8], ["everything", 8.858, 9.44], ["together.", 9.502, 10.08],
      ["Turn", 10.24, 10.88], ["raw", 10.96, 11.2], ["footage", 11.27, 11.76], ["into", 11.84, 12.16], ["a", 12.2, 12.24], ["polished", 12.302, 12.8], ["video,", 12.867, 13.6], ["faster.", 13.691, 14.32],
    ].map(([text, start, end]) => ({ text: text as string, start: start as number, end: end as number })),
    script: {
      theme: "lavender",
      beats: [
        beat({ cue: "Creating a great video", action: "hero_enter", id: "video-project", icon: "clapperboard", label: "Video Project" }),
        beat({ cue: "more than just recording.", action: "orbit", satellites: [1, 2, 3, 4].map((i) => ({ id: `clip-${i}`, icon: "file-play", label: null })) }),
        beat({
          cue: "You need to cut",
          action: "ui_showcase",
          ui: {
            title: "Editing Timeline",
            rows: [
              { icon: "scissors", text: "Cut Moments", value: null, status: "Selected" },
              { icon: "rows-3", text: "Arrange Clips", value: null, status: null },
              { icon: "wand-sparkles", text: "Add Effects", value: null, status: null },
              { icon: "play", text: "Video Preview", value: null, status: null },
            ],
            callouts: [{ icon: "mouse-pointer-2", text: "Choose the moment" }],
            click_row: 0,
          },
        }),
        beat({ cue: "the right moments", action: "confirm" }),
        beat({ cue: "arrange your clips,", action: "add_step", id: "arrange", icon: "rows-3", label: "Arrange Clips", packet_icon: "film" }),
        beat({ cue: "add the perfect effects,", action: "add_step", id: "effects", icon: "wand-sparkles", label: "Perfect Effects", packet_icon: "film" }),
        beat({ cue: "bring everything together.", action: "converge", icon: "film" }),
        beat({ cue: "Turn raw footage into", action: "hero_morph", id: "video-project", icon: "square-play", label: "Polished Video" }),
        beat({ cue: "a polished video,", action: "celebrate", lottie: "sparkle-twinkle" }),
        beat({ cue: "faster.", action: "title", text: "Turn raw footage into a polished video, faster.", accent: "polished video" }),
      ],
    },
  },
];
