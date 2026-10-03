// What the product's own cards show in the film templates: the number that
// updates when the event happens, the event itself, a short list, two side
// figures, the growth figure and the team (initials only). The Director writes
// it for each product; the defaults are the Flowly proof's.

export type Figure = { label: string; from: number; to: number; unit: "$" | "%" | "" };
export type FilmContent = {
  metric: Figure; // the number the event updates (e.g. Revenue 48,300 → 50,700)
  event: { label: string; detail: string; source: string; done: string }; // "New payment", "$2,400", "Lumen Co.", "Revenue updated"
  rows: { name: string; value: string }[]; // 3 earlier entries of the list the event joins
  side: { label: string; value: string }[]; // 2 more figures beside the metric
  growth: Figure; // what grows (e.g. Sales this month 41,018 → 52,240)
  people: { name: string; role: string }[]; // 4 team members (shown as initials)
};

export const DEFAULT_CONTENT: FilmContent = {
  metric: { label: "Revenue", from: 48300, to: 50700, unit: "$" },
  event: { label: "New payment", detail: "$2,400", source: "Lumen Co.", done: "Revenue updated" },
  rows: [
    { name: "Northwind Ltd", value: "$1,240" },
    { name: "Acme Studio", value: "$860" },
    { name: "Blue Harbor", value: "$2,150" },
  ],
  side: [
    { label: "Payments today", value: "18" },
    { label: "Avg. order", value: "$1,312" },
  ],
  growth: { label: "Sales this month", from: 41018, to: 52240, unit: "$" },
  people: [
    { name: "Maya Chen", role: "Head of Sales" },
    { name: "Ravi Patel", role: "Finance lead" },
    { name: "Sara Kim", role: "Operations" },
    { name: "Jon Alvarez", role: "Support" },
  ],
};

// A figure's value as shown (unit, thousands separators).
export const show = (unit: Figure["unit"], n: number) => (unit === "$" ? `$${Math.round(n).toLocaleString("en-US")}` : unit === "%" ? `${Math.round(n)}%` : Math.round(n).toLocaleString("en-US"));
// The growth as a percentage (for the green delta chip).
export const pct = (g: Figure) => (g.from ? Math.round(((g.to - g.from) / Math.abs(g.from)) * 100) : 0);
// A short value for chart labels ("$128k", "1.2k").
export const compact = (unit: Figure["unit"], n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : a >= 1e4 ? `${Math.round(n / 1e3)}k` : a >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`;
  return unit === "$" ? `$${s}` : unit === "%" ? `${s}%` : s;
};
// Eight steps rising to a figure's end value (bars), as fractions and labels.
export function steps(g: Figure, n = 8) {
  const shape = [0.46, 0.51, 0.49, 0.59, 0.64, 0.7, 0.8, 1];
  const vals = shape.slice(0, n).map((k) => g.to * k);
  return { values: shape.map((k) => k * 0.92), labels: vals.map((v) => compact(g.unit, v)) };
}
// The change of a figure with its sign ("+$2,400", "−3").
export const change = (g: Figure) => `${g.to >= g.from ? "+" : "−"}${show(g.unit, Math.abs(g.to - g.from))}`;
