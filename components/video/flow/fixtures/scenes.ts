import type { SceneBeat, SceneContent, SceneElement, SceneScript } from "@/lib/scene-script";
import type { WordTiming } from "@/lib/voice-timing";
import type { CompileBrand } from "../compile";

// SceneScripts (Director v2) in exactly the shape the Director returns, used to
// test the scene compiler.

type Fixture = { name: string; narration: string; durationSeconds: number; script: SceneScript; words?: WordTiming[]; brand?: CompileBrand; screenshots?: string[] };

const C = (c: Partial<SceneContent>): SceneContent => ({ title: null, subtitle: null, value: null, label: null, status: null, name: null, amount: null, delta: null, note: null, action: null, date: null, items: null, ...c });
const E = (id: string, asset: string | null, content?: Partial<SceneContent>, extra: Partial<SceneElement> = {}): SceneElement => ({ id, asset, content: content ? C(content) : null, screen: null, label: null, ...extra });
const B = (b: Partial<SceneBeat> & Pick<SceneBeat, "cue" | "action">): SceneBeat => ({
  elements: null,
  targets: null,
  to: null,
  layout: null,
  camera: null,
  transition: null,
  backdrop: null,
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
  // ── Beyond e-commerce: one script per kind of SaaS, so every industry's
  // templates, layouts and verbs are compiled, gated and rendered. ──
  {
    name: "crm",
    narration: "Leads come in from everywhere, and deals slip through the cracks. Pipeflow captures every lead, scores it instantly, and moves it through your pipeline. Follow-ups happen on time, forecasts stay accurate, and your team closes more deals with Pipeflow.",
    durationSeconds: 15,
    brand: { name: "Pipeflow", cta: "Start free" },
    script: {
      version: 2,
      theme: "lavender",
      beats: [
        B({ cue: "Leads come in from everywhere,", action: "scene", layout: "scatter-e", camera: "drift", transition: "cut", elements: [
          E("maya", "card:lead/glass", { name: "Maya Chen", subtitle: "Website form", status: "New", label: "Lead score" }),
          E("demo", "card:email/solid", { title: "Demo request", subtitle: "from Northwind", note: "Can we see a demo this week?", action: "Book a demo" }),
          E("dan", "card:message/glass", { name: "Daniel Park", subtitle: "LinkedIn", status: "New", note: "Interested in the team plan." }),
          E("sara", "card:contact/tinted", { name: "Sara Lee", subtitle: "Referral", title: "Brightline", date: "Today", label: "Unassigned" }),
        ] }),
        B({ cue: "and deals slip through the cracks.", action: "erase", targets: ["sara"], style: "fly-out" }),
        B({ cue: "Pipeflow captures every lead,", action: "scene", layout: "hero-left-b", camera: "push-in", transition: "push-left", elements: [
          E("pipe", "card:sales-pipeline/solid", { title: "Pipeline", status: "This quarter", items: ["Leads", "Qualified", "Proposal", "Won"] }),
          E("maya", null),
          E("score", "card:ai-score/accent", { title: "Lead score", subtitle: "Maya Chen", label: "Likely to buy" }),
        ] }),
        B({ cue: "scores it instantly,", action: "update", targets: ["maya"], content: C({ status: "Hot" }) }),
        B({ cue: "and moves it through your pipeline.", action: "trigger", targets: ["maya"], to: "pipe", content: C({ status: "+1 qualified" }) }),
        B({ cue: "Follow-ups happen on time,", action: "scene", layout: "mosaic-b", camera: "drift", transition: "morph", elements: [
          E("pipe", null),
          E("fu", "card:follow-up/glass", { title: "Follow-ups", status: "Today", items: ["Call Maya · 10:00", "Send proposal · 12:30", "Demo Northwind · 3:00"] }),
          E("fc", "card:forecast/solid", { title: "Forecast", subtitle: "Q3", value: "$1.2M", label: "Projected", delta: "+18%" }),
        ] }),
        B({ cue: "forecasts stay accurate,", action: "highlight", targets: ["fc"] }),
        B({ cue: "and your team closes", action: "place", elements: [E("won", "card:won-deal/accent", { title: "Deal won", subtitle: "Northwind", amount: "$24,000", label: "Closed" })] }),
        B({ cue: "more deals with Pipeflow.", action: "statement", text: "more deals with Pipeflow.", accent: "more deals", text_layout: "display" }),
      ],
    },
  },
  {
    name: "helpdesk",
    narration: "Support tickets pile up across email, chat and social. Supportly brings every conversation into one inbox. AI sorts each ticket, drafts the reply, and your agents answer in minutes. Customers stay happy, and your team finally catches up.",
    durationSeconds: 15,
    brand: { name: "Supportly", cta: "Try it free" },
    script: {
      version: 2,
      theme: "mint",
      beats: [
        B({ cue: "Support tickets pile up", action: "scene", layout: "scatter-b", camera: "drift", transition: "cut", elements: [
          E("t1", "card:ticket/glass", { title: "#4821 Login issue", subtitle: "Email · 2m", status: "Urgent", note: "I can't sign in.", items: ["Account"] }),
          E("t2", "card:message/solid", { name: "Leo", subtitle: "Live chat", status: "Waiting", note: "Is anyone there?" }),
          E("t3", "card:sms/tinted", { title: "Social DM", subtitle: "5m", note: "Still waiting for a reply…" }),
          E("t4", "card:email/glass", { title: "Refund question", subtitle: "from ana@mail.com", note: "When will I get my refund?", action: "Reply" }),
        ] }),
        B({ cue: "across email, chat and social.", action: "highlight", targets: ["t1"] }),
        B({ cue: "Supportly brings every conversation", action: "scene", layout: "hub-a", camera: "push-in", transition: "morph", elements: [
          E("q", "card:ticket-queue/solid", { title: "Inbox", status: "12 open", items: ["Login issue · 2m · Urgent", "Refund question · 8m · Normal", "Live chat · 1m · Waiting"] }),
          E("t1", null),
          E("t2", null),
        ] }),
        B({ cue: "into one inbox.", action: "merge", targets: ["t1", "t2"], to: "q" }),
        B({ cue: "AI sorts each ticket,", action: "place", elements: [E("ai", "card:ai-automation/accent", { title: "AI triage", status: "Auto", items: ["Tagged 42 tickets", "Routed to billing", "Flagged 3 urgent"] })] }),
        B({ cue: "drafts the reply,", action: "place", elements: [E("draft", "card:ai-answer/glass", { title: "Suggested reply", status: "Draft", note: "Hi Sara, here's how to reset your password.", items: ["Friendly", "Resolves"] })] }),
        B({ cue: "and your agents answer in minutes.", action: "place", elements: [E("sla", "card:sla/solid", { title: "Response time", value: "4 min", label: "First reply", delta: "-62%" })] }),
        B({ cue: "Customers stay happy,", action: "scene", layout: "row-c", camera: "pull-back", transition: "push-left", elements: [
          E("csat", "card:csat/accent", { title: "CSAT", label: "happy customers" }),
          E("rev", "card:testimonial/glass", { note: "“Fixed in minutes. Amazing support!”", name: "Sara", subtitle: "Customer" }),
        ] }),
        B({ cue: "your team finally catches up.", action: "statement", text: "your team finally catches up.", accent: "catches up", text_layout: "display" }),
      ],
    },
  },
  {
    name: "devtool",
    narration: "Shipping code should not be scary. With Shipyard, every pull request gets a preview, tests run automatically, and one click deploys to production. If something breaks, you roll back in seconds. Ship faster, sleep better.",
    durationSeconds: 15,
    brand: { name: "Shipyard", cta: "Deploy your first app" },
    script: {
      version: 2,
      theme: "midnight",
      beats: [
        B({ cue: "Shipping code should not be scary.", action: "scene", layout: "depth-c", camera: "drift", transition: "cut", elements: [
          E("err", "card:error-toast/solid", { title: "Build failed", subtitle: "3 tests broken" }),
          E("inc", "card:incident/glass", { title: "Incident", subtitle: "API down", status: "Open", items: ["Detected · 2:14 AM", "Paging on-call · 2:15", "Investigating · 2:40"] }),
          E("term", "card:terminal/solid", { items: ["npm run deploy", "✗ Error: timeout", "✗ Rollback failed"] }),
        ] }),
        B({ cue: "With Shipyard, every pull request", action: "scene", layout: "hero-left-a", camera: "push-in", transition: "zoom-through", elements: [
          E("pr", "card:pull-request/solid", { title: "Add billing page", subtitle: "#482", status: "Open", items: ["Checks passed", "2 approvals", "No conflicts"], action: "Merge" }),
          E("prev", "card:deploy/glass", { title: "Preview", subtitle: "pr-482.shipyard.app", status: "Ready", items: ["Building preview", "Preview ready"] }),
        ] }),
        B({ cue: "tests run automatically,", action: "place", elements: [E("tests", "card:checklist/tinted", { title: "Tests", items: ["Unit · 214 passed", "E2E · 38 passed", "Lint · clean"] })] }),
        B({ cue: "and one click deploys", action: "place", elements: [E("dep", "card:deploy/accent", { title: "Production", subtitle: "main · a1b2c3d", status: "Deploying", items: ["Building", "Running checks", "Deployed to edge"] })] }),
        B({ cue: "to production.", action: "update", targets: ["dep"], content: C({ status: "Live" }) }),
        B({ cue: "If something breaks,", action: "scene", layout: "split-a", camera: "rise", transition: "push-up", elements: [
          E("rate", "card:error-rate/glass", { title: "Errors", subtitle: "Last hour", value: "4.2%", label: "Error rate", delta: "+300%" }),
          E("rb", "card:commit/solid", { title: "Rollback", subtitle: "to v2.14", items: ["Error spike · 3:02", "Rolled back · 3:02", "Healthy · 3:03"] }),
        ] }),
        B({ cue: "you roll back in seconds.", action: "update", targets: ["rate"], content: C({ value: "0.2%", delta: "-95%" }) }),
        B({ cue: "Ship faster, sleep better.", action: "statement", text: "Ship faster, sleep better.", accent: "sleep better", text_layout: "display" }),
      ],
    },
  },
  {
    name: "hiring",
    narration: "Hiring should not take months. Hireloop posts your job everywhere, screens every applicant with AI, and books interviews automatically. Your team compares candidates side by side, sends the offer in one click, and welcomes new hires on day one.",
    durationSeconds: 15,
    brand: { name: "Hireloop", cta: "Post a job free" },
    script: {
      version: 2,
      theme: "teal",
      beats: [
        B({ cue: "Hiring should not take months.", action: "scene", layout: "row-a", camera: "drift", transition: "cut", elements: [
          E("slow", "card:calendar-event/solid", { title: "Time to hire", subtitle: "87 days" }),
          E("pile", "card:email/glass", { title: "248 applications", subtitle: "Unread", note: "Resumes waiting for review…", action: "Open" }),
        ] }),
        B({ cue: "Hireloop posts your job everywhere,", action: "scene", layout: "hub-b", camera: "push-in", transition: "push-left", elements: [
          E("job", "card:job-post/accent", { title: "Product Designer", subtitle: "Remote · Full-time", status: "Open", items: ["Job boards", "Careers page", "Referrals"] }),
          E("i1", "icon:globe", undefined, { label: "Job boards" }),
          E("i2", "icon:users", undefined, { label: "Referrals" }),
          E("i3", "icon:share-2", undefined, { label: "Social" }),
        ] }),
        B({ cue: "screens every applicant with AI,", action: "place", elements: [E("scr", "card:ai-score/glass", { title: "AI screening", subtitle: "Tania Akter", label: "Match" })] }),
        B({ cue: "and books interviews automatically.", action: "scene", layout: "columns2-b", camera: "drift", transition: "morph", elements: [
          E("scr", null),
          E("iv", "card:interview/solid", { title: "Interview", subtitle: "Tania · pick a time" }),
          E("hp", "card:hiring-pipeline/glass", { title: "Hiring", status: "Designer", items: ["Applied", "Screen", "Interview", "Offer"] }),
        ] }),
        B({ cue: "Your team compares candidates", action: "place", elements: [E("cand", "card:candidate/tinted", { name: "Tania Akter", subtitle: "Product designer", status: "Top match", items: ["Figma", "5 yrs"] })] }),
        B({ cue: "sends the offer in one click,", action: "place", elements: [E("off", "card:offer/accent", { title: "Offer letter", subtitle: "Tania Akter", status: "Accepted", label: "Product Designer", date: "1 Oct" })] }),
        B({ cue: "welcomes new hires on day one.", action: "statement", text: "welcomes new hires on day one.", accent: "day one", text_layout: "display" }),
      ],
    },
  },
  {
    name: "clinic",
    narration: "Patients should not wait on hold to see a doctor. With CareDesk, they book online in seconds, get reminders automatically, and check in from their phone. Doctors see records and lab results in one place, so every visit starts on time.",
    durationSeconds: 15,
    brand: { name: "CareDesk", cta: "Book a demo" },
    script: {
      version: 2,
      theme: "mint",
      beats: [
        B({ cue: "Patients should not wait on hold", action: "scene", layout: "scatter-d", camera: "drift", transition: "cut", elements: [
          E("line", "card:call/glass", { name: "Clinic line", subtitle: "On hold · 14 min", status: "Waiting", action: "Still waiting…" }),
          E("q", "card:clinic-queue/solid", { title: "Waiting room", status: "18 waiting", items: ["Token 12 · 40 min", "Token 13 · 55 min", "Token 14 · 70 min"] }),
          E("miss", "card:error-toast/glass", { title: "Appointment missed", subtitle: "No reminder sent" }),
        ] }),
        B({ cue: "to see a doctor.", action: "highlight", targets: ["q"] }),
        B({ cue: "With CareDesk, they book online", action: "scene", layout: "hero-right-a", camera: "push-in", transition: "dissolve", elements: [
          E("book", "card:appointment/accent", { title: "Appointment", date: "Tue · 10:30", status: "Confirmed", name: "Dr. Karim", subtitle: "General physician" }),
          E("cal", "card:calendar-event/glass", { title: "Available", subtitle: "This week" }),
        ] }),
        B({ cue: "get reminders automatically,", action: "place", elements: [E("rem", "card:sms/solid", { title: "Reminder", subtitle: "Tomorrow", note: "Your visit with Dr. Karim is at 10:30." })] }),
        B({ cue: "and check in from their phone.", action: "place", elements: [E("ci", "card:success-toast/glass", { title: "Checked in", subtitle: "Token 12 · You're next" })] }),
        B({ cue: "Doctors see records", action: "scene", layout: "mosaic-a", camera: "drift", transition: "push-left", elements: [
          E("pt", "card:patient/solid", { name: "Rina Das", subtitle: "Age 34", status: "Checked in", date: "12 Sep", label: "Follow-up" }),
          E("lab", "card:lab-result/glass", { title: "Blood test", subtitle: "Ready", status: "Normal" }),
          E("vit", "card:vitals/tinted", { title: "Vitals", value: "72 bpm", label: "Heart rate" }),
        ] }),
        B({ cue: "and lab results in one place,", action: "highlight", targets: ["lab"] }),
        B({ cue: "every visit starts on time.", action: "statement", text: "every visit starts on time.", accent: "on time", text_layout: "display" }),
      ],
    },
  },
  {
    name: "school",
    narration: "Teaching online should feel like a real classroom. Classly runs live classes, tracks attendance automatically, and grades assignments in minutes. Parents see progress every week, and students stay on track all term.",
    durationSeconds: 14,
    brand: { name: "Classly", cta: "Start teaching" },
    script: {
      version: 2,
      theme: "lavender",
      beats: [
        B({ cue: "Teaching online should feel", action: "scene", layout: "hero-left-c", camera: "drift", transition: "cut", elements: [
          E("live", "card:live-class/accent", { title: "Physics", subtitle: "Mr. Rahman", status: "Live" }),
          E("les", "card:lesson/glass", { title: "Lesson 3: Motion" }),
          E("q", "card:comments/solid", { note: "Can you explain that again?", action: "Sure, watch this!" }),
        ] }),
        B({ cue: "like a real classroom.", action: "highlight", targets: ["live"] }),
        B({ cue: "Classly runs live classes,", action: "scene", layout: "row-b", camera: "push-in", transition: "push-left", elements: [
          E("live", null),
          E("att", "card:class-attendance/solid", { title: "Class 8B", subtitle: "Today", label: "present" }),
        ] }),
        B({ cue: "tracks attendance automatically,", action: "update", targets: ["att"], content: C({ subtitle: "Auto-tracked" }) }),
        B({ cue: "and grades assignments in minutes.", action: "place", elements: [E("as", "card:assignment/glass", { title: "Essay", subtitle: "Graded", status: "A-", label: "Done" })] }),
        B({ cue: "Parents see progress", action: "scene", layout: "columns2-a", camera: "drift", transition: "morph", elements: [
          E("gr", "card:grades/solid", { title: "Report card", subtitle: "Term 1", items: ["Math · A", "Science · A-", "English · B+"] }),
          E("msg", "card:message/glass", { name: "Parent app", subtitle: "Weekly update", status: "New", note: "Ayan finished 12 lessons this week!" }),
        ] }),
        B({ cue: "every week,", action: "highlight", targets: ["msg"] }),
        B({ cue: "students stay on track all term.", action: "statement", text: "students stay on track all term.", accent: "on track", text_layout: "display" }),
      ],
    },
  },
  {
    name: "realestate",
    narration: "Finding the right home takes too many calls. Nestify shows verified listings, books viewings instantly, and calculates your mortgage on the spot. When you find the one, sign the lease online and move in sooner.",
    durationSeconds: 14,
    brand: { name: "Nestify", cta: "Find your home" },
    script: {
      version: 2,
      theme: "teal",
      beats: [
        B({ cue: "Finding the right home", action: "scene", layout: "scatter-a", camera: "drift", transition: "cut", elements: [
          E("l1", "card:listing/glass", { title: "2-bed flat, Banani", amount: "$180,000", label: "1,100 sq ft" }),
          E("l2", "card:listing/solid", { title: "3-bed apartment, Gulshan", amount: "$240,000", label: "1,450 sq ft" }),
          E("calls", "card:call/tinted", { name: "Agent", subtitle: "Missed call", status: "3 missed", action: "Call back" }),
        ] }),
        B({ cue: "takes too many calls.", action: "erase", targets: ["calls"], style: "shrink" }),
        B({ cue: "Nestify shows verified listings,", action: "scene", layout: "hero-left-a", camera: "push-in", transition: "push-left", elements: [
          E("l2", null),
          E("view", "card:viewing/glass", { title: "Viewing", subtitle: "Gulshan apartment", status: "Available" }),
        ] }),
        B({ cue: "books viewings instantly,", action: "update", targets: ["view"], content: C({ status: "Booked" }) }),
        B({ cue: "and calculates your mortgage", action: "place", elements: [E("mort", "card:mortgage/accent", { title: "Mortgage", amount: "$1,420", label: "5.1%", value: "25 years" })] }),
        B({ cue: "When you find the one,", action: "scene", layout: "split-b", camera: "drift", transition: "morph", elements: [
          E("l2", null),
          E("sign", "card:e-sign/solid", { title: "Lease agreement", status: "Signed", name: "Arif Hasan" }),
        ] }),
        B({ cue: "sign the lease online", action: "highlight", targets: ["sign"] }),
        B({ cue: "move in sooner.", action: "statement", text: "move in sooner.", accent: "sooner", text_layout: "display" }),
      ],
    },
  },
  {
    name: "restaurant",
    narration: "Busy nights should not mean lost orders. With TableTap, guests book a table in seconds and order from their phone. Every order reaches the kitchen instantly, and you see tonight's sales live. More happy guests, less chaos.",
    durationSeconds: 14,
    brand: { name: "TableTap", cta: "Get started" },
    script: {
      version: 2,
      theme: "midnight",
      beats: [
        B({ cue: "Busy nights should not mean", action: "scene", layout: "scatter-f", camera: "drift", transition: "cut", elements: [
          E("late", "card:kitchen-order/glass", { title: "Table 7", subtitle: "20 min ago", status: "Late", items: ["2 × Chicken bowl", "1 × Salad", "3 × Lemonade"] }),
          E("lost", "card:error-toast/solid", { title: "Order lost", subtitle: "Table 12" }),
          E("phone", "card:call/glass", { name: "Front desk", subtitle: "Phone ringing", status: "Busy", action: "No answer" }),
        ] }),
        B({ cue: "lost orders.", action: "highlight", targets: ["lost"] }),
        B({ cue: "With TableTap, guests book a table", action: "scene", layout: "hero-right-b", camera: "push-in", transition: "push-left", elements: [
          E("res", "card:reservation/accent", { title: "Table for 4", subtitle: "Friday", status: "Confirmed" }),
          E("menu", "card:menu-item/glass", { title: "Grilled chicken bowl", amount: "$12", label: "12 min" }),
        ] }),
        B({ cue: "and order from their phone.", action: "place", elements: [E("ph", "device:phone/light", { title: "Grilled chicken bowl", amount: "$12", label: "12 min" }, { screen: "card:menu-item/solid" })] }),
        B({ cue: "Every order reaches the kitchen", action: "scene", layout: "pipeline-a", camera: "drift", transition: "morph", elements: [
          E("ph", null),
          E("kit", "card:kitchen-order/solid", { title: "Table 4", subtitle: "Just now", status: "New", items: ["1 × Chicken bowl", "2 × Lemonade"] }),
        ] }),
        B({ cue: "instantly,", action: "connect", targets: ["ph"], to: "kit" }),
        B({ cue: "and you see tonight's sales live.", action: "place", elements: [E("sales", "card:kpi/accent", { value: "$4,860", label: "Tonight's sales", delta: "+22%" })] }),
        B({ cue: "More happy guests, less chaos.", action: "statement", text: "More happy guests, less chaos.", accent: "less chaos", text_layout: "display" }),
      ],
    },
  },
  {
    name: "gym",
    narration: "Running a gym means juggling bookings, payments and members. FitPulse lets members book classes from their phone, pays automatically every month, and tracks every workout. You see who is coming, who is slipping, and how your studio grows.",
    durationSeconds: 15,
    brand: { name: "FitPulse", cta: "Try FitPulse free" },
    script: {
      version: 2,
      theme: "lavender",
      beats: [
        B({ cue: "Running a gym means juggling", action: "scene", layout: "scatter-h", camera: "drift", transition: "cut", elements: [
          E("cb", "card:class-booking/glass", { title: "Yoga flow", subtitle: "Studio A", status: "Full" }),
          E("due", "card:subscription/solid", { title: "Membership", subtitle: "Renews 1 Nov", status: "Overdue", amount: "$49" }),
          E("mem", "card:member/glass", { name: "Sami Rahman", subtitle: "Member since 2024", status: "Active", value: "48", label: "Annual" }),
        ] }),
        B({ cue: "bookings, payments and members.", action: "highlight", targets: ["cb"] }),
        B({ cue: "FitPulse lets members book classes", action: "scene", layout: "hero-left-b", camera: "push-in", transition: "push-left", elements: [
          E("app", "device:phone/dark", { title: "Yoga flow", subtitle: "Studio A", status: "Booked" }, { screen: "card:class-booking/solid" }),
          E("att", "card:attendees/glass", { title: "Tonight's class", value: "18", label: "Booked", delta: "+6" }),
        ] }),
        B({ cue: "pays automatically every month,", action: "place", elements: [E("sub", "card:subscription/solid", { title: "Membership", subtitle: "Auto-pay", status: "Paid", amount: "$49" })] }),
        B({ cue: "and tracks every workout.", action: "place", elements: [E("wk", "card:workout/tinted", { title: "HIIT", subtitle: "32 min", status: "Done", value: "420 kcal", label: "Burned" })] }),
        B({ cue: "You see who is coming,", action: "scene", layout: "mosaic-c", camera: "drift", transition: "morph", elements: [
          E("att", null),
          E("risk", "card:churn/glass", { title: "At risk", value: "12", label: "members slipping", delta: "-30%" }),
          E("rev", "card:mrr/solid", { title: "Studio revenue", value: "$18.4K", label: "This month", delta: "+14%" }),
        ] }),
        B({ cue: "who is slipping,", action: "highlight", targets: ["risk"] }),
        B({ cue: "how your studio grows.", action: "statement", text: "how your studio grows.", accent: "grows", text_layout: "display" }),
      ],
    },
  },
  {
    name: "invoicing",
    narration: "Chasing unpaid invoices wastes your week. Ledgerly sends every invoice automatically, reminds clients before the due date, and matches payments to your bank. Your cash flow is clear in real time, and tax season takes minutes.",
    durationSeconds: 14,
    brand: { name: "Ledgerly", cta: "Send your first invoice" },
    script: {
      version: 2,
      theme: "teal",
      beats: [
        B({ cue: "Chasing unpaid invoices", action: "scene", layout: "scatter-c", camera: "drift", transition: "cut", elements: [
          E("inv", "card:invoice/glass", { title: "Invoice #204", date: "Due 12 Sep", status: "Overdue", amount: "$2,400" }),
          E("over", "card:error-toast/solid", { title: "3 invoices overdue", subtitle: "$8,400 unpaid" }),
          E("chase", "card:email/glass", { title: "Payment reminder", subtitle: "to client@acme.com", note: "Just following up on invoice #204…", action: "Send again" }),
        ] }),
        B({ cue: "wastes your week.", action: "erase", targets: ["chase"], style: "fade" }),
        B({ cue: "Ledgerly sends every invoice automatically,", action: "scene", layout: "hero-left-a", camera: "push-in", transition: "push-left", elements: [
          E("inv", null),
          E("auto", "card:workflow/solid", { title: "Auto-invoicing", status: "On", items: ["Project finished", "Invoice sent", "Reminder in 3 days"] }),
        ] }),
        B({ cue: "reminds clients before the due date,", action: "place", elements: [E("rem", "card:notification/glass", { title: "Reminder sent", subtitle: "Acme · due Friday", status: "Auto" })] }),
        B({ cue: "and matches payments to your bank.", action: "place", elements: [E("tx", "card:transactions/accent", { title: "Bank", items: ["Acme · +$2,400 · Matched", "Northwind · +$1,200 · Matched", "Brightline · +$800 · Matched"] })] }),
        B({ cue: "Your cash flow is clear", action: "scene", layout: "grid-b", camera: "drift", transition: "morph", elements: [
          E("tx", null),
          E("bal", "card:balance/solid", { value: "$48,210", label: "Cash on hand", delta: "+12%" }),
        ] }),
        B({ cue: "in real time,", action: "update", targets: ["bal"], content: C({ value: "$50,610" }) }),
        B({ cue: "tax season takes minutes.", action: "statement", text: "tax season takes minutes.", accent: "minutes", text_layout: "display" }),
      ],
    },
  },
  {
    // Every newer motion and backdrop in one script: an integrations platform.
    name: "platform",
    narration: "Your tools do not talk to each other, so work breaks between them. Linkwise connects every app you use and keeps your data flowing in real time. Follow a customer from signup to payment, open any record in one click, and let AI predict what comes next.",
    durationSeconds: 16,
    brand: { name: "Linkwise", cta: "Connect your apps" },
    script: {
      version: 2,
      theme: "midnight",
      beats: [
        B({ cue: "Your tools do not talk", action: "scene", layout: "row-b", camera: "drift", transition: "cut", backdrop: "grain", style: "bounce", elements: [
          E("crm", "card:contact/glass", { name: "Maya Chen", subtitle: "CRM", title: "Northwind", date: "Today", label: "Sales" }),
          E("bill", "card:invoice/solid", { title: "Invoice #204", date: "Due Friday", status: "Unpaid", amount: "$2,400" }),
          E("help", "card:ticket/glass", { title: "#4821 Billing", subtitle: "Helpdesk", status: "Open", note: "Why was I charged twice?", items: ["Billing"] }),
        ] }),
        B({ cue: "to each other,", action: "connect", targets: ["crm"], to: "bill" }),
        B({ cue: "so work breaks between them.", action: "disconnect", targets: ["crm"], to: "bill" }),
        B({ cue: "Linkwise connects every app you use", action: "scene", layout: "single", camera: "push-in", transition: "zoom-through", backdrop: "energy", style: "spin", elements: [
          E("hub", "card:integration/accent", { title: "Linkwise", status: "Connected", items: ["CRM · On", "Billing · On", "Helpdesk · On"] }),
          E("a1", "icon:users", undefined, { label: "CRM" }),
          E("a2", "icon:receipt", undefined, { label: "Billing" }),
          E("a3", "icon:headset", undefined, { label: "Helpdesk" }),
        ] }),
        B({ cue: "and keeps your data flowing", action: "orbit", targets: ["a1", "a2", "a3"], to: "hub" }),
        B({ cue: "in real time.", action: "flow", targets: ["a1"], to: "hub" }),
        B({ cue: "Follow a customer from signup to payment,", action: "scene", layout: "pipeline-b", camera: "pan-right", transition: "push-left", backdrop: "perspective-grid", elements: [
          E("s1", "card:form/glass", { title: "Sign up", label: "Email", name: "maya@northwind.com", action: "Create account" }),
          E("s2", "card:subscription/solid", { title: "Pro plan", subtitle: "Trial", status: "Active", amount: "$29" }),
          E("s3", "card:payment/accent", { title: "Payment", subtitle: "Maya Chen", status: "Paid", amount: "$29" }),
        ] }),
        B({ cue: "signup to payment,", action: "trace", targets: ["s1", "s2", "s3"] }),
        B({ cue: "open any record in one click,", action: "expand", targets: ["s2"] }),
        B({ cue: "and let AI predict", action: "collapse", targets: ["s2"] }),
        B({ cue: "what comes next.", action: "statement", text: "what comes next.", accent: "next", text_layout: "display" }),
      ],
    },
  },
];
