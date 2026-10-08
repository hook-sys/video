import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import { type Ctx, Glyph, Initial, Tag, Tick, countUp, iconName, kIn, show, surf, toneOf } from "./kit";
import { clamp01, mix } from "./motion";
import type { PlacedItem, RowT } from "./types";

// The product's UI, drawn: a card shows what the words say (a list of
// invoices, a calendar filling up, a chat, a form being sent…). Its rows
// come from the Director; they arrive one by one, and on the item's `hit`
// word its moment happens (a row is checked, a status turns, a slot fills).

export const CARD_W = 640;
export function cardHeight(variant: string, rows: number): number {
  const n = Math.max(1, rows);
  switch (variant) {
    case "notify": return 120 + Math.min(3, n) * 112;
    case "kpi": return 120 + Math.ceil(Math.min(4, n) / 2) * 150;
    case "calendar": return 470;
    case "kanban": return 440;
    case "pay": return 470;
    case "profile": return 420;
    case "doc": return 480;
    case "chat": return 130 + Math.min(5, n) * 92;
    case "form": return 150 + Math.min(4, n) * 96 + 90;
    case "invoice": return 230 + Math.min(4, n) * 62 + 80;
    case "search": return 170 + Math.min(4, n) * 82;
    default: return 120 + Math.min(6, n) * 84;
  }
}

type Props = { c: Ctx; it: PlacedItem; w: number; h: number };
const rowsOf = (it: PlacedItem, fallback: RowT[]) => (it.rows?.length ? it.rows : fallback).slice(0, 6);
const D = (t: string, meta?: string, tag?: string, icon?: string): RowT => ({ title: t, meta: meta ?? null, tag: tag ?? null, icon: icon ?? null });
// rows arrive between the card's word and its hit (else one by one after it)
const rowAt = (it: PlacedItem, i: number, n: number, c: Ctx) => {
  const start = it.at + Math.round(c.m.dur * 0.6);
  const end = it.hit != null && it.hit > start + 6 ? it.hit : start + n * c.m.stagger * 3;
  return Math.round(start + (n <= 1 ? 0 : ((end - start) * i) / n));
};
const hitK = (c: Ctx, it: PlacedItem, dur = 14) => (it.hit == null ? 0 : kIn(c, it.hit, dur));

