import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../../../icons";
import type { Pal } from "../looks";

// Small drawn parts the blocks share (all coloured from the palette).

// The scattered tools of a problem (icon, name, colour).
export const TOOLS: { icon: string; name: string; color: string }[] = [
  { icon: "sheet", name: "Spreadsheet", color: "#16a34a" },
  { icon: "mail", name: "Inbox", color: "#2563eb" },
  { icon: "receipt", name: "Invoices", color: "#9333ea" },
  { icon: "message-square", name: "Chat", color: "#f97316" },
  { icon: "file-text", name: "Docs", color: "#0ea5e9" },
  { icon: "calendar", name: "Calendar", color: "#e11d48" },
];

// A small app window (a tool), drawn flat.
export function Win({ title, icon, color, pal, w = 480, h = 310, children, style }: { title: string; icon: string; color: string; pal: Pal; w?: number; h?: number; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 20, background: pal.panel, boxShadow: pal.dark ? "0 30px 80px rgba(0,0,0,0.45)" : "0 30px 80px rgba(30,50,120,0.16), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden", ...style }}>
      <div style={{ height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderBottom: `1px solid ${pal.line}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={18} color="#fff" strokeWidth={2.4} />
        </div>
        <span style={{ fontSize: 19, fontWeight: 650, color: pal.panelInk }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>
        {children ??
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <span style={{ height: 12, width: `${36 + ((i * 23) % 40)}%`, borderRadius: 9, background: pal.line }} />
              <span style={{ height: 12, width: "20%", borderRadius: 9, background: pal.line, opacity: 0.6 }} />
            </div>
          ))}
      </div>
    </div>
  );
}

// A blurred sheet of paper or UI drifting at an edge.
export function Sheet({ x, y, w, h, r, blur, f, kind, pal }: { x: number; y: number; w: number; h: number; r: number; blur: number; f: number; kind: number; pal: Pal }) {
  const light = kind % 2 === 1;
  const face = light ? "#ffffff" : pal.dark ? "rgba(255,255,255,0.07)" : "#eef0f6";
  const bar = light ? "#e6e3ee" : pal.dark ? "rgba(255,255,255,0.14)" : "#dfe2ec";
  return (
    <div style={{ position: "absolute", left: x + Math.sin(f / 50 + kind) * 14, top: y + Math.cos(f / 60 + kind) * 10, width: w, height: h, borderRadius: 14, background: face, border: `1px solid ${pal.dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)"}`, transform: `rotate(${r}deg)`, filter: `blur(${blur}px)`, padding: 22, boxSizing: "border-box", boxShadow: "0 30px 70px rgba(0,0,0,0.25)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: light ? "#222" : pal.dark ? "#ddd" : "#333", marginBottom: 14 }}>{["INVOICE", "Payment details", "Report Q3", "Sales export"][kind % 4]}</div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span style={{ height: 9, width: `${40 + ((i * 17 + kind * 11) % 40)}%`, borderRadius: 9, background: bar }} />
          <span style={{ height: 9, width: "18%", borderRadius: 9, background: bar, opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}

// A tag pill at a depth (far ones small, blurred and faint).
export function Tag({ t, x, y, z, f, k, icon, pal }: { t: string; x: number; y: number; z: number; f: number; k: number; icon?: string; pal: Pal }) {
  return (
    <div style={{ position: "absolute", left: x + Math.sin(f / 50 + x) * 10 * z, top: y + Math.cos(f / 60 + y) * 8 * z + (1 - k) * 40, display: "flex", alignItems: "center", gap: 10, padding: `${10 * z}px ${22 * z}px`, borderRadius: 12 * z, background: pal.dark ? `${pal.glass}33` : `${pal.accent}1c`, color: pal.dark ? pal.ink : pal.accent, fontSize: 40 * z, fontWeight: 600, opacity: k * (0.35 + 0.65 * Math.min(1, z)), filter: `blur(${Math.abs(1 - z) * 7}px)`, whiteSpace: "nowrap" }}>
      {icon && <Icon name={icon} size={40 * z} color={pal.dark ? pal.ink : pal.accent} />}
      {t}
    </div>
  );
}
