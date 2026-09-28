import type { Block, CardContent, CardTemplate } from "./types";

// Card templates for every kind of SaaS beyond commerce: sales/CRM, support,
// developer tools, HR, projects, real estate, hospitality, travel, legal,
// fitness, events, nonprofits, insurance, facilities, manufacturing, IoT,
// media, community, subscriptions, documents, fleets, agriculture, health,
// education, marketing, finance, security, public services and logistics.
// Content slots ({title}, {items} …) come from the Director; defaults keep
// each card plausible on its own. Values are illustrative UI, never claims.

const T = (id: string, category: string, description: string, tags: string, w: number, blocks: Block[], defaults: CardContent = {}): CardTemplate => ({
  id,
  category,
  description,
  tags: tags.split(/\s+/),
  w,
  blocks,
  defaults,
});

export const INDUSTRY_TEMPLATES: CardTemplate[] = [
  // ── sales / CRM ───────────────────────────────────────────────────────────
  T("deal", "sales", "A sales deal with value and stage", "deal opportunity sales crm won value", 460, [
    { type: "header", icon: "handshake", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{amount}", label: "{label}" },
    { type: "steps", items: ["Lead", "Demo", "Proposal", "Won"], active: 2 },
  ], { title: "Acme Corp", subtitle: "Annual plan", status: "Proposal", amount: "$24,000", label: "Deal value" }),
  T("sales-pipeline", "sales", "A sales pipeline by stage", "pipeline crm stages funnel deals leads", 560, [
    { type: "header", icon: "kanban", title: "{title}", badge: "{status}", tone: "info" },
    { type: "stages", items: "{items}", counts: [42, 18, 9, 5], active: 2 },
  ], { title: "Pipeline", status: "This quarter", items: ["Leads", "Qualified", "Proposal", "Won"] }),
  T("lead", "sales", "A new lead with a score", "lead prospect signup contact score", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "progress", label: "{label}", value: 82 },
  ], { name: "Maya Chen", subtitle: "Head of Ops · Northwind", status: "Hot", label: "Lead score" }),
  T("contact", "sales", "A contact record", "contact person company crm record", 460, [
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
    { type: "kv", pairs: [["Company", "{title}"], ["Last touch", "{date}"], ["Owner", "{label}"]] },
  ], { name: "Daniel Park", subtitle: "CTO", title: "Brightline", date: "2 days ago", label: "You" }),
  T("forecast", "sales", "A revenue forecast", "forecast revenue target quarter projection", 480, [
    { type: "header", icon: "trending-up", title: "{title}", sub: "{subtitle}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "line", values: [30, 34, 33, 41, 46, 52, 61] },
  ], { title: "Forecast", subtitle: "Q3", value: "$1.2M", label: "Projected", delta: "+18%" }),
  T("quota", "sales", "Progress to a sales quota", "quota target goal attainment rep", 440, [
    { type: "header", icon: "target", title: "{title}", sub: "{subtitle}" },
    { type: "meter", value: 78, label: "{label}" },
  ], { title: "Quota", subtitle: "Team East", label: "of target" }),
  T("follow-up", "sales", "Follow-up reminders", "follow up reminder next step call email", 460, [
    { type: "header", icon: "bell-ring", title: "{title}", badge: "{status}", tone: "warn" },
    { type: "rows", items: "{items}", icon: "phone" },
  ], { title: "Follow-ups", status: "Today", items: ["Call Maya · 10:00", "Send proposal · 12:30", "Demo Acme · 3:00"] }),
  T("won-deal", "sales", "A deal marked as won", "won closed deal win celebration", 420, [
    { type: "header", icon: "trophy", title: "{title}", sub: "{subtitle}", tone: "success" },
    { type: "bignum", value: "{amount}", label: "{label}" },
  ], { title: "Deal won", subtitle: "Acme Corp", amount: "$24,000", label: "Closed" }),

  // ── support / helpdesk ─────────────────────────────────────────────────────
  T("ticket", "support", "A support ticket", "ticket support issue helpdesk request", 480, [
    { type: "header", icon: "ticket", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "bubble", text: "{note}" },
    { type: "tags", items: "{items}" },
  ], { title: "#4821 Login issue", subtitle: "from Sara · 2 min ago", status: "Open", note: "I can't sign in since this morning.", items: ["Urgent", "Account"] }),
  T("ticket-queue", "support", "A queue of support tickets", "queue tickets inbox helpdesk backlog", 520, [
    { type: "header", icon: "inbox", title: "{title}", badge: "{status}", tone: "info" },
    { type: "rows", items: "{items}", icon: "ticket" },
  ], { title: "Inbox", status: "12 open", items: ["Login issue · 2m · Urgent", "Billing question · 8m · Normal", "Feature request · 21m · Low"] }),
  T("sla", "support", "Response time against the SLA", "sla response time first reply resolution", 440, [
    { type: "header", icon: "timer", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "progress", label: "Within SLA", value: 96, tone: "success" },
  ], { title: "Response time", value: "4 min", label: "First reply", delta: "-62%" }),
  T("csat", "support", "Customer satisfaction score", "csat satisfaction happiness rating nps", 420, [
    { type: "header", icon: "smile", title: "{title}" },
    { type: "donut", value: 94, label: "{label}" },
  ], { title: "CSAT", label: "happy customers" }),
  T("knowledge-base", "support", "Help center articles", "help center knowledge base article docs faq", 480, [
    { type: "input", label: "{title}", value: "{note}", icon: "search" },
    { type: "rows", items: "{items}", icon: "book-open" },
  ], { title: "Help center", note: "reset password", items: ["Reset your password", "Two-step sign-in", "Account settings"] }),
  T("agent", "support", "A support agent handling chats", "agent support live chat assigned", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Open chats", "{value}"], ["Solved today", "{amount}"]] },
  ], { name: "Nadia", subtitle: "Support", status: "Online", value: "3", amount: "27" }),

  // ── developer tools ───────────────────────────────────────────────────────
  T("deploy", "devtools", "A deployment going live", "deploy release ship production build", 520, [
    { type: "header", icon: "rocket", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "log", lines: "{items}" },
  ], { title: "Production", subtitle: "main · a1b2c3d", status: "Live", items: ["Installing dependencies", "Running tests", "Building app", "Deployed to edge"] }),
  T("terminal", "devtools", "A terminal running commands", "terminal cli command shell console", 540, [
    { type: "log", lines: "{items}" },
  ], { items: ["npm install", "npm run build", "Compiled in 4.2s", "Ready on port 3000"] }),
  T("pull-request", "devtools", "A pull request under review", "pull request pr review merge code", 500, [
    { type: "header", icon: "git-pull-request", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "checklist", items: "{items}" },
    { type: "button", text: "{action}", icon: "git-merge" },
  ], { title: "Add billing page", subtitle: "#482 by dev", status: "Approved", items: ["Checks passed", "2 approvals", "No conflicts"], action: "Merge" }),
  T("api-request", "devtools", "An API request and response", "api request response endpoint json rest", 540, [
    { type: "header", icon: "code", title: "{title}", badge: "{status}", tone: "success" },
    { type: "code", lines: ["POST /v1/payments", "{", '  "amount": 4800,', '  "status": "succeeded"', "}"] },
  ], { title: "API", status: "200 OK" }),
  T("error-rate", "devtools", "Errors dropping", "errors bugs exceptions monitoring rate", 460, [
    { type: "header", icon: "bug", title: "{title}", sub: "{subtitle}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}", tone: "success" },
    { type: "bars", values: [18, 15, 12, 9, 6, 4, 2] },
  ], { title: "Errors", subtitle: "Last 7 days", value: "0.2%", label: "Error rate", delta: "-84%" }),
  T("uptime", "devtools", "Service uptime", "uptime availability monitoring status sla", 460, [
    { type: "header", icon: "activity", title: "{title}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{value}", label: "{label}" },
    { type: "heat" },
  ], { title: "Uptime", status: "Healthy", value: "99.99%", label: "Last 90 days" }),
  T("commit", "devtools", "Recent commits", "commit git history changes repository", 500, [
    { type: "header", icon: "git-branch", title: "{title}", sub: "{subtitle}" },
    { type: "timeline", items: "{items}" },
  ], { title: "main", subtitle: "3 new commits", items: ["Fix checkout bug · 2m", "Add dark mode · 1h", "Update docs · 3h"] }),
  T("feature-flag", "devtools", "Feature flags", "feature flag rollout toggle release", 440, [
    { type: "text", text: "{title}", size: "m" },
    { type: "toggle", label: "{label}", on: true },
    { type: "progress", label: "Rollout", value: 50 },
  ], { title: "Feature flags", label: "New dashboard" }),
  T("incident", "devtools", "An incident resolved", "incident outage alert on-call resolved", 480, [
    { type: "header", icon: "siren", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "danger" },
    { type: "timeline", items: "{items}" },
  ], { title: "Incident", subtitle: "API latency", status: "Resolved", items: ["Detected · 10:02", "Team paged · 10:03", "Fixed · 10:11"] }),

  // ── HR / hiring ───────────────────────────────────────────────────────────
  T("job-post", "hr", "A job opening", "job post opening role hiring vacancy", 460, [
    { type: "header", icon: "briefcase", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "tags", items: "{items}" },
    { type: "avatars", n: 18, label: "applicants" },
  ], { title: "Product Designer", subtitle: "Remote · Full-time", status: "Open", items: ["Design", "Senior", "Remote"] }),
  T("hiring-pipeline", "hr", "Candidates by hiring stage", "hiring pipeline recruiting candidates stages ats", 560, [
    { type: "header", icon: "users", title: "{title}", badge: "{status}", tone: "info" },
    { type: "stages", items: "{items}", counts: [64, 22, 8, 2], active: 2 },
  ], { title: "Hiring", status: "Designer", items: ["Applied", "Screen", "Interview", "Offer"] }),
  T("interview", "hr", "An interview slot booked", "interview schedule slot candidate meeting", 460, [
    { type: "header", icon: "calendar-clock", title: "{title}", sub: "{subtitle}" },
    { type: "slots", items: ["9:00", "10:30", "11:00", "1:30", "3:00", "4:30"], active: 3 },
  ], { title: "Interview", subtitle: "Pick a time" }),
  T("offer", "hr", "A job offer sent", "offer letter hire accepted", 440, [
    { type: "header", icon: "file-check", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Role", "{label}"], ["Start", "{date}"]] },
  ], { title: "Offer letter", subtitle: "Tania Akter", status: "Accepted", label: "Product Designer", date: "1 Oct" }),
  T("onboarding", "hr", "A new hire's onboarding", "onboarding new hire first day checklist welcome", 460, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "checklist", items: "{items}" },
  ], { name: "Tania Akter", subtitle: "Starts Monday", status: "Day 1", items: ["Laptop ready", "Accounts created", "Buddy assigned"] }),
  T("time-off", "hr", "A time-off request", "leave vacation time off pto request", 440, [
    { type: "header", icon: "palmtree", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "calendar", days: [14, 15, 16, 17, 18] },
  ], { title: "Time off", subtitle: "Rahim · 5 days", status: "Pending" }),
  T("payroll", "hr", "Payroll run", "payroll salary pay run employees", 460, [
    { type: "header", icon: "banknote", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{amount}", label: "{label}" },
    { type: "avatars", n: 24, label: "employees" },
  ], { title: "Payroll", subtitle: "September", status: "Paid", amount: "$86,400", label: "Total" }),
  T("attendance", "hr", "Team attendance today", "attendance check-in present shift clock", 440, [
    { type: "header", icon: "clock", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 92, label: "{label}" },
  ], { title: "Attendance", subtitle: "Today", label: "checked in" }),

  // ── projects / productivity ───────────────────────────────────────────────
  T("project", "projects", "A project with progress", "project progress status plan work", 480, [
    { type: "header", icon: "folder-kanban", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "progress", label: "{label}", value: 68 },
    { type: "avatars", n: 6, label: "members" },
  ], { title: "Website redesign", subtitle: "Due 30 Oct", status: "On track", label: "Complete" }),
  T("sprint", "projects", "A sprint board", "sprint agile scrum board stories", 560, [
    { type: "header", icon: "kanban", title: "{title}", badge: "{status}", tone: "info" },
    { type: "stages", items: "{items}", counts: [12, 6, 4, 18], active: 3 },
  ], { title: "Sprint 14", status: "Day 6", items: ["To do", "Doing", "Review", "Done"] }),
  T("milestone", "projects", "Milestones on a timeline", "milestone timeline roadmap plan phases", 480, [
    { type: "header", icon: "flag", title: "{title}" },
    { type: "timeline", items: "{items}" },
  ], { title: "Roadmap", items: ["Research · Aug", "Design · Sep", "Launch · Oct"] }),
  T("workload", "projects", "Team workload", "workload capacity resources team allocation", 480, [
    { type: "header", icon: "gauge", title: "{title}" },
    { type: "progress", label: "{label}", value: 72 },
    { type: "progress", label: "{subtitle}", value: 45 },
    { type: "progress", label: "{status}", value: 88, tone: "warn" },
  ], { title: "Workload", label: "Design", subtitle: "Engineering", status: "Marketing" }),
  T("doc", "projects", "A shared document", "document doc write notes collaborate", 480, [
    { type: "header", icon: "file-text", title: "{title}", sub: "{subtitle}" },
    { type: "text", text: "{note}", size: "s", muted: true },
    { type: "avatars", n: 3, label: "editing" },
  ], { title: "Launch plan", subtitle: "Edited just now", note: "Goals, timeline and owners for the October launch." }),
  T("folder", "projects", "Shared files", "files folder drive storage share", 460, [
    { type: "header", icon: "folder-open", title: "{title}", sub: "{subtitle}" },
    { type: "rows", items: "{items}", icon: "file" },
  ], { title: "Shared", subtitle: "12 files", items: ["Brief.pdf · 2 MB", "Designs.fig · 18 MB", "Budget.xlsx · 1 MB"] }),
  T("whiteboard", "projects", "A whiteboard of ideas", "whiteboard ideas brainstorm sticky notes", 480, [
    { type: "text", text: "{title}", size: "m" },
    { type: "tags", items: "{items}" },
    { type: "avatars", n: 4, label: "online" },
  ], { title: "Brainstorm", items: ["Idea", "Research", "Vote"] }),

  // ── real estate ───────────────────────────────────────────────────────────
  T("listing", "realestate", "A property listing", "property listing home house apartment sale rent", 460, [
    { type: "media", icon: "house", ratio: 2 },
    { type: "text", text: "{title}", size: "m" },
    { type: "kv", pairs: [["Price", "{amount}"], ["Size", "{label}"]] },
  ], { title: "3-bed apartment, Gulshan", amount: "$240,000", label: "1,450 sq ft" }),
  T("viewing", "realestate", "A property viewing booked", "viewing visit tour showing booking", 440, [
    { type: "header", icon: "key-round", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "slots", items: ["Sat 10:00", "Sat 12:00", "Sun 11:00"], active: 1 },
  ], { title: "Viewing", subtitle: "Gulshan apartment", status: "Booked" }),
  T("mortgage", "realestate", "A mortgage calculator", "mortgage loan calculator payment home", 440, [
    { type: "header", icon: "landmark", title: "{title}" },
    { type: "price", amount: "{amount}", period: "/ month" },
    { type: "kv", pairs: [["Rate", "{label}"], ["Term", "{value}"]] },
  ], { title: "Mortgage", amount: "$1,420", label: "5.1%", value: "25 years" }),
  T("tenant", "realestate", "A tenant and rent status", "tenant rent lease property management", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Rent", "{amount}"], ["Lease ends", "{date}"]] },
  ], { name: "Arif Hasan", subtitle: "Unit 4B", status: "Paid", amount: "$900", date: "Mar 2027" }),
  T("occupancy", "realestate", "Occupancy across properties", "occupancy vacancy units portfolio", 440, [
    { type: "header", icon: "building-2", title: "{title}", sub: "{subtitle}" },
    { type: "meter", value: 94, label: "{label}" },
  ], { title: "Portfolio", subtitle: "12 buildings", label: "occupied" }),

  // ── hospitality / restaurants ─────────────────────────────────────────────
  T("reservation", "hospitality", "A table reservation", "reservation booking table restaurant guests", 440, [
    { type: "header", icon: "utensils", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "slots", items: ["6:30", "7:00", "7:30", "8:00", "8:30", "9:00"], active: 2 },
  ], { title: "Table for 4", subtitle: "Friday", status: "Confirmed" }),
  T("menu-item", "hospitality", "A menu item", "menu dish food item price", 420, [
    { type: "media", icon: "chef-hat", ratio: 2 },
    { type: "text", text: "{title}", size: "m" },
    { type: "kv", pairs: [["Price", "{amount}"], ["Prep", "{label}"]] },
  ], { title: "Grilled chicken bowl", amount: "$12", label: "12 min" }),
  T("kitchen-order", "hospitality", "A kitchen order ticket", "kitchen order ticket kds cooking table", 440, [
    { type: "header", icon: "cooking-pot", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "checklist", items: "{items}" },
  ], { title: "Table 7", subtitle: "2 min ago", status: "Cooking", items: ["2 × Chicken bowl", "1 × Salad", "3 × Lemonade"] }),
  T("room-booking", "hospitality", "A hotel room booking", "hotel room booking stay check-in nights", 460, [
    { type: "header", icon: "bed-double", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Check-in", "{date}"], ["Nights", "{value}"], ["Total", "{amount}"]] },
  ], { title: "Deluxe room", subtitle: "Sea view", status: "Booked", date: "12 Oct", value: "3", amount: "$420" }),
  T("guest-review", "hospitality", "A guest review", "review guest rating stay feedback", 480, [
    { type: "stars", n: 5, label: "{value}" },
    { type: "text", text: "{note}", size: "s" },
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
  ], { value: "5.0", note: "“Lovely stay, fast check-in, great staff.”", name: "Guest", subtitle: "Stayed 3 nights" }),

  // ── travel ────────────────────────────────────────────────────────────────
  T("flight", "travel", "A flight booking", "flight plane ticket boarding airline trip", 500, [
    { type: "header", icon: "plane", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "steps", items: "{items}", active: 1 },
  ], { title: "DAC → SIN", subtitle: "12 Oct · 09:40", status: "On time", items: ["Booked", "Checked in", "Boarding", "Landed"] }),
  T("itinerary", "travel", "A trip itinerary", "itinerary trip plan schedule travel days", 480, [
    { type: "header", icon: "map", title: "{title}", sub: "{subtitle}" },
    { type: "timeline", items: "{items}" },
  ], { title: "Singapore trip", subtitle: "4 days", items: ["Flight · Day 1", "City tour · Day 2", "Gardens · Day 3"] }),
  T("boarding-pass", "travel", "A boarding pass", "boarding pass ticket gate seat", 460, [
    { type: "header", icon: "ticket", title: "{title}", sub: "{subtitle}" },
    { type: "kv", pairs: [["Gate", "{label}"], ["Seat", "{value}"]] },
    { type: "qr" },
  ], { title: "Boarding pass", subtitle: "DAC → SIN", label: "B12", value: "14A" }),
  T("trip-budget", "travel", "A trip budget", "budget travel spend trip expenses", 440, [
    { type: "header", icon: "wallet", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 64, label: "{label}" },
  ], { title: "Trip budget", subtitle: "$1,280 of $2,000", label: "spent" }),

  // ── legal / compliance ────────────────────────────────────────────────────
  T("contract", "legal", "A contract ready to sign", "contract agreement document legal sign", 480, [
    { type: "header", icon: "file-text", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "checklist", items: "{items}" },
    { type: "button", text: "{action}", icon: "pen-line" },
  ], { title: "Service agreement", subtitle: "3 parties", status: "Pending", items: ["Terms reviewed", "Pricing agreed", "Ready to sign"], action: "Sign now" }),
  T("e-sign", "legal", "A document signed electronically", "signature e-sign signed esignature", 460, [
    { type: "header", icon: "signature", title: "{title}", badge: "{status}", tone: "success" },
    { type: "signature", name: "{name}" },
  ], { title: "Agreement", status: "Signed", name: "Maya Chen" }),
  T("case", "legal", "A legal case / matter", "case matter legal client law firm", 460, [
    { type: "header", icon: "scale", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "timeline", items: "{items}" },
  ], { title: "Case #2291", subtitle: "Contract dispute", status: "Active", items: ["Filed · Aug", "Hearing · Sep", "Ruling · Oct"] }),
  T("clause-review", "legal", "AI reviewing contract clauses", "clause review risk contract ai redline", 500, [
    { type: "header", icon: "file-search", title: "{title}", badge: "{status}", tone: "warn" },
    { type: "rows", items: "{items}", icon: "file-text" },
  ], { title: "Clause review", status: "2 risks", items: ["Liability · · High", "Termination · · Medium", "Payment terms · · OK"] }),
  T("compliance", "legal", "Compliance checklist", "compliance gdpr audit policy regulation", 460, [
    { type: "header", icon: "shield-check", title: "{title}", badge: "{status}", tone: "success" },
    { type: "checklist", items: "{items}" },
  ], { title: "Compliance", status: "Passed", items: ["Data encrypted", "Access reviewed", "Audit log on"] }),

  // ── fitness / wellness ────────────────────────────────────────────────────
  T("workout", "fitness", "A workout in progress", "workout exercise training session gym", 440, [
    { type: "header", icon: "dumbbell", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{value}", label: "{label}" },
    { type: "line", values: [90, 110, 128, 142, 150, 138, 146], tone: "danger" },
  ], { title: "HIIT", subtitle: "32 min", status: "Live", value: "420 kcal", label: "Burned" }),
  T("class-booking", "fitness", "A class booking", "class booking gym yoga studio schedule", 460, [
    { type: "header", icon: "calendar-check", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "slots", items: ["7:00", "9:00", "12:00", "5:30", "6:30", "8:00"], active: 4 },
  ], { title: "Yoga flow", subtitle: "Studio A", status: "2 spots" }),
  T("member", "fitness", "A gym member", "member membership gym client check-in", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Visits", "{value}"], ["Plan", "{label}"]] },
  ], { name: "Sami Rahman", subtitle: "Member since 2024", status: "Active", value: "48", label: "Annual" }),
  T("streak", "fitness", "A habit streak", "streak habit goal days consistency", 420, [
    { type: "header", icon: "flame", title: "{title}", tone: "warn" },
    { type: "bignum", value: "{value}", label: "{label}" },
    { type: "heat" },
  ], { title: "Streak", value: "21 days", label: "in a row" }),
  T("nutrition", "fitness", "Nutrition tracking", "nutrition calories meals diet macros", 440, [
    { type: "header", icon: "apple", title: "{title}", sub: "{subtitle}" },
    { type: "progress", label: "Protein", value: 80 },
    { type: "progress", label: "Carbs", value: 55 },
    { type: "progress", label: "Fat", value: 40, tone: "warn" },
  ], { title: "Today", subtitle: "1,640 kcal" }),

  // ── events ────────────────────────────────────────────────────────────────
  T("event", "events", "An event page", "event conference meetup webinar launch", 480, [
    { type: "media", icon: "party-popper", ratio: 2.4 },
    { type: "text", text: "{title}", size: "m" },
    { type: "kv", pairs: [["When", "{date}"], ["Where", "{label}"]] },
  ], { title: "Product Summit 2026", date: "18 Nov", label: "Dhaka" }),
  T("event-ticket", "events", "An event ticket", "ticket pass entry admission qr", 440, [
    { type: "header", icon: "ticket", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "qr" },
  ], { title: "General pass", subtitle: "Product Summit", status: "Valid" }),
  T("attendees", "events", "Attendees registered", "attendees registrations guests rsvp", 440, [
    { type: "header", icon: "users", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "avatars", n: 42 },
  ], { title: "Registrations", value: "1,240", label: "Attendees", delta: "+32%" }),
  T("agenda", "events", "An event agenda", "agenda schedule sessions speakers program", 480, [
    { type: "header", icon: "list", title: "{title}" },
    { type: "timeline", items: "{items}" },
  ], { title: "Agenda", items: ["Keynote · 10:00", "Workshops · 12:00", "Networking · 4:00"] }),

  // ── nonprofit ─────────────────────────────────────────────────────────────
  T("donation", "nonprofit", "A donation received", "donation donate gift charity give", 420, [
    { type: "header", icon: "heart-handshake", title: "{title}", sub: "{subtitle}", tone: "success" },
    { type: "bignum", value: "{amount}", label: "{label}" },
  ], { title: "New donation", subtitle: "Monthly donor", amount: "$50", label: "Thank you!" }),
  T("fundraiser", "nonprofit", "A fundraising goal", "fundraiser campaign goal raised charity", 460, [
    { type: "header", icon: "hand-heart", title: "{title}", sub: "{subtitle}" },
    { type: "bignum", value: "{amount}", label: "{label}" },
    { type: "progress", value: 72 },
  ], { title: "Clean water", subtitle: "Goal $50,000", amount: "$36,000", label: "Raised" }),
  T("volunteers", "nonprofit", "Volunteers signed up", "volunteers helpers signup community", 440, [
    { type: "header", icon: "users", title: "{title}", sub: "{subtitle}" },
    { type: "avatars", n: 86, label: "volunteers" },
  ], { title: "Volunteers", subtitle: "This weekend" }),
  T("impact", "nonprofit", "Impact numbers", "impact results lives helped outcome", 480, [
    { type: "header", icon: "sprout", title: "{title}" },
    { type: "kv", pairs: [["{label}", "{value}"], ["Communities", "{amount}"]] },
  ], { title: "Our impact", label: "People helped", value: "12,400", amount: "38" }),

  // ── insurance ─────────────────────────────────────────────────────────────
  T("policy", "insurance", "An insurance policy", "policy insurance coverage premium plan", 460, [
    { type: "header", icon: "umbrella", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Coverage", "{amount}"], ["Renews", "{date}"]] },
  ], { title: "Home insurance", subtitle: "Policy #88213", status: "Active", amount: "$250,000", date: "Jan 2027" }),
  T("claim", "insurance", "An insurance claim tracked", "claim insurance status payout filed", 480, [
    { type: "header", icon: "file-check", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "steps", items: "{items}", active: 2 },
  ], { title: "Claim #5512", subtitle: "Water damage", status: "Approved", items: ["Filed", "Review", "Approved", "Paid"] }),
  T("insurance-quote", "insurance", "An instant quote", "quote estimate price premium compare", 420, [
    { type: "header", icon: "calculator", title: "{title}", sub: "{subtitle}" },
    { type: "price", amount: "{amount}", period: "/ month" },
    { type: "button", text: "{action}" },
  ], { title: "Your quote", subtitle: "Car · Full cover", amount: "$48", action: "Get covered" }),

  // ── facilities / field service ────────────────────────────────────────────
  T("work-order", "facilities", "A maintenance work order", "work order maintenance repair technician field service", 480, [
    { type: "header", icon: "wrench", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "avatar", name: "{name}", sub: "{label}" },
  ], { title: "AC not cooling", subtitle: "Floor 3 · Room 12", status: "Assigned", name: "Karim", label: "Technician · ETA 20 min" }),
  T("inspection", "facilities", "An inspection checklist", "inspection audit safety check site", 460, [
    { type: "header", icon: "clipboard-check", title: "{title}", sub: "{subtitle}" },
    { type: "checklist", items: "{items}" },
  ], { title: "Safety inspection", subtitle: "Site B", items: ["Fire exits clear", "Extinguishers checked", "Wiring safe"] }),
  T("asset-tracker", "facilities", "Tracked equipment", "asset equipment inventory tracking tag", 480, [
    { type: "header", icon: "scan-barcode", title: "{title}", sub: "{subtitle}" },
    { type: "rows", items: "{items}", icon: "box" },
  ], { title: "Equipment", subtitle: "128 assets", items: ["Laptop #22 · Office · In use", "Projector #4 · Room 2 · Free", "Drill #9 · Site B · Repair"] }),

  // ── manufacturing ─────────────────────────────────────────────────────────
  T("production", "manufacturing", "A production line output", "production line factory output units manufacturing", 480, [
    { type: "header", icon: "factory", title: "{title}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "bars", values: [60, 72, 68, 80, 86, 90, 94] },
  ], { title: "Line 2", status: "Running", value: "4,820", label: "Units today", delta: "+9%" }),
  T("quality-check", "manufacturing", "Quality control result", "quality control qc defect inspection pass", 440, [
    { type: "header", icon: "badge-check", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 99, label: "{label}" },
  ], { title: "Quality", subtitle: "Batch 118", label: "passed" }),
  T("machine", "manufacturing", "A machine's health", "machine equipment sensor maintenance predictive", 440, [
    { type: "header", icon: "cog", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "meter", value: 86, label: "{label}" },
  ], { title: "Press #3", subtitle: "Running 14h", status: "Healthy", label: "efficiency" }),
  T("supply", "manufacturing", "Raw material supply", "supply chain materials vendor stock procurement", 480, [
    { type: "header", icon: "container", title: "{title}", sub: "{subtitle}" },
    { type: "rows", items: "{items}", icon: "package" },
  ], { title: "Supply", subtitle: "3 vendors", items: ["Steel · 12 t · OK", "Plastic · 4 t · Low", "Paint · 800 L · OK"] }),

  // ── IoT / energy / smart home ─────────────────────────────────────────────
  T("device-status", "iot", "Connected devices", "devices iot sensors connected online", 460, [
    { type: "header", icon: "cpu", title: "{title}", badge: "{status}", tone: "success" },
    { type: "rows", items: "{items}", icon: "wifi" },
  ], { title: "Devices", status: "All online", items: ["Sensor A · 22°C · OK", "Gateway · · OK", "Camera 2 · · OK"] }),
  T("energy", "iot", "Energy usage", "energy power usage electricity solar kwh", 460, [
    { type: "header", icon: "zap", title: "{title}", sub: "{subtitle}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}", tone: "success" },
    { type: "line", values: [42, 40, 38, 35, 33, 30, 28], tone: "success" },
  ], { title: "Energy", subtitle: "This week", value: "128 kWh", label: "Used", delta: "-22%" }),
  T("sensor-alert", "iot", "A sensor alert", "alert sensor threshold temperature warning", 440, [
    { type: "header", icon: "thermometer", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "danger" },
    { type: "line", values: [20, 21, 21, 23, 26, 29, 31], tone: "danger" },
  ], { title: "Cold room", subtitle: "Above 8°C", status: "Alert" }),
  T("smart-home", "iot", "Smart home controls", "smart home lights thermostat controls automation", 440, [
    { type: "text", text: "{title}", size: "m" },
    { type: "toggle", label: "{label}", on: true },
    { type: "toggle", label: "{subtitle}", on: true },
  ], { title: "Living room", label: "Lights", subtitle: "Air conditioning" }),

  // ── media / creators ──────────────────────────────────────────────────────
  T("video-stats", "media", "Video performance", "video views youtube channel creator stats", 460, [
    { type: "media", icon: "play", ratio: 2.2 },
    { type: "kv", pairs: [["Views", "{value}"], ["Watch time", "{label}"]] },
  ], { value: "184K", label: "6.2K hrs" }),
  T("content-calendar", "media", "A content calendar", "content calendar schedule posts publishing plan", 460, [
    { type: "header", icon: "calendar-range", title: "{title}", sub: "{subtitle}" },
    { type: "calendar", days: [2, 5, 9, 12, 16, 19, 23, 26] },
  ], { title: "Content plan", subtitle: "8 posts scheduled" }),
  T("subscribers", "media", "Subscriber growth", "subscribers followers audience growth creator", 440, [
    { type: "header", icon: "users", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "line", values: [10, 14, 19, 25, 33, 42, 55] },
  ], { title: "Audience", value: "52.4K", label: "Subscribers", delta: "+38%" }),
  T("media-upload", "media", "A file or video uploading", "upload uploading progress file video render", 460, [
    { type: "header", icon: "cloud-upload", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "progress", label: "{label}", value: 76 },
  ], { title: "Episode 12.mp4", subtitle: "1.2 GB", status: "Uploading", label: "Uploaded" }),
  T("podcast", "media", "A podcast episode", "podcast episode audio listen show", 460, [
    { type: "header", icon: "mic", title: "{title}", sub: "{subtitle}" },
    { type: "bars", values: [4, 9, 6, 12, 8, 14, 7, 11, 5, 10, 13, 6] },
    { type: "kv", pairs: [["Listens", "{value}"]] },
  ], { title: "Episode 42", subtitle: "38 min", value: "12.8K" }),

  // ── community / social ────────────────────────────────────────────────────
  T("post", "community", "A community post", "post feed update community social thread", 480, [
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
    { type: "text", text: "{note}", size: "s" },
    { type: "tags", items: "{items}" },
  ], { name: "Nila", subtitle: "2h ago", note: "Just shipped our first release — thank you all!", items: ["❤ 128", "💬 24"] }),
  T("comments", "community", "A comment thread", "comments replies discussion thread", 480, [
    { type: "bubble", text: "{note}" },
    { type: "bubble", text: "{action}", side: "right" },
    { type: "typing" },
  ], { note: "How did you set this up?", action: "Took five minutes with the template!" }),
  T("poll", "community", "A poll with results", "poll vote survey results question", 460, [
    { type: "text", text: "{title}", size: "m" },
    { type: "progress", label: "{label}", value: 64 },
    { type: "progress", label: "{subtitle}", value: 36 },
  ], { title: "What should we build next?", label: "Dark mode", subtitle: "Mobile app" }),
  T("members", "community", "Community members", "members community group online growth", 440, [
    { type: "header", icon: "users-round", title: "{title}", badge: "{status}", tone: "success" },
    { type: "avatars", n: 64, label: "{label}" },
  ], { title: "Community", status: "Growing", label: "online now" }),

  // ── subscriptions / SaaS metrics ──────────────────────────────────────────
  T("subscription", "subscriptions", "A subscription plan", "subscription plan billing renew monthly", 440, [
    { type: "header", icon: "repeat", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "price", amount: "{amount}", period: "/ month" },
  ], { title: "Pro plan", subtitle: "Renews 1 Nov", status: "Active", amount: "$29" }),
  T("mrr", "subscriptions", "Monthly recurring revenue", "mrr arr recurring revenue saas growth", 460, [
    { type: "header", icon: "trending-up", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "bars", values: [22, 26, 29, 33, 38, 44, 51] },
  ], { title: "MRR", value: "$48.2K", label: "This month", delta: "+14%" }),
  T("usage", "subscriptions", "Plan usage and limits", "usage limits quota seats credits plan", 440, [
    { type: "header", icon: "gauge", title: "{title}", sub: "{subtitle}" },
    { type: "progress", label: "{label}", value: 72 },
    { type: "progress", label: "Storage", value: 38 },
  ], { title: "Usage", subtitle: "Pro plan", label: "Seats" }),
  T("churn", "subscriptions", "Churn going down", "churn retention cancel customers", 440, [
    { type: "header", icon: "user-minus", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}", tone: "success" },
    { type: "line", values: [8, 7.4, 6.8, 5.9, 5.1, 4.2, 3.1], tone: "success" },
  ], { title: "Churn", value: "3.1%", label: "Monthly", delta: "-41%" }),
  T("plans", "subscriptions", "Plans to choose from", "plans pricing tiers compare upgrade", 520, [
    { type: "header", icon: "layers", title: "{title}" },
    { type: "rows", items: "{items}", icon: "circle-check" },
    { type: "button", text: "{action}" },
  ], { title: "Choose a plan", items: ["Starter · $9", "Pro · $29 · Popular", "Team · $79"], action: "Upgrade" }),

  // ── fleet / automotive ────────────────────────────────────────────────────
  T("vehicle", "fleet", "A vehicle's status", "vehicle car truck fleet driver status", 460, [
    { type: "header", icon: "car", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Driver", "{name}"], ["Fuel", "{value}"]] },
  ], { title: "Van 12", subtitle: "Route North", status: "Moving", name: "Jamal", value: "68%" }),
  T("fleet-map", "fleet", "Vehicles on a live map", "fleet map gps live tracking vehicles", 520, [
    { type: "header", icon: "map-pinned", title: "{title}", badge: "{status}", tone: "info" },
    { type: "map" },
  ], { title: "Fleet", status: "24 active" }),
  T("service-due", "fleet", "A service reminder", "service maintenance due reminder vehicle", 440, [
    { type: "header", icon: "wrench", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "progress", label: "{label}", value: 92, tone: "warn" },
  ], { title: "Van 7", subtitle: "Oil change", status: "Due", label: "Until service" }),

  // ── agriculture ───────────────────────────────────────────────────────────
  T("field", "agriculture", "A farm field's health", "farm field crop agriculture soil", 460, [
    { type: "header", icon: "sprout", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Moisture", "{value}"], ["Crop", "{label}"]] },
  ], { title: "Field 4", subtitle: "12 acres", status: "Healthy", value: "38%", label: "Rice" }),
  T("weather", "agriculture", "A weather forecast", "weather forecast rain temperature", 440, [
    { type: "header", icon: "cloud-sun", title: "{title}", sub: "{subtitle}" },
    { type: "bignum", value: "{value}", label: "{label}" },
    { type: "bars", values: [2, 5, 9, 4, 1, 0, 3] },
  ], { title: "Forecast", subtitle: "Next 7 days", value: "29°C", label: "Rain on Wed" }),
  T("harvest", "agriculture", "Harvest yield", "harvest yield output tons crop", 440, [
    { type: "header", icon: "wheat", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
  ], { title: "Harvest", value: "48 t", label: "This season", delta: "+12%" }),

  // ── health (more) ─────────────────────────────────────────────────────────
  T("patient", "health", "A patient record", "patient record clinic medical history", 460, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "kv", pairs: [["Last visit", "{date}"], ["Condition", "{label}"]] },
  ], { name: "Rina Das", subtitle: "Age 34", status: "Checked in", date: "12 Sep", label: "Follow-up" }),
  T("clinic-queue", "health", "Patients waiting in a clinic", "queue waiting room clinic patients token", 480, [
    { type: "header", icon: "hospital", title: "{title}", badge: "{status}", tone: "info" },
    { type: "rows", items: "{items}", icon: "user" },
  ], { title: "Waiting room", status: "4 waiting", items: ["Token 12 · 5 min · Next", "Token 13 · 15 min", "Token 14 · 25 min"] }),
  T("lab-result", "health", "Lab test results", "lab test results blood report", 460, [
    { type: "header", icon: "flask-conical", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "rows", items: "{items}", icon: "activity" },
  ], { title: "Blood test", subtitle: "Ready", status: "Normal", items: ["Glucose · 92 · OK", "Cholesterol · 180 · OK", "Iron · 14 · OK"] }),
  T("telehealth", "health", "A video consultation", "telehealth video consult doctor online", 480, [
    { type: "media", icon: "video", ratio: 2 },
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "success" },
  ], { name: "Dr. Karim", subtitle: "General physician", status: "Live" }),
  T("reminder", "health", "A medication or care reminder", "reminder medication pill schedule care", 420, [
    { type: "header", icon: "alarm-clock", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "button", text: "{action}", icon: "check" },
  ], { title: "Take medicine", subtitle: "8:00 PM", status: "Now", action: "Mark taken" }),

  // ── education (more) ──────────────────────────────────────────────────────
  T("lesson", "education", "A lesson playing", "lesson video class lecture learn", 480, [
    { type: "media", icon: "play", ratio: 2.2 },
    { type: "text", text: "{title}", size: "m" },
    { type: "progress", value: 40 },
  ], { title: "Lesson 3: Fractions" }),
  T("grades", "education", "Student grades", "grades marks scores report card", 460, [
    { type: "header", icon: "graduation-cap", title: "{title}", sub: "{subtitle}" },
    { type: "rows", items: "{items}", icon: "book" },
  ], { title: "Report card", subtitle: "Term 1", items: ["Math · A", "Science · A-", "English · B+"] }),
  T("assignment", "education", "An assignment submitted", "assignment homework submit due", 440, [
    { type: "header", icon: "notebook-pen", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "progress", label: "{label}", value: 100, tone: "success" },
  ], { title: "Essay", subtitle: "Due Friday", status: "Submitted", label: "Done" }),
  T("live-class", "education", "A live class with students", "live class online students teacher", 480, [
    { type: "header", icon: "presentation", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "danger" },
    { type: "avatars", n: 32, label: "students" },
  ], { title: "Physics", subtitle: "Mr. Rahman", status: "Live" }),
  T("class-attendance", "education", "Class attendance", "attendance class students present", 440, [
    { type: "header", icon: "school", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 96, label: "{label}" },
  ], { title: "Class 8B", subtitle: "Today", label: "present" }),

  // ── marketing (more) ──────────────────────────────────────────────────────
  T("seo", "marketing", "Search ranking", "seo search ranking google keywords traffic", 480, [
    { type: "header", icon: "search", title: "{title}" },
    { type: "rows", items: "{items}", icon: "trending-up" },
  ], { title: "Rankings", items: ["best crm · #3", "crm for teams · #1", "sales tracker · #5"] }),
  T("email-stats", "marketing", "Email campaign results", "email campaign open rate clicks newsletter", 460, [
    { type: "header", icon: "mail-open", title: "{title}", sub: "{subtitle}" },
    { type: "kv", pairs: [["Opened", "{value}"], ["Clicked", "{label}"]] },
    { type: "progress", value: 58 },
  ], { title: "Newsletter", subtitle: "Sent to 12K", value: "58%", label: "14%" }),
  T("ab-test", "marketing", "An A/B test result", "ab test experiment variant conversion", 460, [
    { type: "header", icon: "split", title: "{title}", badge: "{status}", tone: "success" },
    { type: "progress", label: "{label}", value: 38 },
    { type: "progress", label: "{subtitle}", value: 61, tone: "success" },
  ], { title: "Headline test", status: "B wins", label: "Variant A", subtitle: "Variant B" }),
  T("audience", "marketing", "An audience segment", "audience segment targeting customers persona", 460, [
    { type: "header", icon: "users", title: "{title}", sub: "{subtitle}" },
    { type: "tags", items: "{items}" },
    { type: "bignum", value: "{value}", label: "{label}" },
  ], { title: "Segment", subtitle: "Active buyers", items: ["25–34", "Mobile", "Returning"], value: "18.2K", label: "People" }),
  T("scheduler", "marketing", "Scheduled social posts", "social schedule posts queue publish", 480, [
    { type: "header", icon: "calendar-clock", title: "{title}", badge: "{status}", tone: "info" },
    { type: "timeline", items: "{items}" },
  ], { title: "Scheduled", status: "5 posts", items: ["Launch teaser · Mon 9:00", "Customer story · Wed 12:00", "Live demo · Fri 5:00"] }),

  // ── finance (more) ────────────────────────────────────────────────────────
  T("loan", "finance", "A loan application", "loan credit application approval lending", 460, [
    { type: "header", icon: "landmark", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "steps", items: ["Applied", "Verified", "Approved", "Funded"], active: 2 },
  ], { title: "Business loan", subtitle: "$20,000", status: "Approved" }),
  T("tax", "finance", "Tax estimate", "tax vat estimate filing accounting", 440, [
    { type: "header", icon: "receipt", title: "{title}", sub: "{subtitle}" },
    { type: "bignum", value: "{amount}", label: "{label}" },
    { type: "button", text: "{action}" },
  ], { title: "Tax", subtitle: "Q3 estimate", amount: "$3,240", label: "Due 15 Oct", action: "File now" }),
  T("split-bill", "finance", "A bill split between people", "split bill share expense friends group", 440, [
    { type: "header", icon: "split", title: "{title}", sub: "{subtitle}" },
    { type: "rows", items: "{items}", icon: "user" },
  ], { title: "Team lunch", subtitle: "$96 total", items: ["Rahim · $24 · Paid", "Nila · $24 · Paid", "Sami · $24 · Due"] }),
  T("investment", "finance", "An investment portfolio", "investment portfolio stocks returns wealth", 460, [
    { type: "header", icon: "chart-line", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "line", values: [100, 104, 102, 109, 114, 112, 121] },
  ], { title: "Portfolio", value: "$18,420", label: "Total value", delta: "+8.4%" }),

  // ── security (more) ───────────────────────────────────────────────────────
  T("access-log", "security", "Sign-in activity", "access log sign in activity audit", 500, [
    { type: "header", icon: "log-in", title: "{title}" },
    { type: "rows", items: "{items}", icon: "monitor" },
  ], { title: "Sign-ins", items: ["MacBook · Dhaka · OK", "iPhone · Dhaka · OK", "Unknown · Abroad · Blocked"] }),
  T("permissions", "security", "Roles and permissions", "permissions roles access rbac admin", 460, [
    { type: "text", text: "{title}", size: "m" },
    { type: "toggle", label: "{label}", on: true },
    { type: "toggle", label: "{subtitle}", on: false },
  ], { title: "Editor role", label: "Can edit", subtitle: "Can delete" }),
  T("backup", "security", "Backup completed", "backup restore data snapshot cloud", 440, [
    { type: "header", icon: "database-backup", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "progress", value: 100, tone: "success" },
  ], { title: "Backup", subtitle: "2.4 GB · 3 min ago", status: "Done" }),
  T("vulnerability", "security", "Vulnerabilities fixed", "vulnerability scan security patch cve", 460, [
    { type: "header", icon: "shield-alert", title: "{title}", badge: "{status}", tone: "success" },
    { type: "rows", items: "{items}", icon: "shield" },
  ], { title: "Security scan", status: "0 critical", items: ["Critical · 0 · OK", "High · 0 · OK", "Low · 2 · Review"] }),

  // ── public services ───────────────────────────────────────────────────────
  T("application", "public", "An application being processed", "application permit license form status government", 480, [
    { type: "header", icon: "file-badge", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "steps", items: ["Submitted", "Review", "Approved", "Issued"], active: 1 },
  ], { title: "Trade licence", subtitle: "#TL-20931", status: "In review" }),
  T("form", "public", "An online form being filled", "form fill apply register signup input", 460, [
    { type: "text", text: "{title}", size: "m" },
    { type: "input", label: "{label}", value: "{name}", icon: "user" },
    { type: "button", text: "{action}" },
  ], { title: "Register", label: "Full name", name: "Ayesha Rahman", action: "Submit" }),

  // ── logistics (more) ──────────────────────────────────────────────────────
  T("route", "logistics", "An optimised delivery route", "route optimise stops driver map", 500, [
    { type: "header", icon: "route", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "timeline", items: "{items}" },
  ], { title: "Route", subtitle: "12 stops", status: "Optimised", items: ["Warehouse · 9:00", "Stop 4 · 10:20", "Stop 12 · 1:40"] }),
  T("proof-of-delivery", "logistics", "Proof of delivery", "proof delivery signature photo received", 440, [
    { type: "header", icon: "package-check", title: "{title}", sub: "{subtitle}", tone: "success" },
    { type: "signature", name: "{name}" },
  ], { title: "Delivered", subtitle: "12:40 PM", name: "R. Hasan" }),
];
