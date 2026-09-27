import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedAction } from "./sync";

const FG = "#f5f7fb";
const ACCENT = "#6d8cff";
const ACCENT_2 = "#a071ff";
const FONT = "Inter, system-ui, sans-serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Splits into user-perceived characters so Bangla conjuncts never break mid-typing.
export const graphemes = (text: string) =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);

type Props = { a: TimedAction; local: number; fps: number; size: number; text: string };

function Typing({ a, local, fps, size, text }: Props) {
  const chars = graphemes(text);
  const typeFor = Math.max(Math.min(a.until - a.at, 2.4) * fps, 1);
  const shown = Math.round(interpolate(local, [0, typeFor], [0, chars.length], clamp));
  const caret = Math.floor(local / (fps * 0.5)) % 2 === 0;
  return (
    <div style={{ fontSize: size * 0.03, lineHeight: 1.35, minHeight: "2.7em", textAlign: "left" }}>
      {chars.slice(0, shown).join("")}
      <span style={{ opacity: caret ? 1 : 0, color: ACCENT }}>|</span>
    </div>
  );
}

function Processing({ a, local, fps, size }: Props) {
  const p = interpolate(local, [0, Math.max((a.until - a.at) * fps, 1)], [0.05, 1], clamp);
  const d = size * 0.06;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.025 }}>
      <svg width={d} height={d} viewBox="0 0 40 40" style={{ transform: `rotate(${local * 12}deg)` }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={ACCENT} strokeWidth="4" strokeDasharray="30 100" strokeLinecap="round" />
      </svg>
      <div style={{ flex: 1, display: "grid", gap: size * 0.012 }}>
        {[0.9, 0.65].map((w, i) => (
          <div
            key={i}
            style={{
              height: size * 0.014,
              width: `${w * 100}%`,
              borderRadius: 99,
              background: `linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,${0.2 + 0.15 * Math.sin(local / 5 + i)}), rgba(255,255,255,.08))`,
            }}
          />
        ))}
        <div style={{ height: size * 0.01, borderRadius: 99, background: "rgba(255,255,255,.1)" }}>
          <div style={{ height: "100%", width: `${p * 100}%`, borderRadius: 99, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})` }} />
        </div>
      </div>
    </div>
  );
}

function Reveal({ local, fps, size }: Props) {
  const s = spring({ frame: local, fps, config: { damping: 12 } });
  const glow = interpolate(local, [0, fps * 0.6], [1, 0.35], clamp);
  return (
    <div
      style={{
        aspectRatio: "16 / 9",
        width: "100%",
        maxHeight: size * 0.22,
        borderRadius: 14,
        transform: `scale(${0.8 + 0.2 * s})`,
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2} 60%, #ff8ad8)`,
        boxShadow: `0 0 ${size * 0.08 * glow}px ${ACCENT_2}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.05} height={size * 0.05} viewBox="0 0 24 24" style={{ opacity: s }}>
        <circle cx="12" cy="12" r="12" fill="rgba(255,255,255,.9)" />
        <path d="M10 8l6 4-6 4z" fill={ACCENT_2} />
      </svg>
    </div>
  );
}

function Highlight({ a, local, fps, size }: Props) {
  const sweep = interpolate(local, [0, fps * 0.8], [-30, 130], clamp);
  return (
    <div
      style={{
        fontSize: size * 0.036,
        fontWeight: 700,
        padding: "0.3em 0.8em",
        borderRadius: 99,
        background: `linear-gradient(100deg, rgba(255,255,255,.06) ${sweep - 20}%, rgba(255,255,255,.35) ${sweep}%, rgba(255,255,255,.06) ${sweep + 20}%), linear-gradient(90deg, ${ACCENT}55, ${ACCENT_2}55)`,
      }}
    >
      {a.trigger}
    </div>
  );
}

function Click({ local, fps, size }: Props) {
  const move = spring({ frame: local, fps, config: { damping: 18 } });
  const press = interpolate(local, [fps * 0.45, fps * 0.55, fps * 0.7], [1, 0.9, 1], clamp);
  const ripple = interpolate(local, [fps * 0.5, fps * 1.1], [0, 1], clamp);
  const b = size * 0.07;
  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center", padding: size * 0.02 }}>
      <div
        style={{
          width: b * 2.4,
          height: b,
          borderRadius: 99,
          transform: `scale(${press})`,
          background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
          boxShadow: `0 0 0 ${ripple * size * 0.03}px rgba(160,113,255,${0.5 * (1 - ripple)})`,
        }}
      />
      <svg
        width={b * 0.6}
        height={b * 0.6}
        viewBox="0 0 24 24"
        style={{ position: "absolute", left: `${70 - 25 * move}%`, top: `${90 - 45 * move}%` }}
      >
        <path d="M4 2l16 9-7 2-3 7z" fill={FG} stroke="#000" strokeWidth="1" />
      </svg>
    </div>
  );
}

function Success({ local, fps, size }: Props) {
  const s = spring({ frame: local, fps, config: { damping: 10 } });
  const draw = interpolate(local, [fps * 0.15, fps * 0.5], [24, 0], clamp);
  const d = size * 0.09;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width={d} height={d} viewBox="0 0 48 48" style={{ transform: `scale(${s})` }}>
        <circle cx="24" cy="24" r="22" fill={`url(#ok)`} />
        <defs>
          <linearGradient id="ok" x1="0" x2="1">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="1" stopColor={ACCENT} />
          </linearGradient>
        </defs>
        <path d="M14 25l7 7 13-15" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray="24" strokeDashoffset={draw} />
      </svg>
    </div>
  );
}

const VIEWS = { typing: Typing, processing: Processing, reveal: Reveal, highlight: Highlight, click: Click, success: Success };

// One glass card in the lower third that changes state as the narration reaches
// each action's trigger. Hidden until the first action starts.
// `center` floats it over a product window like a dialog; `lower` sits above the caption.
export function ActionLayer({
  actions,
  text,
  placement = "lower",
}: {
  actions: TimedAction[];
  text: string;
  placement?: "lower" | "center";
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const current = actions.filter((a) => a.at <= t).at(-1);
  if (!current) return null;
  const size = Math.min(width, height) * (width > height ? 1 : 1.25);
  const local = frame - Math.round(current.at * fps);
  const enterCard = spring({ frame: frame - Math.round(actions[0].at * fps), fps, config: { damping: 16 } });
  const swap = interpolate(local, [0, 8], [0, 1], clamp);
  const View = VIEWS[current.action];
  return (
    <AbsoluteFill
      style={{
        justifyContent: placement === "center" ? "center" : "flex-end",
        alignItems: "center",
        padding: placement === "center" ? `0 0 ${height * 0.23}px` : `0 0 ${height * 0.16}px`,
      }}
    >
      <div
        style={{
          width: width > height ? width * 0.42 : width * 0.8,
          padding: size * 0.028,
          borderRadius: 20,
          color: FG,
          fontFamily: FONT,
          background: "rgba(14,17,26,0.72)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 30px 80px rgba(0,0,0,.45)",
          backdropFilter: "blur(18px)",
          opacity: enterCard,
          transform: `translateY(${(1 - enterCard) * 40}px)`,
        }}
      >
        <div style={{ opacity: swap, transform: `translateY(${(1 - swap) * 10}px)` }}>
          <View a={current} local={local} fps={fps} size={size} text={text} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
