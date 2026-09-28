import { Img } from "remotion";
import { Icon } from "@/components/video/icons";
import { clamp01, num, ramp, vec } from "./eval";
import type { FlowTheme } from "./themes";
import type { FlowNode, Track, Vec3 } from "./types";

// A product UI as a plane in 3D space (the references' signature shot): a
// screenshot or a procedural mock, tilted by keyframes. Callouts, lifted rows
// and the cursor live in the plane's 3D space, so they tilt with it and float
// above it in depth.

function tiltAt(track: Track<Vec3>, frame: number): Vec3 {
  return [0, 1, 2].map((i) => num(track.map(([t, v, e]) => [t, v[i], e]), frame, 0)) as Vec3;
}

export function UiPlane({ node, frame, theme, scale, opacity }: { node: FlowNode; frame: number; theme: FlowTheme; scale: number; opacity: number }) {
  const ui = node.ui!;
  const [rx, ry, rz] = tiltAt(ui.tilt, frame);
  const { w, h } = ui;
  const dark = theme.dark;
  const panel = dark ? "#1B1D25" : "#FFFFFF";
  const line = dark ? "rgba(255,255,255,.07)" : "rgba(30,27,75,.07)";
  const header = 64;
  const side = 84;
  const rowH = 76;
  const rows = ui.rows ?? [];
  const lifted = (i: number) => {
    const l = ui.lifts?.find((x) => x.row === i && frame >= x.start && (x.end === undefined || frame < x.end + 16));
    if (!l) return 0;
    return ramp(frame, l.start, 16, "back") * (1 - (l.end !== undefined ? ramp(frame, l.end, 16, "inOut") : 0));
  };
  const cur = ui.cursor ? vec(ui.cursor.path, frame) : null;
  const click = ui.cursor?.clicks.reduce((k, c) => Math.max(k, frame >= c && frame < c + 24 ? 1 - (frame - c) / 24 : 0), 0) ?? 0;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, opacity, perspective: 2600, transform: `scale(${scale})` }}>
      <div style={{ position: "absolute", left: -w / 2, top: -h / 2, width: w, height: h, transformStyle: "preserve-3d", transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}>
        {/* soft contact shadow under the plane */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 28, transform: "translateZ(-40px)", background: dark ? "rgba(0,0,0,.55)" : `${theme.glow}0.28)`, filter: "blur(40px)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 28, overflow: "hidden", background: panel, boxShadow: dark ? "inset 0 0 0 1px rgba(255,255,255,.08)" : "inset 0 0 0 1px rgba(91,79,245,.10)" }}>
          {ui.src ? (
            <Img src={ui.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <>
              <div style={{ position: "absolute", left: 0, top: 0, width: side, bottom: 0, background: dark ? "rgba(255,255,255,.03)" : "#F7F6FF", borderRight: `1px solid ${line}` }}>
                {["layout-dashboard", "wallet", "users", "chart-line", "settings"].map((ic, i) => (
                  <div key={ic} style={{ position: "absolute", left: 20, top: 90 + i * 64, width: 44, height: 44, borderRadius: 12, background: i === 0 ? theme.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={ic} size={24} color={i === 0 ? "#fff" : theme.sub} />
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", left: side, right: 0, top: 0, height: header, display: "flex", alignItems: "center", padding: "0 32px", borderBottom: `1px solid ${line}`, fontSize: 26, fontWeight: 700, color: theme.ink, letterSpacing: -0.4 }}>
                {ui.title}
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: line }} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {!ui.src &&
          rows.map((r, i) => {
            const lift = lifted(i);
            const appear = ramp(frame, i * 3, 14, "out");
            return (
              <div key={i} style={{ position: "absolute", left: side + 24, right: 24, top: header + 22 + i * (rowH + 12), height: rowH, borderRadius: 16, background: lift > 0.01 ? panel : dark ? "rgba(255,255,255,.035)" : "#FBFAFF", boxShadow: lift > 0.01 ? `0 ${30 * lift}px ${70 * lift}px ${dark ? "rgba(0,0,0,.6)" : `${theme.glow}0.35)`}, 0 0 0 ${2 * lift}px ${theme.primary}` : "none", transform: `translateZ(${lift * 110}px) scale(${1 + lift * 0.04})`, opacity: appear, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", fontSize: 23, color: theme.ink }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: dark ? "rgba(255,255,255,.06)" : "#EFEDFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={r.icon} size={22} color={theme.primary} />
                </div>
                <div style={{ fontWeight: 600, letterSpacing: -0.2 }}>{r.text}</div>
                {r.value && <div style={{ marginLeft: "auto", fontWeight: 700 }}>{r.value}</div>}
                {r.status && (
                  <div style={{ marginLeft: r.value ? 12 : "auto", padding: "6px 14px", borderRadius: 14, fontSize: 17, fontWeight: 650, color: theme.success, background: dark ? "rgba(43,196,180,.12)" : "rgba(34,197,94,.12)" }}>{r.status}</div>
                )}
              </div>
            );
          })}
        {(ui.callouts ?? []).map((c, i) => {
          const k = ramp(frame, c.start, 18, "back");
          if (k <= 0) return null;
          const [x, y] = [c.at[0] * w, c.at[1] * h];
          const dx = c.side === "right" ? 150 : -150;
          const lineK = clamp01((frame - c.start) / 10);
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, transformStyle: "preserve-3d" }}>
              <div style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: 9, background: theme.primary, boxShadow: `0 0 0 6px ${theme.glow}0.2)`, transform: `translateZ(2px) scale(${k})` }} />
              <div style={{ position: "absolute", left: c.side === "right" ? 0 : dx * lineK, top: -1.5, width: Math.abs(dx) * lineK, height: 3, background: theme.primary, transform: "translateZ(60px)" }} />
              <div style={{ position: "absolute", left: dx, top: 0, transform: `translate(${c.side === "right" ? "0" : "-100%"}, -50%) translateZ(90px) scale(${k})`, transformOrigin: c.side === "right" ? "left center" : "right center", display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap", padding: "14px 22px", borderRadius: 18, background: dark ? "#262936" : "#fff", boxShadow: `0 24px 50px ${dark ? "rgba(0,0,0,.5)" : `${theme.glow}0.25)`}`, fontSize: 26, fontWeight: 700, color: theme.ink, letterSpacing: -0.3 }}>
                {c.icon && <Icon name={c.icon} size={28} color={theme.primary} strokeWidth={2.2} />}
                {c.text}
              </div>
            </div>
          );
        })}
        {cur && (
          <div style={{ position: "absolute", left: cur[0] * w, top: cur[1] * h, transform: "translateZ(140px)" }}>
            {click > 0 && <div style={{ position: "absolute", left: -40 * (2 - click), top: -40 * (2 - click), width: 80 * (2 - click), height: 80 * (2 - click), borderRadius: "50%", border: `4px solid ${theme.primary}`, opacity: click }} />}
            <div style={{ position: "absolute", left: -6, top: -4, transform: `scale(${1 - click * 0.15})`, filter: "drop-shadow(0 8px 12px rgba(0,0,0,.3))" }}>
              <svg width={46} height={46} viewBox="0 0 24 24">
                <path d="M4 3l7.5 17 2.2-6.8L20.5 11z" fill={dark ? "#fff" : "#1E1B4B"} stroke={dark ? "#1E1B4B" : "#fff"} strokeWidth={1.4} strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
