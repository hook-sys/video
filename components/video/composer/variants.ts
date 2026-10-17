import { resolveIcon } from "../icons";
import { inspected } from "./inspect";
import { DISPLAY_FACES, TEXT_FACES, rng } from "./art";
import { LENSES, autoScript, drawArt } from "./auto";
import { type Fit, layoutFits, placeAll, type Problem } from "./layout";
import { type Language, type Staging, sceneAt, stageOf, staged } from "./staging";
import { type HouseRuleSet, houseRules, varyLayouts } from "./rules";
import { ALL_STYLES, type StyleRules, type StyleT, inStyle, pickStyle } from "./style";
import { RECIPES } from "./recipes";
import { matched } from "./meaning";
import { withoutTechniques } from "./techniques";
import { ENERGY, flowStaging } from "./flow";
import { withPieces } from "./pieces";
import { groundIsDark } from "./style";
import type { StoryShape } from "@/lib/studio";
import { ARRANGES, CAMERAS, CARD_VARIANTS, CHART_VARIANTS, DEVICE_VARIANTS, ENTERS, FIELDS, FLOW_VARIANTS, HARMONIES, ICON_STYLES, ITEM_KINDS, KEYS, LAYOUTS, MOTIONS, OVERLAYS, REVEALS, SCHEMES, LOOKS, SHAPE_VARIANTS, SURFACES, TRANSITIONS } from "./types";
import type { ArtT, Brand, CameraKind, ComposerPlan, Energy, GuideKind, ItemT, JourneyKind, KeyStyle, LayoutKind, Reveal, RowT, SceneT, ScriptT, TransitionKind, Word } from "./types";

// Four Composer videos of one narration. With the Director's ideas (its
// scenes, two or three ways to picture each, and its art directions) each
// video takes its own art and its own picture for every scene; without
// them the Composer's own director composes each from a different lens.
// Every video is laid out and checked (layout.ts) before it is kept.

// What the Director writes (loose: anything out of range is mended or dropped).
export type LooseItem = Record<string, unknown>;
export type Ideas = {
  arts: Record<string, unknown>[];
  // enter, reveal, camera: the Director's own choice for the scene (null: drawn here)
  scenes: { at: number; text: { from: number; to: number; size?: string; key?: string[] } | null; kicker?: string | null; enter?: string | null; reveal?: string | null; camera?: string | null; options: { layout?: string | null; arrange?: string | null; items: LooseItem[] }[] }[];
};

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const oneOf = <T extends string>(v: unknown, xs: readonly T[]): T | null => (typeof v === "string" && (xs as readonly string[]).includes(v) ? (v as T) : null);
const int = (v: unknown, n: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(n - 1, Math.round(v))) : null);

export function mendArt(raw: Record<string, unknown> | undefined, fallback: ArtT): ArtT {
  if (!raw) return fallback;
  const display = DISPLAY_FACES.some((f) => f.slug === raw.display) ? String(raw.display) : fallback.display;
  const face = DISPLAY_FACES.find((f) => f.slug === display)!;
  return {
    name: str(raw.name, 40) ?? fallback.name,
    hue: num(raw.hue, 0, 360) ?? fallback.hue,
    harmony: oneOf(raw.harmony, HARMONIES) ?? fallback.harmony,
    scheme: oneOf(raw.scheme, SCHEMES) ?? fallback.scheme,
    field: oneOf(raw.field, FIELDS) ?? fallback.field,
    overlay: oneOf(raw.overlay, OVERLAYS) ?? fallback.overlay,
    surface: oneOf(raw.surface, SURFACES) ?? fallback.surface,
    radius: num(raw.radius, 0, 48) ?? fallback.radius,
    display,
    text: TEXT_FACES.some((f) => f.slug === raw.text) ? String(raw.text) : fallback.text,
    weight: face.fixed ?? num(raw.weight, 400, 900) ?? fallback.weight,
    case: face.upper ? "upper" : (oneOf(raw.case, ["sentence", "upper", "lower"] as const) ?? fallback.case),
    tracking: num(raw.tracking, -0.07, 0.06) ?? fallback.tracking,
    key: oneOf(raw.key, KEYS) ?? fallback.key,
    motion: oneOf(raw.motion, MOTIONS) ?? fallback.motion,
    pace: num(raw.pace, 0.75, 1.35) ?? fallback.pace,
    camera: oneOf(raw.camera, CAMERAS) ?? fallback.camera,
    icons: oneOf(raw.icons, ICON_STYLES) ?? fallback.icons,
    energy: num(raw.energy, 0.1, 0.95) ?? fallback.energy,
    look: oneOf(raw.look, LOOKS) ?? fallback.look ?? null,
    style: fallback.style ?? null,
  };
}

