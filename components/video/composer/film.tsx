import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { AbsoluteFill, Html5Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { DISPLAY_FACES, TEXT_FACES, faceOf, familyOf, fontUrl, palette, rng } from "./art";
import { type Anchor, Field } from "./field";
import { ItemBody, baseSize } from "./items";
import { type Ctx, CtxC } from "./kit";
import { isAccent } from "./layout";
import { IN_OUT, TRANSITION_FRAMES, cameraOf, clamp01, enterK, enterStyle, mix, moverOf, ramp, sceneIn, sceneOut } from "./motion";
import { Headline } from "./text";
import { Trail } from "@remotion/motion-blur";
import { noise2D } from "@remotion/noise";
import { Present, presentationOf } from "./present";
import { measureText } from "@remotion/layout-utils";
import type { ComposerProps, EnterKind, ItemKind, PlacedItem, PlacedScene, TextBlock } from "./types";

// A Composer film: the Director's scenes on the voice's words. Every scene
// is its own composition; one field of light runs under all of them and
// moves to each scene's place; a thing named again travels to its new place.

const loaded = new Set<string>();
function useFaces(slugs: string[]) {
  const [, setV] = useState(0);
  useState(() => {
    if (typeof document === "undefined") return;
    const todo = [...new Set(slugs)].map((s) => [...DISPLAY_FACES, ...TEXT_FACES].find((f) => f.slug === s) ?? DISPLAY_FACES[0]).filter((f) => !loaded.has(f.family));
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

const DEFAULT_ENTER: Record<ItemKind, EnterKind> = { card: "rise", icon: "pop", chips: "left", stat: "scale", chart: "rise", device: "rise", screenshot: "rise", logo: "blur", button: "pop", compare: "rise", flow: "blur", steps: "rise", avatars: "pop", badge: "pop", quote: "rise", shape: "scale", cursor: "blur" };

function anchorOf(s: PlacedScene, i: number): Anchor {
  const R = rng(s.seed ^ 0x9e3779b9);
  // the light leans away from the scene's things (towards its words)
  const tb = s.text?.box;
  const x = tb ? mix(R.range(380, 1540), tb.x, 0.45) : R.range(380, 1540);
  return { x, y: R.range(260, 820), s: R.range(0.8, 1.3), t: (i * 0.37 + R.next() * 0.3) % 1 };
}

// The words laid out again with the face really measured (Remotion's
// measureText): the same place, never larger than planned; lines re-broken
// and the size lowered until they fit.
const fitCache = new Map<string, TextBlock>();
function fitWords(tb: TextBlock, family: string, weight: number, upper: boolean, tracking: number): TextBlock {
  if (typeof document === "undefined") return tb;
  const area = tb.area ?? tb.box;
  const key = `${family}|${weight}|${upper}|${tracking}|${tb.size}|${Math.round(area.w)}x${Math.round(tb.box.h)}|${tb.kicker ?? ""}|${tb.words.map((w) => w.t).join(" ")}`;
  const hit = fitCache.get(key);
  if (hit) return { ...tb, size: hit.size, lines: hit.lines, box: hit.box };
  const lh = upper ? 1.02 : 1.08;
  const maxW = area.w;
  const maxH = tb.box.h;
  const kickerH = (size: number) => (tb.kicker ? Math.round(size * 0.26) + Math.round(size * 0.22) + 6 : 0);
  let best: { size: number; lines: number[][]; width: number } | null = null;
  for (let size = tb.size; size >= 34; size -= 2) {
    const ws = tb.words.map((w) => measureText({ text: w.t, fontFamily: family, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, textTransform: upper ? "uppercase" : "none", validateFontIsLoaded: false }).width);
    const space = size * (upper ? 0.24 : 0.26);
    const lines: number[][] = [];
    const widths: number[] = [];
    let cur: number[] = [];
    let cw = 0;
    ws.forEach((w, i) => {
      const add = (cur.length ? space : 0) + w;
      if (cur.length && cw + add > maxW) {
        lines.push(cur);
        widths.push(cw);
        cur = [i];
        cw = w;
      } else {
        cur.push(i);
        cw += add;
      }
    });
    if (cur.length) {
      lines.push(cur);
      widths.push(cw);
    }
    const width = Math.max(0, ...widths);
    best = { size, lines, width };
    if (width <= maxW && lines.length * size * lh + kickerH(size) <= maxH + 1) break;
  }
  if (!best) return tb;
  const h = best.lines.length * best.size * lh + kickerH(best.size);
  const w = Math.min(maxW, best.width + 8);
  const x = tb.align === "left" ? area.x - area.w / 2 + w / 2 : tb.align === "right" ? area.x + area.w / 2 - w / 2 : area.x;
  const top = tb.box.y - tb.box.h / 2, bottom = tb.box.y + tb.box.h / 2;
  const y = tb.anchor === "top" ? top + h / 2 : tb.anchor === "bottom" ? bottom - h / 2 : tb.box.y;
  const out = { ...tb, size: best.size, lines: best.lines, box: { x, y, w, h } };
  fitCache.set(key, out);
  return out;
}

export function ComposerFilm({ plan, audioUrl, webAudio, bare, screens = [] }: ComposerProps & { screens?: string[] }) {
  const f = useCurrentFrame();
  const { art } = plan;
  const display = faceOf(art.display);
  const textFace = faceOf(art.text, TEXT_FACES);
  useFaces([display.slug, textFace.slug]);
  const m = useMemo(() => moverOf(art), [art]);
  const pals = useMemo(() => ({ dark: palette(art, true), light: palette(art, false) }), [art]);
  const scenes = plan.scenes;
  const anchors = useMemo(() => scenes.map(anchorOf), [scenes]);
  const ready = typeof document !== "undefined" && loaded.has(display.family);
  const family = familyOf(display);
  const weight = display.fixed ?? art.weight;
  const upper = art.case === "upper" || !!display.upper;
  const tracking = art.tracking;
  const texts = scenes.map((s) => (s.text && ready ? fitWords(s.text, family, weight, upper, tracking) : s.text));
  // the scene whose field is showing (it opens as the scene comes in)
  const cur = Math.max(0, scenes.findLastIndex((s) => s.from - 2 <= f));
  const s = scenes[cur];
  // bright things on a dark field change a lot of light: their ways in and
  // out take longer there (never a flash)
  const D = (i: number) => Math.round((TRANSITION_FRAMES[scenes[i]?.enter ?? "fade"] ?? 16) * (scenes[i]?.dark || scenes[i - 1]?.dark ? 1.5 : 1));
  const flipping = cur > 0 && scenes[cur - 1].dark !== s.dark;
  // a field turning dark ↔ light opens slowly from the scene's thing, its
  // area growing evenly (never a flash of new light)
  const tk = cur ? (flipping ? ramp(f, s.from - 4, 44) : IN_OUT(ramp(f, s.from - 2, Math.max(D(cur), 22)))) : 1;
  const prevA = anchors[Math.max(0, cur - 1)];
  const a = anchors[cur];
  const anchor: Anchor = { x: mix(prevA.x, a.x, tk), y: mix(prevA.y, a.y, tk), s: mix(prevA.s, a.s, tk), t: mix(prevA.t, a.t, tk) };
  const flip = flipping && tk < 1;
  const origin = s.items.find((q) => !isAccent(q))?.box ?? s.text?.box ?? { x: 960, y: 540, w: 0, h: 0 };
  const fieldOf = (dark: boolean, style?: CSSProperties) => <Field f={f} kind={art.field} pal={dark ? pals.dark : pals.light} hue={art.hue} anchor={anchor} energy={art.energy} overlay={art.overlay} style={style} />;
  // (the circle's area grows evenly until it reaches the farthest corner)
  const reach = Math.hypot(Math.max(origin.x, 1920 - origin.x), Math.max(origin.y, 1080 - origin.y));
  const clip = flip ? `circle(${Math.round(Math.sqrt(tk) * reach)}px at ${Math.round(origin.x)}px ${Math.round(origin.y)}px)` : undefined;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: familyOf(textFace) }}>
      {flip && fieldOf(scenes[cur - 1].dark)}
      <AbsoluteFill style={clip ? { clipPath: clip, WebkitClipPath: clip } : undefined}>{fieldOf(s.dark)}</AbsoluteFill>
      {!bare && scenes.map((sc, i) => <SceneLayer key={i} i={i} plan={plan} pals={pals} m={m} display={familyOf(display)} textFamily={familyOf(textFace)} screens={screens} texts={texts} D={D} field={fieldOf} />)}
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
    </AbsoluteFill>
  );
}

type SceneProps = { i: number; plan: ComposerProps["plan"]; pals: { dark: ReturnType<typeof palette>; light: ReturnType<typeof palette> }; m: ReturnType<typeof moverOf>; display: string; textFamily: string; screens: string[]; texts: (TextBlock | null)[]; D: (i: number) => number; field: (dark: boolean) => ReactNode };

// A scene; during a fast way in or out it leaves a short trail (Remotion's
// motion blur as layers — it renders the same in the browser's download).
function SceneLayer(props: SceneProps) {
  const f = useCurrentFrame();
  const { i, plan } = props;
  const sc = plan.scenes[i], next = plan.scenes[i + 1];
  const moves = (k: string) => /^(push|whip|zoom)/.test(k);
  const fast = (i > 0 && moves(sc.enter) && f >= sc.from - 2 && f <= sc.from + 24) || (!!next && moves(next.enter) && f >= sc.to - 4 && f <= sc.to + 30);
  return fast ? (
    <Trail layers={3} lagInFrames={0.5} trailOpacity={0.55}>
      <SceneBody {...props} />
    </Trail>
  ) : (
    <SceneBody {...props} />
  );
}

// One scene, reading the frame itself (so the trail can sample it a moment
// earlier): its way in and out, camera, words and things.
function SceneBody({ i, plan, pals, m, display, textFamily, screens, texts, D, field }: SceneProps) {
  const f = useCurrentFrame();
  const scenes = plan.scenes;
  const sc = scenes[i];
  const { art, brand } = plan;
  const last = i === scenes.length - 1;
  const next = scenes[i + 1];
  const dIn = i ? D(i) : 1;
  // the last scene moves on with the next one where they travel together
  // (push, whip, a Remotion transition); otherwise it is mostly gone before
  // the next one's words arrive (two headlines never sit on each other)
  const together = !last && (/^(push|whip)/.test(next.enter) || !!presentationOf(next.enter));
  const dOut = last ? 0 : together ? D(i + 1) : sc.dark ? 20 : 14;
  const outAt = together ? sc.to - 2 : sc.to - 4;
  const start = sc.from - 2;
  const end = last ? plan.duration : outAt + dOut;
  if (f < start || f > end) return null;
  const kin = i ? IN_OUT(ramp(f, start, dIn)) : 1;
  const kout = last ? 0 : IN_OUT(ramp(f, outAt, dOut));
  const pal = sc.dark ? pals.dark : pals.light;
  const c: Ctx = { f, pal, art, m, display, text: textFamily, brand, screens };
  const o = sc.items.find((q) => !isAccent(q))?.box ?? sc.text?.box ?? { x: 960, y: 540 };
  const pin = presentationOf(sc.enter, sc.seed);
  const pout = next ? presentationOf(next.enter, next.seed) : null;
  const outStyle = kout > 0 && !pout ? sceneOut(next.enter, kout) : undefined;
  const inStyle = kin < 1 && !pin ? sceneIn(sc.enter, kin, o) : undefined;
  const p = clamp01((f - sc.from) / Math.max(1, sc.to - sc.from));
  const cam = cameraOf(sc.camera, p, f, art.energy);
  // things that travel on into the next scene leave this one as it goes
  const travels = (it: PlacedItem) => !!(it.id && next?.items.some((q) => q.id === it.id && q.from)) && f >= next.from - 2;
  const sorted = [...sc.items].sort((x, y) => x.z - y.z);
  const still = sorted.filter((it) => !it.from);
  const moving = sorted.filter((it) => it.from);
  let body = (
    <AbsoluteFill style={inStyle}>
      <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: "50% 45%" }}>
        <AbsoluteFill style={{ transform: cam, transformStyle: "preserve-3d" }}>
          <CtxC.Provider value={c}>
            {still.filter((it) => it.z < 2 && !travels(it)).map((it, j) => <Thing key={`b${j}`} c={c} it={it} idx={j} />)}
            {texts[i] && <Headline c={c} tb={texts[i]!} plate={sc.layout === "over"} />}
            {still.filter((it) => it.z >= 2 && !travels(it)).map((it, j) => <Thing key={`f${j}`} c={c} it={it} idx={j + 10} />)}
          </CtxC.Provider>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
  // Remotion's own transitions (clock wipe, wipe, flip) on our timing
  // (a wipe brings the new scene's own background with it, so the last
  // scene is covered where the new one is revealed — never the two mixed)
  // (a flip turns at an even speed — eased, its edge-on moment flashes past)
  const lin = (k: number, kind: string) => (kind === "flip" ? clamp01((Math.asin(clamp01(k) * 2 - 1) / Math.PI) + 0.5) : k);
  if (pin && kin < 1)
    body = (
      <Present p={pin} dir="entering" k={lin(kin, sc.enter)} dur={dIn}>
        <AbsoluteFill>
          {(sc.enter === "clock" || sc.enter === "wipe") && field(sc.dark)}
          {body}
        </AbsoluteFill>
      </Present>
    );
  if (pout && kout > 0) body = <Present p={pout} dir="exiting" k={lin(kout, next.enter)} dur={dOut}>{body}</Present>;
  return (
    <AbsoluteFill style={outStyle}>
      {body}
      <CtxC.Provider value={c}>
        {moving.filter((it) => !travels(it)).map((it, j) => <Thing key={`m${j}`} c={c} it={it} idx={j + 20} travel={{ from: it.from!, start, dur: 22 }} />)}
      </CtxC.Provider>
    </AbsoluteFill>
  );
}

