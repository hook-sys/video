import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { AbsoluteFill, Html5Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { DISPLAY_FACES, TEXT_FACES, faceOf, familyOf, fontUrl, palette, rng } from "./art";
import { type Anchor, Field } from "./field";
import { ItemBody, baseSize } from "./items";
import { type Ctx, CtxC, Glyph, kIn } from "./kit";
import { isAccent } from "./layout";
import { IN_OUT, TRANSITION_FRAMES, cameraOf, clamp01, enterK, enterStyle, mix, moverOf, ramp, sceneIn, sceneOut } from "./motion";
import { Headline } from "./text";
import { CameraMotionBlur, Trail } from "@remotion/motion-blur";
import { noise2D } from "@remotion/noise";
import { Present, presentationOf } from "./present";
import { RECAP } from "./staging";
import { type Cam, JourneyField, Roads, arriving, cameraAt, moves, recapped, stations, styleOf, toScreen, turnCam, turnGeometry, worldTransform } from "./journey";
import { PAGE, Structure, scrollAt } from "./structure";
import { type Links, Travellers, linksOf } from "./links";
import { depthHops, hopAt, innerTransform, isDepth, outerTransform, tunnelAt, zoomAt } from "./depth";
import { ENERGY, flowMoves, glyphRect } from "./flow";
import { morphPath } from "./morph";
import { measureText } from "@remotion/layout-utils";
import { STILL_BACKGROUND, type ComposerProps, type EnterKind, type ItemKind, type PlacedItem, type PlacedScene, type TextBlock } from "./types";
import { H, W, setFrame } from "./frame";
import { SoundEffects } from "./sfx";
import { QaProbe, qaMark } from "./probe";
import { SimpleFilm } from "../simple/film";
import { isSimple } from "../simple/types";

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

// (a video made by the simple engine plays its own film — components/video/simple)
export function ComposerFilm(props: ComposerProps & { screens?: string[] }) {
  return isSimple(props.plan) ? <SimpleFilm plan={props.plan} audioUrl={props.audioUrl} webAudio={props.webAudio} /> : <PlannedFilm {...props} />;
}

function PlannedFilm({ plan, audioUrl, webAudio, bare, qa, screens = [] }: ComposerProps & { screens?: string[] }) {
  // (the frame every part reads — frame.ts)
  setFrame(plan.w ?? 1920, plan.h ?? 1080);
  const f = useCurrentFrame();
  const { art } = plan;
  const display = faceOf(art.display);
  const textFace = faceOf(art.text, TEXT_FACES);
  useFaces([display.slug, textFace.slug]);
  const m = useMemo(() => moverOf(art, plan.flow ? ENERGY[plan.flow.energy] : null), [art, plan.flow]);
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
  // (a still background keeps the first scene's light all the way)
  const anchor: Anchor = STILL_BACKGROUND ? anchors[0] : { x: mix(prevA.x, a.x, tk), y: mix(prevA.y, a.y, tk), s: mix(prevA.s, a.s, tk), t: mix(prevA.t, a.t, tk) };
  const flip = flipping && tk < 1;
  const origin = s.items.find((q) => !isAccent(q))?.box ?? s.text?.box ?? { x: W / 2, y: H / 2, w: 0, h: 0 };
  const fieldOf = (dark: boolean, style?: CSSProperties) => <Field f={f} kind={art.field} pal={dark ? pals.dark : pals.light} hue={art.hue} anchor={anchor} energy={art.energy} overlay={art.overlay} style={style} />;
  // (the circle's area grows evenly until it reaches the farthest corner)
  const reach = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y));
  const clip = flip ? `circle(${Math.round(Math.sqrt(tk) * reach)}px at ${Math.round(origin.x)}px ${Math.round(origin.y)}px)` : undefined;
  // a scene's own background (each scene on its own: a tile, a window, a page section)
  const sceneField = (i: number) => <Field f={f} kind={art.field} pal={scenes[i].dark ? pals.dark : pals.light} hue={art.hue} anchor={anchors[i]} energy={art.energy} overlay={art.overlay} />;
  // the voice, and the sound effects under it
  const sound = (
    <>
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
      {!bare && <SoundEffects plan={plan} webAudio={webAudio} />}
      {qa && <QaProbe W={plan.w ?? 1920} />}
    </>
  );
  if (plan.journey === "scroll") {
    const props = { plan, pals, m, display: familyOf(display), textFamily: familyOf(textFace), screens, texts, D, field: fieldOf };
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: familyOf(textFace) }}>
        <ScrollPage {...props} bare={bare} sceneField={sceneField} />
        {sound}
      </AbsoluteFill>
    );
  }
  if (isDepth(plan.link)) {
    const props = { plan, pals, m, display: familyOf(display), textFamily: familyOf(textFace), screens, texts, D, field: fieldOf };
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: familyOf(textFace) }}>
        <Depth {...props} bare={bare} sceneField={sceneField} />
        {sound}
      </AbsoluteFill>
    );
  }
  if (plan.journey) {
    const props = { plan, pals, m, display: familyOf(display), textFamily: familyOf(textFace), screens, texts, D, field: fieldOf, weight, upper, tracking, sceneField };
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: familyOf(textFace) }}>
        <Journey {...props} bare={bare} />
        {sound}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: familyOf(textFace) }}>
      {flip && fieldOf(scenes[cur - 1].dark)}
      <AbsoluteFill style={clip ? { clipPath: clip, WebkitClipPath: clip } : undefined}>{fieldOf(s.dark)}</AbsoluteFill>
      {!bare && scenes.map((sc, i) => <SceneLayer key={i} i={i} plan={plan} pals={pals} m={m} display={familyOf(display)} textFamily={familyOf(textFace)} screens={screens} texts={texts} D={D} field={fieldOf} />)}
      {sound}
    </AbsoluteFill>
  );
}

