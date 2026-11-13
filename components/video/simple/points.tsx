import { familyOf } from "./faces";
import { fitWords } from "./fit";
import { HEAD, TYPE, geoOf } from "./geo";
import type { CSSProperties } from "react";
import { type C, Words, clamp01, ease, springAt, tint } from "./kit";
import { toBnDigits } from "./bangla";
import type { Look } from "./theme";
import type { Scene, SimplePlan } from "./types";

// A script told as numbered points (docs/video-spec.md, Points): each point
// opens on a scene of its own — its ordinal as said, its number big, its
// title as said — then a bar holds its number and title at the top for as
// long as it lasts, with a mark for each point (the one we are in longer).

export const numberOf = (n: number) => toBnDigits(String(n).padStart(2, "0"));

// the number, other ways (3…9): in a ring drawn round it, huge and faint behind, with a dot for
// each point, between two rules, in a turned square, counting up to it, struck on a bar of the accent
function NumberMore({ c, v, digits, n, size, num }: { c: C; v: number; digits: string; n: number; size: number; num: CSSProperties }) {
  const { look, s, f } = c;
  const t = ease(clamp01((f - s.from - 4) / 18));
  const ink: CSSProperties = look.keyFill ? { backgroundImage: look.keyFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: look.accent };
  if (v === 3) {
    const d = size * 1.25, r = d / 2 - 6, len = 2 * Math.PI * r;
    return (
      <div style={{ position: "relative", width: d, height: d, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={d} height={d} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={look.line} strokeWidth={5} />
          <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={look.accent} strokeWidth={8} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={(len * (1 - t)).toFixed(1)} />
        </svg>
        <div style={{ ...num, fontSize: size * 0.62, ...ink }}>{digits}</div>
      </div>
    );
  }
  if (v === 4) return <div style={{ ...num, fontSize: size * 1.25, color: "transparent", WebkitTextStroke: `${Math.max(2, size * 0.012).toFixed(1)}px ${tint(look.accent, 0.55)}`, transform: `scale(${(1.2 - 0.2 * t).toFixed(4)})` }}>{digits}</div>;
  if (v === 5) {
    const all = Math.max(n, s.point?.of ?? n);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.12 }}>
        <div style={{ ...num, ...ink }}>{digits}</div>
        <div style={{ display: "flex", gap: 14 }}>
          {Array.from({ length: Math.min(8, all) }, (_, i) => <div key={i} style={{ width: i + 1 === n ? 44 : 16, height: 16, borderRadius: 99, background: i + 1 <= n ? look.accentFill : look.line, opacity: clamp01((t * all - i) * 2) }} />)}
        </div>
      </div>
    );
  }
  if (v === 6)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.08 }}>
        <div style={{ width: size * 1.4 * t, height: 4, background: look.accent, borderRadius: 2 }} />
        <div style={{ ...num, fontSize: size * 0.8, color: look.ink }}>{digits}</div>
        <div style={{ width: size * 1.4 * t, height: 4, background: look.accent, borderRadius: 2 }} />
      </div>
    );
  if (v === 7) {
    const d = size * 0.95;
    return (
      <div style={{ width: d, height: d, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: Math.round(d * 0.16 * look.r), background: look.accentFill, transform: `rotate(${(45 * t).toFixed(2)}deg)`, boxShadow: `0 ${d * 0.1}px ${d * 0.3}px ${look.shadow}` }} />
        <div style={{ ...num, position: "relative", fontSize: size * 0.5, color: look.onAccent }}>{digits}</div>
      </div>
    );
  }
  if (v === 8) {
    // (counting up to it, in the type's own digits)
    const shown = Math.min(n, Math.floor(t * (n + 1)));
    return <div style={{ ...num, ...ink }}>{numberOf(Math.max(shown, t > 0.01 ? 1 : 0) || 0)}</div>;
  }
  // 9 · on a bar of the accent sliding in under it
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${size * 0.25}px` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "38%", height: "40%", background: tint(look.accent, look.dark ? 0.35 : 0.22), borderRadius: Math.round(size * 0.08 * look.r), transformOrigin: "left center", transform: `scaleX(${t.toFixed(4)})` }} />
      <div style={{ ...num, position: "relative", color: look.ink }}>{digits}</div>
    </div>
  );
}

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
        {v >= 3 ? (
          <NumberMore c={c} v={v} digits={digits} n={p.n} size={numSize} num={num} />
        ) : v === 1 ? (
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
