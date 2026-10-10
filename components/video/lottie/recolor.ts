// Our Lottie files are authored in a fixed default palette (scripts/lottie/lib.mjs).
// recolorLottie maps any of those role colours to the video's theme colours.

export const LOTTIE_PALETTE = {
  primary: "#5B4FF5",
  accent: "#19C6B0",
  ink: "#1B1D2A",
  soft: "#E4E1FF",
  white: "#FFFFFF",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
  gold: "#FBBF24",
} as const;
export type LottieRole = keyof typeof LOTTIE_PALETTE;
export type LottieColors = Partial<Record<LottieRole, string>>;

const rgb = (hex: string) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const same = (a: number[], b: number[]) => a.length >= 3 && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < 0.003);

// Returns a recoloured deep copy (the input is never mutated).
export function recolorLottie<T>(data: T, colors: LottieColors | undefined): T {
  const pairs = Object.entries(colors ?? {}).flatMap(([role, hex]) =>
    hex && role in LOTTIE_PALETTE ? [[rgb(LOTTIE_PALETTE[role as LottieRole]), rgb(hex)] as const] : [],
  );
  const copy = JSON.parse(JSON.stringify(data));
  if (!pairs.length) return copy;
  const swap = (v: number[]) => {
    const hit = pairs.find(([from]) => same(v, from));
    return hit ? [...hit[1].map((n) => Math.round(n * 1000) / 1000), ...v.slice(3)] : v;
  };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    // Colour properties: {c: {a: 0, k: [r,g,b,a]}} or keyframed {k: [{s: [r,g,b,a]}…]}.
    const c = o.c as { a?: number; k?: unknown } | undefined;
    if ((o.ty === "fl" || o.ty === "st") && c && Array.isArray(c.k)) {
      if (c.a) for (const f of c.k as { s?: number[] }[]) f.s = f.s && swap(f.s);
      else c.k = swap(c.k as number[]);
    }
    Object.values(o).forEach(walk);
  };
  walk(copy);
  return copy;
}
