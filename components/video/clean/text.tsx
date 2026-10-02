import type { CSSProperties } from "react";
import { OUT, rise } from "./anim";
import type { Variant } from "./types";

// One word of a kinetic line: it appears on its own spoken frame.
export type KWord = { t: string; at: number; key?: boolean; strike?: number };

type Style = { size: number; ink: string; accent: [string, string]; keyword: Variant["keyword"]; weight?: number; align?: "left" | "center" };

// A line of words revealed one by one (blur → sharp, a small rise), the
// keyword in the variant's keyword style, struck words crossed out on cue.
export function KLine({ words, f, s, style }: { words: KWord[]; f: number; s: Style; style?: CSSProperties }) {
  const grad = `linear-gradient(100deg, ${s.accent[0]}, ${s.accent[1]})`;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: s.align === "center" ? "center" : "flex-start", columnGap: s.size * 0.24, rowGap: s.size * 0.06, fontSize: s.size, fontWeight: s.weight ?? 700, letterSpacing: "-0.035em", lineHeight: 1.06, color: s.ink, ...style }}>
      {words.map((w, i) => {
        const k = rise(f, w.at, 14);
        const base: CSSProperties = { display: "inline-block", position: "relative", opacity: k, transform: `translateY(${(1 - k) * s.size * 0.28}px)`, filter: `blur(${(1 - k) * 10}px)`, whiteSpace: "nowrap" };
        const sk = w.strike !== undefined ? rise(f, w.strike, 12) : 0;
        const strike = sk > 0 && <span style={{ position: "absolute", left: -4, top: "52%", height: Math.max(4, s.size * 0.07), width: `calc(${sk * 100}% + 8px)`, background: s.accent[1], borderRadius: 99 }} />;
        if (!w.key) return <span key={i} style={{ ...base, opacity: k * (sk ? 0.55 : 1) }}>{w.t}{strike}</span>;
        const m = rise(f, w.at + 6, 16, OUT);
        if (s.keyword === "gradient")
          return <span key={i} style={{ ...base, backgroundImage: grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: "0.08em" }}>{w.t}{strike}</span>;
        if (s.keyword === "pill")
          return (
            <span key={i} style={{ ...base, color: "#fff", padding: `0 ${s.size * 0.22}px`, margin: `0 ${s.size * 0.04}px` }}>
              <span style={{ position: "absolute", inset: `${s.size * 0.02}px 0`, borderRadius: s.size * 0.24, backgroundImage: grad, transform: `scaleX(${0.6 + 0.4 * m})`, boxShadow: `0 ${s.size * 0.12}px ${s.size * 0.4}px ${s.accent[0]}55` }} />
              <span style={{ position: "relative" }}>{w.t}</span>
              {strike}
            </span>
          );
        if (s.keyword === "underline")
          return (
            <span key={i} style={base}>
              {w.t}
              <span style={{ position: "absolute", left: 0, bottom: -s.size * 0.06, height: Math.max(5, s.size * 0.075), width: `${m * 100}%`, backgroundImage: grad, borderRadius: 99 }} />
              {strike}
            </span>
          );
        return (
          <span key={i} style={{ ...base, padding: `0 ${s.size * 0.08}px` }}>
            <span style={{ position: "absolute", left: 0, top: "18%", bottom: "6%", width: `${m * 100}%`, background: `${s.accent[0]}38`, borderRadius: s.size * 0.08 }} />
            <span style={{ position: "relative", color: s.accent[0] }}>{w.t}</span>
            {strike}
          </span>
        );
      })}
    </div>
  );
}