function Head({ c, it, right }: { c: Ctx; it: PlacedItem; right?: ReactNode }) {
  const { pal } = c;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "26px 30px 16px" }}>
      <Glyph c={c} name={it.icon} size={46} tone="panel" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 27, fontWeight: 700, color: pal.panelInk, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title ?? c.brand.name}</div>
        {it.sub && <div style={{ fontSize: 19, color: pal.panelSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{it.sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Card({ c, it, w, h }: Props) {
  const v = it.variant ?? "list";
  const body = (CARDS[v] ?? CARDS.list)({ c, it, w, h });
  return (
    <div style={{ width: w, height: h, ...surf(c), overflow: "hidden", fontFamily: c.text, color: c.pal.panelInk, position: "relative" }}>{body}</div>
  );
}

const rowLine = (c: Ctx): CSSProperties => ({ borderTop: `1.5px solid ${c.pal.panelLine}` });

const CARDS: Record<string, (p: Props) => ReactNode> = {
  list: ({ c, it }) => {
    const rows = rowsOf(it, [D("New request", "now", "New", "inbox"), D("Weekly report", "2m", "Ready", "file-text"), D("Team update", "1h", "", "bell")]);
    const hk = hitK(c, it);
    return (
      <>
        <Head c={c} it={it} />
        {rows.map((r, i) => {
          const k = kIn(c, rowAt(it, i, rows.length, c));
          const lit = i === rows.length - 1 ? hk : 0;
          return (
            <div key={i} style={{ ...show(k), display: "flex", alignItems: "center", gap: 16, height: 84, padding: "0 30px", ...rowLine(c), background: lit ? `${c.pal.fill}${Math.round(lit * 18).toString(16).padStart(2, "0")}` : undefined }}>
              <Glyph c={c} name={r.icon ?? it.icon} size={42} tone={i % 2 ? "fill2" : "panel"} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 24, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
              {r.meta && <div style={{ fontSize: 20, color: c.pal.panelSub }}>{r.meta}</div>}
              {r.tag && <Tag c={c} tone={toneOf(r.tag)}>{r.tag}</Tag>}
            </div>
          );
        })}
      </>
    );
  },
  checklist: ({ c, it }) => {
    const rows = rowsOf(it, [D("Connect your tools"), D("Invite the team"), D("Go live")]);
    return (
      <>
        <Head c={c} it={it} right={<Tag c={c}>{rows.filter((_, i) => c.f >= rowAt(it, i, rows.length, c) + 10).length}/{rows.length}</Tag>} />
        {rows.map((r, i) => {
          const at = rowAt(it, i, rows.length, c);
          const k = kIn(c, at - 6);
          const done = kIn(c, at + 8, 12);
          return (
            <div key={i} style={{ ...show(k), display: "flex", alignItems: "center", gap: 18, height: 84, padding: "0 30px", ...rowLine(c) }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, border: `2px solid ${c.pal.panelLine}`, position: "relative" }}>
                <div style={{ position: "absolute", inset: -2 }}><Tick c={c} size={34} k={done} /></div>
              </div>
              <div style={{ flex: 1, fontSize: 24, fontWeight: 600, color: done > 0.5 ? c.pal.panelSub : c.pal.panelInk, textDecoration: done > 0.5 ? "line-through" : undefined, textDecorationColor: c.pal.panelSub }}>{r.title}</div>
              {r.meta && <div style={{ fontSize: 20, color: c.pal.panelSub }}>{r.meta}</div>}
            </div>
          );
        })}
      </>
    );
  },
  kpi: ({ c, it }) => {
    const rows = rowsOf(it, [D("Revenue", "$48,210", "+12%"), D("Active", "1,284", "+8%"), D("Time saved", "6h", "/week"), D("Paid on time", "94%", "+21%")]).slice(0, 4);
    return (
      <>
        <Head c={c} it={it} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "6px 30px 30px" }}>
          {rows.map((r, i) => {
            const at = rowAt(it, i, rows.length, c);
            const k = kIn(c, at);
            const n = kIn(c, at, 34);
            return (
              <div key={i} style={{ ...show(k), background: c.pal.panelSoft, borderRadius: Math.max(10, c.art.radius * 0.6), padding: "20px 22px", height: 134, boxSizing: "border-box" }}>
                <div style={{ fontSize: 19, color: c.pal.panelSub, fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 40, fontWeight: 750, letterSpacing: "-0.03em", marginTop: 6, fontFamily: c.display }}>{countUp(r.meta ?? "0", n)}</div>
                {r.tag && <div style={{ fontSize: 18, fontWeight: 650, color: /^-/.test(r.tag) ? "#e11d48" : c.pal.panelDark ? "#6ee7b7" : "#059669" }}>{r.tag}</div>}
              </div>
            );
          })}
        </div>
      </>
    );
  },
  form: ({ c, it }) => {
    const rows = rowsOf(it, [D("Client", "Acme Studio"), D("Amount", "$2,400"), D("Due", "In 7 days")]).slice(0, 4);
    const hk = hitK(c, it, 10);
    const press = it.hit == null ? 0 : clamp01(kIn(c, it.hit - 4, 5) - kIn(c, it.hit + 2, 8));
    return (
      <>
        <Head c={c} it={it} />
        <div style={{ padding: "4px 30px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((r, i) => {
            const at = rowAt(it, i, rows.length, c);
            const k = kIn(c, at - 4);
            const typed = clamp01((c.f - at) / 18);
            const val = r.meta ?? "";
            return (
              <div key={i} style={show(k)}>
                <div style={{ fontSize: 18, color: c.pal.panelSub, fontWeight: 600, marginBottom: 6 }}>{r.title}</div>
                <div style={{ height: 56, borderRadius: Math.max(8, c.art.radius * 0.45), border: `1.5px solid ${typed > 0 && typed < 1 ? c.pal.fill : c.pal.panelLine}`, background: c.pal.panelSoft, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 23, fontWeight: 600 }}>
                  {val.slice(0, Math.round(val.length * typed))}
                  {typed > 0 && typed < 1 && <span style={{ width: 2, height: 26, background: c.pal.fill, marginLeft: 2 }} />}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 8, height: 64, borderRadius: Math.max(10, c.art.radius * 0.5), background: hk > 0.5 ? "#10b981" : `linear-gradient(140deg, ${c.pal.fill}, ${c.pal.fill2})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 24, fontWeight: 700, transform: `scale(${1 - press * 0.05})` }}>
            {hk > 0.5 ? <><Icon name="check" size={26} color="#fff" strokeWidth={3} /> Done</> : <>{it.value ?? "Send"} <Icon name="arrow-right" size={24} color="#fff" strokeWidth={2.5} /></>}
          </div>
        </div>
      </>
    );
  },
  chat: ({ c, it }) => {
    const rows = rowsOf(it, [D("Can you send the report?"), D("Already done — it's in your inbox.", null as unknown as string, "me")]).slice(0, 5);
    return (
      <>
        <Head c={c} it={it} right={<div style={{ width: 12, height: 12, borderRadius: 9, background: "#10b981" }} />} />
        <div style={{ padding: "6px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((r, i) => {
            const at = rowAt(it, i, rows.length, c);
            const me = (r.tag ?? "").toLowerCase() === "me" || i % 2 === 1;
            const k = kIn(c, at);
            const typing = c.f >= at - 14 && c.f < at;
            return (
              <div key={i} style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
                {!me && <Initial c={c} letter={r.meta ?? "A"} size={40} hue={i} />}
                {typing && !k ? (
                  <div style={{ padding: "16px 20px", borderRadius: 22, background: c.pal.panelSoft, display: "flex", gap: 6 }}>{[0, 1, 2].map((d) => <div key={d} style={{ width: 9, height: 9, borderRadius: 9, background: c.pal.panelSub, opacity: 0.4 + 0.6 * Math.abs(Math.sin(c.f / 5 + d)) }} />)}</div>
                ) : (
                  <div style={{ ...show(k, 12), transformOrigin: me ? "100% 100%" : "0% 100%", maxWidth: 420, padding: "14px 20px", borderRadius: 22, borderBottomRightRadius: me ? 6 : 22, borderBottomLeftRadius: me ? 22 : 6, background: me ? `linear-gradient(140deg, ${c.pal.fill}, ${c.pal.fill2})` : c.pal.panelSoft, color: me ? c.pal.onFill : c.pal.panelInk, fontSize: 22, fontWeight: 550, lineHeight: 1.3 }}>{r.title}</div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  },
  notify: ({ c, it }) => {
    const rows = rowsOf(it, [D(it.title ?? "Payment received", it.sub ?? "just now", "", it.icon ?? "bell")]).slice(0, 3);
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, color: c.pal.panelSub, fontWeight: 650, letterSpacing: "0.04em", textTransform: "uppercase", padding: "4px 6px 0" }}>
          <Icon name="bell" size={20} color={c.pal.panelSub} /> {it.title && rows[0].title !== it.title ? it.title : "Notifications"}
        </div>
        {rows.map((r, i) => {
          const at = rowAt(it, i, rows.length, c);
          const k = kIn(c, at);
          return (
            <div key={i} style={{ ...show(k, -20), display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: Math.max(12, c.art.radius * 0.7), background: c.pal.panelSoft, height: 96, boxSizing: "border-box" }}>
              <Glyph c={c} name={r.icon ?? it.icon} size={50} tone={i % 2 ? "fill2" : "accent"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 23, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                {r.meta && <div style={{ fontSize: 19, color: c.pal.panelSub, marginTop: 2 }}>{r.meta}</div>}
              </div>
              {r.tag && <Tag c={c} tone={toneOf(r.tag)}>{r.tag}</Tag>}
            </div>
          );
        })}
      </div>
    );
  },
  invoice: ({ c, it }) => {
    const rows = rowsOf(it, [D("Design work", "$1,800"), D("Hosting", "$240"), D("Support", "$360")]).slice(0, 4);
    const hk = hitK(c, it, 12);
    const total = it.value ?? "$2,400";
    return (
      <div style={{ padding: "28px 32px", position: "relative", height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, letterSpacing: "0.12em", color: c.pal.panelSub, fontWeight: 700 }}>INVOICE</div>
            <div style={{ fontSize: 30, fontWeight: 750, marginTop: 4 }}>{it.title ?? "#1042"}</div>
            {it.sub && <div style={{ fontSize: 19, color: c.pal.panelSub, marginTop: 2 }}>{it.sub}</div>}
          </div>
          <Glyph c={c} name={it.icon ?? "receipt"} size={52} tone="panel" />
        </div>
        <div style={{ marginTop: 22 }}>
          {rows.map((r, i) => {
            const k = kIn(c, rowAt(it, i, rows.length, c));
            return (
              <div key={i} style={{ ...show(k, 10), display: "flex", justifyContent: "space-between", height: 62, alignItems: "center", ...rowLine(c), fontSize: 23 }}>
                <span style={{ fontWeight: 550 }}>{r.title}</span>
                <span style={{ fontWeight: 650 }}>{r.meta}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `2px solid ${c.pal.panelInk}`, paddingTop: 16, marginTop: 4 }}>
          <span style={{ fontSize: 22, color: c.pal.panelSub, fontWeight: 650 }}>Total</span>
          <span style={{ fontSize: 38, fontWeight: 800, fontFamily: c.display, letterSpacing: "-0.03em" }}>{total}</span>
        </div>
        {it.hit != null && (
          <div style={{ position: "absolute", right: 40, top: 150, transform: `rotate(-12deg) scale(${mix(1.8, 1, hk)})`, opacity: hk, border: "4px solid #10b981", color: "#10b981", borderRadius: 14, padding: "6px 20px", fontSize: 40, fontWeight: 900, letterSpacing: "0.08em" }}>{(rows.find((r) => r.tag)?.tag ?? "PAID").toUpperCase()}</div>
        )}
      </div>
    );
  },
  calendar: ({ c, it }) => {
    const rows = rowsOf(it, [D("Check-up", "9:00"), D("Follow-up", "11:30"), D("New patient", "14:00")]).slice(0, 5);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const hk = hitK(c, it, 12);
    return (
      <>
        <Head c={c} it={it} right={<Tag c={c}>{it.value ?? "This week"}</Tag>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, padding: "0 26px" }}>
          {days.map((d) => <div key={d} style={{ fontSize: 17, fontWeight: 700, color: c.pal.panelSub, textAlign: "center" }}>{d}</div>)}
          {Array.from({ length: 15 }, (_, s) => {
            const slot = [1, 7, 13, 4, 10].indexOf(s);
            const idx = slot >= 0 && slot < rows.length ? slot : -1;
            const r = idx >= 0 ? rows[idx] : null;
            const k = r ? kIn(c, rowAt(it, idx, rows.length, c)) : 0;
            const last = idx === rows.length - 1 && it.hit != null;
            const kk = last ? hk : k;
            return (
              <div key={s} style={{ height: 92, borderRadius: Math.max(8, c.art.radius * 0.4), background: c.pal.panelSoft, position: "relative", overflow: "hidden" }}>
                {r && (
                  <div style={{ position: "absolute", inset: 5, borderRadius: Math.max(6, c.art.radius * 0.35), background: idx % 2 ? c.pal.fill2 : c.pal.fill, color: c.pal.onFill, padding: "8px 10px", transform: `scale(${mix(0.6, 1, kk)})`, opacity: kk, boxSizing: "border-box" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>{r.meta}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.15, overflow: "hidden", maxHeight: 40 }}>{r.title}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  },
  table: ({ c, it }) => {
    const rows = rowsOf(it, [D("Acme Co", "$2,400", "Paid"), D("Northwind", "$1,150", "Due"), D("Globex", "$860", "Paid")]).slice(0, 5);
    return (
      <>
        <Head c={c} it={it} />
        <div style={{ display: "flex", padding: "10px 30px", fontSize: 17, fontWeight: 700, color: c.pal.panelSub, letterSpacing: "0.05em", background: c.pal.panelSoft }}>
          <span style={{ flex: 1 }}>NAME</span><span style={{ width: 150 }}>AMOUNT</span><span style={{ width: 110, textAlign: "right" }}>STATUS</span>
        </div>
        {rows.map((r, i) => {
          const k = kIn(c, rowAt(it, i, rows.length, c));
          return (
            <div key={i} style={{ ...show(k, 10), display: "flex", alignItems: "center", height: 76, padding: "0 30px", ...rowLine(c), fontSize: 23 }}>
              <span style={{ flex: 1, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
              <span style={{ width: 150, fontWeight: 650 }}>{r.meta}</span>
              <span style={{ width: 110, textAlign: "right" }}>{r.tag && <Tag c={c} tone={toneOf(r.tag)}>{r.tag}</Tag>}</span>
            </div>
          );
        })}
      </>
    );
  },
  kanban: ({ c, it }) => {
    const rows = rowsOf(it, [D("Draft brief", "To do"), D("Review", "Doing"), D("Ship it", "Done")]).slice(0, 5);
    const cols = ["To do", "Doing", "Done"];
    const hk = hitK(c, it, 18);
    return (
      <>
        <Head c={c} it={it} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "0 22px", position: "relative" }}>
          {cols.map((col, ci) => (
            <div key={col} style={{ background: c.pal.panelSoft, borderRadius: Math.max(10, c.art.radius * 0.5), padding: 12, height: 300, boxSizing: "border-box" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: c.pal.panelSub, marginBottom: 10 }}>{col}</div>
              {rows.map((r, i) => {
                const home = Math.max(0, cols.findIndex((x) => x.toLowerCase() === (r.meta ?? "").toLowerCase()));
                const moving = i === 0 && it.hit != null;
                const at = moving ? (hk > 0.5 ? 2 : home) : home;
                if (at !== ci) return null;
                const k = kIn(c, rowAt(it, i, rows.length, c));
                return (
                  <div key={i} style={{ ...show(moving ? Math.min(k, hk > 0.5 ? clamp01((hk - 0.5) * 2) : 1 - hk * 2) : k, 10), background: c.pal.panel, borderRadius: Math.max(8, c.art.radius * 0.4), padding: "12px 12px", marginBottom: 10, fontSize: 18, fontWeight: 650, boxShadow: `0 4px 12px ${c.pal.shadow}`, borderLeft: `4px solid ${i % 2 ? c.pal.fill2 : c.pal.fill}` }}>{r.title}</div>
                );
              })}
            </div>
          ))}
        </div>
      </>
    );
  },
  toggles: ({ c, it }) => {
    const rows = rowsOf(it, [D("Auto reminders", null as unknown as string, "on"), D("Sync calendar"), D("Weekly summary")]).slice(0, 5);
    return (
      <>
        <Head c={c} it={it} />
        {rows.map((r, i) => {
          const at = rowAt(it, i, rows.length, c);
          const k = kIn(c, at - 8);
          const on = kIn(c, at + 4, 10);
          return (
            <div key={i} style={{ ...show(k), display: "flex", alignItems: "center", gap: 16, height: 84, padding: "0 30px", ...rowLine(c) }}>
              <Glyph c={c} name={r.icon ?? it.icon} size={40} tone="panel" />
              <div style={{ flex: 1, fontSize: 24, fontWeight: 600 }}>{r.title}</div>
              <div style={{ width: 70, height: 40, borderRadius: 99, background: on > 0.5 ? c.pal.fill : c.pal.panelLine, position: "relative", transition: "none" }}>
                <div style={{ position: "absolute", top: 4, left: mix(4, 34, on), width: 32, height: 32, borderRadius: 99, background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }} />
              </div>
            </div>
          );
        })}
      </>
    );
  },
  timeline: ({ c, it }) => {
    const rows = rowsOf(it, [D("Connected", "9:02"), D("Summary written", "9:41"), D("Sent to the team", "9:42")]).slice(0, 5);
    return (
      <>
        <Head c={c} it={it} />
        <div style={{ position: "relative", padding: "6px 30px 20px 30px" }}>
          <div style={{ position: "absolute", left: 50, top: 20, bottom: 40, width: 3, background: c.pal.panelLine }} />
          {rows.map((r, i) => {
            const at = rowAt(it, i, rows.length, c);
            const k = kIn(c, at);
            return (
              <div key={i} style={{ ...show(k, 12), display: "flex", alignItems: "center", gap: 22, height: 80, position: "relative" }}>
                <div style={{ width: 44, display: "flex", justifyContent: "center" }}><Tick c={c} size={30} k={k} /></div>
                <div style={{ flex: 1, fontSize: 24, fontWeight: 600 }}>{r.title}</div>
                {r.meta && <div style={{ fontSize: 20, color: c.pal.panelSub }}>{r.meta}</div>}
              </div>
            );
          })}
        </div>
      </>
    );
  },
  search: ({ c, it }) => {
    const q = it.value ?? it.title ?? "Search";
    const rows = rowsOf(it, [D("Result one", "Last week", "", "file-text"), D("Result two", "Yesterday", "", "file-text")]).slice(0, 4);
    const typed = clamp01((c.f - it.at - 6) / Math.max(12, q.length * 1.6));
    return (
      <>
        <div style={{ padding: "26px 26px 14px" }}>
          <div style={{ height: 70, borderRadius: Math.max(12, c.art.radius * 0.6), border: `2px solid ${c.pal.fill}`, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", background: c.pal.panelSoft }}>
            <Icon name="search" size={28} color={c.pal.panelSub} />
            <span style={{ fontSize: 26, fontWeight: 600 }}>{q.slice(0, Math.round(q.length * typed))}</span>
            {typed < 1 && <span style={{ width: 2, height: 30, background: c.pal.fill }} />}
          </div>
        </div>
        {rows.map((r, i) => {
          const k = kIn(c, Math.max(rowAt(it, i, rows.length, c), it.at + 6 + Math.round(q.length * 1.6)));
          return (
            <div key={i} style={{ ...show(k, 12), display: "flex", alignItems: "center", gap: 16, height: 82, padding: "0 30px", ...rowLine(c) }}>
              <Glyph c={c} name={r.icon ?? "file-text"} size={42} tone="panel" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 23, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                {r.meta && <div style={{ fontSize: 18, color: c.pal.panelSub }}>{r.meta}</div>}
              </div>
              {r.tag && <Tag c={c} tone={toneOf(r.tag)}>{r.tag}</Tag>}
            </div>
          );
        })}
      </>
    );
  },
  profile: ({ c, it }) => {
    const rows = rowsOf(it, [D("Next visit", "Tue 9:00"), D("Plan", "Monthly"), D("Status", "Active", "Active")]).slice(0, 4);
    return (
      <div style={{ padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Initial c={c} letter={it.title ?? "A"} size={86} />
          <div>
            <div style={{ fontSize: 30, fontWeight: 750 }}>{it.title ?? "Alex Morgan"}</div>
            {it.sub && <div style={{ fontSize: 20, color: c.pal.panelSub }}>{it.sub}</div>}
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          {rows.map((r, i) => {
            const k = kIn(c, rowAt(it, i, rows.length, c));
            return (
              <div key={i} style={{ ...show(k, 10), display: "flex", justifyContent: "space-between", alignItems: "center", height: 66, ...rowLine(c), fontSize: 22 }}>
                <span style={{ color: c.pal.panelSub, fontWeight: 600 }}>{r.title}</span>
                {r.tag ? <Tag c={c} tone={toneOf(r.tag)}>{r.meta ?? r.tag}</Tag> : <span style={{ fontWeight: 650 }}>{r.meta}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  doc: ({ c, it }) => {
    const rows = rowsOf(it, [D("Decisions"), D("Action items"), D("Next steps")]).slice(0, 4);
    const hk = hitK(c, it, 16);
    return (
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Glyph c={c} name={it.icon ?? "file-text"} size={46} tone="panel" />
          <div style={{ fontSize: 28, fontWeight: 750, flex: 1 }}>{it.title ?? "Summary"}</div>
          {it.value && <Tag c={c} tone="good">{it.value}</Tag>}
        </div>
        {rows.map((r, i) => {
          const at = rowAt(it, i, rows.length, c);
          const k = kIn(c, at);
          const lineK = kIn(c, at + 4, 20);
          return (
            <div key={i} style={{ ...show(k, 10), marginTop: 18 }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: i === rows.length - 1 && hk ? c.pal.fill : c.pal.panelInk }}>{r.title}</div>
              {[0.92, 0.7].map((wd, j) => (
                <div key={j} style={{ height: 12, borderRadius: 6, marginTop: 9, width: `${wd * 100 * clamp01(lineK * 1.3 - j * 0.3)}%`, background: i === rows.length - 1 && hk ? `${c.pal.fill}55` : c.pal.panelLine }} />
              ))}
            </div>
          );
        })}
      </div>
    );
  },
  pay: ({ c, it }) => {
    const hk = hitK(c, it, 14);
    const amount = it.value ?? "$2,400";
    return (
      <div style={{ padding: 30, display: "flex", flexDirection: "column", gap: 20, height: "100%", boxSizing: "border-box" }}>
        <div style={{ height: 200, borderRadius: Math.max(16, c.art.radius), background: `linear-gradient(135deg, ${c.pal.fill}, ${c.pal.fill2})`, padding: 26, color: c.pal.onFill, position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
          <div style={{ position: "absolute", right: -60, top: -60, width: 220, height: 220, borderRadius: 999, background: "rgba(255,255,255,0.14)" }} />
          <Icon name={iconName(it.icon, "credit-card")} size={40} color={c.pal.onFill} />
          <div style={{ position: "absolute", left: 26, bottom: 26, fontSize: 24, letterSpacing: "0.18em", fontWeight: 600, opacity: 0.9 }}>•••• 4242</div>
          <div style={{ position: "absolute", right: 26, bottom: 26, fontSize: 20, fontWeight: 700 }}>{it.title ?? c.brand.name}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 22, color: c.pal.panelSub, fontWeight: 600 }}>{it.sub ?? "Amount"}</span>
          <span style={{ fontSize: 46, fontWeight: 800, fontFamily: c.display, letterSpacing: "-0.03em" }}>{countUp(amount, kIn(c, it.at + 6, 30))}</span>
        </div>
        <div style={{ height: 70, borderRadius: Math.max(12, c.art.radius * 0.6), background: hk > 0.5 ? "#10b981" : c.pal.panelInk, color: hk > 0.5 ? "#fff" : c.pal.panel, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 25, fontWeight: 750 }}>
          {hk > 0.5 ? <><Tick c={c} size={34} k={clamp01((hk - 0.5) * 2)} color="rgba(255,255,255,0.25)" /> {(it.rows?.[0]?.tag ?? "Paid")}</> : <>Pay {amount}</>}
        </div>
      </div>
    );
  },
};