// "New version": how far each layer's camera moves (× the scene's own move):
// the background least, the things in front most — parallax you can see
const FLOW_CAMERA = { field: 0.9, scene: 2, front: 2.7 };

// A journey: one canvas, each scene in its own place on it, the camera
// travelling between them along the line it draws (see journey.tsx). While it
// travels the whole view leaves a short trail.
type JourneyProps = Omit<SceneProps, "i" | "journey"> & { bare?: boolean; weight: number; upper: boolean; tracking: number; sceneField: (i: number) => ReactNode };
function Journey(props: JourneyProps) {
  const f = useCurrentFrame();
  // (a turning canvas has its own geometry: each scene a quarter turn from the last)
  const turn = useMemo(() => (props.plan.link === "turn" ? turnGeometry(props.plan.scenes.length, props.plan.seed) : null), [props.plan]);
  const st = useMemo(() => turn?.st ?? stations(props.plan.scenes.length, props.plan.journey ?? "right", props.plan.seed), [props.plan, turn]);
  const mv = useMemo(() => moves(props.plan), [props.plan]);
  const arrived = useMemo(() => arriving(props.plan, mv), [props.plan, mv]);
  const { display, weight, tracking, upper } = props;
  // how the scenes are joined (see links.tsx); the words measured in the face
  const L = linksOf(arrived, st, mv, props.texts, (t, size) => (typeof document === "undefined" ? t.length * size * 0.55 : measureText({ text: t, fontFamily: display, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, textTransform: upper ? "uppercase" : "none", validateFontIsLoaded: false }).width), upper);
  const plan = L.plan;
  const kind = plan.journey ?? "right";
  const style = styleOf(kind, plan.link);
  const camOf = (fr: number) => {
    const c = turn ? turnCam(fr, turn, mv) : cameraAt(fr, st, mv, L.ends, style);
    return plan.recap ? recapped(c, fr, plan.duration, st) : c;
  };
  const cam = camOf(f);
  const darks = plan.scenes.map((s) => s.dark);
  const travelling = cam.speed > 10;
  const whip = plan.link === "whip";
  const world = <JourneyWorld {...props} plan={plan} st={st} mv={mv} L={L} camOf={camOf} rots={turn?.rot} />;
  // a structure draws its own joins (a map keeps the line round its ring, up to the hub); the camera-only ways have none
  const roads = kind === "timeline" || kind === "tiles" || whip || turn ? [] : L.hops.map((h, i) => i > 0 && !h && !(kind === "map" && i === st.length - 1));
  return (
    <>
      <JourneyField f={f} cam={cam} st={st} darks={darks} pals={props.pals} hue={plan.art.hue} grid={["beams", "streaks", "horizon", "arcs"].includes(plan.art.field)} />
      <Roads cam={cam} st={st} mv={mv} f={f} pals={props.pals} darks={darks} only={roads} />
      <Structure kind={kind} f={f} cam={cam} st={st} mv={mv} plan={plan} pals={props.pals} font={props.textFamily} />
      {/* (a whip pan is mostly its blur: a film camera's, the frame averaged over most of its time) */}
      {!props.bare && (travelling ? whip ? <CameraMotionBlur shutterAngle={300} samples={14}>{world}</CameraMotionBlur> : <Trail layers={4} lagInFrames={0.3} trailOpacity={0.4}>{world}</Trail> : world)}
      {plan.recap && <RecapCard {...props} plan={plan} />}
    </>
  );
}