const VARIANTS: Record<string, readonly string[]> = { card: CARD_VARIANTS, chart: CHART_VARIANTS, device: DEVICE_VARIANTS, flow: FLOW_VARIANTS, shape: SHAPE_VARIANTS, chips: ["row", "column"] };
export function mendItem(raw: LooseItem, nWords: number): ItemT | null {
  const kind = oneOf(raw.kind, ITEM_KINDS);
  if (!kind) return null;
  const at = int(raw.at, nWords);
  if (at == null) return null;
  const rows: RowT[] | null = Array.isArray(raw.rows)
    ? (raw.rows as Record<string, unknown>[]).slice(0, 6).flatMap((r) => {
        const title = str(r?.title, 48);
        return title ? [{ title, meta: str(r.meta, 40), tag: str(r.tag, 24), icon: resolveIcon(r.icon) }] : [];
      })
    : null;
  const variant = VARIANTS[kind] ? oneOf(raw.variant, VARIANTS[kind]) : null;
  return {
    kind,
    id: str(raw.id, 24),
    at,
    hit: int(raw.hit, nWords),
    enter: oneOf(raw.enter, ENTERS),
    variant,
    title: str(raw.title, 60),
    sub: str(raw.sub, 80),
    icon: resolveIcon(raw.icon),
    value: str(raw.value, 24),
    values: Array.isArray(raw.values) ? (raw.values as unknown[]).filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(0, 12) : null,
    rows,
    screen: oneOf(raw.screen, CARD_VARIANTS),
    size: oneOf(raw.size, ["s", "m", "l"] as const),
    tilt: num(raw.tilt, -14, 14),
  };
}

