import { resolveIcon } from "../icons";
import { DISPLAY_FACES, TEXT_FACES, rng } from "./art";
import { LENSES, autoScript, drawArt } from "./auto";
import { placeAll, type Problem } from "./layout";
import { type Language, type Staging, sceneAt, stageOf, staged } from "./staging";
import { houseRules, varyLayouts } from "./rules";
import { ARRANGES, CAMERAS, CARD_VARIANTS, CHART_VARIANTS, DEVICE_VARIANTS, ENTERS, FIELDS, FLOW_VARIANTS, HARMONIES, ICON_STYLES, ITEM_KINDS, KEYS, LAYOUTS, MOTIONS, OVERLAYS, REVEALS, SCHEMES, SHAPE_VARIANTS, SURFACES, TRANSITIONS } from "./types";
import type { ArtT, Brand, ComposerPlan, GuideKind, ItemT, JourneyKind, Reveal, RowT, SceneT, ScriptT, TransitionKind, Word } from "./types";

// Four Composer videos of one narration. With the Director's ideas (its
// scenes, two or three ways to picture each, and its art directions) each
// video takes its own art and its own picture for every scene; without
// them the Composer's own director composes each from a different lens.
// Every video is laid out and checked (layout.ts) before it is kept.

// What the Director writes (loose: anything out of range is mended or dropped).
export type LooseItem = Record<string, unknown>;
export type Ideas = {
  arts: Record<string, unknown>[];
  scenes: { at: number; text: { from: number; to: number; size?: string; key?: string[] } | null; kicker?: string | null; options: { layout?: string | null; arrange?: string | null; items: LooseItem[] }[] }[];
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
  const reveals = R.shuffle(REVEALS).slice(0, 2) as Reveal[];
  const n = words.length;
  let prevT: TransitionKind | null = null;
  const scenes: SceneT[] = ideas.scenes.map((s, i) => {
    const opts = s.options.length ? s.options : [{ items: [] }];
    const o = opts[(v + (i % 2 ? R.int(0, 2) : 0)) % opts.length];
    const items = (o.items ?? []).map((x) => mendItem(x, n)).filter((x): x is ItemT => !!x).slice(0, 6);
    const carried = items.some((x) => x.id && i > 0);
    let enter: TransitionKind = i === 0 ? "fade" : carried && R.chance(0.7) ? "morph" : R.chance(0.18) ? accentT : R.pick(family.filter((t) => t !== prevT));
    if (!enter) enter = "blur";
    prevT = enter;
    const from = int(s.text?.from, n), to = int(s.text?.to, n);
    return {
      at: int(s.at, n) ?? 0,
      text: s.text && from != null && to != null ? { from, to, size: oneOf(s.text.size, ["s", "m", "l", "xl"] as const) ?? "l", reveal: R.chance(0.75) ? reveals[0] : reveals[1], align: null, key: (s.text.key ?? []).map((k) => String(k).slice(0, 30)).slice(0, 3) } : null,
      kicker: str(s.kicker, 36),
      layout: oneOf(o.layout, LAYOUTS) ?? "center",
      arrange: oneOf(o.arrange, ARRANGES),
      ratio: Number(R.range(0.38, 0.5).toFixed(2)),
      dark: art.scheme === "mixed" ? (i % 3 === 2 ? true : i % 3 === 0 ? false : R.chance(0.5)) : null,
      camera: R.chance(0.7) ? null : R.pick(CAMERAS),
      enter,
      items,
    };
  });
  // the film ends on the brand's ask
  const end = scenes[scenes.length - 1];
  if (end && !end.items.some((x) => x.kind === "button")) {
    end.items = [...end.items.filter((x) => x.kind === "logo"), { kind: "button", at: end.at, hit: end.text?.to ?? end.at, id: null, enter: null, variant: null, title: brand.cta, sub: brand.url || null, icon: null, value: null, values: null, rows: null, screen: null, size: "s", tilt: null }];
    if (!["top", "center", "bottom"].includes(end.layout)) end.layout = "top";
    end.arrange = "column";
  }
  return { art, scenes };
}

export type ComposeInput = { words: Word[]; brand: Brand; duration: number; seed: number; ideas?: Ideas | null; avoid?: Partial<Record<keyof ArtT, unknown[]>>; screens?: number; count?: number; avoidStaging?: (Staging | null)[]; creative?: Creative | null; look?: { scheme?: "dark" | "light" | "mixed"; energy?: number } | null; size?: [number, number] };

