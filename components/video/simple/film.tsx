import { useMemo, useState } from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, continueRender, delayRender, spring, staticFile, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { type Face, familyOf, fontFiles } from "./faces";
import { type C, type Play, clamp01, ease, tint } from "./kit";
import { SOUND_FRAMES, T, soundsOf } from "./sounds";
import { TEMPLATE } from "./more";
import { BAR, geoFor, geoOf } from "./geo";
import { PointBar } from "./points";
// (the living icons drawn here, never on the server)
import "./living-play";
import { type Look, lookOf, themeOf } from "./theme";
import { type FilmProps, GROUNDS, type SimplePlan } from "./types";

// The simple engine's film: each scene its template, on one ground for the
// whole video (a scene the customer gave its own ground brings it in with it), moving slowly in (the camera never stops, not even between
// scenes), one way between scenes for the whole video, the voice and a sound
// on what happens. No music.

const PLAY: Play = { spring, Img };

const loaded = new Set<string>();
function useFaces(faces: Face[]) {
  const [, setV] = useState(0);
  useState(() => {
    if (typeof document === "undefined") return;
    const todo = faces.filter((f, i) => faces.findIndex((g) => g.family === f.family) === i && !loaded.has(f.family));
    if (!todo.length) return;
    const handle = delayRender("Loading faces");
    Promise.all(
      todo.map((f) =>
        // (a Bangla face: its Bangla file for the Bangla range, its Latin file for the rest, each weight)
        Promise.all(
          fontFiles(f).map((x) =>
            new FontFace(f.family, `url(${staticFile(x.url)}) format("woff2")`, { weight: x.weight, ...(x.range ? { unicodeRange: x.range } : {}) })
              .load()
              .then((ff) => void document.fonts.add(ff))
              .catch(() => undefined),
          ),
        ).then(() => void loaded.add(f.family)),
      ),
    )
      .then(() => setV((v) => v + 1))
      .finally(() => continueRender(handle));
  });
}

// The ground: one for the whole video — its colour and two soft lights that
// drift slowly the whole time — so scenes pass over one space (docs/reference:
// the glow is never flat, never busy, and never jumps at a cut).
function Ground({ look, f }: { look: Look; f: number }) {
  return (
    <>
      <Light look={look} f={f} />
      {look.decor !== "none" && <Decor look={look} f={f} />}
    </>
  );
}

// The look's pattern over the ground, faint and slowly moving (never busy, never a jump at a cut):
// neon a floor grid running to a horizon, editorial a page's rules and margin, bold halftone dots
// fading to the middle, depth big soft blobs of colour drifting
function Decor({ look, f }: { look: Look; f: number }) {
  const ink = look.dark ? "#ffffff" : "#000000";
  if (look.decor === "grid")
    return (
      <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "-50%", right: "-50%", top: "52%", height: "120%", transform: "perspective(700px) rotateX(64deg)", transformOrigin: "50% 0%", backgroundImage: `linear-gradient(${tint(look.accent, 0.35)} 1.5px, transparent 1.5px), linear-gradient(90deg, ${tint(look.accent, 0.35)} 1.5px, transparent 1.5px)`, backgroundSize: "90px 90px", backgroundPosition: `0 ${((f * 1.2) % 90).toFixed(1)}px`, WebkitMaskImage: "linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)", opacity: 0.55 }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "44%", height: "16%", background: `radial-gradient(60% 50% at 50% 60%, ${tint(look.accent, 0.28)}, transparent 75%)` }} />
      </AbsoluteFill>
    );
  if (look.decor === "rules")
    return (
      <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: `linear-gradient(${tint(ink, 0.045)} 1px, transparent 1px)`, backgroundSize: "100% 72px", backgroundPosition: `0 ${(-f * 0.15).toFixed(1)}px` }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "7%", width: 1.5, background: tint(look.accent, 0.35) }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: "7%", width: 1, background: tint(ink, 0.08) }} />
      </AbsoluteFill>
    );
  if (look.decor === "dots")
    return (
      <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: `radial-gradient(${tint(look.ground === "brand" ? "#ffffff" : look.accent, look.ground === "brand" ? 0.16 : 0.2)} 2.6px, transparent 3px)`, backgroundSize: "26px 26px", backgroundPosition: `${(f * 0.2).toFixed(1)}px ${(f * 0.12).toFixed(1)}px`, WebkitMaskImage: "radial-gradient(75% 75% at 50% 50%, transparent 35%, #000 100%)" }} />
    );
  // blobs
  const blob = (cx: number, cy: number, r: number, col: string) => <div style={{ position: "absolute", left: `${cx - r}%`, top: `${cy - r * 1.7}%`, width: `${r * 2}%`, height: `${r * 3.4}%`, borderRadius: "50%", background: `radial-gradient(closest-side, ${col}, transparent)` }} />;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {blob(22 + Math.sin(f / 90) * 8, 28 + Math.cos(f / 110) * 8, 26, tint(look.accent, look.dark ? 0.32 : 0.22))}
      {blob(78 + Math.cos(f / 100) * 8, 70 + Math.sin(f / 130) * 7, 30, tint(look.accent, look.dark ? 0.22 : 0.16))}
      {blob(60 + Math.sin(f / 150) * 10, 18 + Math.cos(f / 95) * 6, 16, tint(look.ink, look.dark ? 0.06 : 0.05))}
    </AbsoluteFill>
  );
}

