import { Img } from "remotion";
import { jitter, lerp } from "./motion-patterns";
import { KINDS, WORKSPACE } from "./kinds";
import type { ObjectState, ObjectTrack } from "./timeline";

// V1 object library. Each kind is ONE element whose shape morphs between its
// states (driven by `s.morph`, `s.check`, `s.build` …) — never swapped for a
// different element. Labels and values are illustrative mock-UI content.

export const INK = "#141a33";
export const MUTED = "#6b7394";
export const INDIGO = "#5b6cff";
export const GREEN = "#22c55e";
export const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

type Props = { t: ObjectTrack; s: ObjectState; lift: number; frame: number };
const shadow = (m: number, lift: number, dark = 0.45) =>
  `0 ${lerp(26, 4, m) + lift * 20}px ${lerp(60, 14, m) + lift * 30}px rgba(8,10,30,${lerp(dark, 0.12, m)})`;
const sizeAt = (t: ObjectTrack, m: number) => {
  const k = KINDS[t.kind];
  const o = k.organized ?? k.loose;
  return { w: lerp(k.loose.w, o.w, m), h: lerp(k.loose.h, o.h, m) };
};
const num = (id: string, lo: number, hi: number) => Math.round(lo + ((jitter(id, 9) + 1) / 2) * (hi - lo));

function Check({ size, check }: { size: number; check: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
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
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - check)} />
      </svg>
    </div>
  );
}

// task_card / generic_card: loose card → board row; completed = checked.
function CardItem({ t, s, lift, withCheck }: Props & { withCheck: boolean }) {
  const m = s.morph;
  const { w, h } = sizeAt(t, m);
  const meta = 1 - Math.min(1, m * 1.6);
  return (
    <div style={{ width: w, height: h, borderRadius: lerp(20, 14, m), background: "#fff", boxShadow: shadow(m, lift), border: `1px solid rgba(20,26,51,${lerp(0.04, 0.08, m)})`, display: "flex", alignItems: "center", gap: lerp(18, 12, m), padding: `0 ${lerp(24, 16, m)}px`, boxSizing: "border-box", fontFamily: FONT, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: lerp(8, 5, m), background: t.tint }} />
      {withCheck ? <Check size={lerp(34, 26, m)} check={s.check} /> : <div style={{ width: lerp(52, 30, m), height: lerp(52, 30, m), flex: "none", borderRadius: lerp(14, 9, m), background: `linear-gradient(135deg, ${t.tint}, ${t.tint}88)` }} />}
      <div style={{ display: "flex", flexDirection: "column", gap: lerp(12, 0, m), minWidth: 0 }}>
        <div style={{ fontSize: lerp(30, 20, m), fontWeight: 700, color: s.check > 0.5 ? MUTED : INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: withCheck && s.check > 0.9 ? "line-through" : "none", textDecorationColor: "#b9bfd6" }}>
          {t.content.title ?? "Item"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, height: lerp(34, 0, m), opacity: meta, overflow: "hidden" }}>
          {t.content.tag && <span style={{ fontSize: 20, fontWeight: 700, color: t.tint, background: `${t.tint}1f`, padding: "4px 12px", borderRadius: 999 }}>{t.content.tag}</span>}
          {t.content.meta && <span style={{ fontSize: 20, fontWeight: 600, color: /overdue|late/i.test(t.content.meta) ? "#ef4444" : MUTED }}>{t.content.meta}</span>}
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${t.tint}, #1e2448)` }} />
        </div>
      </div>
      {!withCheck && s.check > 0 && <div style={{ marginLeft: "auto" }}><Check size={lerp(30, 24, m)} check={s.check} /></div>}
    </div>
  );
}