// The brand over the whole canvas at the end of a recap: its name and mark,
// its address, and its ask, on a soft veil so they read over the scenes.
function RecapCard(props: JourneyProps) {
  const f = useCurrentFrame();
  const { plan } = props;
  const at = plan.duration - RECAP + 66;
  const veil = clamp01((f - at + 6) / 22);
  if (veil <= 0) return null;
  const last = plan.scenes[plan.scenes.length - 1];
  const pal = last.dark ? props.pals.dark : props.pals.light;
  const c: Ctx = { f, pal, art: plan.art, m: props.m, display: props.display, text: props.textFamily, brand: plan.brand, screens: props.screens };
  const logo: PlacedItem = { kind: "logo", at, hit: null, sub: plan.brand.url || null, box: { x: W / 2, y: H / 2 - 70, w: Math.min(760, W * 0.7), h: 0 }, scale: 1, z: 1 };
  const button: PlacedItem = { kind: "button", at: at + 14, hit: at + 44, title: plan.brand.cta, box: { x: W / 2, y: H / 2 + 160, w: Math.min(560, W * 0.52), h: 0 }, scale: 1, z: 1 };
  const draw = (it: PlacedItem) => {
    const [bw, bh] = baseSize(it);
    const k = enterK(props.m, f, it.at);
    return (
      <div style={{ position: "absolute", left: it.box.x - bw / 2, top: it.box.y - bh / 2, width: bw, height: bh, transform: `scale(${((it.box.w / bw) * mix(0.92, 1, k)).toFixed(4)})`, opacity: clamp01(k * 1.6) }}>
        <ItemBody c={c} it={it} w={bw} h={bh} />
      </div>
    );
  };
  return (
    <AbsoluteFill>
      {/* the canvas stays in view around a plate the brand sits on */}
      <AbsoluteFill style={{ background: pal.bg, opacity: 0.45 * veil }} />
      <div style={{ position: "absolute", left: W / 2 - Math.min(1120, W - 80) / 2, top: H / 2 + 20 - 300, width: Math.min(1120, W - 80), height: 600, borderRadius: 56, background: pal.bg, opacity: veil, transform: `scale(${mix(0.94, 1, veil).toFixed(4)})`, boxShadow: `0 40px 120px ${pal.shadow}, 0 0 0 2px ${pal.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
      <CtxC.Provider value={c}>
        {draw(logo)}
        {draw(button)}
      </CtxC.Provider>
    </AbsoluteFill>
  );
}
function JourneyWorld(props: JourneyProps & { st: { x: number; y: number }[]; mv: { start: number; dur: number }[]; L: Links; camOf: (f: number) => Cam; rots?: number[] }) {
  const f = useCurrentFrame();
  const { plan, st, mv, L, rots } = props;
  const cam = props.camOf(f);
  const n = plan.scenes.length;
  const tiles = plan.journey === "tiles";
  const ctxOf = (i: number): Ctx => ({ f, pal: plan.scenes[i].dark ? props.pals.dark : props.pals.light, art: plan.art, m: props.m, display: props.display, text: props.textFamily, brand: plan.brand, screens: props.screens });
  // a scene stays where it is on the canvas once the camera has set off
  // towards it; it is drawn while it is in view
  const inView = (i: number) => {
    const c = toScreen(st[i], cam);
    if (rots) return Math.hypot(c.x - W / 2, c.y - H / 2) < Math.hypot(W / 2, H / 2) + (Math.hypot(W / 2, H / 2) + 58) * cam.z;
    return Math.abs(c.x - W / 2) < W / 2 + (W / 2 + 120) * cam.z && Math.abs(c.y - H / 2) < H / 2 + (H / 2 + 120) * cam.z;
  };
  const place = (i: number) => ({ position: "absolute" as const, left: st[i].x - W / 2, top: st[i].y - H / 2, width: W, height: H, ...(rots?.[i] ? { transform: `rotate(${rots[i]}deg)` } : {}) });
  return (
    <AbsoluteFill style={{ transform: worldTransform(cam), transformOrigin: "0 0" }}>
      {plan.scenes.map((_, i) => {
        const start = i ? mv[i].start - 2 : 0;
        const end = i < n - 1 ? mv[i + 1].start + mv[i + 1].dur + 2 : plan.duration;
        const seen = f >= start && (f <= end || inView(i));
        // on a wall of tiles every scene has its tile (an empty one until the camera sets off for it)
        const tile = tiles && inView(i) && (
          <div key={`t${i}`} style={{ ...place(i), borderRadius: 44, overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,0.35)", ...(seen ? {} : { background: "rgba(255,255,255,0.06)", border: "3px dashed rgba(255,255,255,0.28)" }) }}>
            {seen && props.sceneField(i)}
          </div>
        );
        if (!seen) return tile || null;
        return [
          tile,
          <div key={i} style={{ ...place(i), ...(tiles ? { borderRadius: 44, overflow: "hidden" } : {}) }}>
            <SceneBody {...props} i={i} journey={{ start, end: plan.duration + 1, hidden: (j) => L.hidden(i, j, f), hiddenWord: (wi) => L.hiddenWord(i, wi, f), dim: L.dim(i, f) }} />
          </div>,
        ];
      })}
      <Travellers f={f} L={L} st={st} mv={mv} ctxOf={ctxOf} display={props.display} weight={props.weight} tracking={props.tracking} upper={props.upper} lower={plan.art.case === "lower"} />
    </AbsoluteFill>
  );
}

// Depth (see depth.ts): the camera goes into a thing of the scene (the next
// scene is inside it), pulls back out of the next scene's thing, or flies
// forward through the scenes. Every scene has its own background; between
// scenes the two are on screen, one inside (or behind) the other.
type DepthProps = Omit<SceneProps, "i" | "journey"> & { bare?: boolean; sceneField: (i: number) => ReactNode };
function Depth(props: DepthProps) {
  const f = useCurrentFrame();
  // ("New version": its own ways, timed by its energy — flow.ts)
  const flow = !!props.plan.flow;
  const mv = useMemo(() => (props.plan.flow ? flowMoves(props.plan) : moves(props.plan)), [props.plan]);
  const { plan, hops } = useMemo(() => depthHops(arriving(props.plan, mv), mv), [props.plan, mv]);
  const { seg, raw, u } = hopAt(f, mv);
  const deep = flow && plan.flow?.depth !== false;
  const all = { start: -1, end: plan.duration + 1, camera: flow, depth: deep };
  // (in the "New version" each scene's background moves with its camera, slower than its things: parallax)
  const fieldOf = (i: number) => {
    if (!deep) return props.sceneField(i);
    const sc = plan.scenes[i];
    const p = clamp01((f - sc.from) / Math.max(1, sc.to - sc.from));
    return <AbsoluteFill style={{ transform: `${cameraOf(sc.camera, p, f, plan.art.energy, FLOW_CAMERA.field)} scale(1.08)` }}>{props.sceneField(i)}</AbsoluteFill>;
  };
  const layer = (i: number, style: CSSProperties, field = true, frame?: CSSProperties, noGlyph?: number) => (
    <AbsoluteFill key={i} style={{ transformOrigin: "0 0", ...style }}>
      <AbsoluteFill style={{ overflow: "hidden", ...frame }}>
        {field && fieldOf(i)}
        {!props.bare && <SceneBody {...props} plan={plan} i={i} journey={noGlyph != null ? { ...all, noGlyph: (j) => j === noGlyph } : all} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
  const h = hops[seg];
  if (!seg || raw >= 1 || !h) return layer(seg, {});
  if (flow && (h.kind === "cut" || h.kind === "fade" || h.kind === "slide" || h.kind === "wipe" || h.kind === "morph")) {
    const A = seg - 1, B = seg;
    if (h.kind === "cut") return layer(raw < 0.5 ? A : B, {});
    // (a cross-fade: the backgrounds mix, the last scene's things are gone before the next one's come — two headlines never sit on each other)
    if (h.kind === "fade") return <>{fieldOf(A)}<AbsoluteFill style={{ opacity: u }}>{fieldOf(B)}</AbsoluteFill>{layer(A, { opacity: 1 - clamp01(u / 0.5) }, false)}{layer(B, { opacity: clamp01((u - 0.45) / 0.55) }, false)}</>;
    if (h.kind === "slide") {
      // the next scene slides in over the last, which drifts back the other way (one in three goes up)
      const up = (plan.seed + seg) % 3 === 0;
      const move = (px: number) => (up ? `translateY(${px.toFixed(1)}px)` : `translateX(${px.toFixed(1)}px)`);
      const d = up ? H : W;
      return <>{layer(A, { transform: move(-d * 0.28 * u) })}{layer(B, { transform: move(d * (1 - u)), boxShadow: `0 0 ${(80 * Math.sin(raw * Math.PI)).toFixed(0)}px rgba(0,0,0,0.35)` })}</>;
    }
    if (h.kind === "wipe") {
      // a mask wipe: a slanted edge crosses the frame, the next scene behind it
      const x = mix(-0.2 * W, 1.2 * W, u);
      const slant = 0.12 * W;
      const clip = `polygon(0px 0px, ${(x + slant).toFixed(0)}px 0px, ${x.toFixed(0)}px ${H}px, 0px ${H}px)`;
      return <>{layer(A, { transform: `scale(${(1 - 0.03 * u).toFixed(4)})`, transformOrigin: "50% 50%" })}{layer(B, { clipPath: clip, WebkitClipPath: clip, transform: `translateX(${(50 * (1 - u)).toFixed(1)}px)` })}</>;
    }
    // morph: the last scene's icon becomes this scene's hero icon (the same
    // tile, its line moving from one icon to the other, travelling to its
    // place); the rest of the two scenes cross-fade, background first
    const a = plan.scenes[A].items[h.item], b = plan.scenes[B].items[h.item2 ?? -1];
    if (!a || !b) return <>{layer(A, {})}{layer(B, { opacity: u })}</>;
    const ga = glyphRect(a), gb = glyphRect(b);
    const t = u;
    const box = { x: mix(ga.x, gb.x, t), y: mix(ga.y, gb.y, t), w: mix(ga.w, gb.w, t) };
    const path = morphPath(a.icon ?? "", b.icon ?? "", t);
    const ctx = (i: number): Ctx => ({ f, pal: plan.scenes[i].dark ? props.pals.dark : props.pals.light, art: plan.art, m: props.m, display: props.display, text: props.textFamily, brand: plan.brand, screens: props.screens });
    const over = clamp01(raw / 0.06) * (1 - clamp01((raw - 0.94) / 0.06));
    const glyph = (i: number, o: number) => (o <= 0.01 ? null : (
      <div style={{ position: "absolute", left: box.x - 100, top: box.y - 100, width: 200, height: 200, transform: `scale(${(box.w / 200).toFixed(4)}) rotate(${(Math.sin(t * Math.PI) * 6).toFixed(2)}deg)`, opacity: o * over, zIndex: 30 }}>
        {path ? <Glyph c={ctx(i)} name={t < 0.5 ? a.icon : b.icon} size={200} path={path} /> : <Glyph c={ctx(i)} name={i === A ? a.icon : b.icon} size={200} />}
      </div>
    ));
    const same = plan.scenes[A].dark === plan.scenes[B].dark;
    return (
      <>
        {fieldOf(A)}
        <AbsoluteFill style={{ opacity: clamp01(u * 1.4) }}>{fieldOf(B)}</AbsoluteFill>
        {layer(A, { opacity: 1 - clamp01(u / 0.5) }, false, undefined, raw > 0.06 ? h.item : undefined)}
        {layer(B, { opacity: clamp01((u - 0.45) / 0.55) }, false, undefined, raw < 0.94 ? h.item2 : undefined)}
        {glyph(A, same || !path ? (path ? 1 : 1 - t) : 1 - t)}
        {(!same || !path) && glyph(B, t)}
      </>
    );
  }
  // (no motion-blur trail here: on the scaled layers the download draws it as a grey ghost)
  const blur = (node: ReactNode) => node;
  if (h.kind === "flip") {
    // the card turns over (round its upright axis, or every other time its
    // level one), drawing back a little as it turns; the canvas shows behind it
    const tilt = seg % 2 ? "rotateY" : "rotateX";
    const sign = seg % 4 < 2 ? 1 : -1;
    const ang = 180 * u * sign;
    const s = 1 - 0.24 * Math.sin(raw * Math.PI);
    const edge = Math.sin(raw * Math.PI);
    // (turned in the plane — narrowed by the turn's cosine, its near edge
    // lifted — since the download draws a turn in depth flat or not at all)
    const face = (i: number, a: number) => {
      const rad = (a * Math.PI) / 180;
      const narrow = Math.max(0.002, Math.abs(Math.cos(rad)));
      const lift = (Math.sin(rad) * 6).toFixed(3);
      const turn = tilt === "rotateY" ? `scaleX(${narrow.toFixed(4)}) skewY(${lift}deg)` : `scaleY(${narrow.toFixed(4)}) skewX(${lift}deg)`;
      return layer(i, { transformOrigin: "50% 50%", transform: `scale(${s.toFixed(4)}) ${turn}` }, true, { borderRadius: 48 * edge, boxShadow: `0 ${(60 * edge).toFixed(0)}px ${(140 * edge).toFixed(0)}px rgba(0,0,0,${(0.45 * edge).toFixed(2)})` });
    };
    const front = Math.abs(ang) < 90;
    return (
      <>
        {/* (behind the card the canvas turns from one scene's to the next's over the whole flip — never at once) */}
        {props.field(plan.scenes[seg].dark)}
        <AbsoluteFill style={{ opacity: 1 - u }}>{props.field(plan.scenes[seg - 1].dark)}</AbsoluteFill>
        <AbsoluteFill style={{ background: `rgba(0,0,0,${(0.3 * edge).toFixed(2)})` }} />
        {front ? face(seg - 1, ang) : face(seg, ang - 180 * sign)}
      </>
    );
  }
  if (h.kind === "tunnel") {
    const t = tunnelAt(u);
    const around = (S: number) => ({ transform: `translate(960px, 540px) scale(${S.toFixed(5)}) translate(-960px, -540px)` });
    const fade = clamp01((u - 0.2) / 0.5);
    return (
      <>
        {props.sceneField(seg)}
        <AbsoluteFill style={{ opacity: 1 - fade * fade * (3 - 2 * fade) }}>{props.sceneField(seg - 1)}</AbsoluteFill>
        <Warp f={f} k={Math.sin(raw * Math.PI)} travel={seg + u} color={(plan.scenes[seg].dark ? props.pals.dark : props.pals.light).accent} />
        {blur(
          <>
            {t.inO > 0 && layer(seg, { ...around(t.inS), opacity: t.inO }, false)}
            {t.outO > 0 && layer(seg - 1, { ...around(t.outS), opacity: t.outO }, false)}
          </>,
        )}
      </>
    );
  }
  // into a window (dive: the last scene is outside, the next inside) or out
  // of one (reveal: the next scene is outside, the last one inside)
  const dive = h.kind === "dive";
  const outer = dive ? seg - 1 : seg, inner = dive ? seg : seg - 1;
  const z = zoomAt(dive ? u : 1 - u, h.c, h.s);
  const onScreen = h.s * z.Z;
  // the window: rounded on screen while it is small, square when it fills the frame
  const r = (24 * (1 - clamp01((onScreen - 0.4) / 0.6))) / onScreen;
  const o = dive ? clamp01(raw / 0.22) : 1 - clamp01((u - 0.55) / 0.3);
  const ring = props.pals[plan.scenes[outer].dark ? "dark" : "light"];
  return blur(
    <>
      {layer(outer, { transform: outerTransform(z.Z, z.C) })}
      {o > 0 && layer(inner, { transform: innerTransform(z.Z, z.C, h.c, h.s), opacity: o }, true, { borderRadius: r, boxShadow: `0 0 0 ${(3 / onScreen).toFixed(1)}px ${ring.accent}, 0 ${(30 / onScreen).toFixed(0)}px ${(80 / onScreen).toFixed(0)}px ${ring.shadow}` })}
    </>,
  );
}

// A web page that scrolls (see structure.tsx): the scenes are its sections,
// one under the next, each on its own background, in a browser window; the
// page scrolls from one to the next.
function ScrollPage(props: DepthProps) {
  const f = useCurrentFrame();
  const mv = useMemo(() => moves(props.plan), [props.plan]);
  // a section's first things are there as it scrolls into view (a page is already written)
  const plan = useMemo(() => ({ ...props.plan, scenes: props.plan.scenes.map((sc, i) => (i ? { ...sc, items: sc.items.map((it) => (it.at <= sc.from + 24 ? { ...it, at: Math.min(it.at, mv[i].start - 12) } : it)) } : sc)) }), [props.plan, mv]);
  const { y, seg } = scrollAt(f, mv);
  const n = plan.scenes.length;
  const { k, bar } = PAGE;
  const w = W * k, h = H * k;
  const left = (W - w) / 2, top = (H - h - bar) / 2;
  const cur = Math.min(n - 1, Math.round(y / H));
  const pal = plan.scenes[cur].dark ? props.pals.dark : props.pals.light;
  const all = { start: -1, end: plan.duration + 1 };
  const thumbH = Math.max(60, h / n);
  const thumbY = (y / Math.max(1, (n - 1) * H)) * (h - thumbH - 16) + 8;
  return (
    <>
      {props.field(plan.scenes[seg].dark)}
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.38)" }} />
      <div style={{ position: "absolute", left, top, width: w, height: h + bar, borderRadius: 26, overflow: "hidden", boxShadow: `0 50px 140px ${pal.shadow}, 0 0 0 2px ${pal.dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}` }}>
        {/* the browser's bar: three dots and the brand's address */}
        <div style={{ position: "absolute", left: 0, top: 0, width: w, height: bar, background: pal.dark ? "#16171f" : "#f3f4f8", display: "flex", alignItems: "center", gap: 12, padding: "0 26px", boxSizing: "border-box", borderBottom: `1px solid ${pal.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 99, background: c }} />)}
          <div style={{ margin: "0 auto", width: w * 0.42, height: 36, borderRadius: 12, background: pal.dark ? "#262833" : "#ffffff", color: pal.dark ? "#c9cbd6" : "#5a5e6e", fontFamily: props.textFamily, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width={14} height={16} viewBox="0 0 14 16"><rect x={1.5} y={7} width={11} height={8} rx={2} fill="none" stroke="currentColor" strokeWidth={1.8} /><path d="M4,7 V5 a3,3 0 0 1 6,0 V7" fill="none" stroke="currentColor" strokeWidth={1.8} /></svg>
            {plan.brand.url || `${plan.brand.name.toLowerCase()}.com`}
          </div>
          <div style={{ width: 72 }} />
        </div>
        <div style={{ position: "absolute", left: 0, top: bar, width: w, height: h, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H * n, transformOrigin: "0 0", transform: `scale(${k}) translateY(${(-y).toFixed(1)}px)` }}>
            {plan.scenes.map((_, i) => {
              // a section is there once the page starts scrolling to it, while it is in view
              const from = i ? mv[i].start - 2 : 0;
              if (f < from || Math.abs(i * H - y) >= H) return null;
              return (
                <div key={i} style={{ position: "absolute", left: 0, top: i * H, width: W, height: H, overflow: "hidden" }}>
                  {props.sceneField(i)}
                  {!props.bare && <SceneBody {...props} plan={plan} i={i} journey={all} />}
                </div>
              );
            })}
          </div>
          {/* the scroll bar */}
          <div style={{ position: "absolute", right: 8, top: thumbY, width: 9, height: thumbH, borderRadius: 9, background: pal.dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.28)" }} />
        </div>
      </div>
    </>
  );
}

// The light streaming past in a tunnel: points far ahead that rush out past
// the edges (a short streak each) as the camera flies forward.
function Warp({ f, k, travel, color }: { f: number; k: number; travel: number; color: string }) {
  if (k <= 0.01) return null;
  const R = rng(911);
  const lines: ReactNode[] = [];
  for (let j = 0; j < 90; j++) {
    const a = R.next() * Math.PI * 2, rad = R.range(120, 900), z0 = R.next(), w = R.range(1.5, 4);
    const z = 1 - ((z0 + travel * 0.9 + f * 0.0006) % 1);
    const at = (zz: number) => ({ x: W / 2 + Math.cos(a) * rad * (0.16 / Math.max(0.04, zz)), y: H / 2 + Math.sin(a) * rad * (0.16 / Math.max(0.04, zz)) });
    const p = at(z), q = at(z + 0.05);
    lines.push(<line key={j} x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={j % 3 ? "#ffffff" : color} strokeWidth={w * (1.2 - z)} strokeLinecap="round" opacity={k * Math.min(1, (1 - z) * 1.6) * 0.8} />);
  }
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {lines}
    </svg>
  );
}

// (journey.camera: the "New version" — the scene keeps its own camera move on its layer; noGlyph: an icon whose glyph is morphing)
type SceneProps = { journey?: { start: number; end: number; hidden?: (item: number) => boolean; hiddenWord?: (wi: number) => boolean; dim?: number; camera?: boolean; depth?: boolean; noGlyph?: (item: number) => boolean }; i: number; plan: ComposerProps["plan"]; pals: { dark: ReturnType<typeof palette>; light: ReturnType<typeof palette> }; m: ReturnType<typeof moverOf>; display: string; textFamily: string; screens: string[]; texts: (TextBlock | null)[]; D: (i: number) => number; field: (dark: boolean) => ReactNode };

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
// The ghost word (a style's `ghost` — refs 12, 21): the scene's key word
// huge and faint behind its things, drifting slowly; never with the words
// alone (it would only repeat them).
function ghostOf(on: boolean, sc: PlacedScene, tb: TextBlock | null | undefined): string | null {
  if (!on || !tb || !sc.items.some((it) => !isAccent(it))) return null;
  const word = (tb.words.find((w) => w.key) ?? [...tb.words].sort((x, y) => y.t.length - x.t.length)[0])?.t.replace(/[^\p{L}\p{N}%$৳€£-]/gu, "");
  return word && word.length >= 3 ? word : null;
}
function Ghost({ c, word, p, dir }: { c: Ctx; word: string; p: number; dir: number }) {
  const size = Math.min(H * 0.42, (W * 0.95) / Math.max(3, word.length * 0.62));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ fontFamily: c.display, fontSize: size, fontWeight: c.art.weight, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap", textTransform: "uppercase", color: c.pal.ink, opacity: c.pal.dark ? 0.06 : 0.05, transform: `translateX(${dir * (0.5 - p) * W * 0.08}px)` }}>{word}</div>
    </AbsoluteFill>
  );
}

