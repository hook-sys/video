"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Icon paths (24×24, stroke) for the sidebar.
const I = {
  overview: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  videos: "M15 10l5-3v10l-5-3M3 6h12v12H3z",
  queue: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
  costs: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  quality: "M9 12l2 2 4-4M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  billing: "M2 5h20v14H2zM2 10h20",
  content: "M4 4h16v16H4zM4 15l4-4 5 5M14 14l2-2 4 4M15 8h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  models: "M12 2l8 4.5v9L12 20l-8-4.5v-9zM12 11l8-4.5M12 11v9M12 11L4 6.5",
  audit: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8",
};

const GROUPS: { title: string; items: { href: string; label: string; icon: keyof typeof I }[] }[] = [
  { title: "Monitor", items: [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/queue", label: "Render queue", icon: "queue" },
    { href: "/admin/costs", label: "Costs", icon: "costs" },
    { href: "/admin/quality", label: "Video quality", icon: "quality" },
  ] },
  { title: "Manage", items: [
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/videos", label: "Videos", icon: "videos" },
    { href: "/admin/billing", label: "Plans & billing", icon: "billing" },
    { href: "/admin/content", label: "Content", icon: "content" },
  ] },
  { title: "System", items: [
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/models", label: "AI models", icon: "models" },
    { href: "/admin/audit", label: "Audit log", icon: "audit" },
  ] },
];

export function Icon({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  return (
    <>
      <button onClick={() => setOpen(!open)} className="gs-glass fixed right-6 top-[22px] z-50 rounded-full px-3.5 py-1.5 text-sm text-white lg:hidden" aria-label="Menu">
        {open ? "Close" : "Menu"}
      </button>
      <nav className={`${open ? "flex" : "hidden"} gs-glass fixed bottom-6 left-4 top-[96px] z-40 w-60 flex-col gap-6 overflow-y-auto rounded-[22px] px-3 py-5 lg:flex`}>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{g.title}</p>
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active(it.href) ? "bg-white/[0.12] text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <Icon d={I[it.icon]} className={`size-4 ${active(it.href) ? "text-[#9cc2ff]" : ""}`} />
                <span className="flex-1">{it.label}</span>
                {!!badges[it.href] && <span className="rounded-full bg-rose-500/20 px-1.5 text-[11px] font-semibold text-rose-300">{badges[it.href]}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