// One video from the Director's ideas: its art, and for each scene one of
// the ways to picture it (each video another), dressed with ways in, word
// reveals and camera moves drawn for this video.
export function scriptFromIdeas(ideas: Ideas, v: number, seed: number, words: Word[], brand: Brand, avoid?: Partial<Record<keyof ArtT, unknown[]>>): ScriptT {
  const R = rng(seed);
  const art = mendArt(ideas.arts[v % Math.max(1, ideas.arts.length)], drawArt(R, brand.color, avoid));
  const family = R.shuffle(TRANSITIONS.filter((t) => t !== "morph" && t !== "fade")).slice(0, 3) as TransitionKind[];
  const accentT = R.pick(["iris", "zoom-in", "whip", "flip", "wipe", "clock"] as TransitionKind[]);
  // (one word at a time only where the style's type is giant — style.ts inStyle)
  const reveals = R.shuffle(REVEALS.filter((r) => r !== "beat")).slice(0, 2) as Reveal[];
  const n = words.length;
  let prevT: TransitionKind | null = null;
  const scenes: SceneT[] = ideas.scenes.map((s, i) => {
    const opts = s.options.length ? s.options : [{ items: [] }];
    const o = opts[(v + (i % 2 ? R.int(0, 2) : 0)) % opts.length];
    const items = (o.items ?? []).map((x) => mendItem(x, n)).filter((x): x is ItemT => !!x).slice(0, 6);
    const carried = items.some((x) => x.id && i > 0);
    // (the Director's own way in where it chose one; a carried thing may morph)
    const asked = i === 0 ? null : oneOf(s.enter, TRANSITIONS);
    let enter: TransitionKind = i === 0 ? "fade" : asked && (asked !== "morph" || carried) ? asked : carried && R.chance(0.7) ? "morph" : R.chance(0.18) ? accentT : R.pick(family.filter((t) => t !== prevT));
    if (!enter) enter = "blur";
    const reveal = oneOf(s.reveal, REVEALS.filter((r) => r !== "beat"));
    prevT = enter;
    const from = int(s.text?.from, n), to = int(s.text?.to, n);
    return {
      at: int(s.at, n) ?? 0,
      text: s.text && from != null && to != null ? { from, to, size: oneOf(s.text.size, ["s", "m", "l", "xl"] as const) ?? "l", reveal: reveal ?? (R.chance(0.75) ? reveals[0] : reveals[1]), align: null, key: (s.text.key ?? []).map((k) => String(k).slice(0, 30)).slice(0, 3) } : null,
      kicker: str(s.kicker, 36),
      layout: oneOf(o.layout, LAYOUTS) ?? "center",
      arrange: oneOf(o.arrange, ARRANGES),
      ratio: Number(R.range(0.38, 0.5).toFixed(2)),
      dark: art.scheme === "mixed" ? (i % 3 === 2 ? true : i % 3 === 0 ? false : R.chance(0.5)) : null,
      camera: oneOf(s.camera, CAMERAS) ?? (R.chance(0.7) ? null : R.pick(CAMERAS)),
      enter,
      items,
    };
  });
  // the film ends on the brand's ask (the button says it as the customer did)
  const end = scenes[scenes.length - 1];
  if (end && brand.cta) for (const x of end.items) if (x.kind === "button") x.title = brand.cta;
  if (end && !end.items.some((x) => x.kind === "button")) {
    end.items = [...end.items.filter((x) => x.kind === "logo"), { kind: "button", at: end.at, hit: end.text?.to ?? end.at, id: null, enter: null, variant: null, title: brand.cta, sub: brand.url || null, icon: null, value: null, values: null, rows: null, screen: null, size: "s", tilt: null }];
    if (!["top", "center", "bottom"].includes(end.layout)) end.layout = "top";
    end.arrange = "column";
  }
  return { art, scenes };
}

// "New version" (admin → Settings, "New version: video rules"): which house
// rules the Composer keeps, whether layouts vary, and how the video is laid
// out (fit: its shortest scene, the most words on screen — stored with it).
export type RuleSet = { house: HouseRuleSet; layoutVariety: boolean; fit: Fit };
// "New version": the look drawn for this video (lib/v2/variety.ts) — its
// palette treatment, font pairing, layouts, ways in and camera.
// `recipe`: the reference it is built from (recipes.ts) — the code's look,
// never the Director's style.
// `flow`: the premium motion (flow.ts) — the video's energy, a camera move
// of its own for every scene (from `cameras`), the keyword's highlight,
// depth (glass and soft shadows, parallax), the big cursor, and the
// continuous ways between scenes; each part off with its rule.
// (pieces: the UI piece library fills the product's UI from the script's words — pieces.ts)
export type FlowLook = { energy: Energy; cameras: CameraKind[] | null; key: KeyStyle | null; depth: boolean; cursor: boolean; continuous: boolean; pieces?: boolean };
export type Variety = { recipe?: string | null; harmony: (typeof HARMONIES)[number]; scheme: "dark" | "light"; display: string; text: string; camera: CameraKind; transitions: TransitionKind[]; layouts: LayoutKind[]; flow?: FlowLook | null };

// rules: false — the house rules (rules.ts) are not applied (admin → Settings, "Video rules");
// a RuleSet — only the ones it keeps ("New version")
export type ComposeInput = { words: Word[]; brand: Brand; duration: number; seed: number; ideas?: Ideas | null; avoid?: Partial<Record<keyof ArtT, unknown[]>>; screens?: number; count?: number; avoidStaging?: (Staging | null)[]; creative?: Creative | null; look?: { scheme?: "dark" | "light" | "mixed"; energy?: number } | null; size?: [number, number]; rules?: boolean | RuleSet; variety?: Variety | null; match?: boolean; techOff?: string[]; styles?: StyleRules | null; avoidStyles?: (StyleT | null)[] };

