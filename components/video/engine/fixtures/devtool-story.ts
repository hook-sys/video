// A non-workspace story (developer tool): checks the compiler keeps a story that
// uses different objects and events instead of forcing the workspace pattern.
export const DEV_NARRATION = "Your build fails at midnight. Logs everywhere, no answers. Our assistant reads every error, finds the cause and writes the fix. Ship with confidence.";
export const DEV_STORY = {
  version: 1,
  world: { areas: [ { id: "incident", kind: "chaos", mood: "tense" }, { id: "fix", kind: "product_ui", mood: "focused" }, { id: "ship", kind: "hero", mood: "triumphant" } ] },
  cast: [
    { id: "err", kind: "message", group: "alerts", content: { tag: "CI · build #482", title: "Build failed: 3 errors" }, home: "incident" },
    { id: "log_1", kind: "document", group: "logs", content: { title: "server.log" }, home: "incident" },
    { id: "log_2", kind: "document", group: "logs", content: { title: "build.log" }, home: "incident" },
    { id: "log_3", kind: "document", group: "logs", content: { title: "test-report.log" }, home: "incident" },
    { id: "ask", kind: "input_field", content: { title: "Why did build #482 fail?", tag: "Ask" }, home: "fix" },
    { id: "cause", kind: "generic_card", content: { title: "Null config in auth.ts", tag: "Root cause", meta: "line 42" }, home: "fix" },
    { id: "patch", kind: "generic_card", content: { title: "Patch ready: guard config", tag: "Fix", meta: "1 file" }, home: "fix" },
    { id: "deployed", kind: "metric", content: { tag: "Status", title: "All checks passed", meta: "deployed" }, home: "fix" }
  ],
  moments: [
    { cue: "Your build fails", intent: "establish", area: "incident", events: [{ verb: "enter", targets: "err" }], camera: { shot: "push", subject: "err" } },
    { cue: "Logs everywhere", intent: "accumulate", area: "incident", events: [{ verb: "accumulate", targets: "group:logs" }], camera: { shot: "follow", subject: "all_loose" } },
    { cue: "no answers", intent: "overwhelm", area: "incident", events: [{ verb: "emphasize", targets: "all_loose" }], camera: { shot: "hold", subject: "all_loose" } },
    { cue: "Our assistant reads every error", intent: "demonstrate", area: "fix", events: [{ verb: "reveal", targets: "ask" }, { verb: "type", targets: "ask" }], camera: { shot: "track", subject: "ask" } },
    { cue: "finds the cause", intent: "reveal", area: "fix", events: [{ verb: "converge", targets: "group:logs,err", into: "ask" }, { verb: "reveal", targets: "cause" }], camera: { shot: "follow", subject: "cause" } },
    { cue: "writes the fix", intent: "demonstrate", area: "fix", events: [{ verb: "transform", targets: "cause", into: "patch" }], camera: { shot: "push", subject: "patch" } },
    { cue: "Ship with confidence", intent: "resolve", area: "ship", events: [{ verb: "reveal", targets: "deployed" }, { verb: "complete", targets: "patch" }], camera: { shot: "pull_back", subject: "patch,deployed" } }
  ],
  closing: { text: ["Ship with confidence."] }
};
