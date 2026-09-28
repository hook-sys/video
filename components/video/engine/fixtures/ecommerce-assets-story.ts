// An e-commerce story that uses generated visual assets (VISUAL_ASSETS=on):
// two distinct images, with the parcel reused across three moments by its
// continuity_id. Hand-written in the Visual Director's output shape.

export const ECOMMERCE_NARRATION =
  "A customer places an order. The product is packed, the payment is confirmed, and the package starts its journey. From one simple order to a successful delivery, everything stays on track.";

export const ECOMMERCE_STORY = {
  version: 1,
  world: {
    areas: [
      { id: "store", kind: "product_ui", mood: "focused" },
      { id: "warehouse", kind: "neutral", mood: "energetic" },
      { id: "route", kind: "convergence", mood: "energetic" },
      { id: "doorstep", kind: "hero", mood: "triumphant" },
    ],
  },
  cast: [
    { id: "order", kind: "generic_card", content: { title: "Order #1042", tag: "New order" }, home: "store" },
    { id: "payment", kind: "message", content: { tag: "Payment", title: "Confirmed" }, home: "warehouse" },
    { id: "status", kind: "metric", content: { tag: "Delivery", title: "On track" }, home: "doorstep" },
  ],
  moments: [
    {
      cue: "A customer places an order",
      intent: "establish",
      area: "store",
      events: [{ verb: "enter", targets: "order" }],
      camera: { shot: "push", subject: "order" },
      asset: { required: true, type: "object", description: "A kraft cardboard parcel being sealed with tape at a bright packing table", continuity_id: "parcel" },
    },
    {
      cue: "The product is packed",
      intent: "demonstrate",
      area: "warehouse",
      events: [{ verb: "move", targets: "order", into: "payment" }],
      camera: { shot: "follow", subject: "order" },
      asset: { required: true, type: "object", description: "A kraft cardboard parcel being sealed with tape at a bright packing table", continuity_id: "parcel" },
    },
    {
      cue: "the payment is confirmed",
      intent: "progress",
      area: "warehouse",
      events: [{ verb: "reveal", targets: "payment" }, { verb: "complete", targets: "payment" }],
      camera: { shot: "push", subject: "payment" },
    },
    {
      cue: "the package starts its journey",
      intent: "demonstrate",
      area: "doorstep",
      events: [{ verb: "exit", targets: "order" }],
      camera: { shot: "track", subject: "payment" },
      asset: { required: true, type: "object", description: "The same parcel", continuity_id: "parcel" },
    },
    {
      cue: "From one simple order",
      intent: "reveal",
      area: "doorstep",
      events: [{ verb: "reveal", targets: "status" }],
      camera: { shot: "reveal", subject: "status" },
      asset: { required: true, type: "cinematic_scene", description: "A parcel resting on a sunlit front doorstep of a modern home, warm morning light", continuity_id: "doorstep" },
    },
    {
      cue: "everything stays on track",
      intent: "resolve",
      area: "doorstep",
      events: [{ verb: "build", targets: "status" }],
      camera: { shot: "pull_back", subject: "status" },
    },
  ],
  closing: { text: ["everything stays on track."] },
};
