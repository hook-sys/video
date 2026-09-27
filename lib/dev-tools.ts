// Dev-only tools (benchmark, cost breakdown, storyboard preview). Enabled
// locally, or on a deployment (e.g. Vercel Preview, which runs with
// NODE_ENV=production) by setting ENABLE_DEV_TOOLS=true. Never set it in Production.
export const devToolsEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_TOOLS === "true";
