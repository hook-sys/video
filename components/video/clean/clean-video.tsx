import { useState, type CSSProperties } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolateColors, Sequence, staticFile, useCurrentFrame } from "remotion";
import { IN_OUT, mix, OUT, rise } from "./anim";
import { LOOKS, type Look, type Palette } from "./looks";
import { H, Mark, TEMPLATES, W } from "./templates";
import { planSfx, SFX_FILES } from "./sfx";
import type { CleanPlan, CleanVideoProps, Scene, Variant } from "./types";

let fontReady = false;
export function useCleanFont() {
  useState(() => {
    if (fontReady || typeof document === "undefined") return;
    const handle = delayRender("Loading Inter");
    new FontFace("InterClean", `url(${staticFile("fonts/inter-latin-wght.woff2")}) format("woff2")`, { weight: "100 900" })
      .load()
      .then((f) => {
        document.fonts.add(f);
        fontReady = true;
      })
      .finally(() => continueRender(handle));
  });
}

export const IN = 10; // frames a scene takes to come in (from just before its cut)
export const LEAD_IN = 2;
export const OUTF = 6; // and to go (ending on the next cut): one at a time, never both half-seen

// The palette at a frame: each scene's act, blended in over its first frames.
function paletteAt(plan: CleanPlan, look: Look, f: number): Palette {
  const i = Math.max(0, plan.scenes.findLastIndex((s) => s.from <= f));
  const cur = look.acts[plan.scenes[i].act];
  const prev = look.acts[plan.scenes[Math.max(0, i - 1)].act];
  const t = i === 0 ? 1 : rise(f, plan.scenes[i].from, 22, IN_OUT);
  const c = (a: string, b: string) => interpolateColors(t, [0, 1], [a, b]);
  return {
    bg: [c(prev.bg[0], cur.bg[0]), c(prev.bg[1], cur.bg[1])],
    blobs: [c(prev.blobs[0], cur.blobs[0]), c(prev.blobs[1], cur.blobs[1]), c(prev.blobs[2], cur.blobs[2])],
    ink: t < 0.5 ? prev.ink : cur.ink,
    sub: t < 0.5 ? prev.sub : cur.sub,
    dark: t < 0.5 ? prev.dark : cur.dark,
  };
}