// What the Motion Director decided that the build keeps (lib/studio.ts
// CreativePlan): the camera language, the scheme, where the story turns and
// the hero moment (word indexes), the motif.
export type Creative = { shape?: StoryShape | null; language: Language; journey?: JourneyKind | null; guide?: GuideKind | null; recap?: boolean; scheme?: "dark" | "light" | "mixed"; hero?: number | null; turn?: number | null; motif?: { icon: string; label: string } | null };

// A script shaped by the plan and the house rules (rules.ts): the plan's
// scheme, the brand's energy; a motif badge where the story turns and at the
// hero moment (the AI Director places its own); one dark → light turn; the
// scenes' compositions varied.
function shaped(script: ScriptT, creative: Creative | null | undefined, look: ComposeInput["look"], byRule: boolean, seed: number, rules: boolean | RuleSet = true, layouts?: readonly LayoutKind[]): ScriptT {
  let out: ScriptT = { ...script, art: { ...script.art } };
  const scheme = creative?.scheme ?? look?.scheme;
  if (scheme) out.art.scheme = scheme;
  if (byRule && look?.energy != null) out.art.energy = Math.max(0, Math.min(1, look.energy));
  const sceneOf = (word: number | null | undefined) => (word == null ? null : Math.max(0, out.scenes.findLastIndex((x) => x.at <= word)));
  const turn = sceneOf(creative?.turn);
  if (byRule && creative?.motif) {
    // where the story turns, at the hero moment, and once more between them or after (2–3 scenes)
    const hero = sceneOf(creative.hero);
    const marks = [...new Set([turn, hero, turn != null ? turn + 1 : null].filter((x): x is number => x != null && x > 0 && x < out.scenes.length - 1))];
    out = { ...out, scenes: out.scenes.map((sc, i) => (marks.includes(i) && !sc.items.some((it) => it.kind === "badge") && sc.items.length ? { ...sc, items: [...sc.items, { kind: "badge", at: sc.at, icon: resolveIcon(creative.motif!.icon) ?? "sparkles", title: creative.motif!.label, size: "s" }] } : sc)) };
  }
  // told as kinetic type (the plan by rule): the words are the picture — big
  // type alone on every scene but the hero moment and the end
  if (byRule && creative?.shape === "kinetic-type") {
    const hero = sceneOf(creative.hero);
    const last = out.scenes.length - 1;
    out = { ...out, scenes: out.scenes.map((sc, i) => (i === hero || i === last || !sc.text ? sc : { ...sc, layout: "type", arrange: null, items: sc.items.filter((it) => it.kind === "badge"), text: { ...sc.text, size: "xl" } })) };
  }
  // told demo-first or feature-led: the film opens on the product (its screen, or its first card)
  if (byRule && (creative?.shape === "demo-first" || creative?.shape === "feature-led") && out.scenes.length > 2) {
    const want = creative.shape === "demo-first" ? ["device", "screenshot", "card"] : ["card", "device", "chart"];
    const first = out.scenes[0];
    const has = first.items.some((it) => want.includes(it.kind));
    const pool = out.scenes.slice(1, -1).flatMap((sc) => sc.items);
    const from = want.map((k) => pool.find((it) => it.kind === k)).find((it) => !!it);
    if (!has && from) out = { ...out, scenes: [{ ...first, layout: first.text ? "center" : "visual", arrange: null, items: [...first.items.filter((it) => it.kind === "badge"), { ...from, id: null, at: first.at, hit: null, size: "l" }] }, ...out.scenes.slice(1)] };
  }
  if (rules === true) return varyLayouts(houseRules(out, turn), seed);
  if (rules === false) return out;
  const kept = houseRules(out, turn, rules.house);
  return rules.layoutVariety ? varyLayouts(kept, seed, layouts) : layouts ? inLayouts(kept, layouts) : kept;
}

