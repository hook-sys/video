"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Glass windows, one at a time (the site before login and the dashboard).
// The one motion: a window comes out of the Dock icon (or button) that was
// clicked the way a Mac window does (the genie): small and pinched into the
// icon, it pours out of it — narrow at the icon, wide on the far side — and
// opens to its full size; the one it replaces pours back into its own icon.
// Switching changes the address without loading a page; Back and Forward
// move between windows.

const OPEN = { duration: 620, easing: "cubic-bezier(0.22, 0.9, 0.3, 1)" };
const CLOSE = { duration: 420, easing: "cubic-bezier(0.6, 0, 0.8, 0.4)" };
const DELAY = 90;

type Rect = { left: number; top: number; width: number; height: number };
const FULL = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
const pct = (v: number) => Math.max(4, Math.min(96, v));

// The genie: the window's frames from the icon to its full size. Its shape
// (a clip) pinches towards the side the icon is on (the Dock below on a
// phone, beside it on a computer) while it grows out of the icon's centre.
// An icon inside the window (a button in it) opens it evenly instead.
function genie(win: HTMLElement, r: Rect): { frames: Keyframe[]; origin: string } {
  const w = win.getBoundingClientRect();
  const ix = r.left + r.width / 2, iy = r.top + r.height / 2;
  const ox = ix - w.left, oy = iy - w.top;
  const side = iy >= w.top + w.height - 4 ? "bottom" : ix <= w.left + 4 ? "left" : iy <= w.top + 4 ? "top" : ix >= w.left + w.width - 4 ? "right" : null;
  const sx = Math.max(0.04, r.width / w.width), sy = Math.max(0.04, r.height / w.height);
  const origin = `${ox}px ${oy}px`;
  if (!side) return { origin, frames: [{ transform: `scale(${Math.max(sx, sy)})`, clipPath: FULL, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: "none", clipPath: FULL, opacity: 1 }] };
  const px = pct((ox / w.width) * 100), py = pct((oy / w.height) * 100);
  // the shape: [pinched at the start, poured out half way]
  const shape = (k: number, far: number) =>
    side === "bottom" ? `polygon(${px - far}% 0%, ${px + far}% 0%, ${px + k}% 100%, ${px - k}% 100%)`
    : side === "top" ? `polygon(${px - k}% 0%, ${px + k}% 0%, ${px + far}% 100%, ${px - far}% 100%)`
    : side === "left" ? `polygon(0% ${py - k}%, 100% ${py - far}%, 100% ${py + far}%, 0% ${py + k}%)`
    : `polygon(0% ${py - far}%, 100% ${py - k}%, 100% ${py + k}%, 0% ${py + far}%)`;
  const across = side === "bottom" || side === "top";
  return {
    origin,
    frames: [
      { transform: across ? `scale(${sx * 2}, ${sy})` : `scale(${sx}, ${sy * 2})`, clipPath: shape(3, 22), opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { transform: across ? "scale(0.9, 0.7)" : "scale(0.7, 0.9)", clipPath: shape(10, 100), offset: 0.5 },
      { transform: "none", clipPath: FULL, opacity: 1 },
    ],
  };
}
const rectOf = (el: Element): Rect => el.getBoundingClientRect();
// of a window's icons, the one on screen
const shown = (els?: HTMLElement[]) => (els ?? []).find((el) => el.isConnected && el.getClientRects().length > 0) ?? null;

export function useWindows<W extends string>(initial: W, path: Record<W, string>, windowAt: (l: Location) => W, title: Record<W, string>) {
  const [current, setCurrent] = useState<W>(initial);
  const [leaving, setLeaving] = useState<W | null>(null);
  const now = useRef<W>(initial);
  const wins = useRef<Partial<Record<W, HTMLElement | null>>>({});
  // (a window may have an icon in the bar and one in the dock: the one on screen is used)
  const icons = useRef<Partial<Record<W, HTMLElement[]>>>({});
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
      const back = shown(icons.current[leaving]);
      // (the genie backwards: it pours into its own icon)
      const g = back ? genie(prev, rectOf(back)) : null;
      if (g) prev.style.transformOrigin = g.origin;
      const backwards = (frames: Keyframe[]) =>
        [...frames].reverse().map((f, i, all) => {
          const k: Keyframe = { ...f };
          if (typeof f.offset === "number") k.offset = 1 - f.offset;
          else delete k.offset;
          if (i === all.length - 1) k.opacity = 0;
          return k;
        });
      const out = prev.animate(g ? backwards(g.frames) : [{ transform: "none", opacity: 1 }, { transform: "scale(0.9)", opacity: 0 }], CLOSE);
      out.finished
        .then(() => {
          prev.style.visibility = "hidden";
          setLeaving((l) => (l === leaving ? null : l));
        })
        .catch(() => {});
    }
    const icon = from.current?.isConnected && from.current.getClientRects().length ? from.current : shown(icons.current[current]);
    if (icon) {
      const g = genie(next, rectOf(icon));
      next.style.transformOrigin = g.origin;
      next.animate(g.frames, { ...OPEN, delay: DELAY, fill: "backwards" });
    }
  }, [current, leaving]);

  // Back and Forward move between windows; an address naming a window opens it
  useEffect(() => {
    const go = () => show(windowAt(window.location), shown(icons.current[windowAt(window.location)]), false);
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
    const list = (icons.current[id] ?? []).filter((x) => x.isConnected);
    icons.current[id] = el && !list.includes(el) ? [...list, el] : list;
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

// Going to another page: what was clicked is remembered for a moment, and
// that page's window (AppShell) opens out of it.
const FROM = "gs-from";
export function remember(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget.querySelector(".gs-tile") ?? e.currentTarget;
  const r = el.getBoundingClientRect();
  try {
    sessionStorage.setItem(FROM, JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height, at: Date.now() }));
  } catch {
    // (no storage: the window simply appears)
  }
}
// A window opening out of what was clicked on the page before.
export function useArrival(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    let from: { x: number; y: number; w: number; h: number; at: number } | null = null;
    try {
      from = JSON.parse(sessionStorage.getItem(FROM) ?? "null");
      sessionStorage.removeItem(FROM);
    } catch {
      from = null;
    }
    const win = ref.current;
    if (!win || !from || Date.now() - from.at > 8000 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = genie(win, { left: from.x, top: from.y, width: from.w, height: from.h });
    win.style.transformOrigin = g.origin;
    win.animate(g.frames, OPEN);
  }, [ref]);
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
