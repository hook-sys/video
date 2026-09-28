import { lerp } from "../engine/motion-patterns";
import { COLUMNS, LAYOUT, WS } from "./plan";

// The reference demo's objects. Each is one persistent element whose shape
// morphs between states (loose card → board row, browser tab → sidebar app)
// instead of being swapped for a different element.

export const INK = "#141a33";
export const MUTED = "#6b7394";
export const INDIGO = "#5b6cff";
export const GREEN = "#22c55e";
export const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

// Task: loose card (400×156) → board row (272×88). `m` = morph, `check` = done.
export function TaskCard({ title, tag, tagColor, due, m, check, lift }: { title: string; tag: string; tagColor: string; due: string; m: number; check: number; lift: number }) {
  const w = lerp(400, 272, m);
  const h = lerp(156, 88, m);
  const meta = 1 - Math.min(1, m * 1.6);
  const box = lerp(34, 26, m);
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: lerp(20, 14, m),
        background: "#ffffff",
        boxShadow: `0 ${lerp(26, 4, m) + lift * 20}px ${lerp(60, 14, m) + lift * 30}px rgba(8,10,30,${lerp(0.45, 0.12, m)})`,
        border: `1px solid rgba(20,26,51,${lerp(0.04, 0.08, m)})`,
        display: "flex",
        alignItems: "center",
        gap: lerp(18, 12, m),
        padding: `0 ${lerp(24, 16, m)}px`,
        boxSizing: "border-box",
        fontFamily: FONT,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: lerp(8, 5, m), background: tagColor }} />
      <div
        style={{
          width: box,
          height: box,
          flex: "none",
          borderRadius: "50%",
          border: `3px solid ${check > 0 ? GREEN : "#c7cce0"}`,
          background: check > 0 ? `rgba(34,197,94,${check})` : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${1 + 0.25 * Math.sin(Math.PI * Math.min(1, check))})`,
        }}
      >
        <svg width={box * 0.6} height={box * 0.6} viewBox="0 0 24 24">
          <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - check)} />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: lerp(12, 0, m), minWidth: 0 }}>
        <div
          style={{
            fontSize: lerp(30, 20, m),
            fontWeight: 700,
            color: check > 0.5 ? MUTED : INK,
            whiteSpace: "nowrap",
            textDecoration: check > 0.9 ? "line-through" : "none",
            textDecorationColor: "#b9bfd6",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, height: lerp(34, 0, m), opacity: meta, overflow: "hidden" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: tagColor, background: `${tagColor}1f`, padding: "4px 12px", borderRadius: 999 }}>{tag}</span>
          <span style={{ fontSize: 20, fontWeight: 600, color: due === "Overdue" ? "#ef4444" : MUTED }}>{due}</span>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${tagColor}, #1e2448)` }} />
        </div>
      </div>
    </div>
  );
}