// Every scene with things in one of the allowed layouts (the first that fits,
// taken in turn; a scene none fits keeps its own).
function inLayouts(script: ScriptT, allowed: readonly LayoutKind[]): ScriptT {
  return {
    ...script,
    scenes: script.scenes.map((s, i) => {
      const things = s.items.filter((it) => !["badge", "shape", "cursor"].includes(it.kind)).length;
      if (!things || allowed.includes(s.layout)) return s;
      const pick = [...allowed.slice(i % allowed.length), ...allowed.slice(0, i % allowed.length)].find((l) => l !== "type" && layoutFits(l, s.items, !!s.text));
      return pick ? { ...s, layout: pick, arrange: null } : s;
    }),
  };
}

// The look drawn for a "New version" video, over the style: its palette
// treatment and background, its font pairing, its camera, and its ways in.
export function withVariety(sc: ScriptT, v: Variety, seed = 1): ScriptT {
  const face = DISPLAY_FACES.find((f) => f.slug === v.display);
  // (dark or light follows the style's ground — the Director is told the
  // look's, and chooses its ground to match; set here only without a style)
  const art: ArtT = { ...sc.art, harmony: v.harmony, ...(sc.art.style ? {} : { scheme: v.scheme }), display: v.display, text: v.text, camera: v.camera, weight: face?.fixed ?? sc.art.weight, ...(face?.upper ? { case: "upper" as const } : {}) };
  if (v.flow) return withFlow({ ...sc, art }, v.flow, seed);
  return {
    art,
    scenes: sc.scenes.map((s, i) => ({ ...s, enter: v.transitions.includes(s.enter) ? s.enter : v.transitions[i % v.transitions.length], camera: s.camera && s.camera !== v.camera ? v.camera : s.camera })),
  };
}

// The premium motion over the look (flow.ts): the energy's springs and pace;
// every scene its own slow camera move (the Director's where the energy has
// it, never the same twice in a row, never still); the keyword lit in the
// brand colour or on a pill; the brand colour and one harmonious accent;
// glass or softly lifted cards. The ways between scenes are staged later
// (each scene's own way in is kept: the Director's choice).
function withFlow(sc: ScriptT, fl: FlowLook, seed: number): ScriptT {
  const e = ENERGY[fl.energy];
  const R = rng((seed ^ 0x68e31da4) >>> 0 || 1);
  const style = sc.art.style;
  const dark = style ? groundIsDark(style.ground) : sc.art.scheme !== "light";
  const art: ArtT = {
    ...sc.art,
    motion: e.motion,
    pace: e.pace,
    energy: e.level,
    ...(fl.key ? { key: fl.key } : {}),
    ...(fl.depth ? { surface: "glass" as const } : {}),
    style: style ? { ...style, accent: "brand", ...(fl.depth ? { card: dark ? "glass" : style.card === "glass" || style.card === "lifted" ? style.card : "lifted" } : {}) } : style,
  };
  const pool = fl.cameras?.length ? fl.cameras : null;
  let prev: CameraKind | null = null;
  // (a scene's one thing is its hero: big — the product's UI owns the frame)
  const solo = (s: SceneT) => s.items.filter((it) => !["badge", "shape", "cursor"].includes(it.kind));
  const scenes = sc.scenes.map((s0) => {
    const one = solo(s0);
    const s = one.length === 1 && one[0].kind !== "button" && one[0].kind !== "logo" && one[0].size !== "l" ? { ...s0, items: s0.items.map((it) => (it === one[0] ? { ...it, size: "l" as const } : it)) } : s0;
    let camera: CameraKind = pool ? (s.camera && pool.includes(s.camera) && s.camera !== prev ? s.camera : R.pick(pool.filter((c) => c !== prev))) : art.camera;
    if (camera === "still") camera = "drift";
    prev = camera;
    return { ...s, camera };
  });
  return { art, scenes };
}

// A video as stored: its script and seed (laid out again on the voice's words
// when shown) and how it is staged (staging.ts; older videos: cuts).
export type StoredComposition = { script: ScriptT; seed: number; source: ComposerPlan["source"]; staging?: Staging | null; fit?: Fit };

