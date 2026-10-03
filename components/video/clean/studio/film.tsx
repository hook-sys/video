import { AbsoluteFill, Html5Audio, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { useCleanFont } from "../clean-video";
import type { CleanPlan } from "../types";
import { beatsFromPlan } from "../refs/beats";
import { BrandCtx, type Enter, float, Shot } from "../refs/common";
import { mix } from "../anim";
import { BLOCK_BY_ID, blocksFor } from "./blocks";
import type { BlockCtx } from "./kit";
import { partCuts } from "./cuts";
import { type Camera, LOOKS, type LookId, type Role, Backdrop } from "./looks";

export { partCuts };

// A studio video: one look and one block per part, on the voice's moments.
export type Recipe = { look: LookId; blocks: Partial<Record<Role, string>>; hue?: number };
export type StudioProps = { plan: CleanPlan; recipe: Recipe; postHue?: number; audioUrl?: string | null; webAudio?: boolean };

const ENTER: Record<LookId, Enter> = { glow: "zoom", dusk: "blur", fly: "push", connect: "rise", ember: "blur", paper: "slide" };
function cam(kind: Camera) {
  return (p: number, f: number) => {
    if (kind === "push") return `${float(f)} scale(${mix(0.97, 1.05, p)})`;
    if (kind === "drift") return `${float(f)} translateX(${mix(50, -50, p)}px) scale(1.01)`;
    if (kind === "tilt") return `${float(f)} rotateY(${mix(-5, 4, p)}deg) rotateX(${mix(4, 1, p)}deg)`;
    return `${float(f)} translateY(${mix(26, -18, p)}px)`;
  };
}

export function StudioFilm({ plan, recipe, postHue = 0, audioUrl, webAudio }: StudioProps) {
  useCleanFont();
  const f = useCurrentFrame();
  const b = beatsFromPlan(plan);
  const look = LOOKS[recipe.look] ?? LOOKS.glow;
  const parts = partCuts(b.t);
  const hue = recipe.hue ?? 0;
  const brand = { name: plan.brand.name, icon: plan.brand.icon, tagline: plan.brand.tagline, cta: plan.brand.cta, url: plan.brand.url, hue: hue + postHue, things: b.trio.map((x) => ({ label: x.label, icon: x.icon })) };
  return (
    <BrandCtx.Provider value={brand}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: "InterClean, system-ui, sans-serif", filter: hue ? `hue-rotate(${hue}deg)` : undefined }}>
        <Backdrop f={f} look={look} parts={parts} />
        {parts.map((p, i) => {
          const to = parts[i + 1]?.from ?? plan.duration;
          const block = BLOCK_BY_ID[recipe.blocks[p.role] ?? ""] ?? blocksFor(p.role)[0];
          if (!block) return null;
          const c: BlockCtx = { f, from: p.from, to, role: p.role, look, pal: look.pal[look.mode(p.role)], b, T: b.t, L: b.line, C: b.content };
          // white panels on a dark field change a lot of light: a longer exit, and a
          // slower entrance where the field turns dark ↔ light
          return (
            <Shot key={p.role} f={f} from={p.from} to={to} last={i === parts.length - 1} enter={i ? ENTER[look.id] : "none"} exit={ENTER[look.id]} inDur={i && look.mode(parts[i - 1].role) !== look.mode(p.role) ? 28 : 18} outDur={c.pal.dark ? 20 : 14} cam={cam(look.camera)}>
              {block.draw(c)}
            </Shot>
          );
        })}
      </AbsoluteFill>
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
    </BrandCtx.Provider>
  );
}
