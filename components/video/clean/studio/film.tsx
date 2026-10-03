import type { CSSProperties } from "react";
import { AbsoluteFill, Html5Audio, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { useCleanFont } from "../clean-video";
import type { CleanPlan } from "../types";
import { beatsFromPlan } from "../refs/beats";
import { BrandCtx, type Enter, float, Shot } from "../refs/common";
import { IN_OUT, mix, rise } from "../anim";
import { BLOCK_BY_ID, blocksFor } from "./blocks";
import type { Block, BlockCtx, Box } from "./kit";
import { partCuts } from "./cuts";
import { type Camera, LOOKS, type LookId, type Pal, type Role, Backdrop } from "./looks";

export { partCuts };

// A studio video: one look and one block per part, on the voice's moments.
export type Recipe = { look: LookId; blocks: Partial<Record<Role, string>>; hue?: number };
// `bare`: the background alone (checks measure what stands on it).
export type StudioProps = { plan: CleanPlan; recipe: Recipe; postHue?: number; audioUrl?: string | null; webAudio?: boolean; bare?: boolean };

const ENTER: Record<LookId, Enter> = { glow: "zoom", dusk: "blur", fly: "push", connect: "rise", ember: "blur", paper: "slide", pastel: "blur", warm: "blur", violet: "zoom", azure: "push", night: "push", line: "slide", crimson: "blur" };
function cam(kind: Camera) {
  return (p: number, f: number) => {
    if (kind === "push") return `${float(f)} scale(${mix(0.97, 1.05, p)})`;
    if (kind === "drift") return `${float(f)} translateX(${mix(50, -50, p)}px) scale(1.01)`;
    if (kind === "tilt") return `${float(f)} rotateY(${mix(-5, 4, p)}deg) rotateX(${mix(4, 1, p)}deg)`;
    return `${float(f)} translateY(${mix(26, -18, p)}px)`;
  };
}

// The stand-in for an object while it becomes the next part's object.
function fillOf(box: Box, pal: Pal): CSSProperties {
  if (box.fill === "accent") return { background: `linear-gradient(140deg, ${pal.panelAccent ?? pal.accent}, ${pal.panelAccent ? "#8b78ff" : pal.accent2})`, boxShadow: `0 24px 60px ${pal.panelAccent ?? pal.accent}55` };
  if (box.fill === "glass") return { background: pal.dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.62)", border: `1.5px solid ${pal.dark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.95)"}`, boxShadow: pal.dark ? "0 30px 80px rgba(0,0,0,0.35)" : "0 30px 80px rgba(60,70,140,0.14)" };
  if (box.fill === "white") return { background: "#f6f8ff", boxShadow: "0 40px 100px rgba(0,0,0,0.35)" };
  if (box.fill === "dark") return { background: "#111318", boxShadow: "0 60px 140px rgba(20,30,80,0.30)" };
  return { background: pal.panel, boxShadow: pal.dark ? "0 50px 120px rgba(0,0,0,0.45)" : "0 40px 100px rgba(40,40,110,0.16)" };
}
function Morph({ f, at: t, a, z, pa, pz }: { f: number; at: number; a: Box; z: Box; pa: Pal; pz: Pal }) {
  // it holds on the new object while the field opens out of it (t + 12)
  // under both parts' content: it stands in for the object only while the
  // one has gone and the other is still coming, never over either
  const show = rise(f, t - 10, 4) * (1 - rise(f, t + 10, 8));
  if (show <= 0) return null;
  const m = rise(f, t - 8, 16, IN_OUT);
  const x = mix(a.x, z.x, m), y = mix(a.y, z.y, m), w = mix(a.w, z.w, m), h = mix(a.h, z.h, m), r = mix(a.r, z.r, m);
  const geo: CSSProperties = { position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: r };
  return (
    <AbsoluteFill style={{ opacity: show }}>
      <div style={{ ...geo, ...fillOf(a, pa), opacity: 1 - m }} />
      <div style={{ ...geo, ...fillOf(z, pz), opacity: m }} />
    </AbsoluteFill>
  );
}

export function StudioFilm({ plan, recipe, postHue = 0, audioUrl, webAudio, bare }: StudioProps) {
  useCleanFont();
  const f = useCurrentFrame();
  const b = beatsFromPlan(plan);
  const look = LOOKS[recipe.look] ?? LOOKS.glow;
  const parts = partCuts(b.t);
  const hue = recipe.hue ?? 0;
  const shots = parts.map((p, i) => {
    const block: Block | undefined = BLOCK_BY_ID[recipe.blocks[p.role] ?? ""] ?? blocksFor(p.role)[0];
    const to = parts[i + 1]?.from ?? plan.duration;
    const c: BlockCtx = { f, from: p.from, to, role: p.role, look, pal: look.pal[look.mode(p.role)], b, T: b.t, L: b.line, C: b.content };
    return { block, c, obj: block?.obj?.(c) ?? {} };
  });
  // a cut where the field turns dark ↔ light: the last part has gone before
  // the new field opens (its words would vanish on the new colour)
  const flips = (j: number) => j > 0 && j < parts.length && look.mode(parts[j - 1].role) !== look.mode(parts[j].role);
  // where the last part's object (z) becomes this part's (a)
  const hands = shots.map((s, i) => (i && shots[i - 1].obj.z && s.obj.a ? { a: shots[i - 1].obj.z as Box, z: s.obj.a } : null));
  const brand = { name: plan.brand.name, icon: plan.brand.icon, tagline: plan.brand.tagline, cta: plan.brand.cta, url: plan.brand.url, hue: hue + postHue, things: b.trio.map((x) => ({ label: x.label, icon: x.icon })) };
  return (
    <BrandCtx.Provider value={brand}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: "InterClean, system-ui, sans-serif", filter: hue ? `hue-rotate(${hue}deg)` : undefined }}>
        <Backdrop f={f} look={look} parts={parts} origins={hands.map((h) => (h ? { x: h.z.x, y: h.z.y, w: h.z.w, h: h.z.h, r: h.z.r } : null))} />
        {!bare && hands.map((h, i) => h && <Morph key={i} f={f} at={parts[i].from} a={h.a} z={h.z} pa={shots[i - 1].c.pal} pz={shots[i].c.pal} />)}
        {parts.map((p, i) => {
          const { block, c } = shots[i];
          if (!block || bare) return null;
          // an object that becomes the next one: the words fade around it
          const inHand = !!hands[i];
          const outHand = !!hands[i + 1];
          // white panels on a dark field change a lot of light: a longer exit, and a
          // slower entrance where the field turns dark ↔ light; every part
          // leaves after the next has begun to come in (no empty frame)
          return (
            <Shot key={p.role} f={f} from={p.from} to={c.to} last={i === parts.length - 1} enter={!i ? "none" : inHand ? "fade" : ENTER[look.id]} exit={outHand ? "fade" : ENTER[look.id]} inDur={inHand ? 14 : i && look.mode(parts[i - 1].role) !== look.mode(p.role) ? 28 : 18} outDur={outHand ? 12 : flips(i + 1) ? (c.pal.dark ? 17 : 12) : c.pal.dark || c.pal.panelDark ? 20 : 14} tail={outHand ? 4 : flips(i + 1) ? 4 : 10} cam={cam(look.camera)}>
              {block.draw(c)}
            </Shot>
          );
        })}
      </AbsoluteFill>
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
    </BrandCtx.Provider>
  );
}
