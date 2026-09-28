// Phase 2B acceptance test: the Phase 2A reference VisualStory, hand-written
// (no AI). Task titles, tab names and progress values are illustrative mock-UI
// content only.

export const REFERENCE_NARRATION =
  "Too many tasks. Too many tabs. Too much to manage. Bring everything together in one simple workspace. Organize your work, track your progress, and get more done. Less chaos. More clarity.";

const task = (n: number, title: string, tag: string, meta: string) => ({ id: `task_${n}`, kind: "task_card", group: "tasks", content: { title, tag, meta }, home: "chaos" });
const tab = (n: number, title: string, meta: string) => ({ id: `tab_${n}`, kind: "browser_tab", group: "tabs", content: { title, meta }, home: "chaos" });

export const REFERENCE_STORY = {
  version: 1,
  world: {
    areas: [
      { id: "chaos", kind: "chaos", mood: "tense" },
      { id: "flow", kind: "convergence", mood: "energetic" },
      { id: "workspace", kind: "workspace", mood: "focused" },
      { id: "clarity", kind: "hero", mood: "calm" },
    ],
  },
  cast: [
    task(1, "Finalize Q3 report", "Finance", "Today"),
    task(2, "Reply to client email", "Sales", "Overdue"),
    task(3, "Update roadmap", "Product", "Tomorrow"),
    task(4, "Prepare pitch deck", "Marketing", "Fri"),
    task(5, "Fix login bug", "Eng", "Today"),
    task(6, "Design review", "Design", "Today"),
    task(7, "Plan next sprint", "Eng", "Mon"),
    task(8, "Onboard new hire", "People", "Wed"),
    tab(1, "Inbox (24)", "mail"),
    tab(2, "Calendar", "calendar"),
    tab(3, "Roadmap doc", "docs"),
    tab(4, "Team chat", "chat"),
    tab(5, "Analytics", "analytics"),
    { id: "workspace", kind: "workspace", content: { title: "Workspace" }, home: "workspace" },
    { id: "progress", kind: "progress_panel", content: { title: "This week", meta: "tasks completed" }, home: "workspace" },
  ],
  moments: [
    { cue: "Too many tasks", intent: "accumulate", area: "chaos", events: [{ verb: "accumulate", targets: "group:tasks", pace: "tight" }], camera: { shot: "follow", subject: "group:tasks" } },
    { cue: "Too many tabs", intent: "accumulate", area: "chaos", events: [{ verb: "accumulate", targets: "group:tabs" }], camera: { shot: "establish", subject: "all_loose" } },
    { cue: "Too much to manage", intent: "overwhelm", area: "chaos", events: [{ verb: "emphasize", targets: "all_loose" }], camera: { shot: "hold", subject: "all_loose" } },
    {
      cue: "Bring everything together",
      intent: "converge",
      area: "flow",
      events: [
        { verb: "reveal", targets: "workspace" },
        { verb: "converge", targets: "all_loose", into: "workspace" },
      ],
      camera: { shot: "track", subject: "all_loose" },
    },
    { cue: "one simple workspace", intent: "establish", area: "workspace", events: [], camera: { shot: "push", subject: "workspace" } },
    {
      cue: "Organize your work",
      intent: "organize",
      area: "workspace",
      events: [
        { verb: "arrange", targets: "group:tasks", into: "workspace" },
        { verb: "dock", targets: "group:tabs", into: "workspace", slot: "dock" },
      ],
      camera: { shot: "follow", subject: "workspace" },
    },
    {
      cue: "track your progress",
      intent: "progress",
      area: "workspace",
      events: [
        { verb: "reveal", targets: "progress", into: "workspace", slot: "panel" },
        { verb: "complete", targets: "task_5,task_6,task_1,task_2" },
      ],
      camera: { shot: "push", subject: "progress" },
    },
    { cue: "get more done", intent: "progress", area: "workspace", events: [{ verb: "build", targets: "progress" }], camera: { shot: "hold", subject: "workspace" } },
    { cue: "Less chaos", intent: "resolve", area: "clarity", events: [], camera: { shot: "pull_back", subject: "workspace" } },
  ],
  closing: { text: ["Less chaos.", "More clarity."] },
};