function Thing({ c, it, idx, travel }: { c: Ctx; it: PlacedItem; idx: number; travel?: { from: { x: number; y: number; w: number; h: number }; start: number; dur: number } }) {
  const [bw, bh] = baseSize(it);
  let box = it.box;
  let k = 1;
  if (travel) {
    const t = IN_OUT(ramp(c.f, travel.start, travel.dur));
    box = { x: mix(travel.from.x, box.x, t), y: mix(travel.from.y, box.y, t), w: mix(travel.from.w, box.w, t), h: mix(travel.from.h, box.h, t) };
  } else {
    k = enterK(c.m, c.f, it.at);
    if (k <= 0) return null;
  }
  const scale = box.w / bw;
  const kind = it.enter ?? DEFAULT_ENTER[it.kind] ?? "rise";
  const enter = travel ? {} : enterStyle(kind, k);
  // each thing drifts a little on its own (noise, seeded by the thing — never in step with the others)
  const seed = it.id ?? `${it.kind}${idx}`;
  const bob = it.kind === "shape" || it.kind === "cursor" ? "" : ` translate(${(noise2D(seed + "x", c.f / 90, idx) * 4).toFixed(1)}px, ${(noise2D(seed + "y", idx, c.f / 75) * 6).toFixed(1)}px) rotate(${(noise2D(seed + "r", c.f / 120, idx * 0.5) * 0.5).toFixed(2)}deg)`;
  const tilt = it.tilt ? ` perspective(1600px) rotateY(${it.tilt}deg) rotateX(${(Math.abs(it.tilt) * 0.3).toFixed(1)}deg)` : "";
  return (
    <div style={{ position: "absolute", left: box.x - bw / 2, top: box.y - bh / 2, width: bw, height: bh, transform: `scale(${scale.toFixed(4)})${tilt}${bob}`, zIndex: it.z }}>
      <div style={{ width: bw, height: bh, ...enter, transform: `${(enter as CSSProperties).transform ?? ""}` }}>
        <ItemBody c={c} it={it} w={bw} h={bh} />
      </div>
    </div>
  );
}