function Light({ look, f }: { look: Look; f: number }) {
  const x = 32 + Math.sin(f / 170) * 14, y = 30 + Math.cos(f / 210) * 10;
  // (glass: two large soft fields — the brand colour top left, its warm neighbour bottom right — and a haze along the bottom, drifting)
  if (look.fields) {
    const [a, b, haze] = look.fields;
    return (
      <AbsoluteFill style={{ background: look.bg }}>
        <AbsoluteFill style={{ background: `radial-gradient(60% 70% at ${(x - 12).toFixed(1)}% ${(y - 8).toFixed(1)}%, ${a}, transparent 70%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(55% 65% at ${(100 - x + 14).toFixed(1)}% ${(100 - y + 12).toFixed(1)}%, ${b}, transparent 70%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(90% 30% at 50% 108%, ${haze}, transparent 75%)` }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: look.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(1200px 900px at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${look.glow}, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${(100 - x).toFixed(1)}% ${(95 - y).toFixed(1)}%, ${tint(look.accent, look.dark ? 0.07 : 0.05)}, transparent 70%)` }} />
    </AbsoluteFill>
  );
}

export function SimpleFilm({ plan, audioUrl, webAudio }: FilmProps) {
  const f = useCurrentFrame();
  const look = useMemo(() => lookOf(plan.theme, plan.brand.color), [plan.theme, plan.brand.color]);
  // (the looks of the grounds a scene may have of its own)
  const own = useMemo(() => Object.fromEntries(GROUNDS.map((gr) => [gr, lookOf(themeOf(plan.theme, { ground: gr }), plan.brand.color)])), [plan.theme, plan.brand.color]);
  useFaces([look.display, look.text]);
  const { scenes, theme } = plan;
  const n = scenes.length;
  const lively = theme.pace === "lively";
  const g = useMemo(() => geoOf(plan.w ?? 1920, plan.h ?? 1080), [plan.w, plan.h]);
  const W = g.W;
  return (
    <AbsoluteFill style={{ background: look.bg, overflow: "hidden", fontFamily: familyOf(look.text) }}>
      <Ground look={look} f={f} />
      {scenes.map((s, i) => {
        // (a panel that goes on in the next scene: no way out of this one, none into that one — one scene to the eye)
        const goesOn = (k: number) => k > 0 && k < n && !!scenes[k].cont && scenes[k].template === "panel" && scenes[k - 1].template === "panel";
        const contIn = goesOn(i), contOut = goesOn(i + 1);
        const start = contIn ? s.from : i ? s.from - T / 2 : 0, end = contOut ? s.to : i < n - 1 ? s.to + T / 2 : plan.duration;
        if (f < start || f >= end) return null;
        const pin = contIn ? 1 : i ? ease(clamp01((f - start) / T)) : 1;
        const pout = contOut ? 0 : i < n - 1 ? ease(clamp01((f - (s.to - T / 2)) / T)) : 0;
        // the camera: a slow push and a drift one way, for the whole video — it
        // keeps moving through the way out and into the next scene, never stops (over a panel's scenes, as one)
        let c0 = i, c1 = i;
        while (goesOn(c0)) c0--;
        while (goesOn(c1 + 1)) c1++;
        const p = (f - scenes[c0].from) / Math.max(1, scenes[c1].to - scenes[c0].from);
        // (depth: the camera also turns a little in 3D, slowly, as if round the cards)
        const turn = look.style === "depth" ? ` perspective(2600px) rotateY(${(Math.sin(f / 140) * 2.6).toFixed(3)}deg) rotateX(${(Math.cos(f / 170) * 1.6).toFixed(3)}deg)` : "";
        const cam = `scale(${(1 + (lively ? 0.07 : 0.045) * p).toFixed(4)}) translateX(${((0.5 - p) * 28).toFixed(1)}px)${turn}`;
        let way = "";
        let opacity = 1;
        let clip: string | undefined;
        let blur: string | undefined;
        if (theme.way === "slide") way = `translateX(${((1 - pin) * W - pout * W).toFixed(1)}px)`;
        else if (theme.way === "zoom") {
          way = `scale(${(pin < 1 ? 0.82 + 0.18 * pin : 1 + 0.6 * pout).toFixed(4)})`;
          // (through, never dipping to the bare ground: the scene going out stays until what comes in —
          // in from the cut on — is there; the two together only for a moment)
          opacity = pin < 1 ? clamp01(pin * 2.2 - 0.5) : clamp01((0.85 - pout) * 4);
        } else if (theme.way === "blur") {
          // (out into a blur as the next comes in from one — together, never the bare ground for long)
          const t = pin < 1 ? 1 - pin : pout;
          opacity = pin < 1 ? clamp01(pin * 1.7) : clamp01((1 - pout) * 1.7);
          if (t > 0.002) blur = `blur(${(t * 16).toFixed(2)}px)`;
          way = `scale(${(pin < 1 ? 1.03 - 0.03 * pin : 1 - 0.03 * pout).toFixed(4)})`;
        } else if (theme.way === "leak") {
          // (a dissolve under a sweep of warm light: never the bare ground — the scene going out stays until what comes in is there)
          opacity = pin < 1 ? clamp01(pin * 1.8) : clamp01((1 - pout) * 1.8);
          way = `scale(${(pin < 1 ? 1.02 - 0.02 * pin : 1 + 0.02 * pout).toFixed(4)})`;
        } else if (theme.way === "push") {
          // (the next comes up from below, the one going out goes up and away; both streaked while they move)
          const t = pin < 1 ? 1 - pin : pout;
          way = pin < 1 ? `translateY(${((1 - pin) * g.H * 0.55).toFixed(1)}px)` : `translateY(${(-pout * g.H * 0.3).toFixed(1)}px) scale(${(1 - 0.05 * pout).toFixed(4)})`;
          opacity = pin < 1 ? clamp01(pin * 2) : clamp01((1 - pout) * 2.2);
          if (t > 0.002) blur = `blur(${(Math.sin(Math.PI * t) * 9).toFixed(2)}px)`;
        } else if (theme.way === "tilt") {
          // (the scene turns away in depth as the next turns in from the other side)
          way = pin < 1 ? `perspective(1800px) translateX(${((1 - pin) * W * 0.3).toFixed(1)}px) rotateY(${(-(1 - pin) * 32).toFixed(2)}deg)` : `perspective(1800px) translateX(${(-pout * W * 0.3).toFixed(1)}px) rotateY(${(pout * 32).toFixed(2)}deg)`;
          opacity = pin < 1 ? clamp01(pin * 2) : clamp01((1 - pout) * 2);
        } else if (pin < 1) clip = `inset(0 ${((1 - pin) * 100).toFixed(2)}% 0 0)`;
        // (on one ground, the scene going out is wiped away where the next comes in)
        else if (pout > 0) clip = `inset(0 0 0 ${(pout * 100).toFixed(2)}%)`;
        const mine = s.ground && s.ground !== theme.ground ? own[s.ground] : null;
        // (inside a point: laid out below its bar)
        const at = geoFor(g.W, g.H, s);
        const c: C = { f, s, look: mine ?? look, pace: theme.pace, brand: plan.brand, g: at.g, play: PLAY };
        const Body = TEMPLATE[s.template];
        return (
          <AbsoluteFill key={i} data-scene={i} style={{ transform: way || undefined, opacity, clipPath: clip, filter: blur }}>
            {mine && <Ground look={mine} f={f} />}
            <AbsoluteFill style={{ transform: cam }}>
              {at.top ? (
                <div style={{ position: "absolute", left: 0, top: at.top, width: at.g.W, height: at.g.H }}>
                  <Body c={c} />
                </div>
              ) : (
                <Body c={c} />
              )}
            </AbsoluteFill>
            {pin < 1 && theme.way === "wipe" && <div style={{ position: "absolute", top: 0, bottom: 0, left: pin * W - 6, width: 12, background: (mine ?? look).accent }} />}
            {pin < 1 && theme.way === "leak" && <Leak look={mine ?? look} t={pin} />}
          </AbsoluteFill>
        );
      })}
      {BAR && <PointBar plan={plan} f={f} look={look} />}
      {plan.watermark && <Watermark W={g.W} H={g.H} />}
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
      {plan.sfx !== false && <Sounds plan={plan} webAudio={webAudio} />}
    </AbsoluteFill>
  );
}

// A warm light leak sweeping across a cut: brightest halfway, a band of light and the brand colour
function Leak({ look, t }: { look: Look; t: number }) {
  const a = Math.sin(Math.PI * t);
  const x = -40 + t * 140;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: look.dark ? "screen" : "soft-light", opacity: a }}>
      <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${x - 30}%, rgba(255,214,170,0.75) ${x - 8}%, rgba(255,250,240,0.95) ${x}%, ${tint(look.accent, 0.6)} ${x + 12}%, transparent ${x + 34}%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(50% 70% at ${x}% 40%, rgba(255,236,210,0.5), transparent 70%)` }} />
    </AbsoluteFill>
  );
}