// browser_tab: window → docked sidebar row. `pulse` pops its badge.
function BrowserTab({ t, s, lift }: Props) {
  const m = s.morph;
  const { w, h } = sizeAt(t, m);
  const body = 1 - Math.min(1, m * 1.8);
  const host = t.content.meta ?? (t.content.title ?? "app").split(/\s/)[0].toLowerCase();
  const badge = num(t.id, 3, 58);
  return (
    <div style={{ width: w, height: h, borderRadius: lerp(16, 12, m), background: `rgb(${lerp(238, 255, m)},${lerp(240, 255, m)},${lerp(247, 255, m)})`, boxShadow: shadow(m, lift, 0.5), overflow: "hidden", fontFamily: FONT, position: "relative" }}>
      <div style={{ height: 52, display: "flex", alignItems: "flex-end", padding: `0 ${lerp(14, 0, m)}px`, gap: 8 }}>
        <div style={{ height: lerp(40, 52, m), flex: 1, background: "#fff", borderRadius: `12px 12px ${lerp(0, 12, m)}px ${lerp(0, 12, m)}px`, display: "flex", alignItems: "center", gap: 12, padding: "0 14px" }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: t.tint, flex: "none" }} />
          <span style={{ fontSize: 21, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{m > 0.6 ? host[0].toUpperCase() + host.slice(1) : t.content.title}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 22, color: MUTED, opacity: body }}>×</span>
        </div>
        <div style={{ width: lerp(90, 0, m), height: 30, borderRadius: 10, background: "#dfe2ee", opacity: body, marginBottom: 6 }} />
      </div>
      <div style={{ opacity: body, background: "#fff", height: h - 52, padding: "0 16px", boxSizing: "border-box" }}>
        <div style={{ height: 36, borderRadius: 18, background: "#f1f3f9", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 17, color: MUTED }}>{host}.app</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 16 }}>
          <div style={{ height: 130, borderRadius: 10, background: `${t.tint}22` }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 0.8, 0.9, 0.6].map((k, i) => (
              <div key={i} style={{ height: 18, width: `${k * 100}%`, borderRadius: 9, background: "#e6e9f3" }} />
            ))}
          </div>
        </div>
      </div>
      {s.pulse > 0 && (
        <div style={{ position: "absolute", right: 14, top: lerp(6, 13, m), minWidth: lerp(36, 26, m), height: lerp(36, 26, m), padding: "0 8px", boxSizing: "border-box", borderRadius: 999, background: m > 0.5 ? "#e8ebf6" : "#ef4444", color: m > 0.5 ? MUTED : "#fff", fontSize: lerp(19, 15, m), fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${s.pulse})` }}>
          {badge}
        </div>
      )}
    </div>
  );
}

// workspace: an app window. morph = placeholders → real columns; value drives
// its progress readout; calm lightens it at the resolve.
function Workspace({ t, s }: Props) {
  const { w, h } = KINDS.workspace.loose;
  const { cols, panel, header, sidebar, columns } = WORKSPACE;
  const clean = s.morph;
  return (
    <div style={{ width: w, height: h, borderRadius: 34, background: "#fff", boxShadow: `0 60px 160px rgba(6,10,40,${lerp(0.55, 0.22, s.calm)}), 0 0 0 1px rgba(255,255,255,0.6)`, position: "relative", overflow: "hidden", fontFamily: FONT }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: header, display: "flex", alignItems: "center", padding: "0 36px", gap: 20, borderBottom: "1px solid #eef0f6" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${INDIGO}, #9b6bff)` }} />
        <div style={{ fontSize: 34, fontWeight: 800, color: INK, letterSpacing: -0.5 }}>{t.content.title ?? "Workspace"}</div>
        <div style={{ flex: 1 }} />
        <div style={{ opacity: clean, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: MUTED }}>Progress</div>
          <div style={{ width: 300, height: 14, borderRadius: 7, background: "#eef0f6", overflow: "hidden" }}>
            <div style={{ width: `${s.value}%`, height: "100%", borderRadius: 7, background: `linear-gradient(90deg, ${INDIGO}, ${GREEN})` }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: INK, width: 70 }}>{Math.round(s.value)}%</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: header, bottom: 0, width: sidebar.x * 2 + sidebar.w, background: "#f6f7fb", borderRight: "1px solid #eef0f6" }}>
        <div style={{ position: "absolute", left: sidebar.x + 8, top: 22, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, color: "#a3a9c2", opacity: clean }}>CONNECTED</div>
      </div>
      {columns.map((name, c) => (
        <div key={name} style={{ position: "absolute", left: cols.x + c * (cols.w + cols.gap), top: cols.y, width: cols.w }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 32, opacity: clean }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: [MUTED, INDIGO, GREEN][c] }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: INK }}>{["To do", "In progress", "Done"][c]}</span>
          </div>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} style={{ marginTop: r === 0 ? 12 : cols.rowGap, height: cols.rowH, borderRadius: 14, border: "2px dashed #dfe3f0", opacity: (1 - clean) * 0.9 }} />
          ))}
        </div>
      ))}
      <div style={{ position: "absolute", left: panel.x, top: panel.y, width: panel.w, height: panel.h, borderRadius: 24, border: "2px dashed #e3e6f1", background: "#f7f8fc" }} />
    </div>
  );
}

