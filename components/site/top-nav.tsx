"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode, Ref } from "react";
import { Mark, Wordmark } from "./windows";

// The menu bar at the top of every page (site.css .md-nav): the mark and the name,
// the places as tabs — the one you are on lit by a dot underneath — then what
// to do next (a button) and you (your initial). Glass, sticky; on a phone the
// tabs slide sideways under the name.

export type NavItem = { href: string; label: string; active?: boolean; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; anchor?: Ref<HTMLAnchorElement> };

// (`home` null: the name is not a link — while a video is being sent, leaving would lose it)
// (`below`: a row under it all, the full width — the admin's tabs)
export function TopNav({ items = [], right, home = "/", onHome, wide, below }: { items?: NavItem[]; right?: ReactNode; home?: string | null; onHome?: (e: MouseEvent<HTMLAnchorElement>) => void; wide?: boolean; below?: ReactNode }) {
  return (
    <header className="md-nav">
      <div className={`md-nav-in${wide ? " wide" : ""}`}>
        {home === null ? (
          <span className="gs-brand">
            <Mark />
            <Wordmark />
          </span>
        ) : (
          <Link href={home} className="gs-brand" onClick={onHome} aria-label="MotionDots home">
            <Mark />
            <Wordmark />
          </Link>
        )}
        {items.length > 0 && (
          <nav className="md-links" aria-label="Main">
            {items.map((it) => (
              <Link key={it.href + it.label} href={it.href} ref={it.anchor} onClick={it.onClick} className={`md-link${it.active ? " on" : ""}`} aria-current={it.active ? "page" : undefined}>
                {it.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="md-right">{right}</div>
        {below && <div className="md-below">{below}</div>}
      </div>
    </header>
  );
}

// You, as your initial in a ring of the brand's gradient
export function Avatar({ href, initial, onClick, active }: { href: string; initial: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; active?: boolean }) {
  return (
    <Link href={href} onClick={onClick} className={`md-avatar${active ? " on" : ""}`} aria-label="Your account">
      <span>{initial.toUpperCase()}</span>
    </Link>
  );
}