export function composeVariants({ words, brand, duration, seed, ideas, avoid, screens = 0, count = 4, avoidStaging = [], creative, look, size, rules = true, variety = null, match = true, techOff = [], styles = ALL_STYLES, avoidStyles = [] }: ComposeInput): { plans: ComposerPlan[]; videos: StoredComposition[]; problems: string[] } {
  const problems: string[] = [];
  const plans: ComposerPlan[] = [];
  const videos: StoredComposition[] = [];
  const used: Partial<Record<keyof ArtT, unknown[]>> = { ...avoid };
  const made: StyleT[] = [];
  // every video in its own style (style.ts): the Director's, or a reference's
  // changed — unlike the other videos of this set and this customer's last
  // ones (admin → Settings, "Looks"; off: the first light glass look)
  // and every scene's things checked against its words (meaning.ts; admin → Settings, "Visual match")
  let matchNotes: string[] = [];
  const built = (sc: ScriptT, s: number, asked: unknown) => {
    let out = sc;
    // ("New version": its drawn recipe, not the Director's style)
    const forced = variety?.recipe ? RECIPES.find((r) => r.id === variety.recipe) : null;
    if (styles) {
      const { style, recipe } = forced ? pickStyle(null, s, [forced], made, avoidStyles, { ...styles, director: false, recipes: null }) : pickStyle(asked, s, RECIPES, made, avoidStyles, styles);
      made.push(style);
      // ("New version": the recipe's giant type never takes the Director's things away — only a kinetic-type story is told in words alone)
      out = inStyle(sc, variety?.flow && style.size === "giant" && creative?.shape !== "kinetic-type" ? { ...style, size: "big" } : style, s, recipe);
    } else out = { ...sc, art: { ...sc.art, look: null, style: null } };
    if (match) {
      const m = matched(out, words);
      out = m.script;
      matchNotes = m.problems;
    }
    if (variety?.flow?.pieces) out = withPieces(out, words);
    if (variety) out = withVariety(out, variety, s);
    return fitScript(withoutTechniques(out, techOff));
  };
  const fit: Fit | undefined = typeof rules === "object" ? rules.fit : undefined;
  for (let v = 0; v < count; v++) {
    const s = (seed + v * 104729) >>> 0;
    // each video avoids the faces, fields and schemes of the ones before it
    const avoidNow: Partial<Record<keyof ArtT, unknown[]>> = { display: [...(used.display ?? [])], field: [...(used.field ?? [])], key: [...(used.key ?? [])], surface: [...(used.surface ?? [])], hue: [...(used.hue ?? [])] };
    let script: ScriptT = ideas?.scenes.length ? scriptFromIdeas(ideas, v, s, words, brand, avoidNow) : autoScript({ words, brand, seed: s, lens: LENSES[v % LENSES.length], avoid: avoidNow, screens });
    const asked = ideas?.arts.length ? ideas.arts[v % ideas.arts.length]?.style : null;
    script = built(shaped(script, creative, look, !ideas?.scenes.length, s, rules, variety?.layouts), s, asked);
    let placed = placeAll(script, words, duration, brand, s, screens, ideas ? "director" : "auto", size, fit);
    if (ideas && tooBroken(placed.problems, placed.plan)) {
      problems.push(`video ${v + 1}: the Director's scenes did not lay out (${placed.problems.slice(0, 3).map((p) => p.what).join("; ")}) — composed by the Composer instead`);
      script = built(shaped(autoScript({ words, brand, seed: s, lens: LENSES[v % LENSES.length], avoid: avoidNow, screens }), creative, look, true, s, rules, variety?.layouts), s, asked);
      placed = placeAll(script, words, duration, brand, s, screens, "auto", size, fit);
    }
    placed.problems.forEach((p) => problems.push(`video ${v + 1}, scene ${p.scene + 1}: ${p.what}`));
    matchNotes.forEach((p) => problems.push(`video ${v + 1}, ${p}`));
    for (const k of ["display", "field", "key", "surface", "hue"] as const) (used[k] ??= []).push(placed.plan.art[k]);
    // how it is staged: the Motion Director's camera language (else one drawn,
    // unlike the ones before it), its signature move at the hero moment
    const heroWord = creative?.hero != null ? words[Math.max(0, Math.min(words.length - 1, creative.hero))] : null;
    const direction = creative ? { language: creative.language, journey: creative.journey, guide: creative.guide, recap: creative.recap, hero: heroWord ? sceneAt(placed.plan, Math.round(heroWord.start * 30)) : null } : null;
    // ("New version": its own flow — flow.ts — the Director's ways in kept where it chose them)
    const staging = variety?.flow ? flowStaging(placed.plan, s, variety.flow.energy, { hero: direction?.hero ?? null, asked: askedOf(placed.plan, ideas, words), continuous: variety.flow.continuous, cursor: variety.flow.cursor, depth: variety.flow.depth }) : stageOf(placed.plan, s, [...avoidStaging, ...videos.map((x) => x.staging ?? null)], direction);
    // the Frame Inspector: what a viewer would see wrong, mended; the rest reported (for the review and the score)
    const qa = inspected(staged(placed.plan, staging));
    qa.left.forEach((f) => problems.push(`video ${v + 1}, scene ${f.scene + 1}: ${f.what}`));
    plans.push(qa.plan);
    videos.push({ script, seed: s, source: placed.plan.source, staging, ...(fit ? { fit } : {}) });
  }
  return { plans, videos, problems };
}
const tooBroken = (p: Problem[], plan: ComposerPlan) => plan.scenes.length < 2 || p.length > Math.max(2, plan.scenes.length / 3);