// What the Creative Director decided that the build keeps (lib/studio.ts
// CreativePlan): the camera language, the scheme, where the story turns and
// the hero moment (word indexes), the motif.
export type Creative = { language: Language; journey?: JourneyKind | null; guide?: GuideKind | null; recap?: boolean; scheme?: "dark" | "light" | "mixed"; hero?: number | null; turn?: number | null; motif?: { icon: string; label: string } | null };

// A script shaped by the plan and the house rules (rules.ts): the plan's
// scheme, the brand's energy; a motif badge where the story turns and at the
// hero moment (the AI Director places its own); one dark → light turn; the
// scenes' compositions varied.
function shaped(script: ScriptT, creative: Creative | null | undefined, look: ComposeInput["look"], byRule: boolean, seed: number): ScriptT {
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
  return varyLayouts(houseRules(out, turn), seed);
}

// A video as stored: its script and seed (laid out again on the voice's words
// when shown) and how it is staged (staging.ts; older videos: cuts).
export type StoredComposition = { script: ScriptT; seed: number; source: ComposerPlan["source"]; staging?: Staging | null };

export function composeVariants({ words, brand, duration, seed, ideas, avoid, screens = 0, count = 4, avoidStaging = [], creative, look, size }: ComposeInput): { plans: ComposerPlan[]; videos: StoredComposition[]; problems: string[] } {
  const problems: string[] = [];
  const plans: ComposerPlan[] = [];
  const videos: StoredComposition[] = [];
  const used: Partial<Record<keyof ArtT, unknown[]>> = { ...avoid };
  for (let v = 0; v < count; v++) {
    const s = (seed + v * 104729) >>> 0;
    // each video avoids the faces, fields and schemes of the ones before it
    const avoidNow: Partial<Record<keyof ArtT, unknown[]>> = { display: [...(used.display ?? [])], field: [...(used.field ?? [])], key: [...(used.key ?? [])], surface: [...(used.surface ?? [])], hue: [...(used.hue ?? [])] };
    let script: ScriptT = ideas?.scenes.length ? scriptFromIdeas(ideas, v, s, words, brand, avoidNow) : autoScript({ words, brand, seed: s, lens: LENSES[v % LENSES.length], avoid: avoidNow, screens });
    script = fitScript(shaped(script, creative, look, !ideas?.scenes.length, s));
    let placed = placeAll(script, words, duration, brand, s, screens, ideas ? "director" : "auto", size);
    if (ideas && tooBroken(placed.problems, placed.plan)) {
      problems.push(`video ${v + 1}: the Director's scenes did not lay out (${placed.problems.slice(0, 3).map((p) => p.what).join("; ")}) — composed by the Composer instead`);
      script = fitScript(shaped(autoScript({ words, brand, seed: s, lens: LENSES[v % LENSES.length], avoid: avoidNow, screens }), creative, look, true, s));
      placed = placeAll(script, words, duration, brand, s, screens, "auto", size);
    }
    placed.problems.forEach((p) => problems.push(`video ${v + 1}, scene ${p.scene + 1}: ${p.what}`));
    for (const k of ["display", "field", "key", "surface", "hue"] as const) (used[k] ??= []).push(placed.plan.art[k]);
    // how it is staged: the Creative Director's camera language (else one drawn,
    // unlike the ones before it), its signature move at the hero moment
    const heroWord = creative?.hero != null ? words[Math.max(0, Math.min(words.length - 1, creative.hero))] : null;
    const direction = creative ? { language: creative.language, journey: creative.journey, guide: creative.guide, recap: creative.recap, hero: heroWord ? sceneAt(placed.plan, Math.round(heroWord.start * 30)) : null } : null;
    const staging = stageOf(placed.plan, s, [...avoidStaging, ...videos.map((x) => x.staging ?? null)], direction);
    plans.push(staged(placed.plan, staging));
    videos.push({ script, seed: s, source: placed.plan.source, staging });
  }
  return { plans, videos, problems };
}
const tooBroken = (p: Problem[], plan: ComposerPlan) => plan.scenes.length < 2 || p.length > Math.max(2, plan.scenes.length / 3);

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