// progress_panel: empty → building (bars grow) → complete; value = % shown.
function ProgressPanel({ t, s }: Props) {
  const { w, h } = sizeAt(t, s.morph);
  const bars = [0.34, 0.46, 0.4, 0.63, 0.8, 1];
  const shown = s.value > 0 ? s.value : s.build * 100;
  return (
    <div style={{ width: w, height: h, borderRadius: 24, background: `linear-gradient(180deg, rgba(91,108,255,0.1), rgba(34,197,94,0.08)), #fff`, border: "2px solid rgba(91,108,255,0.18)", padding: 30, boxSizing: "border-box", fontFamily: FONT, position: "relative" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: MUTED }}>{t.content.title ?? "Progress"}</div>
      <div style={{ fontSize: 92, fontWeight: 900, color: INK, letterSpacing: -3, lineHeight: 1.05, marginTop: 8 }}>{Math.round(shown)}%</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{t.content.meta ?? "complete"}</div>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 60, height: h * 0.45, display: "flex", alignItems: "flex-end", gap: 18 }}>
        {bars.map((b, i) => {
          const g = Math.max(0, Math.min(1, s.build * 1.6 - i * 0.12));
          return <div key={i} style={{ flex: 1, height: `${b * g * 100}%`, borderRadius: 12, background: i === bars.length - 1 ? `linear-gradient(180deg, ${GREEN}, #16a34a)` : `linear-gradient(180deg, ${INDIGO}, #7c8cff)`, opacity: 0.35 + 0.65 * Math.min(1, g * 3) }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 22, display: "flex", gap: 18 }}>
        {["M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 700, color: "#a3a9c2" }}>{d}</div>
        ))}
      </div>
    </div>
  );
}

// message: chat bubble → inbox row.
function Message({ t, s, lift }: Props) {
  const m = s.morph;
  const { w, h } = sizeAt(t, m);
  return (
    <div style={{ width: w, height: h, borderRadius: lerp(28, 14, m), borderBottomLeftRadius: lerp(6, 14, m), background: "#fff", boxShadow: shadow(m, lift), display: "flex", alignItems: "center", gap: 16, padding: `0 ${lerp(24, 16, m)}px`, boxSizing: "border-box", fontFamily: FONT, overflow: "hidden" }}>
      <div style={{ width: lerp(56, 34, m), height: lerp(56, 34, m), flex: "none", borderRadius: "50%", background: `linear-gradient(135deg, ${t.tint}, #1e2448)` }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: lerp(20, 15, m), fontWeight: 800, color: t.tint }}>{t.content.tag ?? "New message"}</div>
        <div style={{ fontSize: lerp(27, 19, m), fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.content.title ?? "…"}</div>
      </div>
      {s.check > 0 && <div style={{ marginLeft: "auto" }}><Check size={lerp(30, 24, m)} check={s.check} /></div>}
    </div>
  );
}