function SceneBody(props: SceneProps) {
  const { i, plan, pals, m, display, textFamily, screens, texts, D, field } = props;
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
  // (on a journey the scene simply stays where it is on the canvas while the camera comes and goes)
  const J = props.journey;
  const start = J ? J.start : sc.from - 2;
  const end = J ? J.end : last ? plan.duration : outAt + dOut;
  if (f < start || f > end) return null;
  const kin = J ? 1 : i ? IN_OUT(ramp(f, start, dIn)) : 1;
  const kout = J ? 0 : last ? 0 : IN_OUT(ramp(f, outAt, dOut));
  const pal = sc.dark ? pals.dark : pals.light;
  const c: Ctx = { f, pal, art, m, display, text: textFamily, brand, screens };
  const o = sc.items.find((q) => !isAccent(q))?.box ?? sc.text?.box ?? { x: W / 2, y: H / 2 };
  const pin = J ? null : presentationOf(sc.enter, sc.seed);
  const pout = J || !next ? null : presentationOf(next.enter, next.seed);
  const outStyle = kout > 0 && !pout ? sceneOut(next.enter, kout) : undefined;
  const inStyle = kin < 1 && !pin ? sceneIn(sc.enter, kin, o) : undefined;
  const p = clamp01((f - sc.from) / Math.max(1, sc.to - sc.from));
  // (on a journey the travelling camera is the movement; the scene keeps only its breathing, flat —
  // the "New version" keeps every scene's own move, its things in front moving more: parallax)
  const own = !J || !!J.camera;
  // ("New version": a move you can see — the reference films' camera — its things in front moving more)
  const cam = cameraOf(own ? sc.camera : "still", p, f, art.energy, J?.camera ? FLOW_CAMERA.scene : 1);
  const parallax = !!J?.camera && !!J.depth;
  const cOf = (it: PlacedItem): Ctx => (J?.noGlyph?.(sc.items.indexOf(it)) ? { ...c, noGlyph: true } : c);
  const flowCursor = (it: PlacedItem) => !!plan.flow && it.kind === "cursor";
  // things that travel on into the next scene leave this one as it goes
  const travels = (it: PlacedItem) => !J && !!(it.id && next?.items.some((q) => q.id === it.id && q.from)) && f >= next.from - 2;
  const sorted = [...sc.items].sort((x, y) => x.z - y.z).filter((it) => !flowCursor(it));
  const still = J ? sorted.filter((it) => !J.hidden?.(sc.items.indexOf(it))) : sorted.filter((it) => !it.from);
  const moving = J ? [] : sorted.filter((it) => it.from);
  const front = still.filter((it) => it.z >= 2 && !travels(it)).map((it, j) => <Thing key={`f${j}`} c={cOf(it)} it={it} idx={j + 10} si={i} />);
  let body = (
    <AbsoluteFill style={inStyle}>
      <AbsoluteFill style={J ? undefined : { perspective: 1800, perspectiveOrigin: "50% 45%" }}>
        <AbsoluteFill style={{ transform: cam, transformStyle: J ? undefined : "preserve-3d", transformOrigin: own && sc.camera === "macro" ? `${Math.round(o.x)}px ${Math.round(o.y)}px` : undefined }}>
          <CtxC.Provider value={c}>
            {own && ghostOf(!!pal.style?.ghost, sc, texts[i]) && <Ghost c={c} word={ghostOf(!!pal.style?.ghost, sc, texts[i])!} p={p} dir={i % 2 ? -1 : 1} />}
            {still.filter((it) => it.z < 2 && !travels(it)).map((it, j) => <Thing key={`b${j}`} c={cOf(it)} it={it} idx={j} si={i} />)}
            {texts[i] && <Headline c={c} tb={texts[i]!} plate={sc.layout === "over" || sc.layout === "caption"} hide={J?.hiddenWord} out={J?.dim} si={i} />}
            {!parallax && front}
            {own && pal.style?.frame && mainOf(sc) && <DesignFrame c={c} it={mainOf(sc)!} />}
            {own && pal.style?.confetti && plan.hero === i && <Confetti c={c} at={sc.from + 10} o={o} />}
            {plan.flow && sc.items.filter((it) => it.kind === "cursor").map((it, j) => <BigCursor key={`k${j}`} c={c} it={it} />)}
          </CtxC.Provider>
        </AbsoluteFill>
        {parallax && (
          <AbsoluteFill style={{ transform: cameraOf(sc.camera, p, f, art.energy, FLOW_CAMERA.front), transformOrigin: sc.camera === "macro" ? `${Math.round(o.x)}px ${Math.round(o.y)}px` : undefined }}>
            <CtxC.Provider value={c}>{front}</CtxC.Provider>
          </AbsoluteFill>
        )}
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
        {moving.filter((it) => !travels(it)).map((it, j) => <Thing key={`m${j}`} c={c} it={it} idx={j + 20} si={i} travel={{ from: it.from!, start, dur: 22 }} />)}
      </CtxC.Provider>
    </AbsoluteFill>
  );
}

