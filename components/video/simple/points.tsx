import { familyOf } from "./faces";
import { fitWords } from "./fit";
import { HEAD, TYPE, geoOf } from "./geo";
import { type C, Words, clamp01, ease, springAt } from "./kit";
import { toBnDigits } from "./bangla";
import type { Look } from "./theme";
import type { Scene, SimplePlan } from "./types";

// A script told as numbered points (docs/video-spec.md, Points): each point
// opens on a scene of its own — its ordinal as said, its number big, its
// title as said — then a bar holds its number and title at the top for as
// long as it lasts, with a mark for each point (the one we are in longer).

export const numberOf = (n: number) => toBnDigits(String(n).padStart(2, "0"));

// ── the opening: the ordinal, the number, the title ──
export function PointOpen({ c }: { c: C }) {
  const { W, H, pad, u, shape } = c.g;
  const { s, look } = c;
  const p = s.point;
  if (!p) return null;
  const v = s.variant;
  // (the ordinal as said: "প্রথমত")
  const ordinal = (s.said?.[0]?.t ?? "").replace(/[,;:।.]+$/u, "");
  const ordSize = Math.round(TYPE.SUB * u * 0.95);
  const numSize = Math.round(Math.min(shape === "wide" ? H * 0.27 : H * 0.17, W * 0.4));
  const fit = fitWords(s.words.map((w) => w.t), look.display, { width: W - 2 * pad, lines: shape === "wide" ? 2 : 3, max: Math.round(TYPE.HEAD * u * 1.05), min: 48 });
  const titleH = fit.lines.length * fit.size * 1.25;
  const total = ordSize * 1.4 + numSize * 1.1 + titleH + 30;
  const y0 = (H - total) / 2;
  const k = springAt(c, s.from + 2, 0.8);
  const kn = springAt(c, s.from + 6, 0.9);
  const digits = numberOf(p.n);
  const num = {
    fontFamily: familyOf(look.display),
    fontWeight: 800,
    fontSize: numSize,
    lineHeight: 1,
    paddingTop: numSize * 0.12,
    letterSpacing: "-0.02em",
  } as const;
  return (
    <div style={{ position: "absolute", left: pad, top: y0, width: W - 2 * pad, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{ fontFamily: familyOf(look.text), fontWeight: 600, fontSize: ordSize, color: look.sub, height: ordSize * 1.4, opacity: clamp01(k * 1.8), transform: `translateY(${((1 - k) * 16).toFixed(1)}px)`, filter: k < 0.99 ? `blur(${((1 - k) * 10).toFixed(1)}px)` : undefined }}>{ordinal}</div>
      <div style={{ height: numSize * 1.1, display: "flex", alignItems: "center", justifyContent: "center", opacity: clamp01(kn * 1.6), transform: `scale(${(0.7 + 0.3 * kn).toFixed(4)})`, filter: kn < 0.99 ? `blur(${((1 - kn) * 16).toFixed(1)}px)` : undefined }}>
        {v === 1 ? (
          // (in a glossy tile)
          <div style={{ ...num, fontSize: numSize * 0.62, color: look.onAccent, background: look.accentFill, borderRadius: numSize * 0.24, padding: `${numSize * 0.16}px ${numSize * 0.3}px ${numSize * 0.06}px`, boxShadow: `0 ${numSize * 0.1}px ${numSize * 0.3}px ${look.shadow}` }}>{digits}</div>
        ) : v === 2 ? (
          // (an outline)
          <div style={{ ...num, color: "transparent", WebkitTextStroke: `${Math.max(3, numSize * 0.018).toFixed(1)}px ${look.accent}` }}>{digits}</div>
        ) : (
          // (the keyword's colour or gradient)
          <div style={{ ...num, ...(look.keyFill ? { backgroundImage: look.keyFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: look.accent }) }}>{digits}</div>
        )}
      </div>
      <div style={{ marginTop: 30 }}>
        <Words c={c} width={W - 2 * pad} lines={shape === "wide" ? 2 : 3} max={Math.round(TYPE.HEAD * u * 1.05)} min={48} />
      </div>
    </div>
  );
}

// ── the bar at the top, while a point lasts ──
// (the scene shown now and, for the bar's fade, where its point's scenes start and end)
function spanOf(plan: SimplePlan, f: number): { s: Scene; from: number; to: number } | null {
  const i = plan.scenes.findIndex((x) => f >= x.from - 9 && f < x.to + 9 && x.point && x.template !== "point");
  if (i < 0) return null;
  const s = plan.scenes[i];
  const same = plan.scenes.filter((x) => x.point?.n === s.point!.n && x.template !== "point");
  return { s, from: Math.min(...same.map((x) => x.from)), to: Math.max(...same.map((x) => x.to)) };
}
export function PointBar({ plan, f, look }: { plan: SimplePlan; f: number; look: Look }) {
  const at = spanOf(plan, f);
  if (!at?.s.point) return null;
  const p = at.s.point;
  const W = plan.w ?? 1920, H = plan.h ?? 1080;
  const g = geoOf(W, H);
  const head = HEAD[g.shape];
  const t = ease(clamp01((f - at.from + 4) / 12)) * (1 - ease(clamp01((f - (at.to - 6)) / 10)));
  if (t <= 0) return null;
  const pill = g.shape === "wide" ? 44 : g.shape === "square" ? 46 : 60;
  const titleMax = Math.round(pill * 1.05);
  const fit = fitWords(p.title.split(/\s+/), look.display, { width: W - 2 * g.pad - pill * 2.6, lines: 1, max: titleMax, min: Math.round(titleMax * 0.6) });
  const y = g.shape === "tall" ? 130 : g.shape === "square" ? 46 : 36;
  return (
    <div data-part="text" style={{ position: "absolute", left: g.pad, right: g.pad, top: y, height: head - y, display: "flex", flexDirection: "column", alignItems: "center", gap: pill * 0.32, opacity: t, transform: `translateY(${((1 - t) * -24).toFixed(1)}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: pill * 0.36, maxWidth: "100%" }}>
        <div style={{ fontFamily: familyOf(look.display), fontWeight: 800, fontSize: pill * 0.8, lineHeight: 1, color: look.onAccent, background: look.accentFill, borderRadius: 999, padding: `${pill * 0.2}px ${pill * 0.5}px ${pill * 0.08}px`, boxShadow: `0 ${pill * 0.2}px ${pill * 0.5}px ${look.shadow}`, flexShrink: 0 }}>{numberOf(p.n)}</div>
        <div style={{ fontFamily: familyOf(look.display), fontWeight: 700, fontSize: fit.size, color: look.ink, whiteSpace: "nowrap", paddingTop: fit.size * 0.12, lineHeight: 1.1 }}>{p.title}</div>
      </div>
      <div style={{ display: "flex", gap: pill * 0.22 }}>
        {Array.from({ length: p.of }, (_, i) => (
          <div key={i} style={{ width: i + 1 === p.n ? pill * 1.8 : pill * 0.9, height: Math.max(6, pill * 0.18), borderRadius: 99, background: i + 1 <= p.n ? look.accentFill : look.line, opacity: i + 1 <= p.n ? 1 : 0.9, boxShadow: i + 1 > p.n ? `inset 0 0 0 1px ${look.sub}33` : undefined }} />
        ))}
      </div>
    </div>
  );
}
