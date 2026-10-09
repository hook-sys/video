import Link from "next/link";

// Building blocks for the admin panel (server components).

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {sub && <p className="mt-1 text-sm text-zinc-400">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "good" | "bad" | "warn" }) {
  const color = { default: "text-white", good: "text-emerald-400", bad: "text-rose-400", warn: "text-amber-300" }[tone];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

const BADGE = {
  gray: "bg-zinc-500/15 text-zinc-300",
  green: "bg-emerald-500/15 text-emerald-300",
  red: "bg-rose-500/15 text-rose-300",
  amber: "bg-amber-500/15 text-amber-300",
  violet: "bg-[#0a66d6]/25 text-[#9cc2ff]",
  blue: "bg-sky-500/15 text-sky-300",
};
export type BadgeTone = keyof typeof BADGE;
export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[tone]}`}>{children}</span>;
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wider text-zinc-500">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05] text-zinc-300">{children}</tbody>
      </table>
      {rows === 0 && <p className="px-3 py-8 text-center text-sm text-zinc-500">{empty ?? "Nothing here yet."}</p>}
    </div>
  );
}
export const td = "px-3 py-2.5 align-middle";

// Vertical bars, one per label; each bar can stack two series.
export function Bars({ data, height = 140 }: { data: { label: string; a: number; b?: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.a + (d.b ?? 0)));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.a}${d.b !== undefined ? ` / ${d.b}` : ""}`}>
          <div className="flex w-full flex-col justify-end overflow-hidden rounded-md" style={{ height: `${((d.a + (d.b ?? 0)) / max) * 100}%`, minHeight: 2 }}>
            {!!d.b && <div className="w-full bg-rose-400/70" style={{ flex: d.b }} />}
            <div className="w-full bg-[#4f8ff0]" style={{ flex: d.a || 0.0001 }} />
          </div>
          <span className="text-[10px] text-zinc-600 group-hover:text-zinc-300">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBar({ label, value, max, prefix = "" }: { label: React.ReactNode; value: number; max: number; prefix?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <div className="w-28 shrink-0 truncate text-zinc-300">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[#4f8ff0]" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <div className="w-14 shrink-0 text-right tabular-nums text-zinc-400">{prefix}{value.toLocaleString()}</div>
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone === "warn" ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-200" : "border-[#4f8ff0]/25 bg-[#4f8ff0]/[0.08] text-[#c9ddff]"}`}>
      {children}
    </div>
  );
}

export function Filters({ items, current, base, param = "status" }: { items: { value: string; label: string }[]; current: string; base: string; param?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <Link
          key={it.value}
          href={it.value ? `${base}?${param}=${it.value}` : base}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${current === it.value ? "bg-white text-zinc-900" : "bg-white/[0.05] text-zinc-400 hover:bg-white/10 hover:text-white"}`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50";
export const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50";
export const btnDanger = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50";
export const input = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#4f8ff0]/70";
