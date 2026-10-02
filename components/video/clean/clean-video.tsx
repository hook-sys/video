import { useState, type CSSProperties } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolateColors, staticFile, useCurrentFrame } from "remotion";
import { IN_OUT, mix, OUT, rise } from "./anim";
import { LOOKS, type Look, type Palette } from "./looks";
import { H, Mark, TEMPLATES, W } from "./templates";
import type { CleanPlan, CleanVideoProps, Scene, Variant } from "./types";

let fontReady = false;
function useCleanFont() {
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

const IN = 14; // frames a scene takes to come in
const OUTF = 10; // and to go

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

// The moving background: the act's gradient, three drifting light blobs and
// the look's pattern sliding slowly.
function Backdrop({ pal, look, f }: { pal: Palette; look: Look; f: number }) {
  const line = pal.dark ? "rgba(255,255,255,0.07)" : "rgba(30,24,80,0.06)";
  const shift = (f * 0.4) % 64;
  const pattern: Record<Look["pattern"], CSSProperties> = {
    grid: { backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, backgroundSize: "64px 64px", backgroundPosition: `${shift}px ${shift}px` },
    dots: { backgroundImage: `radial-gradient(${line} 2px, transparent 2.5px)`, backgroundSize: "36px 36px", backgroundPosition: `${shift}px 0` },
    lines: { backgroundImage: `repeating-linear-gradient(120deg, ${line} 0 1px, transparent 1px 46px)`, backgroundPosition: `${shift}px 0` },
    rings: { backgroundImage: `repeating-radial-gradient(circle at 50% 120%, ${line} 0 1px, transparent 1px 70px)`, backgroundSize: `100% ${100 + Math.sin(f / 60) * 2}%` },
  };
  return (
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(160deg, ${pal.bg[0]}, ${pal.bg[1]})`, overflow: "hidden" }}>
      {pal.blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 1100,
            height: 1100,
            borderRadius: 9999,
            left: [-200, 1100, 500][i] + Math.sin(f / (120 + i * 30) + i) * 160,
            top: [-350, 300, 600][i] + Math.cos(f / (140 + i * 20) + i * 2) * 120,
            background: `radial-gradient(circle, ${b}, transparent 65%)`,
            opacity: pal.dark ? 0.55 : 0.7,
            filter: "blur(40px)",
          }}
        />
      ))}
      <AbsoluteFill style={{ ...pattern[look.pattern], maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse at center, #000 30%, transparent 85%)" }} />
    </AbsoluteFill>
  );
}

// The camera over a scene: a slow move for the whole scene, a push on a
// "zoom" cue, then the scene's way in and out.
function frameStyle(sc: Scene, v: Variant, f: number, first: boolean, last: boolean): CSSProperties {
  const len = sc.to - sc.from;
  const p = Math.min(1, Math.max(0, (f - sc.from) / len));
  const zoomCue = sc.cues.zoom !== undefined ? rise(f, sc.cues.zoom, 30, IN_OUT) * 0.1 : 0;
  const ox = sc.template === "pay" || sc.template === "growth" ? (v.side === "left" ? "72%" : "28%") : "50%";
  let cam = "";
  if (v.camera === "push") cam = `scale(${1 + p * 0.05 + zoomCue}) translateY(${(1 - p) * 10}px)`;
  else if (v.camera === "tilt") {
    const s = rise(f, sc.from, 40, OUT);
    cam = `perspective(2200px) rotateX(${mix(14, 3, s)}deg) rotateY(${mix(v.side === "left" ? -16 : 16, v.side === "left" ? -4 : 4, s)}deg) scale(${mix(0.92, 1, s) + zoomCue})`;
  } else if (v.camera === "drift") cam = `translateX(${mix(-36, 36, p)}px) scale(${1.03 + zoomCue})`;
  else cam = `scale(${mix(0.94, 1.06, p) + zoomCue})`;
  const kin = first ? 1 : rise(f, sc.from, IN, OUT);
  const kout = last ? 0 : rise(f, sc.to - OUTF, OUTF, IN_OUT);
  let t = "";
  let extra: CSSProperties = {};
  if (v.transition === "blur") extra = { opacity: kin * (1 - kout), filter: `blur(${(1 - kin) * 18 + kout * 18}px)` };
  else if (v.transition === "slide") {
    t = `translateX(${(1 - kin) * 160 - kout * 160}px)`;
    extra = { opacity: kin * (1 - kout) };
  } else if (v.transition === "zoom") {
    t = `scale(${mix(1.14, 1, kin) * mix(1, 0.9, kout)})`;
    extra = { opacity: kin * (1 - kout) };
  } else extra = { clipPath: `inset(0 ${(1 - kin) * 100}% 0 ${kout * 100}%)` };
  return { transform: `${t} ${cam}`, transformOrigin: `${ox} 50%`, ...extra };
}

// The voice's words grouped into short captions (2–4 words, broken at stops).
function captionAt(plan: CleanPlan, f: number) {
  const s = f / 30;
  const groups: { start: number; end: number; words: string[] }[] = [];
  let cur: typeof groups[number] | null = null;
  for (const w of plan.words) {
    if (/^[.,!?]+$/.test(w.text)) continue;
    if (!cur || cur.words.length >= 4) groups.push((cur = { start: w.start, end: w.end, words: [] }));
    cur.words.push(w.text);
    cur.end = w.end;
    if (/[.,!?]$/.test(w.text)) cur = null;
  }
  const g = groups.find((x) => s >= x.start - 0.05 && s <= x.end + 0.25);
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
  return (
    <AbsoluteFill style={{ fontFamily: look.font, background: "#000" }}>
      <Backdrop pal={pal} look={look} f={f} />
      {plan.scenes.map((sc, i) => {
        if (f < sc.from || f > sc.to) return null;
        const T = TEMPLATES[sc.template];
        const scPal = look.acts[sc.act];
        return (
          <AbsoluteFill key={i} style={frameStyle(sc, v, f, i === 0, i === plan.scenes.length - 1)}>
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
    </AbsoluteFill>
  );
}