// The moving background: the act's gradient turning slowly, three large
// light blobs drifting across, the look's pattern sliding against the camera
// (parallax), dust rising and a sheen sweeping over at every cut.
const SPECKS = Array.from({ length: 28 }, (_, i) => ({ x: (i * 397) % 1920, y: (i * 613) % 1080, r: 2 + (i % 4), s: 0.4 + ((i * 7) % 10) / 12, ph: i * 1.7 }));
function Backdrop({ pal, look, f, pan, cuts }: { pal: Palette; look: Look; f: number; pan: number; cuts: number[] }) {
  const line = pal.dark ? "rgba(255,255,255,0.08)" : "rgba(30,24,80,0.07)";
  const sx = f * 1.1 - pan * 0.35, sy = f * 0.45;
  const pattern: Record<Look["pattern"], CSSProperties> = {
    grid: { backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, backgroundSize: "64px 64px", backgroundPosition: `${sx}px ${sy}px` },
    dots: { backgroundImage: `radial-gradient(${line} 2px, transparent 2.5px)`, backgroundSize: "36px 36px", backgroundPosition: `${sx}px ${sy}px` },
    lines: { backgroundImage: `repeating-linear-gradient(120deg, ${line} 0 1px, transparent 1px 46px)`, backgroundPosition: `${sx}px 0` },
    rings: { backgroundImage: `repeating-radial-gradient(circle at ${50 + Math.sin(f / 90) * 8}% 120%, ${line} 0 1px, transparent 1px 70px)`, backgroundPosition: `${-pan * 0.2}px 0` },
  };
  const cut = cuts.filter((c) => c <= f).pop() ?? -999;
  const sweep = rise(f, cut, 34, IN_OUT);
  return (
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(${150 + Math.sin(f / 80) * 24}deg, ${pal.bg[0]}, ${pal.bg[1]})`, overflow: "hidden" }}>
      {pal.blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 1200,
            height: 1200,
            borderRadius: 9999,
            left: [-260, 1000, 420][i] + Math.sin(f / (62 + i * 17) + i) * 300 - pan * (0.15 + i * 0.08),
            top: [-380, 260, 560][i] + Math.cos(f / (74 + i * 13) + i * 2) * 220,
            background: `radial-gradient(circle, ${b}, transparent 64%)`,
            opacity: pal.dark ? 0.62 : 0.75,
            filter: "blur(36px)",
            transform: `scale(${1 + Math.sin(f / 50 + i) * 0.12})`,
          }}
        />
      ))}
      <AbsoluteFill style={{ ...pattern[look.pattern], maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse at center, #000 30%, transparent 85%)" }} />
      {SPECKS.map((p, i) => {
        const y = ((((p.y - f * p.s * 1.6) % 1140) + 1140) % 1140) - 30;
        return <div key={i} style={{ position: "absolute", left: (((p.x - pan * 0.5 * p.s) % 1920) + 1920) % 1920, top: y, width: p.r * 2, height: p.r * 2, borderRadius: 99, background: pal.dark ? "#ffffff" : look.accent[0], opacity: (0.18 + 0.22 * Math.sin(f / 18 + p.ph)) * (pal.dark ? 0.9 : 0.6) }} />;
      })}
      {sweep > 0 && sweep < 1 && <div style={{ position: "absolute", top: -300, height: 1700, width: 520, left: -700 + sweep * 3400, transform: "rotate(18deg)", backgroundImage: `linear-gradient(90deg, transparent, ${pal.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)"}, transparent)` }} />}
    </AbsoluteFill>
  );
}

// The camera over a scene: one clear move per scene (the variant's kind,
// alternating direction scene by scene), a punch-in on each of the scene's
// moments, a push on a "zoom" cue and a slight hand-held float; then the
// scene's way in and out.
const MOMENTS = ["pay", "rev", "inst", "grow", "team", "name", "click"];
export function cameraOf(sc: Scene, v: Variant, f: number, index: number) {
  const len = Math.max(1, sc.to - sc.from);
  const p = IN_OUT(Math.min(1, Math.max(0, (f - sc.from) / len)));
  const dir = index % 2 ? -1 : 1;
  const punch = MOMENTS.reduce((acc, k) => (sc.cues[k] === undefined ? acc : acc + rise(f, sc.cues[k], 6) * (1 - rise(f, sc.cues[k] + 6, 18))), 0);
  const zoom = sc.cues.zoom !== undefined ? rise(f, sc.cues.zoom, 30, IN_OUT) * 0.06 : 0;
  const fx = Math.sin(f / 37) * 5, fy = Math.cos(f / 53) * 4, fr = Math.sin(f / 71) * 0.2;
  const s = 1 + punch * 0.035 + zoom;
  let pan = 0;
  let cam = "";
  if (v.camera === "push") {
    pan = dir * mix(-40, 40, p);
    cam = `translate(${pan + fx}px, ${mix(14, -10, p) + fy}px) scale(${mix(0.98, 1.06, p) * s}) rotate(${fr}deg)`;
  } else if (v.camera === "tilt") {
    pan = dir * mix(30, -30, p);
    cam = `perspective(1800px) translate(${pan + fx}px, ${fy}px) rotateY(${mix(dir * 18, dir * -5, p)}deg) rotateX(${mix(11, 2, p)}deg) scale(${mix(0.9, 1.0, p) * s})`;
  } else if (v.camera === "drift") {
    pan = dir * mix(60, -60, p);
    cam = `translate(${pan + fx}px, ${mix(20, -20, p) + fy}px) rotate(${dir * mix(-1, 1, p) + fr}deg) scale(${0.98 * s})`;
  } else {
    pan = dir * mix(-24, 24, p);
    cam = `translate(${pan + fx}px, ${fy}px) scale(${mix(0.9, 1.06, p) * s}) rotate(${dir * mix(-0.6, 0.6, p)}deg)`;
  }
  return { cam, pan };
}

function frameStyle(sc: Scene, v: Variant, f: number, index: number, last: boolean): CSSProperties {
  const first = index === 0;
  const ox = "50%";
  const { cam } = cameraOf(sc, v, f, index);
  const kin = first ? 1 : rise(f, sc.from - LEAD_IN, IN, OUT);
  const kout = last ? 0 : rise(f, sc.to - OUTF, OUTF, IN_OUT);
  let t = "";
  let extra: CSSProperties = {};
  if (v.transition === "blur") extra = { opacity: kin * (1 - kout), filter: `blur(${(1 - kin) * 18 + kout * 18}px)` };
  else if (v.transition === "slide") {
    t = `translateX(${(1 - kin) * 220 - kout * 220}px)`;
    extra = { opacity: kin * (1 - kout) };
  } else if (v.transition === "zoom") {
    t = `scale(${mix(1.18, 1, kin) * mix(1, 0.86, kout)})`;
    extra = { opacity: kin * (1 - kout) };
  } else extra = { clipPath: `inset(0 ${(1 - kin) * 100}% 0 ${kout * 100}%)` };
  return { transform: `${t} ${cam}`, transformOrigin: `${ox} 50%`, ...extra };
}

// The voice's words grouped into short captions (2–4 words, broken at stops).
export type CaptionGroup = { start: number; end: number; words: string[] };
export function captionGroups(words: CleanPlan["words"]): CaptionGroup[] {
  const groups: CaptionGroup[] = [];
  let cur: CaptionGroup | null = null;
  for (const w of words) {
    if (/^[.,!?]+$/.test(w.text)) {
      cur = null; // a stop ends the caption
      continue;
    }
    if (!cur || cur.words.length >= 4) groups.push((cur = { start: w.start, end: w.end, words: [] }));
    cur.words.push(w.text);
    cur.end = w.end;
    if (/[.,!?]$/.test(w.text)) cur = null;
  }
  return groups;
}
function captionAt(plan: CleanPlan, f: number) {
  const s = f / 30;
  const g = captionGroups(plan.words).find((x) => s >= x.start - 0.05 && s <= x.end + 0.25);
  if (!g) return null;
  const spoken = plan.words.filter((w) => w.start <= s).length;
  return { g, spoken };
}

export function CleanVideo({ plan, audioUrl }: CleanVideoProps) {
  useCleanFont();
  const f = useCurrentFrame();
  const v = plan.variant;
  const look = LOOKS[v.look];
  const pal = paletteAt(plan, look, f);
  const revealAt = plan.scenes.find((s) => s.template === "reveal")?.cues.name ?? 0;
  const chip = rise(f, revealAt + 40, 20);
  const cap = captionAt(plan, f);
  const inCta = plan.scenes.find((s) => s.template === "cta" && f >= s.from);
  const ci = Math.max(0, plan.scenes.findLastIndex((s) => s.from <= f));
  const pan = cameraOf(plan.scenes[ci], v, f, ci).pan;
  const sfx = planSfx(plan);
  return (
    <AbsoluteFill style={{ fontFamily: look.font, background: "#000" }}>
      <Backdrop pal={pal} look={look} f={f} pan={pan} cuts={plan.scenes.slice(1).map((s) => s.from)} />
      {plan.scenes.map((sc, i) => {
        if (f < sc.from - LEAD_IN || f > sc.to) return null;
        const T = TEMPLATES[sc.template];
        const scPal = look.acts[sc.act];
        return (
          <AbsoluteFill key={i} style={frameStyle(sc, v, f, i, i === plan.scenes.length - 1)}>
            <T f={f} sc={sc} look={look} pal={scPal} v={v} brand={plan.brand} />
          </AbsoluteFill>
        );
      })}
      {/* progress */}
      <div style={{ position: "absolute", left: 0, top: 0, height: 5, width: (f / plan.duration) * W, backgroundImage: `linear-gradient(90deg, ${look.accent[0]}, ${look.accent[1]})` }} />
      {/* the brand chip, once the product has been revealed */}
      {chip > 0 && !inCta && (
        <div style={{ position: "absolute", left: 48, top: 40, display: "flex", alignItems: "center", gap: 14, opacity: chip, color: pal.ink, fontSize: 26, fontWeight: 700 }}>
          <Mark brand={plan.brand} size={44} look={look} />
          {plan.brand.name}
        </div>
      )}
      {cap && !inCta && (
        <div style={{ position: "absolute", left: 0, width: W, top: H - 118, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 30px", borderRadius: 999, background: "rgba(12,12,26,0.86)", color: "#fff", fontSize: 32, fontWeight: 600, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: look.accent[0] }} />
            {cap.g.words.map((w, i) => {
              const idx = plan.words.findIndex((x) => x.start >= cap.g.start - 0.001) + i;
              return <span key={i} style={{ opacity: idx < cap.spoken ? 1 : 0.4 }}>{w}</span>;
            })}
          </div>
        </div>
      )}
      {audioUrl && <Audio src={audioUrl} />}
      {sfx.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={45} layout="none">
          <Audio src={staticFile(SFX_FILES[c.kind])} volume={c.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