// document: page → file row.
function Document({ t, s, lift }: Props) {
  const m = s.morph;
  const { w, h } = sizeAt(t, m);
  const page = 1 - Math.min(1, m * 1.7);
  return (
    <div style={{ width: w, height: h, borderRadius: lerp(18, 14, m), background: "#fff", boxShadow: shadow(m, lift), fontFamily: FONT, overflow: "hidden", position: "relative", padding: lerp(28, 16, m), boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: lerp(44, 34, m), height: lerp(54, 40, m), flex: "none", borderRadius: 8, background: `${t.tint}26`, borderTop: `6px solid ${t.tint}` }} />
        <div style={{ fontSize: lerp(26, 19, m), fontWeight: 800, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.content.title ?? "Document"}</div>
      </div>
      <div style={{ opacity: page, marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        {[1, 0.92, 0.97, 0.6, 1, 0.85, 0.7].map((k, i) => (
          <div key={i} style={{ height: 14, width: `${k * 100}%`, borderRadius: 7, background: "#e8ebf4" }} />
        ))}
      </div>
      {s.check > 0 && <div style={{ position: "absolute", right: 16, top: lerp(20, 30, m) }}><Check size={26} check={s.check} /></div>}
    </div>
  );
}

// input_field: idle → typing (typed reveals the text) → submitted (pulse).
function InputField({ t, s, frame }: Props) {
  const { w, h } = KINDS.input_field.loose;
  const full = t.content.title ?? "";
  const shown = full.slice(0, Math.round(full.length * s.typed));
  const caret = Math.floor(frame / 15) % 2 === 0 && s.typed < 1;
  return (
    <div style={{ width: w, height: h, borderRadius: 30, background: "#fff", boxShadow: "0 30px 80px rgba(8,10,30,.35)", display: "flex", alignItems: "center", padding: "0 18px 0 36px", gap: 16, boxSizing: "border-box", fontFamily: FONT }}>
      <div style={{ flex: 1, fontSize: 34, fontWeight: 600, color: shown ? INK : "#a3a9c2", whiteSpace: "nowrap", overflow: "hidden" }}>
        {shown || t.content.meta || "Describe what you need…"}
        {caret && <span style={{ color: INDIGO }}>|</span>}
      </div>
      <div style={{ height: 84, padding: "0 32px", borderRadius: 22, background: `linear-gradient(135deg, ${INDIGO}, #9b6bff)`, color: "#fff", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", transform: `scale(${1 - 0.06 * s.pulse})` }}>{t.content.tag ?? "Go"}</div>
    </div>
  );
}

function Cursor({ s }: Props) {
  return (
    <svg width={56} height={56} viewBox="0 0 24 24" style={{ transform: `scale(${1 - 0.18 * s.pulse})`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,.35))" }}>
      <path d="M4 2l15 9-6.5 1.5L10 19z" fill="#fff" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

// metric: a number that counts up as it builds.
function Metric({ t, s, lift }: Props) {
  const { w, h } = sizeAt(t, s.morph);
  const title = t.content.title ?? "";
  const match = title.match(/(\d+(?:\.\d+)?)/);
  const target = match ? Number(match[1]) : null;
  const shown = target !== null ? title.replace(match![1], String(Math.round(target * Math.min(1, s.build || 1)))) : title;
  return (
    <div style={{ minWidth: w, height: h, borderRadius: 26, background: "#fff", boxShadow: shadow(0, lift), padding: "32px 40px", boxSizing: "border-box", fontFamily: FONT }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: MUTED }}>{t.content.tag ?? "Result"}</div>
      <div style={{ fontSize: shown.length > 8 ? 56 : 88, fontWeight: 900, color: INK, letterSpacing: shown.length > 8 ? -1.5 : -3, lineHeight: 1.1, whiteSpace: "nowrap", marginTop: shown.length > 8 ? 14 : 0 }}>{shown}</div>
      {t.content.meta && <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{t.content.meta}</div>}
    </div>
  );
}

function HeroMark({ t }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 36, fontFamily: FONT }}>
      <div style={{ width: 150, height: 150, borderRadius: 42, background: `linear-gradient(135deg, ${INDIGO}, #9b6bff)`, boxShadow: "0 30px 90px rgba(91,108,255,.45)" }} />
      <div>
        <div style={{ fontSize: 110, fontWeight: 900, letterSpacing: -4, color: "#fff", lineHeight: 1 }}>{t.content.title}</div>
        {t.content.tag && <div style={{ fontSize: 34, fontWeight: 600, color: "#c7cdf5", marginTop: 12 }}>{t.content.tag}</div>}
      </div>
    </div>
  );
}

// Generated visual (asset_wide / asset_square): revealed with a wipe, then
// alive with a slow push-in and drift for as long as it's on screen.
function AssetImage({ t, frame, lift }: Props) {
  const { w, h } = KINDS[t.kind].loose;
  const life = Math.max(0, frame - t.born);
  const reveal = Math.min(1, life / 16);
  const wipe = 1 - (1 - reveal) * (1 - reveal);
  const push = 1.14 - 0.12 * Math.min(1, life / 240);
  const drift = Math.sin(life / 90) * 1.2;
  return (
    <div style={{ width: w, height: h, borderRadius: 34, overflow: "hidden", position: "relative", boxShadow: `0 ${40 + lift * 20}px ${110 + lift * 30}px rgba(6,10,40,0.5)`, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0 round 34px)` }}>
      {t.content.src && (
        <Img src={t.content.src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${push}) translate(${drift}%, ${drift * -0.5}%)` }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 60%, rgba(6,10,30,0.25))", pointerEvents: "none" }} />
    </div>
  );
}

export function ObjectView(p: Props) {
  switch (p.t.kind) {
    case "task_card":
      return <CardItem {...p} withCheck />;
    case "generic_card":
      return <CardItem {...p} withCheck={false} />;
    case "browser_tab":
      return <BrowserTab {...p} />;
    case "workspace":
      return <Workspace {...p} />;
    case "progress_panel":
      return <ProgressPanel {...p} />;
    case "message":
      return <Message {...p} />;
    case "document":
      return <Document {...p} />;
    case "input_field":
      return <InputField {...p} />;
    case "cursor":
      return <Cursor {...p} />;
    case "metric":
      return <Metric {...p} />;
    case "hero_mark":
      return <HeroMark {...p} />;
    case "asset_wide":
    case "asset_square":
      return <AssetImage {...p} />;
  }
}
