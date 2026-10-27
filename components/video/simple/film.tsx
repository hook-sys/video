import { useMemo, useState } from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, continueRender, delayRender, spring, staticFile, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { type Face, familyOf, fontUrl } from "./faces";
import { type C, type Play, clamp01, ease, tint } from "./kit";
import { SOUND_FRAMES, T, soundsOf } from "./sounds";
import { TEMPLATE } from "./more";
import { geoOf } from "./geo";
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
        new FontFace(f.family, `url(${staticFile(fontUrl(f))}) format("woff2")`, { weight: f.fixed ? String(f.fixed) : "100 900" })
          .load()
          .then((ff) => {
            document.fonts.add(ff);
            loaded.add(f.family);
          })
          .catch(() => loaded.add(f.family)),
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
        const start = i ? s.from - T / 2 : 0, end = i < n - 1 ? s.to + T / 2 : plan.duration;
        if (f < start || f >= end) return null;
        const pin = i ? ease(clamp01((f - start) / T)) : 1;
        const pout = i < n - 1 ? ease(clamp01((f - (s.to - T / 2)) / T)) : 0;
        // the camera: a slow push and a drift one way, for the whole video — it
        // keeps moving through the way out and into the next scene, never stops
        const p = (f - s.from) / Math.max(1, s.to - s.from);
        const cam = `scale(${(1 + (lively ? 0.07 : 0.045) * p).toFixed(4)}) translateX(${((0.5 - p) * 28).toFixed(1)}px)`;
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
        } else if (pin < 1) clip = `inset(0 ${((1 - pin) * 100).toFixed(2)}% 0 0)`;
        // (on one ground, the scene going out is wiped away where the next comes in)
        else if (pout > 0) clip = `inset(0 0 0 ${(pout * 100).toFixed(2)}%)`;
        const mine = s.ground && s.ground !== theme.ground ? own[s.ground] : null;
        const c: C = { f, s, look: mine ?? look, pace: theme.pace, brand: plan.brand, g, play: PLAY };
        const Body = TEMPLATE[s.template];
        return (
          <AbsoluteFill key={i} data-scene={i} style={{ transform: way || undefined, opacity, clipPath: clip, filter: blur }}>
            {mine && <Ground look={mine} f={f} />}
            <AbsoluteFill style={{ transform: cam }}>
              <Body c={c} />
            </AbsoluteFill>
            {pin < 1 && theme.way === "wipe" && <div style={{ position: "absolute", top: 0, bottom: 0, left: pin * W - 6, width: 12, background: (mine ?? look).accent }} />}
          </AbsoluteFill>
        );
      })}
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
      {plan.sfx !== false && <Sounds plan={plan} webAudio={webAudio} />}
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

