import type { Block, CardContent, CardTemplate } from "./types";

// The card templates. Content slots ({title}, {value}, {items} …) come from
// the Director; the defaults keep every card plausible on its own. Values are
// illustrative UI, never claims.

const T = (id: string, category: string, description: string, tags: string, w: number, blocks: Block[], defaults: CardContent = {}): CardTemplate => ({
  id,
  category,
  description,
  tags: tags.split(/\s+/),
  w,
  blocks,
  defaults,
});

const rows = (items: [string, string, string?, string?][]) => items.map(([icon, text, value, status]) => ({ icon, text, value, status }));

export const CARD_TEMPLATES: CardTemplate[] = [
  // ── commerce ──────────────────────────────────────────────────────────────
  T("order", "commerce", "A new order: item, amount, status", "order purchase sale checkout new", 460, [
    { type: "header", icon: "shopping-bag", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "divider" },
    { type: "kv", pairs: [["Items", "{label}"], ["Total", "{amount}"]] },
  ], { title: "Order #1042", subtitle: "2 min ago", status: "New", label: "3 products", amount: "$240.00" }),
  T("order-list", "commerce", "Incoming orders as a list", "orders list incoming queue", 520, [
    { type: "header", icon: "shopping-cart", title: "{title}", badge: "{status}" },
    { type: "rows", items: rows([["package", "#1042 · Ayesha", "$48", "Paid"], ["package", "#1043 · Rahim", "$120", "COD"], ["package", "#1044 · Nila", "$36", "Paid"]]) },
  ], { title: "Orders", status: "Live" }),
  T("product", "commerce", "A product with price and stock", "product item catalog price stock", 400, [
    { type: "media", icon: "shirt", ratio: 1.5 },
    { type: "text", text: "{title}", size: "m" },
    { type: "kv", pairs: [["Price", "{amount}"], ["Stock", "{value}"]] },
  ], { title: "Cotton T-shirt", amount: "$18", value: "124" }),
  T("inventory", "commerce", "Stock levels updating", "inventory stock warehouse update level", 480, [
    { type: "header", icon: "boxes", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "progress", label: "In stock", value: 72 },
    { type: "rows", items: rows([["box", "T-shirts", "124"], ["box", "Sneakers", "38"]]) },
  ], { title: "Inventory", subtitle: "Auto-synced", status: "Updated" }),
  T("low-stock", "commerce", "A low-stock alert", "alert low stock warning inventory", 440, [
    { type: "header", icon: "triangle-alert", title: "{title}", sub: "{subtitle}", tone: "warn" },
    { type: "progress", label: "{label}", value: 12, tone: "warn" },
    { type: "button", text: "{action}", icon: "refresh-cw" },
  ], { title: "Low stock", subtitle: "Sneakers · size 42", label: "Remaining", action: "Reorder" }),
  T("cart", "commerce", "A shopping cart", "cart basket checkout items", 440, [
    { type: "header", icon: "shopping-cart", title: "{title}", badge: "{label}" },
    { type: "rows", items: rows([["shirt", "T-shirt", "$18"], ["footprints", "Sneakers", "$64"]]) },
    { type: "button", text: "{action}" },
  ], { title: "Cart", label: "2 items", action: "Checkout" }),
  T("checkout", "commerce", "Checkout with payment method", "checkout pay payment method total", 460, [
    { type: "text", text: "{title}", size: "m" },
    { type: "input", label: "Card", value: "•••• 4242", icon: "credit-card" },
    { type: "kv", pairs: [["Total", "{amount}"]] },
    { type: "button", text: "{action}", icon: "lock" },
  ], { title: "Checkout", amount: "$82.00", action: "Pay now" }),
  T("receipt", "commerce", "A receipt / invoice summary", "receipt invoice bill paid total", 420, [
    { type: "header", icon: "receipt", title: "{title}", sub: "{date}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Subtotal", "$76.00"], ["Delivery", "$6.00"], ["Total", "{amount}"]] },
  ], { title: "Receipt", date: "Today", status: "Paid", amount: "$82.00" }),
  T("refund", "commerce", "A refund processed", "refund return money back", 420, [
    { type: "header", icon: "undo-2", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "bignum", value: "{amount}", label: "Refunded" },
  ], { title: "Refund", subtitle: "Order #1039", status: "Done", amount: "$36.00" }),
  T("return", "commerce", "A return request", "return request exchange", 420, [
    { type: "header", icon: "package-open", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "steps", items: ["Requested", "Picked", "Refunded"], active: 1 },
  ], { title: "Return", subtitle: "Order #1031", status: "In progress" }),
  T("coupon", "commerce", "A discount coupon", "coupon discount promo code sale offer", 400, [
    { type: "bignum", value: "{value}", label: "{label}" },
    { type: "tags", items: "{items}" },
  ], { value: "20% OFF", label: "Weekend offer", items: ["SAVE20", "Ends Sunday"] }),
  T("review", "commerce", "A customer review", "review rating stars feedback customer", 460, [
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
    { type: "stars", n: 5, label: "{value}" },
    { type: "text", text: "{note}", muted: true, size: "s" },
  ], { name: "Nusrat Jahan", subtitle: "Verified buyer", value: "5.0", note: "Fast delivery, great quality." }),
  T("storefront", "commerce", "An online store front", "store shop storefront website", 520, [
    { type: "header", icon: "store", title: "{title}", sub: "{subtitle}", badge: "{status}" },
    { type: "media", icon: "shopping-bag", ratio: 2.4 },
    { type: "tags", items: "{items}" },
  ], { title: "Your store", subtitle: "Online now", status: "Live", items: ["New", "Best sellers", "Sale"] }),
  T("sales-kpi", "commerce", "Today's sales number", "sales revenue today kpi", 400, [
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "line", values: [8, 12, 10, 16, 14, 21, 26] },
  ], { value: "$12,480", label: "Sales today", delta: "+18%" }),

  // ── logistics ─────────────────────────────────────────────────────────────
  T("courier", "logistics", "A courier pickup / dispatch", "courier dispatch pickup shipping delivery rider", 460, [
    { type: "header", icon: "truck", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "steps", items: ["Packed", "Picked", "On way", "Delivered"], active: 2 },
  ], { title: "Courier", subtitle: "Order #1042", status: "Dispatched" }),
  T("tracking", "logistics", "Parcel tracking on a map", "tracking map route parcel delivery location", 500, [
    { type: "header", icon: "map-pin", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "map" },
  ], { title: "Tracking", subtitle: "Arriving in 25 min", status: "On the way" }),
  T("delivered", "logistics", "Delivery completed", "delivered delivery complete done", 400, [
    { type: "header", icon: "package-check", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "progress", value: 100, tone: "success" },
  ], { title: "Delivered", subtitle: "Order #1042", status: "Done" }),
  T("shipment-list", "logistics", "Shipments by courier", "shipments courier list dispatch", 520, [
    { type: "header", icon: "truck", title: "{title}" },
    { type: "rows", items: rows([["truck", "Pathao", "12", "Picked"], ["truck", "Steadfast", "8", "Queued"], ["truck", "RedX", "5", "Delivered"]]) },
  ], { title: "Shipments" }),
  T("warehouse", "logistics", "Warehouse capacity", "warehouse storage capacity", 440, [
    { type: "header", icon: "warehouse", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 68, label: "{label}" },
  ], { title: "Warehouse", subtitle: "Dhaka hub", label: "Capacity used" }),

  // ── finance ───────────────────────────────────────────────────────────────
  T("payment", "finance", "A payment received", "payment received paid money transaction", 440, [
    { type: "header", icon: "circle-dollar-sign", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{amount}" },
  ], { title: "Payment received", subtitle: "bKash · just now", status: "Paid", amount: "$240.00" }),
  T("balance", "finance", "Account balance with trend", "balance wallet account money", 440, [
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "line", values: [20, 24, 22, 30, 28, 36, 42] },
  ], { value: "$48,210", label: "Balance", delta: "+12%" }),
  T("transactions", "finance", "Recent transactions", "transactions history payments list", 520, [
    { type: "header", icon: "arrow-left-right", title: "{title}" },
    { type: "rows", items: rows([["arrow-down-left", "Order #1042", "+$48", "In"], ["arrow-up-right", "Courier fee", "-$6", "Out"], ["arrow-down-left", "Order #1043", "+$120", "In"]]) },
  ], { title: "Transactions" }),
  T("bank-card", "finance", "A bank card", "card credit debit bank", 460, [
    { type: "header", icon: "credit-card", title: "{title}", sub: "{subtitle}" },
    { type: "text", text: "•••• •••• •••• 4242", size: "l" },
    { type: "kv", pairs: [["Holder", "{name}"]] },
  ], { title: "Business card", subtitle: "Visa", name: "Your Company" }),
  T("payout", "finance", "A payout to bank", "payout transfer settlement bank withdraw", 440, [
    { type: "header", icon: "landmark", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "bignum", value: "{amount}" },
    { type: "progress", value: 100, tone: "success" },
  ], { title: "Payout", subtitle: "To your bank", status: "Sent", amount: "$3,120" }),
  T("invoice", "finance", "An invoice with line items", "invoice bill items due", 500, [
    { type: "header", icon: "file-text", title: "{title}", sub: "{date}", badge: "{status}", tone: "warn" },
    { type: "table", cols: ["Item", "Qty", "Amount"], rows: [["Design", "1", "$800"], ["Hosting", "12", "$240"]] },
    { type: "kv", pairs: [["Total", "{amount}"]] },
  ], { title: "Invoice #204", date: "Due in 7 days", status: "Due", amount: "$1,040" }),
  T("expense", "finance", "Expense by category", "expense spending cost budget", 460, [
    { type: "header", icon: "wallet", title: "{title}" },
    { type: "bars", values: [6, 9, 4, 12, 7] },
    { type: "tags", items: "{items}" },
  ], { title: "Expenses", items: ["Ads", "Delivery", "Tools"] }),
  T("budget", "finance", "Budget progress", "budget limit spend target", 420, [
    { type: "header", icon: "piggy-bank", title: "{title}", sub: "{subtitle}" },
    { type: "progress", label: "{label}", value: 64 },
  ], { title: "Monthly budget", subtitle: "$6,400 of $10,000", label: "Used" }),
  T("profit", "finance", "Real profit after costs", "profit margin earnings net", 420, [
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "bars", values: [4, 6, 5, 8, 7, 10, 12] },
  ], { value: "$8,960", label: "Real profit", delta: "+24%" }),

  // ── analytics ─────────────────────────────────────────────────────────────
  T("kpi", "analytics", "A single big number", "kpi metric number stat", 360, [
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
  ], { value: "12.4K", label: "Visitors", delta: "+9%" }),
  T("line-chart", "analytics", "A line chart trend", "chart trend growth line graph", 520, [
    { type: "header", icon: "chart-line", title: "{title}", badge: "{delta}", tone: "success" },
    { type: "line", values: [10, 14, 12, 18, 16, 24, 30, 36] },
  ], { title: "Growth", delta: "+32%" }),
  T("bar-chart", "analytics", "A bar chart", "chart bars comparison graph", 500, [
    { type: "header", icon: "chart-column", title: "{title}", sub: "{subtitle}" },
    { type: "bars", values: [5, 8, 6, 11, 9, 14, 18] },
  ], { title: "Weekly orders", subtitle: "Last 7 days" }),
  T("donut-chart", "analytics", "A share / percentage", "donut pie share percent", 440, [
    { type: "header", icon: "chart-pie", title: "{title}" },
    { type: "donut", value: 76, label: "{label}" },
  ], { title: "Conversion", label: "of visitors buy" }),
  T("funnel", "analytics", "A conversion funnel", "funnel conversion stages", 480, [
    { type: "header", icon: "filter", title: "{title}" },
    { type: "progress", label: "Visits", value: 100 },
    { type: "progress", label: "Carts", value: 42 },
    { type: "progress", label: "Orders", value: 18 },
  ], { title: "Funnel" }),
  T("leaderboard", "analytics", "Top items ranking", "top ranking leaderboard best", 480, [
    { type: "header", icon: "trophy", title: "{title}" },
    { type: "rows", items: rows([["medal", "Sneakers", "412"], ["medal", "T-shirt", "388"], ["medal", "Cap", "240"]]) },
  ], { title: "Best sellers" }),
  T("report-table", "analytics", "A report table", "report table data rows", 560, [
    { type: "header", icon: "table", title: "{title}", sub: "{subtitle}" },
    { type: "table", cols: ["Channel", "Orders", "Revenue"], rows: [["Facebook", "412", "$9.8K"], ["Website", "288", "$7.1K"], ["Instagram", "140", "$3.2K"]] },
  ], { title: "Channels", subtitle: "This month" }),
  T("activity-heat", "analytics", "Activity heatmap", "heatmap activity usage", 520, [
    { type: "header", icon: "activity", title: "{title}" },
    { type: "heat" },
  ], { title: "Activity" }),
  T("dashboard-mini", "analytics", "A compact dashboard", "dashboard overview summary", 560, [
    { type: "header", icon: "layout-dashboard", title: "{title}", badge: "{status}" },
    { type: "bignum", value: "{value}", label: "{label}", delta: "{delta}" },
    { type: "bars", values: [5, 7, 6, 9, 8, 12, 15] },
  ], { title: "Overview", status: "Live", value: "$24,800", label: "Revenue", delta: "+21%" }),

  // ── operations / SaaS ─────────────────────────────────────────────────────
  T("task", "operations", "A task with status", "task todo work item", 440, [
    { type: "header", icon: "square-check", title: "{title}", sub: "{subtitle}", badge: "{status}" },
    { type: "progress", value: 60 },
  ], { title: "Pack orders", subtitle: "Due today", status: "In progress" }),
  T("checklist", "operations", "A checklist ticking off", "checklist steps done todo", 440, [
    { type: "text", text: "{title}", size: "m" },
    { type: "checklist", items: "{items}" },
  ], { title: "Today", items: ["Confirm orders", "Update stock", "Book couriers"] }),
  T("workflow", "operations", "An automated workflow", "workflow automation steps pipeline", 520, [
    { type: "header", icon: "workflow", title: "{title}", badge: "{status}", tone: "success" },
    { type: "rows", items: rows([["zap", "When an order arrives"], ["boxes", "Update inventory"], ["truck", "Book the courier"]]) },
  ], { title: "Automation", status: "On" }),
  T("approval", "operations", "An approval request", "approval approve review request", 440, [
    { type: "header", icon: "stamp", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "warn" },
    { type: "button", text: "{action}", icon: "check" },
  ], { title: "Refund request", subtitle: "Needs approval", status: "Pending", action: "Approve" }),
  T("calendar-event", "operations", "A calendar with booked days", "calendar schedule booking date appointment", 460, [
    { type: "header", icon: "calendar", title: "{title}", sub: "{subtitle}" },
    { type: "calendar", days: [4, 9, 12, 18, 23] },
  ], { title: "Schedule", subtitle: "This month" }),
  T("meeting", "operations", "A meeting / event", "meeting event call time", 440, [
    { type: "header", icon: "video", title: "{title}", sub: "{date}" },
    { type: "tags", items: "{items}" },
    { type: "button", text: "{action}" },
  ], { title: "Weekly sync", date: "Today · 3:00 PM", items: ["Team", "30 min"], action: "Join" }),
  T("integration", "operations", "Connected apps", "integrations connect apps plugins", 480, [
    { type: "header", icon: "plug", title: "{title}", badge: "{status}", tone: "success" },
    { type: "toggle", label: "Facebook shop", on: true },
    { type: "toggle", label: "Courier API", on: true },
  ], { title: "Integrations", status: "Connected" }),
  T("sync", "operations", "Data syncing", "sync syncing update realtime", 420, [
    { type: "header", icon: "refresh-cw", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "progress", value: 84 },
  ], { title: "Syncing", subtitle: "All channels", status: "Live" }),
  T("status-page", "operations", "Systems status", "status uptime health system", 480, [
    { type: "header", icon: "server", title: "{title}", badge: "{status}", tone: "success" },
    { type: "rows", items: rows([["globe", "Storefront", undefined, "OK"], ["credit-card", "Payments", undefined, "OK"], ["truck", "Couriers", undefined, "OK"]]) },
  ], { title: "All systems", status: "Operational" }),
  T("settings", "operations", "Settings toggles", "settings preferences toggle options", 440, [
    { type: "text", text: "{title}", size: "m" },
    { type: "toggle", label: "Auto-confirm orders", on: true },
    { type: "toggle", label: "SMS updates", on: true },
  ], { title: "Settings" }),
  T("kanban", "operations", "A kanban column", "kanban board column tasks", 380, [
    { type: "chip", text: "{title}", tone: "info" },
    { type: "rows", items: rows([["circle", "Pack #1042"], ["circle", "Pack #1043"], ["circle", "Label #1044"]]) },
  ], { title: "To do" }),

  // ── communication ─────────────────────────────────────────────────────────
  T("chat", "communication", "A chat conversation", "chat message conversation support", 480, [
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
    { type: "bubble", text: "{note}", side: "left" },
    { type: "bubble", text: "{action}", side: "right" },
  ], { name: "Customer", subtitle: "Online", note: "Where is my order?", action: "It's on the way — arriving today!" }),
  T("message", "communication", "A single customer message", "message inbox customer question", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "bubble", text: "{note}" },
  ], { name: "Rafi Ahmed", subtitle: "Messenger", status: "New", note: "Is this available in size 42?" }),
  T("typing", "communication", "Someone typing a reply", "typing reply chat", 380, [
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
    { type: "typing" },
  ], { name: "Support", subtitle: "Typing…" }),
  T("email", "communication", "An email", "email mail inbox", 500, [
    { type: "header", icon: "mail", title: "{title}", sub: "{subtitle}" },
    { type: "text", text: "{note}", muted: true, size: "s" },
    { type: "button", text: "{action}" },
  ], { title: "Your order is confirmed", subtitle: "to customer@mail.com", note: "Thanks for shopping with us. We're packing it now.", action: "Track order" }),
  T("sms", "communication", "An SMS notification", "sms text phone notification", 400, [
    { type: "header", icon: "message-square", title: "{title}", sub: "{subtitle}" },
    { type: "bubble", text: "{note}" },
  ], { title: "SMS", subtitle: "Just now", note: "Your parcel is out for delivery." }),
  T("call", "communication", "A phone call", "call phone verify voice", 420, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "success" },
    { type: "button", text: "{action}", icon: "phone" },
  ], { name: "AI assistant", subtitle: "Calling customer", status: "Live", action: "Order confirmed" }),
  T("notification", "communication", "A notification toast", "notification toast alert update", 440, [
    { type: "header", icon: "bell", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
  ], { title: "New order", subtitle: "#1045 · $64", status: "Now" }),
  T("success-toast", "communication", "A success message", "success done complete toast", 420, [
    { type: "header", icon: "circle-check", title: "{title}", sub: "{subtitle}", tone: "success" },
  ], { title: "All set", subtitle: "Everything is synced" }),
  T("error-toast", "communication", "An error / problem message", "error problem failed warning", 420, [
    { type: "header", icon: "circle-x", title: "{title}", sub: "{subtitle}", tone: "danger" },
  ], { title: "Failed delivery", subtitle: "Wrong address" }),

  // ── AI ────────────────────────────────────────────────────────────────────
  T("ai-prompt", "ai", "Typing a prompt to an AI", "ai prompt ask assistant input", 520, [
    { type: "header", icon: "sparkles", title: "{title}" },
    { type: "input", label: "{label}", value: "{note}", icon: "sparkles" },
  ], { title: "AI assistant", label: "Ask anything", note: "Which orders look fake?" }),
  T("ai-answer", "ai", "An AI answer / insight", "ai answer insight result assistant", 520, [
    { type: "header", icon: "sparkles", title: "{title}", badge: "{status}", tone: "brand" },
    { type: "text", text: "{note}", size: "s" },
    { type: "tags", items: "{items}" },
  ], { title: "AI insight", status: "Done", note: "3 orders look suspicious — hold them before shipping.", items: ["#1051", "#1054", "#1060"] }),
  T("ai-automation", "ai", "AI handling work automatically", "ai automation automatic handled", 480, [
    { type: "header", icon: "bot", title: "{title}", badge: "{status}", tone: "success" },
    { type: "checklist", items: "{items}" },
  ], { title: "Handled by AI", status: "Auto", items: ["Confirmed 42 orders", "Flagged 3 fake", "Booked couriers"] }),
  T("ai-score", "ai", "An AI score / risk check", "ai score risk fraud check", 420, [
    { type: "header", icon: "shield-check", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 92, label: "{label}" },
  ], { title: "Order check", subtitle: "#1042", label: "Genuine" }),
  T("ai-suggestions", "ai", "AI suggestions", "ai suggestions recommendations ideas", 480, [
    { type: "header", icon: "lightbulb", title: "{title}" },
    { type: "rows", items: "{items}" },
  ], { title: "Suggestions", items: ["Restock sneakers", "Boost the weekend offer", "Follow up 5 carts"] }),

  // ── people ────────────────────────────────────────────────────────────────
  T("profile", "people", "A customer / user profile", "profile customer user person account", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}" },
    { type: "kv", pairs: [["Orders", "{value}"], ["Spent", "{amount}"]] },
  ], { name: "Ayesha Rahman", subtitle: "Dhaka", status: "VIP", value: "18", amount: "$1,240" }),
  T("team", "people", "A team list", "team members staff people", 480, [
    { type: "header", icon: "users", title: "{title}" },
    { type: "rows", items: rows([["user", "Rahim", undefined, "Packing"], ["user", "Nila", undefined, "Support"], ["user", "Sami", undefined, "Delivery"]]) },
  ], { title: "Team" }),
  T("candidate", "people", "A job candidate", "candidate hiring job applicant", 440, [
    { type: "avatar", name: "{name}", sub: "{subtitle}", badge: "{status}", tone: "info" },
    { type: "tags", items: "{items}" },
  ], { name: "Tania Akter", subtitle: "Product designer", status: "Interview", items: ["Figma", "5 yrs"] }),
  T("testimonial", "people", "A testimonial quote", "testimonial quote customer love", 520, [
    { type: "stars", n: 5 },
    { type: "text", text: "{note}", size: "m" },
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
  ], { note: "“We finally see our real profit.”", name: "Shop owner", subtitle: "Dhaka" }),

  // ── health ────────────────────────────────────────────────────────────────
  T("appointment", "health", "A booked appointment", "appointment booking doctor visit", 440, [
    { type: "header", icon: "calendar-check", title: "{title}", sub: "{date}", badge: "{status}", tone: "success" },
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
  ], { title: "Appointment", date: "Tue · 10:30", status: "Confirmed", name: "Dr. Karim", subtitle: "General physician" }),
  T("vitals", "health", "Health vitals", "health vitals heart rate", 440, [
    { type: "header", icon: "heart-pulse", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}" },
    { type: "line", values: [70, 74, 72, 76, 73, 71, 72], tone: "danger" },
  ], { title: "Vitals", value: "72 bpm", label: "Heart rate" }),
  T("prescription", "health", "A prescription", "prescription medicine pharmacy", 440, [
    { type: "header", icon: "pill", title: "{title}", sub: "{subtitle}" },
    { type: "checklist", items: "{items}" },
  ], { title: "Prescription", subtitle: "Dr. Karim", items: ["Morning · 1 tablet", "Night · 1 tablet"] }),

  // ── education ─────────────────────────────────────────────────────────────
  T("course", "education", "A course with progress", "course learning lesson progress", 460, [
    { type: "media", icon: "graduation-cap", ratio: 2.4 },
    { type: "text", text: "{title}", size: "m" },
    { type: "progress", label: "{label}", value: 65 },
  ], { title: "Growth marketing", label: "Progress" }),
  T("quiz", "education", "A quiz question", "quiz question test answer", 460, [
    { type: "text", text: "{title}", size: "m" },
    { type: "rows", items: rows([["circle", "Option A"], ["circle-check", "Option B", undefined, "Correct"], ["circle", "Option C"]]) },
  ], { title: "Quick quiz" }),
  T("certificate", "education", "A certificate earned", "certificate award achievement", 460, [
    { type: "header", icon: "award", title: "{title}", sub: "{subtitle}", tone: "warn" },
    { type: "text", text: "{name}", size: "l" },
  ], { title: "Certificate", subtitle: "Completed", name: "Your Name" }),

  // ── marketing ─────────────────────────────────────────────────────────────
  T("campaign", "marketing", "An ad campaign with results", "campaign ads marketing results", 480, [
    { type: "header", icon: "megaphone", title: "{title}", badge: "{status}", tone: "success" },
    { type: "kv", pairs: [["Reach", "{value}"], ["Sales", "{amount}"]] },
    { type: "line", values: [3, 5, 4, 8, 11, 14] },
  ], { title: "Weekend sale", status: "Active", value: "48K", amount: "$6.2K" }),
  T("social-post", "marketing", "A social media post", "social post facebook instagram likes", 460, [
    { type: "avatar", name: "{name}", sub: "{subtitle}" },
    { type: "media", icon: "image", ratio: 1.8 },
    { type: "tags", items: "{items}" },
  ], { name: "Your brand", subtitle: "Sponsored", items: ["♥ 2.4K", "Shop now"] }),
  T("newsletter", "marketing", "An email newsletter stats", "newsletter email open rate", 440, [
    { type: "header", icon: "send", title: "{title}", sub: "{subtitle}" },
    { type: "donut", value: 48, label: "{label}" },
  ], { title: "Newsletter", subtitle: "Sent to 3,200", label: "Open rate" }),

  // ── security ──────────────────────────────────────────────────────────────
  T("login", "security", "A sign-in form", "login sign in account form", 440, [
    { type: "text", text: "{title}", size: "m" },
    { type: "input", label: "Email", value: "you@company.com", icon: "mail" },
    { type: "button", text: "{action}" },
  ], { title: "Welcome back", action: "Sign in" }),
  T("two-factor", "security", "A verification code", "2fa otp code verify security", 400, [
    { type: "header", icon: "shield-check", title: "{title}", sub: "{subtitle}" },
    { type: "text", text: "{value}", size: "l" },
  ], { title: "Verification", subtitle: "Code sent", value: "4 8 1 9 2 6" }),
  T("secure", "security", "Protected / encrypted status", "secure protected encrypted safe", 400, [
    { type: "header", icon: "lock", title: "{title}", sub: "{subtitle}", badge: "{status}", tone: "success" },
  ], { title: "Protected", subtitle: "Encrypted end to end", status: "Secure" }),
  T("fraud-alert", "security", "A fraud / risk alert", "fraud risk fake suspicious alert", 440, [
    { type: "header", icon: "shield-alert", title: "{title}", sub: "{subtitle}", tone: "danger" },
    { type: "button", text: "{action}", tone: "danger" },
  ], { title: "Suspicious order", subtitle: "#1054 · fake address", action: "Hold order" }),

  // ── general ───────────────────────────────────────────────────────────────
  T("search", "general", "A search bar being typed", "search find query", 520, [
    { type: "input", label: "{label}", value: "{note}", icon: "search" },
  ], { label: "Search", note: "sneakers size 42" }),
  T("upload", "general", "A file uploading", "upload file progress", 440, [
    { type: "header", icon: "upload", title: "{title}", sub: "{subtitle}" },
    { type: "progress", label: "{label}", value: 86 },
  ], { title: "Uploading", subtitle: "catalog.csv", label: "Progress" }),
  T("file", "general", "A document / file", "file document pdf", 380, [
    { type: "header", icon: "file-text", title: "{title}", sub: "{subtitle}" },
  ], { title: "Report.pdf", subtitle: "2.4 MB" }),
  T("pricing", "general", "A pricing plan", "pricing plan subscription price", 420, [
    { type: "chip", text: "{title}", tone: "brand" },
    { type: "price", amount: "{amount}", period: "{label}" },
    { type: "checklist", items: "{items}" },
    { type: "button", text: "{action}" },
  ], { title: "Pro", amount: "$29", label: "/month", items: ["Unlimited orders", "AI checks", "All couriers"], action: "Start free trial" }),
  T("cta", "general", "A call-to-action button", "cta button start try", 420, [
    { type: "text", text: "{title}", size: "m" },
    { type: "button", text: "{action}", icon: "arrow-right" },
  ], { title: "Ready to grow?", action: "Start free trial" }),
  T("timer", "general", "A countdown / time saved", "timer time saved clock hours", 380, [
    { type: "header", icon: "clock", title: "{title}" },
    { type: "bignum", value: "{value}", label: "{label}" },
  ], { title: "Time saved", value: "12 hrs", label: "every week" }),
  T("qr", "general", "A QR code to scan", "qr code scan pay", 340, [
    { type: "text", text: "{title}", size: "m" },
    { type: "qr" },
  ], { title: "Scan to pay" }),
  T("code", "general", "A code snippet / API", "code api developer snippet", 520, [
    { type: "header", icon: "code", title: "{title}" },
    { type: "code", lines: ["POST /orders", "{ status: 'confirmed' }", "→ 200 OK"] },
  ], { title: "API" }),
  T("stat-trio", "general", "Three quick stats", "stats numbers summary", 520, [
    { type: "kv", pairs: [["{label}", "{value}"], ["Orders", "1,240"], ["Customers", "860"]] },
  ], { label: "Revenue", value: "$24.8K" }),
  T("quote", "general", "A big statement card", "quote statement message headline", 520, [
    { type: "text", text: "{title}", size: "l" },
    { type: "text", text: "{subtitle}", muted: true, size: "s" },
  ], { title: "Everything connected.", subtitle: "One platform for your business" }),
];

export const CARD_BY_ID = new Map(CARD_TEMPLATES.map((t) => [t.id, t]));
