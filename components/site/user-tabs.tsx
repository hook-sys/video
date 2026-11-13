"use client";

import Link from "next/link";
import type { MouseEvent, Ref } from "react";

// The user's places as tabs under the name in the menu bar, the way the admin
// has its own (app/admin/_components/nav.tsx): an icon and a word each, the one
// open lit in the brand's gradient; they slide sideways when they don't fit.

const ICON = {
  videos: "M15 10l5-3v10l-5-3M3 6h12v12H3z",
  new: "M12 5v14M5 12h14",
  brand: "M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3c.4.5.5 1 .5 1.5 0 1-.9 1.7-3 1.7zM7.5 11h.01M10.5 7h.01M15.5 7.5h.01",
  credits: "M2 6h20v12H2zM2 10h20M6 15h4",
  account: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  admin: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
} as const;

export type UserTab = { href: string; label: string; icon: keyof typeof ICON; active?: boolean; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; anchor?: Ref<HTMLAnchorElement> };

export function UserTabs({ items }: { items: UserTab[] }) {
  return (
    <nav className="md-tabs" aria-label="Your places">
      <div className="md-tab-group">
        {items.map((it, i) => (
          <span key={it.href + it.label} className="contents">
            {/* (you — your account, the admin — sit apart from the work) */}
            {i > 0 && it.icon === "account" && <span className="md-tab-sep" aria-hidden="true" />}
            <Link href={it.href} ref={it.anchor} onClick={it.onClick} className={`md-tab${it.active ? " on" : ""}`} aria-current={it.active ? "page" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
                <path d={ICON[it.icon]} />
              </svg>
              <span>{it.label}</span>
            </Link>
          </span>
        ))}
      </div>
    </nav>
  );
}

// The same places for every signed-in page; `on` is the one open.
export function userTabs(on: string | null, admin: boolean, click?: (place: string) => ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined): UserTab[] {
  const t = (place: string, href: string, label: string, icon: keyof typeof ICON): UserTab => ({ href, label, icon, active: on === place, onClick: click?.(place) });
  return [
    t("videos", "/dashboard", "Videos", "videos"),
    t("new", "/projects/new", "New video", "new"),
    t("brand", "/brand", "Brand kits", "brand"),
    t("credits", "/billing", "Credits", "credits"),
    t("account", "/dashboard#account", "Account", "account"),
    ...(admin ? [t("admin", "/admin", "Admin", "admin")] : []),
  ];
}