// The "New version"'s big cursor (flow.ts withCursor): it glides in on a
// slight arc to the thing the voice is talking about, clicks it (a press and
// a ring), rests a moment and drifts off.
function BigCursor({ c, it }: { c: Ctx; it: PlacedItem }) {
  const click = it.hit ?? it.at + 30;
  if (c.f < it.at - 1 || c.f > click + 62) return null;
  const from = it.from ?? it.box;
  const tIn = IN_OUT(ramp(c.f, it.at, Math.max(8, click - 6 - it.at)));
  const tOut = IN_OUT(ramp(c.f, click + 40, 20));
  const x = mix(from.x, it.box.x, tIn) + tOut * 80;
  const y = mix(from.y, it.box.y, tIn) - Math.sin(tIn * Math.PI) * 46 + tOut * 60;
  const press = clamp01(kIn(c, click - 3, 4) - kIn(c, click + 3, 8));
  const ring = c.f >= click ? clamp01((c.f - click) / 18) : 0;
  const ink = c.pal.dark ? "#ffffff" : "#111111";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none", zIndex: 50, opacity: clamp01((c.f - it.at) / 6) * (1 - tOut) }}>
      {ring > 0 && ring < 1 && <div style={{ position: "absolute", left: it.box.x - 46, top: it.box.y - 46, width: 92, height: 92, borderRadius: 99, border: `4px solid ${c.pal.accent}`, transform: `scale(${mix(0.3, 1.6, ring).toFixed(3)})`, opacity: 1 - ring }} />}
      {/* (its shadow drawn as a shape, not a CSS filter: the browser download draws it too) */}
      <div style={{ position: "absolute", left: x - 31, top: y - 18, width: 132, height: 132, transform: `scale(${(1 - press * 0.16).toFixed(3)})`, transformOrigin: "24% 14%" }}>
        <svg width={132} height={132} viewBox="0 0 24 24">
          <path d="M5.9 4.4 L19.9 13.4 L12.9 14.9 L9.9 21.4 Z" fill={c.pal.dark ? "#000000" : "#000000"} fillOpacity={c.pal.dark ? 0.5 : 0.22} />
          <path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill={ink} stroke={c.pal.dark ? "#111111" : "#ffffff"} strokeWidth={1.3} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// The scene's main thing (its biggest, not an accent).
const mainOf = (sc: PlacedScene) => sc.items.filter((it) => !isAccent(it)).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0] ?? null;

