import { ramp } from "./eval";
import { FLOW_FONT, type FlowTheme } from "./themes";

// Non-card elements: a big word or number, round / arrow forms, and literal
// pictures of an idea (voice → waveform, scenes → film strip, time → clock).
// Each draws itself in over ~20 frames from its appearance (t = frames since)
// and keeps moving gently afterwards.

const ink = (theme: FlowTheme) => (theme.dark ? "#FFFFFF" : theme.ink);
const grad = (theme: FlowTheme) => `linear-gradient(120deg, ${theme.primary}, ${theme.accent})`;

export function TextObject({ text, w, h, t, theme }: { text: string; w: number; h: number; t: number; theme: FlowTheme }) {
  const size = Math.round(h / 1.25);
  const k = ramp(t, 0, 16, "out");
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span
        key={text}
        style={{
          fontSize: size,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          backgroundImage: grad(theme),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: `drop-shadow(0 ${size * 0.08}px ${size * 0.25}px ${theme.glow}0.35))`,
          transform: `translateY(${(1 - k) * 0.2 * size}px)`,
          opacity: k,
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function ShapeObject({ shape, label, w, h, t, frame, theme }: { shape: string; label?: string; w: number; h: number; t: number; frame: number; theme: FlowTheme }) {
  const draw = ramp(t, 0, 22, "inOut");
  const pulse = 1 + 0.03 * Math.sin(frame / 18);
  const stroke = theme.primary;
  const labelEl = label && (
    <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", textAlign: "center", fontSize: Math.min(44, w * 0.14), fontWeight: 700, color: shape === "orb" || shape === "pill" ? "#fff" : ink(theme), opacity: ramp(t, 10, 12), whiteSpace: "nowrap" }}>
      {label}
    </div>
  );
  if (shape === "orb" || shape === "circle") {
    const orb = shape === "orb";
    return (
      <div style={{ position: "relative", width: w, height: h }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            transform: `scale(${draw * pulse})`,
            background: orb ? `radial-gradient(circle at 32% 28%, #ffffffcc, ${theme.accent} 38%, ${theme.primary} 72%, ${theme.primary2 ?? theme.primary})` : theme.dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.7)",
            border: orb ? undefined : `3px solid ${stroke}`,
            boxShadow: orb ? `0 0 ${w * 0.35}px ${theme.glow}0.55), inset -${w * 0.06}px -${w * 0.08}px ${w * 0.2}px rgba(0,0,0,.25)` : `0 20px 60px ${theme.glow}0.2)`,
          }}
        />
        {labelEl}
      </div>
    );
  }
  if (shape === "ring") {
    const r = w / 2 - 8;
    const c = 2 * Math.PI * r;
    return (
      <div style={{ position: "relative", width: w, height: h }}>
        <svg width={w} height={h} style={{ transform: `rotate(${-90 + frame * 0.6}deg)` }}>
          <circle cx={w / 2} cy={h / 2} r={r} fill="none" stroke={stroke} strokeOpacity={0.18} strokeWidth={10} />
          <circle cx={w / 2} cy={h / 2} r={r} fill="none" stroke={stroke} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c * 0.72 * draw} ${c}`} style={{ filter: `drop-shadow(0 0 12px ${theme.glow}0.6))` }} />
        </svg>
        {labelEl}
      </div>
    );
  }
  if (shape === "pill") {
    return (
      <div style={{ position: "relative", width: w, height: h }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: h, background: grad(theme), clipPath: `inset(0 ${(1 - draw) * 100}% 0 0 round ${h}px)`, boxShadow: `0 20px 50px ${theme.glow}0.4)` }} />
        {labelEl}
      </div>
    );
  }
  if (shape === "plus" || shape === "spark") {
    const s = Math.min(w, h);
    return (
      <svg width={w} height={h} viewBox="-50 -50 100 100" style={{ transform: `scale(${draw}) rotate(${shape === "spark" ? frame * 0.8 : 0}deg)` }}>
        {shape === "plus" ? (
          <path d="M-8 -34h16v26h26v16h-26v26h-16v-26h-26v-16h26z" fill={stroke} />
        ) : (
          <path d="M0 -44 C4 -12 12 -4 44 0 C12 4 4 12 0 44 C-4 12 -12 4 -44 0 C-12 -4 -4 -12 0 -44z" fill={stroke} style={{ filter: `drop-shadow(0 0 ${s * 0.08}px ${theme.glow}0.7))` }} />
        )}
      </svg>
    );
  }
  // Arrows: a line that draws itself, then the head; a dash of light runs along.
  const path = shape === "arrow-down" ? `M${w / 2} 10 L${w / 2} ${h - 34}` : shape === "arrow-curve" ? `M16 ${h - 24} Q${w / 2} -10 ${w - 40} ${h / 2}` : `M14 ${h / 2} L${w - 40} ${h / 2}`;
  const head = shape === "arrow-down" ? `M${w / 2 - 22} ${h - 44} L${w / 2} ${h - 14} L${w / 2 + 22} ${h - 44}` : shape === "arrow-curve" ? `M${w - 64} ${h / 2 - 22} L${w - 34} ${h / 2 + 2} L${w - 66} ${h / 2 + 18}` : `M${w - 58} ${h / 2 - 24} L${w - 26} ${h / 2} L${w - 58} ${h / 2 + 24}`;
  const run = ((frame % 60) / 60) * 100;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        <path d={path} fill="none" stroke={stroke} strokeWidth={9} strokeLinecap="round" pathLength={100} strokeDasharray={`${draw * 100} 100`} />
        <path d={path} fill="none" stroke="#fff" strokeOpacity={0.8 * draw} strokeWidth={4} strokeLinecap="round" pathLength={100} strokeDasharray="8 92" strokeDashoffset={-run} />
        <path d={head} fill="none" stroke={stroke} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={ramp(t, 16, 8)} />
      </svg>
      {label && <div style={{ position: "absolute", left: 0, right: 0, top: -8, textAlign: "center", fontSize: 30, fontWeight: 700, color: ink(theme), opacity: ramp(t, 12, 10) }}>{label}</div>}
    </div>
  );
}

export function VisualObject({ visual, label, w, h, t, frame, theme }: { visual: string; label?: string; w: number; h: number; t: number; frame: number; theme: FlowTheme }) {
  const k = ramp(t, 0, 18, "out");
  const panel: React.CSSProperties = {
    position: "relative",
    width: w,
    height: label ? h - 50 : h,
    borderRadius: 32,
    background: theme.dark ? "linear-gradient(160deg, rgba(255,255,255,.1), rgba(255,255,255,.03))" : "linear-gradient(160deg, rgba(255,255,255,.95), rgba(255,255,255,.7))",
    boxShadow: `0 30px 70px ${theme.glow}0.22), inset 0 0 0 1.5px rgba(255,255,255,${theme.dark ? 0.18 : 0.95})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };
  const ph = label ? h - 50 : h;
  let art: React.ReactNode = null;
  if (visual === "waveform") {
    // A voice: bars that move like speech.
    const n = 28;
    art = (
      <div style={{ display: "flex", alignItems: "center", gap: 7, height: ph * 0.7 }}>
        {Array.from({ length: n }, (_, i) => {
          const amp = 0.25 + 0.75 * Math.abs(Math.sin(frame / 5 + i * 0.7) * Math.sin(frame / 13 + i * 0.3));
          return <div key={i} style={{ width: 9, height: `${Math.max(8, amp * 100 * k)}%`, borderRadius: 6, background: grad(theme) }} />;
        })}
      </div>
    );
  } else if (visual === "filmstrip") {
    // Scenes: frames sliding past, each lighting up in turn.
    const off = (frame * 2) % 132;
    art = (
      <div style={{ position: "absolute", left: -off, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 12 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{ width: 120, height: ph * 0.62, borderRadius: 14, background: i % 3 === 1 ? grad(theme) : theme.dark ? "rgba(255,255,255,.12)" : theme.soft, border: `3px solid ${theme.dark ? "rgba(255,255,255,.2)" : "#fff"}`, opacity: k }} />
        ))}
      </div>
    );
  } else if (visual === "clock") {
    const a = frame * 6;
    art = (
      <svg width={ph * 0.72} height={ph * 0.72} viewBox="-50 -50 100 100">
        <circle r={44} fill="none" stroke={theme.primary} strokeWidth={5} />
        <line x1={0} y1={0} x2={0} y2={-26} stroke={ink(theme)} strokeWidth={6} strokeLinecap="round" transform={`rotate(${a / 12})`} />
        <line x1={0} y1={0} x2={0} y2={-36} stroke={theme.primary} strokeWidth={4} strokeLinecap="round" transform={`rotate(${a})`} />
        <circle r={5} fill={theme.primary} />
      </svg>
    );
  } else if (visual === "progress") {
    const p = Math.min(1, ramp(t, 4, 60, "inOut"));
    const r = 40;
    const c = 2 * Math.PI * r;
    art = (
      <svg width={ph * 0.72} height={ph * 0.72} viewBox="-50 -50 100 100">
        <circle r={r} fill="none" stroke={theme.primary} strokeOpacity={0.15} strokeWidth={9} />
        <circle r={r} fill="none" stroke={theme.primary} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90)" />
        <text y={9} textAnchor="middle" fontSize={24} fontWeight={800} fontFamily={FLOW_FONT} fill={ink(theme)}>{`${Math.round(p * 100)}%`}</text>
      </svg>
    );
  } else if (visual === "download" || visual === "play") {
    const bob = Math.sin(frame / 10) * 6;
    art = (
      <div style={{ width: ph * 0.62, height: ph * 0.62, borderRadius: "50%", background: grad(theme), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${theme.glow}0.5)`, transform: `scale(${k})` }}>
        <svg width="46%" height="46%" viewBox="0 0 24 24" style={{ transform: visual === "download" ? `translateY(${bob}px)` : undefined }}>
          {visual === "download" ? <path d="M12 3v13M6 11l6 6 6-6M5 21h14" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /> : <path d="M8 5v14l11-7z" fill="#fff" />}
        </svg>
      </div>
    );
  } else if (visual === "bars") {
    const hs = [34, 52, 44, 70, 62, 88];
    art = (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: ph * 0.66 }}>
        {hs.map((v, i) => (
          <div key={i} style={{ width: 48, height: `${v * ramp(t, 2 + i * 3, 16, "out")}%`, borderRadius: 10, background: i === hs.length - 1 ? grad(theme) : theme.dark ? "rgba(255,255,255,.22)" : theme.soft }} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: k }}>
      <div style={panel}>{art}</div>
      {label && <div style={{ fontSize: 32, fontWeight: 650, color: ink(theme), whiteSpace: "nowrap" }}>{label}</div>}
    </div>
  );
}