// The way into each scene the Director chose (each laid-out scene matched to
// the Director's scene that starts nearest it; null: its choice is the code's).
function askedOf(plan: ComposerPlan, ideas: Ideas | null | undefined, words: Word[]): (TransitionKind | null)[] {
  if (!ideas?.scenes.length) return plan.scenes.map(() => null);
  const at = ideas.scenes.map((x) => ({ f: Math.round((words[Math.max(0, Math.min(words.length - 1, x.at))]?.start ?? 0) * 30), asked: oneOf(x.enter, TRANSITIONS) }));
  return plan.scenes.map((s) => {
    const near = at.reduce((b, x) => (Math.abs(x.f - s.from) < Math.abs(b.f - s.from) ? x : b), at[0]);
    return Math.abs(near.f - s.from) < 45 ? near.asked : null;
  });
}

// A script within the stored schema's limits (long words cut, extra rows dropped).
export function fitScript(sc: ScriptT): ScriptT {
  const cut = (v: string | null | undefined, n: number) => (v == null ? v : v.slice(0, n));
  return {
    art: { ...sc.art, name: sc.art.name.slice(0, 40), display: sc.art.display.slice(0, 40), text: sc.art.text.slice(0, 40) },
    scenes: sc.scenes.slice(0, 24).map((s) => ({
      ...s,
      kicker: cut(s.kicker, 36),
      text: s.text ? { ...s.text, key: (s.text.key ?? []).slice(0, 4).map((k) => k.slice(0, 30)) } : s.text,
      items: s.items.slice(0, 7).map((it) => ({
        ...it,
        id: cut(it.id, 24),
        variant: cut(it.variant, 16),
        title: cut(it.title, 60),
        sub: cut(it.sub, 80),
        icon: it.icon ? resolveIcon(it.icon) : it.icon,
        value: cut(it.value, 24),
        values: it.values ? it.values.slice(0, 12) : it.values,
        tilt: it.tilt == null ? it.tilt : Math.max(-20, Math.min(20, it.tilt)),
        rows: it.rows ? it.rows.slice(0, 6).map((r) => ({ ...r, title: r.title.slice(0, 48), meta: cut(r.meta, 40), tag: cut(r.tag, 24), icon: r.icon ? resolveIcon(r.icon) : r.icon })) : it.rows,
      })),
    })),
  };
}

// What a customer has seen (to keep the next videos different).
export const artSignature = (a: ArtT) => ({ display: a.display, field: a.field, key: a.key, surface: a.surface });
