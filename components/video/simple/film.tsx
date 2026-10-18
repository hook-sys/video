import { useMemo, useState } from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, continueRender, delayRender, spring, staticFile, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { type Face, familyOf, fontUrl } from "./faces";
import { type C, type Play, clamp01, ease, tint } from "./kit";
import { TEMPLATE, clickOf } from "./more";
import { geoOf } from "./geo";
import { type Look, lookOf } from "./theme";
import type { FilmProps, Scene, SimplePlan } from "./types";

// The simple engine's film: each scene its template on its own ground,
// moving slowly in (the camera never stops), one way between scenes for the
// whole video, the voice and a sound on what happens.

// frames a way between scenes takes (half before the cut, half after)
const T = 18;
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

// a scene's ground: its colour and a soft light that drifts (each scene's in its own place)
function Ground({ look, f, i }: { look: Look; f: number; i: number }) {
  const x = 30 + ((i * 37) % 45) + Math.sin(f / 150 + i) * 6, y = 25 + ((i * 23) % 40) + Math.cos(f / 170 + i) * 5;
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
  useFaces([look.display, look.text]);
  const { scenes, theme } = plan;
  const n = scenes.length;
  const lively = theme.pace === "lively";
  const g = useMemo(() => geoOf(plan.w ?? 1920, plan.h ?? 1080), [plan.w, plan.h]);
  const W = g.W;
  return (
    <AbsoluteFill style={{ background: look.bg, overflow: "hidden", fontFamily: familyOf(look.text) }}>
      {scenes.map((s, i) => {
        const start = i ? s.from - T / 2 : 0, end = i < n - 1 ? s.to + T / 2 : plan.duration;
        if (f < start || f >= end) return null;
        const pin = i ? ease(clamp01((f - start) / T)) : 1;
        const pout = i < n - 1 ? ease(clamp01((f - (s.to - T / 2)) / T)) : 0;
        // the camera: a slow push and drift through the scene
        const p = clamp01((f - s.from) / Math.max(1, s.to - s.from));
        const cam = `scale(${(1 + (lively ? 0.07 : 0.045) * p).toFixed(4)}) translateX(${(Math.sin(p * Math.PI) * (s.left ? -14 : 14)).toFixed(1)}px)`;
        let way = "";
        let opacity = 1;
        let clip: string | undefined;
        if (theme.way === "slide") way = `translateX(${((1 - pin) * W - pout * W).toFixed(1)}px)`;
        else if (theme.way === "zoom") {
          way = `scale(${(pin < 1 ? 0.82 + 0.18 * pin : 1 + 0.6 * pout).toFixed(4)})`;
          opacity = pin < 1 ? pin : 1 - pout;
        } else if (pin < 1) clip = `inset(0 ${((1 - pin) * 100).toFixed(2)}% 0 0)`;
        const c: C = { f, s, look, pace: theme.pace, brand: plan.brand, g, play: PLAY };
        const Body = TEMPLATE[s.template];
        return (
          <AbsoluteFill key={i} style={{ transform: way || undefined, opacity, clipPath: clip }}>
            <Ground look={look} f={f} i={i} />
            <AbsoluteFill style={{ transform: cam }}>
              <Body c={c} />
            </AbsoluteFill>
            {clip && <div style={{ position: "absolute", top: 0, bottom: 0, left: pin * W - 6, width: 12, background: look.accent }} />}
          </AbsoluteFill>
        );
      })}
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
      {plan.sfx !== false && <Sounds plan={plan} webAudio={webAudio} />}
    </AbsoluteFill>
  );
}

// a whoosh as each scene comes in, a pop as things come in, a click on each click, a chime at the end
function soundsOf(plan: SimplePlan): { at: number; name: string; volume: number }[] {
  const out: { at: number; name: string; volume: number }[] = [];
  plan.scenes.forEach((s: Scene, i) => {
    if (i) out.push({ at: Math.max(0, s.from - T / 2), name: "whoosh", volume: 0.22 });
    if (s.items.length && s.template !== "statement" && s.template !== "stat") out.push({ at: s.from + 10, name: "soft_pop", volume: 0.3 });
    if (s.template === "stat" || s.template === "reveal") out.push({ at: s.from + 8, name: s.template === "stat" ? "subtle_impact" : "reveal", volume: 0.36 });
    const click = clickOf(s);
    if (click != null) out.push({ at: click, name: "click", volume: 0.45 });
    if (s.template === "cta" && click != null) out.push({ at: click + 10, name: "success_chime", volume: 0.32 });
  });
  return out.filter((e) => e.at < plan.duration - 6).sort((a, b) => a.at - b.at).filter((e, i, a) => !i || e.at - a[i - 1].at >= 8);
}
function Sounds({ plan, webAudio }: { plan: SimplePlan; webAudio?: boolean }) {
  return (
    <>
      {soundsOf(plan).map((e, i) => (
        <Sequence key={i} from={e.at} durationInFrames={Math.min(90, plan.duration - e.at)} layout="none">
          {webAudio ? <MediaAudio src={staticFile(`/sfx/${e.name}.mp3`)} volume={e.volume} /> : <Html5Audio src={staticFile(`/sfx/${e.name}.mp3`)} volume={e.volume} />}
        </Sequence>
      ))}
    </>
  );
}