// Browser tab window (420×280) → sidebar app row (214×52).
export function BrowserTab({ title, host, favicon, badge, m, badgePop, lift }: { title: string; host: string; favicon: string; badge: number; m: number; badgePop: number; lift: number }) {
  const w = lerp(440, 214, m);
  const h = lerp(290, 52, m);
  const body = 1 - Math.min(1, m * 1.8);
  const strip = lerp(52, 52, m);
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: lerp(16, 12, m),
        background: lerp(1, 0, m) > 0.5 ? "#eef0f7" : "#ffffff",
        boxShadow: `0 ${lerp(28, 2, m) + lift * 20}px ${lerp(64, 8, m) + lift * 30}px rgba(8,10,30,${lerp(0.5, 0.08, m)})`,
        overflow: "hidden",
        fontFamily: FONT,
        position: "relative",
      }}
    >
      {/* tab strip → the app row */}
      <div style={{ height: strip, display: "flex", alignItems: "flex-end", padding: `0 ${lerp(14, 0, m)}px`, gap: 8 }}>
        <div
          style={{
            height: lerp(40, 52, m),
            flex: 1,
            background: "#ffffff",
            borderRadius: `${lerp(12, 12, m)}px ${lerp(12, 12, m)}px ${lerp(0, 12, m)}px ${lerp(0, 12, m)}px`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 14px",
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 6, background: favicon, flex: "none" }} />
          <span style={{ fontSize: 21, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{m > 0.6 ? host[0].toUpperCase() + host.slice(1) : title}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 22, color: MUTED, opacity: body }}>×</span>
        </div>
        <div style={{ width: lerp(90, 0, m), height: 30, borderRadius: 10, background: "#dfe2ee", opacity: body, marginBottom: 6 }} />
      </div>
      {/* address bar + page */}
      <div style={{ opacity: body, background: "#ffffff", height: h - strip, padding: "0 16px", boxSizing: "border-box" }}>
        <div style={{ height: 36, borderRadius: 18, background: "#f1f3f9", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 17, color: MUTED }}>{host}.app</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 16 }}>
          <div style={{ height: 130, borderRadius: 10, background: `${favicon}22` }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 0.8, 0.9, 0.6].map((k, i) => (
              <div key={i} style={{ height: 18, width: `${k * 100}%`, borderRadius: 9, background: "#e6e9f3" }} />
            ))}
          </div>
        </div>
      </div>
      {/* notification badge */}
      {badgePop > 0 && (
        <div
          style={{
            position: "absolute",
            right: lerp(14, 14, m),
            top: lerp(6, 13, m),
            minWidth: lerp(36, 26, m),
            height: lerp(36, 26, m),
            padding: "0 8px",
            boxSizing: "border-box",
            borderRadius: 999,
            background: m > 0.5 ? "#e8ebf6" : "#ef4444",
            color: m > 0.5 ? MUTED : "#fff",
            fontSize: lerp(19, 15, m),
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${badgePop})`,
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}

// The workspace app window. `appear` reveals it, `clean` turns placeholders into
// real columns, `bars[i]` builds the chart, `pct` drives the progress readouts,
// `calm` lowers visual density at the end.
export function Workspace({ appear, clean, bars, pct, chartIn, calm }: { appear: number; clean: number; bars: number[]; pct: number; chartIn: number; calm: number }) {
  const { cols, chart, header, sidebar } = LAYOUT;
  return (
    <div
      style={{
        width: WS.w,
        height: WS.h,
        borderRadius: 34,
        background: "#ffffff",
        boxShadow: `0 60px 160px rgba(6,10,40,${lerp(0.55, 0.22, calm)}), 0 0 0 1px rgba(255,255,255,0.6)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: FONT,
        opacity: appear,
        transform: `scale(${lerp(0.86, 1, appear)})`,
      }}
    >
      {/* header */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: header, display: "flex", alignItems: "center", padding: "0 36px", gap: 20, borderBottom: "1px solid #eef0f6" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${INDIGO}, #9b6bff)` }} />
        <div style={{ fontSize: 34, fontWeight: 800, color: INK, letterSpacing: -0.5 }}>Workspace</div>
        <div style={{ flex: 1 }} />
        <div style={{ opacity: clean, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: MUTED }}>Progress</div>
          <div style={{ width: 300, height: 14, borderRadius: 7, background: "#eef0f6", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 7, background: `linear-gradient(90deg, ${INDIGO}, ${GREEN})` }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: INK, width: 70 }}>{Math.round(pct)}%</div>
        </div>
      </div>
      {/* sidebar */}
      <div style={{ position: "absolute", left: 0, top: header, bottom: 0, width: sidebar.x * 2 + sidebar.w, background: "#f6f7fb", borderRight: "1px solid #eef0f6" }}>
        <div style={{ position: "absolute", left: sidebar.x + 8, top: 22, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, color: "#a3a9c2", opacity: clean }}>CONNECTED</div>
      </div>
      {/* columns: dashed placeholders until organized */}
      {COLUMNS.map((name, c) => (
        <div key={name} style={{ position: "absolute", left: cols.x + c * (cols.w + cols.gap), top: cols.y, width: cols.w }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 32, opacity: clean }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: [MUTED, INDIGO, GREEN][c] }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: INK }}>{name}</span>
          </div>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} style={{ marginTop: r === 0 ? 12 : cols.rowGap, height: cols.rowH, borderRadius: 14, border: "2px dashed #dfe3f0", opacity: (1 - clean) * 0.9 }} />
          ))}
        </div>
      ))}
      {/* progress panel: empty until the work produces a result */}
      <div
        style={{
          position: "absolute",
          left: chart.x,
          top: chart.y,
          width: chart.w,
          height: chart.h,
          borderRadius: 24,
          background: chartIn > 0 ? `linear-gradient(180deg, rgba(91,108,255,${0.04 + 0.06 * chartIn}), rgba(34,197,94,${0.08 * chartIn}))` : "#f7f8fc",
          border: `2px ${chartIn > 0.05 ? "solid" : "dashed"} ${chartIn > 0.05 ? "rgba(91,108,255,0.18)" : "#e3e6f1"}`,
          padding: 30,
          boxSizing: "border-box",
        }}
      >
        <div style={{ opacity: chartIn }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: MUTED }}>This week</div>
          <div style={{ fontSize: 92, fontWeight: 900, color: INK, letterSpacing: -3, lineHeight: 1.05, marginTop: 8 }}>{Math.round(pct)}%</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>tasks completed</div>
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, bottom: 60, height: 360, display: "flex", alignItems: "flex-end", gap: 18 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, height: `${Math.max(0, b) * 100}%`, borderRadius: 12, background: i === bars.length - 1 ? `linear-gradient(180deg, ${GREEN}, #16a34a)` : `linear-gradient(180deg, ${INDIGO}, #7c8cff)`, opacity: 0.35 + 0.65 * Math.min(1, b * 3) }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, bottom: 22, display: "flex", gap: 18, opacity: chartIn * 0.8 }}>
          {["M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 700, color: "#a3a9c2" }}>{d}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

