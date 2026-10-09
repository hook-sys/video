"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Glass windows, one at a time (the site before login and the dashboard).
// The one motion: a window grows smoothly straight out of the icon (or
// button) that was clicked, the way a Mac window comes out of its Dock icon,
// while the one it replaces shrinks back into its own icon. Switching changes
// the address without loading a page; Back and Forward move between windows.

const OPEN = { duration: 640, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };
const CLOSE = { duration: 360, easing: "cubic-bezier(0.55, 0, 0.75, 0.25)" };
const DELAY = 90;

// a window shrunk, evenly, onto the centre of an icon
function onto(win: HTMLElement, icon: Element) {
  const w = win.getBoundingClientRect(), r = icon.getBoundingClientRect();
  const dx = r.left + r.width / 2 - (w.left + w.width / 2), dy = r.top + r.height / 2 - (w.top + w.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${r.width / w.width})`;
}

export function useWindows<W extends string>(initial: W, path: Record<W, string>, windowAt: (l: Location) => W, title: Record<W, string>) {
  const [current, setCurrent] = useState<W>(initial);
  const [leaving, setLeaving] = useState<W | null>(null);
  const now = useRef<W>(initial);
  const wins = useRef<Partial<Record<W, HTMLElement | null>>>({});
  const icons = useRef<Partial<Record<W, HTMLElement | null>>>({});
  const from = useRef<Element | null>(null);
  const moving = useRef(false);

  const show = useCallback(
    (id: W, clicked: Element | null, push: boolean) => {
      if (id === now.current) return;
      from.current = clicked;
      // (with reduced motion the window simply changes)
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      moving.current = !still;
      if (!still) setLeaving(now.current);
      now.current = id;
      setCurrent(id);
      if (push) window.history.pushState(null, "", path[id]);
    },
    [path],
  );

  // the motion, once both windows are on the page
  useLayoutEffect(() => {
    if (!moving.current) return;
    moving.current = false;
    window.scrollTo({ top: 0 });
    const next = wins.current[current];
    if (!next) return;
    next.getAnimations().forEach((a) => a.cancel());
    next.style.visibility = "";
    const prev = leaving ? wins.current[leaving] : null;
    if (prev && leaving) {
      prev.getAnimations().forEach((a) => a.cancel());
      const back = icons.current[leaving];
      const out = prev.animate([{ transform: "none", opacity: 1 }, { opacity: 0, offset: 0.4 }, { transform: back ? onto(prev, back) : "scale(0.9)", opacity: 0 }], CLOSE);
      out.finished
        .then(() => {
          prev.style.visibility = "hidden";
          setLeaving((l) => (l === leaving ? null : l));
        })
        .catch(() => {});
    }
    const icon = from.current?.isConnected ? from.current : icons.current[current];
    if (icon) {
      next.animate([{ transform: onto(next, icon) }, { transform: "none" }], { ...OPEN, delay: DELAY, fill: "backwards" });
      next.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], { duration: OPEN.duration, delay: DELAY, easing: "linear", fill: "backwards" });
    }
  }, [current, leaving]);

  // Back and Forward move between windows; an address naming a window opens it
  useEffect(() => {
    const go = () => show(windowAt(window.location), icons.current[windowAt(window.location)] ?? null, false);
    if (windowAt(window.location) !== now.current) go();
    window.addEventListener("popstate", go);
    return () => window.removeEventListener("popstate", go);
  }, [show, windowAt]);

  // a click that opens a window (out of the icon in it, else out of what was clicked)
  const open = (id: W) => (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    show(id, e.currentTarget.querySelector(".gs-tile") ?? e.currentTarget, true);
  };
  // where a window comes out of when nothing was clicked (Back, an address)
  const iconRef = (id: W) => (el: HTMLElement | null) => {
    icons.current[id] = el;
  };
  const win = (id: W, body: React.ReactNode) =>
    id === current || id === leaving ? (
      <section
        key={id}
        ref={(el) => {
          wins.current[id] = el;
        }}
        className={`gs-win gs-glass${id === leaving ? " leaving" : ""}`}
        aria-hidden={id === leaving || undefined}
      >
        <div className="gs-titlebar">
          <div className="gs-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>{title[id]}</span>
        </div>
        <div className="gs-body">{body}</div>
      </section>
    ) : null;

  return { current, open, win, iconRef };
}

// The still desk the glass sits on.
export function Desk() {
  return (
    <div className="gs-desk" aria-hidden="true">
      <i className="d1" />
      <i className="d2" />
      <i className="d3" />
    </div>
  );
}

export function Mark() {
  return (
    <span className="gs-mark">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3.2 1.6v8.8L10 6z" fill="#fff" />
      </svg>
    </span>
  );
}