// A design tool's selection round the main thing (ref 17): a thin frame,
// four handles and its name on a tab, drawn once it has come in.
function DesignFrame({ c, it }: { c: Ctx; it: PlacedItem }) {
  const k = enterK(c.m, c.f, it.at + 8, 14);
  if (k <= 0) return null;
  const pad = 14;
  const { x, y, w, h } = it.box;
  const L = x - w / 2 - pad, T = y - h / 2 - pad, Wd = w + pad * 2, Ht = h + pad * 2;
  const col = c.pal.accent;
  const handle = (hx: number, hy: number, key: string) => <div key={key} style={{ position: "absolute", left: hx - 7, top: hy - 7, width: 14, height: 14, background: c.pal.dark ? "#0b0b0d" : "#ffffff", border: `2.5px solid ${col}`, transform: `scale(${k})` }} />;
  const name = (it.title ?? it.variant ?? it.kind).slice(0, 22);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none", zIndex: 40, opacity: clamp01(k * 1.5) }}>
      <div style={{ position: "absolute", left: L, top: T, width: Wd, height: Ht, border: `2px solid ${col}`, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)` }} />
      {handle(L, T, "a")}
      {handle(L + Wd, T, "b")}
      {handle(L, T + Ht, "c")}
      {handle(L + Wd, T + Ht, "d")}
      <div style={{ position: "absolute", left: L, top: T - 38, height: 30, padding: "0 12px", display: "flex", alignItems: "center", background: col, color: c.pal.dark ? "#0b0b0d" : "#ffffff", fontFamily: c.text, fontSize: 17, fontWeight: 600, borderRadius: 6, whiteSpace: "nowrap" }}>
        {name} · {Math.round(w)}×{Math.round(h)}
      </div>
    </div>
  );
}

// A burst of confetti at the hero moment (refs 01, 20): seeded pieces flung
// out from the main thing, falling and turning; gone in under two seconds.
function Confetti({ c, at, o }: { c: Ctx; at: number; o: { x: number; y: number } }) {
  const t = c.f - at;
  if (t < 0 || t > 54) return null;
  const cols = [c.pal.accent, c.pal.accent2, c.pal.fill, c.pal.fill2, c.pal.ink];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none", zIndex: 45 }}>
      {Array.from({ length: 46 }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180;
        const v = 14 + ((i * 53) % 17);
        const x = o.x + Math.cos(a) * v * t * 0.9;
        const y = o.y + Math.sin(a) * v * t * 0.6 - v * t * 0.35 + 0.42 * t * t;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 12 + (i % 3) * 4, height: 7 + (i % 2) * 5, borderRadius: i % 4 === 0 ? 99 : 2, background: cols[i % cols.length], transform: `rotate(${(i * 47 + t * (8 + (i % 5) * 3)) % 360}deg)`, opacity: clamp01((54 - t) / 14) }} />;
      })}
    </div>
  );
}

function Thing({ c, it, idx, si, travel }: { c: Ctx; it: PlacedItem; idx: number; si: number; travel?: { from: { x: number; y: number; w: number; h: number }; start: number; dur: number } }) {
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
  // a thing set at an angle: slanted in the plane (the download draws a turn in depth flat, or not at all inside a moving canvas)
  const tilt = it.tilt ? ` skewY(${(-it.tilt * 0.22).toFixed(2)}deg) scaleX(${Math.cos((it.tilt * Math.PI) / 180).toFixed(4)})` : "";
  return (
    <div {...qaMark(it, si)} style={{ position: "absolute", left: box.x - bw / 2, top: box.y - bh / 2, width: bw, height: bh, transform: `scale(${scale.toFixed(4)})${tilt}${bob}`, zIndex: it.z }}>
      <div style={{ width: bw, height: bh, ...enter, transform: `${(enter as CSSProperties).transform ?? ""}` }}>
        <ItemBody c={c} it={it} w={bw} h={bh} />
      </div>
    </div>
  );
}