function Sounds({ plan, webAudio }: { plan: SimplePlan; webAudio?: boolean }) {
  return (
    <>
      {soundsOf(plan).map((e, i) => (
        <Sequence key={i} from={e.at} durationInFrames={Math.max(1, Math.min(SOUND_FRAMES[e.name] ?? 30, plan.duration - e.at))} layout="none">
          {webAudio ? <MediaAudio src={staticFile(`/sfx/${e.name}.mp3`)} volume={e.volume} /> : <Html5Audio src={staticFile(`/sfx/${e.name}.mp3`)} volume={e.volume} />}
        </Sequence>
      ))}
    </>
  );
}


// A free trial video's mark: "Made with MotionDots" in the lower right, all the
// way through — the dots logo and the name on a dark glass pill, clear on any look.
function Watermark({ W, H }: { W: number; H: number }) {
  const u = Math.min(W, H) / 1080;
  const size = 34 * u;
  return (
    <div style={{ position: "absolute", right: 28 * u, bottom: 28 * u, display: "flex", alignItems: "center", gap: 12 * u, padding: `${10 * u}px ${20 * u}px ${10 * u}px ${10 * u}px`, borderRadius: 999, background: "rgba(12,11,20,0.62)", boxShadow: `0 ${6 * u}px ${24 * u}px rgba(0,0,0,0.35), inset 0 0 0 ${1.5 * u}px rgba(255,255,255,0.14)`, color: "#fff", fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif", fontSize: 22 * u, fontWeight: 600, letterSpacing: "-0.01em", opacity: 0.92, zIndex: 50, pointerEvents: "none" }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <defs>
          <linearGradient id="md-wm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5B5BF6" />
            <stop offset="0.55" stopColor="#A445F2" />
            <stop offset="1" stopColor="#FF5C9D" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#md-wm)" />
        <circle cx="17" cy="44" r="4.5" fill="#fff" fillOpacity="0.55" />
        <circle cx="30" cy="34.5" r="6.2" fill="#fff" fillOpacity="0.8" />
        <circle cx="45.5" cy="22.5" r="8.8" fill="#fff" />
      </svg>
      <span>
        Made with <b style={{ fontWeight: 800 }}>MotionDots</b>
      </span>
    </div>
  );
}
