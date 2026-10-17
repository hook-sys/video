import { AbsoluteFill } from "remotion";
import { noise2D } from "@remotion/noise";
import { hsl, hueOf, type Pal } from "../art";
import { H, W } from "../frame";
import { Radial } from "../radial";
import type { Ctx } from "../kit";

// The soft accent field behind a hero: two drifting glows (drawn as SVG, so
// the download matches the Player) and discs on a slow orbit. Always moving.
export function Atmosphere({ c, variant }: { c: Ctx; variant: number }) {
  const hue = hueOf(c.brand.color || "#5b6cff");
  const shift = (variant % 5) * 14 - 28;
  const a = hsl(hue + shift, 76, c.pal.dark ? 58 : 64, 0.95);
  const b = hsl(hue + shift + (variant % 2 ? 40 : -28), 68, c.pal.dark ? 52 : 68, 0.8);
  const drift = (seed: number, amp: number) => noise2D("glow", c.f / 55, seed + variant) * amp;
  const spots = [
    { x: W * 0.16 + drift(1, 36), y: H * 0.24 + drift(2, 28), r: Math.min(W, H) * 0.46, color: a },
    { x: W * 0.84 + drift(3, 32), y: H * 0.74 + drift(4, 24), r: Math.min(W, H) * 0.42, color: b },
    { x: W * 0.52 + drift(5, 20), y: H * 0.12 + drift(6, 16), r: Math.min(W, H) * 0.24, color: a },
  ];
  return (
    <AbsoluteFill>
      {spots.map((s, i) => (
        <Radial key={i} w={s.r * 2} h={s.r * 2} circle stops={[[0, s.color], [0.55, s.color, 0.35], [1, s.color, 0]]} place={{ x: s.x - s.r, y: s.y - s.r }} />
      ))}
      <Orbs f={c.f} variant={variant} pal={c.pal} hue={hue + shift} />
    </AbsoluteFill>
  );
}

function Orbs({ f, variant, pal, hue }: { f: number; variant: number; pal: Pal; hue: number }) {
  const n = 6;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const speed = 70 + i * 11;
        const ang = f / speed + i * 1.05 + variant * 0.4;
        const rx = (W * 0.34) * (0.72 + (i % 3) * 0.16);
        const ry = (H * 0.3) * (0.7 + (i % 2) * 0.22);
        const x = W / 2 + Math.cos(ang) * rx;
        const y = H / 2 + Math.sin(ang * 0.85) * ry;
        const s = 28 + ((i * 23 + variant * 9) % 86);
        const fill = hsl(hue + i * 18, 70, pal.dark ? 62 : 58, pal.dark ? 0.28 : 0.4);
        return <div key={i} style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: s, background: fill, border: `1px solid ${hsl(hue, 40, 96, 0.45)}` }} />;
      })}
    </>
  );
}
