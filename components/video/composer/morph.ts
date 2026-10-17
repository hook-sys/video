import { getLength, getPointAtLength, getSubpaths } from "@remotion/paths";
import { iconPath } from "../icons";

// One icon becoming another ("New version": a scene's icon morphs into the
// next scene's hero icon). Every icon is one 24×24 line path; each is cut
// into its strokes, the strokes sampled into the same number of points
// (longest stroke to longest, the missing ones growing from a point), and
// the points moved from one icon to the other — the way flubber does it.

const POINTS = 24;
type Stroke = [number, number][];
const cache = new Map<string, Stroke[] | null>();

function strokesOf(name: string): Stroke[] | null {
  if (cache.has(name)) return cache.get(name)!;
  const d = iconPath(name);
  let out: Stroke[] | null = null;
  try {
    if (d)
      out = getSubpaths(d)
        .map((s) => ({ s, L: getLength(s) }))
        .filter((x) => x.L > 0.01)
        .sort((a, b) => b.L - a.L)
        .map(({ s, L }) =>
          Array.from({ length: POINTS }, (_, k): [number, number] => {
            const p = getPointAtLength(s, Math.min(L * 0.9999, (L * k) / (POINTS - 1))) ?? { x: 12, y: 12 };
            return [p.x, p.y];
          }),
        );
  } catch {
    out = null;
  }
  if (out && !out.length) out = null;
  cache.set(name, out);
  return out;
}

// a stroke that is not there: all its points where its partner starts
const point = (s: Stroke): Stroke => s.map(() => [...s[0]] as [number, number]);

// The path between icon a (t = 0) and icon b (t = 1); null when either
// cannot be read (the two then simply cross-fade).
export function morphPath(a: string, b: string, t: number): string | null {
  const A = strokesOf(a), B = strokesOf(b);
  if (!A || !B) return null;
  const n = Math.max(A.length, B.length);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const sa = A[i] ?? point(B[i]), sb = B[i] ?? point(A[i]);
    parts.push(sa.map(([x, y], k) => `${k ? "L" : "M"}${(x + (sb[k][0] - x) * t).toFixed(2)} ${(y + (sb[k][1] - y) * t).toFixed(2)}`).join(" "));
  }
  return parts.join(" ");
}
