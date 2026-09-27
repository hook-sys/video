// Shared look for the video layer.
export const BG = "#0b0d12";
export const FG = "#f5f7fb";
export const ACCENT = "#6d8cff";
export const ACCENT_2 = "#a071ff";
export const FONT = "Inter, system-ui, sans-serif";
// AbsoluteFill defaults to 100% width/height; reset so top/bottom insets apply.
export const inset = { width: "auto", height: "auto" } as const;
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const glass = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 30px 80px rgba(0,0,0,.45)",
  backdropFilter: "blur(18px)",
} as const;
